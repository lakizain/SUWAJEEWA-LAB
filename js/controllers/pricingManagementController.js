class PricingManagementController {
  constructor() {
    this.currentCenterId = "";
    this.testsWithPrices = [];
    this.packagesWithPrices = [];
    this.testSearchTerm = "";
    this.packageSearchTerm = "";

    this.centerSelect = document.getElementById("centerSelect");
    this.testTableBody = document.getElementById("testPricingTableBody");
    this.packageTableBody = document.getElementById("packagePricingTableBody");
    this.testSummary = document.getElementById("testPricingSummary");
    this.packageSummary = document.getElementById("packagePricingSummary");
    this.testSearchInput = document.getElementById("testPricingSearch");
    this.packageSearchInput = document.getElementById("packagePricingSearch");
    this.pageAlert = document.getElementById("pricingPageAlert");
  }

  async initialize() {
    try {
      await this.waitForApp();
      this.setupEventListeners();
      await this.loadCenters();
    } catch (error) {
      console.error("Error initializing pricing management:", error);
      this.showError("Failed to initialize pricing management");
    }
  }

  async waitForApp() {
    if (window.app && window.app.isInitialized) return;

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (window.app && window.app.isInitialized) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  get pricingService() {
    return window.app?.getService("pricing");
  }

  get centerService() {
    return window.app?.getService("center");
  }

  setPageAlert(message, type = "danger") {
    if (!this.pageAlert) return;

    this.pageAlert.innerHTML = `
      <div class="alert alert-${type}" role="alert">${message}</div>
    `;
  }

  clearPageAlert() {
    if (this.pageAlert) {
      this.pageAlert.innerHTML = "";
    }
  }

  setActionButtonsDisabled(disabled) {
    [
      "loadPricingBtn",
      "saveTestPricesBtn",
      "resetTestPricesBtn",
      "savePackagePricesBtn",
      "resetPackagePricesBtn",
    ].forEach((id) => {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = disabled;
      }
    });
  }

  ensureServicesReady() {
    if (!this.centerService || !this.pricingService) {
      throw new Error("Required services are not available");
    }

    if (!window.SUPABASE_CONFIG?.supabase) {
      throw new Error(
        "Supabase connection is not available. Check the browser console and configuration."
      );
    }
  }

  getLoggedInUser() {
    try {
      const raw = sessionStorage.getItem("loggedInUser");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Failed to parse logged in user", error);
      return null;
    }
  }

  setupEventListeners() {
    this.centerSelect?.addEventListener("change", (event) => {
      this.currentCenterId = event.target.value || "";
    });

    document.getElementById("loadPricingBtn")?.addEventListener("click", () => {
      this.loadPricing();
    });

    document.getElementById("saveTestPricesBtn")?.addEventListener("click", () => {
      this.saveTestPrices();
    });

    document.getElementById("resetTestPricesBtn")?.addEventListener("click", () => {
      this.resetTestPrices();
    });

    document.getElementById("savePackagePricesBtn")?.addEventListener("click", () => {
      this.savePackagePrices();
    });

    document.getElementById("resetPackagePricesBtn")?.addEventListener("click", () => {
      this.resetPackagePrices();
    });

    this.testSearchInput?.addEventListener("input", (event) => {
      this.testSearchTerm = String(event.target.value || "").trim().toLowerCase();
      this.renderTestPricingTable();
    });

    this.packageSearchInput?.addEventListener("input", (event) => {
      this.packageSearchTerm = String(event.target.value || "").trim().toLowerCase();
      this.renderPackagePricingTable();
    });
  }

  async loadCenters() {
    try {
      this.ensureServicesReady();
      this.setActionButtonsDisabled(true);
      this.centerSelect.innerHTML = '<option value="">Loading centers...</option>';

      const centers =
        (await this.centerService?.getCentersForDropdownStrict?.()) || [];

      this.centerSelect.innerHTML = '<option value="">Select a center...</option>';

      centers.forEach((center) => {
        const option = document.createElement("option");
        option.value = center.id;
        option.textContent = `${center.center_name}${
          center.cid ? ` (${center.cid})` : ""
        }`;
        this.centerSelect.appendChild(option);
      });

      const user = this.getLoggedInUser();
      const userCenterId = user?.center_id || "";
      if (userCenterId) {
        this.centerSelect.value = userCenterId;
        this.currentCenterId = userCenterId;
      }

      if (user?.role !== "admin" && userCenterId) {
        this.centerSelect.setAttribute("disabled", "disabled");
      }

      if (!centers.length) {
        this.setPageAlert("Active centers not found. Please add a center first.", "warning");
        this.testTableBody.innerHTML =
          '<tr><td colspan="6" class="text-center">No active centers available</td></tr>';
        this.packageTableBody.innerHTML =
          '<tr><td colspan="6" class="text-center">No active centers available</td></tr>';
        return;
      }

      this.clearPageAlert();
      this.setActionButtonsDisabled(false);

      if (this.currentCenterId) {
        await this.loadPricing();
      }
    } catch (error) {
      console.error("Error loading centers for pricing management:", error);
      this.centerSelect.innerHTML =
        '<option value="">Unable to load centers</option>';
      this.setActionButtonsDisabled(true);
      this.setPageAlert(
        error?.message ||
          "Centers could not be loaded from the backend. Dummy data has been disabled for this page."
      );
      this.showError("Failed to load centers");
    }
  }

  async loadPricing() {
    if (!this.currentCenterId) {
      this.showWarning("Please select a center first");
      return;
    }

    try {
      this.clearPageAlert();
      await Promise.all([this.loadTestPricing(), this.loadPackagePricing()]);
    } catch (error) {
      console.error("Error loading pricing:", error);
      this.setPageAlert(error?.message || "Failed to load pricing data from backend");
      this.showError(error?.message || "Failed to load pricing data");
    }
  }

  async loadTestPricing() {
    this.setLoadingState("test", true);
    try {
      this.testsWithPrices = await this.pricingService.getTestsWithCenterPrices(
        this.currentCenterId
      );
      this.renderTestPricingTable();
    } finally {
      this.setLoadingState("test", false);
    }
  }

  async loadPackagePricing() {
    this.setLoadingState("package", true);
    try {
      this.packagesWithPrices = await this.pricingService.getPackagesWithCenterPrices(
        this.currentCenterId
      );
      this.renderPackagePricingTable();
    } finally {
      this.setLoadingState("package", false);
    }
  }

  setLoadingState(section, isLoading) {
    const spinner = document.getElementById(
      section === "test" ? "testLoadingSpinner" : "packageLoadingSpinner"
    );
    const content = document.getElementById(
      section === "test" ? "testPricingContent" : "packagePricingContent"
    );

    spinner?.classList.toggle("show", isLoading);
    if (content) {
      content.style.display = isLoading ? "none" : "block";
    }
  }

  getFilteredItems(items, searchTerm, fields) {
    if (!searchTerm) return items;

    return (items || []).filter((item) =>
      fields.some((field) =>
        String(item[field] || "")
          .toLowerCase()
          .includes(searchTerm)
      )
    );
  }

  renderSummary(container, items, label) {
    if (!container) return;

    const totalCount = items.length;
    const overrideCount = items.filter((item) => item.has_center_price).length;
    const fallbackCount = totalCount - overrideCount;

    container.innerHTML = `
      <div class="summary-chip">${label}: ${totalCount}</div>
      <div class="summary-chip">Center Overrides: ${overrideCount}</div>
      <div class="summary-chip">Using Global Default: ${fallbackCount}</div>
    `;
  }

  renderPriceRows({
    items,
    searchTerm,
    searchFields,
    tbody,
    summaryContainer,
    label,
    idKey,
    nameKey,
    codeKey,
    resetHandlerName,
  }) {
    const filteredItems = this.getFilteredItems(items, searchTerm, searchFields);
    this.renderSummary(summaryContainer, items, label);
    tbody.innerHTML = "";

    if (!filteredItems.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center">No pricing rows match the current filter</td></tr>';
      return;
    }

    filteredItems.forEach((item) => {
      const globalPrice = parseFloat(item.global_price ?? item.price) || 0;
      const resolvedPrice = parseFloat(item.resolved_price ?? item.price) || 0;
      const difference = resolvedPrice - globalPrice;
      const differenceClass =
        difference > 0 ? "increase" : difference < 0 ? "decrease" : "";
      const idValue = item[idKey];
      const sourceBadge = item.has_center_price
        ? '<span class="badge-center">Center Override</span>'
        : '<span class="badge-global">Global Default</span>';

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item[nameKey] || ""}</td>
        <td>${item[codeKey] || "-"}</td>
        <td><span class="badge-global">Rs. ${globalPrice.toFixed(2)}</span></td>
        <td class="price-cell">
          <input
            type="number"
            class="form-control price-input"
            data-item-id="${idValue}"
            data-global-price="${globalPrice.toFixed(2)}"
            value="${resolvedPrice.toFixed(2)}"
            step="0.01"
            min="0"
          >
          <div class="mt-2">${sourceBadge}</div>
        </td>
        <td>
          <span class="price-diff ${differenceClass}">
            ${
              difference !== 0
                ? `${difference > 0 ? "+" : ""}${difference.toFixed(2)}`
                : "-"
            }
          </span>
        </td>
        <td>
          ${
            item.has_center_price
              ? `<button class="btn btn-sm btn-danger" data-reset-id="${idValue}">
                  <i class="fas fa-undo"></i>
                </button>`
              : '<span class="text-muted">Using Global</span>'
          }
        </td>
      `;

      tbody.appendChild(row);
    });

    tbody.querySelectorAll(".price-input").forEach((input) => {
      input.addEventListener("input", () => this.updatePriceDiff(input));
    });

    tbody.querySelectorAll("[data-reset-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const itemId = button.getAttribute("data-reset-id");
        this[resetHandlerName](itemId);
      });
    });
  }

  renderTestPricingTable() {
    this.renderPriceRows({
      items: this.testsWithPrices,
      searchTerm: this.testSearchTerm,
      searchFields: ["test_name", "short_name"],
      tbody: this.testTableBody,
      summaryContainer: this.testSummary,
      label: "Tests",
      idKey: "id",
      nameKey: "test_name",
      codeKey: "short_name",
      resetHandlerName: "resetSingleTestPrice",
    });
  }

  renderPackagePricingTable() {
    this.renderPriceRows({
      items: this.packagesWithPrices,
      searchTerm: this.packageSearchTerm,
      searchFields: ["package_name", "pgid"],
      tbody: this.packageTableBody,
      summaryContainer: this.packageSummary,
      label: "Packages",
      idKey: "id",
      nameKey: "package_name",
      codeKey: "pgid",
      resetHandlerName: "resetSinglePackagePrice",
    });
  }

  updatePriceDiff(input) {
    const row = input.closest("tr");
    if (!row) return;

    const diffSpan = row.querySelector(".price-diff");
    const globalPrice = parseFloat(input.getAttribute("data-global-price")) || 0;
    const currentPrice = parseFloat(input.value) || 0;
    const difference = currentPrice - globalPrice;

    diffSpan.className = `price-diff ${
      difference > 0 ? "increase" : difference < 0 ? "decrease" : ""
    }`;
    diffSpan.textContent =
      difference !== 0
        ? `${difference > 0 ? "+" : ""}${difference.toFixed(2)}`
        : "-";
  }

  collectPriceEntries(selector, idField) {
    return Array.from(document.querySelectorAll(selector)).map((input) => ({
      [idField]: input.getAttribute("data-item-id"),
      price: input.value,
    }));
  }

  ensureCenterSelected() {
    if (this.currentCenterId) return true;
    this.showWarning("Please select a center first");
    return false;
  }

  async saveTestPrices() {
    if (!this.ensureCenterSelected()) return;

    try {
      const entries = this.collectPriceEntries(
        "#testPricingTableBody .price-input",
        "test_id"
      );
      await this.pricingService.setBulkTestPrices(this.currentCenterId, entries);
      this.showSuccess("Test prices saved successfully");
      await this.loadTestPricing();
    } catch (error) {
      console.error("Error saving test prices:", error);
      this.showError(error?.message || "Failed to save test prices");
    }
  }

  async savePackagePrices() {
    if (!this.ensureCenterSelected()) return;

    try {
      const entries = this.collectPriceEntries(
        "#packagePricingTableBody .price-input",
        "package_id"
      );
      await this.pricingService.setBulkPackagePrices(this.currentCenterId, entries);
      this.showSuccess("Package prices saved successfully");
      await this.loadPackagePricing();
    } catch (error) {
      console.error("Error saving package prices:", error);
      this.showError(error?.message || "Failed to save package prices");
    }
  }

  async resetTestPrices() {
    if (!this.ensureCenterSelected()) return;
    if (!window.confirm("Reset all test prices for this center back to global prices?")) {
      return;
    }

    try {
      await this.pricingService.resetAllTestPrices(this.currentCenterId);
      this.showSuccess("All test prices reset to global prices");
      await this.loadTestPricing();
    } catch (error) {
      console.error("Error resetting test prices:", error);
      this.showError(error?.message || "Failed to reset test prices");
    }
  }

  async resetPackagePrices() {
    if (!this.ensureCenterSelected()) return;
    if (
      !window.confirm("Reset all package prices for this center back to global prices?")
    ) {
      return;
    }

    try {
      await this.pricingService.resetAllPackagePrices(this.currentCenterId);
      this.showSuccess("All package prices reset to global prices");
      await this.loadPackagePricing();
    } catch (error) {
      console.error("Error resetting package prices:", error);
      this.showError(error?.message || "Failed to reset package prices");
    }
  }

  async resetSingleTestPrice(testId) {
    if (!this.currentCenterId || !testId) return;

    try {
      await this.pricingService.deleteTestPrice(this.currentCenterId, testId);
      this.showSuccess("Test price reset to global price");
      await this.loadTestPricing();
    } catch (error) {
      console.error("Error resetting single test price:", error);
      this.showError(error?.message || "Failed to reset test price");
    }
  }

  async resetSinglePackagePrice(packageId) {
    if (!this.currentCenterId || !packageId) return;

    try {
      await this.pricingService.deletePackagePrice(this.currentCenterId, packageId);
      this.showSuccess("Package price reset to global price");
      await this.loadPackagePricing();
    } catch (error) {
      console.error("Error resetting single package price:", error);
      this.showError(error?.message || "Failed to reset package price");
    }
  }

  showSuccess(message) {
    window.app?.showSuccess?.(message);
  }

  showWarning(message) {
    window.app?.showWarning?.(message);
  }

  showError(message) {
    window.app?.showError?.(message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.pricingManagementController = new PricingManagementController();
  window.pricingManagementController.initialize();
});
