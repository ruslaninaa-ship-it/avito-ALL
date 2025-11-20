const puppeteer = require('puppeteer');
const loginToAvito = require('./avito_login');

// Test data for kitchen equipment selection
const testAds = [
    {
        title: "Test Kitchen Equipment Selection",
        parameters: JSON.stringify({
            "Тип кухни": "Готовая",
            "Форма кухни": "Прямая",
            "Ширина": 300,
            "Высота": 200,
            "Глубина нижних шкафов": 60
        })
    }
];

async function testKitchenEquipment() {
    let browser;
    let page;

    try {
        console.log('Starting kitchen equipment test...');

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

                try {
                    // Randomly select facade surface
                    const facadeOptions = ['Матовая', 'Глянцевая'];
                    const randomIndex = Math.floor(Math.random() * facadeOptions.length);
                    const selectedFacade = facadeOptions[randomIndex];
                    console.log(`Randomly selected facade surface: ${selectedFacade}`);

                    const clicked = await page.evaluate((type) => {
                        const wrappers = Array.from(document.querySelectorAll('.style-module-wrapper-sPHZh.style-module-wrapper_variant_default-ljiuF'));
                        const target = wrappers.find(wrapper => {
                            const textEl = wrapper.querySelector('.style-module-text-QIi2P.style-module-text_size_l-JNfeb');
                            return textEl && textEl.textContent.trim() === type;
                        });
                        if (target) {
                            target.click();
                            return true;
                        }
                        return false;
                    }, selectedFacade);

                    if (clicked) {
                        console.log(`Clicked facade surface: ${selectedFacade}`);
                    } else {
                        console.log(`Could not find facade surface: ${selectedFacade}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (facadeError) {
                    console.log('Error selecting facade surface:', facadeError.message);
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

                // Select столешница в комплекте
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

                // Select kitchen shape
                try {
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    const kitchenShape = parsedParams["Форма кухни"];
                    if (kitchenShape) {
                        let optionText;
                        if (kitchenShape === "1" || kitchenShape === "Прямая") {
                            optionText = "Прямая";
                        } else if (kitchenShape === "2" || kitchenShape === "Угловая") {
                            optionText = "Угловая";
                        } else if (kitchenShape === "3" || kitchenShape === "П-образная") {
                            optionText = "П-образная";
                        } else if (kitchenShape === "4" || kitchenShape === "Другая") {
                            optionText = "Другая";
                        }
                        if (optionText) {
                            console.log(`Selecting kitchen shape: ${optionText}`);
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
                                console.log(`Clicked kitchen shape: ${optionText}`);
                            } else {
                                console.log(`Could not find kitchen shape: ${optionText}`);
                            }
                        } else {
                            console.log(`No matching optionText for kitchenShape: ${kitchenShape}`);
                        }
                    } else {
                        console.log('No kitchenShape found in parameters');
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (selectError) {
                    console.log('Error selecting kitchen shape:', selectError.message);
                }

                // Fill dimensions
                try {
                    const parsedParams = JSON.parse(ad.parameters || '{}');
                    let width = parsedParams["Ширина"];
                    let height = parsedParams["Высота"];
                    let depth = parsedParams["Глубина нижних шкафов"];

                    // Fall back to default values if dimension not found or invalid
                    if (typeof width !== 'number' || isNaN(width)) {
                        width = 300;
                    }
                    if (typeof height !== 'number' || isNaN(height)) {
                        height = 200;
                    }
                    if (typeof depth !== 'number' || isNaN(depth)) {
                        depth = 60;
                    }

                    console.log(`Filling dimensions: Width=${width}cm, Height=${height}cm, Depth=${depth}cm`);

                    // Fill width
                    await page.focus('#params\\[170053\\]');
                    await page.keyboard.type(width.toString());
                    console.log('Width filled');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Fill height
                    await page.focus('#params\\[170057\\]');
                    await page.keyboard.type(height.toString());
                    console.log('Height filled');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Fill depth
                    await page.focus('#params\\[170055\\]');
                    await page.keyboard.type(depth.toString());
                    console.log('Depth filled');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.log('Error filling dimensions:', error.message);
                }

                // Test kitchen equipment selection
                console.log('Testing kitchen equipment selection...');
                try {
                    const equipmentOptions = ["Шкаф под мойку", "Шкаф под духовку", "Шкаф с ящиками", "Пенал", "Навесные шкафы", "Навесной шкаф под вытяжку", "Сушилка для посуды", "Мойка"];
                    for (const equipment of equipmentOptions) {
                        console.log(`Selecting kitchen equipment: ${equipment}`);
                        const clicked = await page.evaluate((eq) => {
                            const labels = Array.from(document.querySelectorAll('label, span, div'));
                            const option = labels.find(el => el.textContent.trim() === eq);
                            if (option) {
                                option.click();
                                return true;
                            }
                            return false;
                        }, equipment);
                        if (clicked) {
                            console.log(`✓ Clicked kitchen equipment: ${equipment}`);
                        } else {
                            console.log(`✗ Could not find kitchen equipment: ${equipment}`);
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.log('✗ Error selecting kitchen equipment:', error.message);
                }

                // Verify kitchen equipment selection
                console.log('Verifying kitchen equipment selection...');
                const equipmentOptions = ["Шкаф под мойку", "Шкаф под духовку", "Шкаф с ящиками", "Пенал", "Навесные шкафы", "Навесной шкаф под вытяжку", "Сушилка для посуды", "Мойка"];
                let allSelected = true;
                for (const equipment of equipmentOptions) {
                    const isSelected = await page.evaluate((eq) => {
                        const labels = Array.from(document.querySelectorAll('label'));
                        const label = labels.find(l => l.textContent.trim() === eq);
                        if (label) {
                            const input = label.querySelector('input[type="checkbox"]');
                            if (input) {
                                return input.checked;
                            }
                        }
                        return false;
                    }, equipment);
                    if (isSelected) {
                        console.log(`✓ ${equipment} is selected`);
                    } else {
                        console.log(`✗ ${equipment} is not selected`);
                        allSelected = false;
                    }
                }
                if (allSelected) {
                    console.log('✓ All kitchen equipment options are selected successfully');
                } else {
                    console.log('✗ Some kitchen equipment options are not selected');
                }

                // Take screenshot for verification
                const screenshotPath = `test_kitchen_equipment_${i + 1}_${Date.now()}.png`;
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`Screenshot saved: ${screenshotPath}`);

                console.log(`✓ Test Ad ${i + 1} completed successfully`);

            } catch (adError) {
                console.error(`✗ Error testing ad ${i + 1}:`, adError.message);
            }

            // Wait between tests
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.log('\n=== All kitchen equipment tests completed ===');

    } catch (error) {
        console.error('Error in testKitchenEquipment:', error);
        throw error;
    }
}

// Run the test
testKitchenEquipment().catch(console.error);