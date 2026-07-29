const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../admin.js');
const content = fs.readFileSync(filePath, 'utf-8');

// Regex to find functions
const funcRegex = /(?:async\s+)?function\s+(\w+)\s*\(/g;
let match;
const counts = {};

while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1];
    counts[name] = (counts[name] || 0) + 1;
}

const duplicates = {};
for (const [key, value] of Object.entries(counts)) {
    if (value > 1) {
        duplicates[key] = value;
    }
}

console.log("Duplicate functions:", duplicates);
