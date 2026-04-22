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
}
