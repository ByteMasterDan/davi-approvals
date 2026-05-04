import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Loader2, Users, Edit, X } from 'lucide-react'
import { toast } from 'sonner'

interface UserData {
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

export default function UsersPage() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserData | null>(null)
  const [formData, setFormData] = useState({ name: '', email: '', role: 'operator', password: '' })
  const [saving, setSaving] = useState(false)

  const userRole = user?.role?.toLowerCase() || 'operator'
  const availableRoles = userRole === 'admin' ? ['coordinator', 'operator'] : ['operator']

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const result = await callGAS<{ success: boolean; users: UserData[] }>('getUsers', { token: user?.token })
      if (result && result.success) setUsers(result.users || [])
    } catch (e) {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Name and email are required')
      return
    }
    if (!editing && !formData.password.trim()) {
      toast.error('Password is required for new users')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const result = await callGAS<{ success: boolean }>('updateUser', {
          token: user?.token, name: formData.name, email: formData.email, role: formData.role, isActive: editing.isActive,
        })
        if (result?.success) { toast.success('User updated'); setShowForm(false); setEditing(null); loadUsers() }
        else toast.error(result?.error || 'Update failed')
      } else {
        const result = await callGAS<{ success: boolean }>('addUser', {
          token: user?.token, name: formData.name, email: formData.email, role: formData.role, password: formData.password,
        })
        if (result?.success) { toast.success('User added'); setShowForm(false); loadUsers() }
        else toast.error(result?.error || 'Add failed')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (u: UserData) => {
    try {
      const result = await callGAS<{ success: boolean }>('updateUser', {
        token: user?.token, name: u.name, email: u.email, role: u.role, isActive: !u.isActive,
      })
      if (result?.success) { toast.success('User updated'); loadUsers() }
    } catch (e: any) { toast.error(e.message) }
  }

  const openEdit = (u: UserData) => {
    setEditing(u)
    setFormData({ name: u.name, email: u.email, role: u.role })
    setShowForm(true)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div />
        <Button onClick={() => { setEditing(null); setFormData({ name: '', email: '', role: 'operator', password: '' }); setShowForm(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm">{editing ? 'Edit User' : 'Add User'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full h-9 text-sm border border-border rounded px-3 bg-background" placeholder="Full name" disabled={!!editing} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full h-9 text-sm border border-border rounded px-3 bg-background" placeholder="email@example.com" disabled={!!editing} />
            </div>
            {!editing && (
              <div>
                <label className="text-xs text-muted-foreground">Password</label>
                <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full h-9 text-sm border border-border rounded px-3 bg-background" placeholder="Enter password" />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full h-9 text-sm border border-border rounded px-3 bg-background">
                {availableRoles.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editing ? 'Update' : 'Add'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {users.map((u) => (
          <Card key={u.email}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">{u.name}</h3>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.role === 'admin' ? 'default' : u.role === 'coordinator' ? 'secondary' : 'outline'} className="capitalize">{u.role}</Badge>
                <Badge variant={u.isActive ? 'default' : 'destructive'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}>
                  {u.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
