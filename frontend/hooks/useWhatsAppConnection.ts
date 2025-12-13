// frontend/hooks/useWhatsAppConnection.ts

import { useState, useEffect, useCallback, SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabaseClient'; 
import { 
    generateQrCodeApi, 
    disconnectInstanceApi, 
    checkStatusApi 
} from '../services/whatsappApiService'; // IMPORTAÇÃO CORRIGIDA

import { Wifi, WifiOff, RefreshCw, Power } from 'lucide-react';

type WhatsappStatus = 'disconnected' | 'connecting' | 'connected';

interface RestDataUpdate {
    whatsapp_status?: string;
    whatsapp_connected_at?: string;
    whatsapp_instance_name?: string;
}

export const useWhatsAppConnection = (
    restaurantId: number | null, 
    initialInstanceName: string,
    initialStatus: string, // Novo prop para receber o status inicial
    setRestData: (update: SetStateAction<any>) => void
) => {
    const [whatsappStatus, setWhatsappStatus] = useState<WhatsappStatus>(initialStatus as WhatsappStatus);
    const [instanceName, setInstanceName] = useState<string>(initialInstanceName);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<string>('');
    const [isGeneratingQR, setIsGeneratingQR] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    // Efeito para sincronizar o estado local quando os props iniciais mudam
    useEffect(() => {
        setInstanceName(initialInstanceName);
        setWhatsappStatus(initialStatus as WhatsappStatus);
    }, [initialInstanceName, initialStatus]);

    // Função interna para atualizar o status no Supabase
    const updateWhatsAppStatusInDB = useCallback(async (status: string, instanceToSave: string = instanceName) => {
        if (!restaurantId) return;
        
        const updateData: RestDataUpdate = { 
            whatsapp_status: status,
            whatsapp_instance_name: instanceToSave
        };
        
        if (status === 'connected') {
            updateData.whatsapp_connected_at = new Date().toISOString();
        } else if (status === 'disconnected') {
            // Limpa a instância ao desconectar
            updateData.whatsapp_instance_name = '';
        }

        const { error } = await supabase
            .from('restaurants')
            .update(updateData)
            .eq('id', restaurantId);

        if (error) {
             console.error("Erro ao salvar status no DB:", error);
             toast.error("Erro ao sincronizar status no banco de dados.");
        }

        // Atualiza o estado principal do restData
        setRestData(prev => ({ 
            ...prev, 
            whatsapp_status: status, 
            whatsapp_instance_name: instanceToSave 
        }));
    }, [restaurantId, setRestData, instanceName]);


    // Checagem inicial do status ao montar (se já houver instância salva)
    useEffect(() => {
        const checkInitialStatus = async () => {
            // Só checa se o status salvo no DB não for 'connected' e houver nome de instância
            if (!restaurantId || !instanceName || initialStatus === 'connected') return;

            try {
                setWhatsappStatus('connecting'); // Assume que precisa verificar

                const statusResult = await checkStatusApi(instanceName);
                
                if (statusResult.success) {
                    const status = statusResult.status as WhatsappStatus;
                    setWhatsappStatus(status);
                    await updateWhatsAppStatusInDB(status, instanceName);
                }
            } catch (error) {
                console.error('Erro ao verificar status inicial:', error);
                // Se falhar a comunicação, assume que está desconectado
                setWhatsappStatus('disconnected');
            }
        };

        checkInitialStatus();
    }, [restaurantId, instanceName, initialStatus, updateWhatsAppStatusInDB]); 
    
    // Monitorar status do WhatsApp (Poll for status) - Só ativa se estiver 'connecting'
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (whatsappStatus === 'connecting' && instanceName) {
            interval = setInterval(async () => {
                try {
                    const statusResult = await checkStatusApi(instanceName);

                    if (statusResult.success) {
                        const newStatus = statusResult.status as WhatsappStatus;
                        setWhatsappStatus(newStatus);
                        
                        if (newStatus === 'connected') {
                            await updateWhatsAppStatusInDB('connected');
                            toast.success('WhatsApp conectado com sucesso! 🎉');
                            setShowQRModal(false);
                            if (interval) clearInterval(interval); 
                        } else if (newStatus === 'disconnected') {
                            // Se o status mudar para disconnected durante o poll, para e atualiza o DB
                            await updateWhatsAppStatusInDB('disconnected', '');
                            toast.error('A conexão expirou ou foi desconectada.');
                            if (interval) clearInterval(interval);
                        }
                    }
                } catch (error) {
                    console.error('Erro no monitoramento:', error);
                }
            }, 5000); // Poll a cada 5 segundos
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [whatsappStatus, instanceName, updateWhatsAppStatusInDB]);


    // Handlers
    const handleGenerateQR = useCallback(async () => {
        if (!instanceName.trim() || !restaurantId) {
            toast.error('Nome da instância ausente.');
            return;
        }

        const validPattern = /^[a-zA-Z0-9_]+$/;
        if (!validPattern.test(instanceName)) {
            toast.error('Use apenas letras, números e underscore (_) no nome da instância.');
            return;
        }

        setIsGeneratingQR(true);
        const toastId = toast.loading('Criando instância...');

        try {
            const result = await generateQrCodeApi(instanceName, restaurantId);
            
            if (result.success && result.qrCode) {
                setQrCodeData(result.qrCode);
                setShowQRModal(true);
                setWhatsappStatus('connecting');
                // Salva o nome da instância e o status 'connecting' no DB
                await updateWhatsAppStatusInDB('connecting', instanceName); 

                toast.dismiss(toastId);
                toast.success('QR Code gerado! Escaneie com seu WhatsApp.');
            } else {
                toast.dismiss(toastId);
                toast.error(result.error || 'Erro ao gerar QR Code. Tente outro nome de instância.');
                setWhatsappStatus('disconnected');
            }
        } catch (error) {
            toast.dismiss(toastId);
            toast.error('Erro de comunicação com o servidor');
            console.error(error);
        } finally {
            setIsGeneratingQR(false);
        }
    }, [instanceName, restaurantId, updateWhatsAppStatusInDB]);

    const handleDisconnect = useCallback(async () => {
        if (!instanceName) {
            toast.error('Instância não encontrada');
            return;
        }

        if (!confirm('Tem certeza que deseja desconectar o WhatsApp?')) return;

        setIsDisconnecting(true);
        const toastId = toast.loading('Desconectando...');

        try {
            const result = await disconnectInstanceApi(instanceName, restaurantId);
            
            if (result.success) {
                setWhatsappStatus('disconnected');
                setInstanceName('');
                await updateWhatsAppStatusInDB('disconnected', ''); // Limpa a instância
                toast.dismiss(toastId);
                toast.success('WhatsApp desconectado com sucesso!');
            } else {
                toast.dismiss(toastId);
                toast.error(result.error || 'Erro ao desconectar');
            }
        } catch (error) {
            toast.dismiss(toastId);
            toast.error('Erro de comunicação com o servidor');
            console.error(error);
        } finally {
            setIsDisconnecting(false);
        }
    }, [instanceName, restaurantId, updateWhatsAppStatusInDB]);

    // Funções de Estilo (para o JSX)
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
            case 'connecting': return 'Aguardando QR...';
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

    return {
        whatsappStatus,
        instanceName,
        setInstanceName,
        isGeneratingQR,
        isDisconnecting,
        qrCodeData,
        showQRModal,
        setShowQRModal,
        handleGenerateQR,
        handleDisconnect,
        getStatusColor,
        getStatusText,
        getStatusIcon,
    };
};