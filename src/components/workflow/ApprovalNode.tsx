import { Handle, Position, NodeProps } from 'reactflow'
import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'

export default function ApprovalNode({ data, selected }: NodeProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`bg-card border-2 rounded-xl p-4 min-w-[200px] shadow-lg cursor-grab active:cursor-grabbing ${
        selected ? 'border-primary shadow-primary/25' : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
          <CheckCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{data.label || 'Approval'}</div>
          <div className="text-xs text-muted-foreground">{data.assignee || 'Unassigned'}</div>
        </div>
      </div>
      {data.skills?.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2 ml-10">
          {data.skills.map((s: string, i: number) => <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{s}</span>)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </motion.div>
  )
}
