# Daily Sales Integration Guide

## Overview

This guide explains how daily billing details from `billing.html` are properly displayed in the Daily Sales table in `reports-management.html`.

## Data Flow

### 1. Bill Creation (billing.html)

When a bill is created in the billing system:

- Data is saved to the `bills` table in the database
- Includes: `bill_no`, `bill_date`, `patient_name`, `center_id`, `ref_by`, `final_amount`, etc.
- Bill items are saved to the `bill_items` table

### 2. Data Retrieval (reports-management.html)

When viewing Daily Sales reports:

- User selects date range in the filter section
- Reports service calls billing service with date filters
- Billing service queries database with proper date filtering
- Data is transformed and returned to the reports controller
- Data is displayed in the Daily Sales table

## Table Structure

The Daily Sales table displays the following columns:

| Column       | Data Source                | Description                 |
| ------------ | -------------------------- | --------------------------- |
| BILL NO      | `bill.bill_no`             | Unique bill number          |
| DATE         | `bill.bill_date`           | Date when bill was created  |
| PATIENT NAME | `bill.patient_name`        | Name of the patient         |
| CENTER       | `bill.centers.center_name` | Name of the center/location |
| REFERENCE    | `bill.ref_by`              | Doctor/reference name       |
| AMOUNT       | `bill.final_amount`        | Final amount after discount |

## Key Files and Functions

### 1. Billing Service (`js/services/billingService.js`)

```javascript
// Main function that retrieves billing data for reports
async getBillingDataForReports(filters = {}) {
  // Queries bills table with date, center, and reference filters
  // Returns complete bill data with related information
}
```

### 2. Reports Service (`js/services/reportsService.js`)

```javascript
// Gets daily sales report data
async getDailySalesReport(filters = {}) {
  // Uses billing service to get data
  // Transforms data to match expected format
  // Returns data ready for display
}
```

### 3. Reports Controller (`js/controllers/reportsController.js`)

```javascript
// Displays data in the Daily Sales table
displayReportData(data, tabId) {
  // Maps bill data to table rows
  // Formats dates and currency
  // Updates the HTML table
}
```

## Date Filtering

The system supports comprehensive date filtering:

- **From Date**: Shows bills created on or after this date
- **To Date**: Shows bills created on or before this date
- **Center Filter**: Shows bills from specific centers
- **Reference Filter**: Shows bills from specific doctors/references

## Data Transformation

The billing data is transformed to ensure proper display:

```javascript
const transformedData = billingData.map((bill) => ({
  bill_no: bill.bill_no,
  bill_date: bill.bill_date,
  patient_name: bill.patient_name,
  centers: { center_name: bill.centers?.center_name || "Unknown" },
  ref_by: bill.ref_by,
  final_amount: bill.final_amount,
  // ... other fields
}));
```

## Testing

### Test File: `test-daily-sales-display.html`

This file allows you to:

1. Test database connectivity
2. Load daily sales data with date filters
3. Create test bills and verify they appear in the table
4. Debug any display issues

### How to Test:

1. Open `test-daily-sales-display.html`
2. Set date range to today's date
3. Click "Load Daily Sales" to fetch data
4. Click "Create Test Bill" to add a sample bill
5. Verify the bill appears in the table with all details

## Troubleshooting

### Common Issues:

1. **No Data Displayed**

   - Check if bills exist for the selected date range
   - Verify database connection
   - Check browser console for errors

2. **Missing Center Information**

   - Ensure center_id is properly set when creating bills
   - Check if center exists in the centers table

3. **Missing Reference Information**

   - Ensure ref_by field is properly set
   - Check if reference exists in the references table

4. **Date Filtering Not Working**
   - Verify date format in database (should be ISO format)
   - Check if bill_date field is properly set

### Debug Information:

The system includes console logging to help debug issues:

- Billing service logs query results
- Reports service logs data transformation
- Reports controller logs display processing

## Real-time Updates

The system supports real-time updates:

- Bills created in billing.html immediately appear in reports
- No manual refresh required
- Data is fetched fresh from database on each search

## Performance Optimization

- Uses database views (`bill_summary`) for better performance
- Proper indexing on date and filter fields
- Efficient data transformation
- Fallback to sample data if database unavailable

## Conclusion

The daily billing details are properly integrated and displayed in the Daily Sales table. The system ensures:

- ✅ Accurate data retrieval from billing system
- ✅ Proper date filtering
- ✅ Real-time updates
- ✅ Comprehensive error handling
- ✅ Performance optimization

All bills created in `billing.html` will appear in the Daily Sales table in `reports-management.html` when the correct date range is selected.
