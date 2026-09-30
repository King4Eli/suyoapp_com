<?php
declare(strict_types=1);
include "../main_config.php";
include "../global/funcs.php";

$page_title = 'Users';
$page_subtitle = 'Browse user profiles, where they are, and the cities VIPs travel to';
$active_page = 'users';

$db = $DB_STMT;

// Most points the map gets (clustered). The table is paginated separately.
const MAP_POINT_CAP = 5000;

function render_verified(?string $value): array
{
    return $value === '1' ? ['Verified', 'success'] : ['Unverified', 'secondary'];
}

/** Runs a read query; on failure (e.g. users_locations not migrated yet) returns $fallback. */
function query_or(PDO $db, string $sql, array $params, $fallback, string $mode = 'all')
{
    try {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $mode === 'column' ? $stmt->fetchColumn() : $stmt->fetchAll();
    } catch (PDOException $e) {
        return $fallback;
    }
}

// Every location as one row: each user's current location (users.geo_*) plus
// their travel-mode cities (users_locations). geo_meta holds the geocoder's
// city/state/country; missing parts are stored as "unknown".
$locs_sql = "
    SELECT 'current' AS kind, u.user_id, u.user_fullname, u.geo_latd AS latd, u.geo_long AS lng,
           u.geo_meta->>'$.city' AS city, u.geo_meta->>'$.state' AS state,
           u.geo_meta->>'$.country' AS country
    FROM users u
    WHERE NOT (u.geo_latd = 0 AND u.geo_long = 0)
    UNION ALL
    SELECT 'travel', u.user_id, u.user_fullname, l.geo_latd, l.geo_long,
           l.geo_meta->>'$.city', l.geo_meta->>'$.state', l.geo_meta->>'$.country'
    FROM users_locations l
    INNER JOIN users u ON u.user_id = l.user_id
";

// ── Filters ─────────────────────────────────────────────────────────────────
$query = trim((string) ($_GET['q'] ?? ''));
$country = trim((string) ($_GET['country'] ?? ''));
$city = trim((string) ($_GET['city'] ?? ''));
$status = (string) ($_GET['status'] ?? '');
$status = in_array($status, ['0', '1', '2', '3', '-99'], true) ? $status : '';
$travel = (string) ($_GET['travel'] ?? '');
$travel = in_array($travel, ['0', '1'], true) ? $travel : '';
$limit = max(10, min(200, (int) ($_GET['limit'] ?? 50)));
$page = max(1, (int) ($_GET['page'] ?? 1));

// Filters on users. City/country match a user's current location or any of
// their travel locations.
$where = [];
$params = [];
if ($query !== '') {
    $where[] = '(u.user_id LIKE :q1 OR u.user_email LIKE :q2 OR u.user_fullname LIKE :q3 OR u.user_phonenumber LIKE :q4)';
    foreach (['q1', 'q2', 'q3', 'q4'] as $key) {
        $params[":$key"] = '%' . $query . '%';
    }
}
if ($country !== '' || $city !== '') {
    $place_where = [];
    if ($country !== '') {
        $place_where[] = 'locs.country = :country';
        $params[':country'] = $country;
    }
    if ($city !== '') {
        $place_where[] = 'locs.city = :city';
        $params[':city'] = $city;
    }
    $where[] = "u.user_id IN (SELECT locs.user_id FROM ($locs_sql) locs WHERE " . implode(' AND ', $place_where) . ')';
}
if ($status !== '') {
    $where[] = 'u.user_active = :status';
    $params[':status'] = $status;
}
if ($travel !== '') {
    $where[] = 'u.user_travel_mode = :travel';
    $params[':travel'] = $travel;
}
$where_sql = $where ? (' WHERE ' . implode(' AND ', $where)) : '';
$users_from_sql = ' FROM users u' . $where_sql;

