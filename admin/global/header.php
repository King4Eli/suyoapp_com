<?php
$page_title = $page_title ?? 'Dashboard';
$page_subtitle = $page_subtitle ?? 'Admin overview';
$active_page = $active_page ?? '';

// [label, href, Bootstrap Icons name], grouped for the sidebar
$nav_groups = [
    'Overview' => [
        'dashboard' => ['Dashboard', 'dashboard.php', 'speedometer2'],
    ],
    'Community' => [
        'users' => ['Users', 'users.php', 'people'],
        'locations' => ['Locations', 'locations.php', 'geo-alt'],
        'devices' => ['Devices', 'devices.php', 'phone'],
    ],
    'Trust & Safety' => [
        'verifications' => ['Verifications', 'verifications.php', 'patch-check'],
        'user_reports' => ['User Reports', 'user_reports.php', 'flag'],
    ],
    'System' => [
        'applogs' => ['App Logs', 'applogs.php', 'journal-text'],
    ],
];

// Page header icon: the active nav item's
$page_icon = 'grid';
foreach ($nav_groups as $group_items) {
    if (isset($group_items[$active_page])) {
        $page_icon = $group_items[$active_page][2];
    }
}
?>

<div class="container-fluid">
    <div class="row min-vh-100">
        <nav class="admin-sidebar col-12 col-lg-2 p-3 d-flex flex-column">
            <a class="admin-brand" href="dashboard.php">
                <span class="admin-brand-mark"><i class="bi bi-heart-fill"></i></span>
                <span>
                    <span class="admin-brand-name d-block">SoyuApp</span>
                    <span class="admin-brand-sub">Admin Console</span>
                </span>
            </a>
            <div class="admin-nav nav flex-column gap-1">
                <?php foreach ($nav_groups as $group_label => $group_items): ?>
                    <div class="admin-nav-label"><?php echo htmlspecialchars($group_label); ?></div>
                    <?php foreach ($group_items as $key => [$label, $href, $icon]): ?>
                        <a class="nav-link<?php echo $key === $active_page ? ' active' : ''; ?>"
                            href="<?php echo htmlspecialchars($href); ?>"
                            <?php echo $key === $active_page ? 'aria-current="page"' : ''; ?>>
                            <i class="bi bi-<?php echo $icon; ?>"></i>
                            <span><?php echo htmlspecialchars($label); ?></span>
                        </a>
                    <?php endforeach; ?>
                <?php endforeach; ?>
            </div>
            <div class="admin-nav nav flex-column mt-auto pt-4">
                <a class="nav-link nav-logout" href="?logout=true">
                    <i class="bi bi-box-arrow-left"></i>
                    <span>Log out</span>
                </a>
            </div>
        </nav>
        <main class="admin-main col-12 col-lg-10">
            <div class="admin-page-head">
                <div class="d-flex align-items-center gap-3">
                    <span class="admin-page-icon"><i class="bi bi-<?php echo $page_icon; ?>"></i></span>
                    <div>
                        <h1 class="admin-page-title"><?php echo htmlspecialchars($page_title); ?></h1>
                        <div class="admin-page-subtitle"><?php echo htmlspecialchars($page_subtitle); ?></div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="admin-chip"><i class="bi bi-clock"></i><span id="live-clock">--:--</span></span>
                    <span class="admin-chip"><i class="bi bi-database"></i>MySQL</span>
                </div>
            </div>
