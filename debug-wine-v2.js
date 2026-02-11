
const items = [
    { title: "Greasy Fingers Luscious Red Wine 75Cl" },
    { title: "Ink by Grant Burge Barossa Ink Shiraz Red Wine 75cl" },
    { title: "19 Crimes The Uprising Red Wine 750Ml" },
    { title: "Oyster Bay Merlot 75Cl" },
    { title: "Wolf Blass Yellow Label Cabernet Sauvignon 75Cl" },
    { title: "I Heart Prosecco 75Cl" },
    { title: "Yellow Tail Shiraz 75Cl" },
    { title: "Silver Ghost Cabernet Sauvignon 75Cl" },
    { title: "Dark Horse Cabernet Sauvignon 75Cl" }
];

function processItem(item) {
    const name = item.title;
    const words = name.split(' ');
    let brandName = '';

    // 1. "X by Y" Pattern
    // Try to capture until a wine varietal or common stop word?
    const varietals = ['Shiraz', 'Merlot', 'Cabernet', 'Sauvignon', 'Red', 'White', 'Rose', 'Rosé', 'Chardonnay', 'Malbec', 'Pinot', 'Rioja', 'Prosecco', 'Cava', 'Champagne', 'Sparkling', 'Zinfandel', 'Grenache', 'Viognier', 'Tempranillo', 'Barossa', 'Wine'];

    // Regex: " by " followed by words that are NOT in the varietal list
    // This is hard to regex purely. Let's do string manipulation.

    if (name.includes(' by ')) {
        const parts = name.split(' by ');
        if (parts.length > 1) {
            const potentialBrandPart = parts[1];
            // Take words until we hit a varietal or size
            const brandWords = [];
            const potentialWords = potentialBrandPart.split(' ');

            for (const w of potentialWords) {
                // Heuristic: Stop at varietals, "Wine", "75cl", volumes etc.
                if (varietals.includes(w) || /^\d/.test(w) || w.toLowerCase() === 'wine') {
                    break;
                }
                brandWords.push(w);
            }
            if (brandWords.length > 0) {
                return brandWords.join(' ');
            }
        }
    }

    // 2. Known Multi-word Prefixes
    const multiWordPrefixes = [
        'Greasy', 'Oyster', 'Yellow', 'Red', 'Blue', 'Black', 'White', 'Silver', 'Gold',
        'Wolf', 'Dark', 'Mud', 'Barefoot', 'Echo', 'Jam', 'Meat', 'Trivento', 'Casillero',
        'Campo', 'Villa', 'Santa', 'Saint', 'St', 'Le', 'La', 'Les', 'El', 'Los', 'The',
        'I', 'We', 'My', 'Your', 'Our' // "I Heart"
    ];

    if (words.length > 1) {
        const first = words[0];
        const second = words[1];

        if (first === 'I' && second === 'Heart') {
            return 'I Heart';
        }

        if (first === '19' && second === 'Crimes') {
            return '19 Crimes';
        }

        if (multiWordPrefixes.includes(first)) {
            return `${first} ${second}`;
        }
    }

    return words[0];
}

items.forEach(item => {
    console.log(`"${item.title}" -> "${processItem(item)}"`);
});
