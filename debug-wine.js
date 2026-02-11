
const items = [
    {
        title: "Greasy Fingers Luscious Red Wine 75Cl",
        brand: "",
        manufacturer: "",
        retailer: "Tesco",
        url: "https://www.tesco.com/..."
    },
    {
        title: "Ink by Grant Burge Barossa Ink Shiraz Red Wine 75cl",
        brand: "",
        manufacturer: "",
        retailer: "Tesco",
        url: "https://www.tesco.com/..."
    },
    {
        title: "19 Crimes The Uprising Red Wine 750Ml", // Another potential one
        brand: "",
        manufacturer: "",
        retailer: "Tesco",
        url: "https://www.tesco.com/..."
    },
    {
        title: "Oyster Bay Merlot 75Cl",
        brand: "",
        manufacturer: "",
        retailer: "Tesco",
        url: "https://www.tesco.com/..."
    }
];

function processItem(item) {
    const name = item.title || item.name || '';
    let brandName = item.brand || '';

    // Simulate the current logic in run-status.js

    // 3. Fallback: Search description (omitted for this filtered test as we don't have desc in screenshot)
    // But we should implement the "by X" check if we can.

    // 4. Final Fallback: Take first 1-2 words of name
    if (!brandName && name) {
        const words = name.split(' ');
        if (words.length > 0) {
            const firstOne = words[0];
            const firstTwo = words.slice(0, 2).join(' ');
            const firstThree = words.slice(0, 3).join(' ');

            const retailerKeywords = ['Tesco', 'Sainsbury', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'M&S', 'Marks'];
            const isRetailerName = retailerKeywords.some(kw => firstOne.toLowerCase().includes(kw.toLowerCase()));

            if (isRetailerName) {
                brandName = firstTwo.includes('Finest') || firstTwo.includes('Organic') || firstTwo.includes('Best') ? firstTwo : firstOne;
            } else if (words.length > 1 && /^[A-Z]/.test(firstOne)) {

                // PROPOSED FIX LOGIC HERE

                // 1. "Ink by Grant Burge"
                const byMatch = name.match(/^(.*?) by (.*?)\s/i);
                if (byMatch) {
                    // return byMatch[2] or byMatch[1]? 
                    // User said "Ink by Grant Burge" -> Manufacturer "Ink" is wrong.
                    // The brand is likely "Grant Burge" or "Barossa Ink". 
                    // Usually "Product by Brand". 
                    console.log(`[DEBUG] Found 'by' pattern: ${byMatch[0]}`);
                    brandName = byMatch[2];
                }

                // 2. Multi-word phrases that are likely brands?
                // "Greasy Fingers" -> "Greasy" is wrong.
                // "Oyster Bay" -> "Oyster" would be wrong.
                // "19 Crimes" -> "19" would be wrong.

                else if (firstOne === 'Diet') {
                    brandName = firstTwo;
                }
                // Known multi-word starts? 
                else if (['Greasy', 'Oyster', 'Yellow', 'Red', 'Blue', 'Black', 'White', 'Silver', 'Gold'].includes(firstOne)) {
                    // Colors often part of multi-word names? "Yellow Tail", "Oyster Bay"
                    brandName = firstTwo;
                }
                else if (/^\d+$/.test(firstOne)) {
                    // Starts with number? "19 Crimes"
                    brandName = firstTwo;
                }
                else {
                    // Current default
                    brandName = firstOne;
                }
            }
        }
    }

    return brandName;
}

items.forEach(item => {
    console.log(`Name: "${item.title}" -> Brand: "${processItem(item)}"`);
});
