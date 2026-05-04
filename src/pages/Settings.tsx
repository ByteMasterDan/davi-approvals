import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Lock, User, Shield } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Settings() {
  const { user, logout } = useAuthStore()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)
    setPasswordMessage('')

    try {
      const result = await callGAS<{ success: boolean; message?: string; error?: string }>(
        'changePassword',
        { token: user?.token, oldPassword, newPassword }
      )
      if (result.success) {
        setPasswordMessage('Password changed successfully!')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordMessage(result.error || 'Failed to change password')
      }
    } catch (e) {
      setPasswordMessage(e instanceof Error ? e.message : 'Error changing password')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{user?.displayName}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <div className="mt-1">
                    <Badge variant={user?.role === 'Admin' ? 'destructive' : 'default'}>{user?.role}</Badge>
                  </div>
                </div>
                <div>
                  <Label>Skills</Label>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {user?.skills?.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>) || <span className="text-sm text-muted-foreground">None</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
              </div>
              <div>
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              {passwordMessage && (
                <p className={`text-sm ${passwordMessage.includes('success') ? 'text-green-500' : 'text-destructive'}`}>
                  {passwordMessage}
                </p>
              )}
              <Button onClick={handleChangePassword} disabled={passwordLoading}>
                <Lock className="h-4 w-4 mr-2" />
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>G-Flow Approval System</CardTitle>
              <CardDescription>Version 1.0.0</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Workflow approval platform built with React + Google Apps Script</p>
                <p>Features: Visual Workflow Builder, RBAC, Skills-based routing, DLP Entity Management</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}