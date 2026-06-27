// Pricing Service - Resolves global vs center-specific prices
class PricingService {
  constructor() {
    this.supabase = window.SUPABASE_CONFIG?.supabase || null;
  }

  isSupabaseAvailable() {
    return this.supabase !== null;
  }

  ensureSupabaseAvailable() {
    if (!this.isSupabaseAvailable()) {
      throw new Error("Supabase connection is not available");
    }
  }

  getCurrentUser() {
    try {
      const raw = sessionStorage.getItem("loggedInUser");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Failed to parse logged-in user", error);
      return null;
    }
  }

  isUserAdmin() {
    return this.getCurrentUser()?.role === "admin";
  }

  getUserCenterId() {
    return this.getCurrentUser()?.center_id || null;
  }

  ensureAllowedCenterId(centerId) {
    const requestedCenterId = centerId || null;
    const userCenterId = this.getUserCenterId();

    if (!this.isUserAdmin() && userCenterId) {
      if (requestedCenterId && requestedCenterId !== userCenterId) {
        throw new Error("You are not authorized to access another center");
      }
      return userCenterId;
    }

    return requestedCenterId;
  }

  resolveBillingCenterId(centerId) {
    return this.ensureAllowedCenterId(centerId) || this.getUserCenterId() || null;
  }

  getTestService() {
    return window.app?.getService("test") || null;
  }

  getPackageService() {
    return window.app?.getService("package") || null;
  }

  async fetchActiveTests() {
    this.ensureSupabaseAvailable();
    const { data: tests, error } = await this.supabase
      .from("tests")
      .select("*")
      .eq("is_active", true)
      .order("test_name", { ascending: true });

    if (error) throw error;
    return tests || [];
  }

  async fetchActivePackages() {
    this.ensureSupabaseAvailable();
    const { data: packages, error } = await this.supabase
      .from("packages")
      .select("*")
      .eq("is_active", true)
      .order("package_name", { ascending: true });

    if (error) throw error;
    return packages || [];
  }

