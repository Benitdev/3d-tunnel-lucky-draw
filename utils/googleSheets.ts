// Google Sheets API client-side integration
// Note: For production, use Google Apps Script as a proxy for security

interface GoogleSheetsConfig {
  spreadsheetId: string;
  apiKey?: string;
  serviceAccountEmail?: string;
  privateKey?: string;
}

// Get selected numbers from Google Sheets
export async function getSelectedNumbers(
  config: GoogleSheetsConfig
): Promise<number[]> {
  try {
    // Using Google Sheets API v4
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/Sheet1!A:A?key=${config.apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
      
      if (response.status === 403) {
        console.error('403 Permission Denied. Common causes:');
        console.error('1. Google Sheet is not shared publicly (needs "Anyone with the link can view")');
        console.error('2. API key restrictions are too strict');
        console.error('3. Google Sheets API is not enabled in your project');
        console.error('Error details:', errorMessage);
      } else {
        console.error('Error fetching selected numbers:', errorMessage);
      }
      
      throw new Error(`Failed to fetch selected numbers: ${errorMessage}`);
    }

    const data = await response.json();
    const rows = data.values || [];
    
    // Skip header if exists, extract numbers
    const selectedNumbers = rows
      .slice(1)
      .map((row: string[]) => Number(row[0]))
      .filter((num: number) => !isNaN(num) && num >= 1 && num <= 100);

    return selectedNumbers;
  } catch (error) {
    console.error('Error fetching selected numbers:', error);
    return [];
  }
}

// Save number to Google Sheets via Google Apps Script Web App
// This is the recommended approach for client-side writes
export async function saveNumberToSheet(
  number: number,
  config: { scriptUrl: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(config.scriptUrl, {
      method: 'POST',
      mode: 'no-cors', // Google Apps Script doesn't support CORS properly
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'append',
        number,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
    });

    // With no-cors, we can't read the response, so assume success
    return { success: true };
  } catch (error) {
    console.error('Error saving number:', error);
    return { success: false, error: 'Failed to save number' };
  }
}

// Alternative: Direct API call with service account (requires backend proxy in production)
export async function saveNumberDirect(
  number: number,
  config: GoogleSheetsConfig
): Promise<{ success: boolean; error?: string }> {
  // This would require JWT token generation on client-side
  // Not recommended for production - use Google Apps Script instead
  console.warn('Direct API calls with service account should be done server-side');
  return { success: false, error: 'Use Google Apps Script web app for client-side writes' };
}
