<?php
declare(strict_types=1);
include "../main_config.php";
include "../global/funcs.php";

$page_title = 'Devices';
$page_subtitle = 'Registered devices and platform breakdown';
$active_page = 'devices';

$db = $DB_STMT;

function get_device_stats(PDO $db): array
{
    $stats = [
        'total_devices' => 0,
        'unique_users' => 0,
        'emulator_count' => 0,
        'ios_count' => 0,
        'android_count' => 0,
        'other_os_count' => 0,
    ];
    try {
        $stats['total_devices'] = (int) ($db->query('SELECT COUNT(*) FROM users_devices')->fetchColumn() ?: 0);
        $stats['unique_users'] = (int) ($db->query('SELECT COUNT(DISTINCT user_id) FROM users_devices')->fetchColumn() ?: 0);
        $stats['emulator_count'] = (int) ($db->query('SELECT COUNT(*) FROM users_devices WHERE is_emulator = 1')->fetchColumn() ?: 0);
        $stats['ios_count'] = (int) ($db->query("SELECT COUNT(*) FROM users_devices WHERE device_os LIKE 'iOS%'")->fetchColumn() ?: 0);
        $stats['android_count'] = (int) ($db->query("SELECT COUNT(*) FROM users_devices WHERE device_os LIKE 'Android%'")->fetchColumn() ?: 0);
        $stats['other_os_count'] = $stats['total_devices'] - $stats['ios_count'] - $stats['android_count'];
    } catch (PDOException $e) {
        // users_devices may not exist yet -- leave stats at zero
    }
    return $stats;
}

