// Reference Management Controller
class ReferenceController {
  constructor() {
    this.selectedReferenceId = null;
    this.centerList = []; // cached centers for dropdown
    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    this.nameInput = document.getElementById("ref-name");
    this.ridInput = document.getElementById("ref-rid");
    this.commissionInput = document.getElementById("ref-commission");
    this.phoneInput = document.getElementById("ref-phone");
    this.emailInput = document.getElementById("ref-email");
    this.addressInput = document.getElementById("ref-address");
    this.centerSelect = document.getElementById("ref-center");
    this.activeInput = document.getElementById("ref-active");
    this.createBtn = document.querySelector(".btn-primary");
    this.saveBtn = document.querySelector(".btn-success");
    this.deleteBtn = document.querySelector(".btn-danger");
    this.referenceTableBody = document.querySelector("table tbody");
    this.searchInput = document.querySelector(
      'input[placeholder="Search by name or ID..."]'
    );
    this.refreshBtn = document.querySelector(".btn-outline-primary.btn-sm");
  }

  bindEvents() {
    if (this.createBtn) {
      this.createBtn.addEventListener("click", () => this.clearForm());
    }

    if (this.saveBtn) {
      this.saveBtn.addEventListener("click", () => this.handleSave());
    }

    if (this.deleteBtn) {
      this.deleteBtn.addEventListener("click", () => this.handleDelete());
    }

    if (this.searchInput) {
      this.searchInput.addEventListener(
        "input",
        window.app.debounce(() => {
          this.renderReferences(this.searchInput.value.trim());
        }, 400)
      );
    }

    if (this.refreshBtn) {
      this.refreshBtn.addEventListener("click", () => this.renderReferences());
    }
  }

