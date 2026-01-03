const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'pages', 'CaseDetail.tsx');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Regex to find className attributes (with braces or quotes)
    // We capture the content inside className={`...`} or className="..."
    // Note: This matches simple cases. Nested backticks or complex logic might need care, 
    // but the issue is in the static string parts of the template literals.

    // Pattern 1: className={`...`}
    content = content.replace(/className={`([^`]+)`}/g, (match, classString) => {
        // Replace " - " with "-" inside the backticked string
        const fixed = classString.replace(/\s+-\s+/g, '-');
        return `className={\`${fixed}\`}`;
    });

    // Pattern 2: className="..."
    content = content.replace(/className="([^"]+)"/g, (match, classString) => {
        const fixed = classString.replace(/\s+-\s+/g, '-');
        return `className="${fixed}"`;
    });

    // Also fix specific lingering patterns just in case they're outside the main capture (unlikely but safe)
    content = content.replace(/w\s+-\s+full/g, 'w-full');
    content = content.replace(/p\s+-\s+2/g, 'p-2');
    content = content.replace(/border\s+-\s+blue/g, 'border-blue');
    content = content.replace(/border-blue\s+-\s+300/g, 'border-blue-300'); // Fix the specific one from screenshot
    content = content.replace(/bg\s+-\s+gray/g, 'bg-gray');
    content = content.replace(/text\s+-\s+sm/g, 'text-sm');
    content = content.replace(/outline\s+-\s+none/g, 'outline-none');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully sanitised Tailwind classes in CaseDetail.tsx');

} catch (err) {
    console.error('Error fixing file:', err);
    process.exit(1);
}
