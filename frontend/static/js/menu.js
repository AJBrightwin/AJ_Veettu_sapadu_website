/* AJ Veettu Saapadu — MENU page
   search · veg filter · sticky tabs · steppers · dish pop-up · phone cart bar · banner parallax
   Works with any number of sections and dishes added from the admin panel. */
(function () {
  "use strict";
  var root = document.querySelector("[data-mn]");
  if (!root) return;

  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var PHONE = window.matchMedia("(max-width: 759px)");
  var isTa = document.body.classList.contains("lang-ta");
  var Cart = window.AJVSCart;
  var i18n = {}, info = {};
  try { i18n = JSON.parse(document.getElementById("mn-i18n").textContent); } catch (e) { /* no dishes */ }
  try { info = JSON.parse(document.getElementById("mn-info").textContent); } catch (e) { /* no dishes */ }
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var IO = "IntersectionObserver" in window;

  root.classList.add("js-on");
  requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add("is-ready"); }); });

  var header = $(".site-header");
  var tabsBar = $("[data-mn-tabs]");
  function topOffset() { return (header ? header.offsetHeight : 0) + (tabsBar ? tabsBar.offsetHeight : 0); }

  /* ---------- money + count-up ---------- */
  function fmt(v) {
    var r = Math.round(v * 100) / 100;
    return "₹" + (r % 1 === 0 ? r.toLocaleString("en-IN") : r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }
  function countUp(el) {
    var to = parseFloat(el.getAttribute("data-count"));
    if (RM || !(to > 0)) return;
    var t0 = 0, dur = 1000;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? fmt(Math.round(to * e)) : fmt(to);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- reveal on scroll ---------- */
  var items = $$(".mn-it", root);
  var bans = $$("[data-ban]", root);
  var chapters = $$("[data-ch]", root);
  if (IO && !RM) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add("is-in");
        if (el.classList.contains("mn-it")) $$("[data-count]", el).forEach(countUp);
        rio.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    items.concat(bans).forEach(function (el) { rio.observe(el); });
  } else {
    items.concat(bans).forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- steppers (all [data-step] for a dish stay in sync) ---------- */
  var bar = $("[data-mn-bar]");
  var barCount = $("[data-mn-bar-c]");
  var lastCount = -1;
  function sync() {
    if (!Cart) return;
    $$("[data-step]").forEach(function (s) {
      var q = Cart.qty(s.getAttribute("data-id"));
      s.classList.toggle("has", q > 0);
      var n = $("[data-n]", s);
      if (n && n.textContent !== String(q)) {
        n.textContent = q;
        n.classList.remove("is-bump"); void n.offsetWidth; n.classList.add("is-bump");
      }
    });
    var c = Cart.count();
    if (bar) {
      bar.classList.toggle("is-on", c > 0);
      bar.setAttribute("tabindex", c > 0 ? "0" : "-1");
      document.body.classList.toggle("mn-bar-on", c > 0);
      if (barCount) barCount.textContent = c + " " + (c === 1 ? i18n.item : i18n.items);
      if (lastCount >= 0 && c !== lastCount && c > 0) { bar.classList.remove("is-bump"); void bar.offsetWidth; bar.classList.add("is-bump"); }
    }
    lastCount = c;
  }
  document.addEventListener("ajvs:cart", sync);
  sync();

  root.addEventListener("click", function (e) {
    var inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]"), open = e.target.closest("[data-open]");
    if (inc || dec) {
      var s = (inc || dec).closest("[data-step]");
      if (!s || !Cart) return;
      var id = s.getAttribute("data-id");
      if (inc) {
        if (s.hasAttribute("data-closed")) return;
        Cart.add({ id: id, price: s.getAttribute("data-price"), nameEn: s.getAttribute("data-name-en"), nameTa: s.getAttribute("data-name-ta") }, inc);
      } else {
        Cart.set(id, Cart.qty(id) - 1);
      }
      return;
    }
    if (open) { e.preventDefault(); openDlg(open.closest(".mn-it")); }
  });

  /* ---------- search + veg filter ---------- */
  var search = $("[data-mn-search]"), clearBtn = $("[data-mn-clear]");
  var diet = $("[data-mn-diet]"), dietInd = diet ? $(".mn-diet-ind", diet) : null;
  var none = $("[data-mn-none]"), live = $("[data-mn-live]");
  var tabs = $$("[data-tab]");
  var state = { q: "", diet: "all" };

  function placeDiet() {
    if (!diet || !dietInd) return;
    var b = $("[aria-checked=true]", diet);
    dietInd.style.setProperty("--x", b.offsetLeft + "px");
    dietInd.style.setProperty("--w", b.offsetWidth + "px");
  }
  function apply(fromUser) {
    var words = state.q.toLowerCase().normalize("NFC").split(/\s+/).filter(Boolean);
    var total = 0;
    chapters.forEach(function (ch) {
      var vis = [];
      $$(".mn-it", ch).forEach(function (it) {
        var q = it.getAttribute("data-q") || "";
        var ok = (state.diet === "all" || (state.diet === "veg") === (it.getAttribute("data-veg") === "1")) &&
                 words.every(function (w) { return q.indexOf(w) !== -1; });
        var was = !it.classList.contains("is-hide");
        it.classList.toggle("is-hide", !ok);
        if (ok) {
          vis.push(it);
          if (!was && !RM) { it.classList.add("is-in"); it.classList.remove("is-flash"); void it.offsetWidth; it.classList.add("is-flash"); }
        }
        it.classList.remove("is-wide");
      });
      // an odd last dish spans the full card width, so no empty half is left
      if (vis.length % 2 === 1 && vis.length > 1) vis[vis.length - 1].classList.add("is-wide");
      else if (vis.length === 1 && !ch.classList.contains("is-combo")) vis[0].classList.add("is-wide");
      ch.classList.toggle("is-empty", vis.length === 0);
      var tab = tabs.filter(function (t) { return t.getAttribute("data-tab") === ch.getAttribute("data-ch"); })[0];
      if (tab) tab.classList.toggle("is-hide", vis.length === 0);
      total += vis.length;
    });
    $$(".mn-row", root).forEach(function (row) {
      var shown = $$(".mn-ch", row).filter(function (c) { return !c.classList.contains("is-empty"); }).length;
      row.classList.toggle("is-empty", shown === 0);
      row.classList.toggle("is-solo", row.classList.contains("is-duo") && shown === 1);
    });
    if (none) none.hidden = total > 0;
    fillRoom();
    if (tabsBar) tabsBar.hidden = total === 0;
    if (clearBtn) clearBtn.hidden = !state.q;
    var filtering = state.q || state.diet !== "all";
    if (live) live.textContent = filtering ? total + " " + (i18n.found || "") : "";
    if (fromUser && filtering) {
      var body = $(".mn-body", root);
      var y = body.getBoundingClientRect().top + window.pageYOffset - topOffset() - 8;
      if (window.pageYOffset > y + 4) window.scrollTo({ top: y, behavior: RM ? "auto" : "smooth" });
    }
    spy(true);
  }
  /* show the gold ornament only where a short section leaves real empty space */
  var fills = $$("[data-fill]", root);
  function fillRoom() {
    fills.forEach(function (f) {
      var row = f.closest(".mn-row");
      if (row.classList.contains("is-solo") || window.innerWidth < 900) { f.classList.remove("has-room"); return; }
      var list = f.parentNode, other = $$(".mn-list", row).filter(function (l) { return l !== list; })[0];
      f.classList.remove("has-room");
      if (!other) return;
      // both halves are stretched to equal height, so measure the content
      var used = 0;
      $$(".mn-it", list).forEach(function (it) { if (!it.classList.contains("is-hide")) used += it.offsetHeight; });
      var cs = getComputedStyle(list);
      var room = list.clientHeight - used - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      f.classList.toggle("has-room", room >= 100);
    });
  }
  var tmr;
  if (search) {
    search.addEventListener("input", function () {
      clearTimeout(tmr);
      tmr = setTimeout(function () { state.q = search.value.trim(); apply(true); }, 90);
    });
    search.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); search.blur(); } });
  }
  if (clearBtn) clearBtn.addEventListener("click", function () { search.value = ""; state.q = ""; apply(true); search.focus(); });
  function setDiet(v) {
    state.diet = v;
    $$("[data-diet]", diet).forEach(function (b) { b.setAttribute("aria-checked", b.getAttribute("data-diet") === v ? "true" : "false"); });
    placeDiet(); apply(true);
  }
  if (diet) {
    diet.addEventListener("click", function (e) { var b = e.target.closest("[data-diet]"); if (b) setDiet(b.getAttribute("data-diet")); });
    diet.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var bs = $$("[data-diet]", diet), i = bs.indexOf($("[aria-checked=true]", diet));
      var n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
      setDiet(n.getAttribute("data-diet")); n.focus(); e.preventDefault();
    });
    placeDiet();
  }
  var reset = $("[data-mn-reset]");
  if (reset) reset.addEventListener("click", function () { if (search) search.value = ""; state.q = ""; setDiet("all"); });

  /* ---------- sticky tabs: gliding gold line + follows the scroll ---------- */
  var tabsIn = $("[data-mn-tabs-in]"), ind = tabsIn ? $(".mn-tab-ind", tabsIn) : null;
  var active = null, lockUntil = 0;
  function moveInd(a) {
    if (!ind || !a) return;
    ind.style.setProperty("--x", a.offsetLeft + "px");
    ind.style.setProperty("--s", a.offsetWidth / 100);
    ind.style.setProperty("--is", 100 / Math.max(a.offsetWidth, 1));
  }
  function setActive(slug, scrollTabs) {
    var a = tabs.filter(function (t) { return t.getAttribute("data-tab") === slug; })[0];
    if (!a) return;
    if (a !== active) {
      if (active) active.classList.remove("is-on");
      a.classList.add("is-on"); active = a;
      if (scrollTabs && tabsIn && tabsIn.scrollWidth > tabsIn.clientWidth) {
        tabsIn.scrollTo({ left: a.offsetLeft - (tabsIn.clientWidth - a.offsetWidth) / 2, behavior: RM ? "auto" : "smooth" });
      }
    }
    moveInd(a);
  }
  function spy(force) {
    if (!tabs.length) return;
    if (!force && Date.now() < lockUntil) return;
    var line = topOffset() + 60, cur = null;
    chapters.forEach(function (ch) {
      if (ch.classList.contains("is-empty")) return;
      if (ch.getBoundingClientRect().top <= line) cur = ch;
    });
    if (!cur) cur = chapters.filter(function (c) { return !c.classList.contains("is-empty"); })[0];
    if (cur) setActive(cur.getAttribute("data-ch"), true);
    else if (active) moveInd(active);
  }
  tabs.forEach(function (a) {
    a.addEventListener("click", function (e) {
      var ch = document.getElementById("ch-" + a.getAttribute("data-tab"));
      if (!ch) return;
      e.preventDefault();
      lockUntil = Date.now() + 900;
      setActive(a.getAttribute("data-tab"), true);
      var y = ch.getBoundingClientRect().top + window.pageYOffset - topOffset() - 12;
      window.scrollTo({ top: y, behavior: RM ? "auto" : "smooth" });
      if (history.replaceState) history.replaceState(null, "", "#ch-" + a.getAttribute("data-tab"));
    });
    if (FINE) a.addEventListener("mouseenter", function () { moveInd(a); });
  });
  if (tabsIn && FINE) tabsIn.addEventListener("mouseleave", function () { if (active) moveInd(active); });

  /* ---------- one scroll loop: tabs, banner parallax, stuck shadow ---------- */
  var visBans = new Set();
  var parts = bans.map(function (b) {
    return { el: b, art: $("[data-ban-art]", b), num: $(".mn-ban-num", b), glow: $(".mn-ban-glow", b), y: 0, ty: 0, mx: 0, my: 0, tmx: 0, tmy: 0 };
  });
  if (IO) {
    var bio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var p = parts.filter(function (x) { return x.el === en.target; })[0];
        if (en.isIntersecting) visBans.add(p); else visBans.delete(p);
        en.target.closest(".mn-ch").classList.toggle("is-off", !en.isIntersecting);
      });
      kick();
    }, { rootMargin: "60px 0px" });
    bans.forEach(function (b) { bio.observe(b); });
    var hero = $("[data-mn-hero]");
    if (hero) new IntersectionObserver(function (en) { hero.classList.toggle("is-off", !en[0].isIntersecting); }).observe(hero);
  }
  var running = false, lastT = 0;
  function frame(t) {
    var dt = lastT ? Math.min(t - lastT, 64) : 16.7; lastT = t;
    var k = 1 - Math.pow(1 - 0.12, dt / 16.7), moving = false, vh = window.innerHeight;
    visBans.forEach(function (p) {
      var r = p.el.getBoundingClientRect();
      var c = (r.top + r.height / 2 - vh / 2) / vh;             // -1 .. 1 as it crosses the screen
      p.ty = RM ? 0 : c * -30;
      p.y += (p.ty - p.y) * k; p.mx += (p.tmx - p.mx) * k; p.my += (p.tmy - p.my) * k;
      if (Math.abs(p.ty - p.y) > 0.05 || Math.abs(p.tmx - p.mx) > 0.01 || Math.abs(p.tmy - p.my) > 0.01) moving = true;
      if (p.art) p.art.style.translate = (p.mx * 16).toFixed(2) + "px " + (p.y + p.my * 10).toFixed(2) + "px";
      if (p.num) p.num.style.translate = (p.mx * -10).toFixed(2) + "px " + (-p.y * 1.3).toFixed(2) + "px";
    });
    if (moving) requestAnimationFrame(frame); else { running = false; lastT = 0; }
  }
  function kick() { if (!running && !RM && visBans.size) { running = true; requestAnimationFrame(frame); } }
  var ticking = false;
  window.addEventListener("scroll", function () {
    kick();
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false; spy();
      if (tabsBar) tabsBar.classList.toggle("is-stuck", tabsBar.getBoundingClientRect().top <= (header ? header.offsetHeight : 0) + 1);
    });
  }, { passive: true });
  var rzT;
  window.addEventListener("resize", function () { placeDiet(); if (active) moveInd(active); clearTimeout(rzT); rzT = setTimeout(fillRoom, 120); }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placeDiet(); spy(true); fillRoom(); });

  if (FINE && !RM) {
    parts.forEach(function (p) {
      p.el.addEventListener("pointermove", function (e) {
        var r = p.el.getBoundingClientRect();
        p.tmx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        p.tmy = ((e.clientY - r.top) / r.height - 0.5) * 2;
        kick();
      });
      p.el.addEventListener("pointerleave", function () { p.tmx = 0; p.tmy = 0; kick(); });
    });
    /* combo cards tilt towards the mouse */
    $$(".mn-cb", root).forEach(function (c) {
      var raf = 0;
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { c.style.transform = "perspective(900px) rotateX(" + (-y * 5).toFixed(2) + "deg) rotateY(" + (x * 6).toFixed(2) + "deg) translateY(-3px)"; });
      });
      c.addEventListener("pointerleave", function () { cancelAnimationFrame(raf); c.style.transform = ""; });
    });
  }

  /* ---------- dish pop-up ---------- */
  var dlg = $("[data-mn-dlg]");
  var card = dlg ? $("[data-dlg-card]", dlg) : null;
  var cur = null, lastFocus = null, closeTmr = 0;
  var CHILI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 3.5c-.9 0-1.6.6-1.8 1.4-3.3.4-5.5 3.4-7.4 6.6-1.6 2.7-3.3 5-5.8 6.6 3.2 1.6 8.2.4 11.6-3.4 2.4-2.7 3.6-5.6 3.3-7.9.9-.3 1.6-1.1 1.6-2 0-.4-.3-.8-.7-.9z"/></svg>';

  function visibleItems() { return items.filter(function (it) { return !it.classList.contains("is-hide"); }); }
  function fill(it) {
    var id = it.getAttribute("data-dish"), d = info[id] || {};
    var ch = it.closest(".mn-ch");
    var theme = (ch.className.match(/\bth-[a-z]+/) || ["th-leaf"])[0];
    var stage = $("[data-dlg-stage]", dlg);
    var th = $(".mn-th", it);
    stage.className = "mn-dlg-stage " + theme + ($("img", th) ? " is-photo" : "");
    $("[data-dlg-art]", dlg).innerHTML = th.innerHTML;
    var img = $("[data-dlg-art] img", dlg); if (img) img.removeAttribute("loading");
    $("[data-dlg-k]", dlg).textContent = $(".mn-ban-t", ch).textContent.trim() + " · " + $(".mn-ban-num", ch).textContent.trim();
    var tags = $("[data-dlg-tags]", dlg); tags.innerHTML = "";
    $$(".mn-ft > .vm, .mn-ft > .bd", it).forEach(function (b) { tags.appendChild(b.cloneNode(true)); });
    var save = $(".mn-save", it); if (save) tags.appendChild(Object.assign(document.createElement("span"), { className: "bd bd-best", textContent: save.textContent }));
    $("[data-dlg-t]", dlg).textContent = $(".mn-nm", it).textContent.trim();
    $("[data-dlg-alt]", dlg).textContent = d.alt || "";
    var ds = $(".mn-ds", it);
    $("[data-dlg-ds]", dlg).textContent = ds ? ds.textContent.trim() : "";
    var inc = $("[data-dlg-inc]", dlg), list = $("[data-dlg-list]", dlg);
    list.innerHTML = "";
    (d.details || []).forEach(function (x, k) { var li = document.createElement("li"); li.textContent = x; li.style.setProperty("--i", k); list.appendChild(li); });
    inc.hidden = !(d.details && d.details.length);
    var sp = $("[data-dlg-spice]", dlg);
    sp.hidden = !(d.spice > 0);
    if (d.spice > 0) {
      $("[data-dlg-chili]", dlg).innerHTML = [1, 2, 3].map(function (n) { return CHILI.replace("<svg ", '<svg class="' + (n <= d.spice ? "on" : "") + '" '); }).join("");
      $("[data-dlg-spice-t]", dlg).textContent = (i18n.spice || [])[d.spice] || "";
    }
    var pr = $(".mn-pr", it).cloneNode(true);
    $$("[data-count]", pr).forEach(function (s) { s.removeAttribute("data-count"); s.textContent = fmt(parseFloat($("[data-count]", it) ? $("[data-count]", it).getAttribute("data-count") : 0)); });
    var prBox = $("[data-dlg-pr]", dlg); prBox.innerHTML = pr.innerHTML;
    var ctl = $("[data-dlg-ctl]", dlg); ctl.innerHTML = "";
    var mc = $(".mc", it); if (mc) ctl.appendChild(mc.cloneNode(true));
    var vis = visibleItems(), i = vis.indexOf(it);
    $("[data-dlg-prev]", dlg).disabled = i <= 0;
    $("[data-dlg-next]", dlg).disabled = i < 0 || i >= vis.length - 1;
    $("[data-dlg-b]", dlg).scrollTop = 0;
    if (PHONE.matches) card.scrollTop = 0;
    cur = it;
    sync();
  }
  function openDlg(it) {
    if (!dlg || !it) return;
    clearTimeout(closeTmr);
    var wasOpen = dlg.classList.contains("is-open");
    lastFocus = wasOpen ? lastFocus : document.activeElement;
    fill(it);
    dlg.hidden = false;
    document.documentElement.classList.add("mn-dlg-open");
    document.body.classList.add("mn-dlg-open");
    card.style.removeProperty("--drag");
    void card.offsetWidth;
    dlg.classList.add("is-open");
    card.focus({ preventScroll: true });
    // the drawing flies from the dish row into the pop-up (big screens)
    if (!wasOpen && !RM && !PHONE.matches && card.animate) {
      var from = $(".mn-th", it).getBoundingClientRect(), art = $("[data-dlg-art]", dlg);
      var cardR = card.getBoundingClientRect(), to = art.getBoundingClientRect();
      // the card is still scaled .96 here; measure against its final box
      var sx = cardR.width / (card.offsetWidth || 1);
      var tcx = cardR.left + cardR.width / 2 + ((to.left + to.width / 2) - (cardR.left + cardR.width / 2)) / sx;
      var tcy = cardR.top + cardR.height / 2 + ((to.top + to.height / 2) - (cardR.top + cardR.height / 2)) / sx - 28 / sx;
      var tw = to.width / sx;
      var dx = from.left + from.width / 2 - tcx, dy = from.top + from.height / 2 - tcy, sc = from.width / tw;
      art.animate([{ transform: "translate(" + dx + "px," + dy + "px) scale(" + sc + ")", opacity: .3 },
                   { transform: "none", opacity: 1 }], { duration: 760, easing: "cubic-bezier(.22,1,.36,1)" });
    } else if (!wasOpen && !RM && card.animate) {
      $("[data-dlg-art]", dlg).animate([{ transform: "translateY(30px) scale(.7)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 700, delay: 120, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "backwards" });
    }
  }
  function closeDlg() {
    if (!dlg || !dlg.classList.contains("is-open")) return;
    dlg.classList.remove("is-open");
    card.style.removeProperty("--drag");
    document.documentElement.classList.remove("mn-dlg-open");
    document.body.classList.remove("mn-dlg-open");
    closeTmr = setTimeout(function () { dlg.hidden = true; }, 560);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function go(dir) {
    var vis = visibleItems(), i = vis.indexOf(cur), n = vis[i + dir];
    if (!n) return;
    var art = $("[data-dlg-art]", dlg), body = $("[data-dlg-b]", dlg);
    if (RM || !art.animate) { fill(n); return; }
    var out = [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + (-dir * 40) + "px)" }];
    var a1 = art.animate(out, { duration: 200, easing: "ease-in" });
    body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
    a1.onfinish = function () {
      fill(n);
      art.animate([{ opacity: 0, transform: "translateX(" + (dir * 50) + "px) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" });
      body.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 480, easing: "cubic-bezier(.22,1,.36,1)" });
    };
  }
  if (dlg) {
    $$("[data-dlg-close]", dlg).forEach(function (b) { b.addEventListener("click", closeDlg); });
    $("[data-dlg-prev]", dlg).addEventListener("click", function () { go(-1); });
    $("[data-dlg-next]", dlg).addEventListener("click", function () { go(1); });
    document.addEventListener("keydown", function (e) {
      if (!dlg.classList.contains("is-open")) return;
      if (e.key === "Escape") { closeDlg(); e.preventDefault(); }
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {                                // keep focus inside the pop-up
        var f = $$("button:not([disabled]), [href], input", card).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === card)) { f[f.length - 1].focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
      }
    });
    // phones: drag the sheet down to close · swipe the picture sideways for the next dish
    var stage = $("[data-dlg-stage]", dlg), sx0 = 0, sy0 = 0, drag = 0, mode = "";
    function down(e) {
      if (!PHONE.matches && e.pointerType === "mouse") return;
      sx0 = e.clientX; sy0 = e.clientY; drag = 0; mode = "";
    }
    function move(e) {
      if (!sy0) return;
      var dx = e.clientX - sx0, dy = e.clientY - sy0;
      if (!mode) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) mode = "x";
        else if (dy > 10 && PHONE.matches && card.scrollTop <= 0) mode = "y";
      }
      if (mode === "y") { drag = Math.max(0, dy); card.classList.add("is-drag"); card.style.setProperty("--drag", drag + "px"); }
    }
    function up(e) {
      if (!sy0) return;
      var dx = e.clientX - sx0;
      if (mode === "x" && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      card.classList.remove("is-drag");
      if (mode === "y") { if (drag > 110) closeDlg(); else card.style.setProperty("--drag", "0px"); }
      sy0 = 0; mode = "";
    }
    [stage, $("[data-dlg-grab]", dlg)].forEach(function (el) {
      el.addEventListener("pointerdown", down);
    });
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  /* ---------- open straight at a section from a link like /menu/#ch-biryani ---------- */
  if (location.hash && /^#ch-/.test(location.hash)) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) setTimeout(function () {
      window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - topOffset() - 12, behavior: "auto" });
    }, 60);
  }

  apply(false);
})();
