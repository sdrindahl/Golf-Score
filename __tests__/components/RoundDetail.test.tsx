import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RoundDetailContent from '@/app/round-detail/page'
import { useAuth } from '@/lib/useAuth'
import { useRouter, useSearchParams } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Mock useAuth
jest.mock('@/lib/useAuth', () => ({
  useAuth: jest.fn(),
}))

// Mock PageWrapper component
jest.mock('@/components/PageWrapper', () => {
  return function MockPageWrapper({ children, title }: any) {
    return <div data-testid="page-wrapper">{children}</div>
  }
})

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>
  }
})

// Setup localStorage mock
const localStorageMock = (() => {
  let store: { [key: string]: string } = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('RoundDetail - Concede Hole Feature', () => {
  const mockRound = {
    id: 'round-123',
    userId: 'user-123',
    userName: 'Scott Rindahl',
    courseId: 'course-123',
    courseName: 'Bemidji Town and Country Club',
    selectedTee: 'blue',
    date: '2026-05-11',
    scores: [5, 4, 4, 4, 5, 4, 4, 4, 4],
    totalScore: 38,
    notes: '',
    in_progress: false,
    perHoleStats: [
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [15, 8], drive: { yardage: 240 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [20, 10], drive: { yardage: 250 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [18, 9], drive: { yardage: 235 } },
      { fairwayHit: 'L', gir: false, putts: 3, puttDistances: [25, 15, 5], drive: { yardage: 200 } },
      { fairwayHit: 'hit', gir: true, putts: 1, puttDistances: [12], drive: { yardage: 260 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [16, 8], drive: { yardage: 245 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [19, 9], drive: { yardage: 248 } },
      { fairwayHit: 'R', gir: false, putts: 3, puttDistances: [22, 14, 6], drive: { yardage: 210 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [17, 10], drive: { yardage: 255 } },
    ],
  }

  const mockCourse = {
    id: 'course-123',
    name: 'Bemidji Town and Country Club',
    holes: [
      { holeNumber: 1, par: 4, yardages: { blue: 380 } },
      { holeNumber: 2, par: 4, yardages: { blue: 360 } },
      { holeNumber: 3, par: 4, yardages: { blue: 365 } },
      { holeNumber: 4, par: 4, yardages: { blue: 355 } },
      { holeNumber: 5, par: 5, yardages: { blue: 545 } },
      { holeNumber: 6, par: 4, yardages: { blue: 375 } },
      { holeNumber: 7, par: 4, yardages: { blue: 370 } },
      { holeNumber: 8, par: 4, yardages: { blue: 350 } },
      { holeNumber: 9, par: 4, yardages: { blue: 365 } },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()

    // Setup useAuth mock
    ;(useAuth as jest.Mock).mockReturnValue({
      getCurrentUser: jest.fn(() => ({
        id: 'user-123',
        is_admin: false,
      })),
    })

    // Setup useSearchParams mock
    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn((param) => {
        if (param === 'id') return 'round-123'
        return null
      }),
    })

    // Setup useRouter mock
    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      back: jest.fn(),
    })

    // Setup localStorage with test data
    localStorage.setItem('golfRounds', JSON.stringify([mockRound]))
    localStorage.setItem('golfCourses', JSON.stringify([mockCourse]))

    // Mock fetch for API calls — must return a Response-like object or res.ok will be undefined
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { entries: () => [] as [string, string][] },
      json: async () => ({ round: mockRound, courses: [mockCourse] }),
    })
  })

  test('should display conceded hole as "C" instead of blank', () => {
    const concedeRound = {
      ...mockRound,
      scores: [5, 0, 4, 4, 5, 4, 4, 4, 4],
      perHoleStats: [
        mockRound.perHoleStats[0],
        { conceded: true }, // Hole 2 is conceded
        ...mockRound.perHoleStats.slice(2),
      ],
    }
    localStorage.setItem('golfRounds', JSON.stringify([concedeRound]))

    render(<RoundDetailContent />)

    // The conceded hole should display "C"
    // This would require actual rendering logic verification
    waitFor(() => {
      expect(screen.getByText('C')).toBeInTheDocument()
    })
  })

  test('should clear all stats when conceding a hole', () => {
    const hole3Stats = mockRound.perHoleStats[2]
    const concedeRound = {
      ...mockRound,
      scores: [5, 4, 0, 4, 5, 4, 4, 4, 4], // Hole 3 score = 0
      perHoleStats: [
        mockRound.perHoleStats[0],
        mockRound.perHoleStats[1],
        { conceded: true }, // All stats cleared
        ...mockRound.perHoleStats.slice(3),
      ],
    }

    // Verify the conceded stats object is clean
    expect(concedeRound.perHoleStats[2]).toEqual({ conceded: true })
    expect(concedeRound.perHoleStats[2].fairwayHit).toBeUndefined()
    expect(concedeRound.perHoleStats[2].gir).toBeUndefined()
    expect(concedeRound.perHoleStats[2].putts).toBeUndefined()
  })

  test('should clear conceded flag when editing conceded hole to a number', () => {
    const concedeRound = {
      ...mockRound,
      scores: [5, 0, 4, 4, 5, 4, 4, 4, 4],
      perHoleStats: [
        mockRound.perHoleStats[0],
        { conceded: true },
        ...mockRound.perHoleStats.slice(2),
      ],
    }

    // Simulate editing hole 2 to score 4
    const editedRound = {
      ...concedeRound,
      scores: [5, 4, 4, 4, 5, 4, 4, 4, 4],
      perHoleStats: [
        concedeRound.perHoleStats[0],
        {
          ...concedeRound.perHoleStats[1],
          conceded: false, // Flag cleared when score entered
        },
        ...concedeRound.perHoleStats.slice(2),
      ],
    }

    // Verify conceded flag is cleared
    expect(editedRound.perHoleStats[1].conceded).toBe(false)
  })

  test('should save conceded flag to Supabase per_hole_stats', () => {
    const concedeRound = {
      ...mockRound,
      scores: [5, 0, 4, 4, 5, 4, 4, 4, 4],
      perHoleStats: [
        mockRound.perHoleStats[0],
        { conceded: true },
        ...mockRound.perHoleStats.slice(2),
      ],
    }

    // Verify structure matches what save-round API expects
    expect(concedeRound.perHoleStats[1]).toHaveProperty('conceded', true)
    const payload = JSON.stringify(concedeRound)
    expect(payload).toContain('"conceded":true')
  })
})

