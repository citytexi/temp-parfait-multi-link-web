import { useCallback, useEffect, useRef, useState } from 'react'

export const STORE_PREFIX = 'parfait-admin:'
const VERSION = 1

export type Parser<T> = (raw: unknown) => T | null
export type Stored<T> = {
  value: T
  /** Applies fn to the latest stored value and writes the result. True when the write reached storage. */
  update(fn: (current: T) => T): boolean
  /** Whether the last write reached storage. True when nothing was written yet; false while storage holds a newer version. */
  persisted: boolean
}

function assertKey(key: string): void {
  if (import.meta.env.DEV && !key.startsWith(STORE_PREFIX)) {
    throw new Error(`localStore key must start with "${STORE_PREFIX}": ${key}`)
  }
}

/** The stored string; null when missing or when storage is blocked. */
function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Stored values are untrusted: anything but a current envelope the parser accepts is the fallback. */
function parseRaw<T>(raw: string | null, parse: Parser<T>, fallback: T): T {
  if (raw === null) return fallback
  try {
    const envelope: unknown = JSON.parse(raw)
    if (typeof envelope !== 'object' || envelope === null) return fallback
    const { v, items } = envelope as { v?: unknown; items?: unknown }
    return v === VERSION ? (parse(items) ?? fallback) : fallback
  } catch {
    return fallback
  }
}

/** Whether a later version of the admin wrote this string. An old tab must leave it alone. */
function isNewer(raw: string | null): boolean {
  if (raw === null) return false
  try {
    const envelope: unknown = JSON.parse(raw)
    if (typeof envelope !== 'object' || envelope === null) return false
    const { v } = envelope as { v?: unknown }
    return typeof v === 'number' && v > VERSION
  } catch {
    return false
  }
}

/** The string that reached storage; null when serialising or writing failed, or storage holds a newer version. */
function writeRaw(key: string, value: unknown): string | null {
  try {
    if (isNewer(readRaw(key))) return null
    const raw = JSON.stringify({ v: VERSION, items: value })
    localStorage.setItem(key, raw)
    return raw
  } catch {
    return null
  }
}

export function readStored<T>(key: string, parse: Parser<T>, fallback: T): T {
  assertKey(key)
  return parseRaw(readRaw(key), parse, fallback)
}

/** False when the value did not reach storage (quota, blocked access, a newer stored version). Never throws for those. */
export function writeStored(key: string, value: unknown): boolean {
  assertKey(key)
  return writeRaw(key, value) !== null
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** `raw` is the stored string `value` belongs to; it is stale while `persisted` is false. */
type Snapshot<T> = { key: string; raw: string | null; value: T; persisted: boolean }

/**
 * Values whose last write did not reach storage, by key. They outlive the page that holds them,
 * so leaving a menu and coming back shows them again. Gone when the window is reloaded.
 */
const unsaved = new Map<string, Snapshot<unknown>>()

/** Drops every value that was kept only in memory. For tests: module state would leak between them. */
export function forgetUnsaved(): void {
  unsaved.clear()
}

/** A newer stored version reads as the fallback and is not persisted: the key is read-only. */
function read<T>(key: string, raw: string | null, parse: Parser<T>, fallback: T): Snapshot<T> {
  return { key, raw, value: parseRaw(raw, parse, fallback), persisted: !isNewer(raw) }
}

function load<T>(key: string, parse: Parser<T>, fallback: T): Snapshot<T> {
  return (unsaved.get(key) as Snapshot<T> | undefined) ?? read(key, readRaw(key), parse, fallback)
}

/**
 * What storage holds now. Keeps the snapshot (and its value reference) when the stored string is
 * unchanged; with `changedOnly` an unsaved snapshot is kept then too.
 */
function reload<T>(snapshot: Snapshot<T>, parse: Parser<T>, fallback: T, changedOnly = false): Snapshot<T> {
  const raw = readRaw(snapshot.key)
  if (raw === snapshot.raw && (snapshot.persisted || changedOnly)) return snapshot
  const next = read(snapshot.key, raw, parse, fallback)
  // Nothing readable replaces what is on screen while storage holds a newer version.
  return !next.persisted && !snapshot.persisted ? snapshot : next
}

/**
 * A stored value that follows other tabs and keeps working in memory when storage is blocked or full.
 * A value that was not saved is still there after the page is left and opened again.
 */
export function useStored<T>(key: string, parse: Parser<T>, fallback: T): Stored<T> {
  assertKey(key)
  const [state, setState] = useState(() => load(key, parse, fallback))
  // The newest snapshot, ahead of `state` between an update and its render.
  const latest = useRef(state)
  const args = useRef({ parse, fallback })
  useEffect(() => {
    args.current = { parse, fallback }
  })

  let snapshot = state
  if (snapshot.key !== key) {
    snapshot = load(key, parse, fallback)
    latest.current = snapshot
    setState(snapshot)
  }

  const commit = useCallback((next: Snapshot<T>) => {
    if (next === latest.current) return
    latest.current = next
    if (next.persisted) unsaved.delete(next.key)
    else unsaved.set(next.key, next)
    setState(next)
  }, [])

  useEffect(() => {
    const sync = (changedOnly: boolean): void => {
      if (latest.current.key !== key) return
      commit(reload(latest.current, args.current.parse, args.current.fallback, changedOnly))
    }
    const onStorage = (event: StorageEvent): void => {
      if (event.key === key || event.key === null) sync(false)
    }
    window.addEventListener('storage', onStorage)
    // A write from another tab between the first read and here raised its event before the listener
    // was on. An unsaved value is given up only when storage really changed under it.
    sync(true)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, commit])

  const update = useCallback(
    (fn: (current: T) => T): boolean => {
      const { parse, fallback } = args.current
      const held = latest.current.key === key ? latest.current : load(key, parse, fallback)
      // After a failed write storage is older than the screen, so the screen's value is the base.
      const base = held.persisted ? reload(held, parse, fallback) : held
      const value = fn(base.value)
      const raw = writeRaw(key, value)
      commit({ key, raw: raw ?? base.raw, value, persisted: raw !== null })
      return raw !== null
    },
    [key, commit],
  )

  return { value: snapshot.value, update, persisted: snapshot.persisted }
}
