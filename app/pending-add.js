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
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function formHtml(p) {
    var league = p.league || "CFB";
    var type = p.type || "Spread";
    function opt(list, cur) {
      return list.map(function (t) {
        return "<option" + (t === cur ? " selected" : "") + ">" + t + "</option>";
      }).join("");
    }
    return '<div class="grid3"><div><label>Week</label><input id="f-week" value="' + esc(p.week || "") + '"></div><div><label>Date</label><input id="f-date" type="date" value="' + esc(p.date || "") + '"></div><div><label>League</label><select id="f-league">' + opt(["NFL", "CFB"], league) + '</select></div></div>' +
      '<label>Game</label><input id="f-game" value="' + esc(p.game || "") + '"><label>Play</label><input id="f-play" value="' + esc(p.play || "") + '">' +
      '<div class="grid3"><div><label>Type</label><select id="f-type">' + opt(["Spread", "Total", "Moneyline", "Prop"], type) + '</select></div><div><label>Odds</label><input id="f-odds" value="' + esc(p.odds || "-110") + '"></div><div><label>Units</label><input id="f-units" value="1"></div></div>' +
      '<div class="grid2"><div><label>Book</label><input id="f-book" value="Fanatics"></div><div><label>Source</label><input id="f-source" value="' + esc(p.source || "Week board") + '"></div></div>' +
      '<label>Nickname</label><input id="f-nick" value="">' +
      '<label class="check"><input id="f-frd" type="checkbox"> FRD Pick</label>' +
      '<label class="check"><input id="f-flyer" type="checkbox"> Flyer</label>' +
      '<div class="grid2"><div><label>Status</label><select id="f-status"><option selected>PENDING</option><option>W</option><option>L</option><option>P</option></select></div><div><label>Result</label><input id="f-result" value=""></div></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn navy" type="button" id="save-row">Add to book</button><button class="btn ghost" type="button" id="cancel-row">Cancel</button></div>';
  }
  function fill(play) {
    var app = document.getElementById("app");
    var wrap = document.getElementById("form-wrap");
    if (!app || app.classList.contains("hidden") || !wrap || !play || !play.play) return false;
    var betsBtn = document.querySelector("[data-view=bets]");
    if (betsBtn) betsBtn.click();
    wrap.classList.remove("hidden");
    wrap.innerHTML = formHtml(play);
    clearPending();
    return true;
  }
  function tick() {
    var play = readPending();
    if (!play) return;
    if (fill(play)) return;
    setTimeout(tick, 250);
  }
  setTimeout(tick, 300);
  document.addEventListener("click", function () { setTimeout(tick, 200); });
})();
