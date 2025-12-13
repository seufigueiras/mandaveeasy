// components/ui/PrintIFrame.tsx
import React, { useEffect, useRef } from 'react';

interface PrintIFrameProps {
  htmlContent: string;
  onFinished: () => void;
}

const PrintIFrame: React.FC<PrintIFrameProps> = ({ htmlContent, onFinished }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // 1. Prepara o Documento do iFrame
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // 2. Monta o HTML Básico para Recibo 80mm
    const printHtml = `
      <html>
      <head>
        <title>Recibo #${Date.now()}</title>
        <style>
          @page { 
            size: 80mm auto; 
            margin: 0; 
          }
          body {
            margin: 0;
            padding: 5mm; 
            font-family: 'monospace', sans-serif; 
            font-size: 10pt;
            visibility: visible !important; /* ⬅️ ADIÇÃO */
            width: auto !important; /* ⬅️ ADIÇÃO */
          }
          table {
            border-collapse: collapse;
            margin-top: 5px;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .total { font-size: 1.2em; font-weight: bold; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(printHtml);
    iframeDoc.close();

    // 3. Dispara a Impressão e Limpa
    const printWindow = iframe.contentWindow;
    
    const printAndCleanup = () => {
      printWindow?.focus();
      printWindow?.print();
      onFinished();
    };

    // Tenta garantir que o conteúdo esteja carregado antes de imprimir
    iframe.onload = printAndCleanup;
    
    // Tempo de espera para o conteúdo carregar (1 segundo)
    setTimeout(printAndCleanup, 1000);

  }, [htmlContent, onFinished]);

  return (
    // O iFrame é completamente escondido na tela principal
    <iframe
      ref={iframeRef}
      style={{ display: 'none', position: 'absolute' }}
      title="Print Area"
    />
  );
};

export default PrintIFrame;