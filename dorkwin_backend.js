const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// RPC Configuration
const RPC_URL = 'http://127.0.0.1:22555';
const RPC_USER = 'SOMEUSER';
const RPC_PASS = 'SOMEPASS';

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = 'SOMETOKEN';
const TELEGRAM_CHAT_ID = 'SOMECHATID';
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

// ===== Helper Functions =====

// Validate Dorkcoin address format - EXACTLY 34 characters, starts with 'D'
function isValidDorkcoinAddress(address) {
    // Must be a string
    if (!address || typeof address !== 'string') return false;
    
    // Trim whitespace
    address = address.trim();
    
    // Must be exactly 34 characters (D + 33 alphanumeric)
    if (address.length !== 34) return false;
    
    // Must start with 'D'
    if (!address.startsWith('D')) return false;
    
    // Check if it contains only valid characters (alphanumeric)
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < address.length; i++) {
        if (!validChars.includes(address[i])) {
            return false;
        }
    }
    
    return true;
}

// Generic RPC caller
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
            headers: { 'Content-Type': 'text/plain' }
        });
        
        if (response.data.error) {
            // Check if it's an invalid address error
            const errorMsg = response.data.error.message || '';
            if (errorMsg.includes('Invalid address') || errorMsg.includes('invalid address')) {
                const customError = new Error('Invalid Dorkcoin wallet address');
                customError.isInvalidAddress = true;
                throw customError;
            }
            throw new Error(response.data.error.message);
        }
        return response.data.result;
    } catch (error) {
        console.error('RPC Error:', error.message);
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
    return { plays: {}, lastReset: null };
}

// Save lottery data to file
function saveLottoData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving lotto data:', error);
    }
}

// Check if daily reset is needed (12:00 UTC)
function needsReset() {
    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(12, 0, 0, 0);
    
    const data = loadLottoData();
    if (!data.lastReset) return true;
    
    const lastReset = new Date(data.lastReset);
    return now > today && lastReset < today;
}

// Perform daily reset
function performReset() {
    const data = loadLottoData();
    data.plays = {};
    data.lastReset = new Date().toISOString();
    saveLottoData(data);
    console.log('🔄 Daily reset performed at 12:00 UTC');
    
    // Send reset notification to Telegram
    sendTelegramNotification(`🔄 <b>Daily Reset Completed</b>\n\nAll players can now play again! 🎰\nTime: ${new Date().toUTCString()}`);
}

// Check if user already played today
function hasPlayedToday(address) {
    const data = loadLottoData();
    const today = new Date().toISOString().split('T')[0];
    return data.plays[address] === today;
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

// Send prize to user
async function sendPrize(userAddress, amount, prizeName) {
    try {
        if (amount === 0) {
            return { txid: null, message: 'No prize to send' };
        }
        
        // Validate address first
        if (!isValidDorkcoinAddress(userAddress)) {
            const error = new Error('Invalid Dorkcoin wallet address format. Must be exactly 34 characters starting with "D"');
            error.isInvalidAddress = true;
            throw error;
        }
        
        const txid = await callRPC('sendtoaddress', [userAddress, amount]);
        const message = `💰 Sent ${amount} DORK to ${userAddress} for ${prizeName}`;
        console.log(message);
        
        // Send to Telegram
        const telegramMessage = `🎰 <b>WINNER!</b>\n\n` +
                               `🏆 Prize: <b>${prizeName}</b>\n` +
                               `💲 Amount: <b>${amount} DORK</b>\n` +
                               `👤 Address: <code>${userAddress}</code>\n` +
                               `🔗 TXID: <code>${txid}</code>\n` +
                               `⏰ Time: ${new Date().toUTCString()}`;
        
        await sendTelegramNotification(telegramMessage);
        
        return { txid, message: 'Prize sent successfully!' };
    } catch (error) {
        console.error('Error sending prize:', error);
        
        // Don't send Telegram notification for invalid addresses
        if (!error.isInvalidAddress) {
            await sendTelegramNotification(`❌ <b>Prize Sending Failed</b>\n\n` +
                                          `Prize: ${prizeName}\n` +
                                          `Amount: ${amount} DORK\n` +
                                          `Address: <code>${userAddress}</code>\n` +
                                          `Error: ${error.message}`);
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
        
        // Check daily reset
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

// 3. Play the lotto (OPEN CHEST)
app.post('/api/play', async (req, res) => {
    try {
        const { address } = req.body;
        
        if (!address) {
            return res.status(400).json({ error: 'Wallet address required' });
        }
        
        // Validate address format
        if (!isValidDorkcoinAddress(address)) {
            return res.status(400).json({ 
                error: 'Invalid Dorkcoin wallet address format. Must be exactly 34 characters starting with "D"',
                friendlyMessage: '❌ Invalid wallet address! Must be exactly 34 characters starting with "D"'
            });
        }
        
        // Check daily reset
        if (needsReset()) {
            performReset();
        }
        
        // Check if already played
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

// Start server
app.listen(PORT, () => {
    console.log(`🎰 Dorkwin Daily Lotto API running at http://localhost:${PORT}`);
    console.log(`🔄 Daily reset at 12:00 UTC`);
    console.log(`📊 Prize tiers: ${PRIZES.length} levels`);
    console.log(`🤖 Telegram bot enabled`);
    
    // Send startup notification
    sendTelegramNotification(`🚀 <b>Dorkwin Lotto Bot Started!</b>\n\n` +
                            `Server is running and ready to process plays! 🎰\n` +
                            `Time: ${new Date().toUTCString()}`);
});
