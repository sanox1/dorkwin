const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const helmet = require('helmet');
const schedule = require('node-schedule'); // ← ADD THIS

const app = express();
const PORT = 3000;

// ===== SECURITY MIDDLEWARE =====
// Use Helmet with sensible defaults
app.use(helmet());

// Customize Helmet for your API
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "http://EXTERNAL_RPC_IP:3000"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: false,
}));

// ===== RATE LIMITING CONFIGURATION =====
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests, please slow down',
        friendlyMessage: '⏳ Too many requests! Please wait a moment.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});

// Strict rate limit for sensitive endpoints (play, send, balance)
const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        error: 'Too many play attempts, please wait',
        friendlyMessage: '⏳ Too many attempts! Please wait a moment.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    // Key generator to rate-limit by IP (or combination of IP + address)
    keyGenerator: (req) => {
        const address = req.body.address || req.params.address || 'unknown';
        const ipKey = ipKeyGenerator(req.ip);
        return `${req.ip}-${address}`;
    }
});

// ===== PER-ADDRESS RATE LIMITING =====
const addressPlayTracker = new Map();
const ipPlayTracker = new Map();

setInterval(() => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    for (const [key, value] of addressPlayTracker.entries()) {
        if (value.timestamp < oneDayAgo) {
            addressPlayTracker.delete(key);
        }
    }
    // Clean IP tracker too
    for (const [key, value] of ipPlayTracker.entries()) {
        if (value.timestamp < oneDayAgo) {
            ipPlayTracker.delete(key);
        }
    }
}, 60 * 60 * 1000);

// ===== IP LIMIT MIDDLEWARE =====
const ipLimitMiddleware = async (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (!clientIp) {
        return next();
    }
    
    const today = new Date().toISOString().split('T')[0];
    const key = `${clientIp}-${today}`;
    const now = Date.now();
    
    // Load current data to check IP plays
    const data = loadLottoData();
    const todayPlays = data.ipPlays?.[clientIp] || [];
    
    // Check if this IP has already played today
    if (todayPlays.length > 0) {
        // If IP already played, check if it's the same address
        const address = req.body.address;
        const existingAddress = todayPlays[0];
        
        if (address && existingAddress !== address) {
            // Different wallet from same IP - block it!
            return res.status(403).json({
                error: 'Multiple wallets from same IP not allowed',
                friendlyMessage: '❌ You can only play with one wallet per day from this IP address!'
            });
        }
    }
    
    // Check memory-based rate limit for IP (prevent rapid switching)
    if (ipPlayTracker.has(key)) {
        const data = ipPlayTracker.get(key);
        const timeSinceLastAttempt = (now - data.timestamp) / 1000;
        
        // Allow retry after 5 seconds
        if (timeSinceLastAttempt < 5 && data.count >= 1) {
            return res.status(429).json({
                error: 'Too many attempts, please wait',
                friendlyMessage: `⏳ Please wait ${Math.ceil(5 - timeSinceLastAttempt)} seconds before trying again`
            });
        }
        
        ipPlayTracker.set(key, {
            count: data.count + 1,
            timestamp: now
        });
    } else {
        ipPlayTracker.set(key, {
            count: 1,
            timestamp: now
        });
    }
    
    // Store IP in request for later logging
    req.clientIp = clientIp;
    next();
};

