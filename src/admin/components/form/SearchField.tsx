import type { ReactElement } from 'react'
import { useDebouncedPageParam } from '../../lib/useDebouncedPageParam'
import { TextField } from './TextField'

/**
 * A search box kept in the page param `param`. Typing writes the URL after a pause; Enter and
 * leaving the box write it at once. `onWrite` runs after each write, with null for an empty box.
 */
export function SearchField({
  label,
  param,
  placeholder,
  onWrite,
}: {
  label: string
  param: string
  placeholder?: string
  onWrite?(value: string | null): void
}): ReactElement {
  const [value, setValue, write] = useDebouncedPageParam(param, undefined, onWrite)
  return (
    <TextField
      type="search"
      label={label}
      value={value}
      onChange={setValue}
      placeholder={placeholder}
      autoComplete="off"
      onBlur={write}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) write()
      }}
    />
  )
}
