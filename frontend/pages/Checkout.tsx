// mandavenovo/pages/Checkout.tsx - CÓDIGO FINAL E CORRIGIDO (v7)

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../services/supabaseClient';
import toast from 'react-hot-toast';
import { Package, MapPin, Phone, User, CheckCircle, ShoppingCart } from 'lucide-react';

// Importa componentes de UI
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

// Tipagem do Estado
interface FormData {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    orderType: 'DELIVERY' | 'PICKUP';
    paymentMethod: string;
}

// 🟢 ATUALIZADO: Função de formatação agora recebe o nome do restaurante
const formatWhatsappMessage = (orderId: string, formData: FormData, items: any[], total: number, restaurantName: string): string => {
    
    // Garantia de String
    const safeOrderId = String(orderId || '').substring(0, 8);
    
    const addressLine = formData.orderType === 'DELIVERY' ? `\n*Endereço:* ${formData.customerAddress}` : '';
    
    const orderItems = items.map(item => ` - *${item.quantity}x* ${item.name} (R$ ${item.price.toFixed(2)})`).join('\n');
    
    // 🟢 USANDO o nome real do restaurante
    let message = `*NOVO PEDIDO #${safeOrderId} - ${restaurantName}*\n\n`;
    message += `*CLIENTE:* ${formData.customerName}\n`;
    message += `*TELEFONE:* ${formData.customerPhone}\n`;
    message += `*Tipo de Serviço:* ${formData.orderType === 'DELIVERY' ? 'ENTREGA 🛵' : 'RETIRADA 📦'}${addressLine}\n`;
    message += `*Pagamento:* ${formData.paymentMethod}\n\n`;
    message += `--- ITENS DO PEDIDO ---\n${orderItems}\n\n`;
    message += `*TOTAL: R$ ${total.toFixed(2)}*`;

    return encodeURIComponent(message);
};

