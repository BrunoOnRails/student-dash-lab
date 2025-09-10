import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { BookOpen, Users, TrendingUp, Award } from 'lucide-react';
import Header from '@/components/Header';

interface DashboardData {
  totalStudents: number;
  totalSubjects: number;
  averageGrade: number;
  gradeDistribution: Array<{ range: string; count: number }>;
  performanceBySubject: Array<{ name: string; average: number; students: number }>;
  gradesTrend: Array<{ assessment: string; average: number }>;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalStudents: 0,
    totalSubjects: 0,
    averageGrade: 0,
    gradeDistribution: [],
    performanceBySubject: [],
    gradesTrend: []
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, selectedSubject]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('professor_id', user?.id);

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Build subject filter
      const subjectFilter = selectedSubject === 'all' ? 
        (subjectsData?.map(s => s.id) || []) : 
        [selectedSubject];

      if (subjectFilter.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch students count
      const { count: studentsCount, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .in('subject_id', subjectFilter);

      if (studentsError) throw studentsError;

      // Fetch grades with student and subject info
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select(`
          *,
          students!inner(
            subject_id,
            name,
            subjects!inner(name, code, professor_id)
          )
        `)
        .eq('students.subjects.professor_id', user?.id)
        .in('students.subject_id', subjectFilter);

      if (gradesError) throw gradesError;

      // Calculate statistics
      const grades = gradesData || [];
      const totalGrades = grades.length;
      const averageGrade = totalGrades > 0 ? 
        grades.reduce((sum, grade) => sum + Number(grade.grade), 0) / totalGrades : 0;

      // Grade distribution
      const gradeRanges = [
        { range: '0-2', min: 0, max: 2 },
        { range: '2-4', min: 2, max: 4 },
        { range: '4-6', min: 4, max: 6 },
        { range: '6-8', min: 6, max: 8 },
        { range: '8-10', min: 8, max: 10 }
      ];

      const gradeDistribution = gradeRanges.map(range => ({
        range: range.range,
        count: grades.filter(grade => 
          Number(grade.grade) >= range.min && Number(grade.grade) < range.max
        ).length
      }));

      // Performance by subject
      const subjectGroups = grades.reduce((acc, grade) => {
        const subjectId = grade.students.subject_id;
        if (!acc[subjectId]) {
          acc[subjectId] = {
            name: grade.students.subjects.name,
            grades: [],
            students: new Set()
          };
        }
        acc[subjectId].grades.push(Number(grade.grade));
        acc[subjectId].students.add(grade.student_id);
        return acc;
      }, {} as Record<string, { name: string; grades: number[]; students: Set<string> }>);

      const performanceBySubject = Object.values(subjectGroups).map(subject => ({
        name: subject.name,
        average: subject.grades.length > 0 ? 
          subject.grades.reduce((sum, grade) => sum + grade, 0) / subject.grades.length : 0,
        students: subject.students.size
      }));

      // Grades trend by assessment type
      const assessmentGroups = grades.reduce((acc, grade) => {
        const type = grade.assessment_type || 'Sem tipo';
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(Number(grade.grade));
        return acc;
      }, {} as Record<string, number[]>);

      const gradesTrend = Object.entries(assessmentGroups).map(([type, gradesList]) => ({
        assessment: type,
        average: gradesList.length > 0 ? 
          gradesList.reduce((sum, grade) => sum + grade, 0) / gradesList.length : 0
      }));

      setDashboardData({
        totalStudents: studentsCount || 0,
        totalSubjects: selectedSubject === 'all' ? (subjectsData?.length || 0) : 1,
        averageGrade: Number(averageGrade.toFixed(2)),
        gradeDistribution,
        performanceBySubject,
        gradesTrend
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Análise de desempenho acadêmico</p>
          </div>
          
          <div className="w-64">
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as disciplinas</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.code} - {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Alunos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.totalStudents}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disciplinas</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.totalSubjects}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.averageGrade}</div>
              <p className="text-xs text-muted-foreground">de 10 pontos</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.averageGrade >= 7 ? 'Boa' : dashboardData.averageGrade >= 5 ? 'Regular' : 'Baixa'}
              </div>
              <p className="text-xs text-muted-foreground">classificação geral</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Notas</CardTitle>
              <CardDescription>Quantidade de notas por faixa</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData.gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance por Disciplina</CardTitle>
              <CardDescription>Média de notas por disciplina</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData.performanceBySubject}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Bar dataKey="average" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tendência por Tipo de Avaliação</CardTitle>
              <CardDescription>Média por tipo de avaliação</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboardData.gradesTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="assessment" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="average" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição Visual de Notas</CardTitle>
              <CardDescription>Proporção de notas por faixa</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dashboardData.gradeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ range, percent }) => `${range}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {dashboardData.gradeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;