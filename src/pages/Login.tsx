import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { gsap } from 'gsap'

interface LoginResult {
  success: boolean
  token?: string
  user?: {
    email: string
    role: string
    displayName: string
    skills: string[]
  }
  error?: string
}

export default function Login({ onSuccess }: { onSuccess: (token: string, user: { email: string; role: string; displayName: string; skills: string[] }) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(logoRef.current,
        { scale: 0, rotation: -180, opacity: 0 },
        { scale: 1, rotation: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' }
      )
      gsap.fromTo(formRef.current,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, delay: 0.3, ease: 'power2.out' }
      )
    })
    return () => ctx.revert()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await callGAS<LoginResult>('login', {
        email: email.trim(),
        password: password,
      })

      if (response.success && response.token && response.user) {
        if (containerRef.current) {
          gsap.to(containerRef.current, {
            y: -20,
            opacity: 0,
            duration: 0.3,
            onComplete: () => onSuccess(response.token!, response.user!),
          })
        } else {
          onSuccess(response.token, response.user)
        }
      } else {
        setError(response.error || 'Login failed')
        if (formRef.current) {
          gsap.to(formRef.current, { x: [-10, 10, -10, 10, 0], duration: 0.4, ease: 'power2.out' })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" ref={containerRef}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8" ref={logoRef}>
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
            <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Davi Approvals</h1>
          <p className="text-muted-foreground text-sm mt-1">Document Approval System</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4" ref={formRef}>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="mt-1"
                />
              </div>
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
