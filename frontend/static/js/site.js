/* AJ Veettu Saapadu — site-wide behaviour (every page)
   header · wordmark · mobile menu · reveals · magnetic buttons · ripples
   soft cursor glow · dish-card tilt · spotlight cards · back-to-top */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var fancy = finePointer && !reduceMotion;
  var header = document.querySelector("[data-header]");
  var progress = document.querySelector("[data-progress]");
  var toTop = document.querySelector("[data-to-top]");
  var toTopRing = document.querySelector("[data-to-top-ring]");

  /* ---------- wordmark: split into letters (Tamil-safe) and animate in ---------- */
  function graphemes(str) {
    if (window.Intl && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter("ta", { granularity: "grapheme" }).segment(str), function (s) { return s.segment; });
    }
    return null; // old browsers: animate whole words instead
  }
  var wm = document.querySelector(".wm");
  if (wm) {
    var ci = 0;
    wm.querySelectorAll("[data-wm]").forEach(function (word) {
      var parts = graphemes(word.textContent) || [word.textContent];
      word.textContent = "";
      parts.forEach(function (p) {
        var s = document.createElement("span");
        s.className = "wm-c";
        s.textContent = p;
        s.style.setProperty("--ci", ci++);
        word.appendChild(s);
      });
    });
    var intro = document.documentElement.classList.contains("show-intro");
    setTimeout(function () { wm.classList.add("is-in"); }, intro ? 2300 : 60);
  }

  /* ---------- fixed header: share its real height with the CSS (--header-h) ---------- */
  function setHeaderH() {
    if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  }
  setHeaderH();
  window.addEventListener("resize", setHeaderH);
  if (header && "ResizeObserver" in window) new ResizeObserver(setHeaderH).observe(header);

  /* ---------- header: solid on scroll + progress bar ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || window.pageYOffset;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(y / max, 1) : 0;
      if (header) header.classList.toggle("is-scrolled", y > 12);
      if (progress) progress.style.transform = "scaleX(" + p + ")";
      if (toTop) {
        toTop.classList.toggle("is-on", y > 600);
        if (toTopRing) toTopRing.style.strokeDashoffset = String(100 - p * 100);
      }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); });

  /* ---------- desktop nav: sliding yellow pill ---------- */
  var pill = document.querySelector("[data-nav-pill]");
  var indicator = document.querySelector("[data-nav-indicator]");
  if (pill && indicator) {
    var current = pill.querySelector('a[aria-current="page"]');
    var moveTo = function (a) {
      if (!a || !a.offsetWidth) { indicator.style.opacity = "0"; return; }
      var navBox = indicator.parentElement.getBoundingClientRect();
      var pillBox = pill.getBoundingClientRect();
      var box = a.getBoundingClientRect();
      // keep the highlight inside the pill, never past its edges
      var left = Math.max(box.left, pillBox.left + 5), right = Math.min(box.right, pillBox.right - 5);
      var hidden = indicator.style.opacity !== "1";
      if (hidden) indicator.style.transition = "opacity .25s";      // appear in place, don't fly in from the side
      indicator.style.width = (right - left) + "px";
      indicator.style.transform = "translateX(" + (left - navBox.left) + "px)";
      indicator.style.opacity = "1";
      if (hidden) { void indicator.offsetWidth; indicator.style.transition = ""; }
    };
    pill.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("mouseenter", function () { moveTo(a); });
      a.addEventListener("focus", function () { moveTo(a); });
    });
    pill.addEventListener("mouseleave", function () { if (current) moveTo(current); else indicator.style.opacity = "0"; });
    var place = function () {
      indicator.style.transition = "none";
      moveTo(current);
      void indicator.offsetWidth;
      indicator.style.transition = "";
    };
    place();
    window.addEventListener("resize", place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  }

  /* ---------- mobile full-screen menu ---------- */
  var burger = document.querySelector("[data-burger]");
  var menu = document.querySelector("[data-mobile-menu]");
  if (burger && menu) {
    var mmEmblem = menu.querySelector("[data-mm-emblem]");
    // split each menu label into letters (Tamil-safe) so they can rise one by one
    menu.querySelectorAll("[data-mm-split]").forEach(function (el) {
      var txt = el.textContent.trim();
      var parts = graphemes(txt) || txt.split("");
      el.setAttribute("aria-label", txt);
      el.textContent = "";
      parts.forEach(function (p, k) {
        var c = document.createElement("span");
        c.className = "mm-c";
        c.setAttribute("aria-hidden", "true");
        c.textContent = p;
        c.style.setProperty("--ci", k);
        el.appendChild(c);
      });
    });
    var setMenu = function (open) {
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? burger.dataset.labelClose : burger.dataset.labelOpen);
      document.body.classList.toggle("menu-open", open);
      if (header) header.classList.toggle("is-menu", open);
      // once the curtain fully covers the page, stop painting the page behind it (smoother on phones)
      clearTimeout(menu._cover);
      if (open) menu._cover = setTimeout(function () { document.body.classList.add("menu-covered"); }, 1000);
      else document.body.classList.remove("menu-covered");
      if (mmEmblem) {
        if (open) requestAnimationFrame(function () { mmEmblem.classList.add("is-visible"); });
        else setTimeout(function () { if (!menu.classList.contains("is-open")) mmEmblem.classList.remove("is-visible"); }, 900);
      }
      if (open) {
        var first = menu.querySelector("a");
        if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 350);
      }
    };
    burger.addEventListener("click", function () { setMenu(!menu.classList.contains("is-open")); });
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) { setMenu(false); burger.focus(); }
    });
    window.addEventListener("resize", function () { if (!burger.offsetParent && menu.classList.contains("is-open")) setMenu(false); });
  }

  /* ---------- reveal on scroll ---------- */
  var targets = document.querySelectorAll("[data-reveal], [data-steps]");
  function show(el) { el.classList.add(el.hasAttribute("data-steps") ? "is-drawn" : "is-visible"); }
  if (reduceMotion || !("IntersectionObserver" in window)) {
    targets.forEach(show);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { show(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- click ripple on every button ---------- */
  if (!reduceMotion) {
    document.addEventListener("pointerdown", function (e) {
      var btn = e.target.closest(".btn");
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      var dot = document.createElement("span");
      dot.className = "ripple";
      dot.style.left = (e.clientX - r.left) + "px";
      dot.style.top = (e.clientY - r.top) + "px";
      dot.style.setProperty("--rs", Math.ceil(Math.max(r.width, r.height) / 6));
      btn.appendChild(dot);
      setTimeout(function () { dot.remove(); }, 750);
    });
  }

  /* ---------- footer: "today's menu on WhatsApp" signup (no page reload) ---------- */
  var sub = document.querySelector("[data-sub]");
  if (sub && window.fetch && window.FormData) {
    var subMsg = sub.querySelector("[data-sub-msg]");
    var subInput = sub.querySelector("input[name=phone]");
    subInput.addEventListener("input", function () {          // digits only
      var v = subInput.value.replace(/\D/g, "");
      if (v !== subInput.value) subInput.value = v;
    });
    sub.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sub.classList.contains("is-busy")) return;
      sub.classList.add("is-busy");
      subMsg.className = "ft-sub-msg";
      subMsg.textContent = "";
      fetch(sub.action, {
        method: "POST",
        body: new FormData(sub),
        headers: { "Accept": "application/json", "X-Requested-With": "fetch" },
        credentials: "same-origin"
      }).then(function (r) { return r.json(); }).then(function (data) {
        subMsg.textContent = data.message || "";
        subMsg.classList.add(data.ok ? "is-ok" : "is-err");
        if (data.ok) { sub.classList.add("is-done"); sub.reset(); }
      }).catch(function () {
        sub.submit();                                          // fall back to a normal post
      }).then(function () { sub.classList.remove("is-busy"); });
    });
  }

  /* ---------- section headings: words rise out of a mask (all screens) ---------- */
  var heads = document.querySelectorAll("main h2:not(.bt-title):not(.hero-title), main .page-head h1");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var hio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); hio.unobserve(en.target); } });
    }, { threshold: 0.35 });
    heads.forEach(function (h) {
      if (h.children.length) return;                       // only plain-text headings
      var words = h.textContent.trim().split(/\s+/);
      if (!words[0]) return;
      h.textContent = "";
      words.forEach(function (w, k) {
        var o = document.createElement("span"); o.className = "hw";
        var n = document.createElement("span"); n.className = "hw-i"; n.textContent = w; n.style.setProperty("--wi", k);
        o.appendChild(n); h.appendChild(o);
        if (k < words.length - 1) h.appendChild(document.createTextNode(" "));
      });
      h.classList.add("h-split");
      hio.observe(h);
    });
  }

  /* ---------- cards: a soft light sweeps across once when they come into view ---------- */
  var sheenCards = document.querySelectorAll(".dish, .why, .stat, .step, .ft-sub, .pr-card, .ci-card");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-sheen"); sio.unobserve(en.target); } });
    }, { threshold: 0.45 });
    sheenCards.forEach(function (c) {
      var sh = document.createElement("span"); sh.className = "sheen"; sh.setAttribute("aria-hidden", "true");
      c.appendChild(sh); sio.observe(c);
    });
  }

  /* ---------- dish glare layer (used by mouse tilt AND touch) ---------- */
  document.querySelectorAll(".dish").forEach(function (card) {
    if (card.querySelector(".dish-glare")) return;
    var g = document.createElement("span"); g.className = "dish-glare"; g.setAttribute("aria-hidden", "true");
    card.appendChild(g);
  });

  /* =====================================================================
     PHONES & TABLETS (no mouse): premium touch effects
     ===================================================================== */
  if (!fancy && !reduceMotion) {
    document.documentElement.classList.add("touch-fx");

    // 1) golden glow that blooms where the finger touches
    var tg = document.createElement("div");
    tg.className = "touch-glow"; tg.setAttribute("aria-hidden", "true");
    document.body.appendChild(tg);
    var tgTimer = null;
    document.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      tg.style.transform = "translate3d(" + (e.clientX - 110) + "px," + (e.clientY - 110) + "px,0)";
      tg.classList.remove("is-on"); void tg.offsetWidth; tg.classList.add("is-on");
      clearTimeout(tgTimer); tgTimer = setTimeout(function () { tg.classList.remove("is-on"); }, 650);
    }, { passive: true });

    // 2) cards press in, and the glare jumps to the finger
    var pressSel = ".dish, .why, .stat, .step, .ft-sub, .ft-badges li, .pr-card, .jr-step, .ci-card, .qa, .fq-item";
    var pressed = null;
    var release = function () { if (pressed) { pressed.classList.remove("is-press"); pressed = null; } };
    document.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      var c = e.target.closest(pressSel); if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty("--gx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      c.style.setProperty("--gy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      c.style.setProperty("--mx", (e.clientX - r.left) + "px");
      c.style.setProperty("--my", (e.clientY - r.top) + "px");
      pressed = c; c.classList.add("is-press");
    }, { passive: true });
    ["pointerup", "pointercancel", "scroll"].forEach(function (ev) { window.addEventListener(ev, release, { passive: true }); });

    // 3) cards gently tilt as they travel through the screen while scrolling,
    //    and their gold spotlight glides with them (the touch version of the mouse tilt)
    var liveCards = Array.prototype.slice.call(document.querySelectorAll(".dish, .why, .stat, .step, .pr-card, .ci-card"));
    var onScreen = new Set();
    if ("IntersectionObserver" in window) {
      var lio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) onScreen.add(en.target); else onScreen.delete(en.target); });
        kickCards();
      }, { rootMargin: "60px 0px" });
      liveCards.forEach(function (c) { lio.observe(c); });
    }
    var cardRaf = 0;
    function paintCards() {
      cardRaf = 0;
      var vh = window.innerHeight;
      onScreen.forEach(function (c) {
        var r = c.getBoundingClientRect();
        var d = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2);   // -1 (top) .. 1 (bottom)
        d = Math.max(-1, Math.min(1, d));
        c.style.setProperty("--tx", (d * 9).toFixed(2) + "deg");
        if (!c.classList.contains("is-press")) {
          c.style.setProperty("--gy", (50 - d * 60).toFixed(1) + "%");
          c.style.setProperty("--gx", (50 + d * 20).toFixed(1) + "%");
          c.style.setProperty("--mx", "50%");
          c.style.setProperty("--my", (50 - d * 70).toFixed(1) + "%");
        }
      });
    }
    function kickCards() { if (!cardRaf) cardRaf = requestAnimationFrame(paintCards); }
    window.addEventListener("scroll", kickCards, { passive: true });
    window.addEventListener("resize", kickCards);
    kickCards();
  }

  if (!fancy) return; // everything below is mouse-only polish

  /* ---------- magnetic buttons ---------- */
  document.querySelectorAll("[data-magnetic]").forEach(function (el) {
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width / 2) * 0.25;
      var y = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.translate = x.toFixed(1) + "px " + y.toFixed(1) + "px";
    });
    el.addEventListener("mouseleave", function () { el.style.translate = ""; });
  });

  /* ---------- soft green glow that glides after the mouse ---------- */
  var cursor = document.querySelector("[data-cursor]");
  if (cursor) {
    var cx = -500, cy = -500, tx = -500, ty = -500, running = false, lastT = 0;
    var loop = function (t) {
      var dt = lastT ? Math.min(t - lastT, 64) : 16.7;
      lastT = t;
      var k = 1 - Math.pow(1 - 0.14, dt / 16.7);       // frame-rate independent easing
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      cursor.style.transform = "translate3d(" + (cx - 170).toFixed(2) + "px," + (cy - 170).toFixed(2) + "px,0)";
      if (Math.abs(tx - cx) > 0.3 || Math.abs(ty - cy) > 0.3) requestAnimationFrame(loop); else { running = false; lastT = 0; }
    };
    document.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!cursor.classList.contains("is-on")) { cx = tx; cy = ty; cursor.classList.add("is-on"); }
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener("mouseover", function (e) {
      cursor.classList.toggle("is-hover", !!e.target.closest("a, button, .dish, [data-lux], select, input, textarea, label"));
    });
    document.addEventListener("mousedown", function () { cursor.classList.add("is-down"); });
    document.addEventListener("mouseup", function () { cursor.classList.remove("is-down"); });
    document.documentElement.addEventListener("mouseleave", function () { cursor.classList.remove("is-on"); });
  }

  /* ---------- dish cards: 3D tilt + glare ---------- */
  document.querySelectorAll(".dish").forEach(function (card) {
    card.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.classList.add("is-tilting");
      card.style.setProperty("--ty", ((px - 0.5) * 10).toFixed(2) + "deg");
      card.style.setProperty("--tx", ((0.5 - py) * 10).toFixed(2) + "deg");
      card.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
    });
    card.addEventListener("mouseleave", function () {
      card.classList.remove("is-tilting");
      card.style.setProperty("--tx", "0deg");
      card.style.setProperty("--ty", "0deg");
    });
  });

  /* ---------- spotlight that follows the mouse inside cards ---------- */
  document.querySelectorAll("[data-spot]").forEach(function (el) {
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });
})();
