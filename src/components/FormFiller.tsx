import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Send, X, Upload, FileText, Trash2 } from 'lucide-react'
import type { FormField } from './form-builder'

interface FormFillerProps {
  fields: FormField[]
  initialData?: Record<string, any>
  onSubmit: (data: Record<string, any>) => void
  onCancel: () => void
  disabled?: boolean
}

interface FileItem {
  name: string
  mimeType: string
  base64: string
}

export default function FormFiller({ fields, initialData = {}, onSubmit, onCancel, disabled = false }: FormFillerProps) {
  const [values, setValues] = useState<Record<string, any>>(initialData)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updateValue = (fieldId: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    for (const field of fields) {
      if (field.required) {
        const val = values[field.id]
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          newErrors[field.id] = 'This field is required'
        }
      }
      if (field.type === 'email' && values[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(values[field.id])) {
          newErrors[field.id] = 'Invalid email format'
        }
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSubmit(values)
  }

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No form fields defined.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {fields.map(field => (
        <div key={field.id} className="space-y-1.5">
          <Label className="text-sm">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>

          {field.type === 'text' && (
            <Input
              value={values[field.id] || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              disabled={disabled}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'textarea' && (
            <Textarea
              value={values[field.id] || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              disabled={disabled}
              rows={3}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'number' && (
            <Input
              type="number"
              value={values[field.id] ?? ''}
              onChange={e => updateValue(field.id, e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={field.placeholder || ''}
              disabled={disabled}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'date' && (
            <Input
              type="date"
              value={values[field.id] || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              disabled={disabled}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'email' && (
            <Input
              type="email"
              value={values[field.id] || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || 'email@example.com'}
              disabled={disabled}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'select' && (
            <Select
              value={values[field.id] || ''}
              onValueChange={v => updateValue(field.id, v)}
              disabled={disabled}
            >
              <SelectTrigger className={errors[field.id] ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === 'checkbox' && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={!!values[field.id]}
                onCheckedChange={v => updateValue(field.id, v)}
                disabled={disabled}
              />
              <span className="text-sm text-muted-foreground">{field.placeholder || 'Check this option'}</span>
            </div>
          )}

          {field.type === 'file' && (
            <div className="space-y-2">
              {!disabled && (
                <div className="flex items-center gap-2">
                  <label className="flex-1 relative">
                    <div className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors ${errors[field.id] ? 'border-destructive' : 'border-border'}`}>
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Select files (multiple allowed)</span>
                    </div>
                    <input
                      id={`file-input-${field.id}`}
                      type="file"
                      multiple
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={e => {
                        const fileList = e.target.files
                        if (!fileList || fileList.length === 0) return
                        const existingFiles: FileItem[] = Array.isArray(values[field.id]) ? values[field.id] : []
                        const newFiles: FileItem[] = [...existingFiles]
                        let processed = 0
                        for (let i = 0; i < fileList.length; i++) {
                          const file = fileList[i]
                          const reader = new FileReader()
                          reader.onloadend = () => {
                            newFiles.push({
                              name: file.name,
                              mimeType: file.type,
                              base64: (reader.result as string).split(',')[1],
                            })
                            processed++
                            if (processed === fileList.length) {
                              updateValue(field.id, newFiles)
                              e.target.value = ''
                            }
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                  </label>
                </div>
              )}
              {Array.isArray(values[field.id]) && values[field.id].length > 0 && (
                <div className="space-y-1">
                  {values[field.id].map((file: FileItem, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      {!disabled && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => {
                            const updated = values[field.id].filter((_: FileItem, i: number) => i !== idx)
                            updateValue(field.id, updated.length > 0 ? updated : undefined)
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {errors[field.id] && (
            <p className="text-xs text-destructive">{errors[field.id]}</p>
          )}
        </div>
      ))}

      {!disabled && (
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSubmit} className="flex-1">
            <Send className="h-4 w-4 mr-2" /> Submit
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
