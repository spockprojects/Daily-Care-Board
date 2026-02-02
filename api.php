<?php

require 'db_connect.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

if ($action === 'register')
{
    $username = $data['username'];
    $password = password_hash($data['password'], PASSWORD_DEFAULT);
    
    try
    {
        $stmt = $pdo->prepare("INSERT INTO users (username, password) VALUES (?, ?)");
        $stmt->execute([$username, $password]);
        echo json_encode(['status' => 'success', 'msg' => 'Zarejestrowano pomyślnie! Zaloguj się.']);
    }
    catch (Exception $e)
    {
        echo json_encode(['status' => 'error', 'msg' => 'Użytkownik już istnieje.']);
    }
    exit;
}

if ($action === 'login')
{
    $stmt = $pdo->prepare("SELECT id, password FROM users WHERE username = ?");
    $stmt->execute([$data['username']]);
    $user = $stmt->fetch();

    if ($user && password_verify($data['password'], $user['password']))
    {
        $_SESSION['user_id'] = $user['id'];
        echo json_encode(['status' => 'success', 'user_id' => $user['id']]);
    }
    else
    {
        echo json_encode(['status' => 'error', 'msg' => 'Błędne dane.']);
    }
    exit;
}

if ($action === 'logout')
{
    session_destroy();
    echo json_encode(['status' => 'success']);
    exit;
}

if ($action === 'check_session')
{
    if (isset($_SESSION['user_id']))
    {
        echo json_encode(['status' => 'logged_in', 'user_id' => $_SESSION['user_id']]);
    }
    else
    {
        echo json_encode(['status' => 'guest']);
    }
    exit;
}

if (!isset($_SESSION['user_id']))
{
    echo json_encode(['status' => 'error', 'msg' => 'Brak autoryzacji']);
    exit;
}

$user_id = $_SESSION['user_id'];

if ($action === 'update_stats')
{
    $date = date('Y-m-d');
    $sql = "INSERT INTO daily_stats (user_id, date, water_current, water_goal, kcal_current, kcal_goal, steps_current, steps_goal, sleep_current, sleep_goal) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            water_current = VALUES(water_current), water_goal = VALUES(water_goal),
            kcal_current = VALUES(kcal_current), kcal_goal = VALUES(kcal_goal),
            steps_current = VALUES(steps_current), steps_goal = VALUES(steps_goal),
            sleep_current = VALUES(sleep_current), sleep_goal = VALUES(sleep_goal)";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute(
        [
            $user_id, $date,
            $data['stats']['water'], $data['goals']['water'],
            $data['stats']['kcal'], $data['goals']['kcal'],
            $data['stats']['steps'], $data['goals']['steps'],
            $data['stats']['sleep'], $data['goals']['sleep']
        ]
    );
    echo json_encode(['status' => 'success']);
    exit;
}

if ($action === 'load_stats')
{
    $date = $data['date'] ?? date('Y-m-d');
    $stmt = $pdo->prepare("SELECT * FROM daily_stats WHERE user_id = ? AND date = ?");
    $stmt->execute([$user_id, $date]);
    $result = $stmt->fetch();
    
    if ($result)
    {
        echo json_encode(['status' => 'success', 'data' => $result]);
    }
    else
    {
        echo json_encode(['status' => 'empty']);
    }
    exit;
}

if ($action === 'save_widget')
{
    $content = json_encode($data['content']);
    
    if (isset($data['widget_id']))
    {
        $stmt = $pdo->prepare("UPDATE widgets SET content = ?, pos_x = ?, pos_y = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([$content, $data['x'], $data['y'], $data['widget_id'], $user_id]);
        echo json_encode(['status' => 'success', 'id' => $data['widget_id']]);
    }
    else
    {
        $stmt = $pdo->prepare("INSERT INTO widgets (user_id, type, content, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$user_id, $data['type'], $content, $data['x'], $data['y']]);
        echo json_encode(['status' => 'success', 'id' => $pdo->lastInsertId()]);
    }
    exit;
}

if ($action === 'delete_widget')
{
    $stmt = $pdo->prepare("DELETE FROM widgets WHERE id = ? AND user_id = ?");
    $stmt->execute([$data['widget_id'], $user_id]);
    echo json_encode(['status' => 'success']);
    exit;
}

if ($action === 'load_widgets')
{
    $stmt = $pdo->prepare("SELECT * FROM widgets WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $widgets = $stmt->fetchAll();
    echo json_encode(['status' => 'success', 'widgets' => $widgets]);
    exit;
}

if ($action === 'get_chart_data')
{
    $type = $data['type'];
    $range = $data['range'];
    
    $colMap =
    [
        'water' => 'water_current',
        'kcal' => 'kcal_current',
        'steps' => 'steps_current',
        'sleep' => 'sleep_current'
    ];
    
    if (!array_key_exists($type, $colMap))
    {
        echo json_encode(['status' => 'error', 'msg' => 'Invalid type']);
        exit;
    }
    
    $column = $colMap[$type];
    
    if ($range === 'year')
    {
        $sql = "SELECT DATE_FORMAT(date, '%Y-%m') as label, AVG($column) as value 
                FROM daily_stats 
                WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
                GROUP BY DATE_FORMAT(date, '%Y-%m')
                ORDER BY label ASC";
    }
    else
    {
        $days = (int)$range;
        $sql = "SELECT date as label, $column as value 
                FROM daily_stats 
                WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                ORDER BY date ASC";
    }

    $stmt = $pdo->prepare($sql);
    if ($range === 'year')
    {
        $stmt->execute([$user_id]);
    }
    else
    {
        $stmt->execute([$user_id, $days]);
    }
    
    $data = $stmt->fetchAll();
    echo json_encode(['status' => 'success', 'data' => $data]);
    exit;

}
?>
