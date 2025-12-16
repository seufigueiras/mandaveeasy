// services/evolutionService.ts

const EVOLUTION_API_URL = 'https://cantinhodabere-evolution-api.3xdxtv.easypanel.host';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'Cantinhodaberev1';

interface EvolutionResponse {
  instance?: {
    instanceName: string;
    status: string;
    state?: string;
  };
  state?: string;
  qrcode?: {
    base64?: string;
    code?: string;
  };
  error?: string;
  message?: string;
}

interface SendMessageParams {
  phone: string;
  message: string;
}

// Headers padrão para todas as requisições
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'apikey': API_KEY,
});

/**
 * 📤 ENVIAR MENSAGEM DE TEXTO
 */
export const sendWhatsAppMessage = async ({ phone, message }: SendMessageParams) => {
  try {
    console.log('📤 Enviando mensagem via Evolution API...');
    console.log('📱 Para:', phone);
    console.log('💬 Mensagem:', message);

    // Formatar o número corretamente (remover caracteres especiais)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.includes('@s.whatsapp.net') 
      ? cleanPhone 
      : `${cleanPhone}@s.whatsapp.net`;

    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Erro da Evolution API:', errorData);
      throw new Error(`Erro ao enviar mensagem: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Mensagem enviada com sucesso!', data);
    return data;

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    throw error;
  }
};

/**
 * Verifica o status da conexão do WhatsApp
 */
export const checkConnectionStatus = async (instanceName: string): Promise<string> => {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    const data: EvolutionResponse = await response.json();
    
    // Estados possíveis: 'open', 'close', 'connecting'
    if (data.instance?.state === 'open' || data.state === 'open') return 'connected';
    if (data.instance?.state === 'connecting' || data.state === 'connecting') return 'connecting';
    return 'disconnected';
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    return 'disconnected';
  }
};

/**
 * Cria uma nova instância e gera QR Code
 */
export const createInstanceAndGenerateQR = async (instanceName: string): Promise<{ success: boolean; qrCode?: string; error?: string }> => {
  try {
    // 1. Criar a instância
    const createResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/create`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        }),
      }
    );

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      throw new Error(errorData.message || 'Erro ao criar instância');
    }

    const createData = await createResponse.json();

    // 2. Verificar se o QR Code já veio na resposta
    if (createData.qrcode?.base64) {
      return {
        success: true,
        qrCode: createData.qrcode.base64,
      };
    }

    // 3. Se não veio, aguardar e buscar o QR Code
    await new Promise(resolve => setTimeout(resolve, 2000));

    const qrResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    const qrData = await qrResponse.json();

    if (qrData.qrcode?.base64) {
      return {
        success: true,
        qrCode: qrData.qrcode.base64,
      };
    }

    return {
      success: false,
      error: 'QR Code não disponível. Tente novamente.',
    };
  } catch (error) {
    console.error('Erro ao criar instância:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar instância',
    };
  }
};

/**
 * Conecta a uma instância existente e gera novo QR Code
 */
export const connectToInstance = async (instanceName: string): Promise<{ success: boolean; qrCode?: string; error?: string }> => {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao conectar à instância');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const qrResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    const qrData = await qrResponse.json();

    if (qrData.qrcode?.base64) {
      return {
        success: true,
        qrCode: qrData.qrcode.base64,
      };
    }

    return {
      success: false,
      error: 'QR Code não disponível.',
    };
  } catch (error) {
    console.error('Erro ao conectar:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao conectar',
    };
  }
};

/**
 * Desconecta o WhatsApp (logout)
 */
export const disconnectWhatsApp = async (instanceName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/logout/${instanceName}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao desconectar');
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao desconectar WhatsApp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao desconectar',
    };
  }
};

/**
 * Verifica se uma instância já existe
 */
export const checkIfInstanceExists = async (instanceName: string): Promise<{ exists: boolean; connected: boolean }> => {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      return { exists: false, connected: false };
    }

    const instances = await response.json();
    
    // Procurar pela instância específica
    if (Array.isArray(instances)) {
      const instance = instances.find((inst: any) => 
        inst.instance?.instanceName === instanceName || inst.name === instanceName
      );

      if (instance) {
        const state = instance.instance?.state || instance.state || instance.connectionStatus;
        return {
          exists: true,
          connected: state === 'open'
        };
      }
    }

    return { exists: false, connected: false };
  } catch (error) {
    console.error('Erro ao verificar instância:', error);
    return { exists: false, connected: false };
  }
};

/**
 * Busca informações da instância
 */
export const getInstanceInfo = async () => {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar instância: ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Erro ao buscar instância:', error);
    throw error;
  }
};

/**
 * Monitora o status da conexão em tempo real
 * Retorna uma função para parar o monitoramento
 */
export const monitorConnection = (
  instanceName: string,
  onStatusChange: (status: string) => void,
  intervalMs: number = 5000
): (() => void) => {
  const interval = setInterval(async () => {
    const status = await checkConnectionStatus(instanceName);
    onStatusChange(status);
  }, intervalMs);

  // Retorna função para parar o monitoramento
  return () => clearInterval(interval);
};

export default {
  sendWhatsAppMessage,
  checkConnectionStatus,
  createInstanceAndGenerateQR,
  connectToInstance,
  disconnectWhatsApp,
  checkIfInstanceExists,
  getInstanceInfo,
  monitorConnection,
};