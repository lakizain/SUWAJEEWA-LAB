// Billing Service - Handles all billing related operations
class BillingService {
  constructor() {
    this.supabase = window.SUPABASE_CONFIG?.supabase || null;
    this.DB_SCHEMA = window.SUPABASE_CONFIG?.DB_SCHEMA || null;

    if (!this.supabase) {
      console.warn("BillingService initialized without Supabase connection");
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
    return user?.center_id;
  }

  // Check if Supabase is available
  isSupabaseAvailable() {
    return this.supabase !== null;
  }

  filterBillItemsForDisplay(items) {
    return (items || []).filter((item) => !item?.is_package_component);
  }

  normalizeBillForDisplay(bill) {
    if (!bill || !Array.isArray(bill.bill_items)) return bill;
    return {
      ...bill,
      bill_items: this.filterBillItemsForDisplay(bill.bill_items),
    };
  }

  // Generate unique bill number
  async generateBillNumber() {
    if (!this.isSupabaseAvailable()) {
      // Generate a timestamp-based bill number for offline mode
      const timestamp = Date.now().toString().slice(-6);
      return `B${timestamp}`;
    }

    try {
      const { data: lastBill, error } = await this.supabase
        .from("bills")
        .select("bill_no")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (lastBill && lastBill.length > 0) {
        const lastBillNo = lastBill[0].bill_no;
        const lastNumber = parseInt(lastBillNo.replace("B", ""));
        nextNumber = lastNumber + 1;
      }

      return `B${nextNumber.toString().padStart(3, "0")}`;
    } catch (error) {
      console.error("Error generating bill number:", error);
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString().slice(-6);
      return `B${timestamp}`;
    }
  }

  // Create new bill with retry mechanism for race conditions
  async createBill(billData, retryCount = 0) {
    const maxRetries = 3;

    try {
      const billNumber = await this.generateBillNumber();

      // If Supabase is not available, return mock data for offline mode
      if (!this.isSupabaseAvailable()) {
        console.warn("Creating bill in offline mode");
        return {
          id: Date.now(),
          bill_no: billNumber,
          bill_date: new Date().toISOString(),
          ...billData,
          status: "offline",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      // Auto-fill center_id if not provided and user has a center
      let centerId = billData.center_id;
      if ((centerId === "" || centerId === undefined || centerId === null) && this.getUserCenterId()) {
        centerId = this.getUserCenterId();
      }

      const billPayload = {
        bill_no: billNumber,
        bill_date: new Date().toISOString(),
        bill_type: billData.bill_type || "Main Lab",
        center_id: centerId !== "" ? centerId : null,
        patient_phone: billData.patient_phone,
        patient_name: billData.patient_name,
        patient_title: billData.patient_title,
        patient_age_years:
          billData.patient_age_years !== ""
            ? parseInt(billData.patient_age_years)
            : null,
        patient_age_months:
          billData.patient_age_months !== ""
            ? parseInt(billData.patient_age_months)
            : null,
        patient_age_days:
          billData.patient_age_days !== ""
            ? parseInt(billData.patient_age_days)
            : null,
        patient_gender: billData.patient_gender,
        ref_by: billData.ref_by || null, // Fixed to use ref_by instead of reference_id
        new_referral: billData.new_referral,
        total_amount: billData.total_amount || 0,
        discount: billData.discount || 0,
        discount_type: billData.discount_type || "percent",
        final_amount: billData.final_amount || 0,
        paid_amount: billData.paid_amount || 0,
        remaining_amount: billData.remaining_amount || 0,
        lifetime_discount: billData.lifetime_discount || false,
        status: "pending",
      };

      console.log(
        `Creating bill with payload (attempt ${retryCount + 1}):`,
        JSON.stringify(billPayload, null, 2)
      );

      // Check if bill number already exists (race condition protection)
      const { data: existingBill, error: checkError } = await this.supabase
        .from("bills")
        .select("bill_no")
        .eq("bill_no", billNumber)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("Error checking existing bill:", checkError);
        throw checkError;
      }

      if (existingBill) {
        console.warn(
          "Bill number already exists, generating new one:",
          billNumber
        );
        // Generate a new bill number with timestamp to avoid conflicts
        const timestamp = Date.now().toString().slice(-4);
        billPayload.bill_no = `${billNumber}-${timestamp}`;
        console.log("New bill number generated:", billPayload.bill_no);
      }

      const { data: bill, error } = await this.supabase
        .from("bills")
        .insert(billPayload)
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          constraint: error.constraint,
        });

        // Handle specific error codes
        if (error.code === "23505") {
          // Unique violation
          if (error.constraint && error.constraint.includes("bill_no")) {
            // Retry with a new bill number if it's a bill number conflict
            if (retryCount < maxRetries) {
              console.log(
                `Bill number conflict detected, retrying (${
                  retryCount + 1
                }/${maxRetries})...`
              );
              // Wait a bit before retrying to avoid immediate conflicts
              await new Promise((resolve) =>
                setTimeout(resolve, 100 * (retryCount + 1))
              );
              return this.createBill(billData, retryCount + 1);
            } else {
              throw new Error(
                `Bill number ${billPayload.bill_no} already exists. Please try again.`
              );
            }
          } else if (error.constraint && error.constraint.includes("patient")) {
            throw new Error(
              "A bill with this patient information already exists."
            );
          } else {
            throw new Error(
              "Duplicate data detected. Please check your input and try again."
            );
          }
        } else if (error.code === "23514") {
          // Check violation
          throw new Error(
            "Invalid data provided. Please check all required fields."
          );
        } else if (error.code === "23503") {
          // Foreign key violation
          throw new Error(
            "Invalid reference data. Please check center or reference selection."
          );
        } else if (error.code === "409") {
          // Conflict
          if (retryCount < maxRetries) {
            console.log(
              `Conflict detected, retrying (${retryCount + 1}/${maxRetries})...`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 200 * (retryCount + 1))
            );
            return this.createBill(billData, retryCount + 1);
          } else {
            throw new Error(
              "Conflict detected after multiple attempts. Please try again."
            );
          }
        }

        throw error;
      }

