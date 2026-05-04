import { Handle, Position, NodeProps } from 'reactflow'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, User } from 'lucide-react'

export default function FormNode({ data, selected }: NodeProps) {
  const assignees: string[] = data.assignees || []

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`bg-card border-2 rounded-xl p-4 min-w-[200px] shadow-lg cursor-grab active:cursor-grabbing ${
        selected ? 'border-violet-500 shadow-violet-500/25' : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-400 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center">
          <ClipboardList className="h-4 w-4 text-violet-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{data.label || 'Form'}</div>
          <div className="text-xs text-muted-foreground">{data.fields?.length || 0} fields</div>
        </div>
      </div>
      {assignees.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {assignees.slice(0, 3).map((email: string, i: number) => (
            <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 bg-violet-500/10 text-violet-600 rounded-full flex items-center gap-0.5">
              <User className="h-2.5 w-2.5" /> {email.split('@')[0]}
            </span>
          ))}
          {assignees.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{assignees.length - 3}</span>
          )}
        </div>
      )}
      {data.fields && data.fields.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.fields.slice(0, 3).map((f: any, i: number) => (
            <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] py-0 px-1">{f.type}</Badge>
              {f.label || 'Untitled'}
            </div>
          ))}
          {data.fields.length > 3 && <div className="text-xs text-muted-foreground">+{data.fields.length - 3} more</div>}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-violet-400 !w-3 !h-3" />
    </motion.div>
  )
}
