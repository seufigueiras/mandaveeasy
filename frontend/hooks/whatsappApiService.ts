// frontend/services/whatsappApiService.ts

// A URL base do seu backend deve estar nas variáveis de ambiente do Vite
// Ex: VITE_API_URL, que você passou no comando de deploy.
// Importante: use a variável de ambiente correta configurada no seu ambiente de deploy.
const API_BASE_URL = import.meta.env.VITE_API_URL; 

interface ApiResponse {
    success: boolean;
    error?: string;
    qrCode?: string;
    status?: string; // Para checar o status
}

const handleResponse = async (response: Response): Promise<ApiResponse> => {
    if (!response.ok) {
        // Tenta ler a mensagem de erro do backend
        const errorData = await response.json().catch(() => ({ message: `Erro HTTP ${response.status}` }));
        return { 
            success: false, 
            error: errorData.message || `Erro no servidor: Código ${response.status}` 
        };
    }
    // Retorna o JSON da resposta
    return response.json();
};

// 1. Geração de QR Code
export const generateQrCodeApi = async (instanceName: string, restaurantId: number): Promise<ApiResponse> => {
    try {
        const response = await fetch(`${API_BASE_URL}/whatsapp/generate-qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ instanceName, restaurantId }),
        });
        return handleResponse(response);
    } catch (e) {
        console.error("API Call Error (generateQrCodeApi):", e);
        return { success: false, error: 'Erro de rede ou comunicação com o servidor.' };
    }
};

// 2. Desconexão da Instância
export const disconnectInstanceApi = async (instanceName: string, restaurantId: number): Promise<ApiResponse> => {
    try {
        const response = await fetch(`${API_BASE_URL}/whatsapp/disconnect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ instanceName, restaurantId }),
        });
        return handleResponse(response);
    } catch (e) {
        console.error("API Call Error (disconnectInstanceApi):", e);
        return { success: false, error: 'Erro de rede ou comunicação com o servidor.' };
    }
};

// 3. Checagem de Status
export const checkStatusApi = async (instanceName: string): Promise<ApiResponse> => {
    try {
        // Usamos GET para checar status, passando o nome da instância como query param
        const response = await fetch(`${API_BASE_URL}/whatsapp/status?instanceName=${instanceName}`);
        return handleResponse(response);
    } catch (e) {
        console.error("API Call Error (checkStatusApi):", e);
        return { success: false, error: 'Erro de rede ou comunicação com o servidor.' };
    }
};