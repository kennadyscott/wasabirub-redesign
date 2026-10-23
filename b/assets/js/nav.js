/* WasabiRub 2027 nav — mobile menu toggle (dropdown is pure CSS hover/focus). */
(function () {
  "use strict";
  function init() {
    var btn = document.querySelector(".mnav-btn");
    var m = document.getElementById("mnav");
    if (!btn || !m) return;
    var x = m.querySelector(".mnav-x");
    function open() { m.removeAttribute("hidden"); document.documentElement.classList.add("mnav-open"); btn.setAttribute("aria-expanded", "true"); }
    function close() { m.setAttribute("hidden", ""); document.documentElement.classList.remove("mnav-open"); btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function () { m.hasAttribute("hidden") ? open() : close(); });
    if (x) x.addEventListener("click", close);
    m.addEventListener("click", function (e) { if (e.target.tagName === "A") close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
