/* ============================================
   TUGA HARDWARE — /admin page (back office)
   Served by the worker, not the static build, so
   it never lands in the sitemap or the assets.
   The page holds no data: it asks /api/admin/*
   with the ADMIN_TOKEN the user types in once.
   Screens are hash routes (#/sales/TUGA-0427) so
   the phone's back gesture works.
   ============================================ */

export const ADMIN_PAGE = String.raw`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Tuga Back Office</title>
<link rel="icon" href="/favicon.svg">
<style>
  :root {
    --bg: #faf7f2; --surface: #fffcf7; --raised: #ffffff;
    --ink: #1a1a18; --ink-mid: #4a4a45; --ink-light: #6b6b64;
    --rule: rgba(5,46,22,0.12); --rule-strong: rgba(5,46,22,0.22);
    --accent: #a66b54; --accent-ink: #ffffff; --accent-soft: #f4e6df;
    --ok: #2f6b45; --ok-soft: #e2efe6; --warn: #8a5a00; --warn-soft: #f6ead0;
    --bad: #a3361f; --bad-soft: #f6e0da; --info: #2d5a86; --info-soft: #e1ebf5;
    --mute-soft: #ece8e0;
    --font: 'Helvetica Neue', Arial, sans-serif;
    --mono: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #161512; --surface: #1f1d19; --raised: #26231e;
      --ink: #f3efe6; --ink-mid: #c9c2b5; --ink-light: #9a9385;
      --rule: rgba(247,244,239,0.12); --rule-strong: rgba(247,244,239,0.24);
      --accent: #d4a088; --accent-ink: #1a1a18; --accent-soft: #3a2a22;
      --ok: #7cc597; --ok-soft: #1f3327; --warn: #e4b85c; --warn-soft: #3a2f15;
      --bad: #ee8a70; --bad-soft: #3d221b; --info: #8db7e2; --info-soft: #1c2a38;
      --mute-soft: #2c2924;
      color-scheme: dark;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font); font-size: 16px; line-height: 1.4; }
  button, input, select, textarea { font: inherit; color: inherit; }
  a { color: var(--accent); }
  .wrap { max-width: 960px; margin: 0 auto; padding: 0 16px 80px; }
  header { position: sticky; top: 0; z-index: 5; background: var(--bg); border-bottom: 1px solid var(--rule); }
  .bar { max-width: 960px; margin: 0 auto; padding: 12px 16px 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .brand { font-weight: 800; font-size: 18px; letter-spacing: -0.01em; }
  .brand span { color: var(--accent); }
  .tabs { max-width: 960px; margin: 0 auto; padding: 0 8px; display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
  .tabs::-webkit-scrollbar { display: none; }
  .tab { background: none; border: none; padding: 12px 10px 10px; font-weight: 600; color: var(--ink-light); border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; }
  .tab.on { color: var(--ink); border-bottom-color: var(--accent); }
  .link { background: none; border: none; color: var(--ink-light); font-size: 14px; cursor: pointer; padding: 6px; text-decoration: none; }
  h2 { font-size: 21px; margin: 22px 0 6px; }
  h3 { font-size: 16px; margin: 22px 0 8px; }
  .muted { color: var(--ink-light); font-size: 14px; }
  .back { display: inline-block; margin-top: 16px; font-size: 14px; color: var(--ink-light); text-decoration: none; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .btn { border: none; border-radius: 10px; padding: 11px 16px; font-weight: 700; cursor: pointer; background: var(--accent); color: var(--accent-ink); text-decoration: none; display: inline-block; }
  .btn.ghost { background: var(--raised); color: var(--ink); border: 1px solid var(--rule-strong); }
  .btn.danger { background: none; color: var(--bad); border: 1px solid var(--bad); }
  .btn.sm { padding: 7px 12px; font-size: 14px; }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .grid-sum { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 12px; }
  .sum { background: var(--raised); border: 1px solid var(--rule); border-radius: 12px; padding: 12px; }
  .sum .n { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .sum .l { font-size: 13px; color: var(--ink-mid); }
  .tools { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0 10px; align-items: center; }
  .tools input { flex: 1 1 220px; }
  input[type=text], input[type=search], input[type=date], input[type=password], input[type=email], input[type=tel], input[type=number], select, textarea {
    width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--rule-strong); background: var(--raised); min-width: 0;
  }
  textarea { min-height: 76px; resize: vertical; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .chip { border: 1px solid var(--rule-strong); background: var(--raised); border-radius: 999px; padding: 6px 12px; font-size: 14px; cursor: pointer; }
  .chip.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .list { background: var(--raised); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; }
  .row { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; padding: 12px 14px; border-bottom: 1px solid var(--rule); color: inherit; text-decoration: none; }
  .row:last-child { border-bottom: none; }
  a.row:hover { background: var(--surface); }
  .row .t { font-weight: 700; }
  .row .s { color: var(--ink-mid); font-size: 14px; }
  .row .r { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .mono { font-family: var(--mono); font-size: 0.92em; overflow-wrap: anywhere; }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pill { display: inline-block; border-radius: 999px; padding: 3px 10px; font-size: 12.5px; font-weight: 700; white-space: nowrap; }
  .st-in_stock, .st-received, .st-paid, .st-in, .st-delivered { background: var(--ok-soft); color: var(--ok); }
  .st-reserved, .st-returned, .st-part_received, .st-awaiting_payment, .st-pending, .st-return, .st-ordered { background: var(--warn-soft); color: var(--warn); }
  .st-assigned, .st-dispatched, .st-out { background: var(--info-soft); color: var(--info); }
  .st-sold, .st-quote, .st-cancelled, .st-adjust { background: var(--mute-soft); color: var(--ink-mid); }
  .st-faulty { background: var(--bad-soft); color: var(--bad); }
  .vbar { display: block; height: 8px; border-radius: 4px; background: var(--accent); margin: 6px 0 0; min-width: 2px; }
  .card { background: var(--raised); border: 1px solid var(--rule); border-radius: 12px; padding: 14px; margin-top: 12px; }
  form .f { margin-bottom: 12px; }
  form label, .lbl { display: block; font-size: 13px; font-weight: 700; color: var(--ink-mid); margin-bottom: 5px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .hint { font-size: 13px; margin-top: 4px; min-height: 1em; }
  .hint.bad { color: var(--bad); } .hint.ok { color: var(--ok); }
  .msg { padding: 10px 12px; border-radius: 10px; margin: 12px 0; font-size: 14px; }
  .msg.bad { background: var(--bad-soft); color: var(--bad); }
  .msg.ok { background: var(--ok-soft); color: var(--ok); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .empty { padding: 28px 16px; text-align: center; color: var(--ink-light); }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; font-size: 15px; }
  dt { color: var(--ink-light); }
  dd { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
  .hist { font-size: 14px; border-left: 2px solid var(--rule-strong); padding-left: 12px; }
  .hist div { margin-bottom: 8px; }
  table.lines { width: 100%; border-collapse: collapse; font-size: 15px; }
  table.lines th { text-align: left; font-size: 12.5px; color: var(--ink-light); font-weight: 700; padding: 6px 4px; border-bottom: 1px solid var(--rule); }
  table.lines td { padding: 8px 4px; border-bottom: 1px solid var(--rule); vertical-align: top; }
  table.lines .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.lines tfoot td { border-bottom: none; padding-top: 6px; }
  .line-ed { border: 1px solid var(--rule); border-radius: 10px; padding: 10px; margin-bottom: 8px; background: var(--surface); }
  .line-ed .grid { display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 8px; align-items: end; }
  .contact-ed { border: 1px solid var(--rule); border-radius: 10px; padding: 10px; margin-bottom: 8px; background: var(--surface); }
  .unit-ed { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .pick { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 14.5px; }
  .login { max-width: 380px; margin: 12vh auto 0; }
  .pick-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--rule); padding: 4px 0; }
  .pick-row select { width: auto; padding: 6px 8px; font-size: 14px; }
  .attn { border-color: var(--warn); background: var(--warn-soft); margin-top: 14px; }
  .attn a { color: var(--ink); }
  .claim { border-top: 1px solid var(--rule); padding: 10px 0; }
  .claim:first-child { border-top: none; }
  .x { background: none; border: none; color: var(--ink-light); font-size: 20px; cursor: pointer; padding: 6px 8px; }
  .margin-ok { color: var(--ok); font-weight: 700; }
  @media (max-width: 560px) {
    .two, .three { grid-template-columns: 1fr; }
    .line-ed .grid { grid-template-columns: 1fr 1fr; }
    .line-ed .grid .wide { grid-column: 1 / -1; }
    .unit-ed { grid-template-columns: 1fr; padding-bottom: 8px; border-bottom: 1px solid var(--rule); }
  }
</style>
</head>
<body>
<div id="root"></div>
<script>
(function () {
  'use strict';
  var TOKEN_KEY = 'tugaAdminToken';
  var token = '';
  try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}

  var META = null;
  var UI = { stockFilter: 'all', stockQ: '', moveFilter: 'all', saleFilter: 'open', visitDays: 30, visitUk: true };
  var root = document.getElementById('root');

  /* ---------------- helpers ---------------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function val(sel) { var e = $(sel); return e ? e.value : ''; }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtWhen(iso) {
    var d = new Date(iso);
    return isNaN(d) ? (iso || '') : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function money(p) { return p == null || p === '' ? '—' : (p < 0 ? '−' : '') + '£' + (Math.abs(p) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function daysFrom(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
  function plusDays(a, n) { return new Date(Date.parse(a + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
  /* Where a unit's cover stands today, in words and a pill class. */
  function coverState(w) {
    if (!w) return { label: 'No warranty yet', cls: 'quote', left: null };
    var left = daysFrom(today(), w.end);
    if (left < 0) return { label: 'Expired ' + fmtDate(w.end), cls: 'cancelled', left: left };
    if (left <= 30) return { label: left + ' days left', cls: 'returned', left: left };
    return { label: 'Active until ' + fmtDate(w.end), cls: 'in_stock', left: left };
  }
  function toPence(v) { var n = parseFloat(String(v).replace(/[£,\s]/g, '')); return isNaN(n) ? 0 : Math.round(n * 100); }
  function toPounds(p) { return p ? (p / 100).toFixed(2) : ''; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function luhn(s) {
    if (!/^\d{15}$/.test(s)) return false;
    var sum = 0;
    for (var i = 0; i < 15; i++) { var d = +s[14 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
    return sum % 10 === 0;
  }
  function pill(status, labels) { return '<span class="pill st-' + esc(status) + '">' + esc((labels && labels[status]) || status) + '</span>'; }
  function opts(map, sel, blank) {
    return (blank != null ? '<option value="">' + esc(blank) + '</option>' : '') +
      Object.keys(map).map(function (k) { return '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join('');
  }
  function field(label, id, html) { return '<div class="f"><label for="' + id + '">' + esc(label) + '</label>' + html + '</div>'; }
  function input(id, value, attrs) { return '<input type="' + ((attrs && attrs.type) || 'text') + '" id="' + id + '" value="' + esc(value) + '"' + ((attrs && attrs.extra) || '') + '>'; }
  function area(id, value, ph) { return '<textarea id="' + id + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(value) + '</textarea>'; }
  function errBox(sel, err) { var b = $(sel); if (b) b.innerHTML = '<div class="msg bad">' + esc(err.message || err) + '</div>'; }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function main() { return $('#main'); }
  function loading() { main().innerHTML = '<p class="muted" style="margin-top:24px">Loading…</p>'; }
  function busy(btn, on) { if (btn) btn.disabled = on; }

  function api(method, path, body) {
    return fetch('/api/admin/' + path, {
      method: method,
      headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (r.status === 404 && path === 'meta') throw { auth: true };
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || ('Request failed (' + r.status + ')'));
        return data;
      });
    });
  }

  /* ---------------- login & shell ---------------- */
  function renderLogin(err) {
    root.innerHTML =
      '<div class="wrap"><form class="login" id="loginForm">' +
      '<div class="brand" style="font-size:24px;margin-bottom:6px">Tuga <span>Back Office</span></div>' +
      '<p class="muted">Enter the admin token (the ADMIN_TOKEN secret). It stays on this device.</p>' +
      (err ? '<div class="msg bad">' + esc(err) + '</div>' : '') +
      field('Admin token', 'tok', '<input type="password" id="tok" autocomplete="current-password" required>') +
      '<button class="btn" type="submit">Sign in</button></form></div>';
    $('#loginForm').onsubmit = function (e) { e.preventDefault(); token = val('#tok').trim(); boot(true); };
  }

  function boot(remember) {
    api('GET', 'meta').then(function (m) {
      META = m;
      if (remember) { try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {} }
      shell();
      route();
    }).catch(function (e) {
      if (e && e.auth) { try { localStorage.removeItem(TOKEN_KEY); } catch (x) {} renderLogin(token ? 'That token was not accepted.' : ''); }
      else renderLogin(e.message || 'Could not reach the server.');
    });
  }

  var TABS = [['stock', 'Stock'], ['in', 'Goods in'], ['sales', 'Sales'], ['customers', 'Customers'], ['suppliers', 'Suppliers'], ['warranty', 'Warranty'], ['moves', 'Movements'], ['visits', 'Visits']];
  function shell() {
    root.innerHTML =
      '<header><div class="bar"><div class="brand">Tuga <span>Back Office</span></div>' +
      '<div><a class="link" href="#/import">Import</a><button class="link" id="out">Sign out</button></div></div>' +
      '<nav class="tabs" id="tabs">' + TABS.map(function (t) { return '<a class="tab" data-tab="' + t[0] + '" href="#/' + t[0] + '">' + t[1] + '</a>'; }).join('') +
      '</nav></header><main class="wrap" id="main"></main>';
    $('#out').onclick = function () { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} token = ''; location.hash = ''; renderLogin(); };
  }

  function route() {
    if (!META) return;
    var parts = (location.hash.replace(/^#\/?/, '') || 'stock').split('/').map(decodeURIComponent);
    var tab = { device: 'stock' }[parts[0]] || parts[0];
    $$('[data-tab]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-tab') === tab); });
    window.scrollTo(0, 0);
    var p0 = parts[0], p1 = parts[1], p2 = parts[2];
    if (p0 === 'stock') return stockList();
    if (p0 === 'device') return deviceView(p1);
    if (p0 === 'in') return !p1 ? purchaseList() : p1 === 'new' ? purchaseForm() : p1 === 'quick' ? quickReceive() : p2 === 'edit' ? purchaseForm(p1) : purchaseView(p1);
    if (p0 === 'sales') return !p1 ? saleList() : p1 === 'new' ? saleForm(null, p2) : p2 === 'edit' ? saleForm(p1) : saleView(p1);
    if (p0 === 'web') return webOrderView(p1);
    if (p0 === 'customers') return !p1 ? customerList() : p1 === 'new' ? customerForm() : p2 === 'edit' ? customerForm(p1) : customerView(p1);
    if (p0 === 'suppliers') return !p1 ? supplierList() : p1 === 'new' ? supplierForm() : p2 === 'edit' ? supplierForm(p1) : supplierView(p1);
    if (p0 === 'moves') return moveList();
    if (p0 === 'visits') return visitsView();
    if (p0 === 'warranty') return warrantyView();
    if (p0 === 'import') return importView();
    if (p0 === 'load') return loadView(p1);
    stockList();
  }
  window.addEventListener('hashchange', route);

  /* ================= STOCK ================= */
  function stockList() {
    loading();
    api('GET', 'devices').then(function (r) {
      var devs = r.devices, models = META.models, statuses = META.deviceStatuses;
      var byModel = {}, onHand = 0, value = 0;
      devs.forEach(function (d) {
        var m = byModel[d.model] || (byModel[d.model] = { total: 0, in: 0 });
        m.total++;
        if (d.status === 'in_stock') { m.in++; onHand++; }
      });
      function matches(d) {
        if (UI.stockFilter !== 'all' && d.status !== UI.stockFilter) return false;
        if (!UI.stockQ) return true;
        var q = UI.stockQ.toLowerCase();
        return [d.serial, d.imei1, d.assignedTo, d.orderId, d.poId, models[d.model]].some(function (v) { return v && String(v).toLowerCase().indexOf(q) > -1; });
      }
      function draw() {
        var shown = devs.filter(matches);
        $('#stockRows').innerHTML = devs.length
          ? (shown.length ? shown.map(function (d) {
            return '<a class="row" href="#/device/' + encodeURIComponent(d.serial) + '"><div><div class="t">' + esc(models[d.model] || d.model) + '</div>' +
              '<div class="s mono">' + esc(d.serial) + '</div><div class="s">' + (d.assignedTo ? esc(d.assignedTo) + ' · ' : '') + 'in ' + esc(fmtDate(d.receivedAt)) + (d.poId ? ' · ' + esc(d.poId) : '') + '</div></div>' +
              '<div class="r">' + pill(d.status, statuses) + '</div></a>';
          }).join('') : '<div class="empty">Nothing matches.</div>')
          : '<div class="empty">No units recorded yet. Book stock in from <a href="#/in">Goods in</a>.</div>';
      }
      main().innerHTML =
        '<div class="head"><h2>Stock</h2><div class="actions"><a class="btn ghost sm" href="#/in/quick">Quick receive</a></div></div>' +
        '<p class="muted">' + onHand + ' unit' + (onHand === 1 ? '' : 's') + ' on the shelf · ' + devs.length + ' recorded in total</p>' +
        '<div id="attn"></div>' +
        '<div class="grid-sum">' + Object.keys(models).filter(function (id) { return byModel[id]; }).map(function (id) {
          return '<div class="sum"><div class="n">' + byModel[id].in + '</div><div class="l">' + esc(models[id]) + ' in stock<br>' + byModel[id].total + ' recorded</div></div>';
        }).join('') + '</div>' +
        '<div class="tools"><input type="search" id="q" placeholder="Search serial, IMEI, customer, order, PO" value="' + esc(UI.stockQ) + '"></div>' +
        '<div class="chips">' + [['all', 'All']].concat(Object.keys(statuses).map(function (k) { return [k, statuses[k]]; })).map(function (p) {
          return '<button class="chip' + (UI.stockFilter === p[0] ? ' on' : '') + '" data-f="' + p[0] + '">' + esc(p[1]) + '</button>';
        }).join('') + '</div><div class="list" id="stockRows"></div>';
      draw();
      loadAttention();
      $('#q').oninput = function () { UI.stockQ = this.value; draw(); };
      $$('[data-f]').forEach(function (b) {
        b.onclick = function () { UI.stockFilter = b.getAttribute('data-f'); $$('[data-f]').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); };
      });
    }).catch(function (e) { errBox('#main', e); });
  }

  /* The same list the morning email sends, so nothing is a surprise. */
  function loadAttention() {
    api('GET', 'attention').then(function (r) {
      var box = $('#attn');
      if (!box || !r.sections.length) return;
      box.innerHTML = '<div class="card attn"><div class="lbl" style="margin-bottom:8px">Needs attention</div>' + r.sections.map(function (sec) {
        return '<div style="margin-bottom:10px"><a href="' + esc(sec.link) + '"><strong>' + esc(sec.title) + '</strong></a> <span class="muted">(' + sec.lines.length + ')</span>' +
          '<div class="muted">' + sec.lines.slice(0, 3).map(esc).join('<br>') + (sec.lines.length > 3 ? '<br>…' : '') + '</div></div>';
      }).join('') + '</div>';
    }).catch(function () {});
  }

  function deviceView(serial) {
    loading();
    api('GET', 'devices/' + encodeURIComponent(serial)).then(function (r) {
      var d = r.device, S = META.deviceStatuses;
      var hist = (d.history || []).slice().reverse().map(function (h) {
        return '<div><strong>' + esc(h.event) + '</strong><br><span class="muted">' + esc(fmtWhen(h.at)) + (h.by ? ' · ' + esc(h.by) : '') + '</span></div>';
      }).join('');
      var canReturn = d.status === 'sold' || d.status === 'assigned';
      var margin = d.soldPrice != null && d.unitCost != null ? d.soldPrice - d.unitCost : null;
      main().innerHTML =
        '<a class="back" href="#/stock">← Stock</a>' +
        '<div class="head"><h2>' + esc(META.models[d.model] || d.model) + '</h2>' + pill(d.status, S) + '</div>' +
        '<div class="card"><dl><dt>Serial</dt><dd class="mono">' + esc(d.serial) + '</dd>' +
        (d.imei1 ? '<dt>IMEI 1</dt><dd class="mono">' + esc(d.imei1) + '</dd>' : '') +
        (d.imei2 ? '<dt>IMEI 2</dt><dd class="mono">' + esc(d.imei2) + '</dd>' : '') +
        '<dt>Received</dt><dd>' + esc(fmtDate(d.receivedAt)) + '</dd>' +
        (d.supplier ? '<dt>Supplier</dt><dd>' + (d.supplierId ? '<a href="#/suppliers/' + esc(d.supplierId) + '">' + esc(d.supplier) + '</a>' : esc(d.supplier)) + '</dd>' : '') +
        (d.poId ? '<dt>Purchase order</dt><dd><a href="#/in/' + esc(d.poId) + '">' + esc(d.poId) + '</a></dd>' : '') +
        '<dt>Landed cost</dt><dd class="num">' + money(d.unitCost) + '</dd>' +
        (d.saleId ? '<dt>Sales order</dt><dd><a href="#/sales/' + esc(d.saleId) + '">' + esc(d.saleId) + '</a></dd>' : '') +
        (d.customerId ? '<dt>Customer</dt><dd><a href="#/customers/' + esc(d.customerId) + '">' + esc(d.assignedTo || d.customerId) + '</a></dd>' : '') +
        (d.soldPrice != null ? '<dt>Sold for</dt><dd class="num">' + money(d.soldPrice) + (margin != null ? ' · <span class="margin-ok">margin ' + money(margin) + '</span>' : '') + '</dd>' : '') +
        '</dl></div>' +
        warrantyCard(d) +
        (canReturn ? '<div class="card"><h3 style="margin-top:0">Book a return</h3><form id="ret"><div class="three">' +
          field('Comes back as', 'rtStatus', '<select id="rtStatus"><option value="returned">Returned (check it over)</option><option value="in_stock">Straight back in stock</option><option value="faulty">Faulty</option></select>') +
          field('Date', 'rtAt', input('rtAt', today(), { type: 'date' })) +
          field('Reason', 'rtNote', input('rtNote', '', { extra: ' placeholder="e.g. 30-day trial"' })) +
          '</div><div id="rtMsg"></div><button class="btn ghost" type="submit">Book return</button></form></div>' : '') +
        '<h3>Edit</h3><form id="edit" class="card"><div class="two">' +
        field('Status', 'eStatus', '<select id="eStatus">' + opts(S, d.status) + '</select>') +
        field('Model', 'eModel', '<select id="eModel">' + opts(META.models, d.model) + '</select>') + '</div><div class="two">' +
        field('Assigned to / customer', 'eWho', input('eWho', d.assignedTo)) +
        field('Landed cost (£)', 'eCost', input('eCost', toPounds(d.unitCost), { extra: ' inputmode="decimal"' })) + '</div>' +
        field('Notes', 'eNotes', area('eNotes', d.notes)) +
        '<div id="eMsg"></div><div class="actions"><button class="btn" type="submit">Save</button>' +
        '<button class="btn danger" type="button" id="eDel" style="margin-left:auto">Delete unit</button></div></form>' +
        '<h3>History</h3><div class="hist">' + (hist || '<span class="muted">No history.</span>') + '</div>';
      bindWarranty(d);
      if (canReturn) $('#ret').onsubmit = function (e) {
        e.preventDefault();
        api('POST', 'devices/' + encodeURIComponent(d.serial) + '/return', { status: val('#rtStatus'), at: val('#rtAt'), note: val('#rtNote') })
          .then(function () { deviceView(d.serial); }).catch(function (err) { errBox('#rtMsg', err); });
      };
      $('#edit').onsubmit = function (e) {
        e.preventDefault();
        api('PATCH', 'devices/' + encodeURIComponent(d.serial), {
          status: val('#eStatus'), model: val('#eModel'), assignedTo: val('#eWho'), notes: val('#eNotes'),
          unitCost: val('#eCost').trim() === '' ? null : toPence(val('#eCost')),
        }).then(function () { deviceView(d.serial); }).catch(function (err) { errBox('#eMsg', err); });
      };
      $('#eDel').onclick = function () {
        if (!confirm('Delete ' + d.serial + ' from stock records? An adjustment is logged in movements.')) return;
        api('DELETE', 'devices/' + encodeURIComponent(d.serial)).then(function () { go('#/stock'); }).catch(function (err) { errBox('#eMsg', err); });
      };
    }).catch(function (e) { errBox('#main', e); });
  }

  /* ---------------- warranty on a unit ---------------- */
  function warrantyCard(d) {
    var w = d.warranty, P = META.warrantyPlans, st = coverState(w);
    var html = '<h3>Warranty</h3><div class="card"><div class="head"><strong>' + (w ? esc(P[w.plan].name) : 'Not started') + '</strong><span class="pill st-' + st.cls + '">' + esc(st.label) + '</span></div>';
    if (w) {
      html += '<dl style="margin-top:10px"><dt>Cover</dt><dd>' + esc(fmtDate(w.start)) + ' to ' + esc(fmtDate(w.end)) + '</dd>' +
        (w.ref ? '<dt>From</dt><dd>' + esc(w.ref) + '</dd>' : '') + (w.note ? '<dt>Note</dt><dd>' + esc(w.note) + '</dd>' : '') +
        (d.registeredTo ? '<dt>Registered by</dt><dd>' + esc(d.registeredTo.name || '') + ' ' + esc(d.registeredTo.email || '') + '</dd>' : '') + '</dl>';
      if (w.plan === 'standard') {
        var since = daysFrom(w.start, today());
        html += '<p class="muted" style="margin-bottom:0">' + (since <= META.planWindowDays
          ? '3-Year Warranty can be added at the published price until ' + esc(fmtDate(plusDays(w.start, META.planWindowDays))) + ' (' + (META.planWindowDays - since) + ' days left).'
          : since <= 365 ? '30-day plan window has passed: a 3-Year Warranty now needs a remote diagnostic check first.' : 'Paid plans can no longer be added.') + '</p>';
      }
    } else {
      html += '<p class="muted" style="margin-bottom:0">Cover starts on the dispatch date, set automatically when the unit goes out on an order.</p>';
    }
    html += '<details style="margin-top:10px"><summary class="muted">Change plan or dates</summary><form id="wF" style="margin-top:10px"><div class="three">' +
      field('Plan', 'wPlan', '<select id="wPlan">' + opts(Object.keys(P).reduce(function (m, k) { m[k] = P[k].name; return m; }, {}), w ? w.plan : 'standard') + '</select>') +
      field('Starts (dispatch date)', 'wStart', input('wStart', w ? w.start : today(), { type: 'date' })) +
      field('Note', 'wNote', input('wNote', '', { extra: ' placeholder="e.g. plan bought by phone"' })) +
      '</div><div id="wMsg"></div><button class="btn ghost sm" type="submit">Save warranty</button></form></details></div>';

    var claims = d.claims || [];
    html += '<h3>Warranty claims</h3><div class="card">' + (claims.length ? claims.map(function (c, i) {
      return '<div class="claim"><div class="head"><strong>' + esc(fmtDate(c.openedAt)) + '</strong>' + pill(c.status === 'open' ? 'reserved' : 'sold', { reserved: 'Open', sold: 'Closed: ' + c.outcome }) + '</div>' +
        '<div style="white-space:pre-line">' + esc(c.fault) + '</div>' + (c.notes ? '<div class="muted" style="white-space:pre-line">' + esc(c.notes) + '</div>' : '') +
        (c.status === 'open' ? '<form class="closeClaim" data-i="' + i + '" style="margin-top:8px"><div class="three">' +
          '<select class="cOut"><option value="">Outcome…</option>' + ['repaired', 'replaced', 'refunded', 'declined', 'no fault found'].map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select>' +
          '<input type="text" class="cNotes" placeholder="Notes (what was done)">' +
          '<button class="btn ghost sm" type="submit">Close claim</button></div></form>' : (c.closedAt ? '<div class="muted">Closed ' + esc(fmtDate(c.closedAt)) + '</div>' : '')) + '</div>';
    }).join('') : '<p class="muted" style="margin-top:0">No claims.</p>') +
      '<details><summary class="muted">Log a new claim</summary><form id="clF" style="margin-top:10px">' +
      field('Fault reported', 'clFault', area('clFault', '', 'What the customer says is wrong')) +
      '<div class="two">' + field('Reported on', 'clAt', input('clAt', today(), { type: 'date' })) + '<div></div></div>' +
      '<div id="clMsg"></div><button class="btn ghost sm" type="submit">Open claim</button></form></details></div>';
    return html;
  }

  function bindWarranty(d) {
    var enc = encodeURIComponent(d.serial);
    $('#wF').onsubmit = function (e) {
      e.preventDefault();
      api('PUT', 'devices/' + enc + '/warranty', { plan: val('#wPlan'), start: val('#wStart'), note: val('#wNote') })
        .then(function () { deviceView(d.serial); }).catch(function (err) { errBox('#wMsg', err); });
    };
    $('#clF').onsubmit = function (e) {
      e.preventDefault();
      api('POST', 'devices/' + enc + '/claims', { fault: val('#clFault'), at: val('#clAt') })
        .then(function () { deviceView(d.serial); }).catch(function (err) { errBox('#clMsg', err); });
    };
    $$('form.closeClaim').forEach(function (f) {
      f.onsubmit = function (e) {
        e.preventDefault();
        api('PATCH', 'devices/' + enc + '/claims/' + f.getAttribute('data-i'), { status: 'closed', outcome: f.querySelector('.cOut').value, notes: f.querySelector('.cNotes').value })
          .then(function () { deviceView(d.serial); }).catch(function (err) { alert(err.message); });
      };
    });
  }

  /* ================= WARRANTY REGISTER ================= */
  function warrantyView() {
    loading();
    Promise.all([api('GET', 'devices'), api('GET', 'registrations')]).then(function (res) {
      var devs = res[0].devices, regs = res[1].registrations, P = META.warrantyPlans, now = today();
      var covered = devs.filter(function (d) { return d.wPlan; });
      var active = covered.filter(function (d) { return daysFrom(now, d.wEnd) >= 0; });
      var count = function (plan) { return active.filter(function (d) { return d.wPlan === plan; }).length; };
      var windowOpen = active.filter(function (d) { return d.wPlan === 'standard' && daysFrom(d.wStart, now) <= META.planWindowDays && d.status === 'sold'; });
      var claims = devs.filter(function (d) { return d.claimsOpen > 0; });
      var todo = regs.filter(function (r) { return !r.handledAt; });
      function unitRow(d, extra) {
        var st = coverState({ plan: d.wPlan, start: d.wStart, end: d.wEnd });
        return '<a class="row" href="#/device/' + encodeURIComponent(d.serial) + '"><div><div class="t">' + esc(META.models[d.model]) + ' · <span class="mono">' + esc(d.serial) + '</span></div>' +
          '<div class="s">' + esc(d.assignedTo || '') + (d.wPlan ? ' · ' + esc(P[d.wPlan].name) : '') + '</div>' + (extra ? '<div class="s">' + extra + '</div>' : '') + '</div>' +
          '<div class="r"><span class="pill st-' + st.cls + '">' + esc(st.label) + '</span></div></a>';
      }
      main().innerHTML =
        '<h2>Warranty</h2><p class="muted">The warranty register. Cover for each unit runs from its dispatch date. Standard is 12 months; the 3-Year Warranty and Total Care run 36 months.</p>' +
        '<div class="grid-sum">' +
        [[count('standard'), 'Standard, active'], [count('3yr'), '3-Year, active'], [count('care'), 'Total Care, active'], [claims.length, 'Units with open claims'], [todo.length, 'Registrations to check']]
          .map(function (x) { return '<div class="sum"><div class="n">' + x[0] + '</div><div class="l">' + esc(x[1]) + '</div></div>'; }).join('') + '</div>' +
        (claims.length ? '<h3>Open claims</h3><div class="list">' + claims.map(function (d) { return unitRow(d, d.claimsOpen + ' open claim' + (d.claimsOpen === 1 ? '' : 's')); }).join('') + '</div>' : '') +
        (windowOpen.length ? '<h3>Can still add a 3-Year Warranty</h3><p class="muted">Within ' + META.planWindowDays + ' days of dispatch the plan can be added at the published price. Worth a nudge.</p><div class="list">' +
          windowOpen.map(function (d) { var left = META.planWindowDays - daysFrom(d.wStart, now); return unitRow(d, left + ' day' + (left === 1 ? '' : 's') + ' left to add, until ' + fmtDate(plusDays(d.wStart, META.planWindowDays))); }).join('') + '</div>' : '') +
        '<h3>Registrations from the website</h3><div class="list">' + (regs.length ? regs.map(function (r) {
          return '<div class="row"><div><div class="t"><span class="mono">' + esc(r.serial) + '</span> · ' + esc(META.models[r.model] || r.model) + '</div>' +
            '<div class="s">' + esc(r.name) + ' · ' + esc(r.email) + (r.orderRef ? ' · order ' + esc(r.orderRef) : '') + (r.purchaseDate ? ' · bought ' + esc(fmtDate(r.purchaseDate)) : '') + '</div>' +
            '<div class="s">' + (r.matched ? 'Matches our unit, held by ' + esc(r.holder || '—') + ' · <a href="#/device/' + encodeURIComponent(r.serial) + '">open unit</a>' : '<span style="color:var(--bad)">No unit with this serial in our records: check it with the customer</span>') + '</div></div>' +
            '<div class="r">' + (r.handledAt ? '<span class="pill st-sold">Done</span>' : '<button class="btn sm" data-reg="' + esc(r.key) + '" data-link="' + (r.matched ? 1 : 0) + '">' + (r.matched ? 'Record on unit' : 'Mark checked') + '</button>') +
            '<span class="muted">' + esc(fmtDate(r.receivedAt)) + '</span></div></div>';
        }).join('') : '<div class="empty">No registrations yet.</div>') + '</div>' +
        '<h3>Register</h3><div class="tools"><input type="search" id="wq" placeholder="Search serial or customer"></div><div class="list" id="wRows"></div>';
      function draw(q) {
        var list = covered.filter(function (d) { return !q || [d.serial, d.assignedTo, d.imei1].join(' ').toLowerCase().indexOf(q) > -1; })
          .sort(function (a, b) { return (a.wEnd || '').localeCompare(b.wEnd || ''); });
        $('#wRows').innerHTML = list.length ? list.map(function (d) { return unitRow(d, fmtDate(d.wStart) + ' to ' + fmtDate(d.wEnd)); }).join('') : '<div class="empty">No units under warranty yet. Cover starts when a unit is dispatched.</div>';
      }
      draw('');
      $('#wq').oninput = function () { draw(this.value.toLowerCase()); };
      $$('[data-reg]').forEach(function (b) {
        b.onclick = function () {
          busy(b, true);
          api('POST', 'registrations/handle', { key: b.getAttribute('data-reg'), link: b.getAttribute('data-link') === '1' })
            .then(function () { warrantyView(); }).catch(function (err) { busy(b, false); alert(err.message); });
        };
      });
    }).catch(function (e) { errBox('#main', e); });
  }

  /* Serial + IMEI inputs with a live check-digit hint. */
  function unitInputs(prefix, i) {
    var id = prefix + i;
    return '<div class="unit-ed">' +
      '<div><label for="' + id + 's">Serial (S/N)</label><input type="text" id="' + id + 's" class="mono" autocapitalize="characters" spellcheck="false"></div>' +
      '<div><label for="' + id + 'a">IMEI 1</label><input type="text" id="' + id + 'a" class="mono imei" inputmode="numeric" maxlength="17"><div class="hint"></div></div>' +
      '<div><label for="' + id + 'b">IMEI 2</label><input type="text" id="' + id + 'b" class="mono imei" inputmode="numeric" maxlength="17"><div class="hint"></div></div></div>';
  }
  function bindImeiHints(scope) {
    $$('input.imei', scope).forEach(function (inp) {
      var hint = inp.parentNode.querySelector('.hint');
      inp.oninput = function () {
        var v = inp.value.replace(/\D/g, '');
        if (!v) { hint.textContent = ''; hint.className = 'hint'; return; }
        if (v.length < 15) { hint.textContent = v.length + ' of 15 digits'; hint.className = 'hint'; return; }
        var ok = luhn(v);
        hint.textContent = ok ? 'Check digit OK' : 'Check digit fails — typo?';
        hint.className = 'hint ' + (ok ? 'ok' : 'bad');
      };
    });
  }

  function quickReceive(flash) {
    main().innerHTML =
      '<a class="back" href="#/in">← Goods in</a><h2>Quick receive</h2>' +
      '<p class="muted">For a unit with no purchase order. Units bought from a supplier are better received against their <a href="#/in">purchase order</a>, which records the landed cost.</p>' +
      (flash ? '<div class="msg ok">' + flash + '</div>' : '') +
      '<form id="recv" class="card" autocomplete="off"><div class="two">' +
      field('Model', 'rModel', '<select id="rModel">' + opts(META.models, UI.lastModel) + '</select>') +
      field('Received', 'rDate', input('rDate', today(), { type: 'date' })) + '</div>' +
      unitInputs('q', 0) +
      '<div class="two">' + field('Supplier', 'rSupp', input('rSupp', '')) + field('Landed cost (£)', 'rCost', input('rCost', '', { extra: ' inputmode="decimal"' })) + '</div>' +
      field('Notes', 'rNotes', area('rNotes', '')) +
      '<div id="rMsg"></div><button class="btn" type="submit" id="rGo">Receive</button></form>';
    bindImeiHints(main());
    $('#recv').onsubmit = function (e) {
      e.preventDefault();
      var btn = $('#rGo'); busy(btn, true);
      var body = { model: val('#rModel'), receivedAt: val('#rDate'), serial: val('#q0s'), imei1: val('#q0a'), imei2: val('#q0b'), supplier: val('#rSupp'), notes: val('#rNotes') };
      if (val('#rCost').trim()) body.unitCost = toPence(val('#rCost'));
      api('POST', 'devices', body).then(function (r) {
        UI.lastModel = body.model;
        quickReceive(esc(META.models[r.device.model]) + ' <span class="mono">' + esc(r.device.serial) + '</span> received.');
      }).catch(function (err) { busy(btn, false); errBox('#rMsg', err); });
    };
  }

  /* ================= LINE EDITOR (purchase & sales) ================= */
  function lineEditor(lines, priceField, devicesOnly) {
    var cat = META.catalogue;
    function row(l, i) {
      var productOpts = '<option value="">Other / description only</option>' + Object.keys(cat).filter(function (id) { return !devicesOnly || cat[id].device; })
        .map(function (id) { return '<option value="' + id + '"' + (id === l.productId ? ' selected' : '') + '>' + esc(cat[id].name) + '</option>'; }).join('');
      return '<div class="line-ed" data-line="' + i + '"><div class="grid">' +
        '<div class="wide"><label>Product</label><select class="lp">' + productOpts + '</select></div>' +
        '<div><label>Qty</label><input type="number" class="lq" min="1" value="' + esc(l.qty || 1) + '"></div>' +
        '<div><label>' + (priceField === 'unitCost' ? 'Unit cost (£)' : 'Unit price (£)') + '</label><input type="text" class="lu" inputmode="decimal" value="' + esc(toPounds(l[priceField])) + '"></div>' +
        '<div><button type="button" class="x" title="Remove line" data-rm>×</button></div></div>' +
        '<div style="margin-top:8px"><label>Description</label><input type="text" class="ld" value="' + esc(l.description) + '"></div></div>';
    }
    var html = '<div id="lines">' + (lines.length ? lines : [{}]).map(row).join('') + '</div><button type="button" class="btn ghost sm" id="addLine">+ Add line</button>';
    function bind() {
      $$('#lines [data-rm]').forEach(function (b) { b.onclick = function () { if ($$('#lines .line-ed').length > 1) b.closest('.line-ed').remove(); }; });
      $$('#lines .lp').forEach(function (s) {
        s.onchange = function () {
          var ed = s.closest('.line-ed'), p = cat[s.value];
          if (p) {
            ed.querySelector('.ld').value = p.name;
            if (priceField === 'unitPrice' && !ed.querySelector('.lu').value) ed.querySelector('.lu').value = toPounds(p.price);
          }
        };
      });
      $('#addLine').onclick = function () {
        $('#lines').insertAdjacentHTML('beforeend', row({}, $$('#lines .line-ed').length));
        bind();
      };
    }
    function read() {
      return $$('#lines .line-ed').map(function (ed) {
        var l = { productId: ed.querySelector('.lp').value, description: ed.querySelector('.ld').value, qty: +ed.querySelector('.lq').value || 0 };
        l[priceField] = toPence(ed.querySelector('.lu').value);
        return l;
      });
    }
    return { html: html, bind: bind, read: read };
  }

  function linesTable(lines, priceField, extraRows) {
    var cat = META.catalogue;
    return '<table class="lines"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Each</th><th class="n">Total</th></tr></thead><tbody>' +
      lines.map(function (l) {
        return '<tr><td>' + esc(l.description || (cat[l.productId] && cat[l.productId].name)) + '</td><td class="n">' + esc(l.qty) + '</td><td class="n">' + money(l[priceField]) + '</td><td class="n">' + money(l[priceField] * l.qty) + '</td></tr>';
      }).join('') + '</tbody><tfoot>' + (extraRows || []).map(function (r) {
        return '<tr><td colspan="3" class="n"' + (r[2] ? ' style="font-weight:800"' : '') + '>' + esc(r[0]) + '</td><td class="n"' + (r[2] ? ' style="font-weight:800"' : '') + '>' + money(r[1]) + '</td></tr>';
      }).join('') + '</tfoot></table>';
  }

  /* ================= GOODS IN (purchase orders) ================= */
  function purchaseList() {
    loading();
    api('GET', 'purchases').then(function (r) {
      var list = r.purchases.sort(function (a, b) { return (b.orderedAt || '').localeCompare(a.orderedAt || ''); });
      main().innerHTML =
        '<div class="head"><h2>Goods in</h2><div class="actions"><a class="btn ghost sm" href="#/in/quick">Quick receive</a><a class="btn sm" href="#/in/new">New purchase order</a></div></div>' +
        '<p class="muted">Purchase orders from suppliers. Receive units against them to record serials and landed cost.</p>' +
        '<div class="list" style="margin-top:12px">' + (list.length ? list.map(function (p) {
          return '<a class="row" href="#/in/' + esc(p.id) + '"><div><div class="t">' + esc(p.id) + ' · ' + esc(p.supplierName) + '</div>' +
            '<div class="s">' + esc(fmtDate(p.orderedAt)) + (p.supplierRef ? ' · <span class="mono">' + esc(p.supplierRef) + '</span>' : '') + '</div>' +
            '<div class="s">' + esc(p.received || 0) + ' of ' + esc(p.units || 0) + ' units received</div></div>' +
            '<div class="r">' + pill(p.status, META.purchaseStatuses) + '<span class="num">' + money(p.total) + '</span></div></a>';
        }).join('') : '<div class="empty">No purchase orders yet.</div>') + '</div>';
    }).catch(function (e) { errBox('#main', e); });
  }

  function purchaseForm(id) {
    loading();
    Promise.all([api('GET', 'suppliers'), id ? api('GET', 'purchases/' + encodeURIComponent(id)) : null]).then(function (res) {
      var sups = res[0].suppliers, po = res[1] ? res[1].purchase : { lines: [], orderedAt: today(), status: 'ordered' };
      if (!sups.length) {
        main().innerHTML = '<a class="back" href="#/in">← Goods in</a><h2>New purchase order</h2><div class="card">Add the supplier first. <a class="btn sm" href="#/suppliers/new">New supplier</a></div>';
        return;
      }
      var supMap = {}; sups.forEach(function (s) { supMap[s.id] = s.name; });
      var le = lineEditor(po.lines, 'unitCost', false);
      main().innerHTML =
        '<a class="back" href="' + (id ? '#/in/' + esc(id) : '#/in') + '">← ' + (id ? esc(id) : 'Goods in') + '</a>' +
        '<h2>' + (id ? 'Edit ' + esc(id) : 'New purchase order') + '</h2>' +
        '<form id="poF" class="card"><div class="two">' +
        field('Supplier', 'pSup', '<select id="pSup">' + opts(supMap, po.supplierId, 'Choose…') + '</select>') +
        field('Supplier order / invoice ref', 'pRef', input('pRef', po.supplierRef, { extra: ' class="mono"' })) + '</div><div class="three">' +
        field('Ordered', 'pOrd', input('pOrd', po.orderedAt, { type: 'date' })) +
        field('Paid', 'pPaid', input('pPaid', po.paidAt, { type: 'date' })) +
        field('Paid by', 'pMeth', input('pMeth', po.paymentMethod, { extra: ' placeholder="e.g. Apple Pay"' })) + '</div>' +
        '<div class="lbl">Lines</div>' + le.html +
        '<div class="three" style="margin-top:14px">' +
        field('Shipping (£)', 'pShip', input('pShip', toPounds(po.shipping), { extra: ' inputmode="decimal"' })) +
        field('Import VAT / duty (£)', 'pTax', input('pTax', toPounds(po.tax), { extra: ' inputmode="decimal"' })) +
        field('Fees (£)', 'pFees', input('pFees', toPounds(po.fees), { extra: ' inputmode="decimal"' })) + '</div>' +
        '<div class="two">' + field('Total actually paid (£)', 'pPaidAmt', input('pPaidAmt', toPounds(po.amountPaid), { extra: ' inputmode="decimal" placeholder="Sets the landed cost"' })) +
        field('Status', 'pStatus', '<select id="pStatus">' + opts(META.purchaseStatuses, po.status) + '</select>') + '</div>' +
        field('Notes', 'pNotes', area('pNotes', po.notes)) +
        '<div id="pMsg"></div><div class="actions"><button class="btn" type="submit" id="pGo">' + (id ? 'Save' : 'Create purchase order') + '</button>' +
        (id && !po.received ? '<button class="btn danger" type="button" id="pDel" style="margin-left:auto">Delete</button>' : '') + '</div></form>';
      le.bind();
      $('#poF').onsubmit = function (e) {
        e.preventDefault();
        var btn = $('#pGo'); busy(btn, true);
        var body = {
          supplierId: val('#pSup'), supplierRef: val('#pRef'), orderedAt: val('#pOrd'), paidAt: val('#pPaid'), paymentMethod: val('#pMeth'),
          lines: le.read(), shipping: toPence(val('#pShip')), tax: toPence(val('#pTax')), fees: toPence(val('#pFees')),
          amountPaid: toPence(val('#pPaidAmt')), status: val('#pStatus'), notes: val('#pNotes'),
        };
        api(id ? 'PUT' : 'POST', 'purchases' + (id ? '/' + encodeURIComponent(id) : ''), body)
          .then(function (r) { go('#/in/' + encodeURIComponent(r.purchase.id)); })
          .catch(function (err) { busy(btn, false); errBox('#pMsg', err); });
      };
      var del = $('#pDel');
      if (del) del.onclick = function () {
        if (!confirm('Delete ' + id + '?')) return;
        api('DELETE', 'purchases/' + encodeURIComponent(id)).then(function () { go('#/in'); }).catch(function (err) { errBox('#pMsg', err); });
      };
    }).catch(function (e) { errBox('#main', e); });
  }

  function purchaseView(id, flash) {
    loading();
    api('GET', 'purchases/' + encodeURIComponent(id)).then(function (r) {
      var po = r.purchase, cat = META.catalogue;
      var goods = po.lines.reduce(function (s, l) { return s + l.unitCost * l.qty; }, 0);
      var extras = [['Goods', goods]];
      if (po.shipping) extras.push(['Shipping', po.shipping]);
      if (po.tax) extras.push(['Import VAT / duty', po.tax]);
      if (po.fees) extras.push(['Fees', po.fees]);
      extras.push(['Total paid', po.amountPaid || goods + (po.shipping || 0) + (po.tax || 0) + (po.fees || 0), true]);
      var remaining = Math.max(0, (po.units || 0) - (po.received || 0));
      var deviceLines = po.lines.map(function (l, i) { return [i, l]; }).filter(function (p) { return cat[p[1].productId] && cat[p[1].productId].device; });
      var landedNote = deviceLines.map(function (p) { return esc(cat[p[1].productId].name) + ': ' + money(r.landed[p[0]]) + ' per unit'; }).join(' · ');
      main().innerHTML =
        '<a class="back" href="#/in">← Goods in</a>' +
        (flash ? '<div class="msg ok">' + flash + '</div>' : '') +
        '<div class="head"><h2>' + esc(po.id) + '</h2><div class="actions">' + pill(po.status, META.purchaseStatuses) + '<a class="btn ghost sm" href="#/in/' + esc(po.id) + '/edit">Edit</a></div></div>' +
        '<div class="card"><dl><dt>Supplier</dt><dd><a href="#/suppliers/' + esc(po.supplierId) + '">' + esc(po.supplierName) + '</a></dd>' +
        (po.supplierRef ? '<dt>Their ref</dt><dd class="mono">' + esc(po.supplierRef) + '</dd>' : '') +
        '<dt>Ordered</dt><dd>' + esc(fmtDate(po.orderedAt)) + '</dd>' +
        (po.paidAt ? '<dt>Paid</dt><dd>' + esc(fmtDate(po.paidAt)) + (po.paymentMethod ? ' · ' + esc(po.paymentMethod) : '') + '</dd>' : '') +
        '<dt>Received</dt><dd>' + esc(po.received || 0) + ' of ' + esc(po.units || 0) + ' units</dd>' +
        (po.notes ? '<dt>Notes</dt><dd>' + esc(po.notes) + '</dd>' : '') + '</dl></div>' +
        '<div class="card">' + linesTable(po.lines, 'unitCost', extras) +
        (landedNote ? '<p class="muted" style="margin-bottom:0">Landed cost (everything paid, split by line value): ' + landedNote + '</p>' : '') + '</div>' +
        (remaining && deviceLines.length ? '<h3>Receive units</h3><form id="rcv" class="card" autocomplete="off">' +
          '<div class="two">' + field('Received on', 'rcAt', input('rcAt', today(), { type: 'date' })) +
          (deviceLines.length > 1 ? field('Line', 'rcLine', '<select id="rcLine">' + deviceLines.map(function (p) { return '<option value="' + p[0] + '">' + esc(cat[p[1].productId].name) + '</option>'; }).join('') + '</select>') : '<div></div>') + '</div>' +
          '<div id="units">' + unitInputs('u', 0) + '</div>' +
          (remaining > 1 ? '<button type="button" class="btn ghost sm" id="addUnit">+ Another unit</button>' : '') +
          '<div id="rcMsg"></div><div class="actions"><button class="btn" type="submit" id="rcGo">Receive into stock</button></div></form>' : '') +
        '<h3>Units from this order</h3><div class="list">' + (r.devices.length ? r.devices.map(function (d) {
          return '<a class="row" href="#/device/' + encodeURIComponent(d.serial) + '"><div><div class="t">' + esc(META.models[d.model]) + '</div><div class="s mono">' + esc(d.serial) + '</div>' +
            (d.assignedTo ? '<div class="s">' + esc(d.assignedTo) + '</div>' : '') + '</div><div class="r">' + pill(d.status, META.deviceStatuses) + '</div></a>';
        }).join('') : '<div class="empty">Nothing received yet.</div>') + '</div>';
      if (!$('#rcv')) return;
      bindImeiHints(main());
      var add = $('#addUnit');
      if (add) add.onclick = function () {
        var n = $$('#units .unit-ed').length;
        if (n >= remaining) return;
        $('#units').insertAdjacentHTML('beforeend', unitInputs('u', n));
        bindImeiHints($('#units'));
      };
      $('#rcv').onsubmit = function (e) {
        e.preventDefault();
        var btn = $('#rcGo'); busy(btn, true);
        var line = $('#rcLine') ? +val('#rcLine') : deviceLines[0][0];
        var units = $$('#units .unit-ed').map(function (u, i) {
          return { serial: val('#u' + i + 's'), imei1: val('#u' + i + 'a'), imei2: val('#u' + i + 'b'), line: line };
        }).filter(function (u) { return u.serial.trim(); });
        api('POST', 'purchases/' + encodeURIComponent(po.id) + '/receive', { units: units, receivedAt: val('#rcAt') })
          .then(function (res) { purchaseView(po.id, res.devices.length + ' unit' + (res.devices.length === 1 ? '' : 's') + ' received into stock.'); })
          .catch(function (err) { busy(btn, false); errBox('#rcMsg', err); });
      };
    }).catch(function (e) { errBox('#main', e); });
  }

  /* ================= SALES (goods out) ================= */
  function saleList() {
    loading();
    Promise.all([api('GET', 'sales'), api('GET', 'orders')]).then(function (res) {
      var rows = res[0].sales.map(function (s) {
        return { href: '#/sales/' + encodeURIComponent(s.id), title: s.id + ' · ' + s.customerName, date: s.orderedAt, status: s.status, total: s.total, sub: (s.units || 0) + ' unit' + (s.units === 1 ? '' : 's'), open: ['quote', 'awaiting_payment', 'paid'].indexOf(s.status) > -1 };
      }).concat(res[1].orders.filter(function (o) { return !o.saleId; }).map(function (o) {
        var name = (o.shippingAddress && o.shippingAddress.name) || o.customerEmail || 'Web customer';
        return { href: '#/web/' + encodeURIComponent(o.orderId), title: 'Web · ' + name, date: (o.paidAt || '').slice(0, 10), status: o.status || 'pending', total: o.total, sub: o.items.map(function (i) { return i.quantity + ' × ' + i.name; }).join(', '), open: !o.dispatch };
      })).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      function draw() {
        var shown = rows.filter(function (r) { return UI.saleFilter === 'all' || (UI.saleFilter === 'open') === r.open; });
        $('#saleRows').innerHTML = shown.length ? shown.map(function (r) {
          return '<a class="row" href="' + r.href + '"><div><div class="t">' + esc(r.title) + '</div><div class="s">' + esc(fmtDate(r.date)) + ' · ' + esc(r.sub) + '</div></div>' +
            '<div class="r">' + pill(r.status, META.saleStatuses) + '<span class="num">' + money(r.total) + '</span></div></a>';
        }).join('') : '<div class="empty">' + (rows.length ? 'Nothing here.' : 'No sales yet.') + '</div>';
      }
      main().innerHTML =
        '<div class="head"><h2>Sales</h2><a class="btn sm" href="#/sales/new">New sales order</a></div>' +
        '<p class="muted">Every sale in one place. Website orders are filed here automatically, with the customer added to Customers.</p>' +
        (res[1].orders.some(function (o) { return !o.saleId; }) ? '<div class="card">Some website orders came in before automatic filing. <button class="btn sm" id="syncWeb">File them as sales orders</button><div id="syncMsg"></div></div>' : '') +
        '<div class="chips" style="margin-top:12px">' + [['open', 'To do'], ['done', 'Done'], ['all', 'All']].map(function (p) {
          return '<button class="chip' + (UI.saleFilter === p[0] ? ' on' : '') + '" data-sf="' + p[0] + '">' + p[1] + '</button>';
        }).join('') + '</div><div class="list" id="saleRows"></div>';
      draw();
      var sync = $('#syncWeb');
      if (sync) sync.onclick = function () {
        busy(sync, true);
        api('POST', 'sync-web', {}).then(function () { saleList(); }).catch(function (err) { busy(sync, false); errBox('#syncMsg', err); });
      };
      $$('[data-sf]').forEach(function (b) {
        b.onclick = function () { UI.saleFilter = b.getAttribute('data-sf'); $$('[data-sf]').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); };
      });
    }).catch(function (e) { errBox('#main', e); });
  }

  function saleForm(id, presetCustomer) {
    loading();
    Promise.all([api('GET', 'customers'), id ? api('GET', 'sales/' + encodeURIComponent(id)) : null]).then(function (res) {
      var custs = res[0].customers, s = res[1] ? res[1].sale : { lines: [], orderedAt: today(), status: 'awaiting_payment', customerId: presetCustomer || '' };
      if (!custs.length) {
        main().innerHTML = '<a class="back" href="#/sales">← Sales</a><h2>New sales order</h2><div class="card">Add the customer first. <a class="btn sm" href="#/customers/new">New customer</a></div>';
        return;
      }
      var custMap = {}; custs.forEach(function (c) { custMap[c.id] = c.name + (c.contact && c.contact !== c.name ? ' (' + c.contact + ')' : ''); });
      var le = lineEditor(s.lines, 'unitPrice', false);
      main().innerHTML =
        '<a class="back" href="' + (id ? '#/sales/' + esc(id) : '#/sales') + '">← ' + (id ? esc(id) : 'Sales') + '</a>' +
        '<h2>' + (id ? 'Edit ' + esc(id) : 'New sales order') + '</h2>' +
        '<form id="soF" class="card"><div class="two">' +
        field('Customer', 'sCust', '<select id="sCust">' + opts(custMap, s.customerId, 'Choose…') + '</select>') +
        field('Contact', 'sContact', input('sContact', s.contactName)) + '</div><div class="three">' +
        (id ? '' : field('Order number', 'sId', input('sId', '', { extra: ' class="mono" placeholder="Leave blank for next TUGA number"' }))) +
        field('Order date', 'sOrd', input('sOrd', s.orderedAt, { type: 'date' })) +
        field('Status', 'sStatus', '<select id="sStatus">' + opts(META.saleStatuses, s.status) + '</select>') + '</div>' +
        '<div class="lbl">Lines</div>' + le.html +
        '<div class="three" style="margin-top:14px">' +
        field('Discount (£)', 'sDisc', input('sDisc', toPounds(s.discount), { extra: ' inputmode="decimal"' })) +
        field('Delivery charge (£)', 'sShip', input('sShip', toPounds(s.shippingCharge), { extra: ' inputmode="decimal"' })) +
        field('VAT (£)', 'sVat', input('sVat', toPounds(s.vat), { extra: ' inputmode="decimal" placeholder="0 while not VAT registered"' })) + '</div>' +
        '<div class="three">' +
        field('Payment method', 'sPay', '<select id="sPay">' + opts({ BACS: 'BACS transfer', Card: 'Card', PayPal: 'PayPal', Cash: 'Cash', Other: 'Other' }, s.paymentMethod || 'BACS') + '</select>') +
        field('Payment reference', 'sPayRef', input('sPayRef', s.paymentRef, { extra: ' class="mono"' })) +
        field('Paid on', 'sPaid', input('sPaid', s.paidAt, { type: 'date' })) + '</div>' +
        '<div class="two">' + field('Invoice number', 'sInv', input('sInv', s.invoiceNumber, { extra: ' class="mono"' })) + '<div></div></div>' +
        field('Deliver to (blank = customer\'s delivery address)', 'sAddr', area('sAddr', s.deliveryAddress)) +
        field('Notes', 'sNotes', area('sNotes', s.notes, 'e.g. 30-day trial agreed')) +
        '<div id="sMsg"></div><div class="actions"><button class="btn" type="submit" id="sGo">' + (id ? 'Save' : 'Create sales order') + '</button>' +
        (id && !s.dispatch ? '<button class="btn danger" type="button" id="sDel" style="margin-left:auto">Delete</button>' : '') + '</div></form>';
      le.bind();
      $('#soF').onsubmit = function (e) {
        e.preventDefault();
        var btn = $('#sGo'); busy(btn, true);
        var body = {
          customerId: val('#sCust'), contactName: val('#sContact'), orderedAt: val('#sOrd'), status: val('#sStatus'),
          lines: le.read(), discount: toPence(val('#sDisc')), shippingCharge: toPence(val('#sShip')), vat: toPence(val('#sVat')),
          paymentMethod: val('#sPay'), paymentRef: val('#sPayRef'), paidAt: val('#sPaid'), invoiceNumber: val('#sInv'),
          deliveryAddress: val('#sAddr'), notes: val('#sNotes'),
        };
        if (!id && val('#sId').trim()) body.id = val('#sId').trim();
        api(id ? 'PUT' : 'POST', 'sales' + (id ? '/' + encodeURIComponent(id) : ''), body)
          .then(function (r) { go('#/sales/' + encodeURIComponent(r.sale.id)); })
          .catch(function (err) { busy(btn, false); errBox('#sMsg', err); });
      };
      var del = $('#sDel');
      if (del) del.onclick = function () {
        if (!confirm('Delete ' + id + '?')) return;
        api('DELETE', 'sales/' + encodeURIComponent(id)).then(function () { go('#/sales'); }).catch(function (err) { errBox('#sMsg', err); });
      };
    }).catch(function (e) { errBox('#main', e); });
  }

  function saleView(id) {
    loading();
    Promise.all([api('GET', 'sales/' + encodeURIComponent(id)), api('GET', 'devices')]).then(function (res) {
      var s = res[0].sale, units = res[0].devices, cost = res[0].cost, all = res[1].devices, cat = META.catalogue;
      var extras = [['Subtotal', s.subtotal]];
      if (s.discount) extras.push(['Discount', -s.discount]);
      if (s.shippingCharge) extras.push(['Delivery', s.shippingCharge]);
      extras.push(['VAT', s.vat || 0]);
      extras.push(['Total', s.total, true]);
      var models = {};
      s.lines.forEach(function (l) { if (cat[l.productId] && cat[l.productId].device) models[l.productId] = true; });
      var avail = all.filter(function (d) { return models[d.model] && (d.status === 'in_stock' || d.status === 'reserved' || d.status === 'returned'); });
      var deviceRevenue = s.lines.reduce(function (t, l) { return t + (cat[l.productId] && cat[l.productId].device ? l.unitPrice * l.qty : 0); }, 0);
      var canPay = s.status === 'awaiting_payment' || s.status === 'quote';
      main().innerHTML =
        '<a class="back" href="#/sales">← Sales</a>' +
        '<div class="head"><h2>' + esc(s.id) + '</h2><div class="actions">' + pill(s.status, META.saleStatuses) + '<a class="btn ghost sm" href="#/sales/' + esc(s.id) + '/edit">Edit</a></div></div>' +
        '<div class="card"><dl><dt>Customer</dt><dd><a href="#/customers/' + esc(s.customerId) + '">' + esc(s.customerName) + '</a>' + (s.contactName ? ' · ' + esc(s.contactName) : '') + '</dd>' +
        '<dt>Ordered</dt><dd>' + esc(fmtDate(s.orderedAt)) + (s.channel === 'web' ? ' · on the website' : '') + '</dd>' +
        '<dt>Payment</dt><dd>' + esc(s.paymentMethod || '') + (s.paymentRef ? ' · <span class="mono">' + esc(s.paymentRef) + '</span>' : '') + (s.paidAt ? ' · paid ' + esc(fmtDate(s.paidAt)) : ' · not paid yet') + '</dd>' +
        (s.invoiceNumber ? '<dt>Invoice</dt><dd class="mono">' + esc(s.invoiceNumber) + '</dd>' : '') +
        (s.deliveryAddress ? '<dt>Deliver to</dt><dd>' + esc(s.deliveryAddress) + '</dd>' : '') +
        (s.notes ? '<dt>Notes</dt><dd>' + esc(s.notes) + '</dd>' : '') + '</dl></div>' +
        '<div class="card">' + linesTable(s.lines, 'unitPrice', extras) + '</div>' +
        (canPay ? '<div class="card"><form id="payF" class="two" style="align-items:end">' + field('Payment received on', 'pyAt', input('pyAt', today(), { type: 'date' })) +
          '<div class="f"><button class="btn" type="submit">Mark paid</button></div></form><div id="pyMsg"></div></div>' : '') +
        (s.dispatch
          ? '<h3>Dispatched</h3><div class="card"><dl><dt>When</dt><dd>' + esc(fmtWhen(s.dispatch.at)) + '</dd>' +
            (s.dispatch.courier ? '<dt>Courier</dt><dd>' + esc(s.dispatch.courier) + '</dd>' : '') +
            (s.dispatch.tracking ? '<dt>Tracking</dt><dd class="mono">' + trackLink(s.dispatch.courier, s.dispatch.tracking) + '</dd>' : '') +
            (s.dispatch.notified ? '<dt>Customer emailed</dt><dd>' + esc(s.dispatch.notified) + '</dd>' : '') + '</dl>' +
            (cost != null ? '<p style="margin-bottom:0">Cost of units ' + money(cost) + ' · device revenue ' + money(deviceRevenue) + ' · <span class="margin-ok">gross margin ' + money(deviceRevenue - cost) + '</span></p>' : '') + '</div>' +
            '<h3>Units sent</h3><div class="list">' + (units.length ? units.map(function (d) {
              return '<a class="row" href="#/device/' + encodeURIComponent(d.serial) + '"><div><div class="t">' + esc(META.models[d.model]) + '</div><div class="s mono">' + esc(d.serial) + '</div>' +
                (d.warranty ? '<div class="s">' + esc(META.warrantyPlans[d.warranty.plan].name) + ' until ' + esc(fmtDate(d.warranty.end)) + '</div>' : '') +
                '</div><div class="r">' + pill(d.status, META.deviceStatuses) + '<span class="num">cost ' + money(d.unitCost) + '</span></div></a>';
            }).join('') : '<div class="empty">No serials recorded.</div>') + '</div>'
          : (s.status !== 'cancelled' ? '<h3>Dispatch</h3><form id="dsp" class="card"><div class="lbl">Units going out</div>' +
            (avail.length ? avail.map(function (d) {
              return '<div class="pick-row"><label class="pick"><input type="checkbox" value="' + esc(d.serial) + '"> ' + esc(META.models[d.model]) + ' · <span class="mono">' + esc(d.serial) + '</span> ' + pill(d.status, META.deviceStatuses) + '</label>' +
                '<select class="plan" data-serial="' + esc(d.serial) + '" aria-label="Warranty for ' + esc(d.serial) + '"><option value="">Warranty: from the order</option>' +
                Object.keys(META.warrantyPlans).map(function (k) { return '<option value="' + k + '">' + esc(META.warrantyPlans[k].name) + '</option>'; }).join('') + '</select></div>';
            }).join('') + '<p class="muted">Warranty starts on the dispatch date. "From the order" gives the 3-Year Warranty to as many units as the order paid for, and the standard 12 months to the rest.</p>'
              : '<p class="muted">No matching units in stock. Book them in from <a href="#/in">Goods in</a> first.</p>') +
            '<div class="three" style="margin-top:12px">' + field('Courier', 'dCour', input('dCour', 'Royal Mail')) + field('Tracking number', 'dTrack', input('dTrack', '', { extra: ' class="mono"' })) +
            field('Dispatched on', 'dAt', input('dAt', today(), { type: 'date' })) + '</div>' +
            '<label class="pick"><input type="checkbox" id="dNotify" checked> Email the tracking number to the customer</label>' +
            '<div id="dMsg"></div><button class="btn" type="submit" id="dGo">Dispatch</button></form>' : ''));
      if (canPay) $('#payF').onsubmit = function (e) {
        e.preventDefault();
        var body = Object.assign({}, s, { paidAt: val('#pyAt'), status: 'paid' });
        api('PUT', 'sales/' + encodeURIComponent(s.id), body).then(function () { saleView(s.id); }).catch(function (err) { errBox('#pyMsg', err); });
      };
      var dsp = $('#dsp');
      if (dsp) dsp.onsubmit = function (e) {
        e.preventDefault();
        var serials = $$('#dsp .pick-row input:checked').map(function (c) { return c.value; });
        if (s.units && serials.length !== s.units && !confirm('The order has ' + s.units + ' unit(s) and you picked ' + serials.length + '. Dispatch anyway?')) return;
        var btn = $('#dGo'); busy(btn, true);
        var plans = {};
        $$('#dsp select.plan').forEach(function (sel) { if (sel.value) plans[sel.getAttribute('data-serial')] = sel.value; });
        api('POST', 'sales/' + encodeURIComponent(s.id) + '/dispatch', { serials: serials, courier: val('#dCour'), tracking: val('#dTrack'), at: val('#dAt'), plans: plans, notifyCustomer: $('#dNotify').checked })
          .then(function () { saleView(s.id); }).catch(function (err) { busy(btn, false); errBox('#dMsg', err); });
      };
    }).catch(function (e) { errBox('#main', e); });
  }

  function trackLink(courier, num) {
    if (/royal ?mail/i.test(courier || '')) return '<a href="https://www.royalmail.com/track-your-item#/tracking-results/' + encodeURIComponent(num) + '" target="_blank" rel="noopener">' + esc(num) + '</a>';
    return esc(num);
  }

  function webOrderView(id) {
    loading();
    Promise.all([api('GET', 'orders'), api('GET', 'devices')]).then(function (res) {
      var o = res[0].orders.filter(function (x) { return x.orderId === id; })[0];
      if (!o) { main().innerHTML = '<a class="back" href="#/sales">← Sales</a><div class="msg bad">Order not found.</div>'; return; }
      if (o.saleId) { location.replace('#/sales/' + encodeURIComponent(o.saleId)); return; }
      var a = o.shippingAddress || {};
      var addr = [a.name, a.line1, a.line2, a.city, a.postal_code].filter(Boolean).map(esc).join('\n');
      var ids = {};
      o.items.forEach(function (it) { if (it.id) ids[it.id] = true; });
      var avail = res[1].devices.filter(function (d) { return ids[d.model] && (d.status === 'in_stock' || d.status === 'reserved' || d.status === 'returned'); });
      main().innerHTML =
        '<a class="back" href="#/sales">← Sales</a><div class="head"><h2>Web order</h2>' + pill(o.status || 'pending', META.saleStatuses) + '</div>' +
        '<div class="card"><dl><dt>Order</dt><dd class="mono">' + esc(o.orderId) + '</dd><dt>Paid</dt><dd>' + esc(fmtWhen(o.paidAt)) + ' · ' + esc(o.provider) + '</dd>' +
        '<dt>Email</dt><dd>' + esc(o.customerEmail) + '</dd>' + (addr ? '<dt>Deliver to</dt><dd>' + addr + '</dd>' : '') + '</dl></div>' +
        '<div class="card">' + linesTable(o.items.map(function (i) { return { description: i.name, qty: i.quantity, unitPrice: i.unitPrice }; }), 'unitPrice', [['Total', o.total, true]]) + '</div>' +
        (o.dispatch
          ? '<div class="card"><strong>Dispatched</strong> ' + esc(fmtWhen(o.dispatch.at)) + (o.dispatch.courier ? ' · ' + esc(o.dispatch.courier) : '') + (o.dispatch.tracking ? ' · <span class="mono">' + trackLink(o.dispatch.courier, o.dispatch.tracking) + '</span>' : '') +
            (o.dispatch.serials && o.dispatch.serials.length ? '<br>Serials: ' + o.dispatch.serials.map(function (sn) { return '<a class="mono" href="#/device/' + encodeURIComponent(sn) + '">' + esc(sn) + '</a>'; }).join(', ') : '') + '</div>'
          : '<h3>Dispatch</h3><form id="dsp" class="card"><div class="lbl">Units going out</div>' +
            (avail.length ? avail.map(function (d) { return '<label class="pick"><input type="checkbox" value="' + esc(d.serial) + '"> ' + esc(META.models[d.model]) + ' · <span class="mono">' + esc(d.serial) + '</span></label>'; }).join('') : '<p class="muted">No matching units in stock.</p>') +
            '<div class="three" style="margin-top:12px">' + field('Courier', 'dCour', input('dCour', 'Royal Mail')) + field('Tracking number', 'dTrack', input('dTrack', '', { extra: ' class="mono"' })) + field('Dispatched on', 'dAt', input('dAt', today(), { type: 'date' })) + '</div>' +
            '<div id="dMsg"></div><button class="btn" type="submit">Dispatch</button></form>');
      var dsp = $('#dsp');
      if (dsp) dsp.onsubmit = function (e) {
        e.preventDefault();
        var serials = $$('#dsp .pick input:checked').map(function (c) { return c.value; });
        api('POST', 'orders/' + encodeURIComponent(o.orderId) + '/dispatch', { serials: serials, courier: val('#dCour'), tracking: val('#dTrack'), at: val('#dAt') })
          .then(function () { webOrderView(id); }).catch(function (err) { errBox('#dMsg', err); });
      };
    }).catch(function (e) { errBox('#main', e); });
  }

  /* ================= CUSTOMERS ================= */
  function customerList() {
    loading();
    api('GET', 'customers').then(function (r) {
      var list = r.customers.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      main().innerHTML =
        '<div class="head"><h2>Customers</h2><a class="btn sm" href="#/customers/new">New customer</a></div>' +
        '<div class="tools"><input type="search" id="cq" placeholder="Search name, contact, email"></div><div class="list" id="cRows"></div>';
      function draw(q) {
        var shown = list.filter(function (c) { return !q || [c.name, c.contact, c.email, c.id].join(' ').toLowerCase().indexOf(q) > -1; });
        $('#cRows').innerHTML = shown.length ? shown.map(function (c) {
          return '<a class="row" href="#/customers/' + esc(c.id) + '"><div><div class="t">' + esc(c.name) + '</div><div class="s">' + esc([c.contact !== c.name ? c.contact : '', c.email].filter(Boolean).join(' · ')) + '</div></div><div class="r muted">' + esc(c.id) + '</div></a>';
        }).join('') : '<div class="empty">' + (list.length ? 'Nothing matches.' : 'No customers yet.') + '</div>';
      }
      draw('');
      $('#cq').oninput = function () { draw(this.value.toLowerCase()); };
    }).catch(function (e) { errBox('#main', e); });
  }

  function contactEditor(contacts) {
    function row(c) {
      return '<div class="contact-ed"><div class="two"><div><label>Name</label><input type="text" class="cn" value="' + esc(c.name) + '"></div>' +
        '<div><label>Role</label><input type="text" class="cr" value="' + esc(c.role) + '" placeholder="e.g. Buyer, Accounts"></div></div>' +
        '<div class="two" style="margin-top:8px"><div><label>Email</label><input type="email" class="ce" value="' + esc(c.email) + '"></div>' +
        '<div><label>Phone</label><input type="tel" class="cp" value="' + esc(c.phone) + '"></div></div>' +
        '<button type="button" class="link" data-rmc style="margin-top:6px">Remove contact</button></div>';
    }
    return {
      html: '<div id="contacts">' + (contacts.length ? contacts : [{}]).map(row).join('') + '</div><button type="button" class="btn ghost sm" id="addContact">+ Add contact</button>',
      bind: function bind() {
        $$('[data-rmc]').forEach(function (b) { b.onclick = function () { b.closest('.contact-ed').remove(); }; });
        $('#addContact').onclick = function () { $('#contacts').insertAdjacentHTML('beforeend', row({})); bind(); };
      },
      read: function () {
        return $$('#contacts .contact-ed').map(function (ed) {
          return { name: ed.querySelector('.cn').value, role: ed.querySelector('.cr').value, email: ed.querySelector('.ce').value, phone: ed.querySelector('.cp').value };
        });
      },
    };
  }

  function customerForm(id) {
    (id ? api('GET', 'customers/' + encodeURIComponent(id)) : Promise.resolve({ customer: { contacts: [] } })).then(function (r) {
      var c = r.customer, ce = contactEditor(c.contacts || []);
      main().innerHTML =
        '<a class="back" href="' + (id ? '#/customers/' + esc(id) : '#/customers') + '">← ' + (id ? esc(c.company || id) : 'Customers') + '</a>' +
        '<h2>' + (id ? 'Edit customer' : 'New customer') + '</h2><form id="cF" class="card"><div class="two">' +
        field('Company', 'cCo', input('cCo', c.company, { extra: ' placeholder="Leave blank for a private buyer"' })) +
        field('VAT number', 'cVat', input('cVat', c.vatNumber, { extra: ' class="mono"' })) + '</div>' +
        '<div class="lbl">Contacts</div>' + ce.html +
        '<div class="two" style="margin-top:14px">' + field('Billing address', 'cBill', area('cBill', c.billingAddress)) + field('Delivery address', 'cDel', area('cDel', c.deliveryAddress, 'If different from billing')) + '</div>' +
        field('Notes', 'cNotes', area('cNotes', c.notes)) +
        '<div id="cMsg"></div><div class="actions"><button class="btn" type="submit" id="cGo">' + (id ? 'Save' : 'Create customer') + '</button>' +
        (id ? '<button class="btn danger" type="button" id="cDelB" style="margin-left:auto">Delete</button>' : '') + '</div></form>';
      ce.bind();
      $('#cF').onsubmit = function (e) {
        e.preventDefault();
        var btn = $('#cGo'); busy(btn, true);
        var body = { company: val('#cCo'), vatNumber: val('#cVat'), contacts: ce.read(), billingAddress: val('#cBill'), deliveryAddress: val('#cDel'), notes: val('#cNotes') };
        api(id ? 'PUT' : 'POST', 'customers' + (id ? '/' + encodeURIComponent(id) : ''), body)
          .then(function (res) { go('#/customers/' + encodeURIComponent(res.customer.id)); })
          .catch(function (err) { busy(btn, false); errBox('#cMsg', err); });
      };
      var del = $('#cDelB');
      if (del) del.onclick = function () {
        if (!confirm('Delete this customer?')) return;
        api('DELETE', 'customers/' + encodeURIComponent(id)).then(function () { go('#/customers'); }).catch(function (err) { errBox('#cMsg', err); });
      };
    }).catch(function (e) { errBox('#main', e); });
  }

  function customerView(id) {
    loading();
    api('GET', 'customers/' + encodeURIComponent(id)).then(function (r) {
      var c = r.customer;
      var spent = r.sales.filter(function (s) { return ['paid', 'dispatched', 'delivered'].indexOf(s.status) > -1; }).reduce(function (t, s) { return t + (s.total || 0); }, 0);
      main().innerHTML =
        '<a class="back" href="#/customers">← Customers</a>' +
        '<div class="head"><h2>' + esc(c.company || (c.contacts[0] && c.contacts[0].name) || id) + '</h2><div class="actions"><a class="btn ghost sm" href="#/customers/' + esc(id) + '/edit">Edit</a><a class="btn sm" href="#/sales/new/' + esc(id) + '">New sale</a></div></div>' +
        '<p class="muted">' + esc(id) + ' · ' + r.sales.length + ' order' + (r.sales.length === 1 ? '' : 's') + ' · ' + money(spent) + ' paid in total</p>' +
        '<div class="card"><dl>' + (c.vatNumber ? '<dt>VAT number</dt><dd class="mono">' + esc(c.vatNumber) + '</dd>' : '') +
        (c.billingAddress ? '<dt>Billing</dt><dd>' + esc(c.billingAddress) + '</dd>' : '') +
        (c.deliveryAddress ? '<dt>Delivery</dt><dd>' + esc(c.deliveryAddress) + '</dd>' : '') +
        (c.notes ? '<dt>Notes</dt><dd>' + esc(c.notes) + '</dd>' : '') + '</dl></div>' +
        '<h3>Contacts</h3><div class="list">' + (c.contacts.length ? c.contacts.map(function (p) {
          return '<div class="row"><div><div class="t">' + esc(p.name) + (p.role ? ' <span class="muted">· ' + esc(p.role) + '</span>' : '') + '</div>' +
            '<div class="s">' + [p.email ? '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : '', p.phone ? '<a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + '</a>' : ''].filter(Boolean).join(' · ') + '</div></div></div>';
        }).join('') : '<div class="empty">No contacts.</div>') + '</div>' +
        '<h3>Orders</h3><div class="list">' + (r.sales.length ? r.sales.sort(function (a, b) { return (b.orderedAt || '').localeCompare(a.orderedAt || ''); }).map(function (s) {
          return '<a class="row" href="#/sales/' + esc(s.id) + '"><div><div class="t">' + esc(s.id) + '</div><div class="s">' + esc(fmtDate(s.orderedAt)) + ' · ' + esc(s.lines.map(function (l) { return l.qty + ' × ' + l.description; }).join(', ')) + '</div></div>' +
            '<div class="r">' + pill(s.status, META.saleStatuses) + '<span class="num">' + money(s.total) + '</span></div></a>';
        }).join('') : '<div class="empty">No orders yet.</div>') + '</div>' +
        '<h3>Units they hold</h3><div class="list">' + (r.devices.length ? r.devices.map(function (d) {
          return '<a class="row" href="#/device/' + encodeURIComponent(d.serial) + '"><div><div class="t">' + esc(META.models[d.model]) + '</div><div class="s mono">' + esc(d.serial) + '</div></div><div class="r">' + pill(d.status, META.deviceStatuses) + '</div></a>';
        }).join('') : '<div class="empty">None.</div>') + '</div>';
    }).catch(function (e) { errBox('#main', e); });
  }

  /* ================= SUPPLIERS ================= */
  function supplierList() {
    loading();
    api('GET', 'suppliers').then(function (r) {
      main().innerHTML =
        '<div class="head"><h2>Suppliers</h2><a class="btn sm" href="#/suppliers/new">New supplier</a></div>' +
        '<div class="list" style="margin-top:12px">' + (r.suppliers.length ? r.suppliers.map(function (s) {
          return '<a class="row" href="#/suppliers/' + esc(s.id) + '"><div><div class="t">' + esc(s.name) + '</div><div class="s">' + esc(s.contact) + '</div></div><div class="r muted">' + esc(s.id) + '</div></a>';
        }).join('') : '<div class="empty">No suppliers yet.</div>') + '</div>';
    }).catch(function (e) { errBox('#main', e); });
  }

  function supplierForm(id) {
    (id ? api('GET', 'suppliers/' + encodeURIComponent(id)) : Promise.resolve({ supplier: {} })).then(function (r) {
      var s = r.supplier;
      main().innerHTML =
        '<a class="back" href="' + (id ? '#/suppliers/' + esc(id) : '#/suppliers') + '">← ' + (id ? esc(s.name) : 'Suppliers') + '</a>' +
        '<h2>' + (id ? 'Edit supplier' : 'New supplier') + '</h2><form id="spF" class="card">' +
        field('Name', 'spName', input('spName', s.name)) +
        '<div class="two">' + field('Contact', 'spCon', input('spCon', s.contact)) + field('Website / store', 'spWeb', input('spWeb', s.website)) + '</div>' +
        '<div class="two">' + field('Email', 'spEmail', input('spEmail', s.email, { type: 'email' })) + field('Phone', 'spPhone', input('spPhone', s.phone, { type: 'tel' })) + '</div>' +
        field('Address', 'spAddr', area('spAddr', s.address)) + field('Notes', 'spNotes', area('spNotes', s.notes)) +
        '<div id="spMsg"></div><div class="actions"><button class="btn" type="submit" id="spGo">' + (id ? 'Save' : 'Create supplier') + '</button>' +
        (id ? '<button class="btn danger" type="button" id="spDel" style="margin-left:auto">Delete</button>' : '') + '</div></form>';
      $('#spF').onsubmit = function (e) {
        e.preventDefault();
        var btn = $('#spGo'); busy(btn, true);
        var body = { name: val('#spName'), contact: val('#spCon'), website: val('#spWeb'), email: val('#spEmail'), phone: val('#spPhone'), address: val('#spAddr'), notes: val('#spNotes') };
        api(id ? 'PUT' : 'POST', 'suppliers' + (id ? '/' + encodeURIComponent(id) : ''), body)
          .then(function (res) { go('#/suppliers/' + encodeURIComponent(res.supplier.id)); })
          .catch(function (err) { busy(btn, false); errBox('#spMsg', err); });
      };
      var del = $('#spDel');
      if (del) del.onclick = function () {
        if (!confirm('Delete this supplier?')) return;
        api('DELETE', 'suppliers/' + encodeURIComponent(id)).then(function () { go('#/suppliers'); }).catch(function (err) { errBox('#spMsg', err); });
      };
    }).catch(function (e) { errBox('#main', e); });
  }

  function supplierView(id) {
    loading();
    api('GET', 'suppliers/' + encodeURIComponent(id)).then(function (r) {
      var s = r.supplier;
      var spent = r.purchases.reduce(function (t, p) { return t + (p.amountPaid || 0); }, 0);
      main().innerHTML =
        '<a class="back" href="#/suppliers">← Suppliers</a>' +
        '<div class="head"><h2>' + esc(s.name) + '</h2><div class="actions"><a class="btn ghost sm" href="#/suppliers/' + esc(id) + '/edit">Edit</a><a class="btn sm" href="#/in/new">New purchase order</a></div></div>' +
        '<p class="muted">' + esc(id) + ' · ' + r.purchases.length + ' purchase order' + (r.purchases.length === 1 ? '' : 's') + ' · ' + money(spent) + ' paid in total</p>' +
        '<div class="card"><dl>' + (s.contact ? '<dt>Contact</dt><dd>' + esc(s.contact) + '</dd>' : '') +
        (s.email ? '<dt>Email</dt><dd><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></dd>' : '') +
        (s.phone ? '<dt>Phone</dt><dd>' + esc(s.phone) + '</dd>' : '') +
        (s.website ? '<dt>Store</dt><dd>' + esc(s.website) + '</dd>' : '') +
        (s.address ? '<dt>Address</dt><dd>' + esc(s.address) + '</dd>' : '') +
        (s.notes ? '<dt>Notes</dt><dd>' + esc(s.notes) + '</dd>' : '') + '</dl></div>' +
        '<h3>Purchase orders</h3><div class="list">' + (r.purchases.length ? r.purchases.map(function (p) {
          return '<a class="row" href="#/in/' + esc(p.id) + '"><div><div class="t">' + esc(p.id) + '</div><div class="s">' + esc(fmtDate(p.orderedAt)) + ' · ' + esc(p.received || 0) + '/' + esc(p.units || 0) + ' received</div></div>' +
            '<div class="r">' + pill(p.status, META.purchaseStatuses) + '<span class="num">' + money(p.amountPaid) + '</span></div></a>';
        }).join('') : '<div class="empty">None yet.</div>') + '</div>';
    }).catch(function (e) { errBox('#main', e); });
  }

  /* ================= MOVEMENTS ================= */
  function moveList() {
    loading();
    api('GET', 'moves').then(function (r) {
      var T = META.moveTypes;
      function draw() {
        var shown = r.moves.filter(function (m) { return UI.moveFilter === 'all' || m.type === UI.moveFilter; });
        $('#mRows').innerHTML = shown.length ? shown.map(function (m) {
          var refHref = /^PO-/.test(m.ref) ? '#/in/' + m.ref : /^cs_|^[0-9A-Z]{17}$/.test(m.ref) ? '#/web/' + m.ref : m.ref ? '#/sales/' + m.ref : '';
          return '<div class="row"><div><div class="t">' + esc(T[m.type] || m.type) + ' · <a class="mono" href="#/device/' + encodeURIComponent(m.serial) + '">' + esc(m.serial) + '</a></div>' +
            '<div class="s">' + esc(META.models[m.model] || m.model) + (m.party ? ' · ' + esc(m.party) : '') + (m.ref ? ' · ' + (refHref ? '<a href="' + esc(refHref) + '">' + esc(m.ref) + '</a>' : esc(m.ref)) : '') + '</div>' +
            (m.note ? '<div class="s">' + esc(m.note) + '</div>' : '') + '</div><div class="r">' + pill(m.type, T) + '<span class="muted">' + esc(fmtDate(m.at)) + '</span></div></div>';
        }).join('') : '<div class="empty">No movements yet.</div>';
      }
      var counts = { in: 0, out: 0, return: 0, adjust: 0 };
      r.moves.forEach(function (m) { counts[m.type] = (counts[m.type] || 0) + 1; });
      main().innerHTML =
        '<h2>Movements</h2><p class="muted">Every unit in and out, newest first. Entries are never edited.</p>' +
        '<div class="grid-sum">' + Object.keys(T).map(function (k) { return '<div class="sum"><div class="n">' + (counts[k] || 0) + '</div><div class="l">' + esc(T[k]) + '</div></div>'; }).join('') + '</div>' +
        '<div class="chips" style="margin-top:14px">' + [['all', 'All']].concat(Object.keys(T).map(function (k) { return [k, T[k]]; })).map(function (p) {
          return '<button class="chip' + (UI.moveFilter === p[0] ? ' on' : '') + '" data-mf="' + p[0] + '">' + esc(p[1]) + '</button>';
        }).join('') + '</div><div class="list" id="mRows"></div>';
      draw();
      $$('[data-mf]').forEach(function (b) {
        b.onclick = function () { UI.moveFilter = b.getAttribute('data-mf'); $$('[data-mf]').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); };
      });
    }).catch(function (e) { errBox('#main', e); });
  }

  /* ================= VISITS =================
     Counted by the worker on every page request (src/pageviews.js), so
     visitors who block Google Analytics or decline cookies are included.
     Only requests shaped like a browser navigation count, and the UK-only
     view is the default: for a UK shop that is the trend worth watching. */
  function pctChange(now, before) {
    if (!before) return now ? 'new' : '';
    var pc = Math.round(100 * (now - before) / before);
    return (pc > 0 ? '+' : '') + pc + '%';
  }
  /* Product page views, basket views, confirmations and orders for the
     period. Orders come from the KV store (null when it is not bound), so
     "views per order" is the one conversion figure the site can measure
     without any cookie. */
  function funnelBlock(r) {
    var f = r.funnel || { products: 0, productsMobile: 0, cart: 0, confirmations: 0 };
    var orders = r.orders;
    var perOrder = orders ? Math.round(f.products / orders) : null;
    return '<div class="lbl" style="margin-top:18px">Funnel' + (r.uk ? ' (UK)' : '') + '</div>' +
      '<div class="grid-sum" style="margin-top:6px">' +
        '<div class="sum"><div class="n">' + f.products + '</div><div class="l">Product page views' + (f.products ? ' (' + Math.round(100 * f.productsMobile / f.products) + '% mobile)' : '') + '</div></div>' +
        '<div class="sum"><div class="n">' + f.cart + '</div><div class="l">Basket views</div></div>' +
        '<div class="sum"><div class="n">' + f.confirmations + '</div><div class="l">Order confirmations</div></div>' +
        '<div class="sum"><div class="n">' + (orders == null ? 'n/a' : orders) + '</div><div class="l">Orders paid (all countries)</div></div>' +
        '<div class="sum"><div class="n">' + (perOrder == null ? 'n/a' : perOrder) + '</div><div class="l">Product views per order</div></div>' +
      '</div>';
  }

  /* Verified search engine fetches: who is crawling, and which of the
     content pages (guides, works-with, trade, compare) they reached last.
     Never filtered by country: crawlers come from wherever they come from. */
  function crawlBlock(r) {
    var c = r.crawls || { byBot: [], recent: [] };
    var bots = c.byBot.map(function (b) { return { name: b.bot, views: b.hits }; });
    var recent = c.recent.map(function (x) { return { path: x.path, views: x.hits, day: x.day }; });
    var max = bots.reduce(function (m, x) { return Math.max(m, x.views); }, 0) || 1;
    return '<div class="lbl" style="margin-top:18px">Crawler hits (everywhere)</div><div class="list">' + (bots.length ? bots.map(function (b) {
        return '<div class="row"><div><div class="t">' + esc(b.name) + '</div><div class="vbar" style="width:' + Math.round(100 * b.views / max) + '%"></div></div><div class="r num">' + b.views + '</div></div>';
      }).join('') : '<div class="empty">No verified crawler has fetched a page in this period.</div>') + '</div>' +
      '<div class="lbl" style="margin-top:18px">Content pages crawled most recently</div><div class="list">' + (recent.length ? recent.map(function (x) {
        return '<div class="row"><div><div class="t mono">' + esc(x.path) + '</div><div class="s">last fetched ' + esc(fmtDate(x.day)) + '</div></div><div class="r num">' + x.views + '</div></div>';
      }).join('') : '<div class="empty">Nothing yet.</div>') + '</div>';
  }

  function visitsView() {
    loading();
    api('GET', 'visits?days=' + UI.visitDays + '&uk=' + (UI.visitUk ? 1 : 0)).then(function (r) {
      function bars(title, rows, key, label, sub) {
        var max = rows.reduce(function (m, x) { return Math.max(m, x.views); }, 0) || 1;
        return '<div class="lbl" style="margin-top:18px">' + esc(title) + '</div><div class="list">' + (rows.length ? rows.map(function (x) {
          var extra = sub ? sub(x) : '';
          return '<div class="row"><div><div class="t' + (key === 'path' ? ' mono' : '') + '">' + esc(label ? label(x[key]) : x[key]) + '</div>' +
            '<div class="vbar" style="width:' + Math.round(100 * x.views / max) + '%"></div></div>' +
            '<div class="r num">' + x.views + (extra ? '<span class="s">' + extra + '</span>' : '') + '</div></div>';
        }).join('') : '<div class="empty">Nothing yet.</div>') + '</div>';
      }
      var today = r.byDay.length ? r.byDay[r.byDay.length - 1].views : 0;
      var mobile = (r.devices.filter(function (d) { return d.device === 'mobile'; })[0] || { views: 0 }).views;
      var change = pctChange(r.total, r.previous.total);
      var perDay = r.days ? Math.round(10 * r.total / r.days) / 10 : 0;
      var strictInWindow = r.strictSince && r.since < r.strictSince;
      main().innerHTML =
        '<h2>Visits</h2><p class="muted">Page views counted on the server, including visitors who block Google Analytics. No cookies, nothing that identifies anyone. Only requests shaped like a browser opening a page are counted, so crawlers are left out.</p>' +
        '<div class="chips" style="margin-top:14px">' + [[7, '7 days'], [30, '30 days'], [90, '90 days']].map(function (p) {
          return '<button class="chip' + (UI.visitDays === p[0] ? ' on' : '') + '" data-vd="' + p[0] + '">' + p[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="chips">' + [[1, 'UK only'], [0, 'Everywhere']].map(function (p) {
          return '<button class="chip' + ((UI.visitUk ? 1 : 0) === p[0] ? ' on' : '') + '" data-vuk="' + p[0] + '">' + p[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="grid-sum">' +
          '<div class="sum"><div class="n">' + r.total + '</div><div class="l">' + (r.uk ? 'UK page views' : 'Page views') + ', last ' + r.days + ' days</div></div>' +
          '<div class="sum"><div class="n">' + (change || '–') + '</div><div class="l">vs the ' + r.days + ' days before (' + r.previous.total + ')</div></div>' +
          '<div class="sum"><div class="n">' + perDay + '</div><div class="l">A day, on average</div></div>' +
          '<div class="sum"><div class="n">' + today + '</div><div class="l">Today (UTC)</div></div>' +
          '<div class="sum"><div class="n">' + (r.total ? Math.round(100 * mobile / r.total) : 0) + '%</div><div class="l">On mobile</div></div>' +
        '</div>' +
        (strictInWindow ? '<p class="muted" style="margin-top:10px">Stricter bot filtering started on ' + esc(fmtDate(r.strictSince)) + '. Earlier days include crawlers that copied a browser user agent, so compare days before and after with care.</p>' : '') +
        bars('By day' + (r.uk ? ' (UK)' : ''), r.byDay.slice().reverse(), 'day', fmtDate, r.uk ? null : function (x) { return x.uk + ' UK'; }) +
        bars('Top pages', r.pages, 'path', null, function (x) { return 'was ' + x.previous; }) +
        bars('Referring sites', r.referrers, 'referrer') +
        bars('Search landing pages' + (r.uk ? ' (UK)' : ''), r.landing || [], 'path', null, function (x) { return 'was ' + x.previous; }) +
        funnelBlock(r) +
        crawlBlock(r) +
        bars('Dead URLs, 404s (everywhere, crawlers included)', (r.misses || []).map(function (m) { return { path: m.path, views: m.hits, referrer: m.referrer }; }), 'path', null, function (x) { return x.referrer ? 'from ' + esc(x.referrer) : 'no referrer'; }) +
        bars('Countries (all visits)', r.countries, 'country', function (c) { return c || 'Unknown'; });
      $$('[data-vd]').forEach(function (b) {
        b.onclick = function () { UI.visitDays = +b.getAttribute('data-vd'); visitsView(); };
      });
      $$('[data-vuk]').forEach(function (b) {
        b.onclick = function () { UI.visitUk = b.getAttribute('data-vuk') === '1'; visitsView(); };
      });
    }).catch(function (e) { errBox('#main', e); });
  }

  /* ================= ONE-TAP LOAD =================
     A link like /admin#/load/<data> carries an import in its fragment (the
     part after # is never sent to a server). It asks before importing, so a
     link someone else sends cannot change anything on its own. */
  function b64urlToBytes(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function decodePayload(enc) {
    var zipped = enc.indexOf('z.') === 0;
    var bytes = b64urlToBytes(zipped ? enc.slice(2) : enc);
    if (!zipped) return Promise.resolve(new TextDecoder().decode(bytes));
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }
  function loadView(enc) {
    main().innerHTML = '<p class="muted" style="margin-top:24px">Reading link…</p>';
    decodePayload(enc || '').then(function (text) {
      var data = JSON.parse(text);
      var counts = ['customers', 'suppliers', 'purchases', 'sales', 'devices', 'moves'].filter(function (k) { return (data[k] || []).length; })
        .map(function (k) { return data[k].length + ' ' + k; });
      if (!counts.length) throw new Error('empty');
      var names = (data.customers || []).map(function (c) { return c.company || (c.contacts && c.contacts[0] && c.contacts[0].name); }).filter(Boolean);
      main().innerHTML = '<h2>Import from link</h2><div class="card"><p style="margin-top:0">This link will add or update: <strong>' + esc(counts.join(', ')) + '</strong>' +
        (names.length ? ' (customer: ' + esc(names.join(', ')) + ')' : '') + '.</p><p class="muted">Records that already exist are updated, not duplicated. Only continue if you made this link or asked for it.</p>' +
        '<div id="ldMsg"></div><div class="actions"><button class="btn" id="ldGo">Import now</button><a class="btn ghost" href="#/stock">Cancel</a></div></div>';
      $('#ldGo').onclick = function () {
        var btn = this; busy(btn, true);
        api('POST', 'import', data).then(function () {
          // Drop the data from the address bar so a reload cannot import it again.
          history.replaceState(null, '', '#/loaded');
          $('#ldMsg').innerHTML = '<div class="msg ok">Done. Imported ' + esc(counts.join(', ')) + '.</div>';
          btn.style.display = 'none';
          $$('.actions a').forEach(function (a) { a.textContent = 'See stock'; a.className = 'btn'; });
        }).catch(function (err) { busy(btn, false); errBox('#ldMsg', err); });
      };
    }).catch(function () {
      main().innerHTML = '<h2>Import from link</h2><div class="msg bad">That link is damaged or incomplete, so nothing was imported.</div><a class="btn ghost" href="#/stock">Back to stock</a>';
    });
  }

  /* ================= IMPORT ================= */
  function importView() {
    main().innerHTML =
      '<h2>Import</h2><p class="muted">Bring records in from a JSON file: customers, suppliers, purchase orders, sales orders, units and movements. Records with an id that already exists are updated, not duplicated.</p>' +
      '<form id="imF" class="card">' + field('JSON file', 'imFile', '<input type="file" id="imFile" accept="application/json,.json">') +
      field('…or paste it', 'imText', '<textarea id="imText" style="min-height:160px" class="mono"></textarea>') +
      '<div id="imMsg"></div><button class="btn" type="submit" id="imGo">Import</button></form>';
    $('#imFile').onchange = function () {
      var f = this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { $('#imText').value = rd.result; };
      rd.readAsText(f);
    };
    $('#imF').onsubmit = function (e) {
      e.preventDefault();
      var data;
      try { data = JSON.parse(val('#imText')); } catch (err) { errBox('#imMsg', 'That is not valid JSON.'); return; }
      var btn = $('#imGo'); busy(btn, true);
      api('POST', 'import', data).then(function (r) {
        busy(btn, false);
        var n = r.imported;
        $('#imMsg').innerHTML = '<div class="msg ok">Imported: ' + Object.keys(n).filter(function (k) { return n[k]; }).map(function (k) { return n[k] + ' ' + k; }).join(', ') + '.</div>';
      }).catch(function (err) { busy(btn, false); errBox('#imMsg', err); });
    };
  }

  if (token) boot(false); else renderLogin();
})();
</script>
</body>
</html>`;
