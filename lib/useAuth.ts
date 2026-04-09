import { User } from '@/types'

export function useAuth() {
  function getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null
    const user = localStorage.getItem('currentUser')
    return user ? JSON.parse(user) : null
  }

  function getAllUsers(): User[] {
    if (typeof window === 'undefined') return []
    const users = localStorage.getItem('golfUsers')
    return users ? JSON.parse(users) : []
  }

  function generatePassword(): string {
    return Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')
  }

  function registerUser(name: string, password: string): User {
    const users = getAllUsers()
    
    // Check if user already exists
    const existing = users.find(u => u.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      throw new Error('User already exists')
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      name,
      password,
    }

    users.push(newUser)
    localStorage.setItem('golfUsers', JSON.stringify(users))
    
    return newUser
  }

  function loginUser(name: string, password: string): User {
    const users = getAllUsers()
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password)
    
    if (!user) {
      throw new Error('Invalid name or password')
    }

    localStorage.setItem('currentUser', JSON.stringify(user))
    return user
  }

  function logoutUser(): void {
    localStorage.removeItem('currentUser')
  }

  function updatePassword(userId: string, newPassword: string): void {
    const users = getAllUsers()
    const userIndex = users.findIndex(u => u.id === userId)
    
    if (userIndex >= 0) {
      users[userIndex].password = newPassword
      localStorage.setItem('golfUsers', JSON.stringify(users))
      
      const currentUser = getCurrentUser()
      if (currentUser && currentUser.id === userId) {
        currentUser.password = newPassword
        localStorage.setItem('currentUser', JSON.stringify(currentUser))
      }
    }
  }

  return {
    getCurrentUser,
    getAllUsers,
    registerUser,
    loginUser,
    logoutUser,
    updatePassword,
    generatePassword,
  }
}
