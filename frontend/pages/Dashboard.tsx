// mandavenovo/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { DollarSign, ShoppingCart, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { subDays, format, startOfDay } from 'date-fns';

const Dashboard: React.FC = () => {
  const { restaurantId } = useAuth();
  const [stats, setStats] = useState({
    periodSales: 0,
    totalOrders: 0,
    ticketAverage: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [filter, setFilter] = useState<'today' | '7d' | '30d'>('today');

  useEffect(() => {
    if(restaurantId) fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, filter]);

  const fetchStats = async () => {
    const now = new Date();
    let startDate = startOfDay(now);

    if (filter === '7d') startDate = subDays(now, 7);
    if (filter === '30d') startDate = subDays(now, 30);

    const startIso = startDate.toISOString();
    
    // Fetch Orders
    const { data: ordersData, error } = await supabase
      .from('orders')
      // ✅ CORREÇÃO 1: Selecionando AMBAS as colunas de valor
      .select('total, total_amount, created_at, status') 
      .eq('restaurant_id', restaurantId)
      // Garante que pedidos cancelados (CANCELLED) não entrem na contagem/cálculo de vendas
      .not('status', 'in', '("CANCELLED", "cancelled")')
      .gte('created_at', startIso);

    if (error) {
        console.error("Erro ao buscar estatísticas:", error);
        return;
    }

    if (ordersData) {
      const totalOrders = ordersData.length;
      
      // ✅ CORREÇÃO 2: Soma priorizando 'total_amount' (Cardápio) ou usando 'total' (Manual)
      const periodSales = ordersData.reduce((acc, curr) => {
        // Pega o valor de 'total_amount'. Se for nulo ou undefined, usa 'total'.
        const rawValue = curr.total_amount || curr.total; 
        
        // Garante que o valor seja um número válido antes de somar
        const value = typeof rawValue === 'number' ? rawValue : 0;
        
        return acc + value;
      }, 0); 
      
      const ticketAverage = totalOrders > 0 ? periodSales / totalOrders : 0;

      setStats({ periodSales, totalOrders, ticketAverage });

      // Generate Chart Data
      const grouped = ordersData.reduce((acc: any, curr) => {
          const date = format(new Date(curr.created_at), 'dd/MM');
          if(!acc[date]) acc[date] = 0;
          
          // ✅ CORREÇÃO 3: Aplica a mesma lógica de valor para o gráfico
          const rawValue = curr.total_amount || curr.total;
          const value = typeof rawValue === 'number' ? rawValue : 0;
          
          acc[date] += value; 
          return acc;
      }, {});

      const chart = Object.keys(grouped).map(key => ({ name: key, sales: grouped[key] }));
      
      if(chart.length === 0 && filter !== 'today') {
           setChartData([]); 
      } else if (chart.length === 0 && filter === 'today') {
           setChartData([{ name: format(now, 'dd/MM'), sales: 0 }]);
      } else {
           setChartData(chart);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <div className="flex bg-white rounded-md border p-1 gap-1">
            <Button size="sm" variant={filter === 'today' ? 'primary' : 'ghost'} onClick={() => setFilter('today')}>Hoje</Button>
            <Button size="sm" variant={filter === '7d' ? 'primary' : 'ghost'} onClick={() => setFilter('7d')}>7 Dias</Button>
            <Button size="sm" variant={filter === '30d' ? 'primary' : 'ghost'} onClick={() => setFilter('30d')}>30 Dias</Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas ({filter === 'today' ? 'Hoje' : 'Período'})</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.periodSales.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.ticketAverage.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Evolução de Vendas</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip />
                <Bar dataKey="sales" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;