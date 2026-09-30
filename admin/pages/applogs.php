<?php
declare(strict_types=1);
include "../main_config.php";
include "../global/funcs.php";

$page_title = 'Application Logs';
$page_subtitle = 'Server/app error and event log stream';
$active_page = 'applogs';

$db = $DB_STMT;
$action_error = '';

function render_report_status(?string $value): array
{
    switch ($value) {
        case '1':
            return ['Resolved', 'success'];
        case '2':
            return ['Escalated', 'danger'];
        default:
            return ['Open', 'warning'];
    }
}

function format_report_data(?string $raw): string
{
    if ($raw === null || $raw === '') {
        return '';
    }
    $decoded = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        $pretty = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        return $pretty === false ? $raw : $pretty;
    }
    return $raw;
}

function safe_dom_id(string $value, int $fallback): string
{
    $sanitized = preg_replace('/[^a-zA-Z0-9_-]/', '', $value);
    if ($sanitized === '') {
        return 'row-' . $fallback;
    }
    return $sanitized . '-' . $fallback;
}

$status_actions = [
    'open' => 0,
    'resolved' => 1,
    'escalated' => 2,
];

$filter_keys = ['q', 'status', 'report_type', 'app_version', 'device_os', 'build', 'emulator', 'user', 'from', 'to', 'limit'];
$f = [];
foreach ($filter_keys as $key) {
    $f[$key] = trim((string) ($_GET[$key] ?? ''));
}
$query = $f['q'];
$status = $f['status'];
$report_type_filter = $f['report_type'];
$limit = (int) ($f['limit'] !== '' ? $f['limit'] : 100);
$limit = max(25, min(200, $limit));
$page = max(1, (int) ($_GET['page'] ?? 1));
$offset = ($page - 1) * $limit;

// Every query here shares these joins, so filters on device columns work for
// the count as well as the rows. app_version / device_os are the device's
// current values (users_devices is updated in place), not what it ran when the
// log was written; build_hash is the API build that wrote the log.
$from_sql = ' FROM logs_application r
    LEFT JOIN users u ON u.user_id = r.report_currentuser
    LEFT JOIN users_devices d ON d.device_id = r.device_id';

/** Distinct non-empty values of one column, for a filter dropdown. */
function distinct_values(PDO $db, string $expr, string $from_sql): array
{
    try {
        $stmt = $db->query("SELECT DISTINCT $expr AS v $from_sql WHERE $expr IS NOT NULL AND TRIM($expr) <> '' ORDER BY v DESC LIMIT 100");
        return array_values(array_map(static fn($row) => (string) $row['v'], $stmt->fetchAll()));
    } catch (PDOException $e) {
        return [];
    }
}
$report_types = distinct_values($db, 'r.report_type', $from_sql);
sort($report_types);
$app_versions = distinct_values($db, 'd.app_version', $from_sql);
usort($app_versions, static fn($a, $b) => version_compare($b, $a));
$device_oses = distinct_values($db, 'd.device_os', $from_sql);
$builds = distinct_values($db, 'r.build_hash', $from_sql);

$NONE = '__none__'; // dropdown value for "not recorded"
$params = [];
$where = [];
if ($query !== '') {
    $where[] = '(r.report_id LIKE :q OR r.report_type LIKE :q OR r.report_currentuser LIKE :q OR u.user_fullname LIKE :q OR r.build_hash LIKE :q OR r.report_data LIKE :q)';
    $params[':q'] = '%' . $query . '%';
}
if ($status !== '' && ctype_digit($status)) {
    $where[] = 'r.report_status = :status';
    $params[':status'] = (int) $status;
}
if ($report_type_filter !== '') {
    $where[] = 'r.report_type = :report_type';
    $params[':report_type'] = $report_type_filter;
}
foreach ([
    'app_version' => 'd.app_version',
    'device_os' => 'd.device_os',
    'build' => 'r.build_hash',
] as $key => $column) {
    if ($f[$key] === $NONE) {
        $where[] = "($column IS NULL OR $column = '')";
    } elseif ($f[$key] !== '') {
        $where[] = "$column = :$key";
        $params[":$key"] = $f[$key];
    }
}
if ($f['emulator'] === '1' || $f['emulator'] === '0') {
    $where[] = 'd.is_emulator = :emulator';
    $params[':emulator'] = (int) $f['emulator'];
}
if ($f['user'] !== '') {
    $where[] = 'r.report_currentuser = :user';
    $params[':user'] = $f['user'];
}
// Dates are local days; created_at is unix seconds.
if ($f['from'] !== '' && ($ts = strtotime($f['from'] . ' 00:00:00')) !== false) {
    $where[] = 'r.created_at >= :from_ts';
    $params[':from_ts'] = $ts;
}
if ($f['to'] !== '' && ($ts = strtotime($f['to'] . ' 23:59:59')) !== false) {
    $where[] = 'r.created_at <= :to_ts';
    $params[':to_ts'] = $ts;
}
$where_sql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

