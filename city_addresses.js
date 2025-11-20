const fs = require('fs');
const path = require('path');

// Path to the address database
const DATABASE_PATH = path.join(__dirname, 'russian_cities_addresses.json');

// Cache for the loaded database
let addressDatabase = null;

/**
 * Load the address database from file
 * @returns {Object} The address database object
 * @throws {Error} If database file cannot be read
 */
function loadDatabase() {
    if (addressDatabase) {
        return addressDatabase;
    }
    
    try {
        const data = fs.readFileSync(DATABASE_PATH, 'utf8');
        addressDatabase = JSON.parse(data);
        console.log(`[Address Database] Loaded database with ${Object.keys(addressDatabase).length} cities`);
        return addressDatabase;
    } catch (error) {
        throw new Error(`Failed to load address database from ${DATABASE_PATH}: ${error.message}`);
    }
}

/**
 * Get list of available cities
 * @returns {Array<string>} Array of city names
 */
function getAvailableCities() {
    const db = loadDatabase();
    return Object.keys(db).sort();
}

/**
 * Load addresses for a specific city
 * @param {string} cityName - Name of the city
 * @returns {Array<string>} Array of addresses for the city
 * @throws {Error} If city name is not found in database
 */
function loadCityAddresses(cityName) {
    const db = loadDatabase();
    
    if (!db[cityName]) {
        const availableCities = getAvailableCities();
        throw new Error(
            `City "${cityName}" not found in database. Available cities: ${availableCities.join(', ')}`
        );
    }
    
    const addresses = db[cityName];
    console.log(`[Address Database] Loaded ${addresses.length} addresses for ${cityName}`);
    return addresses;
}

/**
 * Get statistics about the address database
 * @returns {Object} Statistics object with city count and total addresses
 */
function getDatabaseStats() {
    const db = loadDatabase();
    const cities = Object.keys(db);
    const totalAddresses = Object.values(db).reduce((sum, arr) => sum + arr.length, 0);
    
    return {
        totalCities: cities.length,
        totalAddresses: totalAddresses,
        averagePerCity: Math.round(totalAddresses / cities.length),
        cities: cities.sort()
    };
}

/**
 * Validate that a city exists in the database
 * @param {string} cityName - Name of the city to validate
 * @returns {boolean} True if city exists, false otherwise
 */
function validateCity(cityName) {
    const db = loadDatabase();
    return cityName in db;
}

/**
 * Get a random address from a city
 * @param {string} cityName - Name of the city
 * @returns {string} Random address from the city
 * @throws {Error} If city name is not found in database
 */
function getRandomAddress(cityName) {
    const addresses = loadCityAddresses(cityName);
    const randomIndex = Math.floor(Math.random() * addresses.length);
    return addresses[randomIndex];
}

module.exports = {
    loadCityAddresses,
    getAvailableCities,
    getDatabaseStats,
    validateCity,
    getRandomAddress
};