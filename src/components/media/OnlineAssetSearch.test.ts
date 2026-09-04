import { describe, it, expect } from 'vitest'
import { searchStockImages, searchStockVideos, searchWikimediaImages, searchWikimediaVideos } from '@/api/stock/search'
import { searchMusic } from '@/api/music/search'
import { searchGiphy, searchWikimediaGifs } from '@/api/stickers/search'

describe('Online Asset Search APIs', () => {
  it('has valid stock, music, and sticker search functions', () => {
    expect(typeof searchStockVideos).toBe('function')
    expect(typeof searchStockImages).toBe('function')
    expect(typeof searchWikimediaImages).toBe('function')
    expect(typeof searchWikimediaVideos).toBe('function')
    expect(typeof searchMusic).toBe('function')
    expect(typeof searchGiphy).toBe('function')
    expect(typeof searchWikimediaGifs).toBe('function')
  })

  it('handles empty results gracefully without throwing', async () => {
    const videoResults = await searchStockVideos('nonexistentquery123456789')
    expect(Array.isArray(videoResults)).toBe(true)

    const stockResults = await searchStockImages('nonexistentquery123456789')
    expect(Array.isArray(stockResults)).toBe(true)

    const musicResults = await searchMusic('nonexistentquery123456789')
    expect(Array.isArray(musicResults)).toBe(true)
  })

  it('successfully returns search arrays from open stock providers', async () => {
    const wikiImages = await searchWikimediaImages('nature', 2)
    expect(Array.isArray(wikiImages)).toBe(true)

    const wikiVideos = await searchWikimediaVideos('nature', 2)
    expect(Array.isArray(wikiVideos)).toBe(true)
  })
})

