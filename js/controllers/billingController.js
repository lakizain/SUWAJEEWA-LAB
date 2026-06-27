// Billing Page Controller
class BillingController {
  constructor() {
    this.billingService = null;
    this.pricingService = null;
    this.currentBill = null;
    this.selectedTests = [];
    this.selectedPackages = [];
    this.editingBillId = null; // Track if we're editing a bill
    this.referenceChanged = false; // Track if reference was changed during editing
    this.isInitialized = false;
  }

  // Initialize the billing page
  async initialize() {
    try {
      console.log("Initializing billing controller...");

      // Wait for app to be initialized
      await this.waitForApp();

      this.billingService = window.app.getService("billing");
      this.pricingService = window.app.getService("pricing");
      console.log("Billing service:", this.billingService);

      this.setupEventListeners();
      this.setupKeyboardNavigation();
      await this.populateCentersDropdown();
      await Promise.all([
        this.populateReferencesDropdown(),
        this.populatePackagesDropdown(),
      ]);
      await this.loadInitialData();
      this.setupAutoComplete();
      this.initializeTableScroll(); // Initialize scroll functionality

      this.isInitialized = true;
      console.log("Billing controller initialized successfully");
    } catch (error) {
      console.error("Error initializing billing controller:", error);
      window.app.showError("Failed to initialize billing page");
    }
  }

  // Wait for app to be initialized
  waitForApp() {
    return new Promise((resolve) => {
      if (window.app && window.app.isInitialized) {
        resolve();
      } else {
        window.app.on("app:initialized", resolve);
      }
    });
  }

