import { useState, useEffect } from 'react'
import { callGAS } from '../components/AuthGate'
import { useAuthStore } from '../stores/authStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, ExternalLink, FileText } from 'lucide-react'
import { motion } from 'framer-motion'

interface DocumentFile {
  name: string
  driveUrl: string
  driveId: string
  mimeType: string
}

interface ExecutionDocument {
  approvalId: string
  flowId: string
  status: string
  submittedBy: string
  entityTag: string
  files: DocumentFile[]
  submittedAt: string
}

export default function Documents() {
  const { user } = useAuthStore()
  const [documents, setDocuments] = useState<ExecutionDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEntity, setFilterEntity] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const result = await callGAS<{ success: boolean; documents: ExecutionDocument[] }>('getDocuments', { 
        token: user?.token,
        filterEntity: filterEntity || undefined
      })
      if (result && result.success) {
        setDocuments(result.documents || [])
      }
    } catch (e) {
      console.error('Error loading documents:', e)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'default'
      case 'Rejected': return 'destructive'
      case 'Pending': return 'secondary'
      default: return 'outline'
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Document Directory</h2>
          <p className="text-sm text-muted-foreground">Browse files submitted in execution flows</p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter by entity name..."
              className="pl-8"
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadDocuments()}
            />
          </div>
          <Button variant="secondary" onClick={loadDocuments}>Search</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium text-lg">No documents found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {filterEntity ? `No documents match "${filterEntity}"` : "Documents uploaded during flow executions will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc, i) => (
            <Card key={`${doc.approvalId}-${i}`} className="overflow-hidden hover:border-primary/50 transition-colors">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <CardTitle className="text-base truncate" title={doc.entityTag}>
                      {doc.entityTag || 'Unknown Entity'}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {doc.flowId}
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusColor(doc.status)}>{doc.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[120px]" title={doc.submittedBy}>By: {doc.submittedBy}</span>
                  <span>{new Date(doc.submittedAt).toLocaleDateString()}</span>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Files ({doc.files.length})</p>
                  <div className="space-y-2">
                    {doc.files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border group">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm truncate" title={file.name}>{file.name}</span>
                        </div>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                            <a href={file.driveUrl} target="_blank" rel="noreferrer" title="Open in Drive">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  )
}
