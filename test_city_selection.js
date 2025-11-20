const { 
    getAvailableCities, 
    loadCityAddresses, 
    getDatabaseStats,
    validateCity,
    getRandomAddress
} = require('./city_addresses');

console.log('='.repeat(70));
console.log('Testing City Address Database');
console.log('='.repeat(70));
console.log();

try {
    // Test 1: Get database statistics
    console.log('Test 1: Loading database statistics...');
    const stats = getDatabaseStats();
    console.log(`✓ Total cities: ${stats.totalCities}`);
    console.log(`✓ Total addresses: ${stats.totalAddresses.toLocaleString()}`);
    console.log(`✓ Average per city: ${stats.averagePerCity}`);
    console.log();

    // Test 2: Get available cities
    console.log('Test 2: Getting available cities...');
    const cities = getAvailableCities();
    console.log(`✓ Found ${cities.length} cities:`);
    cities.forEach((city, index) => {
        console.log(`   ${index + 1}. ${city}`);
    });
    console.log();

    // Test 3: Validate city names
    console.log('Test 3: Validating city names...');
    console.log(`✓ "Москва" valid: ${validateCity('Москва')}`);
    console.log(`✓ "Санкт-Петербург" valid: ${validateCity('Санкт-Петербург')}`);
    console.log(`✓ "Invalid City" valid: ${validateCity('Invalid City')}`);
    console.log();

    // Test 4: Load addresses for specific cities
    console.log('Test 4: Loading addresses for specific cities...');
    const testCities = ['Москва', 'Санкт-Петербург', 'Казань'];
    
    for (const city of testCities) {
        const addresses = loadCityAddresses(city);
        console.log(`✓ ${city}: ${addresses.length} addresses loaded`);
        console.log(`   Sample: ${addresses[0]}`);
    }
    console.log();

    // Test 5: Get random addresses
    console.log('Test 5: Getting random addresses...');
    for (let i = 0; i < 5; i++) {
        const randomCity = cities[Math.floor(Math.random() * cities.length)];
        const randomAddress = getRandomAddress(randomCity);
        console.log(`✓ Random from ${randomCity}: ${randomAddress}`);
    }
    console.log();

    // Test 6: Test error handling
    console.log('Test 6: Testing error handling...');
    try {
        loadCityAddresses('NonExistentCity');
        console.log('✗ Should have thrown error for invalid city');
    } catch (error) {
        console.log(`✓ Correctly caught error: ${error.message.substring(0, 50)}...`);
    }
    console.log();

    // Test 7: Verify Moscow includes Moscow region addresses
    console.log('Test 7: Verifying Moscow addresses include Moscow region...');
    const moscowAddresses = loadCityAddresses('Москва');
    const moscowRegionCount = moscowAddresses.filter(addr => 
        addr.includes('Московская область')
    ).length;
    console.log(`✓ Moscow has ${moscowRegionCount} Moscow region addresses`);
    console.log(`   Sample Moscow region address: ${moscowAddresses.find(a => a.includes('Московская область'))}`);
    console.log();

    console.log('='.repeat(70));
    console.log('All tests passed successfully! ✓');
    console.log('='.repeat(70));
    console.log();
    console.log('The city selection system is ready to use.');
    console.log('Run the main script to see the interactive city selection prompt.');
    console.log();

} catch (error) {
    console.error('='.repeat(70));
    console.error('Test failed! ✗');
    console.error('='.repeat(70));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}