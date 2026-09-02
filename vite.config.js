import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const supabaseUrl = JSON.stringify(env.VITE_SUPABASE_URL || '');
    const supabaseKey = JSON.stringify(env.VITE_SUPABASE_ANON_KEY || '');
    const cartoApiKey = JSON.stringify(env.VITE_CARTO_API_KEY || '');

    return {
        plugins: [
            react(),
            {
                name: 'inject-supabase-globals',
                transformIndexHtml(html) {
                    return html.replace(
                        '<head>',
                        `<head>\n    <script>window.__SUPABASE_URL__=${supabaseUrl};window.__SUPABASE_KEY__=${supabaseKey};window.__CARTO_API_KEY__=${cartoApiKey};</script>`
                    );
                },
            },
            viteStaticCopy({
                targets: [
                    { src: 'src/js/**/*', dest: 'src/js' },
                    { src: 'src/css/**/*', dest: 'src/css' },
                    // src/utils/i18n.js se referencia como <script src="/src/utils/i18n.js">
                    // (script clásico, no import) en index.html/ciudad.html/mapa.html — sin
                    // este target el build de producción lo omite y esas páginas devuelven
                    // 404 para ese script, aunque `npm run dev` no lo detecta porque Vite
                    // sirve todo el repo directamente en desarrollo.
                    { src: 'src/utils/**/*', dest: 'src/utils' },
                ],
            }),
        ],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'index.html'),
                    ciudad: resolve(__dirname, 'ciudad.html'),
                    ciudades: resolve(__dirname, 'ciudades.html'),
                    ciudadesTodas: resolve(__dirname, 'ciudades-todas.html'),
                    mapa: resolve(__dirname, 'mapa.html'),
                    alojamiento: resolve(__dirname, 'alojamiento.html'),
                    servicios: resolve(__dirname, 'servicios.html'),
                    viajes: resolve(__dirname, 'viajes.html'),
                    admin: resolve(__dirname, 'admin/index.html'),
                },
            },
        },
    };
});
