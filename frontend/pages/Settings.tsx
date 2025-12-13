// pages/Settings.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { QrCode, Smartphone, Save, Upload, X, RefreshCw, Power, Wifi, WifiOff, Bot, Clock } from 'lucide-react';
import { 
    checkConnectionStatus, 
    createInstanceAndGenerateQR,
    disconnectWhatsApp,
    monitorConnection,
    checkIfInstanceExists
} from '../services/whatsappApiService'; // <--- CORREÇÃO AQUI: Importa do novo arquivo do Frontend

type OpeningHour = {
    day: string;
    is_open: boolean;
    open_time: string;
    close_time: string;
};

const initialOpeningHours: OpeningHour[] = [
    { day: 'Segunda', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Terça', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Quarta', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Quinta', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Sexta', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Sábado', is_open: true, open_time: '12:00', close_time: '00:00' },
    { day: 'Domingo', is_open: false, open_time: '18:00', close_time: '23:00' },
];

const Settings: React.FC = () => {
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [isSavingHours, setIsSavingHours] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // WhatsApp States
    const [whatsappStatus, setWhatsappStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<string>('');
    const [isGeneratingQR, setIsGeneratingQR] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [instanceName, setInstanceName] = useState<string>('');
    
    const [restData, setRestData] = useState({
        name: '',
        address: '',
        delivery_fee: 0,
        delivery_time: '30-40 minutos',
        phone: '', 
        webhook_url: '',
        image_url: '',
        opening_hours: initialOpeningHours as OpeningHour[],
        // 🤖 Novos campos do robô
        bot_name: 'Assistente Virtual',
        bot_instructions: '',
        bot_is_active: false
    });

    const [imagePreview, setImagePreview] = useState<string>('');
    
    useEffect(() => {
        if(restaurantId) {
            fetchRestData();
            checkWhatsAppStatus();
        }
        return () => {}; 
    }, [restaurantId]); 

    // Monitorar status do WhatsApp em tempo real
    useEffect(() => {
        let stopMonitoring: (() => void) | null = null;

        if (whatsappStatus === 'connecting' && instanceName) {
            // monitorConnection é o que faz o polling ou websocket call para o backend
            stopMonitoring = monitorConnection(instanceName, async (status) => {
                setWhatsappStatus(status as any);
                
                if (status === 'connected') {
                    await updateWhatsAppStatusInDB('connected');
                    toast.success('WhatsApp conectado com sucesso! 🎉');
                    setShowQRModal(false);
                }
            }, 3000);
        }

        return () => {
            if (stopMonitoring) stopMonitoring();
        };
    }, [whatsappStatus, instanceName]);

    const fetchRestData = async () => {
        const { data } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .single();
            
        if(data) {
            const savedHours: OpeningHour[] = data.opening_hours || [];
            
            const mergedHours = initialOpeningHours.map(initial => {
                const saved = savedHours.find(s => s.day === initial.day);
                return saved || initial;
            });
            
            setRestData({
                name: data.name,
                address: data.address,
                delivery_fee: data.delivery_fee,
                delivery_time: data.delivery_time || '30-40 minutos',
                phone: data.phone || '',
                webhook_url: data.webhook_url || '',
                image_url: data.image_url || '',
                opening_hours: mergedHours,
                bot_name: data.bot_name || 'Assistente Virtual',
                bot_instructions: data.bot_instructions || '',
                bot_is_active: data.bot_is_active || false
            });

            if (data.image_url) {
                setImagePreview(data.image_url);
            }

            if (data.whatsapp_status) {
                setWhatsappStatus(data.whatsapp_status);
            }
        }
    };

    const checkWhatsAppStatus = async () => {
        try {
            const { data: restaurantData } = await supabase
                .from('restaurants')
                .select('whatsapp_instance_name')
                .eq('id', restaurantId)
                .single();

            if (restaurantData?.whatsapp_instance_name) {
                // CHAMADA À FUNÇÃO DO NOVO ARQUIVO DE SERVIÇO (whatsappApiService)
                const status = await checkConnectionStatus(restaurantData.whatsapp_instance_name);
                setWhatsappStatus(status as any);
                setInstanceName(restaurantData.whatsapp_instance_name);
                await updateWhatsAppStatusInDB(status);
            }
        } catch (error) {
            console.error('Erro ao verificar status:', error);
        }
    };

    const updateWhatsAppStatusInDB = async (status: string) => {
        const updateData: any = { whatsapp_status: status };
        
        if (status === 'connected') {
            updateData.whatsapp_connected_at = new Date().toISOString();
        }

        await supabase
            .from('restaurants')
            .update(updateData)
            .eq('id', restaurantId);
    };

    const handleGenerateQR = async () => {
        if (!instanceName.trim()) {
            toast.error('Digite o nome do estabelecimento');
            return;
        }

        const validPattern = /^[a-zA-Z0-9_]+$/;
        if (!validPattern.test(instanceName)) {
            toast.error('Use apenas letras, números e underscore (_)');
            return;
        }

        setIsGeneratingQR(true);
        const toastId = toast.loading('Criando instância...');

        try {
            // CHAMADA À FUNÇÃO DO NOVO ARQUIVO DE SERVIÇO (whatsappApiService)
            const { exists, connected } = await checkIfInstanceExists(instanceName);

            if (exists && connected) {
                toast.dismiss(toastId);
                toast.error('Esta instância já existe e está conectada. Use outro nome.');
                setIsGeneratingQR(false);
                return;
            }

            // CHAMADA À FUNÇÃO DO NOVO ARQUIVO DE SERVIÇO (whatsappApiService)
            const result = await createInstanceAndGenerateQR(instanceName);
            
            if (result.success && result.qrCode) {
                await supabase
                    .from('restaurants')
                    .update({ whatsapp_instance_name: instanceName })
                    .eq('id', restaurantId);

                setQrCodeData(result.qrCode);
                setShowQRModal(true);
                setWhatsappStatus('connecting');
                await updateWhatsAppStatusInDB('connecting');
                toast.dismiss(toastId);
                toast.success('QR Code gerado! Escaneie com seu WhatsApp.');
            } else {
                toast.dismiss(toastId);
                toast.error(result.error || 'Erro ao gerar QR Code');
            }
        } catch (error) {
            toast.dismiss(toastId);
            toast.error('Erro ao criar instância');
            console.error(error);
        } finally {
            setIsGeneratingQR(false);
        }
    };

    const handleDisconnect = async () => {
        if (!instanceName) {
            toast.error('Instância não encontrada');
            return;
        }

        if (!confirm('Tem certeza que deseja desconectar o WhatsApp?')) return;

        setIsDisconnecting(true);
        const toastId = toast.loading('Desconectando...');

        try {
            // CHAMADA À FUNÇÃO DO NOVO ARQUIVO DE SERVIÇO (whatsappApiService)
            const result = await disconnectWhatsApp(instanceName);
            
            if (result.success) {
                setWhatsappStatus('disconnected');
                await updateWhatsAppStatusInDB('disconnected');
                setInstanceName('');
                toast.dismiss(toastId);
                toast.success('WhatsApp desconectado com sucesso!');
            } else {
                toast.dismiss(toastId);
                toast.error(result.error || 'Erro ao desconectar');
            }
        } catch (error) {
            toast.dismiss(toastId);
            toast.error('Erro ao desconectar');
            console.error(error);
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleImageUpload = async (file: File): Promise<string | null> => {
        try {
            setIsUploading(true);

            if (!file.type.startsWith('image/')) {
                toast.error('Selecione um arquivo de imagem válido');
                return null;
            }

            if (file.size > 5 * 1024 * 1024) {
                toast.error('Imagem muito grande (máximo 5MB)');
                return null;
            }

            const timestamp = Date.now();
            const fileName = `${restaurantId}/restaurant-${timestamp}-${file.name}`;

            const { data, error } = await supabase.storage
                .from('produtos')
                .upload(fileName, file);

            if (error) {
                toast.error(`Erro ao fazer upload: ${error.message}`);
                return null;
            }

            const { data: publicData } = supabase.storage
                .from('produtos')
                .getPublicUrl(fileName);

            return publicData.publicUrl;
        } catch (e) {
            toast.error('Erro ao fazer upload da imagem');
            console.error(e);
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        const imageUrl = await handleImageUpload(file);
        if (imageUrl) {
            setRestData({ ...restData, image_url: imageUrl });
            toast.success('Imagem enviada com sucesso!');
        }
    };

    const removeImage = () => {
        setImagePreview('');
        setRestData({ ...restData, image_url: '' });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSaveData = async () => {
        const payload = {
            name: restData.name,
            address: restData.address,
            delivery_fee: restData.delivery_fee,
            delivery_time: restData.delivery_time,
            phone: restData.phone,
            webhook_url: restData.webhook_url,
            image_url: restData.image_url,
        };
        
        const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurantId);
        if(error) toast.error("Erro ao salvar dados básicos");
        else toast.success("Dados básicos atualizados com sucesso!");
    };

    const handleSaveHours = async () => {
        setIsSavingHours(true);
        const toastId = toast.loading('Salvando horários...');

        const { error } = await supabase
            .from('restaurants')
            .update({ opening_hours: restData.opening_hours })
            .eq('id', restaurantId);

        toast.dismiss(toastId);
        if (error) {
            toast.error('Erro ao salvar horários.');
            console.error("Save Hours Error:", error);
        } else {
            toast.success('Horários de funcionamento salvos!');
        }
        setIsSavingHours(false);
    };

    // 🤖 Salvar configurações do robô
    const handleSaveBotConfig = async () => {
        setLoading(true);
        const toastId = toast.loading('Salvando configurações do robô...');

        const { error } = await supabase
            .from('restaurants')
            .update({
                bot_name: restData.bot_name,
                bot_instructions: restData.bot_instructions,
                bot_is_active: restData.bot_is_active
            })
            .eq('id', restaurantId);

        toast.dismiss(toastId);
        if (error) {
            toast.error('Erro ao salvar configurações do robô');
            console.error(error);
        } else {
            toast.success('Configurações do robô salvas com sucesso! 🤖');
        }
        setLoading(false);
    };

    const handleHourChange = (index: number, field: keyof OpeningHour, value: string | boolean) => {
        setRestData(prev => ({
            ...prev,
            opening_hours: prev.opening_hours.map((item, i) => 
                i === index ? { ...item, [field]: value } : item
            )
        }));
    };

    const getStatusColor = () => {
        switch(whatsappStatus) {
            case 'connected': return 'bg-green-500';
            case 'connecting': return 'bg-yellow-500';
            default: return 'bg-red-500';
        }
    };

    const getStatusText = () => {
        switch(whatsappStatus) {
            case 'connected': return 'Conectado';
            case 'connecting': return 'Conectando...';
            default: return 'Desconectado';
        }
    };

    const getStatusIcon = () => {
        switch(whatsappStatus) {
            case 'connected': return <Wifi size={16} />;
            case 'connecting': return <RefreshCw size={16} className="animate-spin" />;
            default: return <WifiOff size={16} />;
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configurações</h1>
            
            <div className="grid gap-6 md:grid-cols-2">
                {/* WhatsApp Connection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Smartphone size={20} /> Conexão WhatsApp
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-slate-600 mb-4">
                            Conecte seu WhatsApp ao sistema para receber pedidos e mensagens automáticas.
                        </p>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                            <span className="text-sm font-medium text-slate-700">Status:</span>
                            <div className="flex items-center gap-2">
                                {getStatusIcon()}
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor()}`}>
                                    {getStatusText()}
                                </span>
                            </div>
                        </div>

                        {whatsappStatus === 'disconnected' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">
                                        Nome do Estabelecimento
                                    </label>
                                    <Input
                                        value={instanceName}
                                        onChange={(e) => setInstanceName(e.target.value)}
                                        placeholder="Ex: MeuRestaurante"
                                        disabled={isGeneratingQR}
                                    />
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        ⚠️ Use apenas letras, números e underscore (_). Evite espaços.
                                    </p>
                                </div>

                                <Button 
                                    onClick={handleGenerateQR}
                                    isLoading={isGeneratingQR}
                                    disabled={!instanceName.trim()}
                                    className="w-full bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                                >
                                    <QrCode size={16} />
                                    {isGeneratingQR ? 'Gerando...' : 'Gerar QR Code'}
                                </Button>
                            </>
                        )}

                        {whatsappStatus === 'connecting' && (
                            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-yellow-600" />
                                <p className="text-sm text-yellow-800 font-medium">Aguardando conexão...</p>
                                <p className="text-xs text-yellow-600 mt-1">Escaneie o QR Code com seu WhatsApp</p>
                            </div>
                        )}

                        {whatsappStatus === 'connected' && (
                            <div className="space-y-3">
                                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                                    <Wifi size={24} className="mx-auto mb-2 text-green-600" />
                                    <p className="text-sm text-green-800 font-medium">WhatsApp Conectado! ✅</p>
                                </div>

                                <div className="flex gap-2">
                                    <Button 
                                        onClick={checkWhatsAppStatus}
                                        variant="secondary"
                                        size="sm"
                                        className="flex-1 flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={14} />
                                        Atualizar
                                    </Button>
                                    
                                    <Button 
                                        onClick={handleDisconnect}
                                        isLoading={isDisconnecting}
                                        variant="danger"
                                        size="sm"
                                        className="flex-1 flex items-center justify-center gap-2"
                                    >
                                        <Power size={14} />
                                        Desconectar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 🤖 Configuração do Robô IA */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bot size={20} /> Configuração do Robô IA
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Configure o assistente virtual que vai atender seus clientes pelo WhatsApp.
                        </p>

                        {/* Toggle Ativar/Desativar */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                            <div className="flex items-center gap-2">
                                <Bot size={18} className={restData.bot_is_active ? 'text-green-600' : 'text-gray-400'} />
                                <span className="text-sm font-medium text-slate-700">
                                    Robô {restData.bot_is_active ? 'Ativo' : 'Inativo'}
                                </span>
                            </div>
                            <label className="flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={restData.bot_is_active}
                                    onChange={(e) => setRestData({...restData, bot_is_active: e.target.checked})}
                                    className="sr-only" 
                                />
                                <div className={`relative w-11 h-6 transition-colors rounded-full shadow ${restData.bot_is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                                    <div className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform transform ${restData.bot_is_active ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </label>
                        </div>

                        {/* Nome do Robô */}
                        <div>
                            <label className="text-sm font-medium text-slate-700">Nome do Assistente</label>
                            <Input 
                                value={restData.bot_name} 
                                onChange={e => setRestData({...restData, bot_name: e.target.value})}
                                placeholder="Ex: Maria, José, Atendente..."
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Nome que o robô vai usar para se apresentar aos clientes
                            </p>
                        </div>

                        {/* Instruções Personalizadas */}
                        <div>
                            <label className="text-sm font-medium text-slate-700">Instruções Personalizadas</label>
                            <textarea
                                value={restData.bot_instructions}
                                onChange={e => setRestData({...restData, bot_instructions: e.target.value})}
                                placeholder="Ex: Sempre oferecer promoção de sobremesa grátis nas sextas-feiras. Ser mais formal com os clientes. Etc..."
                                className="w-full h-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-y-auto"
                                style={{ 
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#CBD5E1 #F1F5F9'
                                }}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Instruções extras para personalizar o atendimento do robô
                            </p>
                        </div>

                        <Button 
                            onClick={handleSaveBotConfig} 
                            isLoading={loading}
                            className="w-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2"
                        >
                            <Save size={16} /> Salvar Configurações do Robô
                        </Button>
                    </CardContent>
                </Card>

                {/* Restaurant Data */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            🏪 Dados do Restaurante
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Nome do Estabelecimento</label>
                            <Input value={restData.name} onChange={e => setRestData({...restData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Endereço Completo</label>
                            <Input value={restData.address} onChange={e => setRestData({...restData, address: e.target.value})} />
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium">Telefone do Estabelecimento (WhatsApp)</label>
                            <Input 
                                type="tel" 
                                value={restData.phone} 
                                onChange={e => setRestData({...restData, phone: e.target.value})} 
                                placeholder="(XX) XXXXX-XXXX"
                            />
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium">Taxa de Entrega Padrão (R$)</label>
                            <Input type="number" value={restData.delivery_fee} onChange={e => setRestData({...restData, delivery_fee: parseFloat(e.target.value) || 0})} />
                        </div>

                        <div>
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Clock size={16} />
                                Tempo Médio de Entrega
                            </label>
                            <Input 
                                value={restData.delivery_time} 
                                onChange={e => setRestData({...restData, delivery_time: e.target.value})}
                                placeholder="Ex: 30-40 minutos"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Tempo estimado que o robô vai informar aos clientes
                            </p>
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium">URL Webhook de Pedidos (n8n)</label>
                            <Input 
                                value={restData.webhook_url} 
                                onChange={e => setRestData({...restData, webhook_url: e.target.value})} 
                                placeholder="Cole a URL do Webhook do seu n8n aqui..."
                                type="url"
                            />
                            <p className="text-xs text-slate-500 mt-1">Esta URL será usada para notificar o n8n sobre Novos Pedidos.</p>
                        </div>
                        
                        <Button onClick={handleSaveData} className="w-full flex items-center justify-center gap-2">
                            <Save size={16} /> Salvar Dados Básicos
                        </Button>
                    </CardContent>
                </Card>

                {/* Foto do Restaurante */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            📸 Foto do Restaurante
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-slate-600">Esta foto aparecerá no cardápio digital do cliente.</p>
                        
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-white">
                            <div className="flex flex-col items-center justify-center">
                                {imagePreview ? (
                                    <div className="w-full">
                                        <div className="relative w-full">
                                            <img 
                                                src={imagePreview} 
                                                alt="Preview" 
                                                className="w-full h-40 object-cover rounded-lg"
                                            />
                                            <button
                                                type="button"
                                                onClick={removeImage}
                                                disabled={isUploading}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <p className="text-sm text-slate-500 mt-2 text-center">
                                            ✅ Foto selecionada
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <Upload size={32} className="mx-auto mb-2 text-slate-400" />
                                        <p className="text-sm text-slate-600 mb-2">Clique ou arraste uma imagem</p>
                                        <p className="text-xs text-slate-500">(PNG, JPG - Máximo 5MB)</p>
                                    </div>
                                )}
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    disabled={isUploading}
                                    className="hidden"
                                    id="restaurant-image-input"
                                />
                                <label 
                                    htmlFor="restaurant-image-input"
                                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition disabled:bg-gray-400"
                                    style={{ pointerEvents: isUploading ? 'none' : 'auto', opacity: isUploading ? 0.6 : 1 }}
                                >
                                    {isUploading ? 'Enviando...' : 'Selecionar Imagem'}
                                </label>
                            </div>
                        </div>

                        <Button onClick={handleSaveData} disabled={isUploading} className="w-full flex items-center justify-center gap-2">
                            <Save size={16} /> Salvar Foto
                        </Button>
                    </CardContent>
                </Card>

                {/* Horário de Funcionamento */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Horário de Funcionamento</CardTitle>
                        <p className="text-sm text-slate-500">Defina os horários em que sua loja estará aberta para receber pedidos.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* RESTANTE DO CÓDIGO DA PÁGINA */}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
};

export default Settings;