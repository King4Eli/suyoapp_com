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

function format_json_field(?string $json): string
{
    if (!$json)
        return '';

    $decoded = json_decode($json, true);
    if (json_last_error() === JSON_ERROR_NONE && $decoded) {
        return is_array($decoded) ? implode(', ', array_map('htmlspecialchars', $decoded)) : htmlspecialchars((string) $decoded);
    }
    return htmlspecialchars($json);
}

$user = get_user_data($db, $user_id);
if (!$user) {
    die('User not found');
}

$match_stats = get_user_match_stats($db, $user_id);
$active_subscription = get_user_active_subscription($db, $user_id);
$is_subscribed = $active_subscription !== null;

// Calculate age from DOB
$age = null;
if (!empty($user['user_bio_dob']) && strlen($user['user_bio_dob']) === 8) {
    $year = substr($user['user_bio_dob'], 0, 4);
    $month = substr($user['user_bio_dob'], 4, 2);
    $day = substr($user['user_bio_dob'], 6, 2);
    $dob = "$year-$month-$day";
    $birth_date = new DateTime($dob);
    $today = new DateTime();
    $age = $today->diff($birth_date)->y;
}

// Parse JSON fields
$location = $user['geo_meta'] ? json_decode($user['geo_meta'], true) : [];
$prompts = $user['user_bio_prompt'] ? json_decode($user['user_bio_prompt'], true) : [];
$settings = $user['user_settings'] ? json_decode($user['user_settings'], true) : [];
$images = $user['user_image'] ? json_decode($user['user_image'], true) : [];
?>
<html>

<head>
    <?php include "../global/head.php"; ?>
    <style>
        .profile-image {
            width: 100px;
            height: 100px;
            object-fit: cover;
            border-radius: 8px;
        }

        .badge-sm {
            font-size: 0.75em;
            padding: 0.25em 0.5em;
        }

        .info-grid dt {
            font-weight: 600;
            color: #666;
        }

        .info-grid dd {
            margin-bottom: 1rem;
        }
    </style>
</head>

