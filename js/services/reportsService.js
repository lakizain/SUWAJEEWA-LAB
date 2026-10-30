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
    referenceName = null,
    centerId = null
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
          center_id,
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

      if (centerId && centerId !== "all") {
        query = query.eq("center_id", centerId);
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

  async getTestCostProfitReport(fromDate = null, toDate = null, centerId = null) {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log("Supabase not available, returning sample test cost report");
        return this.buildTestCostProfitReport([
          {
            id: "sample-1",
            bill_date: new Date().toISOString(),
            final_amount: 1500,
            status: "paid",
            bill_items: [
              {
                quantity: 1,
                unit_price: 800,
                total_price: 800,
                is_package_component: false,
                tests: { id: "sample-fbc", test_name: "FBC", test_cost: 200 },
              },
              {
                quantity: 1,
                unit_price: 700,
                total_price: 700,
                is_package_component: false,
                tests: { id: "sample-crp", test_name: "CRP", test_cost: 280 },
              },
            ],
          },
        ]);
      }

      const pageSize = 1000;
      const bills = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = this.supabase
          .from("bills")
          .select(
            `
            id,
            bill_date,
            center_id,
            final_amount,
            status,
            bill_items(
              test_id,
              package_id,
              quantity,
              unit_price,
              total_price,
              is_package_component,
              tests(test_name, test_cost),
              packages(package_name)
            )
          `
          )
          .neq("status", "cancelled")
          .order("bill_date", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (fromDate) {
          query = query.gte(
            "bill_date",
            new Date(fromDate + "T00:00:00").toISOString()
          );
        }
        if (toDate) {
          query = query.lte(
            "bill_date",
            new Date(toDate + "T23:59:59").toISOString()
          );
        }
        if (centerId && centerId !== "all") {
          query = query.eq("center_id", centerId);
        }

        const { data, error } = await query;
        if (error) throw error;

        bills.push(...(data || []));
        hasMore = (data || []).length === pageSize;
        offset += pageSize;
      }

      return this.buildTestCostProfitReport(bills);
    } catch (error) {
      console.error("Error getting test cost and profit report:", error);
      throw error;
    }
  }

  buildTestCostProfitReport(bills) {
    const itemTotals = new Map();
    const billIds = new Set();
    let totalRevenue = 0;
    let totalCost = 0;
    let missingCostItems = 0;

    const getNumber = (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    const getRelation = (relation) =>
      Array.isArray(relation) ? relation[0] || null : relation || null;
    const addItem = (key, item) => {
      if (!itemTotals.has(key)) {
        itemTotals.set(key, {
          item_type: item.item_type,
          item_name: item.item_name,
          quantity: 0,
          revenue: 0,
          cost: 0,
          missing_cost_quantity: 0,
        });
      }
      return itemTotals.get(key);
    };

    (bills || []).forEach((bill, billIndex) => {
      if (bill.status === "cancelled") return;
      billIds.add(bill.id || `bill-${billIndex}`);

      const billItems = Array.isArray(bill.bill_items) ? bill.bill_items : [];
      const saleItems = billItems.filter((item) => !item.is_package_component);
      const lineTotals = saleItems.map((item) => {
        const quantity = Math.max(0, getNumber(item.quantity, 1));
        const unitPrice = getNumber(item.unit_price);
        const totalPrice =
          item.total_price === null || item.total_price === undefined
            ? quantity * unitPrice
            : getNumber(item.total_price);
        return { item, quantity, totalPrice };
      });
      const subtotal = lineTotals.reduce(
        (sum, line) => sum + line.totalPrice,
        0
      );
      const billedAmount = Math.max(0, getNumber(bill.final_amount));
      const revenueScale = subtotal > 0 ? billedAmount / subtotal : 0;
      const packageRows = new Map();

      lineTotals.forEach(({ item, quantity, totalPrice }, lineIndex) => {
        const revenue =
          lineIndex === lineTotals.length - 1 && subtotal > 0
            ? billedAmount -
              lineTotals
                .slice(0, lineIndex)
                .reduce((sum, line) => sum + line.totalPrice * revenueScale, 0)
            : totalPrice * revenueScale;
        totalRevenue += revenue;

        const test = getRelation(item.tests);
        const packageData = getRelation(item.packages);
        if (item.test_id || test) {
          const itemName = test?.test_name || "Unknown test";
          const key = `test:${item.test_id || itemName}`;
          const row = addItem(key, {
            item_type: "Test",
            item_name: itemName,
          });
          row.quantity += quantity;
          row.revenue += revenue;

          const testCost =
            test?.test_cost === null ||
            test?.test_cost === undefined ||
            test?.test_cost === ""
              ? null
              : getNumber(test.test_cost, null);
          if (testCost === null) {
            row.missing_cost_quantity += quantity;
            missingCostItems += quantity;
          } else {
            const cost = testCost * quantity;
            row.cost += cost;
            totalCost += cost;
          }
        } else if (item.package_id || packageData) {
          const itemName = packageData?.package_name || "Unknown package";
          const key = `package:${item.package_id || itemName}`;
          const row = addItem(key, {
            item_type: "Package",
            item_name: itemName,
          });
          row.quantity += quantity;
          row.revenue += revenue;
          packageRows.set(`${item.package_id || itemName}`, {
            row,
            componentCount: 0,
            quantity,
          });
        } else {
          const key = `unallocated:${bill.id || billIndex}`;
          const row = addItem(key, {
            item_type: "Unallocated",
            item_name: "Unallocated bill item",
          });
          row.quantity += quantity;
          row.revenue += revenue;
          row.missing_cost_quantity += quantity;
          missingCostItems += quantity;
        }
      });

      billItems
        .filter((item) => item.is_package_component)
        .forEach((item) => {
          const test = getRelation(item.tests);
          const packageData = getRelation(item.packages);
          const packageKey = item.package_id || packageData?.id;
          const packageRow = packageRows.get(String(packageKey));
          const quantity = Math.max(0, getNumber(item.quantity, 1));

          if (!packageRow) {
            const key = `unallocated-cost:${bill.id || billIndex}:${packageKey || "unknown"}`;
            const row = addItem(key, {
              item_type: "Unallocated",
              item_name: "Package test cost without package sale",
            });
            row.quantity += quantity;
            const testCost =
              test?.test_cost === null ||
              test?.test_cost === undefined ||
              test?.test_cost === ""
                ? null
                : getNumber(test.test_cost, null);
            if (testCost === null) {
              row.missing_cost_quantity += quantity;
              missingCostItems += quantity;
            } else {
              const cost = testCost * quantity;
              row.cost += cost;
              totalCost += cost;
            }
            return;
          }

          packageRow.componentCount += 1;
          if (!test) {
            packageRow.row.missing_cost_quantity += quantity;
            missingCostItems += quantity;
            return;
          }

          const testCost =
            test.test_cost === null ||
            test.test_cost === undefined ||
            test.test_cost === ""
              ? null
              : getNumber(test.test_cost, null);
          if (testCost === null) {
            packageRow.row.missing_cost_quantity += quantity;
            missingCostItems += quantity;
          } else {
            const cost = testCost * quantity;
            packageRow.row.cost += cost;
            totalCost += cost;
          }
        });

      packageRows.forEach((packageRow) => {
        if (packageRow.componentCount === 0) {
          packageRow.row.missing_cost_quantity += packageRow.quantity;
          missingCostItems += packageRow.quantity;
        }
      });

      if (subtotal <= 0 && billedAmount > 0) {
        const key = `unallocated:${bill.id || billIndex}`;
        const row = addItem(key, {
          item_type: "Unallocated",
          item_name: "Bill amount without item details",
        });
        row.quantity += 1;
        row.revenue += billedAmount;
        row.missing_cost_quantity += 1;
        missingCostItems += 1;
        totalRevenue += billedAmount;
      }
    });

    const rows = Array.from(itemTotals.values())
      .map((row) => {
        const profit = row.revenue - row.cost;
        return {
          ...row,
          profit,
          profit_margin: row.revenue > 0 ? (profit / row.revenue) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
    const estimatedProfit = totalRevenue - totalCost;

    return {
      total_bills: billIds.size,
      total_revenue: totalRevenue,
      total_cost: totalCost,
      estimated_profit: missingCostItems > 0 ? null : estimatedProfit,
      profit_margin:
        missingCostItems > 0
          ? null
          : totalRevenue > 0
            ? (estimatedProfit / totalRevenue) * 100
            : 0,
      missing_cost_items: missingCostItems,
      rows,
    };
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
