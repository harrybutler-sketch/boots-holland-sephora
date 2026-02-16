
const ownBrandMap = {
    'Sephora': ['sephora', 'sephora collection'],
    'Holland & Barrett': ['holland', 'barrett', 'h&b', 'holland & barrett', 'holland and barrett'],
    'Sainsburys': ['sainsbury', 'hubbard', 'by sainsbury', 'sainsbury\'s', 'stamford street', 'be good to yourself', 'so organic', 'taste the difference'],
    'Tesco': ['tesco', 'stockwell', 'ms molly', 'eastman', 'finest', 'creamfields', 'grower\'s harvest', 'hearty food co', 'romano', 'willow farm', 'redmere', 'nightingale', 'boswell', 'bay fishmongers', 'woodside farms'],
    'Asda': ['asda', 'extra special', 'just essentials', 'asda logo', 'george home', 'smart price', 'farm stores'],
    'Morrisons': ['morrison', 'the best', 'savers', 'morrisons', 'nutmeg', 'market street', 'v taste'],
    'Ocado': ['ocado', 'ocado own range', 'm&s', 'marks & spencer'],
    'Waitrose': ['waitrose', 'essential waitrose', 'no.1', 'duchy organic', 'waitrose & partners', 'lovifeel'],
    'Superdrug': ['superdrug', 'b.', 'b. by superdrug', 'studio', 'solait', 'me+', 'optimum', 'artisan']
};

const bannedKeywords = ['toaster', 'blender', 'microwave', 'electrical', 'appliance', 'menswear', 'womenswear', 'clothing', 'television', 'laptop', 'vacuum', 'iron', 'kettle', 'fryer'];

function runFilters(item, retailer) {
    const name = item.title || item.name || '';
    const lowerName = name.toLowerCase();

    // 1. Review Count Filter
    const reviewCount = parseInt(item.reviews || item.ratingCount || item.reviewCount || 0);
    if (reviewCount > 5) return { skip: true, reason: `High Reviews (${reviewCount})` };

    // 2. Banned Keywords (with Kettle exception)
    const isFoodKettle = lowerName.includes('kettle') && (
        lowerName.includes('chips') ||
        lowerName.includes('crisps') ||
        lowerName.includes('popcorn') ||
        lowerName.includes('salt') ||
        lowerName.includes('seasoning') ||
        lowerName.includes('foods')
    );
    if (bannedKeywords.some(kw => lowerName.includes(kw)) && !isFoodKettle) {
        return { skip: true, reason: 'Banned Keyword' };
    }

    // 3. Own Brand Filter
    const manufacturer = (item.manufacturer || item.brand || '').toLowerCase();
    const brand = (item.brand || '').toLowerCase();
    const ownBrandKeywords = ownBrandMap[retailer] || [];

    const isOwnBrand = ownBrandKeywords.some(kw =>
        manufacturer.includes(kw) ||
        brand.includes(kw) ||
        (lowerName.startsWith(kw) && !isFoodKettle) ||
        (brand === retailer.toLowerCase())
    );

    if (isOwnBrand) return { skip: true, reason: 'Own Brand' };

    return { skip: false };
}

const testCases = [
    { retailer: 'Tesco', item: { name: 'Tesco Finest Wine', reviews: 2 }, expected: true, reason: 'Own Brand' },
    { retailer: 'Tesco', item: { name: 'Casillero del Diablo', reviews: 10 }, expected: true, reason: 'High Reviews' },
    { retailer: 'Tesco', item: { name: 'Casillero del Diablo', reviews: 3 }, expected: false },
    { retailer: 'Sainsburys', item: { name: 'Hubbard\'s Cornflakes', reviews: 0 }, expected: true, reason: 'Own Brand' },
    { retailer: 'Sainsburys', item: { name: 'Kellogg\'s Cornflakes', reviews: 1 }, expected: false },
    { retailer: 'Asda', item: { name: 'Kettle Chips Sea Salt', reviews: 2 }, expected: false },
    { retailer: 'Asda', item: { name: 'Electric Kettle', reviews: 0 }, expected: true, reason: 'Banned Keyword' },
    { retailer: 'Superdrug', item: { name: 'L\'Oreal Revitalift', reviews: 2, brand: 'L\'Oreal' }, expected: false },
    { retailer: 'Superdrug', item: { name: 'Superdrug Vitamin C', reviews: 2, brand: 'Superdrug' }, expected: true, reason: 'Own Brand' }
];

testCases.forEach((tc, i) => {
    const result = runFilters(tc.item, tc.retailer);
    const passed = result.skip === tc.expected;
    console.log(`Test ${i + 1}: ${tc.retailer} - ${tc.item.name} | Result: ${result.skip ? 'SKIP (' + result.reason + ')' : 'KEEP'} | ${passed ? '✅ PASSED' : '❌ FAILED'}`);
});
