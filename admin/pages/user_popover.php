<?php
declare(strict_types=1);
// Profile summary for the user popovers in admin tables (user_cell() in
// global/funcs.php, wired up in statics/main.js). Returns an HTML fragment.
// main_config.php's login check covers this page like any other.
include "../main_config.php";
include "../global/funcs.php";

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, max-age=60');

$db = $DB_STMT;
$user_id = trim((string) ($_GET['id'] ?? ''));
if ($user_id === '') {
    http_response_code(400);
    exit('<div class="text-muted small">No user.</div>');
}

try {
    $stmt = $db->prepare('SELECT u.user_id, u.user_fullname, u.user_email, u.user_phonenumber, u.user_active,
            u.user_verified, u.user_image, u.user_bio_dob, u.geo_meta, u.user_datecreated, u.user_last_accessed,
            (SELECT COUNT(*) FROM users_reported r WHERE r.user_id = u.user_id) AS times_reported
        FROM users u WHERE u.user_id = ? LIMIT 1');
    $stmt->execute([$user_id]);
    $user = $stmt->fetch();
} catch (PDOException $e) {
    error_log('user_popover.php failed: ' . $e->getMessage());
    http_response_code(500);
    exit('<div class="text-danger small">Could not load this user.</div>');
}
if (!$user) {
    http_response_code(404);
    exit('<div class="text-muted small">User not found (deleted?).</div>');
}

$photos = json_decode((string) ($user['user_image'] ?? '[]'), true) ?: [];
$photo = is_array($photos) && isset($photos[0]['p']) ? rtrim(img_domain_base_url(), '/') . $photos[0]['p'] : '';
$geo = json_decode((string) ($user['geo_meta'] ?? '{}'), true) ?: [];
$place = implode(', ', array_filter([$geo['city'] ?? null, $geo['state'] ?? null, $geo['country'] ?? null]));
$age = null;
if (preg_match('/^\d{8}$/', (string) $user['user_bio_dob'])) {
    $dob = DateTime::createFromFormat('Ymd', (string) $user['user_bio_dob']);
    $age = $dob ? $dob->diff(new DateTime())->y : null;
}
[$status_label, $status_color] = render_user_active((string) $user['user_active']);

/** A value with a copy button (statics/main.js .js-pop-copy), or a dash. */
function copy_value(string $value, bool $mono = false): string
{
    if ($value === '') {
        return '<span class="text-muted">—</span>';
    }
    $v = htmlspecialchars($value, ENT_QUOTES);
    return '<span class="admin-copy-row"><span class="' . ($mono ? 'font-monospace ' : '') . 'admin-copy-text">' . $v . '</span>'
        . '<button type="button" class="admin-copy-btn js-pop-copy" data-copy="' . $v . '" aria-label="Copy ' . $v . '">'
        . '<i class="bi bi-copy"></i></button></span>';
}
$reported = (int) $user['times_reported'];
?>
<div class="admin-user-card">
    <div class="d-flex align-items-center gap-2 mb-2">
        <?php if ($photo !== ''): ?>
            <img src="<?php echo htmlspecialchars($photo); ?>" alt="" class="admin-user-card-photo">
        <?php else: ?>
            <span class="admin-user-card-photo d-grid place-items-center"><i class="bi bi-person"></i></span>
        <?php endif; ?>
        <div class="min-w-0">
            <div class="fw-bold text-truncate">
                <?php echo htmlspecialchars((string) $user['user_fullname']); ?><?php echo $age !== null ? ', ' . $age : ''; ?>
                <?php if ((string) $user['user_verified'] === '1'): ?>
                    <i class="bi bi-patch-check-fill text-primary" title="Verified"></i>
                <?php endif; ?>
            </div>
            <span class="badge text-bg-<?php echo $status_color; ?>"><?php echo htmlspecialchars($status_label); ?></span>
            <?php if ($reported > 0): ?>
                <span class="badge text-bg-danger"><?php echo $reported; ?> report<?php echo $reported === 1 ? '' : 's'; ?></span>
            <?php endif; ?>
        </div>
    </div>
    <dl class="admin-pop-dl mb-0">
        <dt>ID</dt><dd><?php echo copy_value((string) $user['user_id'], true); ?></dd>
        <dt>Email</dt><dd><?php echo copy_value((string) ($user['user_email'] ?? '')); ?></dd>
        <dt>Phone</dt><dd><?php echo copy_value((string) ($user['user_phonenumber'] ?? '')); ?></dd>
        <?php if ($place !== ''): ?>
            <dt>Location</dt><dd><?php echo htmlspecialchars($place); ?></dd>
        <?php endif; ?>
        <dt>Joined</dt><dd><?php echo $user['user_datecreated'] ? date('M j, Y', strtotime((string) $user['user_datecreated'])) : '—'; ?></dd>
        <dt>Last seen</dt><dd><?php echo $user['user_last_accessed'] ? date('M j, Y H:i', strtotime((string) $user['user_last_accessed'])) : '—'; ?></dd>
    </dl>
    <a class="btn btn-sm btn-primary w-100 mt-3" href="singleuser.php?id=<?php echo urlencode((string) $user['user_id']); ?>">
        <i class="bi bi-person"></i> View user
    </a>
</div>
