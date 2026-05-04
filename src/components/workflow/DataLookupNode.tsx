import { Handle, Position, NodeProps } from 'reactflow'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Search } from 'lucide-react'

export default function DataLookupNode({ data, selected }: NodeProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`bg-card border-2 rounded-xl p-4 min-w-[220px] shadow-lg cursor-grab active:cursor-grabbing ${
        selected ? 'border-indigo-500 shadow-indigo-500/25' : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
          <Search className="h-4 w-4 text-indigo-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{data.label || 'Data Lookup'}</div>
        </div>
      </div>
      <div className="space-y-1 ml-10">
        {data.sourceField && <div className="text-xs text-muted-foreground">From: {data.sourceField}</div>}
        {data.lookupType && <Badge variant="outline" className="text-[10px]">{data.lookupType}</Badge>}
        {data.outputVariable && <div className="text-xs text-muted-foreground">Output: {data.outputVariable}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" />
    </motion.div>
  )
}
