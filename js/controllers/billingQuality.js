/* billingQuality.js
 * Load AFTER billingController.js (before billingEnhancement.js).
 * Upgrades the printed bill (80mm thermal receipt) and fixes front-end bugs.
 */
(function () {
  "use strict";
  if (typeof BillingController === "undefined") return;
  const P = BillingController.prototype;

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const r2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
  const money = (n) => r2(n).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const DEFAULT_CENTER = {
    center_name: "Suwajeewa Laboratories",
    address: "No 62, Akuramboda Road Pallepola, Matale",
    phone: "070 6222 644",
    email: null,
  };

  const RECEIPT_CSS = `
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000;
      font-family: Arial, "Noto Sans Sinhala", sans-serif; font-size: 11px; line-height: 1.35;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt { width: 72mm; margin: 0 auto; padding: 3mm 0; page-break-after: always; break-after: page; }
    .receipt:last-child { page-break-after: auto; break-after: auto; }
    .center { text-align: center; }
    .logo { max-width: 22mm; max-height: 22mm; margin-bottom: 2px; }
    .lab-name { font-size: 16px; font-weight: 700; letter-spacing: .3px; }
    .lab-line { font-size: 10px; }
    .doc-title { margin: 6px 0 2px; padding: 2px 0; border: 1px solid #000; font-weight: 700;
      font-size: 12px; letter-spacing: 1.5px; text-align: center; }
    .sep { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
    .sep.solid { border-top: 1px solid #000; }
    .kv { display: flex; gap: 4px; margin: 1px 0; }
    .kv .k { width: 21mm; flex: none; font-weight: 700; }
    .kv .v { flex: 1; word-break: break-word; }
    table.items { width: 100%; border-collapse: collapse; }
    table.items th { text-align: left; font-size: 10px; border-bottom: 1px solid #000; padding: 2px 0; }
    table.items td { padding: 2px 0; vertical-align: top; }
    .q { width: 8mm; text-align: center; } .a { width: 20mm; text-align: right; white-space: nowrap; }
    th.q { text-align: center; } th.a { text-align: right; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .row.grand { font-size: 13px; font-weight: 700; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 4px 0; }
    .qr { text-align: center; margin-top: 6px; font-size: 9px; }
    .qr img { width: 26mm; height: 26mm; display: block; margin: 0 auto 2px; }
    .note { font-size: 9px; text-align: center; margin-top: 5px; }
    .thanks { font-size: 11px; font-weight: 700; text-align: center; margin-top: 4px; }
    .credit { font-size: 7px; text-align: center; margin-top: 3px; }
  `;

  P.generateBillHTML = function (bill, d, tests, centerInfo, reportQrCode = "") {
    const c = { ...DEFAULT_CENTER, ...(centerInfo || {}) };
    const lines = [c.address, [c.phone, c.email].filter(Boolean).join(" | ")].filter(Boolean);
    const dt = new Date(bill.bill_date || d.bill_date || Date.now());
    const fmt = (o) => dt.toLocaleString("en-GB", { timeZone: "Asia/Colombo", hour12: false, ...o });
    const dateStr = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });
    const timeStr = fmt({ hour: "2-digit", minute: "2-digit" });
    const total = d.total_amount != null ? r2(d.total_amount)
      : r2((tests || []).reduce((s, t) => s + (parseFloat(t.price) || 0) * (parseFloat(t.qty) || 1), 0));
    const dType = d.discount_type || "percent";
    const dVal = parseFloat(d.discount) || 0;
    const dAmt = r2(this.calculateDiscountAmount(total, dVal, dType));
    const final = d.final_amount != null ? r2(d.final_amount) : r2(total - dAmt);
    const paid = r2(d.paid_amount);
    const remaining = d.remaining_amount != null ? r2(d.remaining_amount) : r2(final - paid);
    const dLabel = dType === "fixed" ? "Discount" : `Discount (${dVal}%)`;
    const age = this.formatAge(d.patient_age_years, d.patient_age_months, d.patient_age_days);
    const kv = (k, v) => (v ? `<div class="kv"><span class="k">${k}</span><span class="v">: ${esc(v)}</span></div>` : "");
    const rows = (tests || []).map((t) => {
      const q = parseFloat(t.qty) || 1, p = parseFloat(t.price) || 0;
      return `<tr><td>${esc(t.short_name || t.test_name)}</td><td class="q">${q}</td><td class="a">${money(p * q)}</td></tr>`;
    }).join("");
    const logo = new URL("Imgs/suwajeewa_logo%20b%20nd%20w.png", document.baseURI).href;

    return `
      <div class="center">
        <img class="logo" src="${esc(logo)}" alt="">
        <div class="lab-name">${esc(c.center_name)}</div>
        ${lines.map((l) => `<div class="lab-line">${esc(l)}</div>`).join("")}
      </div>
      <div class="doc-title">PAYMENT RECEIPT</div>
      ${kv("Bill No", bill.bill_no)}
      ${kv("Date", `${dateStr}  ${timeStr}`)}
      ${kv("Patient", `${d.patient_title ? d.patient_title + " " : ""}${d.patient_name || ""}`)}
      ${kv("Age / Sex", [age, d.patient_gender].filter(Boolean).join(" / "))}
      ${kv("Tel", d.patient_phone || "Not Given")}
      ${kv("Ref By", (d.ref_by || "N/A") + (d.reference_rid ? ` (${d.reference_rid})` : ""))}
      ${kv("Collection Site", d.company_name)}
      <hr class="sep">
      <table class="items">
        <thead><tr><th>Test</th><th class="q">Qty</th><th class="a">Amount (Rs.)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr class="sep solid">
      <div class="row"><span>Sub Total</span><span>Rs. ${money(total)}</span></div>
      ${dAmt > 0 ? `<div class="row"><span>${esc(dLabel)}</span><span>- Rs. ${money(dAmt)}</span></div>` : ""}
      <div class="row grand"><span>NET AMOUNT</span><span>Rs. ${money(final)}</span></div>
      <div class="row"><span>Paid</span><span>Rs. ${money(paid)}</span></div>
      <div class="row"><b>Balance Due</b><b>Rs. ${money(Math.max(remaining, 0))}</b></div>
      ${reportQrCode ? `<div class="qr"><img src="${reportQrCode}" alt="QR"><div>Scan to view / download your report</div></div>` : ""}
      <hr class="sep">
      <div class="note">Please bring this receipt to collect your report.<br>Reports must be collected within 30 days.</div>
      <div class="thanks">Thank you for choosing ${esc(c.center_name)}!</div>
      <div class="credit">SOFTWARE BY LAKSHAN SACHINTHA</div>`;
  };

  P.generatePDF = function (pages, billNo) {
    const html = `<!DOCTYPE html><html lang="si"><head><meta charset="UTF-8">
      <title>Bill-${esc(billNo)}</title><style>${RECEIPT_CSS}</style></head>
      <body>${pages.map((p) => `<section class="receipt">${p}</section>`).join("")}</body></html>`;
    document.getElementById("bill-print-frame")?.remove();
    const f = document.createElement("iframe");
    f.id = "bill-print-frame";
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    f.onload = () => {
      const w = f.contentWindow;
      const imgs = [...w.document.images];
      imgs.forEach((i) => (i.onerror = () => (i.style.display = "none")));
      Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => {
        imgs.forEach((i) => { if (i.complete && i.naturalWidth === 0) i.style.display = "none"; });
        w.onafterprint = () => setTimeout(() => f.remove(), 500);
        w.focus();
        w.print();
      });
    };
    f.srcdoc = html;
    document.body.appendChild(f);
  };

  P.printBill = async function (bill, printContext = null) {
    try {
      const ctx = await this.resolvePrintContext(bill, printContext);
      let qr = "";
      try { qr = await this.createReportQrCode(ctx.bill); }
      catch (e) { console.warn("Report QR skipped:", e); window.app.showInfo?.("QR code unavailable; bill printed without it"); }
      const receipt = this.generateBillHTML(
        ctx.bill,
        ctx.billData,
        ctx.selectedTests,
        ctx.centerInfo,
        qr
      );
      const pages = [receipt, receipt];
      this.generatePDF(pages, ctx.bill.bill_no || bill.bill_no);
    } catch (error) {
      console.error("Error printing bill:", error);
      window.app.showError(error.message || "Failed to print bill");
    }
  };

  P.waitForApp = function () {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const t = setInterval(() => {
        if (window.app && window.app.isInitialized) { clearInterval(t); resolve(); }
        else if (Date.now() - start > 15000) { clearInterval(t); reject(new Error("App failed to initialize")); }
      }, 50);
    });
  };

  const origTotal = P.calculateTotalAmount;
  P.calculateTotalAmount = function () { return r2(origTotal.call(this)); };
  const origDisc = P.calculateDiscountAmount;
  P.calculateDiscountAmount = function (...a) { return r2(origDisc.apply(this, a)); };

  const origValidate = P.validateBillData;
  P.validateBillData = function (d) {
    if (!origValidate.call(this, d)) return false;
    const e = [];
    if (d.discount_type === "percent" && d.discount > 100) e.push("Discount cannot exceed 100%");
    if (d.discount_type === "fixed" && d.discount > d.total_amount) e.push("Discount cannot exceed the total");
    if (d.paid_amount < 0) e.push("Paid amount cannot be negative");
    if (d.paid_amount > d.final_amount + 0.005) e.push("Paid amount cannot exceed the final amount");
    if (e.length) { window.app.showError(e.join(", ")); return false; }
    return true;
  };

  P.displayRecentBills = function (bills) {
    const body = document.querySelector(".recent-bills-table-container table tbody");
    if (!body) return;
    if (!bills || !bills.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-info-circle"></i><div>No recent bills found</div></td></tr>`;
      return;
    }
    body.innerHTML = bills.map((b) => `
      <tr>
        <td><strong>${esc(b.bill_no || "N/A")}</strong></td>
        <td>${esc(b.patient_name || "N/A")}</td>
        <td>${b.bill_date ? esc(window.app.formatDate(b.bill_date)) : "N/A"}</td>
        <td><span class="badge bg-success">${esc(window.app.formatCurrency(b.final_amount || 0))}</span></td>
        <td><div class="btn-group" role="group">
          <button class="btn btn-sm btn-outline-primary" data-action="view" data-bill-no="${esc(b.bill_no)}" title="View Bill"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-outline-success" data-action="print" data-bill-id="${esc(b.id)}" title="Print Bill"><i class="fas fa-print"></i></button>
          <button class="btn btn-sm btn-outline-warning" data-action="edit" data-bill-id="${esc(b.id)}" title="Edit Bill"><i class="fas fa-edit"></i></button>
        </div></td>
        <td>${esc(b.cashier || "—")}</td>
      </tr>`).join("");
    const box = document.querySelector(".recent-bills-table-container");
    if (box) this.handleTableScroll(box);
  };

  P.displayPatientHistory = function (history) {
    const body = document.querySelector("#patient-history-table tbody");
    if (!body) return;
    const panel = document.getElementById("patient-history-results");
    if (panel) panel.hidden = true;
    if (!history || !history.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-info-circle"></i><div>No history found for this phone number</div></td></tr>`;
      return;
    }
    body.innerHTML = history.map((b) => {
      const items = (b.bill_items || []).filter((i) => i.tests && i.id);
      const names = items.length
        ? items.map((i) => `<button type="button" class="btn btn-link btn-sm p-0 me-2" data-bill-item-id="${esc(i.id)}" data-test-name="${esc(i.tests.test_name)}">${esc(i.tests.test_name)}</button>`).join("")
        : esc(this.getTestNames(b.bill_items || []));
      return `<tr>
        <td><strong>${esc(b.bill_no)}</strong></td><td>${esc(b.patient_name || "N/A")}</td>
        <td>${esc(window.app.formatDate(b.bill_date))}</td><td>${esc(b.patient_gender || "")}</td>
        <td>${names}</td>
        <td>${esc(window.app.formatCurrency(b.paid_amount || 0))}</td>
        <td>${esc(window.app.formatCurrency(b.remaining_amount || 0))}</td></tr>`;
    }).join("");
  };

  P.displayTestSuggestions = function (tests) {
    const input = document.getElementById("test-details-input");
    if (!input) return;
    let dd = document.getElementById("test-dropdown");
    if (!dd) {
      dd = document.createElement("div");
      dd.id = "test-dropdown";
      dd.className = "dropdown-menu show position-absolute w-100";
      dd.style.cssText = "z-index:1000;max-height:200px;overflow-y:auto;";
      input.parentElement.style.position = "relative";
      input.parentElement.appendChild(dd);
      dd.addEventListener("mousedown", (e) => e.preventDefault());
      dd.addEventListener("click", (e) => {
        const el = e.target.closest("[data-index]");
        const test = el && (this._lastTestSuggestions || [])[Number(el.dataset.index)];
        if (test) this.selectTest(encodeURIComponent(JSON.stringify(test)));
      });
    }
    if (!tests.length) {
      if (input.value.trim().length < 2) { dd.remove(); return; }
      dd.innerHTML = '<div class="dropdown-item disabled">No tests found</div>';
      return;
    }
    dd.innerHTML = tests.map((t, i) => `
      <div class="dropdown-item" role="option" data-index="${i}" style="cursor:pointer">
        <strong>${esc(t.test_name)}</strong> (${esc(t.short_name)}) - Rs. ${money(t.resolved_price ?? t.price)}
        <span class="small text-muted">[${t.has_center_price ? "Center" : "Global"}]</span>
      </div>`).join("");
  };

  P.displayPatientSuggestions = function (history, inputEl) {
    this.removePatientDropdown();
    if (!Array.isArray(history) || !history.length || !inputEl || !inputEl.parentElement) return;
    const unique = new Map();
    history.forEach((b) => { const k = (b.patient_name || "N/A").trim().toLowerCase(); if (!unique.has(k)) unique.set(k, b); });
    const parent = inputEl.parentElement;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    const dd = document.createElement("div");
    dd.id = "patient-phone-dropdown";
    dd.className = "dropdown-menu show position-absolute w-100";
    dd.style.cssText = "z-index:1000;max-height:220px;overflow-y:auto;";
    [...unique.values()].slice(0, 10).forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dropdown-item";
      const info = [b.patient_gender, this.formatAge(b.patient_age_years, b.patient_age_months, b.patient_age_days)].filter(Boolean).join(" • ");
      btn.innerHTML = `<strong>${esc((b.patient_title ? b.patient_title + " " : "") + (b.patient_name || "N/A"))}</strong><div class="small text-muted">${esc(info)}</div>`;
      btn.addEventListener("click", () => {
        const phone = document.getElementById("patient-phone");
        if (phone && b.patient_phone) phone.value = b.patient_phone;
        this.autoFillPatientDetails(b);
        this.removePatientDropdown();
        document.querySelector('select[name="patient_title"]')?.focus();
      });
      dd.appendChild(btn);
    });
    parent.appendChild(dd);
    inputEl.addEventListener("keydown", (e) => { if (e.key === "Escape") this.removePatientDropdown(); }, { once: true });
    inputEl.addEventListener("blur", () => setTimeout(() => {
      if (!document.getElementById("patient-phone-dropdown")?.contains(document.activeElement)) this.removePatientDropdown();
    }, 150), { once: true });
  };
})();
