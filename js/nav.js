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

// Handle logout functionality
function handleLogout() {
  // Clear session storage
  sessionStorage.removeItem('loggedInUser');
  
  // Show logout message
  if (window.app && window.app.showInfo) {
    window.app.showInfo('Logged out successfully');
  }
  
  // Redirect to login page
  window.location.href = 'index.html';
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
