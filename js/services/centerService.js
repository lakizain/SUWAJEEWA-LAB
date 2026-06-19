// Center Management Service - Handles all center related operations
class CenterService {
  constructor() {
    this.supabase = window.SUPABASE_CONFIG?.supabase || null;
    this.DB_SCHEMA = window.SUPABASE_CONFIG?.DB_SCHEMA || null;

    if (!this.supabase) {
      console.warn("CenterService initialized without Supabase connection");
    }
    this._centersDropdownCache = { data: null, ts: 0 };
  }

  // Check if Supabase is available
  isSupabaseAvailable() {
    return this.supabase !== null;
  }

  // Generate unique CID
  async generateCID() {
    if (!this.isSupabaseAvailable()) {
      const timestamp = Date.now().toString().slice(-6);
      return `CID${timestamp}`;
    }

    try {
      const { data: allCIDs, error } = await this.supabase
        .from("centers")
        .select("cid");

      if (error) throw error;

      // Find the highest CID number
      let maxNumber = 0;
      if (allCIDs && allCIDs.length > 0) {
        allCIDs.forEach((row) => {
          const num = parseInt(row.cid.replace("CID", ""));
          if (!isNaN(num) && num > maxNumber) maxNumber = num;
        });
      }

      return `CID${(maxNumber + 1).toString().padStart(3, "0")}`;
    } catch (error) {
      console.error("Error generating CID:", error);
      const timestamp = Date.now().toString().slice(-6);
      return `CID${timestamp}`;
    }
  }

  // Create new center
  async createCenter(centerData) {
    try {
      const cid = await this.generateCID();

      const centerPayload = {
        cid: cid,
        center_name: centerData.center_name,
        is_active: centerData.is_active || true,
      };

      const { data: center, error } = await this.supabase
        .from("centers")
        .insert(centerPayload)
        .select()
        .single();

      if (error) throw error;
      return center;
    } catch (error) {
      console.error("Error creating center:", error);
      throw error;
    }
  }

  // Get all centers
  async getAllCenters() {
    try {
      const { data: centers, error } = await this.supabase
        .from("centers")
        .select("*")
        .order("center_name", { ascending: true });

      if (error) throw error;
      return centers;
    } catch (error) {
      console.error("Error getting centers:", error);
      throw error;
    }
  }

  async getCentersForDropdown() {
    try {
      if (!this.isSupabaseAvailable()) {
        return this.getActiveCenters();
      }

      const now = Date.now();
      if (this._centersDropdownCache.data && now - this._centersDropdownCache.ts < 60000) {
        return this._centersDropdownCache.data;
      }

      const { data: centers, error } = await this.supabase
        .from("centers")
        .select("id, center_name")
        .eq("is_active", true)
        .order("center_name", { ascending: true });

      if (error) throw error;
      this._centersDropdownCache = { data: centers || [], ts: now };
      return centers || [];
    } catch (error) {
      console.error("Error getting centers for dropdown:", error);
      return this.getActiveCenters();
    }
  }

  // Get active centers
  async getActiveCenters() {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log("Supabase not available, returning sample centers");
        return [
          {
            id: "sample-1",
            center_name: "KURUNEGALA CENTER",
            cid: "CID001",
            is_active: true,
          },
          {
            id: "sample-2",
            center_name: "COLOMBO CENTER",
            cid: "CID002",
            is_active: true,
          },
          {
            id: "sample-3",
            center_name: "KANDY CENTER",
            cid: "CID003",
            is_active: true,
          },
        ];
      }

      const { data: centers, error } = await this.supabase
        .from("centers")
        .select("*")
        .eq("is_active", true)
        .order("center_name", { ascending: true });

