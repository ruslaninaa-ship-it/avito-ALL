#!/usr/bin/env node

const { loadAccountConfigs, promptCitySelection, promptProductTypeSelection, runPublishingCycle } = require('./index');
const { readSheetData } = require('./sheets');
const { loadCityAddresses } = require('./city_addresses');
const { countActiveAds, deleteAllAds } = require('./publish_ads');
const loginToAvito = require('./avito_login');
const StateManager = require('./state_manager');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// Global state for shutdown handling
let shutdownRequested = false;
let activeBrowsers = [];

/**
 * Logger class for file and console logging
 */
class Logger {
    constructor(logFile) {
        this.logFile = logFile;
        this.stream = fs.createWriteStream(logFile, { flags: 'a' });
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        console.log(logMessage);
        this.stream.write(logMessage + '\n');
    }

    info(message) {
        this.log(message, 'INFO');
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    debug(message) {
        if (config.DEBUG) {
            this.log(message, 'DEBUG');
        }
    }

    close() {
        this.stream.end();
    }
}

// Initialize logger
const logger = new Logger(config.LOG_FILE);

/**
 * Sleep function with optional progress logging
 * @param {number} ms - Milliseconds to sleep
 * @param {boolean} showProgress - Whether to show countdown progress
 * @returns {Promise<void>}
 */
async function sleep(ms, showProgress = false) {
    if (!showProgress) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const startTime = Date.now();
    const endTime = startTime + ms;
    const progressInterval = config.PROGRESS_LOG_INTERVAL;

    return new Promise(resolve => {
        const checkProgress = setInterval(() => {
            if (shutdownRequested) {
                clearInterval(checkProgress);
                resolve();
                return;
            }

            const now = Date.now();
            const remainingMs = endTime - now;

            if (remainingMs <= 0) {
                clearInterval(checkProgress);
                resolve();
            } else {
                const elapsed = now - startTime;
                if (elapsed % progressInterval < 1000) {
                    const remainingFormatted = config.formatDuration(remainingMs);
                    logger.info(`⏳ Waiting... ${remainingFormatted} remaining until next cycle`);
                }
            }
        }, 1000);
    });
}

/**
 * Select a batch of unpublished ads
 * @param {Array<Object>} allAds - All ads from sheets
 * @param {number} batchSize - Number of ads to select
 * @returns {Array<Object>} Batch of unpublished ads
 */
function selectAdBatch(allAds, batchSize) {
    const unpublished = allAds.filter(ad => !ad.status || ad.status !== 'выставлено');
    return unpublished.slice(0, batchSize);
}

/**
 * Setup graceful shutdown handlers
 * @param {StateManager} stateManager - State manager instance
 */
function setupShutdownHandlers(stateManager) {
    const handleShutdown = async (signal) => {
        logger.info(`\n${'='.repeat(60)}`);
        logger.info(`Received ${signal} - Initiating graceful shutdown...`);
        logger.info('='.repeat(60));
        
        shutdownRequested = true;

        try {
            // Save current state
            logger.info('Saving current state...');
            stateManager.saveState();
            logger.info('✓ State saved successfully');

            // Close any active browsers
            if (activeBrowsers.length > 0) {
                logger.info(`Closing ${activeBrowsers.length} active browser(s)...`);
                for (const browser of activeBrowsers) {
                    try {
                        await browser.close();
                    } catch (error) {
                        logger.error(`Error closing browser: ${error.message}`);
                    }
                }
                logger.info('✓ All browsers closed');
            }

            // Close logger
            logger.info('Shutdown complete. Goodbye!');
            logger.close();

            process.exit(0);
        } catch (error) {
            logger.error(`Error during shutdown: ${error.message}`);
            logger.close();
            process.exit(1);
        }
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

/**
 * Check if any account needs deletion (has more than threshold ads)
 * @param {Array<Object>} accounts - Account configurations
 * @returns {Promise<boolean>} True if deletion is needed
 */
async function checkDeletionNeeded(accounts) {
    logger.info('Checking if ad deletion is needed...');
    
    for (const account of accounts) {
        if (!account.enabled) continue;
        
        try {
            const loginResult = await loginToAvito(account.profileDir, account.name);
            const page = loginResult.page;
            const browser = loginResult.browser;
            
            // Track browser for cleanup
            activeBrowsers.push(browser);
            
            const activeCount = await countActiveAds(page, account.name);
            
            // Clean up
            await browser.close();
            activeBrowsers = activeBrowsers.filter(b => b !== browser);
            
            if (activeCount > config.DELETION_THRESHOLD) {
                logger.info(`⚠️ Account ${account.name} has ${activeCount} ads (threshold: ${config.DELETION_THRESHOLD})`);
                return true;
            }
        } catch (error) {
            logger.error(`Error checking ads for ${account.name}: ${error.message}`);
        }
    }
    
    logger.info('✓ No deletion needed');
    return false;
}

/**
 * Execute deletion phase - delete all ads from all accounts
 * @param {Array<Object>} accounts - Account configurations
 * @param {StateManager} stateManager - State manager instance
 * @returns {Promise<void>}
 */
async function deletionPhase(accounts, stateManager) {
    logger.info('\n' + '='.repeat(60));
    logger.info('DELETION PHASE STARTED');
    logger.info('='.repeat(60));
    
    let totalDeleted = 0;
    
    for (const account of accounts) {
        if (!account.enabled) continue;
        
        try {
            logger.info(`Starting deletion for account: ${account.name}`);
            
            const loginResult = await loginToAvito(account.profileDir, account.name);
            const page = loginResult.page;
            const browser = loginResult.browser;
            
            activeBrowsers.push(browser);
            
            const deletedCount = await deleteAllAds(page, account.name, selectedProductType);
            totalDeleted += deletedCount;
            
            await browser.close();
            activeBrowsers = activeBrowsers.filter(b => b !== browser);
            
            logger.info(`✓ Deleted ${deletedCount} ads from ${account.name}`);
            
        } catch (error) {
            logger.error(`Error deleting ads for ${account.name}: ${error.message}`);
        }
    }
    
    // Update state
    stateManager.updateDeletionState(totalDeleted);
    
    logger.info('='.repeat(60));
    logger.info(`DELETION PHASE COMPLETE - Total deleted: ${totalDeleted}`);
    logger.info('='.repeat(60) + '\n');
}

/**
 * Execute publishing phase
 * @param {Array<Object>} accounts - Account configurations
 * @param {Array<Object>} adBatch - Batch of ads to publish
 * @param {Array<string>} cityAddresses - City addresses
 * @param {string} productType - Product type ('kitchen' or 'curtains')
 * @param {StateManager} stateManager - State manager instance
 * @returns {Promise<void>}
 */
async function publishingPhase(accounts, adBatch, cityAddresses, productType, stateManager) {
    logger.info('\n' + '='.repeat(60));
    logger.info('PUBLISHING PHASE STARTED');
    logger.info('='.repeat(60));
    logger.info(`Publishing ${adBatch.length} ads across ${accounts.length} account(s)`);
    logger.info(`Product type: ${productType}`);

    try {
        const cycleResult = await runPublishingCycle(accounts, adBatch, cityAddresses, productType, config.BATCH_SIZE);

        // Update state with cycle results
        stateManager.updateCycleState(cycleResult);

        logger.info('='.repeat(60));
        logger.info(`PUBLISHING PHASE COMPLETE`);
        logger.info(`Published: ${cycleResult.published}, Failed: ${cycleResult.failed}`);
        logger.info('='.repeat(60) + '\n');

    } catch (error) {
        logger.error(`Error in publishing phase: ${error.message}`);
        throw error;
    }
}

/**
 * Main continuous automation loop
 */
async function continuousLoop() {
    logger.info('='.repeat(60));
    logger.info('CONTINUOUS AUTOMATION STARTED');
    logger.info('='.repeat(60));
    logger.info(`Mode: ${config.DRY_RUN ? 'DRY-RUN' : 'PRODUCTION'}`);
    logger.info(`Test Mode: ${config.TEST_MODE ? 'ENABLED' : 'DISABLED'}`);
    logger.info(`Cycle Duration: ${config.formatDuration(config.getEffectiveCycleDuration())}`);
    logger.info(`Batch Size: ${config.BATCH_SIZE} ads per cycle`);
    logger.info(`Deletion Threshold: ${config.DELETION_THRESHOLD} ads`);
    logger.info('='.repeat(60) + '\n');

    try {
        // 1. Startup: Select product type (once)
        logger.info('Step 1: Product type selection...');
        const selectedProductType = await promptProductTypeSelection();
        logger.info(`✓ Selected product type: ${selectedProductType}\n`);

        // 2. Startup: Select city (once)
        logger.info('Step 2: City selection...');
        const selectedCity = await promptCitySelection();
        const cityAddresses = loadCityAddresses(selectedCity);
        logger.info(`✓ Using ${cityAddresses.length} addresses from ${selectedCity}\n`);

        // 3. Load accounts
        logger.info('Step 3: Loading account configurations...');
        const accounts = loadAccountConfigs();
        const enabledAccounts = accounts.filter(acc => acc.enabled);

        if (enabledAccounts.length === 0) {
            throw new Error('No enabled accounts found');
        }

        logger.info(`✓ Loaded ${enabledAccounts.length} enabled account(s)\n`);

        // 4. Initialize state manager
        logger.info('Step 4: Initializing state manager...');
        const stateManager = new StateManager(config.STATE_FILE);
        logger.info('✓ State manager initialized');
        logger.info(`Current state:\n${stateManager.getStats()}\n`);

        // 5. Setup shutdown handlers
        setupShutdownHandlers(stateManager);
        logger.info('✓ Shutdown handlers configured\n');

        // 6. Infinite loop
        logger.info('Step 5: Starting infinite automation loop...\n');
        
        while (!shutdownRequested) {
            try {
                logger.info('\n' + '█'.repeat(60));
                logger.info(`CYCLE ${stateManager.getState().currentCycle + 1} STARTING`);
                logger.info('█'.repeat(60));
                logger.info(`Timestamp: ${new Date().toISOString()}`);
                logger.info('█'.repeat(60) + '\n');

                // Read current ads from sheets
                logger.info('Reading ads from Google Sheets...');
                const allAds = await readSheetData(selectedProductType);
                logger.info(`✓ Read ${allAds.length} total ads from sheet`);

                // Check if deletion needed
                const needsDeletion = await checkDeletionNeeded(enabledAccounts);
                
                if (needsDeletion) {
                    await deletionPhase(enabledAccounts, stateManager);
                    logger.info('⏳ Waiting 5 minutes after deletion before next check...');
                    await sleep(300000); // Wait 5 minutes
                    continue; // Re-check after deletion
                }

                // Get unpublished ads
                const unpublishedAds = selectAdBatch(allAds, config.BATCH_SIZE);
                
                if (unpublishedAds.length < config.BATCH_SIZE) {
                    logger.info(`⚠️ Only ${unpublishedAds.length} unpublished ads available (need ${config.BATCH_SIZE})`);
                    logger.info(`Waiting ${config.formatDuration(config.getEffectiveCycleDuration())} for more ads...`);
                    await sleep(config.getEffectiveCycleDuration(), true);
                    continue;
                }

                logger.info(`✓ Selected ${unpublishedAds.length} unpublished ads for publishing`);

                // Publishing phase
                await publishingPhase(enabledAccounts, unpublishedAds, cityAddresses, selectedProductType, stateManager);

                // Sleep for cycle duration
                const cycleDuration = config.getEffectiveCycleDuration();
                logger.info(`\n⏳ Cycle complete. Sleeping for ${config.formatDuration(cycleDuration)}...`);
                logger.info(`Next cycle will start at: ${new Date(Date.now() + cycleDuration).toISOString()}\n`);
                
                await sleep(cycleDuration, true);

            } catch (cycleError) {
                logger.error(`❌ Error in cycle: ${cycleError.message}`);
                if (config.DEBUG) {
                    logger.error(`Stack trace: ${cycleError.stack}`);
                }
                
                logger.info(`Waiting ${config.formatDuration(config.ERROR_RETRY_DELAY)} before retry...`);
                await sleep(config.ERROR_RETRY_DELAY);
            }
        }

    } catch (error) {
        logger.error(`\n${'='.repeat(60)}`);
        logger.error('CRITICAL ERROR IN CONTINUOUS LOOP');
        logger.error('='.repeat(60));
        logger.error(`Error: ${error.message}`);
        logger.error(`Stack: ${error.stack}`);
        logger.error('='.repeat(60));
        throw error;
    }
}

/**
 * Main entry point
 */
async function main() {
    try {
        await continuousLoop();
    } catch (error) {
        logger.error('Fatal error:', error.message);
        logger.close();
        process.exit(1);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error.message);
    logger.error('Stack:', error.stack);
    logger.close();
    process.exit(1);
});

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = {
    continuousLoop,
    sleep,
    selectAdBatch,
    setupShutdownHandlers,
    checkDeletionNeeded,
    deletionPhase,
    publishingPhase
};
