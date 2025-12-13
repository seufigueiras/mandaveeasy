import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import toast from 'react-hot-toast';
import { Plus, UtensilsCrossed, Trash2, Edit, Save, X, Upload } from 'lucide-react';

type Product = {
    id: string;
    category: string; 
    name: string;
    description: string | null; 
    price: number;
    is_active: boolean; 
    is_visible: boolean; 
    image_url: string | null;
    created_at: string;
    restaurant_id: string; 
};

type GroupedProducts = {
    [categoryName: string]: Product[];
};

const Products: React.FC = () => {
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [groupedProducts, setGroupedProducts] = useState<GroupedProducts>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    // Estados do Formulário de Adição
    const [newProductName, setNewProductName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [newImagePreview, setNewImagePreview] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // ESTADOS PARA EDIÇÃO INLINE
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<Product>>({});
    const [editImagePreview, setEditImagePreview] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (restaurantId) {
            fetchProductsAndGroup();
        }
    }, [restaurantId]);

    // Função de Upload para Supabase Storage
    const handleImageUpload = async (file: File): Promise<string | null> => {
        try {
            if (!file.type.startsWith('image/')) {
                toast.error('Selecione um arquivo de imagem válido');
                return null;
            }

            if (file.size > 5 * 1024 * 1024) {
                toast.error('Imagem muito grande (máximo 5MB)');
                return null;
            }

            const timestamp = Date.now();
            const fileName = `${restaurantId}/${timestamp}-${file.name}`;

            const { data, error } = await supabase.storage
                .from('produtos')
                .upload(fileName, file);

            if (error) {
                toast.error(`Erro ao fazer upload: ${error.message}`);
                return null;
            }

            const { data: publicData } = supabase.storage
                .from('produtos')
                .getPublicUrl(fileName);

            return publicData.publicUrl;
        } catch (e) {
            toast.error('Erro ao fazer upload da imagem');
            console.error(e);
            return null;
        }
    };

    // Quando o usuário seleciona uma imagem (formulário de adição)
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setNewImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        setIsUploading(true);
        const imageUrl = await handleImageUpload(file);
        setIsUploading(false);
        
        if (imageUrl) {
            setNewImageUrl(imageUrl);
            toast.success('Imagem enviada com sucesso!');
        }
    };

    // Quando o usuário seleciona uma imagem (formulário de edição)
    const handleEditFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setEditImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        setIsUploading(true);
        const imageUrl = await handleImageUpload(file);
        setIsUploading(false);
        
        if (imageUrl) {
            setEditData({ ...editData, image_url: imageUrl });
            toast.success('Imagem enviada com sucesso!');
        }
    };

    const fetchProductsAndGroup = async () => {
        setLoading(true);
        
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('restaurant_id', restaurantId) 
            .order('category', { ascending: true }) 
            .order('name', { ascending: true }); 

        if (error) {
            toast.error("Erro ao carregar produtos. Verifique o RLS e a coluna 'restaurant_id' no Supabase.");
            console.error("Fetch Products Error:", error);
            setGroupedProducts({}); 
        } else if (data) {
            const groups: GroupedProducts = data.reduce((acc, product) => {
                const category = product.category || 'Sem Categoria'; 
                if (!acc[category]) {
                    acc[category] = [];
                }
                acc[category].push(product);
                return acc;
            }, {} as GroupedProducts);

            setGroupedProducts(groups);
        }
        setLoading(false);
    };

    const handleAddProduct = async () => {
        if (!newProductName.trim() || !newPrice.trim() || !newCategory.trim()) {
            toast.error('Preencha nome, preço e categoria.');
            return;
        }

        setIsAdding(true);

        const newProduct = {
            restaurant_id: restaurantId,
            name: newProductName.trim(),
            price: parseFloat(newPrice.replace(',', '.')), 
            category: newCategory.trim(),
            image_url: newImageUrl.trim() || null,
            is_active: true, 
            is_visible: true, 
        };
        
        const { error } = await supabase
            .from('products')
            .insert([newProduct]);

        if (error) {
            toast.error(`Erro ao criar produto: ${error.message}.`);
            console.error(error);
        } else {
            toast.success('Produto criado com sucesso!');
            setNewProductName('');
            setNewPrice('');
            setNewCategory('');
            setNewImageUrl('');
            setNewImagePreview('');
            fetchProductsAndGroup(); 
        }

        setIsAdding(false);
    };

    const handleDeleteProduct = async (productId: string, productName: string) => {
        if (!confirm(`Tem certeza que deseja excluir o produto "${productName}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        setLoading(true);

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)
            .eq('restaurant_id', restaurantId); 

        if (error) {
            toast.error(`Erro ao excluir produto: ${error.message}.`);
            console.error(error);
        } else {
            toast.success('Produto excluído com sucesso!');
            fetchProductsAndGroup();
        }

        setLoading(false);
    };

    const startEditing = (product: Product) => {
        setEditingProductId(product.id);
        setEditData({
            name: product.name,
            price: product.price.toString(), 
            category: product.category,
            image_url: product.image_url || '',
            is_active: product.is_active,
            is_visible: product.is_visible,
        });
        setEditImagePreview(product.image_url || '');
    };

    const cancelEditing = () => {
        setEditingProductId(null);
        setEditData({});
        setEditImagePreview('');
    };

    const handleUpdateProduct = async () => {
        if (!editingProductId || !editData.name || !editData.price || !editData.category) {
            toast.error('Preencha todos os campos obrigatórios.');
            return;
        }

        setIsUpdating(true);

        const updatedData = {
            name: editData.name,
            price: parseFloat(editData.price.toString().replace(',', '.')), 
            category: editData.category, 
            image_url: editData.image_url || null,
            is_active: editData.is_active,
            is_visible: editData.is_visible,
        };
        
        const { error } = await supabase
            .from('products')
            .update(updatedData)
            .eq('id', editingProductId)
            .eq('restaurant_id', restaurantId); 

        if (error) {
            toast.error(`Erro ao atualizar produto: ${error.message}.`);
            console.error(error);
        } else {
            toast.success('Produto atualizado com sucesso!');
            cancelEditing();
            fetchProductsAndGroup();
        }

        setIsUpdating(false);
    };

    const removeNewImage = () => {
        setNewImagePreview('');
        setNewImageUrl('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeEditImage = () => {
        setEditImagePreview('');
        setEditData({ ...editData, image_url: '' });
        if (editFileInputRef.current) {
            editFileInputRef.current.value = '';
        }
    };

    const categories = Object.keys(groupedProducts);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                <UtensilsCrossed size={28} className="inline mr-2 text-indigo-600" />
                Gestão do Cardápio Online ({categories.length} Categorias)
            </h1>

            {/* Formulário de Adição de Produto */}
            <Card className="p-4 border">
                <CardTitle className="mb-4 text-lg">Adicionar Novo Produto</CardTitle>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <Input 
                        placeholder="Nome do Produto"
                        value={newProductName}
                        onChange={e => setNewProductName(e.target.value)}
                        disabled={isAdding || isUploading}
                    />
                    <Input 
                        placeholder="Preço (ex: 45.90)"
                        type="number"
                        value={newPrice}
                        onChange={e => setNewPrice(e.target.value)}
                        disabled={isAdding || isUploading}
                    />
                    <Input 
                        placeholder="Categoria (ex: Pizzas Doces)"
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        disabled={isAdding || isUploading}
                    />
                    <div className="flex gap-2">
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*"
                            onChange={handleFileSelect}
                            disabled={isAdding || isUploading}
                            className="hidden"
                            id="new-image-input"
                        />
                        <label 
                            htmlFor="new-image-input"
                            className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition disabled:bg-gray-400"
                            style={{ pointerEvents: isAdding || isUploading ? 'none' : 'auto', opacity: isAdding || isUploading ? 0.6 : 1 }}
                        >
                            <Upload size={16} className="mr-1" />
                            Foto
                        </label>
                    </div>
                </div>

                {/* Preview da nova imagem */}
                {newImagePreview && (
                    <div className="mb-4 relative w-24 h-24">
                        <img src={newImagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                        <button
                            type="button"
                            onClick={removeNewImage}
                            disabled={isAdding || isUploading}
                            className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                <Button 
                    onClick={handleAddProduct}
                    isLoading={isAdding}
                    disabled={isUploading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                    <Plus size={16} /> Salvar Produto
                </Button>
            </Card>
            
            {loading && <p className="text-center p-8">Carregando cardápio...</p>}

            {!loading && categories.length === 0 && (
                <div className="text-center p-8 bg-white rounded-lg border border-dashed">
                    <p className="text-slate-500">Nenhum produto encontrado. Adicione o primeiro acima.</p>
                </div>
            )}

            {/* Lista de Produtos Agrupados */}
            <div className="space-y-8">
                {categories.map(categoryName => (
                    <Card key={categoryName}>
                        <CardHeader className='bg-slate-100 rounded-t-lg'>
                            <CardTitle className="flex justify-between items-center text-xl text-indigo-800">
                                <span>{categoryName}</span>
                                <span className="text-sm font-normal text-slate-500">
                                    ({groupedProducts[categoryName].length} itens)
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {groupedProducts[categoryName].map(product => (
                                <div key={product.id} className={`p-3 border rounded-lg shadow-sm ${editingProductId === product.id ? 'bg-yellow-50 border-yellow-300' : 'bg-white'}`}>
                                    
                                    {editingProductId === product.id ? (
                                        /* MODO EDIÇÃO INLINE */
                                        <div className="space-y-3">
                                            <h4 className="font-semibold text-lg text-yellow-800">Editando {product.name}</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <Input 
                                                    placeholder="Nome"
                                                    value={editData.name || ''}
                                                    onChange={e => setEditData({...editData, name: e.target.value})}
                                                    disabled={isUpdating || isUploading}
                                                />
                                                <Input 
                                                    placeholder="Preço"
                                                    type="number"
                                                    value={editData.price || ''}
                                                    onChange={e => setEditData({...editData, price: e.target.value})}
                                                    disabled={isUpdating || isUploading}
                                                />
                                                <Input 
                                                    placeholder="Categoria"
                                                    value={editData.category || ''}
                                                    onChange={e => setEditData({...editData, category: e.target.value})}
                                                    disabled={isUpdating || isUploading}
                                                />
                                                <div className="flex gap-2">
                                                    <input 
                                                        ref={editFileInputRef}
                                                        type="file" 
                                                        accept="image/*"
                                                        onChange={handleEditFileSelect}
                                                        disabled={isUpdating || isUploading}
                                                        className="hidden"
                                                        id={`edit-image-input-${product.id}`}
                                                    />
                                                    <label 
                                                        htmlFor={`edit-image-input-${product.id}`}
                                                        className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition disabled:bg-gray-400 text-sm"
                                                        style={{ pointerEvents: isUpdating || isUploading ? 'none' : 'auto', opacity: isUpdating || isUploading ? 0.6 : 1 }}
                                                    >
                                                        <Upload size={14} />
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Preview da imagem em edição */}
                                            {editImagePreview && (
                                                <div className="relative w-20 h-20">
                                                    <img src={editImagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                                    <button
                                                        type="button"
                                                        onClick={removeEditImage}
                                                        disabled={isUpdating || isUploading}
                                                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            )}

                                            <div className="flex items-center space-x-4 pt-2">
                                                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={editData.is_active || false}
                                                        onChange={(e) => setEditData({...editData, is_active: e.target.checked})}
                                                        className="form-checkbox h-4 w-4 text-green-600 rounded"
                                                        disabled={isUpdating || isUploading}
                                                    />
                                                    Ativo
                                                </label>
                                                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={editData.is_visible || false}
                                                        onChange={(e) => setEditData({...editData, is_visible: e.target.checked})}
                                                        className="form-checkbox h-4 w-4 text-green-600 rounded"
                                                        disabled={isUpdating || isUploading}
                                                    />
                                                    Disponível
                                                </label>

                                                <Button size="sm" onClick={handleUpdateProduct} isLoading={isUpdating} disabled={isUploading} className='ml-auto bg-green-600 hover:bg-green-700'>
                                                    <Save size={16} /> Salvar
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isUpdating || isUploading}>
                                                    <X size={16} className='text-red-500' /> Cancelar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* MODO VISUALIZAÇÃO */
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center space-x-3">
                                                {product.image_url && (
                                                    <img 
                                                        src={product.image_url} 
                                                        alt={product.name}
                                                        className="w-12 h-12 object-cover rounded-lg"
                                                    />
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full ${product.is_active ? 'bg-green-500' : 'bg-red-500'}`} title={product.is_active ? "Ativo" : "Inativo"}></div>
                                                        <span className="font-semibold">{product.name}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500">{product.category}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <span className="font-bold text-green-600 min-w-[70px] text-right">
                                                    R$ {product.price.toFixed(2)}
                                                </span>
                                                <Button variant="ghost" size="sm" onClick={() => startEditing(product)} disabled={isUpdating || isAdding || isUploading}>
                                                    <Edit size={16} className="text-slate-500 hover:text-indigo-600" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id, product.name)} disabled={isUpdating || isAdding || isUploading}>
                                                    <Trash2 size={16} className="text-red-500 hover:text-red-700" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>

        </div>
    );
};

export default Products;