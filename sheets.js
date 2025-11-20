const { google } = require('googleapis');
const path = require('path');

// Path to the service account JSON file
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'astute-smile-474621-e4-740759e13bbc.json');

// Google Sheets API scopes
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Sheet IDs for different product types
const SPREADSHEET_IDS = {
    kitchen: '1muDNyHOdL9YF-6MQ1CBkarwxAGXJtEMp0C4YtM83sq8',
    curtains: '1Dzq3Bu-TjgwDlTTTdpGEDW2WeVjRnjOC6-9aUaYXfS8'
};

// Function to authenticate and get sheets client
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

// Function to read data from the sheet
async function readSheetData(productType = 'kitchen') {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = SPREADSHEET_IDS[productType] || SPREADSHEET_IDS.kitchen;

    // Read the entire sheet (assuming data starts from A1)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'A1:Z', // Read from A1 to Z
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return [];
    }

    // Assuming first row is headers
    const headers = rows[0];
    const data = rows.slice(1).map((row, index) => {
      const obj = {};
      headers.forEach((header, colIndex) => {
        obj[header.toLowerCase().replace(/\s+/g, '_')] = row[colIndex] || '';
      });
      // Add row index (1-based, +2 because row 1 is headers and we start from index 0)
      obj.rowIndex = index + 2;
      return obj;
    });

    return data;
  } catch (error) {
    console.error('Error reading sheet data:', error);
    throw error;
  }
}

/**
 * Update the status of an ad in the Google Sheet
 * @param {number} rowIndex - The 1-based row index in the sheet (row 1 is headers, data starts at row 2)
 * @param {string} status - The status to write (e.g., "выставлено")
 * @param {string} productType - Product type ('kitchen' or 'curtains')
 * @returns {Promise<void>}
 */
async function updateAdStatus(rowIndex, status, productType = 'kitchen') {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = SPREADSHEET_IDS[productType] || SPREADSHEET_IDS.kitchen;

    // Determine the status column (column Z)
    const statusColumn = 'Z';
    const range = `${statusColumn}${rowIndex}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'RAW',
      resource: {
        values: [[status]]
      }
    });

    console.log(`✓ Updated row ${rowIndex} status to: "${status}"`);
  } catch (error) {
    console.error(`Error updating status for row ${rowIndex}:`, error.message);
    // Don't throw - make this non-blocking
  }
}

/**
 * Clear all ad statuses in the Status column
 * This should be called when all ads are deleted
 * @param {string} productType - Product type ('kitchen' or 'curtains')
 * @returns {Promise<void>}
 */
async function clearAllAdStatuses(productType = 'kitchen') {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = SPREADSHEET_IDS[productType] || SPREADSHEET_IDS.kitchen;

    // First, read to find out how many rows we have
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'A1:Z',
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      console.log('No data rows to clear status from');
      return;
    }

    // Clear status column Z for all data rows (starting from row 2)
    const statusColumn = 'Z';
    const startRow = 2;
    const endRow = rows.length;
    const range = `${statusColumn}${startRow}:${statusColumn}${endRow}`;

    // Create an array of empty values for each row
    const emptyValues = Array(endRow - startRow + 1).fill(['']);

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'RAW',
      resource: {
        values: emptyValues
      }
    });

    console.log(`✓ Cleared all ad statuses (rows ${startRow} to ${endRow})`);
  } catch (error) {
    console.error('Error clearing all ad statuses:', error.message);
    // Don't throw - make this non-blocking
  }
}

// Function to process photo URLs from the Photos column
function processPhotoUrls(data) {
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }
  console.log('Processing photo URLs for ads...');
  return data.map((ad, index) => {
    const photosStr = ad.photos || ad['photos'] || '';
    console.log(`Ad ${index + 1} photos string: "${photosStr}"`);

    let urls = [];

    // Check if photosStr is a JSON string (like the first ad)
    if (photosStr.startsWith('{') && photosStr.endsWith('}')) {
      try {
        const parsed = JSON.parse(photosStr);
        console.log(`Ad ${index + 1} parsed as JSON object:`, parsed);
        // Extract URLs from the object values
        urls = Object.values(parsed).filter(url => typeof url === 'string' && url.trim().length > 0);
        console.log(`Ad ${index + 1} extracted URLs from JSON:`, urls);
      } catch (jsonError) {
        console.log(`Ad ${index + 1} JSON parse failed: ${jsonError.message}, treating as comma-separated`);
        urls = photosStr.split(',').map(url => url.trim()).filter(url => url.length > 0);
      }
    } else {
      // Treat as comma-separated URLs
      urls = photosStr.split(',').map(url => url.trim()).filter(url => url.length > 0);
    }

    console.log(`Ad ${index + 1} parsed URLs:`, urls);
    const validUrls = [];
    for (const url of urls) {
      try {
        new URL(url);
        validUrls.push(url);
      } catch (error) {
        console.log(`Invalid URL skipped for ad ${index + 1}: ${url} - ${error.message}`);
      }
    }
    console.log(`Ad ${index + 1} valid URLs:`, validUrls);
    return validUrls;
  });
}

module.exports = { readSheetData, processPhotoUrls, updateAdStatus, clearAllAdStatuses };