      if (billData.items && billData.items.length > 0) {
        await this.addBillItems(bill.id, billData.items);
      }

      return bill;
    } catch (error) {
      console.error("Error creating bill:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        constraint: error.constraint,
        retryCount,
      });
      throw error;
    }
  }

  // Add items to bill
  async addBillItems(billId, items) {
    try {
      const billItems = items.map((item) => {
        const quantity = parseFloat(item.quantity || item.qty) || 1;
        const unitPrice = parseFloat(item.unit_price || item.price) || 0;
        return {
          bill_id: billId,
          test_id: item.test_id,
          package_id: item.package_id || null,
          quantity: quantity,
          unit_price: unitPrice,
          total_price: item.total_price || quantity * unitPrice,
          is_package_component: Boolean(item.is_package_component),
        };
      });

      const { data, error } = await this.supabase
        .from("bill_items")
        .insert(billItems);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error adding bill items:", error);
      throw error;
    }
  }

  // Update bill items (delete existing and add new ones)
  async updateBillItems(billId, items) {
    try {
      // First delete existing bill items
      await this.supabase.from("bill_items").delete().eq("bill_id", billId);

      // Then add new bill items
      if (items && items.length > 0) {
        return await this.addBillItems(billId, items);
      }

      return [];
    } catch (error) {
      console.error("Error updating bill items:", error);
      throw error;
    }
  }

  // Get bill by ID
  async getBillById(billId) {
    try {
      const { data: bill, error } = await this.supabase
        .from("bills")
        .select(
          `
                    *,
                    bill_items (
                        *,
                        tests (test_name, short_name, price),
                        packages (package_name, price)
                    ),
                    centers (center_name)
                `
        )
        .eq("id", billId)
        .single();

      if (error) throw error;
      return this.normalizeBillForDisplay(bill);
    } catch (error) {
      console.error("Error getting bill:", error);
      throw error;
    }
  }

  // Get bill by number
  async getBillByNumber(billNo) {
    try {
      const { data: bill, error } = await this.supabase
        .from("bills")
        .select(
          `
                    *,
                    bill_items (
                        *,
                        tests (test_name, short_name, price),
                        packages (package_name, price)
                    ),
                    centers (center_name)
                `
        )
        .eq("bill_no", billNo)
        .single();

      if (error) throw error;
      return this.normalizeBillForDisplay(bill);
    } catch (error) {
      console.error("Error getting bill by number:", error);
      throw error;
    }
  }

  // Get bill items by bill ID
  async getBillItems(billId, options = {}) {
    try {
      const includeComponents = options.includeComponents === true;
      const { data: billItems, error } = await this.supabase
        .from("bill_items")
        .select(
          `
          *,
          tests:test_id(*),
          packages:package_id(*)
        `
        )
        .eq("bill_id", billId);

      if (error) throw error;
      return includeComponents
        ? billItems || []
        : this.filterBillItemsForDisplay(billItems);
    } catch (error) {
      console.error("Error getting bill items:", error);
      throw error;
    }
  }

  // Get patient history by phone
  async getPatientHistory(phone) {
    try {
      const { data: bills, error } = await this.supabase
        .from("bills")
        .select(
          `
                    id,
                    bill_no,
                    bill_date,
                    patient_name,
                    patient_title,
                    patient_age_years,
                    patient_age_months,
                    patient_age_days,
                    patient_gender,
                    ref_by,
                    lifetime_discount,
                    total_amount,
                    paid_amount,
                    remaining_amount,
                    bill_items (
                      is_package_component,
                      tests (test_name),
                      packages (package_name)
                    )
                `
        )
        .eq("patient_phone", phone)
        .order("bill_date", { ascending: false });

      if (error) throw error;
      return (bills || []).map((bill) => this.normalizeBillForDisplay(bill));
    } catch (error) {
      console.error("Error getting patient history:", error);
      throw error;
    }
  }

  // Get recent bills
  async getRecentBills(limit = 10) {
    try {
      if (!this.isSupabaseAvailable()) {
        console.warn("Supabase not available, returning empty recent bills");
        return [];
      }

      let query = this.supabase
        .from("bills")
        .select(
          `
                    id,
                    bill_no,
                    patient_name,
                    bill_date,
                    final_amount,
                    status
                `
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!this.isUserAdmin() && this.getUserCenterId()) {
        query = query.eq("center_id", this.getUserCenterId());
      }

      const { data: bills, error } = await query;

      if (error) throw error;
      return bills || [];
    } catch (error) {
      console.error("Error getting recent bills:", error);
      return [];
    }
  }

  // Search bills
  async searchBills(searchTerm) {
    try {
      let query = this.supabase
        .from("bills")
        .select(
          `
          id,
          bill_no,
          patient_name,
          bill_date,
          final_amount,
          status
        `
        )
        .or(`bill_no.ilike.%${searchTerm}%,patient_name.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false });

      if (!this.isUserAdmin() && this.getUserCenterId()) {
        query = query.eq("center_id", this.getUserCenterId());
      }

      const { data: bills, error } = await query;

      if (error) throw error;
      return bills;
    } catch (error) {
      console.error("Error searching bills:", error);
      throw error;
    }
  }

  // Search patient history by bill number or phone with optional filters
  async searchPatientHistory({ query, centerId = null, memberName = null }) {
    try {
      if (!this.isSupabaseAvailable()) {
        console.warn("Supabase not available. Returning empty history");
        return [];
      }

      let q = this.supabase
        .from("bills")
        .select(
          `
            id,
            bill_no,
            bill_date,
            patient_name,
            patient_gender,
            patient_phone,
            paid_amount,
            remaining_amount,
            ref_by,
            center_id,
            bill_items(
              is_package_component,
              tests(test_name),
              packages(package_name)
            )
          `
        )
        .order("bill_date", { ascending: false });

      if (query && query.trim() !== "") {
        const term = query.trim();
        // Match bill_no exactly OR phone partially
        q = q.or(`bill_no.eq.${term},patient_phone.ilike.%${term}%`);
      }

      if (centerId && centerId !== "all") {
        q = q.eq("center_id", centerId);
      } else if (!this.isUserAdmin() && this.getUserCenterId()) {
        // If user is not admin and no centerId provided, use user's center
        q = q.eq("center_id", this.getUserCenterId());
      }

      if (memberName && memberName !== "all") {
        // ref_by stores the doctor name in bills table
        q = q.eq("ref_by", memberName);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((bill) => this.normalizeBillForDisplay(bill));
    } catch (error) {
      console.error("Error searching patient history:", error);
      return [];
    }
  }

  // Update bill
  async updateBill(billId, updateData) {
    try {
      console.log("Updating bill with data:", { billId, updateData });

      // Check if user is authorized to update this bill (only admin or same center)
      if (!this.isUserAdmin() && this.getUserCenterId()) {
        const bill = await this.getBillById(billId);
        if (bill && bill.center_id !== this.getUserCenterId()) {
          throw new Error("You are not authorized to update this bill");
        }
      }

      const { data: bill, error } = await this.supabase
        .from("bills")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", billId)
        .select()
        .single();

      if (error) {
        console.error("Supabase error details:", error);
        throw new Error(
          `Database update failed: ${error.message} (${
            error.details || "No details"
          })`
        );
      }

      console.log("Bill updated successfully:", bill);
      return bill;
    } catch (error) {
      console.error("Error updating bill:", error);
      throw error;
    }
  }

  // Update bill payment
  async updateBillPayment(billId, paidAmount) {
    try {
      // Check authorization
      if (!this.isUserAdmin() && this.getUserCenterId()) {
        const bill = await this.getBillById(billId);
        if (bill && bill.center_id !== this.getUserCenterId()) {
          throw new Error("You are not authorized to update this bill");
        }
      }

      const bill = await this.getBillById(billId);
      const remainingAmount = bill.final_amount - paidAmount;
      const status = remainingAmount <= 0 ? "paid" : "partial";

      return await this.updateBill(billId, {
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        status: status,
      });
    } catch (error) {
      console.error("Error updating bill payment:", error);
      throw error;
    }
  }

  // Delete bill
  async deleteBill(billId) {
    try {
      // Check authorization
      if (!this.isUserAdmin() && this.getUserCenterId()) {
        const bill = await this.getBillById(billId);
        if (bill && bill.center_id !== this.getUserCenterId()) {
          throw new Error("You are not authorized to delete this bill");
        }
      }

      // First delete bill items
      await this.supabase.from("bill_items").delete().eq("bill_id", billId);

      // Then delete the bill
      const { error } = await this.supabase
        .from("bills")
        .delete()
        .eq("id", billId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting bill:", error);
      throw error;
    }
  }

  // Get billing statistics
  async getBillingStats() {
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).toISOString();
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59
      ).toISOString();

      let todayQuery = this.supabase
        .from("bills")
        .select("final_amount, status")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay);

      let totalQuery = this.supabase
        .from("bills")
        .select("final_amount, status");

      if (!this.isUserAdmin() && this.getUserCenterId()) {
        todayQuery = todayQuery.eq("center_id", this.getUserCenterId());
        totalQuery = totalQuery.eq("center_id", this.getUserCenterId());
      }

      const { data: todayBills, error: todayError } = await todayQuery;

      if (todayError) throw todayError;

      const { data: totalBills, error: totalError } = await totalQuery;

      if (totalError) throw totalError;

      const stats = {
        today: {
          count: todayBills.length,
          amount: todayBills.reduce((sum, bill) => sum + bill.final_amount, 0),
          paid: todayBills.filter((bill) => bill.status === "paid").length,
        },
        total: {
          count: totalBills.length,
          amount: totalBills.reduce((sum, bill) => sum + bill.final_amount, 0),
          paid: totalBills.filter((bill) => bill.status === "paid").length,
        },
      };

      return stats;
    } catch (error) {
      console.error("Error getting billing stats:", error);
      throw error;
    }
  }

  // Check for existing bills with same patient info
  async checkExistingBills(patientName, patientPhone) {
    try {
      if (!patientName || !patientPhone) return [];

      let query = this.supabase
        .from("bills")
        .select("id, bill_no, bill_date, total_amount, status")
        .or(
          `patient_name.ilike.%${patientName.trim()}%,patient_phone.eq.${patientPhone.trim()}`
        )
        .order("created_at", { ascending: false })
        .limit(5);

      if (!this.isUserAdmin() && this.getUserCenterId()) {
        query = query.eq("center_id", this.getUserCenterId());
      }

      const { data: bills, error } = await query;

      if (error) throw error;
      return bills || [];
    } catch (error) {
      console.error("Error checking existing bills:", error);
      return [];
    }
  }

  // Get billing data for reports (enhanced connection)
  async getBillingDataForReports(filters = {}) {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log("Supabase not available, returning sample billing data");
        return [];
      }

      let query = this.supabase
        .from("bills")
        .select(
          `
          *,
          centers(center_name),
          bill_items(
            *,
            tests(test_name, short_name, price),
            packages(package_name, price)
          )
        `
        )
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters.fromDate) {
        query = query.gte("bill_date", filters.fromDate);
      }
      if (filters.toDate) {
        query = query.lte("bill_date", filters.toDate);
      }
      if (filters.centerId && filters.centerId !== "all") {
        query = query.eq("center_id", filters.centerId);
      } else if (!this.isUserAdmin() && this.getUserCenterId()) {
        // If user is not admin and no centerId provided, use user's center
        query = query.eq("center_id", this.getUserCenterId());
      }
      if (filters.referenceId && filters.referenceId !== "all") {
        // Get reference name by ID and filter by ref_by field
        const referenceService = window.app?.getService("reference");
        if (referenceService) {
          try {
            const references = await referenceService.getAllReferences();
            const reference = references.find(
              (ref) => ref.id === filters.referenceId
            );
            if (reference) {
              query = query.eq("ref_by", reference.name);
            }
          } catch (error) {
            console.warn("Could not get reference name for filtering:", error);
          }
        }
      }
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error getting billing data for reports:", error);
        throw error;
      }

      console.log(`Billing data for reports: Found ${data.length} bills`);
      return (data || []).map((bill) => this.normalizeBillForDisplay(bill));
    } catch (error) {
      console.error("Error getting billing data for reports:", error);
      return [];
    }
  }

  // Get billing summary for reports
  async getBillingSummaryForReports(filters = {}) {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log("Supabase not available, returning sample summary");
        return {
          total_bills: 0,
          total_amount: 0,
          paid_amount: 0,
          pending_amount: 0,
          by_status: {},
          by_center: {},
          by_reference: {},
        };
      }

      let query = this.supabase.from("bills").select(
        `
          final_amount,
          paid_amount,
          status,
          centers(center_name),
          ref_by
        `
      );

      // Apply filters
      if (filters.fromDate) {
        query = query.gte("bill_date", filters.fromDate);
      }
      if (filters.toDate) {
        query = query.lte("bill_date", filters.toDate);
      }
      if (filters.centerId && filters.centerId !== "all") {
        query = query.eq("center_id", filters.centerId);
      } else if (!this.isUserAdmin() && this.getUserCenterId()) {
        // If user is not admin and no centerId provided, use user's center
        query = query.eq("center_id", this.getUserCenterId());
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error getting billing summary:", error);
        throw error;
      }

      const summary = {
        total_bills: data.length,
        total_amount: 0,
        paid_amount: 0,
        pending_amount: 0,
        by_status: {},
        by_center: {},
        by_reference: {},
      };

      data.forEach((bill) => {
        const amount = parseFloat(bill.final_amount || 0);
        const paid = parseFloat(bill.paid_amount || 0);

        summary.total_amount += amount;
        summary.paid_amount += paid;
        summary.pending_amount += amount - paid;

        // By status
        const status = bill.status || "unknown";
        if (!summary.by_status[status]) {
          summary.by_status[status] = { count: 0, amount: 0 };
        }
        summary.by_status[status].count++;
        summary.by_status[status].amount += amount;

        // By center
        const centerName = bill.centers?.center_name || "Unknown";
        if (!summary.by_center[centerName]) {
          summary.by_center[centerName] = { count: 0, amount: 0 };
        }
        summary.by_center[centerName].count++;
        summary.by_center[centerName].amount += amount;

        // By reference
        const refName = bill.ref_by || "Unknown";
        if (!summary.by_reference[refName]) {
          summary.by_reference[refName] = { count: 0, amount: 0 };
        }
        summary.by_reference[refName].count++;
        summary.by_reference[refName].amount += amount;
      });

      console.log("Billing summary calculated:", summary);
      return summary;
    } catch (error) {
      console.error("Error getting billing summary:", error);
      throw error;
    }
  }
}

// Export the service
window.BillingService = BillingService;
