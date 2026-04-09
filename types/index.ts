export interface Course {
  id: string
  name: string
  location: string
  state: string
  holeCount: number
  par: number
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

export interface Round {
  id: string
  courseId: string
  courseName: string
  date: string
  scores: number[]
  totalScore: number
  notes?: string
}
