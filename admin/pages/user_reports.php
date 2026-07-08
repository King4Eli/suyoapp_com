<?php
declare(strict_types=1);
include "../main_config.php";

$page_title = 'User Reports';
$page_subtitle = 'User-submitted reports and moderation actions';
$active_page = 'user_reports';

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

$status_actions = [
    'open' => 0,
    'resolved' => 1,
    'escalated' => 2,
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $report_id = trim((string) ($_POST['report_id'] ?? ''));
    $action = trim((string) ($_POST['action'] ?? ''));

    if ($action === 'ban_user') {
        $target_user_id = trim((string) ($_POST['target_user_id'] ?? ''));
        if ($report_id !== '' && ctype_digit($report_id) && $target_user_id !== '') {
            try {
                $db->beginTransaction();
                $stmt = $db->prepare('UPDATE users SET user_active = ? WHERE user_id = ?');
                $stmt->execute(['3', $target_user_id]);
                $stmt = $db->prepare('UPDATE users_reported SET status = 1, date_mod = NOW() WHERE id_ai = ?');
                $stmt->execute([$report_id]);
                $db->commit();
                $redirect = $_SERVER['HTTP_REFERER'] ?? 'user_reports.php';
                header('Location: ' . $redirect);
                exit;
            } catch (PDOException $e) {
                $db->rollBack();
                $action_error = 'Unable to ban the reported user.';
            }
        } else {
            $action_error = 'Invalid action.';
        }
    } elseif ($report_id !== '' && ctype_digit($report_id) && isset($status_actions[$action])) {
        try {
            $stmt = $db->prepare('UPDATE users_reported SET status = :status, date_mod = NOW() WHERE id_ai = :id');
            $stmt->execute([
                ':status' => $status_actions[$action],
                ':id' => $report_id,
            ]);
            $redirect = $_SERVER['HTTP_REFERER'] ?? 'user_reports.php';
            header('Location: ' . $redirect);
            exit;
        } catch (PDOException $e) {
            $action_error = 'Unable to update report status.';
        }
    } else {
        $action_error = 'Invalid action.';
    }
}

$query = trim((string) ($_GET['q'] ?? ''));
$status = trim((string) ($_GET['status'] ?? ''));
$limit = (int) ($_GET['limit'] ?? 100);
$limit = max(25, min(200, $limit));

$reports = [];
$params = [];
$where = [];
$sql = 'SELECT ur.id_ai, ur.user_id, ur.reporter_user_id, ur.status, ur.reason, ur.date_created, ur.date_mod,
        ru.user_fullname AS reported_fullname, rp.user_fullname AS reporter_fullname
        FROM users_reported ur
        LEFT JOIN users ru ON ru.user_id = ur.user_id
        LEFT JOIN users rp ON rp.user_id = ur.reporter_user_id';
