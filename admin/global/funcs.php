<?php

/** Fetches the api mapper payload once per request. */
function fetch_mapper_payload(): array
{
    static $payload = null;
    if ($payload !== null) {
        return $payload;
    }

    $apiUrl = ($_ENV['API_INTERNAL_URL'] ?? getenv('API_INTERNAL_URL')) ?: 'http://suyoapp_com_api';
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => '{}',
            'timeout' => 3,
            'ignore_errors' => true,
        ],
    ]);

    $response = @file_get_contents(rtrim($apiUrl, '/') . '/api/core/v1/getMapper', false, $context);
    $decoded = $response !== false ? json_decode($response, true) : null;
    $payload = $decoded['mapper_payload'] ?? [];
    return $payload;
}

/** Label for a stored code: api payload first, then mapping_lookup. */
function get_lookup_label(PDO $db, string $type, ?int $code): string
{
    if ($code === null) {
        return 'Not set';
    }
    if ((int) $code === -99) {
        return 'Any';
    }

    $mapper = fetch_mapper_payload();
    if (isset($mapper[$type])) {
        return $mapper[$type][$code] ?? 'Unknown';
    }

    $stmt = $db->prepare('SELECT map_label FROM mapping_lookup WHERE map_type = ? AND map_code = ?');
    $stmt->execute([$type, $code]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    return $result['map_label'] ?? 'Unknown';
}

/** Prefix for a stored image path (user_image[].p). */
function img_domain_base_url(): string
{
    $mapper = fetch_mapper_payload();
    return is_string($mapper['img_domain'] ?? null) ? $mapper['img_domain'] : '';
}

/** Pretty-prints JSON, arrays, or scalars. */
function format_scalar_or_json($value): string
{
    if ($value === null || $value === '') {
        return '<span class="text-muted">—</span>';
    }
    if (is_array($value)) {
        return '<pre class="mb-0 small">' . htmlspecialchars(json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) . '</pre>';
    }
    $str = (string) $value;
    $trimmed = ltrim($str);
    if ($trimmed !== '' && ($trimmed[0] === '{' || $trimmed[0] === '[')) {
        $decoded = json_decode($str, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return '<pre class="mb-0 small">' . htmlspecialchars(json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) . '</pre>';
        }
    }
    return nl2br(htmlspecialchars($str));
}

/** [label, bootstrap color] for users.user_active. */
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

/**
 * A stat tile: icon bubble + big number + label. Styles in statics/admin.css.
 * @param int|float|string $value numbers are formatted with thousands separators
 * @param string $icon Bootstrap Icons name (without the "bi-" prefix)
 * @param string $tone primary|accent|success|warning|info|danger|secondary
 */
function stat_card($value, string $label, string $icon, string $tone = 'primary'): string
{
    $display = is_numeric($value) ? number_format((float) $value) : (string) $value;
    return '<div class="card h-100"><div class="stat-tile">'
        . '<span class="stat-tile-icon tone-' . htmlspecialchars($tone) . '"><i class="bi bi-' . htmlspecialchars($icon) . '"></i></span>'
        . '<div><div class="stat-tile-value">' . htmlspecialchars($display) . '</div>'
        . '<div class="stat-tile-label">' . htmlspecialchars($label) . '</div></div>'
        . '</div></div>';
}

/**
 * A date/time for a table cell: short relative text ("3h ago", "Mar 4") with
 * the full local time, UTC and unix seconds in a popover (statics/main.js).
 * Accepts unix seconds (int or digit string) or anything strtotime() reads.
 * @param int|string|null $value
 */
function time_cell($value): string
{
    if ($value === null || $value === '' || $value === '0') {
        return '<span class="text-muted">—</span>';
    }
    $ts = is_numeric($value) ? (int) $value : strtotime((string) $value);
    if (!$ts) {
        return htmlspecialchars((string) $value);
    }
    $diff = time() - $ts;
    if ($diff >= 0 && $diff < 60) {
        $short = 'just now';
    } elseif ($diff >= 0 && $diff < 3600) {
        $short = floor($diff / 60) . 'm ago';
    } elseif ($diff >= 0 && $diff < 86400) {
        $short = floor($diff / 3600) . 'h ago';
    } elseif ($diff >= 0 && $diff < 7 * 86400) {
        $short = floor($diff / 86400) . 'd ago';
    } elseif (date('Y', $ts) === date('Y')) {
        $short = date('M j', $ts);
    } else {
        $short = date('M j, Y', $ts);
    }
    $body = '<dl class="admin-pop-dl mb-0">'
        . '<dt>Local</dt><dd>' . date('D, M j, Y · H:i:s', $ts) . ' ' . date('T', $ts) . '</dd>'
        . '<dt>UTC</dt><dd>' . gmdate('Y-m-d H:i:s', $ts) . '</dd>'
        . '<dt>Unix</dt><dd class="font-monospace">' . $ts . '</dd>'
        . '</dl>';
    return '<span class="admin-time" tabindex="0" data-bs-toggle="popover" data-bs-trigger="hover focus"'
        . ' data-bs-html="true" data-bs-placement="top"'
        . ' data-bs-content="' . htmlspecialchars($body, ENT_QUOTES) . '">'
        . '<time datetime="' . date('c', $ts) . '">' . htmlspecialchars($short) . '</time></span>';
}

/**
 * A user for a table cell: their name as a button that opens a profile card
 * popover (id, contact details with copy buttons, "View user"), fetched once
 * from user_popover.php. A button, not a link, so tapping it on a phone shows
 * the card instead of leaving the page. Optional second line under the name.
 */
function user_cell(?string $user_id, ?string $name, string $sub = ''): string
{
    $label = trim((string) $name) !== '' ? (string) $name : 'Unknown';
    if ($user_id === null || $user_id === '') {
        return '<div class="fw-semibold">' . htmlspecialchars($label) . '</div>';
    }
    return '<button type="button" class="admin-user-pop" data-user-id="' . htmlspecialchars($user_id, ENT_QUOTES) . '"'
        . ' aria-haspopup="dialog" aria-label="' . htmlspecialchars($label, ENT_QUOTES) . ': show user details">'
        . htmlspecialchars($label) . '</button>'
        . ($sub !== '' ? '<div class="small text-muted">' . htmlspecialchars($sub) . '</div>' : '');
}
