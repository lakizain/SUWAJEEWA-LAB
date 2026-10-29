class PublicReportController {
  constructor() {
    this.state = document.getElementById("state");
    this.patientHeading = document.getElementById("patient-heading");
    this.patientName = document.getElementById("patient-name");
    this.billDate = document.getElementById("bill-date");
    this.reportList = document.getElementById("report-list");
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

  async loadImageData(source) {
    const image = new Image();
    const imageUrl = new URL(source, document.baseURI);
    if (imageUrl.origin !== window.location.origin) {
      image.crossOrigin = "anonymous";
    }

    image.src = imageUrl.href;
    try {
      await image.decode();
    } catch (error) {
      throw new Error(`Could not load report image: ${imageUrl.href}`, { cause: error });
    }

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare report image for PDF.");
    context.drawImage(image, 0, 0);

    return {
      data: canvas.toDataURL("image/png"),
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  }

  drawField(pdf, label, value, x, y, labelWidth, valueWidth) {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, x, y, { maxWidth: labelWidth });
    pdf.setFont("helvetica", "normal");
    pdf.text(":", x + labelWidth, y);
    if (value) {
      pdf.text(String(value), x + labelWidth + 2, y, {
        maxWidth: valueWidth,
      });
    }
  }

  drawReportPage(pdf, bill, report, results, assets, pageIndex, pageCount) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const headerHeight = pageWidth * assets.header.height / assets.header.width;
    const footerHeight = pageWidth * assets.footer.height / assets.footer.width;
    const footerTop = pageHeight - footerHeight;
    const x = 10.5;
    const rightX = 121.5;
    const rowGap = 6.3;
    const firstInfoY = 61;
    const leftFields = [
      ["NAME", `${bill.patientTitle || ""} ${bill.patientName || ""}`.trim().toUpperCase()],
      ["AGE", this.formatAge(bill)],
      ["GENDER", (bill.gender || "").toUpperCase()],
      ["REQUESTED BY", (bill.requestedBy || "").toUpperCase()],
      [
        bill.isOutMedical ? "COMPANY NAME" : "CENTER",
        String((bill.isOutMedical ? bill.companyName : bill.centerName) || "").toUpperCase(),
      ],
    ];
    const reportDate = bill.billDate
      ? String(bill.billDate).slice(0, 10)
      : "";
    const rightFields = [
      ["SAMPLE RECEIVED ON", reportDate],
      ["SAMPLE REPORTED ON", new Date().toLocaleTimeString()],
      ["INV NO", (bill.billNo || "").toUpperCase()],
      ["SAMPLE TYPE", (report.specimen || "").toUpperCase()],
    ];

    pdf.addImage(assets.header.data, "PNG", 0, 0, pageWidth, headerHeight);
    pdf.addImage(assets.footer.data, "PNG", 0, footerTop, pageWidth, footerHeight);

    pdf.setFontSize(9.5);
    leftFields.forEach(([label, value], index) => {
      this.drawField(pdf, label, value, x, firstInfoY + index * rowGap, 38, 58);
    });
    rightFields.forEach(([label, value], index) => {
      this.drawField(pdf, label, value, rightX, firstInfoY + index * rowGap, 49, 28);
    });

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("INVESTIGATION", x, 96);
    pdf.setFont("helvetica", "normal");
    pdf.text(":", 49, 96);
    pdf.setFont("helvetica", "bold");
    pdf.text((report.testName || "REPORT").toUpperCase(), 52, 96, {
      maxWidth: 145,
    });

    const hasRemark = results.some((result) => result.remark);
    const tableWidth = pageWidth - 2 * x;
    const columns = hasRemark
      ? [tableWidth * 0.44, tableWidth * 0.24, tableWidth * 0.16, tableWidth * 0.16]
      : [tableWidth * 0.52, tableWidth * 0.28, tableWidth * 0.2];
    const tableY = 103;
    const headerY = 109;
    const firstResultY = 116;
    const hasReportFooter = pageIndex === pageCount - 1 && assets.reportFooter;
    const reservedFooterSpace = hasReportFooter ? 28 : 0;
    const resultsBottom = Math.min(
      footerTop - 8 - reservedFooterSpace,
      235 - reservedFooterSpace
    );
    const rowGapMm = results.length
      ? Math.min(6.2, (resultsBottom - firstResultY) / results.length)
      : 6.2;
    const rowFontSize = rowGapMm < 4.5 ? 7 : rowGapMm < 5.3 ? 8 : 9.5;

    pdf.setDrawColor(120, 120, 120);
    pdf.setLineWidth(0.25);
    pdf.line(x, tableY, pageWidth - x, tableY);
    pdf.setFontSize(9.5);
    pdf.setFont("helvetica", "bold");
    const headers = hasRemark
      ? ["INVESTIGATION", "RESULT", "UNIT", "REMARK"]
      : ["INVESTIGATION", "RESULT", "UNIT"];
    let columnX = x;
    headers.forEach((header, index) => {
      pdf.text(header, columnX + 1.5, headerY, {
        maxWidth: columns[index] - 3,
      });
      columnX += columns[index];
    });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(rowFontSize);
    results.forEach((result, index) => {
      const y = firstResultY + index * rowGapMm;
      const name = (result.name || "").toUpperCase();
      const value = String(result.value || "");
      pdf.text(name, x + 1.5, y, { maxWidth: columns[0] - 3 });
      if (value) {
        pdf.text(":", x + columns[0] - 3, y);
        pdf.text(value, x + columns[0], y, {
          maxWidth: columns[1] - 5,
        });
      }
      pdf.text(String(result.unit || ""), x + columns[0] + columns[1] + 1.5, y, {
        maxWidth: columns[2] - 3,
      });
      if (hasRemark) {
        pdf.text(
          String(result.remark || ""),
          x + columns[0] + columns[1] + columns[2] + 1.5,
          y,
          { maxWidth: columns[3] - 3 }
        );
      }
    });

    let extraContentY = firstResultY + results.length * rowGapMm + 5;
    if (hasReportFooter && extraContentY < footerTop - 10) {
      const maxHeight = Math.min(22, footerTop - 10 - extraContentY);
      const imageWidth = Math.min(
        pageWidth - 2 * x,
        maxHeight * assets.reportFooter.width / assets.reportFooter.height
      );
      const imageHeight = imageWidth * assets.reportFooter.height / assets.reportFooter.width;
      pdf.addImage(
        assets.reportFooter.data,
        "PNG",
        x,
        extraContentY,
        imageWidth,
        imageHeight
      );
      extraContentY += imageHeight + 4;
    }

    if (pageIndex === pageCount - 1) {
      const signatureX = pageWidth - 18 - 67;
      const signatureY = pageHeight - 49;
      const signatureHeight = 11;
      const signatureWidth = signatureHeight * assets.signature.width / assets.signature.height;
      pdf.addImage(
        assets.signature.data,
        "PNG",
        signatureX + (67 - signatureWidth) / 2,
        signatureY,
        signatureWidth,
        signatureHeight
      );
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineDashPattern([1, 0.8], 0);
      pdf.line(signatureX, signatureY + 12, signatureX + 67, signatureY + 12);
      pdf.setLineDashPattern([], 0);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("Medical Laboratory Technologist", signatureX + 33.5, signatureY + 16, {
        align: "center",
      });

      if (report.comments) {
        if (extraContentY < signatureY - 5) {
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          pdf.text("COMMENT:", x, extraContentY);
          pdf.setFont("helvetica", "normal");
          pdf.text(report.comments.toUpperCase(), x + 24, extraContentY, {
            maxWidth: pageWidth - x * 2 - 24,
          });
        }
      }
    }
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

  async handleReportDownload(event) {
    const button = event.target.closest("[data-report-index]");
    if (!button) return;

    const reportIndex = Number(button.dataset.reportIndex);
    if (!Number.isInteger(reportIndex) || !this.reports[reportIndex]) return;

    const JsPDF = window.jspdf?.jsPDF;
    if (typeof JsPDF !== "function") {
      this.showMessage("PDF generation is unavailable. Please reload and try again.", "danger");
      return;
    }

    button.disabled = true;
    button.textContent = "Preparing PDF…";
    try {
      const report = this.reports[reportIndex];
      const assets = {
        header: await this.loadImageData("Imgs/suwajeewa-header.svg"),
        footer: await this.loadImageData("Imgs/suwajeewa-footer.png"),
        signature: await this.loadImageData("Imgs/signature.svg"),
      };
      if (report.footerImage) {
        assets.reportFooter = await this.loadImageData(report.footerImage);
      }

      const pdf = new JsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
      });
      const results = report.results || [];
      const maxRowsPerPage = report.footerImage ? 22 : 30;
      const pageCount = Math.max(1, Math.ceil(results.length / maxRowsPerPage));
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        if (pageIndex > 0) pdf.addPage("a4", "portrait");
        const start = pageIndex * maxRowsPerPage;
        const pageResults = results.slice(start, start + maxRowsPerPage);
        this.drawReportPage(pdf, this.bill, report, pageResults, assets, pageIndex, pageCount);
      }

      const filename = `${report.testName || "Report"}-${this.bill.billNo || "Report"}`
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/\s+/g, "-");
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error("Could not generate the report PDF:", error);
      this.showMessage("Could not create the PDF. Please try again.", "danger");
    } finally {
      button.disabled = false;
      button.textContent = "Download PDF";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.publicReportController = new PublicReportController();
});
