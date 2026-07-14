<?php
declare(strict_types=1);
include "../main_config.php";

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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $report_id = trim((string) ($_POST['report_id'] ?? ''));
    $action = trim((string) ($_POST['action'] ?? ''));
    if ($report_id !== '' && isset($status_actions[$action])) {
        try {
            $stmt = $db->prepare('UPDATE logs_application SET report_status = :status, updated_at = NOW() WHERE report_id = :id');
            $stmt->execute([
                ':status' => $status_actions[$action],
                ':id' => $report_id,
            ]);
            $redirect = $_SERVER['HTTP_REFERER'] ?? 'applogs.php';
            header('Location: ' . $redirect);
            exit;
        } catch (PDOException $e) {
            $action_error = 'Unable to update log status.';
        }
    } else {
        $action_error = 'Invalid action.';
    }
}

$query = trim((string) ($_GET['q'] ?? ''));
$status = trim((string) ($_GET['status'] ?? ''));
$report_type_filter = trim((string) ($_GET['report_type'] ?? ''));
$view = trim((string) ($_GET['view'] ?? 'list'));
$view = in_array($view, ['list', 'group'], true) ? $view : 'list';
$limit = (int) ($_GET['limit'] ?? 100);
$limit = max(25, min(200, $limit));

$report_types = [];
try {
    $type_stmt = $db->query('SELECT DISTINCT report_type FROM logs_application WHERE report_type IS NOT NULL AND TRIM(report_type) <> "" ORDER BY report_type ASC');
    $report_types = array_values(array_filter(array_map(static function ($row): string {
        return trim((string) ($row['report_type'] ?? ''));
    }, $type_stmt->fetchAll()), static function (string $value): bool {
        return $value !== '';
    }));
} catch (PDOException $e) {
    $report_types = [];
}

$reports = [];
$params = [];
$where = [];
$sql = $view === 'group'
    ? 'SELECT r.report_type, COUNT(*) AS report_count FROM logs_application r LEFT JOIN users u ON u.user_id = r.report_currentuser'
    : 'SELECT r.report_id, r.report_type, r.report_status, r.report_data, r.created_at, r.updated_at, r.report_currentuser, u.user_fullname FROM logs_application r LEFT JOIN users u ON u.user_id = r.report_currentuser';
