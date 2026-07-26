// Main Application Controller
class LaboratoryApp {
  constructor() {
    this.services = {};
    this.currentUser = null;
    this.isInitialized = false;
  }

  // Initialize the application
  async initialize() {
    try {
      console.log("Initializing Laboratory Management System...");

      // Initialize Supabase configuration
      await this.loadSupabaseConfig();

      // Initialize all services
      this.initializeServices();

      // Check authentication (optional)
      try {
        await this.checkAuthentication();
      } catch (authError) {
        console.warn(
          "Authentication check failed, continuing without auth:",
          authError
        );
      }

      // Load initial data (optional)
      try {
        await this.loadInitialData();
      } catch (dataError) {
        console.warn(
          "Initial data loading failed, continuing without data:",
          dataError
        );
      }

      this.isInitialized = true;
      console.log("Laboratory Management System initialized successfully");

      // Trigger initialization event
      this.triggerEvent("app:initialized");
    } catch (error) {
      console.error("Failed to initialize application:", error);
      // Still mark as initialized so controllers can work with sample data
      this.isInitialized = true;
      this.triggerEvent("app:initialized");

      if (this.showError) {
        this.showError(
          "Application initialized with limited functionality. Some features may not work properly."
        );
      }
    }
  }

  // Load Supabase configuration
  async loadSupabaseConfig() {
    try {
      console.log("Starting Supabase configuration...");

      // Wait for Supabase script to load
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait

      while (!window.supabase && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
        if (attempts % 10 === 0) {
          console.log(
            `Waiting for Supabase script... attempt ${attempts}/${maxAttempts}`
          );
        }
      }

      if (!window.supabase) {
        console.warn(
          "Supabase script not loaded after",
          maxAttempts,
          "attempts. Continuing in offline mode."
        );
        this.supabase = null;
        this.DB_SCHEMA = null;
        return;
      }

        console.log("Supabase script loaded successfully");

      // Wait for SUPABASE_CONFIG to be available
      let configWaitAttempts = 0;
      const maxConfigWaitAttempts = 50;
      while (!window.SUPABASE_CONFIG && configWaitAttempts < maxConfigWaitAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        configWaitAttempts++;
        if (configWaitAttempts % 10 === 0) {
          console.log(
            `Waiting for SUPABASE_CONFIG... attempt ${configWaitAttempts}/${maxConfigWaitAttempts}`
          );
        }
      }

      // Initialize Supabase client
      if (window.SUPABASE_CONFIG) {
        console.log("Supabase config found, initializing client...");

        // Wait for Supabase client to be ready
        let configAttempts = 0;
        while (!window.SUPABASE_CONFIG.supabase && configAttempts < 50) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          configAttempts++;
          if (configAttempts % 10 === 0) {
            console.log(
              `Waiting for Supabase client... attempt ${configAttempts}/50`
            );
          }
        }

        this.supabase = window.SUPABASE_CONFIG.supabase;
        this.DB_SCHEMA = window.SUPABASE_CONFIG.DB_SCHEMA;

        if (!this.supabase) {
          console.warn(
            "Supabase client is null after initialization. Continuing in offline mode."
          );
          this.supabase = null;
          this.DB_SCHEMA = null;
          return;
        }

        console.log("Supabase client initialized successfully");
      } else {
        console.warn("SUPABASE_CONFIG not found. Continuing in offline mode.");
        this.supabase = null;
        this.DB_SCHEMA = null;
      }
    } catch (error) {
      console.warn("Error loading Supabase config:", error);
      console.log("Continuing in offline mode...");
      this.supabase = null;
      this.DB_SCHEMA = null;
    }
  }

  // Initialize all services
  initializeServices() {
    try {
      this.services = {};

      // Initialize services only if they are available
      if (typeof BillingService !== "undefined") {
        this.services.billing = new BillingService();
      } else {
        console.warn("BillingService not available");
      }

      if (typeof TestService !== "undefined") {
        this.services.test = new TestService();
      } else {
        console.warn("TestService not available");
      }

      if (typeof ReferenceService !== "undefined") {
        this.services.reference = new ReferenceService();
      } else {
        console.warn("ReferenceService not available");
      }

      if (typeof CenterService !== "undefined") {
        this.services.center = new CenterService();
      } else {
        console.warn("CenterService not available");
      }

      if (typeof PackageService !== "undefined") {
        this.services.package = new PackageService();
      } else {
        console.warn("PackageService not available");
      }

      if (typeof PricingService !== "undefined") {
        this.services.pricing = new PricingService();
      } else {
        console.warn("PricingService not available");
      }

      console.log("Services initialized:", Object.keys(this.services));
    } catch (error) {
      console.error("Error initializing services:", error);
      this.services = {};
    }
  }

  // Show full-screen server error screen (fallback if nav.js not loaded)
  showServerErrorScreenFallback() {
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
      '<div style="display:flex;gap:10px;"><button id="se-retry-fb" style="flex:1;background:linear-gradient(180deg,#ef4444,#b91c1c);color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:800;font-size:13px;cursor:pointer;">Try Again</button><button id="se-contact-fb" style="flex:1;background:#fff;color:#7f1d1d;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;font-weight:800;font-size:13px;cursor:pointer;">Contact Admin</button></div>',
      '<div style="margin-top:22px;font-size:11px;color:#94a3b8;">Reference ID: SE-' + Math.random().toString(36).substring(2,10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase() + '</div>',
      '</div></div>'
    ].join('');
    if (document.body) { document.body.appendChild(overlay); document.body.style.overflow = 'hidden'; }
    else document.documentElement.appendChild(overlay);
    var r = overlay.querySelector('#se-retry-fb');
    if (r) r.addEventListener('click', function () { location.reload(); });
    var c = overlay.querySelector('#se-contact-fb');
    if (c) c.addEventListener('click', function () { alert('Please contact your system administrator to restore access.'); });
    if (window.history && window.history.pushState) {
      try { window.history.pushState(null, '', window.location.href); window.onpopstate = function () { window.history.pushState(null, '', window.location.href); }; } catch (e) {}
    }
  }

  // Check user authentication
  async checkAuthentication() {
    try {
      const loggedInUser = sessionStorage.getItem('loggedInUser');
      
      if (loggedInUser) {
        try {
          const userData = JSON.parse(loggedInUser);
          if (userData && userData.username) {
            this.currentUser = userData;
            console.log("User authenticated:", userData.username);
            return;
          }
        } catch (parseError) {
          console.warn("Invalid session data, clearing:", parseError);
          sessionStorage.removeItem('loggedInUser');
        }
      }

      console.warn("No user authenticated. Showing server error screen.");
      sessionStorage.removeItem('loggedInUser');
      if (window.location.pathname !== '/index.html' && !window.location.pathname.endsWith('index.html')) {
        this.showServerErrorScreenFallback();
      }
    } catch (error) {
      console.warn("Error checking authentication:", error);
      sessionStorage.removeItem('loggedInUser');
      if (window.location.pathname !== '/index.html' && !window.location.pathname.endsWith('index.html')) {
        this.showServerErrorScreenFallback();
      }
    }
  }

  // Load initial data
  async loadInitialData() {
    try {
      // Load common data that might be needed across pages
      const promises = [];

      if (
        this.services.center &&
        typeof this.services.center.getActiveCenters === "function"
      ) {
        promises.push(
          this.services.center.getActiveCenters().catch((err) => {
            console.warn("Error loading centers:", err);
            return [];
          })
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      if (
        this.services.reference &&
        typeof this.services.reference.getActiveReferences === "function"
      ) {
        promises.push(
          this.services.reference.getActiveReferences().catch((err) => {
            console.warn("Error loading references:", err);
            return [];
          })
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      if (
        this.services.test &&
        typeof this.services.test.getActiveTests === "function"
      ) {
        promises.push(
          this.services.test.getActiveTests().catch((err) => {
            console.warn("Error loading tests:", err);
            return [];
          })
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      if (
        this.services.package &&
        typeof this.services.package.getActivePackages === "function"
      ) {
        promises.push(
          this.services.package.getActivePackages().catch((err) => {
            console.warn("Error loading packages:", err);
            return [];
          })
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      const [centers, references, tests, packages] = await Promise.all(
        promises
      );

      // Store in global cache
      window.APP_CACHE = {
        centers,
        references,
        tests,
        packages,
        lastUpdated: new Date(),
      };

      console.log("Initial data loaded");
    } catch (error) {
      console.error("Error loading initial data:", error);
      // Set empty cache on error
      window.APP_CACHE = {
        centers: [],
        references: [],
        tests: [],
        packages: [],
        lastUpdated: new Date(),
      };
    }
  }

  // Get service by name
  getService(serviceName) {
    return this.services[serviceName];
  }

  // Show success message
  showSuccess(message, duration = 3000) {
    this.showNotification(message, "success", duration);
  }

  // Show error message
  showError(message, duration = 5000) {
    this.showNotification(message, "error", duration);
  }

  // Show warning message
  showWarning(message, duration = 4000) {
    this.showNotification(message, "warning", duration);
  }

  // Show info message
  showInfo(message, duration = 3000) {
    this.showNotification(message, "info", duration);
  }

  // Show notification
  showNotification(message, type = "info", duration = 3000) {
    const notification = document.createElement("div");
    notification.className = `alert alert-${
      type === "error" ? "danger" : type
    } alert-dismissible fade show position-fixed`;
    notification.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 500px;
        `;

    notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

    document.body.appendChild(notification);

    // Auto remove after duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);
  }

  // Show loading spinner
  showLoading(message = "Loading...") {
    const loading = document.createElement("div");
    loading.id = "app-loading";
    loading.className =
      "position-fixed w-100 h-100 d-flex align-items-center justify-content-center";
    loading.style.cssText = `
            top: 0;
            left: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
        `;

    loading.innerHTML = `
            <div class="text-center text-white">
                <div class="spinner-border mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div>${message}</div>
            </div>
        `;

    document.body.appendChild(loading);
  }

  // Hide loading spinner
  hideLoading() {
    const loading = document.getElementById("app-loading");
    if (loading) {
      loading.remove();
    }
  }

  // Load script dynamically
  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Trigger custom events
  triggerEvent(eventName, data = {}) {
    const event = new CustomEvent(eventName, { detail: data });
    document.dispatchEvent(event);
  }

  // Listen for custom events
  on(eventName, callback) {
    document.addEventListener(eventName, (event) => {
      callback(event.detail);
    });
  }

  // Format currency
  formatCurrency(amount) {
    // Handle NaN, undefined, or null values
    if (isNaN(amount) || amount === null || amount === undefined) {
      amount = 0;
    }
    return new Intl.NumberFormat("si-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount);
  }

  // Format date
  formatDate(date, format = "short") {
    const d = new Date(date);

    if (format === "short") {
      return d.toLocaleDateString("si-LK");
    } else if (format === "long") {
      return d.toLocaleDateString("si-LK", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } else if (format === "datetime") {
      return d.toLocaleString("si-LK");
    }

    return d.toLocaleDateString("si-LK");
  }

  // Validate form data
  validateForm(formData, rules) {
    const errors = {};

    for (const [field, rule] of Object.entries(rules)) {
      const value = formData[field];

      if (rule.required && (!value || value.trim() === "")) {
        errors[field] = `${field} is required`;
        continue;
      }

      if (rule.minLength && value && value.length < rule.minLength) {
        errors[
          field
        ] = `${field} must be at least ${rule.minLength} characters`;
        continue;
      }

      if (rule.maxLength && value && value.length > rule.maxLength) {
        errors[field] = `${field} must be at most ${rule.maxLength} characters`;
        continue;
      }

      if (rule.pattern && value && !rule.pattern.test(value)) {
        errors[field] = `${field} format is invalid`;
        continue;
      }

      if (rule.min && value && parseFloat(value) < rule.min) {
        errors[field] = `${field} must be at least ${rule.min}`;
        continue;
      }

      if (rule.max && value && parseFloat(value) > rule.max) {
        errors[field] = `${field} must be at most ${rule.max}`;
        continue;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function
  throttle(func, limit) {
    let inThrottle;
    return function () {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // Get URL parameters
  getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }

  // Set URL parameters
  setUrlParams(params) {
    const url = new URL(window.location);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    window.history.pushState({}, "", url);
  }

  // Export data to CSV
  exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      this.showError("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((header) => `"${row[header]}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Print element
  printElement(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
      this.showError("Element not found");
      return;
    }

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
            <html>
                <head>
                    <title>Print</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @media print {
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    ${element.outerHTML}
                </body>
            </html>
        `);
    printWindow.document.close();
    printWindow.print();
  }
}

// Initialize global app instance
window.app = new LaboratoryApp();

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app.initialize();
});
