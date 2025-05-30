require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Environment variables for sensitive data
const credentials = {
  client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

// Google Sheets setup
const auth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Initialize Google Sheets
const salesDoc = new GoogleSpreadsheet(process.env.SALES_SHEET_ID, auth);
const expensesDoc = new GoogleSpreadsheet(process.env.EXPENSES_SHEET_ID, auth);

// Helper functions
const mapSalesRowData = (row, headers) => ({
  'Customer Name': row[headers.indexOf('Customer Name')] || '-',
  'Car Model': row[headers.indexOf('Car Model')] || '-',
  'Car Type/Make': row[headers.indexOf('Car Type/Make')] || '-',
  'Car Number': row[headers.indexOf('Car Number')] || '-',
  'Primary Service': row[headers.indexOf('Primary Service')] || '-',
  'Secondary Service': row[headers.indexOf('Secondary Service')] || '-',
  'Washer Name': row[headers.indexOf('Washer Name')] || '-',
  'Mobile Number': row[headers.indexOf('Mobile Number')] || '-',
  'Email': row[headers.indexOf('Email')] || '-',
  'Payment Type': row[headers.indexOf('Payment Type')] || '-',
  'Total Amount (GHS)': parseFloat(row[headers.indexOf('Total Amount (GHS)')] || 0),
  'Washer Commission (GHS)': parseFloat(row[headers.indexOf('Washer Commission (GHS)')] || 0),
  'Company Commission (GHS)': parseFloat(row[headers.indexOf('Company Commission (GHS)')] || 0),
  'Timestamp': row[headers.indexOf('Timestamp')] || new Date().toISOString()
});

const mapExpensesRowData = (row, headers) => ({
  date: row[headers.indexOf('Date')] || new Date().toISOString(),
  category: row[headers.indexOf('Category')] || '-',
  description: row[headers.indexOf('Description')] || '-',
  amount: parseFloat(row[headers.indexOf('Amount (GHS)')] || 0),
  person: row[headers.indexOf('Responsible Person')] || '-',
  payment: row[headers.indexOf('Payment Method')] || '-',
  timestamp: row[headers.indexOf('Timestamp')] || new Date().toISOString()
});

// Initialize connections
(async function initializeSheets() {
  try {
    await Promise.all([salesDoc.loadInfo(), expensesDoc.loadInfo()]);
    console.log('Connected to Google Sheets:');
    console.log('- Sales Sheet:', salesDoc.title);
    console.log('- Expenses Sheet:', expensesDoc.title);
  } catch (error) {
    console.error('Google Sheets connection failed:', error.message);
    process.exit(1); // Exit if can't connect to sheets
  }
})();

// API Routes

// Sales endpoints
app.get('/api/data', async (req, res) => {
  try {
    const sheet = salesDoc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    res.json(rows.map(row => mapSalesRowData(row._rawData, sheet.headerValues)));
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

app.post('/api/save', async (req, res) => {
  try {
    const sheet = salesDoc.sheetsByIndex[0];
    await sheet.addRow({
      'Customer Name': req.body.customerName,
      'Car Model': req.body.carModel,
      'Car Type/Make': req.body.carType,
      'Car Number': req.body.carNumber,
      'Primary Service': req.body.serviceType1,
      'Secondary Service': req.body.serviceType2,
      'Washer Name': req.body.washerName,
      'Mobile Number': req.body.mobileNumber,
      'Email': req.body.email || '',
      'Payment Type': req.body.paymentType,
      'Total Amount (GHS)': Number(req.body.amount).toFixed(2),
      'Washer Commission (GHS)': Number(req.body.washerCommission).toFixed(2),
      'Company Commission (GHS)': Number(req.body.companyCommission).toFixed(2),
      'Timestamp': new Date().toISOString()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving sale:', error);
    res.status(500).json({ error: 'Failed to save sale' });
  }
});

// Expenses endpoints
app.get('/api/expenses', async (req, res) => {
  try {
    const sheet = expensesDoc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    res.json(rows.map(row => mapExpensesRowData(row._rawData, sheet.headerValues)));
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const sheet = expensesDoc.sheetsByIndex[0];
    await sheet.addRow({
      'Date': req.body.date,
      'Category': req.body.category,
      'Description': req.body.description,
      'Amount (GHS)': Number(req.body.amount).toFixed(2),
      'Responsible Person': req.body.person,
      'Payment Method': req.body.payment,
      'Timestamp': new Date().toISOString()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving expense:', error);
    res.status(500).json({ error: 'Failed to save expense' });
  }
});

// Serve frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});