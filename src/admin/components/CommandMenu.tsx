import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { MenuDef } from '../menu/defineMenu'
import type { MenuGroup } from '../menu/registry'

export type CommandMenuProps = {
  groups: readonly MenuGroup[]
  open: boolean
  onOpenChange(open: boolean): void
  onSelect(id: string): void
}

/** True when the trimmed query appears in the menu's label, description or keywords. */
export function matchesQuery(menu: MenuDef, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  const haystack = [menu.label, menu.description, ...(menu.keywords ?? [])].join(' ').toLowerCase()
  return haystack.includes(needle)
}

/** ⌘K / Ctrl+K. `code` covers Hangul input, where `key` is a jamo instead of "k". */
function isToggleShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')
}

/** Searchable jump-to-menu dialog. Controlled: the shell owns `open`. */
export function CommandMenu({ groups, open, onOpenChange, onSelect }: CommandMenuProps): ReactElement {
  const [query, setQuery] = useState('')
  // Set when the dialog closes because a menu was picked, read by onCloseAutoFocus.
  const pickedRef = useRef(false)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isToggleShortcut(e)) return
      e.preventDefault()
      // A held shortcut keeps firing keydown; toggling on each one would flicker the dialog.
      if (e.repeat) return
      onOpenChange(!open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const pick = (id: string) => {
    pickedRef.current = true
    onSelect(id)
    onOpenChange(false)
  }

  const visible = groups
    .map((g) => ({ ...g, menus: g.menus.filter((m) => matchesQuery(m, query)) }))
    .filter((g) => g.menus.length > 0)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="adm-command__overlay" />
        <Dialog.Content
          className="adm-command"
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            // Runs before focus moves into the dialog, so this is still the element that opened it.
            openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            pickedRef.current = false
          }}
          onCloseAutoFocus={(e) => {
            // Radix only restores focus to a Dialog.Trigger, and the shell has none, so do it here.
            // After a pick the shell moves focus to the page's <h1>; restoring would undo that. The same
            // holds when the dialog closed because the page changed under it and focus already moved
            // on: restore only while nothing else holds focus.
            e.preventDefault()
            const active = document.activeElement
            if (!pickedRef.current && (active === null || active === document.body)) openerRef.current?.focus()
          }}
        >
          <Dialog.Title className="adm-sr-only">빠른 이동</Dialog.Title>
          <Command label="빠른 이동" shouldFilter={false} className="adm-command__root">
            <div className="adm-command__search">
              <Search className="adm-command__search-icon" size={18} aria-hidden="true" />
              <Command.Input
                className="adm-command__input"
                placeholder="메뉴 이름으로 찾기"
                value={query}
                onValueChange={setQuery}
              />
            </div>
            <Command.List className="adm-command__list">
              <Command.Empty className="adm-command__empty">찾는 메뉴가 없어요</Command.Empty>
              {visible.map((group) => (
                <Command.Group key={group.id} heading={group.label} className="adm-command__group">
                  {group.menus.map((menu) => {
                    const Icon = menu.icon
                    return (
                      <Command.Item
                        key={menu.id}
                        value={menu.id}
                        className="adm-command__item"
                        onSelect={() => pick(menu.id)}
                      >
                        <Icon className="adm-command__icon" size={18} aria-hidden="true" />
                        <span className="adm-command__label">{menu.label}</span>
                        <span className="adm-command__desc">{menu.description}</span>
                      </Command.Item>
                    )
                  })}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
