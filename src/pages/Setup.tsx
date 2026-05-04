import { useState } from 'react'
import { callGAS } from '../components/AuthGate'

interface SetupResult {
  success: boolean
  message?: string
  error?: string
  bootstrapResult?: {
    sheets: string[]
    admin: string
    errors: string[]
  }
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
        setTimeout(() => onComplete(), 3000)
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
          <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.814 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.814 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.814-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.814-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-textPrimary mb-2">System Setup</h1>
          <p className="text-textSecondary text-sm">
            Configure your Google Spreadsheet to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-6">
            <label className="block text-sm font-medium text-textPrimary mb-2">
              Google Spreadsheet ID <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="1ABC123XYZ..."
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-textPrimary placeholder-textSecondary focus:outline-none focus:border-accent font-mono text-sm"
              required
            />
            <p className="text-xs text-textSecondary mt-2">
              Found in your Sheet URL: docs.google.com/spreadsheets/d/<b>ID_HERE</b>/edit
            </p>
          </div>

          <div className="bg-surface/50 border border-border rounded-xl p-4">
            <p className="text-xs text-textSecondary">
              <b className="text-textPrimary">What happens next:</b><br />
              Creates 6 sheets (Users, Flows, Approvals, Entities, Skills, Audit_Log)<br />
              Creates default admin: <code className="text-accent">admin@g-flow.local / admin123</code>
            </p>
          </div>

          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-error/10 border-error/30 text-error'
            }`}>
              <p className="text-sm font-medium">{result.success ? 'Success!' : 'Error'}</p>
              <p className="text-sm mt-1">{result.message || result.error}</p>
              {result.bootstrapResult?.sheets && (
                <ul className="text-xs mt-2 space-y-1">
                  {result.bootstrapResult.sheets.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                  {result.bootstrapResult.admin && <li>{result.bootstrapResult.admin}</li>}
                </ul>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !spreadsheetId.trim()}
            className="w-full bg-accent hover:bg-accentHover text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Configuring...' : 'Configure System'}
          </button>
        </form>
      </div>
    </div>
  )
}