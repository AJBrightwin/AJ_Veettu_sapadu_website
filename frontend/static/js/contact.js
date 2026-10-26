/* AJ வீட்டு சாப்பாடு — Contact page
   · live chat on the phone (loops, pauses when off-screen)
   · form: sends without reloading, shows field errors, animated "thank you"
   · "Plan a bulk order" picks the reason and glides to the form
   · FAQ accordion */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- chat loop ---------------- */
  var chat = document.querySelector("[data-chat]");
  if (chat && !reduceMotion) {
    var bubs = Array.prototype.slice.call(chat.querySelectorAll(".bub"));
    // [step to show, wait after it (ms)]; typing bubbles are hidden when the reply arrives
    var plan = [[0, 1300], [1, 1300], [2, 1700], [3, 1300], [4, 1200], [5, 3600]];
    var k = 0, timer = null, visible = false;
    function reset() { bubs.forEach(function (b) { b.classList.remove("is-on", "is-out"); }); }
    function step() {
      if (!visible) { timer = null; return; }
      if (k >= plan.length) {                          // fade everything out and start again
        bubs.forEach(function (b) { if (b.classList.contains("is-on")) b.classList.add("is-out"); });
        k = 0;
        timer = setTimeout(function () { reset(); step(); }, 500);
        return;
      }
      var b = bubs[plan[k][0]];
      var prev = bubs[plan[k][0] - 1];
      if (prev && prev.classList.contains("bub-typing")) prev.classList.remove("is-on");
      b.classList.add("is-on");
      timer = setTimeout(step, plan[k][1]);
      k++;
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible && !timer) timer = setTimeout(step, k === 0 ? 900 : 300);
      }, { threshold: 0.2 }).observe(chat);
    } else { visible = true; step(); }
  } else if (chat) {
    chat.querySelectorAll(".bub:not(.bub-typing)").forEach(function (b) { b.classList.add("is-on"); });
  }

  /* ---------------- form ---------------- */
  var form = document.querySelector("[data-ct-form]");
  var done = document.querySelector("[data-ct-done]");
  function pickReason(code) {
    if (!form) return;
    var r = form.querySelector('input[name="reason"][value="' + code + '"]');
    if (r) { r.checked = true; r.closest(".rs").classList.remove("has-err"); }
  }
  document.querySelectorAll("[data-pick-reason]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      pickReason(a.getAttribute("data-pick-reason"));
      var target = document.getElementById("ct-form");
      var card = form ? form.closest(".cf-card") : target;
      card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      setTimeout(function () { var m = form && form.querySelector("#c-name"); if (m) m.focus({ preventScroll: true }); }, reduceMotion ? 0 : 700);
    });
  });

  if (form && window.fetch && window.FormData) {
    var btn = form.querySelector(".cf-send");
    var btnText = btn.querySelector("span");
    var idle = btnText.textContent;
    var phone = form.querySelector("#c-phone");
    phone.addEventListener("input", function () {
      var v = phone.value.replace(/[^\d+\s]/g, "");
      if (v !== phone.value) phone.value = v;
    });
    function clearErrors() {
      form.querySelectorAll(".has-err").forEach(function (el) { el.classList.remove("has-err"); });
      form.querySelectorAll("[data-err]").forEach(function (p) { p.textContent = ""; });
    }
    form.querySelectorAll("input, textarea").forEach(function (el) {
      el.addEventListener("input", function () {
        var box = el.closest(".fl, .rs");
        if (box && box.classList.contains("has-err")) { box.classList.remove("has-err"); var p = box.querySelector("[data-err]"); if (p) p.textContent = ""; }
      });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.classList.contains("is-busy")) return;
      clearErrors();
      form.classList.add("is-busy");
      btnText.textContent = btn.getAttribute("data-sending") || idle;
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { "Accept": "application/json" }, credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            form.reset();
            done.hidden = false;
            done.classList.remove("is-in"); void done.offsetWidth; done.classList.add("is-in");
            done.querySelector("[data-ct-again]").focus({ preventScroll: true });
          } else {
            var first = null;
            Object.keys(data.errors || {}).forEach(function (f) {
              var p = form.querySelector('[data-err="' + f + '"]');
              if (p) { p.textContent = data.errors[f]; var box = p.closest(".fl, .rs"); box.classList.add("has-err"); first = first || box; }
            });
            if (first) {
              first.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
              var inp = first.querySelector("input, textarea"); if (inp && inp.type !== "radio") inp.focus({ preventScroll: true });
            }
          }
        })
        .catch(function () { form.submit(); })               // no network trick: normal post
        .then(function () { form.classList.remove("is-busy"); btnText.textContent = idle; });
    });
    if (done) done.querySelector("[data-ct-again]").addEventListener("click", function () {
      done.hidden = true; done.classList.remove("is-in");
      var n = form.querySelector("#c-name"); if (n) n.focus();
    });
  }

  /* ---------------- phone digits ripple (each character becomes its own span) ---------------- */
  document.querySelectorAll("[data-wave]").forEach(function (el) {
    var txt = el.textContent.trim(); el.textContent = "";
    txt.split("").forEach(function (ch, i) { var c = document.createElement("i"); c.textContent = ch; c.style.setProperty("--i", i); el.appendChild(c); });
  });

  /* ---------------- FAQ ---------------- */
  document.querySelectorAll(".fq-q").forEach(function (q) {
    q.addEventListener("click", function () {
      var item = q.closest(".fq-item");
      var open = !item.classList.contains("is-open");
      item.classList.toggle("is-open", open);
      q.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* =====================================================================
     PREMIUM MOTION — smooth 3D tilt, glare, spotlights and hero parallax.
     Every value glides toward its target each frame (frame-rate independent),
     and only GPU-friendly properties (transform / translate / opacity) change.
     ===================================================================== */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion;
  if (fine) document.documentElement.classList.add("fine");
  var live = [];                       // things currently easing
  var raf = 0, lastT = 0;
  function ease(dt, rate) { return 1 - Math.pow(1 - rate, dt / 16.7); }
  function loop(t) {
    var dt = lastT ? Math.min(t - lastT, 64) : 16.7; lastT = t;
    for (var i = live.length - 1; i >= 0; i--) { if (!live[i](dt)) live.splice(i, 1); }
    if (live.length) raf = requestAnimationFrame(loop); else { raf = 0; lastT = 0; }
  }
  function wake(fn) { if (live.indexOf(fn) < 0) live.push(fn); if (!raf) raf = requestAnimationFrame(loop); }

  /* ---- 3D tilt + glare (mouse) ---- */
  if (fine) {
    document.querySelectorAll("[data-tilt]").forEach(function (el) {
      var max = parseFloat(el.getAttribute("data-tilt")) || 8;
      var lift = el.classList.contains("qa") ? -5 : el.classList.contains("ci-in") ? -8 : -6;
      var s = { rx: 0, ry: 0, l: 0 }, t = { rx: 0, ry: 0, l: 0 };
      function step(dt) {
        var k = ease(dt, 0.14);
        s.rx += (t.rx - s.rx) * k; s.ry += (t.ry - s.ry) * k; s.l += (t.l - s.l) * k;
        var still = Math.abs(t.rx - s.rx) < 0.01 && Math.abs(t.ry - s.ry) < 0.01 && Math.abs(t.l - s.l) < 0.02;
        if (still) { s.rx = t.rx; s.ry = t.ry; s.l = t.l; }
        el.style.transform = (s.rx || s.ry || s.l) ? "perspective(900px) rotateX(" + s.rx.toFixed(3) + "deg) rotateY(" + s.ry.toFixed(3) + "deg) translate3d(0," + s.l.toFixed(2) + "px,0)" : "";
        return !still;
      }
      el.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        var r = el.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
        t.rx = (0.5 - ny) * max; t.ry = (nx - 0.5) * max; t.l = lift;
        el.style.setProperty("--gx", (nx * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (ny * 100).toFixed(1) + "%");
        el.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
        el.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
        el.classList.add("is-tilting");
        wake(step);
      });
      el.addEventListener("pointerleave", function () { t.rx = 0; t.ry = 0; t.l = 0; el.classList.remove("is-tilting"); wake(step); });
    });
    document.querySelectorAll("[data-spotlight]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
        el.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      });
    });
  }

  /* ---- hero parallax: follows the mouse, and drifts apart as you scroll (all screens) ---- */
  var hero = document.querySelector("[data-ch]");
  var copy = document.querySelector("[data-px-copy]");
  var phoneWrap = document.querySelector("[data-px-phone]");
  var bg = hero ? hero.querySelector(".ch-bg") : null;
  if (hero && copy && phoneWrap && !reduceMotion) {
    var hv = { mx: 0, my: 0, p: 0 }, ht = { mx: 0, my: 0, p: 0 }, heroOn = true, lastCy = null;
    function heroStep(dt) {
      var k = ease(dt, 0.08);
      hv.mx += (ht.mx - hv.mx) * k; hv.my += (ht.my - hv.my) * k; hv.p += (ht.p - hv.p) * ease(dt, 0.14);
      var still = Math.abs(ht.mx - hv.mx) < 0.001 && Math.abs(ht.my - hv.my) < 0.001 && Math.abs(ht.p - hv.p) < 0.0005;
      if (still) { hv.mx = ht.mx; hv.my = ht.my; hv.p = ht.p; }
      var cy = (hv.p * 70).toFixed(1), co = (1 - hv.p * 0.55).toFixed(3);
      if (cy !== lastCy) { copy.style.translate = "0 " + cy + "px"; copy.style.opacity = co; lastCy = cy; }   // text only drifts on scroll
      phoneWrap.style.translate = (hv.mx * 16).toFixed(2) + "px " + (hv.my * 12 - hv.p * 46).toFixed(2) + "px";
      if (bg) bg.style.translate = (hv.mx * -22).toFixed(2) + "px " + (hv.my * -14).toFixed(2) + "px";
      return !still;
    }
    if (fine) {
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        ht.mx = (e.clientX - r.left) / r.width * 2 - 1; ht.my = (e.clientY - r.top) / r.height * 2 - 1;
        wake(heroStep);
      });
      hero.addEventListener("pointerleave", function () { ht.mx = 0; ht.my = 0; wake(heroStep); });
    }
    function onScroll() {
      if (!heroOn) return;
      ht.p = Math.max(0, Math.min(1, window.scrollY / Math.max(hero.offsetHeight, 1)));
      wake(heroStep);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { heroOn = en[0].isIntersecting; if (heroOn) onScroll(); }).observe(hero);
    onScroll();
  }
})();
