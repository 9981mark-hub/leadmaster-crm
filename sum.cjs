const fs = require('fs');
const data = fs.readFileSync('test.csv', 'utf-8').split('\n').slice(4);
let sum = 0;
data.forEach(row => {
    const parts = row.split(',');
    if (parts.length > 3) {
        const val = parts[3].replace(/\"/g, '');
        const num = parseFloat(val);
        if (!isNaN(num)) sum += num;
    }
});
console.log('Total:', sum);
