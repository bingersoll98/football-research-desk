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
  function ticket(g, play, type, odds, source) {
    return {
      week: String(window.FRD_SLATE && window.FRD_SLATE.week || ""),
      date: g.date || "",
      league: window.FRD_SLATE && window.FRD_SLATE.league || "",
      game: g.away + " @ " + g.home,
      play: play,
      type: type,
      odds: odds || "-110",
      source: source || "Week board",
      board: "LEAN",
      addable: true
    };
  }
  function add(play) {
    try { sessionStorage.setItem("FRD_PENDING_ADD", JSON.stringify(play)); } catch (e) {}
    location.href = "app/";
  }
  function propRow(p) {
    var play = p.play || "";
    var odds = p.odds ? String(p.odds) : "";
    var type = p.type || "Player Prop";
    return '<button type="button" class="prop frd-lean" data-play="' + encodeURIComponent(play) +
      '" data-type="' + encodeURIComponent(type) + '" data-odds="' + encodeURIComponent(odds || "-110") +
      '" data-source="' + encodeURIComponent(p.source || "Packet Prop") + '">' +
      '<span class="frd-tag">FRD PICK</span>' +
      "<b>" + play + "</b>" +
      (odds ? "<em>" + odds + "</em>" : "") +
      "</button>";
  }
  function card(g) {
    var awayPlay = side(g, g.away);
    var homePlay = side(g, g.home);
    var marked = leans(g).length > 0 || props(g).length > 0;
    var propHtml = props(g).length
      ? '<div class="props"><p class="props-label">FRD props</p>' + props(g).map(propRow).join("") + "</div>"
      : "";
    return '<article class="game' + (marked ? " frd" : "") + '">' +
      '<div class="when">' + (g.kick || "") + (g.tv ? " · " + g.tv : "") + (g.note ? " · " + g.note : "") +
        (marked ? ' <span class="frd-tag">FRD</span>' : "") + "</div>" +
      '<div class="match">' +
        '<button type="button" class="side' + (isLean(g, "spread", "away") ? " frd-lean" : "") + '" data-play="' + encodeURIComponent(awayPlay.play) + '" data-type="Spread">' +
          rank(g.awayRank) + g.away + "<b>" + (g.spreadTeam === g.away ? g.spread : "+" + Math.abs(g.spread)) + "</b>" +
          leanTag(g, "spread", "away") + "</button>" +
        '<span class="at">@</span>' +
        '<button type="button" class="side' + (isLean(g, "spread", "home") ? " frd-lean" : "") + '" data-play="' + encodeURIComponent(homePlay.play) + '" data-type="Spread">' +
          rank(g.homeRank) + g.home + "<b>" + (g.spreadTeam === g.home ? g.spread : "+" + Math.abs(g.spread)) + "</b>" +
          leanTag(g, "spread", "home") + "</button>" +
      "</div>" +
      '<div class="totals">' +
        '<button type="button" class="' + (isLean(g, "total", "over") ? "frd-lean" : "") + '" data-play="' + encodeURIComponent("Over " + g.total) + '" data-type="Total">O ' + g.total + leanTag(g, "total", "over") + "</button>" +
        '<button type="button" class="' + (isLean(g, "total", "under") ? "frd-lean" : "") + '" data-play="' + encodeURIComponent("Under " + g.total) + '" data-type="Total">U ' + g.total + leanTag(g, "total", "under") + "</button>" +
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
    host.innerHTML = '<p class="slate-note' + (locked ? " locked" : "") + '">' + notice + "</p>" + (data.games || []).map(card).join("");
    host.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-play]");
      if (!btn) return;
      var art = btn.closest(".game");
      var g = data.games[Array.prototype.indexOf.call(host.children, art)];
      if (!g) return;
      add(ticket(
        g,
        decodeURIComponent(btn.getAttribute("data-play")),
        decodeURIComponent(btn.getAttribute("data-type") || "Spread"),
        decodeURIComponent(btn.getAttribute("data-odds") || "-110"),
        decodeURIComponent(btn.getAttribute("data-source") || "Week board")
      ));
    });
  }
  boot();
})();
