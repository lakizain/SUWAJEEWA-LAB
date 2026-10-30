// Supabase Configuration
const SUPABASE_URL =
  window.APP_CONFIG?.supabase?.url ||
  "https://edhwbsvtgfmvkzcmfggt.supabase.co";
const SUPABASE_ANON_KEY =
  window.APP_CONFIG?.supabase?.anonKey ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHdic3Z0Z2Ztdmt6Y21mZ2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMTA0MzEsImV4cCI6MjA2OTY4NjQzMX0.Ho0aK_wvoI4_JgWyz0-ttrIrRRTUx0QYFvGt1aX962s";

// Initialize Supabase client
let supabaseClient = null;

// Function to initialize Supabase client
function initializeSupabase() {
  if (window.supabase && !supabaseClient) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Supabase client initialized successfully");
    } catch (error) {
      console.error("Error initializing Supabase client:", error);
    }
  }
  return supabaseClient;
}

// Initialize immediately if supabase is available
if (window.supabase) {
  initializeSupabase();
} else {
  // Wait for supabase to load
  const checkSupabase = setInterval(() => {
    if (window.supabase) {
      initializeSupabase();
      clearInterval(checkSupabase);
    }
  }, 100);
}

// Expose public config for auxiliary clients (e.g., admin user creation)
window.SUPABASE_PUBLIC = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};

// Database Schema Configuration
const DB_SCHEMA = {
  // Billing related tables
  bills: {
    id: "id",
    bill_no: "bill_no",
    bill_date: "bill_date",
    bill_type: "bill_type",
    center_id: "center_id",
    cashier: "cashier",
    patient_phone: "patient_phone",
    patient_name: "patient_name",
    patient_title: "patient_title",
    patient_age_years: "patient_age_years",
    patient_age_months: "patient_age_months",
    patient_age_days: "patient_age_days",
    patient_gender: "patient_gender",
    ref_by: "ref_by",
    new_referral: "new_referral",
    total_amount: "total_amount",
    discount: "discount",
    final_amount: "final_amount",
    paid_amount: "paid_amount",
    remaining_amount: "remaining_amount",
    status: "status",
    created_at: "created_at",
    updated_at: "updated_at",
  },

  bill_items: {
    id: "id",
    bill_id: "bill_id",
    test_id: "test_id",
    package_id: "package_id",
    quantity: "quantity",
    unit_price: "unit_price",
    total_price: "total_price",
    created_at: "created_at",
  },

  // Test management tables
  tests: {
    id: "id",
    test_name: "test_name",
    short_name: "short_name",
    price: "price",
    remarks: "remarks",
    specimen: "specimen",
    tube: "tube",
    category: "category",
    is_active: "is_active",
    created_at: "created_at",
    updated_at: "updated_at",
  },

  test_subcategories: {
    id: "id",
    test_id: "test_id",
    subcategory_name: "subcategory_name",
    created_at: "created_at",
  },

  reference_ranges: {
    id: "id",
    test_id: "test_id",
    gender: "gender",
    age_min: "age_min",
    age_max: "age_max",
    min_value: "min_value",
    max_value: "max_value",
    unit: "unit",
    created_at: "created_at",
  },

  // Reference management tables
  references: {
    id: "id",
    rid: "rid",
    name: "name",
    commission: "commission",
    is_active: "is_active",
    created_at: "created_at",
    updated_at: "updated_at",
  },

  // Center management tables
  centers: {
    id: "id",
    cid: "cid",
    center_name: "center_name",
    is_active: "is_active",
    created_at: "created_at",
    updated_at: "updated_at",
  },

  // Package management tables
  packages: {
    id: "id",
    pgid: "pgid",
    package_name: "package_name",
    price: "price",
    is_active: "is_active",
    created_at: "created_at",
    updated_at: "updated_at",
  },

  package_tests: {
    id: "id",
    package_id: "package_id",
    test_id: "test_id",
    created_at: "created_at",
  },

  // User management tables
  users: {
    id: "id",
    username: "username",
    email: "email",
    password_hash: "password_hash",
    role: "role",
    is_active: "is_active",
    created_at: "created_at",
    updated_at: "updated_at",
  },
};

// Export configuration
window.SUPABASE_CONFIG = {
  get supabase() {
    return initializeSupabase();
  },
  DB_SCHEMA,
  initializeSupabase,
};

