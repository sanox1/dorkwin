<?php
// Start session safely
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ===== CAPTCHA Functions =====
function generateCaptcha() {
    $num1 = rand(1, 10);
    $num2 = rand(1, 10);
    $operators = ['+', '-'];
    $operator = $operators[array_rand($operators)];
    
    if ($operator === '+') {
        $answer = $num1 + $num2;
    } else {
        if ($num1 < $num2) {
            $temp = $num1;
            $num1 = $num2;
            $num2 = $temp;
        }
        $answer = $num1 - $num2;
    }
    
    $_SESSION['captcha_answer'] = $answer;
    $_SESSION['captcha_question'] = "$num1 $operator $num2";
    $_SESSION['captcha_time'] = time();
}

// Generate initial CAPTCHA
if (!isset($_SESSION['captcha_answer']) || !isset($_SESSION['captcha_time']) || 
    (time() - $_SESSION['captcha_time'] > 300)) {
    generateCaptcha();
}

$captchaQuestion = $_SESSION['captcha_question'] ?? '2 + 3';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎰 Dorkwin Daily Lotto</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: rgba(255,255,255,0.95);
            border-radius: 24px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            text-align: center;
        }
        h1 {
            font-size: 2.5rem;
            background: linear-gradient(45deg, #f7971e, #ffd200);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
        .free-badge {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 15px;
        }
        .input-group { margin: 20px 0; }
        .input-group label { display: block; font-weight: 600; color: #333; margin-bottom: 8px; }
        .input-group input {
            width: 100%;
            padding: 14px 18px;
            border: 2px solid #ddd;
            border-radius: 12px;
            font-size: 16px;
            font-family: 'Courier New', monospace;
            transition: all 0.3s;
            background: #f8f9fa;
        }
        .input-group input:focus {
            outline: none;
            border-color: #f7971e;
            background: white;
            box-shadow: 0 0 0 4px rgba(247,151,30,0.1);
        }
        .input-group input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .address-helper { font-size: 12px; margin-top: 8px; color: #666; min-height: 20px; }
        .address-helper.valid { color: #28a745; }
        .address-helper.invalid { color: #dc3545; }
        .address-helper.warning { color: #ffc107; }
        .captcha-container {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            border: 2px solid #e9ecef;
        }
        .captcha-question {
            font-size: 28px;
            font-weight: 700;
            color: #f7971e;
            margin: 10px 0;
            padding: 10px;
            background: white;
            border-radius: 8px;
            display: inline-block;
        }
        .captcha-input {
            width: 120px;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 18px;
            text-align: center;
            margin: 10px auto;
            display: block;
        }
        .chest-box {
            margin: 30px 0;
            cursor: pointer;
            transition: transform 0.3s;
            position: relative;
        }
        .chest-box:hover {
            transform: scale(1.02);
        }
        .chest-box img {
            max-width: 100%;
            height: auto;
            border-radius: 16px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        }
        .chest-box.opened {
            animation: chestOpen 1s ease-in-out;
        }
        @keyframes chestOpen {
            0% { transform: scale(1); }
            50% { transform: scale(1.1) rotate(-5deg); }
            100% { transform: scale(1); }
        }
        .captcha-input:focus { border-color: #f7971e; outline: none; }
        .captcha-hint { font-size: 12px; color: #999; margin-top: 8px; }
        .btn-refresh {
            background: #6c757d;
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
        }
        .btn-refresh:hover { background: #5a6268; }
        .btn-open {
            background: linear-gradient(45deg, #f7971e, #ffd200);
            border: none;
            padding: 16px 48px;
            font-size: 20px;
            font-weight: 700;
            border-radius: 50px;
            color: #1a1a2e;
            cursor: pointer;
            transition: all 0.3s;
            width: 100%;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 10px;
        }
        .btn-open:hover:not(:disabled) { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 25px rgba(247,151,30,0.4); 
        }
        .btn-open:disabled { 
            opacity: 0.5; 
            cursor: not-allowed; 
            transform: none !important;
        }
        .btn-open.loading {
            background: linear-gradient(45deg, #6c757d, #495057);
            color: white;
            cursor: wait;
        }
        .message {
            margin: 15px 0;
            padding: 15px;
            border-radius: 12px;
            font-weight: 600;
            display: none;
        }
        .message.show { display: block; }
        .message.success { 
            background: #d4edda; 
            border: 2px solid #28a745; 
            color: #155724;
            font-size: 18px;
        }
        .message.error { background: #f8d7da; border: 2px solid #dc3545; color: #721c24; }
        .message.warning { background: #fff3cd; border: 2px solid #ffc107; color: #856404; }
        .message.info { background: #d1ecf1; border: 2px solid #17a2b8; color: #0c5460; }
        .message .prize-emoji { font-size: 40px; display: block; margin-bottom: 5px; }
        .message .prize-amount { font-size: 28px; font-weight: 700; color: #28a745; }
        .message .prize-name { font-size: 22px; font-weight: 700; }
        .message .txid { font-size: 11px; color: #666; margin-top: 5px; word-break: break-all; }
        .stats {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            padding: 15px;
            background: #e8f5e9;
            border-radius: 12px;
            font-size: 14px;
        }
        .stats .number { font-size: 22px; font-weight: 700; color: #2e7d32; }
        .rules {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            text-align: left;
        }
        .rules h3 { color: #333; margin-bottom: 12px; }
        .rules .prize-tier {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        .rules .prize-tier:last-child { border-bottom: none; }
        .rules .tier-emoji { font-size: 20px; }
        .rules .tier-chance { color: #666; font-size: 12px; }
        @media (max-width: 480px) { .container { padding: 20px; } h1 { font-size: 1.8rem; } }
        
        .alert-shake {
            animation: shake 0.5s ease-in-out;
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
        }
        
        .loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
            margin-right: 10px;
            vertical-align: middle;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Prize celebration animation */
        .celebration {
            animation: celebrate 0.6s ease-in-out;
        }
        @keyframes celebrate {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎰 Dorkwin Daily Lotto</h1>
        <p class="subtitle">Open the treasure chest once a day and win $DORK!</p>
        <div class="free-badge">🎁 FREE TO PLAY</div>
        
        <!-- Chest -->
        <div class="chest-box" id="chestBox">
            <img src="chest.jpg" alt="Treasure Chest" width="500" height="600">
        </div>

        <!-- Message Display -->
        <div id="messageContainer">
            <div id="message" class="message"></div>
        </div>

        <!-- Form -->
        <form id="lottoForm" onsubmit="return false;">
            <div class="input-group">
                <label>💰 Wallet Address</label>
                <input type="text" id="walletAddress" 
                       placeholder="Enter Dorkcoin address (e.g., D...)" maxlength="34" required>
                <div class="address-helper" id="addressHelper">🔑 Enter 34 chars, starts with "D"</div>
            </div>

            <div class="captcha-container">
                <div style="font-weight: 600; color: #333; margin-bottom: 10px;">🛡️ Solve to continue</div>
                <div class="captcha-question" id="captchaQuestion"><?php echo htmlspecialchars($captchaQuestion); ?> = ?</div>
                <input type="text" id="captchaInput" class="captcha-input" placeholder="?" autocomplete="off" required>
                <div class="captcha-hint">⏱️ CAPTCHA expires in <span id="captchaTimer">5:00</span></div>
                <button type="button" class="btn-refresh" onclick="refreshCaptcha()">🔄 New CAPTCHA</button>
            </div>

            <button type="button" class="btn-open" id="openBtn" onclick="startLotto()">🔓 OPEN CHEST</button>
        </form>

        <div class="stats">
            <div><div class="number" id="todayPlays">-</div><div>Today's Plays</div></div>
            <div><div class="number" id="totalPlayers">-</div><div>Total Players</div></div>
            <div><div class="number">12:00 UTC</div><div>Next Reset</div></div>
        </div>

        <div class="rules">
            <h3>🎯 Prize Tiers</h3>
            <div class="prize-tier"><span>👑 Mythic</span><span>500 DORK (0.5%)</span></div>
            <div class="prize-tier"><span>💎 Legendary</span><span>250 DORK (3.0%)</span></div>
            <div class="prize-tier"><span>🪨 Epic</span><span>50 DORK (10.0%)</span></div>
            <div class="prize-tier"><span>🔨 Rare</span><span>15 DORK (20.0%)</span></div>
            <div class="prize-tier"><span>🥦 Common</span><span>5 DORK (35.0%)</span></div>
            <div class="prize-tier" style="color:#666;"><span>😢 No Luck</span><span>0 DORK (31.5%)</span></div>
        </div>
        
        <!-- Ad Banner -->
        <div style="margin-top: 20px;">
            <iframe src="https://zerads.com/ad/ad.php?width=300&ref=11510" 
                    marginwidth="0" 
                    marginheight="0" 
                    width="300" 
                    height="250" 
                    scrolling="no" 
                    border="0" 
                    frameborder="0">
            </iframe>
        </div>
    </div>

    <script>
        // ===== CONFIGURATION =====
        const API_URL = 'http://YOUR_IP:3001'; // Your internal backend
        let captchaTimerInterval = null;
        let captchaExpiryTime = <?php echo time() + 300; ?>;

        // ===== DOM Elements =====
        const walletInput = document.getElementById('walletAddress');
        const helper = document.getElementById('addressHelper');
        const openBtn = document.getElementById('openBtn');
        const messageEl = document.getElementById('message');
        const chestBox = document.getElementById('chestBox');
        const captchaInput = document.getElementById('captchaInput');
        const captchaQuestion = document.getElementById('captchaQuestion');

        // ===== Show Message Helper with Auto-Hide =====
        function showMessage(text, type = 'info', duration = 8000) {
            messageEl.innerHTML = text;
            messageEl.className = `message show ${type} alert-shake`;
            
            // Clear any existing timeout
            clearTimeout(messageEl._hideTimeout);
            
            // Auto-hide after duration
            if (duration > 0) {
                messageEl._hideTimeout = setTimeout(() => {
                    messageEl.className = 'message';
                }, duration);
            }
            
            // Scroll to message
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // ===== Show Prize Message (stays longer) =====
        function showPrizeMessage(prize, txid = null) {
            let html = '';
            
            if (prize.amount > 0) {
                html = `
                    <div class="prize-emoji">${prize.emoji}</div>
                    <div class="prize-name">🎉 ${prize.name}!</div>
                    <div class="prize-amount">+${prize.amount} DORK</div>
                    ${txid ? `<div class="txid">🔗 TX: ${txid.substring(0, 30)}...</div>` : ''}
                    <div style="margin-top: 8px; font-size: 14px; color: #28a745;">💰 Prize sent to your wallet!</div>
                `;
                messageEl.className = `message show success celebration`;
            } else {
                html = `
                    <div class="prize-emoji">😢</div>
                    <div class="prize-name">${prize.name}</div>
                    <div style="font-size: 16px; color: #666; margin-top: 5px;">Better luck next time! 🍀</div>
                `;
                messageEl.className = `message show warning`;
            }
            
            messageEl.innerHTML = html;
            
            // Clear any existing timeout
            clearTimeout(messageEl._hideTimeout);
            
            // Show prize for 10 seconds (longer so user can see it)
            messageEl._hideTimeout = setTimeout(() => {
                messageEl.className = 'message';
            }, 10000);
            
            // Scroll to message
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Animate chest
            chestBox.classList.add('opened');
            setTimeout(() => {
                chestBox.classList.remove('opened');
            }, 1500);
        }

        // ===== CAPTCHA Timer =====
        function startCaptchaTimer() {
            if (captchaTimerInterval) {
                clearInterval(captchaTimerInterval);
            }
            
            captchaTimerInterval = setInterval(() => {
                const remaining = captchaExpiryTime - Math.floor(Date.now() / 1000);
                
                if (remaining <= 0) {
                    clearInterval(captchaTimerInterval);
                    document.getElementById('captchaTimer').textContent = '0:00';
                    document.getElementById('captchaTimer').style.color = '#dc3545';
                    openBtn.disabled = true;
                    openBtn.textContent = '⏳ CAPTCHA EXPIRED';
                    showMessage('⏰ CAPTCHA expired! Click "New CAPTCHA" to refresh.', 'warning', 5000);
                    return;
                }
                
                const mins = Math.floor(remaining / 60);
                const secs = remaining % 60;
                document.getElementById('captchaTimer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                document.getElementById('captchaTimer').style.color = remaining < 60 ? '#dc3545' : '#666';
            }, 1000);
        }

        // ===== Refresh CAPTCHA (with delay for message) =====
        async function refreshCaptcha() {
            try {
                const response = await fetch('verify_captcha.php?action=refresh');
                const data = await response.json();
                
                if (data.success) {
                    captchaQuestion.textContent = data.question + ' = ?';
                    captchaInput.value = '';
                    captchaExpiryTime = Math.floor(Date.now() / 1000) + 300;
                    document.getElementById('captchaTimer').style.color = '#666';
                    openBtn.disabled = false;
                    openBtn.textContent = '🔓 OPEN CHEST';
                    startCaptchaTimer();
                    
                    // Only show this message if there's no prize message showing
                    if (!messageEl.classList.contains('success')) {
                        showMessage('🔄 New CAPTCHA generated!', 'info', 3000);
                    }
                }
            } catch (error) {
                console.error('Error refreshing CAPTCHA:', error);
                showMessage('❌ Failed to refresh CAPTCHA. Please reload the page.', 'error', 5000);
            }
        }

        // ===== Address Validation =====
        walletInput.addEventListener('input', function() {
            const addr = this.value.trim();
            
            if (addr.length === 0) {
                helper.textContent = '🔑 Enter 34 chars, starts with "D"';
                helper.className = 'address-helper';
                openBtn.disabled = true;
                openBtn.textContent = '🔓 OPEN CHEST';
                return;
            }
            
            if (addr.length === 34 && addr.startsWith('D')) {
                helper.textContent = '✅ Valid address';
                helper.className = 'address-helper valid';
                checkCanPlay(addr);
            } else if (addr.length === 34) {
                helper.textContent = '❌ Must start with "D"';
                helper.className = 'address-helper invalid';
                openBtn.disabled = true;
                openBtn.textContent = '❌ INVALID ADDRESS';
            } else {
                helper.textContent = `⏳ ${addr.length}/34 characters`;
                helper.className = 'address-helper';
                openBtn.disabled = true;
                openBtn.textContent = '⏳ ENTER ADDRESS';
            }
        });

        // ===== Check if user can play =====
        async function checkCanPlay(address) {
            try {
                const response = await fetch(`${API_URL}/api/canplay/${address}`);
                const data = await response.json();
                
                if (data.hasPlayed) {
                    helper.textContent = '⏳ Already played today! Come back at 12:00 UTC!';
                    helper.className = 'address-helper warning';
                    openBtn.disabled = true;
                    openBtn.textContent = '⏳ ALREADY PLAYED';
                    showMessage('⏳ You already played today! Come back tomorrow at 12:00 UTC!', 'warning', 6000);
                } else if (data.canPlay) {
                    openBtn.disabled = false;
                    openBtn.textContent = '🔓 OPEN CHEST';
                }
            } catch (error) {
                console.error('Check play status error:', error);
                // If backend is unreachable, still allow play attempt
                openBtn.disabled = false;
                openBtn.textContent = '🔓 OPEN CHEST';
            }
        }

        // ===== Verify CAPTCHA with PHP =====
        async function verifyCaptcha(answer) {
            try {
                const formData = new FormData();
                formData.append('action', 'verify');
                formData.append('captcha_input', answer);
                
                const response = await fetch('verify_captcha.php', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('CAPTCHA verification error:', error);
                return { valid: false, message: 'Error verifying CAPTCHA' };
            }
        }

        // ===== Main Lotto Function =====
        async function startLotto() {
            const address = walletInput.value.trim();
            const captchaAnswer = captchaInput.value.trim();
            
            // Validate address
            if (!address || address.length !== 34 || !address.startsWith('D')) {
                showMessage('❌ Please enter a valid Dorkcoin address (34 chars, starts with "D")', 'error', 5000);
                walletInput.focus();
                return;
            }
            
            // Validate CAPTCHA
            if (!captchaAnswer) {
                showMessage('❌ Please solve the CAPTCHA first!', 'error', 5000);
                captchaInput.focus();
                return;
            }
            
            // Disable button and show loading
            openBtn.disabled = true;
            openBtn.innerHTML = '<span class="loading-spinner"></span> VERIFYING...';
            openBtn.className = 'btn-open loading';
            
            try {
                // Step 1: Verify CAPTCHA with PHP
                const captchaResult = await verifyCaptcha(captchaAnswer);
                
                if (!captchaResult.valid) {
                    showMessage(`❌ ${captchaResult.message}`, 'error', 5000);
                    // Refresh CAPTCHA on failure (but wait a moment)
                    setTimeout(async () => {
                        await refreshCaptcha();
                    }, 1500);
                    openBtn.disabled = false;
                    openBtn.innerHTML = '🔓 OPEN CHEST';
                    openBtn.className = 'btn-open';
                    return;
                }
                
                // Step 2: Call Node.js backend directly
                showMessage('🎰 Opening the chest...', 'info', 2000);
                
                const playResponse = await fetch(`${API_URL}/api/play`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ address: address })
                });
                
                const result = await playResponse.json();
                
                // Step 3: Handle the result
                if (playResponse.ok && result.success) {
                    // ===== SUCCESS - Show prize with longer display =====
                    const prize = result.prize;
                    
                    // Show prize message (stays for 10 seconds)
                    showPrizeMessage(prize, result.txid);
                    
                    // Disable button (already played today)
                    openBtn.disabled = true;
                    openBtn.textContent = '⏳ PLAYED TODAY';
                    openBtn.className = 'btn-open';
                    
                    // Refresh stats
                    loadStats();
                    
                    // Refresh CAPTCHA after prize is shown (delayed)
                    setTimeout(async () => {
                        await refreshCaptcha();
                        // Don't show "New CAPTCHA" message if prize is still showing
                    }, 3000);
                    
                } else {
                    // ===== ERROR - Show error message =====
                    const errorMsg = result.friendlyMessage || result.error || 'Unknown error';
                    showMessage(`❌ ${errorMsg}`, 'error', 6000);
                    
                    openBtn.disabled = false;
                    openBtn.innerHTML = '🔓 OPEN CHEST';
                    openBtn.className = 'btn-open';
                    
                    // Refresh CAPTCHA after error (delayed)
                    setTimeout(async () => {
                        await refreshCaptcha();
                    }, 2000);
                }
                
            } catch (error) {
                console.error('Lotto error:', error);
                showMessage('❌ Could not connect to game server. Please check your connection and try again.', 'error', 6000);
                openBtn.disabled = false;
                openBtn.innerHTML = '🔓 OPEN CHEST';
                openBtn.className = 'btn-open';
                
                // Refresh CAPTCHA after error
                setTimeout(async () => {
                    await refreshCaptcha();
                }, 2000);
            }
        }

        // ===== Load Stats =====
        async function loadStats() {
            try {
                const response = await fetch(`${API_URL}/api/stats`);
                const data = await response.json();
                document.getElementById('todayPlays').textContent = data.totalPlaysToday || 0;
                document.getElementById('totalPlayers').textContent = data.totalUniquePlayers || 0;
            } catch (error) {
                console.error('Stats error:', error);
                document.getElementById('todayPlays').textContent = '?';
                document.getElementById('totalPlayers').textContent = '?';
            }
        }

        // ===== Auto-check address on paste =====
        walletInput.addEventListener('paste', function() {
            setTimeout(() => {
                const addr = this.value.trim();
                if (addr.length === 34 && addr.startsWith('D')) {
                    checkCanPlay(addr);
                }
            }, 100);
        });

        // ===== Enter key to submit =====
        walletInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                startLotto();
            }
        });
        captchaInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                startLotto();
            }
        });

        // ===== Initialize =====
        startCaptchaTimer();
        loadStats();
        setInterval(loadStats, 30000);

        console.log('🎰 Dorkwin Daily Lotto loaded!');
        console.log('🔒 CAPTCHA handled by PHP, game logic by Node.js');
        console.log(`🌐 Backend API: ${API_URL}`);
        console.log('✅ No cURL or file_get_contents needed!');
    </script>
</body>
</html>
