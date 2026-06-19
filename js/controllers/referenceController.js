// Reference Management Controller
class ReferenceController {
  constructor() {
    this.selectedReferenceId = null;
    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    this.nameInput = document.querySelector(
      'input[placeholder="Enter doctor/reference name"]'
    );
    this.ridInput = document.querySelector("input[disabled]");
    this.commissionInput = document.querySelector(
      'input[placeholder="Enter commission percentage"]'
    );
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

  clearForm() {
    this.selectedReferenceId = null;
    if (this.nameInput) this.nameInput.value = "";
    if (this.ridInput) this.ridInput.value = "Auto-generated";
    if (this.commissionInput) this.commissionInput.value = "";
    if (this.deleteBtn) this.deleteBtn.disabled = true;
    if (this.saveBtn) this.saveBtn.textContent = "Save";
  }

  fillForm(reference) {
    this.selectedReferenceId = reference.id;
    if (this.nameInput) this.nameInput.value = reference.name;
    if (this.ridInput) this.ridInput.value = reference.rid;
    if (this.commissionInput) this.commissionInput.value = reference.commission;
    if (this.deleteBtn) this.deleteBtn.disabled = false;
    if (this.saveBtn) this.saveBtn.textContent = "Update";
  }

  async renderReferences(searchTerm = "") {
    if (!this.referenceTableBody) return;

    this.referenceTableBody.innerHTML =
      '<tr><td colspan="4">Loading...</td></tr>';
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
        '<tr><td colspan="4">Error loading data</td></tr>';
      return;
    }

    if (!references || references.length === 0) {
      this.referenceTableBody.innerHTML =
        '<tr><td colspan="4">No references found</td></tr>';
      return;
    }

    this.referenceTableBody.innerHTML = "";
    references.forEach((reference) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td><span class="badge bg-info">${reference.rid}</span></td>
                <td>
                    <span class="fw-bold">${reference.name}</span><br>
                    <small class="text-muted">Created: ${window.app.formatDate(
                      reference.created_at
                    )}</small>
                </td>
                <td><span class="badge bg-success">${
                  reference.commission?.toFixed(2) ?? "0.00"
                }%</span></td>
                <td>
                    <button class="btn btn-outline-primary btn-sm edit-btn"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger btn-sm delete-btn"><i class="bi bi-trash"></i></button>
                </td>
            `;

      // Edit button
      tr.querySelector(".edit-btn").addEventListener("click", () =>
        this.fillForm(reference)
      );

      // Delete button
      tr.querySelector(".delete-btn").addEventListener("click", async () => {
        if (confirm("Are you sure you want to delete this reference?")) {
          try {
            await window.app.services.reference.deleteReference(reference.id);
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

    if (!name) {
      window.app.showWarning("Name is required");
      return;
    }

    try {
      if (this.selectedReferenceId) {
        // Update
        await window.app.services.reference.updateReference(
          this.selectedReferenceId,
          {
            name,
            commission: parseFloat(commission),
          }
        );
        window.app.showSuccess("Reference updated");
      } else {
        // Create
        await window.app.services.reference.createReference({
          name,
          commission: parseFloat(commission),
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
