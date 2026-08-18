import { ArrowDown, ArrowUp, ImageIcon } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import {
  defaultStockImagesConfig,
  type StockImagesConfig,
  type StockProviderConfig,
  type UnsplashProviderConfig,
} from '@/api/config/types'
import { testUnsplash, testPexels, testPixabay } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

type ProviderKey = 'unsplash' | 'pexels' | 'pixabay'

const PROVIDER_META: Record<ProviderKey, { name: string; placeholder: string }> = {
  unsplash: { name: 'Unsplash', placeholder: 'Unsplash API key' },
  pexels: { name: 'Pexels', placeholder: 'Pexels API key' },
  pixabay: { name: 'Pixabay', placeholder: 'Pixabay API key' },
}

export function StockImagesCard() {
  const { config, update, save } = useApiConfigStore()
  const stock: StockImagesConfig = config.stockImages

  const setProvider = (key: ProviderKey, patch: Partial<StockProviderConfig> | Partial<UnsplashProviderConfig>) => {
    update((draft) => ({
      ...draft,
      stockImages: {
        ...draft.stockImages,
        [key]: { ...draft.stockImages[key], ...patch },
      },
    }))
  }

  const setOrder = (newOrder: Array<ProviderKey>) => {
    update((draft) => ({ ...draft, stockImages: { ...draft.stockImages, order: newOrder } }))
  }

  const move = (index: number, dir: -1 | 1) => {
    const order = [...stock.order]
    const target = index + dir
    if (target < 0 || target >= order.length) return
    const [item] = order.splice(index, 1)
    order.splice(target, 0, item)
    setOrder(order)
  }

  const testerFor = (key: ProviderKey, timeout: number) => {
    switch (key) {
      case 'unsplash': {
        const u = stock.unsplash
        return testUnsplash(u.accessKey || u.apiKey, timeout)
      }
      case 'pexels':
        return testPexels(stock.pexels.apiKey, timeout)
      case 'pixabay':
        return testPixabay(stock.pixabay.apiKey, timeout)
    }
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <ImageIcon className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Stock Images</h3>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Unsplash, Pexels & Pixabay aggregated by priority
          </p>
        </div>
      </div>

      <Separator />

      <CardContent className="grid grid-cols-1 gap-5 px-4 py-4 md:grid-cols-3">
        {(Object.keys(PROVIDER_META) as ProviderKey[]).map((key, index) => {
          const meta = PROVIDER_META[key]
          const p = stock[key]
          return (
            <Card key={key} className="gap-4 py-4">
              <div className="flex items-center justify-between px-4">
                <h4 className="text-sm font-semibold">{meta.name}</h4>
                <Switch
                  checked={p.enabled}
                  onCheckedChange={(enabled) => setProvider(key, { enabled, status: enabled ? p.status ?? 'disconnected' : 'disabled' })}
                  aria-label={`Toggle ${meta.name}`}
                />
              </div>
              <CardContent className="flex flex-col gap-3 px-4">
                {key === 'unsplash' ? (
                  <>
                    <FieldRow label="Application ID" htmlFor="stock-unsplash-app-id">
                      <ApiKeyInput
                        id="stock-unsplash-app-id"
                        value={stock.unsplash.applicationId}
                        placeholder="Unsplash Application ID"
                        onChange={(e) => setProvider(key, { applicationId: e.target.value })}
                      />
                    </FieldRow>
                    <FieldRow label="Access Key" htmlFor="stock-unsplash-access-key">
                      <ApiKeyInput
                        id="stock-unsplash-access-key"
                        value={stock.unsplash.accessKey}
                        placeholder="Unsplash Access Key"
                        onChange={(e) => setProvider(key, { accessKey: e.target.value })}
                      />
                    </FieldRow>
                    <FieldRow label="Secret Key" htmlFor="stock-unsplash-secret-key">
                      <ApiKeyInput
                        id="stock-unsplash-secret-key"
                        value={stock.unsplash.secretKey}
                        placeholder="Unsplash Secret Key (OAuth only)"
                        onChange={(e) => setProvider(key, { secretKey: e.target.value })}
                      />
                    </FieldRow>
                  </>
                ) : (
                  <FieldRow label="API Key" htmlFor={`stock-${key}-key`}>
                    <ApiKeyInput
                      id={`stock-${key}-key`}
                      value={p.apiKey}
                      placeholder={meta.placeholder}
                      onChange={(e) => setProvider(key, { apiKey: e.target.value })}
                    />
                  </FieldRow>
                )}

                <FieldRow label="Priority">
                  <Select
                    value={String(p.priority)}
                    onValueChange={(v) => setProvider(key, { priority: Number(v) as 1 | 2 | 3 })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 — Primary</SelectItem>
                      <SelectItem value="2">2 — Secondary</SelectItem>
                      <SelectItem value="3">3 — Fallback</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>

                {key === 'unsplash' && (
                  <FieldRow label="Min Resolution" htmlFor="stock-unsplash-min">
                    <Select
                      value={p.minResolution ?? '1920x1080'}
                      onValueChange={(v) => setProvider(key, { minResolution: v })}
                    >
                      <SelectTrigger id="stock-unsplash-min" className="w-full">
                        <SelectValue placeholder="Min resolution" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1920x1080">1920x1080</SelectItem>
                        <SelectItem value="3840x2160">3840x2160</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`stock-${key}-safe`}
                    checked={p.safeSearch}
                    onCheckedChange={(checked) => setProvider(key, { safeSearch: checked === true })}
                  />
                  <Label htmlFor={`stock-${key}-safe`} className="text-xs font-normal">
                    Safe search
                  </Label>
                </div>

                <ApiTester
                  label="Test"
                  run={() =>
                    testerFor(key, 15000).then((result) => {
                      if (result.ok) {
                        setProvider(key, { status: 'connected' })
                      } else if (result.status === 'disconnected') {
                        setProvider(key, { status: 'disconnected' })
                      }
                      return result
                    })
                  }
                />

                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-muted-foreground text-xs">
                    Order #{index + 1}
                  </span>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="icon" className="size-7" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="size-7" disabled={index === stock.order.length - 1} onClick={() => move(index, 1)} aria-label="Move down">
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </CardContent>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-muted-foreground text-xs">
          Search order: {stock.order.map((k) => PROVIDER_META[k].name).join(' → ')}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => update((d) => ({ ...d, stockImages: { ...defaultStockImagesConfig } }))}>
            Reset
          </Button>
          <Button type="button" size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  )
}