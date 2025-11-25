import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Users, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">SIGA</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Sistema Integrado de Gestão Acadêmica
          </p>
          <Button onClick={() => window.location.href = '/auth'}>
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard do Professor
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Gerencie suas disciplinas e acompanhe o desempenho dos seus alunos com análises avançadas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="card-enhanced group">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-3 text-xl">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <span>Minhas Disciplinas</span>
              </CardTitle>
              <CardDescription className="text-base">
                Gerencie suas disciplinas e anos letivos com facilidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full btn-gradient text-white" onClick={() => navigate('/subjects')}>
                Ver Disciplinas
              </Button>
            </CardContent>
          </Card>

          <Card className="card-enhanced group">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-3 text-xl">
                <div className="p-2 rounded-lg bg-chart-2/10 group-hover:bg-chart-2/20 transition-colors">
                  <Users className="h-6 w-6" style={{color: 'hsl(var(--chart-2))'}} />
                </div>
                <span>Alunos</span>
              </CardTitle>
              <CardDescription className="text-base">
                Visualize e gerencie dados dos alunos eficientemente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full btn-gradient text-white" onClick={() => navigate('/students')}>
                  Gerenciar Alunos
                </Button>
                <Button className="w-full" variant="outline" onClick={() => navigate('/upload')}>
                  Carregar Planilha
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="card-enhanced group">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-3 text-xl">
                <div className="p-2 rounded-lg bg-chart-3/10 group-hover:bg-chart-3/20 transition-colors">
                  <BarChart3 className="h-6 w-6" style={{color: 'hsl(var(--chart-3))'}} />
                </div>
                <span>Análises</span>
              </CardTitle>
              <CardDescription className="text-base">
                Relatórios e métricas detalhadas de desempenho
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full btn-gradient text-white" onClick={() => navigate('/dashboard')}>
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
