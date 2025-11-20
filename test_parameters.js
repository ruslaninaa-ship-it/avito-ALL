const { readSheetData } = require('./sheets');

async function testParameters() {
  try {
    const ads = await readSheetData();
    console.log('Total ads read:', ads.length);
    console.log('First few ads with parameters field:');

    // Log parameters for first 5 ads (or all if less than 5)
    const numToLog = Math.min(5, ads.length);
    for (let i = 0; i < numToLog; i++) {
      const ad = ads[i];
      console.log(`\nAd ${i + 1}:`);
      console.log('Parameters field:', ad.parameters);
      console.log('Type of parameters:', typeof ad.parameters);

      // Try to parse as JSON to check if it's a JSON string
      if (ad.parameters) {
        try {
          const parsed = JSON.parse(ad.parameters);
          console.log('Parsed as JSON:', parsed);
          console.log('Is JSON string: Yes');
        } catch (e) {
          console.log('Is JSON string: No (appears to be plain text)');
        }
      } else {
        console.log('Parameters field is empty or undefined');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testParameters();