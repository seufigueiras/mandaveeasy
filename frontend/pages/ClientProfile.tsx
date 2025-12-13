import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import toast from 'react-hot-toast';
import { User, Phone, MapPin, Edit2, Save, X, Package } from 'lucide-react';

interface CustomerData {
    id: string;
    name: string;
    phone: string;
    address: string;
}

interface Order {
    id: string;
    status: string;
    total: number;
    created_at: string;
    items: any[];
}

const ClientProfile: React.FC = () => {
    const { restaurantId } = useParams<{ restaurantId: string }>();
    const navigate = useNavigate();

    const [showLoginModal, setShowLoginModal] = useState(true);
    const [phoneInput, setPhoneInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    const [customerData, setCustomerData] = useState<CustomerData | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'andamento' | 'finalizados'>('andamento');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [restaurantPhone, setRestaurantPhone] = useState('');
    
    const [editData, setEditData] = useState<Partial<CustomerData>>({
        name: '',
        phone: '',
        address: ''
    });

    // Buscar cliente pelo telefone
    const handlePhoneSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!phoneInput.trim()) {
            toast.error('Digite um telefone válido');
            return;
        }

        setIsSearching(true);

        try {
            // Buscar cliente
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .eq('phone', phoneInput)
                .single();

            if (customerError || !customer) {
                toast.error('Cliente não encontrado. Faça um pedido primeiro!');
                setIsSearching(false);
                return;
            }

            setCustomerData(customer);
            setEditData({
                name: customer.name,
                phone: customer.phone,
                address: customer.address
            });

            // Buscar pedidos do cliente
            const { data: customerOrders } = await supabase
                .from('orders')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .eq('customer_phone', phoneInput)
                .order('created_at', { ascending: false });

            setOrders(customerOrders || []);
            setShowLoginModal(false);

            toast.success('Dados carregados com sucesso!');
        } catch (error) {
            console.error(error);
            toast.error('Erro ao buscar dados');
        } finally {
            setIsSearching(false);
        }
    };

    // Buscar telefone do restaurante
    useEffect(() => {
        const fetchRestaurantPhone = async () => {
            try {
                const { data } = await supabase
                    .from('restaurants')
                    .select('phone')
                    .eq('id', restaurantId)
                    .single();
                
                if (data?.phone) {
                    setRestaurantPhone(data.phone);
                }
            } catch (error) {
                console.error('Erro ao buscar telefone do restaurante:', error);
            }
        };

        if (restaurantId) {
            fetchRestaurantPhone();
        }
    }, [restaurantId]);

    // Salvar alterações
    const handleSaveChanges = async () => {
        if (!editData.name || !editData.phone || !editData.address) {
            toast.error('Preencha todos os campos');
            return;
        }

        if (!customerData) return;

        setIsSaving(true);

        try {
            const { error } = await supabase
                .from('customers')
                .update({
                    name: editData.name,
                    phone: editData.phone,
                    address: editData.address
                })
                .eq('id', customerData.id);

            if (error) throw error;

            setCustomerData({
                ...customerData,
                name: editData.name || customerData.name,
                phone: editData.phone || customerData.phone,
                address: editData.address || customerData.address
            });

            setIsEditing(false);
            toast.success('Dados atualizados com sucesso!');
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar dados');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        setShowLoginModal(true);
        setCustomerData(null);
        setOrders([]);
        setPhoneInput('');
        setEditData({});
    };

    // Filtrar pedidos por status
    const ordersEmAndamento = orders.filter(o => o.status !== 'FINISHED' && o.status !== 'CANCELLED');
    const ordersFinalizados = orders.filter(o => o.status === 'FINISHED' || o.status === 'CANCELLED');

    // =========== MODAL DE LOGIN ===========
    if (showLoginModal) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                padding: '20px'
            }}>
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '40px',
                    maxWidth: '400px',
                    width: '100%',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#1f2937' }}>
                        Meu Perfil
                    </h2>
                    <p style={{ color: '#6b7280', marginBottom: '25px' }}>
                        Digite seu telefone para acessar seus dados
                    </p>

                    <form onSubmit={handlePhoneSearch} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px', color: '#374151' }}>
                                Telefone (WhatsApp)
                            </label>
                            <input
                                type="tel"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                placeholder="(11) 99999-9999"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSearching}
                            style={{
                                backgroundColor: '#4f46e5',
                                color: 'white',
                                padding: '10px',
                                borderRadius: '6px',
                                border: 'none',
                                fontWeight: '600',
                                cursor: isSearching ? 'not-allowed' : 'pointer',
                                opacity: isSearching ? 0.6 : 1
                            }}
                        >
                            {isSearching ? 'Buscando...' : 'Acessar Perfil'}
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate(`/cardapio/${restaurantId}`)}
                            style={{
                                backgroundColor: '#e5e7eb',
                                color: '#374151',
                                padding: '10px',
                                borderRadius: '6px',
                                border: 'none',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Voltar ao Cardápio
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // =========== PERFIL DO CLIENTE ===========
    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px', fontFamily: 'sans-serif' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid #e5e7eb', paddingBottom: '15px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>Meu Perfil</h1>
                <button
                    onClick={handleLogout}
                    style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600'
                    }}
                >
                    Sair
                </button>
            </div>

            {customerData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                    
                    {/* Card de Dados Pessoais */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        borderLeft: '4px solid #4f46e5',
                        gridColumn: '1 / -1'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>Dados Pessoais</h2>
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                style={{
                                    backgroundColor: isEditing ? '#ef4444' : '#4f46e5',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                {isEditing ? <X size={14} /> : <Edit2 size={14} />}
                                {isEditing ? 'Cancelar' : 'Editar'}
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            {/* Nome */}
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>
                                    <User size={16} /> Nome
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.name || ''}
                                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                ) : (
                                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                                        {customerData.name}
                                    </p>
                                )}
                            </div>

                            {/* Telefone */}
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>
                                    <Phone size={16} /> Telefone
                                </label>
                                {isEditing ? (
                                    <input
                                        type="tel"
                                        value={editData.phone || ''}
                                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                ) : (
                                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                                        {customerData.phone}
                                    </p>
                                )}
                            </div>

                            {/* Endereço */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>
                                    <MapPin size={16} /> Endereço (Rua, Bairro, Cidade, CEP)
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={editData.address || ''}
                                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            minHeight: '80px',
                                            boxSizing: 'border-box',
                                            fontFamily: 'sans-serif'
                                        }}
                                    />
                                ) : (
                                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
                                        {customerData.address || 'Não preenchido'}
                                    </p>
                                )}
                            </div>

                            {/* Botão Salvar */}
                            {isEditing && (
                                <button
                                    onClick={handleSaveChanges}
                                    disabled={isSaving}
                                    style={{
                                        gridColumn: '1 / -1',
                                        backgroundColor: '#10b981',
                                        color: 'white',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                        fontWeight: '600',
                                        opacity: isSaving ? 0.6 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Save size={16} />
                                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Abas de Pedidos */}
            <div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
                    <button
                        onClick={() => setActiveTab('andamento')}
                        style={{
                            padding: '12px 20px',
                            backgroundColor: activeTab === 'andamento' ? '#4f46e5' : 'transparent',
                            color: activeTab === 'andamento' ? 'white' : '#6b7280',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: '600',
                            borderBottom: activeTab === 'andamento' ? '3px solid #4f46e5' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Em Andamento ({ordersEmAndamento.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('finalizados')}
                        style={{
                            padding: '12px 20px',
                            backgroundColor: activeTab === 'finalizados' ? '#4f46e5' : 'transparent',
                            color: activeTab === 'finalizados' ? 'white' : '#6b7280',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: '600',
                            borderBottom: activeTab === 'finalizados' ? '3px solid #4f46e5' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Finalizados ({ordersFinalizados.length})
                    </button>
                </div>

                {/* Pedidos Em Andamento */}
                {activeTab === 'andamento' && (
                    <div>
                        {ordersEmAndamento.length === 0 ? (
                            <div style={{
                                backgroundColor: '#f3f4f6',
                                padding: '30px',
                                borderRadius: '12px',
                                textAlign: 'center',
                                color: '#6b7280'
                            }}>
                                <Package size={40} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                                <p>Você não tem pedidos em andamento</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {ordersEmAndamento.map((order) => (
                                    <div
                                        key={order.id}
                                        style={{
                                            backgroundColor: 'white',
                                            borderRadius: '12px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                            borderLeft: '4px solid #f59e0b'
                                        }}
                                    >
                                        <div
                                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                            style={{
                                                padding: '15px',
                                                cursor: 'pointer',
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '15px'
                                            }}
                                        >
                                            <div>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Pedido</p>
                                                <p style={{ fontWeight: '600', color: '#1f2937', margin: 0 }}>
                                                    #{String(order.id).substring(0, 8)}
                                                </p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Total</p>
                                                <p style={{ fontWeight: '600', color: '#10b981', margin: 0 }}>
                                                    R$ {order.total.toFixed(2)}
                                                </p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Status</p>
                                                <span style={{
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: '#fef3c7',
                                                    color: '#78350f'
                                                }}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Data/Hora</p>
                                                <p style={{ fontSize: '12px', color: '#1f2937', margin: 0 }}>
                                                    {new Date(order.created_at).toLocaleDateString('pt-BR')} {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Detalhes do Pedido - Aberto */}
                                        {expandedOrderId === order.id && (
                                            <div style={{
                                                padding: '15px',
                                                borderTop: '1px solid #e5e7eb',
                                                backgroundColor: '#f9fafb'
                                            }}>
                                                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '10px' }}>
                                                    Items do Pedido:
                                                </h4>
                                                <div style={{ display: 'grid', gap: '8px', marginBottom: '15px' }}>
                                                    {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                padding: '8px',
                                                                backgroundColor: 'white',
                                                                borderRadius: '6px',
                                                                fontSize: '13px'
                                                            }}
                                                        >
                                                            <div>
                                                                <span style={{ fontWeight: '600' }}>{item.quantity}x</span> {item.name}
                                                            </div>
                                                            <span style={{ color: '#10b981', fontWeight: '600' }}>
                                                                R$ {(item.price * item.quantity).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Botão WhatsApp */}
                                                {restaurantPhone && (
                                                    <a
                                                        href={`https://wa.me/55${restaurantPhone.replace(/\D/g, '')}?text=Olá, gostaria de acompanhar o pedido número ${String(order.id).substring(0, 8)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '8px',
                                                            width: '100%',
                                                            padding: '10px',
                                                            backgroundColor: '#25d366',
                                                            color: 'white',
                                                            borderRadius: '6px',
                                                            textDecoration: 'none',
                                                            fontWeight: '600',
                                                            fontSize: '13px',
                                                            border: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        📱 Acompanhar no WhatsApp
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Pedidos Finalizados */}
                {activeTab === 'finalizados' && (
                    <div>
                        {ordersFinalizados.length === 0 ? (
                            <div style={{
                                backgroundColor: '#f3f4f6',
                                padding: '30px',
                                borderRadius: '12px',
                                textAlign: 'center',
                                color: '#6b7280'
                            }}>
                                <Package size={40} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                                <p>Você não tem pedidos finalizados</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {ordersFinalizados.map((order) => (
                                    <div
                                        key={order.id}
                                        style={{
                                            backgroundColor: 'white',
                                            borderRadius: '12px',
                                            padding: '15px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                            borderLeft: order.status === 'FINISHED' ? '4px solid #10b981' : '4px solid #ef4444'
                                        }}
                                    >
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                            <div>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Pedido</p>
                                                <p style={{ fontWeight: '600', color: '#1f2937', margin: 0 }}>
                                                    #{String(order.id).substring(0, 8)}
                                                </p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Total</p>
                                                <p style={{ fontWeight: '600', color: '#10b981', margin: 0 }}>
                                                    R$ {order.total.toFixed(2)}
                                                </p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Status</p>
                                                <span style={{
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: order.status === 'FINISHED' ? '#d1fae5' : '#fee2e2',
                                                    color: order.status === 'FINISHED' ? '#065f46' : '#7f1d1d'
                                                }}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Data/Hora</p>
                                                <p style={{ fontSize: '12px', color: '#1f2937', margin: 0 }}>
                                                    {new Date(order.created_at).toLocaleDateString('pt-BR')} {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Botão Voltar */}
            <button
                onClick={() => navigate(`/cardapio/${restaurantId}`)}
                style={{
                    width: '100%',
                    marginTop: '20px',
                    padding: '12px',
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                }}
            >
                Voltar ao Cardápio
            </button>
        </div>
    );
};

export default ClientProfile;