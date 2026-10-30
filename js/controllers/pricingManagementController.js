class PricingManagementController {
  constructor() {
    this.currentCenterId = "";
    this.pricingLoadedCenterId = "";
    this.pricingLoadRequestId = 0;
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

  setPricingActionButtonsDisabled(disabled) {
    [
      "saveTestPricesBtn",
      "resetTestPricesBtn",
      "savePackagePricesBtn",
      "resetPackagePricesBtn",
    ].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = disabled;
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

  getSelectedCenterId() {
    return this.centerSelect?.value || "";
  }

  setupEventListeners() {
    this.centerSelect?.addEventListener("change", (event) => {
      const centerId = event.target.value || "";
      if (!window.UserCenterAccess?.setActiveCenterId(centerId)) {
        this.centerSelect.value = this.currentCenterId;
        this.showError("You are not assigned to this center");
        return;
      }

      this.currentCenterId = centerId;
      this.clearPricingData();
      if (centerId) {
        this.loadPricing(centerId);
      } else {
        this.setActionButtonsDisabled(true);
      }
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
      const assignedCenterIds =
        window.UserCenterAccess?.getAssignedCenterIds(user) || [];
      const defaultCenterId =
        window.UserCenterAccess?.getDefaultCenterId(
          user,
          centers.map((center) => center.id)
        );
      const activeCenterId =
        window.UserCenterAccess?.getActiveCenterId(user);
      const userCenterId =
        activeCenterId && centers.some((center) => center.id === activeCenterId)
          ? activeCenterId
          : defaultCenterId && (
              user?.role === "admin" || assignedCenterIds.includes(defaultCenterId)
            )
            ? defaultCenterId
            : "";
      if (userCenterId) {
        this.centerSelect.value = userCenterId;
        this.currentCenterId = userCenterId;
        window.UserCenterAccess?.setActiveCenterId(userCenterId);
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

      if (this.currentCenterId) {
        await this.loadPricing(this.currentCenterId);
      } else {
        this.clearPricingData();
        this.setActionButtonsDisabled(true);
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

  async loadPricing(centerId = this.currentCenterId) {
    if (!centerId) {
      this.showWarning("Please select a center first");
      return;
    }

    const requestId = ++this.pricingLoadRequestId;
    this.pricingLoadedCenterId = "";
    this.setActionButtonsDisabled(true);
    this.setLoadingState("test", true);
    this.setLoadingState("package", true);
    try {
      this.clearPageAlert();
      const [tests, packages] = await Promise.all([
        this.pricingService.getTestsWithCenterPrices(centerId),
        this.pricingService.getPackagesWithCenterPrices(centerId),
      ]);
      if (
        requestId !== this.pricingLoadRequestId ||
        centerId !== this.centerSelect?.value
      ) {
        return;
      }

      this.testsWithPrices = tests;
      this.packagesWithPrices = packages;
      this.pricingLoadedCenterId = centerId;
      this.renderTestPricingTable();
      this.renderPackagePricingTable();
    } catch (error) {
      if (requestId === this.pricingLoadRequestId) {
        console.error("Error loading pricing:", error);
        this.setPageAlert(
          error?.message || "Failed to load pricing data from backend"
        );
        this.showError(error?.message || "Failed to load pricing data");
      }
    } finally {
      if (requestId === this.pricingLoadRequestId) {
        this.setLoadingState("test", false);
        this.setLoadingState("package", false);
        const centerIsSelected = this.centerSelect?.value === centerId;
        const loadButton = document.getElementById("loadPricingBtn");
        if (loadButton) loadButton.disabled = !centerIsSelected;
        this.setPricingActionButtonsDisabled(
          !centerIsSelected || this.pricingLoadedCenterId !== centerId
        );
      }
    }
  }

  clearPricingData() {
    this.pricingLoadRequestId++;
    this.pricingLoadedCenterId = "";
    this.testsWithPrices = [];
    this.packagesWithPrices = [];
    this.setLoadingState("test", false);
    this.setLoadingState("package", false);
    if (this.testSummary) this.testSummary.innerHTML = "";
    if (this.packageSummary) this.packageSummary.innerHTML = "";
    if (this.testTableBody) {
      this.testTableBody.innerHTML =
        '<tr><td colspan="6" class="text-center">Loading selected center pricing...</td></tr>';
    }
    if (this.packageTableBody) {
      this.packageTableBody.innerHTML =
        '<tr><td colspan="6" class="text-center">Loading selected center pricing...</td></tr>';
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
    if (
      this.currentCenterId &&
      this.currentCenterId === this.centerSelect?.value &&
      this.pricingLoadedCenterId === this.currentCenterId
    ) return true;
    this.showWarning("Load pricing for the selected center before saving");
    return false;
  }

  async saveTestPrices() {
    if (!this.ensureCenterSelected()) return;
    const centerId = this.currentCenterId;

    try {
      const entries = this.collectPriceEntries(
        "#testPricingTableBody .price-input",
        "test_id"
      );
      await this.pricingService.setBulkTestPrices(centerId, entries);
      this.showSuccess("Test prices saved successfully");
      if (centerId === this.getSelectedCenterId()) await this.loadPricing(centerId);
    } catch (error) {
      console.error("Error saving test prices:", error);
      this.showError(error?.message || "Failed to save test prices");
    }
  }

  async savePackagePrices() {
    if (!this.ensureCenterSelected()) return;
    const centerId = this.currentCenterId;

    try {
      const entries = this.collectPriceEntries(
        "#packagePricingTableBody .price-input",
        "package_id"
      );
      await this.pricingService.setBulkPackagePrices(centerId, entries);
      this.showSuccess("Package prices saved successfully");
      if (centerId === this.getSelectedCenterId()) await this.loadPricing(centerId);
    } catch (error) {
      console.error("Error saving package prices:", error);
      this.showError(error?.message || "Failed to save package prices");
    }
  }

  async resetTestPrices() {
    if (!this.ensureCenterSelected()) return;
    const centerId = this.currentCenterId;
    if (!window.confirm("Reset all test prices for this center back to global prices?")) {
      return;
    }

    try {
      await this.pricingService.resetAllTestPrices(centerId);
      this.showSuccess("All test prices reset to global prices");
      if (centerId === this.getSelectedCenterId()) await this.loadPricing(centerId);
    } catch (error) {
      console.error("Error resetting test prices:", error);
      this.showError(error?.message || "Failed to reset test prices");
    }
  }

  async resetPackagePrices() {
    if (!this.ensureCenterSelected()) return;
    const centerId = this.currentCenterId;
    if (
      !window.confirm("Reset all package prices for this center back to global prices?")
    ) {
      return;
    }

    try {
      await this.pricingService.resetAllPackagePrices(centerId);
      this.showSuccess("All package prices reset to global prices");
      if (centerId === this.getSelectedCenterId()) await this.loadPricing(centerId);
    } catch (error) {
      console.error("Error resetting package prices:", error);
      this.showError(error?.message || "Failed to reset package prices");
    }
  }

  async resetSingleTestPrice(testId) {
    if (!this.ensureCenterSelected() || !testId) return;
    const centerId = this.currentCenterId;

    try {
      await this.pricingService.deleteTestPrice(centerId, testId);
      this.showSuccess("Test price reset to global price");
      if (centerId === this.getSelectedCenterId()) await this.loadPricing(centerId);
    } catch (error) {
      console.error("Error resetting single test price:", error);
      this.showError(error?.message || "Failed to reset test price");
    }
  }

  async resetSinglePackagePrice(packageId) {
    if (!this.ensureCenterSelected() || !packageId) return;
    const centerId = this.currentCenterId;

    try {
      await this.pricingService.deletePackagePrice(centerId, packageId);
      this.showSuccess("Package price reset to global price");
      if (centerId === this.getSelectedCenterId()) await this.loadPricing(centerId);
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
