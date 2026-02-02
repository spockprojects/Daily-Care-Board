<?php

// include database connection + session start
require 'db_connect.php';
// force JSON response
header('Content-Type: application/json');


// read JSON input from frontend
$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';


// AUTH: REGISTER

if ($action === 'register')
{
    // get user credentials
    $username = $data['username'];
    $password = password_hash($data['password'], PASSWORD_DEFAULT);
    
    try
    {
        // insert new user into database
        $stmt = $pdo->prepare("INSERT INTO users (username, password) VALUES (?, ?)");
        $stmt->execute([$username, $password]);

        echo json_encode(['status' => 'success', 'msg' => 'Zarejestrowano pomyślnie! Zaloguj się.']);
    }
    catch (Exception $e)
    {
        // username already exists
        echo json_encode(['status' => 'error', 'msg' => 'Użytkownik już istnieje.']);
    }
    exit;
}

// AUTH: LOGIN

if ($action === 'login')
{
    // get user by username
    $stmt = $pdo->prepare("SELECT id, password FROM users WHERE username = ?");
    $stmt->execute([$data['username']]);
    $user = $stmt->fetch();

    // verify password and start session
    if ($user && password_verify($data['password'], $user['password']))
    {
        $_SESSION['user_id'] = $user['id'];
        echo json_encode(['status' => 'success', 'user_id' => $user['id']]);
    }
    else
    {
        // invalid credentials
        echo json_encode(['status' => 'error', 'msg' => 'Błędne dane.']);
    }
    exit;
}

// AUTH: LOGOUT

if ($action === 'logout')
{
    // destroy session
    session_destroy();
    echo json_encode(['status' => 'success']);
    exit;
}

// AUTH: CHECK SESSION

if ($action === 'check_session')
{
    // check if user is logged in
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

// AUTH: GUARD

// block access if user is not authenticated
if (!isset($_SESSION['user_id']))
{
    echo json_encode(['status' => 'error', 'msg' => 'Brak autoryzacji']);
    exit;
}


// get current user id
$user_id = $_SESSION['user_id'];

// DAILY STATS: SAVE / UPDATE

if ($action === 'update_stats')
{
    // use current date
    $date = date('Y-m-d');

    // insert or update daily stats
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

// DAILY STATS: LOAD

if ($action === 'load_stats')
{
    // get selected date or fallback to today
    $date = $data['date'] ?? date('Y-m-d');
    
    // fetch daily stats for user and date
    $stmt = $pdo->prepare("SELECT * FROM daily_stats WHERE user_id = ? AND date = ?");
    $stmt->execute([$user_id, $date]);
    $result = $stmt->fetch();
    
    if ($result)
    {
        echo json_encode(['status' => 'success', 'data' => $result]);
    }
    else
    {
        // no stats saved for this date
        echo json_encode(['status' => 'empty']);
    }
    exit;
}

// WIDGETS: SAVE / UPDATE

if ($action === 'save_widget')
{
    // encode widget content
    $content = json_encode($data['content']);
    
    if (isset($data['widget_id']))
    {
        // update existing widget
        $stmt = $pdo->prepare("UPDATE widgets SET content = ?, pos_x = ?, pos_y = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([$content, $data['x'], $data['y'], $data['widget_id'], $user_id]);

        echo json_encode(['status' => 'success', 'id' => $data['widget_id']]);
    }
    else
    {
        // create new widget
        $stmt = $pdo->prepare("INSERT INTO widgets (user_id, type, content, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$user_id, $data['type'], $content, $data['x'], $data['y']]);

        echo json_encode(['status' => 'success', 'id' => $pdo->lastInsertId()]);
    }
    exit;
}

// WIDGETS: DELETE

if ($action === 'delete_widget')
{
    // delete widget owned by user
    $stmt = $pdo->prepare("DELETE FROM widgets WHERE id = ? AND user_id = ?");
    $stmt->execute([$data['widget_id'], $user_id]);

    echo json_encode(['status' => 'success']);
    exit;
}

// WIDGETS: LOAD

if ($action === 'load_widgets')
{
    // load all widgets for user
    $stmt = $pdo->prepare("SELECT * FROM widgets WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $widgets = $stmt->fetchAll();

    echo json_encode(['status' => 'success', 'widgets' => $widgets]);
    exit;
}

// CHART DATA

if ($action === 'get_chart_data')
{
    // chart type and time range
    $type = $data['type'];
    $range = $data['range'];
    
    // map chart type to database column
    $colMap =
    [
        'water' => 'water_current',
        'kcal' => 'kcal_current',
        'steps' => 'steps_current',
        'sleep' => 'sleep_current'
    ];
    
    // validate chart type
    if (!array_key_exists($type, $colMap))
    {
        echo json_encode(['status' => 'error', 'msg' => 'Invalid type']);
        exit;
    }
    
    $column = $colMap[$type];
    
    // yearly average (grouped by month)
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
        // last x days
        $days = (int)$range;
        $sql = "SELECT date as label, $column as value 
                FROM daily_stats 
                WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                ORDER BY date ASC";
    }

    // execute query
    $stmt = $pdo->prepare($sql);
    if ($range === 'year')
    {
        $stmt->execute([$user_id]);
    }
    else
    {
        $stmt->execute([$user_id, $days]);
    }
    
    // return chart-ready data
    $data = $stmt->fetchAll();

    echo json_encode(['status' => 'success', 'data' => $data]);
    exit;

}
?>
