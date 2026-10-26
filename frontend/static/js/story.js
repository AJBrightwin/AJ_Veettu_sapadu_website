/* AJ வீட்டு சாப்பாடு — Our Story page
   · four scroll chapters: the picture and the text change as you scroll
   · "kitchen to your door": a gold route draws and the scooter glides along it
     (eased toward the scroll position every frame, GPU-only transforms) */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var sc = document.querySelector("[data-sc]");
  var jr = document.querySelector("[data-jr]");
  if (!sc && !jr) return;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function headerH() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64; }

  /* ================= chapters ================= */
  var scenes = sc ? Array.prototype.slice.call(sc.querySelectorAll(".scn")) : [];
  var chapters = sc ? Array.prototype.slice.call(sc.querySelectorAll("[data-ch]")) : [];
  var dots = sc ? Array.prototype.slice.call(sc.querySelectorAll("[data-sc-dot]")) : [];
  var last = -1;
  function setChapter(i) {
    if (i === last) return;
    last = i;
    scenes.forEach(function (s, k) { s.classList.toggle("is-active", k === i); });
    chapters.forEach(function (c, k) { c.classList.toggle("is-active", k === i); c.classList.toggle("is-past", k < i); });
    dots.forEach(function (d, k) { d.classList.toggle("is-on", k <= i); });
  }
  function paintChapters() {
    if (!sc) return;
    var r = sc.getBoundingClientRect(), hh = headerH(), stick = window.innerHeight - hh;
    var p = clamp((hh - r.top) / Math.max(r.height - stick, 1), 0, 1);
    sc.style.setProperty("--p", p.toFixed(4));
    setChapter(Math.min(chapters.length - 1, Math.floor(p * chapters.length * 0.999)));
  }

  /* ================= kitchen → door route ================= */
  var steps = jr ? Array.prototype.slice.call(jr.querySelectorAll("[data-jr-step]")) : [];
  var route = jr ? jr.querySelector(".jr-route") : null;
  var track = jr ? jr.querySelector(".jr-track") : null;
  var fill = jr ? jr.querySelector("[data-jr-fill]") : null;
  var head = jr ? jr.querySelector("[data-jr-head]") : null;
  var bike = jr ? jr.querySelector("[data-jr-bike]") : null;
  var lean = bike ? bike.querySelector(".jb-lean") : null;
  var spokes = bike ? Array.prototype.slice.call(bike.querySelectorAll("[data-jb-spokes]")) : [];
  var len = 1, vertical = false, wheelPx = 9;          // track length, direction, wheel radius on screen
  var target = 0, cur = 0, vel = 0, angle = 0, running = false, lastT = 0, dir = 1;
  var lit = steps.map(function () { return false; });

  // the gold route runs exactly from the first stop's icon to the last one
  function fitTrack() {
    if (!track || steps.length < 2) return;
    var base = route.getBoundingClientRect();
    var a = steps[0].querySelector(".jr-ic").getBoundingClientRect();
    var b = steps[steps.length - 1].querySelector(".jr-ic").getBoundingClientRect();
    vertical = Math.abs(b.top - a.top) > Math.abs(b.left - a.left);
    if (vertical) {
      len = b.top - a.top;
      track.style.cssText = "left:" + (a.left + a.width / 2 - base.left - 1.5) + "px;right:auto;top:" + (a.top + a.height / 2 - base.top) + "px;height:" + len + "px;bottom:auto;width:3px";
    } else {
      len = b.left - a.left;
      track.style.cssText = "top:" + (a.top + a.height / 2 - base.top - 1.5) + "px;left:" + (a.left + a.width / 2 - base.left) + "px;width:" + len + "px;right:auto;height:3px";
    }
    if (bike) wheelPx = 8.5 * (bike.getBoundingClientRect().width / 96 || 1);
    apply();
  }

  function targetFromScroll() {
    if (!route) return 0;
    var vh = window.innerHeight, rr = route.getBoundingClientRect();
    // starts when the route enters the lower part of the screen, arrives by the time it reaches the middle
    return clamp((vh * 0.85 - rr.top) / (rr.height + vh * 0.25), 0, 1);
  }

  function apply() {
    if (!track) return;
    var d = cur * len;
    if (fill) fill.style.transform = vertical ? "scaleY(" + cur.toFixed(5) + ")" : "scaleX(" + cur.toFixed(5) + ")";
    var tr = vertical ? "translate3d(0," + d.toFixed(2) + "px,0)" : "translate3d(" + d.toFixed(2) + "px,0,0)";
    if (head) { head.style.transform = tr; head.style.opacity = cur > 0.002 && cur < 0.998 ? "1" : "0"; }
    // the scooter starts just after the first stop and parks just before the last one
    var pad = vertical ? 78 : 92, bd = pad + cur * Math.max(len - pad * 2, 0);
    if (bike) bike.style.transform = vertical ? "translate3d(0," + bd.toFixed(2) + "px,0)" : "translate3d(" + bd.toFixed(2) + "px,0,0)";
    // stops light up as the scooter reaches them (with a one-time ripple)
    steps.forEach(function (s, k) {
      var on = cur >= (k / (steps.length - 1)) - 0.012;
      if (on !== lit[k]) {
        lit[k] = on;
        s.classList.toggle("is-on", on);
        if (on && !reduceMotion) { s.classList.remove("is-pop"); void s.offsetWidth; s.classList.add("is-pop"); }
      }
    });
  }

  function frame(t) {
    var dt = lastT ? Math.min(t - lastT, 64) : 16.7;
    lastT = t;
    var k = 1 - Math.pow(1 - 0.085, dt / 16.7);           // frame-rate independent glide
    var before = cur;
    cur += (target - cur) * k;
    if (Math.abs(target - cur) < 0.0002) cur = target;
    var dx = (cur - before) * Math.max(len - (vertical ? 156 : 184), 1);   // px the scooter moved this frame
    vel += ((dx / dt) * 16.7 - vel) * 0.18;                 // smoothed speed (px per 60fps frame)
    if (Math.abs(vel) < 0.01) vel = 0;
    var gap = (target - cur) * len;                         // face the way it is heading
    if (gap > 3) dir = 1; else if (gap < -3) dir = -1;

    angle += (Math.abs(dx) / wheelPx) * 57.2958;            // wheels roll with the distance travelled (the flip handles direction)
    spokes.forEach(function (g) { g.style.transform = "rotate(" + angle.toFixed(1) + "deg)"; });
    var spd = clamp(Math.abs(vel) / 7, 0, 1);
    if (bike) {
      bike.style.setProperty("--spd", spd.toFixed(3));
      bike.classList.toggle("is-moving", spd > 0.06);
      bike.classList.toggle("is-back", dir < 0 && !vertical);
      bike.classList.toggle("is-up", dir < 0 && vertical);
    }
    if (lean) {
      var l = vertical ? 0 : clamp(Math.abs(vel) * 0.8, 0, 6); // lean forward into the motion, settle when it stops
      lean.style.transform = "rotate(" + l.toFixed(2) + "deg)";
    }
    apply();
    if (cur !== target || Math.abs(vel) > 0.01) requestAnimationFrame(frame);
    else { running = false; lastT = 0; if (bike) bike.classList.remove("is-moving"); }
  }

  function kickRoute() {
    if (!jr) return;
    target = targetFromScroll();
    if (reduceMotion) { cur = target; apply(); return; }
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  /* ================= wiring ================= */
  var raf = 0;
  function onScroll() {
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; paintChapters(); kickRoute(); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { fitTrack(); onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTrack);

  // pause the looping animations of any section that is off-screen
  if ("IntersectionObserver" in window) {
    var offIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle("is-offscreen", !en.isIntersecting); });
    }, { rootMargin: "80px 0px" });
    document.querySelectorAll(".sh, .sc, .pr, .jr").forEach(function (el) { offIO.observe(el); });
  }

  setChapter(0);
  fitTrack();
  cur = target = targetFromScroll();   // start where the page already is (no fly-in on reload)
  apply();
  paintChapters();
})();
