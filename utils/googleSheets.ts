// Google Sheets API client-side integration
// Note: For production, use Google Apps Script as a proxy for security

interface GoogleSheetsConfig {
  spreadsheetId: string
  apiKey?: string
  serviceAccountEmail?: string
  privateKey?: string
}

// Get user IP address
export async function getUserIP(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json")
    const data = await response.json()
    return data.ip || "unknown"
  } catch (error) {
    console.error("Error fetching IP address:", error)
    return "unknown"
  }
}

// Get selected numbers and IP addresses from Google Sheets
export async function getSelectedNumbers(
  config: GoogleSheetsConfig
): Promise<{ numbers: number[]; ipNumbers: Map<string, number> }> {
  try {
    // Using Google Sheets API v4 - get columns A (Number) and E (IP Address)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/Sheet1!A:E?key=${config.apiKey}`

    const response = await fetch(url)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`

      if (response.status === 403) {
        console.error("403 Permission Denied. Common causes:")
        console.error(
          '1. Google Sheet is not shared publicly (needs "Anyone with the link can view")'
        )
        console.error("2. API key restrictions are too strict")
        console.error("3. Google Sheets API is not enabled in your project")
        console.error("Error details:", errorMessage)
      } else {
        console.error("Error fetching selected numbers:", errorMessage)
      }

      throw new Error(`Failed to fetch selected numbers: ${errorMessage}`)
    }

    const data = await response.json()
    const rows = data.values || []

    // Skip header if exists
    const selectedNumbers: number[] = []
    const ipNumbers = new Map<string, number>()

    rows.slice(1).forEach((row: string[]) => {
      const number = Number(row[0])
      const ip = row[4] || "" // IP address is in column E (index 4)

      if (!isNaN(number) && number >= 1 && number <= 100) {
        selectedNumbers.push(number)
        if (ip) {
          ipNumbers.set(ip, number)
        }
      }
    })

    return { numbers: selectedNumbers, ipNumbers }
  } catch (error) {
    console.error("Error fetching selected numbers:", error)
    return { numbers: [], ipNumbers: new Map() }
  }
}

// Save number to Google Sheets via Google Apps Script Web App
// This is the recommended approach for client-side writes
export async function saveNumberToSheet(
  number: number,
  ipAddress: string,
  config: { scriptUrl: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(config.scriptUrl, {
      method: "POST",
      mode: "no-cors", // Google Apps Script doesn't support CORS properly
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "append",
        number,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ipAddress: ipAddress,
      }),
    })

    // With no-cors, we can't read the response, so assume success
    return { success: true }
  } catch (error) {
    console.error("Error saving number:", error)
    return { success: false, error: "Failed to save number" }
  }
}

// Alternative: Direct API call with service account (requires backend proxy in production)
export async function saveNumberDirect(
  number: number,
  config: GoogleSheetsConfig
): Promise<{ success: boolean; error?: string }> {
  // This would require JWT token generation on client-side
  // Not recommended for production - use Google Apps Script instead
  console.warn(
    "Direct API calls with service account should be done server-side"
  )
  return {
    success: false,
    error: "Use Google Apps Script web app for client-side writes",
  }
}
