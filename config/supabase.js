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
