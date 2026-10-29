class PublicReportController {
  constructor() {
    this.state = document.getElementById("state");
    this.patientHeading = document.getElementById("patient-heading");
    this.patientName = document.getElementById("patient-name");
    this.billDate = document.getElementById("bill-date");
    this.reportList = document.getElementById("report-list");
    this.pdfRenderArea = document.getElementById("pdf-render-area");
    this.bill = null;
    this.reports = [];

    this.reportList.addEventListener("click", (event) => {
      this.handleReportDownload(event);
    });
    this.loadReport();
  }

  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  showMessage(message, type = "info") {
    this.state.className = `alert alert-${type}`;
    this.state.textContent = message;
    this.state.classList.remove("d-none");
  }

  formatAge(bill) {
    return [
      bill.ageYears ? `${bill.ageYears} YEARS` : "",
      bill.ageMonths ? `${bill.ageMonths} MONTHS` : "",
      bill.ageDays ? `${bill.ageDays} DAYS` : "",
    ].filter(Boolean).join(" ");
  }

  formatBillDate(value) {
    if (!value) return "DATE UNAVAILABLE";

    const dateValue = String(value);
    const date = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
        ? `${dateValue}T00:00:00`
        : dateValue
    );
    if (Number.isNaN(date.getTime())) return "DATE UNAVAILABLE";

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  renderReport(bill, report) {
    const date = bill.billDate
      ? new Date(bill.billDate).toISOString().slice(0, 10)
      : "";
    const centerLabel = bill.isOutMedical ? "COMPANY NAME" : "CENTER";
    const centerValue = bill.isOutMedical ? bill.companyName : bill.centerName;
    const results = report.results || [];
    const hasRemark = results.some((result) => result.remark);
    return `
      <section class="report-page pdf-report${results.length > 24 ? " compact-results" : ""}">
        <div class="letterhead letterhead-header"><img src="Imgs/suwajeewa-header.svg" alt="Suwajeewa Laboratories"></div>
        <div class="letterhead letterhead-footer"><img src="Imgs/suwajeewa-footer.png" alt=""></div>
        <div class="report-container content-area">
          <div class="top-space"></div>
          <div class="report-info">
            <div class="info-col">
              <div class="info-row"><div class="label">NAME</div><div>:</div><div>${this.escapeHtml(`${bill.patientTitle || ""} ${bill.patientName || ""}`.trim().toUpperCase())}</div></div>
              <div class="info-row"><div class="label">AGE</div><div>:</div><div>${this.escapeHtml(this.formatAge(bill))}</div></div>
              <div class="info-row"><div class="label">GENDER</div><div>:</div><div>${this.escapeHtml(bill.gender || "")}</div></div>
              <div class="info-row"><div class="label">REQUESTED BY</div><div>:</div><div>${this.escapeHtml(bill.requestedBy || "").toUpperCase()}</div></div>
              <div class="info-row"><div class="label">${centerLabel}</div><div>:</div><div>${this.escapeHtml(centerValue || "").toUpperCase()}</div></div>
            </div>
            <div class="info-col">
              <div class="info-row"><div class="label">SAMPLE RECEIVED ON</div><div>:</div><div>${this.escapeHtml(date)}</div></div>
              <div class="info-row"><div class="label">SAMPLE REPORTED ON</div><div>:</div><div>${this.escapeHtml(new Date().toLocaleTimeString())}</div></div>
              <div class="info-row"><div class="label">INV NO</div><div>:</div><div>${this.escapeHtml(bill.billNo || "").toUpperCase()}</div></div>
              <div class="info-row"><div class="label">SAMPLE TYPE</div><div>:</div><div>${this.escapeHtml(report.specimen || "").toUpperCase()}</div></div>
            </div>
          </div>
          <div class="investigation-line">
            <div class="label">INVESTIGATION</div><div>:</div>
            <div class="investigation-value">${this.escapeHtml((report.testName || "REPORT").toUpperCase())}</div>
          </div>
          <div class="report-divider"></div>
          <table class="results-table">
            <thead><tr>
              <th style="width:${hasRemark ? "44%" : "52%"}">INVESTIGATION</th>
              <th style="width:${hasRemark ? "24%" : "28%"}">RESULT</th>
              <th style="width:${hasRemark ? "16%" : "20%"}">UNIT</th>
              ${hasRemark ? '<th style="width:16%">REMARK</th>' : ""}
            </tr></thead>
            <tbody>${results.map((result) => `<tr${result.value ? "" : ' class="hide-value-colon"'}>
              <td>${this.escapeHtml((result.name || "").toUpperCase())}</td>
              <td>${this.escapeHtml(result.value)}</td>
              <td>${this.escapeHtml(result.unit)}</td>
              ${hasRemark ? `<td>${this.escapeHtml(result.remark)}</td>` : ""}
            </tr>`).join("")}</tbody>
          </table>
          ${report.footerImage ? `<div class="footer-image"><img src="${this.escapeHtml(report.footerImage)}" alt=""></div>` : ""}
          ${report.comments ? `<div class="remarks"><span class="label">COMMENT:</span><span>${this.escapeHtml(report.comments.toUpperCase())}</span></div>` : ""}
        </div>
        <div class="signature-section">
          <div class="signature-image"><img src="Imgs/signature.svg" alt="Authorized signature"></div>
          <div class="signature-line"></div>
          <div class="signature-label">Medical Laboratory Technologist</div>
        </div>
      </section>`;
  }

  async loadReport() {
    const query = new URLSearchParams(window.location.search);
    const billId = query.get("bill");
    const token = query.get("token");
    if (!billId || !token) {
      this.showMessage("This report link is invalid.", "danger");
      return;
    }

    const publicConfig = window.SUPABASE_PUBLIC;
    if (!publicConfig?.url || !publicConfig?.anonKey) {
      this.showMessage("The report service is not configured. Please contact the laboratory.", "danger");
      return;
    }

    try {
      const response = await fetch(`${publicConfig.url}/functions/v1/public-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publicConfig.anonKey,
        },
        body: JSON.stringify({ billId, token }),
      });
      const data = await response.json();

      if (response.status === 402) {
        this.showMessage(`Please complete the outstanding payment of Rs. ${Number(data.remainingAmount).toFixed(2)} to view and download this report.`, "warning");
        return;
      }
      if (response.status === 409) {
        this.showMessage("Your report is not ready yet. Please contact the laboratory.", "info");
        return;
      }
      if (!response.ok) {
        this.showMessage(data.error || "Unable to load this report. Please contact the laboratory.", "danger");
        return;
      }
      if (!data.bill || !Array.isArray(data.reports)) {
        throw new Error("The report service returned invalid report data.");
      }

      this.bill = data.bill;
      this.reports = data.reports;
      this.patientName.textContent = `${data.bill.patientTitle || ""} ${data.bill.patientName || ""}`
        .trim()
        .toUpperCase() || "PATIENT REPORTS";
      this.billDate.textContent = this.formatBillDate(data.bill.billDate);
      this.reportList.innerHTML = data.reports.map((report, index) => `
        <article class="test-download-item">
          <h2 class="test-name">${this.escapeHtml(report.testName)}</h2>
          <button class="btn btn-primary" type="button" data-report-index="${index}">
            Download PDF
          </button>
        </article>`).join("");
      this.state.classList.add("d-none");
      this.patientHeading.classList.remove("d-none");
    } catch (error) {
      console.error("Could not load the public report:", error);
      this.showMessage("Unable to load the report. Please try again later.", "danger");
    }
  }

  async waitForReportImages() {
    const images = Array.from(this.pdfRenderArea.querySelectorAll("img"));
    await Promise.all(images.map((image) => {
      if (image.complete) {
        return image.naturalWidth > 0
          ? Promise.resolve()
          : Promise.reject(new Error(`Could not load report image: ${image.src}`));
      }
      return new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", () => {
          reject(new Error(`Could not load report image: ${image.src}`));
        }, { once: true });
      });
    }));
  }

  async handleReportDownload(event) {
    const button = event.target.closest("[data-report-index]");
    if (!button) return;

    const reportIndex = Number(button.dataset.reportIndex);
    if (!Number.isInteger(reportIndex) || !this.reports[reportIndex]) return;

    if (typeof window.html2pdf !== "function") {
      this.showMessage("PDF generation is unavailable. Please reload and try again.", "danger");
      return;
    }

    button.disabled = true;
    button.textContent = "Preparing PDF…";
    try {
      this.pdfRenderArea.innerHTML = this.renderReport(
        this.bill,
        this.reports[reportIndex]
      );
      await this.waitForReportImages();

      const report = this.reports[reportIndex];
      const filename = `${report.testName || "Report"}-${this.bill.billNo || "Report"}`
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/\s+/g, "-");
      const pdfPage = this.pdfRenderArea.firstElementChild;
      const pageBounds = pdfPage.getBoundingClientRect();
      await window.html2pdf()
        .set({
          margin: 0,
          filename: `${filename}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: Math.ceil(pageBounds.width),
            windowHeight: Math.ceil(pageBounds.height),
            onclone: (clonedDocument) => {
              const clonedRenderArea = clonedDocument.getElementById("pdf-render-area");
              if (!clonedRenderArea) {
                throw new Error("The PDF render area could not be prepared.");
              }
              clonedRenderArea.style.visibility = "visible";
              clonedRenderArea.style.zIndex = "1";
            },
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css"] },
        })
        .from(pdfPage)
        .save();
    } catch (error) {
      console.error("Could not generate the report PDF:", error);
      this.showMessage("Could not create the PDF. Please try again.", "danger");
    } finally {
      this.pdfRenderArea.replaceChildren();
      button.disabled = false;
      button.textContent = "Download PDF";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.publicReportController = new PublicReportController();
});
