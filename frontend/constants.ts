// Tenta ler de variáveis de ambiente (Vite ou Next.js), se não existir, usa as credenciais de produção fornecidas no PRD.

const getEnv = (key: string, viteKey: string, fallback: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
    // @ts-ignore
    return import.meta.env[viteKey];
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    // @ts-ignore
    return process.env[key];
  }
  return fallback;
};

export const SUPABASE_URL = getEnv(
  "NEXT_PUBLIC_SUPABASE_URL", 
  "VITE_SUPABASE_URL", 
  "https://lhhasjzlsbmhaxhvaipw.supabase.co"
);

export const SUPABASE_ANON_KEY = getEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY", 
  "VITE_SUPABASE_ANON_KEY", 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoaGFzanpsc2JtaGF4aHZhaXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNzQwMTEsImV4cCI6MjA4MDY1MDAxMX0.xtfP1Sz_LeoRfimOKAAeFd8DNu_rUBYF1lpGdgDVVac"
);

export const EVOLUTION_API_URL = "https://cantinhodabere-evolution-api.3xdxtv.easypanel.host";

// n8n Webhooks
export const WEBHOOK_ONBOARDING = getEnv(
  "NEXT_PUBLIC_N8N_WEBHOOK_ONBOARDING",
  "VITE_N8N_WEBHOOK_ONBOARDING",
  "https://cantinhodabere-n8n.3xdxtv.easypanel.host/webhook-test/evolution-onboarding"
);

export const WEBHOOK_SYNC_RAG = getEnv(
  "NEXT_PUBLIC_N8N_WEBHOOK_SYNC_RAG",
  "VITE_N8N_WEBHOOK_SYNC_RAG",
  "https://cantinhodabere-n8n.3xdxtv.easypanel.host/webhook-test/sync-rag"
);

export const WEBHOOK_BOT_MSG = "https://cantinhodabere-n8n.3xdxtv.easypanel.host/webhook-test/mandave";

// Hardcoded Tenant ID for demo purposes
export const DEMO_RESTAURANT_ID = "00000000-0000-0000-0000-000000000001"; 
export const DEMO_RESTAURANT_NAME = "Cantinho da Bere";