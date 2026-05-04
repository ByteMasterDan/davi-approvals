import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Workflow,
  CheckCircle,
  Building2,
  ScrollText,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Route {
  path: string
  label: string
  roles?: string[]
  icon?: React.ReactNode
}

const routeIcons: Record<string, React.ReactNode> = {
  '/dashboard': <LayoutDashboard className="h-5 w-5" />,
  '/flows': <Workflow className="h-5 w-5" />,
  '/my-forms': <ClipboardList className="h-5 w-5" />,
  '/execution': <CheckCircle className="h-5 w-5" />,
  '/documents': <FileText className="h-5 w-5" />,
  '/clients': <Building2 className="h-5 w-5" />,
  '/audit': <ScrollText className="h-5 w-5" />,
  '/users': <Users className="h-5 w-5" />,
  '/settings': <Settings className="h-5 w-5" />,
}

interface SidebarProps {
  routes: Route[]
  currentRoute: string
  onNavigate: (path: string) => void
}

export default function Sidebar({ routes, currentRoute, onNavigate }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const userRole = user?.role || 'Operator'

  const filteredRoutes = routes.filter(
    route => !route.roles || route.roles.includes(userRole)
  )

  const handleLogout = () => {
    logout()
    window.location.hash = '/login'
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 256 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="bg-card border-r border-border flex flex-col h-screen shrink-0 overflow-hidden"
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">G-Flow</span>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 shrink-0"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <ul className="space-y-1">
            {filteredRoutes.map(route => {
              const isActive = currentRoute === route.path
              const icon = routeIcons[route.path] || <LayoutDashboard className="h-5 w-5" />

              const button = (
                <button
                  key={route.path}
                  onClick={() => onNavigate(route.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  } ${sidebarCollapsed ? 'justify-center' : ''}`}
                >
                  <span className="shrink-0">{icon}</span>
                  <AnimatePresence mode="wait">
                    {!sidebarCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="truncate"
                      >
                        {route.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )

              if (sidebarCollapsed) {
                return (
                  <li key={route.path}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {button}
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {route.label}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                )
              }

              return <li key={route.path}>{button}</li>
            })}
          </ul>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-border shrink-0">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
                {user?.displayName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.role || 'Operator'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Separator className="my-3" />

          {/* Logout Button */}
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="w-full h-9 text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Logout
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Logout</span>
            </Button>
          )}
        </div>
      </motion.aside>
    </TooltipProvider>
  )
}