// ===== ADDRESS LIMIT MIDDLEWARE =====
const addressLimitMiddleware = async (req, res, next) => {
    const address = req.body.address || req.params.address;
    
    if (!address) {
        return next();
    }
    
    // Validate address format first
    if (!isValidDorkcoinAddress(address)) {
        return res.status(400).json({
            error: 'Invalid Dorkcoin wallet address format',
            friendlyMessage: '❌ Invalid wallet address! Must be exactly 34 characters starting with "D"'
        });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const key = `${address}-${today}`;
    const now = Date.now();
    
    // Check if address already has a play recorded for today (from file)
    const hasPlayed = hasPlayedToday(address);
    if (hasPlayed) {
        return res.status(400).json({
            error: 'Already played today! Come back tomorrow at 12:00 UTC!',
            friendlyMessage: '⏳ Already played today! Come back tomorrow at 12:00 UTC!'
        });
    }
    
    // Check memory-based rate limit (additional protection against race conditions)
    if (addressPlayTracker.has(key)) {
        const data = addressPlayTracker.get(key);
        const timeSinceLastAttempt = (now - data.timestamp) / 1000;
        
        // Allow retry after 5 seconds (prevents accidental double-clicks)
        if (timeSinceLastAttempt < 5 && data.count >= 1) {
            return res.status(429).json({
                error: 'Too many attempts, please wait',
                friendlyMessage: `⏳ Please wait ${Math.ceil(5 - timeSinceLastAttempt)} seconds before trying again`
            });
        }
        
        // Update existing entry
        addressPlayTracker.set(key, {
            count: data.count + 1,
            timestamp: now
        });
    } else {
        // Create new entry
        addressPlayTracker.set(key, {
            count: 1,
            timestamp: now
        });
    }
    
    next();
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(generalLimiter);

// ===== APPLY STRICT LIMITS =====
app.post('/api/play', strictLimiter);
app.post('/api/validate-address', strictLimiter);
app.get('/api/balance/:address', strictLimiter);
app.get('/api/stats', generalLimiter);
app.get('/api/canplay/:address', generalLimiter);
app.get('/api/test-telegram', strictLimiter);

// ===== CONFIGURATION =====
const RPC_URL = 'http://127.0.0.1:22555';
const RPC_USER = 'YOURUSER';
const RPC_PASS = 'YOURPASSWORD';

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'YOUR_TG_CHAT_ID';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Lotto Configuration
const DATA_FILE = path.join(__dirname, 'lotto_data.json');

// Prize Tiers
const PRIZES = [
    { name: 'Mythic', emoji: '👑', chance: 0.005, amount: 500, tier: 1 },
    { name: 'Legendary', emoji: '💎', chance: 0.030, amount: 250, tier: 2 },
    { name: 'Epic', emoji: '🪨', chance: 0.100, amount: 50, tier: 3 },
    { name: 'Rare', emoji: '🔨', chance: 0.200, amount: 15, tier: 4 },
    { name: 'Common', emoji: '🥦', chance: 0.350, amount: 5, tier: 5 },
    { name: 'No Luck', emoji: '😢', chance: 0.315, amount: 0, tier: 6 }
];

// ===== HELPER FUNCTIONS =====

// Validate Dorkcoin address format - EXACTLY 34 characters, starts with 'D'
function isValidDorkcoinAddress(address) {
    // Must be a string
    if (!address || typeof address !== 'string') return false;
    address = address.trim();
    if (address.length !== 34) return false;
    if (!address.startsWith('D')) return false;
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < address.length; i++) {
        if (!validChars.includes(address[i])) {
            return false;
        }
    }
    return true;
}

// Generic RPC caller - IMPROVED ERROR HANDLING
async function callRPC(method, params = []) {
    try {
        const response = await axios.post(RPC_URL, {
            jsonrpc: '1.0',
            id: 'dorkcoin',
            method: method,
            params: params
        }, {
            auth: {
                username: RPC_USER,
                password: RPC_PASS
            },
            headers: { 'Content-Type': 'text/plain' },
            // Don't throw on HTTP 500 - we want to inspect the response
            validateStatus: function(status) {
                return status >= 200 && status < 600;
            }
        });
        
        // Check if response has error
        if (response.data && response.data.error) {
            const errorMsg = response.data.error.message || 'Unknown RPC error';
            
            // Check for invalid address errors
            if (errorMsg.includes('Invalid address') || 
                errorMsg.includes('invalid address') ||
                errorMsg.includes('not valid') ||
                errorMsg.includes('Invalid Dorkcoin address') ||
                errorMsg.includes('sendtoaddress') && errorMsg.includes('invalid')) {
                
                const customError = new Error('Invalid Dorkcoin wallet address - address does not exist or is invalid');
                customError.isInvalidAddress = true;
                customError.isRpcError = true;
                customError.rpcError = response.data.error;
                throw customError;
            }
            
            // Other RPC errors
            const rpcError = new Error(`RPC Error: ${errorMsg}`);
            rpcError.isRpcError = true;
            rpcError.rpcError = response.data.error;
            throw rpcError;
        }
        
        return response.data.result;
    } catch (error) {
        // If it's already a custom error, re-throw it
        if (error.isInvalidAddress || error.isRpcError) {
            throw error;
        }
        
        // Handle axios network errors
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
                const connError = new Error('Cannot connect to Dorkcoin RPC server');
                connError.isConnectionError = true;
                throw connError;
            }
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                const errorMsg = error.response.data?.error?.message || 
                                error.response.data?.message || 
                                `HTTP ${error.response.status}: ${error.response.statusText}`;
                const rpcError = new Error(`RPC Error: ${errorMsg}`);
                rpcError.isRpcError = true;
                rpcError.statusCode = error.response.status;
                rpcError.responseData = error.response.data;
                throw rpcError;
            }
        }
        
        // Re-throw other errors
        throw error;
    }
}

