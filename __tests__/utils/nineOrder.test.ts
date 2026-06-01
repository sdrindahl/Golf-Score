import { orderNinesForDisplay } from '@/lib/nineOrder'

describe('orderNinesForDisplay', () => {
  it('puts Front before Back regardless of selection order', () => {
    const selected = [
      { id: 'back', name: 'Back 9' },
      { id: 'front', name: 'Front 9' },
    ]

    const ordered = orderNinesForDisplay(selected)

    expect(ordered.map((c) => c.id)).toEqual(['front', 'back'])
  })

  it('preserves selection order for courses without Front/Back naming', () => {
    const selected = [
      { id: 'west', name: 'West 9' },
      { id: 'north', name: 'North 9' },
    ]

    const ordered = orderNinesForDisplay(selected)

    expect(ordered.map((c) => c.id)).toEqual(['west', 'north'])
  })

  it('supports prefixed names like G Front 9 / G Back 9', () => {
    const selected = [
      { id: 'g-back', name: 'G Back 9' },
      { id: 'g-front', name: 'G Front 9' },
    ]

    const ordered = orderNinesForDisplay(selected)

    expect(ordered.map((c) => c.id)).toEqual(['g-front', 'g-back'])
  })
})
