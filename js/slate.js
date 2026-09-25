(function () {
  function rank(n) { return n ? "#" + n + " " : ""; }
  function side(g, who) {
    var pts = Math.abs(Number(g.spread));
    if (who === g.spreadTeam) return { play: who + " -" + pts, type: "Spread" };
    return { play: who + " +" + pts, type: "Spread" };
  }
  function leans(g) { return Array.isArray(g.leans) ? g.leans : (g.lean ? [g.lean] : []); }
  function props(g) { return Array.isArray(g.props) ? g.props : []; }
  function isLean(g, kind, which) {
    return leans(g).some(function (L) {
      return L && L.kind === kind && String(L.side || "").toLowerCase() === which;
    });
  }
  function leanTag(g, kind, which) {
    if (!isLean(g, kind, which)) return "";
    return '<span class="frd-tag">FRD PICK</span>';
  }
  function attr(g) {
    return ' data-game="' + encodeURIComponent((g.away || "") + " @ " + (g.home || "")) + '"' +
      ' data-date="' + encodeURIComponent(g.date || "") + '"' +
      ' data-week="' + encodeURIComponent(String(window.FRD_SLATE && window.FRD_SLATE.week || "")) + '"' +
      ' data-league="' + encodeURIComponent((window.FRD_SLATE && window.FRD_SLATE.league) || "") + '"';
  }
  function ticketFromBtn(btn) {
    return {
      week: decodeURIComponent(btn.getAttribute("data-week") || ""),
      date: decodeURIComponent(btn.getAttribute("data-date") || ""),
      league: decodeURIComponent(btn.getAttribute("data-league") || ""),
      game: decodeURIComponent(btn.getAttribute("data-game") || ""),
      play: decodeURIComponent(btn.getAttribute("data-play") || ""),
      type: decodeURIComponent(btn.getAttribute("data-type") || "Spread"),
      odds: decodeURIComponent(btn.getAttribute("data-odds") || "-110"),
      source: decodeURIComponent(btn.getAttribute("data-source") || "Week board"),
      board: "LEAN",
      addable: true
    };
  }
  function add(play) {
    try { sessionStorage.setItem("FRD_PENDING_ADD", JSON.stringify(play)); } catch (e) {}
    location.href = "app/#bets";
  }
  function propRow(g, p) {
    var play = p.play || "";
    var odds = p.odds ? String(p.odds) : "";
    var type = p.type || "Player Prop";
    return '<button type="button" class="prop frd-lean"' + attr(g) +
      ' data-play="' + encodeURIComponent(play) +
      '" data-type="' + encodeURIComponent(type) +
      '" data-odds="' + encodeURIComponent(odds || "-110") +
      '" data-source="' + encodeURIComponent(p.source || "Packet Prop") + '">' +
      '<span class="frd-tag">FRD PICK</span>' +
      "<b>" + play + "</b>" +
      (odds ? "<em>" + odds + "</em>" : "") +
      "</button>";
  }
  function card(g, i) {
    var awayPlay = side(g, g.away);
    var homePlay = side(g, g.home);
    var marked = leans(g).length > 0 || props(g).length > 0;
    var a = attr(g);
    var propHtml = props(g).length
      ? '<div class="props"><p class="props-label">FRD props</p>' + props(g).map(function (p) { return propRow(g, p); }).join("") + "</div>"
      : "";
    return '<article class="game' + (marked ? " frd" : "") + '" data-gid="' + (g.id || ("g-" + i)) + '">' +
      '<div class="when">' + (g.kick || "") + (g.tv ? " · " + g.tv : "") + (g.note ? " · " + g.note : "") +
        (marked ? ' <span class="frd-tag">FRD</span>' : "") + "</div>" +
      '<div class="match">' +
        '<button type="button" class="side' + (isLean(g, "spread", "away") ? " frd-lean" : "") + '"' + a + ' data-play="' + encodeURIComponent(awayPlay.play) + '" data-type="Spread" data-odds="-110" data-source="Week board">' +
          rank(g.awayRank) + g.away + "<b>" + (g.spreadTeam === g.away ? g.spread : "+" + Math.abs(g.spread)) + "</b>" +
          leanTag(g, "spread", "away") + "</button>" +
        '<span class="at">@</span>' +
        '<button type="button" class="side' + (isLean(g, "spread", "home") ? " frd-lean" : "") + '"' + a + ' data-play="' + encodeURIComponent(homePlay.play) + '" data-type="Spread" data-odds="-110" data-source="Week board">' +
          rank(g.homeRank) + g.home + "<b>" + (g.spreadTeam === g.home ? g.spread : "+" + Math.abs(g.spread)) + "</b>" +
          leanTag(g, "spread", "home") + "</button>" +
      "</div>" +
      '<div class="totals">' +
        '<button type="button"' + (isLean(g, "total", "over") ? ' class="frd-lean"' : "") + a + ' data-play="' + encodeURIComponent("Over " + g.total) + '" data-type="Total" data-odds="-110" data-source="Week board">O ' + g.total + leanTag(g, "total", "over") + "</button>" +
        '<button type="button"' + (isLean(g, "total", "under") ? ' class="frd-lean"' : "") + a + ' data-play="' + encodeURIComponent("Under " + g.total) + '" data-type="Total" data-odds="-110" data-source="Week board">U ' + g.total + leanTag(g, "total", "under") + "</button>" +
      "</div>" + propHtml + "</article>";
  }
  async function boot() {
    var src = document.body.getAttribute("data-slate");
    var host = document.getElementById("slate");
    if (!src || !host) return;
    var data = await (await fetch(src, { cache: "no-store" })).json();
    window.FRD_SLATE = data;
    var title = document.getElementById("week-title");
    var meta = document.getElementById("week-meta");
    if (title) title.textContent = data.label || "This week";
    if (meta) meta.textContent = (data.updated || "") + (data.note ? " — " + data.note : "");
    document.title = (data.label || "Week") + " · Football Research Desk";
    var locked = !!data.locked;
    var notice = locked
      ? "Lines locked Friday 2:00 CT with the Packet. Gold FRD PICK tags are this week’s published leans. Confirm the number."
      : "Schedule is up. Spreads, totals, and FRD marks lock Friday 2:00 CT with the Packet. Until then this board is kick times only — not the card.";
    var games = data.games || [];
    host.innerHTML = '<p class="slate-note' + (locked ? " locked" : "") + '">' + notice + "</p>" + games.map(card).join("");
    host.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-play]");
      if (!btn) return;
      e.preventDefault();
      add(ticketFromBtn(btn));
    });
  }
  boot();
})();
