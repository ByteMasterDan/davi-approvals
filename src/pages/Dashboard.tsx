import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { Clock, CheckCircle, XCircle, Workflow, Users, Building2 } from 'lucide-react'

interface DashboardStats {
  pendingApprovals: number
  approvedToday: number
  rejectedToday: number
  activeFlows: number
  totalClients: number
  totalUsers: number
}

interface RecentLog {
  timestamp: string
  actorEmail: string
  action: string
  details: string
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const result = await callGAS<{ success: boolean; stats: DashboardStats; recentLogs: RecentLog[] }>(
        'getDashboardStats',
        { token: user?.token }
      )
      if (result && result.success) {
        setStats(result.stats)
        setRecentLogs(result.recentLogs)
      }
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'Pending Approvals', value: stats?.pendingApprovals ?? 0, icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
    { label: 'Approved Today', value: stats?.approvedToday ?? 0, icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    { label: 'Active Flows', value: stats?.activeFlows ?? 0, icon: Workflow, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'Total Clients', value: stats?.totalClients ?? 0, icon: Building2, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
    { label: 'Rejected Today', value: stats?.rejectedToday ?? 0, icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  ]

  const getActionBadge = (action: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      APPROVED: 'default',
      REJECTED: 'destructive',
      CREATED: 'secondary',
      SUBMITTED: 'outline',
      UPDATED: 'secondary',
      DEACTIVATED: 'destructive',
    }
    return <Badge variant={variants[action] || 'secondary'}>{action}</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Welcome back, {user?.displayName}</h2>
        <p className="text-sm text-muted-foreground">Here's what's happening with your workflows</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {getActionBadge(log.action)}
                    <div>
                      <p className="text-sm text-foreground">{log.details}</p>
                      <p className="text-xs text-muted-foreground">{log.actorEmail}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}