if ($query !== '') {
    $where[] = '(ur.user_id LIKE :q OR ur.reporter_user_id LIKE :q OR ur.reason LIKE :q OR ru.user_fullname LIKE :q OR rp.user_fullname LIKE :q)';
    $params[':q'] = '%' . $query . '%';
}
if ($status !== '' && ctype_digit($status)) {
    $where[] = 'ur.status = :status';
    $params[':status'] = (int) $status;
}
if ($where) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
$sql .= ' ORDER BY ur.date_created DESC LIMIT ' . $limit;

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
                    <label class="form-label" for="report-search">Search reports</label>
                    <input class="form-control" id="report-search" name="q" type="search"
                        placeholder="Search by user id, reporter id, name, or reason"
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
                    <a class="btn btn-outline-secondary flex-fill" href="user_reports.php">Reset</a>
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
            <span class="fw-semibold">User Report Queue</span>
            <span class="text-muted small"><?php echo count($reports); ?> rows</span>
        </div>
        <div class="table-responsive">
            <table class="table table-striped align-middle mb-0" id="user-reports-table">
                <thead class="table-light">
                    <tr>
                        <th>Reported user</th>
                        <th>Reporter</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!$reports): ?>
                        <tr>
                            <td colspan="6" class="text-center text-muted py-4">No reports found.</td>
                        </tr>
                    <?php endif; ?>
                    <?php foreach ($reports as $report): ?>
                        <?php [$status_label, $status_color] = render_report_status((string) ($report['status'] ?? '0')); ?>
                        <tr>
                            <td>
                                <div class="fw-semibold"><?php echo htmlspecialchars($report['reported_fullname'] ?? 'Unknown'); ?></div>
                                <div class="small text-muted"><?php echo htmlspecialchars($report['user_id'] ?? ''); ?></div>
                            </td>
                            <td>
                                <?php if (!empty($report['reporter_user_id'])): ?>
                                    <div class="fw-semibold"><?php echo htmlspecialchars($report['reporter_fullname'] ?? 'Unknown'); ?></div>
                                    <div class="small text-muted"><?php echo htmlspecialchars($report['reporter_user_id']); ?></div>
                                <?php else: ?>
                                    <span class="text-muted small">Unknown</span>
                                <?php endif; ?>
                            </td>
                            <td style="max-width: 320px;">
                                <div class="small" style="text-wrap:wrap;overflow-wrap:anywhere"><?php echo htmlspecialchars((string) ($report['reason'] ?? '')); ?></div>
                            </td>
                            <td><span class="badge text-bg-<?php echo $status_color; ?>"><?php echo htmlspecialchars($status_label); ?></span></td>
                            <td><?php echo htmlspecialchars((string) ($report['date_created'] ?? '')); ?></td>
                            <td class="text-end">
                                <div class="btn-group">
                                    <button type="button" class="btn btn-sm btn-outline-secondary dropdown-toggle"
                                        data-bs-toggle="dropdown" aria-expanded="false">
                                        Actions
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
                                        <li>
                                            <hr class="dropdown-divider">
                                        </li>
                                        <li>
                                            <button type="button" class="dropdown-item text-danger js-report-action"
                                                data-action="ban_user" data-target-user="<?php echo htmlspecialchars($report['user_id'] ?? ''); ?>">
                                                Ban reported user
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                                <form method="post" class="d-inline">
                                    <input type="hidden" name="report_id" value="<?php echo htmlspecialchars((string) ($report['id_ai'] ?? '')); ?>">
                                    <input type="hidden" name="action" value="">
                                    <input type="hidden" name="target_user_id" value="">
                                </form>
                                <?php if (!empty($report['reporter_user_id'])): ?>
                                    <a class="btn btn-sm btn-outline-primary"
                                        href="singleuser.php?id=<?php echo urlencode($report['reporter_user_id']); ?>">Reporter</a>
                                <?php endif; ?>
                                <?php if (!empty($report['user_id'])): ?>
                                    <a class="btn btn-sm btn-outline-danger"
                                        href="singleuser.php?id=<?php echo urlencode($report['user_id']); ?>">Reported</a>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        $(function () {
            $('#client-filter').on('input', function () {
                var query = $(this).val().toLowerCase();
                $('#user-reports-table tbody tr').each(function () {
                    var text = $(this).text().toLowerCase();
                    $(this).toggle(text.indexOf(query) !== -1);
                });
            });

            $('.js-report-action').on('click', function () {
                var action = $(this).data('action');
                var targetUser = $(this).data('target-user');
                var confirmMessage = action === 'ban_user'
                    ? 'Ban this user? They will be marked inactive and hidden from discovery.'
                    : 'Are you sure you want to do this?';
                var first = confirm(confirmMessage);
                if (!first) {
                    return;
                }
                var second = confirm('This action is non reversable.');
                if (!second) {
                    return;
                }
                var $form = $(this).closest('td').find('form');
                $form.find('input[name="action"]').val(action);
                if (targetUser) {
                    $form.find('input[name="target_user_id"]').val(targetUser);
                }
                $form.trigger('submit');
            });
        });
    </script>

    <?php include "../global/footer.php"; ?>
</body>

</html>
