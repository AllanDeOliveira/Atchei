import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { MainLayout } from './MainLayout';

export const PrivateRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Se o usuário não estiver logado, redireciona para o Login
    return <Navigate to="/login" replace />;
  }

  // Mesmo layout das rotas públicas — o guard só decide se renderiza, não como.
  return <MainLayout />;
};
