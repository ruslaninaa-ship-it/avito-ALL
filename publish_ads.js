const loginToAvito = require('./avito_login');
const { readSheetData, processPhotoUrls, updateAdStatus, clearAllAdStatuses } = require('./sheets');
const { getProductConfig, getRandomCondition, getRandomSaleType, getPriceUnit } = require('./product_configs');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Helper function to download a file from URL
async function downloadFile(url, filepath) {
    console.log(`Starting download from ${url} to ${filepath}`);
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            console.log(`Download response status: ${response.statusCode}`);
            if (response.statusCode !== 200) {
                fs.unlink(filepath, () => {});
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Download completed: ${filepath}`);
                resolve();
            });
        }).on('error', (err) => {
            console.error(`Download error for ${url}:`, err.message);
            fs.unlink(filepath, () => {}); // Delete the file on error
            reject(err);
        });
    });
}

/**
 * Generate MD5 hash for a given string
 * @param {string} str - String to hash
 * @returns {string} MD5 hash
 */
function generateHash(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Get the cache directory path for a given ad (based on photo URLs)
 * @param {Array<string>} photoUrls - Array of photo URLs
 * @returns {string} Path to the cache directory
 */
function getPhotoCache(photoUrls) {
    // Create a unique identifier based on the first photo URL
    const cacheKey = photoUrls.length > 0 ? photoUrls[0] : 'no-photos';
    const hash = generateHash(cacheKey);
    const cacheDir = path.join(__dirname, 'ad_photos', hash);
    return cacheDir;
}

/**
 * Check if a cached photo exists
 * @param {string} cacheDir - Cache directory path
 * @param {number} photoIndex - Index of the photo
 * @returns {boolean} True if cached photo exists
 */
function cachePhotoExists(cacheDir, photoIndex) {
    const filepath = path.join(cacheDir, `photo_${photoIndex}.jpg`);
    return fs.existsSync(filepath);
}

/**
 * Get all cached photo paths for a given cache directory
 * @param {string} cacheDir - Cache directory path
 * @param {number} photoCount - Number of photos expected
 * @returns {Array<string>|null} Array of cached photo paths or null if not all cached
 */
function getCachedPhotoPaths(cacheDir, photoCount) {
    const cachedPaths = [];
    for (let i = 0; i < photoCount; i++) {
        const filepath = path.join(cacheDir, `photo_${i}.jpg`);
        if (!fs.existsSync(filepath)) {
            return null; // Not all photos are cached
        }
        cachedPaths.push(filepath);
    }
    return cachedPaths;
}

// Helper function to upload photos sequentially
async function uploadPhotos(page, photoUrls) {
    console.log(`Starting photo upload process for ${photoUrls.length} photos`);
    
    // Get cache directory for these photos
    const cacheDir = getPhotoCache(photoUrls);
    console.log(`Cache directory: ${cacheDir}`);
    
    // Check if all photos are already cached
    const cachedPaths = getCachedPhotoPaths(cacheDir, photoUrls.length);
    let downloadedFiles = [];
    
    try {
        if (cachedPaths) {
            // Use cached photos
            console.log(`✓ Found ${cachedPaths.length} cached photos, using cache instead of downloading`);
            downloadedFiles = cachedPaths;
        } else {
            // Photos not cached, need to download
            console.log('Photos not in cache, downloading...');
            
            // Ensure cache directory exists
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
                console.log(`Created cache directory: ${cacheDir}`);
            }
            
            // Download all photos to cache
            for (let i = 0; i < photoUrls.length; i++) {
                const url = photoUrls[i];
                const filename = `photo_${i}.jpg`;
                const filepath = path.join(cacheDir, filename);
                console.log(`Downloading photo ${i + 1}/${photoUrls.length} from ${url} to ${filepath}`);
                await downloadFile(url, filepath);
                downloadedFiles.push(filepath);
                console.log(`Downloaded and cached ${downloadedFiles.length} photos so far`);
            }
            console.log(`✓ All ${downloadedFiles.length} photos downloaded and cached successfully`);
        }

        // Upload photos sequentially to Avito
        console.log('Starting photo upload to Avito...');
        for (let i = 0; i < downloadedFiles.length; i++) {
            const filepath = downloadedFiles[i];
            console.log(`Uploading photo ${i + 1}/${downloadedFiles.length}: ${filepath}`);

            // Check if file exists before upload
            if (!fs.existsSync(filepath)) {
                throw new Error(`Photo file not found: ${filepath}`);
            }

            // Click the add photo button (label with data-marker="add")
            console.log('Clicking add photo button...');
            await page.click('label[data-marker="add"]');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Wait for and find the file input
            const inputSelector = 'input[type="file"]';
            console.log('Waiting for file input selector...');
            await page.waitForSelector(inputSelector, { timeout: 5000 });
            const fileInput = await page.$(inputSelector);
            if (fileInput) {
                console.log(`Uploading file to input: ${filepath}`);
                await fileInput.uploadFile(filepath);
                console.log(`Successfully uploaded ${filepath}`);
                // Wait for upload to process
                console.log('Waiting for upload to process...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                throw new Error('File input not found after clicking add button');
            }
        }
        console.log(`✓ All ${downloadedFiles.length} photos uploaded successfully to Avito`);
    } catch (error) {
        console.error('Error uploading photos:', error);
        throw error;
    }
    // Note: Photos are kept permanently in cache, no cleanup
    console.log(`Photos kept in cache at: ${cacheDir}`);
}

/**
 * Count the number of active ads for the account
 * @param {Object} page - Puppeteer page object
 * @param {string} accountName - Account identifier for logging
 * @returns {Promise<number>} Number of active ads
 */
async function countActiveAds(page, accountName) {
    try {
        console.log(`[${accountName}] Navigating to profile items page to count active ads...`);
        
        // Navigate to the user's active ads page
        await page.goto('https://www.avito.ru/profile/items', { waitUntil: 'networkidle2', timeout: 30000 });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Count active ads from the counter element
        const adCount = await page.evaluate(() => {
            // Try to find the counter element with exact class
            const counterSpan = document.querySelector('.styles-module-counter-prLgf.styles-module-counter_size-l-drhmu');
            if (counterSpan) {
                const count = parseInt(counterSpan.textContent.trim());
                console.log(`Found ${count} ads using counter span`);
                return isNaN(count) ? 0 : count;
            }
            
            // Fallback: try just the first class
            const counterAlt = document.querySelector('.styles-module-counter-prLgf');
            if (counterAlt) {
                const count = parseInt(counterAlt.textContent.trim());
                console.log(`Found ${count} ads using alternative counter`);
                return isNaN(count) ? 0 : count;
            }
            
            // Fallback: try data-marker attribute
            const counterMarker = document.querySelector('[data-marker*="counter"]');
            if (counterMarker) {
                const count = parseInt(counterMarker.textContent.trim());
                console.log(`Found ${count} ads using data-marker`);
                return isNaN(count) ? 0 : count;
            }
            
            console.log('No counter found, returning 0');
            return 0;
        });
        
        console.log(`[${accountName}] ✓ Found ${adCount} active ads`);
        return adCount;
        
    } catch (error) {
        console.error(`[${accountName}] Error counting active ads:`, error.message);
        return 0;
    }
}

/**
 * Delete all active ads for the account
 * @param {Object} page - Puppeteer page object
 * @param {string} accountName - Account identifier for logging
 * @param {string} productType - Product type ('kitchen' or 'curtains')
 * @returns {Promise<number>} Number of ads deleted
 */
async function deleteAllAds(page, accountName, productType = 'kitchen') {
    let deletedCount = 0;
    
    try {
        console.log(`[${accountName}] Starting ad deletion process...`);
        
        // First, count how many ads we have
        const totalAds = await countActiveAds(page, accountName);
        
        if (totalAds === 0) {
            console.log(`[${accountName}] No active ads to delete`);
            return 0;
        }
        
        // Safety check - don't delete if less than 45 ads
        if (totalAds < 45) {
            console.log(`[${accountName}] ⚠️ Safety check: Only ${totalAds} ads found (less than 45). Skipping deletion.`);
            return 0;
        }
        
        console.log(`[${accountName}] Found ${totalAds} ads. Starting bulk deletion process...`);
        
        // Navigate to profile items page
        await page.goto('https://www.avito.ru/profile/items', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 1: Click "Select All" checkbox
        console.log(`[${accountName}] Clicking 'Select All' checkbox...`);
        try {
            const selectAllClicked = await page.evaluate(() => {
                // Try to find the select all checkbox
                const selectAllDiv = document.querySelector('.css-1s1m1fg');
                if (selectAllDiv) {
                    selectAllDiv.click();
                    return true;
                }
                
                // Fallback: try to find any checkbox-like element
                const checkboxes = document.querySelectorAll('[type="checkbox"]');
                if (checkboxes.length > 0) {
                    checkboxes[0].click();
                    return true;
                }
                
                return false;
            });
            
            if (selectAllClicked) {
                console.log(`[${accountName}] ✓ Clicked 'Select All'`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log(`[${accountName}] ⚠️ Could not find 'Select All' checkbox`);
            }
        } catch (selectError) {
            console.log(`[${accountName}] Error clicking 'Select All':`, selectError.message);
        }
        
        // Step 2: Click "Unpublish" button
        console.log(`[${accountName}] Clicking 'Unpublish' button...`);
        try {
            await page.waitForSelector('[data-marker="unpublish-action"]', { timeout: 5000 });
            await page.click('[data-marker="unpublish-action"]');
            console.log(`[${accountName}] ✓ Clicked 'Unpublish' button`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (unpublishError) {
            console.log(`[${accountName}] Error clicking unpublish button:`, unpublishError.message);
            throw new Error('Could not click unpublish button');
        }
        
        // Step 3: Click the radio button/toggle
        console.log(`[${accountName}] Selecting unpublish reason...`);
        try {
            const radioClicked = await page.evaluate(() => {
                // Try the specific class
                const radioToggle = document.querySelector('.styles-module-toggle-VncHl.styles-module-toggle_mode_radio-FAy_H');
                if (radioToggle) {
                    radioToggle.click();
                    return true;
                }
                
                // Fallback: try any radio-like toggle
                const radioAlt = document.querySelector('.styles-module-toggle_mode_radio-FAy_H');
                if (radioAlt) {
                    radioAlt.click();
                    return true;
                }
                
                // Fallback: try finding by radio input
                const radioInput = document.querySelector('input[type="radio"]');
                if (radioInput) {
                    radioInput.click();
                    return true;
                }
                
                return false;
            });
            
            if (radioClicked) {
                console.log(`[${accountName}] ✓ Selected reason`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log(`[${accountName}] ⚠️ Could not find reason radio button (might not be required)`);
            }
        } catch (radioError) {
            console.log(`[${accountName}] Radio selection error (might not be required):`, radioError.message);
        }
        
        // Step 4: Click confirm "Unpublish" button
        console.log(`[${accountName}] Clicking confirm 'Unpublish' button...`);
        try {
            await page.waitForSelector('[data-marker="save-reason"]', { timeout: 5000 });
            await page.click('[data-marker="save-reason"]');
            console.log(`[${accountName}] ✓ Clicked confirm button`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (confirmError) {
            console.log(`[${accountName}] Error clicking confirm button:`, confirmError.message);
            throw new Error('Could not click confirm button');
        }
        
        // Wait for the action to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if deletion was successful by counting again
        const remainingAds = await countActiveAds(page, accountName);
        deletedCount = totalAds - remainingAds;
        
        console.log(`[${accountName}] ✓ Bulk deletion complete. Deleted ${deletedCount} ads (${remainingAds} remaining)`);
        
        // Clear all ad statuses in Google Sheets after deletion
        if (deletedCount > 0) {
            console.log(`[${accountName}] Clearing all ad statuses in Google Sheets...`);
            await clearAllAdStatuses(productType);
        }
        
        return deletedCount;
        
    } catch (error) {
        console.error(`[${accountName}] Critical error during ad deletion:`, error.message);
        return deletedCount;
    }
}

/**
 * Get a random curtain type for curtains/shades category
 * @returns {Object} Object with name and value of randomly selected curtain type
 */
function getRandomCurtainType() {
    const curtainTypes = [
        { name: 'Шторы', value: '3285870' },
        { name: 'Портьеры', value: '3285871' },
        { name: 'Гардины', value: '3285872' },
        { name: 'Тюль', value: '3285873' },
        { name: 'Жалюзи', value: '3285874' },
        { name: 'Римские шторы', value: '3285875' },
        { name: 'Рулонные шторы', value: '3285876' },
        { name: 'Ламбрекен', value: '3285877' },
        { name: 'Комплект', value: '3285878' },
        { name: 'Карниз', value: '3285879' },
        { name: 'Аксессуары', value: '3285880' }
    ];

    const randomIndex = Math.floor(Math.random() * curtainTypes.length);
    return curtainTypes[randomIndex];
}

/**
 * Publishes a subset of ads using the specified account with persistent browser profile.
 *
 * @param {Array<Object>} adsData - Array of ad objects to publish
 * @param {string} profileDir - Absolute path to the browser profile directory
 * @param {string} accountName - Account identifier for logging
 * @param {Array<string>} cityAddresses - Array of addresses for the selected city
 * @param {string} [productType='kitchen'] - Product type ('kitchen' or 'curtains') determining category and logic
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.retryLimit=2] - Number of retry attempts per ad
 * @param {number} [options.delayBetweenAds=5000] - Delay between ads in ms
 * @returns {Promise<{accountName: string, totalAds: number, published: number, failed: number}>} Summary of the publishing session
 * @throws {Error} If login fails or critical error occurs
 *
 * @example
 * const results = await publishAds(
 *     [ad1, ad2, ad3],
 *     '/path/to/account/profile',
 *     'Account1_Liliya',
 *     cityAddresses,
 *     'kitchen',
 *     { retryLimit: 3, delayBetweenAds: 3000 }
 * );
 * console.log(`Published ${results.published}/${results.totalAds} ads`);
 */
async function publishAds(adsData, profileDir, accountName, cityAddresses, productType = 'kitchen', options = {}) {
    const { retryLimit = 2, delayBetweenAds = 10000 } = options;
    let browser = null;
    let successCount = 0;
    let failedCount = 0;

    try {
        // Login to Avito with persistent browser profile and get the page and browser
        console.log(`[${accountName}] Logging into Avito with browser profile...`);
        const loginResult = await loginToAvito(profileDir, accountName);
        const page = loginResult.page;
        browser = loginResult.browser;
        
        // Check active ad count at the start
        const activeAdCount = await countActiveAds(page, accountName);
        
        if (activeAdCount > 45) {
            console.log(`[${accountName}] ⚠️ WARNING: Found ${activeAdCount} active ads (more than 45).`);
            console.log(`[${accountName}] You should delete all ads before publishing new ones.`);
            console.log(`[${accountName}] Use the deleteAllAds function to clean up ads.`);
            // Note: Not calling deleteAllAds automatically - user will control this separately
        }

        if (adsData.length === 0) {
            console.log(`[${accountName}] No ads to publish.`);
            return { accountName, totalAds: 0, published: 0, failed: 0 };
        }

        console.log(`[${accountName}] Found ${adsData.length} ads to publish.`);
        console.log(`[${accountName}] Using ${cityAddresses.length} addresses from city database.`);

        // Process each ad
        for (let i = 0; i < adsData.length; i++) {
            const ad = adsData[i];
            try {
                console.log(`[${accountName}] Publishing ad ${i + 1}/${adsData.length}: ${ad.title || 'Untitled'}`);

                // Navigate to the add item page with retry logic
                try {
                    await page.goto('https://www.avito.ru/additem', { waitUntil: 'networkidle2', timeout: 30000 });
                    console.log(`[${accountName}] Navigated to additem page`);
                } catch (navError) {
                    console.log(`[${accountName}] Navigation failed, trying alternative approach`);
                    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
                    await page.goto('https://www.avito.ru/additem', { waitUntil: 'networkidle2', timeout: 30000 });
                    console.log(`[${accountName}] Reloaded and navigated to additem page`);
                }

                // Wait for the category selection page to load
                await page.waitForSelector('button[data-marker="category-wizard/button"]', { timeout: 10000 });
                console.log(`[${accountName}] Category selection page loaded`);
                await new Promise(resolve => setTimeout(resolve, 10000)); // Added delay after page load

                // Select category based on product type
                const categoryName = productType === 'kitchen' ? 'Личные вещи' : 'Для дома и дачи';
                const categoryClicked = await page.evaluate((catName) => {
                    const buttons = Array.from(document.querySelectorAll('button[data-marker="category-wizard/button"]'));
                    const targetButton = buttons.find(button => {
                        const labelDiv = button.querySelector('div[data-marker="category-wizard/button"]');
                        return labelDiv && labelDiv.textContent.trim() === catName;
                    });
                    if (targetButton) {
                        targetButton.click();
                        return true;
                    }
                    return false;
                }, categoryName);
                if (categoryClicked) {
                    console.log(`[${accountName}] Selected category: ${categoryName}`);
                } else {
                    console.log(`[${accountName}] Could not find category button for "${categoryName}"`);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
                await new Promise(resolve => setTimeout(resolve, 10000)); // Added delay before next action

                // Wait for the title input to load
                await page.waitForSelector('input[data-marker="title-field-23/input"]', { timeout: 10000 });
                console.log(`[${accountName}] Title input loaded`);

                // Fill in the title
                if (ad.title) {
                    await page.type('input[data-marker="title-field-23/input"]', ad.title);
                    console.log(`[${accountName}] Title filled: ${ad.title}`);
                }
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Click the category title button after title entry
                try {
                    await page.waitForSelector('button[data-marker="category-title"]', { timeout: 10000 });
                    await page.click('button[data-marker="category-title"]');
                    console.log(`[${accountName}] Clicked category title button`);
                } catch (error) {
                    console.log(`[${accountName}] Category title button not found within timeout:`, error.message);
                }

                // Dismiss popup banner and select sale type
                try {
                    // Dismiss popup banner
                    const closeSelectors = ['.popup-close', '.modal-close', '.banner-close', '[data-marker*="close"]'];
                    let dismissed = false;
                    for (const selector of closeSelectors) {
                        try {
                            await page.waitForSelector(selector, { timeout: 2000 });
                            await page.click(selector);
                            console.log(`[${accountName}] Dismissed banner with selector: ${selector}`);
                            dismissed = true;
                            break;
                        } catch (e) {
                            // continue
                        }
                    }
                    if (!dismissed) {
                        await page.click('body');
                        console.log(`[${accountName}] Clicked on body to dismiss banner`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (dismissError) {
                    console.log(`[${accountName}] Error dismissing banner:`, dismissError.message);
                }

                try {
                    // Randomly select sale type
                    const saleTypes = ['Товар произведён мной', 'Товар произведён мной', 'Товар куплен на продажу'];
                    const randomIndex = Math.floor(Math.random() * saleTypes.length);
                    const selectedType = saleTypes[randomIndex];
                    console.log(`[${accountName}] Randomly selected sale type: ${selectedType}`);

                    const clicked = await page.evaluate((type) => {
                        const labels = Array.from(document.querySelectorAll('label, span, div'));
                        const option = labels.find(el => el.textContent.trim() === type);
                        if (option) {
                            const input = option.querySelector('input[type="radio"]') || option.closest('label')?.querySelector('input');
                            if (input) {
                                input.click();
                                return true;
                            } else {
                                option.click();
                                return true;
                            }
                        }
                        return false;
                    }, selectedType);

                    if (clicked) {
                        console.log(`[${accountName}] Clicked sale type: ${selectedType}`);
                    } else {
                        console.log(`[${accountName}] Could not find sale type: ${selectedType}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (selectError) {
                    console.log(`[${accountName}] Error selecting sale type:`, selectError.message);
                }

                try {
                    const condition = ad.parameters === "Новое" ? "Новое" : "Новое";
                    console.log(`[${accountName}] Selecting condition: ${condition}`);

                    const clicked = await page.evaluate((cond) => {
                        const labels = Array.from(document.querySelectorAll('label, span, div'));
                        const option = labels.find(el => el.textContent.trim() === cond);
                        if (option) {
                            const input = option.querySelector('input[type="radio"]') || option.closest('label')?.querySelector('input');
                            if (input) {
                                input.click();
                                return true;
                            } else {
                                option.click();
                                return true;
                            }
                        }
                        return false;
                    }, condition);

                    if (clicked) {
                        console.log(`[${accountName}] Clicked condition: ${condition}`);
                    } else {
                        console.log(`[${accountName}] Could not find condition: ${condition}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (selectError) {
                    console.log(`[${accountName}] Error selecting condition:`, selectError.message);
                }

                try {
                    console.log(`[${accountName}] ad.parameters:`, ad.parameters);
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    console.log(`[${accountName}] parsedParams:`, parsedParams);
                    const kitchenType = parsedParams["Тип кухни"];
                    console.log(`[${accountName}] kitchenType from sheet:`, kitchenType);
                    if (kitchenType) {
                        let optionText;
                        if (kitchenType === "Готовая") {
                            optionText = "Готовая";
                        } else if (kitchenType === "На заказ") {
                            optionText = "На заказ";
                        } else if (kitchenType === "Модульная") {
                            optionText = "Модульная";
                        }
                        if (optionText) {
                            console.log(`Selecting kitchen type: ${optionText}`);
                            const clicked = await page.evaluate((text) => {
                                const spans = Array.from(document.querySelectorAll('span'));
                                const option = spans.find(span => span.textContent.trim() === text);
                                if (option) {
                                    option.click();
                                    return true;
                                }
                                return false;
                            }, optionText);
                            if (clicked) {
                                console.log(`Clicked kitchen type: ${optionText}`);
                            } else {
                                console.log(`Could not find kitchen type: ${optionText}`);
                            }
                        } else {
                            console.log(`No matching optionText for kitchenType: ${kitchenType}`);
                        }
                    } else {
                        console.log('No kitchenType found in parameters');
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (selectError) {
                    console.log('Error selecting kitchen type:', selectError.message);
                }

                // Upload photos after kitchen type selection
                try {
                    const photoUrls = processPhotoUrls([ad])[0]; // Process photos for this ad
                    if (photoUrls && photoUrls.length > 0) {
                        console.log(`Uploading ${photoUrls.length} photos for ad: ${ad.title || 'Untitled'}`);
                        await uploadPhotos(page, photoUrls);
                        console.log('Photo upload completed');
                    } else {
                        console.log('No photos to upload for this ad');
                    }
                } catch (photoError) {
                    console.error('Error uploading photos:', photoError.message);
                    // Continue with ad publishing even if photo upload fails
                }

                // Randomly select curtain type for curtain ads
                if (productType === 'curtains') {
                    try {
                        const curtainType = getRandomCurtainType();
                        console.log(`[${accountName}] Randomly selected curtain type: ${curtainType.name} (value: ${curtainType.value})`);

                        // Click on the curtain type dropdown button
                        await page.click('div[data-marker="tip_shtor"]');
                        console.log(`[${accountName}] Clicked curtain type dropdown button`);
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // Select the random curtain type option
                        const curtainClicked = await page.evaluate((curtainVal) => {
                            const buttons = Array.from(document.querySelectorAll(`button[data-marker*="tip_shtor/custom-option"]`));
                            const target = buttons.find(btn => btn.getAttribute('data-marker') === `tip_shtor/custom-option(${curtainVal})`);
                            if (target) {
                                target.click();
                                return true;
                            }
                            return false;
                        }, curtainType.value);

                        if (curtainClicked) {
                            console.log(`[${accountName}] ✓ Selected curtain type: ${curtainType.name}`);
                        } else {
                            console.log(`[${accountName}] ⚠️ Could not find curtain type option: ${curtainType.name}`);
                        }

                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (curtainError) {
                        console.log(`[${accountName}] Error selecting curtain type:`, curtainError.message);
                    }
                }

                try {
                    // Randomly select facade surface
                    const facadeOptions = ['Матовая', 'Глянцевая'];
                    const randomIndex = Math.floor(Math.random() * facadeOptions.length);
                    const selectedFacade = facadeOptions[randomIndex];
                    console.log(`Randomly selected facade surface: ${selectedFacade}`);

                    const clicked = await page.evaluate((type) => {
                        const wrappers = Array.from(document.querySelectorAll('.style-module-wrapper-sPHZh.style-module-wrapper_variant_default-ljiuF'));
                        const target = wrappers.find(wrapper => {
                            const textEl = wrapper.querySelector('.style-module-text-QIi2P.style-module-text_size_l-JNfeb');
                            return textEl && textEl.textContent.trim() === type;
                        });
                        if (target) {
                            target.click();
                            return true;
                        }
                        return false;
                    }, selectedFacade);

                    if (clicked) {
                        console.log(`Clicked facade surface: ${selectedFacade}`);
                    } else {
                        console.log(`Could not find facade surface: ${selectedFacade}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (facadeError) {
                    console.log('Error selecting facade surface:', facadeError.message);
                }

                try {
                    // Click on the material search input
                    await page.click('input[data-marker="material_fasada/search-input"]');
                    console.log('Clicked facade material search input');
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Retrieve facade material data from parameters
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    let facadeMaterials = parsedParams["Материал фасада"];
                    if (!facadeMaterials) {
                        console.log('No facade material found in parameters');
                    } else {
                        // Handle multiple materials
                        if (typeof facadeMaterials === 'string') {
                            facadeMaterials = facadeMaterials.split(',').map(m => m.trim());
                        } else if (Array.isArray(facadeMaterials)) {
                            // already array
                        } else {
                            facadeMaterials = [facadeMaterials.toString()];
                        }

                        // Select matching options
                        for (const material of facadeMaterials) {
                            console.log(`Selecting facade material: ${material}`);
                            const clicked = await page.evaluate((mat) => {
                                const buttons = Array.from(document.querySelectorAll('button[data-marker*="material_fasada/custom-option"]'));
                                const target = buttons.find(btn => btn.textContent.trim() === mat);
                                if (target) {
                                    target.click();
                                    return true;
                                }
                                return false;
                            }, material);

                            if (clicked) {
                                console.log(`Clicked facade material: ${material}`);
                            } else {
                                console.log(`Could not find facade material: ${material}`);
                            }

                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                } catch (materialError) {
                    console.log('Error selecting facade material:', materialError.message);
                }

                try {
                    // Click on the color dropdown button
                    await page.click('div[data-marker="osnovnoy_cvet"]');
                    console.log('Clicked facade color dropdown button');
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Retrieve facade color data from parameters
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    let facadeColors = parsedParams["Цвет фасада"];
                    if (!facadeColors) {
                        console.log('No facade color found in parameters');
                    } else {
                        // Handle multiple colors
                        if (typeof facadeColors === 'string') {
                            facadeColors = facadeColors.split(',').map(c => c.trim());
                        } else if (Array.isArray(facadeColors)) {
                            // already array
                        } else {
                            facadeColors = [facadeColors.toString()];
                        }

                        // List of available color options
                        const colorOptions = [
                            'Белый', 'Бежевый', 'Коричневый', 'Чёрный', 'Серый', 'Золотой', 'Серебристый',
                            'Зелёный', 'Синий', 'Оранжевый', 'Красный', 'Розовый', 'Жёлтый', 'Бирюзовый',
                            'Бордовый', 'Голубой', 'Фиолетовый', 'Разноцветный', 'Прозрачный', 'Другой'
                        ];

                        // Select matching options
                        for (const color of facadeColors) {
                            console.log(`Selecting facade color: ${color}`);
                            const clicked = await page.evaluate((col) => {
                                const buttons = Array.from(document.querySelectorAll('button[data-marker*="osnovnoy_cvet/custom-option"]'));
                                const target = buttons.find(btn => btn.textContent.trim() === col);
                                if (target) {
                                    target.click();
                                    return true;
                                }
                                return false;
                            }, color);

                            if (clicked) {
                                console.log(`Clicked facade color: ${color}`);
                            } else {
                                console.log(`Could not find facade color: ${color}`);
                            }

                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                } catch (colorError) {
                    console.log('Error selecting facade color:', colorError.message);
                }

                // Select столешница в комплекте
                try {
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    const countertopsIncluded = parsedParams["Столешница в комплекте"];
                    if (countertopsIncluded && (countertopsIncluded === "Есть" || countertopsIncluded === "Нет")) {
                        console.log(`Selecting столешница в комплекте: ${countertopsIncluded}`);
                        const clicked = await page.evaluate((value) => {
                            const spans = Array.from(document.querySelectorAll('span'));
                            const option = spans.find(span => span.textContent.trim() === value);
                            if (option) {
                                option.click();
                                return true;
                            }
                            return false;
                        }, countertopsIncluded);

                        if (clicked) {
                            console.log(`Clicked столешница в комплекте: ${countertopsIncluded}`);
                        } else {
                            console.log(`Could not find столешница в комплекте: ${countertopsIncluded}`);
                        }

                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        console.log('No valid столешница в комплекте parameter found');
                    }
                } catch (error) {
                    console.log('Error selecting столешница в комплекте:', error.message);
                }

                // Select countertop material if included
                try {
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    const countertopsIncluded = parsedParams["Столешница в комплекте"];
                    if (countertopsIncluded === "Есть") {
                        let countertopMaterials = parsedParams["Материал столешницы"];
                        if (countertopMaterials) {
                            // Handle multiple materials
                            if (typeof countertopMaterials === 'string') {
                                countertopMaterials = countertopMaterials.split(',').map(m => m.trim());
                            } else if (Array.isArray(countertopMaterials)) {
                                // already array
                            } else {
                                countertopMaterials = [countertopMaterials.toString()];
                            }

                            // Click on the material dropdown button
                            await page.click('div[data-marker="material_stoleshnicy_kuhny"]');
                            console.log('Clicked countertop material dropdown button');
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            // Select matching options
                            for (const material of countertopMaterials) {
                                console.log(`Selecting countertop material: ${material}`);
                                const clicked = await page.evaluate((mat) => {
                                    const buttons = Array.from(document.querySelectorAll('button[data-marker*="material_stoleshnicy_kuhny/custom-option"]'));
                                    const target = buttons.find(btn => btn.textContent.trim() === mat);
                                    if (target) {
                                        target.click();
                                        return true;
                                    }
                                    return false;
                                }, material);

                                if (clicked) {
                                    console.log(`Clicked countertop material: ${material}`);
                                } else {
                                    console.log(`Could not find countertop material: ${material}`);
                                }

                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } else {
                            console.log('No countertop material found in parameters');
                        }
                    }
                } catch (error) {
                    console.log('Error selecting countertop material:', error.message);
                }

                // Select kitchen shape
                try {
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    const kitchenShape = parsedParams["Форма кухни"];
                    if (kitchenShape) {
                        let optionText;
                        if (kitchenShape === "1" || kitchenShape === "Прямая") {
                            optionText = "Прямая";
                        } else if (kitchenShape === "2" || kitchenShape === "Угловая") {
                            optionText = "Угловая";
                        } else if (kitchenShape === "3" || kitchenShape === "П-образная") {
                            optionText = "П-образная";
                        } else if (kitchenShape === "4" || kitchenShape === "Другая") {
                            optionText = "Другая";
                        }
                        if (optionText) {
                            console.log(`Selecting kitchen shape: ${optionText}`);
                            const clicked = await page.evaluate((text) => {
                                const spans = Array.from(document.querySelectorAll('span'));
                                const option = spans.find(span => span.textContent.trim() === text);
                                if (option) {
                                    option.click();
                                    return true;
                                }
                                return false;
                            }, optionText);
                            if (clicked) {
                                console.log(`Clicked kitchen shape: ${optionText}`);
                            } else {
                                console.log(`Could not find kitchen shape: ${optionText}`);
                            }
                        } else {
                            console.log(`No matching optionText for kitchenShape: ${kitchenShape}`);
                        }
                    } else {
                        console.log('No kitchenShape found in parameters');
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (selectError) {
                    console.log('Error selecting kitchen shape:', selectError.message);
                }

                try {
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    const width = parsedParams["Ширина"];
                    const height = parsedParams["Высота"];
                    const depth = parsedParams["Глубина нижних шкафов"];

                    // Fall back to random generation if dimension not found or invalid
                    const sanitizedWidth = typeof width === 'string' ? parseInt(width) : width;
                    const sanitizedHeight = typeof height === 'string' ? parseInt(height) : height;
                    const sanitizedDepth = typeof depth === 'string' ? parseInt(depth) : depth;

                    const dimensionsMap = {
                        "Ширина": sanitizedWidth,
                        "Высота": sanitizedHeight,
                        "Глубина нижних шкафов": sanitizedDepth
                    };

                    console.log(`Filling dimensions:`);
                    Object.entries(dimensionsMap).forEach(([label, value]) => {
                        if (value || value === 0) {
                            console.log(`${label}: ${value.toString()}cm`);
                        } else {
                            const rand = Math.floor(Math.random() * (500 - 150 + 1)) + 150;
                            console.log(`${label}: ${rand.toString()}cm`);
                            dimensionsMap[label] = rand;
                        }
                    });

                    // Fill width with simulated typing
                    const widthStr = dimensionsMap["Ширина"].toString();
                    await page.focus('#params\\[170053\\]');
                    for (const digit of widthStr) {
                        await page.keyboard.type(digit);
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
                    }
                    console.log('Width filled');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Fill height with simulated typing
                    const heightStr = dimensionsMap["Высота"].toString();
                    await page.focus('#params\\[170057\\]');
                    for (const digit of heightStr) {
                        await page.keyboard.type(digit);
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
                    }
                    console.log('Height filled');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Fill depth with simulated typing
                    const depthStr = dimensionsMap["Глубина нижних шкафов"].toString();
                    await page.focus('#params\\[170055\\]');
                    for (const digit of depthStr) {
                        await page.keyboard.type(digit);
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
                    }
                    console.log('Depth filled');
                } catch (error) {
                    console.log('Error filling dimensions:', error.message);
                }

                try {
                    const kitchenEquipmentOptions = ["Шкаф под мойку", "Шкаф под духовку", "Шкаф с ящиками", "Пенал", "Навесные шкафы", "Навесной шкаф под вытяжку", "Сушилка для посуды", "Мойка"];
                    for (const equipment of kitchenEquipmentOptions) {
                        console.log(`Selecting kitchen equipment: ${equipment}`);
                        const clicked = await page.evaluate((eq) => {
                            const labels = Array.from(document.querySelectorAll('label, span, div'));
                            const option = labels.find(el => el.textContent.trim() === eq);
                            if (option) {
                                option.click();
                                return true;
                            }
                            return false;
                        }, equipment);
                        if (clicked) {
                            console.log(`Clicked kitchen equipment: ${equipment}`);
                        } else {
                            console.log(`Could not find kitchen equipment: ${equipment}`);
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.log('Error selecting kitchen equipment:', error.message);
                }

                try {
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    const availabilityOptions = ["В наличии", "Под заказ"];
                    const randomIndex = Math.floor(Math.random() * availabilityOptions.length);
                    const availabilityText = availabilityOptions[randomIndex];
                    console.log(`Selecting availability: ${availabilityText}`);
                    const clicked = await page.evaluate((text) => {
                        const labels = Array.from(document.querySelectorAll('label, span, div'));
                        const option = labels.find(el => el.textContent.trim() === text);
                        if (option) {
                            const input = option.querySelector('input[type="radio"]') || option.closest('label')?.querySelector('input');
                            if (input) {
                                input.click();
                                return true;
                            } else {
                                option.click();
                                return true;
                            }
                        }
                        return false;
                    }, availabilityText);
                    if (clicked) {
                        console.log(`Clicked availability: ${availabilityText}`);
                    } else {
                        console.log(`Could not find availability: ${availabilityText}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.log('Error selecting availability:', error.message);
                }

                // Wait for the full form to load
                await page.waitForSelector('input[data-marker="price"]', { timeout: 10000 });
                console.log('Full form loaded');

                // Wait a bit more for dynamic content to load
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Fill in the description using the contenteditable div
                if (ad.description) {
                    await page.type('.public-DraftEditor-content[contenteditable="true"]', ad.description);
                    console.log('Description filled:', ad.description);
                }

                // Fill in the price if available
                if (ad.price) {
                    const priceStr = ad.price.toString();
                    await page.focus('#price');
                    for (const digit of priceStr) {
                        await page.keyboard.type(digit);
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
                    }
                    console.log('Price filled:', ad.price);
                }

                // Click on price unit button (используется новая система конфигов, но оставлена старая логика)
                try {
                    const priceUnit = getPriceUnit(productType); // Получить единицу измерения из конфига
                    if (priceUnit) { // Если задана единица измерения (например, для кухонь "за погонный метр")
                        const clicked = await page.evaluate((unit) => {
                            const wrappers = Array.from(document.querySelectorAll('.style-module-wrapper-sPHZh.style-module-wrapper_variant_default-ljiuF'));
                            const target = wrappers.find(wrapper => {
                                const textEl = wrapper.querySelector('.style-module-text-QIi2P.style-module-text_size_l-JNfeb');
                                return textEl && textEl.textContent.trim() === unit;
                            });
                            if (target) {
                                target.click();
                                return true;
                            }
                            return false;
                        }, priceUnit);

                        if (clicked) {
                            console.log(`Clicked "${priceUnit}" button`);
                        } else {
                            console.log(`Could not find "${priceUnit}" button`);
                        }
                    } else {
                        console.log('No price unit configured for this product type (will use regular price)');
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (priceUnitError) {
                    console.log('Error selecting price unit:', priceUnitError.message);
                }

                // Select address in Moscow or Moscow region
                try {
                    // Click on the geo search input
                    await page.click('input[data-marker="geo/search-input"]');
                    console.log('Clicked geo search input');
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Select a random address from the city addresses
                    const randomIndex = Math.floor(Math.random() * cityAddresses.length);
                    const selectedAddress = cityAddresses[randomIndex];
                    console.log(`Typing address: ${selectedAddress}`);

                    // Clear the input first
                    await page.evaluate(() => {
                        const input = document.querySelector('input[data-marker="geo/search-input"]');
                        if (input) {
                            input.value = '';
                        }
                    });

                    // Type the address
                    await page.type('input[data-marker="geo/search-input"]', selectedAddress);
                    console.log('Address typed');

                    // Wait for suggestions to appear
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Click the first address option
                    const optionClicked = await page.evaluate(() => {
                        const options = Array.from(document.querySelectorAll('button[data-marker*="geo/custom-option"]'));
                        if (options.length > 0) {
                            options[0].click();
                            return true;
                        }
                        return false;
                    });

                    if (optionClicked) {
                        console.log('Clicked first address option');
                    } else {
                        console.log('Could not find address options');
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (addressError) {
                    console.log('Error selecting address:', addressError.message);
                }

                await new Promise(resolve => setTimeout(resolve, 10000)); // Added delay before form submission

                // Additional fields can be added here as needed, e.g., location, images, etc.
                // For example:
                // if (ad.location) {
                //     await page.type('input[name="location"]', ad.location);
                // }

                console.log('About to submit form');
                // Debug: log available buttons and take screenshot
                try {
                    const buttons = await page.$$eval('button', buttons => buttons.map(btn => ({
                        text: btn.textContent.trim(),
                        dataMarker: btn.getAttribute('data-marker'),
                        className: btn.className,
                        type: btn.type,
                        visible: btn.offsetParent !== null
                    })));
                    console.log('Available buttons:', buttons);

                    // Take screenshot for debugging
                    await page.screenshot({ path: `debug_buttons_${Date.now()}.png`, fullPage: true });
                    console.log('Screenshot saved for debugging');
                } catch (debugError) {
                    console.log('Error during button debugging:', debugError.message);
                }

                // Try multiple selectors for submit button
                let submitClicked = false;
                const selectors = [
                    'button[data-marker="item-edit/button-next"]',
                    'button[type="submit"]',
                    'button[data-marker*="button-next"]',
                    'button[data-marker="item-edit/button-submit"]',
                    'button[data-marker="item-edit/button-publish"]',
                    '.button-submit',
                    '.submit-button'
                ];

                for (const selector of selectors) {
                    try {
                        await page.waitForSelector(selector, { timeout: 2000 });
                        await page.click(selector);
                        console.log(`Clicked button with selector: ${selector}`);
                        submitClicked = true;
                        break;
                    } catch (e) {
                        console.log(`Selector ${selector} failed: ${e.message}`);
                    }
                }

                // If no selector worked, try clicking by text content
                if (!submitClicked) {
                    try {
                        const clicked = await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const submitButton = buttons.find(btn => 
                                btn.textContent.includes('Опубликовать') ||
                                btn.textContent.includes('Далее') ||
                                btn.textContent.includes('Разместить') ||
                                btn.textContent.includes('Submit') ||
                                btn.textContent.includes('Next')
                            );
                            if (submitButton && submitButton.offsetParent !== null) { // Check if visible
                                submitButton.click();
                                return true;
                            }
                            return false;
                        });
                        if (clicked) {
                            console.log('Clicked button by text content');
                            submitClicked = true;
                        } else {
                            console.log('No suitable visible button found by text');
                        }
                    } catch (e) {
                        console.log(`Text-based click failed: ${e.message}`);
                    }
                }

                if (!submitClicked) {
                    throw new Error('Could not find or click submit button');
                }

                console.log('Form submitted');

                // Wait for the target audience selection page to load
                await new Promise(resolve => setTimeout(resolve, 3000));
                console.log('Waiting for target audience selection page...');

                // Select target audience "Частные лица" (Private individuals)
                try {
                    // Wait for the target audience radio button to appear
                    await page.waitForSelector('label[data-marker="params[181941]/3331545"]', { timeout: 10000 });
                    console.log('Target audience selection page loaded');

                    // Click on "Частные лица" radio button
                    await page.click('label[data-marker="params[181941]/3331545"]');
                    console.log('Selected target audience: Частные лица');

                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Click the "Продолжить" (Continue) button
                    await page.waitForSelector('button[data-marker="item-edit/button-next"]', { timeout: 10000 });
                    await page.click('button[data-marker="item-edit/button-next"]');
                    console.log('Clicked continue button after target audience selection');

                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (targetAudienceError) {
                    console.log('Error selecting target audience:', targetAudienceError.message);
                    // Continue anyway as this might be an optional step
                }

                // Check if we're still on the same page or if navigation occurred
                const currentUrl = page.url();
                if (currentUrl.includes('additem')) {
                    console.log('Still on additem page, ad may not have been submitted successfully');
                } else {
                    console.log('Navigation occurred, ad submission likely successful');
                }

                console.log(`[${accountName}] ✓ Ad "${ad.title || 'Untitled'}" published successfully.`);
                successCount++;
                
                // Update ad status in Google Sheets
                if (ad.rowIndex) {
                    try {
                        await updateAdStatus(ad.rowIndex, 'выставлено', productType);
                    } catch (statusError) {
                        console.error(`[${accountName}] Error updating status for row ${ad.rowIndex}:`, statusError.message);
                        // Don't fail the ad publication if status update fails
                    }
                }
        
                // Add delay between submissions to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, delayBetweenAds));
        
            } catch (adError) {
                console.error(`[${accountName}] ✗ Error publishing ad "${ad.title || 'Untitled'}":`, adError.message);
                failedCount++;
                // Continue with next ad
            }
        }

        console.log(`[${accountName}] Session completed: ${successCount} published, ${failedCount} failed out of ${adsData.length} total ads`);
        return { accountName, totalAds: adsData.length, published: successCount, failed: failedCount };

    } catch (error) {
        console.error(`[${accountName}] Critical error in publishAds:`, error);
        throw error;
    } finally {
        // Ensure browser is closed
        if (browser) {
            try {
                await browser.close();
                console.log(`[${accountName}] Browser closed`);
            } catch (closeError) {
                console.error(`[${accountName}] Error closing browser:`, closeError.message);
            }
        }
    }
}

module.exports = { publishAds, countActiveAds, deleteAllAds };
