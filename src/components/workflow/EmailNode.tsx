import { Handle, Position, NodeProps } from 'reactflow'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Mail } from 'lucide-react'

export default function EmailNode({ data, selected }: NodeProps) {
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
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
          <Mail className="h-4 w-4 text-blue-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{data.label || 'Send Email'}</div>
        </div>
      </div>
      <div className="space-y-1 ml-10">
        {data.to?.length > 0 && <div className="text-xs text-muted-foreground">To: {data.to.length} recipient(s)</div>}
        {data.cc?.length > 0 && <div className="text-xs text-muted-foreground">CC: {data.cc.length}</div>}
        {data.bcc?.length > 0 && <div className="text-xs text-muted-foreground">BCC: {data.bcc.length}</div>}
        {data.from && <Badge variant="outline" className="text-[10px]">{data.from}</Badge>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3" />
    </motion.div>
  )
}
