import { useState, useCallback, useRef, DragEvent } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Save, Play, Trash2, GripVertical, X, Plus } from 'lucide-react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'

// Custom Node: Start
function StartNode() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-green-600 text-white rounded-full w-20 h-20 flex items-center justify-center text-sm font-bold shadow-lg shadow-green-600/25 cursor-grab active:cursor-grabbing"
    >
      <div className="text-center">
        <div className="text-lg">▶</div>
        <div className="text-xs">START</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-400 !w-3 !h-3" />
    </motion.div>
  )
}

// Custom Node: End
function EndNode() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-red-600 text-white rounded-full w-20 h-20 flex items-center justify-center text-sm font-bold shadow-lg shadow-red-600/25 cursor-grab active:cursor-grabbing"
    >
      <Handle type="target" position={Position.Top} className="!bg-red-400 !w-3 !h-3" />
      <div className="text-center">
        <div className="text-lg">⬛</div>
        <div className="text-xs">END</div>
      </div>
    </motion.div>
  )
}

// Custom Node: Approval Step
function ApproveStepNode({ data, selected }: NodeProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`bg-card border-2 rounded-xl p-4 min-w-[220px] shadow-lg cursor-grab active:cursor-grabbing ${
        selected ? 'border-primary shadow-primary/25' : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
          <span className="text-primary text-sm">✓</span>
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{data.label || 'Approval Step'}</div>
          <div className="text-xs text-muted-foreground">{data.assignee || 'Unassigned'}</div>
        </div>
      </div>
      {data.skills && data.skills.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {data.skills.map((skill: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </motion.div>
  )
}

// Custom Node: Email
function EmailNode({ data, selected }: NodeProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`bg-card border-2 rounded-xl p-4 min-w-[220px] shadow-lg cursor-grab active:cursor-grabbing ${
        selected ? 'border-blue-500 shadow-blue-500/25' : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
          <span className="text-blue-500 text-sm">✉</span>
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{data.label || 'Send Email'}</div>
          <div className="text-xs text-muted-foreground">{data.recipient || 'No recipient'}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3" />
    </motion.div>
  )
}

