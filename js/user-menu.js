(function () {
  var slot = document.getElementById("user-slot");
  var inApp = location.pathname.indexOf("/app") !== -1;
  var appHref = (slot && slot.getAttribute("data-app")) || (inApp ? "index.html" : "app/index.html");
  var fineHover = function () {
    return window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  };

  function closeAll(except) {
    document.querySelectorAll("details.nav-item, details.user-slot").forEach(function (d) {
      if (d !== except) d.open = false;
    });
  }

  function bindMenu(d) {
    var timer = null;
    d.addEventListener("mouseenter", function () {
      if (!fineHover()) return;
      clearTimeout(timer);
      closeAll(d);
      d.open = true;
    });
    d.addEventListener("mouseleave", function () {
      if (!fineHover()) return;
      timer = setTimeout(function () { d.open = false; }, 120);
    });
    d.addEventListener("toggle", function () {
      if (d.open) closeAll(d);
    });
  }

  document.querySelectorAll("details.nav-item, details.user-slot").forEach(bindMenu);

  document.addEventListener("click", function (e) {
    var inside = e.target.closest && e.target.closest("details.nav-item, details.user-slot");
    if (!inside) closeAll();
    if (e.target && e.target.id === "logout") {
      e.preventDefault();
      var cfg = window.FRD_CONFIG || {};
      function done() {
        try { localStorage.removeItem("frd_app_v1"); } catch (err) {}
        location.reload();
      }
      if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
        window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey).auth.signOut().finally(done);
      } else done();
    }
    if (e.target.closest && e.target.closest(".sub, .user-drop") && e.target.closest("a, button")) {
      var owner = e.target.closest("details");
      setTimeout(function () { if (owner) owner.open = false; }, 0);
    }
  });

  function setDrop(user) {
    var drop = document.getElementById("user-drop");
    if (!drop) return;
    while (drop.firstChild) drop.removeChild(drop.firstChild);
    if (user) {
      var p = document.createElement("p");
      p.className = "user-mail";
      p.textContent = user.email || user.name || "Signed in";
      drop.appendChild(p);
      if (!inApp) {
        var open = document.createElement("a");
        open.href = appHref;
        open.textContent = "Open book";
        drop.appendChild(open);
      }
      var acct = document.createElement("a");
      acct.href = appHref + "#settings";
      acct.textContent = "Account";
      drop.appendChild(acct);
      var outBtn = document.createElement("button");
      outBtn.type = "button";
      outBtn.id = "logout";
      outBtn.textContent = "Log out";
      drop.appendChild(outBtn);
    } else {
      var login = document.createElement("a");
      login.href = appHref;
      login.textContent = "Log in";
      drop.appendChild(login);
    }
  }

  setDrop(null);
  (async function () {
    var user = null;
    try {
      var cfg = window.FRD_CONFIG || {};
      if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
        var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        var res = await sb.auth.getSession();
        var sess = res && res.data && res.data.session;
        if (sess && sess.user) user = { email: sess.user.email, name: (sess.user.user_metadata || {}).name || "" };
      }
    } catch (err) {}
    setDrop(user);
  })();
})();
