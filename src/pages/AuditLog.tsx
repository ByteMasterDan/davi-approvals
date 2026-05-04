import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { RefreshCw, Download } from 'lucide-react'
import { motion } from 'framer-motion'

interface AuditLog {
  timestamp: string
  approvalId: string
  actorEmail: string
  action: string
  details: string
  metadata: string
}

export default function AuditLog() {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterActor, setFilterActor] = useState('')

  useEffect(() => { loadLogs() }, [])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const filters: Record<string, string> = {}
      if (filterAction !== 'all') filters.action = filterAction
      if (filterActor) filters.actor = filterActor

      const result = await callGAS<{ success: boolean; logs: AuditLog[] }>('getAuditLogs', {
        token: user?.token,
        filters,
      })
      if (result.success) setLogs(result.logs)
    } catch (e) {
      console.error('Load logs error:', e)
    } finally {
      setLoading(false)
    }
  }

  const getActionBadge = (action: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      APPROVED: 'default',
      REJECTED: 'destructive',
      CREATED: 'secondary',
      SUBMITTED: 'outline',
      DISPATCHED: 'default',
      LOGIN: 'secondary',
    }
    return <Badge variant={variants[action] || 'secondary'}>{action}</Badge>
  }

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: ({ row }) => new Date(row.original.timestamp).toLocaleString(),
    },
    { accessorKey: 'approvalId', header: 'Approval ID' },
    { accessorKey: 'actorEmail', header: 'Actor' },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => getActionBadge(row.original.action),
    },
    { accessorKey: 'details', header: 'Details' },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Audit Log</h2>
        <div className="flex gap-2">
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CREATED">Created</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="DISPATCHED">Dispatched</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Filter by actor..."
            value={filterActor}
            onChange={e => setFilterActor(e.target.value)}
            className="w-[200px]"
          />
          <Button variant="outline" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <DataTable columns={columns} data={logs} searchKey="actorEmail" searchPlaceholder="Search by actor..." />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}