import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Lock, User, Shield, X, Settings as SettingsIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface Settings {
  ccRecipients: string[]
  emailTemplateSubject: string
  emailTemplateHtml: string
  customTemplateVars: { key: string; value: string }[]
}

const BUILT_IN_VARS = [
  { key: 'clientName', desc: 'Nombre del cliente' },
  { key: 'fileName', desc: 'Nombre del archivo' },
  { key: 'date', desc: 'Fecha de aprobación' },
  { key: 'approvedBy', desc: 'Email de quien aprobo' },
  { key: 'escalatedBy', desc: 'Email de quien escalo (si aplica)' },
  { key: 'clientType', desc: 'Tipo de cliente (Natural/Juridica)' },
]

const DEFAULT_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Documento Aprobado</title></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#CE1126 0%,#a30d1f 100%);padding:30px 40px;position:relative;overflow:hidden;"><div style="position:absolute;top:-50px;right:-50px;width:150px;height:150px;background:rgba(255,255,255,0.1);border-radius:50%;"></div><div style="position:absolute;bottom:-30px;left:20px;width:80px;height:80px;background:rgba(255,255,255,0.08);border-radius:50%;"></div><table cellpadding="0" cellspacing="0" width="100%"><tr><td><span style="font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:1px;">DAVIVIENDA</span></td><td align="right"><span style="font-size:12px;color:rgba(255,255,255,0.8);">Sistema de Aprobaciones</span></td></tr></table></td></tr><tr><td style="padding:40px 40px 20px;text-align:center;"><div style="display:inline-block;width:80px;height:80px;background-color:#28a745;border-radius:50%;line-height:80px;text-align:center;box-shadow:0 4px 12px rgba(40,167,69,0.3);"><span style="color:#ffffff;font-size:36px;font-weight:bold;">✓</span></div><h1 style="margin:20px 0 5px;font-size:28px;color:#1a1a1a;font-weight:bold;">Documento Aprobado</h1><p style="margin:0;color:#666666;font-size:14px;">Su documento ha sido procesado exitosamente</p></td></tr><tr><td style="padding:20px 40px;"><div style="background-color:#f8f9fa;border-left:4px solid #CE1126;border-radius:4px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,0.08);"><table width="100%" cellpadding="4"><tr><td style="color:#999999;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Cliente</td></tr><tr><td style="color:#1a1a1a;font-size:16px;font-weight:bold;padding-bottom:16px;">{{clientName}}</td></tr><tr><td style="color:#999999;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Documento</td></tr><tr><td style="color:#1a1a1a;font-size:16px;padding-bottom:16px;">{{fileName}}</td></tr><tr><td style="color:#999999;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Fecha de Aprobación</td></tr><tr><td style="color:#1a1a1a;font-size:16px;padding-bottom:16px;">{{date}}</td></tr><tr><td style="color:#999999;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Aprobado por</td></tr><tr><td style="color:#1a1a1a;font-size:16px;">{{approvedBy}}</td></tr></table></div></td></tr><tr><td style="padding:10px 40px 20px;"><p style="color:#333333;font-size:15px;line-height:1.7;margin:0;">Estimado/a <strong>{{clientName}}</strong>,</p><p style="color:#333333;font-size:15px;line-height:1.7;margin:15px 0;">Nos complace informarle que su documento ha sido aprobado exitosamente y se encuentra disponible para su consulta.</p><p style="color:#333333;font-size:15px;line-height:1.7;margin:15px 0;">Si tiene alguna duda o necesita asistencia, no dude en contactarnos.</p></td></tr><tr><td style="padding:10px 40px 30px;text-align:center;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#CE1126 0%,#a30d1f 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-weight:bold;font-size:14px;box-shadow:0 4px 12px rgba(206,17,38,0.3);">Ver Documento</a></td></tr><tr><td style="background-color:#1a1a1a;padding:25px 40px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><p style="color:#ffffff;font-size:14px;font-weight:bold;margin:0 0 5px;">Banco Davivienda Salvadoreño S.A.</p><p style="color:rgba(255,255,255,0.6);font-size:11px;margin:0;line-height:1.5;">Este es un correo automático generado por el Sistema de Aprobaciones.<br>Por favor no responda directamente a este mensaje.</p></td><td align="right" style="vertical-align:bottom;"><div style="width:4px;height:40px;background-color:#CE1126;border-radius:2px;"></div></td></tr></table></td></tr></table></td></tr></table></body></html>';

