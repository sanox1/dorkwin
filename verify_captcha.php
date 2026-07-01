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
    
    return [
        'question' => $_SESSION['captcha_question'],
        'answer' => $_SESSION['captcha_answer']
    ];
}

function verifyCaptcha($userAnswer) {
    if (!isset($_SESSION['captcha_answer']) || !isset($_SESSION['captcha_time'])) {
        return ['valid' => false, 'message' => 'CAPTCHA not initialized'];
    }
    
    if (time() - $_SESSION['captcha_time'] > 300) {
        unset($_SESSION['captcha_answer']);
        unset($_SESSION['captcha_question']);
        unset($_SESSION['captcha_time']);
        return ['valid' => false, 'message' => 'CAPTCHA expired'];
    }
    
    if (trim($userAnswer) !== (string)$_SESSION['captcha_answer']) {
        return ['valid' => false, 'message' => 'Incorrect answer'];
    }
    
    // CAPTCHA is valid - clear it to prevent reuse
    unset($_SESSION['captcha_answer']);
    unset($_SESSION['captcha_question']);
    unset($_SESSION['captcha_time']);
    
    return ['valid' => true, 'message' => 'Verified'];
}

// ===== Handle Requests =====
header('Content-Type: application/json');

// Refresh CAPTCHA
if (isset($_GET['action']) && $_GET['action'] === 'refresh') {
    $captcha = generateCaptcha();
    echo json_encode([
        'success' => true,
        'question' => $captcha['question']
    ]);
    exit;
}

// Verify CAPTCHA
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'verify') {
    $userAnswer = trim($_POST['captcha_input'] ?? '');
    $result = verifyCaptcha($userAnswer);
    
    if (!$result['valid']) {
        // Generate new CAPTCHA on failure
        $newCaptcha = generateCaptcha();
        $result['new_captcha'] = $newCaptcha['question'];
    }
    
    echo json_encode($result);
    exit;
}

// Invalid request
echo json_encode(['valid' => false, 'message' => 'Invalid request']);
?>