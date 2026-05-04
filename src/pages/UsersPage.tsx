import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { z } from 'zod'

// ─── Zod Schemas ───
const createUserSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['Admin', 'SuperApprover', 'Approver', 'Operator']),
  skills: z.string().optional(),
})

const updateUserSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['Admin', 'SuperApprover', 'Approver', 'Operator']),
  skills: z.string().optional(),
})

// ─── Types ───
interface User {
  userId: string
  email: string
  role: string
  displayName: string
  skills: string[]
  isActive: boolean
  createdAt: string
  lastLogin?: string
}

// ─── Helpers ───
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

function getInitials(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  if (parts.length === 1 && parts[0][0]) {
    return parts[0][0].toUpperCase()
  }
  return '?'
}

function getAvatarColor(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return 'bg-gray-500'
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

// ─── Component ───
export default function UsersPage() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'Operator' as const,
    displayName: '',
    skills: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadUsers() }, [])

  const normalizeRole = (role: string): string => {
    if (!role) return 'Operator'
    const lower = role.toLowerCase()
    const map: Record<string, string> = {
      admin: 'Admin',
      superapprover: 'SuperApprover',
      approver: 'Approver',
      operator: 'Operator',
      coordinator: 'Coordinator',
    }
    return map[lower] || role.charAt(0).toUpperCase() + role.slice(1)
  }

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await callGAS<{ users?: User[] }>('getAllUsers', { token: user?.token })
      let loadedUsers: User[] = []
      if (result && Array.isArray(result.users)) {
        loadedUsers = result.users
      } else if (Array.isArray(result)) {
        loadedUsers = result as User[]
      }
      // Filter out invalid entries and normalize roles
      loadedUsers = loadedUsers
        .filter((u) => u && typeof u === 'object' && u.email && u.userId)
        .map((u) => ({ ...u, role: normalizeRole(u.role) }))
      console.log('[UsersPage] loaded users:', loadedUsers)
      setUsers(loadedUsers)
    } catch (e: any) {
      console.error('Load users error:', e)
      const msg = e.message || 'Unknown error loading users'
      setError(msg)
      toast.error('Error loading users', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    try {
      if (editingUser) {
        updateUserSchema.parse(formData)
      } else {
        createUserSchema.parse(formData)
      }
      return true
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast.error('Validation error', { description: err.errors.map((e: any) => e.message).join(', ') })
      } else {
        toast.error('Validation error')
      }
      return false
    }
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    const loadingToast = toast.loading(editingUser ? 'Updating user...' : 'Creating user...')
    try {
      if (editingUser) {
        const result = await callGAS<{ success?: boolean; message?: string; error?: string }>('updateUser', {
          token: user?.token,
          userId: editingUser.userId,
          updates: {
            email: formData.email,
            role: formData.role,
            displayName: formData.displayName,
            skills: formData.skills,
          },
        })
        toast.dismiss(loadingToast)
        if (result?.success !== false) {
          toast.success('User updated', { description: `${formData.displayName} has been updated successfully.` })
        } else {
          toast.error('Update failed', { description: result?.error || 'Unknown error' })
          setSaving(false)
          return
        }
      } else {
        const result = await callGAS<{ success?: boolean; message?: string; error?: string }>('createUser', {
          token: user?.token,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          displayName: formData.displayName,
          skills: formData.skills ? formData.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
        })
        toast.dismiss(loadingToast)
        if (result?.success !== false) {
          toast.success('User created', { description: `${formData.displayName} has been added to the system.` })
        } else {
          toast.error('Creation failed', { description: result?.error || 'Unknown error' })
          setSaving(false)
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
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (targetUser: User) => {
    const loadingToast = toast.loading(`${targetUser.isActive ? 'Deactivating' : 'Activating'} ${targetUser.displayName}...`)
    try {
      const result = await callGAS<{ success?: boolean; error?: string }>('updateUser', {
        token: user?.token,
        userId: targetUser.userId,
        updates: { isActive: !targetUser.isActive },
      })
      toast.dismiss(loadingToast)
      if (result?.success !== false) {
        toast.success(`User ${targetUser.isActive ? 'deactivated' : 'activated'}`, {
          description: `${targetUser.displayName} (${targetUser.email}).`,
        })
        await loadUsers()
      } else {
        toast.error('Update failed', { description: result?.error || 'Unknown error' })
      }
    } catch (e: any) {
      toast.dismiss(loadingToast)
      console.error('Toggle active error:', e)
      toast.error('Update failed', { description: e.message || 'Unexpected error' })
    }
  }

  const openEdit = (u: User) => {
    setEditingUser(u)
    setFormData({
      email: u.email,
      password: '',
      role: u.role as any,
      displayName: u.displayName,
      skills: Array.isArray(u.skills) ? u.skills.join(', ') : '',
    })
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditingUser(null)
    setFormData({ email: '', password: '', role: 'Operator', displayName: '', skills: '' })
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
          {row.original.skills?.map((s, i) => (
            <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
          )) || '—'}
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
          {row.original.email !== user?.email && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={row.original.isActive ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-600'}
                  onClick={() => handleToggleActive(row.original)}
                >
                  {row.original.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{row.original.isActive ? 'Deactivate user' : 'Activate user'}</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
  ]

  const activeUsers = users.filter((u) => u.isActive)
  const inactiveUsers = users.filter((u) => !u.isActive)

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
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New User
          </Button>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@company.com"
                disabled={!!editingUser}
              />
            </div>
            {!editingUser && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min. 6 characters"
                />
              </div>
            )}
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v as any })}
              >
                <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="SuperApprover">Super Approver</SelectItem>
                  <SelectItem value="Approver">Approver</SelectItem>
                  <SelectItem value="Operator">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="Finance, Legal, IT"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
