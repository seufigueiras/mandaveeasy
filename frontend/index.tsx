import React from 'react';
import ReactDOM from 'react-dom/client';
// ⚠️ LINHA CORRIGIDA AQUI: Usando './App' porque index.tsx e App.tsx estão na mesma pasta.
import App from './App';
import './styles/print.css'; 

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);