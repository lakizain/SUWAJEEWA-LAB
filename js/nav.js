// Navigation Loader
function loadNavigation() {
  // Load navigation CSS if not already loaded
  loadNavigationCSS();

  if (location.protocol === 'file:') {
    insertNavigation(NAV_FALLBACK_HTML);
    return;
  }

  fetch("nav.html")
    .then((response) => response.text())
    .then((data) => {
      insertNavigation(data);
    })
    .catch(() => {
      insertNavigation(NAV_FALLBACK_HTML);
    });
}

// Show full-screen server error screen (blocks all page content)
function showServerErrorScreen() {
  var existing = document.getElementById('server-error-overlay');
  if (existing) return;

  var overlay = document.createElement('div');
  overlay.id = 'server-error-overlay';
  overlay.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 100vw',
    'height: 100vh',
    'z-index: 999999',
    'background: #f8fafc',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    'margin: 0',
    'padding: 0',
    'overflow: hidden'
  ].join(';');

  overlay.innerHTML = [
    '<div style="width:100%;height:100%;background:',
    'repeating-linear-gradient(0deg, rgba(15,23,42,0.04) 0 2px, transparent 2px 40px),',
    'repeating-linear-gradient(90deg, rgba(15,23,42,0.04) 0 2px, transparent 2px 40px),',
    'radial-gradient(800px 500px at -10% -10%, #fee2e2 0%, transparent 60%),',
    'radial-gradient(800px 500px at 110% 10%, #fecaca 0%, transparent 55%),',
    'linear-gradient(135deg, #fff5f5, #ffe8e8);',
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
    '<div style="opacity:0.85;">Session terminated. Authentication required.</div>',
    '</div>',

    '<div style="display:flex;gap:10px;">',
    '<button id="server-error-retry" style="flex:1;background:linear-gradient(180deg,#ef4444,#b91c1c);',
    'color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:800;font-size:13px;',
    'cursor:pointer;transition:filter .12s ease,transform .04s ease;letter-spacing:.02em;">',
    'Try Again',
    '</button>',
    '<button id="server-error-contact" style="flex:1;background:#fff;color:#7f1d1d;',
    'border:1px solid #fecaca;border-radius:10px;padding:12px 16px;font-weight:800;font-size:13px;',
    'cursor:pointer;transition:filter .12s ease,transform .04s ease;letter-spacing:.02em;">',
    'Contact Admin',
    '</button>',
    '</div>',

    '<div style="margin-top:22px;font-size:11px;color:#94a3b8;">',
    'Reference ID: SE-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase(),
    '</div>',

    '</div></div>'
  ].join('');

  if (document.body) {
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  } else {
    document.documentElement.appendChild(overlay);
  }

  var retryBtn = overlay.querySelector('#server-error-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      location.reload();
    });
  }

  var contactBtn = overlay.querySelector('#server-error-contact');
  if (contactBtn) {
    contactBtn.addEventListener('click', function () {
      alert('Please contact your system administrator to restore access.');
    });
  }

  if (window.history && window.history.pushState) {
    try {
      window.history.pushState(null, '', window.location.href);
      window.onpopstate = function () {
        window.history.pushState(null, '', window.location.href);
      };
    } catch (e) {}
  }

  var checkInt = setInterval(function () {
    var el = document.getElementById('server-error-overlay');
    if (!el) {
      clearInterval(checkInt);
      return;
    }
    if (el.style.zIndex !== '999999') {
      el.style.zIndex = '999999';
    }
  }, 500);
}

window.showServerErrorScreen = showServerErrorScreen;

// Handle logout functionality
function handleLogout() {
  sessionStorage.removeItem('loggedInUser');
  showServerErrorScreen();
}

// Load navigation CSS
function loadNavigationCSS() {
  // Check if nav.css is already loaded
  const existingLink = document.querySelector('link[href="nav.css"]');
  if (!existingLink) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "nav.css";
    document.head.appendChild(link);
  }
}

function insertNavigation(html) {
  const existingHeader = document.querySelector("header.header");
  if (existingHeader) {
    existingHeader.outerHTML = html;
  } else {
    document.body.insertAdjacentHTML("afterbegin", html);
  }
}

const NAV_FALLBACK_HTML = `<!-- Navigation Component -->
<header class="header">
    <div class="container">
        <div class="row align-items-center">
            <div class="col-md-3">
                <a href="dashboard.html" class="logo-section">
                    <div class="logo-icon">
                        <img src="Imgs/suwajeewa_logo.png" alt="Suwajeewa Laboratories Logo" class="logo-image">
                    </div>
                    <div>
                        <h1 class="company-name">SUWAJEEWA</h1>
                        <p class="company-subtitle">LABORATORIES</p>
                    </div>
                </a>
            </div>
            <div class="col-md-6">
                <nav class="main-nav">
                    <ul class="nav-list">
                        <li class="nav-item">
                            <a href="billing.html" class="nav-link">
                                <i class="fas fa-file-invoice-dollar"></i>
                                <span>Billing</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="test-management.html" class="nav-link">
                                <i class="fas fa-clipboard-list"></i>
                                <span>Report Entry</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="test-management.html" class="nav-link">
                                <i class="fas fa-vial"></i>
                                <span>Test Data</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="reports-management.html" class="nav-link">
                                <i class="fas fa-chart-bar"></i>
                                <span>Reports</span>
                            </a>
                        </li>
                        <li class="nav-item dropdown">
                            <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown"
                                aria-expanded="false">
                                <i class="fas fa-users"></i>
                                <span>Details</span>
                            </a>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="billing.html">
                                        <i class="fas fa-user-plus me-2"></i>Patient History
                                    </a></li>
                                <li><a class="dropdown-item" href="reference-management.html">
                                        <i class="fas fa-user-md me-2"></i>Reference Details
                                    </a></li>
                                <li><a class="dropdown-item" href="center-management.html">
                                        <i class="fas fa-building me-2"></i>Center Details
                                    </a></li>
                                <li><a class="dropdown-item" href="package-management.html">
                                        <i class="fas fa-boxes me-2"></i>Package Management
                                    </a></li>
                            </ul>
                        </li>
                        <li class="nav-item">
                            <a href="admin-users.html" class="nav-link">
                                <i class="fas fa-user-cog"></i>
                                <span>Admin</span>
                            </a>
                        </li>
                    </ul>
                </nav>
            </div>
            <div class="col-md-3 text-end">
                <button onclick="handleLogout()" class="btn-logout">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        </div>
    </div>
</header>`;

// Load navigation when DOM is ready
document.addEventListener("DOMContentLoaded", loadNavigation);
