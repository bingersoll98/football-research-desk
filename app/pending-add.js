(function () {
  function fromHash() {
    var h = location.hash || "";
    var i = h.indexOf("add=");
    if (i < 0) return null;
    try { return JSON.parse(decodeURIComponent(h.slice(i + 4))); } catch (e) { return null; }
  }
  function readPending() {
    var play = fromHash();
    if (play && play.play) return play;
    try {
      var raw = sessionStorage.getItem("FRD_PENDING_ADD") || localStorage.getItem("FRD_PENDING_ADD");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function clearPending() {
    try { sessionStorage.removeItem("FRD_PENDING_ADD"); } catch (e) {}
    try { localStorage.removeItem("FRD_PENDING_ADD"); } catch (e) {}
    if ((location.hash || "").indexOf("add=") >= 0) {
      try { history.replaceState(null, "", "#bets"); } catch (e) { location.hash = "bets"; }
    }
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
    var up = await sb.from("books").upsert({
      user_id: user.id,
      data: book,
      updated_at: new Date().toISOString()
    });
    if (up.error) return false;
    clearPending();
    return true;
  }
  var busy = false;
  var tries = 0;
  async function tick() {
    if (busy) return;
    var play = readPending();
    if (!play) return;
    busy = true;
    tries += 1;
    try {
      var ok = await save(play);
      if (ok) {
        location.hash = "bets";
        location.reload();
        return;
      }
    } finally {
      busy = false;
    }
    if (tries < 40) setTimeout(tick, 400);
  }
  setTimeout(tick, 500);
})();
