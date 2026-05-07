// Mock authentication for testing
jest.mock('@/lib/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-123',
      name: 'Test User',
      email: 'test@example.com',
    },
    loading: false,
    logout: jest.fn().mockResolvedValue(undefined),
  }),
}));

export const mockAuthUser = {
  id: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com',
};

export const mockAuthContext = {
  user: mockAuthUser,
  loading: false,
  logout: jest.fn(),
};
