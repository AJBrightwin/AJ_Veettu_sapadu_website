/* AJ Veettu Saapadu — home page animations
   headline words · luxury logo (tilt + glare + scroll drift)
   counters · parallax · ticker skew · scrolling big words */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hero = document.querySelector("[data-hero]");
  if (!hero) return;
  var introDelay = document.documentElement.classList.contains("show-intro") ? 2000 : 0;

  /* ---------- headline: wrap each word so it can slide up ---------- */
  var wi = 0;
  hero.querySelectorAll("[data-split]").forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach(function (word, i) {
      var outer = document.createElement("span");
      outer.className = "w";
      var inner = document.createElement("span");
      inner.textContent = word;
      inner.style.setProperty("--wi", wi++);
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });

  var start = function () {
    setTimeout(function () {
      requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add("is-ready"); }); });
    }, introDelay);
  };
  if (document.fonts && document.fonts.ready) {
    var started = false;
    var go = function () { if (!started) { started = true; start(); } };
    document.fonts.ready.then(go);
    setTimeout(go, 700);
  } else {
    start();
  }

  /* ---------- luxury logo: gentle 3D tilt + glare (mouse only) ---------- */
  var lux = hero.querySelector("[data-lux]");
  var luxTilt = hero.querySelector("[data-lux-tilt]");
  var luxLogo = hero.querySelector("[data-lux-logo]");
  if (lux && luxTilt && finePointer && !reduceMotion) {
    lux.addEventListener("mousemove", function (e) {
      var r = lux.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width * 2 - 1;
      var ny = (e.clientY - r.top) / r.height * 2 - 1;
      luxTilt.style.setProperty("--rx", (ny * -6).toFixed(2) + "deg");
      luxTilt.style.setProperty("--ry", (nx * 7).toFixed(2) + "deg");
      if (luxLogo) {
        luxLogo.style.setProperty("--gx", ((nx + 1) * 50).toFixed(1) + "%");
        luxLogo.style.setProperty("--gy", ((ny + 1) * 50).toFixed(1) + "%");
      }
    });
    lux.addEventListener("mouseleave", function () {
      luxTilt.style.setProperty("--rx", "0deg");
      luxTilt.style.setProperty("--ry", "0deg");
    });
  }

  /* ---------- background float items follow the mouse ---------- */
  if (finePointer && !reduceMotion) {
    var floaters = hero.querySelectorAll("[data-depth]");
    var raf = null, mx = 0, my = 0;
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width * 2 - 1;
      my = (e.clientY - r.top) / r.height * 2 - 1;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = null;
        floaters.forEach(function (f) {
          var d = parseFloat(f.getAttribute("data-depth")) || 10;
          f.style.translate = (mx * d).toFixed(1) + "px " + (my * d).toFixed(1) + "px";
        });
      });
    });
  }

  /* ---------- counters ---------- */
  var runCounter = function (el) {
    var end = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (reduceMotion || end === 0) { el.textContent = end; return; }
    var t0 = null, dur = 1700;
    var step = function (ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { runCounter(en.target); cio.unobserve(en.target); } });
    }, { threshold: 0.6 });
    document.querySelectorAll("[data-count]").forEach(function (el) { cio.observe(el); });
  }

  /* ---------- coin medallion: gentle tilt + glare toward the mouse ---------- */
  var seal = document.querySelector("[data-seal]");
  var sealTilt = document.querySelector("[data-seal-tilt]");
  if (seal && sealTilt && finePointer && !reduceMotion) {
    var teaser = seal.closest(".story-teaser") || seal;
    teaser.addEventListener("mousemove", function (e) {
      var r = seal.getBoundingClientRect();
      var nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 2)));
      var ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 2)));
      sealTilt.style.setProperty("--ry", (nx * 22).toFixed(2) + "deg");
      sealTilt.style.setProperty("--rx", (ny * -18).toFixed(2) + "deg");
      seal.style.setProperty("--gx", ((nx + 1) * 50).toFixed(1) + "%");
      seal.style.setProperty("--gy", ((ny + 1) * 50).toFixed(1) + "%");
    });
    teaser.addEventListener("mouseleave", function () {
      sealTilt.style.setProperty("--rx", "0deg");
      sealTilt.style.setProperty("--ry", "0deg");
    });
  }

  /* =====================================================================
     ONE SMOOTH LOOP for every scroll-linked effect.
     smoothY glides toward the real scroll position (inertia), so the logo
     drift, parallax, tape lean and banyan tree all move without jumps.
     ===================================================================== */
  var bt = document.querySelector("[data-bt]");
  var luxScroll = hero.querySelector("[data-lux-scroll]");
  var parallax = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var ticker = document.querySelector("[data-ticker]");

  /* ----- banyan parts ----- */
  var parts = [], chapters = [], dots = [], bar = null, lastCh = -1;
  if (bt) {
    bt.querySelectorAll("[data-a]").forEach(function (el) {
      var kind = el.tagName.toLowerCase() === "path" ? "draw"
        : el.classList.contains("bt-leaves") ? "grow"
        : el.classList.contains("bt-fig") ? "pop"
        : el.classList.contains("bt-dish") ? "hang"
        : el.classList.contains("bt-shade") ? "shade"
        : "fade";
      parts.push({ el: el, a: parseFloat(el.getAttribute("data-a")), b: parseFloat(el.getAttribute("data-b")), kind: kind, last: -1 });
    });
    chapters = Array.prototype.slice.call(bt.querySelectorAll(".bt-ch"));
    dots = Array.prototype.slice.call(bt.querySelectorAll(".bt-dots b"));
    bar = bt.querySelector("[data-bt-bar]");
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return t * t * (3 - 2 * t); }                  // smoothstep
  function easeOutBack(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

  function paintTree(p) {
    for (var i = 0; i < parts.length; i++) {
      var o = parts[i];
      var t = clamp01((p - o.a) / (o.b - o.a));
      if (Math.abs(t - o.last) < 0.001) continue;
      o.last = t;
      var e = ease(t), st = o.el.style;
      if (o.kind === "draw") {
        st.strokeDashoffset = (1 - e).toFixed(4);
      } else if (o.kind === "grow") {
        st.opacity = Math.min(1, e * 1.6).toFixed(3);
        st.scale = (t > 0 ? easeOutBack(e) : 0).toFixed(3);
      } else if (o.kind === "pop") {
        st.opacity = e.toFixed(3);
        st.scale = (t > 0 ? easeOutBack(e) : 0).toFixed(3);
      } else if (o.kind === "hang") {
        st.opacity = e.toFixed(3);
        st.translate = "0 " + ((1 - e) * -26).toFixed(1) + "px";
      } else if (o.kind === "shade") {
        st.opacity = (e * 0.14).toFixed(3);
        st.scale = (0.6 + e * 0.4).toFixed(3);
      } else {
        st.opacity = e.toFixed(3);
      }
    }
    var ch = p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.74 ? 2 : 3;
    if (ch !== lastCh) {
      lastCh = ch;
      chapters.forEach(function (c, k) { c.classList.toggle("is-active", k === ch); });
      dots.forEach(function (d, k) { d.classList.toggle("is-on", k <= ch); });
    }
    if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    bt.classList.toggle("is-complete", p > 0.97);
  }

  if (reduceMotion) {           // show everything finished, no motion
    if (bt) { parts.forEach(function (o) { o.last = -1; }); paintTree(1); chapters.forEach(function (c) { c.classList.add("is-active"); }); }
    return;
  }

  var smoothY = window.scrollY, skew = 0, running = false, lastT = 0;
  function headerH() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64; }

  function frame(t) {
    var dt = lastT ? Math.min(t - lastT, 64) : 16.7;
    lastT = t;
    var targetY = window.scrollY;
    var k = 1 - Math.pow(1 - 0.12, dt / 16.7);          // frame-rate independent glide
    var prevSmooth = smoothY;
    smoothY += (targetY - smoothY) * k;
    if (Math.abs(targetY - smoothY) < 0.2) smoothY = targetY;
    var shift = targetY - smoothY;                       // how far the visuals lag behind
    var vh = window.innerHeight;

    // hero logo drifts down and fades slightly
    if (luxScroll) {
      var hp = clamp01(smoothY / Math.max(hero.offsetHeight, 1));
      luxScroll.style.transform = "translate3d(0," + (hp * 60).toFixed(2) + "px,0) scale(" + (1 - hp * 0.08).toFixed(4) + ")";
      luxScroll.style.opacity = (1 - hp * 0.5).toFixed(3);
    }
    // parallax blobs and leaves
    for (var i = 0; i < parallax.length; i++) {
      var el = parallax[i], r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) continue;
      var kk = parseFloat(el.getAttribute("data-parallax")) || 0;
      el.style.translate = "0 " + ((r.top + shift + r.height / 2 - vh / 2) * kk).toFixed(2) + "px";
    }
    // tapes lean gently with scroll speed
    if (ticker) {
      var vel = (smoothY - prevSmooth) / Math.max(dt, 1) * 16.7;
      skew += (Math.max(-6, Math.min(6, vel * 0.22)) - skew) * 0.12;
      if (Math.abs(skew) < 0.01) skew = 0;
      ticker.style.setProperty("--skew", skew.toFixed(3) + "deg");
    }
    // banyan tree grows with (smoothed) progress through its section
    if (bt) {
      var br = bt.getBoundingClientRect();
      var top = br.top + shift;
      var stick = vh - headerH();
      var p = clamp01((headerH() - top) / Math.max(br.height - stick, 1));
      if (br.bottom + shift > -50 && top < vh + 50) paintTree(p);
    }

    if (Math.abs(targetY - smoothY) > 0.2 || Math.abs(skew) > 0.01) {
      requestAnimationFrame(frame);
    } else {
      running = false; lastT = 0;
    }
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", function () { parts.forEach(function (o) { o.last = -1; }); kick(); });
  kick();
})();