// Status changes: one row (row menu), the ticked rows, or every log matching
// the current filters (the form posts back to this URL, so $where above is the
// same filter the list shows).
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = trim((string) ($_POST['action'] ?? ''));
    $scope = (string) ($_POST['scope'] ?? 'selected');
    $ids = $_POST['report_ids'] ?? [];
    if (!is_array($ids)) {
        $ids = [];
    }
    if (isset($_POST['report_id']) && $_POST['report_id'] !== '') {
        $ids[] = $_POST['report_id'];
    }
    $ids = array_values(array_unique(array_filter(array_map('strval', $ids), static fn($id) => $id !== '')));

    if (!isset($status_actions[$action])) {
        $action_error = 'Pick a status to apply.';
    } elseif ($scope !== 'filter' && !$ids) {
        $action_error = 'Select at least one log.';
    } else {
        try {
            $update_params = [':new_status' => $status_actions[$action]];
            if ($scope === 'filter') {
                // UPDATE can't join, so match the filtered ids through a derived table.
                $sql = 'UPDATE logs_application SET report_status = :new_status, updated_at = UNIX_TIMESTAMP()
                    WHERE report_id IN (SELECT report_id FROM (SELECT r.report_id' . $from_sql . $where_sql . ') AS matched)';
                $update_params += $params;
            } else {
                $placeholders = [];
                foreach (array_slice($ids, 0, 1000) as $n => $id) {
                    $placeholders[] = ":id$n";
                    $update_params[":id$n"] = $id;
                }
                $sql = 'UPDATE logs_application SET report_status = :new_status, updated_at = UNIX_TIMESTAMP()
                    WHERE report_id IN (' . implode(', ', $placeholders) . ')';
            }
            $stmt = $db->prepare($sql);
            $stmt->execute($update_params);
            $_SESSION['applogs_notice'] = number_format($stmt->rowCount()) . ' log(s) marked ' . $action . '.';
            header('Location: applogs.php' . ($_SERVER['QUERY_STRING'] !== '' ? '?' . $_SERVER['QUERY_STRING'] : ''));
            exit;
        } catch (PDOException $e) {
            error_log('applogs.php status update failed: ' . $e->getMessage());
            $action_error = 'Unable to update log status.';
        }
    }
}
$action_notice = $_SESSION['applogs_notice'] ?? '';
unset($_SESSION['applogs_notice']);

$reports = [];
$total_rows = 0;
try {
    $count_stmt = $db->prepare('SELECT COUNT(*)' . $from_sql . $where_sql);
    $count_stmt->execute($params);
    $total_rows = (int) ($count_stmt->fetchColumn() ?: 0);

    $stmt = $db->prepare('SELECT r.report_id, r.report_type, r.report_status, r.report_data, r.created_at, r.updated_at, r.report_currentuser, r.build_hash, u.user_fullname, d.device_id, d.device_model, d.device_brand, d.device_os, d.app_version, d.is_emulator'
        . $from_sql . $where_sql
        . ' ORDER BY r.created_at DESC LIMIT ' . $limit . ' OFFSET ' . $offset);
    $stmt->execute($params);
    $reports = $stmt->fetchAll();
} catch (PDOException $e) {
    error_log('applogs.php query failed: ' . $e->getMessage());
    $action_error = 'Could not load logs: ' . $e->getMessage();
}
$active_filters = count(array_filter($f, static fn($v, $k) => $v !== '' && $k !== 'limit', ARRAY_FILTER_USE_BOTH));

$total_pages = (int) max(1, (int) ceil(($total_rows ?: 1) / $limit));
$page = min($page, $total_pages);
$offset = ($page - 1) * $limit;
$has_prev = $page > 1;
$has_next = $page < $total_pages;

