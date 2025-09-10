import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, BookOpen, Users, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">Acalytics</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Sistema de Análise de Desempenho Acadêmico
          </p>
          <Button onClick={() => window.location.href = '/auth'}>
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Acalytics</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Bem-vindo, {user.user_metadata?.full_name || user.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard do Professor</h2>
          <p className="text-muted-foreground">
            Gerencie suas disciplinas e acompanhe o desempenho dos seus alunos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>Minhas Disciplinas</span>
              </CardTitle>
              <CardDescription>
                Gerencie suas disciplinas e anos letivos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/subjects')}>Ver Disciplinas</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Alunos</span>
              </CardTitle>
              <CardDescription>
                Visualize e gerencie dados dos alunos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button className="w-full" onClick={() => navigate('/students')}>Gerenciar Alunos</Button>
                <Button className="w-full" variant="outline" onClick={() => navigate('/upload')}>
                  Carregar Planilha
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Análises</span>
              </CardTitle>
              <CardDescription>
                Relatórios e métricas de desempenho
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/dashboard')}>
                Ver Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
