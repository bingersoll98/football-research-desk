(function () {
  var btn = document.querySelector(".menu-btn");
  var head = document.querySelector("header.top");
  if (!btn || !head) return;
  function setOpen(open) {
    head.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.textContent = open ? "\u00d7" : "\u2630";
  }
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!head.classList.contains("open"));
  });
  document.addEventListener("click", function (e) {
    if (!head.classList.contains("open")) return;
    if (head.contains(e.target)) return;
    setOpen(false);
  });
})();
