// Package Management Service - Handles all package related operations
class PackageService {
  constructor() {
    this.supabase = window.SUPABASE_CONFIG?.supabase || null;
    this.DB_SCHEMA = window.SUPABASE_CONFIG?.DB_SCHEMA || null;

    if (!this.supabase) {
      console.warn("PackageService initialized without Supabase connection");
    }
    this._packagesDropdownCache = { data: null, ts: 0 };
  }

  // Check if Supabase is available
  isSupabaseAvailable() {
    return this.supabase !== null;
  }

  // Generate unique PGID
  async generatePGID() {
    if (!this.isSupabaseAvailable()) {
      const timestamp = Date.now().toString().slice(-6);
      return `PGID${timestamp}`;
    }

    try {
      // Get all PGIDs and find the max number
      const { data: allPackages, error } = await this.supabase
        .from("packages")
        .select("pgid");
      if (error) throw error;

      let maxNumber = 0;
      if (allPackages && allPackages.length > 0) {
        allPackages.forEach((pkg) => {
          const match = pkg.pgid && pkg.pgid.match(/^PGID(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        });
      }
      const nextNumber = maxNumber + 1;
      return `PGID${nextNumber.toString().padStart(3, "0")}`;
    } catch (error) {
      console.error("Error generating PGID:", error);
      const timestamp = Date.now().toString().slice(-6);
      return `PGID${timestamp}`;
    }
  }

  // Create new package
  async createPackage(packageData) {
    try {
      const pgid = await this.generatePGID();
      const packagePayload = {
        pgid: pgid,
        package_name: packageData.package_name,
        price: parseFloat(packageData.price),
        is_active: packageData.is_active || true,
      };
      const { data: pkg, error } = await this.supabase
        .from("packages")
        .insert(packagePayload)
        .select()
        .single();
      if (error) {
        // Handle duplicate error
        if (error.code === "23505" || error.message?.includes("duplicate")) {
          throw new Error(
            "A package with this PGID or name already exists. Please try again."
          );
        }
        throw error;
      }
      // Add tests to package if provided
      if (packageData.tests && packageData.tests.length > 0) {
        try {
          const testResult = await this.addTestsToPackage(
            pkg.id,
            packageData.tests
          );
          console.log("Tests saved to package:", testResult);
        } catch (testError) {
          // Rollback: delete the package if test saving fails
          await this.supabase.from("packages").delete().eq("id", pkg.id);
          throw new Error(
            "Tests could not be saved to the package. The package was not created. Please try again."
          );
        }
      }
      return pkg;
    } catch (error) {
      window.app?.showError?.(error.message || "Error creating package");
      throw error;
    }
  }

  // Add tests to package
  async addTestsToPackage(packageId, testIds) {
    try {
      const packageTests = testIds.map((testId) => ({
        package_id: packageId,
        test_id: testId,
      }));

      const { data, error } = await this.supabase
        .from("package_tests")
        .insert(packageTests);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error adding tests to package:", error);
      throw error;
    }
  }

  // Get all packages
  async getAllPackages() {
    try {
      const { data: pkgs, error } = await this.supabase
        .from("packages")
        .select(
          `
                    *,
                    package_tests (
                        test_id,
                        tests (test_name, short_name, price)
                    )
                `
        )
        .order("package_name", { ascending: true });

      if (error) throw error;
      return pkgs;
    } catch (error) {
      console.error("Error getting packages:", error);
      throw error;
    }
  }

  async getPackagesForDropdown() {
    try {
      if (!this.isSupabaseAvailable()) {
        return this.getActivePackages();
      }

      const now = Date.now();
      if (this._packagesDropdownCache.data && now - this._packagesDropdownCache.ts < 60000) {
        return this._packagesDropdownCache.data;
      }

      const { data: pkgs, error } = await this.supabase
        .from("packages")
        .select("id, package_name, pgid")
        .eq("is_active", true)
        .order("package_name", { ascending: true });

      if (error) throw error;
      this._packagesDropdownCache = { data: pkgs || [], ts: now };
      return pkgs || [];
    } catch (error) {
      console.error("Error getting packages for dropdown:", error);
      return this.getActivePackages();
    }
  }

  // Get active packages
  async getActivePackages() {
    try {
      if (!this.isSupabaseAvailable()) {
        console.log("Supabase not available, returning sample packages");
        return [
          {
            id: "sample-1",
            package_name: "BASIC HEALTH PACKAGE",
            pgid: "PG001",
            price: 1200.0,
            is_active: true,
          },
          {
            id: "sample-2",
            package_name: "COMPREHENSIVE PACKAGE",
            pgid: "PG002",
            price: 2500.0,
            is_active: true,
          },
          {
            id: "sample-3",
            package_name: "DIABETIC PACKAGE",
            pgid: "PG003",
            price: 1800.0,
            is_active: true,
          },
        ];
      }

      const { data: pkgs, error } = await this.supabase
        .from("packages")
        .select(
          `
                    *,
                    package_tests (
                        test_id,
                        tests (test_name, short_name, price)
                    )
                `
        )
        .eq("is_active", true)
        .order("package_name", { ascending: true });

      if (error) throw error;
      return pkgs || [];
    } catch (error) {
      console.error("Error getting active packages:", error);
      // Return sample data on error
      return [
        {
          id: "sample-1",
          package_name: "BASIC HEALTH PACKAGE",
          pgid: "PG001",
          price: 1200.0,
          is_active: true,
        },
        {
          id: "sample-2",
          package_name: "COMPREHENSIVE PACKAGE",
          pgid: "PG002",
          price: 2500.0,
          is_active: true,
        },
        {
          id: "sample-3",
          package_name: "DIABETIC PACKAGE",
          pgid: "PG003",
          price: 1800.0,
          is_active: true,
        },
      ];
    }
  }

  // Get package by ID
  async getPackageById(packageId) {
    try {
      const { data: pkg, error } = await this.supabase
        .from("packages")
        .select(
          `
                    *,
                    package_tests (
                        test_id,
                        tests (test_name, short_name, price)
                    )
                `
        )
        .eq("id", packageId)
        .single();

      if (error) throw error;
      return pkg;
    } catch (error) {
      console.error("Error getting package:", error);
      throw error;
    }
  }

  // Get package by PGID
  async getPackageByPGID(pgid) {
    try {
      const { data: pkg, error } = await this.supabase
        .from("packages")
        .select(
          `
                    *,
                    package_tests (
                        test_id,
                        tests (test_name, short_name, price)
                    )
                `
        )
        .eq("pgid", pgid)
        .single();

      if (error) throw error;
      return pkg;
    } catch (error) {
      console.error("Error getting package by PGID:", error);
      throw error;
    }
  }

  // Search packages
  async searchPackages(searchTerm) {
    try {
      const { data: pkgs, error } = await this.supabase
        .from("packages")
        .select(
          `
                    *,
                    package_tests (
                        test_id,
                        tests (test_name, short_name, price)
                    )
                `
        )
        .or(`package_name.ilike.%${searchTerm}%,pgid.ilike.%${searchTerm}%`)
        .order("package_name", { ascending: true });

      if (error) throw error;
      return pkgs;
    } catch (error) {
      console.error("Error searching packages:", error);
      throw error;
    }
  }

  // Update package
  async updatePackage(packageId, updateData) {
    try {
      const { data: pkg, error } = await this.supabase
        .from("packages")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", packageId)
        .select()
        .single();

      if (error) throw error;
      return pkg;
    } catch (error) {
      console.error("Error updating package:", error);
      throw error;
    }
  }

  // Delete package
  async deletePackage(packageId) {
    try {
      // First delete package tests
      await this.supabase
        .from("package_tests")
        .delete()
        .eq("package_id", packageId);

      // Then delete the package
      const { error } = await this.supabase
        .from("packages")
        .delete()
        .eq("id", packageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting package:", error);
      throw error;
    }
  }

  // Toggle package status
  async togglePackageStatus(packageId) {
    try {
      const pkg = await this.getPackageById(packageId);
      const newStatus = !pkg.is_active;

      return await this.updatePackage(packageId, { is_active: newStatus });
    } catch (error) {
      console.error("Error toggling package status:", error);
      throw error;
    }
  }

  // Get package tests
  async getPackageTests(packageId) {
    try {
      const { data: packageTests, error } = await this.supabase
        .from("package_tests")
        .select(
          `
                    *,
                    tests (test_name, short_name, price)
                `
        )
        .eq("package_id", packageId);

      if (error) throw error;
      return packageTests;
    } catch (error) {
      console.error("Error getting package tests:", error);
      throw error;
    }
  }

  // Remove test from package
  async removeTestFromPackage(packageId, testId) {
    try {
      const { error } = await this.supabase
        .from("package_tests")
        .delete()
        .eq("package_id", packageId)
        .eq("test_id", testId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error removing test from package:", error);
      throw error;
    }
  }

  // Update package tests
  async updatePackageTests(packageId, testIds) {
    try {
      // Remove all existing tests
      await this.supabase
        .from("package_tests")
        .delete()
        .eq("package_id", packageId);

      // Add new tests
      if (testIds && testIds.length > 0) {
        await this.addTestsToPackage(packageId, testIds);
      }

      return true;
    } catch (error) {
      console.error("Error updating package tests:", error);
      throw error;
    }
  }

  // Calculate package price from individual tests
  async calculatePackagePrice(packageId) {
    try {
      const packageTests = await this.getPackageTests(packageId);
      const totalPrice = packageTests.reduce((sum, pt) => {
        return sum + (pt.tests?.price || 0);
      }, 0);

      return totalPrice;
    } catch (error) {
      console.error("Error calculating package price:", error);
      throw error;
    }
  }

  // Get package statistics
  async getPackageStats() {
    try {
      const { data: pkgs, error } = await this.supabase
        .from("packages")
        .select("is_active, price");

      if (error) throw error;

      const stats = {
        total: pkgs.length,
        active: pkgs.filter((pkg) => pkg.is_active).length,
        inactive: pkgs.filter((pkg) => !pkg.is_active).length,
        totalValue: pkgs.reduce((sum, pkg) => sum + (pkg.price || 0), 0),
        avgPrice:
          pkgs.length > 0
            ? pkgs.reduce((sum, pkg) => sum + (pkg.price || 0), 0) / pkgs.length
            : 0,
      };

      return stats;
    } catch (error) {
      console.error("Error getting package stats:", error);
      throw error;
    }
  }

  // Get packages by price range
  async getPackagesByPriceRange(minPrice, maxPrice) {
    try {
      const { data: pkgs, error } = await this.supabase
        .from("packages")
        .select(
          `
                    *,
                    package_tests (
                        test_id,
                        tests (test_name, short_name, price)
                    )
                `
        )
        .gte("price", minPrice)
        .lte("price", maxPrice)
        .order("price", { ascending: true });

      if (error) throw error;
      return pkgs;
    } catch (error) {
      console.error("Error getting packages by price range:", error);
      throw error;
    }
  }

  // Get top packages by price
  async getTopPackagesByPrice(limit = 10) {
    try {
      const { data: pkgs, error } = await this.supabase
        .from("packages")
        .select(
          `
                    *,
                    package_tests (
                        test_id,
                        tests (test_name, short_name, price)
                    )
                `
        )
        .order("price", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return pkgs;
    } catch (error) {
      console.error("Error getting top packages by price:", error);
      throw error;
    }
  }

  // Get packages containing specific test
  async getPackagesByTest(testId) {
    try {
      const { data: packages, error } = await this.supabase
        .from("package_tests")
        .select(
          `
                    packages (*)
                `
        )
        .eq("test_id", testId);

      if (error) throw error;
      return packages.map((pt) => pt.packages);
    } catch (error) {
      console.error("Error getting packages by test:", error);
      throw error;
    }
  }

  // Bulk update package status
  async bulkUpdatePackageStatus(packageIds, newStatus) {
    try {
      const { data: pkgs, error } = await this.supabase
        .from("packages")
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .in("id", packageIds)
        .select();

      if (error) throw error;
      return pkgs;
    } catch (error) {
      console.error("Error bulk updating package status:", error);
      throw error;
    }
  }
}

// Export the service
window.PackageService = PackageService;