  // Load centers for the center dropdown
  async loadCenterOptions(selectedCenterId = null) {
    if (!this.centerSelect) return;
    try {
      if (!this.centerList || this.centerList.length === 0) {
        this.centerList =
          (await window.app.services.center.getActiveCenters()) || [];
      }
      this.centerSelect.innerHTML =
        '<option value="">-- All Centers (Global) --</option>';
      this.centerList.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `[${c.cid}] ${c.center_name}`;
        if (selectedCenterId && c.id === selectedCenterId) {
          opt.selected = true;
        }
        this.centerSelect.appendChild(opt);
      });
    } catch (e) {
      console.warn("Could not load centers:", e);
      if (this.centerSelect) {
        this.centerSelect.innerHTML =
          '<option value="">-- (Error loading centers) --</option>';
      }
    }
  }

  // Helper: find cached center by id for table display
  getCenterLabel(centerId) {
    if (!centerId) return '<span class="badge bg-light text-dark">Global</span>';
    const found = this.centerList.find((c) => c.id === centerId);
    if (found) {
      return `<span class="badge bg-info">${found.short_name || found.cid}</span> <small class="text-muted">${found.center_name}</small>`;
    }
    return '<span class="badge bg-secondary">Unknown Center</span>';
  }

  clearForm() {
    this.selectedReferenceId = null;
    if (this.nameInput) this.nameInput.value = "";
    if (this.ridInput) this.ridInput.value = "Auto-generated";
    if (this.commissionInput) this.commissionInput.value = "";
    if (this.phoneInput) this.phoneInput.value = "";
    if (this.emailInput) this.emailInput.value = "";
    if (this.addressInput) this.addressInput.value = "";
    if (this.activeInput) this.activeInput.checked = true;
    this.loadCenterOptions(null);
    if (this.deleteBtn) this.deleteBtn.disabled = true;
    if (this.saveBtn)
      this.saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
  }

  fillForm(reference) {
    this.selectedReferenceId = reference.id;
    if (this.nameInput) this.nameInput.value = reference.name;
    if (this.ridInput) this.ridInput.value = reference.rid;
    if (this.commissionInput)
      this.commissionInput.value = reference.commission ?? "";
    if (this.phoneInput) this.phoneInput.value = reference.phone || "";
    if (this.emailInput) this.emailInput.value = reference.email || "";
    if (this.addressInput) this.addressInput.value = reference.address || "";
    if (this.activeInput)
      this.activeInput.checked = reference.is_active !== false;
    this.loadCenterOptions(reference.center_id || null);
    if (this.deleteBtn) this.deleteBtn.disabled = false;
    if (this.saveBtn)
      this.saveBtn.innerHTML = '<i class="bi bi-save"></i> Update';
  }

  async renderReferences(searchTerm = "") {
    if (!this.referenceTableBody) return;

    // Ensure centers are loaded before rendering (for labels)
    await this.loadCenterOptions();

    this.referenceTableBody.innerHTML =
      '<tr><td colspan="7">Loading...</td></tr>';
    let references = [];

    try {
      if (searchTerm) {
        references = await window.app.services.reference.searchReferences(
          searchTerm
        );
      } else {
        references = await window.app.services.reference.getAllReferences();
      }
    } catch (e) {
      window.app.showError("Failed to load references");
      this.referenceTableBody.innerHTML =
        '<tr><td colspan="7">Error loading data</td></tr>';
      return;
    }

    if (!references || references.length === 0) {
      this.referenceTableBody.innerHTML =
        '<tr><td colspan="7">No references found</td></tr>';
      return;
    }

    this.referenceTableBody.innerHTML = "";
    references.forEach((reference) => {
      const statusBadge =
        reference.is_active !== false
          ? '<span class="badge bg-success">Active</span>'
          : '<span class="badge bg-secondary">Inactive</span>';
      const contactHtml = [];
      if (reference.phone)
        contactHtml.push(
          `<small><i class="bi bi-telephone"></i> ${reference.phone}</small>`
        );
      if (reference.email)
        contactHtml.push(
          `<small class="text-muted"><i class="bi bi-envelope"></i> ${reference.email}</small>`
        );
      const contactLine = contactHtml.length
        ? contactHtml.join("<br>") +
          `<br><small class="text-muted">Created: ${window.app.formatDate(
            reference.created_at
          )}</small>`
        : `<small class="text-muted">Created: ${window.app.formatDate(
            reference.created_at
          )}</small>`;
      const addressLine = reference.address
        ? `<br><small class="text-muted d-block text-truncate" style="max-width:240px">${reference.address}</small>`
        : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td><span class="badge bg-info">${reference.rid}</span></td>
                <td>${this.getCenterLabel(reference.center_id)}</td>
                <td>
                    <span class="fw-bold">${reference.name}</span>${addressLine}
                </td>
                <td>${contactLine}</td>
                <td><span class="badge bg-success">${
                  reference.commission?.toFixed(2) ?? "0.00"
                }%</span></td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-outline-primary btn-sm edit-btn"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger btn-sm delete-btn"><i class="bi bi-trash"></i></button>
                </td>
            `;

      tr.querySelector(".edit-btn").addEventListener("click", () =>
        this.fillForm(reference)
      );

      tr.querySelector(".delete-btn").addEventListener("click", async () => {
        if (confirm("Are you sure you want to delete this reference?")) {
          try {
            await window.app.services.reference.deleteReference(
              reference.id
            );
            window.app.showSuccess("Reference deleted");
            this.clearForm();
            this.renderReferences();
          } catch (e) {
            window.app.showError(e.message || "Delete failed");
          }
        }
      });

      this.referenceTableBody.appendChild(tr);
    });
  }

  async handleSave() {
    const name = this.nameInput?.value.trim();
    const commission = this.commissionInput?.value.trim();
    const centerId = this.centerSelect?.value || null;
    const phone = this.phoneInput?.value.trim() || null;
    const email = this.emailInput?.value.trim() || null;
    const address = this.addressInput?.value.trim() || null;
    const isActive = this.activeInput?.checked ?? true;

    if (!name) {
      window.app.showWarning("Name is required");
      return;
    }

    try {
      if (this.selectedReferenceId) {
        await window.app.services.reference.updateReference(
          this.selectedReferenceId,
          {
            name,
            commission: parseFloat(commission) || 0,
            center_id: centerId,
            phone,
            email,
            address,
            is_active: isActive,
          }
        );
        window.app.showSuccess("Reference updated");
      } else {
        await window.app.services.reference.createReference({
          name,
          commission: parseFloat(commission) || 0,
          center_id: centerId,
          phone,
          email,
          address,
          is_active: isActive,
        });
        window.app.showSuccess("Reference created");
      }
      this.clearForm();
      this.renderReferences();
    } catch (e) {
      window.app.showError(e.message || "Save failed");
    }
  }

  async handleDelete() {
    if (!this.selectedReferenceId) return;

    if (confirm("Are you sure you want to delete this reference?")) {
      try {
        await window.app.services.reference.deleteReference(
          this.selectedReferenceId
        );
        window.app.showSuccess("Reference deleted");
        this.clearForm();
        this.renderReferences();
      } catch (e) {
        window.app.showError(e.message || "Delete failed");
      }
    }
  }

  async initialize() {
    await this.loadCenterOptions();
    await this.renderReferences();
    this.clearForm();
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  function waitForAppAndInit() {
    if (window.app && window.app.debounce && window.app.showWarning) {
      window.referenceController = new ReferenceController();
      window.referenceController.initialize();
    } else {
      setTimeout(waitForAppAndInit, 50);
    }
  }
  waitForAppAndInit();
});
