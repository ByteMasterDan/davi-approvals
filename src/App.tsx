import { useState, useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { callGAS } from './components/AuthGate'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Approvals from './pages/Approvals'
import UsersPage from './pages/UsersPage'
import ClientsPage from './pages/ClientsPage'
import Setup from './pages/Setup'
import Login from './pages/Login'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'

const routes = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/upload', label: 'Upload', icon: 'Upload' },
  { path: '/approvals', label: 'Approvals', icon: 'CheckCircle' },
  { path: '/users', label: 'Users', icon: 'Users' },
  { path: '/clients', label: 'Clients', icon: 'Building2' },
]

const roleRoutes: Record<string, string[]> = {
  admin: ['/dashboard', '/upload', '/approvals', '/users', '/clients'],
  coordinator: ['/dashboard', '/approvals', '/users', '/clients'],
  operator: ['/dashboard', '/upload'],
}

function AppContent() {
  const { user, login, loading, setLoading } = useAuthStore()
  const [currentRoute, setCurrentRoute] = useState('/dashboard')
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || '/dashboard'
      setCurrentRoute(hash)
    }
    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    setLoading(true)
    callGAS<{ configured: boolean }>('isSystemConfigured')
      .then((result) => setIsConfigured(result.configured))
      .catch(() => setIsConfigured(false))
      .finally(() => setLoading(false))
  }, [])

  const navigateTo = (path: string) => {
    window.location.hash = path
  }

  if (loading || isConfigured === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isConfigured) {
    return <Setup onComplete={() => setIsConfigured(true)} />
  }

  if (!user?.authenticated) {
    return <Login onSuccess={(token, userData) => userData && login(token, userData)} />
  }

  const userRole = user.role?.toLowerCase() || 'operator'
  const allowedRoutes = roleRoutes[userRole] || roleRoutes.operator
  const filteredRoutes = routes.filter(r => allowedRoutes.includes(r.path))

  // Redirect to first allowed route if current not allowed
  if (!allowedRoutes.includes(currentRoute)) {
    window.location.hash = allowedRoutes[0]
  }

  const renderPage = () => {
    switch (currentRoute) {
      case '/dashboard': return <Dashboard />
      case '/upload': return <Upload />
      case '/approvals': return <Approvals />
      case '/users': return <UsersPage />
      case '/clients': return <ClientsPage />
      default: return <Dashboard />
    }
  }

  const route = routes.find(r => r.path === currentRoute)
  const pageTitle = route?.label || 'Dashboard'

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar routes={filteredRoutes} currentRoute={currentRoute} onNavigate={navigateTo} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-card border-b border-border flex items-center px-6 justify-between shrink-0">
          <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
          <div className="text-xs text-muted-foreground">
            {user.email} ({user.role})
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <TooltipProvider>
      <AppContent />
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  )
}

export default App
