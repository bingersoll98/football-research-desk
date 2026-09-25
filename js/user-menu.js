(function () {
  var slot = document.getElementById("user-slot");
  if (!slot) return;
  var inApp = location.pathname.indexOf("/app") !== -1;
  var appHref = slot.getAttribute("data-app") || (inApp ? "index.html" : "app/index.html");

  function text(s) { return String(s || ""); }

  function setDrop(user) {
    var drop = slot.querySelector(".user-drop") || document.getElementById("user-drop");
    if (!drop) return;
    drop.innerHTML = "";
    if (user) {
      var p = document.createElement("p");
      p.className = "user-mail";
      p.textContent = text(user.email || user.name || "Signed in");
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

  document.addEventListener("click", function (e) {
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
  });

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
