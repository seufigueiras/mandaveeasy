import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import 'dotenv/config'; 

const app = express();

// --- CONFIGURAÇÕES DO SISTEMA --- 
const supabaseUrl = process.env.SUPABASE_URL || 'https://lhhasjzlsbmhaxhvaipw.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoaGFzanpsc2JtaGF4aHZhaXB3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA3NDAxMSwiZXhwIjoyMDgwNjUwMDExfQ.60tU_BnRACKcTXjAU9tdsR-DeBug9l5SZQivVGcu160';
const supabase = createClient(supabaseUrl, supabaseKey);

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://cantinhodabere-evolution-api.3xdxtv.easypanel.host';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'testa';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBU_-SIdVKXPuRgrW65zBsHZ-MHVYCykb8'; 
const RESTAURANT_ID = process.env.RESTAURANT_ID || '00000000-0000-0000-0000-000000000001';

const COMMAND_RESET = '#NEYREVISAO'; 
const PASSWORD_RESET = 'Diney2594'; 
const STATE_WAITING_PASS = 'WAITING_FOR_PASSWORD_NEYREVISAO';
const STATE_IDLE = 'IDLE';
const STATE_ORDER_CREATED = 'ORDER_CREATED';

const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
];

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Mandavenovo - API do WhatsApp',
        message: 'O backend está ativo e aguardando webhooks da Evolution API.'
    });
});

async function buscarCardapio() {
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

async function buscarConfiguracoes() {
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

        return restaurant;
    } catch (error) {
        console.error('❌ Erro ao buscar configurações:', error);
        return null;
    }
}

function verificarHorarioFuncionamento(openingHours) {
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

async function logBotMessage(conversationId, phone, messageText) {
    await supabase
        .from('whatsapp_messages')
        .insert({
            conversation_id: conversationId,
            phone: phone,
            message_text: messageText,
            is_from_me: true,
        });
}

async function resetConversation(conversationId, phone) {
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

async function baixarAudioWhatsApp(messageId) {
    try {
        console.log('🎤 Baixando áudio da Evolution API...');
        
        const response = await fetch(
            `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY,
                },
                body: JSON.stringify({
                    message: { key: { id: messageId } },
                    convertToMp4: false
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erro ao baixar mídia:', errorText);
            return null;
        }

        const data = await response.json();
        
        if (data.base64) {
            console.log('✅ Áudio baixado com sucesso!');
            return data.base64;
        }

        return null;
    } catch (error) {
        console.error('❌ Erro ao baixar áudio:', error);
        return null;
    }
}

async function transcreverAudio(base64Audio, mimeType = 'audio/ogg') {
    try {
        console.log('🎤 Transcrevendo áudio com Gemini...');

        let ultimoErro = null;

        for (const modelo of GEMINI_MODELS) {
            try {
                console.log(`🧪 Tentando transcrição com modelo: ${modelo}`);
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;

                const requestBody = {
                    contents: [
                        {
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64Audio
                                    }
                                },
                                {
                                    text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto falado, sem comentários.'
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 2048,
                    }
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ Erro com ${modelo}:`, response.status, errorText);
                    
                    if (response.status === 429) {
                        ultimoErro = new Error(`Quota excedida: ${modelo}`);
                        continue;
                    }
                                
                    ultimoErro = new Error(`HTTP ${response.status}: ${errorText}`);
                    continue;
                }

                const data = await response.json();

                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    const transcricao = data.candidates[0].content.parts[0].text;
                    console.log(`✅ Áudio transcrito com sucesso usando: ${modelo}`);
                    return transcricao.trim();
                }

                throw new Error('Resposta inválida do Gemini');

            } catch (erro) {
                console.error(`❌ Falha com ${modelo}:`, erro.message);
                ultimoErro = erro;
                continue;
            }
        }

        console.error('❌ TODOS OS MODELOS DE ÁUDIO FALHARAM!');
        throw ultimoErro || new Error('Nenhum modelo de áudio disponível');

    } catch (error) {
        console.error('❌ Erro ao transcrever áudio:', error);
        return null;
    }
}

