import { createClient } from '@supabase/supabase-js';
import { COURSES_DATABASE } from '../data/courses.ts';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);


async function importCourses() {
  for (const course of COURSES_DATABASE) {
    // Map camelCase to snake_case for DB compatibility
    const dbCourse = { ...course, hole_count: course.holeCount };
    delete dbCourse.holeCount;
    const { error } = await supabase.from('courses').upsert([dbCourse], { onConflict: 'id' });
    if (error) {
      console.error(`Error inserting course ${course.name}:`, error.message);
    } else {
      console.log(`Inserted course: ${course.name}`);
    }
  }
  console.log('Import complete.');
}

importCourses();