if ($query !== '') {
    $where[] = '(r.report_id LIKE :q OR r.report_type LIKE :q OR r.report_currentuser LIKE :q OR u.user_fullname LIKE :q)';
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
if ($where) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
if ($view === 'group') {
    $sql .= ' GROUP BY r.report_type';
    $sql .= ' ORDER BY report_count DESC, r.report_type ASC LIMIT ' . $limit;
} else {
    $sql .= ' ORDER BY r.created_at DESC LIMIT ' . $limit;
}

try {
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $reports = $stmt->fetchAll();
} catch (PDOException $e) {
    $reports = [];
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

    <div class="card shadow-sm mb-4">
        <div class="card-body">
            <form class="row g-2 align-items-end" method="get">
                <div class="col-12 col-md-6">
                    <label class="form-label" for="report-search">Search logs</label>
                    <input class="form-control" id="report-search" name="q" type="search"
                        placeholder="Search by log id, type, or user"
                        value="<?php echo htmlspecialchars($query); ?>">
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="report-status">Status</label>
                    <select class="form-select" id="report-status" name="status">
                        <option value="">All</option>
                        <option value="0" <?php echo $status === '0' ? ' selected' : ''; ?>>Open</option>
                        <option value="1" <?php echo $status === '1' ? ' selected' : ''; ?>>Resolved</option>
                        <option value="2" <?php echo $status === '2' ? ' selected' : ''; ?>>Escalated</option>
                    </select>
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="report-type">Report type</label>
                    <select class="form-select" id="report-type" name="report_type">
                        <option value="" <?php echo $report_type_filter === '' ? ' selected' : ''; ?>>All</option>
                        <?php foreach ($report_types as $type): ?>
                            <option value="<?php echo htmlspecialchars($type, ENT_QUOTES, 'UTF-8'); ?>" <?php echo $report_type_filter === $type ? ' selected' : ''; ?>>
                                <?php echo htmlspecialchars($type); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="report-view">View</label>
                    <select class="form-select" id="report-view" name="view">
                        <option value="list" <?php echo $view === 'list' ? ' selected' : ''; ?>>List</option>
                        <option value="group" <?php echo $view === 'group' ? ' selected' : ''; ?>>Group by type</option>
                    </select>
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="report-limit">Rows</label>
                    <select class="form-select" id="report-limit" name="limit">
                        <?php foreach ([50, 100, 150, 200] as $option): ?>
                            <option value="<?php echo $option; ?>" <?php echo $limit === $option ? ' selected' : ''; ?>>
                                <?php echo $option; ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-12 col-md-2 d-flex gap-2">
                    <button class="btn btn-primary flex-fill" type="submit">Apply</button>
                    <a class="btn btn-outline-secondary flex-fill" href="applogs.php">Reset</a>
                </div>
                <div class="col-12 col-md-6">
                    <label class="form-label" for="client-filter">Quick filter (client)</label>
                    <input class="form-control" id="client-filter" type="text" placeholder="Filter visible rows">
                </div>
            </form>
        </div>
    </div>

    <div class="card shadow-sm">
        <div class="card-header d-flex align-items-center justify-content-between">
            <span class="fw-semibold">Log Queue</span>
            <span class="text-muted small"><?php echo count($reports); ?> rows</span>
        </div>
        <div class="table-responsive">
            <table class="table table-striped align-middle mb-0" id="reports-table">
                <thead class="table-light">
                    <tr>
                        <?php if ($view === 'group'): ?>
                            <th>Log type</th>
                            <th>Count</th>
                            <th colspan="4"></th>
                        <?php else: ?>
                            <th>Log</th>
                            <th>User</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Last Updated</th>
                            <th></th>
                        <?php endif; ?>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!$reports): ?>
                        <tr>
                            <td colspan="6" class="text-center text-muted py-4">No logs found.</td>
                        </tr>
                    <?php endif; ?>
                    <?php foreach ($reports as $index => $report): ?>
                        <?php if ($view === 'group'): ?>
                            <tr>
                                <td><?php echo htmlspecialchars($report['report_type'] ?? 'Unknown'); ?></td>
                                <td><?php echo number_format((int) ($report['report_count'] ?? 0)); ?></td>
                                <td colspan="4"></td>
                            </tr>
                        <?php else: ?>
                            <?php [$status_label, $status_color] = render_report_status((string) ($report['report_status'] ?? '0')); ?>
                            <?php $collapse_id = 'report-' . safe_dom_id((string) ($report['report_id'] ?? ''), $index); ?>
                            <?php $last_updated = $report['updated_at'] ?? $report['created_at'] ?? ''; ?>
                            <?php $created_at = $report['created_at'] ?? $report['created_at'] ?? ''; ?>
                            <tr>
                                <td>
                                    <div class="fw-semibold"><?php echo htmlspecialchars($report['report_type'] ?? ''); ?></div>
                                    <div class="small text-muted"><?php echo htmlspecialchars($report['report_id'] ?? ''); ?>
                                    </div>
                                </td>
                                <td>
                                    <div class="fw-semibold">
                                        <?php echo htmlspecialchars($report['user_fullname'] ?? 'Unknown'); ?>
                                    </div>
                                    <div class="small text-muted">
                                        <?php echo htmlspecialchars($report['report_currentuser'] ?? ''); ?>
                                    </div>
                                </td>
                                <td><span
                                        class="badge text-bg-<?php echo $status_color; ?>"><?php echo htmlspecialchars($status_label); ?></span>
                                </td>
                                <td><?php echo $created_at !== '' ? htmlspecialchars(date('Y-m-d H:i:s', (int) $created_at)) : ''; ?></td>
                                <td><?php echo $last_updated !== '' ? htmlspecialchars(date('Y-m-d H:i:s', (int) $last_updated)) : ''; ?></td>
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
                                                <button type="button" class="dropdown-item js-report-action" data-action="open">
                                                    Mark as open
                                                </button>
                                            </li>
                                            <li>
                                                <button type="button" class="dropdown-item js-report-action" data-action="resolved">
                                                    Mark as resolved
                                                </button>
                                            </li>
                                            <li>
                                                <button type="button" class="dropdown-item js-report-action" data-action="escalated">
                                                    Mark as escalated
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                    <form method="post" class="d-inline">
                                        <input type="hidden" name="report_id"
                                            value="<?php echo htmlspecialchars($report['report_id'] ?? ''); ?>">
                                        <input type="hidden" name="action" value="">
                                    </form>
                                    <?php if (!empty($report['report_currentuser'])): ?>
                                        <a class="btn btn-sm btn-outline-primary"
                                            href="singleuser.php?id=<?php echo urlencode($report['report_currentuser']); ?>">User</a>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <tr class="collapse bg-light" id="<?php echo $collapse_id; ?>">
                                <td colspan="6">
                                    <pre class="small mb-0" style="text-wrap:wrap;overflow-wrap:anywhere"><?php echo htmlspecialchars(format_report_data($report['report_data'] ?? '')); ?></pre>
                                </td>
                            </tr>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </tbody>
            </table>
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
                var first = confirm('Are you sure you want to do this?');
                if (!first) {
                    return;
                }
                var second = confirm('This action is non reversable.');
                if (!second) {
                    return;
                }
                var $form = $(this).closest('td').find('form');
                $form.find('input[name="action"]').val(action);
                $form.trigger('submit');
            });
        });
    </script>

    <?php include "../global/footer.php"; ?>
</body>

</html>