// Custom Node: Archive
function ArchiveNode({ data, selected }: NodeProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`bg-card border-2 rounded-xl p-4 min-w-[220px] shadow-lg cursor-grab active:cursor-grabbing ${
        selected ? 'border-yellow-500 shadow-yellow-500/25' : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-400 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
          <span className="text-yellow-500 text-sm">📁</span>
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{data.label || 'Archive'}</div>
          <div className="text-xs text-muted-foreground">Save to Drive</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400 !w-3 !h-3" />
    </motion.div>
  )
}

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  approveStep: ApproveStepNode,
  email: EmailNode,
  archive: ArchiveNode,
}

// Catalog items for drag
const catalogItems = [
  { type: 'start', label: 'Start', icon: '▶', color: 'bg-green-600', description: 'Flow starting point' },
  { type: 'approveStep', label: 'Approval', icon: '✓', color: 'bg-primary', description: 'Approval step' },
  { type: 'email', label: 'Email', icon: '✉', color: 'bg-blue-600', description: 'Send email action' },
  { type: 'archive', label: 'Archive', icon: '📁', color: 'bg-yellow-600', description: 'Archive to Drive' },
  { type: 'end', label: 'End', icon: '⬛', color: 'bg-red-600', description: 'Flow endpoint' },
]

export default function FlowBuilder() {
  const { user } = useAuthStore()
  const [flowName, setFlowName] = useState('')
  const [flowDescription, setFlowDescription] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [saving, setSaving] = useState(false)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
          },
          eds
        )
      )
    },
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // Drag from catalog to canvas
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      if (!type || !rfInstance || !reactFlowWrapper.current) return

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: type === 'start' ? 'Start' : type === 'end' ? 'End' : type === 'approveStep' ? 'Approval Step' : type === 'email' ? 'Send Email' : 'Archive',
          assignee: '',
          skills: [],
          recipient: '',
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [rfInstance, setNodes]
  )

  const deleteSelectedNode = () => {
    if (!selectedNode) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
  }

  const updateNodeData = (key: string, value: unknown) => {
    if (!selectedNode) return
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          return { ...n, data: { ...n.data, [key]: value } }
        }
        return n
      })
    )
    setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, [key]: value } } : null)
  }

  const handleSave = async () => {
    if (!flowName.trim()) return alert('Flow name is required')
    setSaving(true)

    try {
      const steps = nodes.map(n => ({
        id: n.id,
        type: n.type,
        name: n.data.label,
        assigneeType: n.type === 'approveStep' ? 'user' : undefined,
        assigneeValue: n.data.assignee || n.data.recipient,
        skills: n.data.skills,
        position: n.position,
      }))

      await callGAS('createFlow', {
        token: user?.token,
        flowData: { name: flowName, description: flowDescription, steps },
      })

      alert('Flow saved successfully!')
    } catch (e) {
      console.error('Save flow error:', e)
      alert('Failed to save flow')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ReactFlowProvider>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[calc(100vh-7rem)] flex gap-4">
        {/* Left: Catalog */}
        <div className="w-64 shrink-0 space-y-4 overflow-y-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Flow Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="Flow name" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input value={flowDescription} onChange={e => setFlowDescription(e.target.value)} placeholder="Description" className="h-8 text-sm" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full h-8 text-sm">
                <Save className="h-3 w-3 mr-2" />
                {saving ? 'Saving...' : 'Save Flow'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Node Catalog</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Drag nodes to the canvas</p>
              {catalogItems.map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', item.type)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50 cursor-grab active:cursor-grabbing hover:bg-muted hover:border-primary/50 transition-all group"
                >
                  <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center text-white text-lg shrink-0 group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                  <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 rounded-xl border border-border overflow-hidden bg-background" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} className="!bg-background" />
            <Controls className="!bg-card !border-border" />
            <MiniMap
              nodeColor="hsl(var(--muted))"
              className="!bg-card !border-border"
              maskColor="hsl(var(--background) / 0.8)"
            />
          </ReactFlow>
        </div>

        {/* Right: Node Config */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-72 shrink-0"
            >
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Node Configuration</CardTitle>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedNode(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">Node Type</Label>
                    <Badge variant="outline" className="mt-1">{selectedNode.type}</Badge>
                  </div>

                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={selectedNode.data.label || ''}
                      onChange={e => updateNodeData('label', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  {selectedNode.type === 'approveStep' && (
                    <>
                      <div>
                        <Label className="text-xs">Assignee Email</Label>
                        <Input
                          value={selectedNode.data.assignee || ''}
                          onChange={e => updateNodeData('assignee', e.target.value)}
                          placeholder="approver@company.com"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Required Skills</Label>
                        <Input
                          value={(selectedNode.data.skills || []).join(', ')}
                          onChange={e => updateNodeData('skills', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                          placeholder="Finance, Legal"
                          className="h-8 text-sm"
                        />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'email' && (
                    <div>
                      <Label className="text-xs">Recipient</Label>
                      <Input
                        value={selectedNode.data.recipient || ''}
                        onChange={e => updateNodeData('recipient', e.target.value)}
                        placeholder="recipient@company.com"
                        className="h-8 text-sm"
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="text-xs text-muted-foreground">
                    <p>Node ID: {selectedNode.id}</p>
                    <p>Position: ({Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)})</p>
                  </div>

                  {selectedNode.id !== 'start' && selectedNode.id !== 'end' && (
                    <Button variant="destructive" size="sm" className="w-full" onClick={deleteSelectedNode}>
                      <Trash2 className="h-3 w-3 mr-2" /> Delete Node
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </ReactFlowProvider>
  )
}