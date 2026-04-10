import { User } from '@/types'
import { supabase, isSupabaseConfigured } from './supabase'

export function useAuth() {
  function isSupabaseActive(): boolean {
    return isSupabaseConfigured()
  }

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

  async function getAllUsersAsync(): Promise<User[]> {
    if (!isSupabaseActive() || !supabase) {
      // Fallback to localStorage
      return getAllUsers()
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching users from Supabase:', error)
      // Fallback to localStorage
      return getAllUsers()
    }
  }

  function generatePassword(): string {
    return Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')
  }

  async function registerUser(name: string, password: string): Promise<User> {
    const users = isSupabaseActive() ? await getAllUsersAsync() : getAllUsers()

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

    // Add user to array
    users.push(newUser)

    // Save to Supabase first (primary source of truth)
    if (isSupabaseActive() && supabase) {
      try {
        const { error } = await supabase
          .from('users')
          .insert([newUser])

        if (error) throw error
        console.log('User registered in Supabase')
      } catch (error) {
        console.error('Error registering user in Supabase:', error)
        throw new Error('Failed to register user. Please check your connection.')
      }
    }

    // Update localStorage cache
    localStorage.setItem('golfUsers', JSON.stringify(users))

    return newUser
  }

  async function loginUser(name: string, password: string): Promise<User> {
    const users = isSupabaseActive() ? await getAllUsersAsync() : getAllUsers()
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

  async function updatePassword(userId: string, newPassword: string): Promise<void> {
    const users = isSupabaseActive() ? await getAllUsersAsync() : getAllUsers()
    const userIndex = users.findIndex(u => u.id === userId)

    if (userIndex >= 0) {
      users[userIndex].password = newPassword

      if (isSupabaseActive() && supabase) {
        try {
          const { error } = await supabase
            .from('users')
            .update({ password: newPassword })
            .eq('id', userId)

          if (error) throw error
        } catch (error) {
          console.error('Error updating password in Supabase:', error)
        }
      }

      localStorage.setItem('golfUsers', JSON.stringify(users))

      const currentUser = getCurrentUser()
      if (currentUser && currentUser.id === userId) {
        currentUser.password = newPassword
        localStorage.setItem('currentUser', JSON.stringify(currentUser))
      }
    }
  }

  async function updateName(userId: string, newName: string): Promise<void> {
    const users = isSupabaseActive() ? await getAllUsersAsync() : getAllUsers()
    const userIndex = users.findIndex(u => u.id === userId)

    if (userIndex >= 0) {
      users[userIndex].name = newName

      if (isSupabaseActive() && supabase) {
        try {
          const { error } = await supabase
            .from('users')
            .update({ name: newName })
            .eq('id', userId)

          if (error) throw error
        } catch (error) {
          console.error('Error updating name in Supabase:', error)
        }
      }

      localStorage.setItem('golfUsers', JSON.stringify(users))

      const currentUser = getCurrentUser()
      if (currentUser && currentUser.id === userId) {
        currentUser.name = newName
        localStorage.setItem('currentUser', JSON.stringify(currentUser))
      }
    }
  }

  async function deleteUser(userId: string): Promise<void> {
    const users = isSupabaseActive() ? await getAllUsersAsync() : getAllUsers()
    const userIndex = users.findIndex(u => u.id === userId)

    if (userIndex >= 0) {
      // Remove user from users array
      users.splice(userIndex, 1)

      // Delete from Supabase
      if (isSupabaseActive() && supabase) {
        try {
          // Delete all rounds for this user
          const { error: roundsError } = await supabase
            .from('rounds')
            .delete()
            .eq('user_id', userId)

          if (roundsError) throw roundsError

          // Delete user
          const { error: userError } = await supabase
            .from('users')
            .delete()
            .eq('id', userId)

          if (userError) throw userError

          console.log('User deleted from Supabase')
        } catch (error) {
          console.error('Error deleting user from Supabase:', error)
        }
      }

      // Update users in localStorage
      localStorage.setItem('golfUsers', JSON.stringify(users))

      // Remove all rounds for this user from localStorage
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds)
        const filteredRounds = allRounds.filter((r: any) => r.userId !== userId)
        localStorage.setItem('golfRounds', JSON.stringify(filteredRounds))
      }

      // Log out the user
      logoutUser()
    }
  }

  return {
    getCurrentUser,
    getAllUsers,
    getAllUsersAsync,
    registerUser,
    loginUser,
    logoutUser,
    updatePassword,
    updateName,
    deleteUser,
    generatePassword,
    isSupabaseActive,
  }
}
