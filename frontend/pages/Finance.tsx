import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { FinancialMovement, PaymentMethod } from '../types';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react'; 

const Finance: React.FC = () => {
  const { restaurantId } = useAuth();
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
      amount: '',
      category: 'Fornecedor',
      description: '',
      payment_method: 'cash' as PaymentMethod
  });

  const [summary, setSummary] = useState({
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      byMethod: { cash: 0, pix: 0, debit_card: 0, credit_card: 0 }
  });

  useEffect(() => {
    if(restaurantId) fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const fetchMovements = async () => {
    // Fetch manual movements
    const { data: movs } = await supabase
      .from('financial_mov')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('date', { ascending: false });

    // Fetch orders to calculate income
    const { data: orders } = await supabase
      .from('orders')
      // Incluindo 'total_amount' na busca
      .select('total, total_amount, payment_method, status, created_at') 
      .eq('restaurant_id', restaurantId)
      .neq('status', 'cancelled');

    const allMovements = movs || [];
    
    // Process Summary
    let income = 0;
    let expense = 0;
    const methodTotals = { cash: 0, pix: 0, debit_card: 0, credit_card: 0 };

    // Process Orders as Income
    orders?.forEach(o => {
        // Pega o valor da coluna que estiver preenchida
        const rawValue = o.total_amount || o.total;
        // Garante que o valor seja um número válido antes de somar
        const numericValue = typeof rawValue === 'number' ? rawValue : 0;

        income += numericValue;
        
        // ✅ CORREÇÃO FINAL: Converte o método de pagamento para minúsculo
        const rawMethod = o.payment_method || 'cash'; // Fallback para 'cash' se for nulo
        const method = (rawMethod as string).toLowerCase() as PaymentMethod;
        
        if (methodTotals[method] !== undefined) {
          methodTotals[method] += numericValue;
        }
    });

    // Process Expenses
    allMovements.forEach(m => {
        if(m.type === 'expense') {
            expense += m.amount;
            // Subtrai do saldo do método (Lógica de Fluxo de Caixa)
            if (methodTotals[m.payment_method] !== undefined) methodTotals[m.payment_method] -= m.amount;
        }
    });

    setSummary({
        totalIncome: income,
        totalExpense: expense,
        balance: income - expense,
        byMethod: methodTotals
    });

    setMovements(allMovements);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = {
          restaurant_id: restaurantId,
          type: 'expense',
          amount: parseFloat(newExpense.amount),
          category: newExpense.category,
          payment_method: newExpense.payment_method,
          description: newExpense.description,
          date: new Date().toISOString()
      };

      const { error } = await supabase.from('financial_mov').insert([payload]);

      if(error) {
          toast.error("Erro ao lançar despesa");
      } else {
          toast.success("Despesa lançada");
          setShowModal(false);
          setNewExpense({ amount: '', category: 'Fornecedor', description: '', payment_method: 'cash' });
          fetchMovements(); // Recarrega os dados para atualizar a tabela e o resumo
      }
  };

  // Função para deletar despesa (mantida)
  const handleDeleteExpense = async (movementId: number) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa? Esta ação é irreversível e afetará o saldo.')) {
      return;
    }

    const toastId = toast.loading('Excluindo despesa...');
    
    const { error } = await supabase
      .from('financial_mov') // Assumindo que a tabela de movimentos é 'financial_mov'
      .delete()
      .eq('id', movementId);

    toast.dismiss(toastId);

    if (error) {
      toast.error('Erro ao excluir despesa.');
      console.error('Deletion Error:', error);
    } else {
      toast.success('Despesa excluída com sucesso!');
      // Chama fetchMovements para recalcular tudo e atualizar a tabela
      fetchMovements(); 
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Fluxo de Caixa</h1>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2" variant="danger">
            <Plus size={18} /> Lançar Despesa
        </Button>
      </div>

        {/* Summary Cards (mantidos) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                    <div className="text-sm text-green-700 font-semibold">Faturamento Total</div>
                    <div className="text-2xl font-bold text-green-900">R$ {summary.totalIncome.toFixed(2)}</div>
                </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4">
                    <div className="text-sm text-red-700 font-semibold">Despesas</div>
                    <div className="text-2xl font-bold text-red-900">R$ {summary.totalExpense.toFixed(2)}</div>
                </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200 md:col-span-2">
                <CardContent className="p-4">
                    <div className="text-sm text-blue-700 font-semibold mb-2">Saldo em Caixa (Por Método)</div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                        <div>
                            <span className="block text-slate-500 text-xs">Dinheiro</span>
                            <span className="font-bold">R$ {summary.byMethod.cash.toFixed(2)}</span>
                        </div>
                         <div>
                            <span className="block text-slate-500 text-xs">PIX</span>
                            <span className="font-bold">R$ {summary.byMethod.pix.toFixed(2)}</span>
                        </div>
                         <div>
                            <span className="block text-slate-500 text-xs">Crédito</span>
                            <span className="font-bold">R$ {summary.byMethod.credit_card.toFixed(2)}</span>
                        </div>
                        <div>
                            <span className="block text-slate-500 text-xs">Débito</span>
                            <span className="font-bold">R$ {summary.byMethod.debit_card.toFixed(2)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Modal de Cadastro de Despesa (mantido) */}
        {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="w-96">
                    <CardHeader><CardTitle>Nova Despesa</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddExpense} className="space-y-4">
                            <Input 
                                type="number" 
                                placeholder="Valor (R$)" 
                                value={newExpense.amount}
                                onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                                required
                            />
                            <select 
                                className="w-full border rounded p-2 text-sm"
                                value={newExpense.payment_method}
                                onChange={e => setNewExpense({...newExpense, payment_method: e.target.value as PaymentMethod})}
                            >
                                <option value="cash">Dinheiro (Sangria)</option>
                                <option value="pix">PIX</option>
                                <option value="debit_card">Débito</option>
                            </select>
                            <Input 
                                placeholder="Categoria (ex: Fornecedor, Luz)" 
                                value={newExpense.category}
                                onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                                required
                            />
                            <Input 
                                placeholder="Descrição" 
                                value={newExpense.description}
                                onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                            />
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
                                <Button type="submit" variant="danger">Confirmar Saída</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        )}

      <div className="bg-white rounded-md border shadow-sm">
        <div className="p-4 border-b font-medium">Histórico de Despesas</div>
        <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                <tr>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Categoria</th>
                    <th className="px-6 py-3">Método</th>
                    <th className="px-6 py-3">Descrição</th>
                    <th className="px-6 py-3 text-right">Valor</th>
                    <th className="px-6 py-3 text-right">Ações</th> 
                </tr>
            </thead>
            <tbody>
                {movements.filter(m => m.type === 'expense').map((mov) => (
                    <tr key={mov.id} className="bg-white border-b hover:bg-slate-50">
                        <td className="px-6 py-4">{new Date(mov.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">{mov.category}</td>
                        <td className="px-6 py-4 uppercase text-xs">{mov.payment_method}</td>
                         <td className="px-6 py-4 text-slate-500">{mov.description || '-'}</td>
                        <td className="px-6 py-4 text-right font-medium text-red-600">
                            - R$ {mov.amount.toFixed(2)}
                        </td>
                        {/* Célula de Ações com botão de Excluir (mantida) */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button 
                            onClick={() => handleDeleteExpense(mov.id)} 
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Excluir Despesa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default Finance;