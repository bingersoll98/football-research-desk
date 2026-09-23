(function () {
  const KEY = "frd_app_v1";
  const cfg = window.FRD_CONFIG || {};
  const cloud = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let sb = null;
  let session = null;
  let view = "dashboard";
  const $ = (id) => document.getElementById(id);
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  function emptyBook() { return { unit: 25, bets: [], flyer: [] }; }
  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, session: null }; }
    catch { return { users: {}, session: null }; }
  }
  function saveLocal(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
  async function hashPass(email, pass, salt) {
    const enc = new TextEncoder();
    const useSalt = salt || crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", enc.encode(pass + email.toLowerCase()), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: 120000, salt: useSalt }, key, 256);
    return { salt: btoa(String.fromCharCode(...new Uint8Array(useSalt))), hash: btoa(String.fromCharCode(...new Uint8Array(bits))) };
  }
  function num(n) { const x = Number(n); return Number.isFinite(x) ? x : 0; }
  function settle(row) {
    const stake = num(row.stake), units = num(row.units), odds = num(row.odds), st = row.status || "PENDING";
    if (!st || st === "PENDING") return { payout: "", unitsWon: "", profit: "" };
    if (st === "P") return { payout: stake, unitsWon: 0, profit: 0 };
    if (st === "L") return { payout: 0, unitsWon: -units, profit: -stake };
    const payout = odds < 0 ? stake + stake * 100 / Math.abs(odds) : stake + stake * odds / 100;
    const unitsWon = odds < 0 ? units * 100 / Math.abs(odds) : units * odds / 100;
    return { payout, unitsWon, profit: payout - stake };
  }
  function stats(rows) {
    const graded = rows.filter((r) => r.status && r.status !== "PENDING");
    const w = graded.filter((r) => r.status === "W").length;
    const l = graded.filter((r) => r.status === "L").length;
    const p = graded.filter((r) => r.status === "P").length;
    let units = 0, profit = 0;
    graded.forEach((r) => { const s = settle(r); units += num(s.unitsWon); profit += num(s.profit); });
    return { n: rows.length, w, l, p, pending: rows.filter((r) => r.status === "PENDING").length, units, profit };
  }
  function money(n) { if (n === "" || n == null) return "—"; const x = num(n); return (x < 0 ? "-" : "") + "$" + Math.abs(x).toFixed(2); }
  function unitsTxt(n) { if (n === "" || n == null) return "—"; const x = num(n); return (x >= 0 ? "+" : "") + x.toFixed(2) + "u"; }
  async function currentBook() {
    if (!session) return emptyBook();
    if (!cloud) return session.book || emptyBook();
    const { data, error } = await sb.from("books").select("data").eq("user_id", session.id).maybeSingle();
    if (error) { console.warn(error); return emptyBook(); }
    return (data && data.data) || emptyBook();
  }
  async function writeBook(book) {
    if (!session) return;
    if (!cloud) {
      const db = loadLocal();
      if (db.users[session.email]) { db.users[session.email].book = book; session.book = book; db.session = session; saveLocal(db); }
      return;
    }
    await sb.from("books").upsert({ user_id: session.id, data: book, updated_at: new Date().toISOString() });
  }
  async function signup() {
    const email = $("email").value.trim().toLowerCase();
    const pass = $("pass").value;
    const name = $("disp").value.trim();
    if (!$("age").checked) return alert("21+ required.");
    if (!email || !pass || pass.length < 8) return alert("Email and a password of 8+ characters.");
    if (cloud) {
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { name } } });
      if (error) return alert(error.message);
      session = { id: data.user.id, email, name };
      await sb.from("books").upsert({ user_id: session.id, data: emptyBook() });
    } else {
      const db = loadLocal();
      if (db.users[email]) return alert("That email already has a book in this browser.");
      const hp = await hashPass(email, pass);
      db.users[email] = { email, name, salt: hp.salt, hash: hp.hash, book: emptyBook() };
      session = { email, name, book: db.users[email].book };
      db.session = session; saveLocal(db);
    }
    showApp();
  }
  async function login() {
    const email = $("email").value.trim().toLowerCase();
    const pass = $("pass").value;
    if (cloud) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) return alert(error.message);
      session = { id: data.user.id, email, name: (data.user.user_metadata || {}).name || "" };
    } else {
      const db = loadLocal();
      const u = db.users[email];
      if (!u) return alert("No book for that email in this browser.");
      const hp = await hashPass(email, pass, Uint8Array.from(atob(u.salt), (c) => c.charCodeAt(0)));
      if (hp.hash !== u.hash) return alert("Wrong password.");
      session = { email, name: u.name, book: u.book }; db.session = session; saveLocal(db);
    }
    showApp();
  }
  function logout() {
    if (cloud && sb) sb.auth.signOut();
    const db = loadLocal(); db.session = null; saveLocal(db); session = null; showGate();
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&","<":"<",">":">",'"':'"',"'":"&#39;" }[c])); }
  function rowForm(kind, existing) {
    const r = existing || { week: "", date: "", league: "NFL", game: "", play: "", type: "Spread", nickname: "", odds: "-110", book: "Fanatics", units: "1", status: "PENDING", result: "", source: kind === "flyer" ? "Flyer" : "" };
    return `<div class="grid3"><div><label>Week</label><input id="f-week" value="${esc(r.week)}"></div><div><label>Date</label><input id="f-date" type="date" value="${esc(r.date)}"></div><div><label>League</label><select id="f-league"><option${r.league==="NFL"?" selected":""}>NFL</option><option${r.league==="CFB"?" selected":""}>CFB</option></select></div></div>
      <label>Game</label><input id="f-game" value="${esc(r.game)}" placeholder="Away @ Home">
      <label>Play</label><input id="f-play" value="${esc(r.play)}" placeholder="Team +3.5">
      <div class="grid3"><div><label>Type</label><select id="f-type">${["Spread","Total","Moneyline","Prop"].map(t=>`<option${r.type===t?" selected":""}>${t}</option>`).join("")}</select></div><div><label>Odds</label><input id="f-odds" value="${esc(r.odds)}"></div><div><label>Units</label><input id="f-units" value="${esc(r.units)}"></div></div>
      <div class="grid2"><div><label>Book</label><input id="f-book" value="${esc(r.book)}"></div><div><label>Source</label><input id="f-source" value="${esc(r.source)}"></div></div>
      ${kind==="flyer"?`<label>Nickname</label><input id="f-nick" value="${esc(r.nickname)}">`:""}
      <div class="grid2"><div><label>Status</label><select id="f-status">${["PENDING","W","L","P"].map(s=>`<option${r.status===s?" selected":""}>${s}</option>`).join("")}</select></div><div><label>Result score</label><input id="f-result" value="${esc(r.result)}"></div></div>
      <div class="row" style="margin-top:14px"><button class="btn navy" type="button" id="save-row">${existing?"Save":"Add to book"}</button><button class="btn ghost" type="button" id="cancel-row">Cancel</button></div>`;
  }
  function readForm(kind, book) {
    const units = num($("f-units").value) || 1;
    const row = { id: uid(), week: $("f-week").value.trim(), date: $("f-date").value, league: $("f-league").value, game: $("f-game").value.trim(), play: $("f-play").value.trim(), type: $("f-type").value, odds: $("f-odds").value.trim(), book: $("f-book").value.trim(), units, stake: +(book.unit * units).toFixed(2), status: $("f-status").value, result: $("f-result").value.trim(), source: $("f-source").value.trim(), nickname: kind === "flyer" && $("f-nick") ? $("f-nick").value.trim() : "" };
    if (!row.play) { alert("Play is required."); return null; }
    return row;
  }
  function table(rows, kind) {
    if (!rows.length) return `<p class="note">Empty book. Add a lean.</p>`;
    return `<div class="scroll"><table class="book"><tr><th>Wk</th><th>Game</th><th>Play</th><th>Odds</th><th>u</th><th>Status</th><th>u won</th><th></th></tr>${rows.map((r,i)=>{ const s = settle(r); const cls = r.status==="W"?"w":r.status==="L"?"l":r.status==="P"?"p":"pending"; return `<tr><td>${esc(r.week)} ${esc(r.league)}</td><td>${esc(r.game)}${r.nickname?`<div class="note">${esc(r.nickname)}</div>`:""}</td><td>${esc(r.play)}<div class="note">${esc(r.type)}</div></td><td>${esc(r.odds)}</td><td>${esc(r.units)}</td><td class="${cls}">${esc(r.status)}</td><td>${unitsTxt(s.unitsWon)}</td><td><button class="btn ghost sm" data-edit="${kind}:${i}">Edit</button> <button class="btn danger sm" data-del="${kind}:${i}">Del</button></td></tr>`; }).join("")}</table></div>`;
  }
  async function render() {
    const book = await currentBook(); const b = stats(book.bets);
    $("who").textContent = session.name || session.email;
    $("mode").textContent = cloud ? "Cloud book" : "This-browser prototype";
    $("dash").classList.toggle("hidden", view !== "dashboard");
    $("bets").classList.toggle("hidden", view !== "bets");
    $("flyer").classList.toggle("hidden", view !== "flyer");
    $("settings").classList.toggle("hidden", view !== "settings");
    document.querySelectorAll("[data-view]").forEach((el) => el.classList.toggle("active", el.getAttribute("data-view") === view));
    $("s-n").textContent = b.n; $("s-rec").textContent = b.w + "–" + b.l + (b.p ? "–" + b.p : "");
    $("s-u").textContent = unitsTxt(b.units); $("s-p").textContent = money(b.profit);
    $("s-pending").textContent = b.pending + " pending"; $("unit-label").textContent = "$" + book.unit + " / 1u";
    $("bet-list").innerHTML = table(book.bets, "bets"); $("flyer-list").innerHTML = table(book.flyer, "flyer");
    $("unit-input").value = book.unit; $("form-wrap").classList.add("hidden"); $("flyer-form-wrap").classList.add("hidden");
  }
  function showGate() { $("gate").classList.remove("hidden"); $("app").classList.add("hidden"); $("cloud-note").textContent = cloud ? "Accounts sync on any phone once you log in." : "Prototype mode: your book stays in this browser until a free Supabase project is connected."; }
  function showApp() { $("gate").classList.add("hidden"); $("app").classList.remove("hidden"); view = "dashboard"; render(); }
  async function boot() {
    if (cloud && window.supabase) {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data } = await sb.auth.getSession();
      if (data.session) { session = { id: data.session.user.id, email: data.session.user.email, name: (data.session.user.user_metadata || {}).name || "" }; showApp(); return; }
    } else {
      const db = loadLocal();
      if (db.session && db.session.email && db.users[db.session.email]) { session = db.session; session.book = db.users[db.session.email].book; showApp(); return; }
    }
    showGate();
  }
  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.classList.contains("menu-btn")) { document.querySelector("header.top").classList.toggle("open"); t.textContent = document.querySelector("header.top").classList.contains("open") ? "×" : "☰"; }
    if (t.id === "go-signup") signup();
    if (t.id === "go-login") login();
    if (t.id === "logout") logout();
    if (t.getAttribute("data-view")) { view = t.getAttribute("data-view"); render(); }
    if (t.id === "add-bet") { $("form-wrap").classList.remove("hidden"); $("form-wrap").innerHTML = rowForm("bets"); }
    if (t.id === "add-flyer") { $("flyer-form-wrap").classList.remove("hidden"); $("flyer-form-wrap").innerHTML = rowForm("flyer"); }
    if (t.id === "cancel-row") { $("form-wrap").classList.add("hidden"); $("flyer-form-wrap").classList.add("hidden"); }
    if (t.id === "save-unit") { const book = await currentBook(); book.unit = num($("unit-input").value) || 25; await writeBook(book); render(); }
    if (t.id === "save-row") {
      const useFlyer = !$("flyer-form-wrap").classList.contains("hidden");
      const book = await currentBook(); const row = readForm(useFlyer ? "flyer" : "bets", book); if (!row) return;
      if (window._edit) { const [k, i] = window._edit.split(":"); row.id = book[k][Number(i)].id; book[k][Number(i)] = row; window._edit = null; }
      else { book[useFlyer ? "flyer" : "bets"].unshift(row); }
      await writeBook(book); render();
    }
    const ed = t.getAttribute("data-edit");
    if (ed) { const [k, i] = ed.split(":"); const book = await currentBook(); window._edit = ed; const wrap = k === "flyer" ? $("flyer-form-wrap") : $("form-wrap"); wrap.classList.remove("hidden"); wrap.innerHTML = rowForm(k, book[k][Number(i)]); }
    const del = t.getAttribute("data-del");
    if (del && confirm("Remove this row?")) { const [k, i] = del.split(":"); const book = await currentBook(); book[k].splice(Number(i), 1); await writeBook(book); render(); }
  });
  boot();
})();
