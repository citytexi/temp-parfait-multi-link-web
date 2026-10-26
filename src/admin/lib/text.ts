const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/
// Direction marks, overrides, isolates and invisible characters: they reorder or hide the text around a name.
// U+200C and U+200D stay allowed: they join emoji and letters and reorder nothing.
const FORMAT = /[\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/
// In unicode mode a surrogate matches only when it is not part of a pair.
const LONE_SURROGATE = /[\ud800-\udfff]/u

/**
 * Whether a name a person typed (or a stored one) holds characters that break how it is shown:
 * control characters and line breaks, characters that reorder or hide text, or half of a surrogate pair.
 */
export function hasUnsafeChars(text: string): boolean {
  return CONTROL.test(text) || FORMAT.test(text) || LONE_SURROGATE.test(text)
}