function get_top_brands(PDO $db, int $limit = 6): array
{
    try {
        $stmt = $db->prepare("
            SELECT COALESCE(NULLIF(device_brand, ''), 'Unknown') AS brand, COUNT(*) AS device_count
            FROM users_devices
            GROUP BY brand
            ORDER BY device_count DESC
            LIMIT $limit
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        return [];
    }
}

$stats = get_device_stats($db);
$top_brands = get_top_brands($db);

$query = trim((string) ($_GET['q'] ?? ''));
$os_filter = trim((string) ($_GET['os'] ?? ''));
$limit = (int) ($_GET['limit'] ?? 50);
$limit = max(10, min(200, $limit));
$page = (int) ($_GET['page'] ?? 1);
$page = max(1, $page);
$offset = ($page - 1) * $limit;

$devices = [];
$params = [];
$total_rows = 0;
$where = [];
if ($query !== '') {
    $where[] = '(d.device_id LIKE :q OR d.device_model LIKE :q OR d.device_brand LIKE :q OR d.user_id LIKE :q OR u.user_fullname LIKE :q)';
    $params[':q'] = '%' . $query . '%';
}
if ($os_filter !== '') {
    $where[] = 'd.device_os LIKE :os';
    $params[':os'] = $os_filter . '%';
}
$where_sql = $where ? (' WHERE ' . implode(' AND ', $where)) : '';

$sql = 'SELECT d.id_ai, d.user_id, d.device_id, d.device_name, d.device_model, d.device_brand, d.device_type,
               d.manufacturer, d.device_os, d.carrier, d.app_version, d.is_emulator, d.date_created, d.date_mod,
               u.user_fullname
        FROM users_devices d
        LEFT JOIN users u ON u.user_id = d.user_id'
        . $where_sql . ' ORDER BY d.date_mod DESC LIMIT ' . $limit . ' OFFSET ' . $offset;

try {
    $count_sql = 'SELECT COUNT(*) AS total FROM users_devices d LEFT JOIN users u ON u.user_id = d.user_id' . $where_sql;
    $count_stmt = $db->prepare($count_sql);
    $count_stmt->execute($params);
    $total_rows = (int) ($count_stmt->fetchColumn() ?: 0);

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $devices = $stmt->fetchAll();
} catch (PDOException $e) {
    $devices = [];
    $total_rows = 0;
}

$total_pages = (int) max(1, (int) ceil($total_rows / $limit));
$page = min($page, $total_pages);
$has_prev = $page > 1;
$has_next = $page < $total_pages;

function build_device_page_url(int $page, string $query, string $os_filter, int $limit): string
{
    $params = ['page' => $page, 'limit' => $limit];
    if ($query !== '') {
        $params['q'] = $query;
    }
    if ($os_filter !== '') {
        $params['os'] = $os_filter;
    }
    return 'devices.php?' . http_build_query($params);
}
?>
<html>

<head>
    <?php include "../global/head.php"; ?>
    <style>
        .stat-card {
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
        }
    </style>
</head>

<body>
    <?php include "../global/header.php"; ?>

    <div class="row mb-4">
        <div class="col-6 col-md-4 col-lg-2 mb-3">
            <div class="card stat-card h-100">
                <div class="card-body">
                    <div class="h4 mb-1"><?php echo number_format($stats['total_devices']); ?></div>
                    <div class="text-muted small">Total Devices</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2 mb-3">
            <div class="card stat-card h-100">
                <div class="card-body">
                    <div class="h4 mb-1"><?php echo number_format($stats['unique_users']); ?></div>
                    <div class="text-muted small">Unique Users</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2 mb-3">
            <div class="card stat-card h-100">
                <div class="card-body">
                    <div class="h4 mb-1"><?php echo number_format($stats['ios_count']); ?></div>
                    <div class="text-muted small">iOS</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2 mb-3">
            <div class="card stat-card h-100">
                <div class="card-body">
                    <div class="h4 mb-1"><?php echo number_format($stats['android_count']); ?></div>
                    <div class="text-muted small">Android</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2 mb-3">
            <div class="card stat-card h-100">
                <div class="card-body">
                    <div class="h4 mb-1"><?php echo number_format($stats['other_os_count']); ?></div>
                    <div class="text-muted small">Other OS</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-4 col-lg-2 mb-3">
            <div class="card stat-card h-100">
                <div class="card-body">
                    <div class="h4 mb-1"><?php echo number_format($stats['emulator_count']); ?></div>
                    <div class="text-muted small">Emulators</div>
                </div>
            </div>
        </div>
    </div>

    <?php if ($top_brands): ?>
    <div class="card shadow-sm mb-4">
        <div class="card-header fw-semibold">Top Brands</div>
        <div class="card-body d-flex flex-wrap gap-2">
            <?php foreach ($top_brands as $brand_row): ?>
                <span class="badge text-bg-light border">
                    <?php echo htmlspecialchars($brand_row['brand']); ?>
                    <span class="text-muted">&middot; <?php echo number_format((int) $brand_row['device_count']); ?></span>
                </span>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

    <div class="card shadow-sm mb-4">
        <div class="card-body">
            <form class="row g-2 align-items-end" method="get">
                <div class="col-12 col-md-5">
                    <label class="form-label" for="device-search">Search devices</label>
                    <input class="form-control" id="device-search" name="q" type="search"
                        placeholder="Search by device id, model, brand, user id, or name"
                        value="<?php echo htmlspecialchars($query); ?>">
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="device-os">Platform</label>
                    <select class="form-select" id="device-os" name="os">
                        <option value="">All</option>
                        <option value="iOS"<?php echo $os_filter === 'iOS' ? ' selected' : ''; ?>>iOS</option>
                        <option value="Android"<?php echo $os_filter === 'Android' ? ' selected' : ''; ?>>Android</option>
                    </select>
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="device-limit">Rows</label>
                    <select class="form-select" id="device-limit" name="limit">
                        <?php foreach ([25, 50, 100, 200] as $option): ?>
                            <option value="<?php echo $option; ?>"<?php echo $limit === $option ? ' selected' : ''; ?>><?php echo $option; ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-12 col-md-3 d-flex gap-2">
                    <button class="btn btn-primary flex-fill" type="submit">Apply</button>
                    <a class="btn btn-outline-secondary flex-fill" href="devices.php">Reset</a>
                </div>
                <div class="col-12">
                    <label class="form-label" for="client-filter">Quick filter (client)</label>
                    <input class="form-control" id="client-filter" type="text" placeholder="Filter visible rows">
                </div>
            </form>
        </div>
    </div>

    <div class="card shadow-sm">
        <div class="card-header d-flex align-items-center justify-content-between">
            <span class="fw-semibold">Device List</span>
            <span class="text-muted small"><?php echo number_format($total_rows); ?> total</span>
        </div>
        <div class="table-responsive">
            <table class="table table-striped align-middle mb-0" id="devices-table">
                <thead class="table-light">
                    <tr>
                        <th>User</th>
                        <th>Device</th>
                        <th>Platform</th>
                        <th>App Version</th>
                        <th>Carrier</th>
                        <th>First Seen</th>
                        <th>Last Seen</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!$devices): ?>
                        <tr>
                            <td colspan="8" class="text-center text-muted py-4">No devices found.</td>
                        </tr>
                    <?php endif; ?>
                    <?php foreach ($devices as $device): ?>
                        <tr>
                            <td>
                                <div class="fw-semibold"><?php echo htmlspecialchars($device['user_fullname'] ?? 'Unknown'); ?></div>
                                <div class="small text-muted">
                                    <button type="button" class="btn btn-link p-0 js-copy" title="Click to copy"
                                        data-copy="<?php echo htmlspecialchars($device['user_id'] ?? ''); ?>">
                                        <?php echo htmlspecialchars($device['user_id'] ?? ''); ?>
                                    </button>
                                </div>
                            </td>
                            <td>
                                <div class="fw-semibold">
                                    <?php echo htmlspecialchars(trim(($device['device_brand'] ?? '') . ' ' . ($device['device_model'] ?? '')) ?: 'Unknown'); ?>
                                </div>
                                <div class="small text-muted">
                                    <?php echo htmlspecialchars($device['device_type'] ?? ''); ?>
                                    <?php if (!empty($device['is_emulator'])): ?>
                                        <span class="badge text-bg-secondary">emulator</span>
                                    <?php endif; ?>
                                </div>
                                <div class="small text-muted">
                                    <button type="button" class="btn btn-link p-0 js-copy" title="Click to copy"
                                        data-copy="<?php echo htmlspecialchars($device['device_id'] ?? ''); ?>">
                                        <?php echo htmlspecialchars($device['device_id'] ?? ''); ?>
                                    </button>
                                </div>
                            </td>
                            <td><?php echo htmlspecialchars($device['device_os'] ?? 'Unknown'); ?></td>
                            <td><?php echo htmlspecialchars($device['app_version'] ?? ''); ?></td>
                            <td><?php echo htmlspecialchars($device['carrier'] ?? ''); ?></td>
                            <td><?php echo htmlspecialchars($device['date_created'] ?? ''); ?></td>
                            <td><?php echo htmlspecialchars($device['date_mod'] ?? ''); ?></td>
                            <td class="text-end">
                                <?php if (!empty($device['user_id'])): ?>
                                    <a class="btn btn-sm btn-outline-secondary"
                                        href="singleuser.php?id=<?php echo urlencode($device['user_id']); ?>">User</a>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <div class="card-footer d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
            <div class="small text-muted">
                <?php
                $from = $total_rows === 0 ? 0 : ($offset + 1);
                $to = min($offset + $limit, $total_rows);
                ?>
                Showing <?php echo number_format($from); ?>–<?php echo number_format($to); ?> of <?php echo number_format($total_rows); ?>
            </div>
            <nav aria-label="Devices pagination">
                <ul class="pagination mb-0">
                    <li class="page-item<?php echo $has_prev ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_device_page_url(1, $query, $os_filter, $limit)); ?>">First</a>
                    </li>
                    <li class="page-item<?php echo $has_prev ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_device_page_url(max(1, $page - 1), $query, $os_filter, $limit)); ?>">Prev</a>
                    </li>
                    <li class="page-item disabled">
                        <span class="page-link">Page <?php echo number_format($page); ?> of <?php echo number_format($total_pages); ?></span>
                    </li>
                    <li class="page-item<?php echo $has_next ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_device_page_url(min($total_pages, $page + 1), $query, $os_filter, $limit)); ?>">Next</a>
                    </li>
                    <li class="page-item<?php echo $has_next ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_device_page_url($total_pages, $query, $os_filter, $limit)); ?>">Last</a>
                    </li>
                </ul>
            </nav>
        </div>
    </div>

    <script>
        $(function () {
            $('#client-filter').on('input', function () {
                var query = $(this).val().toLowerCase();
                $('#devices-table tbody tr').each(function () {
                    var text = $(this).text().toLowerCase();
                    $(this).toggle(text.indexOf(query) !== -1);
                });
            });

            function copyText(text, el) {
                if (!text) return;
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(text).then(function () {
                        flashCopied(el);
                    });
                    return;
                }
                var $temp = $('<input>');
                $('body').append($temp);
                $temp.val(text).select();
                document.execCommand('copy');
                $temp.remove();
                flashCopied(el);
            }

            function flashCopied(el) {
                var $el = $(el);
                var original = $el.text();
                $el.addClass('text-success');
                $el.text('Copied');
                setTimeout(function () {
                    $el.text(original);
                    $el.removeClass('text-success');
                }, 900);
            }

            $('.js-copy').on('click', function (e) {
                e.preventDefault();
                copyText($(this).data('copy'), this);
            });
        });
    </script>

    <?php include "../global/footer.php"; ?>
</body>

</html>