// ===== Telegram Notification Function =====
async function sendTelegramNotification(message) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('✅ Telegram notification sent');
    } catch (error) {
        console.error('❌ Failed to send Telegram notification:', error.message);
    }
}

// Load lottery data from file
function loadLottoData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading lotto data:', error);
    }
    return { plays: {}, ipPlays: {}, ipAddresses: {}, lastReset: null };
}

// Save lottery data to file
function saveLottoData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving lotto data:', error);
    }
}

// ===== FIXED RESET FUNCTIONS =====

// Check if reset is needed - COMPLETELY REWRITTEN
function needsReset() {
    const data = loadLottoData();
    if (!data.lastReset) return true;
    
    const now = new Date();
    const lastReset = new Date(data.lastReset);
    
    // Get today's reset time (12:00 UTC)
    const todayReset = new Date(now);
    todayReset.setUTCHours(12, 0, 0, 0);
    
    // If now is before today's reset (e.g., 10:00 UTC), we need to check
    // if the last reset was yesterday or earlier
    if (now < todayReset) {
        // Check if lastReset was before yesterday's reset
        const yesterdayReset = new Date(todayReset);
        yesterdayReset.setUTCDate(yesterdayReset.getUTCDate() - 1);
        return lastReset < yesterdayReset;
    } else {
        // Now is after today's reset (e.g., 13:00 UTC)
        // Check if lastReset was before today's reset
        return lastReset < todayReset;
    }
}

// Perform daily reset - NOW SAFE TO CALL MULTIPLE TIMES
function performReset() {
    const data = loadLottoData();
    const now = new Date();
    const todayReset = new Date(now);
    todayReset.setUTCHours(12, 0, 0, 0);
    
    // Only reset if the last reset was before today's reset time
    if (data.lastReset) {
        const lastReset = new Date(data.lastReset);
        if (lastReset >= todayReset) {
            console.log('⏭️ Reset already performed today, skipping');
            return false;
        }
    }
    
    data.plays = {};
    data.ipPlays = {};        // ← Clear IP plays
    data.ipAddresses = {};    // ← Clear IP addresses
    data.lastReset = new Date().toISOString();
    saveLottoData(data);
    console.log(`🔄 Daily reset performed at ${new Date().toUTCString()}`);
    
    // Send reset notification to Telegram
    sendTelegramNotification(`🔄 <b>Daily Reset Completed</b>\n\nAll players can now play again! 🎰\nTime: ${new Date().toUTCString()}`);
    return true;
}

