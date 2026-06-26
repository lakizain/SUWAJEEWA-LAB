// Report Entry Controller - Handles UI interactions for report entry
const VALUE_DECIMAL_PLACES = 3;
const THREE_DECIMAL_VALUE_TEST_ID = "3ea45cbd-4b12-4ae1-9983-52e759219e98";

/**
 * 0-based subcategory row indices where manual value entry is skipped (by test UUID).
 * Row numbers shown to users are index + 1 (e.g. index 11 = 12th row).
 */
const SKIP_VALUE_ENTRY_ROW_INDICES_BY_TEST_ID = {
  [THREE_DECIMAL_VALUE_TEST_ID]: new Set([11]),
  "4eb8777d-797c-4fe1-830c-93b30ac71dea": new Set([1, 4, 7]),
};

class ReportEntryController {
  constructor() {
    this.reportEntryService = new window.ReportEntryService();
    this.billingService = new window.BillingService();
    this.testService = new window.TestService();
    this.centerService = new window.CenterService();

    this.currentBills = [];
    this.selectedBill = null;
    this.selectedTestItem = null;
    this.isLoading = false;
    this.testsIndexByName = new Map();
    this.testsById = new Map();

    // Subcategory navigation state for quick entry
    this.currentSubcategories = [];
    this.currentSubcategoryIndex = 0;

    // Performance optimization caches
    this.subcategoriesCache = new Map();
    this.referenceRangesCache = new Map();
    this.suggestionsCache = new Map();

    this.readySelectionKeys = new Set();
    this.readySelectionItems = new Map();

    this.initializeElements();
    this.bindEvents();
    this.loadInitialData();
  }

  // Format reference range for display/print.
  // Rules:
  // - Keep true ranges like "10 - 199"
  // - If only one side exists (e.g. "<140"), do not show a stray "-" like "- <140"
  formatReferenceRange(minValue, maxValue, unitValue) {
    const min = minValue == null ? "" : String(minValue).trim();
    const max = maxValue == null ? "" : String(maxValue).trim();
    const unit = unitValue == null ? "" : String(unitValue).trim();

    // Build core range without forcing a dash
    let core = "";
    if (min && max) core = `${min} - ${max}`;
    else core = min || max || "";

    // Remove single-sided stray dash markers (leading/trailing only)
    // Keep middle dash when both sides exist.
    const hasMiddleDash = /\S\s*-\s*\S/.test(core);
    if (!hasMiddleDash) {
      core = core.replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "").trim();
    } else {
      core = core.trim();
    }

