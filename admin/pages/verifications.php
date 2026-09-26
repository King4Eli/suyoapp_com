<?php
declare(strict_types=1);
include "../main_config.php";

$page_title = 'Verifications';
$page_subtitle = 'Selfie checks: does the person in the selfie match the profile and copy the pose?';
$active_page = 'verifications';

$db = $DB_STMT;
$action_error = '';

// Pose codes issued by the API (api/global/verification.js VERIFICATION_POSES).
$pose_labels = [
    'peace_sign' => 'Peace sign next to face',
    'thumbs_up' => 'Thumbs up next to face',
    'touch_nose' => 'Touching nose with one finger',
    'hand_on_head' => 'One hand on top of head',
    'three_fingers' => 'Three fingers next to face',
    'cover_one_eye' => 'One eye covered with hand',
];

// Canned reasons the user sees in the app when a selfie is rejected.
$reject_reasons = [
    "We couldn't match your selfie to your profile photos.",
    "Your selfie didn't show the requested pose.",
    'Your face wasn\'t clearly visible -- try better lighting.',
    'Only you should be in the selfie.',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $verification_id = trim((string) ($_POST['verification_id'] ?? ''));
    $action = trim((string) ($_POST['action'] ?? ''));
    $reason = trim((string) ($_POST['reason'] ?? ''));

    try {
        $stmt = $db->prepare('SELECT id, user_id, status FROM user_verifications WHERE id = ? LIMIT 1');
        $stmt->execute([$verification_id]);
        $request = $stmt->fetch();

        if (!$request || (int) $request['status'] !== 0) {
            $action_error = 'This request was already reviewed or no longer exists.';
        } elseif ($action === 'approve') {
            $db->beginTransaction();
            $stmt = $db->prepare('UPDATE user_verifications SET status = 1, reviewed_at = NOW() WHERE id = ?');
            $stmt->execute([$verification_id]);
            $stmt = $db->prepare("UPDATE users SET user_verified = '1' WHERE user_id = ?");
            $stmt->execute([$request['user_id']]);
            $db->commit();
            header('Location: verifications.php');
            exit;
        } elseif ($action === 'reject' && $reason !== '') {
            $stmt = $db->prepare('UPDATE user_verifications SET status = 2, reject_reason = ?, reviewed_at = NOW() WHERE id = ?');
            $stmt->execute([mb_substr($reason, 0, 255), $verification_id]);
            header('Location: verifications.php');
            exit;
        } else {
            $action_error = 'Pick a reason before rejecting.';
        }
    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        $action_error = 'Unable to update this verification.';
    }
}

$status = trim((string) ($_GET['status'] ?? '0'));
$params = [];
$sql = 'SELECT v.id, v.user_id, v.selfie_path, v.pose, v.status, v.reject_reason, v.created_at, v.reviewed_at,
        u.user_fullname, u.user_image, u.user_verified
        FROM user_verifications v
        LEFT JOIN users u ON u.user_id = v.user_id';
if ($status !== '' && ctype_digit($status)) {
    $sql .= ' WHERE v.status = :status';
    $params[':status'] = (int) $status;
}
// Oldest pending first, so nobody waits forever; newest first for history.
$sql .= $status === '0' ? ' ORDER BY v.created_at ASC' : ' ORDER BY v.created_at DESC';
$sql .= ' LIMIT 100';

try {
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $requests = $stmt->fetchAll();
} catch (PDOException $e) {
    $requests = [];
}

$img_base = rtrim(img_domain_base_url(), '/');
$status_labels = [0 => ['Pending', 'warning'], 1 => ['Approved', 'success'], 2 => ['Rejected', 'danger']];
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

    <div class="d-flex gap-2 mb-3">
        <?php foreach (['0' => 'Pending', '1' => 'Approved', '2' => 'Rejected', '' => 'All'] as $value => $label): ?>
            <a class="btn btn-sm <?php echo $status === (string) $value ? 'btn-primary' : 'btn-outline-secondary'; ?>"
                href="verifications.php?status=<?php echo urlencode((string) $value); ?>"><?php echo $label; ?></a>
        <?php endforeach; ?>
    </div>

    <?php if (!$requests): ?>
        <div class="card shadow-sm">
            <div class="card-body text-center text-muted py-5">Nothing here.</div>
        </div>
    <?php endif; ?>

    <?php foreach ($requests as $request): ?>
        <?php
        $photos = json_decode((string) ($request['user_image'] ?? '[]'), true) ?: [];
        [$status_label, $status_color] = $status_labels[(int) $request['status']] ?? ['Unknown', 'secondary'];
        ?>
        <div class="card shadow-sm mb-3">
            <div class="card-header d-flex align-items-center justify-content-between">
                <div>
                    <a class="fw-semibold" href="singleuser.php?id=<?php echo urlencode($request['user_id']); ?>">
                        <?php echo htmlspecialchars($request['user_fullname'] ?? 'Unknown'); ?>
                    </a>
                    <span class="small text-muted ms-2"><?php echo htmlspecialchars((string) $request['created_at']); ?></span>
                </div>
                <span class="badge text-bg-<?php echo $status_color; ?>"><?php echo $status_label; ?></span>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-12 col-md-4">
                        <div class="small text-muted mb-1">Selfie -- asked to do:
                            <strong><?php echo htmlspecialchars($pose_labels[$request['pose']] ?? $request['pose']); ?></strong>
                        </div>
                        <img src="<?php echo htmlspecialchars($img_base . $request['selfie_path']); ?>"
                            class="img-fluid rounded border" style="max-height: 360px; object-fit: cover;" alt="Selfie">
                    </div>
                    <div class="col-12 col-md-8">
                        <div class="small text-muted mb-1">Profile photos</div>
                        <div class="d-flex flex-wrap gap-2">
                            <?php foreach ($photos as $photo): ?>
                                <?php if (!empty($photo['p'])): ?>
                                    <img src="<?php echo htmlspecialchars($img_base . $photo['p']); ?>"
                                        class="rounded border" style="width: 130px; height: 170px; object-fit: cover;" alt="Profile photo">
                                <?php endif; ?>
                            <?php endforeach; ?>
                        </div>
                        <?php if ((int) $request['status'] === 2 && !empty($request['reject_reason'])): ?>
                            <div class="alert alert-light border mt-3 mb-0 small">
                                Rejected: <?php echo htmlspecialchars($request['reject_reason']); ?>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            <?php if ((int) $request['status'] === 0): ?>
                <div class="card-footer">
                    <form method="post" class="row g-2 align-items-center">
                        <input type="hidden" name="verification_id" value="<?php echo htmlspecialchars($request['id']); ?>">
                        <div class="col-12 col-md-auto">
                            <button class="btn btn-success" name="action" value="approve" type="submit"
                                onclick="return confirm('Approve and give this profile the verified badge?');">
                                Approve
                            </button>
                        </div>
                        <div class="col-12 col-md">
                            <select class="form-select" name="reason">
                                <option value="">Reject with reason…</option>
                                <?php foreach ($reject_reasons as $reason_option): ?>
                                    <option value="<?php echo htmlspecialchars($reason_option); ?>">
                                        <?php echo htmlspecialchars($reason_option); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-12 col-md-auto">
                            <button class="btn btn-outline-danger" name="action" value="reject" type="submit">
                                Reject
                            </button>
                        </div>
                    </form>
                </div>
            <?php endif; ?>
        </div>
    <?php endforeach; ?>

    <?php include "../global/footer.php"; ?>
</body>

</html>
