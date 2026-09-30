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

<?php
// Theme switch button (cycles light -> dark -> system); main.js wires it up.
$theme_toggle = '<button type="button" class="admin-chip admin-theme-toggle js-theme-toggle" aria-label="Switch theme">'
    . '<i class="bi bi-circle-half"></i><span class="js-theme-label">System</span></button>';
$brand = '<a class="admin-brand" href="dashboard.php">'
    . '<span class="admin-brand-mark"><i class="bi bi-heart-fill"></i></span>'
    . '<span><span class="admin-brand-name d-block">SoyuApp</span>'
    . '<span class="admin-brand-sub">Admin Console</span></span></a>';
?>
<div class="container-fluid">
    <div class="row min-vh-100">
        <nav class="admin-sidebar-col col-lg-2" aria-label="Main">
            <div class="offcanvas-lg offcanvas-start admin-sidebar" id="adminSidebar" tabindex="-1"
                aria-labelledby="adminSidebarLabel">
                <div class="offcanvas-header">
                    <span id="adminSidebarLabel"><?php echo $brand; ?></span>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"
                        data-bs-target="#adminSidebar" aria-label="Close menu"></button>
                </div>
                <div class="offcanvas-body d-flex">
                    <div class="d-none d-lg-block"><?php echo $brand; ?></div>
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
                </div>
            </div>
        </nav>
        <main class="admin-main col-12 col-lg-10">
            <div class="admin-topbar d-lg-none">
                <button class="admin-hamburger" type="button" data-bs-toggle="offcanvas"
                    data-bs-target="#adminSidebar" aria-controls="adminSidebar" aria-label="Open menu">
                    <i class="bi bi-list"></i>
                </button>
                <?php echo $brand; ?>
                <?php echo $theme_toggle; ?>
            </div>
            <div class="admin-page-head">
                <div class="d-flex align-items-center gap-3">
                    <span class="admin-page-icon"><i class="bi bi-<?php echo $page_icon; ?>"></i></span>
                    <div>
                        <h1 class="admin-page-title"><?php echo htmlspecialchars($page_title); ?></h1>
                        <div class="admin-page-subtitle"><?php echo htmlspecialchars($page_subtitle); ?></div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="d-none d-lg-inline-flex"><?php echo $theme_toggle; ?></span>
                    <span class="admin-chip"><i class="bi bi-clock"></i><span id="live-clock">--:--</span></span>
                    <span class="admin-chip"><i class="bi bi-database"></i>MySQL</span>
                </div>
            </div>
