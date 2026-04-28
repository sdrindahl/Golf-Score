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
}

export interface Round {
  id: string
  userId: string
  userName: string
  courseId: string
  courseName: string
  selectedTee: 'men' | 'women' | 'senior' | 'championship'
  date: string
  scores: number[]
  totalScore: number
  notes?: string
  in_progress?: boolean
  perHoleStats?: PerHoleStats[] // Array, one per hole (optional)
}
