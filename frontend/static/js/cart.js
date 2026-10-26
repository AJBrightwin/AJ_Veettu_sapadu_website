/* AJ Veettu Saapadu — cart (kept in the browser; the server re-checks every price at checkout) */
(function () {
  "use strict";

  var KEY = "ajvs_cart_v1";
  var i18n = JSON.parse(document.getElementById("ajvs-i18n").textContent);
  var lang = i18n.lang;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function load() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || "{}");
      return c && typeof c === "object" ? c : {};
    } catch (e) { return {}; }
  }
  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* storage blocked: cart lives for this page only */ }
  }
  var cart = load();

  function money(n) {
    var v = Math.round(n * 100) / 100;
    return "₹" + (v % 1 === 0 ? v.toLocaleString("en-IN") : v.toLocaleString("en-IN", { minimumFractionDigits: 2 }));
  }
  function lines() { return Object.keys(cart).map(function (k) { return cart[k]; }); }
  function count() { return lines().reduce(function (s, l) { return s + l.qty; }, 0); }
  function subtotal() { return lines().reduce(function (s, l) { return s + l.qty * l.price; }, 0); }
  function nameOf(l) { return lang === "ta" ? (l.ta || l.en) : l.en; }

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }

  /* ----- today's dishes from the server (photos, names, prices, suggestions) ----- */
  var catalog = [], byId = {};
  try { catalog = JSON.parse(document.getElementById("ajvs-catalog").textContent) || []; } catch (e) { catalog = []; }
  catalog.forEach(function (d) { byId[d.id] = d; });
  if (catalog.length) {                       // drop dishes that can't be ordered now, refresh prices & names
    Object.keys(cart).forEach(function (id) {
      var d = byId[id];
      if (!d) { delete cart[id]; return; }
      cart[id].price = parseFloat(d.price); cart[id].en = d.en; cart[id].ta = d.ta;
    });
    save(cart);
  }

  var drawer = document.getElementById("cart-drawer");
  var box = drawer ? drawer.querySelector("[data-cart-items]") : null;
  var minOrder = drawer ? parseFloat(drawer.getAttribute("data-min") || "0") || 0 : 0;
  var LEAF = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 38C12 18 30 8 42 8c-1 18-14 32-34 30z" fill="#2E8B2E"/><path d="M10 37 38 12" stroke="#E4F1D6" stroke-width="2" stroke-linecap="round"/></svg>';
  var TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var MINUS = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

  function photo(id) {
    var d = byId[id];
    if (d && d.img) { var i = el("img", { src: d.img, alt: "", loading: "lazy", decoding: "async" }); return i; }
    var s = el("span", { "class": "cd-leaf" }); s.innerHTML = LEAF; return s;
  }
  function vegMark(id) {
    var d = byId[id], veg = d ? d.veg : true;
    var v = el("span", { "class": "vm" + (veg ? "" : " vm-nv"), title: veg ? i18n.veg : i18n.nonveg }); v.appendChild(el("i"));
    return v;
  }
  function itemsText(n) { return n + " " + (n === 1 ? (i18n.item || "item") : (i18n.items || "items")); }

  function setQty(id, qty) {
    if (!cart[id]) return;
    if (qty <= 0) delete cart[id]; else cart[id].qty = Math.min(qty, 50);
    save(cart); render();
  }

  /* ----- money that counts up / down smoothly ----- */
  var shown = {};
  function tweenMoney(node, to) {
    var from = node._v != null ? node._v : to;
    node._v = to;
    if (reduceMotion || from === to || !node.isConnected) { node.textContent = money(to); return; }
    var t0 = 0, dur = 450;
    cancelAnimationFrame(node._raf);
    (function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      node.textContent = money(Math.round(from + (to - from) * e));
      if (p < 1) node._raf = requestAnimationFrame(step); else node.textContent = money(to);
    })(performance.now());
  }

  /* ----- one dish row in the cart ----- */
  function buildRow(l) {
    var row = el("div", { "class": "cd-line", "data-id": l.id });
    var ph = el("span", { "class": "cd-ph" }); ph.appendChild(photo(l.id));
    var info = el("div", { "class": "cd-info" });
    var nm = el("p", { "class": "cd-nm" }); nm.appendChild(vegMark(l.id)); nm.appendChild(el("span", { "class": "cd-nm-t" }));
    info.appendChild(nm); info.appendChild(el("p", { "class": "cd-each" }));
    var right = el("div", { "class": "cd-right" });
    var q = el("div", { "class": "cd-qty" });
    var dec = el("button", { type: "button", "class": "cd-dec", "data-act": "dec" });
    var n = el("b", { "class": "cd-n", "aria-live": "polite" });
    var inc = el("button", { type: "button", "class": "cd-inc", "data-act": "inc", "aria-label": "+" }); inc.innerHTML = PLUS;
    q.appendChild(dec); q.appendChild(n); q.appendChild(inc);
    right.appendChild(q); right.appendChild(el("b", { "class": "cd-lp" }));
    row.appendChild(ph); row.appendChild(info); row.appendChild(right);
    return row;
  }
  function updateRow(row, l) {
    row.querySelector(".cd-nm-t").textContent = nameOf(l);
    row.querySelector(".cd-each").textContent = money(l.price) + " " + (i18n.each || "each");
    var n = row.querySelector(".cd-n"), old = parseInt(n.textContent || "0", 10);
    if (old !== l.qty) {
      n.textContent = l.qty;
      if (old && !reduceMotion) { n.classList.remove("is-up", "is-down"); void n.offsetWidth; n.classList.add(l.qty > old ? "is-up" : "is-down"); }
    }
    var dec = row.querySelector(".cd-dec");
    var trash = l.qty === 1;
    if (dec._trash !== trash) { dec.innerHTML = trash ? TRASH : MINUS; dec._trash = trash; dec.classList.toggle("is-trash", trash); }
    dec.setAttribute("aria-label", trash ? (i18n.remove || "Remove") : "−");
    tweenMoney(row.querySelector(".cd-lp"), l.qty * l.price);
  }
  function removeRow(row) {
    if (row._out) return; row._out = true;
    if (reduceMotion || !row.animate) { row.remove(); return; }
    var h = row.offsetHeight;
    row.style.overflow = "hidden";
    var a = row.animate([{ opacity: 1, transform: "none", height: h + "px" },
                         { opacity: 0, transform: "translateX(40px)", height: h + "px", offset: .45 },
                         { opacity: 0, transform: "translateX(40px)", height: "0px", paddingTop: "0px", paddingBottom: "0px" }],
                        { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" });
    a.onfinish = function () { row.remove(); };
  }

  function renderEmpty(on) {
    var e = box.querySelector(".cd-empty");
    if (on && !e) {
      e = el("div", { "class": "cd-empty" });
      var art = el("div", { "class": "cd-empty-art", "aria-hidden": "true" });
      art.innerHTML = '<svg viewBox="0 0 160 110"><ellipse cx="80" cy="96" rx="60" ry="8" fill="rgba(20,63,29,.12)"/>' +
        '<ellipse cx="80" cy="66" rx="66" ry="30" fill="#FFFDF7" stroke="#C9961A" stroke-width="2.4"/><ellipse cx="80" cy="66" rx="52" ry="22" fill="none" stroke="#E7D9B4" stroke-width="1.4"/>' +
        '<path d="M30 70c14-30 64-40 96-20-14 28-62 40-96 20z" fill="#2E8B2E"/><path d="M34 69 124 51" stroke="#DFF3CF" stroke-width="1.8"/>' +
        '<g class="cd-steam" fill="none" stroke="#C9961A" stroke-width="2.2" stroke-linecap="round"><path d="M66 28c-5-7 4-10 0-17"/><path d="M80 24c-5-7 4-10 0-17"/><path d="M94 28c-5-7 4-10 0-17"/></g></svg>';
      e.appendChild(art);
      e.appendChild(el("p", { "class": "cd-empty-t" }, i18n.emptyT || i18n.empty));
      e.appendChild(el("p", { "class": "cd-empty-d" }, i18n.emptyD || ""));
      var a = el("a", { "class": "cd-browse", href: drawer.getAttribute("data-menu-url") || "/menu/" }, i18n.browse || "Menu");
      e.appendChild(a);
      box.appendChild(e);
    } else if (!on && e) e.remove();
  }

  var lastSugg = "";
  function renderSuggestions(ls) {
    var sec = drawer.querySelector("[data-cd-sugg]"), row = drawer.querySelector("[data-cd-sugg-row]");
    if (!sec || !row) return;
    var inCart = {}; ls.forEach(function (l) { inCart[l.id] = 1; });
    var pick = catalog.map(function (d, k) { return { d: d, k: k }; })
      .filter(function (x) { return !inCart[x.d.id]; })
      .sort(function (a, b) { return (a.d.rank - b.d.rank) || (a.k - b.k); })
      .slice(0, 6).map(function (x) { return x.d; });
    sec.hidden = !ls.length || !pick.length;
    var key = pick.map(function (d) { return d.id; }).join(",") + "|" + lang;
    if (key === lastSugg) return;
    lastSugg = key;
    row.innerHTML = "";
    pick.forEach(function (d, k) {
      var c = el("div", { "class": "cd-sc", style: "--i:" + k });
      var ph = el("span", { "class": "cd-sc-ph" }); ph.appendChild(photo(d.id)); ph.appendChild(vegMark(d.id));
      c.appendChild(ph);
      c.appendChild(el("p", { "class": "cd-sc-nm" }, lang === "ta" ? (d.ta || d.en) : d.en));
      var ft = el("div", { "class": "cd-sc-ft" });
      ft.appendChild(el("b", null, money(parseFloat(d.price))));
      var add = el("button", { type: "button", "class": "cd-sc-add", "data-sugg": d.id });
      add.innerHTML = PLUS + "<span>" + (i18n.add || "Add") + "</span>";
      ft.appendChild(add);
      c.appendChild(ft);
      row.appendChild(c);
    });
  }

  function renderDrawer() {
    if (!drawer || !box) return;
    var ls = lines(), n = count(), sub = subtotal();
    renderEmpty(!ls.length);
    var rows = {};
    box.querySelectorAll(".cd-line").forEach(function (r) { if (!r._out) rows[r.getAttribute("data-id")] = r; });
    ls.forEach(function (l, k) {
      var r = rows[l.id];
      if (!r) {
        r = buildRow(l); r.classList.add("is-new"); r.style.setProperty("--i", k);
        box.appendChild(r);
      }
      delete rows[l.id];
      updateRow(r, l);
    });
    Object.keys(rows).forEach(function (id) { removeRow(rows[id]); });

    drawer.querySelectorAll("[data-cd-count]").forEach(function (c) { c.textContent = itemsText(n); });
    drawer.querySelectorAll("[data-cart-subtotal]").forEach(function (c) { tweenMoney(c, sub); });
    var bill = drawer.querySelector("[data-cd-bill]"); if (bill) bill.hidden = !ls.length;
    drawer.classList.toggle("is-empty", !ls.length);

    var minBox = drawer.querySelector("[data-cd-min]"), below = minOrder > 0 && sub > 0 && sub < minOrder;
    if (minBox) {
      minBox.hidden = !below;
      if (below) {
        minBox.querySelector("[data-cd-min-t]").textContent = (i18n.min || "Add {amt} more").replace("{amt}", money(minOrder - sub));
        minBox.querySelector("[data-cd-min-bar]").style.transform = "scaleX(" + (sub / minOrder).toFixed(3) + ")";
      }
    }
    var pay = drawer.querySelector("[data-checkout-link]");
    if (pay) { pay.classList.toggle("is-disabled", !n || below); pay.setAttribute("aria-disabled", (!n || below) ? "true" : "false"); }
    renderSuggestions(ls);
  }

  if (box) {
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var id = b.closest(".cd-line").getAttribute("data-id");
      if (!cart[id]) return;
      setQty(id, cart[id].qty + (b.getAttribute("data-act") === "inc" ? 1 : -1));
    });
  }
  if (drawer) {
    drawer.addEventListener("click", function (e) {
      var s = e.target.closest("[data-sugg]");
      if (s) {
        var d = byId[s.getAttribute("data-sugg")]; if (!d) return;
        var card = s.closest(".cd-sc");
        if (card && card.animate && !reduceMotion) card.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-14px) scale(.9)", opacity: 0 }], { duration: 320, easing: "ease-in" });
        setTimeout(function () {
          if (!cart[d.id]) cart[d.id] = { id: d.id, en: d.en, ta: d.ta, price: parseFloat(d.price), qty: 0 };
          cart[d.id].qty = Math.min(cart[d.id].qty + 1, 50);
          save(cart); render(); bumpCart();
          var sc = drawer.querySelector("[data-cd-scroll]");
          if (sc) sc.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
        }, reduceMotion ? 0 : 280);
        return;
      }
      var pay = e.target.closest("[data-checkout-link]");
      if (pay && pay.classList.contains("is-disabled")) e.preventDefault();
    });
  }

  function render() {
    document.querySelectorAll("[data-cart-count]").forEach(function (n) { n.textContent = count(); });
    document.querySelectorAll("[data-cart-subtotal]").forEach(function (n) { if (!drawer || !drawer.contains(n)) n.textContent = money(subtotal()); });
    renderDrawer();
    renderCheckout();
    try {
      document.dispatchEvent(new CustomEvent("ajvs:cart", { detail: { count: count(), subtotal: subtotal() } }));
    } catch (e) { /* very old browser: pages just don't live-update */ }
  }

  /* ----- cart icon bump + flying dot from the Add button ----- */
  function bumpCart() {
    document.querySelectorAll(".cart-btn").forEach(function (b) {
      b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    });
    document.querySelectorAll("[data-cart-count]").forEach(function (c) {
      c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop");
    });
  }
  function flyToCart(fromEl) {
    var bar = document.querySelector("[data-mn-bar].is-on");         // menu page on phones: fly into the bottom bar
    var target = bar && getComputedStyle(bar).display !== "none" ? bar.querySelector(".mn-bar-ic") || bar : document.querySelector(".site-header .cart-btn");
    if (reduceMotion || !target || !fromEl.animate) { bumpCart(); return; }
    var a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    var x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    var x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    var dot = el("span", { "class": "fly-dot", "aria-hidden": "true" });
    dot.style.left = x0 + "px"; dot.style.top = y0 + "px";
    document.body.appendChild(dot);
    var dx = x1 - x0, dy = y1 - y0;
    var anim = dot.animate([
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: "translate(" + dx * 0.45 + "px," + (dy * 0.45 - 90) + "px) scale(1.25)", opacity: 1, offset: 0.5 },
      { transform: "translate(" + dx + "px," + dy + "px) scale(.4)", opacity: .6 }
    ], { duration: 700, easing: "cubic-bezier(.5,0,.4,1)" });
    anim.onfinish = function () { dot.remove(); bumpCart(); };
  }

  /* ----- drawer: side panel on computers, full-screen page on phones ----- */
  var backdrop = document.querySelector(".drawer-backdrop");
  var lastFocus = null, animTimer = 0;
  function openDrawer() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    render();
    backdrop.hidden = false; void backdrop.offsetWidth; backdrop.classList.add("is-on");
    drawer.classList.add("is-open", "cd-anim"); drawer.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("cd-lock");
    clearTimeout(animTimer); animTimer = setTimeout(function () { drawer.classList.remove("cd-anim"); }, 1400);
    var sc = drawer.querySelector("[data-cd-scroll]"); if (sc) sc.scrollTop = 0;
    setTimeout(function () { var b = drawer.querySelector(".cd-x"); if (b && b.offsetParent) b.focus({ preventScroll: true }); }, 60);   // phones: no focus ring on open
  }
  function closeDrawer() {
    if (!drawer || !drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true");
    backdrop.classList.remove("is-on");
    document.documentElement.classList.remove("cd-lock");
    setTimeout(function () { if (!drawer.classList.contains("is-open")) backdrop.hidden = true; }, 500);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.querySelectorAll("[data-cart-open]").forEach(function (b) { b.addEventListener("click", openDrawer); });
  document.querySelectorAll("[data-cart-close]").forEach(function (b) { b.addEventListener("click", closeDrawer); });
  document.addEventListener("keydown", function (e) {
    if (!drawer || !drawer.classList.contains("is-open")) return;
    if (e.key === "Escape") closeDrawer();
    else if (e.key === "Tab") {                                   // keep focus inside the cart
      var f = Array.prototype.filter.call(drawer.querySelectorAll("button, a[href]"), function (x) { return x.offsetParent !== null && !x.classList.contains("is-disabled"); });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
    }
  });

  /* ----- add buttons ----- */
  document.querySelectorAll("[data-add]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.dataset.id;
      if (!cart[id]) cart[id] = { id: id, en: b.dataset.nameEn, ta: b.dataset.nameTa, price: parseFloat(b.dataset.price), qty: 0 };
      cart[id].qty = Math.min(cart[id].qty + 1, 50);
      save(cart); render();
      flyToCart(b);
      b.classList.add("is-added"); b.textContent = i18n.added;
      setTimeout(function () { b.classList.remove("is-added"); b.textContent = i18n.add; }, 1100);
    });
  });

  /* ----- small API used by the menu page (steppers, dish pop-up) ----- */
  window.AJVSCart = {
    qty: function (id) { return cart[id] ? cart[id].qty : 0; },
    add: function (data, fromEl) {
      var id = String(data.id);
      var d = byId[id];
      if (!cart[id]) cart[id] = { id: id, en: d ? d.en : data.nameEn, ta: d ? d.ta : data.nameTa, price: parseFloat(d ? d.price : data.price), qty: 0 };
      cart[id].qty = Math.min(cart[id].qty + 1, 50);
      save(cart); render();
      if (fromEl) flyToCart(fromEl); else bumpCart();
    },
    set: function (id, qty) { setQty(String(id), qty); },
    lines: function () { return lines().map(function (l) { return { id: l.id, qty: l.qty, price: l.price, en: l.en, ta: l.ta }; }); },
    dish: function (id) { return byId[id] || null; },
    count: count,
    subtotal: subtotal,
    money: money
  };

  /* ----- checkout page ----- */
  var form = document.querySelector("[data-checkout-form]");
  var live = document.getElementById("ajvs-live-prices");
  if (form && live) {
    // sync cart with today's prices and availability from the server
    var prices = JSON.parse(live.textContent);
    Object.keys(cart).forEach(function (id) {
      if (prices[id] == null) delete cart[id]; else cart[id].price = parseFloat(prices[id]);
    });
    save(cart);
    var area = form.querySelector("select[name=delivery_area]");
    if (area) area.addEventListener("change", renderCheckout);
    form.addEventListener("submit", function () {
      form.querySelector("input[name=items]").value = JSON.stringify(lines().map(function (l) { return { id: l.id, qty: l.qty }; }));
      var btn = form.querySelector("button[type=submit]"); if (btn) { btn.disabled = true; }
    });
  }

  function renderCheckout() {
    if (!form) return;
    var list = document.querySelector("[data-summary-items]");
    list.innerHTML = "";
    lines().forEach(function (l) {
      var li = el("li");
      li.appendChild(el("span", null, l.qty + " × " + nameOf(l)));
      li.appendChild(el("span", null, money(l.qty * l.price)));
      list.appendChild(li);
    });
    var sub = subtotal();
    var opt = form.querySelector("select[name=delivery_area] option:checked");
    var fee = opt && opt.dataset.fee ? parseFloat(opt.dataset.fee) : 0;
    var freeAbove = parseFloat(form.dataset.freeAbove || "0");
    if (freeAbove > 0 && sub >= freeAbove) fee = 0;
    document.querySelector("[data-sum-sub]").textContent = money(sub);
    document.querySelector("[data-sum-fee]").textContent = fee === 0 && opt && opt.value ? form.dataset.freeLabel : money(fee);
    document.querySelector("[data-sum-total]").textContent = money(sub + fee);
    var empty = document.querySelector("[data-summary-empty]");
    if (empty) empty.hidden = lines().length > 0;
    var btn = form.querySelector("button[type=submit]");
    if (btn) btn.disabled = lines().length === 0 || form.dataset.closed === "1";
  }

  /* ----- success page: clear the cart ----- */
  if (document.querySelector("[data-clear-cart]")) { cart = {}; save(cart); }

  render();
})();
