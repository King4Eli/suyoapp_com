<?php 
include "../main_config.php";

$url = "http://localhost:8080"; // Override for dev

if (isset($_SESSION[sessionname::isloggedin]) && $_SESSION[sessionname::isloggedin] === true) {
    header("Location: dashboard.php");
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if ($username === $ENV_ADMIN_FRONTEND_API_USERNAME && $password === $ENV_ADMIN_FRONTEND_API_PASSWORD) {
        $_SESSION[sessionname::isloggedin] = true;
        header("Location: dashboard.php");
        exit;
    } else {
        $error = 'Invalid username or password.';
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <?php include "../global/head.php"; ?>
</head>
<body class="admin-login-bg">
    <div class="container">
        <div class="row justify-content-center align-items-center min-vh-100">
            <div class="col-md-6 col-lg-4">
                <div class="card shadow">
                    <div class="card-body p-5">
                        <div class="text-center mb-4">
                            <span class="admin-brand-mark mx-auto mb-3" style="width:52px;height:52px;font-size:1.4rem">
                                <i class="bi bi-heart-fill"></i>
                            </span>
                            <h2 class="h4 fw-bold mb-1">SoyuApp Admin</h2>
                            <p class="text-muted mb-0">Sign in to the admin console</p>
                        </div>
                        <?php if ($error): ?>
                            <div class="alert alert-danger" role="alert">
                                <?php echo htmlspecialchars($error); ?>
                            </div>
                        <?php endif; ?>
                        <form method="post">
                            <div class="mb-3">
                                <label for="username" class="form-label"><i class="bi bi-person me-1"></i>Username</label>
                                <input type="text" class="form-control" id="username" name="username" required>
                            </div>
                            <div class="mb-3">
                                <label for="password" class="form-label"><i class="bi bi-lock me-1"></i>Password</label>
                                <input type="password" class="form-control" id="password" name="password" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100"><i class="bi bi-box-arrow-in-right me-1"></i>Sign in</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"
        integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI"
        crossorigin="anonymous"></script>
</body>
</html>