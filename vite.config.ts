import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { buildAdminCsp, escapeHtmlAttribute, readCspFragments } from './build/adminCsp.ts'

/**
 * Build-only: the dev server needs React Refresh's inline script, which this CSP blocks.
 * Runs after Vite's own HTML transforms so the meta stays the first child of <head>.
 */
function adminCsp(): Plugin {
  const csp = buildAdminCsp(readCspFragments(path.resolve(import.meta.dirname, 'src/admin/pages')))
  return {
    name: 'admin-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.path.endsWith('/admin/index.html')) return html
        const meta = `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(csp)}">`
        let inserted = false
        // A function replacer: a replacement string would interpret `$` sequences in the policy.
        const out = html.replace(/<head>/i, () => {
          inserted = true
          return `<head>\n  ${meta}`
        })
        if (!inserted) throw new Error(`admin-csp: no <head> tag in ${ctx.path}, so the CSP meta was not inserted`)
        return out
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/temp-parfait-multi-link-web/',
  plugins: [react(), adminCsp()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', admin: 'admin/index.html' },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
})
