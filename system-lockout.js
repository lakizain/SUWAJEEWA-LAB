// System-wide lockout: displays an un-dismissable 500 Server Error overlay on every page.
// This script must be loaded as early as possible in <head> or start of <body>.
(function () {
  'use strict';

  var OVERLAY_ID = 'system-lockout-overlay';
  var STYLE_ID = 'system-lockout-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + OVERLAY_ID + ' {',
      '  position: fixed !important;',
      '  top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;',
      '  width: 100vw !important; height: 100vh !important;',
      '  z-index: 2147483647 !important;',
      '  background: #f8fafc;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
      '  margin: 0 !important; padding: 0 !important;',
      '  overflow: hidden !important;',
      '}',
      '#' + OVERLAY_ID + ' * { box-sizing: border-box; }',
      'html, body { overflow: hidden !important; }'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function buildRefId() {
    return 'SE-' +
      Math.random().toString(36).substring(2, 10).toUpperCase() + '-' +
      Date.now().toString(36).toUpperCase();
  }

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    injectStyles();

    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = [
      '<div style="width:100%;height:100%;background:',
      'repeating-linear-gradient(0deg,rgba(15,23,42,0.04) 0 2px,transparent 2px 40px),',
      'repeating-linear-gradient(90deg,rgba(15,23,42,0.04) 0 2px,transparent 2px 40px),',
      'radial-gradient(800px 500px at -10% -10%,#fee2e2 0%,transparent 60%),',
      'radial-gradient(800px 500px at 110% 10%,#fecaca 0%,transparent 55%),',
      'linear-gradient(135deg,#fff5f5,#ffe8e8);',
      'display:flex;align-items:center;justify-content:center;padding:24px;">',

      '<div style="max-width:560px;width:100%;background:rgba(255,255,255,0.92);',
      '-webkit-backdrop-filter:saturate(140%) blur(14px);backdrop-filter:saturate(140%) blur(14px);',
      'border-radius:20px;box-shadow:0 24px 60px rgba(127,29,29,0.18),0 0 0 1px rgba(239,68,68,0.10) inset;',
      'border:1px solid rgba(239,68,68,0.15);padding:40px 32px;text-align:center;position:relative;">',

      '<div style="width:96px;height:96px;border-radius:50%;margin:0 auto 20px;',
      'background:linear-gradient(180deg,#ef4444,#b91c1c);',
      'display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 12px 28px rgba(185,28,28,0.35);">',
      '<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">',
      '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>',
      '<line x1="12" y1="9" x2="12" y2="13"></line>',
      '<line x1="12" y1="17" x2="12.01" y2="17"></line>',
      '</svg>',
      '</div>',

      '<div style="font-size:64px;font-weight:900;letter-spacing:-0.04em;margin:0 0 4px;',
      'background:linear-gradient(180deg,#b91c1c,#7f1d1d);-webkit-background-clip:text;background-clip:text;color:transparent;">',
      '500',
      '</div>',

      '<h1 style="font-size:22px;font-weight:800;margin:0 0 8px;color:#7f1d1d;letter-spacing:-0.01em;">',
      'Server Error',
      '</h1>',

      '<p style="font-size:14px;color:#64748b;margin:0 0 24px;line-height:1.6;">',
      'The server encountered an unexpected condition that prevented it from fulfilling the request.',
      '<br/>Please contact your system administrator for assistance.',
      '</p>',

      '<div style="padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;',
      'font-size:12px;color:#991b1b;text-align:left;margin:0 0 20px;">',
      '<div style="font-weight:700;margin-bottom:4px;">Error Code: SERVER-0x500</div>',
      '<div style="opacity:0.85;">System is currently unavailable. Please try again later.</div>',
      '</div>',

      '<div style="display:flex;gap:10px;">',
      '<button id="sys-lockout-retry" style="flex:1;background:linear-gradient(180deg,#ef4444,#b91c1c);',
      'color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:800;font-size:13px;',
      'cursor:pointer;transition:filter .12s ease,transform .04s ease;letter-spacing:.02em;">',
      'Try Again',
      '</button>',
      '<button id="sys-lockout-contact" style="flex:1;background:#fff;color:#7f1d1d;',
      'border:1px solid #fecaca;border-radius:10px;padding:12px 16px;font-weight:800;font-size:13px;',
      'cursor:pointer;transition:filter .12s ease,transform .04s ease;letter-spacing:.02em;">',
      'Contact Admin',
      '</button>',
      '</div>',

      '<div style="margin-top:22px;font-size:11px;color:#94a3b8;">',
      'Reference ID: ' + buildRefId(),
      '</div>',

      '</div></div>'
    ].join('');

    var host = document.body || document.documentElement;
    host.appendChild(overlay);

    try { document.body.style.overflow = 'hidden'; } catch (e) {}
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}

    var r = overlay.querySelector('#sys-lockout-retry');
    if (r) r.addEventListener('click', function () { location.reload(); });

    var c = overlay.querySelector('#sys-lockout-contact');
    if (c) c.addEventListener('click', function () {
      alert('Please contact your system administrator to restore system access.');
    });
  }

  function ensureOverlay() {
    if (typeof document === 'undefined') return;
    createOverlay();
    var el = document.getElementById(OVERLAY_ID);
    if (el) {
      el.style.display = 'flex';
      el.style.zIndex = '2147483647';
    }
  }

  // --- Aggressive, repeated attachment ---

  // 1) Try now
  ensureOverlay();

  // 2) DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureOverlay);
  } else {
    ensureOverlay();
  }

  // 3) Window load (extra safety)
  window.addEventListener('load', ensureOverlay);

  // 4) Every 100ms self-heal (so app code cannot remove it)
  setInterval(ensureOverlay, 100);

  // 5) Block browser back/forward navigation
  if (window.history && window.history.pushState) {
    try {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', function () {
        window.history.pushState(null, '', window.location.href);
        ensureOverlay();
      });
    } catch (e) {}
  }

  // 6) Prevent keyboard shortcuts that might bypass (F5 is reload, but block ESC hiding)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // 7) Capture clicks on any removed overlay and restore
  (new MutationObserver(function () { ensureOverlay(); }))
    .observe(document.documentElement, { childList: true, subtree: true });

})();
