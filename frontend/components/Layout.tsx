import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

// 🔴 COMPONENTE DE ESTILOS AGRESSIVOS EXTREMOS
const GlobalPrintStyles = () => (
    <style dangerouslySetInnerHTML={{ __html: `
      @media print {
        /* 🛑 Regra 1: Esconde TUDO no BODY por padrão */
        body * {
            visibility: hidden !important;
            display: none !important;
        }

        /* 🟢 Regra 2: Torna o contêiner de impressão visível, e forçamos a visibilidade de seus filhos */
        .print-only, .print-only * {
            visibility: visible !important;
            display: block !important;
            opacity: 1 !important; /* Adiciona opacidade, caso haja um bug */
            color: #000 !important; /* Garante cor preta para o texto */
            background-color: #fff !important; /* Garante fundo branco */
        }
        
        .print-only {
            /* Garante que o recibo comece no topo da página e não seja ignorado */
            position: absolute !important; 
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            z-index: 9999999; /* Z-Index extremo */
            margin: 0 !important;
            padding: 0 !important;
            /* Se o Recibo for o único elemento, ele precisa do body visível */
            visibility: visible !important; 
        }
        
        /* Opcional: Garante que o body possa ser renderizado */
        body {
             visibility: visible !important;
             display: block !important;
             margin: 0;
             padding: 0;
        }

        /* Ajuste para impressoras de recibo */
        @page {
            size: 80mm auto; 
            margin: 0;
        }
        body, html {
            margin: 0;
            padding: 0;
            font-size: 10pt;
            min-width: 80mm;
        }
      }
    `}} />
);


const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50">
        {/* 🟢 Chamada do componente de estilos de impressão */}
        <GlobalPrintStyles />

      <Sidebar />
      <main className="pl-64">
        <div className="container mx-auto p-8 max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;