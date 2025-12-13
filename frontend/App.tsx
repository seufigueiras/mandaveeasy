// mandavenoatualiza/App.tsx - Versão Final e Corrigida

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Customers from './pages/Customers';
import Login from './pages/Login';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
// 🟢 Imports de Funcionalidade
import Products from './pages/Products'; // Sua gestão de cardápio
import PublicMenu from './pages/PublicMenu'; // O cardápio público
import Checkout from './pages/Checkout'; // A página de finalização
import ClientProfile from './pages/ClientProfile'; // 🆕 Perfil do cliente
import WhatsApp from './pages/WhatsApp'; // 🆕 Monitor WhatsApp
import { CartProvider } from './contexts/CartContext'; // O gerenciador de carrinho

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider> 
        <HashRouter>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* ROTAS PÚBLICAS */}
            <Route path="/cardapio/:restaurantId" element={<PublicMenu />} /> 
            <Route path="/checkout/:restaurantId" element={<Checkout />} />
            <Route path="/perfil/:restaurantId" element={<ClientProfile />} /> {/* 🆕 NOVA ROTA */}
            
            {/* ROTAS PROTEGIDAS */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              
              {/* ROTA DE GESTÃO DO CARDÁPIO */}
              <Route path="menu" element={<Products />} /> 

              <Route path="finance" element={<Finance />} />
              <Route path="customers" element={<Customers />} />
              <Route path="settings" element={<Settings />} />
              
              {/* 🆕 ROTA DO WHATSAPP MONITOR */}
              <Route path="whatsapp" element={<WhatsApp />} />
            </Route>
          </Routes>
        </HashRouter>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;