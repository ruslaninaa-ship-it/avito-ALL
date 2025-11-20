const puppeteer = require('puppeteer');
const loginToAvito = require('./avito_login');

// Test data with various facade material and color combinations
const testAds = [
    {
        title: "Test Ad 1 - Single Material and Color",
        parameters: JSON.stringify({
            "Материал фасада": "ДСП",
            "Цвет фасада": "Белый"
        })
    },
    {
        title: "Test Ad 2 - Multiple Materials",
        parameters: JSON.stringify({
            "Материал фасада": "ДСП, МДФ",
            "Цвет фасада": "Белый"
        })
    },
    {
        title: "Test Ad 3 - Multiple Colors",
        parameters: JSON.stringify({
            "Материал фасада": "МДФ",
            "Цвет фасада": "Белый, Чёрный"
        })
    },
    {
        title: "Test Ad 4 - Array Materials and Colors",
        parameters: JSON.stringify({
            "Материал фасада": ["ДСП", "МДФ", "Массив дерева"],
            "Цвет фасада": ["Белый", "Серый", "Коричневый"]
        })
    },
    {
        title: "Test Ad 5 - Invalid Data",
        parameters: JSON.stringify({
            "Материал фасада": "InvalidMaterial",
            "Цвет фасада": "InvalidColor"
        })
    },
    {
        title: "Test Ad 6 - Empty Parameters",
        parameters: JSON.stringify({})
    }
];

