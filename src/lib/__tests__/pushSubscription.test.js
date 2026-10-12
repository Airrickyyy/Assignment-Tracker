import { describe, it, expect, vi } from 'vitest'

// pushSubscription imports the Supabase client, which throws without env vars.
vi.mock('../supabaseClient', () => ({ supabase: {} }))

import { urlBase64ToUint8Array } from '../pushSubscription'

describe('urlBase64ToUint8Array', () => {
  it('decodes unpadded base64url, including - and _', () => {
    // bytes 0xfb 0xff 0xbf → base64 '+/+/' → base64url '-_-_'
    expect([...urlBase64ToUint8Array('-_-_')]).toEqual([0xfb, 0xff, 0xbf])
  })

  it('round-trips a 65-byte VAPID public key', () => {
    const bytes = Uint8Array.from({ length: 65 }, (_, i) => (i * 37) & 0xff)
    const encoded = Buffer.from(bytes).toString('base64url')
    expect(encoded.endsWith('=')).toBe(false)
    expect([...urlBase64ToUint8Array(encoded)]).toEqual([...bytes])
  })
})
