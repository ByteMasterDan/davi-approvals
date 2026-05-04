import { useCallback, useMemo, useState } from 'react'
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
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Badge } from '@/components/ui/badge'

// Custom Node: Start
function StartNode() {
  return (
    <div className="bg-green-600 text-white rounded-full w-16 h-16 flex items-center justify-center text-sm font-medium shadow-lg">
      START
      <Handle type="source" position={Position.Bottom} className="!bg-green-400" />
    </div>
  )
}

// Custom Node: End
function EndNode() {
  return (
    <div className="bg-red-600 text-white rounded-full w-16 h-16 flex items-center justify-center text-sm font-medium shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-red-400" />
      END
    </div>
  )
}

// Custom Node: Approval Step
function ApproveStepNode({ data }: { data: { label: string; assignee: string; skills: string[] } }) {
  return (
    <div className="bg-surface border-2 border-accent rounded-lg p-4 min-w-[200px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-accent" />
      <div className="text-sm font-medium text-textPrimary mb-1">{data.label}</div>
      <div className="text-xs text-textSecondary">Assignee: {data.assignee}</div>
      {data.skills && data.skills.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {data.skills.map((skill, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-accent" />
    </div>
  )
}

// Custom Node: Email
function EmailNode({ data }: { data: { label: string; recipient: string } }) {
  return (
    <div className="bg-blue-900/50 border-2 border-blue-500 rounded-lg p-4 min-w-[200px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-blue-400" />
      <div className="text-sm font-medium text-textPrimary mb-1">{data.label}</div>
      <div className="text-xs text-textSecondary">To: {data.recipient}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
    </div>
  )
}

// Custom Node: Archive
function ArchiveNode({ data }: { data: { label: string } }) {
  return (
    <div className="bg-surface border-2 border-yellow-500 rounded-lg p-4 min-w-[200px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-yellow-400" />
      <div className="text-sm font-medium text-textPrimary">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400" />
    </div>
  )
}

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  approveStep: ApproveStepNode,
  email: EmailNode,
  archive: ArchiveNode,
}

interface FlowCanvasProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onNodesChange?: (nodes: Node[]) => void
  onEdgesChange?: (edges: Edge[]) => void
  readonly?: boolean
}

export default function FlowCanvas({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  readonly = false,
}: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
          },
          eds
        )
      )
    },
    [setEdges]
  )

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  return (
    <div className="w-full h-[600px] border border-border rounded-lg overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeInternal}
        onEdgesChange={onEdgesChangeInternal}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        proOptions={proOptions}
        fitView
        nodesDraggable={!readonly}
        nodesConnectable={!readonly}
        elementsSelectable={!readonly}
      >
        <Background gap={12} size={1} className="!bg-background" />
        <Controls className="!bg-surface !border-border" />
        <MiniMap
          nodeColor="hsl(var(--muted))"
          className="!bg-surface !border-border"
        />
      </ReactFlow>
    </div>
  )
}