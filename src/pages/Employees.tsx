import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2, Users, Loader2 } from 'lucide-react'

interface Employee {
  employeeId: string
  employeeNumber: string
  displayName: string
  email: string
  department: string
  isActive: boolean
  createdAt: string
}

export default function Employees() {
  const { user } = useAuthStore()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formNumber, setFormNumber] = useState('')
  const [formDepartment, setFormDepartment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadEmployees() }, [])

  const loadEmployees = async () => {
    setLoading(true)
    try {
      const result = await callGAS<{ success: boolean; employees: Employee[] }>('getEmployees', { token: user?.token })
      if (result && result.success) setEmployees(result.employees || [])
    } catch (e) { console.error('Load employees error:', e) }
    finally { setLoading(false) }
  }

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormEmail('')
    setFormNumber('')
    setFormDepartment('')
    setDialogOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setFormName(emp.displayName)
    setFormEmail(emp.email)
    setFormNumber(emp.employeeNumber)
    setFormDepartment(emp.department)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) return alert('Name and email are required')
    setSaving(true)
    try {
      if (editing) {
        await callGAS('updateEmployee', {
          token: user?.token,
          employeeId: editing.employeeId,
          employeeData: { name: formName, email: formEmail, employeeNumber: formNumber, department: formDepartment },
        })
      } else {
        await callGAS('createEmployee', {
          token: user?.token,
          employeeData: { name: formName, email: formEmail, employeeNumber: formNumber, department: formDepartment },
        })
      }
      setDialogOpen(false)
      await loadEmployees()
    } catch (e) { console.error('Save error:', e) }
    finally { setSaving(false) }
  }

  const handleDelete = async (emp: Employee) => {
    if (!confirm('Deactivate employee ' + emp.displayName + '?')) return
    try {
      await callGAS('deleteEmployee', { token: user?.token, employeeId: emp.employeeId })
      await loadEmployees()
    } catch (e) { console.error('Delete error:', e) }
  }

  const columns: ColumnDef<Employee>[] = [
    { accessorKey: 'employeeNumber', header: 'Employee #' },
    { accessorKey: 'displayName', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'default' : 'destructive'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row.original)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ]

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
          <Users className="h-5 w-5" /> Employee Directory
        </h2>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> New Employee</Button>
      </div>
      <Card><CardContent className="p-0">
        <DataTable columns={columns} data={employees} searchKey="displayName" searchPlaceholder="Search employees..." />
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Employee' : 'New Employee'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Employee Number</Label><Input value={formNumber} onChange={e => setFormNumber(e.target.value)} placeholder="EMP-001" className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Name *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Full name" className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Email *</Label><Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@company.com" className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Department</Label><Input value={formDepartment} onChange={e => setFormDepartment(e.target.value)} placeholder="Department" className="h-8 text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
