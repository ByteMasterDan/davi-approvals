import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Trash2, AlertCircle, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

interface User {
  userId: string
  email: string
  role: string
  displayName: string
  skills: string[]
  isActive: boolean
  createdAt: string
  lastLogin: string
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('es-HN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(str: string): string {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
    'bg-amber-500', 'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500',
    'bg-teal-500', 'bg-rose-500',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const roleConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  Admin: { variant: 'destructive', label: 'Admin' },
  SuperApprover: { variant: 'default', label: 'Super Approver' },
  Approver: { variant: 'secondary', label: 'Approver' },
  Operator: { variant: 'outline', label: 'Operator' },
}

export default function Users() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({ email: '', password: '', role: 'Operator', displayName: '', skills: '' })

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await callGAS<{ success: boolean; users: User[] }>('getAllUsers', { token: user?.token })
      if (result && result.success && result.users) {
        setUsers(result.users)
      } else {
        setError('Failed to load users')
        toast.error('Failed to load users')
      }
    } catch (e: any) {
      console.error('Load users error:', e)
      const msg = e.message || 'Unknown error loading users'
      setError(msg)
      toast.error('Error loading users', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const loadingToast = toast.loading(editingUser ? 'Updating user...' : 'Creating user...')
    try {
      if (editingUser) {
        const result = await callGAS<{ success: boolean; message?: string; error?: string }>('updateUser', {
          token: user?.token,
          userId: editingUser.userId,
          updates: { 
            email: formData.email, 
            role: formData.role, 
            displayName: formData.displayName, 
            skills: formData.skills 
          },
        })
        toast.dismiss(loadingToast)
        if (result?.success) {
          toast.success('User updated', { description: `${editingUser.email} has been updated successfully.` })
        } else {
          toast.error('Update failed', { description: result?.error || 'Unknown error' })
          return
        }
      } else {
        const result = await callGAS<{ success: boolean; message?: string; error?: string }>('createUser', {
          token: user?.token,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          displayName: formData.displayName,
        })
        toast.dismiss(loadingToast)
        if (result?.success) {
          toast.success('User created', { description: `${formData.email} has been added to the system.` })
        } else {
          toast.error('Creation failed', { description: result?.error || 'Unknown error' })
          return
        }
      }
      setDialogOpen(false)
      setEditingUser(null)
      setFormData({ email: '', password: '', role: 'Operator', displayName: '', skills: '' })
      await loadUsers()
    } catch (e: any) {
      toast.dismiss(loadingToast)
      console.error('Save user error:', e)
      toast.error('Save failed', { description: e.message || 'Unexpected error' })
    }
  }

  const handleDelete = async (targetUser: User) => {
    const loadingToast = toast.loading(`Deactivating ${targetUser.displayName}...`)
    try {
      const result = await callGAS<{ success: boolean; message?: string; error?: string }>('updateUser', {
        token: user?.token,
        userId: targetUser.userId,
        updates: { isActive: false },
      })
      toast.dismiss(loadingToast)
      if (result?.success) {
        toast.success('User deactivated', {
          description: `${targetUser.displayName} (${targetUser.email}) has been deactivated.`,
        })
        await loadUsers()
      } else {
        toast.error('Deactivation failed', { description: result?.error || 'Unknown error' })
      }
    } catch (e: any) {
      toast.dismiss(loadingToast)
      console.error('Delete user error:', e)
      toast.error('Deactivation failed', { description: e.message || 'Unexpected error' })
    }
  }

  const openEdit = (u: User) => {
    setEditingUser(u)
    setFormData({ email: u.email, password: '', role: u.role, displayName: u.displayName, skills: u.skills.join(', ') })
    setDialogOpen(true)
  }

  const columns: ColumnDef<User>[] = [
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => {
        const u = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className={`${getAvatarColor(u.email)} text-white text-xs font-semibold`}>
                {getInitials(u.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none truncate">{u.displayName}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const cfg = roleConfig[row.original.role]
        return <Badge variant={cfg?.variant || 'secondary'}>{cfg?.label || row.original.role}</Badge>
      },
    },
    {
      accessorKey: 'skills',
      header: 'Skills',
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {row.original.skills.map((s, i) => (
            <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'destructive'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      accessorKey: 'lastLogin',
      header: 'Last Login',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.original.lastLogin)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
                <Edit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit user</TooltipContent>
          </Tooltip>
          {row.original.email !== user?.email && row.original.isActive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(row.original)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Deactivate user</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
  ]

  const activeUsers = users.filter(u => u.isActive)
  const inactiveUsers = users.filter(u => !u.isActive)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">User Management</h2>
          <Badge variant="outline" className="text-xs">{users.length} users</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingUser(null); setFormData({ email: '', password: '', role: 'Operator', displayName: '', skills: '' }) }}>
                <Plus className="h-4 w-4 mr-2" /> New User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="user@company.com" />
                </div>
                {!editingUser && (
                  <div>
                    <Label>Password</Label>
                    <Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Password" />
                  </div>
                )}
                <div>
                  <Label>Display Name</Label>
                  <Input value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} placeholder="John Doe" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="SuperApprover">Super Approver</SelectItem>
                      <SelectItem value="Approver">Approver</SelectItem>
                      <SelectItem value="Operator">Operator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Skills (comma-separated)</Label>
                  <Input value={formData.skills} onChange={e => setFormData({ ...formData, skills: e.target.value })} placeholder="Finance, Legal, IT" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading users</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="active" className="w-full">
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                  <TabsTrigger value="active">Active Users ({activeUsers.length})</TabsTrigger>
                  <TabsTrigger value="inactive">Inactive Users ({inactiveUsers.length})</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="active" className="mt-0 border-0 p-0">
                <DataTable columns={columns} data={activeUsers} searchKey="email" searchPlaceholder="Search active users..." />
              </TabsContent>
              <TabsContent value="inactive" className="mt-0 border-0 p-0">
                <DataTable columns={columns} data={inactiveUsers} searchKey="email" searchPlaceholder="Search inactive users..." />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}