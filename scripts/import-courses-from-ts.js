// scripts/import-courses-from-ts.js
// Usage: node scripts/import-courses-from-ts.js
// Requires: npm install @supabase/supabase-js ts-node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { COURSES_DATABASE } = require('../data/courses');

// Set these environment variables or hardcode for quick test
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function importCourses() {
  for (const course of COURSES_DATABASE) {
    // Remove any fields not in your DB schema if needed
    const { error } = await supabase.from('courses').insert([{ ...course }]);
    if (error) {
      console.error(`Error inserting course ${course.name}:`, error.message);
    } else {
      console.log(`Inserted course: ${course.name}`);
    }
  }
  console.log('Import complete.');
}

importCourses();
