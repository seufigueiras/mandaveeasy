// services/n8nService.ts

import { WEBHOOK_ONBOARDING, WEBHOOK_SYNC_RAG } from '../constants';

// 🟢 NOVO: URL correta para Webhook de Pedido Novo
const N8N_ORDER_WEBHOOK = "https://cantinhodabere-n8n.3xdxtv.easypanel.host/webhook/testando";
const N8N_TEST_WEBHOOK = "https://cantinhodabere-n8n.3xdxtv.easypanel.host/webhook-test/testando"; // Mantido para eventos genéricos

/**
 * ============================================================
 * FUNÇÃO GENÉRICA PARA ENVIAR EVENTOS AO N8N
 * ============================================================
 */
export const sendEventToN8n = async (eventName: string, data: any): Promise<any> => {
    
    // 🛑 A URL a ser usada depende do nome do evento
    const url = eventName === 'newOrder' ? N8N_ORDER_WEBHOOK : N8N_TEST_WEBHOOK;
    
    try {
        const response = await fetch(url, { // AGORA USANDO A URL DINÂMICA
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                event: eventName,
                payload: data
            })
        });

        // Caso o N8n responda com erro
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Erro HTTP: ${response.status}` }));
            return { message: errorData.message || `Erro ao enviar evento ao N8n: ${response.status}` };
        }

        return await response.json().catch(() => ({}));
    } catch (error) {
        console.error("Erro ao enviar evento ao N8n:", error);
        return { message: (error as Error).message || "Falha ao enviar evento ao N8n." };
    }
};


/**
 * ============================================================
 * FUNÇÃO DE ONBOARDING DO RESTAURANTE
 * ============================================================
 * Agora recebe dados dinâmicos do restaurante
 */
export const triggerOnboarding = async (
    restaurantId: string,
    restaurantName: string
): Promise<any> => {
    try {
        const response = await fetch(WEBHOOK_ONBOARDING, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                restaurant_name: restaurantName,
                restaurant_id: restaurantId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: `Erro HTTP: ${response.status} ${response.statusText}`,
            }));
            return { message: errorData.message || `Erro no onboarding: ${response.status}` };
        }

        return await response.json();
    } catch (error) {
        console.error('Error triggering onboarding:', error);
        return { message: (error as Error).message || "Falha ao acessar o servidor N8N." };
    }
};


/**
 * ============================================================
 * FUNÇÃO PARA SINCRONIZAR PRODUTOS (RAG)
 * ============================================================
 * Mantida para uso futuro, caso seja necessário
 */
export const syncRAG = async (restaurantId: string): Promise<void> => {
    try {
        await fetch(WEBHOOK_SYNC_RAG, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                restaurant_id: restaurantId,
                action: 'sync_products',
            }),
        });
    } catch (error) {
        console.error('Error syncing RAG:', error);
    }
};