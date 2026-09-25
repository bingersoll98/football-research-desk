(function () {
  function readPending() {
    try {
      var raw = sessionStorage.getItem("FRD_PENDING_ADD");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function clearPending() {
    try { sessionStorage.removeItem("FRD_PENDING_ADD"); } catch (e) {}
  }
  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  async function save(play) {
    var cfg = window.FRD_CONFIG || {};
    var app = document.getElementById("app");
    if (!app || app.classList.contains("hidden")) return false;
    if (!play || !play.play) return false;
    if (!cfg.supabaseUrl || !window.supabase) return false;
    var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, storage: window.localStorage }
    });
    var sess = await sb.auth.getSession();
    var user = sess.data && sess.data.session && sess.data.session.user;
    if (!user) return false;
    var row = await sb.from("books").select("data").eq("user_id", user.id).maybeSingle();
    var book = (row.data && row.data.data) || { unit: 25, bets: [] };
    if (!Array.isArray(book.bets)) book.bets = [];
    var game = play.game || "";
    var pick = play.play || "";
    if (book.bets.some(function (r) { return r.game === game && r.play === pick; })) {
      clearPending();
      return true;
    }
    var units = 1;
    book.bets.unshift({
      id: uid(),
      week: String(play.week || ""),
      date: play.date || "",
      league: play.league || "CFB",
      game: game,
      play: pick,
      type: play.type || "Spread",
      odds: String(play.odds || "-110").replace("+", ""),
      book: "Fanatics",
      units: units,
      stake: +(Number(book.unit || 25) * units).toFixed(2),
      status: "PENDING",
      result: "",
      source: play.source || "Week board",
      nickname: "",
      frdPick: false,
      flyer: false
    });
    await sb.from("books").upsert({
      user_id: user.id,
      data: book,
      updated_at: new Date().toISOString()
    });
    clearPending();
    return true;
  }
  var busy = false;
  async function tick() {
    if (busy) return;
    var play = readPending();
    if (!play) return;
    busy = true;
    try {
      var ok = await save(play);
      if (ok) {
        var betsBtn = document.querySelector("[data-view=bets]");
        if (betsBtn) betsBtn.click();
        else location.hash = "bets";
        setTimeout(function () { location.reload(); }, 200);
      }
    } finally {
      busy = false;
    }
  }
  setTimeout(tick, 400);
  document.addEventListener("click", function () { setTimeout(tick, 300); });
})();
