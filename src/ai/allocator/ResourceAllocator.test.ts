import { describe, it, expect } from 'vitest'
import { resourceAllocator } from './ResourceAllocator'

describe('ResourceAllocator', () => {
  it('initializes provider health states', () => {
    const snapshot = resourceAllocator.getHealthSnapshot()
    expect(snapshot.length).toBeGreaterThanOrEqual(10)
    const unsplash = snapshot.find((s) => s.provider === 'unsplash')
    expect(unsplash).toBeDefined()
  })

  it('selects best provider according to waterfall', () => {
    const stockProvider = resourceAllocator.selectBestProvider('stock_images')
    expect(['unsplash', 'pexels', 'pixabay']).toContain(stockProvider)
  })

  it('records call outcome and updates rate limit state', () => {
    resourceAllocator.recordCallOutcome('unsplash', false, 500, true)
    const snapshot = resourceAllocator.getHealthSnapshot()
    const unsplash = snapshot.find((s) => s.provider === 'unsplash')
    expect(unsplash?.isRateLimited).toBe(true)

    // Reset with success
    resourceAllocator.recordCallOutcome('unsplash', true, 150, false)
    expect(unsplash?.isRateLimited).toBe(false)
  })
})
