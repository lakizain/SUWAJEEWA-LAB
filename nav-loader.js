// Navigation loader script
(function() {
    'use strict';
    
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
                    '<a href="index.html" class="btn-logout">' +
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
