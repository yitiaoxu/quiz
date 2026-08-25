import { describe, expect, it } from 'vitest'
import { clampZoomFactor } from './zoom'

describe('clampZoomFactor', () => {
  it('keeps the default and Typora-like bounds', () => {
    expect(clampZoomFactor(1)).toBe(1)
    expect(clampZoomFactor(0.69)).toBe(0.7)
    expect(clampZoomFactor(2.1)).toBe(2)
    expect(clampZoomFactor(1.14)).toBe(1.1)
    expect(clampZoomFactor(Number.NaN)).toBe(1)
  })
})
