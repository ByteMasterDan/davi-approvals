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

// ─── Zod Schema ───
const clientSchema = z.object({
  clientName: z.string().min(2, 'Client name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  clientType: z.enum(['Natural', 'Jurídico']),
})

// ─── Types ───
interface Client {
  clientName: string
  email: string
  clientType: string
  isActive: boolean
  createdAt: string
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

// ─── Component ───
export default function ClientsPage() {
  const { user } = useAuthStore()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState({
    clientName: '',
    email: '',
    clientType: 'Natural' as const,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadClients() }, [])

  const loadClients = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await callGAS<{ clients?: Client[] }>('getClients', { token: user?.token })
      let loadedClients: Client[] = []
      if (result && Array.isArray(result.clients)) {
        loadedClients = result.clients
      } else if (Array.isArray(result)) {
        loadedClients = result as Client[]
      }
      // Filter out invalid entries
      loadedClients = loadedClients.filter((c) => c && typeof c === 'object' && c.clientName && c.email)
      console.log('[ClientsPage] loaded clients:', loadedClients)
      setClients(loadedClients)
    } catch (e: any) {
      console.error('Load clients error:', e)
      const msg = e.message || 'Unknown error loading clients'
      setError(msg)
      toast.error('Error loading clients', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    try {
      clientSchema.parse(formData)
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
    const loadingToast = toast.loading(editingClient ? 'Updating client...' : 'Creating client...')
    try {
      if (editingClient) {
        const result = await callGAS<{ success?: boolean; error?: string }>('updateClient', {
          token: user?.token,
          clientName: editingClient.clientName,
          clientData: {
            clientName: formData.clientName.toUpperCase(),
            email: formData.email,
            clientType: formData.clientType,
          },
        })
        toast.dismiss(loadingToast)
        if (result?.success !== false) {
          toast.success('Client updated', { description: `${formData.clientName.toUpperCase()} has been updated.` })
        } else {
          toast.error('Update failed', { description: result?.error || 'Unknown error' })
          setSaving(false)
          return
        }
      } else {
        const result = await callGAS<{ success?: boolean; error?: string }>('createClient', {
          token: user?.token,
          clientData: {
            clientName: formData.clientName.toUpperCase(),
            email: formData.email,
            clientType: formData.clientType,
          },
        })
        toast.dismiss(loadingToast)
        if (result?.success !== false) {
          toast.success('Client created', { description: `${formData.clientName.toUpperCase()} has been added.` })
        } else {
          toast.error('Creation failed', { description: result?.error || 'Unknown error' })
          setSaving(false)
          return
        }
      }
      setDialogOpen(false)
      setEditingClient(null)
      setFormData({ clientName: '', email: '', clientType: 'Natural' })
      await loadClients()
    } catch (e: any) {
      toast.dismiss(loadingToast)
      console.error('Save client error:', e)
      toast.error('Save failed', { description: e.message || 'Unexpected error' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (targetClient: Client) => {
    const loadingToast = toast.loading(
      `${targetClient.isActive ? 'Deactivating' : 'Activating'} ${targetClient.clientName}...`
    )
    try {
      const result = await callGAS<{ success?: boolean; error?: string }>('updateClient', {
        token: user?.token,
        clientName: targetClient.clientName,
        clientData: {
          clientName: targetClient.clientName,
          email: targetClient.email,
          clientType: targetClient.clientType,
          isActive: !targetClient.isActive,
        },
      })
      toast.dismiss(loadingToast)
      if (result?.success !== false) {
        toast.success(`Client ${targetClient.isActive ? 'deactivated' : 'activated'}`, {
          description: `${targetClient.clientName}.`,
        })
        await loadClients()
      } else {
        toast.error('Update failed', { description: result?.error || 'Unknown error' })
      }
    } catch (e: any) {
      toast.dismiss(loadingToast)
      console.error('Toggle active error:', e)
      toast.error('Update failed', { description: e.message || 'Unexpected error' })
    }
  }

  const openEdit = (c: Client) => {
    setEditingClient(c)
    setFormData({
      clientName: c.clientName,
      email: c.email,
      clientType: c.clientType as any,
    })
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditingClient(null)
    setFormData({ clientName: '', email: '', clientType: 'Natural' })
    setDialogOpen(true)
  }

  const columns: ColumnDef<Client>[] = [
    {
      id: 'client',
      header: 'Client',
      cell: ({ row }) => {
        const c = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className={`${getAvatarColor(c.clientName)} text-white text-xs font-semibold`}>
                {getInitials(c.clientName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none truncate">{c.clientName}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.email}</p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'clientType',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={row.original.clientType === 'Jurídico' ? 'default' : 'secondary'}>
          {row.original.clientType}
        </Badge>
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
            <TooltipContent>Edit client</TooltipContent>
          </Tooltip>
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
            <TooltipContent>{row.original.isActive ? 'Deactivate client' : 'Activate client'}</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]

  const activeClients = clients.filter((c) => c.isActive)
  const inactiveClients = clients.filter((c) => !c.isActive)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Client Directory</h2>
          <Badge variant="outline" className="text-xs">{clients.length} clients</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadClients} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Client
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading clients</AlertTitle>
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
                  <TabsTrigger value="active">Active Clients ({activeClients.length})</TabsTrigger>
                  <TabsTrigger value="inactive">Inactive Clients ({inactiveClients.length})</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="active" className="mt-0 border-0 p-0">
                <DataTable columns={columns} data={activeClients} searchKey="clientName" searchPlaceholder="Search active clients..." />
              </TabsContent>
              <TabsContent value="inactive" className="mt-0 border-0 p-0">
                <DataTable columns={columns} data={inactiveClients} searchKey="clientName" searchPlaceholder="Search inactive clients..." />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="clientType">Type</Label>
              <Select
                value={formData.clientType}
                onValueChange={(v) => setFormData({ ...formData, clientType: v as any })}
              >
                <SelectTrigger id="clientType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Natural">Persona Natural</SelectItem>
                  <SelectItem value="Jurídico">Persona Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value.toUpperCase() })}
                placeholder="JUAN PEREZ"
                disabled={!!editingClient}
              />
              <p className="text-xs text-muted-foreground mt-1">Unique identifier. Saved in uppercase.</p>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingClient ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