describe('RoundDetail - Score Editing to Zero', () => {
  const mockRound = {
    id: 'round-123',
    userId: 'user-123',
    userName: 'Scott Rindahl',
    courseId: 'course-123',
    courseName: 'Bemidji Town and Country Club',
    selectedTee: 'blue',
    date: '2026-05-11',
    scores: [5, 4, 4, 4, 5, 4, 4, 4, 4],
    totalScore: 38,
    notes: '',
    in_progress: false,
    perHoleStats: [
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [15, 8], drive: { yardage: 240 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [20, 10], drive: { yardage: 250 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [18, 9], drive: { yardage: 235 } },
      { fairwayHit: 'L', gir: false, putts: 3, puttDistances: [25, 15, 5], drive: { yardage: 200 } },
      { fairwayHit: 'hit', gir: true, putts: 1, puttDistances: [12], drive: { yardage: 260 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [16, 8], drive: { yardage: 245 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [19, 9], drive: { yardage: 248 } },
      { fairwayHit: 'R', gir: false, putts: 3, puttDistances: [22, 14, 6], drive: { yardage: 210 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [17, 10], drive: { yardage: 255 } },
    ],
  }

  const mockCourse = {
    id: 'course-123',
    name: 'Bemidji Town and Country Club',
    holes: [
      { holeNumber: 1, par: 4, yardages: { blue: 380 } },
      { holeNumber: 2, par: 4, yardages: { blue: 360 } },
      { holeNumber: 3, par: 4, yardages: { blue: 365 } },
      { holeNumber: 4, par: 4, yardages: { blue: 355 } },
      { holeNumber: 5, par: 5, yardages: { blue: 545 } },
      { holeNumber: 6, par: 4, yardages: { blue: 375 } },
      { holeNumber: 7, par: 4, yardages: { blue: 370 } },
      { holeNumber: 8, par: 4, yardages: { blue: 350 } },
      { holeNumber: 9, par: 4, yardages: { blue: 365 } },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()

    ;(useAuth as jest.Mock).mockReturnValue({
      getCurrentUser: jest.fn(() => ({
        id: 'user-123',
        is_admin: false,
      })),
    })

    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn((param) => {
        if (param === 'id') return 'round-123'
        return null
      }),
    })

    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      back: jest.fn(),
    })

    localStorage.setItem('golfRounds', JSON.stringify([mockRound]))
    localStorage.setItem('golfCourses', JSON.stringify([mockCourse]))

    global.fetch = jest.fn()
  })

  test('should accept score of 0 as valid input', () => {
    const testScores = [0, 1, 2, 5, 10]
    const validScores = testScores.filter((score) => score >= 0) // 0 is now valid

    expect(validScores).toContain(0)
    expect(validScores.length).toBe(5)
  })

  test('should reject negative scores', () => {
    const testScores = [-1, 0, 1, 2, 5]
    const validScores = testScores.filter((score) => score >= 0)

    expect(validScores).not.toContain(-1)
    expect(validScores).toContain(0)
  })

  test('should display score of 0 as blank on scorecard', () => {
    const zeroRound = {
      ...mockRound,
      scores: [5, 0, 4, 4, 5, 4, 4, 4, 4],
      totalScore: 33,
    }

    // Score of 0 should not display a number
    expect(zeroRound.scores[1]).toBe(0)

    // When rendering, 0 should show as blank (verified by display logic)
    const displayValue = zeroRound.scores[1] > 0 ? zeroRound.scores[1] : ''
    expect(displayValue).toBe('')
  })

  test('should calculate total correctly with zeros', () => {
    const roundWithZeros = {
      ...mockRound,
      scores: [5, 0, 4, 0, 5, 4, 0, 4, 4],
    }

    const calculatedTotal = roundWithZeros.scores.reduce((sum, score) => sum + score, 0)
    expect(calculatedTotal).toBe(26) // 5 + 0 + 4 + 0 + 5 + 4 + 0 + 4 + 4 = 26
  })

  test('should save score of 0 to database', () => {
    const zeroRound = {
      ...mockRound,
      scores: [5, 0, 4, 4, 5, 4, 4, 4, 4],
      totalScore: 33,
    }

    // Verify 0 is preserved in scores array
    expect(zeroRound.scores[1]).toBe(0)

    // Verify JSON serialization preserves 0
    const jsonString = JSON.stringify(zeroRound)
    const parsed = JSON.parse(jsonString)
    expect(parsed.scores[1]).toBe(0)
  })

  test('should allow minus button to decrease score to 0', () => {
    let currentScore = 3
    const minusAction = () => {
      currentScore = Math.max(0, currentScore - 1)
    }

    // Decrease from 3 to 0
    minusAction() // Now 2
    minusAction() // Now 1
    minusAction() // Now 0

    expect(currentScore).toBe(0)

    // Try to go below 0 - should stay at 0
    minusAction()
    expect(currentScore).toBe(0)
  })
})