async function testFacadeSelection() {
    let browser;
    let page;

    try {
        console.log('Starting facade selection test...');

        // Login to Avito
        page = await loginToAvito();
        console.log('Logged in to Avito');

        for (let i = 0; i < testAds.length; i++) {
            const ad = testAds[i];
            console.log(`\n=== Testing Ad ${i + 1}: ${ad.title} ===`);

            try {
                // Navigate to add item page
                await page.goto('https://www.avito.ru/additem', { waitUntil: 'networkidle2', timeout: 30000 });
                console.log('Navigated to additem page');

                // Wait for category selection
                await page.waitForSelector('button[data-marker="category-wizard/button"]', { timeout: 10000 });
                await page.click('button[data-marker="category-wizard/button"]');
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Wait for title input and fill it
                await page.waitForSelector('input[data-marker="title-field-23/input"]', { timeout: 10000 });
                await page.type('input[data-marker="title-field-23/input"]', ad.title);
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Click category title button
                try {
                    await page.waitForSelector('button[data-marker="category-title"]', { timeout: 10000 });
                    await page.click('button[data-marker="category-title"]');
                    console.log('Clicked category title button');
                } catch (error) {
                    console.log('Category title button not found:', error.message);
                }

                // Dismiss banner
                try {
                    const closeSelectors = ['.popup-close', '.modal-close', '.banner-close', '[data-marker*="close"]'];
                    for (const selector of closeSelectors) {
                        try {
                            await page.waitForSelector(selector, { timeout: 2000 });
                            await page.click(selector);
                            console.log(`Dismissed banner with selector: ${selector}`);
                            break;
                        } catch (e) {}
                    }
                    await page.click('body');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (dismissError) {
                    console.log('Error dismissing banner:', dismissError.message);
                }

                // Select sale type
                try {
                    const saleType = 'Товар произведён мной';
                    const clicked = await page.evaluate((type) => {
                        const labels = Array.from(document.querySelectorAll('label, span, div'));
                        const option = labels.find(el => el.textContent.trim() === type);
                        if (option) {
                            const input = option.querySelector('input[type="radio"]') || option.closest('label')?.querySelector('input');
                            if (input) {
                                input.click();
                                return true;
                            } else {
                                option.click();
                                return true;
                            }
                        }
                        return false;
                    }, saleType);

                    if (clicked) {
                        console.log(`Selected sale type: ${saleType}`);
                    } else {
                        console.log(`Could not find sale type: ${saleType}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (selectError) {
                    console.log('Error selecting sale type:', selectError.message);
                }

                // Select condition
                try {
                    const condition = "Новое";
                    const clicked = await page.evaluate((cond) => {
                        const labels = Array.from(document.querySelectorAll('label, span, div'));
                        const option = labels.find(el => el.textContent.trim() === cond);
                        if (option) {
                            const input = option.querySelector('input[type="radio"]') || option.closest('label')?.querySelector('input');
                            if (input) {
                                input.click();
                                return true;
                            } else {
                                option.click();
                                return true;
                            }
                        }
                        return false;
                    }, condition);

                    if (clicked) {
                        console.log(`Selected condition: ${condition}`);
                    } else {
                        console.log(`Could not find condition: ${condition}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (selectError) {
                    console.log('Error selecting condition:', selectError.message);
                }

                // Select kitchen type
                try {
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    const kitchenType = parsedParams["Тип кухни"] || "Готовая";
                    let optionText = "Готовая"; // default

                    if (kitchenType === "Готовая") {
                        optionText = "Готовая";
                    } else if (kitchenType === "На заказ") {
                        optionText = "На заказ";
                    } else if (kitchenType === "Модульная") {
                        optionText = "Модульная";
                    }

                    console.log(`Selecting kitchen type: ${optionText}`);
                    const clicked = await page.evaluate((text) => {
                        const spans = Array.from(document.querySelectorAll('span'));
                        const option = spans.find(span => span.textContent.trim() === text);
                        if (option) {
                            option.click();
                            return true;
                        }
                        return false;
                    }, optionText);

                    if (clicked) {
                        console.log(`Clicked kitchen type: ${optionText}`);
                    } else {
                        console.log(`Could not find kitchen type: ${optionText}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (selectError) {
                    console.log('Error selecting kitchen type:', selectError.message);
                }

                // Test facade material selection
                console.log('Testing facade material selection...');
                try {
                    // Click on the material search input
                    await page.click('input[data-marker="material_fasada/search-input"]');
                    console.log('✓ Clicked facade material search input');
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Retrieve facade material data from parameters
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    let facadeMaterials = parsedParams["Материал фасада"];
                    if (!facadeMaterials) {
                        console.log('No facade material found in parameters');
                    } else {
                        // Handle multiple materials
                        if (typeof facadeMaterials === 'string') {
                            facadeMaterials = facadeMaterials.split(',').map(m => m.trim());
                        } else if (Array.isArray(facadeMaterials)) {
                            // already array
                        } else {
                            facadeMaterials = [facadeMaterials.toString()];
                        }

                        console.log(`Materials to select: ${facadeMaterials.join(', ')}`);

                        // Select matching options
                        for (const material of facadeMaterials) {
                            console.log(`Selecting facade material: ${material}`);
                            const clicked = await page.evaluate((mat) => {
                                const buttons = Array.from(document.querySelectorAll('button[data-marker*="material_fasada/custom-option"]'));
                                const target = buttons.find(btn => btn.textContent.trim() === mat);
                                if (target) {
                                    target.click();
                                    return true;
                                }
                                return false;
                            }, material);

                            if (clicked) {
                                console.log(`✓ Clicked facade material: ${material}`);
                            } else {
                                console.log(`✗ Could not find facade material: ${material}`);
                            }

                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                } catch (materialError) {
                    console.log('✗ Error selecting facade material:', materialError.message);
                }

                // Test facade color selection
                console.log('Testing facade color selection...');
                try {
                    // Click on the color dropdown button
                    await page.click('div[data-marker="osnovnoy_cvet"]');
                    console.log('✓ Clicked facade color dropdown button');
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Retrieve facade color data from parameters
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    let facadeColors = parsedParams["Цвет фасада"];
                    if (!facadeColors) {
                        console.log('No facade color found in parameters');
                    } else {
                        // Handle multiple colors
                        if (typeof facadeColors === 'string') {
                            facadeColors = facadeColors.split(',').map(c => c.trim());
                        } else if (Array.isArray(facadeColors)) {
                            // already array
                        } else {
                            facadeColors = [facadeColors.toString()];
                        }

                        console.log(`Colors to select: ${facadeColors.join(', ')}`);

                        // Select matching options
                        for (const color of facadeColors) {
                            console.log(`Selecting facade color: ${color}`);
                            const clicked = await page.evaluate((col) => {
                                const buttons = Array.from(document.querySelectorAll('button[data-marker*="osnovnoy_cvet/custom-option"]'));
                                const target = buttons.find(btn => btn.textContent.trim() === col);
                                if (target) {
                                    target.click();
                                    return true;
                                }
                                return false;
                            }, color);

                            if (clicked) {
                                console.log(`✓ Clicked facade color: ${color}`);
                            } else {
                                console.log(`✗ Could not find facade color: ${color}`);
                            }

                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                } catch (colorError) {
                    console.log('✗ Error selecting facade color:', colorError.message);
                }

                // Test столешница в комплекте selection
                console.log('Testing столешница в комплекте selection...');
                try {
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    const countertopIncluded = parsedParams["Столешница в комплекте"];
                    if (countertopIncluded && (countertopIncluded === "Есть" || countertopIncluded === "Нет")) {
                        console.log(`Selecting столешница в комплекте: ${countertopIncluded}`);
                        const clicked = await page.evaluate((value) => {
                            const spans = Array.from(document.querySelectorAll('span'));
                            const option = spans.find(span => span.textContent.trim() === value);
                            if (option) {
                                option.click();
                                return true;
                            }
                            return false;
                        }, countertopIncluded);

                        if (clicked) {
                            console.log(`✓ Clicked столешница в комплекте: ${countertopIncluded}`);
                        } else {
                            console.log(`✗ Could not find столешница в комплекте: ${countertopIncluded}`);
                        }

                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        console.log('No valid столешница в комплекте parameter found');
                    }
                } catch (error) {
                    console.log('✗ Error selecting столешница в комплекте:', error.message);
                }

                // Take screenshot for verification
                const screenshotPath = `test_facade_${i + 1}_${Date.now()}.png`;
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`Screenshot saved: ${screenshotPath}`);

                console.log(`✓ Test Ad ${i + 1} completed successfully`);

            } catch (adError) {
                console.error(`✗ Error testing ad ${i + 1}:`, adError.message);
            }

            // Wait between tests
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.log('\n=== All facade selection tests completed ===');

    } catch (error) {
        console.error('Error in testFacadeSelection:', error);
        throw error;
    }
}

// Run the test
testFacadeSelection().catch(console.error);