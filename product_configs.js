/**
 * Product-specific configurations for Avito automation
 * Each product type can have independent settings
 */

const PRODUCT_CONFIGS = {
    kitchen: {
        // Категория Avito
        category: 'Личные вещи',

        // Состояние товара (для выбора рандома между опциями)
        condition_options: ['Новое'], // только новое для кухонь

        // Тип продажи (для выбора рандома)
        sale_type_options: ['Товар произведён мной', 'Товар куплен на продажу'],

        // Единица измерения цены (если null - обычная цена)
        price_unit: 'за погонный метр',

        // Процесс публикации (в будущем можно добавить специфические шаги)
        publishing_steps: ['basic'], // базовый процесс

        // Дополнительные настройки (резерв для будущего)
        additional_settings: {
            random_facade_surface: true, // рандом глянцевая/матовая
            equipment_selection: true  // выбирать кухонное оборудование
        }
    },

    curtains: {
        // Категория Avito
        category: 'Для дома и дачи',

        // Состояние товара (можно добавить рандом БУ/новое)
        condition_options: ['Новое', 'Б/У'], // можно рандом между новым и БУ

        // Тип продажи
        sale_type_options: ['Товар произведён мной'],

        // Единица измерения цены
        price_unit: null, // обычная цена без единицы

        // Процесс публикации (для штор может быть другой процесс)
        publishing_steps: ['basic'], // базовый, но можно расширить

        // Дополнительные настройки
        additional_settings: {
            // специфические параметры для штор
            fabric_type: false, // если нужно выбирать тип ткани
            blackout_curtains: false // светонепроницаемые и т.д.
        }
    }
};

/**
 * Получить конфиг для продукта
 * @param {string} productType - Тип продукта ('kitchen' или 'curtains')
 * @returns {Object} Конфигурация продукта
 */
function getProductConfig(productType) {
    return PRODUCT_CONFIGS[productType] || PRODUCT_CONFIGS.kitchen;
}

/**
 * Получить случайный вариант из массива опций
 * @param {Array} options - Массив опций
 * @returns {*} Случайный вариант
 */
function getRandomOption(options) {
    if (!Array.isArray(options) || options.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex];
}

/**
 * Рандомное состояние товара для продукта
 * @param {string} productType - Тип продукта
 * @returns {string} Состояние товара
 */
function getRandomCondition(productType) {
    const config = getProductConfig(productType);
    const condition = getRandomOption(config.condition_options);

    // Логика обратно совместимости - если массив с одним элементом "Новое"
    if (condition === 'Новое') {
        return 'Новое';
    }

    return condition || 'Новое'; // fallback
}

/**
 * Рандомный тип продажи для продукта
 * @param {string} productType - Тип продукта
 * @returns {string} Тип продажи
 */
function getRandomSaleType(productType) {
    const config = getProductConfig(productType);
    return getRandomOption(config.sale_type_options) || 'Товар произведён мной';
}

/**
 * Получить единицу измерения цены для продукта
 * @param {string} productType - Тип продукта
 * @returns {string|null} Единица измерения или null
 */
function getPriceUnit(productType) {
    const config = getProductConfig(productType);
    return config.price_unit;
}

module.exports = {
    PRODUCT_CONFIGS,
    getProductConfig,
    getRandomCondition,
    getRandomSaleType,
    getPriceUnit,
    getRandomOption
};
