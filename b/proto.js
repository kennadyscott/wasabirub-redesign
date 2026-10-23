/* Hero-only prototype controller for the WasabiRub 2027 concept.
 * Switch the homepage hero style + photo live; persists across pages.
 * Hide with ?proto=off, show with ?proto. */
(function () {
  "use strict";
  var KEY = "wrhero";
  var DEF = { hero: "split", photo: "cycle", collapsed: false, hidden: false };
  function load() { var s = {}; try { s = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {} var o = {}; for (var k in DEF) o[k] = (k in s) ? s[k] : DEF[k]; return o; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  var s = load();
  var q = new URLSearchParams(location.search);
  if (q.has("proto")) { s.hidden = (q.get("proto") === "off"); save(s); }

  var PHOTO = { finish: "assets/life-finish.jpg", cycle: "assets/life-cycle.jpg", team: "assets/life-team.jpg", climb: "assets/life-climb.jpg", stretch: "assets/life-stretch.jpg" };
  function apply() {
    document.documentElement.dataset.hero = s.hero;
    var bg = document.getElementById("hero-bg");
    if (bg && PHOTO[s.photo]) bg.src = PHOTO[s.photo];
  }
  apply();

  function seg(label, key, opts, after) {
    var g = document.createElement("div"); g.className = "proto-grp";
    var l = document.createElement("label"); l.textContent = label; g.appendChild(l);
    var row = document.createElement("div"); row.className = "proto-seg";
    opts.forEach(function (o) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = o[1];
      if (s[key] === o[0]) b.className = "on";
      b.addEventListener("click", function () {
        s[key] = o[0]; save(s); apply();
        [].forEach.call(row.children, function (c) { c.classList.remove("on"); }); b.classList.add("on");
        if (after) after();
      });
      row.appendChild(b);
    });
    g.appendChild(row); return g;
  }
  function thumbs(label, key, opts) {
    var g = document.createElement("div"); g.className = "proto-grp";
    var l = document.createElement("label"); l.textContent = label; g.appendChild(l);
    var row = document.createElement("div"); row.className = "proto-thumbs";
    opts.forEach(function (o) {
      var b = document.createElement("button"); b.type = "button"; b.title = o[1];
      var im = document.createElement("img"); im.src = o[2]; im.alt = o[1]; b.appendChild(im);
      if (s[key] === o[0]) b.className = "on";
      b.addEventListener("click", function () {
        s[key] = o[0]; save(s); apply();
        [].forEach.call(row.children, function (c) { c.classList.remove("on"); }); b.classList.add("on");
      });
      row.appendChild(b);
    });
    g.appendChild(row); return g;
  }

  function build() {
    if (document.querySelector(".proto")) return;
    if (!document.getElementById("hero-bg")) return; // hero controls only on the homepage
    var p = document.createElement("div");
    p.className = "proto" + (s.collapsed ? " collapsed" : "");
    if (s.hidden) p.hidden = true;
    var head = document.createElement("div"); head.className = "proto-head";
    var b = document.createElement("b"); b.textContent = "HERO";
    var min = document.createElement("button"); min.className = "proto-min"; min.type = "button";
    min.setAttribute("aria-label", "Collapse"); min.textContent = s.collapsed ? "+" : "−";
    min.addEventListener("click", function () { p.classList.toggle("collapsed"); s.collapsed = p.classList.contains("collapsed"); save(s); min.textContent = s.collapsed ? "+" : "−"; });
    head.appendChild(b); head.appendChild(min); p.appendChild(head);

    var body = document.createElement("div"); body.className = "proto-body";
    body.appendChild(seg("Hero style", "hero", [["product", "A · Product"], ["lifestyle", "B · Lifestyle"], ["split", "C · Split"], ["onphoto", "D · Product + photo"]]));
    body.appendChild(thumbs("Hero photo (B/C/D)", "photo", [
      ["finish", "Finish line", "assets/life-finish.jpg"],
      ["cycle", "Cyclists", "assets/life-cycle.jpg"],
      ["team", "Team", "assets/life-team.jpg"],
      ["climb", "Climbing", "assets/life-climb.jpg"],
      ["stretch", "Stretch", "assets/life-stretch.jpg"]
    ]));
    var note = document.createElement("p"); note.className = "proto-note";
    note.innerHTML = "Hero options only. The photo applies to the Lifestyle / Split / Product+photo styles. <code>?proto=off</code> hides this.";
    body.appendChild(note);
    p.appendChild(body);
    document.body.appendChild(p);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
