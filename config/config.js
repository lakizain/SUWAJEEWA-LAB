// Application Configuration
window.APP_CONFIG = {
  // Supabase Configuration
  supabase: {
    url: "https://edhwbsvtgfmvkzcmfggt.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHdic3Z0Z2Ztdmt6Y21mZ2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMTA0MzEsImV4cCI6MjA2OTY4NjQzMX0.Ho0aK_wvoI4_JgWyz0-ttrIrRRTUx0QYFvGt1aX962s",
  },

  // Application Settings
  app: {
    name: "SUWAJEEWA LABORATORIES",
    version: "1.0.0",
    debug: false,
    currency: "LKR",
    dateFormat: "si-LK",
    timezone: "Asia/Colombo",
  },

  // Feature Flags
  features: {
    realtime: true,
    notifications: true,
    export: true,
    print: true,
    search: true,
    validation: true,
  },

  // API Settings
  api: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },

  // Optional credentials for admin bootstrap (used to satisfy RLS policies)
  auth: {
    admin: {
      // Provide valid Supabase auth user credentials here if needed
      email: "",
      password: "",
    },
  },

  // UI Settings
  ui: {
    theme: "light",
    language: "en",
    notifications: {
      duration: 3000,
      position: "top-right",
    },
    loading: {
      message: "Loading...",
      spinner: true,
    },
  },

  // Validation Rules
  validation: {
    patient: {
      name: { required: true, minLength: 2, maxLength: 255 },
      phone: { required: true, pattern: /^[0-9]{10}$/ },
      age: { min: 0, max: 150 },
    },
    test: {
      name: { required: true, minLength: 2, maxLength: 255 },
      shortName: { required: true, minLength: 1, maxLength: 50 },
      price: { required: true, min: 0 },
    },
    bill: {
      patientName: { required: true },
      patientPhone: { required: true },
      items: { required: true, minLength: 1 },
    },
  },

  // Default Values
  defaults: {
    billType: "Main Lab",
    patientTitle: "Mr.",
    patientGender: "Male",
    discount: 0,
    paidAmount: 0,
  },

  // Sample Data for Testing
  sampleData: {
    centers: [
      { cid: "CID001", center_name: "KURUNEGALA CENTER" },
      { cid: "CID002", center_name: "COLOMBO CENTER" },
      { cid: "CID003", center_name: "KANDY CENTER" },
    ],
    references: [
      { rid: "RID001", name: "DR M AMUNUGAMA", commission: 5.0 },
      { rid: "RID002", name: "DR S PERERA", commission: 3.5 },
      { rid: "RID003", name: "DR J SILVA", commission: 4.0 },
    ],
    tests: [
      {
        test_name: "Complete Blood Count",
        short_name: "CBC",
        price: 1500.0,
        category: "Hematology",
      },
      {
        test_name: "Blood Glucose",
        short_name: "BG",
        price: 800.0,
        category: "Biochemistry",
      },
      {
        test_name: "Urine Analysis",
        short_name: "UA",
        price: 600.0,
        category: "Microbiology",
      },
    ],
    packages: [
      { pgid: "PGID001", package_name: "FULL BODY CHECK-UP", price: 2700.0 },
      {
        pgid: "PGID002",
        package_name: "MEDICAL CHECK UP NALANDA",
        price: 2100.0,
      },
      { pgid: "PGID003", package_name: "PHI PACK", price: 2000.0 },
    ],
  },
};

// Environment-specific configurations
if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
) {
  // Development environment
  window.APP_CONFIG.app.debug = true;
  window.APP_CONFIG.api.timeout = 60000; // Longer timeout for development
} else if (window.location.hostname.includes("staging")) {
  // Staging environment
  window.APP_CONFIG.app.debug = true;
} else {
  // Production environment
  window.APP_CONFIG.app.debug = false;
  window.APP_CONFIG.features.debug = false;
}

// Helper functions for configuration
window.Config = {
  // Get configuration value
  get: function (key) {
    const keys = key.split(".");
    let value = window.APP_CONFIG;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  },

  // Set configuration value
  set: function (key, value) {
    const keys = key.split(".");
    let config = window.APP_CONFIG;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in config) || typeof config[k] !== "object") {
        config[k] = {};
      }
      config = config[k];
    }

    config[keys[keys.length - 1]] = value;
  },

  // Check if feature is enabled
  isFeatureEnabled: function (feature) {
    return this.get(`features.${feature}`) === true;
  },

  // Get validation rules
  getValidationRules: function (type) {
    return this.get(`validation.${type}`) || {};
  },

  // Get default value
  getDefault: function (key) {
    return this.get(`defaults.${key}`);
  },

  // Get sample data
  getSampleData: function (type) {
    return this.get(`sampleData.${type}`) || [];
  },

  // Check if in development mode
  isDevelopment: function () {
    return this.get("app.debug") === true;
  },

  // Get API timeout
  getApiTimeout: function () {
    return this.get("api.timeout");
  },

  // Get notification settings
  getNotificationSettings: function () {
    return this.get("ui.notifications");
  },
};

// Initialize configuration
console.log(
  "Application Configuration Loaded:",
  window.APP_CONFIG.app.name,
  "v" + window.APP_CONFIG.app.version
);
