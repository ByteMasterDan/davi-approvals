import { Handle, Position, NodeProps } from 'reactflow'
import { motion } from 'framer-motion'
import { Database } from 'lucide-react'

export default function SaveToSheetNode({ data, selected }: NodeProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`bg-card border-2 rounded-xl p-4 min-w-[200px] shadow-lg cursor-grab active:cursor-grabbing ${
        selected ? 'border-cyan-500 shadow-cyan-500/25' : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-cyan-400 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
          <Database className="h-4 w-4 text-cyan-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{data.label || 'Save to Sheet'}</div>
          <div className="text-xs text-muted-foreground">{data.sheetName || 'Configure sheet'}</div>
        </div>
      </div>
      {data.fieldMapping && data.fieldMapping.length > 0 && (
        <div className="mt-2 text-[10px] text-muted-foreground text-center">
          <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-700 rounded-full font-medium">
            {data.fieldMapping.length} fields mapped
          </span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-400 !w-3 !h-3" />
    </motion.div>
  )
}
