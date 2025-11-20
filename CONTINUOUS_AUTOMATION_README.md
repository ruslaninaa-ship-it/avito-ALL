# Continuous Automation System for Avito

## Overview

The continuous automation system enables 24/7 unattended operation of Avito ad publishing with intelligent state management, automatic deletion when thresholds are reached, and graceful shutdown capabilities.

## Architecture

The system consists of the following components:

### Core Modules

1. **`continuous_automation.js`** - Main entry point for continuous execution
   - Infinite loop with 24-hour cycles
   - Automatic city selection at startup
   - State persistence and recovery
   - Graceful shutdown handling

2. **`state_manager.js`** - State persistence module
   - Tracks cycle count, timestamps, and statistics
   - Manages account-specific metrics
   - Handles state recovery on restart

3. **`config.js`** - Configuration management
   - Environment variable support
   - Default values for all settings
   - Helper functions for formatting

4. **`index.js`** (modified) - Publishing workflow
   - Exported `runPublishingCycle()` for continuous mode
   - Backward compatible with one-time execution

5. **`publish_ads.js`** (modified) - Ad operations
   - Exported `countActiveAds()` and `deleteAllAds()`
   - Used by continuous automation for deletion phase

## Features

### 1. Infinite Execution
- Runs continuously without termination
- Automatically resumes after errors
- State persistence ensures no data loss
- Recovery from unexpected shutdowns

### 2. Intelligent Cycle Management
- Publishes exactly 25 ads per account per cycle
- Waits 24 hours between cycles (configurable)
- Only publishes when sufficient unpublished ads available
- Automatic deletion when account exceeds 45 ads

### 3. State Persistence
- All cycle data saved to `continuous_state.json`
- Account-specific statistics tracking
- Cycle history (last 100 cycles)
- Automatic state recovery on restart

### 4. Graceful Shutdown
- Handles SIGINT (Ctrl+C) and SIGTERM signals
- Saves state before exit
- Closes all browser instances
- Clean exit with proper logging

### 5. Comprehensive Logging
- All activities logged to `automation.log`
- Console and file output
- Progress updates during wait periods
- Error tracking with stack traces

## Configuration

### Environment Variables

```bash
# Batch size (ads per cycle per account)
BATCH_SIZE=25

# Cycle duration in milliseconds (24 hours)
CYCLE_DURATION=86400000

# Deletion threshold
DELETION_THRESHOLD=45

# Test mode (shorter cycles for testing)
TEST_MODE=true
TEST_CYCLE_DURATION=120000  # 2 minutes for testing

# Dry run mode (simulation)
DRY_RUN=true

# Debug mode
DEBUG=true

# Log file path
LOG_FILE=automation.log

# Progress logging interval (1 hour)
PROGRESS_LOG_INTERVAL=3600000
```

### Configuration File

All settings are centralized in `config.js`:

```javascript
const config = require('./config');

// Access settings
config.BATCH_SIZE          // 25
config.CYCLE_DURATION      // 86400000 (24 hours)
config.DELETION_THRESHOLD  // 45
config.TEST_MODE           // false
config.DRY_RUN            // false
```

## Usage

### Starting Continuous Automation

```bash
# Production mode (24-hour cycles)
node continuous_automation.js

# Test mode (2-minute cycles)
TEST_MODE=true node continuous_automation.js

# Dry run mode (simulation)
DRY_RUN=true node continuous_automation.js

# Combined test and dry run
TEST_MODE=true DRY_RUN=true node continuous_automation.js
```

### Graceful Shutdown

Press `Ctrl+C` or send SIGTERM signal:

```bash
# From terminal
Ctrl+C

# From another process
kill -TERM <process_id>
```

The system will:
1. Save current state
2. Close all browsers
3. Flush logs
4. Exit cleanly

### Monitoring Progress

View the log file in real-time:

```bash
tail -f automation.log
```

Check current state:

```bash
cat continuous_state.json | jq
```

## Workflow

### Startup Phase

1. **City Selection**: User selects city for addresses (one-time)
2. **Account Loading**: Loads all enabled accounts
3. **State Initialization**: Loads or creates state file
4. **Shutdown Handlers**: Sets up graceful shutdown

### Main Loop

```
┌─────────────────────────────────────────┐
│         Read Ads from Sheets            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    Check if Deletion Needed (>45)       │
└──────────────┬──────────────────────────┘
               │
               ├─ YES ──► Delete All Ads ──► Clear Status ──► Wait 5min ──┐
               │                                                           │
               ▼                                                           │
┌─────────────────────────────────────────┐                              │
│   Check Unpublished Ads Available       │                              │
└──────────────┬──────────────────────────┘                              │
               │                                                           │
               ├─ <25 ──► Wait 24 hours ────────────────────────────────┐│
               │                                                          ││
               ▼                                                          ││
┌─────────────────────────────────────────┐                             ││
│    Select 25 Ads Batch for Each Acct    │                             ││
└──────────────┬──────────────────────────┘                             ││
               │                                                          ││
               ▼                                                          ││
┌─────────────────────────────────────────┐                             ││
│      Publish Ads to All Accounts        │                             ││
└──────────────┬──────────────────────────┘                             ││
               │                                                          ││
               ▼                                                          ││
┌─────────────────────────────────────────┐                             ││
│         Update State & Sheets           │                             ││
└──────────────┬──────────────────────────┘                             ││
               │                                                          ││
               ▼                                                          ││
┌─────────────────────────────────────────┐                             ││
│         Sleep 24 Hours                  │ ◄───────────────────────────┘│
└──────────────┬──────────────────────────┘                              │
               │                                                           │
               └───────────────────────────────────────────────────────────┘
```

