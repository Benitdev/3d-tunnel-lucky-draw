# Google Sheets Setup Guide

This app saves number selections to Google Sheets. You have two options:

## Option 1: Google Apps Script (Recommended for Client-Side)

This is the most secure way to write to Google Sheets from the client.

### Steps:

1. **Create a Google Sheet**

   - Create a new Google Sheet
   - Add headers in row 1: `Number | Timestamp | User Agent | Saved At`

2. **Create a Google Apps Script**
   - In your Google Sheet, go to `Extensions` > `Apps Script`
   - Replace the code with:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
    const data = JSON.parse(e.postData.contents)

    if (data.action === "append" && data.number) {
      // Check if number already exists
      const existingData = sheet.getDataRange().getValues()
      const numbers = existingData.slice(1).map((row) => row[0])

      if (numbers.includes(data.number)) {
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: "Number already selected",
          })
        ).setMimeType(ContentService.MimeType.JSON)
      }

      // Append new row
      sheet.appendRow([
        data.number,
        data.timestamp || new Date().toISOString(),
        data.userAgent || "",
        new Date().toISOString(),
      ])

      return ContentService.createTextOutput(
        JSON.stringify({
          success: true,
          message: "Number saved successfully",
        })
      ).setMimeType(ContentService.MimeType.JSON)
    }

    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: "Invalid request",
      })
    ).setMimeType(ContentService.MimeType.JSON)
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: error.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON)
  }
}

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
  const data = sheet.getDataRange().getValues()
  const numbers = data
    .slice(1)
    .map((row) => row[0])
    .filter((n) => n)

  return ContentService.createTextOutput(
    JSON.stringify({
      selectedNumbers: numbers,
    })
  ).setMimeType(ContentService.MimeType.JSON)
}
```

3. **Deploy as Web App**

   - Click `Deploy` > `New deployment`
   - Choose type: `Web app`
   - Execute as: `Me`
   - Who has access: `Anyone` (or `Anyone with Google account` for more security)
   - Click `Deploy`
   - Copy the Web App URL

4. **Get Google Sheets API Key (for reading selected numbers)**

   The API key is needed to read which numbers have already been selected. Here's how to get it:

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the **Google Sheets API**:
     - Navigate to "APIs & Services" > "Library"
     - Search for "Google Sheets API"
     - Click on it and click "Enable"
   - Create an API Key:
     - Go to "APIs & Services" > "Credentials"
     - Click "Create Credentials" > "API Key"
     - Copy the API key that appears
     - (Optional but recommended) Click "Restrict Key" and restrict it to "Google Sheets API" only

5. **Get Spreadsheet ID**

   - Open your Google Sheet
   - Look at the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Copy the `SPREADSHEET_ID` (the long string between `/d/` and `/edit`)

6. **Set Environment Variables**

   - Create a `.env` file in the root directory:

   ```
   VITE_GOOGLE_SCRIPT_URL=your_web_app_url_here
   VITE_GOOGLE_SHEETS_ID=your_spreadsheet_id_here
   VITE_GOOGLE_API_KEY=your_api_key_here
   ```

   **Note:** The API key is only needed for reading selected numbers. If you only use Google Apps Script for writing, you can skip the API key, but then the app won't be able to show which numbers are already taken.

## Option 2: Direct API with API Key (Read-Only)

For reading selected numbers, you can use a Google Sheets API key:

1. **Get API Key**

   **Step-by-step:**

   a. Go to [Google Cloud Console](https://console.cloud.google.com/)

   b. Create a new project (or select an existing one):

   - Click the project dropdown at the top
   - Click "New Project"
   - Enter a project name (e.g., "Number Selection App")
   - Click "Create"

   c. Enable Google Sheets API:

   - In the left sidebar, go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click on "Google Sheets API"
   - Click the "Enable" button

   d. Create an API Key:

   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - A popup will show your API key - **copy it immediately** (you can't see it again!)
   - Click "Restrict Key" (recommended for security)
     - Under "API restrictions", select "Restrict key"
     - Choose "Google Sheets API" from the dropdown
     - Click "Save"

   e. **Important:** Copy and save your API key - you'll need it for the `.env` file

2. **Share Sheet**

   - Open your Google Sheet
   - Click "Share" and make it "Anyone with the link can view" (for read access)

3. **Get Spreadsheet ID**

   - From the sheet URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Copy the `SPREADSHEET_ID`

4. **Set Environment Variables**
   ```
   VITE_GOOGLE_SHEETS_ID=your_spreadsheet_id_here
   VITE_GOOGLE_API_KEY=your_api_key_here
   ```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Google Sheets Configuration
VITE_GOOGLE_SHEETS_ID=your_spreadsheet_id_here
VITE_GOOGLE_API_KEY=your_api_key_here
VITE_GOOGLE_SCRIPT_URL=your_google_apps_script_web_app_url_here
```

**Note:** The app will work without Google Sheets configuration - selections will be saved locally only.

## Troubleshooting 403 Permission Denied Error

If you're getting a `403 The caller does not have permission` error, try these solutions:

### Solution 1: Make Google Sheet Publicly Readable (Easiest)

1. Open your Google Sheet
2. Click the **"Share"** button (top right)
3. Click **"Change to anyone with the link"**
4. Set permission to **"Viewer"**
5. Click **"Done"**
6. The sheet must be accessible without authentication for the API key to work

### Solution 2: Check API Key Restrictions

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **"APIs & Services" > "Credentials"**
3. Click on your API key
4. Under **"API restrictions"**:
   - Make sure **"Google Sheets API"** is selected (not "Restrict key")
   - OR if restricted, ensure **"Google Sheets API"** is in the allowed list
5. Under **"Application restrictions"**:
   - For testing, set to **"None"** (you can restrict later)
   - If using HTTP referrer, make sure your domain is added
6. Click **"Save"**

### Solution 3: Verify API is Enabled

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **"APIs & Services" > "Library"**
3. Search for **"Google Sheets API"**
4. Make sure it shows **"Enabled"** (not "Enable")
5. If not enabled, click **"Enable"**

### Solution 4: Use Google Apps Script for Reading (Alternative)

If API key continues to have issues, you can modify the Google Apps Script to also handle reading:

1. Update your Google Apps Script `doGet` function to return CORS headers:

```javascript
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
  const data = sheet.getDataRange().getValues()
  const numbers = data
    .slice(1)
    .map((row) => row[0])
    .filter((n) => n)

  return ContentService.createTextOutput(
    JSON.stringify({
      selectedNumbers: numbers,
    })
  )
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
    })
}
```

2. Then update your app to use the script URL for reading instead of the API key.

### Quick Checklist

- [ ] Google Sheet is shared as "Anyone with the link can view"
- [ ] Google Sheets API is enabled in your project
- [ ] API key has correct restrictions (or no restrictions for testing)
- [ ] Spreadsheet ID is correct (no extra spaces or characters)
- [ ] API key is correct (no extra spaces or characters)
