// Reports Management Controller
class ReportsController {
    constructor() {
        this.currentTab = 'daily';
        this.isInitialized = false;
        this.initServices();
    }

    async initServices() {
        try {
            // Wait for services to be available
            await this.waitForServices();
            this.reportsService = new ReportsService();
            this.billingService = new BillingService();
            this.centerService = new CenterService();
            this.referenceService = new ReferenceService();
            this.init();
        } catch (error) {
            console.error('Failed to initialize services:', error);
            this.showGlobalError('Failed to initialize services. Please refresh the page.');
        }
    }

    async waitForServices() {
        const maxWait = 5000; // 5 seconds
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (window.ReportsService && window.BillingService && 
                window.CenterService && window.ReferenceService) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Services not available after timeout');
    }

    init() {
        if (this.isInitialized) return;
        
        try {
            this.setupEventListeners();
            this.setupDateFilters();
            this.loadCenters();
            this.loadReferences();
            this.loadDailySalesData();
            this.isInitialized = true;
        } catch (error) {
            console.error('Error during initialization:', error);
            this.showGlobalError('Failed to initialize reports. Please refresh the page.');
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('data-bs-target');
                this.currentTab = target.replace('#', '');
                this.loadReportData();
            });
        });

        // Action buttons
        document.getElementById('refresh-report-btn')?.addEventListener('click', () => {
            this.refreshCurrentReport();
        });

        document.getElementById('print-report-btn')?.addEventListener('click', () => {
            this.printReport();
        });

        document.getElementById('export-csv-btn')?.addEventListener('click', () => {
            this.exportToCSV();
        });

        // Filter buttons
        document.getElementById('daily-filter-btn')?.addEventListener('click', () => {
            this.applyDailyFilter();
        });

        document.getElementById('monthly-filter-btn')?.addEventListener('click', () => {
            this.applyMonthlyFilter();
        });

        document.getElementById('center-filter-btn')?.addEventListener('click', () => {
            this.applyCenterFilter();
        });

        document.getElementById('commission-filter-btn')?.addEventListener('click', () => {
            this.applyCommissionFilter();
        });
    }

    setupDateFilters() {
        // Set default date range (today)
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Daily filters
        const dailyFromDateInput = document.getElementById('daily-from-date');
        const dailyToDateInput = document.getElementById('daily-to-date');
        if (dailyFromDateInput) dailyFromDateInput.value = todayStr;
        if (dailyToDateInput) dailyToDateInput.value = todayStr;

        // Center filters
        const centerFromDateInput = document.getElementById('center-from-date');
        const centerToDateInput = document.getElementById('center-to-date');
        if (centerFromDateInput) centerFromDateInput.value = todayStr;
        if (centerToDateInput) centerToDateInput.value = todayStr;

        // Commission filters
        const commissionFromDateInput = document.getElementById('commission-from-date');
        const commissionToDateInput = document.getElementById('commission-to-date');
        if (commissionFromDateInput) commissionFromDateInput.value = todayStr;
        if (commissionToDateInput) commissionToDateInput.value = todayStr;

        // Set default year to 2025 for monthly filter
        const monthlyYearFilter = document.getElementById('monthly-year-filter');
        if (monthlyYearFilter) {
            monthlyYearFilter.value = '2025';
        }
    }

    async loadCenters() {
        try {
            if (!this.centerService) {
                console.warn('CenterService not available');
                return;
            }
            const centers = await this.centerService.getAllCenters();

            // Load centers for all filter dropdowns
            const centerFilters = [
                'daily-center-filter',
                'monthly-center-filter',
                'center-center-filter'
            ];

            centerFilters.forEach(filterId => {
                const centerFilter = document.getElementById(filterId);
                if (centerFilter) {
                    centerFilter.innerHTML = '<option value="all">All Centers</option>';
                    centers.forEach(center => {
                        const option = document.createElement('option');
                        option.value = center.id;
                        option.textContent = center.center_name;
                        centerFilter.appendChild(option);
                    });
                }
            });
        } catch (error) {
            console.error('Error loading centers:', error);
        }
    }

    async loadReferences() {
        try {
            if (!this.referenceService) {
                console.warn('ReferenceService not available');
                return;
            }
            const references = await this.referenceService.getAllReferences();

            const referenceFilter = document.getElementById('commission-reference-filter');
            if (referenceFilter) {
                referenceFilter.innerHTML = '<option value="all">All References</option>';
                references.forEach(reference => {
                    const option = document.createElement('option');
                    option.value = reference.name;
                    option.textContent = reference.name;
                    referenceFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading references:', error);
        }
    }

    async applyDailyFilter() {
        const fromDate = document.getElementById('daily-from-date')?.value;
        const toDate = document.getElementById('daily-to-date')?.value;
        const centerId = document.getElementById('daily-center-filter')?.value;

        await this.loadDailySalesData(fromDate, toDate, centerId);
    }

    async applyMonthlyFilter() {
        const year = document.getElementById('monthly-year-filter')?.value;
        const month = document.getElementById('monthly-month-filter')?.value;
        const centerId = document.getElementById('monthly-center-filter')?.value;

        await this.loadMonthlySalesData(year, month, centerId);
    }

    async applyCenterFilter() {
        const fromDate = document.getElementById('center-from-date')?.value;
        const toDate = document.getElementById('center-to-date')?.value;
        const centerId = document.getElementById('center-center-filter')?.value;

        await this.loadCenterWiseData(fromDate, toDate, centerId);
    }

    async applyCommissionFilter() {
        const fromDate = document.getElementById('commission-from-date')?.value;
        const toDate = document.getElementById('commission-to-date')?.value;
        const referenceName = document.getElementById('commission-reference-filter')?.value;

        await this.loadCommissionData(fromDate, toDate, referenceName);
    }

    async loadReportData() {
        switch (this.currentTab) {
            case 'daily':
                await this.loadDailySalesData();
                break;
            case 'monthly':
                await this.loadMonthlySalesData();
                break;
            case 'center':
                await this.loadCenterWiseData();
                break;
            case 'commission':
                await this.loadCommissionData();
                break;
        }
    }

    async loadDailySalesData(fromDate = null, toDate = null, centerId = null) {
        try {
            if (!this.reportsService) {
                this.showError('daily', 'Reports service not available');
                return;
            }
            this.showLoading('daily');
            const data = await this.reportsService.getDailySalesReport(fromDate, toDate, centerId);
            this.displayDailySalesData(data);
        } catch (error) {
            console.error('Error loading daily sales data:', error);
            this.showError('daily', 'Failed to load daily sales data: ' + error.message);
        }
    }

    async loadMonthlySalesData(year = null, month = null, centerId = null) {
        try {
            if (!this.reportsService) {
                this.showError('monthly', 'Reports service not available');
                return;
            }
            this.showLoading('monthly');
            const data = await this.reportsService.getMonthlySalesReport(year, month, centerId);
            this.displayMonthlySalesData(data);
        } catch (error) {
            console.error('Error loading monthly sales data:', error);
            this.showError('monthly', 'Failed to load monthly sales data: ' + error.message);
        }
    }

    async loadCenterWiseData(fromDate = null, toDate = null, centerId = null) {
        try {
            if (!this.reportsService) {
                this.showError('center', 'Reports service not available');
                return;
            }
            this.showLoading('center');
            const data = await this.reportsService.getCenterWiseReport(fromDate, toDate, centerId);
            this.displayCenterWiseData(data);
        } catch (error) {
            console.error('Error loading center wise data:', error);
            this.showError('center', 'Failed to load center wise data: ' + error.message);
        }
    }

    async loadCommissionData(fromDate = null, toDate = null, referenceName = null) {
        try {
            if (!this.reportsService) {
                this.showError('commission', 'Reports service not available');
                return;
            }
            this.showLoading('commission');
            const data = await this.reportsService.getCommissionReport(fromDate, toDate, referenceName);
            this.displayCommissionData(data);
        } catch (error) {
            console.error('Error loading commission data:', error);
            this.showError('commission', 'Failed to load commission data: ' + error.message);
        }
    }

    displayDailySalesData(data) {
        const tbody = document.querySelector('#daily tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data"><i class="fas fa-info-circle"></i>No data found for the selected criteria</td></tr>';
            this.updateDailySummary(0, 0, 0);
            return;
        }

        // Sort by bill_date ascending (day 01..31 top-to-bottom)
        const sorted = [...data].sort((a, b) => {
            const da = new Date(a.bill_date);
            const db = new Date(b.bill_date);
            if (isNaN(da) && isNaN(db)) return 0;
            if (isNaN(da)) return 1;
            if (isNaN(db)) return -1;
            return da - db;
        });

        const rows = [];
        sorted.forEach(bill => {
            let formattedDate = 'N/A';
            try {
                const billDate = new Date(bill.bill_date);
                if (!isNaN(billDate.getTime())) {
                    formattedDate = billDate.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                }
            } catch (error) {
                console.warn('Date formatting error:', error);
            }

            const items = Array.isArray(bill.bill_items) ? bill.bill_items : [];
            if (items.length > 0) {
                items.forEach(it => {
                    const testName = (it.tests?.test_name) || (it.packages?.package_name) || 'N/A';
                    const qty = parseFloat(it.quantity || 1);
                    const unit = parseFloat(it.unit_price || 0);
                    const itemTotal = parseFloat(it.total_price != null ? it.total_price : (qty * unit));
                    rows.push(
                        '<tr>' +
                        '<td>' + (bill.bill_no || 'N/A') + '</td>' +
                        '<td>' + formattedDate + '</td>' +
                        '<td>' + (bill.patient_name || 'N/A') + '</td>' +
                        '<td>' + testName + '</td>' +
                        '<td>' + (bill.centers?.center_name || 'N/A') + '</td>' +
                        '<td>' + (bill.ref_by || 'N/A') + '</td>' +
                        '<td class="text-end">Rs. ' + itemTotal.toFixed(2) + '</td>' +
                        '</tr>'
                    );
                });
            } else {
                rows.push(
                    '<tr>' +
                    '<td>' + (bill.bill_no || 'N/A') + '</td>' +
                    '<td>' + formattedDate + '</td>' +
                    '<td>' + (bill.patient_name || 'N/A') + '</td>' +
                    '<td>N/A</td>' +
                    '<td>' + (bill.centers?.center_name || 'N/A') + '</td>' +
                    '<td>' + (bill.ref_by || 'N/A') + '</td>' +
                    '<td class="text-end">Rs. ' + parseFloat(bill.final_amount || 0).toFixed(2) + '</td>' +
                    '</tr>'
                );
            }
        });
        tbody.innerHTML = rows.join('');

        // Calculate totals
        const totalAmount = sorted.reduce((sum, bill) => {
            const items = Array.isArray(bill.bill_items) ? bill.bill_items : [];
            if (items.length > 0) {
                const itemSum = items.reduce((s, it) => {
                    const qty = parseFloat(it.quantity || 1);
                    const unit = parseFloat(it.unit_price || 0);
                    const itemTotal = parseFloat(it.total_price != null ? it.total_price : (qty * unit));
                    return s + itemTotal;
                }, 0);
                return sum + itemSum;
            }
            return sum + parseFloat(bill.final_amount || 0);
        }, 0);
        const totalBills = sorted.length;
        const averageBill = totalBills > 0 ? totalAmount / totalBills : 0;

        // Add summary row
        tbody.innerHTML += '<tr class="table-info">' +
            '<td colspan="6" class="text-end"><strong>Total:</strong></td>' +
            '<td class="text-end"><strong>Rs. ' + totalAmount.toFixed(2) + '</strong></td>' +
            '</tr>';

        // Update summary section
        this.updateDailySummary(totalBills, totalAmount, averageBill);
    }

    updateDailySummary(totalBills, totalAmount, averageBill) {
        const totalBillsEl = document.getElementById('daily-total-bills');
        const totalAmountEl = document.getElementById('daily-total-amount');
        const avgBillEl = document.getElementById('daily-avg-bill');
        
        if (totalBillsEl) totalBillsEl.textContent = totalBills;
        if (totalAmountEl) totalAmountEl.textContent = 'Rs. ' + totalAmount.toFixed(2);
        if (avgBillEl) avgBillEl.textContent = 'Rs. ' + averageBill.toFixed(2);

        // Update date range
        const fromDate = document.getElementById('daily-from-date')?.value;
        const toDate = document.getElementById('daily-to-date')?.value;
        let dateRange = 'Today';

        if (fromDate && toDate) {
            if (fromDate === toDate) {
                const date = new Date(fromDate);
                dateRange = date.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            } else {
                const from = new Date(fromDate);
                const to = new Date(toDate);
                dateRange = from.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' - ' + to.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        }

        const dateRangeEl = document.getElementById('daily-date-range');
        if (dateRangeEl) dateRangeEl.textContent = dateRange;

        // Show summary section
        const summaryEl = document.getElementById('daily-summary');
        if (summaryEl) summaryEl.classList.add('show');
    }

    displayMonthlySalesData(data) {
        const tbody = document.querySelector('#monthly tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="no-data"><i class="fas fa-info-circle"></i>No monthly data found for the selected criteria</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(month => 
            '<tr>' +
            '<td>' + month.month + '</td>' +
            '<td class="text-center">' + month.total_bills + '</td>' +
            '<td class="text-end">Rs. ' + month.total_amount.toFixed(2) + '</td>' +
            '</tr>'
        ).join('');

        // Add summary row
        const totalBills = data.reduce((sum, month) => sum + month.total_bills, 0);
        const totalAmount = data.reduce((sum, month) => sum + month.total_amount, 0);
        tbody.innerHTML += '<tr class="table-info">' +
            '<td><strong>Total:</strong></td>' +
            '<td class="text-center"><strong>' + totalBills + '</strong></td>' +
            '<td class="text-end"><strong>Rs. ' + totalAmount.toFixed(2) + '</strong></td>' +
            '</tr>';
    }

    displayCenterWiseData(data) {
        const tbody = document.querySelector('#center tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="no-data"><i class="fas fa-info-circle"></i>No center data found for the selected criteria</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(center => 
            '<tr>' +
            '<td>' + center.center_name + '</td>' +
            '<td class="text-center">' + center.total_bills + '</td>' +
            '<td class="text-end">Rs. ' + center.total_amount.toFixed(2) + '</td>' +
            '</tr>'
        ).join('');

        // Add summary row
        const totalBills = data.reduce((sum, center) => sum + center.total_bills, 0);
        const totalAmount = data.reduce((sum, center) => sum + center.total_amount, 0);
        tbody.innerHTML += '<tr class="table-info">' +
            '<td><strong>Total:</strong></td>' +
            '<td class="text-center"><strong>' + totalBills + '</strong></td>' +
            '<td class="text-end"><strong>Rs. ' + totalAmount.toFixed(2) + '</strong></td>' +
            '</tr>';
    }

    displayCommissionData(data) {
        const tbody = document.querySelector('#commission tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data"><i class="fas fa-info-circle"></i>No commission data found for the selected criteria</td></tr>';
            return;
        }

        // Sort by date ascending (day 01..31 top-to-bottom)
        const sorted = [...data].sort((a, b) => {
            const da = new Date(a.date);
            const db = new Date(b.date);
            if (isNaN(da) && isNaN(db)) return 0;
            if (isNaN(da)) return 1;
            if (isNaN(db)) return -1;
            return da - db;
        });

        tbody.innerHTML = sorted.map(item => {
            let formattedDate = 'N/A';
            try {
                const billDate = new Date(item.date);
                if (!isNaN(billDate.getTime())) {
                    formattedDate = billDate.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                }
            } catch (error) {
                console.warn('Date formatting error:', error);
            }

            return '<tr>' +
                '<td>' + formattedDate + '</td>' +
                '<td>' + (item.bill_no || 'N/A') + '</td>' +
                '<td>' + (item.patient_name || 'N/A') + '</td>' +
                '<td>' + (item.test_name || 'N/A') + '</td>' +
                '<td>' + (item.reference_name || 'N/A') + '</td>' +
                '<td class="text-end">Rs. ' + parseFloat(item.total_amount || 0).toFixed(2) + '</td>' +
                '<td class="text-center">' + parseFloat(item.commission_rate || 0).toFixed(1) + '%</td>' +
                '<td class="text-end">Rs. ' + parseFloat(item.commission_amount || 0).toFixed(2) + '</td>' +
                '</tr>';
        }).join('');

        // Add summary row (sum of per-item amounts)
        const totalAmount = sorted.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0);
        const totalCommission = sorted.reduce((sum, item) => sum + parseFloat(item.commission_amount || 0), 0);
        tbody.innerHTML += '<tr class="table-info">' +
            '<td colspan="5"><strong>Total:</strong></td>' +
            '<td class="text-end"><strong>Rs. ' + totalAmount.toFixed(2) + '</strong></td>' +
            '<td class="text-center"><strong>-</strong></td>' +
            '<td class="text-end"><strong>Rs. ' + totalCommission.toFixed(2) + '</strong></td>' +
            '</tr>';
    }

    showLoading(tabId) {
        const tbody = document.querySelector('#' + tabId + ' tbody');
        if (tbody) {
            const colCount = this.getColumnCount(tabId);
            tbody.innerHTML = '<tr>' +
                '<td colspan="' + colCount + '" class="text-center">' +
                '<div class="spinner-border text-primary" role="status">' +
                '<span class="visually-hidden">Loading...</span>' +
                '</div>' +
                '<div class="mt-2">Loading data...</div>' +
                '</td>' +
                '</tr>';
        }
    }

    getColumnCount(tabId) {
        const columnCounts = {
            'daily': 7,
            'monthly': 3,
            'center': 3,
            'commission': 8
        };
        return columnCounts[tabId] || 6;
    }

    refreshCurrentReport() {
        // Clear any existing error messages
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => alert.remove());
        
        // Reload current report data
        this.loadReportData();
    }

    showError(tabId, message) {
        const tbody = document.querySelector('#' + tabId + ' tbody');
        if (tbody) {
            const colCount = this.getColumnCount(tabId);
            tbody.innerHTML = '<tr>' +
                '<td colspan="' + colCount + '" class="no-data">' +
                '<i class="fas fa-exclamation-triangle text-warning"></i>' +
                '<div>' + message + '</div>' +
                '<button class="btn btn-sm btn-outline-primary mt-2" onclick="window.reportsController.loadReportData()">' +
                '<i class="fas fa-retry"></i> Retry' +
                '</button>' +
                '</td>' +
                '</tr>';
        }
    }

    showGlobalError(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show';
        alertDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i>' +
            '<strong>Error:</strong> ' + message +
            '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>';
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
            // Auto-dismiss after 10 seconds
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 10000);
        }
    }

    printReport() {
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab) {
            const printWindow = window.open('', '_blank');
            const table = activeTab.querySelector('table');
            if (table) {
                // Get report type from active tab
                const reportType = this.getReportType(activeTab);
                const dateRange = this.getDateRangeForPrint(activeTab);

                const htmlContent = '<html>' +
                    '<head>' +
                    '<title>Suwajeewa Laboratory - ' + reportType + '</title>' +
                    '<style>' +
                    'body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }' +
                    '.header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }' +
                    '.company-name { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 5px; }' +
                    '.report-title { font-size: 16px; color: #666; margin-bottom: 5px; }' +
                    '.date-range { font-size: 12px; color: #333; font-weight: 500; margin-bottom: 5px; }' +
                    '.report-date { font-size: 11px; color: #888; }' +
                    'table { width: 100%; border-collapse: collapse; margin-top: 15px; }' +
                    'th, td { border: 1px solid #ddd; padding: 4px; text-align: left; line-height: 1.2; }' +
                    'th { background-color: #f2f2f2; font-weight: bold; font-size: 11px; }' +
                    'td { font-size: 10px; }' +
                    '.text-end { text-align: right; }' +
                    '.text-center { text-align: center; }' +
                    '.table-info { background-color: #e3f2fd; font-weight: bold; }' +
                    '.no-data { text-align: center; font-style: italic; color: #666; }' +
                    '@media print {' +
                    'body { margin: 5px; font-size: 10px; line-height: 1.1; }' +
                    '.header { page-break-after: avoid; margin-bottom: 10px; padding-bottom: 5px; }' +
                    'table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9px; }' +
                    'th, td { border: 1px solid #ddd; padding: 2px 3px; text-align: left; line-height: 1.0; }' +
                    'th { background-color: #f2f2f2; font-weight: bold; font-size: 9px; padding: 3px; }' +
                    'td { font-size: 8px; padding: 2px; }' +
                    '.table-info { background-color: #e3f2fd; font-weight: bold; page-break-inside: avoid; }' +
                    'tbody tr { page-break-inside: auto; }' +
                    'thead { display: table-header-group; }' +
                    '}' +
                    '</style>' +
                    '</head>' +
                    '<body>' +
                    '<div class="header">' +
                    '<div class="company-name">SUWAJEEWA LABORATORY</div>' +
                    '<div class="report-title">' + reportType + '</div>' +
                    (dateRange ? '<div class="date-range">' + dateRange + '</div>' : '') +
                    '<div class="report-date">Generated on: ' + new Date().toLocaleString() + '</div>' +
                    '</div>' +
                    table.outerHTML +
                    '</body>' +
                    '</html>';
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                printWindow.print();
            }
        }
    }

    getReportType(activeTab) {
        const tabId = activeTab.id;
        switch (tabId) {
            case 'daily':
                return 'Daily Sales Report';
            case 'monthly':
                return 'Monthly Sales Report';
            case 'center':
                return 'Center Wise Report';
            case 'commission':
                return 'Commission Report';
            default:
                return 'Report';
        }
    }

    getDateRangeForPrint(activeTab) {
        const tabId = activeTab.id;
        let fromDate, toDate, year, month;

        switch (tabId) {
            case 'daily':
                fromDate = document.getElementById('daily-from-date')?.value;
                toDate = document.getElementById('daily-to-date')?.value;
                break;
            case 'center':
                fromDate = document.getElementById('center-from-date')?.value;
                toDate = document.getElementById('center-to-date')?.value;
                break;
            case 'commission':
                fromDate = document.getElementById('commission-from-date')?.value;
                toDate = document.getElementById('commission-to-date')?.value;
                break;
            case 'monthly':
                year = document.getElementById('monthly-year-filter')?.value;
                month = document.getElementById('monthly-month-filter')?.value;
                if (month && month !== 'all') {
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
                    return 'Period: ' + monthNames[parseInt(month)] + ' ' + year;
                } else {
                    return 'Period: ' + year;
                }
        }

        if (fromDate && toDate) {
            if (fromDate === toDate) {
                const date = new Date(fromDate);
                return 'Date: ' + date.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
            } else {
                const from = new Date(fromDate);
                const to = new Date(toDate);
                return 'Period: ' + from.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'long'
                }) + ' - ' + to.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
            }
        } else if (fromDate) {
            const date = new Date(fromDate);
            return 'From: ' + date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        } else if (toDate) {
            const date = new Date(toDate);
            return 'Until: ' + date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        }

        return null;
    }

    exportToCSV() {
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab) {
            const table = activeTab.querySelector('table');
            if (table) {
                const csv = this.tableToCSV(table);
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.currentTab + '_report_' + new Date().toISOString().split('T')[0] + '.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        }
    }

    tableToCSV(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        return rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => {
                let text = cell.textContent.trim();
                // Escape quotes and wrap in quotes if contains comma
                if (text.includes(',') || text.includes('"')) {
                    text = '"' + text.replace(/"/g, '""') + '"';
                }
                return text;
            }).join(',');
        }).join('\n');
    }
}

// Initialize when DOM is loaded
function initializeReports() {
    if (!window.reportsController) {
        window.reportsController = new ReportsController();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReports);
} else {
    initializeReports();
}

// Add global error handler
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    if (window.reportsController && window.reportsController.showGlobalError) {
        window.reportsController.showGlobalError('An unexpected error occurred. Please refresh the page.');
    }
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    if (window.reportsController && window.reportsController.showGlobalError) {
        window.reportsController.showGlobalError('An unexpected error occurred. Please refresh the page.');
    }
});