      if (error) throw error;
      return centers || [];
    } catch (error) {
      console.error("Error getting active centers:", error);
      // Return sample data on error
      return [
        {
          id: "sample-1",
          center_name: "KURUNEGALA CENTER",
          cid: "CID001",
          is_active: true,
        },
        {
          id: "sample-2",
          center_name: "COLOMBO CENTER",
          cid: "CID002",
          is_active: true,
        },
        {
          id: "sample-3",
          center_name: "KANDY CENTER",
          cid: "CID003",
          is_active: true,
        },
      ];
    }
  }

  // Get center by ID
  async getCenterById(centerId) {
    try {
      const { data: center, error } = await this.supabase
        .from("centers")
        .select("*")
        .eq("id", centerId)
        .single();

      if (error) throw error;
      return center;
    } catch (error) {
      console.error("Error getting center:", error);
      throw error;
    }
  }

  // Get center by CID
  async getCenterByCID(cid) {
    try {
      const { data: center, error } = await this.supabase
        .from("centers")
        .select("*")
        .eq("cid", cid)
        .single();

      if (error) throw error;
      return center;
    } catch (error) {
      console.error("Error getting center by CID:", error);
      throw error;
    }
  }

  // Search centers
  async searchCenters(searchTerm) {
    try {
      const { data: centers, error } = await this.supabase
        .from("centers")
        .select("*")
        .or(`center_name.ilike.%${searchTerm}%,cid.ilike.%${searchTerm}%`)
        .order("center_name", { ascending: true });

      if (error) throw error;
      return centers;
    } catch (error) {
      console.error("Error searching centers:", error);
      throw error;
    }
  }

  // Update center
  async updateCenter(centerId, updateData) {
    try {
      const { data: center, error } = await this.supabase
        .from("centers")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", centerId)
        .select()
        .single();

      if (error) throw error;
      return center;
    } catch (error) {
      console.error("Error updating center:", error);
      throw error;
    }
  }

  // Delete center
  async deleteCenter(centerId) {
    try {
      // Check if center has any associated bills
      const { data: bills, error: billsError } = await this.supabase
        .from("bills")
        .select("id")
        .eq("center_id", centerId)
        .limit(1);

      if (billsError) throw billsError;

      if (bills && bills.length > 0) {
        throw new Error("Cannot delete center with associated bills");
      }

      const { error } = await this.supabase
        .from("centers")
        .delete()
        .eq("id", centerId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting center:", error);
      throw error;
    }
  }

  // Toggle center status
  async toggleCenterStatus(centerId) {
    try {
      const center = await this.getCenterById(centerId);
      const newStatus = !center.is_active;

      return await this.updateCenter(centerId, { is_active: newStatus });
    } catch (error) {
      console.error("Error toggling center status:", error);
      throw error;
    }
  }

  // Get center statistics
  async getCenterStats() {
    try {
      const { data: centers, error } = await this.supabase
        .from("centers")
        .select("is_active");

      if (error) throw error;

      const stats = {
        total: centers.length,
        active: centers.filter((center) => center.is_active).length,
        inactive: centers.filter((center) => !center.is_active).length,
      };

      return stats;
    } catch (error) {
      console.error("Error getting center stats:", error);
      throw error;
    }
  }

  // Get center performance (bills generated)
  async getCenterPerformance(centerId, startDate, endDate) {
    try {
      const { data: bills, error } = await this.supabase
        .from("bills")
        .select("final_amount, bill_date, status")
        .eq("center_id", centerId)
        .gte("bill_date", startDate)
        .lte("bill_date", endDate)
        .order("bill_date", { ascending: false });

      if (error) throw error;

      const performance = {
        totalBills: bills.length,
        totalAmount: bills.reduce((sum, bill) => sum + bill.final_amount, 0),
        averageAmount:
          bills.length > 0
            ? bills.reduce((sum, bill) => sum + bill.final_amount, 0) /
              bills.length
            : 0,
        paidBills: bills.filter((bill) => bill.status === "paid").length,
        pendingBills: bills.filter((bill) => bill.status === "pending").length,
        bills: bills,
      };

      return performance;
    } catch (error) {
      console.error("Error getting center performance:", error);
      throw error;
    }
  }

  // Get all centers with performance data
  async getCentersWithPerformance(startDate, endDate) {
    try {
      const centers = await this.getAllCenters();
      const centersWithPerformance = [];

      for (const center of centers) {
        const performance = await this.getCenterPerformance(
          center.id,
          startDate,
          endDate
        );
        centersWithPerformance.push({
          ...center,
          performance,
        });
      }

      return centersWithPerformance;
    } catch (error) {
      console.error("Error getting centers with performance:", error);
      throw error;
    }
  }

  // Get top performing centers
  async getTopPerformingCenters(limit = 5, startDate, endDate) {
    try {
      const centersWithPerformance = await this.getCentersWithPerformance(
        startDate,
        endDate
      );

      return centersWithPerformance
        .sort((a, b) => b.performance.totalAmount - a.performance.totalAmount)
        .slice(0, limit);
    } catch (error) {
      console.error("Error getting top performing centers:", error);
      throw error;
    }
  }

  // Bulk update center status
  async bulkUpdateCenterStatus(centerIds, newStatus) {
    try {
      const { data: centers, error } = await this.supabase
        .from("centers")
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .in("id", centerIds)
        .select();

      if (error) throw error;
      return centers;
    } catch (error) {
      console.error("Error bulk updating center status:", error);
      throw error;
    }
  }

  // Get center by name (for dropdowns)
  async getCenterByName(centerName) {
    try {
      const { data: center, error } = await this.supabase
        .from("centers")
        .select("*")
        .eq("center_name", centerName)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return center;
    } catch (error) {
      console.error("Error getting center by name:", error);
      throw error;
    }
  }
}

// Export the service
window.CenterService = CenterService;
