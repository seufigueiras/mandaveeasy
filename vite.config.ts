// vite.config.ts

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 🟢 URL DA EVOLUTION API PARA O PROXY
const EVOLUTION_TARGET = 'https://cantinhodabere-evolution-api.3xdxtv.easypanel.host'; 

export default defineConfig(({ mode }) => {
    // Carrega todas as variáveis de ambiente (incluindo aquelas sem o prefixo VITE_)
    const env = loadEnv(mode, '.', '');
    
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            // 🟢 CONFIGURAÇÃO DE PROXY PARA EVITAR CORS (Apenas para Dev)
            proxy: {
                '/evolution-api': {
                    target: EVOLUTION_TARGET,
                    changeOrigin: true, 
                    secure: false, 
                    rewrite: (path) => path.replace(/^\/evolution-api/, ''), 
                },
            },
        },
        plugins: [react()],
        // 🛠️ ADIÇÃO PARA CORRIGIR O ERRO DE RESOLUÇÃO DO 'xlsx' NO VITE
        optimizeDeps: { 
            exclude: ['xlsx'],
        },
        define: {
            // Variáveis de ambiente explicitamente expostas para o frontend (import.meta.env)
            // Variáveis de API/Serviços
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.NEXT_PUBLIC_N8N_BASE_URL': JSON.stringify(env.NEXT_PUBLIC_N8N_BASE_URL),
            
            // 🚨 CRÍTICO: ADICIONANDO AS VARIÁVEIS PÚBLICAS DO SUPABASE PARA O FRONTEND
            // Usamos fallbacks (||) caso você tenha configurado a variável apenas como SUPABASE_URL (sem NEXT_PUBLIC)
            'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL),
            'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_KEY),
            
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});