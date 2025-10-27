import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { validatePassword } from '@/utils/passwordValidation';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingToken, setProcessingToken] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [error, setError] = useState('');
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const processRecoveryToken = async () => {
      try {
        // Captura os parâmetros da URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        // Verifica se há erro na URL
        if (error) {
          setTokenError(errorDescription || 'Link inválido ou expirado');
          setProcessingToken(false);
          return;
        }

        // Verifica se já há uma sessão válida
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setTokenError('Link inválido ou expirado. Por favor, solicite um novo link de redefinição de senha.');
        }
        
        setProcessingToken(false);
      } catch (err) {
        console.error('Error processing recovery token:', err);
        setTokenError('Erro ao processar o link de recuperação');
        setProcessingToken(false);
      }
    };

    processRecoveryToken();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Por favor, preencha todos os campos');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join('. '));
      setLoading(false);
      return;
    }

    const { error } = await updatePassword(newPassword);
    
    if (error) {
      if (error.message.includes('session_not_found') || error.message.includes('token')) {
        setError('Sessão expirada. Por favor, solicite um novo link de redefinição de senha.');
      } else {
        setError(error.message);
      }
    } else {
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Você já pode fazer login com sua nova senha.',
      });
      navigate('/auth');
    }
    
    setLoading(false);
  };

  const handleRequestNewLink = () => {
    navigate('/auth');
  };

  const passwordValidation = validatePassword(newPassword);

  // Mostra loading enquanto processa o token
  if (processingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Processando link de recuperação...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostra erro se o token for inválido
  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-destructive">Link Inválido</CardTitle>
            <CardDescription>
              {tokenError}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Os links de redefinição de senha expiram em 1 hora por motivos de segurança.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleRequestNewLink} 
              className="w-full"
            >
              Solicitar Novo Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Redefinir Senha</CardTitle>
          <CardDescription>
            Crie uma nova senha para sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {newPassword && (
                <div className="text-xs space-y-1">
                  <div className="font-medium">Requisitos da senha:</div>
                  {passwordValidation.errors.map((error, index) => (
                    <div key={index} className="text-destructive">
                      • {error}
                    </div>
                  ))}
                  {passwordValidation.isValid && (
                    <div className="text-green-600">✓ Senha válida</div>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirme sua nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !passwordValidation.isValid}
            >
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
