import { useState, useEffect, useCallback, useRef, DragEvent } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { motion, AnimatePresence } from 'framer-motion'
import FormBuilder from '../components/form-builder'
import FormNode from '../components/workflow/FormNode'
import SaveToSheetNode from '../components/workflow/SaveToSheetNode'
import EmailNode from '../components/workflow/EmailNode'
import ApprovalNode from '../components/workflow/ApprovalNode'
import ArchiveNode from '../components/workflow/ArchiveNode'
import DataLookupNode from '../components/workflow/DataLookupNode'
import {
  Plus, Edit, Trash2, ArrowLeft, Save, GripVertical,
  Copy, Play, ClipboardList, Database, Mail, CheckCircle, FolderArchive, Square, RefreshCw, Loader2, XCircle, Search
} from 'lucide-react'
import ReactFlow, {
  Node, addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, Connection, MarkerType,
  Handle, Position, ReactFlowProvider, ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'

function StartNode() {
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-green-600 text-white rounded-full w-20 h-20 flex items-center justify-center text-sm font-bold shadow-lg cursor-grab">
      <div className="text-center"><Play className="h-5 w-5 mx-auto" /><div className="text-xs mt-0.5">START</div></div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-400 !w-3 !h-3" />
    </motion.div>
  )
}

function EndNode() {
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-red-600 text-white rounded-full w-20 h-20 flex items-center justify-center text-sm font-bold shadow-lg cursor-grab">
      <Handle type="target" position={Position.Top} className="!bg-red-400 !w-3 !h-3" />
      <div className="text-center"><Square className="h-5 w-5 mx-auto" /><div className="text-xs mt-0.5">END</div></div>
    </motion.div>
  )
}

const nodeTypes = {
  start: StartNode, end: EndNode,
  form: FormNode, saveToSheet: SaveToSheetNode,
  email: EmailNode, approval: ApprovalNode, archive: ArchiveNode,
  dataLookup: DataLookupNode,
}

const catalogItems = [
  { type: 'start', label: 'Start', icon: Play, color: 'bg-green-600', desc: 'Start point' },
  { type: 'form', label: 'Form', icon: ClipboardList, color: 'bg-violet-600', desc: 'User fills form' },
  { type: 'dataLookup', label: 'Data Lookup', icon: Search, color: 'bg-indigo-600', desc: 'Lookup email from directory' },
  { type: 'saveToSheet', label: 'Save Data', icon: Database, color: 'bg-cyan-600', desc: 'Save to sheet' },
  { type: 'email', label: 'Email', icon: Mail, color: 'bg-blue-600', desc: 'Send email' },
  { type: 'approval', label: 'Approval', icon: CheckCircle, color: 'bg-primary', desc: 'Approval step' },
  { type: 'archive', label: 'Archive', icon: FolderArchive, color: 'bg-yellow-600', desc: 'Save to Drive' },
  { type: 'end', label: 'End', icon: Square, color: 'bg-red-600', desc: 'End point' },
]

