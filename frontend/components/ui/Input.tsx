// mandavenovo/components/ui/Input.tsx

import React, { InputHTMLAttributes } from 'react';

// Estendemos as props nativas do HTML para que todos os atributos funcionem
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    className?: string;
}

const Input: React.FC<InputProps> = ({ className, ...props }) => {
    return (
        <input
            className={`w-full border border-gray-300 rounded-md shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 text-slate-800 ${className}`}
            {...props}
        />
    );
};

export default Input;