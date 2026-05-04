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
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface Client {
  clientId: string
  clientType: string
  displayName: string
  verifiedEmail: string
  isActive: boolean
  createdAt: string
}

export default function Clients() {
  const { user } = useAuthStore()
  const [clients, setClients] = useState<Client[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState({ type: 'Natural', name: '', email: '' })

  useEffect(() => { loadClients() }, [])

  const loadClients = async () => {
    try {
      const result = await callGAS<{ success: boolean; clients: Client[] }>('getClients', { token: user?.token })
      if (result.success) setClients(result.clients)
    } catch (e) {
      console.error('Load clients error:', e)
    }
  }

  const handleSave = async () => {
    try {
      if (editingClient) {
        await callGAS('updateClient', {
          token: user?.token,
          clientId: editingClient.clientId,
          clientData: { type: formData.type, name: formData.name, email: formData.email },
        })
      } else {
        await callGAS('createClient', {
          token: user?.token,
          clientData: { type: formData.type, name: formData.name, email: formData.email },
        })
      }
      setDialogOpen(false)
      setEditingClient(null)
      setFormData({ type: 'Natural', name: '', email: '' })
      loadClients()
    } catch (e) {
      console.error('Save client error:', e)
    }
  }

  const handleDelete = async (clientId: string) => {
    if (!confirm('Are you sure you want to deactivate this client?')) return
    try {
      await callGAS('deleteClient', { token: user?.token, clientId })
      loadClients()
    } catch (e) {
      console.error('Delete client error:', e)
    }
  }

  const openEdit = (client: Client) => {
    setEditingClient(client)
    setFormData({ type: client.clientType, name: client.displayName, email: client.verifiedEmail })
    setDialogOpen(true)
  }

  const columns: ColumnDef<Client>[] = [
    { accessorKey: 'clientId', header: 'ID' },
    {
      accessorKey: 'clientType',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{row.original.clientType}</Badge>,
    },
    { accessorKey: 'displayName', header: 'Name' },
    { accessorKey: 'verifiedEmail', header: 'Verified Email' },
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
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.clientId)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Client Directory</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingClient(null); setFormData({ type: 'Natural', name: '', email: '' }) }}>
              <Plus className="h-4 w-4 mr-2" /> New Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Natural">Persona Natural</SelectItem>
                    <SelectItem value="Jurídico">Persona Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Display Name</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Company or Person Name" />
              </div>
              <div>
                <Label>Verified Email</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="contact@company.com" />
                <p className="text-xs text-muted-foreground mt-1">This email will be used for DLP-enforced communications</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable columns={columns} data={clients} searchKey="displayName" searchPlaceholder="Search clients..." />
        </CardContent>
      </Card>
    </motion.div>
  )
}