// mandavenovo/components/ui/Button.tsx

import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react'; // Ícone de loading (certifique-se de ter o pacote lucide-react)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'ghost'; // Adiciona suporte ao variant 'ghost'
    isLoading?: boolean; // Adiciona suporte ao isLoading
}

const Button: React.FC<ButtonProps> = ({ 
    children, 
    className = '', 
    variant = 'default', 
    isLoading = false, 
    disabled, // Pega o disabled nativo
    ...props 
}) => {
    
    // Define classes básicas de estilo e cor baseadas no variant
    let baseClasses = "flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    
    // Adiciona estilos específicos baseados no variant
    if (variant === 'default') {
        baseClasses += ' bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500';
    } else if (variant === 'ghost') {
        // Estilo 'ghost' (transparente ou com cor de fundo muito suave)
        baseClasses += ' bg-transparent text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500';
    }
    
    return (
        <button
            className={`${baseClasses} ${className}`}
            disabled={disabled || isLoading} // Desativa se estiver desativado ou carregando
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {/* Exibe o loading */}
            {children}
        </button>
    );
};

export default Button;