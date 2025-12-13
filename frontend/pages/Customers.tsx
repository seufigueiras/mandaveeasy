import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Customer } from '../types';
import toast from 'react-hot-toast';
// 🟢 MUDANÇA: Importamos o ícone Edit
import { Search, FileSpreadsheet, User, Plus, Trash2, Edit } from 'lucide-react'; 
import * as XLSX from 'xlsx';

const Customers: React.FC = () => {
  const { restaurantId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para Cadastro (EXISTENTES)
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<{
    name: string;
    phone: string;
    address: string;
  }>({
    name: '',
    phone: '',
    address: '',
  });

  // 🟢 ADIÇÃO: Estados para Edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (restaurantId) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');
    
    if (error) {
      toast.error('Erro ao buscar clientes');
    } else {
      setCustomers(data || []);
    }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(customers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "clientes_mandave.xlsx");
    toast.success("Download iniciado!");
  };

  // Funções de Cadastro
  const handleCustomerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewCustomer(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCustomer.name || !newCustomer.phone) {
      return toast.error("Nome e telefone são obrigatórios.");
    }

    const payload = {
      restaurant_id: restaurantId,
      name: newCustomer.name,
      phone: newCustomer.phone,
      address: newCustomer.address,
    };

    const { data, error } = await supabase
      .from('customers')
      .insert([payload])
      .select()
      .single();

    if (error) {
      toast.error("Erro ao cadastrar cliente.");
      console.error("Customer Creation Error:", error);
    } else if (data) {
      toast.success("Cliente cadastrado com sucesso!");
      setCustomers(prev => [data as Customer, ...prev.filter(c => c.id !== data.id)]); 
      setShowCustomerModal(false);
      setNewCustomer({ name: '', phone: '', address: '' });
    }
  };

  const handleDeleteCustomer = async (customerId: number) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (error) {
      toast.error('Erro ao excluir cliente.');
    } else {
      toast.success('Cliente excluído!');
      setCustomers(prev => prev.filter(c => c.id !== customerId));
    }
  };

  // 🟢 ADIÇÃO: Funções de Edição
  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowEditModal(true);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingCustomer(prev => (prev ? { ...prev, [name]: value } : null));
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingCustomer || !editingCustomer.name || !editingCustomer.phone) {
      return toast.error("Nome e telefone são obrigatórios.");
    }

    const { id, name, phone, address } = editingCustomer;

    const { data, error } = await supabase
      .from('customers')
      .update({ name, phone, address })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao atualizar cliente.");
      console.error("Customer Update Error:", error);
    } else if (data) {
      toast.success("Cliente atualizado com sucesso!");
      setCustomers(prev => 
        prev.map(c => (c.id === data.id ? (data as Customer) : c))
      );
      setShowEditModal(false);
      setEditingCustomer(null);
    }
  };


  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Clientes</h1>
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowCustomerModal(true)} 
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus size={18} /> Novo Cliente
          </Button>

          <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2">
             <FileSpreadsheet size={18} /> Exportar Excel
          </Button>
        </div>
        
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Telefone</th>
                <th className="px-6 py-3">Endereço</th>
                <th className="px-6 py-3">Cadastro</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="bg-white border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                        <div className="bg-slate-100 p-1 rounded-full"><User size={14}/></div>
                        {customer.name}
                    </td>
                    <td className="px-6 py-4">{customer.phone}</td>
                    <td className="px-6 py-4 max-w-xs truncate">{customer.address || '-'}</td>
                    <td className="px-6 py-4 text-slate-500">
                        {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                        {/* 🟢 ADIÇÃO: Botão de Edição */}
                        <button 
                            onClick={() => handleEditCustomer(customer)} 
                            className="text-blue-600 hover:text-blue-900 p-1"
                        >
                            <Edit size={16} />
                        </button>
                        
                        <button 
                            onClick={() => handleDeleteCustomer(customer.id)} 
                            className="text-red-600 hover:text-red-900 p-1"
                        >
                            <Trash2 size={16} />
                        </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal de Cadastro (EXISTENTE) */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-xl font-bold">Cadastrar Novo Cliente</h2>
              <button 
                onClick={() => setShowCustomerModal(false)} 
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome Completo *</label>
                  <Input 
                    name="name"
                    value={newCustomer.name} 
                    onChange={handleCustomerInputChange} 
                    placeholder="Ex: João da Silva" 
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefone / WhatsApp *</label>
                  <Input 
                    name="phone"
                    value={newCustomer.phone} 
                    onChange={handleCustomerInputChange} 
                    placeholder="(DDD) 9xxxx-xxxx" 
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Endereço Completo</label>
                  <Input 
                    name="address"
                    value={newCustomer.address} 
                    onChange={handleCustomerInputChange} 
                    placeholder="Rua, Número, Bairro, Complemento" 
                  />
                </div>
                
                <div className="pt-4 border-t mt-4">
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">
                    Finalizar Cadastro
                  </Button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 ADIÇÃO: Modal de Edição de Cliente */}
      {showEditModal && editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-xl font-bold">Editar Cliente: {editingCustomer.name}</h2>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome Completo *</label>
                  <Input 
                    name="name"
                    value={editingCustomer.name} 
                    onChange={handleEditInputChange} 
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefone / WhatsApp *</label>
                  <Input 
                    name="phone"
                    value={editingCustomer.phone} 
                    onChange={handleEditInputChange} 
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Endereço Completo</label>
                  <Input 
                    name="address"
                    value={editingCustomer.address} 
                    onChange={handleEditInputChange} 
                  />
                </div>
                
                <div className="pt-4 border-t mt-4">
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                    Salvar Alterações
                  </Button>
                </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Customers;