// Fetch rounds in progress from Supabase
import { supabase } from './supabase'

export async function getRoundsInProgress(userId?: string) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  let query = supabase
    .from('rounds')
    .select('*')
    .eq('in_progress', true);
  
  // Filter by user_id if provided (IMPORTANT: prevents cross-user access bug)
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query.order('date', { ascending: false });
  if (error) throw error;
  
  // Fetch course IDs from join table for each round
  let roundsWithCourses = data || [];
  if (roundsWithCourses.length > 0 && supabase) {
    roundsWithCourses = await Promise.all(
      roundsWithCourses.map(async (round: any) => {
        const { data: courseLinks, error: joinError } = await supabase!
          .from('round_courses')
          .select('course_id')
          .eq('round_id', round.id)
          .order('course_order');
        
        if (!joinError && courseLinks && courseLinks.length > 0) {
          const courseIds = courseLinks.map((rc: any) => rc.course_id);
          return {
            ...round,
            courseId: courseIds.length === 1 ? courseIds[0] : courseIds.join(','),
            course_id: courseIds.join(','), // For backward compatibility
          };
        }
        return round;
      })
    );
  }
  
  return roundsWithCourses;
}

// (Optional) Subscribe to real-time updates for rounds in progress
export function subscribeToRoundsInProgress(onUpdate: (payload: any) => void) {
  if (!supabase) return;
  return supabase
    .channel('public:rounds')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rounds', filter: 'in_progress=eq.true' },
      payload => onUpdate(payload)
    )
    .subscribe();
}
