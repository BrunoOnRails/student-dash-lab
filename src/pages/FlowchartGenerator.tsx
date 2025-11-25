import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Header from "@/components/Header";

const FlowchartGenerator = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateFlowchart = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-flowchart');
      
      if (error) throw error;
      
      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
        toast.success("Fluxograma gerado com sucesso!");
      } else {
        throw new Error("Nenhuma imagem foi retornada");
      }
    } catch (error) {
      console.error('Erro ao gerar fluxograma:', error);
      toast.error("Erro ao gerar fluxograma. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'fluxograma-importacao-siga.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download iniciado!");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-6 w-6" />
              Gerador de Fluxograma de Importação
            </CardTitle>
            <CardDescription>
              Gere um fluxograma visual do processo de importação de planilhas do SIGA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4">
              <Button 
                onClick={generateFlowchart} 
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Gerar Fluxograma
                  </>
                )}
              </Button>
              
              {imageUrl && (
                <Button 
                  onClick={downloadImage}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Imagem
                </Button>
              )}
            </div>

            {imageUrl && (
              <div className="border rounded-lg p-4 bg-white">
                <img 
                  src={imageUrl} 
                  alt="Fluxograma de Importação de Planilhas" 
                  className="w-full h-auto rounded"
                />
              </div>
            )}

            {!imageUrl && !isGenerating && (
              <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Clique no botão acima para gerar o fluxograma</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FlowchartGenerator;