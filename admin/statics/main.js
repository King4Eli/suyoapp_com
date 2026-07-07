$(function () {
    function updateClock() {
        var now = new Date();
        var clockText = now.toLocaleString('en-US', {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        $('#live-clock').text(clockText);
    }

    if ($('#live-clock').length) {
        updateClock();
        setInterval(updateClock, 60000);
    }
});
