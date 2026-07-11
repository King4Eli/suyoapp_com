<?php
declare(strict_types=1);
include "../main_config.php";

$page_title = 'Dashboard';
$page_subtitle = 'Database-wide statistics';
$active_page = 'dashboard';
$db = $DB_STMT;

function table_exists(PDO $db, string $table): bool
{
    $stmt = $db->prepare('
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
        LIMIT 1
    ');
    $stmt->execute([$table]);
    return (bool) $stmt->fetchColumn();
}

function column_exists(PDO $db, string $table, string $column): bool
{
    $stmt = $db->prepare('
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
        LIMIT 1
    ');
    $stmt->execute([$table, $column]);
    return (bool) $stmt->fetchColumn();
}

function safe_count(PDO $db, string $table, string $where = '1=1'): int
{
    if (!table_exists($db, $table)) {
        return 0;
    }
    $stmt = $db->query("SELECT COUNT(*) AS count FROM `$table` WHERE $where");
    return (int) ($stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);
}

function safe_max_timestamp(PDO $db, string $table, string $column): ?string
{
    if (!table_exists($db, $table) || !column_exists($db, $table, $column)) {
        return null;
    }
    $stmt = $db->query("SELECT MAX(`$column`) AS max_date FROM `$table`");
    $value = $stmt->fetch(PDO::FETCH_ASSOC)['max_date'] ?? null;

    if ($value === null || $value === '') {
        return null;
    }

    if (is_numeric($value)) {
        return date('Y-m-d H:i:s', (int) $value);
    }

    return (string) $value;
}

function get_table_row_stats(PDO $db): array
{
    $stmt = $db->query('
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY table_name ASC
    ');
    $tableNames = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

    $rows = [];
    $totalRows = 0;

    foreach ($tableNames as $tableName) {
        if (!preg_match('/^[A-Za-z0-9_]+$/', (string) $tableName)) {
            continue;
        }
        $countStmt = $db->query("SELECT COUNT(*) AS count FROM `$tableName`");
        $count = (int) ($countStmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);
        $rows[] = [
            'table_name' => (string) $tableName,
            'row_count' => $count,
        ];
        $totalRows += $count;
    }

    return [
        'table_count' => count($rows),
        'total_rows' => $totalRows,
        'rows' => $rows,
    ];
}

function get_dashboard_stats(PDO $db): array
{
    $stats = [];

    $stats['conversations_total'] = safe_count($db, 'conversations');
    $stats['matches_total'] = safe_count($db, 'matches');
    $stats['matches_active'] = column_exists($db, 'matches', 'match_status')
        ? safe_count($db, 'matches', "match_status = '1'")
        : 0;
    $stats['reports_total'] = safe_count($db, 'logreports');
    $stats['reports_pending'] = column_exists($db, 'logreports', 'report_status')
        ? safe_count($db, 'logreports', "report_status = '0'")
        : 0;
    $stats['payments_total'] = safe_count($db, 'payments');
    $stats['payments_completed'] = column_exists($db, 'payments', 'status')
        ? safe_count($db, 'payments', "status = '1'")
        : 0;
    $stats['payments_refunded'] = column_exists($db, 'payments', 'status')
        ? safe_count($db, 'payments', "status = '2'")
        : 0;
    $stats['products_total'] = safe_count($db, 'product_lists');
    $stats['products_active'] = column_exists($db, 'product_lists', 'pl_is_active')
        ? safe_count($db, 'product_lists', "pl_is_active = '1'")
        : 0;
    $stats['purchases_total'] = safe_count($db, 'product_purchased');
    $stats['mapper_entries'] = safe_count($db, 'mapping_lookup');

    $stats['latest_conversation'] = safe_max_timestamp($db, 'conversations', 'convo_date_added');
    $stats['latest_match'] = safe_max_timestamp($db, 'matches', 'match_dateAdded');
    $stats['latest_report'] = safe_max_timestamp($db, 'logreports', 'created_at');
    $stats['latest_payment'] = safe_max_timestamp($db, 'payments', 'p_created_at');

    return $stats;
}

$tableStats = get_table_row_stats($db);
$stats = get_dashboard_stats($db);
?>
<html>
<head>
    <?php include "../global/head.php"; ?>
    <style>
        .stat-card {
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <?php include "../global/header.php"; ?>

    <div class="container-fluid py-4">
        <div class="row mb-4">
            <div class="col-12">
                <h5 class="mb-3">Database Overview</h5>
            </div>

            <div class="col-6 col-md-4 col-lg-3 mb-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <div class="h4 mb-1"><?php echo number_format($tableStats['table_count']); ?></div>
                        <div class="text-muted small">Total Tables</div>
                    </div>
                </div>
            </div>

            <div class="col-6 col-md-4 col-lg-3 mb-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <div class="h4 mb-1"><?php echo number_format($tableStats['total_rows']); ?></div>
                        <div class="text-muted small">Total Rows</div>
                    </div>
                </div>
            </div>

            <div class="col-6 col-md-4 col-lg-3 mb-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <div class="h4 mb-1"><?php echo number_format($stats['conversations_total']); ?></div>
                        <div class="text-muted small">Conversations</div>
                    </div>
                </div>
            </div>

            <div class="col-6 col-md-4 col-lg-3 mb-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <div class="h4 mb-1"><?php echo number_format($stats['matches_total']); ?></div>
                        <div class="text-muted small">Matches</div>
                    </div>
                </div>
            </div>

            <div class="col-6 col-md-4 col-lg-3 mb-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <div class="h4 mb-1"><?php echo number_format($stats['reports_total']); ?></div>
                        <div class="text-muted small">Reports</div>
                    </div>
                </div>
            </div>

            <div class="col-6 col-md-4 col-lg-3 mb-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <div class="h4 mb-1"><?php echo number_format($stats['payments_total']); ?></div>
                        <div class="text-muted small">Payments</div>
                    </div>
                </div>
            </div>

            <div class="col-6 col-md-4 col-lg-3 mb-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <div class="h4 mb-1"><?php echo number_format($stats['products_active']); ?></div>
                        <div class="text-muted small">Active Products</div>
                    </div>
                </div>
            </div>

            <div class="col-6 col-md-4 col-lg-3 mb-3">
                <div class="card stat-card h-100">
                    <div class="card-body">
                        <div class="h4 mb-1"><?php echo number_format($stats['purchases_total']); ?></div>
                        <div class="text-muted small">Product Purchases</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-lg-6 mb-4">
                <div class="card h-100">
                    <div class="card-header">
                        <h6 class="mb-0">Detailed Metrics</h6>
                    </div>
                    <div class="card-body">
                        <table class="table table-sm mb-0">
                            <tbody>
                                <tr>
                                    <th scope="row">Active Matches</th>
                                    <td><?php echo number_format($stats['matches_active']); ?></td>
                                </tr>
                                <tr>
                                    <th scope="row">Pending Reports</th>
                                    <td><?php echo number_format($stats['reports_pending']); ?></td>
                                </tr>
                                <tr>
                                    <th scope="row">Completed Payments</th>
                                    <td><?php echo number_format($stats['payments_completed']); ?></td>
                                </tr>
                                <tr>
                                    <th scope="row">Refunded Payments</th>
                                    <td><?php echo number_format($stats['payments_refunded']); ?></td>
                                </tr>
                                <tr>
                                    <th scope="row">All Products</th>
                                    <td><?php echo number_format($stats['products_total']); ?></td>
                                </tr>
                                <tr>
                                    <th scope="row">Mapping Entries</th>
                                    <td><?php echo number_format($stats['mapper_entries']); ?></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="col-lg-6 mb-4">
                <div class="card h-100">
                    <div class="card-header">
                        <h6 class="mb-0">Latest Activity Timestamps</h6>
                    </div>
                    <div class="card-body">
                        <table class="table table-sm mb-0">
                            <tbody>
                                <tr>
                                    <th scope="row">Latest Conversation</th>
                                    <td><?php echo $stats['latest_conversation'] ? htmlspecialchars($stats['latest_conversation']) : '-'; ?></td>
                                </tr>
                                <tr>
                                    <th scope="row">Latest Match</th>
                                    <td><?php echo $stats['latest_match'] ? htmlspecialchars($stats['latest_match']) : '-'; ?></td>
                                </tr>
                                <tr>
                                    <th scope="row">Latest Report</th>
                                    <td><?php echo $stats['latest_report'] ? htmlspecialchars($stats['latest_report']) : '-'; ?></td>
                                </tr>
                                <tr>
                                    <th scope="row">Latest Payment</th>
                                    <td><?php echo $stats['latest_payment'] ? htmlspecialchars($stats['latest_payment']) : '-'; ?></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">Table Row Counts (All SQL Tables)</h6>
                        <span class="badge bg-light text-dark"><?php echo number_format($tableStats['table_count']); ?> tables</span>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-striped table-hover table-sm mb-0">
                                <thead>
                                    <tr>
                                        <th>Table</th>
                                        <th class="text-end">Rows</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($tableStats['rows'] as $row): ?>
                                        <tr>
                                            <td><?php echo htmlspecialchars($row['table_name']); ?></td>
                                            <td class="text-end"><?php echo number_format((int) $row['row_count']); ?></td>
                                        </tr>
                                    <?php endforeach; ?>
                                    <?php if (empty($tableStats['rows'])): ?>
                                        <tr>
                                            <td colspan="2" class="text-center text-muted">No tables found</td>
                                        </tr>
                                    <?php endif; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <?php include "../global/footer.php"; ?>
</body>
</html>