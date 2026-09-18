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

  parseBillNumberParts(billNo) {
    if (!billNo) return null;
    const value = String(billNo);
    const shortFormat = value.match(/^([A-Z]{2})-(\d+)$/);
    if (shortFormat) {
      return {
        prefix: shortFormat[1],
        num: parseInt(shortFormat[2], 10),
        padLength: 5,
      };
    }

    const prefixedFormat = value.match(/^(.+)-(\d+)$/);
    if (prefixedFormat) {
      return {
        prefix: prefixedFormat[1],
        num: parseInt(prefixedFormat[2], 10),
        padLength: /^[A-Z]{2}$/.test(prefixedFormat[1]) ? 5 : 3,
      };
    }

    const legacyFormat = value.match(/^B(\d+)$/);
    if (legacyFormat) {
      return {
        prefix: "B",
        num: parseInt(legacyFormat[1], 10),
        padLength: 3,
        legacy: true,
      };
    }

    return null;
  }

  incrementBillNumber(billNo) {
    const parts = this.parseBillNumberParts(billNo);
    if (!parts) return null;

    const next = parts.num + 1;
    if (parts.legacy) {
      return `B${String(next).padStart(parts.padLength, "0")}`;
    }

    return `${parts.prefix}-${String(next).padStart(parts.padLength, "0")}`;
  }

  async isBillNumberTaken(billNo) {
    const { data, error } = await this.supabase
      .from("bills")
      .select("bill_no")
      .eq("bill_no", billNo)
      .maybeSingle();

    if (error) throw error;
    return data !== null;
  }

  async findNextAvailableBillNumber(startBillNo, maxAttempts = 100) {
    let candidate = startBillNo;
    const startParts = this.parseBillNumberParts(startBillNo);

    if (startParts) {
      let maxExisting = 0;

      if (startParts.legacy) {
        const { data: legacyBills, error } = await this.supabase
          .from("bills")
          .select("bill_no")
          .like("bill_no", "B%")
          .order("created_at", { ascending: false })
          .limit(300);

        if (!error) {
          for (const row of legacyBills || []) {
            const parts = this.parseBillNumberParts(row.bill_no);
            if (parts?.legacy && parts.num > maxExisting) {
              maxExisting = parts.num;
            }
          }
        }
      } else {
        const { data: prefixBills, error } = await this.supabase
          .from("bills")
          .select("bill_no")
          .like("bill_no", `${startParts.prefix}-%`)
          .order("created_at", { ascending: false })
          .limit(300);

        if (!error) {
          for (const row of prefixBills || []) {
            const parts = this.parseBillNumberParts(row.bill_no);
            if (parts?.num > maxExisting) {
              maxExisting = parts.num;
            }
          }
        }
      }

      const nextFromMax = maxExisting + 1;
      const nextFromStart = startParts.num;
      const resolvedNum = Math.max(nextFromStart, nextFromMax);

      if (startParts.legacy) {
        candidate = `B${String(resolvedNum).padStart(startParts.padLength, "0")}`;
      } else {
        candidate = `${startParts.prefix}-${String(resolvedNum).padStart(
          startParts.padLength,
          "0"
        )}`;
      }

      if (candidate !== startBillNo) {
        console.log(
          `Adjusted bill number from ${startBillNo} to ${candidate} based on existing bills`
        );
      }
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const taken = await this.isBillNumberTaken(candidate);
      if (!taken) {
        if (attempt > 0 || candidate !== startBillNo) {
          console.log(`Resolved available bill number: ${candidate}`);
        }
        return candidate;
      }

      console.warn(
        `Bill number ${candidate} exists (attempt ${attempt + 1}/${maxAttempts}), trying next...`
      );

      const nextCandidate = this.incrementBillNumber(candidate);
      if (!nextCandidate) {
        break;
      }
      candidate = nextCandidate;
    }

    const fallback = `${startBillNo}-${Date.now().toString().slice(-4)}`;
    console.warn(`Using fallback bill number: ${fallback}`);
    return fallback;
  }

  isBillNumberConflict(error) {
    if (!error) return false;
    if (error.code === "23505") {
      return !error.constraint || error.constraint.includes("bill_no");
    }
    return error.code === "409";
  }

  async syncCenterCounterIfNeeded(centerId, billNo) {
    const parts = this.parseBillNumberParts(billNo);
    if (!parts?.num || !centerId || !this.isSupabaseAvailable()) return;

    try {
      const { data: center, error } = await this.supabase
        .from("centers")
        .select("bill_counter")
        .eq("id", centerId)
        .single();

      if (error || !center) return;

      if (parts.num > (center.bill_counter || 0)) {
        await this.supabase
          .from("centers")
          .update({ bill_counter: parts.num })
          .eq("id", centerId);
      }
    } catch (syncError) {
      console.warn("Could not sync bill counter:", syncError);
    }
  }

  // Generate unique bill number (center-wise if centerId is provided)
  // NEW FORMAT (from today): YT-00001   (short_name + 5-digit counter, zero-padded)
  // OLD BILLS STAY UNCHANGED:   CID001-B001   or   B001
  async generateBillNumber(centerId = null) {
    const resolvedCenterId = centerId || this.getUserCenterId();

    if (!this.isSupabaseAvailable()) {
      const timestamp = Date.now().toString().slice(-6);
      return `B${timestamp}`;
    }

    // Primary path: use the atomic RPC function (recommended)
    if (resolvedCenterId) {
      try {
        const { data, error } = await this.supabase
          .rpc('get_next_bill_number', { p_center_id: resolvedCenterId });

        if (error) {
          console.warn('RPC get_next_bill_number failed, falling back:', error);
        } else if (data && data.length > 0 && data[0].formatted_bill_no) {
          return this.findNextAvailableBillNumber(data[0].formatted_bill_no);
        }
      } catch (rpcError) {
        console.warn('RPC call error, falling back to legacy:', rpcError);
      }
    }

    // ======================================================
    // FALLBACK: manual bill number generation (if RPC unavailable)
    // To guarantee sequential (1,2,3,4...): take last 50 bills,
    // extract numeric suffix from EVERY bill, take MAX, then +1.
    // This avoids "random" jumps caused by created_at ordering issues
    // when bill formats are mixed or timestamps are very close.
    // ======================================================
    try {
      let prefix = null;
      if (resolvedCenterId) {
        try {
          const { data: ctr, error: ctrErr } = await this.supabase
            .from("centers")
            .select("cid, short_name, bill_counter")
            .eq("id", resolvedCenterId)
            .single();

          if (!ctrErr && ctr) {
            prefix =
              ctr.short_name && /^[A-Z]{2}$/.test(ctr.short_name)
                ? ctr.short_name
                : ctr.cid;
          }
        } catch (e) {
          // ignore, fall through to plain B format
        }
      }

      const extractNum = (billNo) => {
        const parts = this.parseBillNumberParts(
          String(billNo).replace(/-\d{4,6}$/, "")
        );
        return parts?.num || 0;
      };

      let lastNumber = 0;
      if (prefix) {
        const { data: prefixBills, error: prefixError } = await this.supabase
          .from("bills")
          .select("bill_no")
          .like("bill_no", `${prefix}-%`)
          .order("created_at", { ascending: false })
          .limit(200);

        if (prefixError) throw prefixError;

        for (const row of prefixBills || []) {
          const n = extractNum(row.bill_no);
          if (n > lastNumber) lastNumber = n;
        }
      } else {
        const { data: recentBills, error } = await this.supabase
          .from("bills")
          .select("bill_no")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        for (const row of recentBills || []) {
          const n = extractNum(row.bill_no);
          if (n > lastNumber) lastNumber = n;
        }
      }

      const nextNumber = lastNumber + 1;

      if (prefix) {
        return this.findNextAvailableBillNumber(
          `${prefix}-${nextNumber.toString().padStart(5, "0")}`
        );
      }

      return this.findNextAvailableBillNumber(
        `B${nextNumber.toString().padStart(3, "0")}`
      );
    } catch (error) {
      console.error("Error generating bill number:", error);
      const timestamp = Date.now().toString().slice(-6);
      return `B${timestamp}`;
    }
  }

  // Create new bill with retry mechanism for race conditions
  async createBill(billData, retryCount = 0, preferredBillNo = null) {
    const maxRetries = 5;

    try {
      // Auto-fill center_id if not provided and user has a center
      let centerId = billData.center_id;
      if ((centerId === "" || centerId === undefined || centerId === null) && this.getUserCenterId()) {
        centerId = this.getUserCenterId();
      }

      const generatedBillNumber = preferredBillNo
        ? preferredBillNo
        : await this.generateBillNumber(centerId);
      const billNumber = await this.findNextAvailableBillNumber(
        generatedBillNumber
      );

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

      billPayload.bill_no = billNumber;

      console.log(
        `Creating bill with payload (attempt ${retryCount + 1}):`,
        JSON.stringify(billPayload, null, 2)
      );

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

        if (this.isBillNumberConflict(error)) {
          if (retryCount < maxRetries) {
            const nextBillNo =
              this.incrementBillNumber(billPayload.bill_no) ||
              `${billPayload.bill_no}-${Date.now().toString().slice(-4)}`;

            console.log(
              `Bill number conflict on ${billPayload.bill_no}, retrying with ${nextBillNo} (${
                retryCount + 1
              }/${maxRetries})...`
            );

            await new Promise((resolve) =>
              setTimeout(resolve, 100 * (retryCount + 1))
            );
            return this.createBill(billData, retryCount + 1, nextBillNo);
          }

          throw new Error(
            `Bill number ${billPayload.bill_no} already exists. Please try again.`
          );
        }

        // Handle specific error codes
        if (error.code === "23505") {
          if (error.constraint && error.constraint.includes("patient")) {
            throw new Error(
              "A bill with this patient information already exists."
            );
          }

          throw new Error(
            "Duplicate data detected. Please check your input and try again."
          );
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
        }

        throw error;
      }

      await this.syncCenterCounterIfNeeded(centerId, bill.bill_no);

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
                    centers (center_name, phone, address, email, short_name)
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
                    centers (center_name, phone, address, email, short_name)
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

  // Get patient history by phone (filtered by user's center unless admin)
  async getPatientHistory(phone) {
    try {
      let query = this.supabase
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

      if (this.getUserCenterId()) {
        query = query.eq("center_id", this.getUserCenterId());
      }

      const { data: bills, error } = await query;

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

      if (this.getUserCenterId()) {
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

      if (this.getUserCenterId()) {
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
      } else if (this.getUserCenterId()) {
        // If no centerId provided, use user's center (for all users regardless of role)
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

      // Check if user is authorized to update this bill (same center only, for ALL users)
      if (this.getUserCenterId()) {
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
      // Check authorization (same center only, for ALL users)
      if (this.getUserCenterId()) {
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
      // Check authorization (same center only, for ALL users)
      if (this.getUserCenterId()) {
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

      if (this.getUserCenterId()) {
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

      if (this.getUserCenterId()) {
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
      } else if (this.getUserCenterId()) {
        // If no centerId provided, use user's center (for all users regardless of role)
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
      } else if (this.getUserCenterId()) {
        // If no centerId provided, use user's center (for all users regardless of role)
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
