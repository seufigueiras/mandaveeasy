import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import toast from 'react-hot-toast';
import { useCart } from '../contexts/CartContext';
import { Home, Clock, Phone, MapPin, ShoppingBag, Package, User, GripVertical, XCircle } from 'lucide-react';

type Product = {
    id: string;
    name: string;
    price: number;
    category: string;
    description: string | null; 
    image_url: string | null;
    is_active: boolean; 
    is_visible: boolean;
    display_order: number;
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
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [draggedItem, setDraggedItem] = useState<string | null>(null);
    const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    
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
            checkIfAdmin();
            fetchRestaurantInfo();
            fetchPublicProducts();
        } else {
            setLoading(false);
            toast.error("ID do restaurante não encontrado na URL.");
        }
    }, [restaurantId]);

    const checkIfAdmin = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAdmin(!!session?.user);
    };

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
            .order('display_order', { ascending: true });

        if (data) {
            setProducts(data as Product[]);
            
            const uniqueCategories = Array.from(
                new Set(data.map(p => p.category))
            );
            
            setCategories(uniqueCategories);
            
            if (uniqueCategories.length > 0) {
                setSelectedCategory(uniqueCategories[0]);
            }
        }
        setLoading(false);
    };

    const filteredProducts = products.filter(p => p.category === selectedCategory);

    // DRAG & DROP - PRODUTOS
    const handleDragStartProduct = (e: React.DragEvent, productId: string) => {
        if (!isAdmin) return;
        setDraggedItem(productId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOverProduct = (e: React.DragEvent) => {
        if (!isAdmin) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropProduct = async (e: React.DragEvent, targetProductId: string) => {
        if (!isAdmin || !draggedItem) return;
        e.preventDefault();

        const draggedProduct = products.find(p => p.id === draggedItem);
        const targetProduct = products.find(p => p.id === targetProductId);

        if (!draggedProduct || !targetProduct || draggedProduct.category !== targetProduct.category) {
            setDraggedItem(null);
            return;
        }

        const updatedProducts = [...products];
        const draggedIndex = updatedProducts.findIndex(p => p.id === draggedItem);
        const targetIndex = updatedProducts.findIndex(p => p.id === targetProductId);

        const [removed] = updatedProducts.splice(draggedIndex, 1);
        updatedProducts.splice(targetIndex, 0, removed);

        const categoryProducts = updatedProducts.filter(p => p.category === selectedCategory);
        for (let i = 0; i < categoryProducts.length; i++) {
            categoryProducts[i].display_order = i;
            
            await supabase
                .from('products')
                .update({ display_order: i })
                .eq('id', categoryProducts[i].id);
        }

        setProducts(updatedProducts);
        setDraggedItem(null);
        toast.success('Ordem atualizada!');
    };

    // DRAG & DROP - CATEGORIAS
    const handleDragStartCategory = (e: React.DragEvent, category: string) => {
        if (!isAdmin) return;
        setDraggedCategory(category);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOverCategory = (e: React.DragEvent) => {
        if (!isAdmin) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropCategory = async (e: React.DragEvent, targetCategory: string) => {
        if (!isAdmin || !draggedCategory) return;
        e.preventDefault();

        const draggedIndex = categories.indexOf(draggedCategory);
        const targetIndex = categories.indexOf(targetCategory);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedCategory(null);
            return;
        }

        const updatedCategories = [...categories];
        const [removed] = updatedCategories.splice(draggedIndex, 1);
        updatedCategories.splice(targetIndex, 0, removed);

        const reorderedProducts = [...products];
        updatedCategories.forEach((cat, catIndex) => {
            const categoryProducts = reorderedProducts.filter(p => p.category === cat);
            categoryProducts.forEach((product, prodIndex) => {
                product.display_order = catIndex * 1000 + prodIndex;
            });
        });

        for (const product of reorderedProducts) {
            await supabase
                .from('products')
                .update({ display_order: product.display_order })
                .eq('id', product.id);
        }

        setCategories(updatedCategories);
        setProducts(reorderedProducts);
        setDraggedCategory(null);
        toast.success('Ordem das categorias atualizada!');
    };

    const handleAddToCart = (product: Product) => {
        if (!isStoreOpen()) {
            toast.error('Loja fechada! Não é possível adicionar produtos no momento.');
            return;
        }
        addItem({
            product_id: product.id,
            name: product.name,
            price: product.price
        });
    };

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

    const getTodayHours = (): OpeningHour | null => {
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const todayIndex = new Date().getDay();
        const todayName = days[todayIndex];
        return restaurantData.opening_hours.find(h => h.day === todayName) || null;
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

                    {todayHours && (
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={16} />
                            {todayHours.is_open ? `${todayHours.open_time} - ${todayHours.close_time}` : 'Fechado hoje'}
                        </div>
                    )}

                    {restaurantData.address && (
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <MapPin size={16} style={{ marginTop: '2px', minWidth: '16px' }} />
                            <span>{restaurantData.address}</span>
                        </div>
                    )}

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

                {/* Abas de Categorias */}
                <div style={{ borderTop: '1px solid #e5e7eb', backgroundColor: 'white', padding: '12px 20px', overflowX: 'auto' }}>
                    {isAdmin && (
                        <div style={{ fontSize: '12px', color: '#3b82f6', marginBottom: '8px' }}>
                            🔒 Modo Admin: Arraste as categorias para reordenar
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', whiteSpace: 'nowrap' }}>
                        {categories.map((category) => (
                            <button
                                key={category}
                                draggable={isAdmin}
                                onDragStart={(e) => handleDragStartCategory(e, category)}
                                onDragOver={handleDragOverCategory}
                                onDrop={(e) => handleDropCategory(e, category)}
                                onClick={() => setSelectedCategory(category)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: 'none',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    cursor: isAdmin ? 'move' : 'pointer',
                                    transition: 'all 0.2s',
                                    backgroundColor: selectedCategory === category ? '#f97316' : '#f3f4f6',
                                    color: selectedCategory === category ? 'white' : '#374151',
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedCategory !== category) {
                                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedCategory !== category) {
                                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                                    }
                                }}
                            >
                                {isAdmin && <GripVertical size={14} />}
                                {category}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Alerta quando loja está fechada */}
            {!isOpen && (
                <div style={{
                    margin: '20px',
                    padding: '16px',
                    backgroundColor: '#fee2e2',
                    border: '2px solid #ef4444',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <XCircle size={24} color="#ef4444" />
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#991b1b' }}>
                            Loja Fechada
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#7f1d1d' }}>
                            Não é possível fazer pedidos no momento. {todayHours?.is_open && `Voltamos às ${todayHours.open_time}`}
                        </p>
                    </div>
                </div>
            )}

            {/* Lista de Produtos */}
            <div style={{ maxWidth: '100%', padding: '20px' }}>
                {isAdmin && (
                    <div style={{ 
                        padding: '12px', 
                        backgroundColor: '#dbeafe', 
                        border: '1px solid #93c5fd', 
                        borderRadius: '8px', 
                        marginBottom: '16px',
                        fontSize: '14px',
                        color: '#1e40af'
                    }}>
                        <strong>🔒 Modo Admin:</strong> Arraste produtos para reordená-los dentro da categoria
                    </div>
                )}

                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>
                    {selectedCategory}
                </h2>

                {filteredProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                        <ShoppingBag size={48} style={{ margin: '0 auto 16px' }} />
                        <p>Nenhum produto nesta categoria</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {filteredProducts.map(product => (
                            <div 
                                key={product.id}
                                draggable={isAdmin}
                                onDragStart={(e) => handleDragStartProduct(e, product.id)}
                                onDragOver={handleDragOverProduct}
                                onDrop={(e) => handleDropProduct(e, product.id)}
                                style={{
                                    backgroundColor: 'white',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    display: 'flex',
                                    gap: '12px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    transition: 'box-shadow 0.2s, opacity 0.2s',
                                    cursor: isAdmin ? 'move' : 'default',
                                    opacity: !isOpen ? 0.5 : (draggedItem === product.id ? 0.5 : 1),
                                    pointerEvents: !isOpen && !isAdmin ? 'none' : 'auto',
                                    position: 'relative',
                                }}
                                onMouseEnter={(e) => {
                                    if (isOpen) {
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                                    }
                                }}
                                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)')}
                            >
                                {/* Overlay quando fechado */}
                                {!isOpen && !isAdmin && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                        borderRadius: '12px',
                                        zIndex: 1,
                                    }} />
                                )}

                                {isAdmin && (
                                    <div style={{ display: 'flex', alignItems: 'center', color: '#9ca3af' }}>
                                        <GripVertical size={20} />
                                    </div>
                                )}

                                <div style={{ minWidth: '90px', maxWidth: '90px' }}>
                                    {product.image_url ? (
                                        <img 
                                            src={product.image_url}
                                            alt={product.name}
                                            style={{
                                                width: '90px',
                                                height: '90px',
                                                objectFit: 'cover',
                                                borderRadius: '8px',
                                                filter: !isOpen ? 'grayscale(50%)' : 'none'
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
                                            disabled={!isOpen}
                                            style={{
                                                backgroundColor: isOpen ? '#4f46e5' : '#9ca3af',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '6px 12px',
                                                cursor: isOpen ? 'pointer' : 'not-allowed',
                                                fontWeight: '600',
                                                fontSize: '14px',
                                                transition: 'background-color 0.2s',
                                                position: 'relative',
                                                zIndex: 2,
                                            }}
                                            onMouseEnter={(e) => {
                                                if (isOpen) {
                                                    e.currentTarget.style.backgroundColor = '#3b39b0';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (isOpen) {
                                                    e.currentTarget.style.backgroundColor = '#4f46e5';
                                                }
                                            }}
                                        >
                                            {isOpen ? '+ Adicionar' : 'Indisponível'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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