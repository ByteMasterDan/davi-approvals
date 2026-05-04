import { useState, useEffect } from 'react'
import { callGAS } from './AuthGate'
import { useAuthStore } from '../stores/authStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Mail, Send, Paperclip, AlertCircle } from 'lucide-react'

interface EmailComposerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  execution: any
}

export default function EmailComposer({ open, onOpenChange, execution }: EmailComposerProps) {
  const { user } = useAuthStore()
  const [aliases, setAliases] = useState<string[]>([])
  const [fromAlias, setFromAlias] = useState('')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  
  // Extract files from execution.formData or from execution if it was loaded
  // The backend might store files differently, but let's assume we can fetch them via getDocuments or they are in execution
  const executionFiles = execution?.formData ? 
    Object.values(execution.formData)
      .filter((v: any) => v && typeof v === 'object' && v.driveUrl) 
    : []

  const isRejected = execution?.status === 'Rejected'

  useEffect(() => {
    if (open) {
      loadAliases()
      // Setup defaults based on execution
      setSubject(`Update on Flow Execution: ${execution?.flowName || ''}`)
      setBody(`<p>Hello {{entityName}},</p>\n<p>Your execution <b>{{executionId}}</b> has been processed.</p>`)
    }
  }, [open, execution])

  const loadAliases = async () => {
    try {
      const result = await callGAS<{ success: boolean; aliases: string[] }>('getGmailAliases')
      if (result && result.success && result.aliases) {
        setAliases(result.aliases)
        if (result.aliases.length > 0) setFromAlias(result.aliases[0])
      }
    } catch (e) {
      console.error('Failed to load aliases', e)
    }
  }

  const interpolateFields = (text: string) => {
    if (!text) return ''
    let result = text
    result = result.replace(/{{executionId}}/g, execution?.executionId || '')
    result = result.replace(/{{flowName}}/g, execution?.flowName || '')
    result = result.replace(/{{entityName}}/g, execution?.formData?.EntityName || execution?.formData?.Name || 'User')
    return result
  }

  const handleSend = async () => {
    if (isRejected) return
    setSending(true)
    try {
      const config = {
        to: to.split(',').map(s => s.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        from: fromAlias,
        subject: interpolateFields(subject),
        body: interpolateFields(body),
        // Handle attachments if we have APIs...
      }
      
      const result = await callGAS<{ success: boolean; error?: string }>('sendFlowEmail', {
        token: user?.token,
        config
      })
      if (result && result.success) {
        // close on success
        onOpenChange(false)
      } else {
        alert('Failed to send email: ' + result?.error)
      }
    } catch (e: any) {
      alert('Error sending email: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose Email
          </DialogTitle>
        </DialogHeader>

        {isRejected ? (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Cannot Send Email</p>
              <p className="text-sm mt-1">This execution was rejected. Emails can only be sent for approved or pending executions.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">From</Label>
              <Select value={fromAlias} onValueChange={setFromAlias}>
                <SelectTrigger className="col-span-3 h-9">
                  <SelectValue placeholder="Select alias" />
                </SelectTrigger>
                <SelectContent>
                  {aliases.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">To</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Email addresses, comma separated" className="col-span-3 h-9" />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">CC</Label>
              <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional CC" className="col-span-3 h-9" />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className="col-span-3 h-9" />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label>Message Body (HTML supported)</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPreviewMode(!previewMode)}>
                  {previewMode ? 'Edit HTML' : 'Preview Result'}
                </Button>
              </div>
              
              {previewMode ? (
                <div 
                  className="border rounded-md p-3 min-h-[160px] bg-muted/30 text-sm"
                  dangerouslySetInnerHTML={{ __html: interpolateFields(body) }}
                />
              ) : (
                <Textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[160px] font-mono text-sm"
                  placeholder="Type your email body here..."
                />
              )}
              <div className="flex gap-2 flex-wrap mt-2">
                <Badge variant="outline" className="text-xs font-mono cursor-pointer" onClick={() => setBody(b => b + '{{executionId}}')}>+ {'{{executionId}}'}</Badge>
                <Badge variant="outline" className="text-xs font-mono cursor-pointer" onClick={() => setBody(b => b + '{{flowName}}')}>+ {'{{flowName}}'}</Badge>
                <Badge variant="outline" className="text-xs font-mono cursor-pointer" onClick={() => setBody(b => b + '{{entityName}}')}>+ {'{{entityName}}'}</Badge>
              </div>
            </div>

            {executionFiles.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Attachments</Label>
                <div className="space-y-2">
                  {executionFiles.map((f: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 border rounded-md p-2 bg-muted/30">
                      <Checkbox 
                        id={`file-${idx}`}
                        checked={selectedDocs.includes(f.driveUrl)}
                        onCheckedChange={(c) => {
                          if (c) setSelectedDocs([...selectedDocs, f.driveUrl])
                          else setSelectedDocs(selectedDocs.filter(d => d !== f.driveUrl))
                        }}
                      />
                      <Label htmlFor={`file-${idx}`} className="text-sm cursor-pointer">{f.name || 'Attachment'}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={isRejected || sending || !to || !subject}>
            {sending ? 'Sending...' : <><Send className="h-4 w-4 mr-2" /> Send Email</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
