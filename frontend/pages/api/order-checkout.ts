// pages/api/order-checkout.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../services/supabaseClient'; // Importa o Supabase
import { sendEventToN8n } from '../../services/n8nService'; // Importa a função corrigida

// Tipos de dados (simplificados)
interface OrderItem {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
}

interface OrderPayload {
    restaurant_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string | null;
    order_type: 'DELIVERY' | 'PICKUP';
    total: number;
    payment_method: string;
    items: OrderItem[];
    origin: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 1. Apenas aceitar requisições POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const payload: OrderPayload = req.body;
    
    // Validação básica
    if (!payload.restaurant_id || !payload.total || payload.items.length === 0) {
        return res.status(400).json({ error: 'Dados do pedido incompletos.' });
    }

    try {
        // 2. INSERIR O PEDIDO PRINCIPAL NA TABELA 'orders'
        const orderData = {
            restaurant_id: payload.restaurant_id,
            status: 'PENDING', // O status inicial é PENDING
            total: payload.total,
            customer_name: payload.customer_name,
            customer_phone: payload.customer_phone,
            customer_address: payload.customer_address,
            order_type: payload.order_type,
            payment_method: payload.payment_method,
            origin: payload.origin,
            // created_at é setado automaticamente pelo Supabase
        };

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert(orderData)
            .select('id')
            .single();

        if (orderError || !order) {
            console.error("Erro ao salvar pedido principal:", orderError);
            throw new Error('Falha ao salvar o pedido principal no banco de dados.');
        }

        const newOrderId = order.id;

        // 3. INSERIR OS ITENS DO PEDIDO NA TABELA 'order_items'
        const itemsToInsert = payload.items.map(item => ({
            order_id: newOrderId,
            product_id: item.product_id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsToInsert);

        if (itemsError) {
            console.error("Erro ao salvar itens do pedido:", itemsError);
            // Aviso: O pedido principal foi salvo, mas os itens não.
        }

        // 4. DISPARAR O WEBHOOK PARA O N8N
        try {
             const n8nPayload = {
                order_id: newOrderId,
                restaurant_id: payload.restaurant_id,
                customer_name: payload.customer_name,
                customer_phone: payload.customer_phone,
                total: payload.total,
                order_type: payload.order_type,
                payment_method: payload.payment_method,
                items: payload.items, // Itens para o n8n formatar a mensagem
                created_at: new Date().toISOString()
            };
            
            // 🟢 AQUI CHAMAMOS SUA FUNÇÃO, enviando o evento 'newOrder'
            await sendEventToN8n('newOrder', n8nPayload); 
            
        } catch (n8nError) {
            console.warn("Aviso: Falha ao disparar evento para o n8n. O pedido foi salvo, mas o robô não foi notificado.", n8nError);
            // Mantemos o sucesso, pois o dado está no DB.
        }

        // 5. RESPOSTA DE SUCESSO PARA O FRONTEND
        res.status(201).json({ 
            success: true, 
            message: 'Pedido criado com sucesso.', 
            order_id: newOrderId 
        });

    } catch (error) {
        console.error('Erro na API de Checkout:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Erro interno do servidor ao processar o pedido.' });
    }
}