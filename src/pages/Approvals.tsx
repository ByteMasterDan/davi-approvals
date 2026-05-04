import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Loader2, FileText, ExternalLink, CheckSquare } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface Approval {
  id: string
  timestamp: string
  userEmail: string
  clientName: string
  fileName: string
  fileUrl: string
  status: string
  notes: string
}

export default function ApprovalsPage() {
  const { user } = useAuthStore()
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  useEffect(() => { loadApprovals() }, [])

  const loadApprovals = async () => {
    setLoading(true)
    try {
      const result = await callGAS<{ success: boolean; approvals: Approval[] }>('getPendingApprovals', { token: user?.token })
      if (result && result.success) {
        setApprovals(result.approvals || [])
      }
    } catch (e) {
      toast.error('Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    setProcessing(id)
    try {
      const result = await callGAS<{ success: boolean; message?: string; emailSent?: boolean }>('approveDocument', { token: user?.token, auditId: id })
      if (result && result.success) {
        toast.success(result.message || 'Document approved')
        setApprovals(prev => prev.filter(a => a.id !== id))
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
      } else {
        toast.error(result?.message || 'Approval failed')
      }
    } catch (e: any) {
      toast.error('Approval failed: ' + e.message)
    } finally {
      setProcessing(null)
    }
  }

  const handleApproveAll = async () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    setProcessing('all')
    try {
      const result = await callGAS<{ success: boolean }>('approveAllDocuments', { token: user?.token, auditIds: ids })
      if (result && result.success) {
        toast.success(`${ids.length} document(s) approved`)
        setApprovals(prev => prev.filter(a => !selected.has(a.id)))
        setSelected(new Set())
      }
    } catch (e: any) {
      toast.error('Approval failed: ' + e.message)
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setProcessing(id)
    try {
      const result = await callGAS<{ success: boolean }>('rejectDocument', { token: user?.token, auditId: id, reason: rejectReason })
      if (result && result.success) {
        toast.success('Document rejected')
        setApprovals(prev => prev.filter(a => a.id !== id))
        setRejectingId(null)
        setRejectReason('')
      }
    } catch (e: any) {
      toast.error('Rejection failed: ' + e.message)
    } finally {
      setProcessing(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === approvals.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(approvals.map(a => a.id)))
    }
  }

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleString() } catch { return dateStr }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {approvals.length > 1 && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={toggleSelectAll}>
            <CheckSquare className="h-4 w-4 mr-2" />
            {selected.size === approvals.length ? 'Deselect All' : 'Select All'}
          </Button>
          {selected.size > 0 && (
            <Button size="sm" onClick={handleApproveAll} disabled={processing !== null}>
              {processing === 'all' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Approve Selected ({selected.size})
            </Button>
          )}
        </div>
      )}

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No pending approvals</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <motion.div key={approval.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={selected.has(approval.id) ? 'ring-2 ring-primary' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selected.has(approval.id)}
                      onChange={() => toggleSelect(approval.id)}
                      className="mt-1 rounded border-border"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{approval.clientName}</h3>
                          <p className="text-sm text-muted-foreground">{approval.fileName}</p>
                        </div>
                        <Badge variant="outline">Pending</Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Uploaded by: {approval.userEmail}</span>
                        <span>Date: {formatDate(approval.timestamp)}</span>
                      </div>

                      {approval.fileUrl && (
                        <a
                          href={approval.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Document
                        </a>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(approval.id)}
                          disabled={processing !== null}
                        >
                          {processing === approval.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                          Approve
                        </Button>

                        {rejectingId === approval.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Reason..."
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              className="h-8 text-sm border border-border rounded px-2 bg-background"
                            />
                            <Button size="sm" variant="destructive" onClick={() => handleReject(approval.id)} disabled={processing !== null}>
                              Confirm Reject
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason('') }}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setRejectingId(approval.id)}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
