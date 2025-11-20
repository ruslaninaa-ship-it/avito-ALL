// Simple functions module for continuous automation
const { publishAds } = require('./publish_ads');
const { readSheetData } = require('./sheets');
const { getAvailableCities, loadCityAddresses } = require('./city_addresses');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true';
const DEBUG = process.env.DEBUG === 'true';

/**
 * Load account configurations by scanning the account directory.
 * Each subdirectory becomes an account with its own isolated browser profile.
 *
 * @returns {Array<AccountConfig>} Array of account configuration objects
 */
function loadAccountConfigs() {
    const accountsBaseDir = path.join(__dirname, 'куки для avito_automation kuhni');
    console.log(`[System] Loading account configs from: ${accountsBaseDir}`);

    if (!fs.existsSync(accountsBaseDir)) {
        console.error(`[System] Accounts directory not found: ${accountsBaseDir}`);
        return [];
    }

    const accounts = [];
    const entries = fs.readdirSync(accountsBaseDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const accountDir = path.join(accountsBaseDir, entry.name);

            // Extract email from directory name (format: "email password")
            const email = entry.name.split(' ')[0] || entry.name;

            const account = {
                name: entry.name,
                email: email,
                profileDir: accountDir, // Use entire directory as browser profile
                enabled: true
            };

            accounts.push(account);
        }
    }

    console.log(`[System] Loaded ${accounts.length} account(s)`);
    return accounts;
}

/**
 * Prompt user to select a product type interactively
 * @returns {Promise<string>} The selected product type ('kitchen' or 'curtains')
 */
async function promptProductTypeSelection() {
    const productTypes = [
        { value: 'kitchen', label: 'Кухни' },
        { value: 'curtains', label: 'Шторы' }
    ];

    console.log('Available product types:\n');

    productTypes.forEach((type, index) => {
        console.log(`[System] ${index + 1}. ${type.label}`);
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Enter product type number (1-2): ', (answer) => {
            const selection = parseInt(answer.trim());

            if (isNaN(selection) || selection < 1 || selection > productTypes.length) {
                console.log('Invalid selection. Please enter a number between 1 and ' + productTypes.length);
                rl.close();
                resolve('kitchen'); // Default
            } else {
                const selectedType = productTypes[selection - 1];
                rl.close();
                resolve(selectedType.value);
            }
        });
    });
}

/**
 * Prompt user to select a city interactively
 * @returns {Promise<string>} The selected city name
 */
async function promptCitySelection() {
    const cities = getAvailableCities();

    console.log('Available cities:\n');

    cities.forEach((city, index) => {
        console.log(`${index + 1}. ${city}`);
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Enter city number (1-' + cities.length + '): ', (answer) => {
            const selection = parseInt(answer.trim());

            if (isNaN(selection) || selection < 1 || selection > cities.length) {
                console.log('Invalid selection. Please enter a number between 1 and ' + cities.length);
                rl.close();
                resolve(cities[0]); // Default to first city
            } else {
                const selectedCity = cities[selection - 1];
                rl.close();
                resolve(selectedCity);
            }
        });
    });
}

/**
 * Execute parallel publishing sessions
 * @param {Array<Object>} accounts - Account configurations
 * @param {Array<Object>} ads - Ads to publish
 * @param {Array<string>} cityAddresses - City addresses
 * @param {string} productType - Product type
 * @param {number} batchSize - Batch size
 * @returns {Promise<Object>} Results
 */
async function runPublishingCycle(accounts, ads, cityAddresses, productType, batchSize) {
    // Filter only enabled accounts
    const enabledAccounts = accounts.filter(acc => acc.enabled);
    if (enabledAccounts.length === 0) {
        throw new Error('No enabled accounts found.');
    }

    // Take only the batch size from the ads array
    const batch = ads.slice(0, batchSize);

    const results = [];

    // Simple simulation - publish all ads on all accounts
    for (const account of enabledAccounts) {
        try {
            if (DRY_RUN) {
                results.push({
                    accountName: account.name,
                    totalAds: batch.length,
                    published: batch.length,
                    failed: 0
                });
            } else {
                const result = await publishAds(batch, account.profileDir, account.name, cityAddresses, productType);
                results.push(result);
            }
        } catch (error) {
            results.push({
                accountName: account.name,
                totalAds: batch.length,
                published: 0,
                failed: batch.length
            });
        }
    }

    // Aggregate results
    let totalPublished = 0;
    let totalFailed = 0;

    results.forEach((result) => {
        if (result) {
            totalPublished += result.published;
            totalFailed += result.failed;
        }
    });

    return {
        published: totalPublished,
        failed: totalFailed,
        accountResults: results
    };
}

module.exports = {
    loadAccountConfigs,
    promptCitySelection,
    promptProductTypeSelection,
    runPublishingCycle
};