export default function Settings() {
  const user = useAuthStore(s => s.user)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [ccRecipients, setCCRecipients] = useState<string[]>([])
  const [newCCEmail, setNewCCEmail] = useState('')
  const [ccLoading, setCCLoading] = useState(false)

  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [customVars, setCustomVars] = useState<{ key: string; value: string }[]>([])
  const [newVarKey, setNewVarKey] = useState('')
  const [templateLoading, setTemplateLoading] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState(false)

  const userRole = user?.role?.toLowerCase() || ''
  const canManageSettings = userRole === 'admin' || userRole === 'superapprover'

  useEffect(() => {
    if (canManageSettings) {
      loadSettings()
    }
  }, [canManageSettings])

  const loadSettings = async () => {
    setCCLoading(true)
    try {
      const result = await callGAS<{ settings?: Settings }>('getSettings', { token: user?.token })
      if (result && result.settings) {
        setCCRecipients(result.settings.ccRecipients || [])
        setEmailSubject(result.settings.emailTemplateSubject || '')
        setEmailBody(result.settings.emailTemplateHtml || DEFAULT_HTML)
        setCustomVars(result.settings.customTemplateVars || [])
      }
    } catch (e) {
      console.error('Failed to load settings', e)
    } finally {
      setCCLoading(false)
    }
  }

  const addCCRecipient = async () => {
    const email = newCCEmail.trim().toLowerCase()
    if (!email) return
    if (!email.includes('@')) {
      toast.error('Please enter a valid email')
      return
    }
    if (ccRecipients.includes(email)) {
      toast.error('Email already in CC list')
      return
    }
    const newList = [...ccRecipients, email].join(',')
    setCCLoading(true)
    try {
      const result = await callGAS<{ success?: boolean }>('updateSettings', {
        token: user?.token,
        key: 'CC_RECIPIENTS',
        value: newList,
      })
      if (result && result.success !== false) {
        setCCRecipients([...ccRecipients, email])
        setNewCCEmail('')
        toast.success('CC recipient added')
      } else {
        toast.error('Failed to add CC recipient')
      }
    } catch (e: any) {
      toast.error('Failed to add CC recipient: ' + e.message)
    } finally {
      setCCLoading(false)
    }
  }

  const removeCCRecipient = async (email: string) => {
    const newList = ccRecipients.filter((e) => e !== email).join(',')
    setCCLoading(true)
    try {
      const result = await callGAS<{ success?: boolean }>('updateSettings', {
        token: user?.token,
        key: 'CC_RECIPIENTS',
        value: newList,
      })
      if (result && result.success !== false) {
        setCCRecipients(ccRecipients.filter((e) => e !== email))
        toast.success('CC recipient removed')
      } else {
        toast.error('Failed to remove CC recipient')
      }
    } catch (e: any) {
      toast.error('Failed to remove CC recipient: ' + e.message)
    } finally {
      setCCLoading(false)
    }
  }

  const addCustomVar = () => {
    const key = newVarKey.trim()
    if (!key) return
    if (customVars.find((v) => v.key === key)) {
      toast.error('Variable already exists')
      return
    }
    setCustomVars([...customVars, { key, value: '' }])
    setNewVarKey('')
  }

  const removeCustomVar = async (key: string) => {
    setCustomVars(customVars.filter((v) => v.key !== key))
  }

  const saveEmailTemplate = async () => {
    setTemplateLoading(true)
    try {
      await Promise.all([
        callGAS('updateSettings', { token: user?.token, key: 'EMAIL_TEMPLATE_SUBJECT', value: emailSubject }),
        callGAS('updateSettings', { token: user?.token, key: 'EMAIL_TEMPLATE_HTML', value: emailBody }),
        callGAS('updateSettings', { token: user?.token, key: 'CUSTOM_TEMPLATE_VARS', value: JSON.stringify(customVars) }),
      ])
      toast.success('Email template saved')
    } catch (e: any) {
      toast.error('Failed to save template: ' + e.message)
    } finally {
      setTemplateLoading(false)
    }
  }

  const interpolatePreview = (text: string) => {
    if (!text) return ''
    return text
      .replace(/\{\{clientName\}\}/g, '<strong>JUAN PEREZ</strong>')
      .replace(/\{\{fileName\}\}/g, '<strong>documento.pdf</strong>')
      .replace(/\{\{date\}\}/g, '<strong>' + new Date().toLocaleDateString() + '</strong>')
      .replace(/\{\{approvedBy\}\}/g, '<strong>admin@empresa.com</strong>')
      .replace(/\{\{escalatedBy\}\}/g, '<em>(ninguno)</em>')
      .replace(/\{\{clientType\}\}/g, '<strong>Natural</strong>')
      .replace(/\{\{(?!clientName|fileName|date|approvedBy|escalatedBy|clientType)[^}]+\}\}/g, '<span class="bg-yellow-100 px-1 rounded">$&=</span>')
      .replace(/\n/g, '<br>')
  }

  const previewHtml = useMemo(() => interpolatePreview(emailBody), [emailBody])

  const insertVar = (key: string) => {
    setEmailBody((b) => b + '{{' + key + '}}')
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)
    setPasswordMessage('')

    try {
      const result = await callGAS<{ success: boolean; message?: string; error?: string }>(
        'changePassword',
        { token: user?.token, oldPassword, newPassword }
      )
      if (result.success) {
        setPasswordMessage('Password changed successfully!')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordMessage(result.error || 'Failed to change password')
      }
    } catch (e) {
      setPasswordMessage(e instanceof Error ? e.message : 'Error changing password')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="cc">CC Recipients</TabsTrigger>
          <TabsTrigger value="email">Email Template</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                  <SettingsIcon className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{user?.displayName}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <div className="mt-1">
                    <Badge variant={user?.role === 'Admin' ? 'destructive' : 'default'}>{user?.role}</Badge>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <div className="mt-1">
                    <Badge variant={user?.role === 'Admin' ? 'destructive' : 'default'}>{user?.role}</Badge>
                  </div>
                </div>
                <div>
                  <Label>Skills</Label>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {user?.skills?.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>) || <span className="text-sm text-muted-foreground">None</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
              </div>
              <div>
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              {passwordMessage && (
                <p className={`text-sm ${passwordMessage.includes('success') ? 'text-green-500' : 'text-destructive'}`}>
                  {passwordMessage}
                </p>
              )}
              <Button onClick={handleChangePassword} disabled={passwordLoading}>
                <Lock className="h-4 w-4 mr-2" />
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CC Recipients</CardTitle>
              <CardDescription>
                These email addresses will receive a notification when a document is approved. Up to ~10 recipients.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ccRecipients.length > 0 ? (
                <div className="space-y-2">
                  {ccRecipients.map((email) => (
                    <div key={email} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <span className="text-sm">{email}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeCCRecipient(email)}
                        disabled={ccLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No CC recipients configured.</p>
              )}

              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={newCCEmail}
                  onChange={(e) => setNewCCEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCCRecipient()}
                  className="flex-1"
                />
                <Button onClick={addCCRecipient} disabled={ccLoading || !newCCEmail.trim()}>
                  {ccLoading ? 'Saving...' : 'Add'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageSettings && (
          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Template</CardTitle>
                <CardDescription>
                  Customize the email sent to clients when a document is approved. Use variables like {'{{clientName}}'} which will be replaced automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Subject</Label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Documento aprobado - {{clientName}}"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Body</Label>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPreviewTemplate(!previewTemplate)}>
                      {previewTemplate ? 'Edit' : 'Preview'}
                    </Button>
                  </div>
                  {previewTemplate ? (
                    <div
                      className="border rounded-md p-3 min-h-[160px] bg-muted/30 text-sm whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <Textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="min-h-[160px] font-mono text-sm"
                      placeholder="Type your email body here..."
                    />
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Available Variables (click to insert at cursor)</Label>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {BUILT_IN_VARS.map((v) => (
                      <Badge key={v.key} variant="outline" className="text-xs font-mono cursor-pointer" onClick={() => insertVar(v.key)} title={v.desc}>
                        {'{{' + v.key + '}}'}
                      </Badge>
                    ))}
                    {customVars.map((cv) => (
                      <Badge key={cv.key} variant="secondary" className="text-xs font-mono cursor-pointer" onClick={() => insertVar(cv.key)}>
                        {'{{' + cv.key + '}}'}
                        <button className="ml-1 text-destructive/60 hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeCustomVar(cv.key); }}>x</button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="customFieldName"
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomVar()}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addCustomVar}>Add Custom Variable</Button>
                </div>

                <Button onClick={saveEmailTemplate} disabled={templateLoading}>
                  {templateLoading ? 'Saving...' : 'Save Template'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>G-Flow Approval System</CardTitle>
              <CardDescription>Version 1.0.0</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Workflow approval platform built with React + Google Apps Script</p>
                <p>Features: Visual Workflow Builder, RBAC, Skills-based routing, DLP Entity Management</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
