// Reference Management Service - Handles all reference/doctor related operations
class ReferenceService {
  constructor() {
    this.supabase = window.SUPABASE_CONFIG?.supabase || null;
    this.DB_SCHEMA = window.SUPABASE_CONFIG?.DB_SCHEMA || null;

    if (!this.supabase) {
      console.warn("ReferenceService initialized without Supabase connection");
    }
    this._referencesDropdownCache = { data: null, ts: 0 };
  }

  // Check if Supabase is available
  isSupabaseAvailable() {
    return this.supabase !== null;
  }

  // Generate unique RID
  async generateRID() {
    if (!this.isSupabaseAvailable()) {
      const timestamp = Date.now().toString().slice(-6);
      return `RID${timestamp}`;
    }

    try {
      const { data: lastReference, error } = await this.supabase
        .from("references")
        .select("rid")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (lastReference && lastReference.length > 0) {
        const lastRID = lastReference[0].rid;
        const lastNumber = parseInt(lastRID.replace("RID", ""));
        nextNumber = lastNumber + 1;
      }

      return `RID${nextNumber.toString().padStart(3, "0")}`;
    } catch (error) {
      console.error("Error generating RID:", error);
      const timestamp = Date.now().toString().slice(-6);
      return `RID${timestamp}`;
    }
  }

  async getReferencesForDropdown() {
    try {
      if (!this.isSupabaseAvailable()) {
        return this.getActiveReferences();
      }

      const now = Date.now();
      if (this._referencesDropdownCache.data && now - this._referencesDropdownCache.ts < 60000) {
        return this._referencesDropdownCache.data;
      }

      const { data: references, error } = await this.supabase
        .from("references")
        .select("id, name, rid")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      this._referencesDropdownCache = { data: references || [], ts: now };
      return references || [];
    } catch (error) {
      console.error("Error getting references for dropdown:", error);
      return this.getActiveReferences();
    }
  }

  // Create new reference
  async createReference(referenceData) {
    try {
      const rid = await this.generateRID();

      const referencePayload = {
        rid: rid,
        name: referenceData.name,
        commission: parseFloat(referenceData.commission) || 0,
        is_active: referenceData.is_active || true,
      };

      const { data: reference, error } = await this.supabase
        .from("references")
        .insert(referencePayload)
        .select()
        .single();

      if (error) throw error;
      return reference;
    } catch (error) {
      console.error("Error creating reference:", error);
      throw error;
    }
  }

  // Get all references
  async getAllReferences() {
    try {
      const { data: references, error } = await this.supabase
        .from("references")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return references;
    } catch (error) {
      console.error("Error getting references:", error);
      throw error;
    }
  }

  // Get active references
  async getActiveReferences() {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log("Supabase not available, returning sample references");
        return [
          {
            id: "sample-1",
            name: "DR M AMUNUGAMA",
            rid: "RID001",
            commission: 5.0,
            is_active: true,
          },
          {
            id: "sample-2",
            name: "DR S PERERA",
            rid: "RID002",
            commission: 3.5,
            is_active: true,
          },
          {
            id: "sample-3",
            name: "DR J SILVA",
            rid: "RID003",
            commission: 4.0,
            is_active: true,
          },
        ];
      }

