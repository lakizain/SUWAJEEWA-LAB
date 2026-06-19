// Patient History Controller - wires UI and BillingService search
(function () {
  function renderRows(tableBody, bills) {
    if (!bills || bills.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">No results found</td></tr>';
      return;
    }

    const rows = bills
      .map((bill) => {
        const tests = (bill.bill_items || [])
          .map((it) => it.tests?.test_name || it.packages?.package_name || "")
          .filter(Boolean)
          .join(", ");
        const dateStr = window.app
          ? window.app.formatDate(bill.bill_date, "short")
          : new Date(bill.bill_date).toLocaleDateString();
        const paidStr = window.app
          ? window.app.formatCurrency(bill.paid_amount || 0)
          : bill.paid_amount || 0;
        const remainStr = window.app
          ? window.app.formatCurrency(bill.remaining_amount || 0)
          : bill.remaining_amount || 0;

        return `
          <tr>
            <td>${bill.bill_no || ""}</td>
            <td>${bill.patient_name || ""}</td>
            <td>${dateStr}</td>
            <td>${bill.patient_gender || ""}</td>
            <td>${tests}</td>
            <td>${paidStr}</td>
            <td>${remainStr}</td>
          </tr>
        `;
      })
      .join("");

    tableBody.innerHTML = rows;
  }

  function populateCenters(selectEl, centers) {
    selectEl.innerHTML =
      '<option value="all" selected>Select the center</option>' +
      (centers || [])
        .map((c) => `<option value="${c.id}">${c.center_name}</option>`) // id + name
        .join("");
  }

  function populateMembersFromBills(selectEl, bills) {
    const uniqueNames = Array.from(
      new Set((bills || []).map((b) => b.patient_name).filter(Boolean))
    );
    selectEl.innerHTML =
      '<option value="all" selected>Select the member</option>' +
      uniqueNames
        .map((name) => `<option value="${name}">${name}</option>`)
        .join("");
  }

  async function attachPatientHistoryController() {
    const centerSelect = document.getElementById("centerSelect");
    const memberSelect = document.getElementById("memberSelect");
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");
    const tableBody = document.getElementById("historyTableBody");

    if (!window.app) return;
    const billing = window.app.getService("billing");

    // Populate dropdowns when initial data is ready
    const centers = (window.APP_CACHE && window.APP_CACHE.centers) || [];
    populateCenters(centerSelect, centers);

    // Keep last fetched result set for member filtering
    let lastBills = [];

    async function performSearch() {
      const query = searchInput.value.trim();
      const centerId = centerSelect.value;
      const memberName = memberSelect.value;

      if (!query) {
        tableBody.innerHTML =
          '<tr><td colspan="7" class="text-center text-muted">Enter phone or bill no to search</td></tr>';
        return;
      }

      tableBody.innerHTML =
        '<tr><td colspan="7" class="text-center">Searching...</td></tr>';
      if (!billing || typeof billing.searchPatientHistory !== "function") {
        tableBody.innerHTML =
          '<tr><td colspan="7" class="text-center text-danger">Billing service unavailable</td></tr>';
        return;
      }

      const bills = await billing.searchPatientHistory({
        query,
        centerId,
        // Do not pass memberName here; populate dropdown from full result first
      });
      lastBills = bills || [];
      populateMembersFromBills(memberSelect, lastBills);

      const filtered =
        memberName && memberName !== "all"
          ? lastBills.filter((b) => (b.patient_name || "") === memberName)
          : lastBills;
      renderRows(tableBody, filtered);
    }

    // Events
    searchBtn.addEventListener("click", performSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") performSearch();
    });
    centerSelect.addEventListener("change", performSearch);
    memberSelect.addEventListener("change", () => {
      const tableBody = document.getElementById("historyTableBody");
      const memberName = memberSelect.value;
      const filtered =
        memberName && memberName !== "all"
          ? lastBills.filter((b) => (b.patient_name || "") === memberName)
          : lastBills;
      renderRows(tableBody, filtered);
    });
  }

  // Wait until the app is initialized
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    if (window.app && window.app.isInitialized) {
      attachPatientHistoryController();
    } else {
      document.addEventListener(
        "app:initialized",
        attachPatientHistoryController,
        { once: true }
      );
    }
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (window.app && window.app.isInitialized) {
        attachPatientHistoryController();
      } else {
        document.addEventListener(
          "app:initialized",
          attachPatientHistoryController,
          { once: true }
        );
      }
    });
  }
})();
