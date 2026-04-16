// Fetch all rounds in progress from Supabase
import { supabase } from './supabase'

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
  return data;
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