async function gerarRespostaIA(mensagemCliente, telefone, config) {
    try {
        console.log('🤖 Gerando resposta com IA...');

        const { data: conversationData } = await supabase
            .from('whatsapp_conversations')
            .select('id, internal_state') 
            .eq('phone', telefone)
            .eq('restaurant_id', RESTAURANT_ID)
            .single();

        if (conversationData && conversationData.internal_state === STATE_ORDER_CREATED) {
            console.log('🔁 Pedido anterior finalizado. Resetando para IDLE.');
            await supabase
                .from('whatsapp_conversations')
                .update({ internal_state: STATE_IDLE })
                .eq('id', conversationData.id);
        }

        let historicoMensagens = [];
        if (conversationData) {
            const { data: messages } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .eq('conversation_id', conversationData.id)
                .order('timestamp', { ascending: true })
                .limit(50);

            historicoMensagens = (messages || []).map(msg => ({
                role: msg.is_from_me ? 'model' : 'user',
                parts: [{ text: msg.message_text }]
            }));
        }

        const { cardapioVisivel, cardapioInterno } = await buscarCardapio();

        const dataAtual = new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const horarioTexto = config.opening_hours && config.opening_hours.length > 0
            ? config.opening_hours.map(h => `${h.day}: ${h.is_open ? `${h.open_time} às ${h.close_time}` : 'FECHADO'}`).join('\n')
            : 'Não configurado';
            
        const nomeRestaurante = config.name || 'nossa lanchonete';
        const enderecoRestaurante = config.address || 'Não configurado';
        const telefoneRestaurante = config.phone || 'Não configurado';
        const taxaEntrega = (config.delivery_fee || 0).toFixed(2);
        const tempoEntrega = config.delivery_time || '30-40 minutos';
        const instrucoesAdicionais = config.bot_instructions || '';
        
        const systemInstructionText = `Você é ${config.bot_name || 'a Assistente Virtual'} do restaurante ${nomeRestaurante}. Seu papel é atender o cliente, conduzir a venda e processar o pedido.

📅 DATA E HORA ATUAL: ${dataAtual}

## ℹ️ INFORMAÇÕES DO RESTAURANTE:
- Nome: ${nomeRestaurante}
- Endereço: ${enderecoRestaurante}
- Telefone: ${telefoneRestaurante}
- Taxa de entrega: R$ ${taxaEntrega}
- Tempo médio de entrega: ${tempoEntrega}

${cardapioVisivel}

${cardapioInterno}

## 🕐 HORÁRIO DE FUNCIONAMENTO:
${horarioTexto}

## 🎯 SUAS RESPONSABILIDADES (LEIA COM ATENÇÃO):

1. **NOME DO RESTAURANTE**: O nome é **${nomeRestaurante}**. Você deve se apresentar e se referir APENAS a este nome.

2. **FLUXO DE CONVERSA - CRÍTICO**:
   - Saudação APENAS na primeira mensagem
   - NUNCA repita perguntas já respondidas
   - Mantenha o contexto da conversa sempre

3. **FINALIZAÇÃO DE PEDIDO - REGRA MAIS IMPORTANTE**:
   🚨 ATENÇÃO MÁXIMA AQUI:
   - Quando você mostrar o resumo do pedido com todos os dados (itens, endereço, nome, pagamento, total)
   - E perguntar "Está tudo correto?" ou "Confirma o pedido?"
   - Se o cliente responder: "SIM", "OK", "CONFIRMO", "ISSO", "CORRETO", "PODE FAZER", ou qualquer variação afirmativa
   - Você DEVE IMEDIATAMENTE FINALIZAR O PEDIDO gerando o JSON
   - NÃO pergunte novamente
   - NÃO repita o resumo
   - NÃO peça mais confirmações
   - FINALIZE IMEDIATAMENTE COM O JSON

4. **TRATAMENTO DE CONTEXTO CURTO**:
   - "Sim" ou "Não" se refere APENAS à sua última pergunta
   - Se perguntou "Quer observação?" e cliente disse "Não", continue o pedido normalmente
   - "Não" em observação NÃO cancela o pedido

5. **FLUXO DE VENDA**:
   - Seja amigável e educado
   - Mostre o cardápio (sem IDs)
   - Anote quantidade e observações
   - Colete: Nome, Endereço completo, Forma de Pagamento
   - Calcule o total (itens + taxa de R$ ${taxaEntrega})
   - Mostre o resumo APENAS UMA VEZ
   - Quando cliente confirmar, FINALIZE IMEDIATAMENTE

6. **FORMATO DE FINALIZAÇÃO**:
   Quando o cliente confirmar o pedido, responda assim:

   Excelente! Seu pedido foi confirmado com sucesso! 🎉

   Pedido #[NUMERO_DO_PEDIDO]

   Resumo:
   - Itens: [liste os itens]
   - Total: R$ [valor]
   - Endereço: [endereço]
   - Pagamento: [forma]

   Seu pedido será entregue em aproximadamente ${tempoEntrega}.
   Obrigado pela preferência! 😊

   \`\`\`json
   {
       "action": "create_order",
       "data": {
           "customer_name": "Nome do Cliente",
           "customer_phone": "${telefone}",
           "delivery_address": "Endereço Completo",
           "payment_method": "pix",
           "items": [
               { "product_id": "id-do-produto", "name": "Nome Produto", "quantity": 1, "price": 10.00, "notes": "" }
           ],
           "notes": "Observações gerais do pedido"
       }
   }
   \`\`\`

${instrucoesAdicionais ? `\n## 📝 INSTRUÇÕES ADICIONAIS:\n${instrucoesAdicionais}\n` : ''}

🗣️ Responda sempre em português brasileiro!

⚠️ LEMBRE-SE: Quando o cliente confirmar o pedido após ver o resumo, FINALIZE IMEDIATAMENTE! Não pergunte novamente!`;


        const requestBody = {
            systemInstruction: {
                parts: [
                    { text: systemInstructionText }
                ]
            },
            contents: [
                ...historicoMensagens,
                { role: 'user', parts: [{ text: mensagemCliente }] }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
                topP: 0.95,
                topK: 40
            }
        };

        let ultimoErro = null;
        
        for (const modelo of GEMINI_MODELS) {
            try {
                console.log(`🧪 Tentando modelo: ${modelo}`);
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`; 

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ Erro com ${modelo}:`, response.status, errorText);
                    
                    if (response.status === 429) {
                        ultimoErro = new Error(`Quota excedida: ${modelo}`);
                        continue;
                    }
                    ultimoErro = new Error(`HTTP ${response.status}: ${errorText}`);
                    continue;
                }

                const data = await response.json();

                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    const resposta = data.candidates[0].content.parts[0].text;
                    console.log(`✅ Resposta gerada com sucesso usando: ${modelo}`);
                    console.log(`📢 CONTEÚDO BRUTO DA RESPOSTA DA IA:\n--- START ---\n${resposta}\n--- END ---`);
                    
                    return resposta;
                }
                throw new Error('Resposta inválida do Gemini');
            } catch (erro) {
                console.error(`❌ Falha com ${modelo}:`, erro.message);
                ultimoErro = erro;
                continue;
            }
        }

        console.error('❌ TODOS OS MODELOS FALHARAM!');
        throw ultimoErro || new Error('Nenhum modelo disponível');

    } catch (error) {
        console.error('❌ Erro ao gerar resposta:', error);
        const fallbackName = config?.name || 'nossa lanchonete';
        return `Olá! 👋 Bem-vindo ao ${fallbackName}! 😊\n\nEstou com uma dificuldade técnica no momento, mas já vou te atender!`;
    }
}

async function enviarMensagemWhatsApp(jidCompleto, mensagem) {
    try {
        console.log('📤 Enviando mensagem via Evolution...');
        console.log(`📞 JID de envio: ${jidCompleto}`);
        
        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
                number: jidCompleto, 
                text: mensagem,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('❌ Resposta de erro da Evolution:', errorBody);
            throw new Error(`Erro Evolution: ${response.status}`);
        }

        console.log('✅ Mensagem enviada com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        return false;
    }
}

async function notificarNovoPedido(pedidoId, dadosPedido) {
    try {
        console.log('🔔 Enviando notificação de novo pedido...');
        
        await supabase
            .from('notifications')
            .insert({
                restaurant_id: RESTAURANT_ID,
                type: 'new_order',
                title: 'Novo Pedido Recebido!',
                message: `Pedido #${pedidoId} - ${dadosPedido.customer_name} - R$ ${dadosPedido.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}`,
                order_id: pedidoId,
                is_read: false,
                created_at: new Date().toISOString()
            });
        
        console.log('✅ Notificação criada com sucesso!');
        return true;
    } catch (error) {
        console.error('⚠️ Erro ao criar notificação (tabela pode não existir):', error.message);
        return true;
    }
}

