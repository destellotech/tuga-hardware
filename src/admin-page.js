/* ============================================
   TUGA HARDWARE — /admin page (stock & orders)
   Served by the worker, not the static build, so
   it never lands in the sitemap or the assets.
   The page holds no data: it asks /api/admin/*
   with the ADMIN_TOKEN the user types in once.
   ============================================ */

export const ADMIN_PAGE = String.raw`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Tuga Stock</title>
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
  .wrap { max-width: 920px; margin: 0 auto; padding: 0 16px 80px; }
  header { position: sticky; top: 0; z-index: 5; background: var(--bg); border-bottom: 1px solid var(--rule); }
  .bar { max-width: 920px; margin: 0 auto; padding: 12px 16px 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .brand { font-weight: 800; font-size: 18px; letter-spacing: -0.01em; }
  .brand span { color: var(--accent); }
  .tabs { max-width: 920px; margin: 0 auto; padding: 0 16px; display: flex; gap: 4px; }
  .tab { background: none; border: none; padding: 12px 12px 10px; font-weight: 600; color: var(--ink-light); border-bottom: 2px solid transparent; cursor: pointer; }
  .tab.on { color: var(--ink); border-bottom-color: var(--accent); }
  .link { background: none; border: none; color: var(--ink-light); font-size: 14px; cursor: pointer; padding: 6px; }
  h2 { font-size: 20px; margin: 22px 0 12px; }
  .muted { color: var(--ink-light); font-size: 14px; }
  .btn { border: none; border-radius: 10px; padding: 11px 16px; font-weight: 700; cursor: pointer; background: var(--accent); color: var(--accent-ink); }
  .btn.ghost { background: var(--raised); color: var(--ink); border: 1px solid var(--rule-strong); }
  .btn.danger { background: none; color: var(--bad); border: 1px solid var(--bad); }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .grid-sum { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .sum { background: var(--raised); border: 1px solid var(--rule); border-radius: 12px; padding: 12px; }
  .sum .n { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .sum .l { font-size: 13px; color: var(--ink-mid); }
  .tools { display: flex; gap: 8px; flex-wrap: wrap; margin: 18px 0 10px; }
  .tools input { flex: 1 1 220px; }
  input[type=text], input[type=search], input[type=date], input[type=password], select, textarea {
    width: 100%; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--rule-strong); background: var(--raised);
  }
  textarea { min-height: 70px; resize: vertical; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { border: 1px solid var(--rule-strong); background: var(--raised); border-radius: 999px; padding: 6px 12px; font-size: 14px; cursor: pointer; }
  .chip.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .list { background: var(--raised); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; }
  .row { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; padding: 12px 14px; border-bottom: 1px solid var(--rule); cursor: pointer; width: 100%; text-align: left; background: none; border-left: 0; border-right: 0; border-top: 0; }
  .row:last-child { border-bottom: none; }
  .row:hover { background: var(--surface); }
  .row .t { font-weight: 700; }
  .row .s { color: var(--ink-mid); font-size: 14px; }
  .mono { font-family: var(--mono); font-size: 0.92em; overflow-wrap: anywhere; }
  .pill { display: inline-block; border-radius: 999px; padding: 3px 10px; font-size: 12.5px; font-weight: 700; white-space: nowrap; align-self: start; }
  .st-in_stock { background: var(--ok-soft); color: var(--ok); }
  .st-reserved { background: var(--warn-soft); color: var(--warn); }
  .st-assigned { background: var(--info-soft); color: var(--info); }
  .st-sold { background: var(--mute-soft); color: var(--ink-mid); }
  .st-returned { background: var(--warn-soft); color: var(--warn); }
  .st-faulty { background: var(--bad-soft); color: var(--bad); }
  .st-pending { background: var(--warn-soft); color: var(--warn); }
  .st-dispatched { background: var(--ok-soft); color: var(--ok); }
  form .f { margin-bottom: 14px; }
  form label, .lbl { display: block; font-size: 13px; font-weight: 700; color: var(--ink-mid); margin-bottom: 5px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .hint { font-size: 13px; margin-top: 4px; min-height: 1em; }
  .hint.bad { color: var(--bad); } .hint.ok { color: var(--ok); }
  .msg { padding: 10px 12px; border-radius: 10px; margin: 12px 0; font-size: 14px; }
  .msg.bad { background: var(--bad-soft); color: var(--bad); }
  .msg.ok { background: var(--ok-soft); color: var(--ok); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
  .empty { padding: 28px 16px; text-align: center; color: var(--ink-light); }
  .sheet-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; align-items: flex-end; justify-content: center; z-index: 20; }
  .sheet-bg.open { display: flex; }
  .sheet { background: var(--bg); width: 100%; max-width: 620px; max-height: 92vh; overflow-y: auto; border-radius: 18px 18px 0 0; padding: 20px 16px 32px; }
  @media (min-width: 700px) { .sheet-bg { align-items: center; } .sheet { border-radius: 18px; } }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0 0 16px; font-size: 15px; }
  dt { color: var(--ink-light); }
  dd { margin: 0; }
  .hist { font-size: 14px; border-left: 2px solid var(--rule-strong); padding-left: 12px; }
  .hist div { margin-bottom: 8px; }
  .order { background: var(--raised); border: 1px solid var(--rule); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
  .order .head { display: flex; justify-content: space-between; gap: 10px; }
  .order ul { margin: 8px 0; padding-left: 18px; }
  .pick { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 14.5px; }
  .login { max-width: 380px; margin: 12vh auto 0; }
  @media (max-width: 520px) { .two { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div id="root"></div>
<div class="sheet-bg" id="sheetBg"><div class="sheet" id="sheet" role="dialog" aria-modal="true"></div></div>
<script>
(function () {
  'use strict';
  var TOKEN_KEY = 'tugaAdminToken';
  var token = '';
  try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}

  var S = { view: 'stock', devices: [], models: {}, statuses: {}, orders: null, filter: 'all', q: '', lastModel: '' };
  var root = document.getElementById('root');
  var sheetBg = document.getElementById('sheetBg');
  var sheet = document.getElementById('sheet');

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtWhen(iso) {
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function money(p, cur) { return p == null ? '' : (cur === 'GBP' || !cur ? '£' : cur + ' ') + (p / 100).toFixed(2); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function luhn(s) {
    if (!/^\d{15}$/.test(s)) return false;
    var sum = 0;
    for (var i = 0; i < 15; i++) { var d = +s[14 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
    return sum % 10 === 0;
  }
  function pill(status, label) { return '<span class="pill st-' + esc(status) + '">' + esc(label || status) + '</span>'; }

  function api(method, path, body) {
    return fetch('/api/admin/' + path, {
      method: method,
      headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (r.status === 404 && path === 'devices' && method === 'GET') throw { auth: true };
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || ('Request failed (' + r.status + ')'));
        return data;
      });
    });
  }

  function loadDevices() {
    return api('GET', 'devices').then(function (d) {
      S.devices = d.devices; S.models = d.models; S.statuses = d.statuses;
      if (!S.lastModel) S.lastModel = Object.keys(S.models)[0] || '';
    });
  }

  /* ---------------- login ---------------- */
  function renderLogin(err) {
    root.innerHTML =
      '<div class="wrap"><form class="login" id="loginForm">' +
      '<div class="brand" style="font-size:24px;margin-bottom:6px">Tuga <span>Stock</span></div>' +
      '<p class="muted">Enter the admin token (the ADMIN_TOKEN secret). It stays on this device.</p>' +
      (err ? '<div class="msg bad">' + esc(err) + '</div>' : '') +
      '<div class="f"><label for="tok">Admin token</label><input type="password" id="tok" autocomplete="current-password" required></div>' +
      '<button class="btn" type="submit">Sign in</button></form></div>';
    $('#loginForm').onsubmit = function (e) {
      e.preventDefault();
      token = $('#tok').value.trim();
      boot(true);
    };
  }

  function boot(remember) {
    loadDevices().then(function () {
      if (remember) { try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {} }
      render();
    }).catch(function (e) {
      if (e && e.auth) { try { localStorage.removeItem(TOKEN_KEY); } catch (x) {} renderLogin(token ? 'That token was not accepted.' : ''); }
      else renderLogin(e.message || 'Could not reach the server.');
    });
  }

  /* ---------------- shell ---------------- */
  function render() {
    root.innerHTML =
      '<header><div class="bar"><div class="brand">Tuga <span>Stock</span></div>' +
      '<button class="link" id="out">Sign out</button></div>' +
      '<nav class="tabs">' +
      ['stock', 'receive', 'orders'].map(function (v) {
        return '<button class="tab' + (S.view === v ? ' on' : '') + '" data-v="' + v + '">' + { stock: 'Stock', receive: 'Receive', orders: 'Orders' }[v] + '</button>';
      }).join('') + '</nav></header><main class="wrap" id="main"></main>';
    root.querySelectorAll('[data-v]').forEach(function (b) {
      b.onclick = function () { S.view = b.getAttribute('data-v'); render(); };
    });
    $('#out').onclick = function () { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} token = ''; renderLogin(); };
    if (S.view === 'stock') renderStock();
    else if (S.view === 'receive') renderReceive();
    else renderOrders();
  }

  /* ---------------- stock ---------------- */
  function matches(d) {
    if (S.filter !== 'all' && d.status !== S.filter) return false;
    if (!S.q) return true;
    var q = S.q.toLowerCase();
    return [d.serial, d.imei1, d.assignedTo, d.orderId, S.models[d.model]].some(function (v) { return v && String(v).toLowerCase().indexOf(q) > -1; });
  }

  function renderStock() {
    var main = $('#main');
    var byModel = {};
    S.devices.forEach(function (d) {
      var m = byModel[d.model] || (byModel[d.model] = { total: 0, in: 0 });
      m.total++; if (d.status === 'in_stock') m.in++;
    });
    var sums = Object.keys(S.models).filter(function (id) { return byModel[id]; }).map(function (id) {
      return '<div class="sum"><div class="n">' + byModel[id].in + '</div><div class="l">' + esc(S.models[id]) + ' in stock<br>' + byModel[id].total + ' recorded</div></div>';
    }).join('');

    var shown = S.devices.filter(matches);
    var rows = shown.map(function (d) {
      return '<button class="row" data-serial="' + esc(d.serial) + '">' +
        '<div><div class="t">' + esc(S.models[d.model] || d.model) + '</div>' +
        '<div class="s mono">' + esc(d.serial) + '</div>' +
        '<div class="s">' + (d.assignedTo ? esc(d.assignedTo) + ' · ' : '') + 'received ' + esc(fmtDate(d.receivedAt)) + '</div></div>' +
        pill(d.status, S.statuses[d.status]) + '</button>';
    }).join('');

    main.innerHTML =
      '<h2>Stock</h2>' +
      (sums ? '<div class="grid-sum">' + sums + '</div>' : '') +
      '<div class="tools"><input type="search" id="q" placeholder="Search serial, IMEI, person, order" value="' + esc(S.q) + '"></div>' +
      '<div class="chips" style="margin-bottom:12px">' +
      [['all', 'All']].concat(Object.keys(S.statuses).map(function (k) { return [k, S.statuses[k]]; })).map(function (p) {
        return '<button class="chip' + (S.filter === p[0] ? ' on' : '') + '" data-f="' + p[0] + '">' + esc(p[1]) + '</button>';
      }).join('') + '</div>' +
      (S.devices.length
        ? (shown.length ? '<div class="list">' + rows + '</div>' : '<div class="list"><div class="empty">Nothing matches.</div></div>')
        : '<div class="list"><div class="empty">No devices recorded yet.<br><br><button class="btn" id="goRecv">Receive the first one</button></div></div>');

    var q = $('#q');
    q.oninput = function () { S.q = q.value; var pos = q.selectionStart; renderStock(); var n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    main.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { S.filter = b.getAttribute('data-f'); renderStock(); }; });
    main.querySelectorAll('[data-serial]').forEach(function (b) { b.onclick = function () { openDevice(b.getAttribute('data-serial')); }; });
    var go = $('#goRecv'); if (go) go.onclick = function () { S.view = 'receive'; render(); };
  }

  /* ---------------- device sheet ---------------- */
  function openSheet(html) { sheet.innerHTML = html; sheetBg.classList.add('open'); }
  function closeSheet() { sheetBg.classList.remove('open'); sheet.innerHTML = ''; }
  sheetBg.addEventListener('click', function (e) { if (e.target === sheetBg) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  function statusOptions(sel) {
    return Object.keys(S.statuses).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(S.statuses[k]) + '</option>'; }).join('');
  }
  function modelOptions(sel) {
    return Object.keys(S.models).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(S.models[k]) + '</option>'; }).join('');
  }

  function openDevice(serial) {
    openSheet('<p class="muted">Loading…</p>');
    api('GET', 'devices/' + encodeURIComponent(serial)).then(function (r) {
      var d = r.device;
      var hist = (d.history || []).slice().reverse().map(function (h) {
        return '<div><strong>' + esc(h.event) + '</strong><br><span class="muted">' + esc(fmtWhen(h.at)) + (h.by ? ' · ' + esc(h.by) : '') + '</span></div>';
      }).join('');
      openSheet(
        '<div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><h2 style="margin-top:0">' + esc(S.models[d.model] || d.model) + '</h2>' + pill(d.status, S.statuses[d.status]) + '</div>' +
        '<dl><dt>Serial</dt><dd class="mono">' + esc(d.serial) + '</dd>' +
        (d.imei1 ? '<dt>IMEI 1</dt><dd class="mono">' + esc(d.imei1) + '</dd>' : '') +
        (d.imei2 ? '<dt>IMEI 2</dt><dd class="mono">' + esc(d.imei2) + '</dd>' : '') +
        '<dt>Received</dt><dd>' + esc(fmtDate(d.receivedAt)) + '</dd>' +
        (d.supplier ? '<dt>Supplier</dt><dd>' + esc(d.supplier) + '</dd>' : '') + '</dl>' +
        '<form id="edit"><div class="two"><div class="f"><label for="eStatus">Status</label><select id="eStatus">' + statusOptions(d.status) + '</select></div>' +
        '<div class="f"><label for="eModel">Model</label><select id="eModel">' + modelOptions(d.model) + '</select></div></div>' +
        '<div class="two"><div class="f"><label for="eWho">Assigned to / customer</label><input type="text" id="eWho" value="' + esc(d.assignedTo) + '"></div>' +
        '<div class="f"><label for="eOrder">Order</label><input type="text" id="eOrder" value="' + esc(d.orderId) + '"></div></div>' +
        '<div class="f"><label for="eNotes">Notes</label><textarea id="eNotes">' + esc(d.notes) + '</textarea></div>' +
        '<div id="eMsg"></div>' +
        '<div class="actions"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" id="eClose">Close</button>' +
        '<button class="btn danger" type="button" id="eDel" style="margin-left:auto">Delete</button></div></form>' +
        '<h2>History</h2><div class="hist">' + (hist || '<span class="muted">No history.</span>') + '</div>'
      );
      $('#eClose').onclick = closeSheet;
      $('#edit').onsubmit = function (e) {
        e.preventDefault();
        api('PATCH', 'devices/' + encodeURIComponent(d.serial), {
          status: $('#eStatus').value, model: $('#eModel').value,
          assignedTo: $('#eWho').value, orderId: $('#eOrder').value, notes: $('#eNotes').value,
        }).then(function () { return loadDevices(); }).then(function () { closeSheet(); render(); })
          .catch(function (err) { $('#eMsg').innerHTML = '<div class="msg bad">' + esc(err.message) + '</div>'; });
      };
      $('#eDel').onclick = function () {
        if (!confirm('Delete ' + d.serial + ' from stock records? Its history goes too.')) return;
        api('DELETE', 'devices/' + encodeURIComponent(d.serial)).then(loadDevices).then(function () { closeSheet(); render(); })
          .catch(function (err) { $('#eMsg').innerHTML = '<div class="msg bad">' + esc(err.message) + '</div>'; });
      };
    }).catch(function (err) { openSheet('<div class="msg bad">' + esc(err.message) + '</div>'); });
  }

  /* ---------------- receive ---------------- */
  function renderReceive(flash) {
    var main = $('#main');
    main.innerHTML =
      '<h2>Receive a device</h2><p class="muted">One unit per entry. Copy the serial and IMEIs from the label on the back.</p>' +
      (flash ? '<div class="msg ok">' + flash + '</div>' : '') +
      '<form id="recv" autocomplete="off">' +
      '<div class="two"><div class="f"><label for="rModel">Model</label><select id="rModel" required>' + modelOptions(S.lastModel) + '</select></div>' +
      '<div class="f"><label for="rDate">Received</label><input type="date" id="rDate" value="' + today() + '" required></div></div>' +
      '<div class="f"><label for="rSerial">Serial number (S/N)</label><input type="text" id="rSerial" class="mono" required autocapitalize="characters" spellcheck="false"></div>' +
      '<div class="two"><div class="f"><label for="rI1">IMEI 1</label><input type="text" id="rI1" class="mono" inputmode="numeric" maxlength="17"><div class="hint" id="hI1"></div></div>' +
      '<div class="f"><label for="rI2">IMEI 2</label><input type="text" id="rI2" class="mono" inputmode="numeric" maxlength="17"><div class="hint" id="hI2"></div></div></div>' +
      '<div class="two"><div class="f"><label for="rStatus">Status</label><select id="rStatus">' + statusOptions('in_stock') + '</select></div>' +
      '<div class="f"><label for="rWho">Assigned to / customer</label><input type="text" id="rWho" placeholder="Optional"></div></div>' +
      '<div class="two"><div class="f"><label for="rOrder">Order</label><input type="text" id="rOrder" placeholder="Optional"></div>' +
      '<div class="f"><label for="rSupp">Supplier</label><input type="text" id="rSupp" placeholder="Optional"></div></div>' +
      '<div class="f"><label for="rNotes">Notes</label><textarea id="rNotes" placeholder="Optional"></textarea></div>' +
      '<div id="rMsg"></div><div class="actions"><button class="btn" type="submit" id="rGo">Receive</button></div></form>';

    ['I1', 'I2'].forEach(function (k) {
      var inp = $('#r' + k), hint = $('#h' + k);
      inp.oninput = function () {
        var v = inp.value.replace(/\D/g, '');
        if (!v) { hint.textContent = ''; hint.className = 'hint'; return; }
        if (v.length < 15) { hint.textContent = v.length + ' of 15 digits'; hint.className = 'hint'; return; }
        var ok = luhn(v);
        hint.textContent = ok ? 'Check digit OK' : 'Check digit fails — typo?';
        hint.className = 'hint ' + (ok ? 'ok' : 'bad');
      };
    });
    $('#rWho').oninput = function () { if ($('#rWho').value && $('#rStatus').value === 'in_stock') $('#rStatus').value = 'assigned'; };

    $('#recv').onsubmit = function (e) {
      e.preventDefault();
      var btn = $('#rGo'); btn.disabled = true;
      var body = {
        model: $('#rModel').value, receivedAt: $('#rDate').value, serial: $('#rSerial').value,
        imei1: $('#rI1').value, imei2: $('#rI2').value, status: $('#rStatus').value,
        assignedTo: $('#rWho').value, orderId: $('#rOrder').value, supplier: $('#rSupp').value, notes: $('#rNotes').value,
      };
      api('POST', 'devices', body).then(function (r) {
        S.lastModel = body.model;
        return loadDevices().then(function () {
          renderReceive(esc(S.models[r.device.model]) + ' <span class="mono">' + esc(r.device.serial) + '</span> received. Ready for the next one.');
          $('#rSerial').focus();
        });
      }).catch(function (err) {
        btn.disabled = false;
        $('#rMsg').innerHTML = '<div class="msg bad">' + esc(err.message) + '</div>';
      });
    };
  }

  /* ---------------- orders ---------------- */
  function renderOrders() {
    var main = $('#main');
    main.innerHTML = '<h2>Orders</h2><p class="muted">Loading…</p>';
    api('GET', 'orders').then(function (r) {
      S.orders = r.orders;
      if (!r.orders.length) { main.innerHTML = '<h2>Orders</h2><div class="list"><div class="empty">No orders yet.</div></div>'; return; }
      main.innerHTML = '<h2>Orders</h2>' + r.orders.map(function (o, i) {
        var a = o.shippingAddress || {};
        var addr = [a.name, a.line1, a.line2, a.city, a.postal_code].filter(Boolean).map(esc).join(', ');
        var items = o.items.map(function (it) { return '<li>' + esc(it.quantity) + ' × ' + esc(it.name) + '</li>'; }).join('');
        var disp = o.dispatch
          ? '<p class="muted">Dispatched ' + esc(fmtWhen(o.dispatch.at)) + (o.dispatch.courier ? ' · ' + esc(o.dispatch.courier) : '') +
            (o.dispatch.tracking ? ' · <span class="mono">' + esc(o.dispatch.tracking) + '</span>' : '') +
            (o.dispatch.serials && o.dispatch.serials.length ? '<br>Serials: <span class="mono">' + o.dispatch.serials.map(esc).join(', ') + '</span>' : '') + '</p>'
          : '<button class="btn ghost" data-dispatch="' + i + '">Dispatch…</button>';
        return '<div class="order"><div class="head"><div><div class="t" style="font-weight:700">' + esc(a.name || o.customerEmail || 'Customer') + '</div>' +
          '<div class="muted">' + esc(fmtWhen(o.paidAt)) + ' · ' + esc(o.provider) + ' · ' + esc(money(o.total, o.currency)) + '</div></div>' +
          pill(o.status || 'pending', o.status || 'pending') + '</div>' +
          '<ul>' + items + '</ul>' + (addr ? '<p class="muted">' + addr + '</p>' : '') +
          (o.customerEmail ? '<p class="muted">' + esc(o.customerEmail) + '</p>' : '') + disp + '</div>';
      }).join('');
      main.querySelectorAll('[data-dispatch]').forEach(function (b) { b.onclick = function () { openDispatch(S.orders[+b.getAttribute('data-dispatch')]); }; });
    }).catch(function (err) { main.innerHTML = '<h2>Orders</h2><div class="msg bad">' + esc(err.message) + '</div>'; });
  }

  function openDispatch(o) {
    // Offer in-stock (or reserved) units of the models on the order.
    var ids = {};
    o.items.forEach(function (it) { if (it.id) ids[it.id.replace(/^wty-3yr-/, '')] = true; });
    var units = S.devices.filter(function (d) { return ids[d.model] && (d.status === 'in_stock' || d.status === 'reserved'); });
    openSheet(
      '<h2 style="margin-top:0">Dispatch order</h2><p class="muted mono">' + esc(o.orderId) + '</p>' +
      '<form id="disp"><div class="lbl">Units going out</div>' +
      (units.length ? units.map(function (d) {
        return '<label class="pick"><input type="checkbox" value="' + esc(d.serial) + '"> ' + esc(S.models[d.model]) + ' · <span class="mono">' + esc(d.serial) + '</span></label>';
      }).join('') : '<p class="muted">No matching units in stock. Receive them first, or dispatch without serials.</p>') +
      '<div class="two" style="margin-top:12px"><div class="f"><label for="dCourier">Courier</label><input type="text" id="dCourier" placeholder="e.g. DPD"></div>' +
      '<div class="f"><label for="dTrack">Tracking number</label><input type="text" id="dTrack" class="mono"></div></div>' +
      '<div id="dMsg"></div><div class="actions"><button class="btn" type="submit">Mark dispatched</button><button class="btn ghost" type="button" id="dClose">Cancel</button></div></form>'
    );
    $('#dClose').onclick = closeSheet;
    $('#disp').onsubmit = function (e) {
      e.preventDefault();
      var serials = Array.prototype.map.call(sheet.querySelectorAll('.pick input:checked'), function (c) { return c.value; });
      api('POST', 'orders/' + encodeURIComponent(o.orderId) + '/dispatch', { serials: serials, courier: $('#dCourier').value, tracking: $('#dTrack').value })
        .then(loadDevices).then(function () { closeSheet(); renderOrders(); })
        .catch(function (err) { $('#dMsg').innerHTML = '<div class="msg bad">' + esc(err.message) + '</div>'; });
    };
  }

  if (token) boot(false); else renderLogin();
})();
</script>
</body>
</html>`;
