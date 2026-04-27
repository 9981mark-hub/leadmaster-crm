const fs = require('fs');

const getWeekMonday = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  // Strip time part for consistency
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
};

const data = fs.readFileSync('test.csv', 'utf-8').split('\n').slice(4);

const weeks = {};

data.forEach(row => {
    const parts = row.split(',');
    if (parts.length > 3) {
        const dateStr = parts[2].trim();
        if(!dateStr || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return;
        
        const monday = getWeekMonday(dateStr);
        const weekKey = monday.toISOString().split('T')[0];
        
        const val = parts[3].replace(/\"/g, '');
        const num = parseFloat(val);
        
        if (!isNaN(num)) {
            if(!weeks[weekKey]) weeks[weekKey] = 0;
            weeks[weekKey] += num;
        }
    }
});

let total = 0;
Object.keys(weeks).sort().forEach(wk => {
    console.log(wk, ':', weeks[wk]);
    total += weeks[wk];
});
console.log('Total:', total);
