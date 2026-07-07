<?php
function get_lookup_label(PDO $db, string $type, ?int $code): string
{
    if ($code === null)
        return 'Not set';

    $stmt = $db->prepare('SELECT map_label FROM mapping_lookup WHERE map_type = ? AND map_code = ?');
    $stmt->execute([$type, $code]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    return $result['map_label'] ?? 'Unknown';
}