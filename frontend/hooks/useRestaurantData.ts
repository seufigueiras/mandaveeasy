// frontend/hooks/useRestaurantData.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabaseClient';

const initialOpeningHours: any[] = [
    { day: 'Segunda', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Terça', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Quarta', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Quinta', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Sexta', is_open: true, open_time: '18:00', close_time: '23:00' },
    { day: 'Sábado', is_open: true, open_time: '12:00', close_time: '00:00' },
    { day: 'Domingo', is_open: false, open_time: '18:00', close_time: '23:00' },
];

const initialRestData = {
    name: '',
    address: '',
    delivery_fee: 0,
    delivery_time: '30-40 minutos',
    phone: '', 
    webhook_url: '',
    image_url: '',
    opening_hours: initialOpeningHours,
    bot_name: 'Assistente Virtual',
    bot_instructions: '',
    bot_is_active: false,
    whatsapp_instance_name: '', 
    whatsapp_status: 'disconnected', // Adicionando status inicial
};

export const useRestaurantData = (restaurantId: number | null) => {
    const [restData, setRestData] = useState(initialRestData);
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Carregar todos os dados do DB
    const fetchRestData = useCallback(async () => {
        if (!restaurantId) return;
        setLoading(true);

        const { data, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .single();
            
        if (data) {
            // Lógica para garantir que todos os 7 dias estejam presentes
            const savedHours: any[] = data.opening_hours || [];
            const mergedHours = initialOpeningHours.map(initial => {
                const saved = savedHours.find(s => s.day === initial.day);
                return saved || initial;
            });

            setRestData({
                ...initialRestData, // Garante que novos campos sejam incluídos
                ...data,
                delivery_fee: data.delivery_fee ?? 0,
                opening_hours: mergedHours,
                whatsapp_instance_name: data.whatsapp_instance_name || '',
                whatsapp_status: data.whatsapp_status || 'disconnected', // Garante que o status seja carregado
            });

            if (data.image_url) {
                setImagePreview(data.image_url);
            }
        }
        setLoading(false);
    }, [restaurantId]);

    useEffect(() => {
        fetchRestData();
    }, [fetchRestData]);
    
    // Upload de Imagem
    const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
        try {
            setIsUploading(true);

            if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
                toast.error('Arquivo inválido ou muito grande (máximo 5MB).');
                return null;
            }

            const timestamp = Date.now();
            const fileName = `${restaurantId}/restaurant-${timestamp}-${file.name}`;

            const { error } = await supabase.storage
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
    }, [restaurantId]);


    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const oldImageUrl = restData.image_url; 
        
        // Pré-visualização
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        const imageUrl = await handleImageUpload(file);
        if (imageUrl) {
            setRestData(prev => ({ ...prev, image_url: imageUrl }));
            toast.success('Imagem enviada com sucesso! Lembre-se de salvar os Dados Básicos.');
        } else {
             // Reverte a pré-visualização se o upload falhar
            setImagePreview(oldImageUrl); 
            toast.error('Falha ao salvar a imagem.');
        }
    }, [restData.image_url, handleImageUpload]);

    const removeImage = useCallback(() => {
        setImagePreview('');
        setRestData(prev => ({ ...prev, image_url: '' }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // Salvar Dados Básicos (e Foto)
    const handleSaveData = useCallback(async () => {
        if (!restaurantId) return;
        setLoading(true);
        const toastId = toast.loading('Salvando dados básicos...');

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
        
        toast.dismiss(toastId);
        if(error) toast.error("Erro ao salvar dados básicos");
        else toast.success("Dados básicos atualizados com sucesso!");
        setLoading(false);
    }, [restaurantId, restData]);

    // Salvar configurações do robô
    const handleSaveBotConfig = useCallback(async () => {
        if (!restaurantId) return;
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
        } else {
            toast.success('Configurações do robô salvas com sucesso! 🤖');
        }
        setLoading(false);
    }, [restaurantId, restData.bot_name, restData.bot_instructions, restData.bot_is_active]);

    return {
        restData,
        setRestData, 
        loading,
        handleSaveData,
        handleSaveBotConfig,
        imagePreview,
        isUploading,
        fileInputRef,
        handleFileSelect,
        removeImage,
    };
};