export default function Flows() {
  const { user } = useAuthStore()
  const [mode, setMode] = useState<'list' | 'edit'>('list')
  const [loading, setLoading] = useState(true)
  const [flows, setFlows] = useState<any[]>([])
  const [selectedFlow, setSelectedFlow] = useState<any>(null)
  const [flowName, setFlowName] = useState('')
  const [flowDescription, setFlowDescription] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [saving, setSaving] = useState(false)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [usersList, setUsersList] = useState<any[]>([])
  const [saveProgress, setSaveProgress] = useState<{ steps: { label: string; done: boolean; error?: string }[]; currentStep: number; complete: boolean } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => { loadInitialData() }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [fRes, uRes] = await Promise.all([
        callGAS<{ success: boolean; flows: any[] }>('getFlows', { token: user?.token }),
        callGAS<{ success: boolean; users: any[] }>('getAllUsers', { token: user?.token }).catch(() => null)
      ])
      if (fRes && fRes.success) setFlows(fRes.flows || [])
      if (uRes && uRes.success) setUsersList(uRes.users || [])
    } catch (e) {
      console.error('Load initial data error:', e)
    } finally {
      setLoading(false)
    }
  }

  const openCreateMode = () => {
    setSelectedFlow(null)
    setFlowName('')
    setFlowDescription('')
    setNodes([{ id: 'start', type: 'start', position: { x: 400, y: 50 }, data: {} }])
    setEdges([])
    setSelectedNode(null)
    setMode('edit')
  }

  const refreshUsers = async () => {
    try {
      const uRes = await callGAS<{ success: boolean; users: any[]; error?: string }>('getAllUsers', { token: user?.token })
      if (uRes && uRes.success) {
        setUsersList(uRes.users || [])
      } else {
        console.error('Refresh users error:', uRes?.error)
      }
    } catch (e) { console.error('Refresh users error:', e) }
  }

  const openEditMode = async (flow: any) => {
    setSelectedFlow(flow)
    setFlowName(flow.flowName)
    setFlowDescription(flow.description)

    if (flow.steps && flow.steps.length > 0) {
      const loadedNodes: Node[] = flow.steps.map((s: any) => ({
        id: s.id, type: s.type, position: s.position || { x: 400, y: 200 },
        data: { label: s.name, assignee: s.assigneeValue, assignees: s.assignees || [], skills: s.skills, recipient: s.recipient,
                to: s.to, cc: s.cc, bcc: s.bcc, from: s.from, fields: s.fields, fieldMapping: s.fieldMapping || [],
                spreadsheetId: s.spreadsheetId, sheetName: s.sheetName, folderPath: s.folderPath,
                driveFolderId: s.driveFolderId || '',
                subject: s.subject, body: s.body },
      }))
      if (!loadedNodes.find(n => n.id === 'start')) loadedNodes.unshift({ id: 'start', type: 'start', position: { x: 400, y: 50 }, data: {} })
      if (!loadedNodes.find(n => n.id === 'end')) loadedNodes.push({ id: 'end', type: 'end', position: { x: 400, y: 550 }, data: {} })
      setNodes(loadedNodes)

      // Restore saved edges
      if (flow.edges && flow.edges.length > 0) {
        const loadedEdges = flow.edges.map((e: any) => ({
          id: e.id || `e-${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
        }))
        setEdges(loadedEdges)
      } else {
        setEdges([])
      }
    } else {
      setNodes([{ id: 'start', type: 'start', position: { x: 400, y: 50 }, data: {} }])
      setEdges([])
    }
    setSelectedNode(null)
    setMode('edit')
  }

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' } }, eds))
  }, [setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { setSelectedNode(node); setTestResult(null) }, [])
  const onPaneClick = useCallback(() => { setSelectedNode(null) }, [])

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/reactflow')
    if (!type || !rfInstance || !reactFlowWrapper.current) return
    const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const item = catalogItems.find(c => c.type === type)
    const newNode: Node = {
      id: `${type}-${Date.now()}`, type, position,
      data: {
        label: item?.label || type, assignee: '', assignees: [], skills: [], recipient: '',
        to: [], cc: [], bcc: [], from: '', fields: [], fieldMapping: [],
        spreadsheetId: '', sheetName: '', folderPath: '', driveFolderId: '',
        subject: '', body: '',
      },
    }
    setNodes(nds => nds.concat(newNode))
  }, [rfInstance, setNodes])

  const onDragOver = useCallback((event: DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }, [])

  const deleteSelectedNode = () => {
    if (!selectedNode || selectedNode.id === 'start' || selectedNode.id === 'end') return
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id))
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
  }

  const updateNodeData = (key: string, value: unknown) => {
    if (!selectedNode) return
    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: value } } : n))
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, [key]: value } } : null)
  }

  const handleSave = async () => {
    if (!flowName.trim()) return alert('Flow name required')
    setSaving(true)

    const progressSteps = [
      { label: 'Saving flow...', done: false },
      { label: 'Sending notifications...', done: false },
      { label: 'Complete!', done: false },
    ]
    setSaveProgress({ steps: progressSteps, currentStep: 0, complete: false })

    try {
      const steps = nodes.map(n => ({
        id: n.id, type: n.type, name: n.data.label,
        assigneeType: (n.type === 'approval' || n.type === 'form') ? 'user' : undefined,
        assigneeValue: n.data.assignee, assignees: n.data.assignees || [], skills: n.data.skills, position: n.position,
        to: n.data.to, cc: n.data.cc, bcc: n.data.bcc, from: n.data.from,
        fields: n.data.fields, fieldMapping: n.data.fieldMapping,
        spreadsheetId: n.data.spreadsheetId, sheetName: n.data.sheetName,
        folderPath: n.data.folderPath, driveFolderId: n.data.driveFolderId,
        subject: n.data.subject, body: n.data.body,
      }))

      const edgesData = edges.map(e => ({ id: e.id, source: e.source, target: e.target }))

      if (selectedFlow) {
        await callGAS('updateFlow', { token: user?.token, flowId: selectedFlow.flowId, flowData: { name: flowName, description: flowDescription, steps, edges } })
      } else {
        const result = await callGAS<{ success: boolean; flowId: string }>('createFlow', { token: user?.token, flowData: { name: flowName, description: flowDescription, steps, edges } })
        if (result && result.success && result.flowId) {
          setSelectedFlow({ flowId: result.flowId })
        }
      }
      setSaveProgress(prev => prev ? { ...prev, steps: prev.steps.map((s, i) => i === 0 ? { ...s, done: true } : s), currentStep: 1 } : null)

      await new Promise(r => setTimeout(r, 600))
      setSaveProgress(prev => prev ? { ...prev, steps: prev.steps.map((s, i) => i <= 1 ? { ...s, done: true } : s), currentStep: 2 } : null)

      await new Promise(r => setTimeout(r, 400))
      setSaveProgress(prev => prev ? { ...prev, steps: prev.steps.map(s => ({ ...s, done: true })), currentStep: 3, complete: true } : null)

      await loadInitialData()
    } catch (e) {
      console.error('Save error:', e)
      setSaveProgress(prev => prev ? { ...prev, steps: prev.steps.map((s, i) => i === prev.currentStep ? { ...s, error: 'Failed' } : s), complete: true } : null)
    } finally {
      setSaving(false)
    }
  }

  const handleCloseSaveProgress = () => {
    setSaveProgress(null)
    setMode('list')
  }

  const handleDelete = async (flowId: string) => {
    if (!confirm('Deactivate this flow?')) return
    try { await callGAS('deleteFlow', { token: user?.token, flowId }); loadInitialData() }
    catch (e) { console.error('Delete error:', e) }
  }

  const handleCopyLink = (flow: any) => {
    const link = flow.formLink || ''
    if (!link) { alert('No public link generated yet'); return }
    navigator.clipboard.writeText(link).then(() => alert('Link copied!'))
  }

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'flowName', header: 'Name' },
    { accessorKey: 'description', header: 'Description', cell: ({ row }) => <span className="text-muted-foreground truncate max-w-[200px] block">{row.original.description}</span> },
    { accessorKey: 'steps', header: 'Steps', cell: ({ row }) => <Badge variant="secondary">{row.original.steps?.length || 0} nodes</Badge> },
    { accessorKey: 'createdBy', header: 'Created By' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'default' : 'destructive'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMode(row.original)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyLink(row.original)}><Copy className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original.flowId)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

  // LIST MODE
  if (mode === 'list') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Workflows</h2>
          <Button onClick={openCreateMode}><Plus className="h-4 w-4 mr-2" /> New Flow</Button>
        </div>
        <Card><CardContent className="p-0">
          <DataTable columns={columns} data={flows} searchKey="flowName" searchPlaceholder="Search flows..." />
        </CardContent></Card>
      </motion.div>
    )
  }

  // EDIT MODE
  const getIncomingFields = () => {
    if (!selectedNode) return []
    
    const visited = new Set<string>()
    let incomingFields: any[] = []
    
    const findFormFields = (nodeId: string) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      
      const incomingEdges = edges.filter(e => e.target === nodeId)
      for (const edge of incomingEdges) {
        const parent = nodes.find(n => n.id === edge.source)
        if (!parent) continue
        
        if (parent.type === 'form' && parent.data.fields) {
          incomingFields = incomingFields.concat(parent.data.fields)
        }
        
        findFormFields(parent.id)
      }
    }
    
    findFormFields(selectedNode.id)
    
    const uniqueFields = incomingFields.filter((field, index, self) => 
      index === self.findIndex(f => f.id === field.id)
    )
    
    return uniqueFields
  }

  const handleUpdateMapping = (fieldId: string, sheetHeader: string) => {
    if (!selectedNode) return
    let currentMap = selectedNode.data.fieldMapping || []
    currentMap = currentMap.filter((m: any) => m.fieldId !== fieldId)
    currentMap.push({ fieldId, sheetHeader })
    updateNodeData('fieldMapping', currentMap)
  }

  const handleTestNode = async () => {
    if (!selectedNode) return
    setTesting(true)
    setTestResult(null)
    try {
      const nodeData = {
        type: selectedNode.type,
        label: selectedNode.data.label,
        assignee: selectedNode.data.assignee,
        assignees: selectedNode.data.assignees || [],
        fields: selectedNode.data.fields || [],
        to: selectedNode.data.to || [],
        cc: selectedNode.data.cc || [],
        bcc: selectedNode.data.bcc || [],
        from: selectedNode.data.from || '',
        subject: selectedNode.data.subject || '',
        body: selectedNode.data.body || '',
        spreadsheetId: selectedNode.data.spreadsheetId || '',
        sheetName: selectedNode.data.sheetName || '',
        folderPath: selectedNode.data.folderPath || '',
        driveFolderId: selectedNode.data.driveFolderId || '',
        fieldMapping: selectedNode.data.fieldMapping || [],
      }
      const result = await callGAS<{ success: boolean; message?: string; error?: string }>('testNode', {
        token: user?.token,
        nodeData,
      })
      setTestResult({
        success: result?.success || false,
        message: result?.success ? (result.message || 'Test passed') : (result?.error || 'Test failed'),
      })
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <ReactFlowProvider>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[calc(100vh-7rem)] flex gap-4">
        <div className="w-64 shrink-0 space-y-4 overflow-y-auto">
          <Button variant="ghost" onClick={() => setMode('list')} className="w-full justify-start gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Flow Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-xs">Name</Label><Input value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="Flow name" className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Description</Label><Input value={flowDescription} onChange={e => setFlowDescription(e.target.value)} placeholder="Description" className="h-8 text-sm" /></div>
              <Button onClick={handleSave} disabled={saving} className="w-full h-8 text-sm"><Save className="h-3 w-3 mr-2" />{saving ? 'Saving...' : 'Save'}</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Node Catalog</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Drag to canvas</p>
              {catalogItems.map(item => (
                <div key={item.type} draggable onDragStart={e => { e.dataTransfer.setData('application/reactflow', item.type); e.dataTransfer.effectAllowed = 'move' }}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/50 cursor-grab hover:bg-muted hover:border-primary/50 transition-all group">
                  <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform`}><item.icon className="h-4 w-4" /></div>
                  <div className="flex-1"><div className="text-sm font-medium">{item.label}</div><div className="text-xs text-muted-foreground">{item.desc}</div></div>
                  <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 rounded-xl border border-border overflow-hidden bg-background" ref={reactFlowWrapper}>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onInit={setRfInstance} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            onDrop={onDrop} onDragOver={onDragOver} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
            <Background gap={16} size={1} className="!bg-background" />
            <Controls className="!bg-card !border-border" />
            <MiniMap nodeColor="hsl(var(--muted))" className="!bg-card !border-border" maskColor="hsl(var(--background) / 0.8)" />
          </ReactFlow>
        </div>

        <div className="w-80 shrink-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {selectedNode && (
              <motion.div key={selectedNode.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Node Config</CardTitle>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedNode(null)}>✕</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div><Label className="text-xs">Type</Label><Badge variant="outline" className="mt-1">{selectedNode.type}</Badge></div>
                    <div><Label className="text-xs">Label</Label><Input value={selectedNode.data.label || ''} onChange={e => updateNodeData('label', e.target.value)} className="h-8 text-sm" /></div>

                    {(selectedNode.type === 'approval') && (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Assignee</Label>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refreshUsers} title="Refresh users">
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                          <Select value={selectedNode.data.assignee || ''} onValueChange={v => updateNodeData('assignee', v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select user" /></SelectTrigger>
                            <SelectContent>
                              {usersList.map((u: any) => <SelectItem key={u.userId} value={u.email}>{u.displayName} ({u.email})</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">Required Skills</Label><Input value={(selectedNode.data.skills || []).join(', ')} onChange={e => updateNodeData('skills', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="Finance, Legal" className="h-8 text-sm" /></div>
                      </>
                    )}

                    {selectedNode.type === 'email' && (
                      <>
                        <div><Label className="text-xs">From Alias</Label><Input value={selectedNode.data.from || ''} onChange={e => updateNodeData('from', e.target.value)} placeholder="noreply@company.com" className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">To (comma separated)</Label><Input value={(selectedNode.data.to || []).join(', ')} onChange={e => updateNodeData('to', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="user@company.com" className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">CC</Label><Input value={(selectedNode.data.cc || []).join(', ')} onChange={e => updateNodeData('cc', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">BCC</Label><Input value={(selectedNode.data.bcc || []).join(', ')} onChange={e => updateNodeData('bcc', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">Subject</Label><Input value={selectedNode.data.subject || ''} onChange={e => updateNodeData('subject', e.target.value)} placeholder="Subject {executionId}" className="h-8 text-sm" /></div>
                      </>
                    )}

                    {selectedNode.type === 'saveToSheet' && (
                      <>
                        <div><Label className="text-xs">Spreadsheet ID</Label><Input value={selectedNode.data.spreadsheetId || ''} onChange={e => updateNodeData('spreadsheetId', e.target.value)} placeholder="Sheet ID" className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">Sheet Name</Label><Input value={selectedNode.data.sheetName || ''} onChange={e => updateNodeData('sheetName', e.target.value)} placeholder="Submissions" className="h-8 text-sm" /></div>
                        
                        <div className="pt-2 border-t mt-3">
                          <Label className="text-xs font-semibold">Column Mapping</Label>
                          <p className="text-[10px] text-muted-foreground mb-2 leading-tight">Map incoming fields to your sheet headers. If left empty, it uses the original field name.</p>
                          <div className="space-y-2">
                            {getIncomingFields().map((field: any) => {
                              const existingMap = (selectedNode.data.fieldMapping || []).find((m: any) => m.fieldId === field.id)
                              return (
                                <div key={field.id} className="flex items-center gap-2">
                                  <div className="w-1/2 text-[10px] truncate bg-muted p-1 rounded border border-border">
                                    {field.label} ({field.type})
                                  </div>
                                  <div className="w-1/2">
                                    <Input 
                                      className="h-6 text-[10px]" 
                                      placeholder="Header Name"
                                      value={existingMap ? existingMap.sheetHeader : ''}
                                      onChange={(e) => handleUpdateMapping(field.id, e.target.value)}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                            {getIncomingFields().length === 0 && (
                              <p className="text-[10px] text-destructive">No incoming form fields found. Connect a Form node.</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {selectedNode.type === 'archive' && (
                      <div><Label className="text-xs">Google Drive Folder ID</Label><Input value={selectedNode.data.folderPath || ''} onChange={e => updateNodeData('folderPath', e.target.value)} placeholder="Folder ID..." className="h-8 text-sm" /></div>
                    )}

                    {selectedNode.type === 'dataLookup' && (
                      <>
                        <div>
                          <Label className="text-xs">Source Field (from form)</Label>
                          <Input value={selectedNode.data.sourceField || ''} onChange={e => updateNodeData('sourceField', e.target.value)} placeholder="field-id or label" className="h-8 text-sm" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">The form field containing the employee/client number</p>
                        </div>
                        <div>
                          <Label className="text-xs">Lookup Type</Label>
                          <Select value={selectedNode.data.lookupType || ''} onValueChange={v => updateNodeData('lookupType', v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select directory" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Employees">Employees</SelectItem>
                              <SelectItem value="Clients">Clients</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Match Field</Label>
                          <Select value={selectedNode.data.matchField || 'EmployeeNumber'} onValueChange={v => updateNodeData('matchField', v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EmployeeNumber">Employee Number</SelectItem>
                              <SelectItem value="DisplayName">Display Name</SelectItem>
                              <SelectItem value="ClientId">Client ID</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Output Variable Name</Label>
                          <Input value={selectedNode.data.outputVariable || ''} onChange={e => updateNodeData('outputVariable', e.target.value)} placeholder="lookupResult" className="h-8 text-sm" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">Use {'{lookupEmail}'} in email node to reference found email</p>
                        </div>
                      </>
                    )}

                    {selectedNode.type === 'form' && (
                      <div className="pt-2">
                        <div>
                          <div className="flex items-center justify-between mt-1">
                            <Label className="text-xs">Assignees</Label>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refreshUsers} title="Refresh users">
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="border border-border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                            {usersList.length === 0 && (
                              <p className="text-xs text-muted-foreground py-1">No users loaded. Click refresh to try again.</p>
                            )}
                            {usersList.length > 0 && usersList.filter((u: any) => u.isActive).length === 0 && (
                              <p className="text-xs text-muted-foreground py-1">No active users. {usersList.length} user(s) found but all are inactive.</p>
                            )}
                            {usersList.filter((u: any) => u.isActive).map((u: any) => {
                              const currentAssignees: string[] = selectedNode.data.assignees || []
                              const isChecked = currentAssignees.includes(u.email)
                              return (
                                <label key={u.userId} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      const updated = isChecked
                                        ? currentAssignees.filter((a: string) => a !== u.email)
                                        : [...currentAssignees, u.email]
                                      updateNodeData('assignees', updated)
                                    }}
                                    className="rounded border-border"
                                  />
                                  <span className="text-xs">{u.displayName} ({u.email})</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                        <div className="pt-3 border-t mt-3 space-y-2">
                          <Label className="text-xs font-semibold">Sheet & Drive Config</Label>
                          <div><Label className="text-xs">Google Sheet ID</Label><Input value={selectedNode.data.spreadsheetId || ''} onChange={e => updateNodeData('spreadsheetId', e.target.value)} placeholder="1ABC...xxxx" className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Sheet Name</Label><Input value={selectedNode.data.sheetName || ''} onChange={e => updateNodeData('sheetName', e.target.value)} placeholder="Submissions" className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Drive Folder ID</Label><Input value={selectedNode.data.driveFolderId || ''} onChange={e => updateNodeData('driveFolderId', e.target.value)} placeholder="1ABC...xxxx" className="h-8 text-sm" /></div>
                        </div>
                        <Button 
                          onClick={() => setFormModalOpen(true)} 
                          variant="secondary" 
                          className="w-full mt-3 h-8 text-sm"
                        >
                          <Edit className="h-3 w-3 mr-2" /> Configure Form Fields
                        </Button>
                      </div>
                    )}

                    {selectedNode.id !== 'start' && selectedNode.id !== 'end' && (
                      <>
                        {['email', 'saveToSheet', 'approval', 'form', 'archive'].includes(selectedNode.type || '') && (
                          <>
                            <Button variant="secondary" size="sm" className="w-full mt-2" onClick={handleTestNode} disabled={testing}>
                              {testing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                              {testing ? 'Testing...' : 'Test Node'}
                            </Button>
                            {testResult && (
                              <div className={`text-xs p-2 rounded mt-1 ${testResult.success ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                                {testResult.success ? '✓ ' : '✗ '}{testResult.message}
                              </div>
                            )}
                          </>
                        )}
                        <Button variant="default" size="sm" className="w-full mt-2" onClick={() => setSelectedNode(null)}>
                          <Save className="h-3 w-3 mr-1" /> Apply Changes
                        </Button>
                        <Button variant="destructive" size="sm" className="w-full mt-2" onClick={deleteSelectedNode}>
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Dialog open={formModalOpen} onOpenChange={setFormModalOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 border-0">
            {selectedNode && selectedNode.type === 'form' && (
              <FormBuilder 
                fields={selectedNode.data.fields || []}
                onChange={fields => updateNodeData('fields', fields)}
                onApply={() => setFormModalOpen(false)}
                formLink={selectedFlow?.formLink}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!saveProgress} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="text-base">Save Progress</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {saveProgress?.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  {step.error ? (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  ) : step.done ? (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  ) : i === saveProgress.currentStep ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />
                  )}
                  <span className={`text-sm ${step.error ? 'text-destructive' : step.done ? 'text-foreground' : i === saveProgress.currentStep ? 'text-primary' : 'text-muted-foreground'}`}>
                    {step.label}
                    {step.error && ' - ' + step.error}
                  </span>
                </div>
              ))}
            </div>
            {saveProgress?.complete && (
              <Button onClick={handleCloseSaveProgress} className="w-full">
                Done
              </Button>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </ReactFlowProvider>
  )
}