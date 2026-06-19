// Reports Service - Handles all reports related operations
class ReportsService {
  constructor() {
    this.supabase = window.SUPABASE_CONFIG?.supabase || null;
    this.DB_SCHEMA = window.SUPABASE_CONFIG?.DB_SCHEMA || null;

    if (!this.supabase) {
      console.warn("ReportsService initialized without Supabase connection");
    }
  }

  // Check if Supabase is available
  isSupabaseAvailable() {
    return this.supabase !== null;
  }

  // Get daily sales report data
  async getDailySalesReport(fromDate = null, toDate = null, centerId = null) {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log(
          "Supabase not available, returning sample daily sales data"
        );
        return this.getSampleDailySalesData();
      }

      let query = this.supabase
        .from("bills")
        .select(
          `
          id,
          bill_no,
          bill_date,
          patient_name,
          final_amount,
          status,
          centers(center_name),
          ref_by,
          bill_items(
            quantity,
            unit_price,
            total_price,
            tests(test_name),
            packages(package_name)
          )
        `
        )
        .order("bill_date", { ascending: false });

      // Apply date filters
      if (fromDate) {
        const startOfDay = new Date(fromDate + "T00:00:00").toISOString();
        query = query.gte("bill_date", startOfDay);
      } else {
        // Default to today if no fromDate provided
        const today = new Date();
        const startOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        ).toISOString();
        query = query.gte("bill_date", startOfDay);
      }

      if (toDate) {
        const endOfDay = new Date(toDate + "T23:59:59").toISOString();
        query = query.lte("bill_date", endOfDay);
      } else if (!fromDate) {
        // Default to end of today if no toDate provided and no fromDate
        const today = new Date();
        const endOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59
        ).toISOString();
        query = query.lte("bill_date", endOfDay);
      }

      // Apply center filter
      if (centerId && centerId !== "all") {
        query = query.eq("center_id", centerId);
      }

      const { data: bills, error } = await query;

      if (error) {
        console.error("Error getting daily sales data:", error);
        throw error;
      }

      const dateRange =
        fromDate && toDate
          ? `${fromDate} to ${toDate}`
          : fromDate
          ? `from ${fromDate}`
          : toDate
          ? `until ${toDate}`
          : "today";
      console.log(
        `Daily sales data: Found ${bills.length} bills for ${dateRange}`
      );
      return bills;
    } catch (error) {
      console.error("Error getting daily sales report:", error);
      return this.getSampleDailySalesData();
    }
  }

  // Get monthly sales report data
  async getMonthlySalesReport(year = null, month = null, centerId = null) {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log(
          "Supabase not available, returning sample monthly sales data"
        );
        return this.getSampleMonthlySalesData();
      }

      const targetYear = year || new Date().getFullYear();
      const targetMonth =
        month !== null && month !== "all" ? parseInt(month) : null;

      let query = this.supabase
        .from("bills")
        .select(
          `
          id,
          bill_no,
          bill_date,
          final_amount,
          status
        `
        )
        .order("bill_date", { ascending: false });

      // Apply year filter
      const startOfYear = new Date(targetYear, 0, 1).toISOString();
      const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59).toISOString();
      query = query.gte("bill_date", startOfYear).lte("bill_date", endOfYear);

      // Apply month filter if specific month is selected
      if (targetMonth !== null) {
        const startOfMonth = new Date(targetYear, targetMonth, 1).toISOString();
        const endOfMonth = new Date(
          targetYear,
          targetMonth + 1,
          0,
          23,
          59,
          59
        ).toISOString();
        query = query
          .gte("bill_date", startOfMonth)
          .lte("bill_date", endOfMonth);
      }

      // Apply center filter
      if (centerId && centerId !== "all") {
        query = query.eq("center_id", centerId);
      }

      const { data: bills, error } = await query;

      if (error) {
        console.error("Error getting monthly sales data:", error);
        throw error;
      }

      // Group by month and calculate totals
      const monthlyData = {};
      bills.forEach((bill) => {
        const billDate = new Date(bill.bill_date);
        const monthKey = billDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            total_bills: 0,
            total_amount: 0,
          };
        }

        monthlyData[monthKey].total_bills++;
        monthlyData[monthKey].total_amount += parseFloat(
          bill.final_amount || 0
        );
      });

      const result = Object.values(monthlyData);
      console.log(
        `Monthly sales data: Found ${result.length} months with data`
      );
      return result;
    } catch (error) {
      console.error("Error getting monthly sales report:", error);
      return this.getSampleMonthlySalesData();
    }
  }

  // Get center wise report data
  async getCenterWiseReport(fromDate = null, toDate = null, centerId = null) {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log(
          "Supabase not available, returning sample center wise data"
        );
        return this.getSampleCenterWiseData();
      }

      let query = this.supabase
        .from("bills")
        .select(
          `
          id,
          bill_no,
          final_amount,
          centers(center_name)
        `
        )
        .order("created_at", { ascending: false });

      // Apply date filters
      if (fromDate) {
        const startOfDay = new Date(fromDate + "T00:00:00").toISOString();
        query = query.gte("bill_date", startOfDay);
      }

      if (toDate) {
        const endOfDay = new Date(toDate + "T23:59:59").toISOString();
        query = query.lte("bill_date", endOfDay);
      }

      // Apply center filter
      if (centerId && centerId !== "all") {
        query = query.eq("center_id", centerId);
      }

      const { data: bills, error } = await query;

      if (error) {
        console.error("Error getting center wise data:", error);
        throw error;
      }

      // Group by center and calculate totals
      const centerData = {};
      bills.forEach((bill) => {
        const centerName = bill.centers?.center_name || "Unknown Center";

        if (!centerData[centerName]) {
          centerData[centerName] = {
            center_name: centerName,
            total_bills: 0,
            total_amount: 0,
          };
        }

        centerData[centerName].total_bills++;
        centerData[centerName].total_amount += parseFloat(
          bill.final_amount || 0
        );
      });

      const result = Object.values(centerData);
      console.log(`Center wise data: Found ${result.length} centers with data`);
      return result;
    } catch (error) {
      console.error("Error getting center wise report:", error);
      return this.getSampleCenterWiseData();
    }
  }

  // Get commission report data
  async getCommissionReport(
    fromDate = null,
    toDate = null,
    referenceName = null
  ) {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log("Supabase not available, returning sample commission data");
        return this.getSampleCommissionData();
      }

      let query = this.supabase
        .from("bills")
        .select(
          `
          id,
          bill_no,
          bill_date,
          patient_name,
          final_amount,
          ref_by,
          bill_items(
            quantity,
            unit_price,
            total_price,
            tests(test_name),
            packages(package_name)
          )
        `
        )
        .not("ref_by", "is", null)
        .order("bill_date", { ascending: false });

      // Apply date filters
      if (fromDate) {
        const startOfDay = new Date(fromDate + "T00:00:00").toISOString();
        query = query.gte("bill_date", startOfDay);
      }

      if (toDate) {
        const endOfDay = new Date(toDate + "T23:59:59").toISOString();
        query = query.lte("bill_date", endOfDay);
      }

      // Apply reference filter
      if (referenceName && referenceName !== "all") {
        query = query.eq("ref_by", referenceName);
      }

      const { data: bills, error } = await query;

      if (error) {
        console.error("Error getting commission data:", error);
        throw error;
      }

      // Get reference commission rates
      const { data: references, error: refError } = await this.supabase
        .from("references")
        .select("name, commission");

      if (refError) {
        console.warn("Could not get reference commission rates:", refError);
      }

      const commissionRates = {};
      if (references) {
        references.forEach((ref) => {
          commissionRates[ref.name] = parseFloat(ref.commission || 0);
        });
      }

      // Calculate commission per bill item (flattened rows)
      const commissionData = [];
      bills.forEach((bill) => {
        const commissionRate = commissionRates[bill.ref_by] || 0;
        const items = Array.isArray(bill.bill_items) ? bill.bill_items : [];

        if (items.length > 0) {
          items.forEach((it) => {
            const qty = parseFloat(it.quantity || 1);
            const unit = parseFloat(it.unit_price || 0);
            const itemTotal = parseFloat(
              it.total_price != null ? it.total_price : qty * unit
            );
            const testName = (it.tests?.test_name) || (it.packages?.package_name) || null;
            const commissionAmount = (itemTotal * commissionRate) / 100;
            commissionData.push({
              date: bill.bill_date,
              bill_no: bill.bill_no,
              patient_name: bill.patient_name,
              reference_name: bill.ref_by,
              test_name: testName,
              total_amount: itemTotal,
              commission_rate: commissionRate,
              commission_amount: commissionAmount,
            });
          });
        } else {
          const total = parseFloat(bill.final_amount || 0);
          const commissionAmount = (total * commissionRate) / 100;
          commissionData.push({
            date: bill.bill_date,
            bill_no: bill.bill_no,
            patient_name: bill.patient_name,
            reference_name: bill.ref_by,
            test_name: null,
            total_amount: total,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
          });
        }
      });

      console.log(
        `Commission data: Found ${commissionData.length} bills with references`
      );
      return commissionData;
    } catch (error) {
      console.error("Error getting commission report:", error);
      return this.getSampleCommissionData();
    }
  }

  // Sample data methods for offline mode
  getSampleDailySalesData() {
    return [
      {
        id: 1,
        bill_no: "B001",
        bill_date: new Date().toISOString(),
        patient_name: "John Doe",
        final_amount: 1500.0,
        status: "paid",
        centers: { center_name: "Main Lab" },
        ref_by: "Dr. Smith",
        bill_items: [
          { quantity: 1, unit_price: 800, total_price: 800, tests: { test_name: "FBC" } },
          { quantity: 1, unit_price: 700, total_price: 700, tests: { test_name: "CRP" } }
        ],
      },
      {
        id: 2,
        bill_no: "B002",
        bill_date: new Date().toISOString(),
        patient_name: "Jane Smith",
        final_amount: 2000.0,
        status: "paid",
        centers: { center_name: "Branch Lab" },
        ref_by: "Dr. Johnson",
        bill_items: [
          { quantity: 1, unit_price: 1200, total_price: 1200, tests: { test_name: "LFT" } },
          { quantity: 1, unit_price: 800, total_price: 800, packages: { package_name: "Wellness Panel" } }
        ],
      },
    ];
  }

  getSampleMonthlySalesData() {
    return [
      {
        month: "January 2024",
        total_bills: 45,
        total_amount: 67500.0,
      },
      {
        month: "February 2024",
        total_bills: 38,
        total_amount: 57000.0,
      },
    ];
  }

  getSampleCenterWiseData() {
    return [
      {
        center_name: "Main Lab",
        total_bills: 25,
        total_amount: 37500.0,
      },
      {
        center_name: "Branch Lab",
        total_bills: 18,
        total_amount: 27000.0,
      },
    ];
  }

  getSampleCommissionData() {
    return [
      {
        date: new Date().toISOString(),
        bill_no: "B001",
        patient_name: "John Doe",
        reference_name: "Dr. Smith",
        test_name: "FBC",
        total_amount: 800.0,
        commission_rate: 10,
        commission_amount: 80.0,
      },
      {
        date: new Date().toISOString(),
        bill_no: "B001",
        patient_name: "John Doe",
        reference_name: "Dr. Smith",
        test_name: "CRP",
        total_amount: 700.0,
        commission_rate: 10,
        commission_amount: 70.0,
      },
    ];
  }

  // Get sales summary for dashboard
  async getSalesSummary() {
    try {
      if (!this.isSupabaseAvailable()) {
        return {
          today_sales: 0,
          today_bills: 0,
          monthly_sales: 0,
          monthly_bills: 0,
        };
      }

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

      const startOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      ).toISOString();
      const endOfMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
        23,
        59,
        59
      ).toISOString();

      // Get today's data
      const { data: todayBills, error: todayError } = await this.supabase
        .from("bills")
        .select("final_amount")
        .gte("bill_date", startOfDay)
        .lte("bill_date", endOfDay);

      // Get month's data
      const { data: monthBills, error: monthError } = await this.supabase
        .from("bills")
        .select("final_amount")
        .gte("bill_date", startOfMonth)
        .lte("bill_date", endOfMonth);

      if (todayError || monthError) {
        console.error("Error getting sales summary:", todayError || monthError);
        throw todayError || monthError;
      }

      const todaySales = todayBills.reduce(
        (sum, bill) => sum + parseFloat(bill.final_amount || 0),
        0
      );
      const monthlySales = monthBills.reduce(
        (sum, bill) => sum + parseFloat(bill.final_amount || 0),
        0
      );

      return {
        today_sales: todaySales,
        today_bills: todayBills.length,
        monthly_sales: monthlySales,
        monthly_bills: monthBills.length,
      };
    } catch (error) {
      console.error("Error getting sales summary:", error);
      return {
        today_sales: 0,
        today_bills: 0,
        monthly_sales: 0,
        monthly_bills: 0,
      };
    }
  }
}

// Export the service
window.ReportsService = ReportsService;
