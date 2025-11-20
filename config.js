/**
 * Configuration module for continuous Avito automation
 * Supports environment variables with sensible defaults
 */

module.exports = {
    // Batch configuration
    BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 25,
    
    // Timing configuration (in milliseconds)
    CYCLE_DURATION: parseInt(process.env.CYCLE_DURATION) || 86400000, // 24 hours default
    
    // Deletion threshold
    DELETION_THRESHOLD: parseInt(process.env.DELETION_THRESHOLD) || 45,
    
    // Retry configuration
    RETRY_LIMIT: parseInt(process.env.RETRY_LIMIT) || 2,
    DELAY_BETWEEN_ADS: parseInt(process.env.DELAY_BETWEEN_ADS) || 5000, // 5 seconds
    
    // Error handling
    ERROR_RETRY_DELAY: parseInt(process.env.ERROR_RETRY_DELAY) || 60000, // 1 minute
    
    // Stagger delay for parallel sessions
    STAGGER_DELAY: parseInt(process.env.STAGGER_DELAY) || 30000, // 30 seconds
    
    // Logging configuration
    LOG_FILE: process.env.LOG_FILE || 'automation.log',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info', // info, debug, error
    
    // Progress logging during wait
    PROGRESS_LOG_INTERVAL: parseInt(process.env.PROGRESS_LOG_INTERVAL) || 3600000, // 1 hour
    
    // State file
    STATE_FILE: process.env.STATE_FILE || 'continuous_state.json',
    
    // Mode flags
    DRY_RUN: process.env.DRY_RUN === 'true',
    DEBUG: process.env.DEBUG === 'true',
    
    // Test mode (shorter cycle for testing)
    TEST_MODE: process.env.TEST_MODE === 'true',
    TEST_CYCLE_DURATION: parseInt(process.env.TEST_CYCLE_DURATION) || 120000, // 2 minutes
    
    // Get effective cycle duration based on mode
    getEffectiveCycleDuration() {
        return this.TEST_MODE ? this.TEST_CYCLE_DURATION : this.CYCLE_DURATION;
    },
    
    // Format duration for logging
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
};