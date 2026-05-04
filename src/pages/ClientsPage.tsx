import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Loader2, Building2, Edit, X } from 'lucide-react'
import { toast } from 'sonner'

interface ClientData {
  clientName: string
  email: string
  isActive: boolean
  createdAt: string
}

export default function ClientsPage() {
  const { user } = useAuthStore()
  const [clients, setClients] = useState<ClientData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ClientData | null>(null)
  const [formData, setFormData] = useState({ clientName: '', email: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadClients() }, [])

  const loadClients = async () => {
    setLoading(true)
    try {
      const result = await callGAS<{ success: boolean; clients: ClientData[] }>('getClients', { token: user?.token })
      if (result && result.success) setClients(result.clients || [])
    } catch (e) {
      toast.error('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.clientName.trim() || !formData.email.trim()) {
      toast.error('Client name and email are required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const result = await callGAS<{ success: boolean }>('updateClient', {
          token: user?.token, clientName: formData.clientName.toUpperCase(), email: formData.email, isActive: editing.isActive,
        })
        if (result?.success) { toast.success('Client updated'); setShowForm(false); setEditing(null); loadClients() }
        else toast.error('Update failed')
      } else {
        const result = await callGAS<{ success: boolean }>('addClient', {
          token: user?.token, clientName: formData.clientName.toUpperCase(), email: formData.email,
        })
        if (result?.success) { toast.success('Client added'); setShowForm(false); loadClients() }
        else toast.error('Add failed')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (c: ClientData) => {
    try {
      const result = await callGAS<{ success: boolean }>('updateClient', {
        token: user?.token, clientName: c.clientName, email: c.email, isActive: !c.isActive,
      })
      if (result?.success) { toast.success('Client updated'); loadClients() }
    } catch (e: any) { toast.error(e.message) }
  }

  const openEdit = (c: ClientData) => {
    setEditing(c)
    setFormData({ clientName: c.clientName, email: c.email })
    setShowForm(true)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div />
        <Button onClick={() => { setEditing(null); setFormData({ clientName: '', email: '' }); setShowForm(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Add Client
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm">{editing ? 'Edit Client' : 'Add Client'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Client Name (UPPERCASE)</label>
              <input
                value={formData.clientName}
                onChange={e => setFormData({ ...formData, clientName: e.target.value.toUpperCase() })}
                className="w-full h-9 text-sm border border-border rounded px-3 bg-background"
                placeholder="JUAN PEREZ"
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full h-9 text-sm border border-border rounded px-3 bg-background" placeholder="client@example.com" />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editing ? 'Update' : 'Add'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {clients.map((c) => (
          <Card key={c.clientName}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">{c.clientName}</h3>
                <p className="text-xs text-muted-foreground">{c.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.isActive ? 'default' : 'destructive'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleToggleActive(c)}>
                  {c.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
