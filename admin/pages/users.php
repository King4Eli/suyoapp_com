<?php
declare(strict_types=1);
include "../main_config.php";
include "../global/funcs.php";

$page_title = 'Users';
$page_subtitle = 'Browse and search user profiles';
$active_page = 'users';

$db = $DB_STMT ;

function render_user_active(?string $value): array
{
    switch ($value) {
        case '1':
            return ['Active', 'success'];
        case '0':
            return ['Inactive', 'secondary'];
        case '2':
            return ['Paused', 'warning'];
        case '3':
            return ['Banned', 'danger'];
        case '-99':
            return ['System', 'dark'];
        default:
            return ['Unknown', 'secondary'];
    }
}

function render_verified(?string $value): array
{
    return $value === '1' ? ['Verified', 'success'] : ['Unverified', 'secondary'];
}

$query = trim((string) ($_GET['q'] ?? ''));
$limit = (int) ($_GET['limit'] ?? 50);
$limit = max(10, min(200, $limit));
$page = (int) ($_GET['page'] ?? 1);
$page = max(1, $page);
$offset = ($page - 1) * $limit;

$users = [];
$params = [];
$total_rows = 0;
$sql = 'SELECT user_id, user_fullname, user_email, user_phonenumber, user_active, user_verified, user_datecreated, user_last_accessed, user_image FROM users';
if ($query !== '') {
    $sql .= ' WHERE user_id LIKE :q OR user_email LIKE :q OR user_fullname LIKE :q OR user_phonenumber LIKE :q';
    $params[':q'] = '%' . $query . '%';
}
$sql .= ' ORDER BY user_datecreated DESC LIMIT ' . $limit . ' OFFSET ' . $offset;

try {
    $count_sql = 'SELECT COUNT(*) AS total FROM users';
    if ($query !== '') {
        $count_sql .= ' WHERE user_id LIKE :q OR user_email LIKE :q OR user_fullname LIKE :q OR user_phonenumber LIKE :q';
    }
    $count_stmt = $db->prepare($count_sql);
    $count_stmt->execute($params);
    $total_rows = (int) ($count_stmt->fetchColumn() ?: 0);

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll();
} catch (PDOException $e) {
    $users = [];
    $total_rows = 0;
}

$total_pages = (int) max(1, (int) ceil($total_rows / $limit));
$page = min($page, $total_pages);
$has_prev = $page > 1;
$has_next = $page < $total_pages;

function build_page_url(int $page, string $query, int $limit): string
{
    $params = ['page' => $page, 'limit' => $limit];
    if ($query !== '') {
        $params['q'] = $query;
    }
    return 'users.php?' . http_build_query($params);
}
?>
<html>

<head>
    <?php include "../global/head.php"; ?>
</head>

