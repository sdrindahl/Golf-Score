// Script to import green locations from CSV into courses.ts
// Usage: node scripts/import-green-locations.js

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const coursesPath = path.join(__dirname, '../data/courses.ts');
const csvPath = path.join(__dirname, '../data/green-locations.csv');


function updateGreenLocations() {
  // Read CSV
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const records = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  // Read courses.ts as text
  let coursesText = fs.readFileSync(coursesPath, 'utf8');

  // For each record, update the corresponding greenLat/greenLng in coursesText
  records.forEach(({ id, holeNumber, greenLat, greenLng }) => {
    if (!id || !holeNumber || !greenLat || !greenLng) return;
    // Even more robust regex to match greenLat and greenLng for the correct id and holeNumber
    // Handles whitespace, optional trailing commas, and any formatting
    const regex = new RegExp(
      `id: ['"]${id}['"][\s\S]*?holes:\s*\[[\s\S]*?\{[^\}]*?holeNumber:\s*${holeNumber}[^\}]*?greenLat:\s*-?\d*\.?\d*\s*,\s*greenLng:\s*-?\d*\.?\d*`,
      'm'
    );
    coursesText = coursesText.replace(regex, (match) => {
      // Replace greenLat and greenLng in the matched string
      return match
        .replace(/greenLat:\s*-?\d*\.?\d*/, `greenLat: ${greenLat}`)
        .replace(/greenLng:\s*-?\d*\.?\d*/, `greenLng: ${greenLng}`);
    });
  });

  // Write back to courses.ts
  fs.writeFileSync(coursesPath, coursesText, 'utf8');
  console.log('Green locations updated in courses.ts');
}

updateGreenLocations();