    if (!core) return "";
    return unit ? `${core} ${unit}` : core;
  }

  initializeElements() {
    // Search panel elements
    this.dateFromInput = document.getElementById("dateFrom");
    this.dateToInput = document.getElementById("dateTo");
    this.findBtn = document.querySelector(
      'button.btn.btn-primary[type="button"]'
    );
    this.testFilter = document.getElementById("filterTest");
    this.centerFilter = document.getElementById("filterCenter");
    this.billSearchInput = document.getElementById("filterBillNo");
    this.billSuggestions = document.getElementById("billSuggestions");
    this.clearSearchBtn = document.getElementById("clearSearchBtn");

    // Create a searchable input for Test filter with datalist suggestions
    if (this.testFilter) {
      // Insert input before the existing select
      this.testSearchInput = document.createElement("input");
      this.testSearchInput.type = "text";
      this.testSearchInput.className = "form-control";
      this.testSearchInput.id = "filterTestSearch";
      this.testSearchInput.setAttribute(
        "placeholder",
        "Type to search tests..."
      );

      // Datalist for suggestions
      this.testSearchDatalist = document.createElement("datalist");
      this.testSearchDatalist.id = "testOptions";
      this.testSearchInput.setAttribute("list", this.testSearchDatalist.id);

      // Place input above the select and keep both (select holds the id)
      this.testFilter.parentElement.insertBefore(
        this.testSearchInput,
        this.testFilter
      );
      this.testFilter.parentElement.insertBefore(
        this.testSearchDatalist,
        this.testFilter
      );

      // Hide the original dropdown; we keep it for internal selection state
      this.testFilter.style.display = "none";
    }

    // Results table
    this.resultsTableBody = document.getElementById("resultsTableBody");
    this.resultsTableBodyReady = document.getElementById("resultsTableBodyReady");
    this.resultsItemsBody = document.getElementById("resultsItemsBody");
    this.resultsTableContainer = document.querySelector(
      "#tab-results .table-responsive"
    );
    this.topCategoryInput = document.getElementById("topCategoryInput");
    this.topValueInput = document.getElementById("topValueInput");
    this.valueSuggestionsList = document.getElementById("valueSuggestions");
    this.commentsResultInput = document.getElementById("commentsResultInput");
    this.specialNotesInput = document.getElementById("specialNotesInput");
    if (!this.specialNotesInput && this.commentsResultInput) {
      this.specialNotesInput = this.commentsResultInput;
    }

    // Right-panel results table headers (for Bill list)
    try {
      this.resultsTableHead = this.resultsTableBody
        ? this.resultsTableBody.closest("table")?.querySelector("thead")
        : null;
      this.resultsTableHeadReady = this.resultsTableBodyReady
        ? this.resultsTableBodyReady.closest("table")?.querySelector("thead")
        : null;
    } catch (_) {
      this.resultsTableHead = null;
      this.resultsTableHeadReady = null;
    }

    this.readyReportsEmailInput = document.getElementById("readyReportsEmail");
    this.sendReadyReportsBtn = document.getElementById("sendReadyReportsBtn");
    this.clearReadySelectionBtn = document.getElementById(
      "clearReadySelectionBtn"
    );
    this.readySelectedCountEl = document.getElementById("readySelectedCount");
    this.readySelectAllCheckbox = document.getElementById("readySelectAll");

    // Summary form elements (order in DOM within Summary tab)
    // 0: Report ID, 1: Bill No, 2: Patient, 3: Age, 4: Gender,
    // 5: Test Type, 6: Specimen, 7: Ref. By
    const allTextInputs = document.querySelectorAll('input[type="text"]');
    this.reportIdInput = allTextInputs[0] || null;
    this.billNoInput = allTextInputs[1] || null;
    this.patientNameInput = allTextInputs[2] || null;
    this.titleInput = allTextInputs[3] || null;
    this.ageInput = allTextInputs[4] || null;
    this.genderInput = allTextInputs[5] || null;
    this.testTypeInput = allTextInputs[6] || null;
    this.specimenInput = allTextInputs[7] || null;
    this.refByInput = allTextInputs[8] || null;

    // Action buttons
    this.updateBtn = document.querySelector("button.btn.btn-primary");
    this.previewBtn = document.querySelector(
      "button.btn.btn-outline-secondary"
    );
    this.printReportBtn = document.getElementById("printReportBtn");
    this.editBtn = document.querySelector("button.btn.btn-warning");
    this.printWithSignatureCheckbox =
      document.getElementById("printWithSignature");
  }

  bindEvents() {
    // Date range search
    if (this.findBtn) {
      this.findBtn.addEventListener("click", () =>
        this.handleDateRangeSearch()
      );
    }

    // Test filter change
    if (this.testFilter) {
      this.testFilter.addEventListener("change", () => this.handleTestFilter());
    }

    // Typable test search: choose by name and trigger filtering
    if (this.testSearchInput) {
      this.testSearchInput.addEventListener(
        "input",
        this.debounce(() => this.syncTestSelectFromSearch(), 200)
      );
      this.testSearchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.syncTestSelectFromSearch(true);
        }
      });
      this.testSearchInput.addEventListener("change", () =>
        this.syncTestSelectFromSearch(true)
      );
    }

    // Center filter change
    if (this.centerFilter) {
      this.centerFilter.addEventListener("change", () =>
        this.handleCenterFilter()
      );
    }

    // Bill number search with suggestions
    if (this.billSearchInput) {
      this.billSearchInput.addEventListener(
        "input",
        this.debounce(() => this.handleBillSearch(), 300)
      );
      this.billSearchInput.addEventListener("focus", () =>
        this.showSuggestions()
      );
      this.billSearchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const billNo = this.billSearchInput.value.trim();
          if (billNo) {
            this.selectBillFromSearch(billNo);
          }
        }
      });
    }

    // Clear search button
    if (this.clearSearchBtn) {
      this.clearSearchBtn.addEventListener("click", () => this.clearSearch());
    }

    // Hide suggestions when clicking outside
    document.addEventListener("click", (e) => {
      if (
        this.billSuggestions &&
        !this.billSuggestions.contains(e.target) &&
        e.target !== this.billSearchInput
      ) {
        this.hideSuggestions();
      }
    });

    // Action buttons
    if (this.updateBtn) {
      this.updateBtn.addEventListener("click", () => this.handleSaveAndPrint());
    }
    if (this.previewBtn) {
      this.previewBtn.addEventListener("click", () => this.handlePreview());
    }
    if (this.printReportBtn) {
      this.printReportBtn.addEventListener("click", () =>
        this.handlePrintReport()
      );
    }
    if (this.editBtn) {
      this.editBtn.addEventListener("click", () => this.handleEdit());
    }

    // Handle Enter key to commit value and move to next category
    if (this.topValueInput) {
      this.bindDecimalConstraint(this.topValueInput, () =>
        this.getValueDecimalPlacesForCurrentTest()
      );
      this.topValueInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.commitTopValueAndAdvance();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          this.navigateSubcategory(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this.navigateSubcategory(-1);
        }
      });
    }

    if (this.readyReportsEmailInput) {
      this.readyReportsEmailInput.addEventListener("input", () =>
        this.updateReadySendControls()
      );
    }
    if (this.sendReadyReportsBtn) {
      this.sendReadyReportsBtn.addEventListener("click", () =>
        this.handleSendReadyReports()
      );
    }
    if (this.clearReadySelectionBtn) {
      this.clearReadySelectionBtn.addEventListener("click", () =>
        this.clearReadySelection()
      );
    }
    if (this.readySelectAllCheckbox) {
      this.readySelectAllCheckbox.addEventListener("change", () =>
        this.toggleSelectAllReadyRows(Boolean(this.readySelectAllCheckbox.checked))
      );
    }
  }

  async loadInitialData() {
    try {
      this.setLoading(true);

      // Set today's date as default
      const today = new Date().toISOString().split("T")[0];
      if (this.dateFromInput) this.dateFromInput.value = today;
      if (this.dateToInput) this.dateToInput.value = today;

      // Load today's bills
      await this.loadTodaysBills();

      // Populate dropdowns
      await this.populateDropdowns();

      // Periodically refresh table row colors for overdue computation
      try {
        if (this._overdueTimer) clearInterval(this._overdueTimer);
        this._overdueTimer = setInterval(() => {
          // Only re-render rows; do not fetch again
          this.renderBillsTable();
          this.highlightSelectedRow();
        }, 60000); // every 1 minute
      } catch (_) {}
    } catch (error) {
      console.error("Error loading initial data:", error);
      this.showError("Failed to load initial data");
    } finally {
      this.setLoading(false);
    }
  }

  // Keyboard navigation across subcategory rows using Up/Down arrows
  navigateSubcategory(delta) {
    if (!this.currentSubcategories || this.currentSubcategories.length === 0)
      return;

    const isVisibleNonEmptyAt = (i) => {
      if (this.isSkippedValueEntryRowIndex(i)) return false;
      const sub = this.currentSubcategories[i];
      if (!sub || !this.resultsItemsBody) return false;
      const row = this.resultsItemsBody.querySelector(
        `tr[data-subcategory-id="${sub.id}"]`
      );
      const cell = row?.querySelector("td:nth-child(1)");
      if (!cell) return false;
      const raw = (cell.textContent || "").replace(/\u00a0/g, " ").trim();
      return raw.length > 0;
    };

    let targetIndex = this.currentSubcategoryIndex;
    if (delta > 0) {
      // find next non-empty after current
      for (
        let i = this.currentSubcategoryIndex + 1;
        i < this.currentSubcategories.length;
        i++
      ) {
        if (isVisibleNonEmptyAt(i)) {
          targetIndex = i;
          break;
        }
      }
    } else if (delta < 0) {
      // find previous non-empty before current
      for (let i = this.currentSubcategoryIndex - 1; i >= 0; i--) {
        if (isVisibleNonEmptyAt(i)) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === this.currentSubcategoryIndex) return;

    this.currentSubcategoryIndex = targetIndex;

    const current = this.currentSubcategories[targetIndex];
    if (this.topCategoryInput) {
      // Prefer visible text from the table to reflect suppressed empty names
      const row = this.resultsItemsBody?.querySelector(
        `tr[data-subcategory-id="${current.id}"]`
      );
      const cell = row?.querySelector("td:nth-child(1)");
      const vis = (cell?.textContent || "").replace(/\u00a0/g, " ").trim();
      this.topCategoryInput.value = vis || "";
    }

    // Mirror the row's current value into the top value input
    const row = this.resultsItemsBody?.querySelector(
      `tr[data-subcategory-id="${current.id}"]`
    );
    const valueInput = row?.querySelector("td:nth-child(2) input");
    const currentValue = (valueInput?.value || "").trim();
    if (this.topValueInput) {
      this.topValueInput.value = currentValue;
      this.topValueInput.focus();
      this.topValueInput.select();
    }

    // Update row highlight
    this.highlightSelectedSubcategoryRow();
  }

  async loadTodaysBills() {
    try {
      this.currentBills = await this.reportEntryService.getTodaysBills();
      this.renderBillsTable();
    } catch (error) {
      console.error("Error loading today's bills:", error);
      this.showError("Failed to load today's bills");
    }
  }

  async populateDropdowns() {
    try {
      // Load tests
      const tests = await this.testService.getActiveTests();
      if (this.testFilter) {
        this.testFilter.innerHTML = '<option value="all">All</option>';
        // reset indices
        this.testsIndexByName.clear();
        this.testsById.clear();
        tests.forEach((test) => {
          const option = document.createElement("option");
          option.value = test.id;
          option.textContent = test.test_name;
          this.testFilter.appendChild(option);

          // index for search
          if (test.id != null) this.testsById.set(String(test.id), test);
          if (test.test_name)
            this.testsIndexByName.set(
              test.test_name.toLowerCase(),
              String(test.id)
            );
        });
      }

      // Populate datalist suggestions
      if (this.testSearchDatalist) {
        this.testSearchDatalist.innerHTML = "";
        const allOpt = document.createElement("option");
        allOpt.value = "All";
        this.testSearchDatalist.appendChild(allOpt);
        tests.forEach((test) => {
          const opt = document.createElement("option");
          opt.value = test.test_name;
          this.testSearchDatalist.appendChild(opt);
        });
      }

      // Load centers
      const centers = await this.centerService.getActiveCenters();
      if (this.centerFilter) {
        this.centerFilter.innerHTML = '<option value="all">All</option>';
        centers.forEach((center) => {
          const option = document.createElement("option");
          option.value = center.id;
          option.textContent = center.center_name;
          this.centerFilter.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error populating dropdowns:", error);
    }
  }

  renderBillsTable() {
    if (!this.resultsTableBody) return;

    // Clear both tables
    this.resultsTableBody.innerHTML = "";
    if (this.resultsTableBodyReady) this.resultsTableBodyReady.innerHTML = "";
    this.readySelectionItems.clear();

    if (this.currentBills.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML =
        '<td colspan="4" class="text-muted">No bills found for today</td>';
      this.resultsTableBody.appendChild(row);
      this.pruneReadySelectionToVisible();
      this.updateReadySendControls();
      return;
    }

    const appendRow = (targetBody, bill, item, status) => {
      const testName = item
        ? item.tests?.test_name || item.packages?.package_name || "-"
        : "-";
      // Determine overdue based on bill time + test duration (minutes)
      let effectiveStatus = status;
      try {
        const createdAt = bill.created_at || bill.bill_date;
        const durationMin =
          (item && (item.tests?.duration ?? null)) != null
            ? Number(item.tests.duration)
            : null;
        if (
          status !== "ready" &&
          status !== "completed" &&
          createdAt &&
          durationMin != null &&
          !Number.isNaN(durationMin)
        ) {
          const start = new Date(createdAt).getTime();
          const endsAt = start + durationMin * 60 * 1000;
          if (Date.now() > endsAt) {
            effectiveStatus = "overdue";
          }
        }
      } catch (_) {}

      let statusClass;
      switch (effectiveStatus) {
        case "ready":
          statusClass = "report-status-ready";
          break;
        case "completed":
          statusClass = "report-status-completed";
          break;
        case "overdue":
          statusClass = "report-status-overdue";
          break;
        default:
          statusClass = "report-status-pending";
          break;
      }
      const statusBadge = this.createStatusBadge(effectiveStatus);

      const row = document.createElement("tr");
      row.className = statusClass;
      const isReadyRow = Boolean(
        this.resultsTableBodyReady && targetBody === this.resultsTableBodyReady
      );
      if (isReadyRow) {
        const key = this.getReadySelectionKey(bill, item);
        row.dataset.readyKey = key;
        this.readySelectionItems.set(key, {
          key,
          billId: bill?.id == null ? null : String(bill.id),
          billNo: bill?.bill_no == null ? "" : String(bill.bill_no),
          patientName: bill?.patient_name == null ? "" : String(bill.patient_name),
          billItemId: item?.id == null ? null : String(item.id),
          testName: testName == null ? "" : String(testName),
          status: effectiveStatus,
        });
        row.innerHTML = `
          <td>
            <input class="form-check-input ready-row-check" type="checkbox" ${
              this.readySelectionKeys.has(key) ? "checked" : ""
            } data-ready-key="${this.safeText(key)}">
          </td>
          <td>${this.safeText(bill.bill_no)}</td>
          <td>${this.safeText(bill.patient_name)}</td>
          <td>${this.safeText(testName)}</td>
          <td>${statusBadge}</td>
        `;
      } else {
        row.innerHTML = `
          <td>${this.safeText(bill.bill_no)}</td>
          <td>${this.safeText(bill.patient_name)}</td>
          <td>${this.safeText(testName)}</td>
          <td>${statusBadge}</td>
        `;
      }
      row.addEventListener("click", () => this.selectBill(bill, item || null));
      targetBody.appendChild(row);

      if (isReadyRow) {
        const cb = row.querySelector("input.ready-row-check");
        if (cb) {
          cb.addEventListener("click", (e) => e.stopPropagation());
          cb.addEventListener("change", (e) => {
            e.stopPropagation();
            const k = cb.getAttribute("data-ready-key") || "";
            if (!k) return;
            if (cb.checked) this.readySelectionKeys.add(k);
            else this.readySelectionKeys.delete(k);
            this.syncReadySelectAllCheckboxState();
            this.updateReadySendControls();
          });
        }
      }
    };

    this.currentBills.forEach((bill) => {
      const items = bill.bill_items || [];

      if (items.length === 0) {
        const status = bill.report_status || "pending";
        // Show bills without items only in Pending when not ready
        if (status !== "ready") {
          appendRow(this.resultsTableBody, bill, null, status);
        } else if (this.resultsTableBodyReady) {
          appendRow(this.resultsTableBodyReady, bill, null, status);
        }
        return;
      }

      items.forEach((item) => {
        const status = item.report_status || "pending";
        if (status === "ready") {
          if (this.resultsTableBodyReady) {
            appendRow(this.resultsTableBodyReady, bill, item, status);
          }
        } else {
          appendRow(this.resultsTableBody, bill, item, status);
        }
      });
    });

    this.pruneReadySelectionToVisible();
    this.syncReadySelectAllCheckboxState();
    this.updateReadySendControls();
  }

  getReadySelectionKey(bill, item) {
    const billItemId = item?.id != null ? String(item.id) : "";
    if (billItemId) return `bill_item:${billItemId}`;
    const billId = bill?.id != null ? String(bill.id) : "";
    if (billId) return `bill:${billId}`;
    const billNo = bill?.bill_no != null ? String(bill.bill_no) : "";
    return billNo ? `bill_no:${billNo}` : "bill_no:-";
  }

  pruneReadySelectionToVisible() {
    if (!this.resultsTableBodyReady) {
      this.readySelectionKeys.clear();
      return;
    }
    const visibleKeys = new Set(
      Array.from(this.resultsTableBodyReady.querySelectorAll("tr"))
        .map((tr) => tr.dataset.readyKey)
        .filter(Boolean)
    );
    Array.from(this.readySelectionKeys).forEach((k) => {
      if (!visibleKeys.has(k)) this.readySelectionKeys.delete(k);
    });
  }

  syncReadySelectAllCheckboxState() {
    if (!this.readySelectAllCheckbox || !this.resultsTableBodyReady) return;
    const boxes = Array.from(
      this.resultsTableBodyReady.querySelectorAll("input.ready-row-check")
    );
    if (boxes.length === 0) {
      this.readySelectAllCheckbox.checked = false;
      this.readySelectAllCheckbox.indeterminate = false;
      return;
    }
    const checkedCount = boxes.filter((b) => b.checked).length;
    this.readySelectAllCheckbox.checked = checkedCount === boxes.length;
    this.readySelectAllCheckbox.indeterminate =
      checkedCount > 0 && checkedCount < boxes.length;
  }

  toggleSelectAllReadyRows(checked) {
    if (!this.resultsTableBodyReady) return;
    const boxes = Array.from(
      this.resultsTableBodyReady.querySelectorAll("input.ready-row-check")
    );
    boxes.forEach((cb) => {
      const key = cb.getAttribute("data-ready-key") || "";
      cb.checked = checked;
      if (key) {
        if (checked) this.readySelectionKeys.add(key);
        else this.readySelectionKeys.delete(key);
      }
    });
    this.syncReadySelectAllCheckboxState();
    this.updateReadySendControls();
  }

  clearReadySelection() {
    this.readySelectionKeys.clear();
    if (this.resultsTableBodyReady) {
      Array.from(
        this.resultsTableBodyReady.querySelectorAll("input.ready-row-check")
      ).forEach((cb) => {
        cb.checked = false;
      });
    }
    this.syncReadySelectAllCheckboxState();
    this.updateReadySendControls();
  }

  updateReadySendControls() {
    const selectedCount = Array.from(this.readySelectionKeys).filter((k) =>
      this.readySelectionItems.has(k)
    ).length;
    if (this.readySelectedCountEl)
      this.readySelectedCountEl.textContent = String(selectedCount);

    const hasSelection = selectedCount > 0;
    const emailValue = (this.readyReportsEmailInput?.value || "").trim();
    const emailLooksValid =
      this.readyReportsEmailInput?.type === "email"
        ? this.readyReportsEmailInput.checkValidity()
        : emailValue.includes("@");
    if (this.sendReadyReportsBtn)
      this.sendReadyReportsBtn.disabled = !(hasSelection && emailLooksValid);
    if (this.clearReadySelectionBtn)
      this.clearReadySelectionBtn.disabled = !hasSelection;
  }

  async handleSendReadyReports() {
    try {
      const email = (this.readyReportsEmailInput?.value || "").trim();
      if (!email) {
        this.showError("Please enter an email address");
        return;
      }
      if (this.readyReportsEmailInput && !this.readyReportsEmailInput.checkValidity()) {
        this.readyReportsEmailInput.reportValidity();
        return;
      }

      const items = Array.from(this.readySelectionKeys)
        .map((k) => this.readySelectionItems.get(k))
        .filter(Boolean);

      if (items.length === 0) {
        this.showError("Please select at least one test from Ready Reports");
        return;
      }

      if (this.sendReadyReportsBtn) this.sendReadyReportsBtn.disabled = true;
      const res = await this.reportEntryService.sendReadyReportsByEmail(
        email,
        items
      );
      if (res && res.success) {
        this.showSuccess(res.message || "Email sent");
        this.clearReadySelection();
      } else {
        this.showError(res?.message || "Failed to send email");
      }
    } catch (e) {
      console.error("Failed to send ready reports", e);
      this.showError("Failed to send email");
    } finally {
      this.updateReadySendControls();
    }
  }

  // Auto-calc for specific tests by ID (UUID). Add rules here as needed.
  wireAutoCalcForSpecificTests(testId, subcategories) {
    // Map of test-specific calculators keyed by test UUID
    const calculators = {
      // d683...: custom row formulas using 1-based row numbers
      "d683c8f0-f901-465d-bb3d-1fee6282ebca": (inputs) => {
        const parse = (el) => {
          const raw = (el?.value || "").trim();
          const n = raw === "" ? null : Number(raw);
          return Number.isNaN(n) ? null : n;
        };

        if (!Array.isArray(inputs) || inputs.length < 6) return;

        // 1-based row numbers -> 0-based indices
        const i1 = 0, i2 = 1, i3 = 2, i4 = 3, i5 = 4, i6 = 5;

        const v1 = parse(inputs[i1]);
        const v2 = parse(inputs[i2]);
        const v3 = parse(inputs[i3]);

        // Guard re-entrancy
        if (this._autoCalcLock) return;
        this._autoCalcLock = true;
        try {
          const calcDp = 2;
          const fmtFixed = (n) =>
            n == null || !Number.isFinite(n) ? "" : Number(n).toFixed(calcDp);
          const r6 = v3 == null ? null : v3 / 5;
          // Row 6 is calculated; keep trailing zeros to always show 2 decimal places
          if (inputs[i6]) inputs[i6].value = fmtFixed(r6);

          const r4 = (v1 == null || v2 == null || r6 == null) ? null : v1 - v2 - r6;
          // Row 4 is calculated; keep trailing zeros to always show 2 decimal places
          if (inputs[i4]) inputs[i4].value = fmtFixed(r4);

          const r5 = (v1 == null || v2 == null || v2 === 0) ? null : v1 / v2;
          if (inputs[i5]) inputs[i5].value = this.formatValueForInput(r5, true, calcDp);

          // Trigger remark updates for affected rows
          [i4, i5, i6].forEach((idx) => {
            const el = inputs[idx];
            if (el) el.dispatchEvent(new Event("input", { bubbles: true }));
          });
        } finally {
          this._autoCalcLock = false;
        }
      },
      // b3ca9595...: ROW3 = ROW1 - ROW2; ROW4 = ROW1 / ROW2
      "b3ca9595-a144-4bea-a219-c315b6f95a59": (inputs) => {
        const parse = (el) => {
          const raw = (el?.value || "").trim();
          const n = raw === "" ? null : Number(raw);
          return Number.isNaN(n) ? null : n;
        };

        if (!Array.isArray(inputs) || inputs.length < 4) return;

        const i1 = 0, i2 = 1, i3 = 2, i4 = 3;
        const v1 = parse(inputs[i1]);
        const v2 = parse(inputs[i2]);

        if (this._autoCalcLock) return;
        this._autoCalcLock = true;
        try {
          // ROW3 = ROW1 - ROW2
          const r3 = (v1 == null || v2 == null) ? null : (v1 - v2);
          if (inputs[i3]) inputs[i3].value = this.formatValueForInput(r3);

          // ROW4 = ROW1 / ROW2
          const r4 = (v1 == null || v2 == null || v2 === 0) ? null : (v1 / v2);
          if (inputs[i4]) inputs[i4].value = this.formatValueForInput(r4);

          // Trigger remark updates for affected rows
          [i3, i4].forEach((idx) => {
            const el = inputs[idx];
            if (el) el.dispatchEvent(new Event("input", { bubbles: true }));
          });
        } finally {
          this._autoCalcLock = false;
        }
      },
      // ba643e33...: ROW5 = ROW6 + ROW7
      "ba643e33-6ec9-4de7-b9d2-e266102cbb40": (inputs) => {
        const parse = (el) => {
          const raw = (el?.value || "").trim();
          const n = raw === "" ? null : Number(raw);
          return Number.isNaN(n) ? null : n;
        };

        if (!Array.isArray(inputs) || inputs.length < 7) return;

        const i5 = 4, i6 = 5, i7 = 6;
        const v6 = parse(inputs[i6]);
        const v7 = parse(inputs[i7]);

        if (this._autoCalcLock) return;
        this._autoCalcLock = true;
        try {
          const r5 = (v6 == null || v7 == null) ? null : (v6 + v7);
          if (inputs[i5]) inputs[i5].value = this.formatValueForInput(r5);

          // Trigger remark updates for affected rows
          [i5].forEach((idx) => {
            const el = inputs[idx];
            if (el) el.dispatchEvent(new Event("input", { bubbles: true }));
          });
        } finally {
          this._autoCalcLock = false;
        }
      },
      // 9517c4cb...: ROW3 = ROW1 - ROW2; ROW4 = ROW2 / ROW3
      "9517c4cb-95fa-4aa5-86bd-2babfe6d59ce": (inputs) => {
        const parse = (el) => {
          const raw = (el?.value || "").trim();
          const n = raw === "" ? null : Number(raw);
          return Number.isNaN(n) ? null : n;
        };

        if (!Array.isArray(inputs) || inputs.length < 4) return;

        const i1 = 0, i2 = 1, i3 = 2, i4 = 3;
        const v1 = parse(inputs[i1]);
        const v2 = parse(inputs[i2]);

        if (this._autoCalcLock) return;
        this._autoCalcLock = true;
        try {
          // ROW3 = ROW1 - ROW2
          const r3 = (v1 == null || v2 == null) ? null : (v1 - v2);
          if (inputs[i3]) inputs[i3].value = this.formatValueForInput(r3);

          // ROW4 = ROW2 / ROW3
          const r4 = (v2 == null || r3 == null || r3 === 0) ? null : (v2 / r3);
          if (inputs[i4]) inputs[i4].value = this.formatValueForInput(r4);

          // Trigger remark updates for affected rows
          [i3, i4].forEach((idx) => {
            const el = inputs[idx];
            if (el) el.dispatchEvent(new Event("input", { bubbles: true }));
          });
        } finally {
          this._autoCalcLock = false;
        }
      },
      // 3b5166cc...: BMI test — ROW1=Age, ROW2=Height, ROW3=Weight; ROW4=BMI; ROW5=Ideal Weight Range
      "3b5166cc-755f-433e-833c-7e8c746c13ce": (inputs) => {
        const parse = (el) => {
          const raw = (el?.value || "").trim();
          const n = raw === "" ? null : Number(raw);
          return Number.isNaN(n) ? null : n;
        };

        if (!Array.isArray(inputs) || inputs.length < 5) return;

        const iHeight = 1, iWeight = 2, iBmi = 3, iIdeal = 4;
        const calcDp = 1;
        const height = parse(inputs[iHeight]);
        const weight = parse(inputs[iWeight]);

        if (this._autoCalcLock) return;
        this._autoCalcLock = true;
        try {
          // Height entered in cm → convert to metres
          const heightM = height == null ? null : height / 100;

          const bmi =
            weight == null || heightM == null || heightM === 0
              ? null
              : weight / (heightM * heightM);
          if (inputs[iBmi]) {
            inputs[iBmi].value = this.formatValueForInput(bmi, true, calcDp);
          }

          // Ideal weight range from normal BMI 18.5–24.9 (kg)
          let idealRange = "";
          if (heightM != null && heightM > 0) {
            const fmt = (v) => this.formatValueForInput(v, true, calcDp);
            const minW = 18.5 * heightM * heightM;
            const maxW = 24.9 * heightM * heightM;
            idealRange = `${fmt(minW)} - ${fmt(maxW)}`;
          }
          if (inputs[iIdeal]) inputs[iIdeal].value = idealRange;

          [iBmi, iIdeal].forEach((idx) => {
            const el = inputs[idx];
            if (el) el.dispatchEvent(new Event("input", { bubbles: true }));
          });
        } finally {
          this._autoCalcLock = false;
        }
      },
    };

    if (!testId || !calculators[testId] || !this.resultsItemsBody) return;

    // Collect all value inputs in row order
    const inputs = [];
    subcategories.forEach((sub) => {
      const row = this.resultsItemsBody.querySelector(`tr[data-subcategory-id="${sub.id}"]`);
      const valInput = row?.querySelector("td:nth-child(2) input");
      inputs.push(valInput || null);
    });

    const runCalc = () => calculators[testId].call(this, inputs);

    const sourceRowIndicesByTestId = {
      "d683c8f0-f901-465d-bb3d-1fee6282ebca": [0, 1, 2],
      "b3ca9595-a144-4bea-a219-c315b6f95a59": [0, 1],
      "ba643e33-6ec9-4de7-b9d2-e266102cbb40": [5, 6],
      "9517c4cb-95fa-4aa5-86bd-2babfe6d59ce": [0, 1],
      "3b5166cc-755f-433e-833c-7e8c746c13ce": [1, 2],
    };

    // Recalculate when source rows change
    (sourceRowIndicesByTestId[testId] || [0, 1, 2]).forEach((idx) => {
      const el = inputs[idx];
      if (!el) return;
      el.addEventListener("input", runCalc);
      el.addEventListener("change", runCalc);
    });

    // Protect auto-calculated target rows from manual edits by making them readOnly
    const outputsByTest = {
      "d683c8f0-f901-465d-bb3d-1fee6282ebca": [3, 4, 5], // rows 4,5,6
      "b3ca9595-a144-4bea-a219-c315b6f95a59": [2, 3],     // rows 3,4
      "ba643e33-6ec9-4de7-b9d2-e266102cbb40": [4],        // row 5
      "9517c4cb-95fa-4aa5-86bd-2babfe6d59ce": [2, 3],     // rows 3,4
      "3b5166cc-755f-433e-833c-7e8c746c13ce": [3, 4],     // rows 4,5: BMI, Ideal Weight Range
    };

    const outputs = outputsByTest[testId] || [];
    outputs.forEach((idx) => {
      const el = inputs[idx];
      if (!el) return;
      // Prevent manual typing
      try { el.readOnly = true; } catch (_) {}
      // If any value slips in (e.g., programmatic), immediately re-calc to restore
      el.addEventListener("input", runCalc);
      el.addEventListener("change", runCalc);
    });

    // Initial calculation (in case values pre-filled)
    runCalc();
  }

  selectBill(bill, selectedTestItem = null) {
    this.selectedBill = bill;
    this.selectedTestItem = selectedTestItem;
    this.populateSummaryForm(bill, selectedTestItem);
    this.renderTestResults(bill, selectedTestItem);
    this.highlightSelectedRow();

    // Load report header (comments/special notes) for selected test item, if any
    if (selectedTestItem?.id) {
      this.loadReportHeaderForItem(selectedTestItem.id);
    } else {
      // Clear header fields when no specific item selected
      if (this.commentsResultInput) this.commentsResultInput.value = "";
      if (this.specialNotesInput) this.specialNotesInput.value = "";
    }

    // Auto-focus on Value field when a test is selected
    this.focusValueFieldAfterSelection();

    // Trigger Patient Report History load based on patient's phone number
    try {
      const phone = (bill && bill.patient_phone) ? String(bill.patient_phone) : "";
      if (window.PatientHistoryLoader && typeof window.PatientHistoryLoader.loadByPhone === "function") {
        window.PatientHistoryLoader.loadByPhone(phone);
      } else {
        // Fallback: set the input directly so user can press Load
        const phoneInput = document.getElementById("historyPhoneInput");
        if (phoneInput) phoneInput.value = phone;
      }
    } catch (_) {}
  }

  // Public: load by bill number and test name from external UI (history table)
  async selectBillByNumberAndTest(billNo, testNameRaw) {
    try {
      const billNumber = (billNo || "").toString().trim();
      const testName = (testNameRaw || "").toString().trim();
      if (!billNumber) return;

      this.setLoading(true);

      // Fetch specific bill
      const bill = await this.reportEntryService.getBillByNumber(billNumber);
      if (!bill) {
        this.showError("Bill not found");
        return;
      }

      // Set as current and render tables
      this.currentBills = [bill];
      this.renderBillsTable();

      // Try to find matching test item by name (test or package)
      let selectedItem = null;
      const items = Array.isArray(bill.bill_items) ? bill.bill_items : [];
      if (testName) {
        const norm = (s) => (s || "").toString().trim().toLowerCase();
        const target = norm(testName);
        selectedItem = items.find((it) => {
          const name = norm(it?.tests?.test_name || it?.packages?.package_name);
          return name === target;
        }) || null;
      }

      // Select bill with (or without) a specific item
      this.selectBill(bill, selectedItem || null);
    } catch (e) {
      console.error("selectBillByNumberAndTest failed", e);
      this.showError("Failed to load report details");
    } finally {
      this.setLoading(false);
    }
  }

  populateSummaryForm(bill, selectedTestItem = null) {
    if (!bill) return;

    // Populate summary form fields
    if (this.reportIdInput) this.reportIdInput.value = bill.bill_no || "";
    if (this.patientNameInput)
      this.patientNameInput.value = bill.patient_name || "";
    if (this.titleInput) this.titleInput.value = bill.patient_title || "";
    if (this.ageInput)
      this.ageInput.value = this.formatAge(
        bill.patient_age_years,
        bill.patient_age_months,
        bill.patient_age_days
      );
    if (this.genderInput) this.genderInput.value = bill.patient_gender || "";

    // If a specific test is selected, show only that test
    if (selectedTestItem) {
      const testName =
        selectedTestItem.tests?.test_name ||
        selectedTestItem.packages?.package_name ||
        "";
      if (this.testTypeInput) this.testTypeInput.value = testName;
    } else {
      // Show all tests if no specific test selected
      if (this.testTypeInput)
        this.testTypeInput.value = this.getTestTypes(bill);
    }

    if (this.refByInput) this.refByInput.value = bill.ref_by || "";
    if (this.billNoInput) this.billNoInput.value = bill.bill_no || "";

    // If a specific test is selected, show specimen for that test
    if (selectedTestItem) {
      const specimen = this.getSpecimenForTest(selectedTestItem);
      if (this.specimenInput) this.specimenInput.value = specimen;
    } else {
      if (this.specimenInput)
        this.specimenInput.value = this.getSpecimenTypes(bill);
    }
  }

  async renderTestResults(bill, selectedTestItem = null) {
    if (!this.resultsItemsBody || !bill) return;

    // Show loading indicator
    this.showTableLoading();

    const items = bill.bill_items || [];
    if (items.length === 0) {
      this.resultsItemsBody.innerHTML =
        '<tr><td colspan="5" class="text-muted">No test items for this bill</td></tr>';
      return;
    }

    // If only one test item exists, use it by default
    if (!selectedTestItem && items.length === 1) {
      selectedTestItem = items[0];
      this.selectedTestItem = selectedTestItem;
    }

    // If a specific test is selected, render that test's subcategories
    if (
      selectedTestItem &&
      (selectedTestItem.tests?.id || selectedTestItem.test_id)
    ) {
      try {
        const testId = selectedTestItem.tests?.id || selectedTestItem.test_id;

        // Check cache first
        let subcategories = this.subcategoriesCache.get(testId);
        if (!subcategories) {
          subcategories = await this.testService.getTestSubcategories(testId);
          this.subcategoriesCache.set(testId, subcategories);
        }

        if (!subcategories || subcategories.length === 0) {
          this.resultsItemsBody.innerHTML =
            '<tr><td colspan="5" class="text-muted">No sub-categories found for this test</td></tr>';
          if (this.topCategoryInput) this.topCategoryInput.value = "";
          return;
        }

        // Track and fill top Category with the first non-empty subcategory name
        this.currentSubcategories = subcategories;
        const firstNonEmptyIndex =
          this.findFirstNonEmptySubcategory(subcategories);
        this.currentSubcategoryIndex = firstNonEmptyIndex;

        if (this.topCategoryInput) {
          const initialSub =
            firstNonEmptyIndex < subcategories.length
              ? subcategories[firstNonEmptyIndex]
              : null;
          if (initialSub && this.resultsItemsBody) {
            const row = this.resultsItemsBody.querySelector(
              `tr[data-subcategory-id="${initialSub.id}"]`
            );
            const cell = row?.querySelector("td:nth-child(1)");
            const vis = (cell?.textContent || "").replace(/\u00a0/g, " ").trim();
            this.topCategoryInput.value = vis || "";
          } else {
            this.topCategoryInput.value = "";
          }
        }

        // Render table rows immediately using DocumentFragment for better performance
        this.renderTableRows(subcategories);

        // Load data in parallel for better performance
        const initialSub =
          firstNonEmptyIndex < subcategories.length
            ? subcategories[firstNonEmptyIndex]
            : null;

        // Start parallel loading of all data
        const loadPromises = [
          initialSub
            ? this.loadSuggestionsForSubcategory(initialSub.id)
            : Promise.resolve(),
          this.populateRefRangesForSubcategories(subcategories),
          this.fillSavedSubcategoryResults(subcategories),
        ];

        // Wait for all data to load
        await Promise.all(loadPromises);

        // Wire auto-remark based on value changes
        this.wireValueAutoRemark(subcategories);

        // Wire specific auto-calculations for targeted tests (by UUID)
        try {
          const currentTestId = this.selectedTestItem?.tests?.id || this.selectedTestItem?.test_id || null;
          this.wireAutoCalcForSpecificTests(currentTestId, subcategories);
        } catch (_) {}

        // Highlight the initially selected subcategory row
        this.highlightSelectedSubcategoryRow();

        // Focus on Value field after everything is loaded
        this.focusValueFieldAfterSelection();
        return;
      } catch (err) {
        console.error("Error loading subcategories for test:", err);
        const errorRow = document.createElement("tr");
        errorRow.innerHTML =
          '<td colspan="4" class="text-danger">Failed to load sub-categories</td>';
        this.resultsItemsBody.appendChild(errorRow);
        return;
      }
    } else {
      // Show all tests if no specific test selected
      items.forEach((item) => {
        const category =
          item.tests?.test_name || item.packages?.package_name || "-";
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${this.safeText(category)}</td>
          <td><input type="text" class="form-control form-control-sm" placeholder="Enter value"></td>
          <td>-</td>
          <td><select class="form-select form-select-sm"><option>Normal</option><option>Abnormal</option><option>Critical</option></select></td>
        `;
        const itemTestId = item.tests?.id || item.test_id || null;
        const dp = this.getValueDecimalPlacesForTest(itemTestId);
        this.bindDecimalConstraint(
          row.querySelector("td:nth-child(2) input"),
          dp
        );
        this.resultsItemsBody.appendChild(row);
      });
    }
  }

  // Handle clicking a subcategory row: load its Category and current Value into top fields
  handleSubcategoryRowClick(subcategoryId) {
    if (!this.currentSubcategories || !this.resultsItemsBody) return;
    let index = this.currentSubcategories.findIndex(
      (s) => s.id === subcategoryId
    );
    if (index === -1) return;

    if (this.isSkippedValueEntryRowIndex(index)) {
      let target = this.findNextValueEntryEligibleIndex(index + 1, 1);
      if (target >= this.currentSubcategories.length) {
        target = this.findNextValueEntryEligibleIndex(index - 1, -1);
      }
      if (target < 0 || target >= this.currentSubcategories.length) return;
      index = target;
      subcategoryId = this.currentSubcategories[index].id;
    }

    this.currentSubcategoryIndex = index;

    const sub = this.currentSubcategories[index];
    if (this.topCategoryInput) {
      this.topCategoryInput.value = sub?.subcategory_name || "";
    }

    const row = this.resultsItemsBody.querySelector(
      `tr[data-subcategory-id="${subcategoryId}"]`
    );
    const valueInput = row?.querySelector("td:nth-child(2) input");
    const currentValue = (valueInput?.value || "").trim();
    if (this.topValueInput) {
      this.topValueInput.value = currentValue;
      // Focus and select the text in the Value field
      this.topValueInput.focus();
      this.topValueInput.select();
    }

    // Update highlight to this selected row
    this.highlightSelectedSubcategoryRow();

    // Load suggestions for this subcategory
    this.loadSuggestionsForSubcategory(subcategoryId);
  }

  // Put top Value into current row and advance Category header
  commitTopValueAndAdvance() {
    if (!this.resultsItemsBody) return;
    if (!this.currentSubcategories || this.currentSubcategories.length === 0)
      return;

    // helper: find next index with a visible non-empty category cell starting from 'fromIdx'
    const findNextVisibleNonEmptyIndex = (fromIdx) => {
      for (let i = fromIdx; i < this.currentSubcategories.length; i++) {
        if (this.isSkippedValueEntryRowIndex(i)) continue;
        const sub = this.currentSubcategories[i];
        const row = this.resultsItemsBody.querySelector(
          `tr[data-subcategory-id="${sub.id}"]`
        );
        const cell = row?.querySelector("td:nth-child(1)");
        const raw = (cell?.textContent || "").replace(/\u00a0/g, " ").trim();
        if (raw.length > 0) return i;
      }
      return this.currentSubcategories.length; // sentinel beyond end
    };

    // Ensure we are at a non-empty category; if current is empty, skip forward
    let currentIndex = findNextVisibleNonEmptyIndex(this.currentSubcategoryIndex);
    if (currentIndex >= this.currentSubcategories.length) {
      // nothing to commit; clear header and finish
      if (this.topCategoryInput) this.topCategoryInput.value = "";
      this.topValueInput?.blur();
      return;
    }

    const current = this.currentSubcategories[currentIndex];
    const dp = this.getValueDecimalPlacesForCurrentTest();
    const value = this.limitValueInputToDecimals(
      (this.topValueInput?.value || "").trim(),
      true,
      dp
    );

    // Set value into the correct row's Value input
    const row = this.resultsItemsBody.querySelector(
      `tr[data-subcategory-id="${current.id}"]`
    );
    const valueInput = row?.querySelector("td:nth-child(2) input");
    if (valueInput) valueInput.value = value;

    // Trigger remark update if wired
    valueInput?.dispatchEvent(new Event("input", { bubbles: true }));

    // Clear top value field
    if (this.topValueInput) this.topValueInput.value = "";

    // Advance to the next non-empty category
    const nextIndex = findNextVisibleNonEmptyIndex(currentIndex + 1);
    if (nextIndex < this.currentSubcategories.length) {
      this.currentSubcategoryIndex = nextIndex;
      const next = this.currentSubcategories[nextIndex];
      if (this.topCategoryInput) {
        const nextRow = this.resultsItemsBody.querySelector(
          `tr[data-subcategory-id="${next.id}"]`
        );
        const nextCell = nextRow?.querySelector("td:nth-child(1)");
        const vis = (nextCell?.textContent || "").replace(/\u00a0/g, " ").trim();
        this.topCategoryInput.value = vis || "";
      }
      // Update selected row highlight
      this.highlightSelectedSubcategoryRow();
      // Load suggestions for next
      this.loadSuggestionsForSubcategory(next.id);
      this.topValueInput?.focus();
    } else {
      // At last subcategory: stay selected and keep highlight (do not clear)
      this.currentSubcategoryIndex = currentIndex;
      if (this.topCategoryInput) {
        const curRow = this.resultsItemsBody.querySelector(
          `tr[data-subcategory-id="${current.id}"]`
        );
        const curCell = curRow?.querySelector("td:nth-child(1)");
        const vis = (curCell?.textContent || "").replace(/\u00a0/g, " ").trim();
        this.topCategoryInput.value = vis || "";
      }
      this.highlightSelectedSubcategoryRow();
      // Keep current suggestions for last
      this.topValueInput?.focus();
    }
  }

  // Populate suggestions for current subcategory to the datalist
  async loadSuggestionsForSubcategory(subcategoryId) {
    try {
      if (!this.valueSuggestionsList || !this.testService) return;

      // Check cache first
      let suggestions = this.suggestionsCache.get(subcategoryId);
      if (!suggestions) {
        suggestions = await this.testService.getSubcategorySuggestions(
          subcategoryId
        );
        this.suggestionsCache.set(subcategoryId, suggestions);
      }

      this.clearValueSuggestions();
      if (Array.isArray(suggestions)) {
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        suggestions.forEach((s) => {
          const opt = document.createElement("option");
          opt.value = (
            s.suggestion_text ??
            s.value ??
            s.suggestion ??
            ""
          ).toString();
          if (opt.value) fragment.appendChild(opt);
        });
        this.valueSuggestionsList.appendChild(fragment);
      }
    } catch (e) {
      // keep UI responsive on errors
    }
  }

  clearValueSuggestions() {
    if (!this.valueSuggestionsList) return;
    this.valueSuggestionsList.innerHTML = "";
  }

  // Clear all caches to free memory
  clearCaches() {
    this.subcategoriesCache.clear();
    this.referenceRangesCache.clear();
    this.suggestionsCache.clear();
  }

  // Clear specific cache entries
  clearSubcategoryCache(testId) {
    this.subcategoriesCache.delete(testId);
  }

  // Highlight the currently selected subcategory row (blue background via Bootstrap)
  highlightSelectedSubcategoryRow() {
    if (!this.resultsItemsBody) return;
    const rows = this.resultsItemsBody.querySelectorAll("tr");
    rows.forEach((r) => r.classList.remove("table-active"));
    const current = this.currentSubcategories?.[this.currentSubcategoryIndex];
    if (!current) return;
    const row = this.resultsItemsBody.querySelector(
      `tr[data-subcategory-id="${current.id}"]`
    );
    row?.classList.add("table-active");

    // Ensure the selected row is visible inside the scroll container
    if (row && this.resultsTableContainer) {
      this.scrollRowIntoView(row);
    }
  }

  // Smoothly scroll the results container so that the given row is visible
  scrollRowIntoView(rowElement) {
    const container = this.resultsTableContainer;
    if (!container || !rowElement) return;

    const rowTop = rowElement.offsetTop;
    const rowBottom = rowTop + rowElement.offsetHeight;
    const visibleTop = container.scrollTop;
    const visibleBottom = visibleTop + container.clientHeight;

    const padding = 8; // small top/bottom padding when bringing into view
    if (rowTop < visibleTop) {
      container.scrollTo({
        top: Math.max(rowTop - padding, 0),
        behavior: "smooth",
      });
    } else if (rowBottom > visibleBottom) {
      const newTop = rowBottom - container.clientHeight + padding;
      container.scrollTo({ top: Math.max(newTop, 0), behavior: "smooth" });
    }
  }

  highlightSelectedRow() {
    // Remove previous highlights in both tables
    const rowsPending = this.resultsTableBody.querySelectorAll("tr");
    rowsPending.forEach((row) => row.classList.remove("table-active"));
    const rowsReady = this.resultsTableBodyReady
      ? this.resultsTableBodyReady.querySelectorAll("tr")
      : [];
    rowsReady.forEach((row) => row.classList.remove("table-active"));

    // Highlight only the specific selected test row
    if (this.selectedBill && this.selectedTestItem) {
      const allRows = [
        ...Array.from(rowsPending),
        ...Array.from(rowsReady),
      ];
      allRows.forEach((row) => {
        const isReadyRow = Boolean(row.querySelector("input.ready-row-check"));
        const billNo = row.cells[isReadyRow ? 1 : 0]?.textContent;
        const testName = row.cells[isReadyRow ? 3 : 2]?.textContent;
        const selectedTestName =
          this.selectedTestItem.tests?.test_name ||
          this.selectedTestItem.packages?.package_name ||
          "";

        if (
          billNo === this.selectedBill.bill_no &&
          testName === selectedTestName
        ) {
          row.classList.add("table-active");
        }
      });
    } else if (this.selectedBill && !this.selectedTestItem) {
      // If no specific test selected, highlight all rows for the patient
      const allRows = [
        ...Array.from(rowsPending),
        ...Array.from(rowsReady),
      ];
      allRows.forEach((row) => {
        const isReadyRow = Boolean(row.querySelector("input.ready-row-check"));
        const billNo = row.cells[isReadyRow ? 1 : 0]?.textContent;
        if (billNo === this.selectedBill.bill_no) {
          row.classList.add("table-active");
        }
      });
    }
  }

  async handleDateRangeSearch() {
    try {
      this.setLoading(true);

      // Check if there's a bill number search first
      const billNo = this.billSearchInput?.value.trim();
      if (billNo) {
        await this.selectBillFromSearch(billNo);
        return;
      }

      const fromDate = this.dateFromInput?.value;
      const toDate = this.dateToInput?.value;

      if (!fromDate || !toDate) {
        this.showError("Please select both from and to dates");
        return;
      }

      this.currentBills = await this.reportEntryService.getBillsByDateRange(
        fromDate,
        toDate
      );
      this.renderBillsTable();
    } catch (error) {
      console.error("Error searching by date range:", error);
      this.showError("Failed to search bills");
    } finally {
      this.setLoading(false);
    }
  }

  async handleTestFilter() {
    try {
      this.setLoading(true);

      const testId = this.testFilter?.value;

      if (testId === "all") {
        await this.loadTodaysBills();
      } else {
        this.currentBills = await this.reportEntryService.getBillsByTest(
          testId
        );
        this.renderBillsTable();
      }
    } catch (error) {
      console.error("Error filtering by test:", error);
      this.showError("Failed to filter bills");
    } finally {
      this.setLoading(false);
    }
  }

  // Sync the hidden select from the typed search, optionally trigger filter
  syncTestSelectFromSearch(trigger = false) {
    if (!this.testFilter || !this.testSearchInput) return;
    const raw = (this.testSearchInput.value || "").trim();
    if (raw === "" || raw.toLowerCase() === "all") {
      this.testFilter.value = "all";
      if (trigger) this.handleTestFilter();
      return;
    }

    // exact match by name
    const id = this.testsIndexByName.get(raw.toLowerCase());
    if (id) {
      this.testFilter.value = id;
      if (trigger) this.handleTestFilter();
      return;
    }

    // partial match: pick first that starts with typed text
    for (const [name, testId] of this.testsIndexByName.entries()) {
      if (name.startsWith(raw.toLowerCase())) {
        this.testFilter.value = testId;
        if (trigger) this.handleTestFilter();
        return;
      }
    }
  }

  async handleCenterFilter() {
    try {
      this.setLoading(true);

      const centerId = this.centerFilter?.value;

      if (centerId === "all") {
        await this.loadTodaysBills();
      } else {
        this.currentBills = await this.reportEntryService.getBillsByCenter(
          centerId
        );
        this.renderBillsTable();
      }
    } catch (error) {
      console.error("Error filtering by center:", error);
      this.showError("Failed to filter bills");
    } finally {
      this.setLoading(false);
    }
  }

  async handleBillSearch() {
    try {
      const searchTerm = this.billSearchInput?.value.trim();

      if (!searchTerm) {
        this.hideSuggestions();
        return;
      }

      const bills = await this.reportEntryService.searchBills(searchTerm);
      this.showBillSuggestions(bills);
    } catch (error) {
      console.error("Error searching bills:", error);
      this.hideSuggestions();
    }
  }

  // Handle bill selection from search
  async selectBillFromSearch(billNo) {
    try {
      this.setLoading(true);

      // Get the specific bill by number
      const bill = await this.reportEntryService.getBillByNumber(billNo);

      if (!bill) {
        this.showError("Bill not found");
        return;
      }

      // Filter current bills to show only this specific bill
      this.currentBills = [bill];
      this.renderBillsTable();

      // Clear any previously selected test item
      this.selectedTestItem = null;

      // Select the bill and populate forms (show all tests for this patient)
      this.selectBill(bill);
    } catch (error) {
      console.error("Error selecting bill from search:", error);
      this.showError("Failed to load bill details");
    } finally {
      this.setLoading(false);
    }
  }

  // Clear search and show all today's bills
  async clearSearch() {
    try {
      this.setLoading(true);

      // Clear the search input
      if (this.billSearchInput) {
        this.billSearchInput.value = "";
      }

      // Load all today's bills
      await this.loadTodaysBills();

      // Clear selected bill and test
      this.selectedBill = null;
      this.selectedTestItem = null;
      this.clearSummaryForm();
      this.clearTestResults();
    } catch (error) {
      console.error("Error clearing search:", error);
      this.showError("Failed to clear search");
    } finally {
      this.setLoading(false);
    }
  }

  // Clear summary form
  clearSummaryForm() {
    if (this.reportIdInput) this.reportIdInput.value = "";
    if (this.patientNameInput) this.patientNameInput.value = "";
    if (this.titleInput) this.titleInput.value = "";
    if (this.ageInput) this.ageInput.value = "";
    if (this.genderInput) this.genderInput.value = "";
    if (this.testTypeInput) this.testTypeInput.value = "";
    if (this.refByInput) this.refByInput.value = "";
    if (this.billNoInput) this.billNoInput.value = "";
    if (this.specimenInput) this.specimenInput.value = "";
  }

  // Clear test results
  clearTestResults() {
    if (this.resultsItemsBody) {
      this.resultsItemsBody.innerHTML =
        '<tr><td colspan="4" class="text-muted">No test selected</td></tr>';
    }
    this.selectedTestItem = null;
  }

  showBillSuggestions(bills) {
    if (!this.billSuggestions) return;

    this.billSuggestions.innerHTML = "";

    if (bills.length === 0) {
      this.hideSuggestions();
      return;
    }

    bills.slice(0, 8).forEach((bill) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-group-item list-group-item-action";
      item.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
          <strong>${this.safeText(bill.bill_no)}</strong>
          <small class="text-muted">${this.safeText(
            new Date(bill.bill_date).toLocaleDateString()
          )}</small>
        </div>
        <div class="small">${this.safeText(bill.patient_name)}</div>
      `;

      item.addEventListener("click", () => {
        this.billSearchInput.value = bill.bill_no;
        this.hideSuggestions();
        this.selectBillFromSearch(bill.bill_no);
      });

      this.billSuggestions.appendChild(item);
    });

    this.billSuggestions.style.display = "block";
    this.setResultsHeaderVisible(false);
  }

  showSuggestions() {
    if (this.billSuggestions && this.billSuggestions.children.length > 0) {
      this.billSuggestions.style.display = "block";
      this.setResultsHeaderVisible(false);
    }
  }

  hideSuggestions() {
    if (this.billSuggestions) {
      this.billSuggestions.style.display = "none";
      this.setResultsHeaderVisible(true);
    }
  }

  // Show/hide the right-panel results table header (Bill No. / Patient / Test)
  setResultsHeaderVisible(visible) {
    if (this.resultsTableHead)
      this.resultsTableHead.style.visibility = visible ? "visible" : "hidden";
    if (this.resultsTableHeadReady)
      this.resultsTableHeadReady.style.visibility = visible
        ? "visible"
        : "hidden";
  }

  handleUpdate() {
    if (!this.selectedBill) {
      this.showError("Please select a bill first");
      return;
    }

    // Collect test results from the table
    const results = this.collectTestResults();

    // Save test results
    const billItemId = this.selectedTestItem?.id || null;
    if (!billItemId) {
      this.showError(
        "Please select a specific test (bill item) to save results"
      );
      return;
    }
    this.saveTestResults(this.selectedBill.id, billItemId, results);
  }

  handlePreview() {
    if (!this.selectedBill) {
      this.showError("Please select a bill first");
      return;
    }

    // Open preview in new window
    const previewWindow = window.open("", "_blank");
    previewWindow.document.write(this.generatePreviewHTML());
  }

  async handleSaveAndPrint() {
    if (!this.selectedBill) {
      this.showError("Please select a bill first");
      return;
    }

    try {
      // Collect data first
      const results = this.collectTestResults();
      const billItemIdForSave = this.selectedTestItem?.id || null;
      if (!billItemIdForSave) {
        this.showError(
          "Please select a specific test (bill item) to save results"
        );
        return;
      }

      // OPTIMIZATION: Generate and open print window IMMEDIATELY (don't wait for saves)
      // This gives instant feedback to the user
      this.handlePrintReport();

      // OPTIMIZATION: Run all database operations in parallel in the background
      // User doesn't need to wait for these to complete
      const billItemId = this.selectedTestItem?.id || null;
      const commentsResult = this.commentsResultInput?.value || "";
      const specialNotes = (this.specialNotesInput?.value ?? this.commentsResultInput?.value) || "";

      // Fire all saves in parallel without blocking UI
      // Show subtle saving indicator (optional - doesn't block anything)
      const savingToast = this.showSavingToast();
      
      Promise.all([
        // Save test results
        this.saveTestResultsNonBlocking(
          this.selectedBill.id,
          billItemIdForSave,
          results
        ),
        // Save report header
        billItemId ? this.reportEntryService.upsertReportHeader({
          billId: this.selectedBill.id,
          billItemId: billItemId,
          commentsResult,
          specialNotes,
          status: "final",
        }).catch(e => console.warn("Failed saving report header:", e)) : Promise.resolve(),
        // Update status
        this.updateReportStatusNonBlocking(billItemIdForSave, "ready")
      ]).then(() => {
        console.log("All data saved successfully");
        savingToast?.remove();
        // Refresh the bills table in background to show updated status
        this.loadTodaysBills().catch(e => console.warn("Failed to refresh bills:", e));
      }).catch(e => {
        console.error("Error during background save:", e);
        savingToast?.remove();
        // Data save failed but print already happened - this is acceptable
      });

    } catch (e) {
      console.error("Error in handleSaveAndPrint:", e);
      this.showError("An error occurred");
    }
  }

  handlePrintReport() {
    if (!this.selectedBill) {
      this.showError("Please select a bill first");
      return;
    }

    // Generate print content
    const printContent = this.generatePrintHTML();

    // Open new window and immediately trigger print dialog
    const printWindow = window.open(
      "",
      "_blank",
      "width=800,height=600,scrollbars=yes,resizable=yes"
    );

    if (!printWindow) {
      this.showError("Please allow popups for this site to print reports");
      return;
    }

    // Write the complete HTML document to the new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report Print - ${this.safeText(
          this.selectedBill.bill_no
        )}</title>
        <style>
          @page { 
            size: A4; 
            margin: 16mm 2mm; 
          }
          
          body { 
            font-family: Arial, sans-serif; 
            color: #111; 
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .page {
            display: flex;
            flex-direction: column;
            height: calc(297mm - 32mm);
            position: relative;
          }
          
          .report-container { 
            width: 100%; 
            background: white;
            padding: 20px;
            margin-left: -10px;
          }
          
          .content-area { flex: 1 0 auto; }
          
          .top-space { 
            height: calc(40mm - 16mm); 
          }
          
          .info { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 8px 8px; 
            font-size: 14px; 
            margin-bottom: 4px; 
          }
          
          .info-col { 
            display: grid; 
            grid-auto-rows: min-content; 
            gap: 2px; 
          }
          
          .info .info-col:last-child { 
            margin-left: 15mm; 
          }
          
          .row { 
            display: grid; 
            grid-template-columns: 140px 8px 1fr; 
            align-items: baseline; 
          }
          
          .label { 
            font-weight: 700; 
            text-transform: uppercase; 
            letter-spacing: 0.2px; 
            white-space: nowrap; 
          }
          
          .colon { 
            text-align: center; 
          }
          
          .investigation-line { 
            display: grid; 
            grid-template-columns: 140px 8px 1fr; 
            align-items: baseline; 
            margin-top: 16px; 
            font-size: 14px; 
          }
          
          .investigation-line .label, 
          .investigation-line .colon { 
            white-space: nowrap; 
          }
          
          .hr { 
            margin-top: 8px; 
            border-top: 1px solid #999; 
          }
          
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 14px; 
            margin-top: 8px; 
          }
          
          .results-table { 
            width: 100%; 
            table-layout: fixed; 
            border-collapse: separate; 
            border-spacing: 0 2px; 
          }
          
          .results-table th, 
          .results-table td { 
            border: none; 
            padding: 2px 6px; 
            vertical-align: top; 
          }
          
          .results-table thead th { 
            background: #fff; 
            font-weight: 700; 
            text-align: left; 
          }
          
          .results-table thead th:nth-child(2) { 
            transform: translateX(-5mm); 
          }
          
          .results-table tbody td:nth-child(2)::before { 
            content: ":"; 
            display: inline-block; 
            width: 10px; 
            text-align: center; 
            margin-right: 6px; 
          }
          
          .results-table tbody tr.empty-category-row td:nth-child(2)::before { 
            content: ""; 
          }
          
          .results-table tbody tr.hide-value-colon td:nth-child(2)::before { 
            content: ""; 
          }
          
          .results-table tbody td:nth-child(2) { 
            padding-left: 0; 
            transform: translateX(-5mm); 
          }
          
          .results-table tbody td:first-child { 
            font-weight: 400; 
            text-align: left;
            white-space: nowrap;
            vertical-align: middle;
          }
          .results-table thead th:first-child {
            text-align: left;
          }
          
          .remarks { 
            margin-top: 18mm; 
            font-size: 14px; 
          }
          
          .remarks .label { 
            font-weight: 700; 
          }
          
          .signature-section { 
            position: absolute;
            bottom: 5mm;
            right: 5mm;
            display: flex; 
            flex-direction: column; 
            align-items: flex-end; 
            width: 25%; 
            transform: translateY(10mm);
            page-break-inside: avoid;
            break-inside: avoid; 
          }
          .signature-image {
            margin-bottom: 8px;
            text-align: center;
            width: 100%;
          }
          .signature-line { 
            width: 100%; 
            height: 1px; 
            border-bottom: 1px dashed #000; 
            margin-bottom: 2px; 
          }
          .signature-label { 
            font-size: 14px; 
            font-weight: 500;
            text-align: center; 
            width: 100%; 
            word-wrap: break-word; 
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="report-container content-area">
          ${printContent}
          </div>
        </div>
        <script>
          // Automatically trigger print dialog when page loads - optimized for speed
          window.onload = function() {
            // Reduced delay for faster response
            setTimeout(function() {
              window.print();
            }, 50);
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  }

  handlePrint() {
    if (!this.selectedBill) {
      this.showError("Please select a bill first");
      return;
    }

    // Use the same new window approach as handlePrintReport
    this.handlePrintReport();
  }

  handleEdit() {
    if (!this.selectedBill) {
      this.showError("Please select a bill first");
      return;
    }

    // If currently in Save mode (after toggled), perform save without printing
    if (this.editBtn && this.editBtn.classList.contains("btn-success")) {
      this.handleSaveOnly();
      return;
    }

    // Enable editing mode
    this.enableEditMode();
  }

  async handleSaveOnly() {
    try {
      // Collect inputs
      const results = this.collectTestResults();
      const billItemId = this.selectedTestItem?.id || null;
      if (!billItemId) {
        this.showError(
          "Please select a specific test (bill item) to save results"
        );
        return;
      }
      await this.saveTestResults(this.selectedBill.id, billItemId, results);

      // Save report header too (comments/special notes)
      const commentsResult = this.commentsResultInput?.value || "";
      const specialNotes = (this.specialNotesInput?.value ?? this.commentsResultInput?.value) || "";
      try {
        await this.reportEntryService.upsertReportHeader({
          billId: this.selectedBill.id,
          billItemId: billItemId,
          commentsResult,
          specialNotes,
          status: "final",
        });
      } catch (e) {
        console.warn("Failed saving report header:", e);
      }

      // Update report status to completed
      await this.updateReportStatus(billItemId, "completed");

      // Return button to Edit state
      if (this.editBtn) {
        this.editBtn.textContent = "Edit";
        this.editBtn.classList.remove("btn-success");
        this.editBtn.classList.add("btn-warning");
      }
    } catch (e) {
      // Errors are handled in save methods
    }
  }

  collectTestResults() {
    const results = [];
    const rows = this.resultsItemsBody.querySelectorAll("tr");

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 5) {
        const value = (cells[1].querySelector("input")?.value || "").trim();
        const unit = (cells[2].textContent || "").trim();
        const remark = (cells[4]?.querySelector("input")?.value || "").trim();

        // Save if there's a value or remark, and we have a valid subcategory ID
        if (value || remark) {
          const subcategoryIdAttr = row.getAttribute("data-subcategory-id");
          const subcategoryId = subcategoryIdAttr ? subcategoryIdAttr : null;
          
          if (subcategoryId) {
            results.push({
              subcategory_id: subcategoryId,
              value: value || null,
              unit: unit || null,
              status: null, // Status field exists in DB but not collected from UI
              comments: remark || null,
            });
          }
        }
      }
    });

    return results;
  }

  async saveTestResults(billId, billItemId, results) {
    try {
      this.setLoading(true);

      await this.reportEntryService.saveTestResults(
        billId,
        billItemId,
        results
      );
    } catch (error) {
      console.error("Error saving test results:", error);
      this.showError("Failed to save test results");
    } finally {
      this.setLoading(false);
    }
  }

  // Non-blocking version for background saves (no loading indicator)
  async saveTestResultsNonBlocking(billId, billItemId, results) {
    try {
      await this.reportEntryService.saveTestResults(
        billId,
        billItemId,
        results
      );
    } catch (error) {
      console.error("Error saving test results:", error);
      throw error;
    }
  }

  enableEditMode() {
    // Enable form fields for editing
    const inputs = document.querySelectorAll("input[readonly]");
    inputs.forEach((input) => input.removeAttribute("readonly"));

    // Show edit controls
    this.editBtn.textContent = "Save";
    this.editBtn.classList.remove("btn-warning");
    this.editBtn.classList.add("btn-success");
  }

  generatePreviewHTML() {
    if (!this.selectedBill)
      return "<html><body><h1>No bill selected</h1></body></html>";

    return this.generatePrintLayoutHTML(false);
  }

  generatePrintHTML() {
    return this.generatePrintLayoutHTML(true);
  }

  // Build a print-ready HTML using a clean template that mirrors the PDF layout
  generatePrintLayoutHTML(isForPrint) {
    const bill = this.selectedBill;
    const billItem = this.selectedTestItem;
    const now = new Date();
    const reportDate = this.safeText(
      new Date(bill.bill_date).toISOString().split("T")[0]
    );
    const printDate = now.toLocaleTimeString();
    const testName = billItem
      ? this.safeText(
          billItem.tests?.test_name || billItem.packages?.package_name || ""
        )
      : this.getTestTypes(bill);
    const specimen = billItem
      ? this.getSpecimenForTest(billItem)
      : this.getSpecimenTypes(bill);
    const age = this.safeText(this.ageInput?.value || "");
    const gender = this.safeText(this.genderInput?.value || "");
    const centerName = this.safeText(bill.centers?.center_name || "");
    const commentsRaw = this.commentsResultInput?.value || "";
    const commentsText = this.safeText(commentsRaw);
    const hasComments = commentsRaw.trim().length > 0;
    const notesText = this.safeText((this.specialNotesInput?.value ?? this.commentsResultInput?.value) || "");
    const title = this.safeText(bill.patient_title || "");
    
    // Get footer link (image URL) from the selected test
    const footerLink = billItem?.tests?.footer_text 
      ? (billItem.tests.footer_text || "").trim() 
      : "";

    // Use <base> so relative assets resolve from current page path
    const baseHref = document.baseURI || "./";

    // Hide optional columns in print if there are no values at all
    const { hasRefRange: showRefRange, hasRemark: showRemark } =
      this.detectPrintableOptionalColumns();

    return `
    <html>
      <head>
        <base href="${baseHref}">
        <meta charset="utf-8" />
        <title>Report ${this.safeText(bill.bill_no)}${
      billItem ? ` - ${this.safeText(testName)}` : ""
    }</title>
        <style>
          @page { size: A4; margin: 16mm 2mm; }
          body { font-family: Arial, sans-serif; color: #111; }
          .page { 
            display: flex; 
            flex-direction: column; 
            height: calc(297mm - 32mm); 
            position: relative; 
          }
          .report-container { width: 100%; margin-left: -10px; }
          .content-area { flex: 1 0 auto; }
          .top-space { height: calc(40mm - 16mm); }
          .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 8px; font-size: 14px; margin-top: 10mm; margin-bottom: 4px; line-height: 1.4; }
          .info-col { display: grid; grid-auto-rows: min-content; gap: 4px; }
          .info .info-col:last-child { margin-left: calc(15mm + 3px); }
          .row { display: grid; grid-template-columns: 180px 8px 1fr; align-items: baseline; }
          .info-col:first-child .row { grid-template-columns: 140px 8px 1fr; }
          .label { font-weight: 700; text-transform: uppercase; letter-spacing: 0.2px; white-space: nowrap; }
          .colon { text-align: center; }
          .investigation-line { display: grid; grid-template-columns: 140px 8px 1fr; align-items: baseline; margin-top: 16px; font-size: 14px; line-height: 1.4; }
          .investigation-line .label, .investigation-line .colon { white-space: nowrap; }
          .hr { margin-top: 8px; border-top: 1px solid #999; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px; line-height: 1.4; }
          .results-table { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0 2px; }
          .results-table th, .results-table td { border: none; padding: 3px 6px; vertical-align: top; }
          .results-table thead th { background: #fff; font-weight: 700; text-align: left; }
          .results-table thead th:nth-child(2) { transform: translateX(-5mm); }
          .results-table tbody td:nth-child(2)::before { content: ":"; display: inline-block; width: 10px; text-align: center; margin-right: 6px; }
          .results-table tbody tr.empty-category-row td:nth-child(2)::before { content: ""; }
          .results-table tbody tr.hide-value-colon td:nth-child(2)::before { content: ""; }
          .results-table tbody td:nth-child(2) { padding-left: 0; transform: translateX(-5mm); }
          .results-table tbody td:first-child { 
            font-weight: 400; 
            text-align: left;
            white-space: nowrap;
            vertical-align: middle;
          }
          .results-table thead th:first-child {
            text-align: left;
          }
          .footer-link-section { 
            margin-top: 12mm; 
            text-align: left; 
            border-top: 1px solid #999;
            padding-top: 4mm;
            page-break-inside: avoid; 
            break-inside: avoid;
          }
          .footer-link-section img { 
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            display: block;
            margin: 0;
            object-fit: contain;
          }
          .remarks { margin-top: 18mm; font-size: 14px; line-height: 1.4; }
          .remarks .label { font-weight: 700; }
          .signature-section { 
            position: absolute;
            bottom: 2mm;
            right: 5mm;
            display: flex; 
            flex-direction: column; 
            align-items: flex-end; 
            width: 25%; 
            transform: translateY(10mm);
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .signature-image {
            margin-bottom: 8px;
            text-align: center;
            width: 100%;
          }
          .signature-line { 
            width: 100%; 
            height: 1px; 
            border-bottom: 1px dashed #000; 
            margin-bottom: 2px; 
          }
          .signature-label { 
            font-size: 14px; 
            font-weight: 500;
            text-align: center; 
            width: 100%; 
            word-wrap: break-word; 
          }
          .no-print-btn { text-align: center; margin-top: 16px; }
          
          @media print {
            .no-print { display: none !important; }
          }
          
          ${
            isForPrint
              ? "@media print { .no-print { display: none !important; } }"
              : ""
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="report-container content-area">
            <div class="top-space"></div>

            <div class="info">
              <div class="info-col">
                <div class="row"><div class="label">NAME</div><div class="colon">:</div><div>${title ? title + " " : ""}${this.safeText(
                  bill.patient_name
                )}</div></div>
                <div class="row"><div class="label">AGE</div><div class="colon">:</div><div>${age}</div></div>
                <div class="row"><div class="label">GENDER</div><div class="colon">:</div><div>${gender}</div></div>
                <div class="row"><div class="label">REQUESTED BY</div><div class="colon">:</div><div>${this.safeText(
                  this.refByInput?.value || ""
                )}</div></div>
                <div class="row"><div class="label">CENTER</div><div class="colon">:</div><div>${centerName}</div></div>
              </div>
              <div class="info-col">
                <div class="row"><div class="label">SAMPLE RECEIVED ON</div><div class="colon">:</div><div>${reportDate}</div></div>
                <div class="row"><div class="label">SAMPLE REPORTED ON</div><div class="colon">:</div><div>${printDate}</div></div>
                <div class="row"><div class="label">INV NO</div><div class="colon">:</div><div>${this.safeText(
                  bill.bill_no
                )}</div></div>
                <div class="row"><div class="label">SAMPLE TYPE</div><div class="colon">:</div><div>${this.safeText(
                  specimen
                )}</div></div>
              </div>
            </div>

            <div class="investigation-line">
              <div class="label">INVESTIGATION</div>
              <div class="colon">:</div>
              <div>${this.safeText(testName)}</div>
            </div>

            <div class="hr"></div>

            <table class="results-table">
              <thead>
                <tr>
                  <th style="width: 35%">INVESTIGATION</th>
                  <th style="width: 18%">RESULT</th>
                  <th style="width: 12%">UNIT</th>
                  ${showRefRange ? `<th style="width: 20%">REFERENCE RANGE</th>` : ""}
                  ${showRemark ? `<th style="width: 15%">REMARK</th>` : ""}
                </tr>
              </thead>
              <tbody>
                ${this.generatePrintableResultsHTML(showRemark, true, showRefRange)}
              </tbody>
            </table>

            ${footerLink ? `
            <div class="footer-link-section">
              <img src="${this.safeText(footerLink)}" alt="Footer Image" style="width:100%;max-width:100%;max-height:none;height:auto;display:block;margin:0;" onerror="this.style.display='none';" />
            </div>
            ` : ''}

            ${
              hasComments
                ? `
            <div class="remarks">
              <span class="label">COMMENT:</span>
              <span style="white-space: pre-wrap; margin-left: 8px;">${commentsText}</span>
            </div>
            `
                : ""
            }
          </div>

          <div class="signature-section">
            ${
              this.shouldIncludeSignature()
                ? `
            <div class="signature-image">
              <img src="Imgs/signature.svg" alt="Signature" style="max-width: 100%; height: auto; max-height: 45px;">
            </div>
            `
                : ""
            }
            <div class="signature-line"></div>
            <div class="signature-label">Medical Laboratory Technologist</div>
          </div>

          ${
            !isForPrint
              ? '<div class="no-print-btn no-print"><button onclick="window.print()">Print</button></div>'
              : ""
          }
        </div>
      </body>
    </html>`;
  }

  // Read current table and build printable rows
  generatePrintableResultsHTML(
    includeRemark = true,
    includeUnit = true,
    includeRefRange = true
  ) {
    const tbody = this.resultsItemsBody;
    if (!tbody) return "";
    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (!rows.length) return "";
    const printTestId =
      this.selectedTestItem?.tests?.id || this.selectedTestItem?.test_id || null;
    const skipColonSet = printTestId
      ? SKIP_VALUE_ENTRY_ROW_INDICES_BY_TEST_ID[printTestId]
      : null;

    const html = rows
      .map((row, rowIndex) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 4) return "";

        const category = (cells[0]?.textContent || "").trim();
        const value = (cells[1]?.querySelector("input")?.value || "").trim();
        const uom = (cells[2]?.textContent || "").trim();
        const ref = (cells[3]?.textContent || "").trim();
        const remark = (cells[4]?.querySelector("input")?.value || "").trim();

        const hasAny =
          category ||
          value ||
          (includeUnit && uom) ||
          (includeRefRange && ref) ||
          (includeRemark && remark);

        const hideValueColon =
          Boolean(skipColonSet && skipColonSet.has(rowIndex));

        const renderRow = (categoryHTML, isEmptyCategoryRow, hideColon) => {
          const classes = [];
          if (isEmptyCategoryRow) classes.push("empty-category-row");
          if (hideColon) classes.push("hide-value-colon");
          const classAttr =
            classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
          const tds = [
            `<td>${categoryHTML}</td>`,
            `<td>${this.safeText(value)}</td>`,
          ];
          if (includeUnit) tds.push(`<td>${this.safeText(uom)}</td>`);
          if (includeRefRange) tds.push(`<td>${this.safeText(ref)}</td>`);
          if (includeRemark) tds.push(`<td>${this.safeText(remark)}</td>`);
          return `<tr${classAttr}>${tds.join("")}</tr>`;
        };

        // Preserve empty/nameless sub-category rows as visual spacing
        if (!category) {
          return renderRow("&nbsp;", true, false);
        }

        // Skip completely empty rows (no category and no other data)
        if (!hasAny) return "";

        return renderRow(this.safeText(category), false, hideValueColon);
      })
      .filter(Boolean)
      .join("");

    const colspan =
      2 +
      (includeUnit ? 1 : 0) +
      (includeRefRange ? 1 : 0) +
      (includeRemark ? 1 : 0);
    return (
      html ||
      `<tr><td colspan="${colspan}" style="text-align:center;color:#777;">No results entered</td></tr>`
    );
  }

  detectPrintableOptionalColumns() {
    const tbody = this.resultsItemsBody;
    if (!tbody) return { hasRefRange: false, hasRemark: false };
    const rows = Array.from(tbody.querySelectorAll("tr"));
    let hasRefRange = false;
    let hasRemark = false;

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 4) continue;

      const ref = (cells[3]?.textContent || "").trim();
      if (ref) hasRefRange = true;

      const remark = (cells[4]?.querySelector("input")?.value || "").trim();
      if (remark) hasRemark = true;

      if (hasRefRange && hasRemark) break;
    }

    return { hasRefRange, hasRemark };
  }

  generateTestResultsHTML() {
    const items = this.selectedBill.bill_items || [];
    return items
      .map((item) => {
        const testName =
          item.tests?.test_name || item.packages?.package_name || "-";
        return `
        <tr>
          <td>${this.safeText(testName)}</td>
          <td></td>
          <td>-</td>
          <td></td>
        </tr>
      `;
      })
      .join("");
  }

  // Utility methods
  safeText(value) {
    return value == null ? "" : String(value);
  }

  getValueDecimalPlacesForTest(testId) {
    if (!testId) return VALUE_DECIMAL_PLACES;
    // Try to get test from testsById map
    const test = this.testsById?.get(String(testId));
    if (test && test.decimal_places != null) {
      return test.decimal_places;
    }
    return VALUE_DECIMAL_PLACES;
  }

  getValueDecimalPlacesForSubcategory(subcategory) {
    if (subcategory && subcategory.decimal_places != null) {
      return subcategory.decimal_places;
    }
    // Fallback to test's decimal places
    const testId =
      this.selectedTestItem?.tests?.id || this.selectedTestItem?.test_id || null;
    return this.getValueDecimalPlacesForTest(testId);
  }

  getValueDecimalPlacesForCurrentTest() {
    // Check current subcategory first
    if (this.currentSubcategories && this.currentSubcategoryIndex != null) {
      const currentSub = this.currentSubcategories[this.currentSubcategoryIndex];
      if (currentSub) {
        return this.getValueDecimalPlacesForSubcategory(currentSub);
      }
    }
    // Fallback to test's decimal places
    const testId =
      this.selectedTestItem?.tests?.id || this.selectedTestItem?.test_id || null;
    return this.getValueDecimalPlacesForTest(testId);
  }

  isSkippedValueEntryRowIndex(subcategoryIndex) {
    const testId =
      this.selectedTestItem?.tests?.id || this.selectedTestItem?.test_id || null;
    if (!testId) return false;
    const skipped = SKIP_VALUE_ENTRY_ROW_INDICES_BY_TEST_ID[testId];
    return Boolean(skipped && skipped.has(subcategoryIndex));
  }

  isVisibleNonEmptyCategoryAt(index) {
    const sub = this.currentSubcategories?.[index];
    if (!sub || !this.resultsItemsBody) return false;
    const row = this.resultsItemsBody.querySelector(
      `tr[data-subcategory-id="${sub.id}"]`
    );
    const cell = row?.querySelector("td:nth-child(1)");
    const raw = (cell?.textContent || "").replace(/\u00a0/g, " ").trim();
    return raw.length > 0;
  }

  /** Next row index suitable for value entry (non-skipped, visible category), or sentinel / -1. */
  findNextValueEntryEligibleIndex(fromIndex, direction) {
    const len = this.currentSubcategories?.length ?? 0;
    if (direction >= 0) {
      for (let i = fromIndex; i < len; i++) {
        if (this.isSkippedValueEntryRowIndex(i)) continue;
        if (this.isVisibleNonEmptyCategoryAt(i)) return i;
      }
      return len;
    }
    for (let i = fromIndex; i >= 0; i--) {
      if (this.isSkippedValueEntryRowIndex(i)) continue;
      if (this.isVisibleNonEmptyCategoryAt(i)) return i;
    }
    return -1;
  }

  limitValueInputToDecimals(rawValue, finalize = false, decimalPlaces = VALUE_DECIMAL_PLACES) {
    const dp = Math.max(0, Math.min(20, Number(decimalPlaces) || VALUE_DECIMAL_PLACES));
    const original = rawValue == null ? "" : String(rawValue);
    const trimmed = original.trim();
    if (trimmed === "") return "";
    if (!/^[+-]?\d*\.?\d*$/.test(trimmed)) return original;

    const sign = trimmed.startsWith("-")
      ? "-"
      : trimmed.startsWith("+")
      ? "+"
      : "";
    const unsigned = trimmed.replace(/^[+-]/, "");
    if (unsigned === "") return sign;

    const hasDot = unsigned.includes(".");
    let [whole, fraction = ""] = unsigned.split(".");
    if (whole === "") whole = "0";

    if (!hasDot) return `${sign}${whole}`;

    if (!finalize && fraction.length === 0) return `${sign}${whole}.`;

    fraction = fraction.slice(0, dp);
    if (finalize && fraction.length === 0) return `${sign}${whole}`;
    return `${sign}${whole}.${fraction}`;
  }

  formatValueForInput(value, finalize = true, decimalPlaces) {
    if (value == null || !Number.isFinite(value)) return "";
    const dp = decimalPlaces ?? this.getValueDecimalPlacesForCurrentTest();
    const rounded = Number(value.toFixed(dp));
    return this.limitValueInputToDecimals(String(rounded), finalize, dp);
  }

  bindDecimalConstraint(inputElement, decimalPlacesSource = VALUE_DECIMAL_PLACES) {
    if (!inputElement) return;
    const resolveDp = () =>
      typeof decimalPlacesSource === "function"
        ? decimalPlacesSource()
        : decimalPlacesSource;
    const apply = (finalize) => {
      const next = this.limitValueInputToDecimals(
        inputElement.value,
        finalize,
        resolveDp()
      );
      if (next !== inputElement.value) inputElement.value = next;
    };
    inputElement.addEventListener("input", () => apply(false));
    inputElement.addEventListener("change", () => apply(true));
    inputElement.addEventListener("blur", () => apply(true));
  }

  shouldIncludeSignature() {
    return this.printWithSignatureCheckbox
      ? this.printWithSignatureCheckbox.checked
      : true;
  }

  // Performance optimization methods
  showTableLoading() {
    if (!this.resultsItemsBody) return;
    this.resultsItemsBody.innerHTML =
      '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div> Loading test results...</td></tr>';
  }

  findFirstNonEmptySubcategory(subcategories) {
    // Prefer visible non-empty cells over raw names
    if (this.resultsItemsBody) {
      for (let i = 0; i < subcategories.length; i++) {
        if (this.isSkippedValueEntryRowIndex(i)) continue;
        const sub = subcategories[i];
        const row = this.resultsItemsBody.querySelector(
          `tr[data-subcategory-id="${sub.id}"]`
        );
        const cell = row?.querySelector("td:nth-child(1)");
        const raw = (cell?.textContent || "").replace(/\u00a0/g, " ").trim();
        if (raw.length > 0) return i;
      }
    }
    for (let i = 0; i < subcategories.length; i++) {
      if (this.isSkippedValueEntryRowIndex(i)) continue;
      const name = (subcategories[i]?.subcategory_name || "").trim();
      if (name) return i;
    }
    return subcategories.length; // sentinel if none
  }

  renderTableRows(subcategories) {
    if (!this.resultsItemsBody) return;

    const testId =
      this.selectedTestItem?.tests?.id || this.selectedTestItem?.test_id || null;

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    subcategories.forEach((sub, rowIndex) => {
      const row = document.createElement("tr");
      row.setAttribute("data-subcategory-id", sub.id);

      const categoryName = this.safeText(sub.subcategory_name);
      const normalizedName = categoryName.replace(/\u00a0/g, " ").trim();

      const tdCat = document.createElement("td");
      tdCat.textContent = normalizedName;
      row.appendChild(tdCat);

      const tdVal = document.createElement("td");
      const valInput = document.createElement("input");
      valInput.type = "text";
      valInput.className = "form-control form-control-sm";
      valInput.setAttribute("placeholder", "Enter value");
      if (this.isSkippedValueEntryRowIndex(rowIndex)) {
        valInput.readOnly = true;
        valInput.tabIndex = -1;
        valInput.placeholder = "—";
        valInput.classList.add("bg-light", "text-muted");
        valInput.title = "This row is skipped for manual entry";
        row.setAttribute("data-skip-value-entry", "true");
      } else {
        const subcategoryDp = this.getValueDecimalPlacesForSubcategory(sub);
        this.bindDecimalConstraint(valInput, subcategoryDp);
      }
      tdVal.appendChild(valInput);
      row.appendChild(tdVal);

      const tdUom = document.createElement("td");
      tdUom.textContent = this.safeText(sub.uom || "");
      row.appendChild(tdUom);

      const tdRef = document.createElement("td");
      tdRef.id = `ref-range-${sub.id}`;
      row.appendChild(tdRef);

      const tdRemark = document.createElement("td");
      const remarkInput = document.createElement("input");
      remarkInput.type = "text";
      remarkInput.className = "form-control form-control-sm";
      remarkInput.setAttribute("placeholder", "Enter remark");
      tdRemark.appendChild(remarkInput);
      row.appendChild(tdRemark);

      // Add click event listener
      row.addEventListener("click", () =>
        this.handleSubcategoryRowClick(sub.id)
      );

      fragment.appendChild(row);
    });

    // Clear and append all rows at once
    this.resultsItemsBody.innerHTML = "";
    this.resultsItemsBody.appendChild(fragment);
  }

  getReferenceRangeTypeByPatientTitle() {
    const normalizedTitle = (this.titleInput?.value || "")
      .toLowerCase()
      .replace(/\./g, "")
      .trim();
    const maleTitles = new Set(["mr", "dr", "master", "rev"]);
    const femaleTitles = new Set(["miss", "mrs"]);
    if (maleTitles.has(normalizedTitle)) return "Male";
    if (femaleTitles.has(normalizedTitle)) return "Female";
    if (normalizedTitle === "baby") return "Baby";

    const gender = (this.genderInput?.value || "").toLowerCase().trim();
    if (gender.startsWith("m")) return "Male";
    if (gender.startsWith("f")) return "Female";
    return null;
  }

  async populateRefRangesForSubcategories(subcategories) {
    try {
      const preferredType = this.getReferenceRangeTypeByPatientTitle();

      // Load all reference ranges in parallel
      const refPromises = subcategories.map(async (sub) => {
        const cacheKey = `${sub.id}`;
        let refs = this.referenceRangesCache.get(cacheKey);

        if (!refs) {
          try {
            refs = await this.testService.getSubcategoryReferenceRanges(sub.id);
            this.referenceRangesCache.set(cacheKey, refs);
          } catch (e) {
            refs = [];
          }
        }

        return { sub, refs };
      });

      const refResults = await Promise.all(refPromises);

      // Update DOM with all results at once
      refResults.forEach(({ sub, refs }) => {
        const target = document.getElementById(`ref-range-${sub.id}`);
        if (!target) return;

        let text = "";
        if (Array.isArray(refs) && refs.length) {
          let ref = null;
          if (preferredType) {
            ref = refs.find((r) => r.gender === preferredType) || null;
          }
          if (!ref) {
            ref = refs[0];
          }
          // Keep reference values exactly as entered (e.g., "5.0", ">5.0", "<10.0").
          // Converting through Number would drop trailing zeros (e.g., "5.0" -> "5").
          const min = ref?.min_value ?? "";
          const max = ref?.max_value ?? "";
          const unit = ref?.unit ?? "";
          text = this.formatReferenceRange(min, max, unit);
        }
        target.textContent = text;
      });
    } catch (e) {
      // ignore silently for UI resiliency
    }
  }

  // Helper function to remove duplicate comments from a string
  removeDuplicateComments(commentsText) {
    if (!commentsText || typeof commentsText !== "string") return "";
    
    // Split by newlines (handles both \n and \r\n)
    const lines = commentsText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    // Remove duplicates while preserving order
    const uniqueLines = [];
    const seen = new Set();
    
    for (const line of lines) {
      if (!seen.has(line)) {
        seen.add(line);
        uniqueLines.push(line);
      }
    }
    
    return uniqueLines.join("\n");
  }

  wireValueAutoRemark(subcategories) {
    subcategories.forEach((sub) => {
      const row = this.resultsItemsBody.querySelector(
        `tr[data-subcategory-id="${sub.id}"]`
      );
      if (!row) return;
      const valueInput = row.querySelector("td:nth-child(2) input");
      const remarkInput = row.querySelector("td:nth-child(5) input");
      const refCell = row.querySelector(`#ref-range-${sub.id}`);

      const updateRemark = () => {
        if (!valueInput || !remarkInput) return;
        const raw = (valueInput.value || "").trim();
        const val = raw === "" ? null : Number(raw);
        if (val === null || Number.isNaN(val)) {
          remarkInput.value = "";
          return;
        }

        // Parse ref range from cell text.
        // Supported:
        // - "10 - 20"
        // - "<140" / "<=140"
        // - ">5" / ">=5"
        // - ">5, <39" (or ">5 - <39")
        const refText = (refCell?.textContent || "").trim();
        const parseRefRange = (text) => {
          const out = {
            min: null,
            max: null,
            minInclusive: true, // for ">=" boundary; for ">" set false
            maxInclusive: true, // for "<=" boundary; for "<" set false
          };

          const cleaned = (text || "").toString().replace(/\u00a0/g, " ").trim();
          if (!cleaned) return out;

          // 1) Comparator style: collect all occurrences (e.g., ">5, <39")
          const comps = [];
          const re = /([<>]=?)\s*([-+]?\d*\.?\d+)/g;
          let m;
          while ((m = re.exec(cleaned)) !== null) {
            const op = m[1];
            const num = Number(m[2]);
            if (Number.isNaN(num)) continue;
            comps.push({ op, num });
          }

          if (comps.length) {
            comps.forEach(({ op, num }) => {
              if (op.startsWith(">")) {
                // Keep the most restrictive (highest) min
                if (out.min == null || num > out.min) {
                  out.min = num;
                  out.minInclusive = op === ">=";
                } else if (num === out.min && op === ">=") {
                  out.minInclusive = true;
                }
              } else if (op.startsWith("<")) {
                // Keep the most restrictive (lowest) max
                if (out.max == null || num < out.max) {
                  out.max = num;
                  out.maxInclusive = op === "<=";
                } else if (num === out.max && op === "<=") {
                  out.maxInclusive = true;
                }
              }
            });
            return out;
          }

          // 2) Dash style: "min - max" (unit may trail)
          const match = cleaned.match(
            /([-+]?\d*\.?\d+)?\s*-\s*([-+]?\d*\.?\d+)?/
          );
          if (match) {
            const minRaw = match[1];
            const maxRaw = match[2];
            const min = minRaw !== undefined && minRaw !== "" ? Number(minRaw) : null;
            const max = maxRaw !== undefined && maxRaw !== "" ? Number(maxRaw) : null;
            out.min = Number.isNaN(min) ? null : min;
            out.max = Number.isNaN(max) ? null : max;
          }
          return out;
        };

        const { min, max, minInclusive, maxInclusive } = parseRefRange(refText);

        // Determine status
        if (min !== null && max !== null) {
          const isLow = minInclusive ? val < min : val <= min;   // expected >= min (or > min)
          const isHigh = maxInclusive ? val > max : val >= max;  // expected <= max (or < max)
          remarkInput.value = isLow ? "Low" : isHigh ? "High" : "Normal";
        } else if (min !== null) {
          const isLow = minInclusive ? val < min : val <= min;
          remarkInput.value = isLow ? "Low" : "Normal";
        } else if (max !== null) {
          const isHigh = maxInclusive ? val > max : val >= max;
          remarkInput.value = isHigh ? "High" : "Normal";
        } else {
          remarkInput.value = "";
        }

        // Auto-append configured less/more comment to the Comment tab if threshold matches
        try {
          const dir = (sub?.less_more || "").toLowerCase();
          const mark = sub?.less_more_mark;
          const cmnt = (sub?.less_more_comment || "").toString().trim();
          if (dir && cmnt && mark != null && !Number.isNaN(Number(mark)) && this.commentsResultInput) {
            const threshold = Number(mark);
            const conditionMet = (dir === "less" && val < threshold) || (dir === "more" && val > threshold);
            if (conditionMet) {
              const existing = this.commentsResultInput.value || "";
              // Split existing comments by newlines and normalize each one
              const existingComments = existing
                .split(/\r?\n/)
                .map(c => c.trim())
                .filter(c => c.length > 0);
              
              // Check if the comment already exists (case-sensitive exact match)
              const commentExists = existingComments.some(existingComment => existingComment === cmnt);
              
              // Append only if not already present to avoid duplicates
              if (!commentExists) {
                const newValue = existing ? `${existing}\n${cmnt}` : cmnt;
                // Remove any duplicates that might have been introduced
                this.commentsResultInput.value = this.removeDuplicateComments(newValue);
              }
            }
          }
        } catch (_) {
          // Non-blocking: ignore any errors to keep UI responsive
        }
      };

      valueInput?.addEventListener("input", updateRemark);
      valueInput?.addEventListener("change", updateRemark);
    });
  }

  formatAge(years, months, days) {
    const parts = [];
    const y = parseInt(years ?? 0) || 0;
    const m = parseInt(months ?? 0) || 0;
    const d = parseInt(days ?? 0) || 0;
    if (y) parts.push(`${y}y`);
    if (m) parts.push(`${m}m`);
    if (d) parts.push(`${d}d`);
    return parts.length ? parts.join(" ") : "";
  }

  getTestTypes(bill) {
    const items = bill.bill_items || [];
    const testNames = items
      .map((item) => item.tests?.test_name || item.packages?.package_name || "")
      .filter((name) => name);
    return testNames.join(", ");
  }

  getSpecimenTypes(bill) {
    // This would need to be implemented based on your specimen data structure
    return "Blood, Urine"; // Placeholder
  }

  getSpecimenForTest(testItem) {
    // Get specimen for a specific test item
    if (testItem.tests?.specimen) {
      return testItem.tests.specimen;
    } else if (testItem.packages?.specimen) {
      return testItem.packages.specimen;
    }
    return "Blood"; // Default specimen
  }

  setLoading(loading) {
    this.isLoading = loading;
    if (this.findBtn) {
      this.findBtn.disabled = loading;
      this.findBtn.textContent = loading ? "Loading..." : "Find";
    }
  }

  showError(message) {
    // You can implement a proper notification system here
    alert("Error: " + message);
  }

  showSuccess(message) {
    // You can implement a proper notification system here
    alert("Success: " + message);
  }

  // Show a subtle non-blocking toast notification for background saves
  showSavingToast() {
    try {
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(40, 167, 69, 0.95);
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideInRight 0.3s ease-out;
      `;
      toast.innerHTML = `
        <div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>Saving data...</span>
      `;
      
      // Add animations
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(toast);
      return toast;
    } catch (e) {
      console.warn("Failed to show saving toast:", e);
      return null;
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Auto-focus on Value field after selecting a test
  focusValueFieldAfterSelection() {
    // Use setTimeout to ensure the DOM has been updated after renderTestResults
    setTimeout(() => {
      if (this.topValueInput) {
        this.topValueInput.focus();
        this.topValueInput.select();
      }
    }, 100);
  }

  // Load report header (comments and special notes) and fill the fields
  async loadReportHeaderForItem(billItemId) {
    try {
      if (!this.reportEntryService || !billItemId) return;
      // Always reset fields first so old report comments do not leak
      // into newly selected reports that have no saved header yet.
      if (this.commentsResultInput) this.commentsResultInput.value = "";
      if (
        this.specialNotesInput &&
        this.specialNotesInput !== this.commentsResultInput
      ) {
        this.specialNotesInput.value = "";
      }

      const header = await this.reportEntryService.getReportHeader(billItemId);
      if (header) {
        const comments = header.comments_result || "";
        const notes = header.special_notes || "";
        if (this.commentsResultInput && this.specialNotesInput && this.specialNotesInput !== this.commentsResultInput) {
          // Remove duplicates from each field separately
          this.commentsResultInput.value = this.removeDuplicateComments(comments);
          this.specialNotesInput.value = this.removeDuplicateComments(notes);
        } else if (this.commentsResultInput) {
          // Combine comments and notes, then remove duplicates
          const combined = [comments, notes].filter(Boolean).join(comments && notes ? "\n\n" : "");
          this.commentsResultInput.value = this.removeDuplicateComments(combined);
        }
      }
    } catch (e) {
      // Non-blocking
      console.warn("Failed to load report header", e);
    }
  }

  // Fetch saved subcategory results for the selected bill item and fill into the table
  async fillSavedSubcategoryResults(subcategories) {
    try {
      const billItemId = this.selectedTestItem?.id;
      if (
        !billItemId ||
        !this.reportEntryService ||
        !Array.isArray(subcategories)
      )
        return;
      const savedTestId =
        this.selectedTestItem?.tests?.id ||
        this.selectedTestItem?.test_id ||
        null;
      const valueDp = this.getValueDecimalPlacesForTest(savedTestId);
      const results = await this.reportEntryService.getTestResultsByBillItem(
        billItemId
      );
      if (!Array.isArray(results) || results.length === 0) return;

      const bySubId = new Map();
      results.forEach((r) => {
        if (r && r.subcategory_id) bySubId.set(r.subcategory_id, r);
      });

      subcategories.forEach((sub, rowIndex) => {
        const row = this.resultsItemsBody?.querySelector(
          `tr[data-subcategory-id="${sub.id}"]`
        );
        if (!row) return;
        const saved = bySubId.get(sub.id);
        if (!saved) return;
        const valueInput = row.querySelector("td:nth-child(2) input");
        const remarkInput = row.querySelector("td:nth-child(5) input");
        if (valueInput && saved.value != null) {
          const isLipidProfile =
            savedTestId === "d683c8f0-f901-465d-bb3d-1fee6282ebca";
          const shouldForceTwoDp =
            isLipidProfile && (rowIndex === 3 || rowIndex === 5);
          if (shouldForceTwoDp) {
            const n = Number(saved.value);
            valueInput.value = Number.isFinite(n) ? n.toFixed(2) : String(saved.value);
          } else {
            valueInput.value = this.limitValueInputToDecimals(
              String(saved.value),
              true,
              valueDp
            );
          }
          // trigger remark recalculation
          valueInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        // If comments are present, prefer them for remark field
        if (remarkInput && saved.comments != null) {
          remarkInput.value = String(saved.comments);
        }
      });
    } catch (e) {
      console.warn("Failed to fill saved results", e);
    }
  }

  // Create status badge HTML
  createStatusBadge(status) {
    let badgeClass, statusText;

    switch (status) {
      case "ready":
        badgeClass = "status-badge-ready";
        statusText = "Ready";
        break;
      case "completed":
        badgeClass = "status-badge-completed";
        statusText = "Completed";
        break;
      case "overdue":
        badgeClass = "status-badge-overdue";
        statusText = "Overdue";
        break;
      default:
        badgeClass = "status-badge-pending";
        statusText = "Pending";
        break;
    }

    return `<span class="status-badge ${badgeClass}">${statusText}</span>`;
  }

  // Update report status for a bill item
  async updateReportStatus(billItemId, status = "completed") {
    try {
      if (!billItemId) {
        console.warn("No bill item ID provided for status update");
        return;
      }

      // Always update the UI first, regardless of service call result
      this.updateStatusInMemory(billItemId, status);

      // Try to update via service, but don't let it block the UI update
      if (this.reportEntryService) {
        this.updateReportStatusNonBlocking(billItemId, status);
      }

      // Re-render the table to reflect the status change
      this.renderBillsTable();

      // Update the highlight for the selected row
      this.highlightSelectedRow();
    } catch (error) {
      console.error("Error updating report status:", error);
      // Even if there's an error, try to update the UI
      this.updateStatusInMemory(billItemId, status);
      this.renderBillsTable();
      this.highlightSelectedRow();
    }
  }

  // Helper method to update status in memory
  updateStatusInMemory(billItemId, status) {
    // Update the selected test item status in memory
    if (this.selectedTestItem && this.selectedTestItem.id === billItemId) {
      this.selectedTestItem.report_status = status;
    }

    // Update the bill item status in the current bills array
    this.currentBills.forEach((bill) => {
      if (bill.bill_items) {
        bill.bill_items.forEach((item) => {
          if (item.id === billItemId) {
            item.report_status = status;
          }
        });
      }
    });
  }

  // Non-blocking version for background status updates
  async updateReportStatusNonBlocking(billItemId, status = "completed") {
    try {
      if (!billItemId) {
        console.warn("No bill item ID provided for status update");
        return;
      }

      if (this.reportEntryService) {
        await this.reportEntryService.updateReportStatus(billItemId, status);
        console.log("Report status updated successfully:", status);
      }
    } catch (error) {
      console.error("Error updating report status:", error);
      throw error;
    }
  }
}

// Initialize controller when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const controller = new ReportEntryController();
  // Expose for external triggers (history table clicks)
  window.ReportEntryController = controller;
});