async function criarPedido(telefone, dadosPedido) {
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
        
        await notificarNovoPedido(order.id, dadosPedido);
        
        return order.id;
    } catch (error) {
        console.error('❌ Erro ao criar pedido:', error);
        return false;
    }
}

function extrairDadosPedido(respostaIA) {
    try {
        const jsonMatch = respostaIA.match(/```json\s*(\{[\s\S]*?\})\s*```/); 
        
        if (jsonMatch) {
            const jsonString = jsonMatch[1];
            const cleanedJsonString = jsonString.trim(); 
            const jsonData = JSON.parse(cleanedJsonString);

            if (jsonData.action === 'create_order' && jsonData.data) {
                console.log('📦 Dados do pedido extraídos com sucesso!');
                return jsonData.data;
            }
        }
        
        const fallbackMatch = respostaIA.match(/\{[\s\S]*?"action"\s*:\s*"create_order"[\s\S]*?\}/);

        if (fallbackMatch) {
            const jsonString = fallbackMatch[0];
            const cleanedJsonString = jsonString.trim(); 
            const jsonData = JSON.parse(cleanedJsonString);

            if (jsonData.action === 'create_order' && jsonData.data) {
                console.log('📦 Dados do pedido (Fallback) extraídos com sucesso!');
                return jsonData.data;
            }
        }
        return null;
    } catch (error) {
        console.error('❌ Erro ao extrair dados do pedido:', error);
        return null;
    }
}

