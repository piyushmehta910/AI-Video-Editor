import * as React from 'react'
import { Lock, Unlock, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PassphraseGateProps {
  children: React.ReactNode
}

export function PassphraseGate({ children }: PassphraseGateProps) {
  const { hydrated, needsPassphrase, passphraseVerified, hydrate, verifyPassphrase, setPassphrase, error } = useApiConfigStore()
  const [passphrase, setPassphraseInput] = React.useState('')
  const [showPassphrase, setShowPassphrase] = React.useState(false)
  const [isSettingPassphrase, setIsSettingPassphrase] = React.useState(false)
  const [isVerifying, setIsVerifying] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!hydrated) {
      // Trigger initial hydrate - will set needsPassphrase if required
      hydrate().catch(() => {})
    }
  }, [hydrated, hydrate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (isSettingPassphrase) {
      if (passphrase.length < 8) {
        setLocalError('Passphrase must be at least 8 characters')
        return
      }
      setIsVerifying(true)
      try {
        await setPassphrase(passphrase)
        setPassphraseInput('')
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to set passphrase')
      } finally {
        setIsVerifying(false)
      }
    } else {
      setIsVerifying(true)
      try {
        const verified = await verifyPassphrase(passphrase)
        if (verified) {
          setPassphraseInput('')
        } else {
          setLocalError('Invalid passphrase')
        }
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Verification failed')
      } finally {
        setIsVerifying(false)
      }
    }
  }

  if (!hydrated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading configuration…</p>
        </div>
      </div>
    )
  }

  if (needsPassphrase && !passphraseVerified) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl animate-in fade-in zoom-95">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isSettingPassphrase ? <Unlock className="size-6" /> : <Lock className="size-6" />}
          </div>
          <div className="mt-4 text-center">
            <h1 className="text-xl font-semibold">
              {isSettingPassphrase ? 'Create Master Passphrase' : 'Enter Master Passphrase'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSettingPassphrase
                ? 'Set a passphrase to encrypt your API keys. This passphrase is never stored and cannot be recovered if lost.'
                : 'Your API keys are encrypted. Enter your passphrase to unlock.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {localError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {localError}
              </div>
            )}
            {error && !localError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="passphrase" className="text-sm font-medium">
                Passphrase
              </Label>
              <div className="relative">
                <Input
                  id="passphrase"
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  placeholder="Enter passphrase (min 8 characters)"
                  autoComplete="off"
                  autoFocus
                  disabled={isVerifying}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                >
                  {showPassphrase ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isVerifying || passphrase.length < 8}>
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {isSettingPassphrase ? 'Securing…' : 'Unlocking…'}
                </>
              ) : isSettingPassphrase ? (
                'Create & Unlock'
              ) : (
                'Unlock'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {isSettingPassphrase
              ? 'This passphrase encrypts your API keys locally. It is never sent to any server.'
              : 'Forgot your passphrase? You can reset it, but all saved API keys will be lost.'}
          </p>

          {!isSettingPassphrase && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsSettingPassphrase(true)}
            >
              I don't have a passphrase yet — create one
            </Button>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}