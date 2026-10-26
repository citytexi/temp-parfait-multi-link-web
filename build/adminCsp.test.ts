// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildAdminCsp, escapeHtmlAttribute, FRAGMENT_DIRECTIVES, readCspFragments } from './adminCsp.ts'

const EXPECTED_BASE =
  "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self' https://analyticsdata.googleapis.com https://accounts.google.com/gsi/ https://oauth2.googleapis.com; frame-src https://accounts.google.com/gsi/; base-uri 'self'; form-action 'none'; object-src 'none'"

describe('buildAdminCsp', () => {
  it('exposes the directives a fragment may extend', () => {
    expect(FRAGMENT_DIRECTIVES).toEqual(['connect-src', 'img-src', 'frame-src'])
  })

  it('equals the current CSP when there are no fragments', () => expect(buildAdminCsp([])).toBe(EXPECTED_BASE))

  it('appends fragment sources to the matching directive', () => {
    const csp = buildAdminCsp([{ file: 'a.csp.json', directives: { 'connect-src': ['https://api.github.com'] } }])
    expect(csp).toContain(
      "connect-src 'self' https://analyticsdata.googleapis.com https://accounts.google.com/gsi/ https://oauth2.googleapis.com https://api.github.com",
    )
    expect(csp.replace(' https://api.github.com', '')).toBe(EXPECTED_BASE)
  })

  it('does not repeat a source that is already allowed', () => {
    const f = { file: 'a.csp.json', directives: { 'connect-src': ['https://oauth2.googleapis.com'] } }
    expect(buildAdminCsp([f, f])).toBe(EXPECTED_BASE)
  })

  it('does not repeat a source listed twice', () => {
    const f = { file: 'a.csp.json', directives: { 'frame-src': ['https://a.example', 'https://a.example'] } }
    expect(buildAdminCsp([f, f]).match(/https:\/\/a\.example/g)).toHaveLength(1)
  })

  it('rejects a fragment that is not a JSON object and names the file', () => {
    const directives = ['https://a.example'] as unknown as Record<string, string[]>
    expect(() => buildAdminCsp([{ file: 'pages/x/arr.csp.json', directives }])).toThrow(/arr\.csp\.json/)
  })

  it.each([['https://api.github.com'], ['https://a.example:8443']])('accepts %s', (source) => {
    const csp = buildAdminCsp([{ file: 'a.csp.json', directives: { 'connect-src': [source] } }])
    expect(csp.replace(` ${source}`, '')).toBe(EXPECTED_BASE)
  })

  it.each([
    ['script-src', ['https://evil.example']],
    ['default-src', ['https://a.example']],
    ['Connect-Src', ['https://a.example']],
    [' connect-src', ['https://a.example']],
    ['__proto__', ['https://a.example']],
    ['connect-src', ['http://a.example']],
    ['connect-src', ['https://*.example.com']],
    ['connect-src', ['*']],
    ['connect-src', ["'unsafe-inline'"]],
    ['connect-src', ['https://a.example; script-src *']],
    ['connect-src', ['https://a.example https://b.example']],
    ['connect-src', ['https://a.example,https://b.example']],
    ['connect-src', ['https://a.example"']],
    ['connect-src', ['https://a.example\n']],
    ['connect-src', ['']],
    ['connect-src', ['https://']],
    ['connect-src', [1]],
    ['connect-src', null],
    ['img-src', 'https://a.example'],
    ['connect-src', ['https://a.example&#59script-src-elem&#32https://evil.example']],
    ['connect-src', ['https://&#42.example.com']],
    ['connect-src', ['https://a.example&#x2a']],
    ['connect-src', ['https://a.example&quot']],
    ['connect-src', ['https://a.example<']],
    ['connect-src', ['https://a.example>']],
    ['connect-src', ['https://a.example\t']],
    ['connect-src', ['https://a.example\u0000']],
    ['connect-src', ['https://u@a.example']],
    ['connect-src', ['https://a.example/path']],
    ['connect-src', ['https://a.example/']],
    ['connect-src', ['https://a.example?x=1']],
    ['connect-src', ['HTTPS://a.example']],
    ['connect-src', ['https://localhost']],
  ])('rejects %s %j and names the file', (directive, value) => {
    expect(() =>
      buildAdminCsp([{ file: 'pages/x/x.csp.json', directives: { [directive]: value as string[] } }]),
    ).toThrow(/x\.csp\.json/)
  })
})

describe('escapeHtmlAttribute', () => {
  it('escapes & " < >', () => expect(escapeHtmlAttribute('a&b"c<d>e')).toBe('a&amp;b&quot;c&lt;d&gt;e'))
  it('leaves the base policy unchanged', () => expect(escapeHtmlAttribute(EXPECTED_BASE)).toBe(EXPECTED_BASE))
})

describe('readCspFragments', () => {
  const dirs: string[] = []
  const tmp = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'))
    dirs.push(d)
    return d
  }
  const write = (root: string, rel: string, body: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), body)
  }
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
  })

  it('reads fragments recursively, sorted by path, and ignores other files', () => {
    const root = tmp()
    write(root, 'b/x.csp.json', '{"connect-src":["https://b.example"]}')
    write(root, 'a/deep/y.csp.json', '{"img-src":["https://a.example"]}')
    write(root, 'a/z.json', '{"connect-src":["https://z.example"]}')
    const frags = readCspFragments(root)
    expect(frags.map((f) => path.relative(root, f.file).replaceAll('\\', '/'))).toEqual([
      'a/deep/y.csp.json',
      'b/x.csp.json',
    ])
    expect(frags[0].directives).toEqual({ 'img-src': ['https://a.example'] })
  })

  it('names the file when a fragment is not valid JSON', () => {
    const root = tmp()
    write(root, 'p/bad.csp.json', '{nope')
    expect(() => readCspFragments(root)).toThrow(/bad\.csp\.json/)
  })

  it('returns [] when the directory does not exist', () => {
    expect(readCspFragments(path.join(tmp(), 'missing'))).toEqual([])
  })
})
