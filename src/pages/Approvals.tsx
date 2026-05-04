import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, XCircle, Loader2, FileText, ExternalLink, CheckSquare, Mail, ArrowUpRight, X, Eye } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  escalatedBy?: string
  escalatedAt?: string
}

interface Client {
  clientName: string
  email: string
  isActive: boolean
}

export default function ApprovalsPage() {
  const user = useAuthStore(s => s.user)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [escalateConfirmId, setEscalateConfirmId] = useState<string | null>(null)
  const [previewApproval, setPreviewApproval] = useState<Approval | null>(null)

  const userRole = user?.role?.toLowerCase() || ''
  const isApprover = userRole === 'approver'
  const isSuperApprover = userRole === 'superapprover' || userRole === 'admin'

  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [approvingApproval, setApprovingApproval] = useState<Approval | null>(null)
  const [approveEmail, setApproveEmail] = useState('')
  const [approveClientSearch, setApproveClientSearch] = useState('')

  const pendingOnly = useMemo(() => approvals.filter((a) => a.status === 'PENDING'), [approvals])

  const clientEmailMap = useMemo(() => {
    const map = new Map<string, string>()
    clients.forEach(c => map.set((c.clientName || '').toUpperCase().trim(), c.email))
    return map
  }, [clients])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadApprovals(), loadClients()])
    } catch (e) {
      console.error('Load data error:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadApprovals = async () => {
    try {
      const result = await callGAS<{ approvals?: Approval[] }>('getPendingApprovals', { token: user?.token })
      let allApprovals: Approval[] = []
      if (result && Array.isArray(result.approvals)) {
        allApprovals = result.approvals.filter((a): a is Approval => a != null)
      } else if (Array.isArray(result)) {
        allApprovals = (result as Approval[]).filter((a): a is Approval => a != null)
      }
      if (isApprover) {
        setApprovals(allApprovals.filter((a) => a.status === 'PENDING'))
      } else {
        setApprovals(allApprovals)
      }
    } catch (e) {
      toast.error('Failed to load approvals')
    }
  }

  const loadClients = async () => {
    try {
      const result = await callGAS<{ clients?: Client[] }>('getClients', { token: user?.token })
      if (result && Array.isArray(result.clients)) {
        setClients(result.clients.filter((c: Client) => c.isActive))
      } else if (Array.isArray(result)) {
        setClients((result as Client[]).filter((c: Client) => c.isActive))
      }
    } catch (e) {
      console.error('Failed to load clients', e)
    }
  }

  const getClientEmail = (clientName: string): string => {
    return clientEmailMap.get((clientName || '').toUpperCase().trim()) || ''
  }

  const getEmbedUrl = (fileUrl: string): string => {
    if (!fileUrl) return ''
    const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
    return fileUrl
  }

  const openApproveDialog = (approval: Approval) => {
    setApprovingApproval(approval)
    const detectedEmail = getClientEmail(approval.clientName)
    setApproveEmail(detectedEmail)
    setApproveClientSearch('')
    setApproveDialogOpen(true)
  }

  const handleApproveConfirm = async () => {
    if (!approvingApproval) return
    if (!approveEmail.trim()) {
      toast.error('Please provide a client email')
      return
    }
    setProcessing(approvingApproval.id)
    setApproveDialogOpen(false)
    try {
      const result = await callGAS<{ success?: boolean; message?: string; emailSent?: boolean }>('approveDocument', {
        token: user?.token,
        auditId: approvingApproval.id,
        clientEmailOverride: approveEmail.trim(),
      })
      if (result && result.success !== false) {
        toast.success(result.message || 'Document approved')
        setApprovals((prev) => prev.filter((a) => a.id !== approvingApproval.id))
        setSelected((prev) => {
          const s = new Set(prev)
          s.delete(approvingApproval.id)
          return s
        })
      } else {
        toast.error(result?.message || 'Approval failed')
      }
    } catch (e: any) {
      toast.error('Approval failed: ' + e.message)
    } finally {
      setProcessing(null)
      setApprovingApproval(null)
      setApproveEmail('')
    }
  }

  const handleApproveAll = async () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    setProcessing('all')
    try {
      const result = await callGAS<{ success?: boolean }>('approveAllDocuments', { token: user?.token, auditIds: ids })
      if (result && result.success !== false) {
        toast.success(`${ids.length} document(s) approved`)
        setApprovals((prev) => prev.filter((a) => !selected.has(a.id)))
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
      const result = await callGAS<{ success?: boolean }>('rejectDocument', {
        token: user?.token,
        auditId: id,
        reason: rejectReason,
      })
      if (result && result.success !== false) {
        toast.success('Document rejected')
        setApprovals((prev) => prev.filter((a) => a.id !== id))
        setRejectingId(null)
        setRejectReason('')
      }
    } catch (e: any) {
      toast.error('Rejection failed: ' + e.message)
    } finally {
      setProcessing(null)
    }
  }

  const handleEscalate = async (id: string) => {
    setProcessing(id)
    setEscalateConfirmId(null)
    try {
      const result = await callGAS<{ success?: boolean; message?: string }>('escalateDocument', {
        token: user?.token,
        auditId: id,
      })
      if (result && result.success !== false) {
        toast.success(result.message || 'Document escalated to SuperApprovers')
        setApprovals((prev) => prev.filter((a) => a.id !== id))
        setSelected((prev) => {
          const s = new Set(prev)
          s.delete(id)
          return s
        })
      } else {
        toast.error(result?.message || 'Escalation failed')
      }
    } catch (e: any) {
      toast.error('Escalation failed: ' + e.message)
    } finally {
      setProcessing(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === pendingOnly.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingOnly.map((a) => a.id)))
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
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
      {approvals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No pending approvals</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bulk Actions Sticky Bar */}
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="sticky top-0 z-30 bg-background/95 backdrop-blur border rounded-lg p-3 flex items-center justify-between shadow-lg"
              >
                <span className="text-sm font-medium">{selected.size} document(s) selected</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleApproveAll} disabled={processing !== null}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectingId('bulk')}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject All
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Select All + Preview Info Bar */}
          <AnimatePresence>
            {selected.size === 0 && pendingOnly.length > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  {selected.size === pendingOnly.length ? 'Deselect All' : 'Select All'}
                </Button>
                <span className="text-xs text-muted-foreground">Click Preview on any document to review before approving</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Approval Cards */}
          <div className="space-y-3">
            {approvals.map((approval) => {
              const detectedEmail = getClientEmail(approval.clientName)
              const isEscalated = approval.status === 'ESCALATED'
              return (
                <motion.div key={approval.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={selected.has(approval.id) ? 'ring-2 ring-primary' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {!isEscalated && (
                          <input
                            type="checkbox"
                            checked={selected.has(approval.id)}
                            onChange={() => toggleSelect(approval.id)}
                            className="mt-1 rounded border-border"
                          />
                        )}

                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-foreground">{approval.clientName}</h3>
                              <p className="text-sm text-muted-foreground">{approval.fileName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEscalated ? (
                                <Badge className="bg-orange-100 text-orange-700 border-orange-300">Escalated</Badge>
                              ) : (
                                <Badge variant="outline">Pending</Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span>Uploaded by: {approval.userEmail}</span>
                            <span>Date: {formatDate(approval.timestamp)}</span>
                            {isEscalated && approval.escalatedBy && (
                              <span className="text-orange-600">Escalated by: {approval.escalatedBy}</span>
                            )}
                            {detectedEmail ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <Mail className="h-3 w-3" />
                                Client email: {detectedEmail}
                              </span>
                            ) : (
                              <span className="text-amber-600">No client email found</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <Button size="sm" variant="outline" onClick={() => setPreviewApproval(approval)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Preview
                            </Button>
                            <a
                              href={approval.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm"
                            >
                              <Button size="sm" variant="ghost">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Open in Drive
                              </Button>
                            </a>

                            {(isSuperApprover || !isEscalated) && (
                              <Button size="sm" onClick={() => openApproveDialog(approval)} disabled={processing !== null}>
                                {processing === approval.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                )}
                                Approve
                              </Button>
                            )}

                            {rejectingId === approval.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Reason..."
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
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

                            {approval.status !== 'ESCALATED' && isApprover && (
                              <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => setEscalateConfirmId(approval.id)}>
                                <ArrowUpRight className="h-4 w-4 mr-1" />
                                Escalate
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      {/* Document Preview Panel */}
      <AnimatePresence>
        {previewApproval && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setPreviewApproval(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-[600px] max-w-[90vw] bg-card border-l shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b shrink-0">
                <div>
                  <h3 className="font-semibold text-foreground">{previewApproval.clientName}</h3>
                  <p className="text-sm text-muted-foreground">{previewApproval.fileName}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPreviewApproval(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <iframe
                  src={getEmbedUrl(previewApproval.fileUrl)}
                  className="w-full h-full border-0"
                  title="Document Preview"
                />
              </div>
              <div className="flex items-center gap-2 p-4 border-t shrink-0">
                <Button size="sm" onClick={() => { openApproveDialog(previewApproval); setPreviewApproval(null); }}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setRejectingId(previewApproval.id); setPreviewApproval(null); }}>
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
                {previewApproval && previewApproval.status !== 'ESCALATED' && isApprover && (
                  <Button size="sm" variant="outline" className="border-orange-300 text-orange-700" onClick={() => { setEscalateConfirmId(previewApproval.id); setPreviewApproval(null); }}>
                    <ArrowUpRight className="h-4 w-4 mr-1" /> Escalate
                  </Button>
                )}
                <a href={previewApproval.fileUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
                  <Button size="sm" variant="ghost">
                    <ExternalLink className="h-4 w-4 mr-1" /> Open in Drive
                  </Button>
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Escalate Confirmation Dialog */}
      <Dialog open={!!escalateConfirmId} onOpenChange={(open) => !open && setEscalateConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escalate Document</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to escalate this document to SuperApprovers? They will be notified via email and can approve or reject it.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateConfirmId(null)} disabled={processing !== null}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => escalateConfirmId && handleEscalate(escalateConfirmId)}
              disabled={processing !== null}
            >
              {processing === escalateConfirmId && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Document</DialogTitle>
          </DialogHeader>
          {approvingApproval && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Client:</span> {approvingApproval.clientName}
                </p>
                <p>
                  <span className="font-medium text-foreground">Document:</span> {approvingApproval.fileName}
                </p>
              </div>

              <div>
                <Label htmlFor="clientEmail">Client Email for Notification</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="clientEmail"
                    type="email"
                    value={approveEmail}
                    onChange={(e) => setApproveEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {getClientEmail(approvingApproval.clientName)
                    ? 'Auto-detected from client directory. You can change it.'
                    : 'No email found in client directory. Please enter manually.'}
                </p>
              </div>

              {clients.length > 0 && (
                <div>
                  <Label>Or select a client</Label>
                  <Select
                    value={approveClientSearch}
                    onValueChange={(v) => {
                      setApproveClientSearch(v)
                      const selectedClient = clients.find((c) => c.clientName === v)
                      if (selectedClient) {
                        setApproveEmail(selectedClient.email)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Search client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.clientName} value={client.clientName}>
                          {client.clientName} ({client.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={processing !== null}>
              Cancel
            </Button>
            <Button onClick={handleApproveConfirm} disabled={processing !== null}>
              {processing === approvingApproval?.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