const Checkout: React.FC = () => {
    const { restaurantId } = useParams<{ restaurantId: string }>();
    const navigate = useNavigate();
    const { items, total, clearCart } = useCart(); 

    const [formData, setFormData] = useState<FormData>({
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        orderType: 'PICKUP',
        paymentMethod: 'CASH',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [orderPlaced, setOrderPlaced] = useState(false);
    const [newOrderId, setNewOrderId] = useState('');
    const [restaurantPhone, setRestaurantPhone] = useState(''); 
    // 🟢 NOVO ESTADO: Para guardar o nome do restaurante
    const [restaurantName, setRestaurantName] = useState('Seu Restaurante'); 
    const [finalOrderDetails, setFinalOrderDetails] = useState<any>(null); 

    // 🟢 ATUALIZADO: Busca o telefone E o nome do restaurante
    const fetchRestaurantPhone = async () => {
        const { data } = await supabase.from('restaurants').select('phone, name').eq('id', restaurantId).single();
        if (data) {
            setRestaurantPhone(data.phone || '');
            // 🟢 Armazena o nome
            setRestaurantName(data.name || 'Seu Restaurante'); 
        }
    };
    
    useEffect(() => {
        if (restaurantId) {
            fetchRestaurantPhone();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restaurantId]); 
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleOrderTypeChange = (type: 'DELIVERY' | 'PICKUP') => {
        setFormData(prev => ({
            ...prev,
            orderType: type,
            customerAddress: type === 'PICKUP' ? '' : prev.customerAddress
        }));
    };

    // ----------------------------------------------------
    // SUBMISSÃO DO PEDIDO
    // ----------------------------------------------------
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (items.length === 0) {
            toast.error("O carrinho está vazio!");
            return;
        }
        if (!formData.customerName || !formData.customerPhone) {
            toast.error("Nome e Telefone são obrigatórios.");
            return;
        }
        if (formData.orderType === 'DELIVERY' && !formData.customerAddress) {
            toast.error("Endereço de entrega é obrigatório.");
            return;
        }

        setIsLoading(true);

        const orderItemsForRPC = items.map(item => ({
            product_id: item.product_id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
        }));

        try {
            const { data, error } = await supabase.rpc('place_order', {
                p_restaurant_id: restaurantId,
                p_customer_name: formData.customerName,
                p_customer_phone: formData.customerPhone,
                p_customer_address: formData.customerAddress || null,
                p_order_type: formData.orderType,
                p_total_amount: total,
                p_payment_method: formData.paymentMethod,
                p_items: orderItemsForRPC,
                p_origin: 'CARDAPIO'
            });

            if (error) throw new Error(error.message);

            // Extrai o ID da resposta do RPC de forma robusta
            let orderId = data;
            
            if (Array.isArray(data) && data.length > 0) {
                orderId = data[0];
            }

            if (typeof orderId === 'object' && orderId !== null && (orderId as any).id) {
                orderId = (orderId as any).id;
            }

            setNewOrderId(String(orderId));
            
            // Salva os detalhes completos do pedido
            setFinalOrderDetails({ items, total, formData });

            // Atribui a flag de sucesso
            setOrderPlaced(true);
            toast.success("Pedido enviado com sucesso!");

            // Limpa o carrinho SÓ AGORA
            clearCart(); 
            
        } catch (error) {
            console.error("Erro ao finalizar pedido:", error);
            toast.error(`Falha ao enviar pedido. ${error instanceof Error ? error.message : ""}`);
        } finally {
            setIsLoading(false);
        }
    };

    // ----------------------------------------------------
    // TELAS DE SUCESSO / CARRINHO VAZIO
    // ----------------------------------------------------
    if (orderPlaced) {
        
        if (!finalOrderDetails) {
             return <div className="p-8 max-w-lg mx-auto mt-10">Carregando detalhes finais do pedido...</div>;
        }
        
        // 🟢 ATUALIZADO: Passando o nome do restaurante
        const whatsappMessage = formatWhatsappMessage(
            newOrderId, 
            finalOrderDetails.formData, 
            finalOrderDetails.items, 
            finalOrderDetails.total,
            restaurantName // 🟢 NOVO ARGUMENTO
        );

        return (
            <div className="p-8 max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center bg-white shadow-xl rounded-lg mt-10">
                <CheckCircle size={60} className="text-green-500 mb-4" />
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Pedido Recebido!</h1>
                <p className="text-lg text-slate-600 mb-6">Seu pedido foi enviado para o restaurante.</p>

                <p className="text-xl font-mono text-indigo-600 mb-8">Nº do Pedido: {String(newOrderId).substring(0, 8)}</p>

                <a 
                    href={`https://wa.me/55${restaurantPhone}?text=${whatsappMessage}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 mb-3 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none gap-2"
                >
                    <Phone size={16} /> Acompanhar Pedido no WhatsApp
                </a>
                
                <Button
                    onClick={() => navigate(`/cardapio/${restaurantId}`)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                    Fazer Novo Pedido
                </Button>
            </div>
        );
    }

    if (items.length === 0 && !isLoading) {
        return (
            <div className="p-8 max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center bg-white shadow-xl rounded-lg mt-10">
                <ShoppingCart size={60} className="text-red-500 mb-4" />
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Carrinho Vazio</h1>
                <p className="text-lg text-slate-600 mb-6">Adicione itens ao cardápio antes de finalizar.</p>
                <Button
                    onClick={() => navigate(`/cardapio/${restaurantId}`)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                    Voltar ao Cardápio
                </Button>
            </div>
        );
    }

    // ----------------------------------------------------
    // FORMULÁRIO DE CHECKOUT
    // ----------------------------------------------------
    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-screen">
            <h1 className="text-3xl font-bold text-indigo-600 border-b pb-2 mb-6">Finalizar Pedido</h1>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* COLUNA 1: Itens do Carrinho */}
                <div className="md:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">Seu Pedido</h2>

                    {items.map(item => (
                        <div key={item.product_id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                            <div className="flex items-center space-x-2">
                                <span className="font-mono text-sm text-slate-500">{item.quantity}x</span>
                                <span className="font-medium text-slate-800">{item.name}</span>
                            </div>
                            <span className="font-bold text-green-600">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    ))}

                    <div className="pt-4 flex justify-between items-center text-2xl font-bold text-slate-900 border-t mt-4">
                        <span>Total:</span>
                        <span>R$ {total.toFixed(2)}</span>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => navigate(`/cardapio/${restaurantId}`)}
                        className="text-indigo-600 hover:bg-indigo-50 w-full mt-4"
                    >
                        Adicionar Mais Itens
                    </Button>
                </div>

                {/* COLUNA 2: Dados do Cliente */}
                <div className="md:col-span-1 space-y-6">

                    {/* TIPO DE SERVIÇO */}
                    <div className="bg-white p-5 rounded-lg shadow">
                        <h2 className="text-lg font-semibold mb-3">Tipo de Serviço</h2>
                        <div className="flex space-x-3">
                            <Button
                                type="button"
                                onClick={() => handleOrderTypeChange('PICKUP')}
                                className={formData.orderType === 'PICKUP' ? 'bg-indigo-600' : 'bg-gray-200 text-slate-700 hover:bg-gray-300'}
                            >
                                <Package size={16} className="mr-2" /> Retirada (Balcão)
                            </Button>
                            <Button
                                type="button"
                                onClick={() => handleOrderTypeChange('DELIVERY')}
                                className={formData.orderType === 'DELIVERY' ? 'bg-indigo-600' : 'bg-gray-200 text-slate-700 hover:bg-gray-300'}
                            >
                                <MapPin size={16} className="mr-2" /> Entrega
                            </Button>
                        </div>
                    </div>

                    {/* DADOS DO CLIENTE */}
                    <div className="bg-white p-5 rounded-lg shadow space-y-4">
                        <h2 className="text-lg font-semibold border-b pb-2 mb-3">Seus Dados</h2>

                        <div className="flex items-center space-x-2">
                            <User size={18} className="text-slate-500" />
                            <Input
                                name="customerName"
                                placeholder="Seu Nome Completo"
                                value={formData.customerName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Phone size={18} className="text-slate-500" />
                            <Input
                                name="customerPhone"
                                placeholder="Telefone (WhatsApp)"
                                value={formData.customerPhone}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {formData.orderType === 'DELIVERY' && (
                            <div className="flex items-center space-x-2 transition-all duration-300">
                                <MapPin size={18} className="text-slate-500" />
                                <Input
                                    name="customerAddress"
                                    placeholder="Endereço de Entrega (Rua, Nº, Bairro)"
                                    value={formData.customerAddress}
                                    onChange={handleChange}
                                    required={formData.orderType === 'DELIVERY'}
                                />
                            </div>
                        )}

                        <label htmlFor="paymentMethod" className="block text-sm font-medium text-slate-700 pt-2">
                            Forma de Pagamento:
                        </label>
                        <select
                            id="paymentMethod"
                            name="paymentMethod"
                            value={formData.paymentMethod}
                            onChange={handleChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                            <option value="CASH">Dinheiro</option>
                            <option value="DEBIT_CARD">Cartão de Débito</option>
                            <option value="CREDIT_CARD">Cartão de Crédito</option>
                            <option value="PIX">PIX</option>
                        </select>
                    </div>

                    <Button
                        type="submit"
                        isLoading={isLoading}
                        disabled={items.length === 0}
                        className="w-full bg-green-600 hover:bg-green-700 py-3 text-xl font-bold shadow-xl"
                    >
                        Enviar Pedido Agora
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default Checkout;