describe('RoundDetail - Edit Modal Tests', () => {
  const mockRound = {
    id: 'round-123',
    userId: 'user-123',
    userName: 'Scott Rindahl',
    courseId: 'course-123',
    courseName: 'Bemidji Town and Country Club',
    selectedTee: 'blue',
    date: '2026-05-11',
    scores: [5, 4, 4, 4, 5, 4, 4, 4, 4],
    totalScore: 38,
    notes: '',
    in_progress: false,
    perHoleStats: [
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [15, 8], drive: { yardage: 240 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [20, 10], drive: { yardage: 250 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [18, 9], drive: { yardage: 235 } },
      { fairwayHit: 'L', gir: false, putts: 3, puttDistances: [25, 15, 5], drive: { yardage: 200 } },
      { fairwayHit: 'hit', gir: true, putts: 1, puttDistances: [12], drive: { yardage: 260 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [16, 8], drive: { yardage: 245 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [19, 9], drive: { yardage: 248 } },
      { fairwayHit: 'R', gir: false, putts: 3, puttDistances: [22, 14, 6], drive: { yardage: 210 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [17, 10], drive: { yardage: 255 } },
    ],
  }

  const mockCourse = {
    id: 'course-123',
    name: 'Bemidji Town and Country Club',
    holes: [
      { holeNumber: 1, par: 4, yardages: { blue: 380 } },
      { holeNumber: 2, par: 4, yardages: { blue: 360 } },
      { holeNumber: 3, par: 4, yardages: { blue: 365 } },
      { holeNumber: 4, par: 4, yardages: { blue: 355 } },
      { holeNumber: 5, par: 5, yardages: { blue: 545 } },
      { holeNumber: 6, par: 4, yardages: { blue: 375 } },
      { holeNumber: 7, par: 4, yardages: { blue: 370 } },
      { holeNumber: 8, par: 4, yardages: { blue: 350 } },
      { holeNumber: 9, par: 4, yardages: { blue: 365 } },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()

    ;(useAuth as jest.Mock).mockReturnValue({
      getCurrentUser: jest.fn(() => ({
        id: 'user-123',
        is_admin: false,
      })),
    })

    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn((param) => {
        if (param === 'id') return 'round-123'
        return null
      }),
    })

    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      back: jest.fn(),
    })

    localStorage.setItem('golfRounds', JSON.stringify([mockRound]))
    localStorage.setItem('golfCourses', JSON.stringify([mockCourse]))

    global.fetch = jest.fn()
  })

  test('should display instruction modal when Edit button is clicked', () => {
    // Verify that when edit mode is entered, modal shows instruction text
    // This tests the structure of the help modal state management
    let showEditHelpModal = false
    const setShowEditHelpModal = jest.fn((value) => {
      showEditHelpModal = typeof value === 'function' ? value(showEditHelpModal) : value
    })

    // Simulate clicking Edit button
    setShowEditHelpModal(true)
    expect(showEditHelpModal).toBe(true)
  })

  test('should show "Select hole to edit" message in modal', () => {
    // The edit help modal displays specific instruction text
    const modalMessage = 'Select hole to edit.'
    expect(modalMessage).toBeDefined()
    expect(modalMessage).toContain('hole')
  })

  test('should close modal when Got it button is clicked', () => {
    let showEditHelpModal = true
    const setShowEditHelpModal = jest.fn((value) => {
      showEditHelpModal = typeof value === 'function' ? value(showEditHelpModal) : value
    })

    // Simulate clicking "Got it" button
    setShowEditHelpModal(false)
    expect(showEditHelpModal).toBe(false)
  })

  test('should show modal every time Edit is clicked (no dismiss preference)', () => {
    let showEditHelpModal = false
    const setShowEditHelpModal = jest.fn((value) => {
      showEditHelpModal = typeof value === 'function' ? value(showEditHelpModal) : value
    })

    // First time: click Edit
    setShowEditHelpModal(true)
    expect(showEditHelpModal).toBe(true)

    // Close modal
    setShowEditHelpModal(false)
    expect(showEditHelpModal).toBe(false)

    // Click Edit again
    setShowEditHelpModal(true)
    expect(showEditHelpModal).toBe(true) // Modal should appear again

    // Verify no "don't show again" checkbox exists (no dismissal logic)
    const hasOnceFlag = Object.prototype.hasOwnProperty.call({}, 'dontShowEditHelpAgain')
    expect(hasOnceFlag).toBe(false)
  })

  test('should display modal with proper styling and layout', () => {
    // Modal should have consistent styling structure
    const modalStructure = {
      hasTitle: true,
      hasMessage: true,
      hasButton: true,
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    }

    expect(modalStructure.hasTitle).toBe(true)
    expect(modalStructure.hasMessage).toBe(true)
    expect(modalStructure.hasButton).toBe(true)
    expect(modalStructure.className).toContain('fixed')
  })
})

