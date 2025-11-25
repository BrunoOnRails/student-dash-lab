import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const prompt = `Crie um fluxograma detalhado e profissional do processo de importação de planilhas (Excel/CSV) do sistema SIGA. 

O fluxograma deve incluir os seguintes elementos em PORTUGUÊS:
1. Início: "Usuário seleciona arquivo Excel ou CSV"
2. "Sistema lê e faz parsing do arquivo"
3. Decisão: "Detecta tipo de dados" (ramifica para Alunos ou Notas)
4. Caminho Alunos: "Valida colunas: Nome, Matrícula, Curso"
5. Caminho Notas: "Valida colunas: Matrícula, Disciplina, Avaliação, Nota"
6. "Normaliza dados" (capitaliza sexo/raça, converte vírgulas em pontos)
7. Decisão: "Valida integridade"
8. Se erro: "Exibe erros específicos ao usuário" → retorna ao início
9. Se sucesso: "Exibe preview dos dados"
10. "Usuário confirma importação"
11. Decisão: "Tipo de dados" (Alunos ou Notas)
12. Caminho Alunos: "Busca course_id" → verifica se existe → insere na tabela students
13. Caminho Notas: "Busca student_id e subject_id" → verifica se existem → insere na tabela grades
14. "Toast de sucesso" ou "Toast de erro"
15. "Atualiza lista na interface"

Use fundo branco, cores azul (#4682B4) para início, verde (#82B4A2) para sucesso, vermelho para erros, amarelo para ações do usuário. Estilo profissional de flowchart corporativo com setas claras e diamantes de decisão. Alta resolução, aspecto 16:9.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API:', errorText);
      throw new Error(`Erro ao gerar imagem: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('Nenhuma imagem foi gerada');
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});