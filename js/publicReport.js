(function () {
  "use strict";

  const state = document.getElementById("state");
  const patientHeading = document.getElementById("patient-heading");
  const patientName = document.getElementById("patient-name");
  const billDate = document.getElementById("bill-date");
  const reportList = document.getElementById("report-list");
  const pdfRenderArea = document.getElementById("pdf-render-area");
  let bill;
  let reports = [];
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);

  function showMessage(message, type = "info") {
    state.className = `alert alert-${type}`;
    state.textContent = message;
    state.classList.remove("d-none");
  }

  function formatAge(bill) {
    return [
      bill.ageYears ? `${bill.ageYears} YEARS` : "",
      bill.ageMonths ? `${bill.ageMonths} MONTHS` : "",
      bill.ageDays ? `${bill.ageDays} DAYS` : "",
    ].filter(Boolean).join(" ");
  }

  function formatBillDate(value) {
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

  function renderReport(bill, report) {
    const date = bill.billDate
      ? new Date(bill.billDate).toISOString().slice(0, 10)
      : "";
    const centerLabel = bill.isOutMedical ? "COMPANY NAME" : "CENTER";
    const centerValue = bill.isOutMedical ? bill.companyName : bill.centerName;
    const results = report.results || [];
    const hasRemark = results.some((result) => result.remark);
    const hasUnit = results.some((result) => result.unit);
    return `
      <section class="report-page">
        <div class="letterhead letterhead-header"><img src="Imgs/suwajeewa-header.svg" alt="Suwajeewa Laboratories"></div>
        <div class="letterhead letterhead-footer"><img src="Imgs/suwajeewa-footer.png" alt=""></div>
        <div class="report-container content-area">
          <div class="top-space"></div>
          <div class="report-info">
            <div class="info-col">
              <div class="info-row"><div class="label">NAME</div><div>:</div><div>${escapeHtml(`${bill.patientTitle || ""} ${bill.patientName || ""}`.trim().toUpperCase())}</div></div>
              <div class="info-row"><div class="label">AGE</div><div>:</div><div>${escapeHtml(formatAge(bill))}</div></div>
              <div class="info-row"><div class="label">GENDER</div><div>:</div><div>${escapeHtml(bill.gender || "")}</div></div>
              <div class="info-row"><div class="label">REQUESTED BY</div><div>:</div><div>${escapeHtml(bill.requestedBy || "").toUpperCase()}</div></div>
              <div class="info-row"><div class="label">${centerLabel}</div><div>:</div><div>${escapeHtml(centerValue || "").toUpperCase()}</div></div>
            </div>
            <div class="info-col">
              <div class="info-row"><div class="label">SAMPLE RECEIVED ON</div><div>:</div><div>${escapeHtml(date)}</div></div>
              <div class="info-row"><div class="label">SAMPLE REPORTED ON</div><div>:</div><div>${escapeHtml(new Date().toLocaleTimeString())}</div></div>
              <div class="info-row"><div class="label">INV NO</div><div>:</div><div>${escapeHtml(bill.billNo || "").toUpperCase()}</div></div>
              <div class="info-row"><div class="label">SAMPLE TYPE</div><div>:</div><div>${escapeHtml(report.specimen || "").toUpperCase()}</div></div>
            </div>
          </div>
          <div class="investigation-line">
            <div class="label">INVESTIGATION</div><div>:</div>
            <div class="investigation-value">${escapeHtml(report.testName.toUpperCase())}</div>
          </div>
          <div style="margin-top:8px;border-top:1px solid #999"></div>
          <table class="results">
            <thead><tr>
              <th style="width:35%">INVESTIGATION</th>
              <th style="width:18%">RESULT</th>
              ${hasUnit ? '<th style="width:12%">UNIT</th>' : ""}
              <th style="width:20%">REFERENCE RANGE</th>
              ${hasRemark ? '<th style="width:15%">REMARK</th>' : ""}
            </tr></thead>
            <tbody>${results.map((result) => `<tr>
              <td>${escapeHtml(result.name.toUpperCase())}</td>
              <td>${escapeHtml(result.value)}</td>
              ${hasUnit ? `<td>${escapeHtml(result.unit)}</td>` : ""}
              <td>${escapeHtml(result.referenceRange)}</td>
              ${hasRemark ? `<td>${escapeHtml(result.remark)}</td>` : ""}
            </tr>`).join("")}</tbody>
          </table>
          ${report.footerImage ? `<div class="footer-image"><img src="${escapeHtml(report.footerImage)}" alt="" style="width:100%;height:auto"></div>` : ""}
          ${report.comments ? `<div class="remarks"><span class="label">COMMENT:</span><span style="white-space:pre-wrap;margin-left:8px">${escapeHtml(report.comments.toUpperCase())}</span></div>` : ""}
        </div>
        <div class="signature-section">
          <div class="signature-image"><img src="Imgs/signature.svg" alt="Authorized signature"></div>
          <div class="signature-line"></div>
          <div class="signature-label">Medical Laboratory Technologist</div>
        </div>
      </section>`;
  }

  async function loadReport() {
    const query = new URLSearchParams(window.location.search);
    const billId = query.get("bill");
    const token = query.get("token");
    if (!billId || !token) {
      showMessage("This report link is invalid.", "danger");
      return;
    }

    const publicConfig = window.SUPABASE_PUBLIC;
    if (!publicConfig?.url || !publicConfig?.anonKey) {
      showMessage("The report service is not configured. Please contact the laboratory.", "danger");
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
        showMessage(`Please complete the outstanding payment of Rs. ${Number(data.remainingAmount).toFixed(2)} to view and download this report.`, "warning");
        return;
      }
      if (response.status === 409) {
        showMessage("Your report is not ready yet. Please contact the laboratory.", "info");
        return;
      }
      if (!response.ok) {
        showMessage(data.error || "Unable to load this report. Please contact the laboratory.", "danger");
        return;
      }

      const fullPatientName = `${data.bill.patientTitle || ""} ${data.bill.patientName || ""}`
        .trim()
        .toUpperCase();
      bill = data.bill;
      reports = data.reports;
      patientName.textContent = fullPatientName || "PATIENT REPORTS";
      billDate.textContent = formatBillDate(bill.billDate);
      reportList.innerHTML = data.reports.map((report, index) => `
        <article class="test-download-item">
          <button class="btn btn-primary" type="button" data-report-index="${index}">
            Download PDF
          </button>
          <h2 class="test-name">${escapeHtml(report.testName)}</h2>
        </article>`).join("");
      state.classList.add("d-none");
      patientHeading.classList.remove("d-none");
    } catch (error) {
      console.error("Could not load the public report:", error);
      showMessage("Unable to connect to the report service. Please try again later.", "danger");
    }
  }

  reportList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-report-index]");
    if (!button) return;

    const reportIndex = Number(button.dataset.reportIndex);
    if (!Number.isInteger(reportIndex) || !reports?.[reportIndex]) return;

    button.disabled = true;
    button.textContent = "Preparing PDF…";
    try {
      const pdfReport = renderReport(bill, reports[reportIndex]);
      pdfRenderArea.innerHTML = pdfReport;
      const filename = `${reports[reportIndex].testName || "Report"}-${bill.billNo || "Report"}`
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/\s+/g, "-");
      await window.html2pdf()
        .set({
          margin: 0,
          filename: `${filename}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(pdfRenderArea.firstElementChild)
        .save();
    } catch (error) {
      console.error("Could not generate the report PDF:", error);
      showMessage("Could not create the PDF. Please try again.", "danger");
    } finally {
      pdfRenderArea.replaceChildren();
      button.disabled = false;
      button.textContent = "Download PDF";
    }
  });

  loadReport();
})();
