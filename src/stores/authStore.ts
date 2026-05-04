import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserProfile {
  authenticated: boolean
  email: string | null
  role: string | null
  displayName: string | null
  skills: string[]
  token: string | null
}

interface AuthState {
  user: UserProfile | null
  loading: boolean
  login: (token: string, userData: { email: string; role: string; displayName: string; skills: string[] }) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  isAuthenticated: () => boolean
  hasRole: (roles: string[]) => boolean
}

const defaultUser: UserProfile = {
  authenticated: false,
  email: null,
  role: null,
  displayName: null,
  skills: [],
  token: null,
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,

      login: (token: string, userData) => {
        // Normalize role to TitleCase for UI consistency
        const normalizeRole = (role: string): string => {
          if (!role) return 'Operator'
          const lower = role.toLowerCase()
          const map: Record<string, string> = {
            admin: 'Admin',
            superapprover: 'SuperApprover',
            approver: 'Approver',
            operator: 'Operator',
            coordinator: 'Coordinator',
          }
          return map[lower] || role.charAt(0).toUpperCase() + role.slice(1)
        }

        set({
          user: {
            authenticated: true,
            email: userData.email,
            role: normalizeRole(userData.role),
            displayName: userData.displayName,
            skills: userData.skills || [],
            token,
          },
          loading: false,
        })
      },

      logout: () => {
        set({ user: null, loading: false })
      },

      setLoading: (loading: boolean) => {
        set({ loading })
      },

      isAuthenticated: () => {
        const { user } = get()
        return !!user?.authenticated && !!user?.token
      },

      hasRole: (roles: string[]) => {
        const { user } = get()
        if (!user?.role) return false
        return roles.includes(user.role)
      },
    }),
    {
      name: 'gflow-auth',
      partialize: (state) => ({
        user: state.user ? {
          authenticated: state.user.authenticated,
          email: state.user.email,
          role: state.user.role,
          displayName: state.user.displayName,
          skills: state.user.skills,
          token: state.user.token,
        } : null,
      }),
    }
  )
)