// ── Stats (unfiltered) ──────────────────────────────────────────────────────
$stats = [
    'users_located' => (int) query_or($db, 'SELECT COUNT(*) FROM users WHERE NOT (geo_latd = 0 AND geo_long = 0)', [], 0, 'column'),
    'travel_locations' => (int) query_or($db, 'SELECT COUNT(*) FROM users_locations', [], 0, 'column'),
    'travel_mode_on' => (int) query_or($db, "SELECT COUNT(*) FROM users WHERE user_travel_mode = '1'", [], 0, 'column'),
    'countries' => (int) query_or($db, "SELECT COUNT(DISTINCT locs.country) FROM ($locs_sql) locs WHERE locs.country <> 'unknown'", [], 0, 'column'),
];

$countries = array_column(query_or(
    $db,
    "SELECT DISTINCT locs.country FROM ($locs_sql) locs WHERE locs.country IS NOT NULL AND locs.country <> 'unknown' ORDER BY locs.country",
    [],
    []
), 'country');

// Locations of the filtered users, for the top cities and the map
$filtered_locs_sql = "FROM ($locs_sql) locs WHERE locs.user_id IN (SELECT u.user_id $users_from_sql)";

$top_cities = query_or(
    $db,
    "SELECT locs.city, locs.country, COUNT(*) AS n $filtered_locs_sql
       AND locs.city IS NOT NULL AND locs.city <> 'unknown'
     GROUP BY locs.city, locs.country ORDER BY n DESC LIMIT 12",
    $params,
    []
);

$total_locations = (int) query_or($db, "SELECT COUNT(*) $filtered_locs_sql", $params, 0, 'column');
$map_rows = query_or(
    $db,
    "SELECT locs.kind, locs.user_id, locs.user_fullname, locs.latd, locs.lng, locs.city, locs.state, locs.country
     $filtered_locs_sql LIMIT " . MAP_POINT_CAP,
    $params,
    []
);
// [lat, lng, kind, name, userId, place]
$map_points = array_map(static function (array $r): array {
    return [
        (float) $r['latd'],
        (float) $r['lng'],
        $r['kind'],
        (string) ($r['user_fullname'] ?? ''),
        (string) $r['user_id'],
        location_place($r, true),
    ];
}, $map_rows);
$map_capped = $total_locations > MAP_POINT_CAP;

// ── Table (paginated) ───────────────────────────────────────────────────────
$total_rows = (int) query_or($db, "SELECT COUNT(*) $users_from_sql", $params, 0, 'column');
$total_pages = (int) max(1, (int) ceil($total_rows / $limit));
$page = min($page, $total_pages);
$offset = ($page - 1) * $limit;

$users = query_or(
    $db,
    "SELECT u.user_id, u.user_fullname, u.user_email, u.user_phonenumber, u.user_active, u.user_verified,
            u.user_datecreated, u.user_last_accessed, u.user_image, u.user_travel_mode,
            u.geo_latd, u.geo_long, u.geo_meta->>'$.city' AS city, u.geo_meta->>'$.state' AS state,
            u.geo_meta->>'$.country' AS country
     $users_from_sql ORDER BY u.user_datecreated DESC LIMIT $limit OFFSET $offset",
    $params,
    []
);

// Travel-location counts for the users on this page
$travel_counts = [];
if ($users) {
    $ids = array_column($users, 'user_id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    foreach (query_or($db, "SELECT user_id, COUNT(*) AS n FROM users_locations WHERE user_id IN ($placeholders) GROUP BY user_id", $ids, []) as $r) {
        $travel_counts[$r['user_id']] = (int) $r['n'];
    }
}

function location_place(array $row, bool $with_country = false): string
{
    $keys = $with_country ? ['city', 'state', 'country'] : ['city', 'state'];
    $parts = array_filter(
        array_map(static fn($k) => (string) ($row[$k] ?? ''), $keys),
        static fn($v) => $v !== '' && $v !== 'unknown'
    );
    return $parts ? implode(', ', $parts) : '';
}

function build_users_url(array $overrides = []): string
{
    global $query, $country, $city, $status, $travel, $limit, $page;
    $params = array_merge([
        'q' => $query,
        'country' => $country,
        'city' => $city,
        'status' => $status,
        'travel' => $travel,
        'limit' => $limit,
        'page' => $page,
    ], $overrides);
    $params = array_filter($params, static fn($v) => $v !== '' && $v !== null);
    return 'users.php?' . http_build_query($params);
}
?>
<html>