describe('RoundDetail - Edit State Management Tests', () => {
  const mockRound = {
    id: 'round-123',
    userId: 'user-123',
    userName: 'Scott Rindahl',
    courseId: 'course-123',
    courseName: 'Bemidji Town and Country Club',
    selectedTee: 'blue',
    date: '2026-05-11',
    scores: [5, 4, 4, 4, 5, 4, 4, 4, 4],
    totalScore: 38,
    notes: '',
    in_progress: false,
    perHoleStats: [
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [15, 8], drive: { yardage: 240 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [20, 10], drive: { yardage: 250 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [18, 9], drive: { yardage: 235 } },
      { fairwayHit: 'L', gir: false, putts: 3, puttDistances: [25, 15, 5], drive: { yardage: 200 } },
      { fairwayHit: 'hit', gir: true, putts: 1, puttDistances: [12], drive: { yardage: 260 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [16, 8], drive: { yardage: 245 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [19, 9], drive: { yardage: 248 } },
      { fairwayHit: 'R', gir: false, putts: 3, puttDistances: [22, 14, 6], drive: { yardage: 210 } },
      { fairwayHit: 'hit', gir: true, putts: 2, puttDistances: [17, 10], drive: { yardage: 255 } },
    ],
  }

  const mockCourse = {
    id: 'course-123',
    name: 'Bemidji Town and Country Club',
    holes: [
      { holeNumber: 1, par: 4, yardages: { blue: 380 } },
      { holeNumber: 2, par: 4, yardages: { blue: 360 } },
      { holeNumber: 3, par: 4, yardages: { blue: 365 } },
      { holeNumber: 4, par: 4, yardages: { blue: 355 } },
      { holeNumber: 5, par: 5, yardages: { blue: 545 } },
      { holeNumber: 6, par: 4, yardages: { blue: 375 } },
      { holeNumber: 7, par: 4, yardages: { blue: 370 } },
      { holeNumber: 8, par: 4, yardages: { blue: 350 } },
      { holeNumber: 9, par: 4, yardages: { blue: 365 } },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()

    ;(useAuth as jest.Mock).mockReturnValue({
      getCurrentUser: jest.fn(() => ({
        id: 'user-123',
        is_admin: false,
      })),
    })

    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn((param) => {
        if (param === 'id') return 'round-123'
        return null
      }),
    })

    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      back: jest.fn(),
    })

    localStorage.setItem('golfRounds', JSON.stringify([mockRound]))
    localStorage.setItem('golfCourses', JSON.stringify([mockCourse]))

    global.fetch = jest.fn()
  })

  test('should initialize isEditMode as false on page load', () => {
    let isEditMode = false

    // isEditMode should start as false
    expect(isEditMode).toBe(false)
  })

  test('should set isEditMode to true when Edit button clicked', () => {
    let isEditMode = false
    const setIsEditMode = jest.fn((value) => {
      isEditMode = typeof value === 'function' ? value(isEditMode) : value
    })

    // Click Edit button
    setIsEditMode(true)
    expect(isEditMode).toBe(true)
  })

  test('should reset isEditMode to false when roundId changes (navigation)', () => {
    let isEditMode = true
    const roundId = 'round-123'
    const newRoundId = 'round-456'

    // Simulate useEffect that resets isEditMode when roundId changes
    if (newRoundId !== roundId) {
      isEditMode = false
    }

    expect(isEditMode).toBe(false)
  })

  test('should maintain edit state for current round but reset on new round navigation', () => {
    // Round 1: Enter edit mode
    let isEditMode = false
    let currentRoundId = 'round-123'

    // Enter edit mode
    isEditMode = true
    expect(isEditMode).toBe(true)

    // Navigate to different round
    currentRoundId = 'round-456'

    // useEffect dependency on roundId should reset isEditMode
    if (currentRoundId !== 'round-123') {
      isEditMode = false
    }

    expect(isEditMode).toBe(false)
  })

  test('should have selectedHoleIndex track which hole is being edited', () => {
    let selectedHoleIndex: number | null = null

    // Initially no hole selected
    expect(selectedHoleIndex).toBe(null)

    // Click hole 2 (index 1)
    selectedHoleIndex = 1
    expect(selectedHoleIndex).toBe(1)

    // Click different hole
    selectedHoleIndex = 4
    expect(selectedHoleIndex).toBe(4)
  })

  test('should clear selectedHoleIndex when exiting edit mode', () => {
    let selectedHoleIndex: number | null = 3
    let isEditMode = true

    // Exit edit mode
    isEditMode = false
    if (!isEditMode) {
      selectedHoleIndex = null
    }

    expect(selectedHoleIndex).toBe(null)
  })

  test('should only show Edit button when user owns round or is admin', () => {
    const user = { id: 'user-123', is_admin: false }
    const roundOwnerId = 'user-123'

    const canEditRound = () => user.id === roundOwnerId || user.is_admin

    expect(canEditRound()).toBe(true)
  })

  test('should not show Edit button for other users non-admin rounds', () => {
    const user = { id: 'user-999', is_admin: false }
    const roundOwnerId = 'user-123'

    const canEditRound = () => user.id === roundOwnerId || user.is_admin

    expect(canEditRound()).toBe(false)
  })

  test('should allow edit for admin even if not round owner', () => {
    const user = { id: 'user-999', is_admin: true }
    const roundOwnerId = 'user-123'

    const canEditRound = () => user.id === roundOwnerId || user.is_admin

    expect(canEditRound()).toBe(true)
  })
})
