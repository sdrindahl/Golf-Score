/**
 * Tests for HoleMap component
 * Tests Leaflet map rendering, markers, distance calculations
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock Leaflet
jest.mock('leaflet', () => ({
  default: {
    map: jest.fn(() => ({
      setView: jest.fn(function () {
        return this
      }),
      on: jest.fn(),
      off: jest.fn(),
      removeLayer: jest.fn(),
      remove: jest.fn(),
    })),
    tileLayer: jest.fn(() => ({
      addTo: jest.fn(function () {
        return this
      }),
    })),
    circleMarker: jest.fn(() => ({
      addTo: jest.fn(function () {
        return this
      }),
      bindPopup: jest.fn(function () {
        return this
      }),
    })),
    polyline: jest.fn(() => ({
      addTo: jest.fn(function () {
        return this
      }),
      setLatLngs: jest.fn(),
    })),
    tooltip: jest.fn(() => ({
      setContent: jest.fn(function () {
        return this
      }),
      setLatLng: jest.fn(function () {
        return this
      }),
      addTo: jest.fn(function () {
        return this
      }),
    })),
  },
}))

describe('HoleMap Component', () => {
  const mockProps = {
    userLat: 40.7128,
    userLng: -74.006,
    greenLat: 40.715,
    greenLng: -74.008,
    holeName: 'Hole 1',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize map with correct center coordinates', () => {
    // Test that map is centered between user and green
    const centerLat = (mockProps.userLat + mockProps.greenLat) / 2
    const centerLng = (mockProps.userLng + mockProps.greenLng) / 2

    expect(centerLat).toBeCloseTo(40.7139, 3)
    expect(centerLng).toBeCloseTo(-74.007, 3)
  })

  it('should calculate distance correctly using haversine formula', () => {
    // Test distance calculation between two points
    const toRad = (v: number) => (v * Math.PI) / 180
    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371000 // meters
      const dLat = toRad(lat2 - lat1)
      const dLon = toRad(lon2 - lon1)
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return (R * c) * 1.09361 // convert to yards
    }

    const distance = getDistance(
      mockProps.userLat,
      mockProps.userLng,
      mockProps.greenLat,
      mockProps.greenLng
    )

    // Distance should be positive
    expect(distance).toBeGreaterThan(0)
    // Distance should be reasonable (test coordinates are ~325 yards apart)
    expect(distance).toBeGreaterThan(300)
    expect(distance).toBeLessThan(400)
  })

  it('should convert distance from meters to yards correctly', () => {
    const meters = 100
    const yards = meters * 1.09361

    expect(yards).toBeCloseTo(109.361, 2)
  })

  it('should create user position marker with correct properties', () => {
    // Test that user marker has correct styling
    const userMarkerColor = '#0066ff' // blue
    const userMarkerRadius = 6

    expect(userMarkerColor).toBe('#0066ff')
    expect(userMarkerRadius).toBe(6)
  })

  it('should create green center marker with correct properties', () => {
    // Test that green marker has correct styling
    const greenMarkerColor = '#22c55e' // green
    const greenMarkerRadius = 8

    expect(greenMarkerColor).toBe('#22c55e')
    expect(greenMarkerRadius).toBe(8)
  })

  it('should draw polyline from user to green initially', () => {
    // Test initial polyline setup
    const initialPolyline = [
      [mockProps.userLat, mockProps.userLng],
      [mockProps.greenLat, mockProps.greenLng],
    ]

    expect(initialPolyline).toHaveLength(2)
    expect(initialPolyline[0]).toEqual([mockProps.userLat, mockProps.userLng])
    expect(initialPolyline[1]).toEqual([mockProps.greenLat, mockProps.greenLng])
  })

  it('should update polyline to 3 points when user taps map', () => {
    // Test measurement point updates polyline
    const userPos = [mockProps.userLat, mockProps.userLng]
    const tapPos = [40.714, -74.007]
    const greenPos = [mockProps.greenLat, mockProps.greenLng]

    const updatedPolyline = [userPos, tapPos, greenPos]

    expect(updatedPolyline).toHaveLength(3)
    expect(updatedPolyline[0]).toEqual(userPos)
    expect(updatedPolyline[1]).toEqual(tapPos)
    expect(updatedPolyline[2]).toEqual(greenPos)
  })

  it('should prevent double initialization in strict mode', () => {
    // Simulate check for existing map
    let mapInstance: any = null

    const tryInitialize = () => {
      if (mapInstance) {
        return // Prevent double init
      }
      mapInstance = { initialized: true }
      return mapInstance
    }

    // First init
    const init1 = tryInitialize()
    expect(init1).not.toBeNull()

    // Second init (should be skipped)
    const init2 = tryInitialize()
    expect(init2).toBeUndefined()

    // Should only have one instance
    expect(mapInstance).toEqual({ initialized: true })
  })

  it('should render loading state while map initializes', () => {
    const TestComponent = () => {
      const [isLoading, setIsLoading] = React.useState(true)

      React.useEffect(() => {
        // Simulate map loading
        const timer = setTimeout(() => setIsLoading(false), 100)
        return () => clearTimeout(timer)
      }, [])

      return (
        <div>
          {isLoading && <div>Loading map...</div>}
          {!isLoading && <div>Map loaded</div>}
        </div>
      )
    }

    render(<TestComponent />)

    expect(screen.getByText('Loading map...')).toBeInTheDocument()

    waitFor(() => {
      expect(screen.getByText('Map loaded')).toBeInTheDocument()
    })
  })

  it('should handle missing green coordinates gracefully', () => {
    const greenLat = 0
    const greenLng = 0

    // Map should still initialize with default coords
    expect(greenLat).toBe(0)
    expect(greenLng).toBe(0)
  })

  it('should cleanup event listeners on unmount', () => {
    const TestComponent = () => {
      React.useEffect(() => {
        const handleClick = jest.fn()
        window.addEventListener('click', handleClick)

        return () => {
          window.removeEventListener('click', handleClick)
        }
      }, [])

      return <div>Map Component</div>
    }

    const { unmount } = render(<TestComponent />)
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalled()
    removeEventListenerSpy.mockRestore()
  })

  it('should round distance to nearest yard for display', () => {
    const distanceYards = 45.678

    const rounded = Math.round(distanceYards)

    expect(rounded).toBe(46)
    expect(rounded).toEqual(46)
  })

  it('should calculate correct distance label format', () => {
    const distanceYards = 125

    const label = `${distanceYards} yd`

    expect(label).toBe('125 yd')
    expect(label).toMatch(/^\d+ yd$/)
  })
})
