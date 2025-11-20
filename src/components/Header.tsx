import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from '@/hooks/useAuth';
import { BarChart3, LogOut, Menu, BookOpen, Users, Upload, Home, FileText, PieChart, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
  };

  const menuItems = [
    { label: 'Início', icon: Home, path: '/' },
    { label: 'Disciplinas', icon: BookOpen, path: '/subjects' },
    { label: 'Alunos', icon: Users, path: '/students' },
    { label: 'Notas', icon: FileText, path: '/grades' },
    { label: 'Cursos', icon: BookOpen, path: '/courses' },
    { label: 'Carregar Planilha', icon: Upload, path: '/upload' },
    { label: 'Dashboard', icon: BarChart3, path: '/dashboard' },
    { label: 'Distribuição de Pontos', icon: PieChart, path: '/assessment-distribution' },
  ];

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">SIGA</h1>
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {menuItems.map((item) => (
                <DropdownMenuItem 
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="cursor-pointer"
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">
            Bem-vindo, {user?.user_metadata?.full_name || user?.email}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Alternar para modo {theme === 'dark' ? 'claro' : 'escuro'}</p>
            </TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;