// ===== SCHEDULED RESET AT 12:00 UTC DAILY =====
function scheduleDailyReset() {
    // Schedule at 12:00 UTC every day
    const rule = new schedule.RecurrenceRule();
    rule.hour = 12;
    rule.minute = 0;
    rule.second = 0;
    rule.tz = 'UTC';
    
    schedule.scheduleJob(rule, function() {
        console.log('⏰ Scheduled reset triggered at 12:00 UTC');
        performReset();
    });
    
    console.log('⏰ Daily reset scheduled for 12:00 UTC');
    
    // Also run a check every hour in case the schedule missed
    setInterval(() => {
        if (needsReset()) {
            console.log('🔄 Detected missed reset, performing now');
            performReset();
        }
    }, 60 * 60 * 1000);
}

// ===== PLAY TRACKING FUNCTIONS =====

function hasPlayedToday(address) {
    const data = loadLottoData();
    const today = new Date().toISOString().split('T')[0];
    return data.plays[address] === today;
}

// NEW: Check if IP already played today with a different wallet
function hasIpPlayedToday(clientIp, address) {
    const data = loadLottoData();
    const today = new Date().toISOString().split('T')[0];
    
    if (!data.ipPlays) {
        data.ipPlays = {};
        saveLottoData(data);
        return false;
    }
    
    const ipPlays = data.ipPlays[clientIp] || [];
    
    // If IP has no plays today, allow
    if (ipPlays.length === 0) {
        return false;
    }
    
    // Check if the IP's play date is today
    const ipPlayDate = ipPlays[0]; // We store the date string
    if (ipPlayDate !== today) {
        // IP played on a different day, allow
        return false;
    }
    
    // IP played today, check if it's the same address
    // We need to check if this IP was used with a DIFFERENT address today
    const ipAddresses = data.ipAddresses?.[clientIp] || [];
    if (ipAddresses.length > 0 && !ipAddresses.includes(address)) {
        // This IP was used with a different address today
        return true; // Block!
    }
    
    return false;
}

// NEW: Record IP play
function recordIpPlay(clientIp, address) {
    const data = loadLottoData();
    const today = new Date().toISOString().split('T')[0];
    
    // Initialize ipPlays if not exists
    if (!data.ipPlays) {
        data.ipPlays = {};
    }
    if (!data.ipAddresses) {
        data.ipAddresses = {};
    }
    
    // Record IP play
    if (!data.ipPlays[clientIp]) {
        data.ipPlays[clientIp] = [];
    }
    // Store only the latest play date (we just need to know if played today)
    data.ipPlays[clientIp] = [today];
    
    // Track which addresses this IP used
    if (!data.ipAddresses[clientIp]) {
        data.ipAddresses[clientIp] = [];
    }
    if (!data.ipAddresses[clientIp].includes(address)) {
        data.ipAddresses[clientIp].push(address);
    }
    
    saveLottoData(data);
}
// Record user's play
function recordPlay(address) {
    const data = loadLottoData();
    const today = new Date().toISOString().split('T')[0];
    data.plays[address] = today;
    saveLottoData(data);
}

// Calculate prize based on RNG
function calculatePrize() {
    const random = Math.random();
    let cumulative = 0;
    
    for (const prize of PRIZES) {
        cumulative += prize.chance;
        if (random <= cumulative) {
            return prize;
        }
    }
    return PRIZES[PRIZES.length - 1]; // No Luck fallback
}

