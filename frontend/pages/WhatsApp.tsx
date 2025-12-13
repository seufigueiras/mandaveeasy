// pages/WhatsApp.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { MessageCircle, Send, Pause, Play, Power, Bot, User, Clock } from 'lucide-react';
import { sendWhatsAppMessage } from '../services/evolutionService';

interface Conversation {
    id: string;
    phone: string;
    contact_name: string;
    last_message: string;
    last_message_at: string;
    is_bot_paused: boolean;
    unread_count: number;
}

interface Message {
    id: string;
    message_text: string;
    is_from_me: boolean;
    timestamp: string;
}

const WhatsApp: React.FC = () => {
    const { restaurantId } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isBotPausedGlobal, setIsBotPausedGlobal] = useState(false);
    const [isTogglingBot, setIsTogglingBot] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (restaurantId) {
            console.log('🔑 Restaurant ID:', restaurantId);
            fetchConversations();
            fetchBotStatus();
            
            // Atualizar conversas a cada 5 segundos
            const interval = setInterval(() => {
                fetchConversations();
                if (selectedConversation) {
                    fetchMessages(selectedConversation.id);
                }
            }, 5000);

            return () => clearInterval(interval);
        }
    }, [restaurantId, selectedConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchBotStatus = async () => {
        const { data } = await supabase
            .from('restaurants')
            .select('is_bot_paused')
            .eq('id', restaurantId)
            .single();

        if (data) {
            setIsBotPausedGlobal(data.is_bot_paused || false);
        }
    };

    const fetchConversations = async () => {
        console.log('📞 Buscando conversas para restaurant_id:', restaurantId);
        
        const { data, error } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('last_message_at', { ascending: false });

        if (error) {
            console.error('❌ Erro ao buscar conversas:', error);
            return;
        }

        console.log('✅ Conversas encontradas:', data?.length || 0);
        setConversations(data || []);
    };

    const fetchMessages = async (conversationId: string) => {
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('timestamp', { ascending: true });

        if (error) {
            console.error('Erro ao buscar mensagens:', error);
            return;
        }

        setMessages(data || []);

        // Marcar como lida
        await supabase
            .from('whatsapp_conversations')
            .update({ unread_count: 0 })
            .eq('id', conversationId);
    };

    const handleSelectConversation = (conversation: Conversation) => {
        setSelectedConversation(conversation);
        fetchMessages(conversation.id);
    };

    const handleSendMessage = async () => {
        if (!messageText.trim() || !selectedConversation) return;

        setIsSending(true);

        try {
            // 1. Enviar mensagem via Evolution API
            console.log('📤 Enviando mensagem via Evolution...');
            await sendWhatsAppMessage({
                phone: selectedConversation.phone,
                message: messageText,
            });

            // 2. Salvar mensagem no banco
            const { error: msgError } = await supabase
                .from('whatsapp_messages')
                .insert({
                    conversation_id: selectedConversation.id,
                    phone: selectedConversation.phone,
                    message_text: messageText,
                    is_from_me: true,
                });

            if (msgError) throw msgError;

            // 3. Atualizar última mensagem da conversa
            await supabase
                .from('whatsapp_conversations')
                .update({
                    last_message: messageText,
                    last_message_at: new Date().toISOString(),
                })
                .eq('id', selectedConversation.id);

            // 4. Limpar input e atualizar UI
            setMessageText('');
            fetchMessages(selectedConversation.id);
            toast.success('✅ Mensagem enviada!');

        } catch (error: any) {
            console.error('❌ Erro ao enviar mensagem:', error);
            toast.error('❌ Erro ao enviar: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsSending(false);
        }
    };

    const toggleBotGlobal = async () => {
        setIsTogglingBot(true);
        const newStatus = !isBotPausedGlobal;

        const { error } = await supabase
            .from('restaurants')
            .update({ is_bot_paused: newStatus })
            .eq('id', restaurantId);

        if (error) {
            toast.error('Erro ao alterar status do bot');
            console.error(error);
        } else {
            setIsBotPausedGlobal(newStatus);
            toast.success(newStatus ? 'Bot pausado globalmente' : 'Bot reativado globalmente');
        }

        setIsTogglingBot(false);
    };

    const toggleBotForConversation = async (conversationId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;

        const { error } = await supabase
            .from('whatsapp_conversations')
            .update({ is_bot_paused: newStatus })
            .eq('id', conversationId);

        if (error) {
            toast.error('Erro ao alterar status do bot');
            console.error(error);
        } else {
            toast.success(newStatus ? 'Bot pausado nesta conversa' : 'Bot reativado nesta conversa');
            fetchConversations();
            
            if (selectedConversation?.id === conversationId) {
                setSelectedConversation({ ...selectedConversation, is_bot_paused: newStatus });
            }
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Hoje';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Ontem';
        } else {
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }
    };

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <MessageCircle size={32} />
                    WhatsApp Monitor
                </h1>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg">
                        <Bot size={20} className={isBotPausedGlobal ? 'text-red-500' : 'text-green-500'} />
                        <span className="text-sm font-medium">
                            Bot: {isBotPausedGlobal ? 'Pausado' : 'Ativo'}
                        </span>
                    </div>

                    <Button
                        onClick={toggleBotGlobal}
                        isLoading={isTogglingBot}
                        className={`flex items-center gap-2 ${
                            isBotPausedGlobal
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {isBotPausedGlobal ? (
                            <>
                                <Play size={16} /> Reativar Bot
                            </>
                        ) : (
                            <>
                                <Pause size={16} /> Pausar Bot
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 flex-1 overflow-hidden">
                {/* Lista de Conversas */}
                <Card className="col-span-1 flex flex-col overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-lg">Conversas ({conversations.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-0">
                        {conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4">
                                <MessageCircle size={48} className="mb-2" />
                                <p className="text-sm text-center">
                                    Nenhuma conversa ainda.
                                    <br />
                                    Envie uma mensagem de teste!
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {conversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        onClick={() => handleSelectConversation(conv)}
                                        className={`p-4 cursor-pointer hover:bg-slate-50 transition ${
                                            selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-sm truncate">
                                                        {conv.contact_name || conv.phone}
                                                    </h3>
                                                    {conv.is_bot_paused && (
                                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                                            Bot Off
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mb-1">
                                                    {conv.phone}
                                                </p>
                                                <p className="text-sm text-slate-600 truncate">
                                                    {conv.last_message}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end ml-2">
                                                <span className="text-xs text-slate-500 mb-1">
                                                    {formatDate(conv.last_message_at)}
                                                </span>
                                                {conv.unread_count > 0 && (
                                                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                                                        {conv.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Área de Mensagens */}
                <Card className="col-span-2 flex flex-col overflow-hidden">
                    {selectedConversation ? (
                        <>
                            <CardHeader className="border-b">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg">
                                            {selectedConversation.contact_name || selectedConversation.phone}
                                        </CardTitle>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {selectedConversation.phone}
                                        </p>
                                    </div>
                                    <Button
                                        onClick={() =>
                                            toggleBotForConversation(
                                                selectedConversation.id,
                                                selectedConversation.is_bot_paused
                                            )
                                        }
                                        size="sm"
                                        variant={selectedConversation.is_bot_paused ? 'default' : 'danger'}
                                        className="flex items-center gap-2"
                                    >
                                        {selectedConversation.is_bot_paused ? (
                                            <>
                                                <Play size={14} /> Reativar Bot
                                            </>
                                        ) : (
                                            <>
                                                <Pause size={14} /> Pausar Bot
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 overflow-y-auto p-4 bg-slate-50">
                                {messages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-slate-400">
                                        <p>Nenhuma mensagem ainda</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${
                                                    msg.is_from_me ? 'justify-end' : 'justify-start'
                                                }`}
                                            >
                                                <div
                                                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                                        msg.is_from_me
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white text-slate-900 border'
                                                    }`}
                                                >
                                                    <p className="text-sm whitespace-pre-wrap">
                                                        {msg.message_text}
                                                    </p>
                                                    <div
                                                        className={`flex items-center gap-1 mt-1 text-xs ${
                                                            msg.is_from_me
                                                                ? 'text-blue-100'
                                                                : 'text-slate-500'
                                                        }`}
                                                    >
                                                        <Clock size={12} />
                                                        {formatTime(msg.timestamp)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </CardContent>

                            <div className="border-t p-4 bg-white">
                                <div className="flex gap-2">
                                    <Input
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Digite sua mensagem..."
                                        disabled={isSending}
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        isLoading={isSending}
                                        disabled={!messageText.trim()}
                                        className="flex items-center gap-2"
                                    >
                                        <Send size={16} /> Enviar
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <div className="text-center">
                                <MessageCircle size={64} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Selecione uma conversa</p>
                                <p className="text-sm mt-2">
                                    Escolha uma conversa à esquerda para visualizar as mensagens
                                </p>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default WhatsApp;