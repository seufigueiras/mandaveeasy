import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, Wallet, Settings, LogOut, Store, Users, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Pedidos', path: '/orders', icon: <ShoppingBag size={20} /> },
    { name: 'Cardápio', path: '/menu', icon: <UtensilsCrossed size={20} /> },
    { name: 'Clientes', path: '/customers', icon: <Users size={20} /> },
    { name: 'WhatsApp', path: '/whatsapp', icon: <MessageCircle size={20} /> }, // 🆕 NOVO
    { name: 'Financeiro', path: '/finance', icon: <Wallet size={20} /> },
    { name: 'Configurações', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-10 w-64 flex flex-col border-r bg-white text-slate-900 no-print">
      <div className="flex h-16 items-center border-b px-6">
        <Store className="mr-2 h-6 w-6 text-slate-900" />
        <span className="text-lg font-bold">MANDAVE</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <button 
          onClick={() => signOut()}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;