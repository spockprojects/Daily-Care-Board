<?php


// database connection settings
$host = 'localhost';
$db   = 'daily_care_board';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';


// create DSN string for PDO
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

// PDO configuration options
$options = 
[
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try 
{
    // create new PDO database connection
    $pdo = new PDO($dsn, $user, $pass, $options);
} 
catch (\PDOException $e) 
{
    // stop execution if connection fails
    throw new \PDOException($e->getMessage(), (int)$e->getCode());
}


// start user session (login, auth, etc.)
session_start();

?>
