// frontend/hooks/useOpeningHours.ts

import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';

type OpeningHour = {
    day: string;
    is_open: boolean;
    open_time: string;
    close_time: string;
};

export const useOpeningHours = (restaurantId: number | null, initialHours: OpeningHour[]) => {
    const [openingHours, setOpeningHours] = useState<OpeningHour[]>(initialHours);
    const [isSavingHours, setIsSavingHours] = useState(false);

    // Sincroniza o estado interno do hook com os dados que vêm do useRestaurantData
    useEffect(() => {
        if (initialHours && initialHours.length > 0) {
            setOpeningHours(initialHours);
        }
    }, [initialHours]);

    const handleHourChange = useCallback((index: number, field: keyof OpeningHour, value: string | boolean) => {
        setOpeningHours(prev => 
            prev.map((item, i) => 
                i === index ? { ...item, [field]: value } : item
            )
        );
    }, []);

    const handleSaveHours = useCallback(async () => {
        if (!restaurantId) return;
        setIsSavingHours(true);
        const toastId = toast.loading('Salvando horários...');

        const { error } = await supabase
            .from('restaurants')
            .update({ opening_hours: openingHours })
            .eq('id', restaurantId);

        toast.dismiss(toastId);
        if (error) {
            toast.error('Erro ao salvar horários.');
            console.error("Save Hours Error:", error);
        } else {
            toast.success('Horários de funcionamento salvos!');
        }
        setIsSavingHours(false);
    }, [restaurantId, openingHours]);

    return {
        openingHours,
        handleHourChange,
        handleSaveHours,
        isSavingHours,
    };
};