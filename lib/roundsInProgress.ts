// Fetch all rounds in progress from Supabase
import { supabase } from './supabase'

// Constants for inactivity timeout
// Auto-complete rounds inactive for 4 hours
const INACTIVITY_TIMEOUT_HOURS = 4
const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_HOURS * 60 * 60 * 1000

/**
 * Check if a round has been inactive for more than the timeout period
 */
function isRoundInactive(round: any): boolean {
  if (!round.updated_at) {
    return false;
  }
  // Ensure ISO string has 'Z' suffix for proper UTC parsing
  const isoString = round.updated_at.endsWith('Z') ? round.updated_at : round.updated_at + 'Z';
  const lastUpdateTime = new Date(isoString).getTime();
  const now = Date.now();
  const inactiveMs = now - lastUpdateTime;
  const isInactive = inactiveMs > INACTIVITY_TIMEOUT_MS;
  
  return isInactive;
}

/**
 * Auto-complete an inactive round by deleting it
 */
async function autoCompleteRound(roundId: string): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase
      .from('rounds')
      .delete()
      .eq('id', roundId)
    
    if (error) {
      console.error(`Error auto-deleting round ${roundId}:`, error)
    }
  } catch (err) {
    console.error(`Exception auto-deleting round ${roundId}:`, err)
  }
}

export async function getRoundsInProgress() {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('in_progress', true)
    .order('date', { ascending: false });
  if (error) throw error;
  
  // Fetch course IDs from join table for each round
  let roundsWithCourses = data || [];
  if (roundsWithCourses.length > 0) {
    roundsWithCourses = await Promise.all(
      roundsWithCourses.map(async (round: any) => {
        const { data: courseLinks, error: joinError } = await supabase
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
  
  // Check for inactive rounds and auto-complete them
  if (roundsWithCourses && roundsWithCourses.length > 0) {
    for (const round of roundsWithCourses) {
      if (isRoundInactive(round)) {
        await autoCompleteRound(round.id)
      }
    }
    
    // Return only active rounds (filter out the ones we just auto-completed)
    const activeRounds = roundsWithCourses.filter(round => !isRoundInactive(round));
    return activeRounds;
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
