import * as React from 'react'
import { LockKeyhole, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { ITERATIONS } from '@/api/config/encryption'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FieldRow } from '../FieldRow'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function SecurityCard() {
  const { config, update, save, locked, setMasterPassword, unlock, lock, changeMasterPassword } =
    useApiConfigStore()
  const security = config.security

  const [unlockPassword, setUnlockPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [message, setMessage] = React.useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = React.useState(false)

  const handleSetPassword = async () => {
    setMessage(null)
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setBusy(true)
    try {
      setMasterPassword(newPassword)
      await save()
      setMessage({ type: 'ok', text: 'Master password set and keys encrypted.' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const handleChangePassword = async () => {
    setMessage(null)
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password must be 8+ characters and match confirmation.' })
      return
    }
    setBusy(true)
    try {
      await changeMasterPassword(currentPassword, newPassword)
      setMessage({ type: 'ok', text: 'Master password changed and config re-encrypted.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    setMessage(null)
    setBusy(true)
    try {
      const ok = await unlock(unlockPassword)
      if (ok) {
        setMessage({ type: 'ok', text: 'Vault unlocked.' })
        setUnlockPassword('')
      } else {
        setMessage({ type: 'error', text: 'Incorrect master password.' })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleLock = () => {
    lock()
    setMessage({ type: 'ok', text: 'Vault locked.' })
  }

  const toggleEncrypt = (encryptKeys: boolean) => {
    update((draft) => ({
      ...draft,
      security: { ...draft.security, encryptKeys },
    }))
    if (!encryptKeys && security.hasMasterPassword) {
      setMessage({ type: 'error', text: 'Disabling encryption stores keys in plaintext. Save to apply.' })
    }
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <LockKeyhole className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Security</h3>
            <Badge variant={locked ? 'warning' : 'success'} className="gap-1.5">
              <ShieldCheck className="size-3" />
              {locked ? 'Locked' : security.hasMasterPassword ? 'Protected' : 'Unencrypted'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            AES-256-GCM + PBKDF2 ({ITERATIONS.toLocaleString()} iterations)
          </p>
        </div>
      </div>

      <Separator />

      <CardContent className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Encrypt API keys with master password</p>
            <p className="text-muted-foreground text-xs">Keys are never stored in plaintext when enabled</p>
          </div>
          <Switch checked={security.encryptKeys} onCheckedChange={toggleEncrypt} aria-label="Encrypt API keys" />
        </div>

        {locked ? (
          <div className="flex flex-col gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <TriangleAlert className="size-4 text-amber-500" />
              Vault is locked
            </p>
            <p className="text-muted-foreground text-xs">
              Your API configuration is encrypted. Enter your master password to unlock it.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                placeholder="Master password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="max-w-xs"
              />
              <Button type="button" disabled={busy || !unlockPassword} onClick={handleUnlock}>
                Unlock
              </Button>
            </div>
          </div>
        ) : security.hasMasterPassword ? (
          <div className="flex flex-col gap-3">
            <FieldRow label="Current password">
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </FieldRow>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldRow label="New password">
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </FieldRow>
              <FieldRow label="Confirm new password">
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </FieldRow>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={handleChangePassword}>
                Save & Re-encrypt
              </Button>
              <Button type="button" variant="outline" onClick={handleLock}>
                Lock vault
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldRow label="Master password" hint="Minimum 8 characters">
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </FieldRow>
              <FieldRow label="Confirm password">
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </FieldRow>
            </div>
            <Button type="button" disabled={busy} onClick={handleSetPassword}>
              Save & Encrypt
            </Button>
          </div>
        )}

        {message && (
          <p
            className={cn(
              'rounded-md px-3 py-2 text-xs',
              message.type === 'ok'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive',
            )}
          >
            {message.text}
          </p>
        )}

        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
          If you forget this password, all API keys become unrecoverable. You will need to re-enter them manually.
        </p>
      </CardContent>
    </Card>
  )
}