  // Setup event listeners
  setupEventListeners() {
    // Patient phone search
    const patientPhoneInput = document.querySelector(
      'input[placeholder*="phone"]'
    );
    if (patientPhoneInput) {
      patientPhoneInput.addEventListener(
        "input",
        this.debounce(this.handlePatientPhoneSearch.bind(this), 500)
      );
    }

    // Reference dropdown change handler
    this.setupReferenceChangeHandler();

    // New reference input change handler
    const newReferralInput = document.getElementById("new-referral-input");
    if (newReferralInput) {
      newReferralInput.addEventListener(
        "input",
        this.handleNewReferenceChange.bind(this)
      );
    }

    // Package selection (change and Enter key)
    const packageSelect = document.getElementById("package-dropdown");
    if (packageSelect) {
      packageSelect.addEventListener(
        "change",
        this.handlePackageSelection.bind(this)
      );
      packageSelect.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          // Trigger add for the currently selected package
          this.handlePackageSelection({ target: packageSelect });
        }
      });
    }

    const centerSelect = document.getElementById("center-dropdown");
    if (centerSelect) {
      centerSelect.addEventListener("change", (event) => {
        this.handleCenterChange(event).catch((error) => {
          console.error("Error handling center change:", error);
          window.app.showError("Failed to refresh center prices");
        });
      });
    }

    // Save bill button
    const saveBillBtn = document.querySelector(".btn-save");
    if (saveBillBtn) {
      saveBillBtn.addEventListener("click", this.handleSaveBill.bind(this));
    }

    // Payment amount changes
    const discountInput = document.getElementById("discount-amount");
    if (discountInput) {
      discountInput.addEventListener(
        "input",
        this.handleDiscountChange.bind(this)
      );
    }

    const discountTypeSelect = document.getElementById("discount-type");
    if (discountTypeSelect) {
      discountTypeSelect.addEventListener("change", () => {
        this.updateDiscountLabel();
        this.updateBillTotals();
      });
    }

    // Paid Amount input
    const paidAmountInput = document.getElementById("paid-amount-input");
    if (paidAmountInput) {
      paidAmountInput.addEventListener(
        "input",
        this.handlePaidAmountChange.bind(this)
      );
    }

    // Lifetime 10% discount checkbox
    const lifetimeDiscountCheckbox = document.getElementById(
      "lifetime-discount-checkbox"
    );
    const discountInputEl = document.getElementById("discount-amount");
    const discountTypeEl = document.getElementById("discount-type");
    if (lifetimeDiscountCheckbox && discountInputEl) {
      lifetimeDiscountCheckbox.addEventListener("change", (e) => {
        const checked = e.target.checked;
        if (checked) {
          if (discountTypeEl) {
            discountTypeEl.value = "percent";
            discountTypeEl.setAttribute("disabled", "disabled");
          }
          discountInputEl.value = "10";
          discountInputEl.setAttribute("disabled", "disabled");
          this.updateDiscountLabel();
          this.updateBillTotals();
        } else {
          if (discountTypeEl) {
            discountTypeEl.removeAttribute("disabled");
          }
          discountInputEl.removeAttribute("disabled");
          if (
            !discountInputEl.value ||
            isNaN(parseFloat(discountInputEl.value))
          ) {
            discountInputEl.value = "0";
          }
          this.updateDiscountLabel();
          this.updateBillTotals();
        }
      });
    }

    // Recent bills search
    const recentBillsSearch = document.querySelector(
      'input[placeholder*="Search by Bill No or Patient Name"]'
    );
    if (recentBillsSearch) {
      recentBillsSearch.addEventListener(
        "input",
        this.debounce(this.handleRecentBillsSearch.bind(this), 300)
      );

      // Add keyboard shortcuts
      recentBillsSearch.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          recentBillsSearch.value = "";
          this.loadRecentBills();
          recentBillsSearch.blur();
        }
      });

      // Add clear button functionality
      const clearButton = recentBillsSearch.parentElement.querySelector(
        ".btn-outline-secondary"
      );
      if (clearButton) {
        clearButton.addEventListener("click", async () => {
          recentBillsSearch.value = "";
          await this.loadRecentBills();
          recentBillsSearch.focus();
        });
      }

      // Add placeholder text with keyboard shortcut hint
      recentBillsSearch.setAttribute(
        "placeholder",
        "Search by Bill No or Patient Name... (Press Esc to clear)"
      );
    }

    // Refresh button
    const refreshBtn = document.querySelector(".btn-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", this.handleRefresh.bind(this));
    }

    // Delegated handlers for action icons (CSP-safe, no inline handlers)
    document.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (!actionBtn) return;
      const action = actionBtn.getAttribute("data-action");
      if (action === "view") {
        const billNo = actionBtn.getAttribute("data-bill-no");
        if (billNo) this.viewBill(billNo);
      } else if (action === "print") {
        const billId = actionBtn.getAttribute("data-bill-id");
        if (billId) this.printExistingBill(billId);
      } else if (action === "edit") {
        const billId = actionBtn.getAttribute("data-bill-id");
        if (billId) this.editBill(billId);
      } else if (action === "delete-test") {
        const idxAttr = actionBtn.getAttribute("data-index");
        const idx = parseInt(idxAttr, 10);
        if (!Number.isNaN(idx)) {
          this.removeTest(idx);
        }
      }
    });

    // Auto-select gender based on title (live)
    const titleSelectEl = document.querySelector('select[name="patient_title"]');
    const genderSelectEl = document.querySelector('select[name="patient_gender"]');
    const syncGenderFromTitle = () => {
      if (!titleSelectEl || !genderSelectEl) return;
      const t = (titleSelectEl.value || "").toLowerCase().replace(/\./g, "").trim();
      if (t === "mr") {
        genderSelectEl.value = "Male";
      } else if (t === "mrs" || t === "ms") {
        genderSelectEl.value = "Female";
      }
    };
    if (titleSelectEl && genderSelectEl) {
      titleSelectEl.addEventListener("change", syncGenderFromTitle);
      // Set once on init
      syncGenderFromTitle();
    }
  }

  // Setup keyboard navigation across form fields
  setupKeyboardNavigation() {
    const phoneInput = document.getElementById("patient-phone");
    const titleSelect = document.querySelector('select[name="patient_title"]');
    const nameInput = document.getElementById("patient-name");
    const ageYears = document.getElementById("patient-age-years");
    const ageMonths = document.getElementById("patient-age-months");
    const ageDays = document.getElementById("patient-age-days");
    const genderSelect = document.querySelector(
      'select[name="patient_gender"]'
    );
    const refBySelect = document.getElementById("ref-by-dropdown");
    const testDetailsInput = document.getElementById("test-details-input");

    const focusAndOpenSelect = (selectEl) => {
      if (!selectEl) return;
      selectEl.focus();
      // Try to open the native select dropdown (best-effort, multiple strategies)
      try {
        const evt = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        selectEl.dispatchEvent(evt);
      } catch (_) {}

      // Keyboard fallback: Alt+ArrowDown (common to open select on Windows)
      try {
        const kd = new KeyboardEvent("keydown", {
          key: "ArrowDown",
          code: "ArrowDown",
          altKey: true,
          bubbles: true,
          cancelable: true,
        });
        selectEl.dispatchEvent(kd);
      } catch (_) {}

      // Click fallback
      try {
        selectEl.click();
      } catch (_) {}
    };

    // Utility to wire select fields: first Enter opens; after change or second Enter moves next
    const setupSelectEnterBehavior = (selectEl, nextEl) => {
      if (!selectEl) return;
      let openedOnce = false;
      let selectionChanged = false;

      selectEl.addEventListener("focus", () => {
        openedOnce = false;
        selectionChanged = false;
      });

      selectEl.addEventListener("change", () => {
        selectionChanged = true;
      });

      selectEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!openedOnce && !selectionChanged) {
            focusAndOpenSelect(selectEl);
            openedOnce = true;
          } else {
            if (nextEl) nextEl.focus();
          }
        }
      });
    };

    // Phone -> Title (Enter)
    if (phoneInput && titleSelect) {
      phoneInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          focusAndOpenSelect(titleSelect);
        }
      });
    }

    // Title: Enter to open, after selection or second Enter -> Name
    setupSelectEnterBehavior(titleSelect, nameInput);

    // Name -> Age Years (Enter)
    if (nameInput && ageYears) {
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ageYears.focus();
        }
      });
    }

    // Age Years -> Age Months (Enter)
    if (ageYears && ageMonths) {
      ageYears.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ageMonths.focus();
        }
      });
    }

    // Age Months -> Age Days (Enter)
    if (ageMonths && ageDays) {
      ageMonths.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ageDays.focus();
        }
      });
    }

    // Age Days -> Gender (Enter)
    if (ageDays && genderSelect) {
      ageDays.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          focusAndOpenSelect(genderSelect);
        }
      });
    }

    // Gender: Enter to open, after selection or second Enter -> Ref By
    setupSelectEnterBehavior(genderSelect, refBySelect);

    // Ref By: Enter to open, after selection or second Enter -> New Reference
    setupSelectEnterBehavior(
      refBySelect,
      document.getElementById("new-referral-input")
    );

    // New Reference -> Test Details (Enter)
    const newReferralInput = document.getElementById("new-referral-input");
    if (newReferralInput && testDetailsInput) {
      newReferralInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          testDetailsInput.focus();
        }
      });
    }
  }

  // Load initial data
  async loadInitialData() {
    try {
      window.app.showLoading("Loading billing data...");

      // Load recent bills
      await this.loadRecentBills();

      // Set current date and time
      this.setCurrentDateTime();

      // Generate bill number
      await this.generateBillNumber();

      window.app.hideLoading();
    } catch (error) {
      console.error("Error loading initial data:", error);
      window.app.showError("Failed to load initial data");
      window.app.hideLoading();
    }
  }

  // Set current date and time
  setCurrentDateTime() {
    const now = new Date();
    const dateTimeString = now.toLocaleString("si-LK", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const billDateInput = document.getElementById("bill-date");
    if (billDateInput) {
      billDateInput.value = dateTimeString;
    }
  }

  // Generate bill number
  async generateBillNumber() {
    try {
      const billNumber = await this.billingService.generateBillNumber();
      const billNoInput = document.getElementById("bill-no");
      if (billNoInput) {
        billNoInput.value = billNumber;
      }
    } catch (error) {
      console.error("Error generating bill number:", error);
    }
  }

  // Handle patient phone search
  async handlePatientPhoneSearch(event) {
    const phone = event.target.value.trim();

    if (phone.length < 3) {
      this.clearPatientHistory();
      this.removePatientDropdown();
      return;
    }

    try {
      const history = await this.billingService.getPatientHistory(phone);
      this.displayPatientHistory(history);

      // Show patient selection dropdown (unique by patient_name)
      this.displayPatientSuggestions(history, event.target);

      // Auto-fill patient details if found
      if (history.length > 0) {
        this.autoFillPatientDetails(history[0]);
      }
    } catch (error) {
      console.error("Error searching patient history:", error);
      window.app.showError("Failed to load patient history");
    }
  }

  // Display patient history
  displayPatientHistory(history) {
    // Prefer the new dedicated patient history table if present
    let historyTable = document.querySelector("#patient-history-table tbody");
    if (!historyTable) {
      // Fallback to the older selector if exists
      const fallback = document.querySelectorAll(
        ".table-responsive .table tbody"
      )[1];
      historyTable = fallback || null;
    }
    if (!historyTable) return;

    if (history.length === 0) {
      historyTable.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-info-circle"></i>
                        <div>No history found for this phone number</div>
                    </td>
                </tr>
            `;
      return;
    }

    const rows = history
      .map((bill) => {
        const testNames = this.getTestNames(bill.bill_items || []);
        return `
          <tr>
            <td><strong>${bill.bill_no}</strong></td>
            <td>${bill.patient_name || "N/A"}</td>
            <td>${window.app.formatDate(bill.bill_date)}</td>
            <td>${bill.patient_gender || ""}</td>
            <td>${testNames}</td>
            <td>${window.app.formatCurrency(bill.paid_amount || 0)}</td>
            <td>${window.app.formatCurrency(bill.remaining_amount || 0)}</td>
          </tr>
        `;
      })
      .join("");

    historyTable.innerHTML = rows;
  }

  // Get test names from bill items
  getTestNames(billItems) {
    if (!billItems || billItems.length === 0) return "N/A";

    return billItems
      .map((item) => {
        if (item.tests) return item.tests.test_name;
        if (item.packages) return item.packages.package_name;
        return "Unknown";
      })
      .join(", ");
  }

  // Auto-fill patient details
  autoFillPatientDetails(bill) {
    if (!bill) return;
    const phoneInput = document.getElementById("patient-phone");
    if (bill.patient_name)
      document.getElementById("patient-name").value = bill.patient_name;
    if (bill.patient_title) {
      const titleSelect = document.querySelector(
        'select[name="patient_title"]'
      );
      if (titleSelect) titleSelect.value = bill.patient_title;
    }
    if (
      typeof bill.patient_age_years !== "undefined" &&
      bill.patient_age_years !== null
    )
      document.getElementById("patient-age-years").value =
        bill.patient_age_years;
    if (
      typeof bill.patient_age_months !== "undefined" &&
      bill.patient_age_months !== null
    )
      document.getElementById("patient-age-months").value =
        bill.patient_age_months;
    if (
      typeof bill.patient_age_days !== "undefined" &&
      bill.patient_age_days !== null
    )
      document.getElementById("patient-age-days").value = bill.patient_age_days;
    if (bill.patient_gender) {
      const genderSelect = document.querySelector(
        'select[name="patient_gender"]'
      );
      if (genderSelect) genderSelect.value = bill.patient_gender;
    }
    // Do not auto-fill New Reference field for previously billed patients
    if (phoneInput && !phoneInput.value)
      phoneInput.value = bill.patient_phone || "";
    // Restore lifetime discount state as per previous bills
    const lifetimeDiscountCheckbox = document.getElementById(
      "lifetime-discount-checkbox"
    );
    const discountInputEl = document.getElementById("discount-amount");
    const discountTypeEl = document.getElementById("discount-type");
    if (lifetimeDiscountCheckbox && discountInputEl) {
      const isLifetime = !!bill.lifetime_discount;
      lifetimeDiscountCheckbox.checked = isLifetime;
      if (isLifetime) {
        if (discountTypeEl) {
          discountTypeEl.value = "percent";
          discountTypeEl.setAttribute("disabled", "disabled");
        }
        discountInputEl.value = "10";
        discountInputEl.setAttribute("disabled", "disabled");
        this.updateDiscountLabel();
        this.updateBillTotals();
      } else {
        if (discountTypeEl) {
          discountTypeEl.removeAttribute("disabled");
        }
        discountInputEl.removeAttribute("disabled");
        this.updateDiscountLabel();
        this.updateBillTotals();
      }
    }
    window.app.showInfo("පෙර billing තොරතුරු හමු විය. විස්තර පරීක්ෂා කරන්න.");
  }

  // Build unique patient suggestions and render dropdown under phone input
  displayPatientSuggestions(history, inputEl) {
    try {
      this.removePatientDropdown();
      if (!Array.isArray(history) || history.length === 0 || !inputEl) return;

      const uniqueByName = new Map();
      for (const bill of history) {
        const key = (bill.patient_name || "N/A").trim().toLowerCase();
        if (!uniqueByName.has(key)) uniqueByName.set(key, bill);
      }

      if (uniqueByName.size === 0) return;

      // Ensure parent is positioned for absolute dropdown
      const parent = inputEl.parentElement;
      if (!parent) return;
      if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }

      const dropdown = document.createElement("div");
      dropdown.id = "patient-phone-dropdown";
      dropdown.className = "dropdown-menu show position-absolute w-100";
      dropdown.style.cssText =
        "z-index:1000; max-height:220px; overflow-y:auto;";

      const items = Array.from(uniqueByName.values())
        .slice(0, 10)
        .map((b) => {
          const name = b.patient_name || "N/A";
          const title = b.patient_title ? b.patient_title + " " : "";
          const gender = b.patient_gender || "";
          const age = this.formatAge(
            b.patient_age_years,
            b.patient_age_months,
            b.patient_age_days
          );
          const info = [gender, age].filter(Boolean).join(" • ");
          return `<div class="dropdown-item" data-bill='${encodeURIComponent(
            JSON.stringify(b)
          )}'>
            <strong>${title}${name}</strong>
            <div class="small text-muted">${info || ""}</div>
          </div>`;
        })
        .join("");

      dropdown.innerHTML =
        items || '<div class="dropdown-item disabled">No matches</div>';
      parent.appendChild(dropdown);

      // Click handler
      dropdown.addEventListener("click", (e) => {
        const item = e.target.closest(".dropdown-item");
        if (!item || item.classList.contains("disabled")) return;
        const bill = JSON.parse(
          decodeURIComponent(item.getAttribute("data-bill"))
        );
        // Set phone if not fully typed yet
        const phoneInput = document.getElementById("patient-phone");
        if (phoneInput && bill && bill.patient_phone)
          phoneInput.value = bill.patient_phone;
        this.autoFillPatientDetails(bill);
        this.removePatientDropdown();
        // Focus next field (Title select)
        const titleSelect = document.querySelector(
          'select[name="patient_title"]'
        );
        if (titleSelect) titleSelect.focus();
      });

      // Dismiss on Escape or blur
      const closeDropdown = (evt) => {
        if (evt.type === "keydown" && evt.key !== "Escape") return;
        this.removePatientDropdown();
      };
      inputEl.addEventListener("keydown", closeDropdown, { once: true });
      inputEl.addEventListener(
        "blur",
        () => setTimeout(() => this.removePatientDropdown(), 150),
        { once: true }
      );
    } catch (err) {
      console.warn("Failed to display patient suggestions:", err);
    }
  }

  removePatientDropdown() {
    const dd = document.getElementById("patient-phone-dropdown");
    if (dd) dd.remove();
  }

  // Clear patient history
  clearPatientHistory() {
    const historyTable = document.querySelectorAll(
      ".table-responsive .table tbody"
    )[1];
    if (historyTable) {
      historyTable.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-info-circle"></i>
                        <div>No recent bills found</div>
                    </td>
                </tr>
            `;
    }
  }

  // Handle package selection
  async handlePackageSelection(event) {
    const packageId = event.target.value;

    if (!packageId || packageId === "Select Package") {
      return;
    }

    try {
      const pricingService = this.pricingService || window.app.getService("pricing");
      const packageData = await pricingService.getResolvedPackageById(
        packageId,
        this.getSelectedCenterId()
      );
      this.addPackageToBill(packageData);
    } catch (error) {
      console.error("Error loading package:", error);
      window.app.showError("Failed to load package");
    }
  }

  // Add package to bill
  addPackageToBill(packageData) {
    if (!packageData) return;

    const item = {
      id: packageData.id,
      test_name: packageData.package_name,
      short_name: packageData.short_name || packageData.package_name,
      price: parseFloat(packageData.resolved_price ?? packageData.price) || 0,
      qty: 1,
      category: "Package",
      itemType: "package",
      global_price: parseFloat(packageData.global_price ?? packageData.price) || 0,
      center_price:
        packageData.center_price == null
          ? null
          : parseFloat(packageData.center_price) || 0,
      resolved_price:
        parseFloat(packageData.resolved_price ?? packageData.price) || 0,
      has_center_price: Boolean(packageData.has_center_price),
      package_tests: Array.isArray(packageData.package_tests)
        ? packageData.package_tests
        : [],
    };

    // Avoid duplicate package lines
    const exists = this.selectedTests.some(
      (t) => t.itemType === "package" && t.id === item.id
    );
    if (!exists) {
      this.selectedTests.push(item);
      this.updateBillTotals();
      this.updateTestTable();
    } else {
      window.app.showInfo("Package already added");
    }

    // Reset dropdown to placeholder after adding
    const dropdown = document.getElementById("package-dropdown");
    if (dropdown) {
      dropdown.selectedIndex = 0;
    }

    window.app.showSuccess(
      `Package "${packageData.package_name}" added to bill`
    );
  }

  // Legacy helper retained for compatibility with older call paths.
  addPackageTestsToBill(packageData) {
    this.addPackageToBill(packageData);
  }

  // Handle discount change
  handleDiscountChange() {
    this.updateBillTotals();
  }

  getDiscountType() {
    const el = document.getElementById("discount-type");
    return el?.value === "fixed" ? "fixed" : "percent";
  }

  getDiscountValue() {
    return parseFloat(document.getElementById("discount-amount")?.value) || 0;
  }

  calculateDiscountAmount(totalAmount, discountValue = null, discountType = null) {
    const value = discountValue ?? this.getDiscountValue();
    const type = discountType ?? this.getDiscountType();
    if (type === "fixed") {
      return Math.min(Math.max(0, value), totalAmount);
    }
    const pct = Math.min(Math.max(0, value), 100);
    return (totalAmount * pct) / 100;
  }

  calculateFinalAmount(totalAmount, discountValue = null, discountType = null) {
    return totalAmount - this.calculateDiscountAmount(totalAmount, discountValue, discountType);
  }

  updateDiscountLabel() {
    const label = document.getElementById("discount-label");
    if (!label) return;
    label.textContent =
      this.getDiscountType() === "fixed" ? "Discount (Rs):" : "Discount (%):";
  }

  // Handle paid amount change
  handlePaidAmountChange(event) {
    const paidAmount = parseFloat(event.target.value) || 0;
    this.updateRemainingAmount(paidAmount);
  }

  // Update bill totals
  updateBillTotals() {
    const totalAmount = this.calculateTotalAmount();
    const discountAmount = this.calculateDiscountAmount(totalAmount);
    const finalAmount = totalAmount - discountAmount;
    const paidAmountInput = document.getElementById("paid-amount-input");
    const paidAmount = parseFloat(paidAmountInput?.value) || 0;
    const remainingAmount = finalAmount - paidAmount;

    // Update display
    const totalElement = document.querySelector(".summary-value");
    if (totalElement) {
      totalElement.textContent = window.app.formatCurrency(totalAmount);
    }

    const amountElement = document.querySelectorAll(".summary-value")[2];
    if (amountElement) {
      amountElement.textContent = window.app.formatCurrency(finalAmount);
    }

    const remainingElement = document.querySelectorAll(".summary-value")[3];
    if (remainingElement) {
      remainingElement.textContent = window.app.formatCurrency(remainingAmount);
    }
  }

  // Calculate total amount
  calculateTotalAmount() {
    // Sum selected tests and packages
    let total = 0;
    if (this.selectedTests && this.selectedTests.length > 0) {
      total += this.selectedTests.reduce((sum, t) => {
        const price = parseFloat(t.price) || 0;
        const qty = parseFloat(t.qty) || 1;
        return sum + price * qty;
      }, 0);
    }
    // TODO: add selectedPackages if needed
    return total;
  }

  getPriceSourceLabel(item) {
    if (item?.pricing_source === "saved_bill") {
      return "Saved bill price";
    }
    return item?.has_center_price ? "Center price" : "Global default";
  }

  renderPriceCell(item) {
    const price = parseFloat(item?.price) || 0;
    const source = this.getPriceSourceLabel(item);
    return `
      <div>${price.toFixed(2)}</div>
      <div class="small text-muted">${source}</div>
    `;
  }

  // Update remaining amount
  updateRemainingAmount(paidAmount) {
    const totalAmount = this.calculateTotalAmount();
    const finalAmount = this.calculateFinalAmount(totalAmount);
    const remainingAmount = finalAmount - (parseFloat(paidAmount) || 0);

    const remainingElement = document.querySelectorAll(".summary-value")[3];
    if (remainingElement) {
      remainingElement.textContent = window.app.formatCurrency(remainingAmount);
    }
  }

  // Refresh Payment Details section
  refreshPaymentDetails() {
    // Clear paid amount input
    const paidAmountInput = document.getElementById("paid-amount-input");
    if (paidAmountInput) {
      paidAmountInput.value = "";
    }

    // Reset discount to 0
    const discountInput = document.getElementById("discount-amount");
    const discountTypeSelect = document.getElementById("discount-type");
    if (discountInput) {
      discountInput.value = "0";
      discountInput.removeAttribute("disabled");
    }
    if (discountTypeSelect) {
      discountTypeSelect.value = "percent";
      discountTypeSelect.removeAttribute("disabled");
    }
    this.updateDiscountLabel();

    // Uncheck lifetime discount
    const lifetimeDiscountCheckbox = document.getElementById("lifetime-discount-checkbox");
    if (lifetimeDiscountCheckbox) {
      lifetimeDiscountCheckbox.checked = false;
    }

    // Update all totals to reflect cleared state
    this.updateBillTotals();

    // Clear selected tests array to ensure totals are zero
    this.selectedTests = [];

    console.log("Payment Details section refreshed");
  }

  // Handle save bill
  async handleSaveBill() {
    try {
      const billData = this.collectBillData();
      if (!this.validateBillData(billData)) {
        return;
      }

      window.app.showLoading(
        this.editingBillId ? "Updating bill..." : "Saving bill..."
      );

      console.log("Bill data being saved:", billData); // Debug log

      // Validate reference_id if present
      if (billData.reference_id && !this.isValidUUID(billData.reference_id)) {
        console.log("Reference ID validation failed:", billData.reference_id);
      }

      let bill;
      if (this.editingBillId) {
        // Update existing bill - exclude items from bill data
        const { items, ...billUpdateData } = billData;
        bill = await this.billingService.updateBill(
          this.editingBillId,
          billUpdateData
        );

        // Update bill items separately
        if (items && items.length > 0) {
          await this.billingService.updateBillItems(this.editingBillId, items);
        }

        window.app.showSuccess(`Bill ${bill.bill_no} updated successfully`);
      } else {
        // Check for existing bills with same patient info
        const existingBills = await this.billingService.checkExistingBills(
          billData.patient_name,
          billData.patient_phone
        );

        if (existingBills.length > 0) {
          console.log("Found existing bills for patient:", existingBills);
          // Show warning but allow creation
          const warningMsg = `Found ${existingBills.length} existing bill(s) for this patient. Proceeding with new bill creation.`;
          console.warn(warningMsg);
        }

        // Create new bill
        bill = await this.billingService.createBill(billData);
        window.app.showSuccess(`Bill ${bill.bill_no} saved successfully`);
      }

      this.currentBill = bill;

      // Always print two bills after saving
      // If reference was changed during editing, ensure it's printed with updated reference
      if (this.editingBillId && this.referenceChanged) {
        console.log(
          "Reference was changed during editing, printing updated bill"
        );
      }

      // Ensure print is always triggered after successful save
      console.log("Bill saved successfully, triggering print for 2 copies...");
      this.printBill(bill);

      this.resetBillForm();
      await this.loadRecentBills();
      
      // Explicitly refresh Payment Details section
      this.refreshPaymentDetails();
    } catch (error) {
      console.error("Error saving bill:", {
        message: error.message,
        details: error.details,
        code: error.code,
        constraint: error.constraint,
        billData: this.collectBillData(),
      });

      let userMessage = this.editingBillId
        ? "Failed to update bill"
        : "Failed to save bill";

      // Provide more specific error messages based on error type
      if (
        error.message.includes("Bill number") &&
        error.message.includes("already exists")
      ) {
        userMessage = "Bill number conflict detected. Please try saving again.";
      } else if (error.message.includes("Duplicate data detected")) {
        userMessage =
          "This bill appears to already exist. Please check the patient information.";
      } else if (error.message.includes("Invalid data provided")) {
        userMessage =
          "Please check all required fields and ensure data is valid.";
      } else if (error.message.includes("Invalid reference data")) {
        userMessage =
          "Invalid center or reference selected. Please check your selections.";
      } else if (
        error.message.includes("ref_by") ||
        error.message.includes("reference")
      ) {
        userMessage = "Invalid reference selected. Please check and try again.";
      } else if (error.message.includes("violates foreign key constraint")) {
        userMessage =
          "Invalid reference or center selected. Please check your selections.";
      } else if (error.message.includes("Database update failed")) {
        userMessage = `Database error: ${
          error.message.split("Database update failed: ")[1]
        }`;
      } else if (error.message.includes("400")) {
        userMessage =
          "Invalid data format. Please check all fields and try again.";
      } else if (error.message.includes("409") || error.code === "409") {
        userMessage =
          "Conflict detected. This may be due to duplicate data. Please try again.";
      }

      window.app.showError(userMessage);
    } finally {
      window.app.hideLoading();
    }
  }

  // Collect bill data from form
  collectBillData() {
    const now = new Date();
    const referenceDetails = this.getSelectedReferenceDetails();
    const newReferenceValue = document
      .getElementById("new-referral-input")
      ?.value.trim();

    console.log("Collecting bill data - Reference details:", referenceDetails);
    console.log(
      "Collecting bill data - New reference value:",
      newReferenceValue
    );

    // Validate reference data before proceeding - prioritize new reference field
    let ref_by = null;

    // First check if new reference field has a value
    if (newReferenceValue && newReferenceValue !== "") {
      ref_by = newReferenceValue;
      console.log("Using new reference for bill:", ref_by);
    } else if (referenceDetails) {
      // Only use reference data if it's valid and no new reference is provided
      if (referenceDetails.name && referenceDetails.name.trim() !== "") {
        ref_by = referenceDetails.name;
        console.log("Reference selected for bill:", ref_by);
      } else {
        console.warn("Invalid reference details, skipping reference data");
      }
    } else {
      console.log("No reference selected for bill");
    }

    return {
      bill_type:
        document.querySelector('select[name="bill_type"]')?.value || "Main Lab",
      center_id: this.isValidUUID(this.getSelectedCenterId())
        ? this.getSelectedCenterId()
        : null,
      patient_phone:
        document.getElementById("patient-phone")?.value.trim() || "",
      patient_name: document.getElementById("patient-name")?.value.trim() || "",
      patient_title:
        document.querySelector('select[name="patient_title"]')?.value || "Mr.",
      patient_age_years:
        parseInt(document.getElementById("patient-age-years")?.value) || null,
      patient_age_months:
        parseInt(document.getElementById("patient-age-months")?.value) || null,
      patient_age_days:
        parseInt(document.getElementById("patient-age-days")?.value) || null,
      patient_gender:
        document.querySelector('select[name="patient_gender"]')?.value ||
        "Male",
      ref_by: ref_by, // Use validated reference name
      // Note: reference_id and reference_rid are not stored in the database
      // They are only used for frontend reference matching
      new_referral:
        document.getElementById("new-referral-input")?.value.trim() || "",
      items: this.getBillItems(),
      total_amount: this.calculateTotalAmount(),
      discount: this.getDiscountValue(),
      discount_type: this.getDiscountType(),
      lifetime_discount: !!document.getElementById("lifetime-discount-checkbox")
        ?.checked,
      final_amount: this.calculateFinalAmount(this.calculateTotalAmount()),
      paid_amount:
        parseFloat(document.getElementById("paid-amount-input")?.value) || 0,
      remaining_amount: (() => {
        const total = this.calculateTotalAmount();
        const final = this.calculateFinalAmount(total);
        const paid =
          parseFloat(document.getElementById("paid-amount-input")?.value) || 0;
        return final - paid;
      })(),
      status: "pending",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  // Add isValidUUID helper
  // Replace existing isValidUUID with this more robust version
  isValidUUID(uuid) {
    if (!uuid) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      uuid
    );
  }

  // Populate centers dropdown
  async populateCentersDropdown() {
    const dropdown = document.getElementById("center-dropdown");
    if (!dropdown) return;
    dropdown.innerHTML = "<option>Loading centers...</option>";
    try {
      const centerService = window.app.getService("center");
      const centers = await centerService.getCentersForDropdown();
      dropdown.innerHTML = "";
      if (centers && centers.length > 0) {
        centers.forEach((center) => {
          const option = document.createElement("option");
          option.value = center.id;
          option.textContent = center.center_name;
          dropdown.appendChild(option);
        });
      } else {
        dropdown.innerHTML = "<option>No centers found</option>";
      }
    } catch (e) {
      dropdown.innerHTML = "<option>Error loading centers</option>";
    }
  }

  // Populate references dropdown
  async populateReferencesDropdown() {
    const dropdown = document.getElementById("ref-by-dropdown");
    if (!dropdown) return;
    dropdown.innerHTML = "<option value=''>Loading references...</option>";
    try {
      const referenceService = window.app.getService("reference");
      const references = await referenceService.getReferencesForDropdown();
      dropdown.innerHTML = "<option value=''>Select Reference</option>";
      if (references && references.length > 0) {
        references.forEach((ref) => {
          const option = document.createElement("option");
          option.value = ref.id;
          option.textContent = `${ref.name} (${ref.rid})`;
          dropdown.appendChild(option);
        });
      } else {
        dropdown.innerHTML = "<option value=''>No references found</option>";
      }
    } catch (e) {
      dropdown.innerHTML = "<option value=''>Error loading references</option>";
    }
  }

  // Populate packages dropdown
  async populatePackagesDropdown() {
    const dropdown = document.getElementById("package-dropdown");
    if (!dropdown) return;
    dropdown.innerHTML = "<option>Loading packages...</option>";
    try {
      const pricingService = this.pricingService || window.app.getService("pricing");
      const packages = pricingService
        ? await pricingService.getPackagesForBilling(this.getSelectedCenterId())
        : [];
      dropdown.innerHTML = "<option>Select Package</option>";
      if (packages && packages.length > 0) {
        packages.forEach((pkg) => {
          const option = document.createElement("option");
          option.value = pkg.id;
          const source = pkg.has_center_price ? "Center" : "Global";
          option.textContent = `${pkg.package_name} (${pkg.pgid}) - Rs. ${(
            parseFloat(pkg.resolved_price ?? pkg.price) || 0
          ).toFixed(2)} [${source}]`;
          dropdown.appendChild(option);
        });
      } else {
        dropdown.innerHTML = "<option>No packages found</option>";
      }
    } catch (e) {
      dropdown.innerHTML = "<option>Error loading packages</option>";
    }
  }

  // Get selected center ID
  getSelectedCenterId() {
    const dropdown = document.getElementById("center-dropdown");
    if (dropdown) {
      return dropdown.value;
    }
    return null;
  }

  async handleCenterChange() {
    await this.populatePackagesDropdown();
    await this.repriceSelectedItems();
  }

  async repriceSelectedItems() {
    if (!this.pricingService || !Array.isArray(this.selectedTests) || this.selectedTests.length === 0) {
      this.updateBillTotals();
      this.updateTestTable();
      return;
    }

    const centerId = this.getSelectedCenterId();
    const testIds = this.selectedTests
      .filter((item) => item.itemType !== "package")
      .map((item) => item.id)
      .filter(Boolean);
    const packageIds = this.selectedTests
      .filter((item) => item.itemType === "package")
      .map((item) => item.id)
      .filter(Boolean);

    const [resolvedTests, resolvedPackages] = await Promise.all([
      testIds.length > 0
        ? this.pricingService.getResolvedTestsByIds(testIds, centerId)
        : Promise.resolve([]),
      packageIds.length > 0
        ? this.pricingService.getResolvedPackagesByIds(packageIds, centerId)
        : Promise.resolve([]),
    ]);

    const resolvedTestMap = new Map(
      resolvedTests.map((item) => [item.id, item])
    );
    const resolvedPackageMap = new Map(
      resolvedPackages.map((item) => [item.id, item])
    );

    this.selectedTests = this.selectedTests.map((item) => {
      if (item.itemType === "package") {
        const resolved = resolvedPackageMap.get(item.id);
        return resolved
          ? {
              ...item,
              price: parseFloat(resolved.resolved_price ?? resolved.price) || 0,
              global_price: resolved.global_price,
              center_price: resolved.center_price,
              resolved_price: resolved.resolved_price,
              has_center_price: resolved.has_center_price,
            }
          : item;
      }

      const resolved = resolvedTestMap.get(item.id);
      return resolved
        ? {
            ...item,
            price: parseFloat(resolved.resolved_price ?? resolved.price) || 0,
            global_price: resolved.global_price,
            center_price: resolved.center_price,
            resolved_price: resolved.resolved_price,
            has_center_price: resolved.has_center_price,
          }
        : item;
    });

    this.updateBillTotals();
    this.updateTestTable();
  }

  // Get selected reference ID
  getSelectedReferenceId() {
    const dropdown = document.getElementById("ref-by-dropdown");
    if (dropdown) {
      return dropdown.value;
    }
    return null;
  }

  // Get selected reference name
  getSelectedReferenceName() {
    const dropdown = document.getElementById("ref-by-dropdown");
    if (dropdown && dropdown.value && dropdown.value !== "") {
      const selectedOption = dropdown.options[dropdown.selectedIndex];
      // Extract the name part (before the parentheses)
      const text = selectedOption.textContent;
      const nameMatch = text.match(/^([^(]+)/);
      return nameMatch ? nameMatch[1].trim() : null;
    }
    return null;
  }

  // Get selected reference details (both ID and name)
  getSelectedReferenceDetails() {
    const dropdown = document.getElementById("ref-by-dropdown");
    if (dropdown && dropdown.value && dropdown.value !== "") {
      const selectedOption = dropdown.options[dropdown.selectedIndex];
      const text = selectedOption.textContent;

      // Validate that we have a valid option
      if (!selectedOption || !text || text.trim() === "") {
        console.warn("Invalid reference option selected");
        return null;
      }

      // Parse the reference text - handle various formats
      const nameMatch = text.match(/^([^(]+)/);
      const ridMatch = text.match(/\(([^)]+)\)/);

      const name = nameMatch ? nameMatch[1].trim() : text.trim();
      const rid = ridMatch ? ridMatch[1].trim() : null;

      // Validate that we have at least a name
      if (
        !name ||
        name === "" ||
        name === "Select Reference" ||
        name === "Loading references..."
      ) {
        console.warn("Invalid reference name:", name);
        return null;
      }

      // Validate UUID format for reference ID
      if (selectedOption.value && !this.isValidUUID(selectedOption.value)) {
        console.warn("Invalid reference ID format:", selectedOption.value);
        // For temporary options, we might not have a valid UUID, so we'll allow it
        if (!text.includes("(N/A)") && !text.includes("(Temporary)")) {
          return null;
        }
      }

      return {
        id: selectedOption.value || null,
        name: name,
        rid: rid,
      };
    }
    return null;
  }

  // Setup reference change handler
  setupReferenceChangeHandler() {
    const refByDropdown = document.getElementById("ref-by-dropdown");
    if (refByDropdown) {
      refByDropdown.addEventListener("change", (event) => {
        console.log("Reference dropdown changed:", event.target.value);
        this.handleReferenceChange(event.target.value);
      });
    }
  }

  // Handle reference change
  handleReferenceChange(selectedValue) {
    console.log("Handling reference change:", selectedValue);

    // Clear new referral input when a reference is selected
    if (selectedValue && selectedValue !== "") {
      const newReferralInput = document.getElementById("new-referral-input");
      if (newReferralInput) {
        newReferralInput.value = "";
      }
    }

    // If editing a bill, mark that reference has been changed
    if (this.editingBillId) {
      this.referenceChanged = true;
      console.log("Reference changed for bill being edited");
    }
  }

  // Handle new reference input change
  handleNewReferenceChange(event) {
    const newReferenceValue = event.target.value.trim();

    // Clear reference dropdown when new reference is entered
    if (newReferenceValue && newReferenceValue !== "") {
      const refByDropdown = document.getElementById("ref-by-dropdown");
      if (refByDropdown) {
        refByDropdown.selectedIndex = 0; // Select first option (empty)
      }
    }

    // If editing a bill, mark that reference has been changed
    if (this.editingBillId) {
      this.referenceChanged = true;
      console.log("New reference entered for bill being edited");
    }
  }

  // Get selected package ID (if needed)
  getSelectedPackageId() {
    const dropdown = document.getElementById("package-dropdown");
    if (dropdown) {
      return dropdown.value;
    }
    return null;
  }

  // Get bill items
  getBillItems() {
    const billItems = [];

    this.selectedTests.forEach((item) => {
      const quantity = parseFloat(item.qty || item.quantity) || 1;
      const price = parseFloat(item.price) || 0;

      if (item.itemType === "package") {
        billItems.push({
          package_id: item.id,
          quantity: quantity,
          unit_price: price,
          total_price: quantity * price,
          is_package_component: false,
        });

        const packageTests = Array.isArray(item.package_tests)
          ? item.package_tests
          : [];

        packageTests.forEach((packageTest) => {
          const componentTestId =
            packageTest.test_id || packageTest.tests?.id || null;
          if (!componentTestId) return;

          billItems.push({
            test_id: componentTestId,
            package_id: item.id,
            quantity: quantity,
            unit_price: 0,
            total_price: 0,
            is_package_component: true,
          });
        });
        return;
      }

      billItems.push({
        test_id: item.id,
        quantity: quantity,
        unit_price: price,
        total_price: quantity * price,
        is_package_component: false,
      });
    });

    return billItems;
  }

  // Validate bill data
  validateBillData(billData) {
    const requiredFields = ["patient_name", "patient_phone"];
    const errors = [];

    // Check required fields
    requiredFields.forEach((field) => {
      if (!billData[field] || billData[field].trim() === "") {
        errors.push(`${field.replace("_", " ")} is required`);
      }
    });

    // Check for at least one test/package
    if (!billData.items || billData.items.length === 0) {
      errors.push("At least one test or package must be added");
    }

    // Validate phone number format (basic validation)
    if (billData.patient_phone && billData.patient_phone.trim() !== "") {
      const phoneRegex = /^[0-9+\-\s()]+$/;
      if (!phoneRegex.test(billData.patient_phone.trim())) {
        errors.push("Invalid phone number format");
      }
    }

    // Validate amounts
    if (billData.total_amount < 0) {
      errors.push("Total amount cannot be negative");
    }

    if (billData.discount < 0) {
      errors.push("Discount cannot be negative");
    }

    if (billData.final_amount < 0) {
      errors.push("Final amount cannot be negative");
    }

    // Validate age fields
    if (
      billData.patient_age_years !== null &&
      (billData.patient_age_years < 0 || billData.patient_age_years > 150)
    ) {
      errors.push("Invalid age in years");
    }

    if (
      billData.patient_age_months !== null &&
      (billData.patient_age_months < 0 || billData.patient_age_months > 11)
    ) {
      errors.push("Invalid age in months");
    }

    if (
      billData.patient_age_days !== null &&
      (billData.patient_age_days < 0 || billData.patient_age_days > 31)
    ) {
      errors.push("Invalid age in days");
    }

    // Validate reference data if present
    if (billData.ref_by) {
      // If ref_by is provided, it should be a valid string
      if (
        typeof billData.ref_by !== "string" ||
        billData.ref_by.trim() === ""
      ) {
        errors.push("Invalid reference name provided");
      }
    }

    // Check for potential duplicate data
    if (billData.patient_name && billData.patient_phone) {
      const name = billData.patient_name.trim().toLowerCase();
      const phone = billData.patient_phone.trim();

      // Basic duplicate check - warn user but don't block
      if (name.length > 2 && phone.length > 5) {
        console.log("Potential duplicate check for:", { name, phone });
      }
    }

    if (errors.length > 0) {
      window.app.showError(errors.join(", "));
      return false;
    }

    return true;
  }

  // Print bill
  printBill(bill) {
    try {
      console.log("Printing bill with 2 copies:", bill);

      // Get bill details
      const billData = this.collectBillData();
      const selectedTests = this.selectedTests;

      console.log("Bill data for printing:", billData);
      console.log("Selected tests for printing:", selectedTests);
      console.log(
        "Reference details in bill data:",
        billData.ref_by,
        billData.reference_rid
      );

      // Create two separate bills - one for customer, one for lab
      const customerBillHTML = this.generateBillHTML(
        bill,
        billData,
        selectedTests,
        "CUSTOMER COPY"
      );
      const labBillHTML = this.generateBillHTML(
        bill,
        billData,
        selectedTests,
        "LAB COPY"
      );

      // Generate PDF with two identical pages
      this.generatePDF([customerBillHTML, labBillHTML], bill.bill_no);

      // Show success message with print details
      window.app.showSuccess(
        "Bill saved and PDF generated with 2 copies (Customer Copy & Lab Copy)"
      );
    } catch (error) {
      console.error("Error generating PDF:", error);
      window.app.showError("Failed to generate PDF");
    }
  }

  // Generate PDF with multiple pages
  generatePDF(billHTMLs, billNo) {
    try {
      // Create a combined HTML document with multiple pages
      const combinedHTML = `
        <!DOCTYPE html>
        <html lang="si">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bill - ${billNo}</title>
          <style>
            @media print {
              body { 
                margin: 0; 
                padding: 2px; 
                background: white !important;
                color: black !important;
                overflow: hidden !important;
                font-size: 12px !important;
                line-height: 1.3 !important;
              }
              .no-print { display: none !important; }
              
              .bill-container {
                page-break-inside: avoid;
                break-inside: avoid;
                max-height: none !important;
                overflow: visible !important;
                width: 8cm !important;
                max-width: 8cm !important;
                height: 15cm !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              
              .header {
                margin-bottom: 5px !important;
                text-align: center !important;
                padding: 0 !important;
              }
              
              .lab-name {
                font-size: 16px !important;
                font-weight: bold !important;
                margin-bottom: 3px !important;
              }
              
              .lab-address {
                font-size: 11px !important;
                margin-bottom: 2px !important;
              }
              
              .copy-type {
                font-size: 14px !important;
                font-weight: bold !important;
                text-align: center !important;
                margin-top: 5px !important;
                border: 1px solid #000 !important;
                padding: 2px !important;
                background: #f0f0f0 !important;
                color: #000 !important;
              }
              
              .patient-info {
                margin-bottom: 5px !important;
                padding: 0 !important;
              }
              
              .info-row {
                margin-bottom: 3px !important;
                font-size: 11px !important;
                padding: 0 !important;
              }
              
              .info-label {
                font-weight: bold !important;
                min-width: 60px !important;
                padding-right: 5px !important;
              }
              
              .divider {
                margin: 6px 0 !important;
                border-top: 1px solid #000 !important;
              }
              
              .tests-section {
                margin-bottom: 5px !important;
                padding: 0 !important;
              }
              
              .test-row {
                margin-bottom: 3px !important;
                font-size: 11px !important;
                padding: 0 !important;
              }
              
              .summary-section {
                margin-top: 5px !important;
                padding: 0 !important;
              }
              
              .summary-row {
                margin-bottom: 3px !important;
                font-size: 11px !important;
                padding: 0 !important;
              }
              
              .total-row {
                font-size: 13px !important;
                border-top: 1px solid #000 !important;
                padding-top: 4px !important;
                margin-top: 6px !important;
              }
              
              .footer {
                margin-top: 3px !important;
                padding: 0 !important;
              }
              
              .footer-line {
                height: 1px !important;
                background-color: #000 !important;
                margin-bottom: 3px !important;
              }
              
              .footer-text {
                text-align: center !important;
                font-size: 8px !important;
                line-height: 1.2 !important;
              }
              
              .note-text {
                color: #000 !important;
                margin-bottom: 2px !important;
              }
              
              .thank-you-text {
                color: #000 !important;
                font-size: 10px !important;
                margin-bottom: 2px !important;
              }
              
              .software-credit {
                color: #000 !important;
                font-size: 7px !important;
              }
              
              @page {
                size: 8cm 15cm;
                margin: 0;
              }
              
              html, body {
                height: auto !important;
                min-height: auto !important;
              }
            }
            
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 2px;
              background: white;
              color: black;
              font-size: 12px;
              line-height: 1.3;
            }
            
            .bill-container {
              max-width: 8cm;
              width: 8cm;
              height: 15cm;
              margin: 0 auto;
              background: white;
              page-break-inside: avoid;
              break-inside: avoid;
              min-height: auto;
              padding: 0;
            }
            
            .header {
              text-align: center;
              margin-bottom: 5px;
              padding: 0;
            }
            
            .logo-container img {
              max-width: 100px;
              max-height: 100px;
              margin-bottom: 10px;
            }
            
            .logo-placeholder {
              color: #ccc;
              font-size: 10px;
              margin-bottom: 5px;
            }
            
            .lab-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 3px;
            }
            
            .lab-address {
              font-size: 11px;
              margin-bottom: 2px;
            }
            
            .copy-type {
              font-size: 14px;
              font-weight: bold;
              text-align: center;
              margin-top: 5px;
              border: 1px solid #000;
              padding: 2px;
              background: #f0f0f0;
            }
            
            .patient-info {
              margin-bottom: 5px;
              padding: 0;
            }
            
            .info-row {
              margin-bottom: 3px;
              font-size: 11px;
              display: flex;
              justify-content: space-between;
              padding: 0;
            }
            
            .info-label {
              font-weight: bold;
              min-width: 60px;
              padding-right: 5px;
            }
            
            .info-value {
              flex: 1;
            }
            
            .divider {
              margin: 6px 0;
              border-top: 1px solid #000;
            }
            
            .tests-section {
              margin-bottom: 5px;
              padding: 0;
            }
            
            .test-row {
              margin-bottom: 3px;
              font-size: 11px;
              display: flex;
              justify-content: space-between;
              padding: 0;
            }
            
            .test-name {
              flex: 1;
            }
            
            .test-price {
              font-weight: bold;
            }
            
            .summary-section {
              margin-top: 5px;
              padding: 0;
            }
            
            .summary-row {
              margin-bottom: 3px;
              font-size: 11px;
              display: flex;
              justify-content: space-between;
              padding: 0;
            }
            
            .summary-label {
              font-weight: bold;
            }
            
            .summary-value {
              font-weight: bold;
            }
            
            .total-row {
              font-size: 13px;
              border-top: 1px solid #000;
              padding-top: 4px;
              margin-top: 6px;
            }
            
            .footer {
              margin-top: 3px;
              padding: 0;
            }
            
            .footer-line {
              height: 1px;
              background-color: #000;
              margin-bottom: 3px;
            }
            
            .footer-text {
              text-align: center;
              font-size: 8px;
              line-height: 1.2;
            }
            
            .note-text {
              color: #666;
              margin-bottom: 2px;
            }
            
            .thank-you-text {
              color: #333;
              font-size: 10px;
              margin-bottom: 2px;
            }
            
            .software-credit {
              color: #999;
              font-size: 7px;
            }
            
            .page-break {
              page-break-after: always;
              break-after: page;
            }
          </style>
        </head>
        <body>
          ${billHTMLs
            .map(
              (html, index) => `
            <div class="bill-container">
              ${html}
            </div>
            ${
              index < billHTMLs.length - 1
                ? '<div class="page-break"></div>'
                : ""
            }
          `
            )
            .join("")}
        </body>
        </html>
      `;

      // Open in new window for PDF generation
      const pdfWindow = window.open("", "_blank", "width=800,height=600");
      pdfWindow.document.write(combinedHTML);
      pdfWindow.document.close();

      // Wait for content to load then trigger print (which will save as PDF)
      pdfWindow.onload = function () {
        setTimeout(() => {
          pdfWindow.focus();
          pdfWindow.print();
          // Close window after printing
          setTimeout(() => {
            pdfWindow.close();
          }, 2000); // Increased timeout to ensure print dialog has time to open
        }, 500);
      };
    } catch (error) {
      console.error("PDF generation error:", error);
    }
  }

  // Reset bill form
  resetBillForm() {
    // Reset all form fields
    document
      .querySelectorAll('input[type="text"], input[type="number"]')
      .forEach((input) => {
        input.value = "";
      });

    // Specifically clear the new reference field
    const newReferralInput = document.getElementById("new-referral-input");
    if (newReferralInput) {
      newReferralInput.value = "";
    }

    // Reset selects to first option
    document.querySelectorAll("select").forEach((select) => {
      select.selectedIndex = 0;
    });

    // Clear bill items table
    this.clearBillItemsTable();

    // Reset totals
    this.updateBillTotals();

    // Set current date and time
    this.setCurrentDateTime();

    // Generate new bill number
    this.generateBillNumber();

    // Clear editing mode
    this.editingBillId = null;
    this.referenceChanged = false; // Reset reference change flag

    // Reset save button text
    const saveButton = document.querySelector(".btn-save");
    if (saveButton) {
      saveButton.innerHTML = '<i class="fas fa-save"></i> SAVE BILL';
    }

    // Reset lifetime discount toggle
    const _lifetimeDiscountCheckbox2 = document.getElementById(
      "lifetime-discount-checkbox"
    );
    const _discountInputEl2 = document.getElementById("discount-amount");
    const _discountTypeEl2 = document.getElementById("discount-type");
    if (_lifetimeDiscountCheckbox2 && _discountInputEl2) {
      _lifetimeDiscountCheckbox2.checked = false;
      _discountInputEl2.removeAttribute("disabled");
      _discountInputEl2.value = "0";
    }
    if (_discountTypeEl2) {
      _discountTypeEl2.value = "percent";
      _discountTypeEl2.removeAttribute("disabled");
    }
    this.updateDiscountLabel();
  }

  // Clear bill items table
  clearBillItemsTable() {
    const testTable = document.querySelector(
      ".test-table-container table tbody"
    );
    if (testTable) {
      testTable.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-info-circle"></i>
                        <div>No tests added yet. Search and select tests above.</div>
                    </td>
                </tr>
            `;

      // Update scroll state after content change
      const container = document.querySelector(".test-table-container");
      if (container) {
        this.handleTableScroll(container);
      }
    }
  }

  // Load recent bills
  async loadRecentBills() {
    try {
      const bills = await this.billingService.getRecentBills(10);
      this.displayRecentBills(bills);

      // Clear search results counter
      const searchCounter = document.getElementById("search-results-counter");
      if (searchCounter) {
        searchCounter.style.display = "none";
      }
    } catch (error) {
      console.error("Error loading recent bills:", error);
    }
  }

  // Display recent bills
  displayRecentBills(bills) {
    // Find the recent bills table specifically within the recent-bills-table-container
    const tableBody = document.querySelector(
      ".recent-bills-table-container table tbody"
    );

    if (!tableBody) {
      console.error("Recent bills table not found");
      return;
    }

    if (bills.length === 0) {
      tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-info-circle"></i>
                        <div>No recent bills found</div>
                    </td>
                </tr>
            `;
      return;
    }

    const rows = bills
      .map(
        (bill) => `
            <tr>
                <td><strong>${bill.bill_no || "N/A"}</strong></td>
                <td>${bill.patient_name || "N/A"}</td>
                <td>${
                  bill.bill_date ? window.app.formatDate(bill.bill_date) : "N/A"
                }</td>
                <td><span class="badge bg-success">${window.app.formatCurrency(
                  bill.final_amount || 0
                )}</span></td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" data-action="view" data-bill-no="${
                          bill.bill_no
                        }" title="View Bill">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" data-action="print" data-bill-id="${
                          bill.id
                        }" title="Print Bill">
                            <i class="fas fa-print"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-warning" data-action="edit" data-bill-id="${
                          bill.id
                        }" title="Edit Bill">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `
      )
      .join("");

    tableBody.innerHTML = rows;

    // Update scroll state after content change
    const container = document.querySelector(".recent-bills-table-container");
    if (container) {
      this.handleTableScroll(container);
    }
  }

  // Handle recent bills search
  async handleRecentBillsSearch(event) {
    const searchTerm = event.target.value.trim();

    // Show loading state - use the same selector as displayRecentBills
    const tableBody = document.querySelector(
      ".recent-bills-table-container table tbody"
    );

    if (tableBody) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Searching...</td></tr>';
    }

    if (searchTerm.length === 0) {
      await this.loadRecentBills();
      return;
    }

    if (searchTerm.length < 2) {
      // Show message for short search terms
      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="5" class="text-center text-muted">Please enter at least 2 characters to search</td></tr>';
      }
      return;
    }

    try {
      const bills = await this.billingService.searchBills(searchTerm);
      this.displayRecentBills(bills);

      // Update search results counter
      const searchCounter = document.getElementById("search-results-counter");
      if (searchCounter) {
        searchCounter.textContent = `Found ${bills.length} result(s)`;
        searchCounter.style.display = bills.length > 0 ? "block" : "none";
      }

      // Show search results count
      if (bills.length === 0) {
        window.app.showInfo(`No bills found for "${searchTerm}"`);
      } else {
        window.app.showSuccess(
          `Found ${bills.length} bill(s) for "${searchTerm}"`
        );
      }
    } catch (error) {
      console.error("Error searching bills:", error);
      window.app.showError("Failed to search bills");

      // Show error state in table
      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="5" class="text-center text-danger"><i class="fas fa-exclamation-triangle"></i> Error loading search results</td></tr>';
      }
    }
  }

  // View bill
  async viewBill(billNo) {
    try {
      const bill = await this.billingService.getBillByNumber(billNo);
      this.displayBillDetails(bill);
    } catch (error) {
      console.error("Error loading bill:", error);
      window.app.showError("Failed to load bill details");
    }
  }

  // Print existing bill
  async printExistingBill(billId) {
    try {
      window.app.showLoading("Loading bill for printing...");

      const billingService = window.app.getService("billing");
      const bill = await billingService.getBillById(billId);

      if (!bill) {
        window.app.showError("Bill not found");
        return;
      }

      // Get bill items
      const billItems = await billingService.getBillItems(billId);

      // Convert bill items to selectedTests format for printing
      const selectedTests = billItems
        .map((item) => {
          if (item.tests) {
            return {
              id: item.tests.id,
              test_name: item.tests.test_name,
              short_name: item.tests.short_name,
              price: parseFloat(item.unit_price) || 0,
              qty: item.quantity || 1,
              itemType: "test",
            };
          } else if (item.packages) {
            return {
              id: item.packages.id,
              test_name: item.packages.package_name,
              short_name:
                item.packages.short_name || item.packages.package_name,
              price: parseFloat(item.unit_price) || 0,
              qty: item.quantity || 1,
              itemType: "package",
            };
          }
          return null;
        })
        .filter((test) => test !== null);

      // Create bill data for printing
      const billData = {
        patient_title: bill.patient_title,
        patient_name: bill.patient_name,
        patient_age_years: bill.patient_age_years,
        patient_age_months: bill.patient_age_months,
        patient_age_days: bill.patient_age_days,
        patient_gender: bill.patient_gender,
        patient_phone: bill.patient_phone,
        ref_by: bill.ref_by,
        reference_rid: bill.reference_rid, // Include RID if available
        new_referral: bill.new_referral,
      };

      console.log("Printing existing bill:", bill);
      console.log("Bill data for printing:", billData);
      console.log("Selected tests for printing:", selectedTests);

      // Create two separate bills - one for customer, one for lab
      const customerBillHTML = this.generateBillHTML(
        bill,
        billData,
        selectedTests,
        "CUSTOMER COPY"
      );
      const labBillHTML = this.generateBillHTML(
        bill,
        billData,
        selectedTests,
        "LAB COPY"
      );

      // Generate PDF with two identical pages
      this.generatePDF([customerBillHTML, labBillHTML], bill.bill_no);

      window.app.showSuccess(
        "PDF generated successfully with 2 copies (Customer Copy & Lab Copy)"
      );
      window.app.hideLoading();
    } catch (error) {
      console.error("Error printing existing bill:", error);
      window.app.showError("Failed to print bill");
      window.app.hideLoading();
    }
  }

  // Display bill details
  displayBillDetails(bill) {
    // This would show bill details in a modal or new page
    console.log("Displaying bill details:", bill);
    window.app.showInfo(`Viewing bill ${bill.bill_no}`);
  }

  // Edit bill
  async editBill(billId) {
    try {
      window.app.showLoading("Loading bill for editing...");

      const billingService = window.app.getService("billing");
      const bill = await billingService.getBillById(billId);

      if (!bill) {
        window.app.showError("Bill not found");
        return;
      }

      // Set editing mode
      this.editingBillId = billId;
      this.referenceChanged = false; // Reset reference change flag

      // Update save button text
      const saveButton = document.querySelector(".btn-save");
      if (saveButton) {
        saveButton.innerHTML = '<i class="fas fa-save"></i> UPDATE BILL';
      }

      // Populate form with bill data
      this.populateFormWithBillData(bill);

      window.app.showSuccess("Bill loaded for editing");
      window.app.hideLoading();
    } catch (error) {
      console.error("Error loading bill for editing:", error);
      window.app.showError("Failed to load bill for editing");
      window.app.hideLoading();
    }
  }

  // Populate form with bill data for editing
  populateFormWithBillData(bill) {
    console.log("Populating form with bill data:", bill);

    // Populate basic patient information
    if (bill.patient_phone) {
      document.getElementById("patient-phone").value = bill.patient_phone;
    }
    if (bill.patient_name) {
      document.getElementById("patient-name").value = bill.patient_name;
    }
    if (bill.patient_age_years) {
      document.getElementById("patient-age-years").value =
        bill.patient_age_years;
    }
    if (bill.patient_age_months) {
      document.getElementById("patient-age-months").value =
        bill.patient_age_months;
    }
    if (bill.patient_age_days) {
      document.getElementById("patient-age-days").value = bill.patient_age_days;
    }
    if (bill.patient_title) {
      const titleSelect = document.querySelector(
        'select[name="patient_title"]'
      );
      if (titleSelect) {
        titleSelect.value = bill.patient_title;
      }
    }
    if (bill.patient_gender) {
      const genderSelect = document.querySelector(
        'select[name="patient_gender"]'
      );
      if (genderSelect) {
        genderSelect.value = bill.patient_gender;
      }
    }
    if (bill.bill_type) {
      const billTypeSelect = document.querySelector('select[name="bill_type"]');
      if (billTypeSelect) {
        billTypeSelect.value = bill.bill_type;
      }
    }
    if (bill.center_id) {
      const centerSelect = document.getElementById("center-dropdown");
      if (centerSelect) {
        centerSelect.value = bill.center_id;
      }
    }
    if (bill.ref_by) {
      // Set the reference dropdown to the correct value
      const refByDropdown = document.getElementById("ref-by-dropdown");
      if (refByDropdown) {
        console.log("Setting reference dropdown for:", bill.ref_by);
        console.log("Reference ID from bill:", bill.reference_id);

        let referenceFound = false;

        // First try to match by reference_id if available (more reliable)
        if (bill.reference_id) {
          for (let i = 0; i < refByDropdown.options.length; i++) {
            if (refByDropdown.options[i].value === bill.reference_id) {
              refByDropdown.selectedIndex = i;
              console.log("Reference dropdown set by ID to index:", i);
              referenceFound = true;
              break;
            }
          }
        }

        // If not found by ID, try to match by name
        if (!referenceFound) {
          const options = refByDropdown.options;
          for (let i = 0; i < options.length; i++) {
            const optionText = options[i].textContent;
            const referenceName = optionText.split(" (")[0]; // Extract name part before (RID)
            console.log(
              "Checking option:",
              referenceName,
              "against:",
              bill.ref_by
            );
            if (referenceName === bill.ref_by) {
              refByDropdown.selectedIndex = i;
              console.log("Reference dropdown set by name to index:", i);
              referenceFound = true;
              break;
            }
          }
        }

        // If reference not found in dropdown, add it as a temporary option
        if (!referenceFound) {
          console.log(
            "Reference not found in dropdown, adding as temporary option"
          );
          const tempOption = document.createElement("option");
          tempOption.value = bill.reference_id || "";
          tempOption.textContent = `${bill.ref_by} (${
            bill.reference_rid || "N/A"
          })`;
          tempOption.style.color = "#666";
          refByDropdown.appendChild(tempOption);
          refByDropdown.selectedIndex = refByDropdown.options.length - 1;
          console.log("Added temporary reference option");
        }
      }
    }
    if (bill.new_referral) {
      document.getElementById("new-referral-input").value = bill.new_referral;
    }
    // Payment fields must populate even when values are 0
    if (bill.discount !== undefined && bill.discount !== null) {
      document.getElementById("discount-amount").value = bill.discount;
    }
    const discountTypeEl = document.getElementById("discount-type");
    if (discountTypeEl) {
      discountTypeEl.value =
        bill.discount_type === "fixed" ? "fixed" : "percent";
    }
    if (bill.paid_amount !== undefined && bill.paid_amount !== null) {
      document.getElementById("paid-amount-input").value = bill.paid_amount;
    }

    // Lifetime discount UI state
    const _lifetimeDiscountCheckbox = document.getElementById(
      "lifetime-discount-checkbox"
    );
    const _discountInputEl = document.getElementById("discount-amount");
    const _discountTypeEl = document.getElementById("discount-type");
    if (_lifetimeDiscountCheckbox && _discountInputEl) {
      const isLifetime = !!bill.lifetime_discount;
      _lifetimeDiscountCheckbox.checked = isLifetime;
      if (isLifetime) {
        if (_discountTypeEl) {
          _discountTypeEl.value = "percent";
          _discountTypeEl.setAttribute("disabled", "disabled");
        }
        _discountInputEl.value = "10";
        _discountInputEl.setAttribute("disabled", "disabled");
      } else {
        if (_discountTypeEl) {
          _discountTypeEl.removeAttribute("disabled");
        }
        _discountInputEl.removeAttribute("disabled");
      }
    }

    this.updateDiscountLabel();
    // Update totals (respect explicit 0 discount)
    this.updateBillTotals();

    // Load bill items if available
    this.loadBillItemsForEditing(bill.id);
  }

  // Load bill items for editing
  async loadBillItemsForEditing(billId) {
    try {
      const billingService = window.app.getService("billing");
      const billItems = await billingService.getBillItems(billId);

      if (billItems && billItems.length > 0) {
        // Clear existing items
        this.selectedTests = [];

        // Add each item to selectedTests
        for (const item of billItems) {
          if (item.tests) {
            this.selectedTests.push({
              id: item.tests.id,
              test_name: item.tests.test_name,
              short_name: item.tests.short_name,
              price: parseFloat(item.unit_price) || 0,
              category: item.tests.category,
              qty: item.quantity || 1,
              itemType: "test",
              pricing_source: "saved_bill",
            });
          } else if (item.packages) {
            let packageTests = [];
            try {
              if (this.pricingService) {
                const packageData = await this.pricingService.getResolvedPackageById(
                  item.packages.id,
                  this.getSelectedCenterId()
                );
                packageTests = Array.isArray(packageData?.package_tests)
                  ? packageData.package_tests
                  : [];
              }
            } catch (packageError) {
              console.warn("Failed to load package component tests for editing:", packageError);
            }

            this.selectedTests.push({
              id: item.packages.id,
              test_name: item.packages.package_name,
              short_name: item.packages.short_name,
              price: parseFloat(item.unit_price) || 0,
              category: "Package",
              qty: item.quantity || 1,
              itemType: "package",
              package_tests: packageTests,
              pricing_source: "saved_bill",
            });
          }
        }

        // Update the test table
        this.updateTestTable();

        // Recalculate payment summary now that items are loaded
        this.updateBillTotals();

        const paidEl = document.getElementById("paid-amount-input");
        const currentPaid = parseFloat(paidEl?.value) || 0;
        this.updateRemainingAmount(currentPaid);
      }
    } catch (error) {
      console.error("Error loading bill items for editing:", error);
    }
  }

  // Handle refresh
  async handleRefresh() {
    try {
      window.app.showLoading("Refreshing...");
      await this.loadRecentBills();
      window.app.showSuccess("Data refreshed");
      window.app.hideLoading();
    } catch (error) {
      console.error("Error refreshing data:", error);
      window.app.showError("Failed to refresh data");
      window.app.hideLoading();
    }
  }

  // Setup auto complete
  setupAutoComplete() {
    console.log("Setting up autocomplete...");

    // Setup reference auto complete (existing)
    const refByInput = document.querySelector('input[value="DR M AMUNUGAMA"]');
    if (refByInput) {
      refByInput.addEventListener(
        "input",
        this.debounce(this.handleReferenceSearch.bind(this), 300)
      );
    }

    // Setup test auto complete for Test Details field
    const testInput = document.getElementById("test-details-input");
    console.log("Test input found:", testInput);

    if (testInput) {
      testInput.addEventListener(
        "input",
        this.debounce(this.handleTestSearch.bind(this), 300)
      );
      // Add Enter key support
      testInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.addTestFromInput();
        }
      });
      console.log("Test input event listeners added");
    } else {
      console.error("Test input not found during setup");
    }
  }

  // Add test from input field if it matches a suggestion
  async addTestFromInput() {
    const testInput = document.getElementById("test-details-input");
    if (!testInput) return;
    const value = testInput.value.trim().toLowerCase();
    if (!value) return;
    // Try to find a matching test from the last suggestions
    let tests = [];
    if (this._lastTestSuggestions) {
      tests = this._lastTestSuggestions;
    } else {
      // fallback: search again
      const pricingService = this.pricingService || window.app.getService("pricing");
      tests = pricingService
        ? await pricingService.searchTestsForBilling(value, this.getSelectedCenterId())
        : [];
      if ((!tests || tests.length === 0) && window.Config) {
        const sampleTests = window.Config.getSampleData("tests") || [];
        tests = sampleTests.filter(
          (t) =>
            t.test_name.toLowerCase().includes(value) ||
            t.short_name.toLowerCase().includes(value)
        );
      }
    }
    // Find exact match first
    let match = tests.find(
      (t) =>
        t.test_name.toLowerCase() === value ||
        t.short_name.toLowerCase() === value
    );

    // If no exact match, try to find the first partial match
    if (!match && tests.length > 0) {
      match = tests[0]; // Use the first suggestion
    }

    if (match) {
      this.selectTest(encodeURIComponent(JSON.stringify(match)));
      // Clear the input field after adding test
      testInput.value = "";
      // Remove any existing dropdown
      const dropdown = document.getElementById("test-dropdown");
      if (dropdown) dropdown.remove();
    } else {
      // If no match found at all, show error message
      window.app.showError(
        "Test not found. Please check the test name or select from suggestions."
      );
    }
  }

  // Handle reference search
  async handleReferenceSearch(event) {
    const searchTerm = event.target.value.trim();

    if (searchTerm.length < 2) return;

    try {
      const referenceService = window.app.getService("reference");
      const references = await referenceService.searchReferences(searchTerm);
      this.displayReferenceSuggestions(references);
    } catch (error) {
      console.error("Error searching references:", error);
    }
  }

  // Display reference suggestions
  displayReferenceSuggestions(references) {
    // Create dropdown for reference suggestions
    let dropdown = document.getElementById("reference-dropdown");
    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.id = "reference-dropdown";
      dropdown.className = "dropdown-menu show position-absolute w-100";
      dropdown.style.cssText =
        "z-index: 1000; max-height: 200px; overflow-y: auto;";

      const refByInput = document.querySelector(
        'input[value="DR M AMUNUGAMA"]'
      );
      if (refByInput) {
        refByInput.parentElement.style.position = "relative";
        refByInput.parentElement.appendChild(dropdown);
      }
    }

    if (references.length === 0) {
      dropdown.innerHTML =
        '<div class="dropdown-item">No references found</div>';
      return;
    }

    const items = references
      .map(
        (ref) => `
            <div class="dropdown-item" onclick="window.billingController.selectReference('${ref.name}')">
                <strong>${ref.name}</strong> (${ref.rid})
            </div>
        `
      )
      .join("");

    dropdown.innerHTML = items;
  }

  // Select reference
  selectReference(referenceName) {
    const refByInput = document.querySelector('input[value="DR M AMUNUGAMA"]');
    if (refByInput) {
      refByInput.value = referenceName;
    }

    const dropdown = document.getElementById("reference-dropdown");
    if (dropdown) {
      dropdown.remove();
    }
  }

  // Handle test search for autocomplete
  async handleTestSearch(event) {
    const searchTerm = event.target.value.trim();
    console.log("Searching for tests with term:", searchTerm);

    if (searchTerm.length < 2) {
      this.displayTestSuggestions([]);
      this._lastTestSuggestions = [];
      return;
    }
    try {
      const pricingService = this.pricingService || window.app.getService("pricing");
      let tests = pricingService
        ? await pricingService.searchTestsForBilling(
            searchTerm,
            this.getSelectedCenterId()
          )
        : [];
      console.log("Tests from service:", tests);

      // Fallback to sample data if no results from DB
      if ((!tests || tests.length === 0) && window.Config) {
        const sampleTests = window.Config.getSampleData("tests") || [];
        console.log("Using sample tests:", sampleTests);
        tests = sampleTests.filter(
          (t) =>
            t.test_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.short_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        console.log("Filtered sample tests:", tests);
      }
      tests = (tests || []).slice().sort((a, b) => {
        const an = ((a && (a.test_name || a.short_name)) || "").toString();
        const bn = ((b && (b.test_name || b.short_name)) || "").toString();
        return an.localeCompare(bn, undefined, { sensitivity: "base" });
      });
      this._lastTestSuggestions = tests;
      this.displayTestSuggestions(tests);
    } catch (error) {
      console.error("Error searching tests:", error);
    }
  }

  // Display test suggestions dropdown
  displayTestSuggestions(tests) {
    console.log("Displaying test suggestions:", tests);
    let dropdown = document.getElementById("test-dropdown");
    const testInput = document.getElementById("test-details-input");
    if (!testInput) {
      console.error("Test input not found");
      return;
    }
    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.id = "test-dropdown";
      dropdown.className = "dropdown-menu show position-absolute w-100";
      dropdown.style.cssText =
        "z-index: 1000; max-height: 200px; overflow-y: auto;";
      testInput.parentElement.style.position = "relative";
      testInput.parentElement.appendChild(dropdown);
    }
    if (tests.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-item">No tests found</div>';
      return;
    }
    const dropdownItems = tests
      .map(
        (test) =>
          `<div class="dropdown-item" onclick="window.billingController.selectTest('${encodeURIComponent(
            JSON.stringify(test)
          )}')">
        <strong>${test.test_name}</strong> (${test.short_name}) - Rs. ${
            (parseFloat(test.resolved_price ?? test.price) || 0).toFixed(2)
          } <span class="small text-muted">[${
            test.has_center_price ? "Center" : "Global"
          }]</span>
      </div>`
      )
      .join("");
    console.log("Generated dropdown items:", dropdownItems);
    dropdown.innerHTML = dropdownItems;
  }

  // Select test from suggestions
  selectTest(testJson) {
    const test = JSON.parse(decodeURIComponent(testJson));
    console.log("Selected test:", test);

    const testInput = document.getElementById("test-details-input");
    if (testInput) {
      testInput.value = test.test_name;
    }

    // Add to selectedTests if not already present
    if (
      !this.selectedTests.some(
        (t) =>
          t.itemType !== "package" &&
          t.id === test.id &&
          t.test_name === test.test_name
      )
    ) {
      this.selectedTests.push({
        ...test,
        itemType: "test",
        price: parseFloat(test.resolved_price ?? test.price) || 0,
        qty: 1,
      });
      console.log("Added test to selectedTests:", this.selectedTests);
      this.updateBillTotals();
      this.updateTestTable();

      // Clear the input field after adding test
      if (testInput) {
        testInput.value = "";
      }
    } else {
      console.log("Test already exists in selectedTests");
      // Still clear the input field even if test already exists
      if (testInput) {
        testInput.value = "";
      }
    }

    // Remove dropdown
    const dropdown = document.getElementById("test-dropdown");
    if (dropdown) dropdown.remove();
  }

  // Update the test table with selected tests
  updateTestTable() {
    // Find the test table specifically within the test-table-container
    const testTable = document.querySelector(
      ".test-table-container table tbody"
    );
    console.log("Found test table:", testTable);

    if (!testTable) {
      console.error("Test table not found");
      return;
    }

    console.log("Updating test table with selected tests:", this.selectedTests);

    if (!this.selectedTests || this.selectedTests.length === 0) {
      testTable.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-info-circle"></i><div>No tests added yet. Search and select tests above.</div></td></tr>`;
      return;
    }

    const tableRows = this.selectedTests
      .map((t, idx) => {
        const price = parseFloat(t.price) || 0;
        const qty = parseFloat(t.qty) || 1;
        const total = price * qty;
        return `<tr>
            <td>${t.test_name || ""}</td>
            <td>${t.short_name || ""}</td>
            <td>${this.renderPriceCell(t)}</td>
            <td>${qty}</td>
            <td>${total.toFixed(2)}</td>
            <td><button class="btn btn-danger btn-sm" data-action="delete-test" data-index="${idx}"><i class="fas fa-trash"></i></button></td>
          </tr>`;
      })
      .join("");

    console.log("Generated table rows:", tableRows);
    testTable.innerHTML = tableRows;

    // Update scroll state after content change
    const container = document.querySelector(".test-table-container");
    if (container) {
      this.handleTableScroll(container);
    }
  }

  // Remove test from selectedTests
  removeTest(idx) {
    this.selectedTests.splice(idx, 1);
    this.updateBillTotals();
    this.updateTestTable();
  }

  // Generate bill HTML
  generateBillHTML(bill, billData, selectedTests, copyType) {
    const now = new Date();
    const formattedDate = now.toLocaleDateString("si-LK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const formattedTime = now.toLocaleTimeString("si-LK", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const totalAmount = this.calculateTotalAmount();
    const discountType = this.getDiscountType();
    const discountValue = this.getDiscountValue();
    const discountAmount = this.calculateDiscountAmount(totalAmount);
    const finalAmount = totalAmount - discountAmount;
    const discountLabel =
      discountType === "fixed"
        ? `Discount (Rs. ${discountValue.toFixed(2)})`
        : `Discount (${discountValue}%)`;
    const paidAmount =
      parseFloat(document.getElementById("paid-amount-input")?.value) || 0;
    const remainingAmount = finalAmount - paidAmount;

    // Generate a single bill content
    const singleBillContent = `
      <!-- Header -->
      <div class="header">
        <div class="logo-container">
          <img src="Imgs/suwajeewa_logo.png" alt="Suwajeewa Laboratory Logo" style="max-width: 100px; max-height: 100px; margin-bottom: 10px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="logo-placeholder" style="display: none;">//LOGO HERE</div>
        </div>
        <div class="lab-name">Suwajeewa Laboratories</div>
        <div class="lab-address">No 62, Akuramboda Road Pallepola, Matale</div>
        <div class="lab-address">070 6222 644</div>
        ${
          copyType === "LAB COPY"
            ? `<div class="copy-type" style="text-align: center; font-weight: bold; font-size: 14px; margin-top: 5px; border: 1px solid #000; padding: 2px; background: #f0f0f0;">${copyType}</div>`
            : ""
        }
      </div>
      
      <!-- Patient Information -->
      <div class="patient-info">
        <div class="info-row">
          <span class="info-label">Bill No :</span>
          <span class="info-value">${bill.bill_no}</span>
        </div>
        <div class="info-row">
          <span class="info-label">     Date :</span>
          <span class="info-value">${formattedDate}           ${formattedTime}</span>
        </div>
    
        <div class="info-row">
          <span class="info-label">Name :</span>
          <span class="info-value">${
            billData.patient_title ? billData.patient_title + " " : ""
          }${billData.patient_name || ""}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Age :</span>
          <span class="info-value">${this.formatAge(
            billData.patient_age_years,
            billData.patient_age_months,
            billData.patient_age_days
          )}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Gender :</span>
          <span class="info-value">${billData.patient_gender || ""}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Ref By :</span>
          <span class="info-value">${billData.ref_by || "N/A"}${
      billData.reference_rid ? ` (${billData.reference_rid})` : ""
    }</span>
        </div>
        <div class="info-row">
          <span class="info-label">TEL :</span>
          <span class="info-value">${
            billData.patient_phone || "////////////"
          }</span>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- Tests Section -->
      <div class="tests-section">
        ${selectedTests
          .map(
            (test) => `
          <div class="test-row">
            <span class="test-name">${test.test_name}</span>
            <span class="test-price">Rs. ${test.price.toFixed(2)}</span>
          </div>
        `
          )
          .join("")}
      </div>
      
      <div class="divider"></div>
      
      <!-- Summary Section -->
      <div class="summary-section">
        <div class="summary-row">
          <span class="summary-label">Total :</span>
          <span class="summary-value">Rs. ${totalAmount.toFixed(2)}</span>
        </div>
         <div class="summary-row">
           <span class="summary-label">${discountLabel} :</span>
           <span class="summary-value">Rs. ${discountAmount.toFixed(2)}</span>
         </div>
        <div class="summary-row total-row">
          <span class="summary-label">Amount :</span>
          <span class="summary-value">Rs. ${finalAmount.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Paid Amount :</span>
          <span class="summary-value">Rs. ${paidAmount.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Remaining to Pay :</span>
          <span class="summary-value">Rs. ${remainingAmount.toFixed(2)}</span>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <div class="footer-line"></div>
        <div class="footer-text">
          <div class="note-text">Note : Please collect the report with in 30 days.</div>
          <div class="thank-you-text">Thank you for choosing Suwajeewa Laboratories!</div>
          <div class="software-credit">SOFTWARE BY LAKSHAN SACHINTHA</div>
        </div>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html lang="si">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bill - ${bill.bill_no}</title>
        <style>
          @media print {
            body { 
              margin: 0; 
              padding: 2px; 
              background: white !important;
              color: black !important;
              overflow: hidden !important;
              font-size: 12px !important;
              line-height: 1.3 !important;
            }
            .no-print { display: none !important; }
            
            .bill-container {
              page-break-inside: avoid;
              break-inside: avoid;
              max-height: none !important;
              overflow: visible !important;
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .header {
              margin-bottom: 5px !important;
              text-align: center !important;
              padding: 0 !important;
            }
            
            .lab-name {
              font-size: 16px !important;
              font-weight: bold !important;
              margin-bottom: 3px !important;
            }
            
            .lab-address {
              font-size: 11px !important;
              margin-bottom: 2px !important;
            }
            
            .copy-type {
              font-size: 14px !important;
              font-weight: bold !important;
              text-align: center !important;
              margin-top: 5px !important;
              border: 1px solid #000 !important;
              padding: 2px !important;
              background: #f0f0f0 !important;
              color: #000 !important;
            }
            
            .patient-info {
              margin-bottom: 5px !important;
              padding: 0 !important;
            }
            
            .info-row {
              margin-bottom: 3px !important;
              font-size: 11px !important;
              padding: 0 !important;
            }
            
            .info-label {
              font-weight: bold !important;
              min-width: 60px !important;
              padding-right: 5px !important;
            }
            
            .divider {
              margin: 6px 0 !important;
              border-top: 1px solid #000 !important;
            }
            
            .tests-section {
              margin-bottom: 5px !important;
              padding: 0 !important;
            }
            
            .test-row {
              margin-bottom: 3px !important;
              font-size: 11px !important;
              padding: 0 !important;
            }
            
            .summary-section {
              margin-top: 5px !important;
              padding: 0 !important;
            }
            
            .summary-row {
              margin-bottom: 3px !important;
              font-size: 11px !important;
              padding: 0 !important;
            }
            
            .total-row {
              font-size: 13px !important;
              border-top: 1px solid #000 !important;
              padding-top: 4px !important;
              margin-top: 6px !important;
            }
            
            .footer {
              background: white !important;
              border: none !important;
              box-shadow: none !important;
              page-break-after: avoid;
              break-after: avoid;
              margin-top: 6px !important;
              padding: 4px 0 !important;
            }
            
            .footer-line {
              background-color: #000 !important;
              margin-bottom: 6px !important;
            }
            
            .footer-text {
              gap: 3px !important;
            }
            
            .note-text {
              font-size: 10px !important;
              color: #000 !important;
              margin: 0 !important;
            }
            
            .thank-you-text {
              font-size: 12px !important;
              color: #000 !important;
              margin: 2px 0 !important;
            }
            
            .software-credit {
              font-size: 9px !important;
              color: #000 !important;
              margin-top: 2px !important;
            }
            
            /* Prevent any extra content from printing */
            * {
              page-break-after: avoid;
              break-after: avoid;
            }
            
            /* Ensure only the bill content prints */
            html, body {
              height: auto !important;
              min-height: auto !important;
            }
            
            /* Remove all unnecessary spacing */
            .logo-placeholder {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .info-value {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .test-name, .test-price {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .summary-label, .summary-value {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* Thermal printer specific optimizations */
            @page {
              margin: 0;
              size: 80mm auto;
            }
          }
          
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 2px;
            background: white;
            color: black;
            font-size: 12px;
            line-height: 1.3;
          }
          
          .bill-container {
            max-width: 80mm;
            width: 100%;
            margin: 0 auto;
            background: white;
            page-break-inside: avoid;
            break-inside: avoid;
            min-height: auto;
            height: auto;
            padding: 0;
          }
          
          .header {
            text-align: center;
            margin-bottom: 5px;
            padding: 0;
          }
          
          .logo-placeholder {
            color: #ccc;
            font-size: 10px;
            margin-bottom: 2px;
            padding: 0;
          }
          
          .lab-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 3px;
          }
          
          .lab-address {
            font-size: 11px;
            margin-bottom: 2px;
          }
          
          .patient-info {
            margin-bottom: 5px;
            padding: 0;
          }
          
          .info-row {
            display: flex;
            margin-bottom: 3px;
            font-size: 11px;
            padding: 0;
          }
          
          .info-label {
            font-weight: bold;
            min-width: 60px;
            text-align: left;
            padding-right: 5px;
          }
          
          .info-value {
            margin-left: 5px;
            padding: 0;
          }
          
          .divider {
            border-top: 1px solid #000;
            margin: 6px 0;
          }
          
          .tests-section {
            margin-bottom: 5px;
            padding: 0;
          }
          
          .test-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 11px;
            padding: 0;
          }
          
          .test-name {
            flex: 1;
            margin: 0;
            padding: 0;
          }
          
          .test-price {
            text-align: right;
            min-width: 60px;
            margin: 0;
            padding: 0;
          }
          
          .summary-section {
            margin-top: 6px;
            padding: 0;
          }
          
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 11px;
            padding: 0;
          }
          
          .summary-label {
            font-weight: bold;
            margin: 0;
            padding: 0;
          }
          
          .summary-value {
            text-align: right;
            margin: 0;
            padding: 0;
          }
          
          .total-row {
            font-weight: bold;
            font-size: 13px;
            border-top: 1px solid #000;
            padding-top: 4px;
            margin-top: 6px;
          }
          
          .footer {
            margin-top: 6px;
            text-align: center;
            padding: 4px 0;
          }
          
          .footer-line {
            height: 1px;
            background-color: #000;
            margin-bottom: 6px;
          }
          
          .footer-text {
            display: flex;
            flex-direction: column;
            gap: 3px;
            align-items: center;
          }
          
          .note-text {
            font-size: 10px;
            color: #000;
            font-weight: normal;
            margin: 0;
          }
          
          .thank-you-text {
            font-size: 12px;
            font-weight: bold;
            color: #000;
            margin: 2px 0;
          }
          
          .software-credit {
            font-size: 9px;
            color: #000;
            font-weight: normal;
            margin-top: 2px;
          }
          
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
          }
          
          .print-button:hover {
            background: #0056b3;
          }
          
          
          
          .duplicate-label {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin: 10px 0;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <button class="print-button no-print" onclick="window.print()">🖨️ Print</button>
        
        <!-- First Bill Copy -->
        <div class="bill-container">
          ${singleBillContent}
        </div>
        
      </body>
      </html>
    `;
  }

  // Format age display
  formatAge(years, months, days) {
    const parts = [];
    if (years) parts.push(`${years} Yrs`);
    if (months) parts.push(`${months} Mths`);
    if (days) parts.push(`${days} Days`);
    return parts.length > 0 ? parts.join(" ") : "";
  }

  // Test reference selection (for debugging)
  testReferenceSelection() {
    const dropdown = document.getElementById("ref-by-dropdown");
    console.log("Dropdown element:", dropdown);
    console.log("Dropdown value:", dropdown?.value);
    console.log("Dropdown selectedIndex:", dropdown?.selectedIndex);
    console.log("Dropdown options:", dropdown?.options);

    if (dropdown && dropdown.options) {
      for (let i = 0; i < dropdown.options.length; i++) {
        console.log(
          `Option ${i}:`,
          dropdown.options[i].value,
          dropdown.options[i].textContent
        );
      }
    }

    const referenceDetails = this.getSelectedReferenceDetails();
    console.log("Selected reference details:", referenceDetails);

    return referenceDetails;
  }

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Initialize scroll functionality for tables
  initializeTableScroll() {
    // Add scroll event listeners to table containers
    const testTableContainer = document.querySelector(".test-table-container");
    const recentBillsTableContainer = document.querySelector(
      ".recent-bills-table-container"
    );

    if (testTableContainer) {
      this.setupTableScroll(testTableContainer);
    }

    if (recentBillsTableContainer) {
      this.setupTableScroll(recentBillsTableContainer);
    }
  }

  // Setup scroll functionality for a table container
  setupTableScroll(container) {
    if (!container) return;

    // Add scroll event listener
    container.addEventListener("scroll", () => {
      this.handleTableScroll(container);
    });

    // Check initial scroll state
    this.handleTableScroll(container);

    // Add content change observer
    const observer = new MutationObserver(() => {
      this.handleTableScroll(container);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });
  }

  // Handle table scroll events
  handleTableScroll(container) {
    if (!container) return;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Add/remove scrolled class for shadow effect
    if (scrollTop > 0) {
      container.classList.add("scrolled");
    } else {
      container.classList.remove("scrolled");
    }

    // Add/remove has-content class for bottom shadow
    if (scrollHeight > clientHeight) {
      container.classList.add("has-content");
    } else {
      container.classList.remove("has-content");
    }
  }
}

// Initialize billing controller when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.billingController = new BillingController();
  window.billingController.initialize();
});
