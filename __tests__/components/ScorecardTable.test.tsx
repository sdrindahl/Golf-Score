import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ScorecardTable } from '@/components/ScorecardTable'

function makeHole(holeNumber: number, yardage: number, par: number) {
  return {
    holeNumber,
    par,
    men: { yardage },
  }
}

describe('ScorecardTable', () => {
  it('preserves merged nine order instead of resorting by hole number', () => {
    const holes = [
      makeHole(1, 428, 4),
      makeHole(2, 540, 5),
      makeHole(3, 503, 3),
      makeHole(4, 573, 4),
      makeHole(5, 560, 5),
      makeHole(6, 440, 4),
      makeHole(7, 400, 4),
      makeHole(8, 240, 3),
      makeHole(9, 320, 4),
      makeHole(1, 419, 4),
      makeHole(2, 413, 4),
      makeHole(3, 372, 4),
      makeHole(4, 515, 5),
      makeHole(5, 453, 4),
      makeHole(6, 398, 3),
      makeHole(7, 580, 4),
      makeHole(8, 560, 3),
      makeHole(9, 347, 5),
    ]
    const scores = Array(18).fill(4)

    render(
      <ScorecardTable
        holes={holes}
        scores={scores}
        selectedTee="men"
        sectionLabels={['West 9', 'North 9']}
      />
    )

    const westLabels = screen.getAllByText('West 9')
    const northLabels = screen.getAllByText('North 9')

    expect(westLabels.length).toBeGreaterThan(0)
    expect(northLabels.length).toBeGreaterThan(0)

    const westHeader = westLabels[0].closest('table')
    const northHeader = northLabels[0].closest('table')

    expect(westHeader).toBeTruthy()
    expect(northHeader).toBeTruthy()

    const westTable = westHeader as HTMLTableElement
    const northTable = northHeader as HTMLTableElement

    expect(within(westTable).getByText('428')).toBeInTheDocument()
    expect(within(westTable).queryByText('419')).not.toBeInTheDocument()
    expect(within(northTable).getByText('419')).toBeInTheDocument()
    expect(within(northTable).queryByText('428')).not.toBeInTheDocument()
  })

  it('uses section labels in the totals header for combined nines', () => {
    const holes = Array.from({ length: 18 }, (_, index) => makeHole((index % 9) + 1, 400 + index, 4))
    const scores = Array(18).fill(4)

    render(
      <ScorecardTable
        holes={holes}
        scores={scores}
        selectedTee="men"
        sectionLabels={['West 9', 'North 9']}
      />
    )

    expect(screen.getAllByText(/West 9/)).toHaveLength(2)
    expect(screen.getAllByText(/North 9/)).toHaveLength(2)
  })
})
