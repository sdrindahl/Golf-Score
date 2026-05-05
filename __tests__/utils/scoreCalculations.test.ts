/**
 * Example test for utility functions
 * Location: lib/exampleUtils.ts
 */
describe('Score Calculations', () => {
  it('should calculate total score correctly', () => {
    const scores = [4, 3, 5, 4, 3, 4, 5, 4, 3]
    const total = scores.reduce((sum, score) => sum + score, 0)
    expect(total).toBe(35)
  })

  it('should calculate score vs par correctly', () => {
    const scores = [4, 3, 5, 4, 3]
    const pars = [4, 4, 5, 4, 4]
    const total = scores.reduce((sum, score) => sum + score, 0)
    const totalPar = pars.reduce((sum, par) => sum + par, 0)
    const diff = total - totalPar
    expect(diff).toBe(-2) // 2 under par
  })

  it('should handle empty scores array', () => {
    const scores: number[] = []
    const total = scores.reduce((sum, score) => sum + score, 0)
    expect(total).toBe(0)
  })
})

describe('Handicap Calculations', () => {
  it('should calculate handicap index from rounds', () => {
    // Example: average of best 8 of last 20 rounds
    const scores = [85, 86, 84, 87, 85, 88, 86, 85]
    const sorted = [...scores].sort((a, b) => a - b)
    const bestEight = sorted.slice(0, 8)
    const avg = bestEight.reduce((sum, s) => sum + s, 0) / bestEight.length
    expect(avg).toBeCloseTo(85.75, 1)
  })
})
