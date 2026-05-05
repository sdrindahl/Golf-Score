/**
 * Calculate handicap based on rounds and courses
 * Uses USGA guidelines for handicap calculation
 */
export const calculateHandicap = (
  rounds: any[],
  courses: any[]
): number => {
  if (rounds.length === 0) return 0

  let handicap = 0

  // Calculate handicap differential for each round
  // Formula: (Score - Course Rating) × 113 / Slope Rating
  const differentials = rounds
    .map(round => {
      // Handle both camelCase (local) and snake_case (Supabase) field names
      const courseIdStr = round.courseId || round.course_id || ''
      
      // Handle comma-separated course IDs (e.g., "9a,9b" for 9-hole courses) or arrays
      let courseIds: string[] = []
      if (Array.isArray(courseIdStr)) {
        courseIds = courseIdStr
      } else if (typeof courseIdStr === 'string') {
        courseIds = courseIdStr.split(',').map((id: string) => id.trim())
      }
      const courseList = courseIds.map((id: string) => courses.find((c: any) => c.id === id)).filter(Boolean)
      
      if (courseList.length === 0) {
        return null
      }
      
      // Combine course ratings if multiple courses
      let totalCourseRating = 0
      let totalSlopeRating = 0
      let totalHoles = 0
      
      courseList.forEach((course: any) => {
        const is9Hole = course.holes && course.holes.length === 9
        
        // Use provided courseRating or calculate from holes
        let courseRating = course.courseRating
        if (!courseRating && course.holes) {
          const totalPar = course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
          courseRating = totalPar
        }
        if (!courseRating) courseRating = is9Hole ? 36 : 72
        
        let slopeRating = course.slopeRating || 130
        
        totalCourseRating += courseRating
        totalSlopeRating += slopeRating
        totalHoles += is9Hole ? 9 : 18
      })
      
      // For 9-hole rounds, double the score and ratings to get 18-hole equivalent
      let adjustedScore = round.totalScore || round.total_score
      
      // If still no total score, calculate from individual scores array
      if (!adjustedScore && round.scores && Array.isArray(round.scores)) {
        adjustedScore = round.scores.reduce((sum: number, score: number) => sum + (score || 0), 0)
      }
      
      let adjustedRating = totalCourseRating
      
      if (totalHoles === 9) {
        adjustedScore = adjustedScore * 2
        adjustedRating = totalCourseRating * 2
        totalSlopeRating = totalSlopeRating * 2
      }
      
      if (!totalSlopeRating) return null
      
      const differential = (adjustedScore - adjustedRating) * 113 / totalSlopeRating
      return differential
    })
    .filter((d: any) => d !== null) as number[]

  // Use best X of last 20 in the calculation based on USGA rules
  if (differentials.length > 0) {
    const recentDifferentials = differentials.slice(-20)
    const sortedDifferentials = recentDifferentials.sort((a, b) => a - b)
    
    // USGA Handicap calculation based on number of scores
    let bestCount = 1
    const numDifferentials = sortedDifferentials.length
    if (numDifferentials >= 6) bestCount = 2
    if (numDifferentials >= 7) bestCount = 3
    if (numDifferentials >= 9) bestCount = 4
    if (numDifferentials >= 11) bestCount = 5
    if (numDifferentials >= 13) bestCount = 6
    if (numDifferentials >= 15) bestCount = 7
    if (numDifferentials >= 17) bestCount = 8
    if (numDifferentials >= 19) bestCount = 9
    if (numDifferentials >= 20) bestCount = 10
    
    const best = sortedDifferentials.slice(0, bestCount)
    handicap = Math.round(best.reduce((a, b) => a + b, 0) / best.length * 10) / 10
  }

  return handicap
}
