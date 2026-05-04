import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, Eye, FileText, Loader2, Plus, Send } from 'lucide-react'

interface FlowTemplate {
  flowId: string
  flowName: string
  description: string
  formFields: any[]
  assignees: string[]
  createdBy: string
  createdAt: string
}

interface MySubmission {
  executionId: string
  flowId: string
  flowName: string
  submittedBy: string
  status: string
  formData: Record<string, any>
  startedAt: string
  completedAt: string
}

type TabType = 'available' | 'submissions'

export default function MyForms() {
  const { user } = useAuthStore()
  const [templates, setTemplates] = useState<FlowTemplate[]>([])
  const [submissions, setSubmissions] = useState<MySubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('available')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tmplResult, subsResult] = await Promise.all([
        callGAS<{ success: boolean; templates: FlowTemplate[] }>('getMyAssignedFlowTemplates', { token: user?.token }),
        callGAS<{ success: boolean; submissions: MySubmission[] }>('getMyAssignedForms', { token: user?.token }),
      ])
      if (tmplResult && tmplResult.success) setTemplates(tmplResult.templates || [])
      if (subsResult && subsResult.success) setSubmissions(subsResult.submissions || [])
    } catch (e) {
      console.error('Load data error:', e)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> My Forms
        </h2>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === 'available' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('available')}
        >
          Available Forms ({templates.length})
        </Button>
        <Button
          variant={activeTab === 'submissions' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('submissions')}
        >
          My Submissions ({submissions.length})
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'available' && (
          <motion.div key="available" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            {templates.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No forms assigned to you.</CardContent></Card>
            )}
            {templates.map(tmpl => (
              <Card key={tmpl.flowId} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm truncate">{tmpl.flowName}</span>
                      </div>
                      {tmpl.description && (
                        <p className="text-xs text-muted-foreground mb-1 truncate">{tmpl.description}</p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {tmpl.formFields.length} field{tmpl.formFields.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Button size="sm" onClick={() => { window.location.hash = '/fill/flow/' + tmpl.flowId }}>
                        <Plus className="h-3 w-3 mr-1" /> Fill Form
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {activeTab === 'submissions' && (
          <motion.div key="submissions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            {submissions.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No active submissions.</CardContent></Card>
            )}
            {submissions.map(sub => (
              <Card key={sub.executionId} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Send className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{sub.flowName || sub.flowId}</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>Submitted: {formatDate(sub.startedAt)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={sub.status === 'Submitted' ? 'secondary' : 'outline'} className="text-xs">{sub.status}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => { window.location.hash = '/fill/' + sub.executionId }}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