app.post(['/api/whatsapp-webhook', '/api/webhook/messages', '/api/whatsapp-webhook/messages-upsert'], async (req, res) => {
    try {
        console.log('\n📱 ====================================');
        console.log('📱 WEBHOOK RECEBIDO DA EVOLUTION');
        console.log('📱 ====================================');

        const { event, data } = req.body;

        if (event === 'messages.upsert') {
            const message = data;

            if (message && message.key && !message.key.fromMe) {
                
                let remoteJid = message.key.remoteJid;
                let phone;
                let jidParaEnvio = remoteJid;

                if (remoteJid.endsWith('@g.us')) {
                    console.log('🤖 Mensagem de grupo ignorada.');
                    return res.status(200).json({ success: true, message: 'Ignored group message' });
                }

                phone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '').trim();

                if (remoteJid.endsWith('@lid')) {
                    console.log(`⚠️ LID detectado. JID original para envio: ${jidParaEnvio}`);
                    const senderJid = message.key.sender;
                    if (senderJid && senderJid.endsWith('@s.whatsapp.net')) {
                        phone = senderJid.replace('@s.whatsapp.net', '').trim();
                        console.log(`✅ JID real encontrado em 'sender'. Usando ${phone} para o Supabase.`);
                    }
                } else {
                    jidParaEnvio = `${phone}@s.whatsapp.net`;
                }
                
                if (!phone || phone.length < 10) {
                    console.error('❌ Número de telefone inválido ou ausente após tratamento:', phone);
                    return res.status(200).json({ success: true, message: 'Invalid phone number' });
                }

                let messageText = null;

                const audioMessage = message.message?.audioMessage || 
                                     message.message?.ptt || 
                                     message.audioMessage;

                if (audioMessage) {
                    console.log('🎤 ÁUDIO DETECTADO!');
                    const audioBase64 = await baixarAudioWhatsApp(message.key.id);
                    
                    if (audioBase64) {
                        const mimeType = audioMessage.mimetype || 'audio/ogg; codecs=opus';
                        const transcricao = await transcreverAudio(audioBase64, mimeType);
                        
                        if (transcricao) { 
                            messageText = transcricao;
                            console.log('📝 Transcrição bem-sucedida:', transcricao);
                        } else {
                            messageText = '[Áudio não pôde ser transcrito]';
                        }
                    } else {
                        messageText = '[Erro ao baixar áudio]';
                    }
                } else {
                    messageText = message.message?.conversation ||
                                   message.message?.extendedTextMessage?.text ||
                                   '[Mídia não suportada]';
                }

                console.log(`📩 ${phone}: ${messageText}`);

                const config = await buscarConfiguracoes();

                if (!config) {
                    console.error('❌ Configurações do restaurante não encontradas');
                    res.status(200).json({ success: false, error: 'Configurações não encontradas' });
                    
                    const fallbackError = 'Olá! Recebemos sua mensagem, mas nosso sistema de pedidos está temporariamente fora do ar. Por favor, tente novamente em alguns minutos!';
                    await enviarMensagemWhatsApp(jidParaEnvio, fallbackError); 
                    return;
                }

                let { data: conversation } = await supabase
                    .from('whatsapp_conversations')
                    .select('*')
                    .eq('phone', phone) 
                    .eq('restaurant_id', RESTAURANT_ID)
                    .single();

                const updateData = {
                    last_message: messageText,
                    last_message_at: new Date().toISOString(),
                    unread_count: (conversation?.unread_count || 0) + 1,
                    internal_state: conversation?.internal_state || STATE_IDLE, 
                };

                if (!conversation) {
                    console.log('🆕 Nova conversa criada');
                    const { data: newConv } = await supabase
                        .from('whatsapp_conversations')
                        .insert({
                            restaurant_id: RESTAURANT_ID,
                            phone: phone,
                            contact_name: message.pushName || phone,
                            ...updateData,
                            unread_count: 1, 
                            is_bot_paused: false,
                            internal_state: STATE_IDLE,
                        })
                        .select()
                        .single();
                    conversation = newConv;
                } else {
                    await supabase
                        .from('whatsapp_conversations')
                        .update(updateData)
                        .eq('id', conversation.id);
                }

                conversation = { ...conversation, ...updateData };

                if (conversation) {
                    await supabase
                        .from('whatsapp_messages')
                        .insert({
                            conversation_id: conversation.id,
                            phone: phone,
                            message_text: messageText,
                            is_from_me: false,
                        });
                }

                const currentInternalState = conversation.internal_state || STATE_IDLE;

                if (messageText.toUpperCase().trim() === COMMAND_RESET) {
                    await supabase
                        .from('whatsapp_conversations')
                        .update({ internal_state: STATE_WAITING_PASS })
                        .eq('id', conversation.id);
                    
                    const responseText = "🤖 **[Modo Manutenção]** Confirme sua identidade para reiniciar. Por favor, digite a senha de acesso:";
                    await enviarMensagemWhatsApp(jidParaEnvio, responseText); 
                    await logBotMessage(conversation.id, phone, responseText);
                    
                    console.log(`🛠️ Entrou no modo ${COMMAND_RESET}. Aguardando senha.`);
                    return res.status(200).json({ success: true, message: 'Waiting for password' });
                }

                if (currentInternalState === STATE_WAITING_PASS) {
                    if (messageText.trim() === PASSWORD_RESET) {
                        await resetConversation(conversation.id, phone);
                        
                        const responseText = "✅ **[Modo Manutenção]** Acesso concedido. A conversa foi reiniciada com sucesso. A IA começará do zero na próxima mensagem.";
                        await enviarMensagemWhatsApp(jidParaEnvio, responseText); 
                        await logBotMessage(conversation.id, phone, responseText);
                        
                        console.log(`✅ Senha correta. Conversa de ${phone} reiniciada.`);
                        return res.status(200).json({ success: true, message: 'Conversation reset' });
                    } else {
                        await supabase
                            .from('whatsapp_conversations')
                            .update({ internal_state: STATE_IDLE })
                            .eq('id', conversation.id);

                        const responseText = "❌ **[Modo Manutenção]** Senha incorreta. Acesso negado. O bot foi retomado normalmente.";
                        await enviarMensagemWhatsApp(jidParaEnvio, responseText); 
                        await logBotMessage(conversation.id, phone, responseText);
                        
                        console.log(`❌ Senha incorreta. Retornando ao modo IDLE.`);
                        return res.status(200).json({ success: true, message: 'Password failed' });
                    }
                }

                if (conversation.is_bot_paused) {
                    console.log('⏸️ Bot pausado para esta conversa');
                    res.status(200).json({ success: true, message: 'Bot pausado' });
                    return;
                }

                if (!verificarHorarioFuncionamento(config.opening_hours)) {
                    const horarioTexto = config.opening_hours
                        .filter(h => h.is_open)
                        .map(h => `${h.day}: ${h.open_time} às ${h.close_time}`)
                        .join('\n');
                    const mensagemFechado = `Olá! 👋\n\nObrigado por entrar em contato com ${config.name}!\n\n🕐 No momento estamos fechados.\n\nNosso horário de funcionamento:\n${horarioTexto}\n\nVolte nesse horário que ficaremos felizes em atendê-lo! 😊`;
                    await enviarMensagemWhatsApp(jidParaEnvio, mensagemFechado); 
                    await logBotMessage(conversation.id, phone, mensagemFechado); 
                    return res.status(200).json({ success: true, message: 'Fora do horário de funcionamento' });
                }

                let respostaIA = await gerarRespostaIA(messageText, phone, config);

                if (respostaIA) {
                    const dadosPedido = extrairDadosPedido(respostaIA);
                    let textoResposta = respostaIA.replace(/```json[\s\S]*?```/, '').trim(); 
                    let pedidoCriado = false;

                    if (dadosPedido) {
                        const pedidoId = await criarPedido(phone, dadosPedido);

                        if (pedidoId) {
                            pedidoCriado = true;
                            console.log(`🔄 Substituindo [NUMERO_DO_PEDIDO] por ${pedidoId}`);
                            
                            textoResposta = textoResposta.replace(/\[NUMERO_DO_PEDIDO\]/g, `${pedidoId}`);
                            
                            console.log('\n🎊 ================================');
                            console.log(`🎉 PEDIDO #${pedidoId} CONFIRMADO!`);
                            console.log(`📱 Cliente: ${dadosPedido.customer_name} (${phone})`);
                            console.log(`📍 Endereço: ${dadosPedido.delivery_address}`);
                            console.log(`💰 Valor Total: R$ ${dadosPedido.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}`);
                            console.log('🎊 ================================\n');
                        } else {
                            console.error('❌ Falha ao criar pedido no banco. Mantendo mensagem original da IA.');
                            textoResposta = textoResposta.replace(/\[NUMERO_DO_PEDIDO\]/g, 'em processamento');
                        }

                        await enviarMensagemWhatsApp(jidParaEnvio, textoResposta); 
                        await logBotMessage(conversation.id, phone, textoResposta);

                        if (pedidoCriado) {
                            await supabase
                                .from('whatsapp_conversations')
                                .update({ internal_state: STATE_ORDER_CREATED })
                                .eq('id', conversation.id);
                        }
                    } else {
                        await enviarMensagemWhatsApp(jidParaEnvio, textoResposta); 
                        await logBotMessage(conversation.id, phone, textoResposta);
                    }
                }

                res.status(200).json({ success: true, message: 'Message processed' });
                
            } else {
                res.status(200).json({ success: true, message: 'Ignored message' });
            }
        } else if (event === 'connection.update') {
            console.log(`📡 Status da Evolution: ${data.state}`);
            res.status(200).json({ success: true, message: 'Status update received' });
        } else {
            res.status(200).json({ success: true, message: 'Ignored event' });
        }
    } catch (error) {
        console.error('❌ Erro inesperado no webhook:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.listen(3002, () => {
    console.log('🚀 ===================================');
    console.log('🤖 Backend Mandavenovo ONLINE!');
    console.log('🌐 Porta: 3002');
    console.log('📱 Aguardando webhooks da Evolution API');
    console.log('🚀 ===================================\n');
});