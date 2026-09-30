$(function () {
  function updateClock() {
    var now = new Date();
    var clockText = now.toLocaleString("en-US", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    $("#live-clock").text(clockText);
  }

  if ($("#live-clock").length) {
    updateClock();
    setInterval(updateClock, 60000);
  }

  // Theme: light -> dark -> system. global/head.php applies the saved choice
  // before paint; this switches it and follows the OS while on "system".
  var THEMES = {
    light: { label: "Light", icon: "bi-sun" },
    dark: { label: "Dark", icon: "bi-moon-stars" },
    system: { label: "System", icon: "bi-circle-half" },
  };
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function currentPref() {
    return document.documentElement.getAttribute("data-theme-pref") || "system";
  }
  function applyTheme(pref) {
    var dark = pref === "dark" || (pref === "system" && media.matches);
    document.documentElement.setAttribute("data-bs-theme", dark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme-pref", pref);
    $(".js-theme-toggle").each(function () {
      $(this).find("i").attr("class", "bi " + THEMES[pref].icon);
      $(this).find(".js-theme-label").text(THEMES[pref].label);
      $(this).attr("aria-label", "Theme: " + THEMES[pref].label + ". Click to switch.");
    });
  }
  $(".js-theme-toggle").on("click", function () {
    var order = ["light", "dark", "system"];
    var next = order[(order.indexOf(currentPref()) + 1) % order.length];
    try {
      localStorage.setItem("admin-theme", next);
    } catch (e) {}
    applyTheme(next);
  });
  media.addEventListener("change", function () {
    if (currentPref() === "system") applyTheme("system");
  });
  applyTheme(currentPref());

  // Popovers for table cells (global/funcs.php): time_cell() carries its own
  // content and shows on hover/focus; user_cell() opens on click (so a tap on
  // a phone shows the card rather than navigating) and loads its card from
  // user_popover.php once, then reuses it.
  if (window.bootstrap) {
    $(".admin-time").each(function () {
      bootstrap.Popover.getOrCreateInstance(this, { container: "body" });
    });

    // The card's copy buttons survive Bootstrap's HTML sanitizer only if allowed.
    var allowList = $.extend(true, {}, bootstrap.Popover.Default.allowList);
    allowList.button = ["type", "data-copy", "aria-label"];

    var userCards = {};
    var openPop = null;
    $(".admin-user-pop").each(function () {
      var el = this;
      var id = $(el).data("user-id");
      var pop = bootstrap.Popover.getOrCreateInstance(el, {
        container: "body",
        trigger: "click",
        placement: "auto",
        html: true,
        allowList: allowList,
        customClass: "admin-user-popover",
        content: function () {
          return userCards[id] || '<div class="small text-muted">Loading…</div>';
        },
      });
      $(el).on("show.bs.popover", function () {
        if (openPop && openPop !== pop) openPop.hide();
        openPop = pop;
        if (userCards[id] !== undefined) return;
        userCards[id] = null;
        $.get("user_popover.php", { id: id })
          .done(function (html) {
            userCards[id] = html;
          })
          .fail(function (xhr) {
            userCards[id] =
              xhr.responseText || '<div class="small text-danger">Could not load this user.</div>';
          })
          .always(function () {
            pop.setContent({ ".popover-body": userCards[id] });
          });
      });
      $(el).on("hidden.bs.popover", function () {
        if (openPop === pop) openPop = null;
      });
    });

    // Close the open card on a click outside it (or its button) and on Esc.
    $(document).on("click", function (e) {
      if (!openPop) return;
      if ($(e.target).closest(".popover, .admin-user-pop").length) return;
      openPop.hide();
    });
    $(document).on("keydown", function (e) {
      if (e.key === "Escape" && openPop) openPop.hide();
    });
  }

  // Copy buttons inside popovers (user_popover.php copy_value()).
  $(document).on("click", ".js-pop-copy", function () {
    var $btn = $(this);
    var text = String($btn.data("copy"));
    var done = function () {
      $btn.addClass("copied").find("i").attr("class", "bi bi-check2");
      setTimeout(function () {
        $btn.removeClass("copied").find("i").attr("class", "bi bi-copy");
      }, 1200);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done);
    } else {
      // Clipboard API needs https; the admin also runs over plain http.
      var $tmp = $("<textarea>").val(text).css({ position: "fixed", opacity: 0 }).appendTo("body");
      $tmp[0].select();
      try {
        document.execCommand("copy");
        done();
      } catch (err) {}
      $tmp.remove();
    }
  });
});
