import React from 'react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
};

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return <h3 className={`font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
};

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
};
