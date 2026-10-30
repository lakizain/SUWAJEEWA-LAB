// Admin Bills Service - Handles bills and patient history for admin users
class AdminBillsService {
  constructor() {
    this.supabase = window.SUPABASE_CONFIG?.supabase || null;
    this.DB_SCHEMA = window.SUPABASE_CONFIG?.DB_SCHEMA || null;

    if (!this.supabase) {
      console.warn("AdminBillsService initialized without Supabase connection");
    }
  }

  // Helper to get current user
  getCurrentUser() {
    try {
      const userStr = sessionStorage.getItem('loggedInUser');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.warn('Error parsing current user:', e);
      return null;
    }
  }

  // Helper to check if user is admin
  isUserAdmin() {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  // Helper to get user's center id
  getUserCenterId() {
    const user = this.getCurrentUser();
    if (user?.role === 'admin') return null;
    return window.UserCenterAccess?.getActiveCenterId(user) || user?.center_id || null;
  }

  getCenterIdForQuery(selectedCenterId = null) {
    if (this.isUserAdmin()) {
      return selectedCenterId && selectedCenterId !== "all"
        ? selectedCenterId
        : null;
    }

    const user = this.getCurrentUser();
    const assignedCenterIds =
      window.UserCenterAccess?.getAssignedCenterIds(user) || [];
    if (
      selectedCenterId &&
      selectedCenterId !== "all" &&
      !assignedCenterIds.includes(selectedCenterId)
    ) {
      throw new Error("You are not assigned to this center");
    }
    return this.getUserCenterId() || null;
  }

  // Check if Supabase is available
  isSupabaseAvailable() {
    return this.supabase !== null;
  }

  async attachBillDetails(bills) {
    if (!bills.length) return bills;

    const billIds = bills.map((bill) => bill.id).filter(Boolean);
    const centerIds = [...new Set(bills.map((bill) => bill.center_id).filter(Boolean))];
    const [itemsResult, centersResult] = await Promise.all([
      billIds.length
        ? this.supabase
            .from("bill_items")
            .select("bill_id, tests(test_name), packages(package_name)")
            .in("bill_id", billIds)
        : Promise.resolve({ data: [], error: null }),
      centerIds.length
        ? this.supabase
            .from("centers")
            .select("id, center_name")
            .in("id", centerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (itemsResult.error) throw itemsResult.error;
    if (centersResult.error) throw centersResult.error;

    const itemsByBillId = new Map();
    (itemsResult.data || []).forEach((item) => {
      const items = itemsByBillId.get(item.bill_id) || [];
      items.push(item);
      itemsByBillId.set(item.bill_id, items);
    });
    const centersById = new Map(
      (centersResult.data || []).map((center) => [center.id, center])
    );

    return bills.map((bill) => ({
      ...bill,
      centers: centersById.get(bill.center_id) || null,
      bill_items: itemsByBillId.get(bill.id) || [],
    }));
  }

  // Get all recent bills for admin view
  async getAllRecentBills(limit = 50, selectedCenterId = null) {
    try {
      if (!this.isSupabaseAvailable()) {
        throw new Error("Database connection not available. Cannot load bills.");
      }

      let query = this.supabase
        .from("bills")
        .select(`
          id,
          bill_no,
          patient_name,
          patient_phone,
          patient_gender,
          bill_date,
          created_at,
          center_id,
          paid_amount,
          remaining_amount,
          final_amount,
          status
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      const centerId = this.getCenterIdForQuery(selectedCenterId);
      if (centerId) {
        query = query.eq("center_id", centerId);
      }

      const { data: bills, error } = await query;

      if (error) throw error;
      return await this.attachBillDetails(bills || []);
    } catch (error) {
      console.error("Error getting all recent bills:", error);
      throw error;
    }
  }

  // Search bills by bill number, patient name, or patient phone.
  async searchBills(searchTerm, selectedCenterId = null) {
    try {
      if (!this.isSupabaseAvailable()) {
        throw new Error("Database connection not available. Cannot search bills.");
      }

      if (!searchTerm || searchTerm.trim() === "") {
        return await this.getAllRecentBills(50, selectedCenterId);
      }

      const term = searchTerm.trim();
      const pattern = term.replace(/[\\%_]/g, "\\$&");
      const selectClause = `
          id,
          bill_no,
          patient_name,
          patient_phone,
          patient_gender,
          bill_date,
          created_at,
          center_id,
          paid_amount,
          remaining_amount,
          final_amount,
          status
        `;
      const centerId = this.getCenterIdForQuery(selectedCenterId);
      const searchField = (field) => {
        let query = this.supabase
          .from("bills")
          .select(selectClause)
          .ilike(field, `%${pattern}%`)
          .order("created_at", { ascending: false })
          .limit(50);
        if (centerId) query = query.eq("center_id", centerId);
        return query;
      };

      const [billNoResults, patientResults, phoneResults] = await Promise.all([
        searchField("bill_no"),
        searchField("patient_name"),
        searchField("patient_phone"),
      ]);
      if (billNoResults.error) throw billNoResults.error;
      if (patientResults.error) throw patientResults.error;
      if (phoneResults.error) throw phoneResults.error;

      const uniqueBills = new Map();
      [
        ...(billNoResults.data || []),
        ...(patientResults.data || []),
        ...(phoneResults.data || []),
      ]
        .forEach((bill) => uniqueBills.set(bill.id || bill.bill_no, bill));
      const sortedBills = Array.from(uniqueBills.values())
        .sort(
          (left, right) =>
            new Date(right.created_at || right.bill_date).getTime() -
            new Date(left.created_at || left.bill_date).getTime()
        )
        .slice(0, 50);
      return await this.attachBillDetails(sortedBills);
    } catch (error) {
      console.error("Error searching bills:", error);
      throw error;
    }
  }

  // Get bill details by ID
  async getBillDetails(billId) {
    try {
      if (!this.isSupabaseAvailable()) {
        throw new Error("Database connection not available. Cannot load bill details.");
      }

      const { data: bill, error } = await this.supabase
        .from("bills")
        .select(`
          *,
          centers(center_name),
          bill_items(
            *,
            tests(test_name, short_name, price),
            packages(package_name, price)
          )
        `)
        .eq("id", billId)
        .single();

      if (error) throw error;
      return bill;
    } catch (error) {
      console.error("Error getting bill details:", error);
      throw error;
    }
  }

  // Get patient history by patient details
  async getPatientHistory(patientName, patientPhone = null, selectedCenterId = null) {
    try {
      if (!this.isSupabaseAvailable()) {
        throw new Error("Database connection not available. Cannot load patient history.");
      }

      if (!patientPhone && !patientName?.trim()) {
        throw new Error("Enter a patient name or phone number to search history.");
      }

      let query = this.supabase
        .from("bills")
        .select(`
          id,
          bill_no,
          patient_name,
          patient_gender,
          bill_date,
          paid_amount,
          remaining_amount,
          bill_items(
            tests(test_name),
            packages(package_name)
          )
        `)
        .order("bill_date", { ascending: false });

      if (patientPhone) {
        query = query.eq("patient_phone", patientPhone.trim());
      } else if (patientName) {
        query = query.ilike("patient_name", `%${patientName.trim()}%`);
      }

      const centerId = this.getCenterIdForQuery(selectedCenterId);
      if (centerId) {
        query = query.eq("center_id", centerId);
      }

      query = query.limit(100);
      const { data: bills, error } = await query;
      if (error) throw error;
      return bills || [];
    } catch (error) {
      console.error("Error getting patient history:", error);
      throw error;
    }
  }

  // Get billing statistics for dashboard
  async getBillingStatistics() {
    try {
      if (!this.isSupabaseAvailable()) {
        return this.getSampleStatistics();
      }

      // Get today's bills
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      let todayQuery = this.supabase
        .from("bills")
        .select("final_amount, paid_amount, status")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay);

      if (this.getUserCenterId()) {
        todayQuery = todayQuery.eq("center_id", this.getUserCenterId());
      }

      const { data: todayBills, error: todayError } = await todayQuery;

      if (todayError) throw todayError;

      // Get this month's bills
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      let monthQuery = this.supabase
        .from("bills")
        .select("final_amount, paid_amount, status")
        .gte("created_at", startOfMonth);

      if (this.getUserCenterId()) {
        monthQuery = monthQuery.eq("center_id", this.getUserCenterId());
      }

      const { data: monthBills, error: monthError } = await monthQuery;

      if (monthError) throw monthError;

      // Get all time bills
      let allQuery = this.supabase
        .from("bills")
        .select("final_amount, paid_amount, status");

      if (this.getUserCenterId()) {
        allQuery = allQuery.eq("center_id", this.getUserCenterId());
      }

      const { data: allBills, error: allError } = await allQuery;

      if (allError) throw allError;

      return {
        today: this.calculatePeriodStats(todayBills),
        thisMonth: this.calculatePeriodStats(monthBills),
        allTime: this.calculatePeriodStats(allBills)
      };
    } catch (error) {
      console.error("Error getting billing statistics:", error);
      return this.getSampleStatistics();
    }
  }

  // Helper method to calculate stats for a period
  calculatePeriodStats(bills) {
    return {
      totalBills: bills.length,
      totalAmount: bills.reduce((sum, bill) => sum + (parseFloat(bill.final_amount) || 0), 0),
      paidAmount: bills.reduce((sum, bill) => sum + (parseFloat(bill.paid_amount) || 0), 0),
      pendingAmount: bills.reduce((sum, bill) => sum + ((parseFloat(bill.final_amount) || 0) - (parseFloat(bill.paid_amount) || 0)), 0),
      paidBills: bills.filter(bill => bill.status === 'paid').length,
      pendingBills: bills.filter(bill => bill.status === 'pending' || bill.status === 'partial').length
    };
  }

  // Format tests/packages for display
  formatTestsForDisplay(billItems) {
    if (!billItems || billItems.length === 0) {
      return "No tests";
    }

    const testNames = billItems.map(item => {
      if (item.tests && item.tests.test_name) {
        return item.tests.test_name;
      } else if (item.packages && item.packages.package_name) {
        return item.packages.package_name;
      }
      return "Unknown";
    }).filter(name => name !== "Unknown");

    if (testNames.length === 0) {
      return "No tests";
    }

    if (testNames.length <= 2) {
      return testNames.join(", ");
    }

    return `${testNames.slice(0, 2).join(", ")} +${testNames.length - 2} more`;
  }

  // Format currency for display
  formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return `Rs. ${num.toFixed(2)}`;
  }

  // Format date for display
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return "Invalid Date";
    }
  }

  // Sample data for offline mode
  getSampleBillsData() {
    return [
      {
        id: 1,
        bill_no: "B001",
        patient_name: "John Doe",
        patient_gender: "Male",
        bill_date: new Date().toISOString(),
        paid_amount: 1500.00,
        remaining_amount: 0.00,
        final_amount: 1500.00,
        status: "paid",
        bill_items: [
          { tests: { test_name: "Blood Test" } },
          { tests: { test_name: "Urine Test" } }
        ]
      },
      {
        id: 2,
        bill_no: "B002",
        patient_name: "Jane Smith",
        patient_gender: "Female",
        bill_date: new Date(Date.now() - 86400000).toISOString(),
        paid_amount: 800.00,
        remaining_amount: 200.00,
        final_amount: 1000.00,
        status: "partial",
        bill_items: [
          { tests: { test_name: "X-Ray" } }
        ]
      }
    ];
  }

  // Delete bill by ID
  async deleteBill(billId) {
    try {
      if (!this.isSupabaseAvailable()) {
        throw new Error("Database connection not available. Cannot delete bill.");
      }

      // First, get bill details for confirmation
      const billDetails = await this.getBillDetails(billId);
      if (!billDetails) {
        throw new Error("Bill not found");
      }

      // Check authorization (same center only, for ALL users)
      if (this.getUserCenterId()) {
        if (billDetails.center_id !== this.getUserCenterId()) {
          throw new Error("You are not authorized to delete this bill");
        }
      }

      // Delete bill items first (foreign key constraint)
      const { error: itemsError } = await this.supabase
        .from("bill_items")
        .delete()
        .eq("bill_id", billId);

      if (itemsError) {
        console.error("Error deleting bill items:", itemsError);
        throw new Error(`Failed to delete bill items: ${itemsError.message}`);
      }

      // Then delete the bill
      const { error: billError } = await this.supabase
        .from("bills")
        .delete()
        .eq("id", billId);

      if (billError) {
        console.error("Error deleting bill:", billError);
        throw new Error(`Failed to delete bill: ${billError.message}`);
      }

      console.log(`Bill ${billDetails.bill_no} deleted successfully`);
      return {
        success: true,
        deletedBill: billDetails,
        message: `Bill ${billDetails.bill_no} has been deleted successfully`
      };

    } catch (error) {
      console.error("Error in deleteBill:", error);
      throw error;
    }
  }

  // Soft delete bill (mark as deleted instead of actually deleting)
  async softDeleteBill(billId) {
    try {
      if (!this.isSupabaseAvailable()) {
        throw new Error("Database connection not available. Cannot delete bill.");
      }

      const billDetails = await this.getBillDetails(billId);
      if (!billDetails) {
        throw new Error("Bill not found");
      }

      // Check authorization (same center only, for ALL users)
      if (this.getUserCenterId()) {
        if (billDetails.center_id !== this.getUserCenterId()) {
          throw new Error("You are not authorized to delete this bill");
        }
      }

      const { data: bill, error } = await this.supabase
        .from("bills")
        .update({
          status: "deleted",
          updated_at: new Date().toISOString()
        })
        .eq("id", billId)
        .select()
        .single();

      if (error) {
        console.error("Error soft deleting bill:", error);
        throw new Error(`Failed to delete bill: ${error.message}`);
      }

      return {
        success: true,
        deletedBill: bill,
        message: `Bill ${bill.bill_no} has been deleted successfully`
      };

    } catch (error) {
      console.error("Error in softDeleteBill:", error);
      throw error;
    }
  }

  // Check if bill can be deleted (business logic)
  async canDeleteBill(billId) {
    try {
      if (!this.isSupabaseAvailable()) {
        return { canDelete: false, reason: "Database connection not available" };
      }

      const billDetails = await this.getBillDetails(billId);
      if (!billDetails) {
        return { canDelete: false, reason: "Bill not found" };
      }

      // Check authorization (same center only, for ALL users)
      if (this.getUserCenterId()) {
        if (billDetails.center_id !== this.getUserCenterId()) {
          return { canDelete: false, reason: "You are not authorized to delete this bill" };
        }
      }

      // Bill can be deleted - no restrictions
      return { 
        canDelete: true, 
        reason: null,
        billDetails: billDetails
      };

    } catch (error) {
      console.error("Error checking if bill can be deleted:", error);
      return { canDelete: false, reason: "Error checking bill status" };
    }
  }

  // Sample statistics for offline mode
  getSampleStatistics() {
    return {
      today: {
        totalBills: 5,
        totalAmount: 7500.00,
        paidAmount: 6000.00,
        pendingAmount: 1500.00,
        paidBills: 3,
        pendingBills: 2
      },
      thisMonth: {
        totalBills: 50,
        totalAmount: 75000.00,
        paidAmount: 60000.00,
        pendingAmount: 15000.00,
        paidBills: 35,
        pendingBills: 15
      },
      allTime: {
        totalBills: 500,
        totalAmount: 750000.00,
        paidAmount: 600000.00,
        pendingAmount: 150000.00,
        paidBills: 350,
        pendingBills: 150
      }
    };
  }
}

// Export the service
window.AdminBillsService = AdminBillsService;
