import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Admin CSP (spec §3). GitHub Pages cannot set headers, so it ships as a <meta>.
const ADMIN_CSP = [
  "default-src 'self'",
  // GIS token client library.
  "script-src 'self' https://accounts.google.com/gsi/client",
  // React inline style attributes; GIS button styles; Pretendard stylesheet.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://cdn.jsdelivr.net",
  // Pretendard font files.
  'font-src https://cdn.jsdelivr.net',
  // Google account avatars shown by GIS.
  "img-src 'self' data: https://*.googleusercontent.com",
  // GA Data API; GIS endpoints (Google's documented requirement); token revoke on logout.
  'connect-src https://analyticsdata.googleapis.com https://accounts.google.com/gsi/ https://oauth2.googleapis.com',
  // GIS iframes (Google's documented requirement, narrower than the spec's accounts.google.com).
  'frame-src https://accounts.google.com/gsi/',
  // Hardening: no <base> hijack, no form posts, no plugins.
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ')

/**
 * Build-only: the dev server needs React Refresh's inline script, which this CSP blocks.
 * Runs after Vite's own HTML transforms so the meta stays the first child of <head>.
 */
function adminCsp(): Plugin {
  return {
    name: 'admin-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.path.endsWith('/admin/index.html')) return html
        return html.replace(
          /<head>/i,
          `<head>\n  <meta http-equiv="Content-Security-Policy" content="${ADMIN_CSP}">`,
        )
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
