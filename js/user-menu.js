(function () {
  var slot = document.getElementById("user-slot");
  if (!slot) return;
  var cfg = window.FRD_CONFIG || {};
  var inApp = location.pathname.indexOf("/app") !== -1;
  var appHref = slot.getAttribute("data-app") || (inApp ? "index.html" : "app/index.html");
  var icon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.2 19.2c1.6-3.1 3.8-4.7 6.8-4.7s5.2 1.6 6.8 4.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ({ "&":"&","<":"<",">":">","\"":""","'":"&#39;" })[c]; });
  }
  function paint(user) {
    var body;
    if (user) {
      body = '<p class="user-mail">' + escapeHtml(user.email || user.name || "Signed in") + '</p>';
      if (!inApp) body += '<a href="' + appHref + '">Open book</a>';
      body += '<button type="button" id="logout">Log out</button>';
    } else {
      body = '<a href="' + appHref + '">Log in</a>';
    }
    slot.innerHTML = '<button type="button" class="user-btn" id="user-btn" aria-haspopup="true" aria-expanded="false" aria-label="Account">' + icon + '</button>' +
      '<div class="user-drop" id="user-drop" hidden>' + body + '</div>';
  }
  document.addEventListener("click", function (e) {
    var btn = document.getElementById("user-btn");
    var drop = document.getElementById("user-drop");
    if (!btn || !drop) return;
    if (btn.contains(e.target)) {
      drop.hidden = !drop.hidden;
      btn.setAttribute("aria-expanded", drop.hidden ? "false" : "true");
      return;
    }
    if (!slot.contains(e.target)) {
      drop.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });
  async function boot() {
    var user = null;
    try {
      if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
        var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        var res = await sb.auth.getSession();
        var sess = res && res.data && res.data.session;
        if (sess && sess.user) user = { email: sess.user.email, name: (sess.user.user_metadata || {}).name || "" };
      } else {
        var raw = localStorage.getItem("frd_app_v1");
        if (raw) {
          var db = JSON.parse(raw);
          if (db.session && db.session.email) user = db.session;
        }
      }
    } catch (err) {}
    paint(user);
  }

  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "logout") {
      e.preventDefault();
      var cfg = window.FRD_CONFIG || {};
      if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
        window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey).auth.signOut().finally(function () {
          try { localStorage.removeItem("frd_app_v1"); } catch (err) {}
          location.reload();
        });
      } else {
        try { localStorage.removeItem("frd_app_v1"); } catch (err) {}
        location.reload();
      }
    }
    var item = e.target.closest && e.target.closest(".nav-item");
    if (item && e.target.closest("a") === item.querySelector(":scope > a")) {
      if (window.matchMedia && window.matchMedia("(hover: none)").matches) {
        if (!item.classList.contains("open")) {
          e.preventDefault();
          document.querySelectorAll(".nav-item.open").forEach(function (n) { n.classList.remove("open"); });
          item.classList.add("open");
        }
      }
    } else if (!e.target.closest(".nav-item")) {
      document.querySelectorAll(".nav-item.open").forEach(function (n) { n.classList.remove("open"); });
    }
  });
  boot();
})();
