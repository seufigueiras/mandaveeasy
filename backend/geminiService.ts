// services/geminiService.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

// 🔑 Chave da API Gemini
const GEMINI_API_KEY = 'AIzaSyDy0sX_xpT8okD2_xrHsGzs3T6IF-QNu6o';

if (!GEMINI_API_KEY || GEMINI_API_KEY === '') {
  console.warn('⚠️ GEMINI_API_KEY não configurada!');
}

// Inicializar o cliente Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ✅ MODELO CORRETO: gemini-2.0-flash-exp (mais estável e atual)
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
  }
});

interface Message {
  role: 'user' | 'model';
  parts: string;
}

/**
 * Envia uma mensagem para o Gemini com contexto de conversa
 */
export const sendMessageToGemini = async (
  userMessage: string,
  systemPrompt: string,
  conversationHistory: Message[] = []
): Promise<string> => {
  try {
    console.log('🤖 Enviando mensagem para Gemini...');
    console.log('📝 Contexto:', conversationHistory.length, 'mensagens anteriores');
    
    // Criar chat com histórico
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }]
        },
        {
          role: 'model',
          parts: [{ text: 'Entendido! Estou pronto para atender os clientes seguindo todas as instruções fornecidas. Vou consultar o cardápio, anotar pedidos completos, perguntar endereço e forma de pagamento, e criar o pedido no sistema quando confirmado.' }]
        },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.parts }]
        }))
      ],
    });

    // Enviar mensagem do usuário
    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    const text = response.text();

    console.log('✅ Resposta do Gemini recebida');
    return text;

  } catch (error) {
    console.error('❌ Erro ao chamar Gemini API:', error);
    console.error('❌ Stack:', error);
    throw new Error('Erro ao processar mensagem com IA');
  }
};

/**
 * Formata o histórico de mensagens para o Gemini
 */
export const formatConversationHistory = (
  messages: Array<{ message_text: string; is_from_me: boolean }>
): Message[] => {
  return messages.map(msg => ({
    role: msg.is_from_me ? 'model' : 'user',
    parts: msg.message_text
  }));
};

/**
 * Extrai dados do pedido da resposta do Gemini
 * Procura por JSON no formato: {"action": "create_order", "data": {...}}
 */
export const extractOrderData = (geminiResponse: string): any | null => {
  try {
    // Procurar por JSON na resposta (mais flexível)
    const jsonMatch = geminiResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                      geminiResponse.match(/\{[\s\S]*?"action"\s*:\s*"create_order"[\s\S]*?\}/);
    
    if (jsonMatch) {
      const jsonString = jsonMatch[1] || jsonMatch[0];
      const jsonData = JSON.parse(jsonString);
      
      if (jsonData.action === 'create_order' && jsonData.data) {
        console.log('📦 Pedido detectado:', jsonData.data);
        return jsonData.data;
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao extrair dados do pedido:', error);
    return null;
  }
};

export default {
  sendMessageToGemini,
  formatConversationHistory,
  extractOrderData
};