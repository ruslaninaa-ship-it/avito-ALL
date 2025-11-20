const { readSheetData } = require('./sheets');

async function test() {
  try {
    const ads = await readSheetData();
    console.log('Ads from sheet:', ads);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();