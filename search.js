const fs = require('fs');

const data = fs.readFileSync('c:\\Users\\Nitro i5-7300HQ\\Downloads\\9887\\script.js', 'utf8');
const lines = data.split('\n');
const results = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].toLowerCase().includes('splash')) {
    results.push(`${i+1}: ${lines[i].trim()}`);
  }
}
console.log("script.js:", results.join('\n'));

const cssData = fs.readFileSync('c:\\Users\\Nitro i5-7300HQ\\Downloads\\9887\\style.css', 'utf8');
const cssLines = cssData.split('\n');
const cssResults = [];
for (let i = 0; i < cssLines.length; i++) {
  if (cssLines[i].toLowerCase().includes('splash')) {
    cssResults.push(`${i+1}: ${cssLines[i].trim()}`);
  }
}
console.log("style.css:", cssResults.join('\n'));
