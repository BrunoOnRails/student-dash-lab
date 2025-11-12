import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface AssessmentDistribution {
  assessment_type: string;
  total_points: number;
  count: number;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const AssessmentDistribution = () => {
  const { user } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [distributionData, setDistributionData] = useState<AssessmentDistribution[]>([]);

  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ["subjects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("professor_id", user?.id)
        .order("name");
      
      if (error) throw error;
      return data as Subject[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const fetchDistribution = async () => {
      if (!user?.id) return;

      let query = supabase
        .from("grades")
        .select(`
          assessment_type,
          max_grade,
          students!inner(
            subject_id,
            subjects!inner(
              id,
              name,
              professor_id
            )
          )
        `)
        .eq("students.subjects.professor_id", user.id);

      if (selectedSubject !== "all") {
        query = query.eq("students.subject_id", selectedSubject);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching distribution:", error);
        return;
      }

      // Aggregate data by assessment type
      const aggregated = data.reduce((acc: Record<string, { total: number; count: number }>, curr: any) => {
        const type = curr.assessment_type;
        if (!acc[type]) {
          acc[type] = { total: 0, count: 0 };
        }
        acc[type].total += parseFloat(curr.max_grade);
        acc[type].count += 1;
        return acc;
      }, {});

      const formattedData = Object.entries(aggregated).map(([type, data]) => ({
        assessment_type: type,
        total_points: data.total,
        count: data.count,
      }));

      setDistributionData(formattedData);
    };

    fetchDistribution();
  }, [user?.id, selectedSubject]);

  if (loadingSubjects) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const totalPoints = distributionData.reduce((sum, item) => sum + item.total_points, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Distribuição de Pontos</h1>
          <p className="text-muted-foreground">
            Análise da distribuição de pontos por tipo de avaliação
          </p>
        </div>

        <div className="mb-6">
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione uma disciplina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Disciplinas</SelectItem>
              {subjects?.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Total de Pontos</CardTitle>
              <CardDescription>
                Soma de todos os pontos distribuídos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                {totalPoints.toFixed(1)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tipos de Avaliação</CardTitle>
              <CardDescription>
                Quantidade de tipos diferentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                {distributionData.length}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Tipo de Avaliação</CardTitle>
              <CardDescription>
                Pontos totais por tipo de avaliação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="assessment_type" 
                    className="text-xs"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="total_points" 
                    fill="hsl(var(--primary))" 
                    name="Total de Pontos"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proporção de Pontos</CardTitle>
              <CardDescription>
                Percentual de pontos por tipo de avaliação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ assessment_type, total_points }) => 
                      `${assessment_type}: ${((total_points / totalPoints) * 100).toFixed(1)}%`
                    }
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="total_points"
                  >
                    {distributionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Detalhamento por Tipo</CardTitle>
              <CardDescription>
                Informações detalhadas de cada tipo de avaliação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Tipo de Avaliação</th>
                      <th className="text-right p-2 font-semibold">Total de Pontos</th>
                      <th className="text-right p-2 font-semibold">Quantidade</th>
                      <th className="text-right p-2 font-semibold">Média por Avaliação</th>
                      <th className="text-right p-2 font-semibold">Percentual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributionData.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="p-2">{item.assessment_type}</td>
                        <td className="text-right p-2">{item.total_points.toFixed(1)}</td>
                        <td className="text-right p-2">{item.count}</td>
                        <td className="text-right p-2">
                          {(item.total_points / item.count).toFixed(1)}
                        </td>
                        <td className="text-right p-2">
                          {((item.total_points / totalPoints) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-muted/30">
                      <td className="p-2">Total</td>
                      <td className="text-right p-2">{totalPoints.toFixed(1)}</td>
                      <td className="text-right p-2">
                        {distributionData.reduce((sum, item) => sum + item.count, 0)}
                      </td>
                      <td className="text-right p-2">-</td>
                      <td className="text-right p-2">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AssessmentDistribution;
