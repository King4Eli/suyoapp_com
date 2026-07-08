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
