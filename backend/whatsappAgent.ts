// services/whatsappAgent.ts

import { supabase } from '../frontend/services/supabaseClient.js';
import { sendMessageToGemini, formatConversationHistory, extractOrderData } from './geminiService.js';
import { sendWhatsAppMessage } from './evolutionService.js';
import fetch from 'node-fetch';
import 'dotenv/config'; 

interface RestaurantConfig {
    id: string;
    name: string;
    address: string;
    phone: string;
    delivery_fee: number;
    delivery_time: string;
    opening_hours: any[];
    bot_name: string;
    bot_instructions: string;
    bot_is_active: boolean;
    bot_last_closed_response: any;
}

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    is_active: boolean;
}

/**
 * 🕐 Verifica se o restaurante está aberto no momento
 */
const isRestaurantOpen = (openingHours: any[]): boolean => {
    const now = new Date();
    const currentDay = now.toLocaleDateString('pt-BR', { weekday: 'long' });
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    const dayMap: { [key: string]: string } = {
        'domingo': 'Domingo',
        'segunda-feira': 'Segunda',
        'terça-feira': 'Terça',
        'quarta-feira': 'Quarta',
        'quinta-feira': 'Quinta',
        'sexta-feira': 'Sexta',
        'sábado': 'Sábado',
    };

    const dayName = dayMap[currentDay.toLowerCase()];
    const todaySchedule = openingHours.find(h => h.day === dayName);

    if (!todaySchedule || !todaySchedule.is_open) {
        return false;
    }

    return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
};

/**
 * ⏰ Verifica se já respondeu "fechado" recentemente (menos de 1 hora)
 */
const canSendClosedMessage = (restaurantId: string, phone: string, lastClosedResponses: any): boolean => {
    if (!lastClosedResponses || typeof lastClosedResponses !== 'object') {
        return true;
    }

    const lastResponse = lastClosedResponses[phone];
    
    if (!lastResponse) {
        return true;
    }

    const lastResponseTime = new Date(lastResponse).getTime();
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hora em milissegundos

    return (now - lastResponseTime) >= oneHour;
};

/**
 * 💾 Salva que enviou mensagem de "fechado"
 */
const saveClosedResponse = async (restaurantId: string, phone: string) => {
    const { data: restaurant } = await supabase
        .from('restaurants')
        .select('bot_last_closed_response')
        .eq('id', restaurantId)
        .single();

    const lastClosedResponses = restaurant?.bot_last_closed_response || {};
    lastClosedResponses[phone] = new Date().toISOString();

    await supabase
        .from('restaurants')
        .update({ bot_last_closed_response: lastClosedResponses })
        .eq('id', restaurantId);
};

/**
 * 📋 Busca produtos ativos do restaurante
 */
const getActiveProducts = async (restaurantId: string): Promise<Product[]> => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('category', { ascending: true });

    if (error) {
        console.error('Erro ao buscar produtos:', error);
        return [];
    }

    return data || [];
};

/**
 * 📝 Formata o cardápio para o prompt
 */
const formatMenuForPrompt = (products: Product[]): string => {
    const groupedByCategory: { [key: string]: Product[] } = {};

    products.forEach(product => {
        if (!groupedByCategory[product.category]) {
            groupedByCategory[product.category] = [];
        }
        groupedByCategory[product.category].push(product);
    });

    let menuText = '## CARDÁPIO DISPONÍVEL:\n\n';

    Object.keys(groupedByCategory).forEach(category => {
        menuText += `### ${category}\n`;
        groupedByCategory[category].forEach(product => {
            menuText += `- **${product.name}** (ID: ${product.id}) - R$ ${product.price.toFixed(2)}\n`;
            if (product.description) {
                menuText += `  ${product.description}\n`;
            }
        });
        menuText += '\n';
    });

    return menuText;
};

/**
 * 🤖 Gera o prompt do sistema para o robô
 */
