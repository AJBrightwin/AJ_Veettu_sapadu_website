/* AJ Veettu Saapadu — CHECKOUT
   steps (phones & tablets) · saved addresses (this device only) · accurate map pin · coupon · live totals
   The server checks everything again (prices, times, location, coupon) when the order is placed. */
(function () {
  "use strict";
  var root = document.querySelector("[data-co]");
  if (!root) return;

  var cfg = JSON.parse(document.getElementById("co-config").textContent);
  var T = cfg.t, ta = cfg.lang === "ta";
  var Cart = window.AJVSCart;
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STEPPED = window.matchMedia("(max-width: 979px)");
  var $ = function (s, c) { return (c || root).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || root).querySelectorAll(s)); };
  var form = $("[data-co-form]");
  var csrf = $("[name=csrfmiddlewaretoken]", form).value;

  var S = { step: 1, fulfil: "delivery", when: cfg.open ? "now" : "later", date: "", slot: "", addr: "", coupon: null };

  /* ---------------- helpers ---------------- */
  function fmt(v) {
    var r = Math.round(v * 100) / 100;
    return "₹" + (r % 1 === 0 ? r.toLocaleString("en-IN") : r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svg(html) { var s = document.createElement("span"); s.innerHTML = html; return s.firstChild; }
  function fill(str, k, v) { return String(str).replace("{" + k + "}", v); }
  function dateObj(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  var locale = ta ? "ta-IN" : "en-IN";
  function dayLabel(iso, long) {
    try { return dateObj(iso).toLocaleDateString(locale, long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" }); }
    catch (e) { return iso; }
  }
  function phoneOk(p) { return /^[6-9]\d{9}$/.test(p); }
  function digits(v) { return String(v || "").replace(/\D/g, "").slice(-10); }
  function setErr(key, msg, scope) {
    var e = (scope || root).querySelector('[data-err="' + key + '"]');
    if (!e) return;
    e.textContent = msg || ""; e.hidden = !msg;
    var f = e.closest(".co-field"); if (f) f.classList.toggle("is-bad", !!msg);
  }
  function alertMsg(msg) {
    var a = $("[data-co-alert]"); a.textContent = msg || ""; a.hidden = !msg;
    if (msg) { a.classList.remove("is-shake"); void a.offsetWidth; a.classList.add("is-shake"); a.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "center" }); }
  }
  function tween(node, to) {
    var from = node._v != null ? node._v : to; node._v = to;
    if (RM || from === to) { node.textContent = fmt(to); return; }
    var t0 = 0; cancelAnimationFrame(node._r);
    (function f(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(Math.round(from + (to - from) * e)); if (p < 1) node._r = requestAnimationFrame(f); else node.textContent = fmt(to); })(performance.now());
  }

  /* ---------------- device storage (never sent anywhere except with the order) ---------------- */
  var KEY_A = "ajvs_addr_v1", KEY_SEL = "ajvs_addr_sel_v1", KEY_C = "ajvs_contact_v1";
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function write(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function clean(s, n) { return typeof s === "string" ? s.replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n) : ""; }
  function num(v, lo, hi) { v = Number(v); return isFinite(v) && v >= lo && v <= hi ? v : null; }
  function loadAddrs() {
    var raw = read(KEY_A); if (!Array.isArray(raw)) return [];
    return raw.slice(0, 10).map(function (a) {
      if (!a || typeof a !== "object") return null;
      var o = { id: /^[a-z0-9]{6,24}$/.test(a.id) ? a.id : "", tag: ["home", "office", "other"].indexOf(a.tag) >= 0 ? a.tag : "other",
        other: clean(a.other, 30), name: clean(a.name, 100), phone: digits(a.phone), building: clean(a.building, 150),
        address: clean(a.address, 300), landmark: clean(a.landmark, 150), lat: num(a.lat, -90, 90), lng: num(a.lng, -180, 180), acc: num(a.acc, 0, 100000) };
      return o.id && o.lat != null && o.lng != null && o.building && o.address ? o : null;
    }).filter(Boolean);
  }
  var addrs = loadAddrs();
  function saveAddrs() { write(KEY_A, addrs); }
  function tagText(a) { return a.tag === "home" ? T.home : a.tag === "office" ? T.office : (a.other || T.other); }
  var TAG_IC = {
    home: '<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/></svg>',
    office: '<svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5h6v2M4 12h16"/></svg>',
    other: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>'
  };

  /* ---------------- step 1: how & when ---------------- */
  var daysBox = $("[data-days]");
  cfg.dates.forEach(function (iso, i) {
    var lab = el("label", "co-chip co-day"); lab.style.setProperty("--i", i);
    var inp = document.createElement("input"); inp.type = "radio"; inp.name = "date"; inp.value = iso;
    var sp = el("span"); var d = dateObj(iso);
    sp.appendChild(el("small", null, d.toLocaleDateString(locale, { weekday: "short" })));
    sp.appendChild(el("b", null, String(d.getDate())));
    sp.appendChild(el("small", null, d.toLocaleDateString(locale, { month: "short" })));
    lab.appendChild(inp); lab.appendChild(sp); daysBox.appendChild(lab);
  });
  var laterD = $("[data-later-d]");
  if (laterD && cfg.dates.length) laterD.textContent = fill(T.laterD, "date", dayLabel(cfg.dates[0]));

  form.addEventListener("change", function (e) {
    var n = e.target.name;
    if (n === "fulfilment") { S.fulfil = e.target.value; applyFulfil(); }
    else if (n === "when") { S.when = e.target.value; var l = $("[data-later]"); l.hidden = S.when !== "later"; if (!l.hidden && !RM) l.classList.add("is-in"); setErr("date"); setErr("slot"); }
    else if (n === "date") { S.date = e.target.value; setErr("date"); }
    else if (n === "slot") { S.slot = e.target.value; setErr("slot"); }
    else if (n === "addr") { S.addr = e.target.value; write(KEY_SEL, S.addr); setErr("addr"); markSel(); }
    summary(); totals(); progress();
  });
  function applyFulfil() {
    var pick = S.fulfil === "pickup";
    $$("[data-for]").forEach(function (b) { b.hidden = b.getAttribute("data-for") !== S.fulfil; });
    $$("[data-s2-label]").forEach(function (b) { b.textContent = pick ? T.s2p : T.s2; });
    $("[data-fee-row]").classList.toggle("is-free", pick);
  }

  /* ---------------- step 2: addresses ---------------- */
  var list = $("[data-addrs]");
  function renderAddrs() {
    list.innerHTML = "";
    if (!addrs.some(function (a) { return a.id === S.addr; })) S.addr = addrs.length ? addrs[0].id : "";
    addrs.forEach(function (a, i) {
      var lab = el("label", "co-addr"); lab.style.setProperty("--i", i);
      var inp = document.createElement("input"); inp.type = "radio"; inp.name = "addr"; inp.value = a.id; inp.checked = a.id === S.addr;
      var ic = el("span", "co-addr-ic"); ic.appendChild(svg(TAG_IC[a.tag] || TAG_IC.other));
      var body = el("span", "co-addr-b");
      body.appendChild(el("b", "co-addr-tag", tagText(a)));
      body.appendChild(el("span", "co-addr-line", a.building + ", " + a.address));
      if (a.landmark) body.appendChild(el("span", "co-addr-lm", a.landmark));
      body.appendChild(el("span", "co-addr-who", a.name + " · " + a.phone));
      var acts = el("span", "co-addr-acts");
      var ed = el("button", "co-link", T.edit); ed.type = "button"; ed.setAttribute("data-addr-edit", a.id);
      var dl = el("button", "co-link co-link-red", T.del); dl.type = "button"; dl.setAttribute("data-addr-del", a.id);
      acts.appendChild(ed); acts.appendChild(dl); body.appendChild(acts);
      var tick = el("span", "co-addr-tick"); tick.appendChild(svg('<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'));
      lab.appendChild(inp); lab.appendChild(ic); lab.appendChild(body); lab.appendChild(tick);
      list.appendChild(lab);
    });
    $("[data-add-title]").textContent = addrs.length ? T.addNew : T.addFirst;
    $("[data-add-sub]").hidden = !!addrs.length;
    root.classList.toggle("has-addrs", !!addrs.length);
    markSel(); summary(); progress();
  }
  function markSel() { $$(".co-addr", list).forEach(function (l) { l.classList.toggle("is-sel", l.querySelector("input").checked); }); }
  list.addEventListener("click", function (e) {
    var ed = e.target.closest("[data-addr-edit]"), dl = e.target.closest("[data-addr-del]");
    if (ed) { e.preventDefault(); openSheet(addrs.filter(function (a) { return a.id === ed.getAttribute("data-addr-edit"); })[0]); }
    if (dl) {
      e.preventDefault();
      var id = dl.getAttribute("data-addr-del"), card = dl.closest(".co-addr");
      var done = function () { addrs = addrs.filter(function (a) { return a.id !== id; }); saveAddrs(); renderAddrs(); };
      if (card.animate && !RM) { var h = card.offsetHeight; card.animate([{ opacity: 1, height: h + "px" }, { opacity: 0, transform: "translateX(30px)", height: h + "px", offset: .5 }, { opacity: 0, height: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" }], { duration: 480, easing: "cubic-bezier(.22,1,.36,1)" }).onfinish = done; }
      else done();
    }
  });
  $("[data-addr-new]").addEventListener("click", function () { openSheet(null); });
  $("[data-forget]").addEventListener("click", function () {
    addrs = []; write(KEY_A, null); write(KEY_SEL, null); write(KEY_C, null);
    $$("[data-contact]").forEach(function (i) { i.value = ""; });
    renderAddrs();
  });

  /* pickup contact (remembered on this device) */
  var contact = read(KEY_C) || {};
  $$("[data-contact]").forEach(function (inp) {
    var k = inp.getAttribute("data-contact");
    inp.value = k === "phone" ? digits(contact.phone) : clean(contact.name, 100);
    inp.addEventListener("input", function () {
      if (k === "phone") inp.value = inp.value.replace(/\D/g, "").slice(0, 10);
      setErr(k);
      var c = { name: clean($("[data-contact=name]").value, 100), phone: digits($("[data-contact=phone]").value) };
      if (c.name.length >= 2 && phoneOk(c.phone)) write(KEY_C, c);
      progress();
    });
  });

  /* ---------------- address sheet + map ---------------- */
  var sheet = $("[data-sheet]"), editing = null, pos = null, watch = null, autoAddr = true, geoTimer = 0, lastFocus = null;
  var A = {}; $$("[data-a]", sheet).forEach(function (i) { A[i.getAttribute("data-a")] = i; });
  A.phone.addEventListener("input", function () { A.phone.value = A.phone.value.replace(/\D/g, "").slice(0, 10); });
  A.address.addEventListener("input", function () { autoAddr = !A.address.value.trim(); });
  sheet.addEventListener("change", function (e) { if (e.target.name === "a_tag") $("[data-other-wrap]", sheet).hidden = e.target.value !== "other"; });
  Object.keys(A).forEach(function (k) { A[k].addEventListener("input", function () { setErr(k === "name" || k === "phone" ? "a-" + k : k, "", sheet); }); });

  function status(msg, kind) { var s = $("[data-loc-status]", sheet); s.textContent = msg; s.className = "co-loc-status" + (kind ? " is-" + kind : ""); }
  function openSheet(a) {
    editing = a || null; lastFocus = document.activeElement;
    $("[data-sheet-title]", sheet).textContent = a ? T.editTitle : T.addTitle;
    var c = read(KEY_C) || {};
    A.building.value = a ? a.building : ""; A.address.value = a ? a.address : ""; A.landmark.value = a ? a.landmark : "";
    A.name.value = a ? a.name : clean(c.name, 100); A.phone.value = a ? a.phone : digits(c.phone); A.other.value = a ? a.other : "";
    autoAddr = !a;
    var tag = a ? a.tag : (addrs.some(function (x) { return x.tag === "home"; }) ? "office" : "home");
    $$("[name=a_tag]", sheet).forEach(function (r) { r.checked = r.value === tag; });
    $("[data-other-wrap]", sheet).hidden = tag !== "other";
    ["building", "address", "a-name", "a-phone", "location"].forEach(function (k) { setErr(k, "", sheet); });
    $("[data-geo]", sheet).hidden = true;
    pos = a ? { lat: a.lat, lng: a.lng, acc: a.acc } : null;
    status(T.pinHint);
    sheet.hidden = false; void sheet.offsetWidth; sheet.classList.add("is-open");
    document.documentElement.classList.add("co-lock");
    setTimeout(function () { initMap(); }, 30);
    setTimeout(function () { var card = $(".co-sheet-card", sheet); card.focus({ preventScroll: true }); }, 80);
  }
  function closeSheet() {
    stopWatch();
    sheet.classList.remove("is-open");
    document.documentElement.classList.remove("co-lock");
    setTimeout(function () { if (!sheet.classList.contains("is-open")) sheet.hidden = true; }, 520);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $$("[data-sheet-close]", sheet).forEach(function (b) { b.addEventListener("click", closeSheet); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheet.classList.contains("is-open")) closeSheet(); });

  /* ---------- map engines: Google Maps (key set in admin → Site settings) or free OpenStreetMap ---------- */
  var G = null, gState = cfg.gkey ? "loading" : "off", gWait = [], M = null, geocoder = null, pac = null;
  var wrap = $(".co-map-wrap", sheet), mapEl = $("[data-map]", sheet), pinEl = $(".co-pin", sheet);
  var userMoved = false, located = false;
  function gDone(ok) { if (gState !== "loading") return; gState = ok ? "ready" : "failed"; var w = gWait; gWait = []; w.forEach(function (f) { f(); }); }
  window.gm_authFailure = function () {
    /* wrong key, key not allowed for this website, or billing not switched on → use the free map */
    if (window.console) console.warn("AJVS: Google Maps key was rejected, using OpenStreetMap");
    gState = "failed";
    if (M && M.kind === "g") swapToFree();
  };
  if (cfg.gkey) {
    window.__ajvsMaps = function () {
      Promise.all([google.maps.importLibrary("maps"), google.maps.importLibrary("places"), google.maps.importLibrary("geocoding")])
        .then(function () { G = google.maps; gDone(true); }, function () { gDone(false); });
    };
    var gs = document.createElement("script");
    gs.async = true;
    gs.referrerPolicy = "strict-origin-when-cross-origin";
    gs.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(cfg.gkey) + "&v=weekly&loading=async&libraries=places&language=" + (ta ? "ta" : "en") + "&region=IN&callback=__ajvsMaps";
    gs.onerror = function () { gDone(false); };
    document.head.appendChild(gs);
    setTimeout(function () { gDone(false); }, 12000);
  }
  function whenMaps(fn) { if (gState === "loading") gWait.push(fn); else fn(); }

  ["pointerdown", "touchstart", "wheel"].forEach(function (ev) {
    wrap.addEventListener(ev, function (e) { if (!e.target.closest(".co-locate")) userMoved = true; }, { passive: true });
  });
  function liftPin() { pinEl.classList.add("is-up"); }
  function settle(lat, lng) {
    pinEl.classList.remove("is-up");
    if (!userMoved && !located) return;
    pos = { lat: +lat.toFixed(6), lng: +lng.toFixed(6), acc: located ? (pos && pos.acc) || null : null };
    located = false;
    setErr("location", "", sheet);
    checkFar(); reverse();
  }
  var CIRCLE = { color: "#C9961A", fill: "#F4C430" };

  function makeFree(start, zoom) {
    var lm = L.map(mapEl, { zoomControl: false, attributionControl: true, tap: true }).setView(start, zoom);
    L.control.zoom({ position: "bottomright" }).addTo(lm);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, referrerPolicy: "strict-origin-when-cross-origin", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(lm);
    lm.on("movestart", liftPin);
    lm.on("moveend", function () { var c = lm.getCenter(); settle(c.lat, c.lng); });
    var circ = null;
    return { kind: "l",
      view: function (c, z) { lm.setView(c, z, { animate: false }); },
      fly: function (c, z) { lm.flyTo(c, z, { duration: RM ? 0 : .9 }); },
      circle: function (c, r) { if (circ) { circ.remove(); circ = null; } if (c) circ = L.circle(c, { radius: r, color: CIRCLE.color, weight: 1, fillColor: CIRCLE.fill, fillOpacity: .12, interactive: false }).addTo(lm); },
      center: function () { var c = lm.getCenter(); return [c.lat, c.lng]; },
      resize: function () { lm.invalidateSize(); },
      kill: function () { lm.remove(); } };
  }
  function makeGoogle(start, zoom) {
    var gm = new G.Map(mapEl, {
      center: { lat: start[0], lng: start[1] }, zoom: zoom, disableDefaultUI: true, zoomControl: true,
      zoomControlOptions: { position: G.ControlPosition.RIGHT_BOTTOM }, gestureHandling: "greedy",
      clickableIcons: false, keyboardShortcuts: false, backgroundColor: "#EFE8D5"
    });
    gm.addListener("dragstart", liftPin);
    gm.addListener("idle", function () { var c = gm.getCenter(); settle(c.lat(), c.lng()); });
    geocoder = new G.Geocoder();
    wrap.classList.add("is-g");
    var circ = null;
    return { kind: "g",
      view: function (c, z) { gm.setCenter({ lat: c[0], lng: c[1] }); gm.setZoom(z); },
      fly: function (c, z) { liftPin(); if (gm.getZoom() !== z) gm.setZoom(z); gm.panTo({ lat: c[0], lng: c[1] }); },
      circle: function (c, r) { if (circ) { circ.setMap(null); circ = null; } if (c) circ = new G.Circle({ map: gm, center: { lat: c[0], lng: c[1] }, radius: r, strokeColor: CIRCLE.color, strokeWeight: 1, fillColor: CIRCLE.fill, fillOpacity: .12, clickable: false }); },
      center: function () { var c = gm.getCenter(); return [c.lat(), c.lng()]; },
      resize: function () {},
      kill: function () { G.event.clearInstanceListeners(gm); } };
  }
  function swapToFree() {
    var c = M ? M.center() : cfg.kitchen;
    if (M) M.kill();
    var fresh = mapEl.cloneNode(false); mapEl.parentNode.replaceChild(fresh, mapEl); mapEl = fresh;
    wrap.classList.remove("is-g"); geocoder = null;
    $("[data-search]", sheet).hidden = true;
    M = null;
    if (!window.L) return;
    M = makeFree(c, pos ? 18 : 14);
    setTimeout(function () { M.resize(); }, 60);
  }
  function setupSearch() {
    if (pac || !G.places || !G.places.PlaceAutocompleteElement) return;
    var k = cfg.kitchen;
    try {
      pac = new G.places.PlaceAutocompleteElement({ includedRegionCodes: ["in"], locationBias: { center: { lat: k[0], lng: k[1] }, radius: 50000 } });
    } catch (e) { pac = null; return; }
    pac.setAttribute("placeholder", T.search);
    pac.className = "co-pac";
    $("[data-search-box]", sheet).appendChild(pac);
    $("[data-search]", sheet).hidden = false;
    function pick(place) {
      if (!place || !place.fetchFields) return;
      place.fetchFields({ fields: ["location", "formattedAddress", "displayName"] }).then(function () {
        var l = place.location; if (!l || !M) return;
        pos = { lat: +l.lat().toFixed(6), lng: +l.lng().toFixed(6), acc: null };
        located = true; userMoved = true;
        M.circle(null);
        status(T.pinHint, "ok");
        M.fly([l.lat(), l.lng()], 18);
      }).catch(function () {});
    }
    pac.addEventListener("gmp-select", function (e) { if (e.placePrediction) pick(e.placePrediction.toPlace()); });
    pac.addEventListener("gmp-placeselect", function (e) { if (e.place) pick(e.place); });
  }

  function initMap() {
    whenMaps(function () {
      var start = pos ? [pos.lat, pos.lng] : cfg.kitchen, zoom = pos ? 18 : 14;
      if (!M) {
        if (gState === "ready" && G) { try { M = makeGoogle(start, zoom); setupSearch(); } catch (e) { M = null; gState = "failed"; } }
        if (!M) { if (!window.L) { setTimeout(initMap, 150); return; } M = makeFree(start, zoom); }
      } else {
        M.view(start, zoom); M.circle(null);
      }
      if (pac) { try { pac.value = ""; } catch (e) {} }
      userMoved = !!pos; located = false;
      setTimeout(function () { if (M) M.resize(); }, 350);
      if (pos) reverse();
    });
  }
  function checkFar() {
    if (!pos || !cfg.radius) return;
    var R = 6371, toR = Math.PI / 180, a = cfg.kitchen;
    var dl = (pos.lat - a[0]) * toR, dg = (pos.lng - a[1]) * toR;
    var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a[0] * toR) * Math.cos(pos.lat * toR) * Math.sin(dg / 2) * Math.sin(dg / 2);
    var km = 2 * R * Math.asin(Math.sqrt(h));
    setErr("location", km > cfg.radius ? T.errFar : "", sheet);
  }
  function showGeo(txt) {
    if (!txt) return;
    var g = $("[data-geo]", sheet); g.textContent = txt; g.hidden = false;
    if (autoAddr) { A.address.value = txt.slice(0, 300); setErr("address", "", sheet); }
  }
  function reverse() {
    clearTimeout(geoTimer);
    geoTimer = setTimeout(function () {
      if (!pos) return;
      if (geocoder) {
        geocoder.geocode({ location: { lat: pos.lat, lng: pos.lng } }).then(function (res) {
          var list = (res && res.results) || [], best = null;
          for (var i = 0; i < list.length; i++) { if (list[i].types.indexOf("plus_code") < 0) { best = list[i]; break; } }
          if (!best) return;
          var txt = best.formatted_address.replace(/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3},?\s*/, "").replace(/,\s*(India|இந்தியா)$/, "");
          showGeo(txt);
        }).catch(function () { /* customer types the address */ });
        return;
      }
      if (!window.fetch) return;
      var url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=" + (ta ? "ta,en" : "en") + "&lat=" + pos.lat + "&lon=" + pos.lng;
      fetch(url, { referrerPolicy: "strict-origin-when-cross-origin", headers: { "Accept": "application/json" } }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.address) return;
        var ad = d.address, parts = [ad.house_number, ad.road || ad.pedestrian, ad.neighbourhood || ad.quarter, ad.suburb || ad.village, ad.city || ad.town || ad.county].filter(Boolean);
        var seen = {}, txt = parts.filter(function (p) { if (seen[p]) return false; seen[p] = 1; return true; }).join(", ");
        showGeo(txt);
      }).catch(function () { /* offline: the customer types the address */ });
    }, 700);
  }
  function stopWatch() { if (watch != null && navigator.geolocation) navigator.geolocation.clearWatch(watch); watch = null; $("[data-locate]", sheet).classList.remove("is-busy"); }
  $("[data-locate]", sheet).addEventListener("click", function () {
    if (!navigator.geolocation) { status(T.denied, "warn"); return; }
    stopWatch();
    var btn = this, best = null, started = Date.now();
    btn.classList.add("is-busy"); status(T.locating, "busy");
    watch = navigator.geolocation.watchPosition(function (p) {
      var c = p.coords;
      if (best && c.accuracy >= best.accuracy) return;
      best = { latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy };
      if (!M) return;
      located = true;
      pos = { lat: +c.latitude.toFixed(6), lng: +c.longitude.toFixed(6), acc: Math.round(c.accuracy) };
      M.fly([c.latitude, c.longitude], c.accuracy < 40 ? 19 : c.accuracy < 120 ? 18 : 16);
      M.circle([c.latitude, c.longitude], c.accuracy);
      var m = Math.round(c.accuracy);
      status(fill(m <= 50 ? T.located : T.weak, "m", m), m <= 50 ? "ok" : "warn");
      if (c.accuracy <= 12 || Date.now() - started > 15000) stopWatch();
    }, function (err) {
      stopWatch();
      status(err && err.code === 1 ? T.denied : (best ? fill(T.weak, "m", Math.round(best.accuracy)) : T.denied), "warn");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    setTimeout(function () { if (watch != null) { stopWatch(); if (best) status(fill(best.accuracy <= 50 ? T.located : T.weak, "m", Math.round(best.accuracy)), best.accuracy <= 50 ? "ok" : "warn"); } }, 16000);
  });

  $("[data-sheet-save]", sheet).addEventListener("click", function () {
    var v = function (k, n) { return clean(A[k].value, n); };
    var o = { building: v("building", 150), address: v("address", 300), landmark: v("landmark", 150), name: v("name", 100), phone: digits(A.phone.value), other: v("other", 30) };
    var tag = ($("[name=a_tag]:checked", sheet) || {}).value || "home";
    var bad = false;
    if (!pos) { setErr("location", T.errLoc, sheet); bad = true; }
    else if ($('[data-err="location"]', sheet).textContent === T.errFar && !$('[data-err="location"]', sheet).hidden) bad = true;
    if (!o.building) { setErr("building", T.errBuilding, sheet); bad = true; }
    if (o.address.length < 8) { setErr("address", T.errAddress, sheet); bad = true; }
    if (o.name.length < 2) { setErr("a-name", T.errName, sheet); bad = true; }
    if (!phoneOk(o.phone)) { setErr("a-phone", T.errPhone, sheet); bad = true; }
    if (bad) {
      var card = $(".co-sheet-card", sheet); card.classList.remove("is-shake"); void card.offsetWidth; card.classList.add("is-shake");
      var first = $(".co-err:not([hidden])", sheet); if (first) first.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "center" });
      return;
    }
    var rec = { id: editing ? editing.id : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20),
      tag: tag, other: tag === "other" ? o.other : "", name: o.name, phone: o.phone, building: o.building, address: o.address,
      landmark: o.landmark, lat: pos.lat, lng: pos.lng, acc: pos.acc || null };
    if (editing) addrs = addrs.map(function (a) { return a.id === rec.id ? rec : a; });
    else addrs.unshift(rec);
    addrs = addrs.slice(0, 10);
    S.addr = rec.id; write(KEY_SEL, S.addr); saveAddrs();
    write(KEY_C, { name: rec.name, phone: rec.phone });
    closeSheet(); renderAddrs();
    var card2 = list.querySelector('.co-addr input[value="' + rec.id + '"]');
    if (card2 && !RM) { var c2 = card2.closest(".co-addr"); c2.classList.add("is-flash"); }
  });

  /* ---------------- step 3: items ---------------- */
  var itemsBox = $("[data-items]"), sumItems = $("[data-sum-items]");
  var PLUS = '<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>', MINUS = '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
      TRASH = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>';
  function photo(id) {
    var d = Cart && Cart.dish(id), s = el("span", "co-ph");
    if (d && d.img) { var i = document.createElement("img"); i.src = d.img; i.alt = ""; i.loading = "lazy"; s.appendChild(i); }
    else s.appendChild(svg('<svg viewBox="0 0 48 48"><path d="M8 38C12 18 30 8 42 8c-1 18-14 32-34 30z" fill="#2E8B2E"/></svg>'));
    return s;
  }
  function nameOf(l) { return ta ? (l.ta || l.en) : l.en; }
  function lines() { return Cart ? Cart.lines() : []; }
  function renderItems() {
    var ls = lines();
    $("[data-empty]").hidden = ls.length > 0;
    itemsBox.innerHTML = ""; sumItems.innerHTML = "";
    ls.forEach(function (l, i) {
      var r = el("div", "co-item"); r.style.setProperty("--i", i);
      r.appendChild(photo(l.id));
      var b = el("div", "co-item-b"); b.appendChild(el("b", null, nameOf(l))); b.appendChild(el("small", null, fmt(l.price) + " " + T.each));
      r.appendChild(b);
      var q = el("div", "co-qty");
      var dec = el("button"); dec.type = "button"; dec.setAttribute("data-q", "-1:" + l.id); dec.setAttribute("aria-label", l.qty === 1 ? T.remove : "−"); dec.appendChild(svg(l.qty === 1 ? TRASH : MINUS));
      if (l.qty === 1) dec.className = "is-trash";
      var inc = el("button"); inc.type = "button"; inc.setAttribute("data-q", "1:" + l.id); inc.setAttribute("aria-label", "+"); inc.appendChild(svg(PLUS));
      q.appendChild(dec); q.appendChild(el("b", null, String(l.qty))); q.appendChild(inc);
      r.appendChild(q);
      r.appendChild(el("b", "co-item-p", fmt(l.qty * l.price)));
      itemsBox.appendChild(r);

      var s = el("div", "co-si"); s.appendChild(photo(l.id));
      s.appendChild(el("span", "co-si-n", l.qty + " × " + nameOf(l))); s.appendChild(el("b", null, fmt(l.qty * l.price)));
      sumItems.appendChild(s);
    });
  }
  itemsBox.addEventListener("click", function (e) {
    var b = e.target.closest("[data-q]"); if (!b || !Cart) return;
    var p = b.getAttribute("data-q").split(":"), id = p[1];
    Cart.set(id, Cart.qty(id) + parseInt(p[0], 10));
  });
  document.addEventListener("ajvs:cart", function () { renderItems(); recheckCoupon(); totals(); progress(); });

  /* ---------------- coupon ---------------- */
  var cBox = $("[data-coupon]");
  function subtotal() { return lines().reduce(function (s, l) { return s + l.qty * l.price; }, 0); }
  function couponDiscount(sub) {
    var c = S.coupon; if (!c) return 0;
    if (sub < c.min) return -1;
    var d = c.kind === "percent" ? Math.round(sub * c.value / 100) : c.value;
    if (c.kind === "percent" && c.max) d = Math.min(d, c.max);
    return Math.max(0, Math.min(d, sub));
  }
  function showCoupon() {
    if (!cBox) return;
    $("[data-coupon-form]", cBox).hidden = !!S.coupon;
    $("[data-coupon-ok]", cBox).hidden = !S.coupon;
    if (S.coupon) {
      $("[data-coupon-code]", cBox).textContent = fill(T.applied, "code", S.coupon.code);
      $("[data-coupon-msg]", cBox).textContent = fill(T.save, "amt", fmt(couponDiscount(subtotal())));
    }
  }
  function recheckCoupon() { if (S.coupon && couponDiscount(subtotal()) < 0) { S.coupon = null; showCoupon(); } else showCoupon(); }
  if (cBox) {
    var cInput = $("[name=coupon_input]", cBox), cBtn = $("[data-coupon-apply]", cBox);
    cInput.addEventListener("input", function () { cInput.value = cInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""); setErr("coupon"); });
    cInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); cBtn.click(); } });
    cBtn.addEventListener("click", function () {
      var code = cInput.value.trim(); if (!code) return;
      cBtn.classList.add("is-busy"); cBtn.disabled = true;
      var fd = new FormData(); fd.append("code", code); fd.append("subtotal", subtotal()); fd.append("csrfmiddlewaretoken", csrf);
      fetch(cfg.couponUrl, { method: "POST", body: fd, credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            S.coupon = { code: d.code, kind: d.kind, value: parseFloat(d.value), max: d.max ? parseFloat(d.max) : 0, min: parseFloat(d.min) || 0, msg: d.message };
            showCoupon(); totals(); confetti($("[data-coupon-ok]", cBox));
          } else setErr("coupon", d.message);
        })
        .catch(function () { setErr("coupon", T.errNet); })
        .then(function () { cBtn.classList.remove("is-busy"); cBtn.disabled = false; });
    });
    $("[data-coupon-remove]", cBox).addEventListener("click", function () { S.coupon = null; cInput.value = ""; showCoupon(); totals(); });
  }
  function confetti(anchor) {
    if (RM || !anchor || !anchor.animate) return;
    var r = anchor.getBoundingClientRect(), cols = ["#F4C430", "#C9961A", "#2E8B2E", "#E98A15", "#FFE9A6"];
    for (var i = 0; i < 18; i++) {
      var p = el("i", "co-confetti"); p.style.left = (r.left + 24) + "px"; p.style.top = (r.top + r.height / 2) + "px"; p.style.background = cols[i % cols.length];
      document.body.appendChild(p);
      var a = (Math.PI * 2 * i) / 18, d = 50 + Math.random() * 60;
      p.animate([{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: "translate(" + Math.cos(a) * d + "px," + (Math.sin(a) * d + 40) + "px) rotate(" + (Math.random() * 360) + "deg)", opacity: 0 }],
        { duration: 900 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = (function (n) { return function () { n.remove(); }; })(p);
    }
  }

  /* ---------------- totals + summary ---------------- */
  function totals() {
    var sub = subtotal(), fee = S.fulfil === "delivery" && lines().length ? cfg.fee : 0, disc = Math.max(0, couponDiscount(sub));
    var total = Math.max(sub + fee - disc, lines().length ? 1 : 0);
    $$("[data-co-sub]").forEach(function (n) { tween(n, sub); });
    var feeEl = $("[data-fee]"); if (S.fulfil === "pickup") { feeEl._v = 0; feeEl.textContent = T.free; } else tween(feeEl, fee);
    $("[data-disc-row]").hidden = !disc;
    if (disc) { $("[data-disc]").textContent = "−" + fmt(disc); $("[data-disc-code]").textContent = S.coupon ? "(" + S.coupon.code + ")" : ""; }
    $$("[data-total]").forEach(function (n) { tween(n, total); });
    var label = fill(T.pay, "amt", fmt(total));
    $("[data-pay-label]").textContent = label;
    if (S.step === 3 || !STEPPED.matches) $("[data-next-label]").textContent = label;
    var below = cfg.min > 0 && sub > 0 && sub < cfg.min, mb = $("[data-min]");
    mb.hidden = !below;
    if (below) { $("[data-min-t]").textContent = fill(T.min, "amt", fmt(cfg.min - sub)); $("[data-min-bar]").style.transform = "scaleX(" + (sub / cfg.min).toFixed(3) + ")"; }
    var payOk = lines().length > 0 && !below;
    $("[data-pay]").classList.toggle("is-disabled", !payOk);
    showCoupon();
  }
  function summary() {
    var w = $("[data-sum-when]"); w.innerHTML = "";
    var ic = el("span", "co-sw-ic"); ic.appendChild(svg(S.fulfil === "pickup" ? TAG_IC.other : '<svg viewBox="0 0 32 32"><path d="M4 21h3m18 0h3M9 21a3 3 0 1 0 6 0 3 3 0 1 0-6 0m11 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M15 21h5M7 21V12h9l3 5h6l1 4"/></svg>'));
    w.appendChild(ic);
    var tx = el("span", "co-sw-t");
    var slotChip = $("[name=slot]:checked"), when;
    if (S.when === "now") when = T.today + " · " + T.asap;
    else when = (S.date ? dayLabel(S.date) : "—") + (slotChip ? " · " + slotChip.nextElementSibling.textContent : "");
    tx.appendChild(el("b", null, when));
    var a = addrs.filter(function (x) { return x.id === S.addr; })[0];
    tx.appendChild(el("small", null, S.fulfil === "pickup" ? "Nigilesan Nagar, Tuticorin" : (a ? tagText(a) + " · " + a.building : "—")));
    w.appendChild(tx);
  }

  /* ---------------- steps ---------------- */
  function valid(n, show) {
    var ok = true;
    if (n === 1) {
      if (S.when === "now" && !cfg.open) ok = false;
      if (S.when === "later") {
        if (!S.date) { ok = false; if (show) setErr("date", T.errDate); }
        if (!S.slot) { ok = false; if (show) setErr("slot", T.errSlot); }
      }
    } else if (n === 2) {
      if (S.fulfil === "delivery") {
        if (!addrs.some(function (a) { return a.id === S.addr; })) { ok = false; if (show) setErr("addr", T.chooseAddr); }
      } else {
        var nm = clean($("[data-contact=name]").value, 100), ph = digits($("[data-contact=phone]").value);
        if (nm.length < 2) { ok = false; if (show) setErr("name", T.errName); }
        if (!phoneOk(ph)) { ok = false; if (show) setErr("phone", T.errPhone); }
      }
    } else if (n === 3) {
      var sub = subtotal();
      ok = lines().length > 0 && !(cfg.min > 0 && sub < cfg.min);
    }
    return ok;
  }
  function progress() {
    var done = [valid(1), valid(2), valid(3)];
    $$("[data-co-steps] li").forEach(function (li, i) {
      li.classList.toggle("is-done", done[i] && (STEPPED.matches ? i + 1 < S.step : true));
      li.classList.toggle("is-on", i + 1 === S.step);
    });
    root.setAttribute("data-at", S.step);
    var pct = STEPPED.matches ? (S.step - 1) / 2 : done.filter(Boolean).length / 3;
    $("[data-co-bar]").style.transform = "scaleX(" + pct + ")";
  }
  function goStep(n, fromUser) {
    if (n > S.step) {
      for (var k = S.step; k < n; k++) { if (!valid(k, true)) { shakeStep(k); return false; } }
    }
    var old = S.step; S.step = Math.max(1, Math.min(3, n));
    if (STEPPED.matches) {
      $$(".co-step").forEach(function (s) {
        var m = +s.getAttribute("data-step");
        s.classList.toggle("is-active", m === S.step);
        s.classList.toggle("from-left", m === S.step && S.step < old);
      });
      $("[data-prev]").classList.toggle("is-hidden", S.step === 1);
      $("[data-next-label]").textContent = S.step === 3 ? fill(T.pay, "amt", $("[data-total]").textContent) : T.cont;
      if (fromUser) window.scrollTo({ top: Math.max(0, root.getBoundingClientRect().top + window.pageYOffset - 70), behavior: RM ? "auto" : "smooth" });
    } else if (fromUser) {
      var s = $('.co-step[data-step="' + S.step + '"]');
      window.scrollTo({ top: s.getBoundingClientRect().top + window.pageYOffset - 110, behavior: RM ? "auto" : "smooth" });
    }
    progress(); totals();
    return true;
  }
  function shakeStep(k) {
    var s = $('.co-step[data-step="' + k + '"]');
    if (STEPPED.matches && S.step !== k) { S.step = k; goStep(k); }
    s.classList.remove("is-shake"); void s.offsetWidth; s.classList.add("is-shake");
    var e = $(".co-err:not([hidden])", s); if (e) e.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "center" });
  }
  $$("[data-goto]").forEach(function (li) {
    li.addEventListener("click", function () { var n = +li.getAttribute("data-goto"); if (n <= S.step || !STEPPED.matches) goStep(n, true); else goStep(n, true); });
  });
  $("[data-prev]").addEventListener("click", function () { goStep(S.step - 1, true); });
  $("[data-next]").addEventListener("click", function () { if (S.step < 3) goStep(S.step + 1, true); else placeOrder(); });
  $("[data-pay]").addEventListener("click", placeOrder);
  STEPPED.addEventListener ? STEPPED.addEventListener("change", function () { goStep(S.step); }) : STEPPED.addListener(function () { goStep(S.step); });

  /* desktop: highlight the step the customer is looking at */
  if (!STEPPED.matches && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting && !STEPPED.matches) { S.step = +x.target.getAttribute("data-step"); progress(); } });
    }, { rootMargin: "-45% 0px -45% 0px" });
    $$(".co-step").forEach(function (s) { io.observe(s); });
  }

  /* ---------------- place order ---------------- */
  var busy = false;
  function placeOrder() {
    if (busy) return;
    alertMsg("");
    for (var k = 1; k <= 3; k++) { if (!valid(k, true)) { if (STEPPED.matches) goStep(k); shakeStep(k); return; } }
    var a = addrs.filter(function (x) { return x.id === S.addr; })[0];
    var fd = new FormData();
    fd.append("csrfmiddlewaretoken", csrf);
    fd.append("items", JSON.stringify(lines().map(function (l) { return { id: l.id, qty: l.qty }; })));
    fd.append("fulfilment", S.fulfil); fd.append("when", S.when); fd.append("date", S.date); fd.append("slot", S.slot);
    if (S.fulfil === "delivery" && a) {
      fd.append("name", a.name); fd.append("phone", a.phone); fd.append("building", a.building); fd.append("address", a.address);
      fd.append("landmark", a.landmark); fd.append("label", tagText(a)); fd.append("lat", a.lat); fd.append("lng", a.lng); fd.append("acc", a.acc || "");
    } else {
      fd.append("name", clean($("[data-contact=name]").value, 100)); fd.append("phone", digits($("[data-contact=phone]").value));
    }
    fd.append("notes", clean($("[name=notes]").value, 300));
    fd.append("no_cutlery", $("[name=no_cutlery]").checked ? "1" : "0");
    if (S.coupon) fd.append("coupon", S.coupon.code);
    busy = true; $("[data-busy]").hidden = false; root.classList.add("is-busy");
    fetch(location.pathname, { method: "POST", body: fd, credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok && d.redirect) { location.href = d.redirect; return; }
        busy = false; $("[data-busy]").hidden = true; root.classList.remove("is-busy");
        var e = d.errors || {}, step = 0;
        if (e.date) { setErr("date", e.date); step = step || 1; }
        if (e.slot) { setErr("slot", e.slot); step = step || 1; }
        if (e.name || e.phone || e.building || e.address || e.location) {
          step = step || 2;
          if (S.fulfil === "pickup") { setErr("name", e.name); setErr("phone", e.phone); }
          else { setErr("addr", e.location || e.building || e.address || e.name || e.phone); }
        }
        if (e.coupon) { setErr("coupon", e.coupon); S.coupon = null; showCoupon(); totals(); step = step || 3; }
        if (d.form_error) alertMsg(d.form_error);
        if (step) { if (STEPPED.matches) goStep(step); shakeStep(step); }
      })
      .catch(function () { busy = false; $("[data-busy]").hidden = true; root.classList.remove("is-busy"); alertMsg(T.errNet); });
  }

  /* ---------------- start ---------------- */
  S.addr = read(KEY_SEL) || "";
  applyFulfil(); renderAddrs(); renderItems(); totals(); summary(); goStep(1);
  requestAnimationFrame(function () { root.classList.add("is-ready"); });
})();