      const { data: references, error } = await this.supabase
        .from("references")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return references || [];
    } catch (error) {
      console.error("Error getting active references:", error);
      // Return sample data on error
      return [
        {
          id: "sample-1",
          name: "DR M AMUNUGAMA",
          rid: "RID001",
          commission: 5.0,
          is_active: true,
        },
        {
          id: "sample-2",
          name: "DR S PERERA",
          rid: "RID002",
          commission: 3.5,
          is_active: true,
        },
        {
          id: "sample-3",
          name: "DR J SILVA",
          rid: "RID003",
          commission: 4.0,
          is_active: true,
        },
      ];
    }
  }

  // Get reference by ID
  async getReferenceById(referenceId) {
    try {
      const { data: reference, error } = await this.supabase
        .from("references")
        .select("*")
        .eq("id", referenceId)
        .single();

      if (error) throw error;
      return reference;
    } catch (error) {
      console.error("Error getting reference:", error);
      throw error;
    }
  }

  // Get reference by RID
  async getReferenceByRID(rid) {
    try {
      const { data: reference, error } = await this.supabase
        .from("references")
        .select("*")
        .eq("rid", rid)
        .single();

      if (error) throw error;
      return reference;
    } catch (error) {
      console.error("Error getting reference by RID:", error);
      throw error;
    }
  }

  // Search references
  async searchReferences(searchTerm) {
    try {
      const { data: references, error } = await this.supabase
        .from("references")
        .select("*")
        .or(`name.ilike.%${searchTerm}%,rid.ilike.%${searchTerm}%`)
        .order("name", { ascending: true });

      if (error) throw error;
      return references;
    } catch (error) {
      console.error("Error searching references:", error);
      throw error;
    }
  }

  // Update reference
  async updateReference(referenceId, updateData) {
    try {
      const { data: reference, error } = await this.supabase
        .from("references")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", referenceId)
        .select()
        .single();

      if (error) throw error;
      return reference;
    } catch (error) {
      console.error("Error updating reference:", error);
      throw error;
    }
  }

  // Delete reference
  async deleteReference(referenceId) {
    try {
      const { error } = await this.supabase
        .from("references")
        .delete()
        .eq("id", referenceId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting reference:", error);
      throw error;
    }
  }

  // Toggle reference status
  async toggleReferenceStatus(referenceId) {
    try {
      const reference = await this.getReferenceById(referenceId);
      const newStatus = !reference.is_active;

      return await this.updateReference(referenceId, { is_active: newStatus });
    } catch (error) {
      console.error("Error toggling reference status:", error);
      throw error;
    }
  }

  // Get reference statistics
  async getReferenceStats() {
    try {
      const { data: references, error } = await this.supabase
        .from("references")
        .select("is_active, commission");

      if (error) throw error;

      const stats = {
        total: references.length,
        active: references.filter((ref) => ref.is_active).length,
        inactive: references.filter((ref) => !ref.is_active).length,
        totalCommission: references.reduce(
          (sum, ref) => sum + (ref.commission || 0),
          0
        ),
        avgCommission:
          references.length > 0
            ? references.reduce((sum, ref) => sum + (ref.commission || 0), 0) /
              references.length
            : 0,
      };

      return stats;
    } catch (error) {
      console.error("Error getting reference stats:", error);
      throw error;
    }
  }

  // Get references by commission range
  async getReferencesByCommissionRange(minCommission, maxCommission) {
    try {
      const { data: references, error } = await this.supabase
        .from("references")
        .select("*")
        .gte("commission", minCommission)
        .lte("commission", maxCommission)
        .order("commission", { ascending: true });

      if (error) throw error;
      return references;
    } catch (error) {
      console.error("Error getting references by commission range:", error);
      throw error;
    }
  }

  // Get top references by commission
  async getTopReferencesByCommission(limit = 10) {
    try {
      const { data: references, error } = await this.supabase
        .from("references")
        .select("*")
        .order("commission", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return references;
    } catch (error) {
      console.error("Error getting top references by commission:", error);
      throw error;
    }
  }

  // Bulk update commission
  async bulkUpdateCommission(referenceIds, newCommission) {
    try {
      const { data: references, error } = await this.supabase
        .from("references")
        .update({
          commission: newCommission,
          updated_at: new Date().toISOString(),
        })
        .in("id", referenceIds)
        .select();

      if (error) throw error;
      return references;
    } catch (error) {
      console.error("Error bulk updating commission:", error);
      throw error;
    }
  }

  // Get reference performance (bills referred)
  async getReferencePerformance(referenceId, startDate, endDate) {
    try {
      const { data: bills, error } = await this.supabase
        .from("bills")
        .select("final_amount, bill_date")
        .eq("ref_by", referenceId)
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
        bills: bills,
      };

      return performance;
    } catch (error) {
      console.error("Error getting reference performance:", error);
      throw error;
    }
  }
}

// Export the service
window.ReferenceService = ReferenceService;
