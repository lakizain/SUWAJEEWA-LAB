// Navigation loader script
(function() {
    'use strict';
    
    function loaderShowServerError() {
        if (window.showServerErrorScreen) {
            window.showServerErrorScreen();
            return;
        }
        var existing = document.getElementById('server-error-overlay');
        if (existing) return;
        var overlay = document.createElement('div');
        overlay.id = 'server-error-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:0;overflow:hidden';
        overlay.innerHTML = [
            '<div style="width:100%;height:100%;background:',
            'repeating-linear-gradient(0deg,rgba(15,23,42,0.04) 0 2px,transparent 2px 40px),',
            'repeating-linear-gradient(90deg,rgba(15,23,42,0.04) 0 2px,transparent 2px 40px),',
            'radial-gradient(800px 500px at -10% -10%,#fee2e2 0%,transparent 60%),',
            'radial-gradient(800px 500px at 110% 10%,#fecaca 0%,transparent 55%),',
            'linear-gradient(135deg,#fff5f5,#ffe8e8);',
            'display:flex;align-items:center;justify-content:center;padding:24px;">',
            '<div style="max-width:560px;width:100%;background:rgba(255,255,255,0.92);-webkit-backdrop-filter:saturate(140%) blur(14px);backdrop-filter:saturate(140%) blur(14px);border-radius:20px;box-shadow:0 24px 60px rgba(127,29,29,0.18);border:1px solid rgba(239,68,68,0.15);padding:40px 32px;text-align:center;">',
            '<div style="width:96px;height:96px;border-radius:50%;margin:0 auto 20px;background:linear-gradient(180deg,#ef4444,#b91c1c);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 28px rgba(185,28,28,0.35);">',
            '<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            '</div>',
            '<div style="font-size:64px;font-weight:900;letter-spacing:-0.04em;margin:0 0 4px;background:linear-gradient(180deg,#b91c1c,#7f1d1d);-webkit-background-clip:text;background-clip:text;color:transparent;">500</div>',
            '<h1 style="font-size:22px;font-weight:800;margin:0 0 8px;color:#7f1d1d;">Server Error</h1>',
            '<p style="font-size:14px;color:#64748b;margin:0 0 24px;line-height:1.6;">The server encountered an unexpected condition that prevented it from fulfilling the request.<br/>Please contact your system administrator for assistance.</p>',
            '<div style="padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;font-size:12px;color:#991b1b;text-align:left;margin:0 0 20px;"><div style="font-weight:700;margin-bottom:4px;">Error Code: SERVER-0x500</div><div style="opacity:0.85;">Session terminated. Authentication required.</div></div>',
            '<div style="display:flex;gap:10px;"><button id="loader-se-retry" onclick="location.reload()" style="flex:1;background:linear-gradient(180deg,#ef4444,#b91c1c);color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:800;font-size:13px;cursor:pointer;">Try Again</button><button id="loader-se-contact" onclick=\'alert("Please contact your system administrator to restore access.")\' style="flex:1;background:#fff;color:#7f1d1d;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;font-weight:800;font-size:13px;cursor:pointer;">Contact Admin</button></div>',
            '<div style="margin-top:22px;font-size:11px;color:#94a3b8;">Reference ID: SE-' + Math.random().toString(36).substring(2,10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase() + '</div>',
            '</div></div>'
        ].join('');
        if (document.body) { document.body.appendChild(overlay); document.body.style.overflow = 'hidden'; }
        else document.documentElement.appendChild(overlay);
    }
    
    window.loaderShowServerError = loaderShowServerError;
    
    function handleFallbackLogout() {
        sessionStorage.removeItem('loggedInUser');
        loaderShowServerError();
        return false;
    }
    
    function loadNavigationForReports() {
        fetch('nav.html')
            .then(response => response.text())
            .then(data => {
                document.body.insertAdjacentHTML('afterbegin', data);
                // Load nav CSS if not already loaded
                if (!document.querySelector('link[href="nav.css"]')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = 'nav.css';
                    document.head.appendChild(link);
                }
            })
            .catch(error => {
                console.error('Error loading navigation:', error);
                // Create a simple fallback navigation
                const fallbackNav = '<header class="header">' +
                    '<div class="container">' +
                    '<div class="d-flex justify-content-between align-items-center">' +
                    '<div class="logo-section">' +
                    '<div class="logo-icon">' +
                    '<img src="Imgs/suwajeewa_logo.png" alt="Logo" class="logo-image" onerror="this.style.display=\'none\'; this.parentElement.innerHTML=\'&lt;i class=&quot;fas fa-flask&quot;&gt;&lt;/i&gt;\'">' +
                    '</div>' +
                    '<div>' +
                    '<h1 class="company-name">SUWAJEEWA LABORATORIES</h1>' +
                    '<p class="company-subtitle">Laboratory Management System</p>' +
                    '</div>' +
                    '</div>' +
                    '<div>' +
                    '<a href="dashboard.html" class="btn btn-outline-primary me-2">' +
                    '<i class="fas fa-home"></i> Dashboard' +
                    '</a>' +
                    '<a href="#" onclick="return handleFallbackLogout()" class="btn-logout">' +
                    '<i class="fas fa-sign-out-alt"></i> Logout' +
                    '</a>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</header>';
                document.body.insertAdjacentHTML('afterbegin', fallbackNav);
            });
    }
    
    // Load navigation when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadNavigationForReports);
    } else {
        loadNavigationForReports();
    }
})();
