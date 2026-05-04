import { useState, useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { callGAS } from './components/AuthGate'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Flows from './pages/Flows'
import FlowExecution from './pages/FlowExecution'
import Clients from './pages/Clients'
import AuditLog from './pages/AuditLog'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Documents from './pages/Documents'
import MyForms from './pages/MyForms'
import Employees from './pages/Employees'
import FormFillPage from './pages/FormFillPage'
import Setup from './pages/Setup'
import Login from './pages/Login'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'

// Mocking Route Type locally if needed, or assume Sidebar handles it if passed
const routes = [
  { path: '/dashboard', label: 'Dashboard', roles: ['Admin', 'SuperApprover', 'Approver', 'Operator'] },
  { path: '/flows', label: 'Flows', roles: ['Admin', 'SuperApprover', 'Approver'] },
  { path: '/my-forms', label: 'My Forms', roles: ['Admin', 'SuperApprover', 'Approver', 'Operator'] },
  { path: '/execution', label: 'Approvals', roles: ['Admin', 'SuperApprover', 'Approver'] },
  { path: '/documents', label: 'Documents', roles: ['Admin', 'SuperApprover', 'Operator'] },
  { path: '/clients', label: 'Client Directory', roles: ['Admin', 'Operator'] },
  { path: '/employees', label: 'Employee Directory', roles: ['Admin', 'Operator'] },
  { path: '/audit', label: 'Audit Log', roles: ['Admin', 'SuperApprover'] },
  { path: '/users', label: 'User Management', roles: ['Admin'] },
  { path: '/settings', label: 'Settings', roles: ['Admin', 'SuperApprover', 'Approver', 'Operator'] },
]

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

  useEffect(() => {
    if (user?.authenticated && user?.email && user?.role && user?.token) {
      const hash = window.location.hash.slice(1)
      if (hash === '/dashboard' || hash === '' || hash === '/') {
        if (!['Admin', 'SuperApprover'].includes(user.role)) {
          window.location.hash = '/my-forms'
        }
      }
    }
  }, [user?.authenticated, user?.role, user?.token])

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

  if (!user?.authenticated || !user.email || !user.role || !user.displayName) {
    return <Login onSuccess={(token, userData) => userData && login(token, userData)} />
  }

  const renderPage = () => {
    if (currentRoute.startsWith('/fill/')) return <FormFillPage />
    switch (currentRoute) {
      case '/dashboard': return <Dashboard />
      case '/flows': return <Flows />
      case '/my-forms': return <MyForms />
      case '/execution': return <FlowExecution />
      case '/documents': return <Documents />
      case '/clients': return <Clients />
      case '/employees': return <Employees />
      case '/audit': return <AuditLog />
      case '/users': return <Users />
      case '/settings': return <Settings />
      default: return <Dashboard />
    }
  }

  const getPageTitle = () => {
    if (currentRoute.startsWith('/fill/')) return 'Fill Form'
    const route = routes.find(r => r.path === currentRoute)
    return route?.label || 'Approval System'
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar routes={routes} currentRoute={currentRoute} onNavigate={navigateTo} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-card border-b border-border flex items-center px-6 justify-between shrink-0">
          <h1 className="text-lg font-semibold text-foreground">{getPageTitle()}</h1>
          <div className="text-xs text-muted-foreground">
            {user.displayName} ({user.role})
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