<?php
declare(strict_types=1);
include "../main_config.php";

$page_title    = 'Storage';
$page_subtitle = 'MinIO bucket policy management';
$active_page   = 'storage';

$MINIO_ENDPOINT     = (string) ($_ENV['MINIO_ENDPOINT']      ?: getenv('MINIO_ENDPOINT')      ?: '');
$MINIO_ROOT_USER    = (string) ($_ENV['MINIO_ROOT_USER']     ?: getenv('MINIO_ROOT_USER')     ?: '');
$MINIO_ROOT_PASSWORD = (string) ($_ENV['MINIO_ROOT_PASSWORD'] ?: getenv('MINIO_ROOT_PASSWORD') ?: '');
$MINIO_BUCKET       = (string) ($_ENV['MINIO_BUCKET']        ?: getenv('MINIO_BUCKET')        ?: '');
$MINIO_USE_SSL      = (string) ($_ENV['MINIO_USE_SSL']       ?: getenv('MINIO_USE_SSL')       ?: 'true');

$alias = 'datingapp_minio_bucket';
$protocol = ($MINIO_USE_SSL === 'true') ? 'https' : 'http';
$mc = '/usr/local/bin/mc';

$feedback = null;
$feedback_type = 'success';

if (!isset($_SESSION['mc_insecure_enabled'])) {
    $_SESSION['mc_insecure_enabled'] = true;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'toggle_mc_insecure') {
    $_SESSION['mc_insecure_enabled'] = isset($_POST['mc_insecure_enabled']);
    $feedback = 'MinIO insecure mode ' . ($_SESSION['mc_insecure_enabled'] ? 'enabled.' : 'disabled.');
}

$mc_insecure_enabled = (bool) $_SESSION['mc_insecure_enabled'];
$mc_insecure_flag = $mc_insecure_enabled ? '--insecure' : '';

function mc_alias_setup(string $mc, string $alias, string $proto, string $endpoint, string $user, string $pass): void
{
    global $mc_insecure_flag;
    $cmd = sprintf(
        '%s alias set '.$mc_insecure_flag.' %s %s://%s %s %s 2>&1',
        escapeshellarg($mc),
        escapeshellarg($alias),
        $proto,
        escapeshellarg($endpoint),
        escapeshellarg($user),
        escapeshellarg($pass)
    );
    $mc_output = shell_exec($cmd);
    //echo "<pre>$mc_output</pre>";
}

function mc_get_policy(string $mc, string $alias, string $bucket): string
{
    global $mc_insecure_flag;
    $target = escapeshellarg("$alias/$bucket");
    $out = shell_exec(escapeshellarg($mc) . " $mc_insecure_flag anonymous get $target 2>&1");
    return trim((string) $out);
}

function mc_get_policy_json(string $mc, string $alias, string $bucket): string
{
    global $mc_insecure_flag;
    $target = escapeshellarg("$alias/$bucket");
    $out = shell_exec(escapeshellarg($mc) . " $mc_insecure_flag anonymous get-json $target 2>&1");
    return trim((string) $out);
}

mc_alias_setup($mc, $alias, $protocol, $MINIO_ENDPOINT, $MINIO_ROOT_USER, $MINIO_ROOT_PASSWORD);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'set_anonymous') {
        $target = escapeshellarg("$alias/$MINIO_BUCKET");
        $out = shell_exec(escapeshellarg($mc) . " $mc_insecure_flag anonymous set download $target 2>&1");
        $feedback = 'Policy set to anonymous download. ' . htmlspecialchars(trim((string) $out));

    } elseif ($action === 'set_none') {
        $target = escapeshellarg("$alias/$MINIO_BUCKET");
        $out = shell_exec(escapeshellarg($mc) . " $mc_insecure_flag anonymous set none $target 2>&1");
        $feedback = 'Anonymous access removed (none). ' . htmlspecialchars(trim((string) $out));

    } elseif ($action === 'set_custom_json') {
        $raw_json = $_POST['policy_json'] ?? '';
        $decoded = json_decode($raw_json, true);
        if ($decoded === null) {
            $feedback = 'Invalid JSON: ' . htmlspecialchars(json_last_error_msg());
            $feedback_type = 'danger';
        } else {
            $tmp = tempnam(sys_get_temp_dir(), 'mc_policy_') . '.json';
            file_put_contents($tmp, json_encode($decoded, JSON_PRETTY_PRINT));
            $target = escapeshellarg("$alias/$MINIO_BUCKET");
            $out = shell_exec(escapeshellarg($mc) . " $mc_insecure_flag anonymous set-json " . escapeshellarg($tmp) . " $target 2>&1");
            unlink($tmp);
            $feedback = 'Custom policy applied. ' . htmlspecialchars(trim((string) $out));
        }
    }
}

$current_policy = mc_get_policy($mc, $alias, $MINIO_BUCKET);
$current_json   = mc_get_policy_json($mc, $alias, $MINIO_BUCKET);

$is_anonymous = stripos($current_policy, 'download') !== false;
$policy_badge_class = $is_anonymous ? 'bg-warning text-dark' : 'bg-secondary';
$policy_label = $is_anonymous ? 'anonymous (download)' : htmlspecialchars($current_policy ?: 'none');