## State File Structure

The `continuous_state.json` file tracks:

```json
{
  "currentCycle": 5,
  "lastCycleTimestamp": "2025-11-04T16:00:00.000Z",
  "lastDeletionTimestamp": "2025-11-03T10:00:00.000Z",
  "totalPublished": 250,
  "totalFailed": 5,
  "totalDeleted": 50,
  "accountStats": {
    "Account1": {
      "totalPublished": 125,
      "totalFailed": 2,
      "cycles": 5
    }
  },
  "cycleHistory": [
    {
      "cycleNumber": 5,
      "timestamp": "2025-11-04T16:00:00.000Z",
      "published": 50,
      "failed": 1,
      "duration": 1800
    }
  ],
  "startedAt": "2025-11-01T00:00:00.000Z",
  "lastUpdated": "2025-11-04T16:00:00.000Z"
}
```

## Testing

### Test Mode

Enable short cycles for testing:

```bash
TEST_MODE=true node continuous_automation.js
```

This reduces the cycle duration to 2 minutes instead of 24 hours.

### Dry Run Mode

Simulate operations without actual publishing:

```bash
DRY_RUN=true node continuous_automation.js
```

### Combined Testing

```bash
TEST_MODE=true DRY_RUN=true node continuous_automation.js
```

## Error Handling

### Cycle Errors

If an error occurs during a cycle:
1. Error is logged with full stack trace
2. System waits 1 minute (configurable)
3. Cycle is retried
4. State is preserved

### Critical Errors

For unrecoverable errors:
1. Error is logged
2. State is saved
3. System exits with code 1

### Recovery

On restart:
1. Previous state is loaded from `continuous_state.json`
2. Cycle count continues from last value
3. Statistics are preserved

## Best Practices

### 1. Monitor Logs Regularly

```bash
# Real-time monitoring
tail -f automation.log

# Search for errors
grep ERROR automation.log

# View statistics
grep "Cycle Complete" automation.log
```

### 2. Regular State Backups

```bash
# Backup state file daily
cp continuous_state.json continuous_state.json.backup.$(date +%Y%m%d)
```

### 3. Resource Management

- Browser profiles are NOT closed between cycles (persistent sessions)
- Cookies and login state persist across cycles
- Photo cache is maintained permanently

### 4. Google Sheets Integration

- Ad status is updated after each publication
- Status column is cleared after deletion
- Sheet is read fresh each cycle

## Troubleshooting

### System Won't Start

**Check account directories:**
```bash
ls -la "куки для avito_automation kuhni/"
```

**Verify Google Sheets credentials:**
```bash
ls -la astute-smile-474621-e4-740759e13bbc.json
```

### Ads Not Publishing

**Check dry run mode:**
```bash
echo $DRY_RUN
```

**Verify unpublished ads:**
- Check Google Sheets status column
- Ensure at least 25 unpublished ads available

### State Recovery Issues

**Reset state:**
```bash
rm continuous_state.json
# System will create new state on next run
```

**Inspect state:**
```bash
cat continuous_state.json | jq
```

## Differences from One-Time Mode

| Feature | One-Time Mode | Continuous Mode |
|---------|--------------|-----------------|
| Execution | Single run | Infinite loop |
| City Selection | Every run | Once at startup |
| State Tracking | None | Full persistence |
| Ad Deletion | Manual | Automatic (>45 ads) |
| Shutdown | Immediate | Graceful |
| Logging | Console only | Console + File |
| Recovery | Not applicable | Full state recovery |

## Migration from One-Time Mode

The one-time execution mode (`index.js`) remains fully functional:

```bash
# One-time execution (original behavior)
node index.js

# Continuous execution (new system)
node continuous_automation.js
```

Both modes share the same underlying functions and are fully compatible.

## Performance Metrics

Based on typical usage:

- **Cycle Time**: ~30-45 minutes for 25 ads across 2 accounts
- **Memory Usage**: ~200-400 MB (persistent browsers)
- **Disk Space**: ~10 MB for state and logs per month
- **Network**: Minimal (Google Sheets API + Avito)

## Future Enhancements

Potential improvements:

1. Web dashboard for monitoring
2. Email/SMS notifications on errors
3. Dynamic batch size based on available ads
4. Multi-city support with rotation
5. Advanced scheduling (specific hours)
6. Metrics export (Prometheus/Grafana)

## Support

For issues or questions:
1. Check logs: `automation.log`
2. Inspect state: `continuous_state.json`
3. Enable debug mode: `DEBUG=true`
4. Review this documentation

## License

Same as the main project.