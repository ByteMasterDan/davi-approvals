import { useState } from 'react'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

interface SetupResult {
  success: boolean
  message?: string
  error?: string
}

export default function Setup({ onComplete }: { onComplete: () => void }) {
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SetupResult | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const response = await callGAS<SetupResult>('setupSystem', { spreadsheetId: spreadsheetId.trim() })
      setResult(response)

      if (response.success) {
        setTimeout(() => onComplete(), 2000)
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Setup failed',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.814 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.814 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.814-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.814-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">System Setup</h1>
          <p className="text-muted-foreground text-sm">
            Configure your Google Spreadsheet to get started
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Google Spreadsheet ID <span className="text-destructive">*</span></Label>
                <Input
                  type="text"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="1ABC123XYZ..."
                  className="mt-1 font-mono"
                  required
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Found in your Sheet URL: docs.google.com/spreadsheets/d/<b>ID_HERE</b>/edit
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">
                  <b className="text-foreground">What happens next:</b><br />
                  Creates 3 sheets: USERS, CLIENTS, AUDIT_LOG<br />
                  This will be your database for the approval system.
                </p>
              </div>

              {result && (
                <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-500/10 border-green-500/30 text-green-600' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
                  <p className="text-sm font-medium">{result.success ? 'Success!' : 'Error'}</p>
                  <p className="text-sm mt-1">{result.message || result.error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading || !spreadsheetId.trim()} className="w-full">
                {loading ? 'Configuring...' : 'Configure System'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
