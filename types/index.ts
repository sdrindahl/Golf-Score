export interface Course {
  id: string
  name: string
  location: string
  state: string
  holeCount: number
  par: number
  courseRating: number  // e.g., 72.4
  slopeRating: number   // e.g., 135
  holes: Hole[]
  tees?: Tee[]
}

export interface Tee {
  name: string
  color: string
  par: number
  yardage: number
}

export interface Hole {
  holeNumber: number
  par: number
  handicap: number
  yardage?: number
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
  date: string
  scores: number[]
  totalScore: number
  notes?: string
}
