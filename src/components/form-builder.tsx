import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, GripVertical, Type, AlignLeft, Hash, Calendar, Mail, List, CheckSquare, Upload, Link, ClipboardList, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

export interface FormField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'select' | 'checkbox' | 'file'
  required: boolean
  options?: string[]
  placeholder?: string
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'textarea', label: 'Textarea', icon: AlignLeft },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'select', label: 'Select', icon: List },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'file', label: 'File Upload', icon: Upload },
]

interface FormBuilderProps {
  fields: FormField[]
  onChange: (fields: FormField[]) => void
  onApply?: () => void
  flowId?: string
  formLink?: string
}

export default function FormBuilder({ fields, onChange, onApply, flowId, formLink }: FormBuilderProps) {
  const addField = () => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
    }
    onChange([...fields, newField])
  }

  const updateField = (id: string, updates: Partial<FormField>) => {
    onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const removeField = (id: string) => {
    onChange(fields.filter(f => f.id !== id))
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newFields.length) return
    ;[newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]]
    onChange(newFields)
  }

  const getFieldIcon = (type: string) => {
    const ft = FIELD_TYPES.find(f => f.value === type)
    return ft ? <ft.icon className="h-4 w-4" /> : <Type className="h-4 w-4" />
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Form Builder
          </CardTitle>
          <div className="flex items-center gap-2">
            {onApply && (
              <Button size="sm" onClick={onApply}>
                <Check className="h-3 w-3 mr-1" /> Apply
              </Button>
            )}
            <Button size="sm" onClick={addField} variant="outline">
              <Plus className="h-3 w-3 mr-1" /> Add Field
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
            <p>No form fields defined yet</p>
            <p className="text-xs mt-1">Click "Add Field" to start building your form</p>
          </div>
        ) : (
          <AnimatePresence>
            {fields.map((field, index) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border border-border rounded-lg p-3 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {getFieldIcon(field.type)}
                    <span className="ml-1">{field.type}</span>
                  </Badge>
                  <div className="flex-1">
                    <Input
                      value={field.label}
                      onChange={e => updateField(field.id, { label: e.target.value })}
                      placeholder="Field label..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveField(index, 'up')}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveField(index, 'down')}
                      disabled={index === fields.length - 1}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeField(field.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-8">
                  <div className="flex-1">
                    <Select
                      value={field.type}
                      onValueChange={(v) => updateField(field.id, { type: v as FormField['type'] })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(ft => (
                          <SelectItem key={ft.value} value={ft.value}>
                            {ft.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`req-${field.id}`}
                      checked={field.required}
                      onCheckedChange={(c) => updateField(field.id, { required: !!c })}
                    />
                    <Label htmlFor={`req-${field.id}`} className="text-xs">Required</Label>
                  </div>
                </div>

                {field.type === 'select' && (
                  <div className="pl-8">
                    <Input
                      value={(field.options || []).join(', ')}
                      onChange={e => updateField(field.id, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                      placeholder="Options (comma separated): Option A, Option B"
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {fields.length > 0 && (
          <>
            <Separator />
            <div className="text-xs text-muted-foreground">
              {fields.length} field(s) defined ({fields.filter(f => f.required).length} required)
            </div>
          </>
        )}

        {formLink && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Link className="h-3 w-3" /> Form Link (auto-generated)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={formLink}
                  readOnly
                  className="h-8 text-xs font-mono bg-muted"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(formLink)}
                >
                  Copy
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}