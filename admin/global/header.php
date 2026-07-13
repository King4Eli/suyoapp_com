<?php
$page_title = $page_title ?? 'Dashboard';
$page_subtitle = $page_subtitle ?? 'Admin overview';
$active_page = $active_page ?? '';
$nav_items = [
    'dashboard' => ['Dashboard', 'dashboard.php'],
    'users' => ['Users', 'users.php'],
    'user_reports' => ['User Reports', 'user_reports.php'],
    'applogs' => ['App Logs', 'applogs.php'],
    'storage' => ['Storage', 'storage.php'],
    'logout' => ['Logout', '?logout=true'],
];
?>

<div class="container-fluid bg-light">
    <div class="row min-vh-100">
        <nav class="col-12 col-lg-2 bg-dark text-white p-3 d-flex flex-column">
            <div class="mb-4">
                <div class="h4 mb-1">Admin Console</div>
                <div class="small text-secondary">SoyuApp</div>
            </div>
            <div class="nav nav-pills flex-column gap-1">
                <?php foreach ($nav_items as $key => $nav_item): ?>
                    <?php [$label, $href] = $nav_item; ?>
                    <a class="nav-link text-white<?php echo $key === $active_page ? ' active' : ''; ?>"
                        href="<?php echo htmlspecialchars($href); ?>">
                        <?php echo htmlspecialchars($label); ?>
                    </a>
                <?php endforeach; ?>
            </div>
            <div class="mt-auto pt-4 small text-secondary">Powered by MySQL</div>
        </nav>
        <main class="col-12 col-lg-10 p-4">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                    <h1 class="h3 mb-1"><?php echo htmlspecialchars($page_title); ?></h1>
                    <div class="text-muted"><?php echo htmlspecialchars($page_subtitle); ?></div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge text-bg-light border" id="live-clock">--:--</span>
                    <span class="badge text-bg-dark">MySQL</span>
                </div>
            </div>