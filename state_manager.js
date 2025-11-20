const fs = require('fs');
const path = require('path');

/**
 * StateManager class for managing continuous automation state
 * Handles state persistence, recovery, and cycle tracking
 */
class StateManager {
    /**
     * @param {string} stateFilePath - Path to the state JSON file
     */
    constructor(stateFilePath) {
        this.stateFilePath = stateFilePath;
        this.state = this.loadState();
    }

    /**
     * Load state from JSON file
     * @returns {Object} State object with default values if file doesn't exist
     */
    loadState() {
        try {
            if (fs.existsSync(this.stateFilePath)) {
                const data = fs.readFileSync(this.stateFilePath, 'utf8');
                const state = JSON.parse(data);
                console.log('[StateManager] State loaded from file');
                console.log(`[StateManager] Current cycle: ${state.currentCycle}`);
                console.log(`[StateManager] Total published: ${state.totalPublished}`);
                return state;
            } else {
                console.log('[StateManager] No state file found, creating new state');
                return this.createDefaultState();
            }
        } catch (error) {
            console.error('[StateManager] Error loading state:', error.message);
            console.log('[StateManager] Creating new state due to load error');
            return this.createDefaultState();
        }
    }

    /**
     * Create default state object
     * @returns {Object} Default state
     */
    createDefaultState() {
        return {
            currentCycle: 0,
            lastCycleTimestamp: null,
            lastDeletionTimestamp: null,
            totalPublished: 0,
            totalFailed: 0,
            totalDeleted: 0,
            accountStats: {},
            cycleHistory: [],
            startedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Save current state to JSON file
     */
    saveState() {
        try {
            this.state.lastUpdated = new Date().toISOString();
            const data = JSON.stringify(this.state, null, 2);
            fs.writeFileSync(this.stateFilePath, data, 'utf8');
            console.log('[StateManager] State saved successfully');
        } catch (error) {
            console.error('[StateManager] Error saving state:', error.message);
        }
    }

    /**
     * Update state after a publishing cycle
     * @param {Object} cycleData - Data from the completed cycle
     */
    updateCycleState(cycleData) {
        this.state.currentCycle++;
        this.state.lastCycleTimestamp = new Date().toISOString();
        
        // Update totals
        this.state.totalPublished += cycleData.published || 0;
        this.state.totalFailed += cycleData.failed || 0;
        
        // Update account stats
        if (cycleData.accountResults) {
            cycleData.accountResults.forEach(result => {
                const accountName = result.accountName || result.result?.accountName;
                if (accountName) {
                    if (!this.state.accountStats[accountName]) {
                        this.state.accountStats[accountName] = {
                            totalPublished: 0,
                            totalFailed: 0,
                            cycles: 0
                        };
                    }
                    this.state.accountStats[accountName].totalPublished += result.result?.published || 0;
                    this.state.accountStats[accountName].totalFailed += result.result?.failed || 0;
                    this.state.accountStats[accountName].cycles++;
                }
            });
        }
        
        // Add to cycle history (keep last 100 cycles)
        this.state.cycleHistory.push({
            cycleNumber: this.state.currentCycle,
            timestamp: this.state.lastCycleTimestamp,
            published: cycleData.published || 0,
            failed: cycleData.failed || 0,
            duration: cycleData.duration || 0
        });
        
        if (this.state.cycleHistory.length > 100) {
            this.state.cycleHistory = this.state.cycleHistory.slice(-100);
        }
        
        this.saveState();
        console.log(`[StateManager] Cycle ${this.state.currentCycle} state updated`);
    }

    /**
     * Update state after deletion phase
     * @param {number} deletedCount - Number of ads deleted
     */
    updateDeletionState(deletedCount) {
        this.state.lastDeletionTimestamp = new Date().toISOString();
        this.state.totalDeleted += deletedCount;
        this.saveState();
        console.log(`[StateManager] Deletion state updated: ${deletedCount} ads deleted`);
    }

    /**
     * Get next action to perform based on state
     * @param {number} activeAdCount - Current number of active ads
     * @param {number} unpublishedCount - Number of unpublished ads available
     * @returns {string} Action to perform: 'DELETE', 'PUBLISH', 'WAIT'
     */
    getNextAction(activeAdCount, unpublishedCount) {
        if (activeAdCount > 45) {
            return 'DELETE';
        }
        
        if (unpublishedCount < 25) {
            return 'WAIT';
        }
        
        return 'PUBLISH';
    }

    /**
     * Get current state
     * @returns {Object} Current state
     */
    getState() {
        return this.state;
    }

    /**
     * Get formatted statistics
     * @returns {string} Formatted statistics string
     */
    getStats() {
        const stats = [
            `Cycle: ${this.state.currentCycle}`,
            `Total Published: ${this.state.totalPublished}`,
            `Total Failed: ${this.state.totalFailed}`,
            `Total Deleted: ${this.state.totalDeleted}`,
            `Started: ${this.state.startedAt}`
        ];
        
        if (this.state.lastCycleTimestamp) {
            stats.push(`Last Cycle: ${this.state.lastCycleTimestamp}`);
        }
        
        return stats.join('\n');
    }

    /**
     * Reset state (useful for testing)
     */
    resetState() {
        console.log('[StateManager] Resetting state');
        this.state = this.createDefaultState();
        this.saveState();
    }

    /**
     * Get time since last cycle
     * @returns {number|null} Milliseconds since last cycle, or null if no previous cycle
     */
    getTimeSinceLastCycle() {
        if (!this.state.lastCycleTimestamp) {
            return null;
        }
        return Date.now() - new Date(this.state.lastCycleTimestamp).getTime();
    }

    /**
     * Check if enough time has passed since last cycle
     * @param {number} cycleDuration - Required cycle duration in milliseconds
     * @returns {boolean} True if enough time has passed
     */
    shouldRunNextCycle(cycleDuration) {
        const timeSinceLast = this.getTimeSinceLastCycle();
        if (timeSinceLast === null) {
            return true; // First cycle
        }
        return timeSinceLast >= cycleDuration;
    }
}

module.exports = StateManager;