$json_pretty = '';
$json_decoded = json_decode($current_json, true);
if ($json_decoded !== null) {
    $json_pretty = json_encode($json_decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
} else {
    $json_pretty = $current_json;
}
?>
<html>
<head>
    <?php include "../global/head.php"; ?>
</head>
<body>
    <?php include "../global/header.php"; ?>

    <div class="container-fluid py-4">

        <?php if ($feedback !== null): ?>
            <div class="alert alert-<?php echo $feedback_type; ?> alert-dismissible fade show" role="alert">
                <?php echo $feedback; ?>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        <?php endif; ?>

        <div class="row g-4">

            <!-- Status card -->
            <div class="col-12">
                <div class="card">
                    <div class="card-header d-flex align-items-center gap-2">
                        <h6 class="mb-0">Bucket</h6>
                        <span class="badge bg-dark"><?php echo htmlspecialchars($MINIO_BUCKET); ?></span>
                        <span class="ms-auto badge <?php echo $policy_badge_class; ?>">
                            <?php echo $policy_label; ?>
                        </span>
                    </div>
                    <div class="card-body">
                        <p class="text-muted small mb-0">
                            Endpoint: <code><?php echo htmlspecialchars($protocol . '://' . $MINIO_ENDPOINT); ?></code>
                        </p>
                        <form method="POST" class="mt-3">
                            <input type="hidden" name="action" value="toggle_mc_insecure">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch"
                                    id="mc_insecure_enabled" name="mc_insecure_enabled" value="1"
                                    onchange="this.form.submit()"
                                    <?php echo $mc_insecure_enabled ? 'checked' : ''; ?>>
                                <label class="form-check-label" for="mc_insecure_enabled">
                                    Use <code>mc --insecure</code>
                                </label>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Quick switch -->
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header">
                        <h6 class="mb-0">Quick Policy Switch</h6>
                    </div>
                    <div class="card-body d-flex flex-column gap-3">
                        <div>
                            <p class="text-muted small mb-2">
                                Allow anyone to download objects from the bucket (no auth required).
                            </p>
                            <form method="POST">
                                <input type="hidden" name="action" value="set_anonymous">
                                <button type="submit" class="btn btn-warning btn-sm w-100"
                                    <?php echo $is_anonymous ? 'disabled' : ''; ?>>
                                    Set Anonymous (download)
                                </button>
                            </form>
                        </div>
                        <hr class="my-0">
                        <div>
                            <p class="text-muted small mb-2">
                                Remove all anonymous access — objects require authentication.
                            </p>
                            <form method="POST">
                                <input type="hidden" name="action" value="set_none">
                                <button type="submit" class="btn btn-secondary btn-sm w-100"
                                    <?php echo !$is_anonymous ? 'disabled' : ''; ?>>
                                    Remove Anonymous (none)
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Current JSON policy -->
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header">
                        <h6 class="mb-0">Current Policy JSON</h6>
                    </div>
                    <div class="card-body p-0">
                        <pre class="m-0 p-3 bg-light rounded-bottom" style="font-size:0.75rem;max-height:220px;overflow:auto;"><?php echo htmlspecialchars($json_pretty ?: '(no policy / empty)'); ?></pre>
                    </div>
                </div>
            </div>

            <!-- Custom JSON editor -->
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Custom JSON Policy</h6>
                    </div>
                    <div class="card-body">
                        <form method="POST" id="custom-json-form">
                            <input type="hidden" name="action" value="set_custom_json">
                            <div class="mb-3">
                                <label class="form-label text-muted small">
                                    Paste a valid AWS S3-style bucket policy JSON. It will be validated before being applied.
                                </label>
                                <textarea name="policy_json" id="policy_json_input" class="form-control font-monospace"
                                    rows="14" spellcheck="false"
                                    placeholder='{"Version":"2012-10-17","Statement":[...]}'><?php echo htmlspecialchars($json_pretty); ?></textarea>
                                <div class="invalid-feedback" id="json-error"></div>
                            </div>
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-outline-secondary btn-sm" id="btn-format">Format JSON</button>
                                <button type="submit" class="btn btn-primary btn-sm" id="btn-apply">Apply Custom Policy</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <?php include "../global/footer.php"; ?>

    <script>
    (function () {
        const textarea = document.getElementById('policy_json_input');
        const jsonError = document.getElementById('json-error');

        document.getElementById('btn-format').addEventListener('click', function () {
            try {
                const parsed = JSON.parse(textarea.value);
                textarea.value = JSON.stringify(parsed, null, 2);
                textarea.classList.remove('is-invalid');
                jsonError.textContent = '';
            } catch (e) {
                textarea.classList.add('is-invalid');
                jsonError.textContent = 'Invalid JSON: ' + e.message;
            }
        });

        document.getElementById('custom-json-form').addEventListener('submit', function (e) {
            try {
                JSON.parse(textarea.value);
                textarea.classList.remove('is-invalid');
            } catch (e) {
                e.preventDefault();
                textarea.classList.add('is-invalid');
                jsonError.textContent = 'Invalid JSON: ' + e.message;
            }
        });
    })();
    </script>
</body>
</html>
