import { useState, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface UploadFile {
  file: File
  name: string
  base64: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export default function UploadPage() {
  const { user } = useAuthStore()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const newFiles: UploadFile[] = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`${file.name} is not a PDF file`)
        continue
      }
      const base64 = await readFileAsBase64(file)
      newFiles.push({ file, name: file.name, base64, status: 'pending' })
    }
    setFiles(prev => [...prev, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)

    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' })))

    try {
      const filesData = files.map(f => ({ name: f.name, base64: f.base64, mimeType: 'application/pdf' }))
      const result = await callGAS<{ success: boolean; results?: any[]; error?: string }>('uploadDocuments', {
        token: user?.token,
        files: filesData,
      })

      if (result && result.success) {
        const successCount = result.results?.filter(r => r.success).length || 0
        const failCount = result.results?.filter(r => !r.success).length || 0

        setFiles(prev => prev.map((f, i) => ({
          ...f,
          status: result.results?.[i]?.success ? 'done' : 'error',
          error: result.results?.[i]?.success ? undefined : result.results?.[i]?.error,
        })))

        if (successCount > 0) toast.success(`${successCount} document(s) uploaded successfully`)
        if (failCount > 0) toast.error(`${failCount} document(s) failed`)
      } else {
        setFiles(prev => prev.map(f => ({ ...f, status: 'error', error: result?.error || 'Upload failed' })))
        toast.error(result?.error || 'Upload failed')
      }
    } catch (e: any) {
      setFiles(prev => prev.map(f => ({ ...f, status: 'error', error: e.message })))
      toast.error('Upload failed: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const clearAll = () => {
    setFiles([])
  }

  const pendingFiles = files.filter(f => f.status === 'pending')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">Click or drag PDF files here</p>
            <p className="text-xs text-muted-foreground">File name should match client name (e.g., JUAN PEREZ.pdf)</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {files.map((file, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    {file.status === 'pending' && <FileText className="h-5 w-5 text-muted-foreground shrink-0" />}
                    {file.status === 'uploading' && <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />}
                    {file.status === 'done' && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
                    {file.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive shrink-0" />}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Client: {file.name.replace(/\.pdf$/i, '').toUpperCase()}
                        {file.error && <span className="text-destructive ml-2">{file.error}</span>}
                      </p>
                    </div>

                    {file.status === 'pending' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </motion.div>
                ))}

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleUpload} disabled={uploading || pendingFiles.length === 0} className="flex-1">
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? 'Uploading...' : `Upload ${pendingFiles.length} file(s)`}
                  </Button>
                  <Button variant="outline" onClick={clearAll} disabled={uploading}>
                    Clear
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}