window.UserCenterAccess = {
  getActiveCenterStorageKey(user = this.getCurrentUser()) {
    const userKey = user?.id || user?.username;
    return userKey ? `activeCenterId:${userKey}` : null;
  },

  getCurrentUser() {
    try {
      const user = sessionStorage.getItem("loggedInUser");
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.warn("Failed to read logged-in user center access", error);
      return null;
    }
  },

  getAssignedCenterIds(user = this.getCurrentUser()) {
    if (!user || user.role === "admin") return [];
    const ids = Array.isArray(user.center_ids) ? user.center_ids : [];
    const legacyId = user.center_id;
    return [...new Set([...ids, ...(legacyId ? [legacyId] : [])].filter(Boolean))];
  },

  getDefaultCenterId(user = this.getCurrentUser(), availableCenterIds = []) {
    if (!user) return null;
    const availableIds = availableCenterIds.filter(
      (centerId) => centerId && centerId !== "all"
    );

    if (user.role === "admin") {
      return availableIds[0] || null;
    }

    const assignedIds = this.getAssignedCenterIds(user);
    const defaultCenterId =
      user.center_id && assignedIds.includes(user.center_id)
        ? user.center_id
        : assignedIds[0] || null;
    if (!availableIds.length || availableIds.includes(defaultCenterId)) {
      return defaultCenterId;
    }
    return availableIds.find((centerId) => assignedIds.includes(centerId)) || null;
  },

  getActiveCenterId(user = this.getCurrentUser()) {
    if (!user) return null;
    const assignedIds = this.getAssignedCenterIds(user);
    let activeCenterId = user.active_center_id || null;
    const storageKey = this.getActiveCenterStorageKey(user);
    if (storageKey) {
      try {
        activeCenterId = localStorage.getItem(storageKey) || activeCenterId;
      } catch (error) {
        console.warn("Failed to read shared active center", error);
      }
    }
    if (user.role === "admin") return activeCenterId;
    if (activeCenterId && assignedIds.includes(activeCenterId)) return activeCenterId;
    return this.getDefaultCenterId(user, assignedIds);
  },

  setActiveCenterId(centerId) {
    const user = this.getCurrentUser();
    if (!user || !centerId || centerId === "all") return false;
    const assignedIds = this.getAssignedCenterIds(user);
    if (user.role !== "admin" && !assignedIds.includes(centerId)) return false;
    user.active_center_id = centerId;
    sessionStorage.setItem("loggedInUser", JSON.stringify(user));
    const storageKey = this.getActiveCenterStorageKey(user);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, centerId);
      } catch (error) {
        console.warn("Failed to persist shared active center", error);
      }
    }
    document.dispatchEvent(
      new CustomEvent("active-center-changed", {
        detail: { centerId, userKey: user.id || user.username },
      })
    );
    return true;
  },
};

(() => {
  const centerSelectIds = [
    "center-dropdown",
    "filterCenter",
    "centerSelect",
    "daily-center-filter",
    "monthly-center-filter",
    "center-center-filter",
    "commission-center-filter",
    "summary-center-filter",
    "bills-center-filter",
  ];
  const selector = centerSelectIds
    .map((id) => `#${id}`)
    .join(", ");

  const centerSelectStyle = document.createElement("style");
  centerSelectStyle.textContent = `
    .center-context-select { font-weight: 700 !important; }
    .center-context-select--default { color: #198754 !important; }
    .center-context-select--changed { color: #dc3545 !important; }
    .center-context-option { font-weight: 700; }
    .center-context-option--default { color: #198754; }
    .center-context-option--changed { color: #dc3545; }
    .center-context-label { font-weight: 700 !important; }
    .center-context-label--default { color: #198754 !important; }
    .center-context-label--changed { color: #dc3545 !important; }
  `;
  document.head.appendChild(centerSelectStyle);

  function updateCenterSelectStyles() {
    const user = window.UserCenterAccess.getCurrentUser();
    document.querySelectorAll(selector).forEach((select) => {
      const options = Array.from(select.options);
      const centerIds = options
        .filter((option) => option.dataset?.isActive !== "false")
        .map((option) => option.value)
        .filter((centerId) => centerId && centerId !== "all");
      const defaultCenterId =
        window.UserCenterAccess.getDefaultCenterId(user, centerIds);
      const selectedCenterId = select.value;
      const isDefault = selectedCenterId === defaultCenterId;
      const isChanged =
        selectedCenterId &&
        selectedCenterId !== "all" &&
        defaultCenterId &&
        !isDefault;

      select.classList.add("center-context-select");
      select.classList.toggle("center-context-select--default", isDefault);
      select.classList.toggle("center-context-select--changed", Boolean(isChanged));

      options.forEach((option) => {
        option.classList.add("center-context-option");
        option.classList.toggle(
          "center-context-option--default",
          option.value === defaultCenterId
        );
        option.classList.toggle(
          "center-context-option--changed",
          option.value === selectedCenterId && Boolean(isChanged)
        );
      });

      const label = document.querySelector(`label[for="${select.id}"]`);
      if (label) {
        label.classList.add("center-context-label");
        label.classList.toggle("center-context-label--default", isDefault);
        label.classList.toggle(
          "center-context-label--changed",
          Boolean(isChanged)
        );
      }
    });
  }

  document.addEventListener(
    "change",
    (event) => {
      if (!event.target.matches?.(selector)) return;
      const centerId = event.target.value;
      if (centerId && centerId !== "all") {
        const saved = window.UserCenterAccess.setActiveCenterId(centerId);
        if (!saved) {
          const activeCenterId = window.UserCenterAccess.getActiveCenterId();
          if (
            activeCenterId &&
            Array.from(event.target.options).some(
              (option) => option.value === activeCenterId
            )
          ) {
            event.target.value = activeCenterId;
          }
        }
      }
      updateCenterSelectStyles();
    },
    true
  );

  document.addEventListener("active-center-changed", (event) => {
    const { centerId } = event.detail || {};
    if (!centerId) return;
    document.querySelectorAll(selector).forEach((select) => {
      if (Array.from(select.options).some((option) => option.value === centerId)) {
        select.value = centerId;
      }
    });
    updateCenterSelectStyles();
  });

  window.addEventListener("storage", (event) => {
    const user = window.UserCenterAccess.getCurrentUser();
    const storageKey = window.UserCenterAccess.getActiveCenterStorageKey(user);
    if (!storageKey || event.key !== storageKey || !event.newValue) return;
    if (
      user?.role !== "admin" &&
      !window.UserCenterAccess.getAssignedCenterIds(user).includes(event.newValue)
    ) {
      return;
    }

    user.active_center_id = event.newValue;
    sessionStorage.setItem("loggedInUser", JSON.stringify(user));
    document.dispatchEvent(
      new CustomEvent("active-center-changed", {
        detail: { centerId: event.newValue, userKey: user.id || user.username },
      })
    );

    updateCenterSelectStyles();
  });

  new MutationObserver(updateCenterSelectStyles).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  updateCenterSelectStyles();
})();
