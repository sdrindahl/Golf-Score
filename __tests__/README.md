# Unit Testing Setup for Golf Score App

## Overview
Jest and React Testing Library have been set up for testing your Golf Score application across:
- **Utility functions** (`lib/`)
- **React components** (`components/` and `app/`)
- **API routes** (`app/api/`)

## Available Scripts

```bash
npm test              # Run all tests once
npm run test:watch   # Run tests in watch mode (re-run on file changes)
npm run test:coverage # Generate coverage report
```

## Test Directory Structure

```
__tests__/
├── api/              # API route tests
│   └── routes.test.ts
├── components/       # React component tests
│   └── HandicapDisplay.test.tsx
└── utils/           # Utility function tests
    └── scoreCalculations.test.ts
```

## Writing Tests

### 1. Utility Function Tests (`__tests__/utils/`)
Example: Testing score calculation logic

```typescript
describe('Score Calculations', () => {
  it('should calculate total score correctly', () => {
    const scores = [4, 3, 5, 4, 3]
    const total = scores.reduce((sum, s) => sum + s, 0)
    expect(total).toBe(19)
  })
})
```

### 2. React Component Tests (`__tests__/components/`)
Example: Testing HandicapDisplay component

```typescript
import { render, screen } from '@testing-library/react'
import HandicapDisplay from '@/components/HandicapDisplay'

describe('HandicapDisplay', () => {
  it('should render handicap value', () => {
    render(<HandicapDisplay handicap={12.5} />)
    expect(screen.getByText('12.5')).toBeInTheDocument()
  })
})
```

### 3. API Route Tests (`__tests__/api/`)
Example: Testing API endpoint logic

```typescript
describe('POST /api/save-round', () => {
  it('should validate round data', () => {
    const round = { user_id: 'user1', scores: [4, 3, 5] }
    expect(round).toHaveProperty('user_id')
  })
})
```

## Key Testing Utilities

- **`render()`** - Render React components for testing
- **`screen.getByText()`, `screen.getByRole()`, etc.** - Query rendered elements
- **`fireEvent()` or `userEvent()`** - Simulate user interactions
- **`waitFor()`** - Wait for async operations
- **`jest.fn()`** - Create mock functions
- **`jest.mock()`** - Mock modules (Supabase, APIs, etc.)

## Example Test Cases to Add

### Components
- [ ] CommentsModal - test comment creation, deletion, reactions
- [ ] ScoreHistory - test round display and reactions
- [ ] NavBar - test navigation
- [ ] InstallPrompt - test PWA install prompt
- [ ] CourseSearch - test search functionality

### API Routes
- [ ] `get-round-reactions` - verify reaction fetching
- [ ] `toggle-round-reaction` - test emoji toggle logic
- [ ] `save-comment` - test comment validation
- [ ] `delete-round` - test round deletion
- [ ] `get-user-rounds` - test round filtering

### Utilities
- [ ] `dataSync.ts` - test data synchronization
- [ ] `roundsInProgress.ts` - test round state management
- [ ] `useAuth.ts` - test auth hook logic

## Mocking Supabase

When testing API routes that interact with Supabase:

```typescript
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        data: [],
        error: null,
      }),
    }),
  },
}))
```

## Coverage Goals

Aim for:
- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >80%
- **Lines**: >80%

View coverage report:
```bash
npm run test:coverage
```

## Running Tests in CI/CD

Add to your deployment pipeline:
```bash
npm test -- --coverage --watchAll=false
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [Next.js Testing](https://nextjs.org/docs/testing)
