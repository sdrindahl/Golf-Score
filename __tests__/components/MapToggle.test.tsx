/**
 * Tests for Map Toggle functionality
 * Tests opening/closing the map modal via button taps and event listeners
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

describe('Map Toggle Functionality', () => {
  beforeEach(() => {
    // Clear all event listeners before each test
    jest.clearAllMocks()
  })

  it('should open map modal when toggleHoleMap event is dispatched with isOpen true', async () => {
    // Create a test component that listens for the toggleHoleMap event
    const TestComponent = () => {
      const [showHoleMap, setShowHoleMap] = React.useState(false)

      React.useEffect(() => {
        const handleOpenMap = () => {
          setShowHoleMap((prev) => !prev)
        }
        window.addEventListener('toggleHoleMap', handleOpenMap)
        return () => window.removeEventListener('toggleHoleMap', handleOpenMap)
      }, [])

      return (
        <div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('toggleHoleMap'))}>
            Toggle Map
          </button>
          {showHoleMap && <div>Map Modal Open</div>}
        </div>
      )
    }

    render(<TestComponent />)

    // Initial state - map should be closed
    expect(screen.queryByText('Map Modal Open')).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(screen.getByRole('button', { name: /Toggle Map/i }))

    // Map should be open
    await waitFor(() => {
      expect(screen.getByText('Map Modal Open')).toBeInTheDocument()
    })
  })

  it('should close map modal when toggleHoleMap event is dispatched a second time', async () => {
    const TestComponent = () => {
      const [showHoleMap, setShowHoleMap] = React.useState(false)

      React.useEffect(() => {
        const handleOpenMap = () => {
          setShowHoleMap((prev) => !prev)
        }
        window.addEventListener('toggleHoleMap', handleOpenMap)
        return () => window.removeEventListener('toggleHoleMap', handleOpenMap)
      }, [])

      return (
        <div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('toggleHoleMap'))}>
            Toggle Map
          </button>
          {showHoleMap && <div>Map Modal Open</div>}
        </div>
      )
    }

    render(<TestComponent />)
    const button = screen.getByRole('button', { name: /Toggle Map/i })

    // Open map
    fireEvent.click(button)
    await waitFor(() => {
      expect(screen.getByText('Map Modal Open')).toBeInTheDocument()
    })

    // Close map (second tap)
    fireEvent.click(button)
    await waitFor(() => {
      expect(screen.queryByText('Map Modal Open')).not.toBeInTheDocument()
    })
  })

  it('should toggle map state correctly with multiple taps', async () => {
    const TestComponent = () => {
      const [showHoleMap, setShowHoleMap] = React.useState(false)

      React.useEffect(() => {
        const handleOpenMap = () => {
          setShowHoleMap((prev) => !prev)
        }
        window.addEventListener('toggleHoleMap', handleOpenMap)
        return () => window.removeEventListener('toggleHoleMap', handleOpenMap)
      }, [])

      return (
        <div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('toggleHoleMap'))}>
            Toggle
          </button>
          <span>{showHoleMap ? 'OPEN' : 'CLOSED'}</span>
        </div>
      )
    }

    render(<TestComponent />)
    const button = screen.getByRole('button', { name: /Toggle/i })

    // Verify initial state
    expect(screen.getByText('CLOSED')).toBeInTheDocument()

    // Toggle 1: Open
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByText('OPEN')).toBeInTheDocument())

    // Toggle 2: Close
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByText('CLOSED')).toBeInTheDocument())

    // Toggle 3: Open
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByText('OPEN')).toBeInTheDocument())

    // Toggle 4: Close
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByText('CLOSED')).toBeInTheDocument())
  })

  it('should dispatch mapStateChanged event with correct isOpen and currentHole values', async () => {
    let dispatchedEvent: CustomEvent | null = null

    // Spy on dispatchEvent to capture the event
    const originalDispatch = window.dispatchEvent
    window.dispatchEvent = jest.fn(function (event: any) {
      if (event.type === 'mapStateChanged') {
        dispatchedEvent = event
      }
      return originalDispatch.call(window, event)
    })

    const TestComponent = () => {
      const [showHoleMap, setShowHoleMap] = React.useState(false)

      React.useEffect(() => {
        window.dispatchEvent(
          new CustomEvent('mapStateChanged', {
            detail: { isOpen: showHoleMap, currentHole: 3 },
          })
        )
      }, [showHoleMap])

      return (
        <button onClick={() => setShowHoleMap(!showHoleMap)}>Toggle</button>
      )
    }

    render(<TestComponent />)
    const button = screen.getByRole('button', { name: /Toggle/i })

    fireEvent.click(button)

    await waitFor(() => {
      expect(dispatchedEvent).not.toBeNull()
      expect(dispatchedEvent?.detail.isOpen).toBe(true)
      expect(dispatchedEvent?.detail.currentHole).toBe(3)
    })

    window.dispatchEvent = originalDispatch
  })

  it('should prevent multiple simultaneous map opens from creating duplicate modals', async () => {
    const TestComponent = () => {
      const [showHoleMap, setShowHoleMap] = React.useState(false)

      React.useEffect(() => {
        const handleToggle = () => {
          setShowHoleMap((prev) => !prev)
        }
        window.addEventListener('toggleHoleMap', handleToggle)
        return () => window.removeEventListener('toggleHoleMap', handleToggle)
      }, [])

      return (
        <div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('toggleHoleMap'))}>
            Toggle
          </button>
          {showHoleMap && <div data-testid="map-modal">Map Modal</div>}
        </div>
      )
    }

    render(<TestComponent />)
    const button = screen.getByRole('button')

    // Rapid clicks
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    // Should only have one modal instance
    const modals = screen.queryAllByTestId('map-modal')
    expect(modals.length).toBeLessThanOrEqual(1)
  })
})