const generateSystemPrompt = (config: RestaurantConfig, products: Product[]): string => {
    const currentDate = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const menuText = formatMenuForPrompt(products);

    let prompt = `Você é ${config.bot_name || 'o Assistente Virtual'} do restaurante ${config.name}.

📅 DATA E HORA ATUAL: ${currentDate}

## INFORMAÇÕES DO RESTAURANTE:
- Nome: ${config.name}
- Endereço: ${config.address}
- Telefone: ${config.phone}
- Taxa de entrega: R$ ${config.delivery_fee.toFixed(2)}
- Tempo médio de entrega: ${config.delivery_time || '30-40 minutos'}

${menuText}

## HORÁRIO DE FUNCIONAMENTO:
${config.opening_hours.map(h => `${h.day}: ${h.is_open ? `${h.open_time} às ${h.close_time}` : 'FECHADO'}`).join('\n')}

## SUAS RESPONSABILIDADES:
1. ✅ Atender clientes com cordialidade e profissionalismo
2. ✅ Anotar pedidos com todos os detalhes (produtos, quantidade, observações)
3. ✅ Perguntar nome, telefone e endereço de entrega
4. ✅ Confirmar forma de pagamento (Dinheiro, PIX, Cartão de Crédito, Cartão de Débito)
5. ✅ Perguntar se o cliente deseja adicionar mais alguma coisa antes de finalizar
6. ✅ Informar o tempo de entrega e a taxa de entrega
7. ✅ Consultar status de pedidos quando solicitado
8. ✅ NUNCA inventar produtos que não estão no cardápio
9. ✅ Ser objetivo e claro nas respostas

## IMPORTANTE - FORMATO DE FINALIZAÇÃO DO PEDIDO:
Quando o cliente confirmar o pedido completo, você DEVE responder em duas partes:

**PARTE 1 - Mensagem para o cliente:**
Uma mensagem amigável confirmando o pedido.

**PARTE 2 - Dados estruturados (JSON):**
Logo após a mensagem, inclua um JSON no seguinte formato:

\`\`\`json
{
    "action": "create_order",
    "data": {
        "customer_name": "Nome do Cliente",
        "customer_phone": "Telefone com DDD",
        "delivery_address": "Endereço completo",
        "payment_method": "cash|pix|credit_card|debit_card",
        "items": [
            {
                "product_id": "ID_DO_PRODUTO",
                "name": "Nome do Produto",
                "quantity": 2,
                "price": 25.90,
                "notes": "Observações opcionais"
            }
        ],
        "notes": "Observações gerais do pedido"
    }
}
\`\`\`

${config.bot_instructions ? `\n## INSTRUÇÕES PERSONALIZADAS:\n${config.bot_instructions}` : ''}

Responda sempre em português brasileiro de forma natural e amigável! 🍕`;

    return prompt;
};

/**
 * 💬 Processa mensagem recebida do cliente
 */
export const processWhatsAppMessage = async (
    restaurantId: string,
    phone: string,
    message: string
) => {
    try {
        console.log('📩 Processando mensagem:', { restaurantId, phone, message });

        // 1. Buscar configurações do restaurante
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .single();

        if (restaurantError || !restaurant) {
            console.error('Restaurante não encontrado:', restaurantError);
            return;
        }

        const config: RestaurantConfig = restaurant as RestaurantConfig;

        // 2. Verificar se o robô está ativo
        if (!config.bot_is_active) {
            console.log('🤖 Robô está desativado');
            return;
        }

        // 3. Verificar se está pausado para este número
        const { data: conversation } = await supabase
            .from('whatsapp_conversations')
            .select('is_bot_paused')
            .eq('phone', phone)
            .eq('restaurant_id', restaurantId)
            .single();

        if (conversation?.is_bot_paused) {
            console.log('⏸️ Robô pausado para este cliente');
            return;
        }

        // 4. Verificar se está fora do horário de funcionamento
        if (!isRestaurantOpen(config.opening_hours)) {
            // Verificar se pode enviar mensagem de fechado (1 hora)
            if (canSendClosedMessage(restaurantId, phone, config.bot_last_closed_response)) {
                const closedMessage = `Olá! 👋\n\nObrigado por entrar em contato com ${config.name}!\n\n🕐 No momento estamos fechados.\n\nNosso horário de funcionamento:\n${config.opening_hours
                    .filter(h => h.is_open)
                    .map(h => `${h.day}: ${h.open_time} às ${h.close_time}`)
                    .join('\n')}\n\nVolte nesse horário que ficaremos felizes em atendê-lo! 😊`;

                await sendWhatsAppMessage({ phone, message: closedMessage });
                await saveClosedResponse(restaurantId, phone);
                await saveMessage(restaurantId, phone, closedMessage, true);
                console.log('🔒 Enviado mensagem de fechado');
            } else {
                console.log('⏰ Já enviou mensagem de fechado recentemente');
            }
            return;
        }

        // 5. Buscar histórico de conversa
        const { data: messages } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('phone', phone)
            .order('timestamp', { ascending: true })
            .limit(20); // Últimas 20 mensagens para contexto

        const conversationHistory = formatConversationHistory(messages || []);

        // 6. Buscar produtos ativos
        const products = await getActiveProducts(restaurantId);

        // 7. Gerar prompt do sistema
        const systemPrompt = generateSystemPrompt(config, products);

        // 8. Enviar para o Gemini
        const geminiResponse = await sendMessageToGemini(
            message,
            systemPrompt,
            conversationHistory
        );

        // 9. Verificar se há um pedido para criar
        const orderData = extractOrderData(geminiResponse);

        if (orderData) {
            console.log('📦 Pedido detectado, criando no sistema...');
            await createOrder(restaurantId, phone, orderData);
        }

        // 10. Remover JSON da resposta antes de enviar ao cliente
        const cleanResponse = geminiResponse.replace(/```json[\s\S]*?```/g, '').trim();

        // 11. Enviar resposta via WhatsApp
        await sendWhatsAppMessage({ phone, message: cleanResponse });

        // 12. Salvar mensagem do bot no banco
        await saveMessage(restaurantId, phone, cleanResponse, true);

        console.log('✅ Mensagem processada com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        
        // Enviar mensagem de erro genérica
        try {
            await sendWhatsAppMessage({
                phone,
                message: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente em instantes.'
            });
        } catch (sendError) {
            console.error('Erro ao enviar mensagem de erro:', sendError);
        }
    }
};

/**
 * 💾 Salva mensagem no banco de dados
 */
const saveMessage = async (
    restaurantId: string,
    phone: string,
    messageText: string,
    isFromMe: boolean
) => {
    // Buscar ou criar conversa
    let { data: conversation } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('phone', phone)
        .eq('restaurant_id', restaurantId)
        .single();

    if (!conversation) {
        const { data: newConv } = await supabase
            .from('whatsapp_conversations')
            .insert({
                restaurant_id: restaurantId,
                phone,
                last_message: messageText,
                last_message_at: new Date().toISOString(),
                is_bot_paused: false,
                unread_count: 0
            })
            .select()
            .single();

        conversation = newConv;
    } else {
        await supabase
            .from('whatsapp_conversations')
            .update({
                last_message: messageText,
                last_message_at: new Date().toISOString()
            })
            .eq('id', conversation.id);
    }

    // Salvar mensagem
    await supabase
        .from('whatsapp_messages')
        .insert({
            conversation_id: conversation?.id,
            phone,
            message_text: messageText,
            is_from_me: isFromMe,
            timestamp: new Date().toISOString()
        });
};

/**
 * 📦 Cria pedido na tabela 'orders' e envia webhook
 */
const createOrder = async (restaurantId: string, phone: string, orderData: any) => {
    try {
        // Buscar ou criar cliente
        let { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', phone)
            .eq('restaurant_id', restaurantId)
            .single();

        if (!customer) {
            const { data: newCustomer } = await supabase
                .from('customers')
                .insert({
                    restaurant_id: restaurantId,
                    name: orderData.customer_name,
                    phone: phone,
                    address: orderData.delivery_address
                })
                .select()
                .single();

            customer = newCustomer;
        }

        // Calcular total
        const itemsTotal = orderData.items.reduce(
            (sum: number, item: any) => sum + (item.price * item.quantity),
            0
        );

        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('delivery_fee')
            .eq('id', restaurantId)
            .single();

        const total = itemsTotal + (restaurant?.delivery_fee || 0);

        // Criar pedido
        const { data: order, error } = await supabase
            .from('orders')
            .insert({
                restaurant_id: restaurantId,
                customer_id: customer?.id,
                customer_name: orderData.customer_name,
                customer_phone: phone,
                delivery_address: orderData.delivery_address,
                status: 'PENDING', // 🟢 Corrigindo para PENDING (String que você informou)
                total: total,
                payment_method: orderData.payment_method,
                items: orderData.items,
                origin: 'whatsapp',
                notes: orderData.notes
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar pedido:', error);
            return;
        }

        console.log('✅ Pedido criado:', order);

        // Enviar webhook para n8n (se configurado)
        const { data: restaurantData } = await supabase
            .from('restaurants')
            .select('webhook_url')
            .eq('id', restaurantId)
            .single();

        if (restaurantData?.webhook_url) {
            await fetch(restaurantData.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order })
            });
        }

    } catch (error) {
        console.error('❌ Erro ao criar pedido:', error);
    }
};

export default {
    processWhatsAppMessage
};