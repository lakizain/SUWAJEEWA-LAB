// Test Management Service - Handles all test related operations
class TestService {
  constructor() {
    this.supabase = window.SUPABASE_CONFIG?.supabase || null;
    this.DB_SCHEMA = window.SUPABASE_CONFIG?.DB_SCHEMA || null;

    console.log("TestService initialized");
    console.log("Supabase available:", !!this.supabase);
    console.log("SUPABASE_CONFIG:", window.SUPABASE_CONFIG);

    if (!this.supabase) {
      console.warn("TestService initialized without Supabase connection");
    }
  }

  // Check if Supabase is available
  isSupabaseAvailable() {
    return this.supabase !== null;
  }

  // Create new test
  async createTest(testData) {
    if (!this.isSupabaseAvailable()) {
      console.warn("Creating test in offline mode");
      return {
        id: Date.now(),
        ...testData,
        price: parseFloat(testData.price),
        duration: testData.duration,
        test_cost: testData.test_cost,
        is_active: testData.is_active || true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    try {
      const testPayload = {
        test_name: testData.test_name,
        short_name: testData.short_name,
        price: parseFloat(testData.price),
        duration: testData.duration,
        test_cost: testData.test_cost,
        remarks: testData.remarks,
        specimen: testData.specimen,
        tube: testData.tube,
        category: testData.category,
        footer_text: testData.footer_text,
        is_active: testData.is_active || true,
        decimal_places: testData.decimal_places || 2,
      };

      const { data: test, error } = await this.supabase
        .from("tests")
        .insert(testPayload)
        .select()
        .single();

      if (error) throw error;
      return test;
    } catch (error) {
      console.error("Error creating test:", error);
      throw error;
    }
  }

  // Get all tests
  async getAllTests() {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log("Supabase not available, returning sample tests");
        return [
          {
            id: "sample-1",
            test_name: "FULL BLOOD COUNT",
            short_name: "FBC",
            price: 500.0,
            duration: 30,
            test_cost: 200.0,
            is_active: true,
            remarks: "Complete blood count test",
            specimen: "Blood",
            tube: "Purple Top",
            category: "Hematology",
          },
          {
            id: "sample-2",
            test_name: "LIPID PROFILE",
            short_name: "LP",
            price: 800.0,
            duration: 45,
            test_cost: 350.0,
            is_active: true,
            remarks: "Cholesterol and lipid analysis",
            specimen: "Blood",
            tube: "Red Top",
            category: "Biochemistry",
          },
          {
            id: "sample-3",
            test_name: "LIVER FUNCTION TEST",
            short_name: "LFT",
            price: 600.0,
            duration: 60,
            test_cost: 280.0,
            is_active: true,
            remarks: "Liver enzyme analysis",
            specimen: "Blood",
            tube: "Red Top",
            category: "Biochemistry",
          },
        ];
      }

      const { data: tests, error } = await this.supabase
        .from("tests")
        .select("*")
        .order("test_name", { ascending: true });

      if (error) throw error;
      return tests || [];
    } catch (error) {
      console.error("Error getting tests:", error);
      // Return sample data on error
      return [
        {
          id: "sample-1",
          test_name: "FULL BLOOD COUNT",
          short_name: "FBC",
          price: 500.0,
          duration: 30,
          test_cost: 200.0,
          is_active: true,
          remarks: "Complete blood count test",
          specimen: "Blood",
          tube: "Purple Top",
          category: "Hematology",
        },
        {
          id: "sample-2",
          test_name: "LIPID PROFILE",
          short_name: "LP",
          price: 800.0,
          duration: 45,
          test_cost: 350.0,
          is_active: true,
          remarks: "Cholesterol and lipid analysis",
          specimen: "Blood",
          tube: "Red Top",
          category: "Biochemistry",
        },
        {
          id: "sample-3",
          test_name: "LIVER FUNCTION TEST",
          short_name: "LFT",
          price: 600.0,
          duration: 60,
          test_cost: 280.0,
          is_active: true,
          remarks: "Liver enzyme analysis",
          specimen: "Blood",
          tube: "Red Top",
          category: "Biochemistry",
        },
      ];
    }
  }

