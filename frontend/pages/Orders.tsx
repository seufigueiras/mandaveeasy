import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Order, OrderStatus, Product, OrderItem, PaymentMethod, OrderOrigin } from '../types'; 
import toast from 'react-hot-toast';
import { Clock, CheckCircle, Truck, Printer, Plus, Trash2 } from 'lucide-react';

const Orders: React.FC = () => {
    const { restaurantId, playNewOrderAlert, stopAlert, audioEnabled, enableAudio } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [restaurantName, setRestaurantName] = useState('MANDAVE DELIVERY');
    
    const [showModal, setShowModal] = useState(false);
    const [newOrder, setNewOrder] = useState<{
        customer_name: string;
        customer_phone: string;
        delivery_address: string;
        payment_method: PaymentMethod;
        items: OrderItem[];
        origin: OrderOrigin;
    }>({
        customer_name: '',
        customer_phone: '',
        delivery_address: '',
        payment_method: 'cash',
        origin: 'table',
        items: []
    });
    
    const [selectedProduct, setSelectedProduct] = useState('');
    const [itemQuantity, setItemQuantity] = useState(1);
    const [itemPrice, setItemPrice] = useState<number | ''>('');

    const fetchOrders = useCallback(async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('*, items')
            .eq('restaurant_id', restaurantId)
            .not('status', 'in', '("FINISHED", "CANCELLED")')
            .order('created_at', { ascending: false });

        if (error) toast.error('Erro ao carregar pedidos');
        else setOrders(data as Order[] || []);
    }, [restaurantId]);

    const fetchProductsAndRestaurant = async () => {
        if (!restaurantId) return;

        const { data: productData } = await supabase.from('products').select('*').eq('restaurant_id', restaurantId);
        if(productData) setProducts(productData as Product[]);
        
        const { data: restData } = await supabase.from('restaurants').select('name').eq('id', restaurantId).single();
        if(restData) setRestaurantName(restData.name || 'MANDAVE DELIVERY');
    }

    useEffect(() => {
        if(restaurantId) {
            fetchOrders();
            fetchProductsAndRestaurant();
            
            const channel = supabase
            .channel('public:orders')
            .on(
            'postgres_changes',
            {
            event: '*', 
            schema: 'public',
            table: 'orders',
            filter: `restaurant_id=eq.${restaurantId}`,
            },
            (payload) => {
            if (payload.eventType === 'INSERT') {
                const newOrderData = payload.new as Order;
                
                // 🔍 LOGS DE DEBUG
                console.log('🆕 NOVO PEDIDO DETECTADO!');
                console.log('📦 Dados do pedido:', newOrderData);
                console.log('📊 Status:', newOrderData.status);
                console.log('🌐 Origin:', newOrderData.origin);
                console.log('🔊 Audio habilitado?', audioEnabled);
                
                fetchOrders();
                
                const statusUpper = newOrderData.status?.toUpperCase();
                const originLower = newOrderData.origin?.toLowerCase();
                
                console.log('✅ Status Upper:', statusUpper);
                console.log('✅ Origin Lower:', originLower);
                
                // CORREÇÃO: Incluindo 'whatsapp' para tocar o alerta de novo pedido
                if (statusUpper === 'PENDING' && (originLower === 'cardapio' || originLower === 'whatsapp')) {
                    console.log('🔔 TENTANDO TOCAR O SOM!');
                    playNewOrderAlert();
                    toast.success(`Novo pedido de ${originLower === 'cardapio' ? 'cardápio' : 'WhatsApp'} recebido!`);
                } else if (statusUpper === 'PENDING') {
                    console.log('📝 Pedido manual ou outra origem');
                    toast.success('Novo pedido recebido!');
                } else {
                    console.log('⚠️ Condição não atendida para tocar som');
                    console.log(`Status: ${statusUpper}, Origin: ${originLower}`);
                }
            } else if (payload.eventType === 'UPDATE') {
                const updatedOrder = payload.new as Order;
                setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
            } else if (payload.eventType === 'DELETE') {
                    setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
            }
            }
            )
            .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [restaurantId, fetchOrders, playNewOrderAlert, audioEnabled]);

    const updateStatus = async (orderId: number, newStatus: OrderStatus) => {
        const statusUpperCase = newStatus.toUpperCase();
        const { error } = await supabase.from('orders').update({ status: statusUpperCase }).eq('id', orderId);

        if (error) toast.error('Erro ao atualizar');
        else {
            toast.success(`Status: ${statusUpperCase}`);
            setOrders(prev => prev.map(o => o.id === orderId ? {...o, status: statusUpperCase} : o));
            
            // Para o alerta se o pedido foi aceito
            if (statusUpperCase === 'ACCEPTED') {
                stopAlert();
            }
        }
    };

    const handleDelete = async (orderId: number) => {
        if(!confirm("Excluir este pedido permanentemente?")) return;
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if(error) {
            toast.error("Erro ao excluir");
        } else {
            toast.success("Pedido excluído");
            setOrders(prev => prev.filter(o => o.id !== orderId));
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewOrder(prev => ({ ...prev, [name]: value as any }));
    };

    const handleProductSelect = (productId: string) => {
        setSelectedProduct(productId);
        if (productId) {
            const product = products.find(p => p.id === productId);
            setItemPrice(product ? product.price : ''); 
        } else {
            setItemPrice('');
        }
    };

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if(newOrder.items.length === 0) return toast.error("Adicione itens ao pedido");
        if(newOrder.origin === 'manual' && !newOrder.delivery_address) return toast.error("Endereço obrigatório para entrega");

        const total = newOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const payload = {
            restaurant_id: restaurantId,
            status: 'PENDING', 
            total, 
            items: newOrder.items,
            customer_name: newOrder.customer_name,
            customer_phone: newOrder.customer_phone,
            delivery_address: newOrder.delivery_address,
            payment_method: newOrder.payment_method,
            origin: newOrder.origin
        };

        const { data, error } = await supabase.from('orders').insert([payload]).select().single();

        if(error) {
            toast.error("Erro ao criar pedido");
            console.error(error);
        } else if (data) {
            toast.success("Pedido criado com sucesso!");
            setShowModal(false);
            setNewOrder({
                customer_name: '', customer_phone: '', delivery_address: '',
                payment_method: 'cash', items: [], origin: 'table'
            });
        }
    };

    const addItemToOrder = () => {
        const itemPriceNumber = typeof itemPrice === 'number' ? itemPrice : (parseFloat(String(itemPrice)) || 0);

        if(!selectedProduct || itemPriceNumber <= 0) {
            return toast.error("Selecione um produto e insira um preço válido (maior que zero).");
        }
        
        const product = products.find(p => p.id === selectedProduct);
        if(!product) return;

        const newItem: OrderItem = {
            product_id: product.id,
            name: product.name,
            quantity: itemQuantity,
            price: itemPriceNumber
        };
        setNewOrder({...newOrder, items: [...newOrder.items, newItem]});
        
        setSelectedProduct('');
        setItemQuantity(1);
        setItemPrice(''); 
    };

    const removeItemFromOrder = (indexToRemove: number) => {
        setNewOrder(prev => ({
            ...prev,
            items: prev.items.filter((_, index) => index !== indexToRemove)
        }));
    };

    const handlePrint = (order: Order) => {
        const deliveryAddress = order.delivery_address || '';
        const hasAddress = !!order.delivery_address;

        const itemsHtml = order.items.map((item, idx) => {
            const subtotal = (item.price * item.quantity).toFixed(2);
            return `<tr><td style="width:10%; text-align:center;">${item.quantity}x</td><td>${item.name}</td><td style="width:25%; text-align:right;">R$ ${subtotal}</td></tr>`;
        }).join('');

        const totalValue = order.total ? order.total.toFixed(2) : 'N/A';
        
        let paymentDisplay = 'NÃO INFORMADO';
        if (order.payment_method) {
            const method = order.payment_method.toUpperCase();
            if (method === 'DEBIT_CARD') paymentDisplay = 'CARTÃO DE DÉBITO';
            else if (method === 'CREDIT_CARD') paymentDisplay = 'CARTÃO DE CRÉDITO';
            else paymentDisplay = method;
        }

        const serviceType = hasAddress ? 'PEDIDO PARA ENTREGA' : 'PEDIDO PARA RETIRADA';
        const addressSection = hasAddress ? `<p style="margin-top: 8px; font-weight: bold;">ENDEREÇO:</p><p>${deliveryAddress}</p>` : '';
        const phoneSection = order.customer_phone ? `<p>Tel: ${order.customer_phone}</p>` : '';
        const orderIdStr = order.id.toString().substring(0, 8);
        const dateStr = new Date(order.created_at).toLocaleString('pt-BR');
        const customerName = order.customer_name || 'BALCÃO';

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Recibo #${orderIdStr}</title>
    <style>
        @page { size: 80mm auto; margin: 0; }
        body { margin: 0; padding: 5mm; font-family: monospace; font-size: 10pt; line-height: 1.2; }
        table { border-collapse: collapse; margin-top: 5px; width: 100%; table-layout: fixed; }
        .center { text-align: center; }
        .total { font-size: 1.2em; font-weight: bold; }
    </style>
</head>
<body>
    <div class="center" style="font-weight: bold; font-size: 1.1em; border-bottom: 1px dashed #333; padding-bottom: 5px; margin-bottom: 10px;">
        ${restaurantName.toUpperCase()}
    </div>
    
    <div class="center" style="font-size: 0.9em; margin-bottom: 10px; font-weight: bold;">
        ${serviceType}
    </div>

    <div style="font-size: 0.9em; margin-bottom: 10px; border-top: 1px dashed #333; padding-top: 8px;">
        <p>PEDIDO #: **${orderIdStr}**</p>
        <p>Data: ${dateStr}</p>
        <p>Cliente: ${customerName}</p>
        ${phoneSection}
        ${addressSection}
    </div>
    
    <table style="border-top: 1px dashed #333; padding-top: 5px;">
        <thead>
            <tr style="font-weight: bold; border-bottom: 1px solid #333; font-size: 0.9em;">
                <td style="width:10%; text-align:center;">Qtd</td>
                <td>Item</td>
                <td style="width:25%; text-align: right;">Valor</td>
            </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
    </table>
    
    <div style="border-top: 1px dashed #333; margin-top: 10px; padding-top: 10px; text-align: right;" class="total">
        TOTAL: R$ ${totalValue}
    </div>
    <div class="center" style="margin-top: 15px; font-size: 0.8em;">
        Pagamento: ${paymentDisplay}
        <p style="margin-top: 5px;">Obrigado pela preferência!</p>
    </div>
</body>
</html>`;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        const printAndClose = () => {
            printWindow.focus();
            printWindow.print();
            setTimeout(() => {
                if (!printWindow.closed) {
                    printWindow.close();
                }
            }, 100); 
        };

        printWindow.onload = printAndClose;
        setTimeout(printAndClose, 500); 
    };

    const KanbanColumn = ({ title, status, icon: Icon }: { title: string, status: OrderStatus, icon: any }) => {
        const statusUpper = status.toUpperCase(); 
        const columnOrders = orders.filter((o) => o.status === status || o.status === statusUpper);
        
        return (
            <div className="flex-1 min-w-[320px] bg-slate-100 p-4 rounded-lg flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                        <Icon size={18} /> {title}
                    </h3>
                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
                        {columnOrders.length}
                    </span>
                </div>
                
                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                    {columnOrders.map((order) => (
                        <Card key={order.id} className="shadow-sm hover:shadow-md transition-shadow relative group">
                            <CardContent className="p-4">
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button onClick={() => handleDelete(order.id)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={14}/></button>
                                </div>

                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-lg">#{order.id.toString().substring(0, 8)}</span>
                                    <Badge variant={
                                        order.origin === 'whatsapp' ? 'success' : 
                                        order.origin === 'cardapio' ? 'info' :
                                        'warning'
                                    }>
                                        {order.origin === 'whatsapp' ? 'Zap' : 
                                         order.origin === 'cardapio' ? 'Cardápio' : 
                                        'Manual'} 
                                    </Badge>
                                </div>
                                
                                <div className="text-sm text-slate-600 mb-2">
                                    <p className="font-medium">{order.customer_name || 'Cliente Balcão'}</p>
                                    {order.delivery_address && (
                                        <p className="text-xs italic mt-1 truncate">
                                            {order.delivery_address}
                                        </p>
                                    )}
                                </div>

                                <div className="border-t border-b border-slate-100 py-2 my-2 space-y-1">
                                    {Array.isArray(order.items) && order.items.map((item: OrderItem, idx: number) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span className="text-slate-500">{(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-between items-center font-bold mb-3">
                                    <span>Total ({order.payment_method === 'DEBIT_CARD' ? 'C.Débito' : order.payment_method === 'CREDIT_CARD' ? 'C.Crédito' : order.payment_method.toUpperCase()})</span>
                                    <span>R$ {order.total ? order.total.toFixed(2) : 'N/A'}</span>
                                </div>

                                <div className="flex gap-2">
                                    {status === 'pending' && <Button size="sm" className="w-full bg-blue-600" onClick={() => updateStatus(order.id, 'accepted')}>Aceitar</Button>}
                                    {status === 'accepted' && <Button size="sm" className="w-full bg-orange-500" onClick={() => updateStatus(order.id, 'preparing')}>Preparar</Button>}
                                    {status === 'preparing' && <Button size="sm" className="w-full bg-purple-500" onClick={() => updateStatus(order.id, 'delivery')}>Enviar</Button>}
                                    {status === 'delivery' && <Button size="sm" className="w-full bg-green-600" onClick={() => updateStatus(order.id, 'finished')}>Concluir</Button>}
                                    
                                    <Button size="sm" variant="secondary" onClick={() => handlePrint(order)}>
                                        <Printer size={16} />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <React.Fragment>
            <div className="app-content h-[calc(100vh-100px)] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestão de Pedidos</h1>
                    <div className="flex gap-3">
                        {!audioEnabled && (
                            <Button onClick={enableAudio} className="bg-yellow-600 hover:bg-yellow-700 flex items-center gap-2">
                                🔊 Ativar Som
                            </Button>
                        )}
                        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2">
                            <Plus size={18} /> Novo Pedido Manual
                        </Button>
                    </div>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 h-full">
                    <KanbanColumn title="Pendente" status="pending" icon={Clock} />
                    <KanbanColumn title="Aceito" status="accepted" icon={CheckCircle} />
                    <KanbanColumn title="Preparando" status="preparing" icon={Clock} />
                    <KanbanColumn title="Saiu p/ Entrega" status="delivery" icon={Truck} />
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h2 className="text-xl font-bold">Novo Pedido Manual</h2>
                            <button 
                                onClick={() => setShowModal(false)} 
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreateOrder} className="space-y-4">
                            
                            <h3 className="font-semibold text-lg border-b pb-1">Detalhes do Cliente</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nome do Cliente</label>
                                    <Input 
                                        name="customer_name"
                                        value={newOrder.customer_name} 
                                        onChange={handleInputChange} 
                                        placeholder="Nome" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Telefone</label>
                                    <Input 
                                        name="customer_phone"
                                        value={newOrder.customer_phone} 
                                        onChange={handleInputChange} 
                                        placeholder="(DDD) 9xxxx-xxxx" 
                                    />
                                </div>
                            </div>
                            
                            <h3 className="font-semibold text-lg border-b pb-1 pt-2">Origem e Pagamento</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Tipo de Pedido</label>
                                    <select 
                                        name="origin"
                                        value={newOrder.origin} 
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="table">Mesa / Balcão</option>
                                        <option value="manual">Delivery Manual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Pagamento</label>
                                    <select 
                                        name="payment_method"
                                        value={newOrder.payment_method} 
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="cash">Dinheiro</option>
                                        <option value="DEBIT_CARD">Cartão de Débito</option> 
                                        <option value="CREDIT_CARD">Cartão de Crédito</option> 
                                        <option value="PIX">PIX</option>
                                    </select>
                                </div>
                            </div>

                            {newOrder.origin === 'manual' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Endereço de Entrega (Obrigatório)</label>
                                    <Input 
                                        name="delivery_address"
                                        value={newOrder.delivery_address} 
                                        onChange={handleInputChange} 
                                        placeholder="Rua, Número, Bairro" 
                                        required={newOrder.origin === 'manual'}
                                    />
                                </div>
                            )}
                            
                            <h3 className="font-semibold text-lg border-b pb-1 pt-2">Itens (Total: R$ {newOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)})</h3>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700">Produto</label>
                                    <select
                                        value={selectedProduct}
                                        onChange={(e) => handleProductSelect(e.target.value)} 
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Selecione um item</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (R$ {p.price.toFixed(2)})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="w-24">
                                    <label className="block text-sm font-medium text-gray-700">Preço Unit.</label>
                                    <input 
                                        type="number"
                                        step="0.01" 
                                        value={itemPrice} 
                                        onChange={(e) => {
                                            if (e.target.value === '') {
                                                setItemPrice(''); 
                                            } else {
                                                const parsedValue = parseFloat(e.target.value);
                                                setItemPrice(isNaN(parsedValue) ? 0 : parsedValue);
                                            }
                                        }} 
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="w-20">
                                    <label className="block text-sm font-medium text-gray-700">Qtd</label>
                                    <Input 
                                        type="number"
                                        min="1"
                                        value={itemQuantity} 
                                        onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)} 
                                    />
                                </div>
                                <Button type="button" onClick={addItemToOrder} disabled={!selectedProduct || itemPrice === '' || (typeof itemPrice === 'number' && itemPrice <= 0)}>Adicionar</Button>
                            </div>
                            
                            <ul className="space-y-1 text-sm pt-2">
                                {newOrder.items.map((item, index) => (
                                    <li key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                        <span>{item.quantity}x **{item.name}** (@ R$ {item.price.toFixed(2)})</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                                            <button 
                                                type="button" 
                                                onClick={() => removeItemFromOrder(index)} 
                                                className="text-red-500 hover:text-red-700 p-1"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="pt-4 border-t mt-4">
                                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                                    Registrar Pedido Manual (R$ {newOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)})
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

export default Orders;