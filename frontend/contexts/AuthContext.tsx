import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { DEMO_RESTAURANT_ID } from '../constants';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  restaurantId: string;
  isLoading: boolean;
  signOut: () => Promise<void>;
  playNewOrderAlert: () => void;
  stopAlert: () => void;
  audioEnabled: boolean;
  enableAudio: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  restaurantId: DEMO_RESTAURANT_ID,
  isLoading: true,
  signOut: async () => {},
  playNewOrderAlert: () => {},
  stopAlert: () => {},
  audioEnabled: false,
  enableAudio: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [restaurantId, setRestaurantId] = useState<string>(DEMO_RESTAURANT_ID);
  const [isLoading, setIsLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Habilitar áudio (chamado quando usuário clica)
  const enableAudio = () => {
    try {
      // Cria o elemento de áudio uma vez
      if (!audioRef.current) {
        audioRef.current = new Audio('/audiopedido.mp3');
        audioRef.current.volume = 0.8; // Volume de 80%
        audioRef.current.preload = 'auto';
      }
      
      // Toca um som de confirmação
      audioRef.current.play().catch(e => {
        console.log("Erro ao tocar áudio de confirmação:", e);
      });
      
      setAudioEnabled(true);
    } catch (e) {
      console.log("Erro ao habilitar áudio:", e);
    }
  };

  // Função para tocar alerta (repete a cada 5 segundos)
  const playNewOrderAlert = () => {
    if (!audioEnabled || !audioRef.current) return;

    if (intervalRef.current) {
      return;
    }

    // Função para tocar o som
    const playBeep = () => {
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0; // Reinicia o áudio
          audioRef.current.play().catch(e => {
            console.log("Erro ao tocar áudio:", e);
          });
        }
      } catch (e) {
        console.log("Erro ao tocar áudio:", e);
      }
    };

    // Toca uma primeira vez
    playBeep();

    // Repete a cada 5 segundos
    intervalRef.current = setInterval(() => {
      if (audioEnabled) {
        playBeep();
      }
    }, 5000);
  };

  // Função para parar o alerta
  const stopAlert = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Para o áudio se estiver tocando
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setRestaurantId(DEMO_RESTAURANT_ID);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setRestaurantId(DEMO_RESTAURANT_ID);
      } else {
        stopAlert();
      }
    });

    return () => {
      subscription.unsubscribe();
      stopAlert();
    };
  }, []);

  const signOut = async () => {
    stopAlert();
    await supabase.auth.signOut();
    setRestaurantId(DEMO_RESTAURANT_ID);
  };

  return (
    <AuthContext.Provider value={{ session, restaurantId, isLoading, signOut, playNewOrderAlert, stopAlert, audioEnabled, enableAudio }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);