<body>
    <?php include "../global/header.php"; ?>

    <div class="card shadow-sm mb-4">
        <div class="card-body">
            <form class="row g-2 align-items-end" method="get">
                <div class="col-12 col-md-6">
                    <label class="form-label" for="user-search">Search users</label>
                    <input class="form-control" id="user-search" name="q" type="search" placeholder="Search by name, email, phone, or id" value="<?php echo htmlspecialchars($query); ?>">
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="user-limit">Rows</label>
                    <select class="form-select" id="user-limit" name="limit">
                        <?php foreach ([25, 50, 100, 200] as $option): ?>
                            <option value="<?php echo $option; ?>"<?php echo $limit === $option ? ' selected' : ''; ?>><?php echo $option; ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-6 col-md-3 d-flex gap-2">
                    <button class="btn btn-primary flex-fill" type="submit">Apply</button>
                    <a class="btn btn-outline-secondary flex-fill" href="users.php">Reset</a>
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
            <span class="fw-semibold">User List</span>
            <span class="text-muted small"><?php echo number_format($total_rows); ?> total</span>
        </div>
        <div class="table-responsive">
            <table class="table table-striped align-middle mb-0" id="users-table">
                <thead class="table-light">
                    <tr>
                        <th>Photo</th>
                        <th>User</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Last Access</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!$users): ?>
                        <tr>
                            <td colspan="7" class="text-center text-muted py-4">No users found.</td>
                        </tr>
                    <?php endif; ?>
                    <?php foreach ($users as $user): ?>
                        <?php [$status_label, $status_color] = render_user_active($user['user_active'] ?? null); ?>
                        <?php [$verified_label, $verified_color] = render_verified($user['user_verified'] ?? null); ?>
                        <?php
                        $images = $user['user_image'] ? json_decode($user['user_image'], true) : [];
                        $profile_src = (!empty($images) && isset($images[0]['p']))
                            ? get_lookup_label($db, "img_domain", 0) . htmlspecialchars($images[0]['p'])
                            : '';
                        ?>
                        <tr>
                            <td>
                                <?php if ($profile_src !== ''): ?>
                                    <img src="<?php echo $profile_src; ?>" alt="Profile image" class="rounded-2"
                                        style="width: 48px; height: 48px; object-fit: cover;">
                                <?php else: ?>
                                    <div class="bg-light text-muted d-flex align-items-center justify-content-center rounded-2"
                                        style="width: 48px; height: 48px; font-size: 11px;">No image</div>
                                <?php endif; ?>
                            </td>
                            <td>
                                <div class="fw-semibold"><?php echo htmlspecialchars($user['user_fullname'] ?? 'Unknown'); ?></div>
                                <div class="small text-muted">
                                    <button type="button" class="btn btn-link p-0 js-copy" title="Click to copy"
                                        data-copy="<?php echo htmlspecialchars($user['user_id'] ?? ''); ?>">
                                        <?php echo htmlspecialchars($user['user_id'] ?? ''); ?>
                                    </button>
                                </div>
                            </td>
                            <td>
                                <div>
                                    <button type="button" class="btn btn-link p-0 js-copy" title="Click to copy"
                                        data-copy="<?php echo htmlspecialchars($user['user_email'] ?? ''); ?>">
                                        <?php echo htmlspecialchars($user['user_email'] ?? ''); ?>
                                    </button>
                                </div>
                                <div class="small text-muted">
                                    <button type="button" class="btn btn-link p-0 js-copy" title="Click to copy"
                                        data-copy="<?php echo htmlspecialchars($user['user_phonenumber'] ?? ''); ?>">
                                        <?php echo htmlspecialchars($user['user_phonenumber'] ?? ''); ?>
                                    </button>
                                </div>
                            </td>
                            <td>
                                <span class="badge text-bg-<?php echo $status_color; ?>"><?php echo htmlspecialchars($status_label); ?></span>
                                <span class="badge text-bg-<?php echo $verified_color; ?>"><?php echo htmlspecialchars($verified_label); ?></span>
                            </td>
                            <td><?php echo htmlspecialchars($user['user_datecreated'] ?? ''); ?></td>
                            <td><?php echo htmlspecialchars($user['user_last_accessed'] ?? ''); ?></td>
                            <td class="text-end">
                                <a class="btn btn-sm btn-outline-secondary" href="singleuser.php?id=<?php echo urlencode($user['user_id'] ?? ''); ?>">View</a>
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
            <nav aria-label="Users pagination">
                <ul class="pagination mb-0">
                    <li class="page-item<?php echo $has_prev ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_page_url(1, $query, $limit)); ?>">First</a>
                    </li>
                    <li class="page-item<?php echo $has_prev ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_page_url(max(1, $page - 1), $query, $limit)); ?>">Prev</a>
                    </li>
                    <li class="page-item disabled">
                        <span class="page-link">Page <?php echo number_format($page); ?> of <?php echo number_format($total_pages); ?></span>
                    </li>
                    <li class="page-item<?php echo $has_next ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_page_url(min($total_pages, $page + 1), $query, $limit)); ?>">Next</a>
                    </li>
                    <li class="page-item<?php echo $has_next ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_page_url($total_pages, $query, $limit)); ?>">Last</a>
                    </li>
                </ul>
            </nav>
        </div>
    </div>

    <script>
        $(function () {
            $('#client-filter').on('input', function () {
                var query = $(this).val().toLowerCase();
                $('#users-table tbody tr').each(function () {
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
