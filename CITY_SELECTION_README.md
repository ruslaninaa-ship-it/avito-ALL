# City Selection and Address Database

## Overview

The Avito automation now supports interactive city selection at startup. All accounts in a session will use addresses from the selected city when publishing ads.

## Features

- **45,000 pre-generated addresses** across 15 major Russian cities
- **3,000 addresses per city** with realistic street names and building numbers
- **Interactive city selection** at startup using numbered menu
- **Moscow region support**: Moscow addresses include ~400 addresses from Moscow Oblast (Одинцово, Химки, Мытищи, etc.)
- **Easy to extend**: Add more cities using the generation script

## Available Cities

1. Волгоград
2. Воронеж
3. Екатеринбург
4. Казань
5. Красноярск
6. Москва (includes Московская область)
7. Нижний Новгород
8. Новосибирск
9. Омск
10. Пермь
11. Ростов-на-Дону
12. Самара
13. Санкт-Петербург
14. Уфа
15. Челябинск

## How It Works

### Startup Process

1. When you run `node index.js`, you'll see a city selection menu
2. Enter the number corresponding to your desired city
3. The system loads 3,000 addresses for that city
4. All accounts publish ads using random addresses from the selected city

### Address Format

Addresses follow the standard Russian format:
```
Город, тип_улицы Название, Номер_дома
```

Examples:
- `Москва, улица Ленина, 25`
- `Санкт-Петербург, проспект Невский, 100А`
- `Московская область, Химки, бульвар Победы, 15`

## Files

### Core Files

- **`russian_cities_addresses.json`** - Database of 45,000 addresses (auto-generated)
- **`city_addresses.js`** - Utility module for loading addresses
- **`generate_addresses.js`** - Script to generate/regenerate the database
- **`test_city_selection.js`** - Test script to verify the implementation

### Modified Files

- **`index.js`** - Added city selection prompt and passes addresses to sessions
- **`publish_ads.js`** - Accepts cityAddresses parameter and uses them for geolocation

## Usage

### Normal Operation

Simply run your automation as usual:

```bash
node index.js
```

You'll see:
```
[System] ========================================
[System] City Selection for Ad Publishing
[System] ========================================
[System] Available cities:

[System] 1. Волгоград
[System] 2. Воронеж
...
[System] 15. Челябинск

[System] All accounts will use addresses from the selected city.
[System] ========================================

[System] Enter city number (1-15): _
```

Enter your choice (1-15), and the system will proceed with that city's addresses.

### Testing

Test the address database:

```bash
node test_city_selection.js
```

This verifies:
- Database loads correctly
- All cities have 3,000 addresses
- Random address selection works
- Error handling functions properly
- Moscow includes Moscow region addresses

### Regenerating the Database

If you need to regenerate the address database (e.g., to add variety):

```bash
node generate_addresses.js
```

This creates a fresh `russian_cities_addresses.json` with new randomized addresses.

## Adding More Cities

To add new cities to the database:

1. Edit `generate_addresses.js`
2. Add city names to the `cities` array in the `generateAddressDatabase()` function
3. Run `node generate_addresses.js` to regenerate the database
4. The new cities will automatically appear in the selection menu

Example:
```javascript
const cities = [
    'Москва',
    'Санкт-Петербург',
    // ... existing cities ...
    'Новый Город',  // Add your new city here
];
```

## Address Generation

Addresses are generated using:

- **Street types**: улица, проспект, переулок, бульвар, площадь, шоссе, набережная
- **Street names**: Mix of numbered streets (1-я, 2-я, etc.) and famous Russian names
- **Building numbers**: 1-200, with occasional letter suffixes (А, Б, В, Г)

Each address is unique within its city (no duplicates).

## API Reference

### city_addresses.js

```javascript
const { 
    loadCityAddresses,      // Load addresses for a city
    getAvailableCities,     // Get list of all cities
    getDatabaseStats,       // Get database statistics
    validateCity,           // Check if city exists
    getRandomAddress        // Get random address from city
} = require('./city_addresses');
```

#### loadCityAddresses(cityName)
Returns array of 3,000 addresses for the specified city.

```javascript
const addresses = loadCityAddresses('Москва');
// Returns: ['Москва, улица Ленина, 25', ...]
```

#### getAvailableCities()
Returns sorted array of all city names.

```javascript
const cities = getAvailableCities();
// Returns: ['Волгоград', 'Воронеж', ...]
```

#### getDatabaseStats()
Returns statistics about the database.

```javascript
const stats = getDatabaseStats();
// Returns: { totalCities: 15, totalAddresses: 45000, averagePerCity: 3000, cities: [...] }
```

## Technical Details

- **Storage**: JSON file (russian_cities_addresses.json) - ~10MB
- **Performance**: Database is cached in memory after first load
- **Randomization**: Each ad gets a random address from the pool
- **Distribution**: Moscow has ~13% Moscow region addresses for variety

## Benefits

1. **Realistic**: Uses actual Russian street naming conventions
2. **Diverse**: 3,000 unique addresses per city prevents detection
3. **Scalable**: Easy to add more cities or regenerate addresses
4. **Fast**: In-memory caching for instant address lookup
5. **Flexible**: Each session can use a different city

## Session Behavior

- City selection happens **once at startup**
- **All accounts** in that session use the same city
- Each account gets **random addresses** from the city's pool
- To use different cities, run separate sessions