const { readSheetData, processPhotoUrls } = require('./sheets');

async function testPhotoProcessing() {
  try {
    console.log('Testing photo URL processing...');
    const ads = await readSheetData();
    console.log(`Total ads read: ${ads.length}`);

    // Process photo URLs for all ads
    const photoUrlsArray = processPhotoUrls(ads);
    console.log(`Processed photo URLs for ${photoUrlsArray.length} ads`);

    // Show details for first few ads with photos
    let adsWithPhotos = 0;
    for (let i = 0; i < Math.min(ads.length, 10); i++) {
      const ad = ads[i];
      const photoUrls = photoUrlsArray[i];
      if (photoUrls && photoUrls.length > 0) {
        adsWithPhotos++;
        console.log(`\nAd ${i + 1} (${ad.title || 'Untitled'}):`);
        console.log(`  Photos field: "${ad.photos || ad['photos'] || ''}"`);
        console.log(`  Processed URLs (${photoUrls.length}):`, photoUrls);
      }
    }

    console.log(`\nSummary:`);
    console.log(`  Total ads: ${ads.length}`);
    console.log(`  Ads with photos: ${adsWithPhotos}`);
    console.log(`  Ads without photos: ${ads.length - adsWithPhotos}`);

    // Test URL validation
    console.log('\nTesting URL validation...');
    const testUrls = [
      'https://example.com/photo.jpg',
      'http://example.com/photo.png',
      'invalid-url',
      'https://photu.ru/img_cache_WQJ04_dfffe1b49417f7fa4977064c1503969c/w/',
      '',
      '   ',
      null,
      undefined
    ];

    for (const url of testUrls) {
      try {
        if (url) {
          new URL(url.trim());
          console.log(`  ✓ Valid: "${url}"`);
        } else {
          console.log(`  - Empty/null: "${url}"`);
        }
      } catch (error) {
        console.log(`  ✗ Invalid: "${url}" - ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Error in test:', error);
  }
}

testPhotoProcessing();