// Send prize to user - IMPROVED
async function sendPrize(userAddress, amount, prizeName) {
    try {
        if (amount === 0) {
            return { txid: null, message: 'No prize to send' };
        }
        
        // Validate address format first (quick check before RPC call)
        if (!isValidDorkcoinAddress(userAddress)) {
            const error = new Error('Invalid Dorkcoin wallet address format. Must be exactly 34 characters starting with "D"');
            error.isInvalidAddress = true;
            throw error;
        }
        
        // Try to send the prize
        const txid = await callRPC('sendtoaddress', [userAddress, amount]);
        console.log(`💰 Sent ${amount} DORK to ${userAddress} for ${prizeName}`);
        
        // Only send Telegram notification for successful sends
        const telegramMessage = `🎰 <b>WINNER!</b>\n\n` +
                               `🏆 Prize: <b>${prizeName}</b>\n` +
                               `💲 Amount: <b>${amount} DORK</b>\n` +
                               `👤 Address: <code>${userAddress}</code>\n` +
                               `🔗 TXID: <code>${txid}</code>\n` +
                               `⏰ Time: ${new Date().toUTCString()}`;
        
        await sendTelegramNotification(telegramMessage);
        
        return { txid, message: 'Prize sent successfully!' };
        
    } catch (error) {
        console.error('Error sending prize:', error.message);
        
        // DON'T send Telegram notification for invalid addresses (user error)
        // DON'T send Telegram notification for format errors (user error)
        if (error.isInvalidAddress) {
            console.log(`⚠️ Invalid address attempted: ${userAddress} - Not sending Telegram notification`);
            throw error; // Re-throw so the play endpoint can handle it
        }
        
        // ONLY send Telegram for unexpected errors (technical issues)
        if (!error.isRpcError && !error.isConnectionError) {
            await sendTelegramNotification(`❌ <b>⚠️ Technical Error - Prize Sending Failed</b>\n\n` +
                                          `Prize: ${prizeName}\n` +
                                          `Amount: ${amount} DORK\n` +
                                          `Address: <code>${userAddress}</code>\n` +
                                          `Error: ${error.message}\n\n` +
                                          `This is a technical issue, not a user error.`);
        } else if (error.isRpcError) {
            // RPC errors might be technical or user-related
            // Only send if it's NOT an invalid address
            if (!error.message.includes('Invalid') && !error.message.includes('invalid')) {
                await sendTelegramNotification(`❌ <b>⚠️ RPC Error</b>\n\n` +
                                              `Prize: ${prizeName}\n` +
                                              `Amount: ${amount} DORK\n` +
                                              `Address: <code>${userAddress}</code>\n` +
                                              `Error: ${error.message}`);
            }
        }
        
        throw error;
    }
}

// ===== API ENDPOINTS =====

