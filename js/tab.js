// Role-based access control and tab functionality for admin-users.html
document.addEventListener('DOMContentLoaded', function() {
  // Check if user has admin privileges
  try {
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (loggedInUser) {
      const userData = JSON.parse(loggedInUser);
      if (userData && userData.role !== 'admin') {
        // User is not admin - show access denied and redirect
        const body = document.body;
        body.innerHTML = `
          <div class="d-flex align-items-center justify-content-center min-vh-100">
            <div class="text-center">
              <div class="mb-4">
                <i class="fas fa-shield-alt text-danger" style="font-size: 4rem;"></i>
              </div>
              <h1 class="h3 text-danger mb-3">Access Denied</h1>
              <p class="text-muted mb-4">You need administrator privileges to access this page.</p>
              <a href="dashboard.html" class="btn btn-primary">
                <i class="fas fa-arrow-left me-2"></i>Return to Dashboard
              </a>
            </div>
          </div>
        `;
        
        // Also redirect after a delay
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 3000);
        
        return;
      }
    } else {
      // No user logged in - redirect to login
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Error checking admin access:', error);
    // On error, redirect to login for security
    window.location.href = 'index.html';
  }
});

// Tab switching functionality
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', function() {
    const targetTab = this.getAttribute('data-tab');
    
    // Remove active class from all tab buttons and content
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked button and corresponding content
    this.classList.add('active');
    document.getElementById(targetTab).classList.add('active');
  });
});
