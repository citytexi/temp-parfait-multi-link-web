import { useCallback, useEffect, useRef, useState } from 'react'

export const STORE_PREFIX = 'parfait-admin:'
const VERSION = 1

export type Parser<T> = (raw: unknown) => T | null
export type Stored<T> = {
  value: T
  /** Applies fn to the latest stored value and writes the result. True when the write reached storage. */
  update(fn: (current: T) => T): boolean
  /** Whether the last write reached storage. True when nothing was written yet. */
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

/** The string that reached storage; null when serialising or writing failed. */
function writeRaw(key: string, value: unknown): string | null {
  try {
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

/** False when the value did not reach storage (quota, blocked access). Never throws for those. */
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

function load<T>(key: string, parse: Parser<T>, fallback: T): Snapshot<T> {
  const raw = readRaw(key)
  return { key, raw, value: parseRaw(raw, parse, fallback), persisted: true }
}

/** What storage holds now. Keeps the snapshot (and its value reference) when the stored string is unchanged. */
function reload<T>(snapshot: Snapshot<T>, parse: Parser<T>, fallback: T): Snapshot<T> {
  const raw = readRaw(snapshot.key)
  if (snapshot.persisted && raw === snapshot.raw) return snapshot
  return { key: snapshot.key, raw, value: parseRaw(raw, parse, fallback), persisted: true }
}

/** A stored value that follows other tabs and keeps working in memory when storage is blocked or full. */
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
    setState(next)
  }, [])

  useEffect(() => {
    const sync = (): void => {
      if (latest.current.key === key) commit(reload(latest.current, args.current.parse, args.current.fallback))
    }
    const onStorage = (event: StorageEvent): void => {
      if (event.key === key || event.key === null) sync()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, commit])

  const update = useCallback(
    (fn: (current: T) => T): boolean => {
      const { parse, fallback } = args.current
      const held = latest.current.key === key ? latest.current : load(key, parse, fallback)
      // After a failed write storage is older than the screen, so the screen's value is the base.
      const base = held.persisted ? reload(held, parse, fallback).value : held.value
      const value = fn(base)
      const raw = writeRaw(key, value)
      commit({ key, raw: raw ?? held.raw, value, persisted: raw !== null })
      return raw !== null
    },
    [key, commit],
  )

  return { value: snapshot.value, update, persisted: snapshot.persisted }
}
