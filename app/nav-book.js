(function () {
  var box = document.getElementById("nav-toggle");
  var head = document.querySelector("header.top");
  var app = document.getElementById("app");
  function syncBook() {
    var inApp = !!(app && !app.classList.contains("hidden"));
    document.querySelectorAll(".book-only").forEach(function (el) {
      el.classList.toggle("hidden", !inApp);
    });
  }
  function closeMenu() {
    if (box) box.checked = false;
    if (head) head.classList.remove("open");
  }
  if (box && head) {
    box.addEventListener("change", function () {
      head.classList.toggle("open", box.checked);
    });
  }
  document.querySelectorAll("#site-nav a, #site-nav button").forEach(function (el) {
    el.addEventListener("click", function () { setTimeout(closeMenu, 0); });
  });
  if (app && window.MutationObserver) {
    new MutationObserver(syncBook).observe(app, { attributes: true, attributeFilter: ["class"] });
  }
  document.addEventListener("click", function () { setTimeout(syncBook, 0); });
  syncBook();
})();
