# SUWAJEEWA LABORATORIES - Backend System

## Overview

This is a comprehensive backend system for the SUWAJEEWA Laboratories management system, built with JavaScript and Supabase. The system provides full CRUD operations for billing, test management, reference management, center management, and package management.

## Features

### 🔧 Core Services

- **Billing Service**: Complete billing management with patient history, payment tracking, and bill generation
- **Test Management**: Test CRUD operations, subcategories, and reference ranges
- **Reference Management**: Doctor/reference management with commission tracking
- **Center Management**: Laboratory center management
- **Package Management**: Test package creation and management

### 🚀 Key Features

- Real-time data synchronization with Supabase
- Automatic bill number generation
- Patient history tracking
- Payment management with discount calculations
- Search and filter functionality
- Data validation and error handling
- Responsive notifications system
- Export functionality (CSV)
- Print functionality

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **UI Framework**: Bootstrap 5
- **Icons**: Font Awesome 6

## Project Structure

```
lab-new/
├── config/
│   └── supabase.js              # Supabase configuration
├── js/
│   ├── app.js                   # Main application controller
│   ├── services/
│   │   ├── billingService.js    # Billing operations
│   │   ├── testService.js       # Test management
│   │   ├── referenceService.js  # Reference management
│   │   ├── centerService.js     # Center management
│   │   └── packageService.js    # Package management
│   └── controllers/
│       └── billingController.js # Billing page controller
├── database/
│   └── setup.sql               # Database schema and setup
├── billing.html                # Billing interface
├── test-management.html        # Test management interface
├── reference-management.html   # Reference management interface
├── center-management.html      # Center management interface
├── package-management.html     # Package management interface
└── README_BACKEND.md          # This file
```

## Setup Instructions

### 1. Supabase Setup

1. **Create Supabase Project**

   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note down your project URL and anon key

2. **Configure Database**

   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the contents of `database/setup.sql`
   - This will create all necessary tables, indexes, and sample data

3. **Update Configuration**
   - Open `config/supabase.js`
   - Replace `YOUR_SUPABASE_URL` with your project URL
   - Replace `YOUR_SUPABASE_ANON_KEY` with your anon key

### 2. Local Development Setup

1. **Clone/Download the project**

   ```bash
   git clone <repository-url>
   cd lab-new
   ```

2. **Update Supabase Configuration**

   - Edit `config/supabase.js` with your Supabase credentials

3. **Serve the application**

   - Use a local web server (due to CORS restrictions)
   - You can use Python's built-in server:
     ```bash
     python -m http.server 8000
     ```
   - Or use Node.js http-server:
     ```bash
     npx http-server
     ```

4. **Access the application**
   - Open `http://localhost:8000` in your browser
   - Navigate to `billing.html` to test the billing system

## Database Schema

### Core Tables

#### Bills Table

- `id`: UUID (Primary Key)
- `bill_no`: VARCHAR(20) - Unique bill number
- `bill_date`: TIMESTAMP - Bill creation date
- `patient_name`: VARCHAR(255) - Patient name
- `patient_phone`: VARCHAR(20) - Patient phone
- `total_amount`: DECIMAL(10,2) - Total bill amount
- `discount`: DECIMAL(10,2) - Discount amount
- `final_amount`: DECIMAL(10,2) - Final amount after discount
- `paid_amount`: DECIMAL(10,2) - Amount paid
- `remaining_amount`: DECIMAL(10,2) - Remaining amount
- `status`: VARCHAR(20) - Bill status (pending/paid/partial/cancelled)

#### Tests Table

- `id`: UUID (Primary Key)
- `test_name`: VARCHAR(255) - Test name
- `short_name`: VARCHAR(50) - Short name
- `price`: DECIMAL(10,2) - Test price
- `category`: VARCHAR(100) - Test category
- `specimen`: VARCHAR(100) - Required specimen
- `tube`: VARCHAR(50) - Tube type
- `is_active`: BOOLEAN - Active status

#### Packages Table

- `id`: UUID (Primary Key)
- `pgid`: VARCHAR(10) - Package ID
- `package_name`: VARCHAR(255) - Package name
- `price`: DECIMAL(10,2) - Package price
- `is_active`: BOOLEAN - Active status

#### References Table

- `id`: UUID (Primary Key)
- `rid`: VARCHAR(10) - Reference ID
- `name`: VARCHAR(255) - Doctor/reference name
- `commission`: DECIMAL(5,2) - Commission percentage

#### Centers Table

