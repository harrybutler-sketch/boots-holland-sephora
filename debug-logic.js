
const workspace = 'grocery';
const retailers = ['Sainsburys', 'Tesco', 'Asda', 'Morrisons', 'Ocado', 'Waitrose'];

console.log('Testing with retailers:', retailers);

const startUrls = [];
if (workspace === 'grocery') {
    const groceryMap = {
        'Sainsburys': 'https://www.sainsburys.co.uk/gol-ui/features/new-in',
        'Tesco': 'https://www.tesco.com/groceries/en-GB/search?query=new%20in',
        'Asda': 'https://groceries.asda.com/search/new%20in',
        'Morrisons': 'https://groceries.morrisons.com/categories/new/192077',
        'Ocado': 'https://www.ocado.com/search?entry=new%20in',
        'Waitrose': 'https://www.waitrose.com/ecom/shop/browse/groceries/new'
    };

    retailers.forEach(retailer => {
        if (groceryMap[retailer]) {
            console.log(`Adding ${retailer}: ${groceryMap[retailer]}`);
            startUrls.push({
                url: groceryMap[retailer],
                userData: { retailer }
            });
        } else {
            console.log(`Skipping ${retailer} (not in map)`);
        }
    });
}

console.log('Final startUrls count:', startUrls.length);
console.log(JSON.stringify(startUrls, null, 2));
