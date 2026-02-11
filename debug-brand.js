
const item = {
    title: "Diet Coke 8 x 330ml Cherry Cans",
    brand: "Diet", // Simulating the bad data
    manufacturer: "Diet", // Simulating the bad data
    retailer: "Sainsburys",
    url: "https://www.sainsburys.co.uk/gol-ui/product/diet-coke-cherry-8x330ml"
};

function processItem(item) {
    const name = item.title || item.name || '';

    // Logic from run-status.js
    const rawBrand = item.brand || item.brandName || '';
    let brandName = (typeof rawBrand === 'string' ? rawBrand : '') || '';

    if (brandName) {
        brandName = brandName.replace(/^Shop all\s+/i, '').trim();

        // The fix should go here
        const bannedBrands = ['boots logo', 'boots', 'diet']; // Testing the fix
        if (bannedBrands.includes(brandName.toLowerCase())) {
            console.log(`Banned brand detected: ${brandName}`);
            brandName = '';
        }
    }

    // Fallback logic check
    if (!brandName && name) {
        const words = name.split(' ');
        if (words.length > 0) {
            const firstTwo = words.slice(0, 2).join(' ');
            console.log(`Fallback 1st word: ${words[0]}`);
            console.log(`Fallback 2nd words: ${firstTwo}`);

            // This replicates the logic in run-status.js line 226
            // "Diet Coke" -> "Diet" (1st word) or "Diet Coke" (2 words)?
            // The code in run-status.js uses firstOne if not a retailer name.
            // But wait, "Diet" is the first word of "Diet Coke". 
            // If we ban "Diet" as an explicit brand, the fallback might JUST pick it up again if we aren't careful?

            // Let's trace run-status.js lines 214-231:
            // if (!brandName && name) {
            //    const words = name.split(' ');
            //    ...
            //    } else if (words.length > 1 && /^[A-Z]/.test(firstOne)) {
            //        brandName = firstOne; 
            //    }
            // }

            // If name is "Diet Coke...", firstOne is "Diet". 
            // If we wipe "Diet" from the explicit brand, the fallback will set generic brandName = "Diet". 
            // We need to handle multi-word brands better, or specifically "Diet Coke".

            if (firstTwo.toLowerCase() === 'diet coke') {
                brandName = 'Diet Coke';
            } else if (words.length > 1 && /^[A-Z]/.test(words[0])) {
                // If the fallback sets it to "Diet", we are back to square one.
                if (words[0].toLowerCase() === 'diet') {
                    brandName = 'Diet Coke'; // or try to grab 2 words?
                } else {
                    brandName = words[0];
                }
            }
        }
    }

    return brandName;
}

console.log('Processed Brand:', processItem(item));