  async getCenterPriceMap(tableName, itemField, itemIds, centerId) {
    if (!this.isSupabaseAvailable() || !centerId || !Array.isArray(itemIds) || itemIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from(tableName)
      .select(`${itemField}, price`)
      .eq("center_id", centerId)
      .eq("is_active", true)
      .in(itemField, itemIds);

    if (error) throw error;

    const priceMap = new Map();
    (data || []).forEach((row) => {
      priceMap.set(row[itemField], parseFloat(row.price) || 0);
    });
    return priceMap;
  }

  applyResolvedPrices(items, centerPriceMap, idField = "id") {
    return (items || []).map((item) => {
      const globalPrice = parseFloat(item.price) || 0;
      const centerPrice = centerPriceMap.get(item[idField]);
      const hasCenterPrice = centerPriceMap.has(item[idField]);
      return {
        ...item,
        global_price: globalPrice,
        center_price: hasCenterPrice ? centerPrice : null,
        resolved_price: hasCenterPrice ? centerPrice : globalPrice,
        has_center_price: hasCenterPrice,
      };
    });
  }

  async getTestsWithCenterPrices(centerId = null) {
    const effectiveCenterId = this.ensureAllowedCenterId(centerId);
    const tests = await this.fetchActiveTests();
    const testIds = tests.map((test) => test.id).filter(Boolean);
    const centerPriceMap = await this.getCenterPriceMap(
      "center_test_prices",
      "test_id",
      testIds,
      effectiveCenterId
    );
    return this.applyResolvedPrices(tests, centerPriceMap).sort((a, b) =>
      String(a.test_name || "").localeCompare(String(b.test_name || ""), undefined, {
        sensitivity: "base",
      })
    );
  }

  async getResolvedTestsByIds(testIds, centerId = null) {
    const uniqueTestIds = [...new Set((testIds || []).filter(Boolean))];
    if (uniqueTestIds.length === 0) return [];

    const effectiveCenterId = this.resolveBillingCenterId(centerId);
    const { data: tests, error } = await this.supabase
      .from("tests")
      .select("*")
      .in("id", uniqueTestIds);

    if (error) throw error;

    const centerPriceMap = await this.getCenterPriceMap(
      "center_test_prices",
      "test_id",
      uniqueTestIds,
      effectiveCenterId
    );

    return this.applyResolvedPrices(tests || [], centerPriceMap);
  }

  async searchTestsForBilling(searchTerm, centerId = null) {
    const term = (searchTerm || "").trim();
    if (!term) return [];

    const effectiveCenterId = this.resolveBillingCenterId(centerId);

    const words = term.split(/\s+/).filter(Boolean);
    let orQuery = words
      .map((word) => `test_name.ilike.%${word}%,short_name.ilike.%${word}%`)
      .join(",");

    if (!orQuery) {
      orQuery = `test_name.ilike.%${term}%,short_name.ilike.%${term}%`;
    }

    const { data: tests, error } = await this.supabase
      .from("tests")
      .select("*")
      .eq("is_active", true)
      .or(orQuery)
      .order("test_name", { ascending: true });

    if (error) throw error;

    const testIds = (tests || []).map((test) => test.id).filter(Boolean);
    const centerPriceMap = await this.getCenterPriceMap(
      "center_test_prices",
      "test_id",
      testIds,
      effectiveCenterId
    );

    return this.applyResolvedPrices(tests || [], centerPriceMap);
  }

  async getPackagesWithCenterPrices(centerId = null) {
    const effectiveCenterId = this.ensureAllowedCenterId(centerId);
    const packages = await this.fetchActivePackages();
    const packageIds = packages.map((pkg) => pkg.id).filter(Boolean);
    const centerPriceMap = await this.getCenterPriceMap(
      "center_package_prices",
      "package_id",
      packageIds,
      effectiveCenterId
    );
    return this.applyResolvedPrices(packages, centerPriceMap).sort((a, b) =>
      String(a.package_name || "").localeCompare(
        String(b.package_name || ""),
        undefined,
        { sensitivity: "base" }
      )
    );
  }

  async getPackagesForBilling(centerId = null) {
    const effectiveCenterId = this.resolveBillingCenterId(centerId);
    const { data: packages, error } = await this.supabase
      .from("packages")
      .select("id, package_name, pgid, price")
      .eq("is_active", true)
      .order("package_name", { ascending: true });

    if (error) throw error;

    const packageIds = (packages || []).map((pkg) => pkg.id).filter(Boolean);
    const centerPriceMap = await this.getCenterPriceMap(
      "center_package_prices",
      "package_id",
      packageIds,
      effectiveCenterId
    );

    return this.applyResolvedPrices(packages || [], centerPriceMap);
  }

  async getResolvedPackagesByIds(packageIds, centerId = null) {
    const uniquePackageIds = [...new Set((packageIds || []).filter(Boolean))];
    if (uniquePackageIds.length === 0) return [];

    const effectiveCenterId = this.resolveBillingCenterId(centerId);
    const { data: packages, error } = await this.supabase
      .from("packages")
      .select("*")
      .in("id", uniquePackageIds);

    if (error) throw error;

    const centerPriceMap = await this.getCenterPriceMap(
      "center_package_prices",
      "package_id",
      uniquePackageIds,
      effectiveCenterId
    );

    return this.applyResolvedPrices(packages || [], centerPriceMap);
  }

  async getResolvedPackageById(packageId, centerId = null) {
    const effectiveCenterId = this.resolveBillingCenterId(centerId);

    const { data: pkg, error } = await this.supabase
      .from("packages")
      .select(
        `
        *,
        package_tests (
          test_id,
          tests (
            id,
            test_name,
            short_name,
            specimen,
            duration,
            footer_text
          )
        )
      `
      )
      .eq("id", packageId)
      .single();

    if (error) throw error;

    const centerPriceMap = await this.getCenterPriceMap(
      "center_package_prices",
      "package_id",
      [packageId],
      effectiveCenterId
    );

    const [resolved] = this.applyResolvedPrices([pkg], centerPriceMap);
    return resolved || null;
  }

  normalizePriceInput(value) {
    const numericValue = parseFloat(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) return null;
    return Number(numericValue.toFixed(2));
  }

  async syncCenterPrices({
    centerId,
    tableName,
    itemField,
    baseTableName,
    entries,
  }) {
    this.ensureSupabaseAvailable();
    const effectiveCenterId = this.ensureAllowedCenterId(centerId);
    if (!effectiveCenterId) {
      throw new Error("A center must be selected before saving prices");
    }

    const cleanEntries = (entries || [])
      .map((entry) => ({
        itemId: entry[itemField],
        price: this.normalizePriceInput(entry.price),
      }))
      .filter((entry) => entry.itemId);

    if (cleanEntries.length === 0) return { deleted: 0, upserted: 0 };

    const itemIds = [...new Set(cleanEntries.map((entry) => entry.itemId))];
    const { data: baseItems, error: baseError } = await this.supabase
      .from(baseTableName)
      .select(`id, price`)
      .in("id", itemIds);

    if (baseError) throw baseError;

    const globalPriceMap = new Map(
      (baseItems || []).map((item) => [item.id, parseFloat(item.price) || 0])
    );

    const toDelete = [];
    const toUpsert = [];

    cleanEntries.forEach((entry) => {
      const globalPrice = globalPriceMap.get(entry.itemId);
      if (entry.price === null || globalPrice === undefined) {
        toDelete.push(entry.itemId);
        return;
      }

      if (Math.abs(entry.price - globalPrice) < 0.00001) {
        toDelete.push(entry.itemId);
        return;
      }

      toUpsert.push({
        center_id: effectiveCenterId,
        [itemField]: entry.itemId,
        price: entry.price,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    });

    if (toDelete.length > 0) {
      const { error: deleteError } = await this.supabase
        .from(tableName)
        .delete()
        .eq("center_id", effectiveCenterId)
        .in(itemField, toDelete);

      if (deleteError) throw deleteError;
    }

    if (toUpsert.length > 0) {
      const { error: upsertError } = await this.supabase
        .from(tableName)
        .upsert(toUpsert, {
          onConflict: `center_id,${itemField}`,
        });

      if (upsertError) throw upsertError;
    }

    return { deleted: toDelete.length, upserted: toUpsert.length };
  }

  async setBulkTestPrices(centerId, entries) {
    return this.syncCenterPrices({
      centerId,
      tableName: "center_test_prices",
      itemField: "test_id",
      baseTableName: "tests",
      entries,
    });
  }

  async setBulkPackagePrices(centerId, entries) {
    return this.syncCenterPrices({
      centerId,
      tableName: "center_package_prices",
      itemField: "package_id",
      baseTableName: "packages",
      entries,
    });
  }

  async deleteTestPrice(centerId, testId) {
    this.ensureSupabaseAvailable();
    const effectiveCenterId = this.ensureAllowedCenterId(centerId);
    if (!effectiveCenterId || !testId) return;

    const { error } = await this.supabase
      .from("center_test_prices")
      .delete()
      .eq("center_id", effectiveCenterId)
      .eq("test_id", testId);

    if (error) throw error;
  }

  async deletePackagePrice(centerId, packageId) {
    this.ensureSupabaseAvailable();
    const effectiveCenterId = this.ensureAllowedCenterId(centerId);
    if (!effectiveCenterId || !packageId) return;

    const { error } = await this.supabase
      .from("center_package_prices")
      .delete()
      .eq("center_id", effectiveCenterId)
      .eq("package_id", packageId);

    if (error) throw error;
  }

  async resetAllTestPrices(centerId) {
    this.ensureSupabaseAvailable();
    const effectiveCenterId = this.ensureAllowedCenterId(centerId);
    if (!effectiveCenterId) return;

    const { error } = await this.supabase
      .from("center_test_prices")
      .delete()
      .eq("center_id", effectiveCenterId);

    if (error) throw error;
  }

  async resetAllPackagePrices(centerId) {
    this.ensureSupabaseAvailable();
    const effectiveCenterId = this.ensureAllowedCenterId(centerId);
    if (!effectiveCenterId) return;

    const { error } = await this.supabase
      .from("center_package_prices")
      .delete()
      .eq("center_id", effectiveCenterId);

    if (error) throw error;
  }
}

window.PricingService = PricingService;
