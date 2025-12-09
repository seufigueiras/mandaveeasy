import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import toast from 'react-hot-toast';
import { useCart } from '../contexts/CartContext';
import { Home, Clock, Phone, MapPin, ShoppingBag, Package, User } from 'lucide-react';

type Product = {
    id: string;
    name: string;
    price: number;
    category: string;
    description: string | null; 
    image_url: string | null;
    is_active: boolean; 
    is_visible: boolean; 
};

type GroupedProducts = {
    [categoryName: string]: Product[];
};

type OpeningHour = {
    day: string;
    is_open: boolean;
    open_time: string;
    close_time: string;
};

const PublicMenu: React.FC = () => {
    const { restaurantId } = useParams<{ restaurantId: string }>();
    const navigate = useNavigate();
    const { items: cartItems, total, addItem } = useCart(); 
    
    const [loading, setLoading] = useState(true);
    const [groupedProducts, setGroupedProducts] = useState<GroupedProducts>({});
    const [restaurantData, setRestaurantData] = useState({
        name: 'Cardápio Digital',
        address: '',
        phone: '',
        image_url: '',
        delivery_fee: 0,
        opening_hours: [] as OpeningHour[]
    });

    useEffect(() => {
        if (restaurantId) {
            fetchRestaurantInfo();
            fetchPublicProducts();
        } else {
            setLoading(false);
            toast.error("ID do restaurante não encontrado na URL.");
        }
    }, [restaurantId]);

    const fetchRestaurantInfo = async () => {
        const { data } = await supabase
            .from('restaurants')
            .select('name, address, phone, image_url, delivery_fee, opening_hours')
            .eq('id', restaurantId)
            .single();
        
        if (data) {
            setRestaurantData({
                name: data.name || 'Cardápio Digital',
                address: data.address || '',
                phone: data.phone || '',
                image_url: data.image_url || '',
                delivery_fee: data.delivery_fee || 0,
                opening_hours: data.opening_hours || []
            });
        }
    };

    const fetchPublicProducts = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('products')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('is_active', true)
            .eq('is_visible', true)
            .order('category', { ascending: true }) 
            .order('name', { ascending: true }); 

        if (data) {
            const groups: GroupedProducts = data.reduce((acc, product) => {
                const category = product.category || 'Outros'; 
                if (!acc[category]) acc[category] = [];
                acc[category].push(product as Product);
                return acc;
            }, {} as GroupedProducts);
            setGroupedProducts(groups);
        }
        setLoading(false);
    };

    // Verifica se a loja está aberta agora
    const isStoreOpen = (): boolean => {
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const now = new Date();
        const todayIndex = now.getDay();
        const todayName = days[todayIndex];
        
        const today = restaurantData.opening_hours.find(h => h.day === todayName);
        if (!today || !today.is_open) return false;
        
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        return currentTime >= today.open_time && currentTime <= today.close_time;
    };

    // Pega os horários de hoje
    const getTodayHours = (): OpeningHour | null => {
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const todayIndex = new Date().getDay();
        const todayName = days[todayIndex];
        return restaurantData.opening_hours.find(h => h.day === todayName) || null;
    };

    const handleAddToCart = (product: Product) => {
        addItem({
            product_id: product.id,
            name: product.name,
            price: product.price
        });
    };

    const totalItemsInCart = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const todayHours = getTodayHours();
    const isOpen = isStoreOpen();

    if (loading) {
        return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Carregando Cardápio...</div>;
    }

    return (
        <div style={{ paddingBottom: '120px', fontFamily: 'sans-serif', backgroundColor: '#f9fafb' }}>
            
            {/* Header com Foto do Restaurante */}
            <div style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                {restaurantData.image_url && (
                    <img 
                        src={restaurantData.image_url} 
                        alt={restaurantData.name}
                        style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                    />
                )}
                
                {/* Info Restaurante */}
                <div style={{ padding: '20px', backgroundColor: 'white' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#1f2937' }}>
                        {restaurantData.name}
                    </h1>

                    {/* Status Aberto/Fechado */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: isOpen ? '#10b981' : '#ef4444'
                        }}></div>
                        <span style={{ fontWeight: '600', color: isOpen ? '#10b981' : '#ef4444' }}>
                            {isOpen ? 'Aberto agora' : 'Fechado'}
                        </span>
                    </div>

                    {/* Horários */}
                    {todayHours && (
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={16} />
                            {todayHours.is_open ? `${todayHours.open_time} - ${todayHours.close_time}` : 'Fechado hoje'}
                        </div>
                    )}

                    {/* Endereço */}
                    {restaurantData.address && (
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <MapPin size={16} style={{ marginTop: '2px', minWidth: '16px' }} />
                            <span>{restaurantData.address}</span>
                        </div>
                    )}

                    {/* Telefone/WhatsApp */}
                    {restaurantData.phone && (
                        <a 
                            href={`https://wa.me/55${restaurantData.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '14px', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                        >
                            <Phone size={16} />
                            {restaurantData.phone}
                        </a>
                    )}
                </div>
            </div>

            {/* Cardápio */}
            <div style={{ maxWidth: '100%', padding: '20px' }}>
                {Object.keys(groupedProducts).map(categoryName => (
                    <div key={categoryName} style={{ marginBottom: '30px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '15px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                            {categoryName}
                        </h2>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {groupedProducts[categoryName].map(product => (
                                <div 
                                    key={product.id}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: '12px',
                                        padding: '12px',
                                        display: 'flex',
                                        gap: '12px',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                        transition: 'box-shadow 0.2s'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)')}
                                >
                                    {/* Imagem */}
                                    <div style={{ minWidth: '90px', maxWidth: '90px' }}>
                                        {product.image_url ? (
                                            <img 
                                                src={product.image_url}
                                                alt={product.name}
                                                style={{
                                                    width: '90px',
                                                    height: '90px',
                                                    objectFit: 'cover',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '90px',
                                                height: '90px',
                                                borderRadius: '8px',
                                                backgroundColor: '#e5e7eb',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#9ca3af'
                                            }}>
                                                Sem Foto
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                                                {product.name}
                                            </h3>
                                            {product.description && (
                                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                                                    {product.description}
                                                </p>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '600', color: '#10b981', fontSize: '16px' }}>
                                                R$ {product.price.toFixed(2)}
                                            </span>
                                            <button 
                                                onClick={() => handleAddToCart(product)}
                                                style={{
                                                    backgroundColor: '#4f46e5',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '6px 12px',
                                                    cursor: 'pointer',
                                                    fontWeight: '600',
                                                    fontSize: '14px',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3b39b0')}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4f46e5')}
                                            >
                                                + Adicionar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Bar - Carrinho */}
            {totalItemsInCart > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: '60px',
                    left: 0,
                    right: 0,
                    padding: '15px',
                    backgroundColor: 'white',
                    borderTop: '2px solid #4f46e5',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
                    zIndex: 50
                }}>
                    <button 
                        onClick={() => navigate(`/checkout/${restaurantId}`)}
                        style={{
                            width: '100%',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShoppingBag size={20} />
                            Ver Carrinho ({totalItemsInCart})
                        </span>
                        <span>R$ {total.toFixed(2)}</span>
                    </button>
                </div>
            )}

            {/* Bottom Navigation Bar */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'white',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-around',
                padding: '8px 0',
                zIndex: 40,
                boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
            }}>
                <button
                    onClick={() => window.location.href = window.location.href}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        color: '#4f46e5',
                        transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#3b39b0')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#4f46e5')}
                >
                    <Home size={24} />
                    <span style={{ fontSize: '11px', fontWeight: '600' }}>Home</span>
                </button>

                <button
                    onClick={() => navigate(`/pedidos/${restaurantId}`)}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        color: '#6b7280',
                        transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#374151')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                >
                    <Package size={24} />
                    <span style={{ fontSize: '11px', fontWeight: '600' }}>Pedidos</span>
                </button>

                <button
                    onClick={() => navigate(`/perfil/${restaurantId}`)}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        color: '#6b7280',
                        transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#374151')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                >
                    <User size={24} />
                    <span style={{ fontSize: '11px', fontWeight: '600' }}>Perfil</span>
                </button>
            </div>
        </div>
    );
};

export default PublicMenu;