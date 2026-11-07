import { useState, useEffect } from 'react'

export interface NetworkState {
  online: boolean
  forceOffline: boolean
  effectiveOnline: boolean
}

let currentOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
let currentForceOffline = typeof localStorage !== 'undefined'
  ? localStorage.getItem('force_offline') === 'true'
  : false

const listeners = new Set<(state: NetworkState) => void>()

function notify() {
  const state = getNetworkStatus()
  listeners.forEach((listener) => listener(state))
}

export function getNetworkStatus(): NetworkState {
  return {
    online: currentOnline,
    forceOffline: currentForceOffline,
    effectiveOnline: currentOnline && !currentForceOffline,
  }
}

export function isNetworkAvailable(): boolean {
  return currentOnline && !currentForceOffline
}

export function setForceOffline(force: boolean): void {
  currentForceOffline = force
  try {
    localStorage.setItem('force_offline', String(force))
  } catch {}
  notify()
}

export function toggleForceOffline(): boolean {
  const next = !currentForceOffline
  setForceOffline(next)
  return next
}

/**
 * Lightweight non-blocking ping to verify actual WAN internet connectivity
 */
export async function verifyConnectivity(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (currentOnline !== false) {
      currentOnline = false
      notify()
    }
    return false
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)
    // Quick, zero-content head request to a high-availability endpoint
    await fetch('https://1.1.1.1/cdn-cgi/trace', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (currentOnline !== true) {
      currentOnline = true
      notify()
    }
    return true
  } catch {
    // If external fetch fails, fallback to navigator.onLine
    const fallback = typeof navigator !== 'undefined' ? navigator.onLine : false
    if (currentOnline !== fallback) {
      currentOnline = fallback
      notify()
    }
    return fallback
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    currentOnline = true
    notify()
    verifyConnectivity().catch(() => {})
  })

  window.addEventListener('offline', () => {
    currentOnline = false
    notify()
  })

  // Re-verify on window focus or initial load
  window.addEventListener('focus', () => {
    verifyConnectivity().catch(() => {})
  })

  // Periodic lightweight check every 45s
  setInterval(() => {
    verifyConnectivity().catch(() => {})
  }, 45000)

  // Run initial check
  verifyConnectivity().catch(() => {})
}

export function useNetworkStatus(): NetworkState & {
  toggleForceOffline: () => boolean
  setForceOffline: (force: boolean) => void
  recheck: () => Promise<boolean>
} {
  const [state, setState] = useState<NetworkState>(getNetworkStatus)

  useEffect(() => {
    const handler = (nextState: NetworkState) => setState(nextState)
    listeners.add(handler)
    return () => {
      listeners.delete(handler)
    }
  }, [])

  return {
    ...state,
    toggleForceOffline,
    setForceOffline,
    recheck: verifyConnectivity,
  }
}

