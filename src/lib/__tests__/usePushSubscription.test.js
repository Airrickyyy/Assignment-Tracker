/**
 * Tests for usePushSubscription (Phase 3C) — the hook that keeps this
 * browser's push subscription in step with the notifications toggle.
 * The browser Push API itself can't run in jsdom; enablePush/disablePush
 * are mocked and real delivery is verified manually (docs/PHASE-3C-SETUP.md).
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../pushSubscription', () => ({
  getPushSupport: vi.fn(() => 'available'),
  enablePush:     vi.fn(() => Promise.resolve()),
  disablePush:    vi.fn(() => Promise.resolve()),
}))

import { getPushSupport, enablePush, disablePush } from '../pushSubscription'
import { usePushSubscription } from '../usePushSubscription'

beforeEach(() => {
  vi.clearAllMocks()
  getPushSupport.mockReturnValue('available')
  enablePush.mockResolvedValue()
  disablePush.mockResolvedValue()
  global.Notification = { permission: 'granted' }
})

describe('usePushSubscription', () => {
  it('subscribes when signed in, enabled and permission granted', async () => {
    const { result } = renderHook(() => usePushSubscription({ enabled: true, sessionUserId: 'u1' }))
    await waitFor(() => expect(result.current).toBe('active'))
    expect(enablePush).toHaveBeenCalledTimes(1)
    expect(disablePush).not.toHaveBeenCalled()
  })

  it('does nothing while signed out', () => {
    const { result } = renderHook(() => usePushSubscription({ enabled: true, sessionUserId: null }))
    expect(result.current).toBe('inactive')
    expect(enablePush).not.toHaveBeenCalled()
    expect(disablePush).not.toHaveBeenCalled()
  })

  it('unsubscribes when the toggle is turned off', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => usePushSubscription({ enabled, sessionUserId: 'u1' }),
      { initialProps: { enabled: true } },
    )
    await waitFor(() => expect(result.current).toBe('active'))
    rerender({ enabled: false })
    expect(result.current).toBe('inactive')
    expect(disablePush).toHaveBeenCalledTimes(1)
  })

  it('does not subscribe without notification permission', () => {
    global.Notification = { permission: 'default' }
    renderHook(() => usePushSubscription({ enabled: true, sessionUserId: 'u1' }))
    expect(enablePush).not.toHaveBeenCalled()
  })

  it('reports an error when registration fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    enablePush.mockRejectedValue(new Error('rpc failed'))
    const { result } = renderHook(() => usePushSubscription({ enabled: true, sessionUserId: 'u1' }))
    await waitFor(() => expect(result.current).toBe('error'))
  })

  it.each(['unsupported', 'unconfigured'])('reports %s and never touches the Push API', support => {
    getPushSupport.mockReturnValue(support)
    const { result } = renderHook(() => usePushSubscription({ enabled: true, sessionUserId: 'u1' }))
    expect(result.current).toBe(support)
    expect(enablePush).not.toHaveBeenCalled()
  })

  it('re-registers for a different user on the same browser', async () => {
    const { result, rerender } = renderHook(
      ({ uid }) => usePushSubscription({ enabled: true, sessionUserId: uid }),
      { initialProps: { uid: 'u1' } },
    )
    await waitFor(() => expect(result.current).toBe('active'))
    rerender({ uid: 'u2' })
    await waitFor(() => expect(enablePush).toHaveBeenCalledTimes(2))
  })
})
