(function () {
  const KEY = "frd_app_v1";
  const cfg = window.FRD_CONFIG || {};
  const cloud = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let sb = null, session = null, view = "dashboard", deskCard = { plays: [] }, betFilter = "all";
  const $ = (id) => document.getElementById(id);
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  function emptyBook() { return { unit: 25, bets: [], flyer: [] }; }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, session: null }; } catch { return { users: {}, session: null }; } }
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
  function recTxt(s) { return s.w + "–" + s.l + (s.p ? "–" + s.p : ""); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&","<":"<",">":">",'"':'"',"'":"&#39;" }[c])); }
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
    const email = $("email").value.trim().toLowerCase(); const pass = $("pass").value; const name = $("disp").value.trim();
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
      session = { email, name, book: db.users[email].book }; db.session = session; saveLocal(db);
    }
    showApp();
  }
  async function login() {
    const email = $("email").value.trim().toLowerCase(); const pass = $("pass").value;
    if (cloud) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) return alert(error.message);
      session = { id: data.user.id, email, name: (data.user.user_metadata || {}).name || "" };
    } else {
      const db = loadLocal(); const u = db.users[email];
      if (!u) return alert("No book for that email in this browser.");
      const hp = await hashPass(email, pass, Uint8Array.from(atob(u.salt), (c) => c.charCodeAt(0)));
      if (hp.hash !== u.hash) return alert("Wrong password.");
      session = { email, name: u.name, book: u.book }; db.session = session; saveLocal(db);
    }
    showApp();
  }
  function logout() { if (cloud && sb) sb.auth.signOut(); const db = loadLocal(); db.session = null; saveLocal(db); session = null; showGate(); }
  function rowForm(kind, existing) {
    const r = existing || { week: "", date: "", league: "NFL", game: "", play: "", type: "Spread", nickname: "", odds: "-110", book: "Fanatics", units: "1", status: "PENDING", result: "", source: kind === "flyer" ? "Flyer" : "", frdPick: !!existing && existing.frdPick };
    return `<div class="grid3"><div><label>Week</label><input id="f-week" value="${esc(r.week)}"></div><div><label>Date</label><input id="f-date" type="date" value="${esc(r.date)}"></div><div><label>League</label><select id="f-league"><option${r.league==="NFL"?" selected":""}>NFL</option><option${r.league==="CFB"?" selected":""}>CFB</option></select></div></div>
      <label>Game</label><input id="f-game" value="${esc(r.game)}">
      <label>Play</label><input id="f-play" value="${esc(r.play)}">
      <div class="grid3"><div><label>Type</label><select id="f-type">${["Spread","Total","Moneyline","Prop"].map(t=>`<option${r.type===t?" selected":""}>${t}</option>`).join("")}</select></div><div><label>Odds</label><input id="f-odds" value="${esc(r.odds)}"></div><div><label>Units</label><input id="f-units" value="${esc(r.units)}"></div></div>
      <div class="grid2"><div><label>Book</label><input id="f-book" value="${esc(r.book)}"></div><div><label>Source</label><input id="f-source" value="${esc(r.source)}"></div></div>
      ${kind==="flyer"?`<label>Nickname</label><input id="f-nick" value="${esc(r.nickname)}">`:""}
      <label class="check"><input id="f-frd" type="checkbox"${r.frdPick?" checked":""}> FRD Pick — this came off the desk card</label>
      <div class="grid2"><div><label>Status</label><select id="f-status">${["PENDING","W","L","P"].map(s=>`<option${r.status===s?" selected":""}>${s}</option>`).join("")}</select></div><div><label>Result</label><input id="f-result" value="${esc(r.result)}"></div></div>
      <div class="row" style="margin-top:14px"><button class="btn navy" type="button" id="save-row">${existing?"Save":"Add to book"}</button><button class="btn ghost" type="button" id="cancel-row">Cancel</button></div>`;
  }
  function readForm(kind, book) {
    const units = num($("f-units").value) || 1;
    const row = { id: uid(), week: $("f-week").value.trim(), date: $("f-date").value, league: $("f-league").value, game: $("f-game").value.trim(), play: $("f-play").value.trim(), type: $("f-type").value, odds: $("f-odds").value.trim(), book: $("f-book").value.trim(), units, stake: +(book.unit * units).toFixed(2), status: $("f-status").value, result: $("f-result").value.trim(), source: $("f-source").value.trim(), nickname: kind === "flyer" && $("f-nick") ? $("f-nick").value.trim() : "", frdPick: !!($("f-frd") && $("f-frd").checked) };
    if (!row.play) { alert("Play is required."); return null; }
    return row;
  }
  function table(rows, kind) {
    if (!rows.length) return `<p class="note">Empty book. Add a lean.</p>`;
    return `<div class="scroll"><table class="book"><tr><th>Wk</th><th>Game</th><th>Play</th><th>Odds</th><th>u</th><th>Status</th><th>u won</th><th></th></tr>${rows.map((r) => { const s = settle(r); const cls = r.status==="W"?"w":r.status==="L"?"l":r.status==="P"?"p":"pending"; return `<tr><td>${esc(r.week)} ${esc(r.league)}</td><td>${esc(r.game)}${r.nickname?`<div class="note">${esc(r.nickname)}</div>`:""}</td><td>${esc(r.play)}<div class="note">${esc(r.type)}${r.frdPick?' <span class="pill frd">FRD</span>':""}</div></td><td>${esc(r.odds)}</td><td>${esc(r.units)}</td><td class="${cls}">${esc(r.status)}</td><td>${unitsTxt(s.unitsWon)}</td><td><button class="btn ghost sm" data-edit="${kind}:${esc(r.id)}">Edit</button> <button class="btn danger sm" data-del="${kind}:${esc(r.id)}">Del</button></td></tr>`; }).join("")}</table></div>`;
  }
  function onBook(rows, play) { return rows.some((r) => r.game === play.game && r.play === play.play); }
  function renderDesk(book) {
    const meta = $("card-meta"), box = $("desk-card"); if (!meta || !box) return;
    meta.textContent = (deskCard.label || "This week") + (deskCard.updated ? " · " + deskCard.updated : "") + (deskCard.note ? " — " + deskCard.note : "");
    const plays = deskCard.plays || [];
    if (!plays.length) { box.innerHTML = `<p class="note">No published leans yet. After Dark Thursday, Packet Friday.</p>`; return; }
    box.innerHTML = plays.map((p) => {
      const board = (p.board || "LEAN").toUpperCase();
      const cls = board === "PASS" ? "pass" : board === "FLYER" ? "flyer" : "lean";
      const taken = onBook(p.tab === "flyer" ? book.flyer : book.bets, p);
      const btn = !p.addable ? `<span class="note">Not a ticket</span>` : taken ? `<span class="note">On your book</span>` : `<button class="btn sm" type="button" data-add-desk="${esc(p.id)}">Add to book</button>`;
      return `<div class="desk-play ${board==="PASS"?"pass":""}"><div><span class="pill ${cls}">${esc(board)}</span> <span class="tag">${esc(p.league)} · ${esc(p.source || "")}</span><div><strong>${esc(p.play)}</strong> ${p.odds?esc(p.odds):""}</div><div class="note">${esc(p.game)}${p.nickname?" · "+esc(p.nickname):""}${p.why?" — "+esc(p.why):""}</div></div><div>${btn}</div></div>`;
    }).join("");
  }
  async function addDeskPlay(id) {
    const play = (deskCard.plays || []).find((p) => p.id === id); if (!play || !play.addable) return;
    const book = await currentBook(); const tab = play.tab === "flyer" ? "flyer" : "bets"; if (onBook(book[tab], play)) return;
    const units = 1; const oddsRaw = String(play.odds || "").replace("+", "");
    book[tab].unshift({ id: uid(), week: play.week || "", date: play.date || "", league: play.league || "", game: play.game || "", play: play.play || "", type: play.type || "Spread", odds: oddsRaw, book: "FRD", units, stake: +(book.unit * units).toFixed(2), status: "PENDING", result: "", source: play.source || "Desk", nickname: play.nickname || "", frdPick: true, deskId: play.id });
    await writeBook(book); view = tab === "flyer" ? "flyer" : "bets"; render();
  }
  async function render() {
    const book = await currentBook();
    const all = stats(book.bets), frd = stats(book.bets.filter((r) => r.frdPick)), mine = stats(book.bets.filter((r) => !r.frdPick));
    $("who").textContent = session.name || session.email;
    $("mode").textContent = cloud ? "Cloud book" : "This-browser prototype";
    $("dash").classList.toggle("hidden", view !== "dashboard");
    $("bets").classList.toggle("hidden", view !== "bets");
    $("flyer").classList.toggle("hidden", view !== "flyer");
    $("settings").classList.toggle("hidden", view !== "settings");
    document.querySelectorAll("[data-view]").forEach((el) => el.classList.toggle("active", el.getAttribute("data-view") === view));
    if ($("s-rec")) $("s-rec").textContent = recTxt(all);
    if ($("s-pending")) $("s-pending").textContent = all.pending + " pending";
    if ($("s-frd")) $("s-frd").textContent = recTxt(frd);
    if ($("s-frd-u")) $("s-frd-u").textContent = unitsTxt(frd.units);
    if ($("s-mine")) $("s-mine").textContent = recTxt(mine);
    if ($("s-mine-u")) $("s-mine-u").textContent = unitsTxt(mine.units);
    if ($("s-u")) $("s-u").textContent = unitsTxt(all.units);
    if ($("s-p")) $("s-p").textContent = money(all.profit);
    if ($("unit-label")) $("unit-label").textContent = "$" + book.unit + " / 1u";
    const shown = book.bets.filter((r) => betFilter === "frd" ? r.frdPick : betFilter === "mine" ? !r.frdPick : true);
    if ($("bet-list")) $("bet-list").innerHTML = table(shown, "bets");
    if ($("flyer-list")) $("flyer-list").innerHTML = table(book.flyer, "flyer");
    if ($("unit-input")) $("unit-input").value = book.unit;
    if ($("form-wrap")) $("form-wrap").classList.add("hidden");
    if ($("flyer-form-wrap")) $("flyer-form-wrap").classList.add("hidden");
    renderDesk(book);
  }
  function showGate() { $("gate").classList.remove("hidden"); $("app").classList.add("hidden"); if ($("cloud-note")) $("cloud-note").textContent = cloud ? "Accounts sync on any phone once you log in." : "Prototype mode: your book stays in this browser until a free Supabase project is connected."; }
  function showApp() { $("gate").classList.add("hidden"); $("app").classList.remove("hidden"); view = "dashboard"; render(); }
  async function boot() {
    try { const res = await fetch("card.json", { cache: "no-store" }); if (res.ok) deskCard = await res.json(); } catch (e) { console.warn(e); }
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
    if (t.getAttribute("data-filter")) { betFilter = t.getAttribute("data-filter"); view = "bets"; render(); }
    if (t.getAttribute("data-add-desk")) addDeskPlay(t.getAttribute("data-add-desk"));
    if (t.id === "add-bet") { $("form-wrap").classList.remove("hidden"); $("form-wrap").innerHTML = rowForm("bets"); }
    if (t.id === "add-flyer") { $("flyer-form-wrap").classList.remove("hidden"); $("flyer-form-wrap").innerHTML = rowForm("flyer"); }
    if (t.id === "cancel-row") { $("form-wrap").classList.add("hidden"); $("flyer-form-wrap").classList.add("hidden"); }
    if (t.id === "save-unit") { const book = await currentBook(); book.unit = num($("unit-input").value) || 25; await writeBook(book); render(); }
    if (t.id === "save-row") {
      const useFlyer = !$("flyer-form-wrap").classList.contains("hidden");
      const book = await currentBook(); const row = readForm(useFlyer ? "flyer" : "bets", book); if (!row) return;
      if (window._edit) { const [k, rid] = window._edit.split(":"); const i = book[k].findIndex((x) => x.id === rid); if (i >= 0) { row.id = rid; book[k][i] = row; } window._edit = null; }
      else book[useFlyer ? "flyer" : "bets"].unshift(row);
      await writeBook(book); render();
    }
    const ed = t.getAttribute("data-edit");
    if (ed) { const [k, rid] = ed.split(":"); const book = await currentBook(); window._edit = ed; const wrap = k === "flyer" ? $("flyer-form-wrap") : $("form-wrap"); wrap.classList.remove("hidden"); wrap.innerHTML = rowForm(k, book[k].find((x) => x.id === rid)); }
    const del = t.getAttribute("data-del");
    if (del && confirm("Remove this row?")) { const [k, rid] = del.split(":"); const book = await currentBook(); book[k] = book[k].filter((x) => x.id !== rid); await writeBook(book); render(); }
  });
  boot();
})();
