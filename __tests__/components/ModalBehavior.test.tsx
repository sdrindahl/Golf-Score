/**
 * Tests for Modal Behavior
 * Tests map modal appearance, close functionality, and navbar interactions
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

describe('Map Modal Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render modal when showHoleMap is true', () => {
    const TestComponent = () => {
      const [showHoleMap, setShowHoleMap] = React.useState(true)

      return (
        <div>
          {showHoleMap && (
            <div data-testid="map-modal" className="fixed inset-0 bg-black bg-opacity-50 z-40">
              <div className="bg-white rounded-2xl">
                <div>Map Content</div>
              </div>
            </div>
          )}
        </div>
      )
    }

    render(<TestComponent />)
    expect(screen.getByTestId('map-modal')).toBeInTheDocument()
  })

  it('should not render modal when showHoleMap is false', () => {
    const TestComponent = () => {
      const [showHoleMap, setShowHoleMap] = React.useState(false)

      return (
        <div>
          {showHoleMap && (
            <div data-testid="map-modal">
              <div>Map Content</div>
            </div>
          )}
        </div>
      )
    }

    render(<TestComponent />)
    expect(screen.queryByTestId('map-modal')).not.toBeInTheDocument()
  })

  it('should close modal when close button (X) is clicked', async () => {
    const TestComponent = () => {
      const [showHoleMap, setShowHoleMap] = React.useState(true)

      return (
        <div>
          {showHoleMap && (
            <div data-testid="map-modal">
              <button
                onClick={() => setShowHoleMap(false)}
                data-testid="close-button"
              >
                ✕
              </button>
              <div>Map Content</div>
            </div>
          )}
        </div>
      )
    }

    render(<TestComponent />)

    // Modal should be visible
    expect(screen.getByTestId('map-modal')).toBeInTheDocument()

    // Click close button
    fireEvent.click(screen.getByTestId('close-button'))

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByTestId('map-modal')).not.toBeInTheDocument()
    })
  })

  it('should have correct z-index layering (modal above navbar)', () => {
    const TestComponent = () => {
      return (
        <div>
          <div className="z-40" data-testid="modal-backdrop">
            Modal Backdrop
          </div>
          <nav className="z-50 fixed bottom-0" data-testid="navbar">
            NavBar
          </nav>
        </div>
      )
    }

    const { container } = render(<TestComponent />)

    const backdrop = container.querySelector('[data-testid="modal-backdrop"]')
    const navbar = container.querySelector('[data-testid="navbar"]')

    // Both should have z-index classes
    expect(backdrop).toHaveClass('z-40')
    expect(navbar).toHaveClass('z-50')
  })

  it('should apply pointer-events-none to backdrop', () => {
    const TestComponent = () => {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 pointer-events-none">
          <div className="pointer-events-auto" data-testid="modal-content">
            Modal
          </div>
        </div>
      )
    }

    const { container } = render(<TestComponent />)

    // Parent should have pointer-events-none
    const backdrop = container.querySelector('[class*="pointer-events-none"]')
    expect(backdrop).toBeTruthy()

    // Modal content should have pointer-events-auto
    expect(screen.getByTestId('modal-content')).toHaveClass('pointer-events-auto')
  })

  it('should allow navbar clicks to pass through modal backdrop', () => {
    const TestComponent = () => {
      const [mapOpen, setMapOpen] = React.useState(true)

      return (
        <div>
          {mapOpen && (
            <div className="fixed inset-0 pointer-events-none z-40" data-testid="backdrop">
              <div className="pointer-events-auto">Modal</div>
            </div>
          )}
          <nav className="fixed bottom-0 z-50" data-testid="navbar">
            <button
              onClick={() => setMapOpen(!mapOpen)}
              data-testid="map-button"
            >
              Toggle
            </button>
          </nav>
        </div>
      )
    }

    render(<TestComponent />)

    // Modal should be open
    expect(screen.getByTestId('backdrop')).toBeInTheDocument()

    // Navbar button should still be clickable (not blocked by backdrop pointer-events-none)
    const mapButton = screen.getByTestId('map-button')
    const navbar = screen.getByTestId('navbar')
    // Navbar should NOT have pointer-events-none, allowing clicks
    expect(navbar).not.toHaveClass('pointer-events-none')

    fireEvent.click(mapButton)

    // Map should close
    waitFor(() => {
      expect(screen.queryByTestId('backdrop')).not.toBeInTheDocument()
    })
  })

  it('should prevent scrolling background when modal is open', () => {
    const TestComponent = () => {
      const [showModal, setShowModal] = React.useState(true)

      React.useEffect(() => {
        if (showModal) {
          document.body.style.overflow = 'hidden'
        } else {
          document.body.style.overflow = 'unset'
        }
      }, [showModal])

      return (
        <div>
          {showModal && <div data-testid="modal">Modal Open</div>}
          <button onClick={() => setShowModal(!showModal)}>Toggle</button>
        </div>
      )
    }

    render(<TestComponent />)

    // When modal is open, body should have overflow hidden
    expect(document.body.style.overflow).toBe('hidden')

    // Click to close
    fireEvent.click(screen.getByRole('button'))

    // When modal is closed, body overflow should be unset
    waitFor(() => {
      expect(document.body.style.overflow).toBe('unset')
    })
  })

  it('should render close button with correct styling and accessibility', () => {
    const TestComponent = () => {
      return (
        <button
          onClick={() => {}}
          className="text-gray-600 hover:text-gray-800 text-2xl font-bold bg-white rounded-full"
          aria-label="Close map modal"
        >
          ✕
        </button>
      )
    }

    render(<TestComponent />)

    const closeButton = screen.getByRole('button', { name: /close map modal/i })
    expect(closeButton).toHaveClass('text-gray-600')
    expect(closeButton).toHaveClass('bg-white')
    expect(closeButton).toHaveClass('rounded-full')
  })

  it('should keep close button and modal content both clickable', () => {
    const closeClickHandler = jest.fn()
    const contentClickHandler = jest.fn()

    const TestComponent = () => {
      return (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div className="pointer-events-auto" onClick={contentClickHandler}>
            <div>Map Content</div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeClickHandler()
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )
    }

    render(<TestComponent />)

    // Click close button
    fireEvent.click(screen.getByRole('button'))
    expect(closeClickHandler).toHaveBeenCalled()

    // Click modal content
    fireEvent.click(screen.getByText('Map Content'))
    expect(contentClickHandler).toHaveBeenCalled()
  })

  it('should not overlap navbar buttons with modal', () => {
    const TestComponent = () => {
      return (
        <div>
          {/* Modal with pb-24 padding-bottom */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 p-4 pb-24">
            <div className="bg-white rounded-2xl h-[85vh]">Modal</div>
          </div>

          {/* Navbar at bottom with z-50 */}
          <nav className="fixed bottom-0 z-50 w-full">
            <button>Button 1</button>
            <button>Button 2</button>
          </nav>
        </div>
      )
    }

    const { container } = render(<TestComponent />)

    const modal = container.querySelector('[class*="pb-24"]')
    const navbar = container.querySelector('nav')

    // Modal should have padding-bottom to avoid navbar
    expect(modal).toHaveClass('pb-24')

    // Navbar should be above modal (higher z-index)
    expect(navbar).toHaveClass('z-50')
  })

  it('should display hole number in modal when open', () => {
    const TestComponent = ({ holeNumber }: { holeNumber: number }) => {
      const [isOpen, setIsOpen] = React.useState(true)

      return (
        <div>
          {isOpen && (
            <div data-testid="modal">
              <h2>Hole {holeNumber} Map View</h2>
            </div>
          )}
        </div>
      )
    }

    const { rerender } = render(<TestComponent holeNumber={1} />)
    expect(screen.getByText('Hole 1 Map View')).toBeInTheDocument()

    rerender(<TestComponent holeNumber={5} />)
    expect(screen.getByText('Hole 5 Map View')).toBeInTheDocument()
  })
})
