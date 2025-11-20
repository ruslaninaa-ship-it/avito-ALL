const fs = require('fs');
const path = require('path');

/**
 * Saves cookies from the Puppeteer page to a JSON file.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance
 * @param {string} cookieFilePath - Absolute path to the cookie file
 * @returns {Promise<void>}
 * @throws {Error} If cookie saving fails or path is invalid
 *
 * @example
 * await saveCookies(page, '/path/to/account1/avito_cookies.json');
 */
async function saveCookies(page, cookieFilePath) {
    try {
        const cookies = await page.cookies();
        fs.writeFileSync(cookieFilePath, JSON.stringify(cookies, null, 2));
        console.log(`Cookies saved to file: ${cookieFilePath}`);
    } catch (error) {
        console.error(`Error saving cookies to ${cookieFilePath}:`, error.message);
        throw error;
    }
}

/**
 * Loads cookies from the JSON file and returns them.
 *
 * @param {string} cookieFilePath - Absolute path to the cookie file
 * @returns {Array<Object>|null} Array of cookie objects or null if file doesn't exist
 * @throws {Error} If cookie loading fails (except file not found)
 *
 * @example
 * const cookies = loadCookies('/path/to/account1/avito_cookies.json');
 * if (cookies) {
 *     await page.setCookie(...cookies);
 * }
 */
function loadCookies(cookieFilePath) {
    try {
        if (fs.existsSync(cookieFilePath)) {
            const cookiesData = fs.readFileSync(cookieFilePath, 'utf8');
            return JSON.parse(cookiesData);
        }
        return null;
    } catch (error) {
        console.error(`Error loading cookies from ${cookieFilePath}:`, error.message);
        return null;
    }
}

module.exports = { saveCookies, loadCookies };