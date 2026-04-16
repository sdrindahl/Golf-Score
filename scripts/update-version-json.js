const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '../public/version.json');
const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));

const now = new Date();
versionData.buildDate = now.toISOString().slice(0, 10);
versionData.buildTime = now.toTimeString().slice(0, 8);

fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2) + '\n');
console.log('Updated buildDate and buildTime in version.json');