/** Preserve the current filters while switching pages. */
function build_logs_page_url(int $page): string
{
    $params = ['page' => $page];
    global $filter_keys;
    foreach ($filter_keys as $key) {
        $value = trim((string) ($_GET[$key] ?? ''));
        if ($value !== '') {
            $params[$key] = $value;
        }
    }
    return 'applogs.php?' . http_build_query($params);
}
?>
<html>

<head>
    <?php include "../global/head.php"; ?>
</head>

<body>
    <?php include "../global/header.php"; ?>

    <?php if ($action_error !== ''): ?>
        <div class="alert alert-danger"><?php echo htmlspecialchars($action_error); ?></div>
    <?php endif; ?>
    <?php if ($action_notice !== ''): ?>
        <div class="alert alert-success"><?php echo htmlspecialchars($action_notice); ?></div>
    <?php endif; ?>

    <div class="card shadow-sm mb-4">
        <div class="card-body">
            <form class="row g-2 align-items-end" method="get">
                <div class="col-12 col-md-6 col-xl-4">
                    <label class="form-label" for="report-search">Search logs</label>
                    <input class="form-control" id="report-search" name="q" type="search"
                        placeholder="Log id, type, user, build or message text"
                        value="<?php echo htmlspecialchars($query); ?>">
                </div>
                <div class="col-6 col-md-3 col-xl-2">
                    <label class="form-label" for="report-status">Status</label>
                    <select class="form-select" id="report-status" name="status">
                        <option value="">All</option>
                        <option value="0" <?php echo $status === '0' ? ' selected' : ''; ?>>Open</option>
                        <option value="1" <?php echo $status === '1' ? ' selected' : ''; ?>>Resolved</option>
                        <option value="2" <?php echo $status === '2' ? ' selected' : ''; ?>>Escalated</option>
                    </select>
                </div>
                <div class="col-6 col-md-3 col-xl-2">
                    <label class="form-label" for="report-type">Log type</label>
                    <select class="form-select" id="report-type" name="report_type">
                        <option value="">All</option>
                        <?php foreach ($report_types as $opt): ?>
                            <option value="<?php echo htmlspecialchars($opt, ENT_QUOTES, 'UTF-8'); ?>" <?php echo $report_type_filter === $opt ? ' selected' : ''; ?>><?php echo htmlspecialchars($opt); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-6 col-md-3 col-xl-2">
                    <label class="form-label" for="report-version">App version</label>
                    <select class="form-select" id="report-version" name="app_version">
                        <option value="">All</option>
                        <option value="<?php echo $NONE; ?>" <?php echo $f['app_version'] === $NONE ? ' selected' : ''; ?>>Not recorded</option>
                        <?php foreach ($app_versions as $opt): ?>
                            <option value="<?php echo htmlspecialchars($opt, ENT_QUOTES, 'UTF-8'); ?>" <?php echo $f['app_version'] === $opt ? ' selected' : ''; ?>><?php echo htmlspecialchars($opt); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-6 col-md-3 col-xl-2">
                    <label class="form-label" for="report-os">Device OS</label>
                    <select class="form-select" id="report-os" name="device_os">
                        <option value="">All</option>
                        <option value="<?php echo $NONE; ?>" <?php echo $f['device_os'] === $NONE ? ' selected' : ''; ?>>Not recorded</option>
                        <?php foreach ($device_oses as $opt): ?>
                            <option value="<?php echo htmlspecialchars($opt, ENT_QUOTES, 'UTF-8'); ?>" <?php echo $f['device_os'] === $opt ? ' selected' : ''; ?>><?php echo htmlspecialchars($opt); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-6 col-md-3 col-xl-2">
                    <label class="form-label" for="report-build">API build</label>
                    <select class="form-select" id="report-build" name="build">
                        <option value="">All</option>
                        <option value="<?php echo $NONE; ?>" <?php echo $f['build'] === $NONE ? ' selected' : ''; ?>>Not recorded</option>
                        <?php foreach ($builds as $opt): ?>
                            <option value="<?php echo htmlspecialchars($opt, ENT_QUOTES, 'UTF-8'); ?>" <?php echo $f['build'] === $opt ? ' selected' : ''; ?>><?php echo htmlspecialchars($opt); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-6 col-md-3 col-xl-2">
                    <label class="form-label" for="report-emulator">Device kind</label>
                    <select class="form-select" id="report-emulator" name="emulator">
                        <option value="">All</option>
                        <option value="0" <?php echo $f['emulator'] === '0' ? ' selected' : ''; ?>>Real devices</option>
                        <option value="1" <?php echo $f['emulator'] === '1' ? ' selected' : ''; ?>>Emulators</option>
                    </select>
                </div>
                <div class="col-6 col-md-3 col-xl-2">
                    <label class="form-label" for="report-from">From</label>
                    <input class="form-control" id="report-from" name="from" type="date" value="<?php echo htmlspecialchars($f['from']); ?>">
                </div>
                <div class="col-6 col-md-3 col-xl-2">
                    <label class="form-label" for="report-to">To</label>
                    <input class="form-control" id="report-to" name="to" type="date" value="<?php echo htmlspecialchars($f['to']); ?>">
                </div>
                <div class="col-12 col-md-6 col-xl-4">
                    <label class="form-label" for="report-user">User id</label>
                    <input class="form-control font-monospace" id="report-user" name="user" type="text"
                        placeholder="Exact user id" value="<?php echo htmlspecialchars($f['user']); ?>">
                </div>
                <div class="col-6 col-md-3 col-xl-2">
                    <label class="form-label" for="report-limit">Rows / page</label>
                    <select class="form-select" id="report-limit" name="limit">
                        <?php foreach ([50, 100, 150, 200] as $option): ?>
                            <option value="<?php echo $option; ?>" <?php echo $limit === $option ? ' selected' : ''; ?>>
                                <?php echo $option; ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-12 col-md-6 col-xl-4 d-flex gap-2">
                    <button class="btn btn-primary flex-fill" type="submit"><i class="bi bi-funnel"></i> Apply<?php echo $active_filters ? ' (' . $active_filters . ')' : ''; ?></button>
                    <a class="btn btn-outline-secondary flex-fill" href="applogs.php"><i class="bi bi-arrow-counterclockwise"></i> Reset</a>
                </div>
                <div class="col-12 col-md-6 col-xl-4">
                    <label class="form-label" for="client-filter">Quick filter (this page)</label>
                    <input class="form-control" id="client-filter" type="text" placeholder="Filter visible rows">
                </div>
            </form>
        </div>
    </div>

    <div class="card shadow-sm">
        <div class="card-header d-flex align-items-center justify-content-between">
            <span class="fw-semibold"><i class="bi bi-journal-text"></i>Log Queue</span>
            <span class="text-muted small">
                <?php
                $from = $total_rows === 0 ? 0 : ($offset + 1);
                $to = min($offset + $limit, $total_rows);
                ?>
                Showing <?php echo number_format($from); ?>–<?php echo number_format($to); ?> of <?php echo number_format($total_rows); ?>
            </span>
        </div>
        <?php $post_url = 'applogs.php' . ($_SERVER['QUERY_STRING'] !== '' ? '?' . $_SERVER['QUERY_STRING'] : ''); ?>
        <form id="bulk-form" method="post" action="<?php echo htmlspecialchars($post_url); ?>"
            class="card-body border-bottom d-flex flex-wrap align-items-center gap-2 py-2">
            <span class="small fw-semibold" id="bulk-count">0 selected</span>
            <select class="form-select form-select-sm w-auto" name="action" id="bulk-action">
                <option value="">Mark as…</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
            </select>
            <select class="form-select form-select-sm w-auto" name="scope" id="bulk-scope">
                <option value="selected">Selected rows</option>
                <option value="filter">All <?php echo number_format($total_rows); ?> matching the filters</option>
            </select>
            <button class="btn btn-sm btn-primary" type="submit" id="bulk-apply" disabled>
                <i class="bi bi-check2-all"></i> Apply
            </button>
        </form>
        <form id="row-action-form" method="post" action="<?php echo htmlspecialchars($post_url); ?>" class="d-none">
            <input type="hidden" name="report_id" value="">
            <input type="hidden" name="action" value="">
            <input type="hidden" name="scope" value="selected">
        </form>
        <div class="table-responsive">
            <table class="table table-striped align-middle mb-0" id="reports-table">
                <thead class="table-light">
                    <tr>
                        <th style="width:1%">
                            <input class="form-check-input" type="checkbox" id="check-all" aria-label="Select all on this page">
                        </th>
                        <th>Log</th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Last Updated</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!$reports): ?>
                        <tr>
                            <td colspan="7" class="text-center text-muted py-4">No logs found.</td>
                        </tr>
                    <?php endif; ?>
                    <?php foreach ($reports as $index => $report): ?>
                            <?php [$status_label, $status_color] = render_report_status((string) ($report['report_status'] ?? '0')); ?>
                            <?php $collapse_id = 'report-' . safe_dom_id((string) ($report['report_id'] ?? ''), $index); ?>
                            <?php $last_updated = $report['updated_at'] ?? $report['created_at'] ?? ''; ?>
                            <?php $created_at = $report['created_at'] ?? $report['created_at'] ?? ''; ?>
                            <tr>
                                <td>
                                    <input class="form-check-input js-row-check" type="checkbox" form="bulk-form"
                                        name="report_ids[]" value="<?php echo htmlspecialchars($report['report_id'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"
                                        aria-label="Select log">
                                </td>
                                <td>
                                    <div class="fw-semibold"><?php echo htmlspecialchars($report['report_type'] ?? ''); ?></div>
                                    <div class="small text-muted"><?php echo htmlspecialchars($report['report_id'] ?? ''); ?>
                                    </div>
                                    <?php if (!empty($report['build_hash'])): ?>
                                        <?php $build = (string) $report['build_hash']; ?>
                                        <span class="badge text-bg-light border font-monospace" title="<?php echo htmlspecialchars($build); ?>">
                                            build <?php echo htmlspecialchars(preg_match('/^[0-9a-f]{40}$/i', $build) ? substr($build, 0, 7) : $build); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if (!empty($report['app_version'])): ?>
                                        <span class="badge text-bg-light border">v<?php echo htmlspecialchars($report['app_version']); ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($report['device_os'])): ?>
                                        <span class="badge text-bg-light border"><?php echo htmlspecialchars($report['device_os']); ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($report['is_emulator'])): ?>
                                        <span class="badge bg-secondary">emulator</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php echo user_cell($report['report_currentuser'] ?? null, $report['user_fullname'] ?? null); ?>
                                </td>
                                <td><span
                                        class="badge text-bg-<?php echo $status_color; ?>"><?php echo htmlspecialchars($status_label); ?></span>
                                </td>
                                <td><?php echo time_cell($created_at); ?></td>
                                <td><?php echo time_cell($last_updated); ?></td>
                                <td class="text-end">
                                    <div class="btn-group">
                                        <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse"
                                            data-bs-target="#<?php echo $collapse_id; ?>" aria-expanded="false">
                                            Details
                                        </button>
                                        <button type="button" class="btn btn-sm btn-outline-secondary dropdown-toggle dropdown-toggle-split"
                                            data-bs-toggle="dropdown" aria-expanded="false">
                                            <span class="visually-hidden">Toggle actions</span>
                                        </button>
                                        <ul class="dropdown-menu dropdown-menu-end">
                                            <li>
                                                <button type="button" class="dropdown-item js-report-action" data-action="open" data-id="<?php echo htmlspecialchars($report['report_id'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
                                                    Mark as open
                                                </button>
                                            </li>
                                            <li>
                                                <button type="button" class="dropdown-item js-report-action" data-action="resolved" data-id="<?php echo htmlspecialchars($report['report_id'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
                                                    Mark as resolved
                                                </button>
                                            </li>
                                            <li>
                                                <button type="button" class="dropdown-item js-report-action" data-action="escalated" data-id="<?php echo htmlspecialchars($report['report_id'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
                                                    Mark as escalated
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                    <?php if (!empty($report['device_id'])): ?>
                                        <a class="btn btn-sm btn-outline-secondary"
                                            href="devices.php?q=<?php echo urlencode($report['device_id']); ?>">Device</a>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <tr class="collapse bg-light" id="<?php echo $collapse_id; ?>">
                                <td colspan="7">
                                    <?php if (!empty($report['device_model']) || !empty($report['device_os'])): ?>
                                        <div class="small text-muted mb-2">
                                            Device:
                                            <?php if (!empty($report['device_id'])): ?>
                                                <a href="devices.php?q=<?php echo urlencode($report['device_id']); ?>"><?php echo htmlspecialchars(trim(($report['device_brand'] ?? '') . ' ' . ($report['device_model'] ?? ''))); ?></a>
                                            <?php else: ?>
                                                <?php echo htmlspecialchars(trim(($report['device_brand'] ?? '') . ' ' . ($report['device_model'] ?? ''))); ?>
                                            <?php endif; ?>
                                            &middot; <?php echo htmlspecialchars($report['device_os'] ?? 'unknown os'); ?>
                                            <?php if (!empty($report['app_version'])): ?>
                                                &middot; app v<?php echo htmlspecialchars($report['app_version']); ?>
                                            <?php endif; ?>
                                            <?php if (!empty($report['is_emulator'])): ?>
                                                &middot; <span class="badge bg-secondary">emulator</span>
                                            <?php endif; ?>
                                        </div>
                                    <?php endif; ?>
                                    <pre class="small mb-0" style="text-wrap:wrap;overflow-wrap:anywhere"><?php echo htmlspecialchars(format_report_data($report['report_data'] ?? '')); ?></pre>
                                </td>
                            </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
            <div class="card-footer d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                <div class="small text-muted">
                    Page <?php echo number_format($page); ?> of <?php echo number_format($total_pages); ?>
                </div>
                <nav aria-label="Application logs pagination">
                    <ul class="pagination mb-0">
                        <li class="page-item<?php echo $has_prev ? '' : ' disabled'; ?>">
                            <a class="page-link" href="<?php echo htmlspecialchars(build_logs_page_url(1)); ?>">First</a>
                        </li>
                        <li class="page-item<?php echo $has_prev ? '' : ' disabled'; ?>">
                            <a class="page-link" href="<?php echo htmlspecialchars(build_logs_page_url(max(1, $page - 1))); ?>">Prev</a>
                        </li>
                        <li class="page-item disabled">
                            <span class="page-link">Page <?php echo number_format($page); ?> / <?php echo number_format($total_pages); ?></span>
                        </li>
                        <li class="page-item<?php echo $has_next ? '' : ' disabled'; ?>">
                            <a class="page-link" href="<?php echo htmlspecialchars(build_logs_page_url(min($total_pages, $page + 1))); ?>">Next</a>
                        </li>
                        <li class="page-item<?php echo $has_next ? '' : ' disabled'; ?>">
                            <a class="page-link" href="<?php echo htmlspecialchars(build_logs_page_url($total_pages)); ?>">Last</a>
                        </li>
                    </ul>
                </nav>
            </div>
    </div>

    <script>
        $(function () {
            $('#client-filter').on('input', function () {
                var query = $(this).val().toLowerCase();
                $('#reports-table tbody tr').each(function () {
                    var text = $(this).text().toLowerCase();
                    if ($(this).hasClass('collapse')) {
                        return;
                    }
                    $(this).toggle(text.indexOf(query) !== -1);
                });
            });

            $('.js-report-action').on('click', function () {
                var action = $(this).data('action');
                if (!confirm('Mark this log as ' + action + '?')) {
                    return;
                }
                var $form = $('#row-action-form');
                $form.find('input[name="report_id"]').val($(this).data('id'));
                $form.find('input[name="action"]').val(action);
                $form.trigger('submit');
            });

            // Bulk bar: count ticked rows, enable Apply only when it can do something.
            var totalMatching = <?php echo (int) $total_rows; ?>;
            function refreshBulk() {
                var checked = $('.js-row-check:checked').length;
                var all = $('.js-row-check').length;
                var scope = $('#bulk-scope').val();
                $('#bulk-count').text(scope === 'filter'
                    ? totalMatching.toLocaleString() + ' matching'
                    : checked + ' selected');
                $('#check-all').prop('checked', all > 0 && checked === all)
                    .prop('indeterminate', checked > 0 && checked < all);
                $('#bulk-apply').prop('disabled', !$('#bulk-action').val()
                    || (scope === 'filter' ? totalMatching === 0 : checked === 0));
            }
            $('#check-all').on('change', function () {
                $('.js-row-check:visible').prop('checked', this.checked);
                refreshBulk();
            });
            $(document).on('change', '.js-row-check', refreshBulk);
            $('#bulk-action, #bulk-scope').on('change', refreshBulk);
            $('#bulk-form').on('submit', function () {
                var scope = $('#bulk-scope').val();
                var n = scope === 'filter' ? totalMatching : $('.js-row-check:checked').length;
                return confirm('Mark ' + n.toLocaleString() + ' log(s) as ' + $('#bulk-action').val() + '?');
            });
            refreshBulk();
        });
    </script>

    <?php include "../global/footer.php"; ?>
</body>

</html>
