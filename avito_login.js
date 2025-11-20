const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function retryNavigation(page, url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Attempting navigation to ${url} (attempt ${i + 1}/${retries})`);
            console.log(`Navigation options:`, options);
            const startTime = Date.now();
            await page.goto(url, options);
            const duration = Date.now() - startTime;
            console.log(`Navigation to ${url} successful in ${duration}ms`);
            return;
        } catch (error) {
            console.log(`Navigation to ${url} failed (attempt ${i + 1}/${retries}):`, error.message);
            console.log(`Error details:`, error);
            if (i === retries - 1) throw error;
            console.log(`Retrying navigation to ${url} in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function retryWaitForNavigation(page, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await page.waitForNavigation(options);
            return;
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Wait for navigation failed, retrying... (${i + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

/**
 * Logs into Avito using a persistent browser profile (userDataDir).
 * Each account gets its own isolated browser profile with saved session.
 * Returns a Puppeteer page with active Avito session.
 *
 * @param {string} profileDir - Absolute path to the browser profile directory for this account
 * @param {string} [accountName='DefaultAccount'] - Account name for logging purposes
 * @returns {Promise<{page: import('puppeteer').Page, browser: import('puppeteer').Browser}>}
 *          Object containing authenticated page and browser instance
 * @throws {Error} If browser launch fails or login timeout
 *
 * @example
 * const { page, browser } = await loginToAvito(
 *     '/path/to/account/profile',
 *     'Account1_Liliya'
 * );
 * try {
 *     // Use page for automation
 * } finally {
 *     await browser.close();
 * }
 */
async function loginToAvito(profileDir, accountName = 'DefaultAccount') {
    // Ensure profile directory exists
    if (!fs.existsSync(profileDir)) {
        console.log(`[${accountName}] Creating profile directory: ${profileDir}`);
        fs.mkdirSync(profileDir, { recursive: true });
    }

    // Launch browser with persistent profile - this automatically saves and loads cookies, localStorage, etc.
    console.log(`[${accountName}] Launching browser with persistent profile: ${profileDir}`);
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: profileDir, // Each account gets its own isolated browser profile
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--ignore-certificate-errors',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        ignoreHTTPSErrors: true
    });
    console.log(`[${accountName}] Browser launched successfully with profile`);

    const page = await browser.newPage();
    console.log(`[${accountName}] New page created`);

    // Set default timeouts for better network handling
    page.setDefaultTimeout(120000); // Increased timeout
    page.setDefaultNavigationTimeout(120000); // Increased navigation timeout

    // Stealth: Remove automation indicators
    await page.evaluateOnNewDocument(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Mock languages and plugins
        Object.defineProperty(navigator, 'languages', {
            get: () => ['ru-RU', 'ru'],
        });

        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });
    });

    // Add network request/response logging (reduced verbosity)
    page.on('request', request => {
        if (request.url().includes('avito.ru')) {
            console.log(`[${accountName}] Request: ${request.method()} ${request.url()}`);
        }
    });
    page.on('response', response => {
        if (response.url().includes('avito.ru')) {
            console.log(`[${accountName}] Response: ${response.status()} ${response.url()}`);
        }
    });
    page.on('requestfailed', request => {
        if (request.url().includes('avito.ru')) {
            console.log(`[${accountName}] Request failed: ${request.method()} ${request.url()} - ${request.failure().errorText}`);
        }
    });

    // Navigate to Avito to check if session exists in the persistent profile
    console.log(`[${accountName}] Checking if session exists in browser profile...`);
    await retryNavigation(page, 'https://www.avito.ru', { waitUntil: 'domcontentloaded', timeout: 120000 });

    // Check if already logged in from previous session
    console.log(`[${accountName}] Checking login status...`);
    const currentUrl = await page.url();
    console.log(`[${accountName}] Current URL: ${currentUrl}`);
    const isLoggedIn = await page.$('a[href*="/profile"]') !== null ||
                      await page.$('.profile-link') !== null ||
                      currentUrl.includes('/profile') ||
                      await page.$('[data-marker="header/user-menu"]') !== null ||
                      await page.$('.header-user-menu') !== null;
    console.log(`[${accountName}] Login status check result: ${isLoggedIn}`);

    if (isLoggedIn) {
        console.log(`[${accountName}] ✅ Session restored from browser profile - already logged in!`);
        return { page, browser };
    }

    console.log(`[${accountName}] ⚠️ No active session found in profile - need to log in`);

    // Navigate to Avito login page with retry logic
    console.log(`[${accountName}] Navigating to login page...`);
    await retryNavigation(page, 'https://www.avito.ru/profile/login', { waitUntil: 'domcontentloaded', timeout: 120000 });

    console.log(`[${accountName}] Please log in manually in the browser window. The script will detect when login is complete.`);

    // Wait for manual login by periodically checking if logged in
    const maxWaitTime = 300000; // 5 minutes
    const checkInterval = 5000; // 5 seconds
    let elapsedTime = 0;

    while (elapsedTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsedTime += checkInterval;

        // Check if login was successful by looking for profile elements or URL
        console.log(`[${accountName}] Checking login status at ${Math.floor(elapsedTime / 1000)}s elapsed...`);
        const currentUrl = await page.url();
        console.log(`[${accountName}] Current URL during login check: ${currentUrl}`);
        const isLoggedIn = await page.$('a[href*="/profile"]') !== null ||
                          await page.$('.profile-link') !== null ||
                          currentUrl.includes('/profile') ||
                          await page.$('[data-marker="header/user-menu"]') !== null || // Additional selector for user menu
                          await page.$('.header-user-menu') !== null; // Another possible selector
        console.log(`[${accountName}] Login check result: ${isLoggedIn}`);

        if (isLoggedIn) {
            console.log(`[${accountName}] ✅ Login detected! Session automatically saved in browser profile.`);
            console.log(`[${accountName}] Future runs will use this session automatically - no re-login needed!`);
            break;
        }

        console.log(`[${accountName}] Waiting for login... (${Math.floor(elapsedTime / 1000)}s elapsed)`);
    }

    if (elapsedTime >= maxWaitTime) {
        console.log(`[${accountName}] ⚠️ Login timeout reached. If you logged in, the session is still saved in browser profile.`);
    }

    return { page, browser };
}

module.exports = loginToAvito;