// 1. Get wallet balance (for display)
app.get('/api/balance/:address', async (req, res) => {
    try {
        const address = req.params.address;
        
        // Validate address
        if (!isValidDorkcoinAddress(address)) {
            return res.status(400).json({ error: 'Invalid Dorkcoin wallet address format. Must be exactly 34 characters starting with "D"' });
        }
        
        const balance = await callRPC('getreceivedbyaddress', [address, 6]);
        res.json({ address, balance });
    } catch (error) {
        if (error.isInvalidAddress) {
            res.status(400).json({ error: 'Invalid Dorkcoin wallet address format. Must be exactly 34 characters starting with "D"' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// 2. Check if user can play today
app.get('/api/canplay/:address', async (req, res) => {
    try {
        const address = req.params.address;
        
        // Validate address
        if (!isValidDorkcoinAddress(address)) {
            return res.status(400).json({ 
                error: 'Invalid Dorkcoin wallet address format. Must be exactly 34 characters starting with "D"',
                canPlay: false,
                hasPlayed: false,
                message: '❌ Invalid wallet address! Must be exactly 34 characters starting with "D"'
            });
        }
        
        // Check and perform reset if needed
        if (needsReset()) {
            performReset();
        }
        
        const played = hasPlayedToday(address);
        
        res.json({
            canPlay: !played,
            hasPlayed: played,
            message: played ? 'Already played today! Come back tomorrow at 12:00 UTC!' : 'Ready to open the chest! 🎰'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/play', strictLimiter, ipLimitMiddleware, addressLimitMiddleware, async (req, res) => {
    try {
        const { address } = req.body;
        const clientIp = req.clientIp || 'unknown';
        
        if (!address) {
            return res.status(400).json({ error: 'Wallet address required' });
        }
        
        if (!isValidDorkcoinAddress(address)) {
            return res.status(400).json({ 
                error: 'Invalid Dorkcoin wallet address format. Must be exactly 34 characters starting with "D"',
                friendlyMessage: '❌ Invalid wallet address! Must be exactly 34 characters starting with "D"'
            });
        }
        
        // Check and perform reset if needed
        if (needsReset()) {
            performReset();
        }
        
        if (hasIpPlayedToday(clientIp, address)) {
            return res.status(403).json({
                error: 'Multiple wallets from same IP not allowed',
                friendlyMessage: '❌ You can only play with one wallet per day from this IP address!'
            });
        }
        
        if (hasPlayedToday(address)) {
            return res.status(400).json({ 
                error: 'Already played today! Come back tomorrow at 12:00 UTC!',
                friendlyMessage: '⏳ Already played today! Come back tomorrow at 12:00 UTC!'
            });
        }
        
        // Calculate prize
        const prize = calculatePrize();
        
        // Record play
        recordPlay(address);
        
        // NEW: Record IP play
        recordIpPlay(clientIp, address);
        
        // Send prize if won
        let txResult = null;
        if (prize.amount > 0) {
            txResult = await sendPrize(address, prize.amount, prize.name);
        } else {
            // Send "No Luck" notification to Telegram
            await sendTelegramNotification(`😢 <b>No Luck!</b>\n\n` +
                                          `👤 Address: <code>${address}</code>\n` +
                                          `⏰ Time: ${new Date().toUTCString()}\n\n` +
                                          `Better luck tomorrow! 🍀`);
        }
        
        res.json({
            success: true,
            prize: prize,
            txid: txResult?.txid || null,
            message: `🎉 ${prize.emoji} ${prize.name}! ${prize.amount > 0 ? `You won ${prize.amount} DORK!` : 'Better luck next time!'}`
        });
        
    } catch (error) {
        console.error('Play error:', error);
        
        // Handle invalid address error specifically
        if (error.isInvalidAddress) {
            return res.status(400).json({ 
                error: 'Invalid Dorkcoin wallet address',
                friendlyMessage: '❌ Invalid wallet address! Must be exactly 34 characters starting with "D"'
            });
        }
        
        res.status(500).json({ 
            error: error.message,
            friendlyMessage: '❌ An error occurred. Please try again later.'
        });
    }
});

// 4. Get lotto stats
app.get('/api/stats', async (req, res) => {
    try {
        const data = loadLottoData();
        const today = new Date().toISOString().split('T')[0];
        const todayPlays = Object.values(data.plays).filter(date => date === today).length;
        
        res.json({
            totalPlaysToday: todayPlays,
            totalUniquePlayers: Object.keys(data.plays).length,
            nextReset: '12:00 UTC daily'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Validate address endpoint (for frontend)
app.post('/api/validate-address', async (req, res) => {
    try {
        const { address } = req.body;
        
        if (!address) {
            return res.status(400).json({ valid: false, message: 'Address required' });
        }
        
        const isValid = isValidDorkcoinAddress(address);
        res.json({ 
            valid: isValid,
            message: isValid ? '✅ Valid Dorkcoin address' : '❌ Invalid Dorkcoin address. Must be exactly 34 characters starting with "D"'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Test Telegram connection (optional endpoint)
app.get('/api/test-telegram', async (req, res) => {
    try {
        await sendTelegramNotification('✅ <b>Dorkwin Lotto Bot is online!</b>\n\nServer is running and notifications are working! 🎰');
        res.json({ success: true, message: 'Telegram notification sent!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== START SERVER =====

// Schedule daily reset
scheduleDailyReset();

// Perform initial reset check on startup
setTimeout(() => {
    if (needsReset()) {
        console.log('🔄 Performing initial reset on startup');
        performReset();
    }
}, 5000); // Wait 5 seconds for everything to initialize

app.listen(PORT, () => {
    console.log(`🎰 Dorkwin Daily Lotto API running at http://localhost:${PORT}`);
    console.log(`🔄 Daily reset at 12:00 UTC`);
    console.log(`📊 Prize tiers: ${PRIZES.length} levels`);
    console.log(`🤖 Telegram bot enabled`);
    
    sendTelegramNotification(`🚀 <b>Dorkwin Lotto Bot Started!</b>\n\n` +
                            `Server is running and ready to process plays! 🎰\n` +
                            `Time: ${new Date().toUTCString()}`);
});
