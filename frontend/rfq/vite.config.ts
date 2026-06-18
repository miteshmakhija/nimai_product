import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Browser navigations (refresh, deep link) send `Accept: text/html`.
// XHR/fetch from axios do not. Frontend routes like /approvals, /users,
// /prompts collide with API proxy prefixes, so only proxy non-HTML requests
// and let Vite serve index.html (SPA fallback) for real navigations.
const bypassHtml = (req: { headers: Record<string, string | string[] | undefined> }) => {
  const accept = req.headers.accept
  if (typeof accept === 'string' && accept.includes('text/html')) return '/index.html'
  return null
}

const apiTarget = 'http://localhost:8001'
const apiProxy = {
  target: apiTarget,
  changeOrigin: true,
  bypass: bypassHtml,
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/auth': apiProxy,
      '/rfqs': apiProxy,
      '/prompts': apiProxy,
      '/users': apiProxy,
      '/metrics': apiProxy,
      '/products': apiProxy,
      '/approvals': apiProxy,
      '/approval-templates': apiProxy,
      '/docx-template': apiProxy,
      '/app-config': apiProxy,
      '/health': apiProxy,
    },
  },
})
