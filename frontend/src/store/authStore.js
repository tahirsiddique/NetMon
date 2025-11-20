import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (username, password) => {
        try {
          const response = await api.post('/auth/login', { username, password })
          const { token, user } = response.data

          set({
            token,
            user,
            isAuthenticated: true,
            isLoading: false,
          })

          // Set token in API headers
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`

          return { success: true }
        } catch (error) {
          set({ isLoading: false })
          return {
            success: false,
            error: error.response?.data?.error || 'Login failed',
          }
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          })

          // Remove token from API headers
          delete api.defaults.headers.common['Authorization']
        }
      },

      verifyAuth: async () => {
        const { token } = get()

        if (!token) {
          set({ isLoading: false, isAuthenticated: false })
          return
        }

        try {
          // Set token in headers
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`

          const response = await api.get('/auth/verify')

          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          console.error('Token verification failed:', error)
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          })
          delete api.defaults.headers.common['Authorization']
        }
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
)
