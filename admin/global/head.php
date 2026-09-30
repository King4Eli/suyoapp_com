<meta charset="utf-8" />
<script>
    // Light / dark / system (statics/main.js switches it). Applied here, before
    // any CSS paints, so a dark-mode page never flashes white.
    (function () {
        var pref = 'system';
        try { pref = localStorage.getItem('admin-theme') || 'system'; } catch (e) {}
        var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme-pref', pref);
    })();
</script>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title><?= htmlspecialchars(($page_title ?? 'Admin') . ' · SoyuApp Admin') ?></title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" />

<script src="<?= $url; ?>/statics/jquery.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet"
    integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"
    integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI"
    crossorigin="anonymous"></script>
<link rel="stylesheet" href="../statics/admin.css" />
