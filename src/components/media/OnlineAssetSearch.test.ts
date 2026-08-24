import { describe, it, expect } from 'vitest'
import { searchStockImages } from '@/api/stock/search'
import { searchMusic } from '@/api/music/search'
import { searchModels } from '@/api/models/polyhaven'
import { searchGiphy } from '@/api/stickers/search'

describe('Online Asset Search APIs', () => {
  it('has valid stock, music, 3D model, and sticker search functions', () => {
    expect(typeof searchStockImages).toBe('function')
    expect(typeof searchMusic).toBe('function')
    expect(typeof searchModels).toBe('function')
    expect(typeof searchGiphy).toBe('function')
  })

  it('handles empty results gracefully without throwing', async () => {
    const stockResults = await searchStockImages('nonexistentquery123456789')
    expect(Array.isArray(stockResults)).toBe(true)

    const musicResults = await searchMusic('nonexistentquery123456789')
    expect(Array.isArray(musicResults)).toBe(true)
  })
})
