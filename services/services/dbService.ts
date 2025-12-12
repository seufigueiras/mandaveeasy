// services/dbService.ts
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // Garante que as variáveis de ambiente sejam carregadas

// --- CONFIGURAÇÕES DO SISTEMA ---
const supabaseUrl = process.env.SUPABASE_URL || 'https://lhhasjzlsbmhaxhvaipw.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoaGFzanpsc2JtaGF4aHZhaXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNzQwMTEsImV4cCI6MjA4MDY1MDAxMX0.xtfP1Sz_LeoRfimOKAAfFd8DNu_rUBYF1lpZWRnDVVac';
const RESTAURANT_ID = process.env.RESTAURANT_ID || '00000000-0000-0000-0000-000000000001';

export const supabase = createClient(supabaseUrl, supabaseKey);

// 🚨 CONSTANTES DE MANUTENÇÃO
export const STATE_WAITING_PASS = 'WAITING_FOR_PASSWORD_NEYREVISAO';
export const STATE_IDLE = 'IDLE';

// ========================================
// 🔧 FUNÇÕES DE BUSCA E LOG
// ========================================

/**
 * Busca e formata o cardápio ativo no Supabase.
 */
export async function buscarCardapio() {
    try {
        const { data: produtos, error } = await supabase
            .from('products')
            .select('*')
            .eq('restaurant_id', RESTAURANT_ID)
            .eq('is_active', true)
            .order('category', { ascending: true });

        if (error || !produtos || produtos.length === 0) {
            return { cardapioVisivel: '⚠️ Não há produtos cadastrados no momento.', cardapioInterno: '' };
        }

        const categorias = {};
        produtos.forEach(produto => {
            if (!categorias[produto.category]) categorias[produto.category] = [];
            categorias[produto.category].push(produto);
        });

        let cardapioVisivel = '## 📋 CARDÁPIO DISPONÍVEL:\n\n';
        let cardapioInterno = '\n## 🆔 MAPA DE PRODUTOS (NÃO MOSTRAR AO CLIENTE):\n';
        
        Object.keys(categorias).forEach(categoria => {
            cardapioVisivel += `### ${categoria}\n`;
            cardapioInterno += `\n### ${categoria} (IDs)\n`;
            
            categorias[categoria].forEach(p => {
                cardapioVisivel += `- **${p.name}** - R$ ${p.price.toFixed(2)}\n`;
                if (p.description) cardapioVisivel += `  _${p.description}_\n`;
                
                cardapioInterno += `- Nome: ${p.name} | ID: ${p.id} | Preço: ${p.price.toFixed(2)}\n`;
            });
            cardapioVisivel += '\n';
        });

        return { cardapioVisivel, cardapioInterno };
    } catch (error) {
        console.error('❌ Erro ao buscar cardápio:', error);
        return { cardapioVisivel: '⚠️ Erro ao carregar cardápio.', cardapioInterno: '' };
    }
}

/**
 * Busca as configurações do restaurante.
 */
export async function buscarConfiguracoes() {
    try {
        const { data: restaurant, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', RESTAURANT_ID)
            .single();

        if (error) {
            console.error('❌ Erro Supabase:', error.message);
            return null;
        }

        if (!restaurant) {
            return null;
        }

        return restaurant;
    } catch (error) {
        console.error('❌ Erro ao buscar configurações:', error);
        return null;
    }
}

/**
 * Loga uma mensagem enviada pelo bot.
 */
export async function logBotMessage(conversationId, phone, messageText) {
    await supabase
        .from('whatsapp_messages')
        .insert({
            conversation_id: conversationId,
            phone: phone,
            message_text: messageText,
            is_from_me: true,
        });
}

/**
 * Reinicia o estado de uma conversa.
 */
export async function resetConversation(conversationId, phone) {
    try {
        await supabase
            .from('whatsapp_messages')
            .delete()
            .eq('conversation_id', conversationId);

        await supabase
            .from('whatsapp_conversations')
            .update({
                internal_state: STATE_IDLE,
                last_message: '[Conversa Reiniciada]',
                unread_count: 0,
            })
            .eq('id', conversationId);

        console.log(`✅ Conversa ${conversationId} de ${phone} reiniciada com sucesso.`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao reiniciar conversa:', error);
        return false;
    }
}

/**
 * Cria um pedido na tabela 'orders' e atualiza/cria o cliente.
 */
export async function criarPedido(telefone, dadosPedido) {
    try {
        console.log('📦 Criando pedido no sistema...');

        let { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', telefone)
            .eq('restaurant_id', RESTAURANT_ID)
            .single();

        if (!customer) {
            const { data: newCustomer, error: customerError } = await supabase
                .from('customers')
                .insert({
                    restaurant_id: RESTAURANT_ID,
                    name: dadosPedido.customer_name,
                    phone: telefone,
                    address: dadosPedido.delivery_address 
                })
                .select()
                .single();
            
            if (customerError) {
                console.error('❌ Erro ao criar cliente:', customerError);
            }
            customer = newCustomer;
        }

        const itemsTotal = dadosPedido.items.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );

        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('delivery_fee')
            .eq('id', RESTAURANT_ID)
            .single();

        const total = itemsTotal + (restaurant?.delivery_fee || 0);

        const { data: order, error } = await supabase
            .from('orders')
            .insert({
                restaurant_id: RESTAURANT_ID,
                customer_id: customer?.id,
                customer_name: dadosPedido.customer_name,
                customer_phone: telefone,
                delivery_address: dadosPedido.delivery_address,
                status: 'PENDING',
                total: total,
                payment_method: dadosPedido.payment_method,
                items: dadosPedido.items, 
                origin: 'whatsapp',
                notes: dadosPedido.notes || ''
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Erro ao criar pedido:', error);
            return false;
        }

        console.log('✅ Pedido criado com sucesso:', order.id);
        return true;

    } catch (error) {
        console.error('❌ Erro ao criar pedido:', error);
        return false;
    }
}


// ========================================
// 🕒 FUNÇÃO DE HORÁRIO (Mantida no dbService)
// ========================================

export function verificarHorarioFuncionamento(openingHours) {
    if (!openingHours || openingHours.length === 0) return true;

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }); 
    const currentTime = now.toTimeString().slice(0, 5);

    const dayMap = {
        'Sunday': 'Domingo',
        'Monday': 'Segunda',
        'Tuesday': 'Terça',
        'Wednesday': 'Quarta',
        'Thursday': 'Quinta',
        'Friday': 'Sexta',
        'Saturday': 'Sábado',
    };

    const dayName = dayMap[currentDay]; 
    const todaySchedule = openingHours.find(h => h.day === dayName);

    if (!todaySchedule || !todaySchedule.is_open) {
        return false;
    }

    return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
}