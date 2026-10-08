import { findEvent, type CatalogEvent } from './eventCatalog'

export function labelFrom(
  event: CatalogEvent | undefined,
  name: string,
): { label: string; registered: boolean } {
  return event === undefined || event.label === ''
    ? { label: name, registered: false }
    : { label: event.label, registered: true }
}

export function eventLabel(name: string): { label: string; registered: boolean } {
  return labelFrom(findEvent(name), name)
}
