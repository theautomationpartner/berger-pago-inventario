import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * Identificación del build. Vercel expone el commit desplegado en `VERCEL_GIT_COMMIT_SHA`; en
 * local no existe y queda como "dev". Se incrusta en el bundle para que la app pueda decir en
 * pantalla qué versión está corriendo.
 */
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'

export default defineConfig({
  plugins: [react()],
  define: { __COMMIT__: JSON.stringify(COMMIT) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5182,
    strictPort: true,
    /*
     * La app corre embebida en Monday (iframe) y también suelta en el navegador. El proxy evita
     * el CORS de api.monday.com y, sobre todo, mantiene el token fuera de la URL.
     *
     * Son DOS destinos porque Monday separa la API GraphQL de la subida de archivos: los binarios
     * van a `/v2/file` como multipart, no a `/v2`.
     */
    proxy: {
      '/monday-api': {
        target: 'https://api.monday.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/monday-api/, '/v2'),
      },
      '/monday-file': {
        target: 'https://api.monday.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/monday-file/, '/v2/file'),
      },
      /*
       * Buscador de direcciones. En producción esto lo hace `api/geo.ts`, que además controla el
       * acceso; acá las funciones de `api/` no corren, así que el pedido sale por el proxy. El
       * `User-Agent` no es opcional: OpenStreetMap responde 403 sin él.
       */
      '/geo-api': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        headers: { 'User-Agent': 'ImportacionBergerSA/1.0 (desarrollo local)' },
        rewrite: (path) => path.replace(/^\/geo-api/, ''),
      },
    },
  },
})
