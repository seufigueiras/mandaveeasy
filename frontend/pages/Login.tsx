import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import toast from 'react-hot-toast';
import { Store } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error('Erro ao fazer login: ' + error.message);
    } else {
      toast.success('Bem-vindo ao MANDAVE!');
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
             <div className="bg-slate-900 p-3 rounded-full">
                <Store className="h-8 w-8 text-white" />
             </div>
          </div>
          <CardTitle className="text-2xl">MANDAVE ERP</CardTitle>
          <p className="text-slate-500">Faça login para gerenciar seu restaurante</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Senha</label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
              />
            </div>
            <Button type="submit" className="w-full" isLoading={loading}>
              Entrar
            </Button>
          </form>
          <div className="mt-4 text-center text-xs text-slate-400">
            Acesso restrito a gestores.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;