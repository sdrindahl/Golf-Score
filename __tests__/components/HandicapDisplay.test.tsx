/**
 * Example test for React components
 * Tests HandicapDisplay component behavior
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock component for testing - replace with actual component
const HandicapDisplay = ({ handicap, loading }: { handicap: number | null; loading: boolean }) => {
  if (loading) return <div>Loading handicap...</div>
  if (handicap === null) return <div>No handicap data</div>
  return <div className="text-2xl font-bold">{handicap.toFixed(1)}</div>
}

describe('HandicapDisplay Component', () => {
  it('should render loading state', () => {
    render(<HandicapDisplay handicap={null} loading={true} />)
    expect(screen.getByText('Loading handicap...')).toBeInTheDocument()
  })

  it('should render handicap value when loaded', () => {
    render(<HandicapDisplay handicap={12.5} loading={false} />)
    expect(screen.getByText('12.5')).toBeInTheDocument()
  })

  it('should render no data message when handicap is null', () => {
    render(<HandicapDisplay handicap={null} loading={false} />)
    expect(screen.getByText('No handicap data')).toBeInTheDocument()
  })

  it('should format handicap to one decimal place', () => {
    render(<HandicapDisplay handicap={12.567} loading={false} />)
    expect(screen.getByText('12.6')).toBeInTheDocument()
  })
})