<head>
    <?php include "../global/head.php"; ?>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
    <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
    <style>
        #users-map {
            height: 480px;
            border-radius: 0 0 var(--bs-card-inner-border-radius) var(--bs-card-inner-border-radius);
        }
        .legend-dot {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 4px;
            vertical-align: middle;
        }
        .legend-current { background: #3b82f6; }
        .legend-travel, .badge-travel { background: #f59e0b; }
        .badge-travel { color: #fff; }
    </style>
</head>

<body>
    <?php include "../global/header.php"; ?>

    <div class="row mb-4">
        <?php foreach ([
            ['users_located', 'Users with a location', 'geo-alt', 'primary'],
            ['travel_locations', 'Travel locations', 'airplane', 'warning'],
            ['travel_mode_on', 'Travel mode on', 'toggle-on', 'success'],
            ['countries', 'Countries', 'globe-americas', 'info'],
        ] as [$stat_key, $stat_label, $stat_icon, $stat_tone]): ?>
            <div class="col-6 col-lg-3 mb-3">
                <?php echo stat_card($stats[$stat_key], $stat_label, $stat_icon, $stat_tone); ?>
            </div>
        <?php endforeach; ?>
    </div>

    <div class="card shadow-sm mb-4">
        <div class="card-body">
            <form class="row g-2 align-items-end" method="get">
                <div class="col-12 col-md-4">
                    <label class="form-label" for="user-search">Search users</label>
                    <input class="form-control" id="user-search" name="q" type="search" placeholder="Search by name, email, phone, or id" value="<?php echo htmlspecialchars($query); ?>">
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="user-country">Country</label>
                    <select class="form-select" id="user-country" name="country">
                        <option value="">All</option>
                        <?php foreach ($countries as $country_option): ?>
                            <option value="<?php echo htmlspecialchars($country_option); ?>"<?php echo $country === $country_option ? ' selected' : ''; ?>>
                                <?php echo htmlspecialchars($country_option); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="user-city">City</label>
                    <input class="form-control" id="user-city" name="city" type="text" placeholder="Exact city"
                        value="<?php echo htmlspecialchars($city); ?>">
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="user-status">User status</label>
                    <select class="form-select" id="user-status" name="status">
                        <option value="">All</option>
                        <?php foreach (['1', '0', '2', '3', '-99'] as $status_option): ?>
                            <option value="<?php echo $status_option; ?>"<?php echo $status === $status_option ? ' selected' : ''; ?>>
                                <?php echo htmlspecialchars(render_user_active($status_option)[0]); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="user-travel">Travel mode</label>
                    <select class="form-select" id="user-travel" name="travel">
                        <option value="">Any</option>
                        <option value="1"<?php echo $travel === '1' ? ' selected' : ''; ?>>On</option>
                        <option value="0"<?php echo $travel === '0' ? ' selected' : ''; ?>>Off</option>
                    </select>
                </div>
                <div class="col-6 col-md-2">
                    <label class="form-label" for="user-limit">Rows</label>
                    <select class="form-select" id="user-limit" name="limit">
                        <?php foreach ([25, 50, 100, 200] as $option): ?>
                            <option value="<?php echo $option; ?>"<?php echo $limit === $option ? ' selected' : ''; ?>><?php echo $option; ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-12 col-md-3 d-flex gap-2">
                    <button class="btn btn-primary flex-fill" type="submit"><i class="bi bi-funnel"></i> Apply</button>
                    <a class="btn btn-outline-secondary flex-fill" href="users.php"><i class="bi bi-arrow-counterclockwise"></i> Reset</a>
                </div>
                <div class="col-12 col-md-7">
                    <label class="form-label" for="client-filter">Quick filter (client)</label>
                    <input class="form-control" id="client-filter" type="text" placeholder="Filter visible rows">
                </div>
            </form>
        </div>
    </div>

    <?php if ($top_cities): ?>
        <div class="card shadow-sm mb-4">
            <div class="card-header fw-semibold"><i class="bi bi-buildings"></i>Top cities <span class="text-muted small fw-normal">(click to filter)</span></div>
            <div class="card-body d-flex flex-wrap gap-2">
                <?php foreach ($top_cities as $city_row): ?>
                    <a class="badge text-bg-light border text-decoration-none"
                        href="<?php echo htmlspecialchars(build_users_url(['city' => $city_row['city'], 'country' => $city_row['country'], 'page' => 1])); ?>">
                        <?php echo htmlspecialchars($city_row['city']); ?>
                        <span class="text-muted">&middot; <?php echo htmlspecialchars((string) $city_row['country']); ?> &middot; <?php echo number_format((int) $city_row['n']); ?></span>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endif; ?>

    <div class="card shadow-sm mb-4">
        <div class="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span class="fw-semibold"><i class="bi bi-map"></i>Map</span>
            <span class="small text-muted">
                <span class="legend-dot legend-current"></span>Current
                <span class="legend-dot legend-travel ms-2"></span>Travel
                <span class="ms-2">&middot; <?php echo number_format(count($map_points)); ?> shown</span>
                <?php if ($map_capped): ?>
                    <span class="text-warning ms-1">(capped at <?php echo number_format(MAP_POINT_CAP); ?> -- narrow the filters)</span>
                <?php endif; ?>
            </span>
        </div>
        <div id="users-map"></div>
    </div>

    <div class="card shadow-sm">
        <div class="card-header d-flex align-items-center justify-content-between">
            <span class="fw-semibold"><i class="bi bi-people"></i>User List</span>
            <span class="text-muted small"><?php echo number_format($total_rows); ?> total</span>
        </div>
        <div class="table-responsive">
            <table class="table table-striped align-middle mb-0" id="users-table">
                <thead class="table-light">
                    <tr>
                        <th>Photo</th>
                        <th>User</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!$users): ?>
                        <tr>
                            <td colspan="5" class="text-center text-muted py-4">No users found.</td>
                        </tr>
                    <?php endif; ?>
                    <?php foreach ($users as $user): ?>
                        <?php [$status_label, $status_color] = render_user_active($user['user_active'] ?? null); ?>
                        <?php [$verified_label, $verified_color] = render_verified($user['user_verified'] ?? null); ?>
                        <?php
                        $images = $user['user_image'] ? json_decode($user['user_image'], true) : [];
                        $profile_src = (!empty($images) && isset($images[0]['p']))
                            ? img_domain_base_url() . htmlspecialchars($images[0]['p'])
                            : '';
                        $has_location = !((float) ($user['geo_latd'] ?? 0) === 0.0 && (float) ($user['geo_long'] ?? 0) === 0.0);
                        $place = location_place($user);
                        $user_country = ($user['country'] ?? '') === 'unknown' ? '' : (string) ($user['country'] ?? '');
                        $travel_count = $travel_counts[$user['user_id']] ?? 0;
                        $search_text = implode(' ', [$user['user_id'] ?? '', $user['user_email'] ?? '', $user['user_phonenumber'] ?? '']);
                        ?>
                        <tr data-search="<?php echo htmlspecialchars($search_text); ?>">
                            <td style="width: 64px;">
                                <?php if ($profile_src !== ''): ?>
                                    <img src="<?php echo $profile_src; ?>" alt="Profile image" class="rounded-2"
                                        style="width: 48px; height: 48px; object-fit: cover;">
                                <?php else: ?>
                                    <div class="bg-light text-muted d-flex align-items-center justify-content-center rounded-2"
                                        style="width: 48px; height: 48px; font-size: 11px;">No image</div>
                                <?php endif; ?>
                            </td>
                            <td>
                                <?php echo user_cell($user['user_id'] ?? null, $user['user_fullname'] ?? null); ?>
                            </td>
                            <td>
                                <?php if ($has_location): ?>
                                    <div><?php echo htmlspecialchars($place !== '' ? $place : 'Unknown place'); ?></div>
                                    <div class="small text-muted"><?php echo htmlspecialchars($user_country); ?></div>
                                <?php else: ?>
                                    <span class="text-muted small">No location</span>
                                <?php endif; ?>
                                <?php if ($travel_count > 0): ?>
                                    <span class="badge badge-travel mt-1"><i class="bi bi-airplane me-1"></i><?php echo number_format($travel_count); ?> travel</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <span class="badge text-bg-<?php echo $status_color; ?>"><?php echo htmlspecialchars($status_label); ?></span>
                                <span class="badge text-bg-<?php echo $verified_color; ?>"><?php echo htmlspecialchars($verified_label); ?></span>
                                <?php if (($user['user_travel_mode'] ?? '0') === '1'): ?>
                                    <span class="badge text-bg-success">Travel mode</span>
                                <?php endif; ?>
                            </td>
                            <td class="text-end text-nowrap">
                                <?php if ($has_location): ?>
                                    <button type="button" class="btn btn-sm btn-outline-primary js-show-on-map"
                                        data-lat="<?php echo htmlspecialchars((string) $user['geo_latd']); ?>"
                                        data-lng="<?php echo htmlspecialchars((string) $user['geo_long']); ?>"><i class="bi bi-crosshair"></i> Map</button>
                                <?php endif; ?>
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
                    <li class="page-item<?php echo $page > 1 ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_users_url(['page' => 1])); ?>">First</a>
                    </li>
                    <li class="page-item<?php echo $page > 1 ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_users_url(['page' => max(1, $page - 1)])); ?>">Prev</a>
                    </li>
                    <li class="page-item disabled">
                        <span class="page-link">Page <?php echo number_format($page); ?> of <?php echo number_format($total_pages); ?></span>
                    </li>
                    <li class="page-item<?php echo $page < $total_pages ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_users_url(['page' => min($total_pages, $page + 1)])); ?>">Next</a>
                    </li>
                    <li class="page-item<?php echo $page < $total_pages ? '' : ' disabled'; ?>">
                        <a class="page-link" href="<?php echo htmlspecialchars(build_users_url(['page' => $total_pages])); ?>">Last</a>
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
                    var text = ($(this).text() + ' ' + ($(this).data('search') || '')).toLowerCase();
                    $(this).toggle(text.indexOf(query) !== -1);
                });
            });

            document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
                new bootstrap.Tooltip(el);
            });

            // [lat, lng, kind, name, userId, place]
            var points = <?php echo json_encode($map_points, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
            var COLORS = { current: '#3b82f6', travel: '#f59e0b' };

            var map = L.map('users-map', { worldCopyJump: true }).setView([20, 0], 2);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            var cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });

            // Built with textContent, not HTML strings -- names come from users.
            function popupFor(p) {
                var box = document.createElement('div');
                var name = document.createElement('div');
                name.className = 'fw-semibold';
                name.textContent = p[3] || 'Unknown';
                var meta = document.createElement('div');
                meta.className = 'small text-muted';
                meta.textContent = (p[2] === 'travel' ? 'Travel · ' : 'Current · ') + (p[5] || 'Unknown place');
                var link = document.createElement('a');
                link.href = 'singleuser.php?id=' + encodeURIComponent(p[4]);
                link.className = 'small';
                link.textContent = 'Open user';
                box.appendChild(name);
                box.appendChild(meta);
                box.appendChild(link);
                return box;
            }

            points.forEach(function (p) {
                var marker = L.circleMarker([p[0], p[1]], {
                    radius: 7,
                    weight: 2,
                    color: '#fff',
                    fillColor: COLORS[p[2]] || COLORS.current,
                    fillOpacity: 0.9
                });
                marker.bindPopup(function () { return popupFor(p); });
                cluster.addLayer(marker);
            });
            map.addLayer(cluster);

            if (points.length) {
                map.fitBounds(cluster.getBounds(), { padding: [30, 30], maxZoom: 12 });
            }

            // "Map" buttons in the table: scroll up and zoom to that user
            $(document).on('click', '.js-show-on-map', function () {
                var lat = parseFloat($(this).data('lat'));
                var lng = parseFloat($(this).data('lng'));
                if (!isFinite(lat) || !isFinite(lng)) return;
                document.getElementById('users-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
                map.setView([lat, lng], 13);
            });
        });
    </script>

    <?php include "../global/footer.php"; ?>
</body>

</html>
