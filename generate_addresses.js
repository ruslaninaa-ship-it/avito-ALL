const fs = require('fs');
const path = require('path');

// Street types in Russian
const streetTypes = ['улица', 'проспект', 'переулок', 'бульвар', 'площадь', 'шоссе', 'набережная'];

// Common street names for numbered streets
const numberedStreetPrefixes = ['', '1-я', '2-я', '3-я', '4-я', '5-я', '6-я', '7-я', '8-я', '9-я', '10-я'];

// Famous Russian street names (subset for variety)
const famousStreetNames = [
    'Ленина', 'Советская', 'Пушкина', 'Гагарина', 'Комсомольская', 'Мира', 
    'Победы', 'Кирова', 'Горького', 'Чехова', 'Достоевского', 'Толстого',
    'Красная', 'Центральная', 'Зеленая', 'Новая', 'Садовая', 'Школьная',
    'Парковая', 'Лесная', 'Молодежная', 'Рабочая', 'Строителей', 'Энергетиков',
    'Октябрьская', 'Первомайская', 'Московская', 'Заречная', 'Набережная',
    'Железнодорожная', 'Вокзальная', 'Малая', 'Большая', 'Тверская',
    'Арбат', 'Маяковского', 'Есенина', 'Суворова', 'Жуковского', 'Некрасова'
];

// Neighborhood/district names for variety
const districts = [
    'Центральный', 'Северный', 'Южный', 'Восточный', 'Западный',
    'Ленинский', 'Советский', 'Октябрьский', 'Промышленный', 'Заводской'
];

/**
 * Generate a random building number
 * @returns {string} Building number (1-200, sometimes with letter)
 */
function generateBuildingNumber() {
    const number = Math.floor(Math.random() * 200) + 1;
    // 20% chance to add a letter suffix (корпус)
    if (Math.random() < 0.2) {
        const letters = ['А', 'Б', 'В', 'Г'];
        return `${number}${letters[Math.floor(Math.random() * letters.length)]}`;
    }
    return number.toString();
}

/**
 * Generate a random street name with type
 * @returns {string} Street name with type (e.g., "улица Ленина", "проспект Мира")
 */
function generateStreetName() {
    const streetType = streetTypes[Math.floor(Math.random() * streetTypes.length)];
    
    // 40% chance for numbered street
    if (Math.random() < 0.4) {
        const prefix = numberedStreetPrefixes[Math.floor(Math.random() * numberedStreetPrefixes.length)];
        const streetName = famousStreetNames[Math.floor(Math.random() * famousStreetNames.length)];
        return prefix ? `${streetType} ${prefix} ${streetName}` : `${streetType} ${streetName}`;
    }
    
    // Otherwise use a famous name
    const streetName = famousStreetNames[Math.floor(Math.random() * famousStreetNames.length)];
    return `${streetType} ${streetName}`;
}

/**
 * Generate addresses for a specific city
 * @param {string} cityName - Name of the city
 * @param {number} count - Number of addresses to generate
 * @returns {Array<string>} Array of addresses
 */
function generateAddressesForCity(cityName, count = 3000) {
    const addresses = new Set(); // Use Set to avoid duplicates
    
    // For Moscow region, add some variation
    const isMoscow = cityName === 'Москва';
    
    while (addresses.size < count) {
        const streetName = generateStreetName();
        const buildingNumber = generateBuildingNumber();
        const address = `${cityName}, ${streetName}, ${buildingNumber}`;
        addresses.add(address);
        
        // For Moscow, occasionally add "Московская область" addresses
        if (isMoscow && Math.random() < 0.15 && addresses.size < count) {
            const moscowSuburbs = ['Одинцово', 'Химки', 'Мытищи', 'Балашиха', 'Подольск', 'Королёв', 'Люберцы'];
            const suburb = moscowSuburbs[Math.floor(Math.random() * moscowSuburbs.length)];
            const suburbAddress = `Московская область, ${suburb}, ${streetName}, ${buildingNumber}`;
            addresses.add(suburbAddress);
        }
    }
    
    return Array.from(addresses).slice(0, count);
}

/**
 * Generate the complete database of addresses for all cities
 * @returns {Object} Object with city names as keys and address arrays as values
 */
function generateAddressDatabase() {
    const cities = [
        'Москва',
        'Санкт-Петербург',
        'Новосибирск',
        'Екатеринбург',
        'Казань',
        'Нижний Новгород',
        'Челябинск',
        'Самара',
        'Омск',
        'Ростов-на-Дону',
        'Уфа',
        'Красноярск',
        'Воронеж',
        'Пермь',
        'Волгоград'
    ];
    
    const database = {};
    
    console.log('Generating address database for Russian cities...');
    console.log('This may take a moment...\n');
    
    for (const city of cities) {
        console.log(`Generating 3000 addresses for ${city}...`);
        database[city] = generateAddressesForCity(city, 3000);
        console.log(`✓ ${city}: ${database[city].length} addresses generated`);
    }
    
    return database;
}

/**
 * Main function to generate and save the address database
 */
function main() {
    console.log('='.repeat(60));
    console.log('Russian Cities Address Database Generator');
    console.log('='.repeat(60));
    console.log();
    
    // Generate the database
    const database = generateAddressDatabase();
    
    // Calculate statistics
    const totalCities = Object.keys(database).length;
    const totalAddresses = Object.values(database).reduce((sum, arr) => sum + arr.length, 0);
    
    console.log('\n' + '='.repeat(60));
    console.log('Generation Complete');
    console.log('='.repeat(60));
    console.log(`Total cities: ${totalCities}`);
    console.log(`Total addresses: ${totalAddresses.toLocaleString()}`);
    console.log(`Average per city: ${Math.round(totalAddresses / totalCities)}`);
    console.log();
    
    // Save to JSON file
    const outputPath = path.join(__dirname, 'russian_cities_addresses.json');
    console.log(`Saving database to: ${outputPath}`);
    
    fs.writeFileSync(
        outputPath,
        JSON.stringify(database, null, 2),
        'utf8'
    );
    
    console.log('✓ Database saved successfully!');
    console.log();
    console.log('Sample addresses for each city:');
    console.log('-'.repeat(60));
    
    for (const [city, addresses] of Object.entries(database)) {
        console.log(`\n${city}:`);
        console.log(`  ${addresses[0]}`);
        console.log(`  ${addresses[1]}`);
        console.log(`  ${addresses[2]}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Done! You can now use the address database in your application.');
    console.log('='.repeat(60));
}

// Run the generation if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = { generateAddressDatabase, generateAddressesForCity };