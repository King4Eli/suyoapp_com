<?php session_start();

include __DIR__ . "/db_config.php";

$url = "http://".$_SERVER['HTTP_HOST'];

$ENV_ADMIN_FRONTEND_API_USERNAME = $_ENV["ADMIN_FRONTEND_API_USERNAME"] ?? getenv("ADMIN_FRONTEND_API_USERNAME");
$ENV_ADMIN_FRONTEND_API_PASSWORD = $_ENV["ADMIN_FRONTEND_API_PASSWORD"] ?? getenv("ADMIN_FRONTEND_API_PASSWORD");

class sessionname
{
    const isloggedin = "logged_in";
}

if (basename($_SERVER['PHP_SELF']) !== "login.php" && !($_SESSION[sessionname::isloggedin] ?? false)) {
    header("Location: login.php");
    exit;
}
if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: login.php");
    exit;
}