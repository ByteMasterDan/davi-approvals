import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, FileText, Clock, CheckCircle2, XCircle } from 'lucide-react'
import FormFiller from '../components/FormFiller'
import type { FormField } from '../components/form-builder'

type PageMode = 'new' | 'existing'
type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export default function FormFillPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [mode, setMode] = useState<PageMode>('new')
  const [flowId, setFlowId] = useState('')
  const [flowName, setFlowName] = useState('')
  const [executionId, setExecutionId] = useState('')
  const [executionStatus, setExecutionStatus] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [initialData, setInitialData] = useState<Record<string, any>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    parseUrl()
  }, [])

  const parseUrl = () => {
    const hash = window.location.hash

    const flowMatch = hash.match(/#\/fill\/flow\/(.+)/)
    if (flowMatch) {
      setMode('new')
      setFlowId(flowMatch[1])
      loadFlowTemplate(flowMatch[1])
      return
    }

    const execMatch = hash.match(/#\/fill\/(.+)/)
    if (execMatch) {
      setMode('existing')
      setExecutionId(execMatch[1])
      loadExecution(execMatch[1])
      return
    }

    setError('Invalid URL')
    setLoading(false)
  }

  const loadFlowTemplate = async (fId: string) => {
    setLoading(true)
    setError('')
    try {
      const flowResult = await callGAS<{ success: boolean; flow: any }>('getFlowById', {
        token: user?.token,
        flowId: fId,
      })

      if (!flowResult || !flowResult.success || !flowResult.flow) {
        setError('Flow not found')
        setLoading(false)
        return
      }

      setFlowName(flowResult.flow.flowName || fId)

      const steps = flowResult.flow.steps || []
      const formStep = steps.find((s: any) => s.type === 'form' && s.fields && s.fields.length > 0)
      if (formStep) {
        setFormFields(formStep.fields)
      } else {
        setError('No form fields defined in this flow')
      }
    } catch (e) {
      console.error('Load flow template error:', e)
      setError('Failed to load form')
    } finally {
      setLoading(false)
    }
  }

  const loadExecution = async (execId: string) => {
    setLoading(true)
    setError('')
    try {
      const subsResult = await callGAS<{ success: boolean; submissions: any[] }>('getMyAssignedForms', {
        token: user?.token,
      })

      let exec = null
      if (subsResult && subsResult.success) {
        exec = (subsResult.submissions || []).find((s: any) => s.executionId === execId)
      }

      if (!exec) {
        const detailResult = await callGAS<{ success: boolean; execution: any }>('getExecutionDetail', {
          token: user?.token,
          executionId: execId,
        })
        if (detailResult && detailResult.success && detailResult.execution) {
          exec = detailResult.execution
        }
      }

      if (!exec) {
        setError('Execution not found or not assigned to you')
        setLoading(false)
        return
      }

      setFlowId(exec.flowId)
      setFlowName(exec.flowName || exec.flowId)
      setExecutionStatus(exec.status)
      setSubmittedBy(exec.submittedBy || '')
      setStartedAt(exec.startedAt || '')
      setInitialData(exec.formData || {})

      const flowResult = await callGAS<{ success: boolean; flow: any }>('getFlowById', {
        token: user?.token,
        flowId: exec.flowId,
      })

      if (flowResult && flowResult.success && flowResult.flow) {
        const steps = flowResult.flow.steps || []
        const formStep = steps.find((s: any) => s.type === 'form' && s.fields && s.fields.length > 0)
        if (formStep) {
          setFormFields(formStep.fields)
        } else {
          setError('No form fields defined in this flow')
        }
      }
    } catch (e) {
      console.error('Load execution error:', e)
      setError('Failed to load form data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: Record<string, any>) => {
    setSubmitState('submitting')
    setErrorMessage('')
    try {
      if (mode === 'new') {
        const result = await callGAS<{ success: boolean; error?: string; executionId?: string }>('startFormSubmission', {
          token: user?.token,
          flowId: flowId,
          formData: data,
        })
        if (result && !result.success) {
          setSubmitState('error')
          setErrorMessage(result.error || 'Failed to submit form')
          return
        }
        setSubmitState('success')
        setTimeout(() => { window.location.hash = '/my-forms' }, 2000)
      } else {
        const result = await callGAS<{ success: boolean; error?: string }>('submitFormData', {
          token: user?.token,
          executionId: executionId,
          formData: data,
        })
        if (result && !result.success) {
          setSubmitState('error')
          setErrorMessage(result.error || 'Failed to submit form')
          return
        }
        setSubmitState('success')
        setTimeout(() => { window.location.hash = '/my-forms' }, 2000)
      }
    } catch (e) {
      console.error('Submit error:', e)
      setSubmitState('error')
      setErrorMessage('Error submitting form. Please try again.')
    }
  }

  const handleCancel = () => {
    window.location.hash = '/my-forms'
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

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-2xl mx-auto">
        <Button variant="ghost" onClick={handleCancel} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to My Forms
        </Button>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  const isReadOnly = mode === 'existing' && (executionStatus === 'Submitted' || executionStatus === 'Approved' || executionStatus === 'Rejected')

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={handleCancel} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to My Forms
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{flowName || flowId}</CardTitle>
                {mode === 'existing' && (
                  <p className="text-xs text-muted-foreground mt-0.5">Execution: {executionId}</p>
                )}
                {mode === 'new' && (
                  <p className="text-xs text-muted-foreground mt-0.5">New submission</p>
                )}
              </div>
            </div>
            {mode === 'existing' && (
              <Badge variant={executionStatus === 'Submitted' ? 'secondary' : executionStatus === 'Approved' ? 'default' : executionStatus === 'Rejected' ? 'destructive' : 'outline'}>
                {executionStatus}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {mode === 'existing' && (
            <div className="flex gap-6 text-sm text-muted-foreground mb-6 pb-4 border-b">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>Submitted: <span className="text-foreground font-medium">{formatDate(startedAt)}</span></span>
              </div>
            </div>
          )}

          {formFields.length > 0 && (
            <FormFiller
              fields={formFields}
              initialData={initialData}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              disabled={isReadOnly || submitState === 'submitting' || submitState === 'success'}
            />
          )}

          {formFields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No form fields available.</p>
          )}
        </CardContent>
      </Card>

      {submitState === 'submitting' && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium text-foreground">Sending form...</p>
            <p className="text-sm text-muted-foreground">Please wait</p>
          </motion.div>
        </div>
      )}

      {submitState === 'success' && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-green-500/20 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <p className="text-lg font-medium text-foreground">Form submitted successfully!</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </motion.div>
        </div>
      )}

      {submitState === 'error' && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 max-w-sm">
            <div className="rounded-full bg-destructive/20 p-4">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <p className="text-lg font-medium text-foreground">Error submitting form</p>
            <p className="text-sm text-muted-foreground text-center">{errorMessage}</p>
            <Button onClick={() => setSubmitState('idle')} variant="outline">Try Again</Button>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