- `id`: UUID (Primary Key)
- `cid`: VARCHAR(10) - Center ID
- `center_name`: VARCHAR(255) - Center name
- `is_active`: BOOLEAN - Active status

## API Services

### BillingService

```javascript
// Create new bill
await billingService.createBill(billData);

// Get bill by number
await billingService.getBillByNumber(billNo);

// Get patient history
await billingService.getPatientHistory(phone);

// Search bills
await billingService.searchBills(searchTerm);

// Update bill payment
await billingService.updateBillPayment(billId, paidAmount);
```

### TestService

```javascript
// Create new test
await testService.createTest(testData);

// Search tests
await testService.searchTests(searchTerm);

// Get test by ID
await testService.getTestById(testId);

// Add reference range
await testService.addReferenceRange(referenceData);
```

### ReferenceService

```javascript
// Create new reference
await referenceService.createReference(referenceData);

// Search references
await referenceService.searchReferences(searchTerm);

// Get reference performance
await referenceService.getReferencePerformance(referenceId, startDate, endDate);
```

### CenterService

```javascript
// Create new center
await centerService.createCenter(centerData);

// Get center performance
await centerService.getCenterPerformance(centerId, startDate, endDate);

// Get top performing centers
await centerService.getTopPerformingCenters(limit, startDate, endDate);
```

### PackageService

```javascript
// Create new package
await packageService.createPackage(packageData);

// Add tests to package
await packageService.addTestsToPackage(packageId, testIds);

// Get package details
await packageService.getPackageById(packageId);
```

## Usage Examples

### Creating a New Bill

```javascript
const billData = {
  patient_name: "John Doe",
  patient_phone: "0771234567",
  patient_title: "Mr.",
  patient_age_years: 30,
  patient_gender: "Male",
  ref_by: "DR M AMUNUGAMA",
  items: [
    {
      test_id: "test-uuid",
      quantity: 1,
      unit_price: 1500.0,
      total_price: 1500.0,
    },
  ],
  total_amount: 1500.0,
  discount: 0.0,
  final_amount: 1500.0,
};

const bill = await billingService.createBill(billData);
```

### Searching Tests

```javascript
const tests = await testService.searchTests("blood");
console.log(tests); // Array of matching tests
```

### Getting Patient History

```javascript
const history = await billingService.getPatientHistory("0771234567");
console.log(history); // Array of patient's previous bills
```

## Error Handling

The system includes comprehensive error handling:

```javascript
try {
  const result = await service.methodName(data);
  window.app.showSuccess("Operation successful");
} catch (error) {
  console.error("Error:", error);
  window.app.showError("Operation failed: " + error.message);
}
```

## Notifications

The system provides built-in notification methods:

```javascript
window.app.showSuccess("Success message");
window.app.showError("Error message");
window.app.showWarning("Warning message");
window.app.showInfo("Info message");
```

## Data Validation

Form validation is handled automatically:

```javascript
const validationRules = {
  patient_name: { required: true, minLength: 2 },
  patient_phone: { required: true, pattern: /^[0-9]{10}$/ },
  price: { required: true, min: 0 },
};

const validation = window.app.validateForm(formData, validationRules);
if (!validation.isValid) {
  console.log(validation.errors);
}
```

## Security Features

- **Row Level Security (RLS)**: All tables have RLS enabled
- **Authentication**: Supabase Auth integration
- **Input Validation**: Client and server-side validation
- **SQL Injection Protection**: Parameterized queries via Supabase

## Performance Optimizations

- **Database Indexes**: Optimized indexes on frequently queried columns
- **Connection Pooling**: Managed by Supabase
- **Caching**: Client-side caching for frequently accessed data
- **Debouncing**: Search inputs are debounced to reduce API calls

## Troubleshooting

### Common Issues

1. **CORS Errors**

   - Ensure you're serving files through a web server, not file:// protocol
   - Check Supabase project settings for allowed origins

2. **Authentication Errors**

   - Verify Supabase URL and anon key in config
   - Check if RLS policies are correctly set up

3. **Database Connection Issues**
   - Verify Supabase project is active
   - Check network connectivity
   - Verify database schema is properly set up

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem("debug", "true");
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the Supabase documentation for database-related issues

## Future Enhancements

- [ ] User authentication and authorization
- [ ] Advanced reporting and analytics
- [ ] Email notifications
- [ ] Mobile app integration
- [ ] Multi-language support
- [ ] Advanced search and filtering
- [ ] Data import/export functionality
- [ ] Audit logging
- [ ] Backup and recovery system