  // Get active tests
  async getActiveTests() {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log("Supabase not available, returning sample tests");
        return [
          {
            id: "sample-1",
            test_name: "FULL BLOOD COUNT",
            short_name: "FBC",
            price: 500.0,
            duration: 30,
            test_cost: 200.0,
            is_active: true,
          },
          {
            id: "sample-2",
            test_name: "LIPID PROFILE",
            short_name: "LP",
            price: 800.0,
            duration: 45,
            test_cost: 350.0,
            is_active: true,
          },
          {
            id: "sample-3",
            test_name: "LIVER FUNCTION TEST",
            short_name: "LFT",
            price: 600.0,
            duration: 60,
            test_cost: 280.0,
            is_active: true,
          },
        ];
      }

      const { data: tests, error } = await this.supabase
        .from("tests")
        .select("*")
        .eq("is_active", true)
        .order("test_name", { ascending: true });

      if (error) throw error;
      return tests || [];
    } catch (error) {
      console.error("Error getting active tests:", error);
      // Return sample data on error
      return [
        {
          id: "sample-1",
          test_name: "FULL BLOOD COUNT",
          short_name: "FBC",
          price: 500.0,
          duration: 30,
          test_cost: 200.0,
          is_active: true,
        },
        {
          id: "sample-2",
          test_name: "LIPID PROFILE",
          short_name: "LP",
          price: 800.0,
          duration: 45,
          test_cost: 350.0,
          is_active: true,
        },
        {
          id: "sample-3",
          test_name: "LIVER FUNCTION TEST",
          short_name: "LFT",
          price: 600.0,
          duration: 60,
          test_cost: 280.0,
          is_active: true,
        },
      ];
    }
  }

  // Get test by ID
  async getTestById(testId) {
    try {
      const { data: test, error } = await this.supabase
        .from("tests")
        .select(
          `
                    *,
                    test_subcategories (*),
                    reference_ranges (*)
                `
        )
        .eq("id", testId)
        .single();

      if (error) throw error;
      return test;
    } catch (error) {
      console.error("Error getting test:", error);
      throw error;
    }
  }

  // Search tests
  async searchTests(searchTerm) {
    try {
      // Split searchTerm into words and build a dynamic or() query for each word
      const words = searchTerm.trim().split(/\s+/).filter(Boolean);
      let orQuery = words
        .map((word) => `test_name.ilike.%${word}%,short_name.ilike.%${word}%`)
        .join(",");
      if (!orQuery) {
        orQuery = `test_name.ilike.%${searchTerm}%,short_name.ilike.%${searchTerm}%`;
      }
      const { data: tests, error } = await this.supabase
        .from("tests")
        .select("*")
        .or(orQuery)
        .order("test_name", { ascending: true });
      if (error) throw error;
      // Debug log
      console.log(
        "[searchTests] searchTerm:",
        searchTerm,
        "orQuery:",
        orQuery,
        "results:",
        tests
      );
      return tests;
    } catch (error) {
      console.error("Error searching tests:", error);
      throw error;
    }
  }

  // Update test
  async updateTest(testId, updateData) {
    try {
      const { data: test, error } = await this.supabase
        .from("tests")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", testId)
        .select()
        .single();

      if (error) throw error;
      return test;
    } catch (error) {
      console.error("Error updating test:", error);
      throw error;
    }
  }

  // Delete test
  async deleteTest(testId) {
    try {
      // Remove bill_items referencing this test to allow DB delete
      {
        const { error: billItemsErr } = await this.supabase
          .from("bill_items")
          .delete()
          .eq("test_id", testId);
        if (billItemsErr) throw billItemsErr;
      }

      // Collect related subcategory ids
      const { data: subcategories, error: subErr } = await this.supabase
        .from("test_subcategories")
        .select("id")
        .eq("test_id", testId);

      if (subErr) throw subErr;

      const subcategoryIds = Array.isArray(subcategories)
        ? subcategories.map((s) => s.id)
        : [];

      // Delete suggestions linked to those subcategories (if any)
      if (subcategoryIds.length > 0) {
        const { error: suggErr } = await this.supabase
          .from("subcategory_suggestions")
          .delete()
          .in("subcategory_id", subcategoryIds);
        if (suggErr) throw suggErr;
      }

      // Delete reference ranges for this test
      {
        const { error: refErr } = await this.supabase
          .from("reference_ranges")
          .delete()
          .eq("test_id", testId);
        if (refErr) throw refErr;
      }

      // Delete subcategories for this test
      {
        const { error: delSubErr } = await this.supabase
          .from("test_subcategories")
          .delete()
          .eq("test_id", testId);
        if (delSubErr) throw delSubErr;
      }

      // Finally delete the test
      const { error: testErr } = await this.supabase
        .from("tests")
        .delete()
        .eq("id", testId);

      if (testErr) throw testErr;
      return true;
    } catch (error) {
      console.error("Error deleting test:", error);
      throw error;
    }
  }

  // Toggle test status
  async toggleTestStatus(testId) {
    try {
      const test = await this.getTestById(testId);
      const newStatus = !test.is_active;

      return await this.updateTest(testId, { is_active: newStatus });
    } catch (error) {
      console.error("Error toggling test status:", error);
      throw error;
    }
  }

  // Test Subcategories Management
  async addTestSubcategory(testId, subcategoryName, uom = null, extra = {}) {
    try {
      let name = (subcategoryName ?? "").trim();
      
      // Get current max sort_order for this test and also get test's default decimal places
      const [maxSortData, testData] = await Promise.all([
        this.supabase
          .from("test_subcategories")
          .select("sort_order")
          .eq("test_id", testId)
          .order("sort_order", { ascending: false })
          .limit(1),
        this.supabase
          .from("tests")
          .select("decimal_places")
          .eq("id", testId)
          .single()
      ]);
      
      let nextSortOrder = 1;
      if (!maxSortData.error && maxSortData.data && maxSortData.data.length > 0) {
        nextSortOrder = (maxSortData.data[0].sort_order || 0) + 1;
      }
      
      let decimalPlaces = 2;
      if (!testData.error && testData.data) {
        decimalPlaces = testData.data.decimal_places || 2;
      }
      
      // For blank/empty names, generate a unique name to allow multiple blank rows
      if (name === "") {
        // Find existing generated blank rows like "Blank Row N" and pick the next N
        const { data: existingBlanks, error: findError } = await this.supabase
          .from("test_subcategories")
          .select("subcategory_name")
          .eq("test_id", testId)
          .ilike("subcategory_name", "Blank Row %");

        if (findError) throw findError;

        let nextNumber = 1;
        if (Array.isArray(existingBlanks) && existingBlanks.length > 0) {
          const nums = existingBlanks
            .map((r) => {
              const m = /Blank Row\s+(\d+)/i.exec(r.subcategory_name || "");
              return m ? parseInt(m[1], 10) : null;
            })
            .filter((n) => Number.isInteger(n));
          if (nums.length > 0) {
            nextNumber = Math.max(...nums) + 1;
          }
        }
        name = `Blank Row ${nextNumber}`;
      } else {
        // For non-blank names, check if it already exists (avoid 409 conflict)
        const { data: existingList, error: findError } = await this.supabase
          .from("test_subcategories")
          .select("*")
          .eq("test_id", testId)
          .eq("subcategory_name", name)
          .limit(1);

        if (findError) throw findError;
        if (existingList && existingList.length > 0) {
          const existing = existingList[0];
          // If UOM provided and different/missing, update it so UI displays the saved UOM
          if (uom && existing.uom !== uom) {
            const { data: updated, error: updateError } = await this.supabase
              .from("test_subcategories")
              .update({ uom })
              .eq("id", existing.id)
              .select()
              .single();

            if (updateError) throw updateError;
            return updated;
          }
          return existing;
        }
      }

      const { data: subcategory, error } = await this.supabase
        .from("test_subcategories")
        .insert({
          test_id: testId,
          subcategory_name: name,
          uom: uom || null,
          less_more: extra?.less_more ?? null,
          less_more_comment: extra?.less_more_comment ?? null,
          less_more_mark: extra?.less_more_mark ?? null,
          sort_order: nextSortOrder,
          decimal_places: extra?.decimal_places ?? decimalPlaces,
        })
        .select()
        .single();

      if (error) throw error;
      return subcategory;
    } catch (error) {
      console.error("Error adding test subcategory:", error);
      throw error;
    }
  }

  async getTestSubcategories(testId) {
    try {
      const { data: subcategories, error } = await this.supabase
        .from("test_subcategories")
        .select("*")
        .eq("test_id", testId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return subcategories;
    } catch (error) {
      console.error("Error getting test subcategories:", error);
      throw error;
    }
  }

  async updateSubcategorySortOrders(testId, sortOrders) {
    try {
      // sortOrders is array of { id: subcategoryId, sort_order: number }
      const promises = sortOrders.map(item => 
        this.supabase
          .from("test_subcategories")
          .update({ sort_order: item.sort_order })
          .eq("id", item.id)
      );
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error("Error updating subcategory sort orders:", error);
      throw error;
    }
  }

  async deleteTestSubcategory(subcategoryId) {
    try {
      const { error } = await this.supabase
        .from("test_subcategories")
        .delete()
        .eq("id", subcategoryId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting test subcategory:", error);
      throw error;
    }
  }

  async updateTestSubcategory(subcategoryId, updateData) {
    try {
      const payload = {
        ...(updateData.subcategory_name !== undefined
          ? { subcategory_name: updateData.subcategory_name }
          : {}),
        ...(updateData.uom !== undefined ? { uom: updateData.uom } : {}),
        ...(updateData.less_more !== undefined ? { less_more: updateData.less_more } : {}),
        ...(updateData.less_more_comment !== undefined ? { less_more_comment: updateData.less_more_comment } : {}),
        ...(updateData.less_more_mark !== undefined ? { less_more_mark: updateData.less_more_mark } : {}),
        ...(updateData.decimal_places !== undefined ? { decimal_places: updateData.decimal_places } : {}),
      };

      if (payload.subcategory_name !== undefined && typeof payload.subcategory_name === "string") {
        payload.subcategory_name = payload.subcategory_name.trim();
      }

      if (payload.subcategory_name) {
        const { data: current, error: currentError } = await this.supabase
          .from("test_subcategories")
          .select("id,test_id,subcategory_name")
          .eq("id", subcategoryId)
          .single();
        if (currentError) throw currentError;

        if (
          current?.test_id &&
          payload.subcategory_name !== current.subcategory_name
        ) {
          const { data: existingList, error: findError } = await this.supabase
            .from("test_subcategories")
            .select("id")
            .eq("test_id", current.test_id)
            .eq("subcategory_name", payload.subcategory_name)
            .neq("id", subcategoryId)
            .limit(1);

          if (findError) throw findError;
          if (Array.isArray(existingList) && existingList.length > 0) {
            const duplicateError = new Error("Subcategory name already exists for this test.");
            duplicateError.code = "DUPLICATE_SUBCATEGORY_NAME";
            throw duplicateError;
          }
        }
      }
      const { data, error } = await this.supabase
        .from("test_subcategories")
        .update(payload)
        .eq("id", subcategoryId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error updating test subcategory:", error);
      throw error;
    }
  }

  // Subcategory Suggestions Management
  async addSubcategorySuggestion(subcategoryId, suggestionData) {
    try {
      const { data: suggestion, error } = await this.supabase
        .from("subcategory_suggestions")
        .insert({
          subcategory_id: subcategoryId,
          suggestion_text: suggestionData.suggestion_text,
          suggestion_type: suggestionData.suggestion_type || "general",
        })
        .select()
        .single();

      if (error) throw error;
      return suggestion;
    } catch (error) {
      console.error("Error adding subcategory suggestion:", error);
      throw error;
    }
  }

  async getSubcategorySuggestions(subcategoryId) {
    try {
      const { data: suggestions, error } = await this.supabase
        .from("subcategory_suggestions")
        .select("*")
        .eq("subcategory_id", subcategoryId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return suggestions;
    } catch (error) {
      console.error("Error getting subcategory suggestions:", error);
      throw error;
    }
  }

  async updateSubcategorySuggestion(suggestionId, updateData) {
    try {
      const { data: suggestion, error } = await this.supabase
        .from("subcategory_suggestions")
        .update(updateData)
        .eq("id", suggestionId)
        .select()
        .single();

      if (error) throw error;
      return suggestion;
    } catch (error) {
      console.error("Error updating subcategory suggestion:", error);
      throw error;
    }
  }

  async deleteSubcategorySuggestion(suggestionId) {
    try {
      const { error } = await this.supabase
        .from("subcategory_suggestions")
        .delete()
        .eq("id", suggestionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting subcategory suggestion:", error);
      throw error;
    }
  }

  // Reference Ranges Management
  async addReferenceRange(referenceData) {
    try {
      const { data: reference, error } = await this.supabase
        .from("reference_ranges")
        .insert({
          test_id: referenceData.test_id,
          subcategory_id: referenceData.subcategory_id || null,
          gender: referenceData.gender,
          age_min: referenceData.age_min,
          age_max: referenceData.age_max,
          min_value: referenceData.min_value,
          max_value: referenceData.max_value,
          unit: referenceData.unit,
        })
        .select()
        .single();

      if (error) throw error;
      return reference;
    } catch (error) {
      console.error("Error adding reference range:", error);
      throw error;
    }
  }

  async getReferenceRanges(testId, subcategoryId = null) {
    try {
      let query = this.supabase
        .from("reference_ranges")
        .select("*")
        .eq("test_id", testId);

      if (subcategoryId) {
        query = query.eq("subcategory_id", subcategoryId);
      } else {
        query = query.is("subcategory_id", null);
      }

      const { data: references, error } = await query.order("gender", {
        ascending: true,
      });

      if (error) throw error;
      return references;
    } catch (error) {
      console.error("Error getting reference ranges:", error);
      throw error;
    }
  }

  async getSubcategoryReferenceRanges(subcategoryId) {
    try {
      const { data: references, error } = await this.supabase
        .from("reference_ranges")
        .select("*")
        .eq("subcategory_id", subcategoryId)
        .order("gender", { ascending: true });

      if (error) throw error;
      return references;
    } catch (error) {
      console.error("Error getting subcategory reference ranges:", error);
      throw error;
    }
  }

  async updateReferenceRange(referenceId, updateData) {
    try {
      const { data: reference, error } = await this.supabase
        .from("reference_ranges")
        .update(updateData)
        .eq("id", referenceId)
        .select()
        .single();

      if (error) throw error;
      return reference;
    } catch (error) {
      console.error("Error updating reference range:", error);
      throw error;
    }
  }

  async deleteReferenceRange(referenceId) {
    try {
      const { error } = await this.supabase
        .from("reference_ranges")
        .delete()
        .eq("id", referenceId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting reference range:", error);
      throw error;
    }
  }

  // Get test statistics
  async getTestStats() {
    try {
      const { data: tests, error } = await this.supabase
        .from("tests")
        .select("is_active");

      if (error) throw error;

      const stats = {
        total: tests.length,
        active: tests.filter((test) => test.is_active).length,
        inactive: tests.filter((test) => !test.is_active).length,
      };

      return stats;
    } catch (error) {
      console.error("Error getting test stats:", error);
      throw error;
    }
  }

  // Get tests by category
  async getTestsByCategory(category) {
    try {
      const { data: tests, error } = await this.supabase
        .from("tests")
        .select("*")
        .eq("category", category)
        .eq("is_active", true)
        .order("test_name", { ascending: true });

      if (error) throw error;
      return tests;
    } catch (error) {
      console.error("Error getting tests by category:", error);
      throw error;
    }
  }

  // Get unique categories
  async getUniqueCategories() {
    try {
      const { data: tests, error } = await this.supabase
        .from("tests")
        .select("category")
        .not("category", "is", null);

      if (error) throw error;

      const categories = [...new Set(tests.map((test) => test.category))];
      return categories.sort();
    } catch (error) {
      console.error("Error getting unique categories:", error);
      throw error;
    }
  }
}

// Export the service
window.TestService = TestService;
