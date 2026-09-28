<?php
declare(strict_types=1);

// getenv() works whatever php.ini's variables_order is; $_ENV is empty under
// php.ini-production ("GPCS"), which the Docker image uses.
function db_env(string $name): string
{
    $value = $_ENV[$name] ?? getenv($name);
    if ($value === false || $value === '') {
        throw new RuntimeException("Missing environment variable $name (see .env/db.env)");
    }
    return (string) $value;
}

$host = db_env('DB_HOST');
$db = db_env('DB_NAME');
$user = db_env('DB_USER');
$pass = db_env('DB_PASSWORD');

$DB_STMT = new PDO(
    "mysql:host=$host;dbname=$db;charset=utf8mb4",
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_PERSISTENT => true,
        PDO::ATTR_TIMEOUT => 2
    ]
);
$DB_STMT->exec('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');


