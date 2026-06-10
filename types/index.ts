export interface TeeBox {
  yardage: number
  courseRating: number
  slopeRating: number
}

export interface Hole {
  holeNumber: number
  par: number
  handicap: number
  greenLat: number
  greenLng: number
  men: TeeBox
  women: TeeBox
  senior: TeeBox
  championship: TeeBox
}

export interface Course {
  id: string;
  name: string;
  location: string;
  state: string;
  holeCount: number;
  par: number;
  holes: Hole[];
  parent_id?: string;
}

export interface Tee {
  name: string
  color: string
  par: number
  yardage: number
}

export interface User {
  id: string
  name: string
  password: string
  is_admin?: boolean
  feature_overrides?: Record<string, boolean>
}

export type FeatureFlagAudience = 'off' | 'admins' | 'users' | 'all'

export type FeatureFlagKey =
  | 'events_core'
  | 'events_teams'
  | 'events_games'
  | 'events_public_view'
  | 'events_payouts'

export interface FeatureFlag {
  key: FeatureFlagKey
  name: string
  description?: string
  enabled: boolean
  audience: FeatureFlagAudience
  enabled_user_ids?: string[]
  updated_at?: string
  updated_by?: string | null
}

export interface FeatureFlagsResponse {
  flags: FeatureFlag[]
  source: 'supabase' | 'local'
}

export interface FeatureFlagState {
  key: FeatureFlagKey
  enabled: boolean
}

export interface FeatureFlagEvaluationContext {
  userId?: string | null
  isAdmin?: boolean
}

export type ExpenseCategory =
  | 'Greens Fees'
  | 'Equipment & Clothing'
  | 'Food & Beverages'
  | 'Winnings'
  | 'Other'

export interface Expense {
  id: string
  user_id: string
  date: string        // ISO date string YYYY-MM-DD
  category: ExpenseCategory
  amount: number
  notes?: string
  round_id?: string
  created_at?: string
  updated_at?: string
}

export interface PerHoleStats {
  /**
   * Fairway in Regulation: 'hit' (✓), 'L' (missed left), 'R' (missed right), or undefined (not set)
   */
  fairwayHit?: 'hit' | 'L' | 'R';
  gir?: boolean;
  /**
   * Array of putt distances in feet, e.g. [first, second, third, ...]
   */
  puttDistances?: number[];
  /**
   * Array of booleans: true if the putt was made, false if missed (for make % by distance)
   */
  puttResults?: boolean[];
  /**
   * For each putt, if missed, direction: 'L', 'R', 'S' (short), 'LNG' (long), or undefined
   */
  puttMissDirection?: ('L' | 'R' | 'S' | 'LNG' | undefined)[];
  /**
   * Number of putts on this hole (redundant but convenient)
   */
  putts?: number;
  /**
   * True if zero putts (chip-in)
   */
  chipIn?: boolean;
  /**
   * Drive data: start/end coordinates and measured yardage
   */
  drive?: {
    start?: { lat: number; lng: number };
    end?: { lat: number; lng: number };
    yardage?: number;
  };
  /**
   * For tracking expanded putt editor state (UI only, not persisted)
   */
  puttExpanded?: number | null;
  /**
   * True if hole was conceded (score 0 with all stats cleared)
   */
  conceded?: boolean;
}

export interface Round {
  id: string
  userId?: string
  user_id?: string  // Supabase field name (snake_case)
  userName?: string
  user_name?: string  // Supabase field name (snake_case)
  courseId?: string
  course_id?: string  // Supabase field name (snake_case)
  courseName?: string
  course_name?: string  // Supabase field name (snake_case)
  selectedTee?: 'men' | 'women' | 'senior' | 'championship'
  selected_tee?: 'men' | 'women' | 'senior' | 'championship'  // Supabase field name (snake_case)
  date: string
  scores: number[]
  totalScore?: number
  total_score?: number  // Supabase field name (snake_case)
  eventId?: string | null
  event_id?: string | null
  notes?: string
  in_progress?: boolean
  perHoleStats?: PerHoleStats[]  // Array, one per hole (optional)
  per_hole_stats?: PerHoleStats[]  // Supabase field name (snake_case)
  updated_at?: string  // Timestamp of last heartbeat/update
  last_activity_at?: string  // Timestamp of last actual score change
}

export type EventStatus = 'draft' | 'active' | 'completed'

export interface Event {
  id: string
  name: string
  organizer_id: string
  course_id?: string | null
  course_name?: string | null
  event_date?: string | null
  hole_count?: number
  status: EventStatus
  enabled_features?: string[]
  created_at?: string
  updated_at?: string
}

export interface EventMember {
  id?: number
  event_id: string
  user_id: string
  role: 'organizer' | 'player'
  created_at?: string
  user_name?: string
}

export interface EventLeaderboardEntry {
  round_id: string
  user_id: string
  user_name: string
  total_score: number
  scores: number[]
  in_progress: boolean
  thru: number
  status_label: string
  updated_at?: string
  last_activity_at?: string
}

export interface CommentReaction {
  emoji: string;
  count: number;
}

export interface Comment {
  id: number;
  round_id: string;
  user_id: string;
  author_name: string;
  text: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  reactions?: CommentReaction[];
}