<body>
    <?php include "../global/header.php"; ?>

    <div class="container-fluid py-4">
        <nav aria-label="breadcrumb" class="mb-4">
            <ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="users.php">Users</a></li>
                <li class="breadcrumb-item active"><?php echo htmlspecialchars($user['user_fullname']); ?></li>
            </ol>
        </nav>

        <div class="row">
            <!-- User Profile Card -->
            <div class="col-lg-4 mb-4">
                <div class="card shadow-sm">
                    <div class="card-body text-center">
                        <?php if (!empty($images) && isset($images[0]['p'])): ?>
                            <img src="<?php echo get_lookup_label($db, "img_domain", 0) . htmlspecialchars($images[0]['p']); ?>"
                                class="profile-image mb-3" alt="Profile image">
                        <?php else: ?>
                            <div class="profile-image mb-3 bg-light d-flex align-items-center justify-content-center">
                                <span class="text-muted">No image</span>
                            </div>
                        <?php endif; ?>

                        <h4 class="mb-1"><?php echo htmlspecialchars($user['user_fullname']); ?></h4>
                        <div class="text-muted mb-3">ID: <?php echo htmlspecialchars($user['user_id']); ?></div>

                        <div class="d-flex flex-wrap justify-content-center gap-2 mb-3">
                            <span
                                class="badge text-bg-<?php echo $user['user_active'] === '1' ? 'success' : 'secondary'; ?>">
                                <?php echo $user['user_active'] === '1' ? 'Active' : 'Inactive'; ?>
                            </span>
                            <span
                                class="badge text-bg-<?php echo $user['user_verified'] === '1' ? 'success' : 'secondary'; ?>">
                                <?php echo $user['user_verified'] === '1' ? 'Verified' : 'Unverified'; ?>
                            </span>
                            <span class="badge text-bg-<?php echo $is_subscribed ? 'primary' : 'secondary'; ?>">
                                <?php echo $is_subscribed ? 'Subscribed' : 'Not subscribed'; ?>
                            </span>
                            <?php if ($age): ?>
                                <span class="badge text-bg-info">Age: <?php echo $age; ?></span>
                            <?php endif; ?>
                        </div>

                        <div class="small text-muted mb-3">
                            Member since: <?php echo date('M j, Y', strtotime($user['user_datecreated'])); ?>
                        </div>

                        <div class="d-grid gap-2">
                            <button class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#editModal">
                                Edit Profile
                            </button>
                            <button class="btn btn-outline-danger" data-bs-toggle="modal" data-bs-target="#banModal">
                                Manage Status
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Quick Stats -->
                <div class="card shadow-sm mt-4">
                    <div class="card-body">
                        <h6 class="card-title mb-3">Quick Stats</h6>
                        <div class="row text-center">
                            <div class="col-6">
                                <div class="h5 mb-1"><?php echo number_format($match_stats['count_matched']); ?></div>
                                <div class="small text-muted">Matches</div>
                            </div>   
                            <div class="col-6 ">
                                <div class="h6 mb-1"><?php echo number_format($match_stats['count_reported']); ?></div>
                                <div class="small text-muted">Reported</div>
                            </div>
                            <div class="col-12 mt-3">
                                <div class="h6 mb-1">
                                    <?php echo $is_subscribed ? htmlspecialchars($active_subscription['plan_name'] ?? 'Subscribed') : 'Free'; ?>
                                </div>
                                <div class="small text-muted">Subscription</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="col-lg-8">
                <!-- Tabs -->
                <ul class="nav nav-tabs mb-4" id="userTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="profile-tab" data-bs-toggle="tab" data-bs-target="#profile"
                            type="button">
                            Profile
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="matches-tab" data-bs-toggle="tab" data-bs-target="#matches"
                            type="button">
                            Matches (<?php echo number_format($match_stats['total_matches']); ?>)
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="photos-tab" data-bs-toggle="tab" data-bs-target="#photos"
                            type="button">
                            Photos (<?php echo count($images); ?>)
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="settings-tab" data-bs-toggle="tab" data-bs-target="#settings"
                            type="button">
                            Settings
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="othertools-tab" data-bs-toggle="tab" data-bs-target="#othertools"
                            type="button">
                            othertools
                        </button>
                    </li>
                </ul>

                <div class="tab-content" id="userTabsContent">
                    <!-- Profile Tab -->
                    <div class="tab-pane fade show active" id="profile">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="card-title mb-4">Bio Information</h6>

                                <div class="row info-grid">
                                    <div class="col-md-6">
                                        <dl>
                                            <dt>About</dt>
                                            <dd><?php echo htmlspecialchars($user['user_bio_about'] ?? 'Not set'); ?>
                                            </dd>

                                            <dt>Gender</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_gender', $user['user_bio_gender'] ?? null); ?>
                                            </dd>

                                            <dt>Height</dt>
                                            <dd><?php echo $user['user_bio_height'] ? $user['user_bio_height'] . ' cm' : 'Not set'; ?>
                                            </dd>

                                            <dt>Ethnicity</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_ethnicity', $user['user_bio_ethnicity'] ?? null); ?>
                                            </dd>
                                        </dl>
                                    </div>
                                    <div class="col-md-6">
                                        <dl>
                                            <dt>Relationship Goal</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_intent', $user['user_bio_relationshipgoal'] ?? null); ?>
                                            </dd>

                                            <dt>Education</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_education', $user['user_bio_highesteducation'] ?? null); ?>
                                            </dd>

                                            <dt>Religion</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_religion', $user['user_bio_religion'] ?? null); ?>
                                            </dd>

                                            <dt>Political View</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_politicalview', $user['user_bio_politicalview'] ?? null); ?>
                                            </dd>

                                            <dt>Smoking/Drinking</dt>
                                            <dd>
                                                <?php echo get_lookup_label($db, 'bio_smoking', (int) $user['user_bio_smoking']); ?>
                                                /
                                                <?php echo get_lookup_label($db, 'bio_drinking', (int) $user['user_bio_drinking']); ?>
                                            </dd>
                                        </dl>
                                    </div>
                                </div>


                                <?php if ($prompts): ?>
                                    <h6 class="mt-4 mb-2">Profile Prompts</h6>
                                    <?php foreach ($prompts as $prompt): ?>
                                        <div class="mb-2">
                                            <strong><?php echo htmlspecialchars($prompt['q'] ?? ''); ?></strong>
                                            <div><?php echo htmlspecialchars($prompt['a'] ?? ''); ?></div>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        </div>

                        <!-- Location Card -->
                        <?php if ($location): ?>
                            <div class="card shadow-sm mt-4">
                                <div class="card-body">
                                    <h6 class="card-title mb-3">Location</h6>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <dl>
                                                <dt>Address</dt>
                                                <dd><?php echo htmlspecialchars($location['display_name'] ?? 'Unknown'); ?>
                                                </dd>

                                                <dt>City</dt>
                                                <dd><?php echo htmlspecialchars($location['city'] ?? 'Unknown'); ?></dd>

                                                <dt>State/Country</dt>
                                                <dd><?php echo htmlspecialchars(($location['state'] ?? '') . ', ' . ($location['country'] ?? '')); ?>
                                                </dd>
                                            </dl>
                                        </div>
                                        <div class="col-md-6">
                                            <dl>
                                                <dt>Coordinates</dt>
                                                <dd><?php echo htmlspecialchars(($location['latd'] ?? '') . ', ' . ($location['long'] ?? '')); ?>
                                                </dd>

                                                <dt>Accuracy</dt>
                                                <dd><?php echo htmlspecialchars((string) ($location['accuracy'] ?? '')); ?>
                                                    meters</dd>

                                                <dt>Last Updated</dt>
                                                <dd>
                                                    <?php echo isset($location['timestamp']) ?
                                                        date('Y-m-d H:i:s', (int) floor($location['timestamp'] / 1000)) :
                                                        'Unknown'; ?>
                                                </dd>
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>

                    <!-- Matches Tab -->
                    <div class="tab-pane fade" id="matches">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="card-title mb-3">Match Activity</h6>
                                <div class="row g-3 text-center">
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['total_matches']); ?></div>
                                            <div class="small text-muted">Total Activity</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_likes_sent']); ?></div>
                                            <div class="small text-muted">Likes Sent</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_likes_received']); ?></div>
                                            <div class="small text-muted">Likes Received</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_matched']); ?></div>
                                            <div class="small text-muted">Matched</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_waiting']); ?></div>
                                            <div class="small text-muted">Waiting</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_not_interested']); ?></div>
                                            <div class="small text-muted">Not Interested</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_superliked']); ?></div>
                                            <div class="small text-muted">Superliked Total</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_superlikes_sent']); ?></div>
                                            <div class="small text-muted">Superlikes Sent</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_superlikes_received']); ?></div>
                                            <div class="small text-muted">Superlikes Received</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_blocked']); ?></div>
                                            <div class="small text-muted">Blocked</div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <div class="border rounded p-3">
                                            <div class="h4 mb-1"><?php echo number_format($match_stats['count_reported']); ?></div>
                                            <div class="small text-muted">Reported</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Photos Tab -->
                    <div class="tab-pane fade" id="photos">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <?php if ($images): ?>
                                    <div class="row row-cols-1 row-cols-md-3 g-4">
                                        <?php foreach ($images as $index => $image): ?>
                                            <div class="col">
                                                <div class="card">
                                                    <img src="<?php echo get_lookup_label($db, "img_domain", 0) . htmlspecialchars($image['p']); ?>"
                                                        class="card-img-top" style="height: 200px; object-fit: cover;"
                                                        alt="Photo <?php echo $index + 1; ?>">
                                                    <div class="card-body text-center">
                                                        <small class="text-muted">
                                                            <?php echo ($image['w'] ?? '?') . '×' . ($image['h'] ?? '?'); ?> px
                                                        </small>
                                                    </div>
                                                </div>
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                <?php else: ?>
                                    <div class="text-center text-muted py-4">
                                        No photos uploaded by this user.
                                    </div>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <!-- Settings Tab -->
                    <div class="tab-pane fade" id="settings">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="card-title mb-3">User Preferences</h6>

                                <div class="row info-grid">
                                    <div class="col-md-6">
                                        <dl>
                                            <dt>Age Range</dt>
                                            <dd><?php echo ($user['user_preference_minimum_age'] ?? 18) . ' - ' . ($user['user_preference_maximum_age'] ?? 25); ?>
                                            </dd>

                                            <dt>Gender Preference</dt>
                                            <dd>
                                                <?php echo $user['user_preference_gender'] == -99 ?
                                                    'Any' :
                                                    get_lookup_label($db, 'bio_gender', $user['user_preference_gender']);
                                                ?>
                                            </dd>

                                            <dt>Distance</dt>
                                            <dd><?php echo ($user['user_preference_distance'] ?? 55); ?> km</dd>

                                            <dt>Height Range</dt>
                                            <dd>
                                                <?php echo ($user['user_preference_height_minimum'] ?? 153) . ' - ' .
                                                    ($user['user_preference_height_maximum'] ?? 180); ?> cm
                                            </dd>
                                        </dl>
                                    </div>
                                    <div class="col-md-6">
                                        <dl>
                                            <dt>Relationship Goal</dt>
                                            <dd>
                                                <?php echo $user['user_preference_relationshipgoal'] == -99 ?
                                                    'Any' :
                                                    get_lookup_label($db, 'bio_intent', $user['user_preference_relationshipgoal']);
                                                ?>
                                            </dd>

                                            <dt>Smoking Preference</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_smoking', (int) ($user['user_preference_smoking'] ?? -99)); ?>
                                            </dd>

                                            <dt>Drinking Preference</dt>
                                            <dd><?php echo get_lookup_label($db, 'bio_drinking', (int) ($user['user_preference_drinking'] ?? -99)); ?>
                                            </dd>

                                            <dt>Children Preference</dt>
                                            <dd>
                                                <?php echo $user['user_preference_children'] == '-99' ?
                                                    'Any' :
                                                    ($user['user_preference_children'] == '1' ? 'Yes' : 'No');
                                                ?>
                                            </dd>
                                        </dl>
                                    </div>
                                </div>

                                <?php if ($settings): ?>
                                    <h6 class="mt-4 mb-2">Notification Settings</h6>
                                    <pre class="bg-light p-3 small rounded"><?php
                                    echo htmlspecialchars(json_encode($settings, JSON_PRETTY_PRINT));
                                    ?></pre>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <!-- other Tools -->
                    <div class="tab-pane fade" id="othertools">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="card-title mb-3">Other Tools</h6>

                                <div class="row info-grid">
                                    <div class="col-md-6">
                                        <dl>
                                            <dt>Subscription</dt>
                                            <dd>
                                                <span class="badge text-bg-<?php echo $is_subscribed ? 'primary' : 'secondary'; ?>">
                                                    <?php echo $is_subscribed ? 'Active' : 'None'; ?>
                                                </span>
                                            </dd>

                                            <?php if ($active_subscription): ?>
                                                <dt>Plan</dt>
                                                <dd>
                                                    <?php echo htmlspecialchars($active_subscription['plan_name'] ?? 'Unknown'); ?>
                                                    <?php if (!empty($active_subscription['plan_variant'])): ?>
                                                        <span class="text-muted">(<?php echo htmlspecialchars($active_subscription['plan_variant']); ?>)</span>
                                                    <?php endif; ?>
                                                </dd>

                                                <dt>Expires</dt>
                                                <dd><?php echo htmlspecialchars($active_subscription['end_date'] ?? ''); ?></dd>
                                            <?php endif; ?>

                                            <dt>Height Range</dt>
                                            <dd>
                                                <?php echo ($user['user_preference_height_minimum'] ?? 153) . ' - ' .
                                                    ($user['user_preference_height_maximum'] ?? 180); ?> cm
                                            </dd>
                                        </dl>
                                    </div>
                                    <div class="col-md-6">
                                        <dl>
                                            <?php if ($active_subscription): ?>
                                                <dt>Subscription ID</dt>
                                                <dd class="text-break"><?php echo htmlspecialchars($active_subscription['id'] ?? ''); ?></dd>

                                                <dt>External ID</dt>
                                                <dd class="text-break"><?php echo htmlspecialchars($active_subscription['external_id'] ?? ''); ?></dd>

                                                <dt>Payment</dt>
                                                <dd>
                                                    <?php echo htmlspecialchars($active_subscription['payment_status'] ?? 'Unknown'); ?>
                                                    <?php if (isset($active_subscription['payment_amount'])): ?>
                                                        <span class="text-muted">
                                                            <?php echo htmlspecialchars((string) $active_subscription['payment_amount']); ?>
                                                            <?php echo htmlspecialchars($active_subscription['payment_currency'] ?? ''); ?>
                                                        </span>
                                                    <?php endif; ?>
                                                </dd>
                                            <?php endif; ?>

                                            <dt>Smoking Preference</dt>
                                            <dd>
                                                <?php echo get_lookup_label($db, 'bio_smoking', (int) ($user['user_preference_smoking'] ?? -99)); ?>
                                            </dd>
                                        </dl>
                                    </div>
                                </div>

                                <?php if ($settings): ?>
                                    <h6 class="mt-4 mb-2">Notification Settings</h6>
                                    <pre class="bg-light p-3 small rounded"><?php
                                    echo htmlspecialchars(json_encode($settings, JSON_PRETTY_PRINT));
                                    ?></pre>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modals will go here -->

    <script>
        $(function () {
            // Initialize tabs
            var triggerTabList = [].slice.call(document.querySelectorAll('#userTabs button'))
            triggerTabList.forEach(function (triggerEl) {
                var tabTrigger = new bootstrap.Tab(triggerEl)
                triggerEl.addEventListener('click', function (event) {
                    event.preventDefault()
                    tabTrigger.show()
                })
            });
        });
    </script>

    <?php include "../global/footer.php"; ?>
</body>

</html>
