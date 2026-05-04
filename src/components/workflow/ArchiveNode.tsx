import { Handle, Position, NodeProps } from 'reactflow'
import { motion } from 'framer-motion'
import { FolderArchive } from 'lucide-react'

export default function ArchiveNode({ data, selected }: NodeProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`bg-card border-2 rounded-xl p-4 min-w-[200px] shadow-lg cursor-grab active:cursor-grabbing ${
        selected ? 'border-yellow-500 shadow-yellow-500/25' : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-400 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
          <FolderArchive className="h-4 w-4 text-yellow-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{data.label || 'Archive Files'}</div>
          <div className="text-xs text-muted-foreground">{data.folderPath || 'Configure folder'}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400 !w-3 !h-3" />
    </motion.div>
  )
}
