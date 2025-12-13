// mandavenovo/contexts/CartContext.tsx

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';

// 🟢 Tipagem do Item do Carrinho (Espelha a estrutura da coluna 'items' do seu BD)
interface CartItem {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
}

// 🟢 Tipagem do Contexto
interface CartContextType {
    items: CartItem[];
    total: number;
    addItem: (item: Omit<CartItem, 'quantity'>) => void;
    removeItem: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'mandavenovo_cart';

// ----------------------------------------------------
// ⚙️ Provedor do Contexto do Carrinho
// ----------------------------------------------------

interface CartProviderProps {
    children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [total, setTotal] = useState(0);

    // Efeito para carregar o carrinho do LocalStorage ao iniciar
    useEffect(() => {
        const storedCart = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedCart) {
            try {
                const parsedItems: CartItem[] = JSON.parse(storedCart);
                setItems(parsedItems);
            } catch (error) {
                console.error("Erro ao carregar carrinho do localStorage:", error);
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        }
    }, []);

    // Efeito para recalcular o total e salvar no LocalStorage sempre que 'items' mudar
    useEffect(() => {
        const newTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        setTotal(newTotal);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    // ----------------------------------------------------
    // ➕ Adicionar Item
    // ----------------------------------------------------
    const addItem = (newItem: Omit<CartItem, 'quantity'>) => {
        setItems(prevItems => {
            const existingItem = prevItems.find(item => item.product_id === newItem.product_id);

            if (existingItem) {
                // Se existe, apenas aumenta a quantidade
                toast.success(`Mais um(a) ${newItem.name} adicionado(a)!`, { duration: 1000 });
                return prevItems.map(item =>
                    item.product_id === newItem.product_id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            } else {
                // Se não existe, adiciona como novo item
                toast.success(`${newItem.name} adicionado(a) ao carrinho!`, { duration: 1000 });
                return [...prevItems, { ...newItem, quantity: 1 }];
            }
        });
    };

    // ----------------------------------------------------
    // 🗑️ Remover Item (Completamente)
    // ----------------------------------------------------
    const removeItem = (productId: string) => {
        setItems(prevItems => {
            const itemToRemove = prevItems.find(item => item.product_id === productId);
            if (itemToRemove) {
                toast.error(`"${itemToRemove.name}" removido do carrinho.`, { duration: 1000 });
            }
            return prevItems.filter(item => item.product_id !== productId);
        });
    };

    // ----------------------------------------------------
    // ✍️ Atualizar Quantidade (Usado para -1, +1 ou exclusão)
    // ----------------------------------------------------
    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            // Se a quantidade for zero ou menor, remove o item completamente
            removeItem(productId);
            return;
        }

        setItems(prevItems => {
            return prevItems.map(item =>
                item.product_id === productId
                    ? { ...item, quantity: quantity }
                    : item
            );
        });
    };

    // ----------------------------------------------------
    // 🧹 Limpar Carrinho
    // ----------------------------------------------------
    const clearCart = () => {
        setItems([]);
        toast.success("Carrinho limpo!", { duration: 1000 });
    };

    return (
        <CartContext.Provider value={{ items, total, addItem, removeItem, updateQuantity, clearCart }}>
            {children}
        </CartContext.Provider>
    );
};

// ----------------------------------------------------
// 🎣 Hook para Usar o Carrinho
// ----------------------------------------------------
export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart deve ser usado dentro de um CartProvider');
    }
    return context;
};