<?php
declare(strict_types=1);
include "../main_config.php";
include "../global/funcs.php";

$page_title = 'User Details';
$active_page = 'users';

$db = $DB_STMT;

$user_id = $_GET['id'] ?? '';
if (!$user_id) {
    header('Location: users.php');
    exit;
}

function get_user_data(PDO $db, string $user_id): ?array
{
    $stmt = $db->prepare('SELECT * FROM users WHERE user_id = ?');
    $stmt->execute([$user_id]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function get_user_match_stats(PDO $db, string $user_id): array
{
    $stmt = $db->prepare('
        SELECT
            COUNT(*) AS total_matches,
            SUM(CASE WHEN m.match_user_id_from = ? THEN 1 ELSE 0 END) AS count_likes_sent,
            SUM(CASE WHEN m.match_user_id_to = ? THEN 1 ELSE 0 END) AS count_likes_received,
            SUM(CASE WHEN m.match_status = "0" THEN 1 ELSE 0 END) AS count_waiting,
            SUM(CASE WHEN m.match_status = "1" THEN 1 ELSE 0 END) AS count_matched,
            SUM(CASE WHEN m.match_status = "2" THEN 1 ELSE 0 END) AS count_not_interested,
            SUM(CASE WHEN m.match_status = "3" THEN 1 ELSE 0 END) AS count_blocked,
            SUM(CASE WHEN m.match_status = "4" THEN 1 ELSE 0 END) AS count_reported,
            SUM(CASE WHEN m.match_status = "5" THEN 1 ELSE 0 END) AS count_superliked,
            SUM(CASE WHEN m.match_user_id_from = ? AND m.match_status = "5" THEN 1 ELSE 0 END) AS count_superlikes_sent,
            SUM(CASE WHEN m.match_user_id_to = ? AND m.match_status = "5" THEN 1 ELSE 0 END) AS count_superlikes_received
        FROM matches m
        WHERE m.match_user_id_from = ? OR m.match_user_id_to = ?
    ');
    $stmt->execute([$user_id, $user_id, $user_id, $user_id, $user_id, $user_id]);
    $stats = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return array_map('intval', array_merge([
        'total_matches' => 0,
        'count_likes_sent' => 0,
        'count_likes_received' => 0,
        'count_waiting' => 0,
        'count_matched' => 0,
        'count_not_interested' => 0,
        'count_blocked' => 0,
        'count_reported' => 0,
        'count_superliked' => 0,
        'count_superlikes_sent' => 0,
        'count_superlikes_received' => 0,
    ], $stats));
}

function get_user_active_subscription(PDO $db, string $user_id): ?array
{
    $stmt = $db->prepare('
        SELECT s.id,
               s.user_id,
               s.variant_id_ref,
               s.end_date,
               s.external_id,
               s.payment_id_ref,
               s.status,
               s.date_created,
               s.date_modified,
               pv.name AS plan_variant,
               pv.price AS plan_price,
               pv.billing_cycle,
               pl.pl_name AS plan_name,
               pl.category AS plan_category,
               p.status AS payment_status,
               p.p_amount AS payment_amount,
               p.p_currency AS payment_currency
        FROM subscriptions s
        LEFT JOIN product_list_variant pv ON s.variant_id_ref = pv.id_ai
        LEFT JOIN product_lists pl ON pv.product_lists_id_ref = pl.pl_sku
        LEFT JOIN payments p ON s.payment_id_ref = p.payment_id
        WHERE s.user_id = ?
          AND s.status = 1
          AND s.end_date > NOW()
        ORDER BY s.end_date DESC, s.date_created DESC
        LIMIT 1
    ');
    $stmt->execute([$user_id]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function get_user_prompts(PDO $db, string $user_id): array
{
    try {
        $stmt = $db->prepare('
            SELECT pv.question, up.answer, up.date_created
            FROM users_prompt up
            INNER JOIN gn_prompts_variant pv ON up.prompts_variant_ref_id = pv.id_ai
            WHERE up.user_id = ?
            ORDER BY up.date_created ASC
        ');
        $stmt->execute([$user_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    } catch (Throwable $e) {
        return [];
    }
}

function get_user_interests(PDO $db, string $user_id): array
{
    try {
        $stmt = $db->prepare('
            SELECT iv.category, iv.interested_in
            FROM users_interests ui
            INNER JOIN gn_interests_variant iv ON ui.interests_variant_ref_id = iv.id_ai
            WHERE ui.user_id = ?
            ORDER BY iv.category ASC, iv.interested_in ASC
        ');
        $stmt->execute([$user_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    } catch (Throwable $e) {
        return [];
    }
    $grouped = [];
    foreach ($rows as $r) {
        $grouped[$r['category']][] = $r['interested_in'];
    }
    return $grouped;
}

/** Which users.* columns are numeric codes, and the lookup type to resolve them with. */
const USER_CODE_FIELDS = [
    'user_active' => 'account_status',
    'user_verified' => 'account_verified',
    'user_bio_gender' => 'bio_gender',
    'user_bio_ethnicity' => 'bio_ethnicity',
    'user_bio_highesteducation' => 'bio_education',
    'user_bio_relationshipgoal' => 'bio_intent',
    'user_bio_politicalview' => 'bio_politicalview',
    'user_bio_religion' => 'bio_religion',
    'user_bio_smoking' => 'bio_smoking',
    'user_bio_drinking' => 'bio_drinking',
    'user_bio_children' => 'bio_children',
    'user_bio_haspet' => 'bio_pets',
    'user_preference_gender' => 'bio_gender',
    'user_preference_ethnicity' => 'bio_ethnicity',
    'user_preference_highesteducation' => 'bio_education',
    'user_preference_relationshipgoal' => 'bio_intent',
    'user_preference_politicalview' => 'bio_politicalview',
    'user_preference_religion' => 'bio_religion',
    'user_preference_smoking' => 'bio_smoking',
    'user_preference_drinking' => 'bio_drinking',
    'user_preference_children' => 'bio_pets',
    'user_preference_pet' => 'bio_pets',
];

function coded_label(PDO $db, string $field, $value): ?string
{
    if (!isset(USER_CODE_FIELDS[$field]) || $value === null || $value === '') {
        return null;
    }
    $label = get_lookup_label($db, USER_CODE_FIELDS[$field], (int) $value);
    return in_array($label, ['Unknown', 'Any', 'Not set'], true) ? null : $label;
}

$user = get_user_data($db, $user_id);
if (!$user) {
    die('User not found');
}

$match_stats = get_user_match_stats($db, $user_id);
$active_subscription = get_user_active_subscription($db, $user_id);
$is_subscribed = $active_subscription !== null;
$prompts = get_user_prompts($db, $user_id);
$interests = get_user_interests($db, $user_id);

// Age from DOB (YYYYMMDD)
$age = null;
if (!empty($user['user_bio_dob']) && strlen((string) $user['user_bio_dob']) === 8) {
    $dob = substr($user['user_bio_dob'], 0, 4) . '-' . substr($user['user_bio_dob'], 4, 2) . '-' . substr($user['user_bio_dob'], 6, 2);
    try {
        $age = (new DateTime())->diff(new DateTime($dob))->y;
    } catch (Throwable $e) {
        $age = null;
    }
}

$location = !empty($user['geo_meta']) ? json_decode((string) $user['geo_meta'], true) : [];
$settings = !empty($user['user_settings']) ? json_decode((string) $user['user_settings'], true) : [];
$phone_meta = !empty($user['user_phonenumber_meta']) ? json_decode((string) $user['user_phonenumber_meta'], true) : [];
$device_stats = !empty($user['user_signedup_device_stats']) ? json_decode((string) $user['user_signedup_device_stats'], true) : null;
$social_links = !empty($user['user_bio_social_links']) ? json_decode((string) $user['user_bio_social_links'], true) : [];
$images = !empty($user['user_image']) ? json_decode((string) $user['user_image'], true) : [];

$img_base = img_domain_base_url();

$account_status_labels = [
    '0' => ['Snoozed', 'secondary'],
    '1' => ['Active', 'success'],
    '2' => ['Locked', 'warning'],
    '3' => ['Banned', 'danger'],
    '-99' => ['Deleted', 'dark'],
    '99' => ['Deleted', 'dark'],
];
[$status_text, $status_color] = $account_status_labels[(string) ($user['user_active'] ?? '')] ?? ['Unknown', 'secondary'];

function fmt_ts(?string $ts): string
{
    if (!$ts || $ts === '0000-00-00 00:00:00') {
        return '—';
    }
    $t = strtotime($ts);
    return $t ? date('M j, Y H:i', $t) : htmlspecialchars($ts);
}
?>
<html>

<head>
    <?php include "../global/head.php"; ?>
    <style>
        .profile-image { width: 120px; height: 120px; object-fit: cover; border-radius: 10px; }
        .info-grid dt { font-weight: 600; color: #6b7280; font-size: .85rem; }
        .info-grid dd { margin-bottom: .9rem; word-break: break-word; }
        .allfields td { vertical-align: top; }
        .allfields td.k { white-space: nowrap; font-family: ui-monospace, monospace; font-size: .82rem; color: #374151; width: 240px; }
        .allfields pre { white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow: auto; background: #f8f9fa; padding: .6rem; border-radius: 6px; }
        .copy-btn { --bs-btn-padding-y: .1rem; --bs-btn-padding-x: .4rem; --bs-btn-font-size: .7rem; }
    </style>
</head>

<body>
    <?php include "../global/header.php"; ?>

    <div class="container-fluid py-4">
        <nav aria-label="breadcrumb" class="mb-3">
            <ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="users.php">Users</a></li>
                <li class="breadcrumb-item active"><?php echo htmlspecialchars((string) $user['user_fullname']); ?></li>
            </ol>
        </nav>

        <div class="row">
            <!-- ── Left column ─────────────────────────────────────────────── -->
            <div class="col-lg-4 mb-4">
                <div class="card shadow-sm">
                    <div class="card-body text-center">
                        <?php if (!empty($images) && isset($images[0]['p'])): ?>
                            <img src="<?php echo htmlspecialchars($img_base . $images[0]['p']); ?>" class="profile-image mb-3" alt="Profile image">
                        <?php else: ?>
                            <div class="profile-image mb-3 bg-light d-inline-flex align-items-center justify-content-center">
                                <span class="text-muted small">No image</span>
                            </div>
                        <?php endif; ?>

                        <h4 class="mb-1"><?php echo htmlspecialchars((string) $user['user_fullname']); ?></h4>
                        <div class="text-muted small mb-3">ID: <code><?php echo htmlspecialchars((string) $user['user_id']); ?></code></div>

                        <div class="d-flex flex-wrap justify-content-center gap-2 mb-2">
                            <span class="badge text-bg-<?php echo $status_color; ?>"><?php echo $status_text; ?></span>
                            <span class="badge text-bg-<?php echo ($user['user_verified'] ?? '') === '1' ? 'success' : 'secondary'; ?>">
                                <?php echo ($user['user_verified'] ?? '') === '1' ? 'Verified' : 'Unverified'; ?>
                            </span>
                            <span class="badge text-bg-<?php echo $is_subscribed ? 'primary' : 'secondary'; ?>">
                                <?php echo $is_subscribed ? 'Subscribed' : 'Free'; ?>
                            </span>
                            <?php if ($age): ?><span class="badge text-bg-info">Age <?php echo $age; ?></span><?php endif; ?>
                        </div>
                    </div>
                </div>

                <!-- Account & Contact -->
                <div class="card shadow-sm mt-3">
                    <div class="card-header py-2"><strong class="small">Account &amp; Contact</strong></div>
                    <div class="card-body">
                        <dl class="info-grid mb-0">
                            <dt>Email</dt>
                            <dd><?php echo htmlspecialchars((string) ($user['user_email'] ?? '')) ?: '—'; ?></dd>

                            <dt>Phone number</dt>
                            <dd><?php echo htmlspecialchars((string) ($user['user_phonenumber'] ?? '')) ?: '—'; ?></dd>

                            <?php if ($phone_meta): ?>
                                <dt>Phone meta</dt>
                                <dd><?php echo format_scalar_or_json($phone_meta); ?></dd>
                            <?php endif; ?>

                            <dt>Status</dt>
                            <dd><?php echo htmlspecialchars((string) ($user['user_active'] ?? '')); ?>
                                <span class="text-muted">(<?php echo $status_text; ?>)</span></dd>

                            <dt>Verified</dt>
                            <dd><?php echo get_lookup_label($db, 'account_verified', isset($user['user_verified']) ? (int) $user['user_verified'] : null); ?></dd>

                            <dt>Member since</dt>
                            <dd><?php echo fmt_ts($user['user_datecreated'] ?? null); ?></dd>

                            <dt>Last accessed</dt>
                            <dd><?php echo fmt_ts($user['user_last_accessed'] ?? null); ?></dd>

                            <dt>Geo hash</dt>
                            <dd><code><?php echo htmlspecialchars((string) ($user['geo_hash'] ?? '')) ?: '—'; ?></code></dd>

                            <dt>Coordinates</dt>
                            <dd><?php echo htmlspecialchars(trim(($user['geo_latd'] ?? '') . ', ' . ($user['geo_long'] ?? ''), ', ')) ?: '—'; ?></dd>

                            <dt>Signup device</dt>
                            <dd><?php echo $device_stats ? format_scalar_or_json($device_stats) : '<span class="text-muted">—</span>'; ?></dd>
                        </dl>
                    </div>
                </div>

                <!-- Quick Stats -->
                <div class="card shadow-sm mt-3">
                    <div class="card-body">
                        <h6 class="card-title mb-3">Quick Stats</h6>
                        <div class="row text-center g-2">
                            <div class="col-4"><div class="h5 mb-0"><?php echo number_format($match_stats['count_matched']); ?></div><div class="small text-muted">Matches</div></div>
                            <div class="col-4"><div class="h5 mb-0"><?php echo number_format($match_stats['count_likes_received']); ?></div><div class="small text-muted">Likes in</div></div>
                            <div class="col-4"><div class="h5 mb-0"><?php echo number_format($match_stats['count_reported']); ?></div><div class="small text-muted">Reported</div></div>
                            <div class="col-12 mt-2"><div class="h6 mb-0"><?php echo $is_subscribed ? htmlspecialchars((string) ($active_subscription['plan_name'] ?? 'Subscribed')) : 'Free'; ?></div><div class="small text-muted">Subscription</div></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Right column ────────────────────────────────────────────── -->
            <div class="col-lg-8">
                <ul class="nav nav-tabs mb-3" id="userTabs" role="tablist">
                    <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#profile" type="button">Profile</button></li>
                    <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#preferences" type="button">Preferences</button></li>
                    <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#matches" type="button">Matches (<?php echo number_format($match_stats['total_matches']); ?>)</button></li>
                    <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#photos" type="button">Photos (<?php echo count($images); ?>)</button></li>
                    <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#allfields" type="button">All Fields</button></li>
                </ul>

                <div class="tab-content" id="userTabsContent">
                    <!-- Profile -->
                    <div class="tab-pane fade show active" id="profile">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="card-title mb-3">Bio Information</h6>
                                <div class="row info-grid">
                                    <div class="col-md-6">
                                        <dl>
                                            <dt>About</dt>
                                            <dd><?php echo nl2br(htmlspecialchars((string) ($user['user_bio_about'] ?? ''))) ?: 'Not set'; ?></dd>

                                            <dt>Gender</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_gender', isset($user['user_bio_gender']) ? (int) $user['user_bio_gender'] : null); ?></dd>

                                            <dt>Date of birth</dt>
                                            <dd><?php echo htmlspecialchars((string) ($user['user_bio_dob'] ?? '')) ?: 'Not set'; ?><?php echo $age ? " (age {$age})" : ''; ?></dd>

                                            <dt>Height</dt>
                                            <dd><?php echo $user['user_bio_height'] ? ((int) $user['user_bio_height']) . ' cm' : 'Not set'; ?></dd>

                                            <dt>Ethnicity</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_ethnicity', isset($user['user_bio_ethnicity']) ? (int) $user['user_bio_ethnicity'] : null); ?></dd>

                                            <dt>Hometown</dt>
                                            <dd><?php echo htmlspecialchars((string) ($user['user_bio_hometown'] ?? '')) ?: 'Not set'; ?></dd>

                                            <dt>School attended</dt>
                                            <dd><?php echo htmlspecialchars((string) ($user['user_bio_schoolattended'] ?? '')) ?: 'Not set'; ?></dd>

                                            <dt>Company / Job role</dt>
                                            <dd><?php echo htmlspecialchars(trim((string) ($user['user_bio_company'] ?? '') . ' / ' . (string) ($user['user_bio_jobrole'] ?? ''), ' /')) ?: 'Not set'; ?></dd>
                                        </dl>
                                    </div>
                                    <div class="col-md-6">
                                        <dl>
                                            <dt>Relationship goal</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_intent', isset($user['user_bio_relationshipgoal']) ? (int) $user['user_bio_relationshipgoal'] : null); ?></dd>

                                            <dt>Education</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_education', isset($user['user_bio_highesteducation']) ? (int) $user['user_bio_highesteducation'] : null); ?></dd>

                                            <dt>Religion</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_religion', isset($user['user_bio_religion']) ? (int) $user['user_bio_religion'] : null); ?></dd>

                                            <dt>Political view</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_politicalview', isset($user['user_bio_politicalview']) ? (int) $user['user_bio_politicalview'] : null); ?></dd>

                                            <dt>Smoking / Drinking</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_smoking', isset($user['user_bio_smoking']) ? (int) $user['user_bio_smoking'] : null); ?>
                                                / <?php echo get_lookup_label($db, 'bio_drinking', isset($user['user_bio_drinking']) ? (int) $user['user_bio_drinking'] : null); ?></dd>

                                            <dt>Children / Pets</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_children', isset($user['user_bio_children']) ? (int) $user['user_bio_children'] : null); ?>
                                                / <?php echo get_lookup_label($db, 'bio_pets', isset($user['user_bio_haspet']) ? (int) $user['user_bio_haspet'] : null); ?></dd>

                                            <dt>Languages (raw)</dt>
                                            <dd><?php echo format_scalar_or_json($user['user_bio_language'] ?? null); ?></dd>

                                            <dt>Social links</dt>
                                            <dd><?php echo $social_links ? format_scalar_or_json($social_links) : '<span class="text-muted">—</span>'; ?></dd>
                                        </dl>
                                    </div>
                                </div>

                                <?php if ($prompts): ?>
                                    <h6 class="mt-3 mb-2">Profile Prompts</h6>
                                    <?php foreach ($prompts as $p): ?>
                                        <div class="mb-2">
                                            <strong><?php echo htmlspecialchars((string) ($p['question'] ?? '')); ?></strong>
                                            <div><?php echo htmlspecialchars((string) ($p['answer'] ?? '')); ?></div>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>

                                <?php if ($interests): ?>
                                    <h6 class="mt-3 mb-2">Interests</h6>
                                    <?php foreach ($interests as $cat => $items): ?>
                                        <div class="mb-2">
                                            <span class="text-muted small"><?php echo htmlspecialchars((string) $cat); ?>:</span>
                                            <?php foreach ($items as $it): ?>
                                                <span class="badge text-bg-light border"><?php echo htmlspecialchars((string) $it); ?></span>
                                            <?php endforeach; ?>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        </div>

                        <?php if ($location): ?>
                            <div class="card shadow-sm mt-3">
                                <div class="card-body">
                                    <h6 class="card-title mb-3">Location</h6>
                                    <div class="row info-grid">
                                        <div class="col-md-6">
                                            <dl>
                                                <dt>Address</dt>
                                                <dd><?php echo htmlspecialchars((string) ($location['display_name'] ?? 'Unknown')); ?></dd>
                                                <dt>City</dt>
                                                <dd><?php echo htmlspecialchars((string) ($location['city'] ?? 'Unknown')); ?></dd>
                                                <dt>State / Country</dt>
                                                <dd><?php echo htmlspecialchars(trim(($location['state'] ?? '') . ', ' . ($location['country'] ?? ''), ', ')); ?></dd>
                                            </dl>
                                        </div>
                                        <div class="col-md-6">
                                            <dl>
                                                <dt>Coordinates</dt>
                                                <dd><?php echo htmlspecialchars(($location['latd'] ?? '') . ', ' . ($location['long'] ?? '')); ?></dd>
                                                <dt>Accuracy</dt>
                                                <dd><?php echo htmlspecialchars((string) ($location['accuracy'] ?? '')); ?> m</dd>
                                                <dt>Reported at</dt>
                                                <dd><?php echo isset($location['timestamp']) ? date('Y-m-d H:i:s', (int) floor(((int) $location['timestamp']) / 1000)) : 'Unknown'; ?></dd>
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>

                    <!-- Preferences -->
                    <div class="tab-pane fade" id="preferences">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="card-title mb-3">Match Preferences</h6>
                                <div class="row info-grid">
                                    <div class="col-md-6">
                                        <dl>
                                            <dt>Age range</dt>
                                            <dd><?php echo ($user['user_preference_minimum_age'] ?? '?') . ' – ' . ($user['user_preference_maximum_age'] ?? '?'); ?></dd>
                                            <dt>Height range</dt>
                                            <dd><?php echo ($user['user_preference_height_minimum'] ?? '?') . ' – ' . ($user['user_preference_height_maximum'] ?? '?'); ?> cm</dd>
                                            <dt>Distance</dt>
                                            <dd><?php echo htmlspecialchars((string) ($user['user_preference_distance'] ?? '?')); ?> km</dd>
                                            <dt>Gender</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_gender', isset($user['user_preference_gender']) ? (int) $user['user_preference_gender'] : null); ?></dd>
                                            <dt>Relationship goal</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_intent', isset($user['user_preference_relationshipgoal']) ? (int) $user['user_preference_relationshipgoal'] : null); ?></dd>
                                            <dt>Ethnicity</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_ethnicity', isset($user['user_preference_ethnicity']) ? (int) $user['user_preference_ethnicity'] : null); ?></dd>
                                        </dl>
                                    </div>
                                    <div class="col-md-6">
                                        <dl>
                                            <dt>Education</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_education', isset($user['user_preference_highesteducation']) ? (int) $user['user_preference_highesteducation'] : null); ?></dd>
                                            <dt>Religion</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_religion', isset($user['user_preference_religion']) ? (int) $user['user_preference_religion'] : null); ?></dd>
                                            <dt>Political view</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_politicalview', isset($user['user_preference_politicalview']) ? (int) $user['user_preference_politicalview'] : null); ?></dd>
                                            <dt>Smoking / Drinking</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_smoking', isset($user['user_preference_smoking']) ? (int) $user['user_preference_smoking'] : null); ?>
                                                / <?php echo get_lookup_label($db, 'bio_drinking', isset($user['user_preference_drinking']) ? (int) $user['user_preference_drinking'] : null); ?></dd>
                                            <dt>Children / Pets</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_children', isset($user['user_preference_children']) ? (int) $user['user_preference_children'] : null); ?>
                                                / <?php echo get_lookup_label($db, 'bio_pets', isset($user['user_preference_pet']) ? (int) $user['user_preference_pet'] : null); ?></dd>
                                            <dt>Languages (raw)</dt>
                                            <dd><?php echo format_scalar_or_json($user['user_preference_language'] ?? null); ?></dd>
                                        </dl>
                                    </div>
                                </div>

                                <h6 class="mt-3 mb-2">Privacy</h6>
                                <div class="d-flex flex-wrap gap-2">
                                    <?php foreach ([
                                        'Show distance' => 'user_privacy_show_distance',
                                        'Show age' => 'user_privacy_show_age',
                                        'Incognito' => 'user_privacy_incognito',
                                        'Read receipts' => 'user_privacy_read_receipts',
                                    ] as $lbl => $col): ?>
                                        <span class="badge text-bg-<?php echo ($user[$col] ?? '') === '1' ? 'success' : 'secondary'; ?>">
                                            <?php echo $lbl; ?>: <?php echo ($user[$col] ?? '0') === '1' ? 'on' : 'off'; ?>
                                        </span>
                                    <?php endforeach; ?>
                                </div>

                                <?php if ($settings): ?>
                                    <h6 class="mt-3 mb-2">Settings JSON</h6>
                                    <pre class="bg-light p-3 small rounded"><?php echo htmlspecialchars(json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?></pre>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <!-- Matches -->
                    <div class="tab-pane fade" id="matches">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="card-title mb-3">Match Activity</h6>
                                <div class="row g-3 text-center">
                                    <?php foreach ([
                                        'Total activity' => 'total_matches',
                                        'Likes sent' => 'count_likes_sent',
                                        'Likes received' => 'count_likes_received',
                                        'Matched' => 'count_matched',
                                        'Waiting' => 'count_waiting',
                                        'Not interested' => 'count_not_interested',
                                        'Superliked total' => 'count_superliked',
                                        'Superlikes sent' => 'count_superlikes_sent',
                                        'Superlikes received' => 'count_superlikes_received',
                                        'Blocked' => 'count_blocked',
                                        'Reported' => 'count_reported',
                                    ] as $lbl => $key): ?>
                                        <div class="col-6 col-md-4">
                                            <div class="border rounded p-3">
                                                <div class="h4 mb-1"><?php echo number_format($match_stats[$key]); ?></div>
                                                <div class="small text-muted"><?php echo $lbl; ?></div>
                                            </div>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Photos -->
                    <div class="tab-pane fade" id="photos">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <?php if ($images): ?>
                                    <div class="row row-cols-1 row-cols-md-3 g-4">
                                        <?php foreach ($images as $index => $image): ?>
                                            <div class="col">
                                                <div class="card h-100">
                                                    <img src="<?php echo htmlspecialchars($img_base . ($image['p'] ?? '')); ?>"
                                                        class="card-img-top" style="height: 200px; object-fit: cover;" alt="Photo <?php echo $index + 1; ?>">
                                                    <div class="card-body text-center">
                                                        <small class="text-muted"><?php echo htmlspecialchars(($image['w'] ?? '?') . '×' . ($image['h'] ?? '?')); ?> px</small>
                                                        <div class="text-muted text-break" style="font-size:.7rem;"><?php echo htmlspecialchars((string) ($image['p'] ?? '')); ?></div>
                                                    </div>
                                                </div>
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                <?php else: ?>
                                    <div class="text-center text-muted py-4">No photos uploaded by this user.</div>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <!-- All Fields -->
                    <div class="tab-pane fade" id="allfields">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h6 class="card-title mb-0">Every <code>users</code> column</h6>
                                    <button class="btn btn-outline-secondary btn-sm" id="copyJsonBtn">Copy row as JSON</button>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-sm table-striped allfields mb-0">
                                        <tbody>
                                            <?php foreach ($user as $col => $val): ?>
                                                <?php $lbl = coded_label($db, (string) $col, $val); ?>
                                                <tr>
                                                    <td class="k"><?php echo htmlspecialchars((string) $col); ?></td>
                                                    <td>
                                                        <?php echo format_scalar_or_json($val); ?>
                                                        <?php if ($lbl !== null): ?>
                                                            <span class="badge text-bg-light border ms-1"><?php echo htmlspecialchars($lbl); ?></span>
                                                        <?php endif; ?>
                                                    </td>
                                                </tr>
                                            <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        $(function () {
            document.querySelectorAll('#userTabs button').forEach(function (el) {
                var t = new bootstrap.Tab(el);
                el.addEventListener('click', function (e) { e.preventDefault(); t.show(); });
            });
            var raw = <?php echo json_encode($user, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;
            var btn = document.getElementById('copyJsonBtn');
            if (btn) btn.addEventListener('click', function () {
                navigator.clipboard.writeText(JSON.stringify(raw, null, 2)).then(function () {
                    btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy row as JSON'; }, 1500);
                });
            });
        });
    </script>

    <?php include "../global/footer.php"; ?>
</body>

</html>
