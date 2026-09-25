(function () {
  var slot = document.getElementById("user-slot");
  var inApp = location.pathname.indexOf("/app") !== -1;
  var appHref = (slot && slot.getAttribute("data-app")) || (inApp ? "index.html" : "app/index.html");
  var icon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.2 19.2c1.6-3.1 3.8-4.7 6.8-4.7s5.2 1.6 6.8 4.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&":"&","<":"<",">":">","\"":""","'":"&#39;" })[c];
    });
  }
  function ensureSlot() {
    if (!slot) return;
    if (!document.getElementById("user-btn")) {
      slot.innerHTML = '<button type="button" class="user-btn" id="user-btn" aria-haspopup="true" aria-expanded="false" aria-label="Account">' + icon + '</button>' +
        '<div class="user-drop" id="user-drop" hidden></div>';
    }
  }
  function paint(user) {
    ensureSlot();
    var drop = document.getElementById("user-drop");
    if (!drop) return;
    if (user) {
      drop.innerHTML = '<p class="user-mail">' + escapeHtml(user.email || user.name || "Signed in") + '</p>' +
        (inApp ? "" : '<a href="' + appHref + '">Open book</a>') +
        '<a href="' + appHref + '#settings">Account</a>' +
        '<button type="button" id="logout">Log out</button>';
    } else {
      drop.innerHTML = '<a href="' + appHref + '">Log in</a><a href="' + appHref + '">Create book</a>';
    }
  }

  document.addEventListener("click", function (e) {
    var btn = document.getElementById("user-btn");
    var drop = document.getElementById("user-drop");
    if (btn && drop && btn.contains(e.target)) {
      drop.hidden = !drop.hidden;
      btn.setAttribute("aria-expanded", drop.hidden ? "false" : "true");
      return;
    }
    if (slot && !slot.contains(e.target) && drop) {
      drop.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
    if (e.target && e.target.id === "logout") {
      e.preventDefault();
      var cfg = window.FRD_CONFIG || {};
      function done() { try { localStorage.removeItem("frd_app_v1"); } catch (err) {} location.reload(); }
      if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
        window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey).auth.signOut().finally(done);
      } else done();
    }
    var parent = e.target.closest && e.target.closest(".nav-parent");
    if (parent) {
      e.preventDefault();
      var item = parent.closest(".nav-item");
      var open = item.classList.contains("open");
      document.querySelectorAll(".nav-item.open").forEach(function (n) { n.classList.remove("open"); });
      if (!open) item.classList.add("open");
      return;
    }
    if (!e.target.closest(".nav-item")) {
      document.querySelectorAll(".nav-item.open").forEach(function (n) { n.classList.remove("open"); });
    }
  });

  document.querySelectorAll(".nav-item").forEach(function (item) {
    item.addEventListener("mouseenter", function () { item.classList.add("open"); });
    item.addEventListener("mouseleave", function () { item.classList.remove("open"); });
  });

  ensureSlot();
  paint(null);
  async function boot() {
    var user = null;
    try {
      var cfg = window.FRD_CONFIG || {};
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
  boot();
})();
