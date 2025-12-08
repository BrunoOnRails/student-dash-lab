import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { BookOpen, Users, TrendingUp, Award, BarChart3 } from 'lucide-react';
import Header from '@/components/Header';

interface DashboardData {
  totalStudents: number;
  totalSubjects: number;
  averageGrade: number;
  gradeDistribution: Array<{ range: string; count: number }>;
  performanceBySubject: Array<{ name: string; average: number; students: number }>;
  gradesTrend: Array<{ assessment: string; average: number }>;
  genderDistribution: Array<{ gender: string; count: number }>;
  raceDistribution: Array<{ race: string; count: number }>;
  incomeDistribution: Array<{ range: string; count: number }>;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  course_id: string | null;
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface AssessmentDistribution {
  assessment_type: string;
  total_points: number;
  count: number;
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
    gradesTrend: [],
    genderDistribution: [],
    raceDistribution: [],
    incomeDistribution: []
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [distributionData, setDistributionData] = useState<AssessmentDistribution[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, selectedSubject, selectedCourse]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, name, code')
        .eq('user_id', user?.id);

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch subjects
      let subjectsQuery = supabase
        .from('subjects')
        .select('id, name, code, course_id')
        .eq('professor_id', user?.id);

      if (selectedCourse !== 'all') {
        subjectsQuery = subjectsQuery.eq('course_id', selectedCourse);
      }

      const { data: subjectsData, error: subjectsError } = await subjectsQuery;

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

      // Fetch students count with demographic data - filtered by course
      let studentsQuery = supabase
        .from('students')
        .select('id, gender, average_income, ethnicity, course_id');

      if (selectedCourse !== 'all') {
        studentsQuery = studentsQuery.eq('course_id', selectedCourse);
      }

      const { data: allStudents, error: studentsError } = await studentsQuery;

      if (studentsError) throw studentsError;
      const studentsCount = allStudents?.length || 0;

      // Fetch grades with student info - filtered by subject and course
      let gradesQuery = supabase
        .from('grades')
        .select('*, students!inner(id, name, student_id, course_id), subjects!inner(id, course_id)')
        .in('subject_id', subjectFilter);

      if (selectedCourse !== 'all') {
        gradesQuery = gradesQuery.eq('subjects.course_id', selectedCourse);
      }

      const { data: gradesData, error: gradesError } = await (gradesQuery as any)
        .order('date_assigned', { ascending: false })
        .limit(100);

      if (gradesError) throw gradesError;

      // Calculate statistics - type cast to any[] to avoid deep type issues
      const grades = (gradesData || []) as any[];
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

      // Performance by subject - simplified since we removed subject join
      const uniqueStudents = [...new Set(grades.map(g => g.student_id))];
      const performanceBySubject = [
        { name: 'Média Geral', average: grades.length > 0 ? Number((grades.reduce((sum, g) => sum + Number(g.grade), 0) / grades.length).toFixed(2)) : 0, students: uniqueStudents.length }
      ];

      // Grades trend by assessment type
      const assessmentGroups = grades.reduce((acc, grade) => {
        const type = grade.assessment_type || 'Sem tipo';
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(Number(grade.grade));
        return acc;
      }, {} as Record<string, number[]>);

      const gradesTrend = Object.entries(assessmentGroups).map(([type, gradesList]: [string, any]) => ({
        assessment: type,
        average: (gradesList as number[]).length > 0 ? 
          Number(((gradesList as number[]).reduce((sum, grade) => sum + grade, 0) / (gradesList as number[]).length).toFixed(2)) : 0
      }));

      // Gender distribution
      const genderGroups = (allStudents || []).reduce((acc, student) => {
        const gender = student.gender || 'Não informado';
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const genderDistribution = Object.entries(genderGroups).map(([gender, count]) => ({
        gender,
        count
      }));

      // Race distribution
      const raceGroups = (allStudents || []).reduce((acc, student) => {
        const race = student.ethnicity || 'Não informado';
        acc[race] = (acc[race] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const raceDistribution = Object.entries(raceGroups).map(([race, count]) => ({
        race,
        count
      }));

      // Income distribution
      const incomeRanges = [
        { range: 'Até 1000', min: 0, max: 1000 },
        { range: '1000-2000', min: 1000, max: 2000 },
        { range: '2000-3000', min: 2000, max: 3000 },
        { range: '3000-5000', min: 3000, max: 5000 },
        { range: 'Acima de 5000', min: 5000, max: Infinity }
      ];

      const studentsWithIncome = (allStudents || []).filter(s => s.average_income != null);
      const incomeDistribution = incomeRanges.map(range => ({
        range: range.range,
        count: studentsWithIncome.filter(student => 
          Number(student.average_income) >= range.min && Number(student.average_income) < range.max
        ).length
      }));

      setDashboardData({
        totalStudents: studentsCount || 0,
        totalSubjects: selectedSubject === 'all' ? (subjectsData?.length || 0) : 1,
        averageGrade: Number(averageGrade.toFixed(2)),
        gradeDistribution,
        performanceBySubject,
        gradesTrend,
        genderDistribution,
        raceDistribution,
        incomeDistribution
      });

      // Fetch assessment distribution
      await fetchDistribution();

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDistribution = async () => {
    if (!user?.id) return;

    let query = supabase
      .from("grades")
      .select(`
        assessment_type,
        max_grade,
        subject_id,
        subjects!inner(
          id,
          name,
          professor_id,
          course_id
        )
      `)
      .eq("subjects.professor_id", user.id);

    if (selectedCourse !== "all") {
      query = query.eq("subjects.course_id", selectedCourse);
    }

    if (selectedSubject !== "all") {
      query = query.eq("subject_id", selectedSubject);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching distribution:", error);
      return;
    }

    // Aggregate data by assessment type
    const aggregated = (data || []).reduce((acc: Record<string, { total: number; count: number }>, curr: any) => {
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
      total_points: Number(data.total.toFixed(2)),
      count: data.count,
    }));

    setDistributionData(formattedData);
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
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              Dashboard Analítico
            </h1>
            <p className="text-lg text-muted-foreground mt-2">Análise completa de desempenho acadêmico</p>
          </div>
          
          <div className="flex gap-4">
            <div className="w-56">
              <Select value={selectedCourse} onValueChange={(value) => {
                setSelectedCourse(value);
                setSelectedSubject('all');
              }}>
                <SelectTrigger className="bg-card border-2 border-primary/20 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder="Filtrar por curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cursos</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} - {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-56">
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="bg-card border-2 border-primary/20 hover:border-primary/40 transition-colors">
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
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="card-enhanced group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Alunos</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{dashboardData.totalStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">estudantes cadastrados</p>
            </CardContent>
          </Card>
          
          <Card className="card-enhanced group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disciplinas</CardTitle>
              <div className="p-2 rounded-lg bg-chart-2/10 group-hover:bg-chart-2/20 transition-colors">
                <BookOpen className="h-5 w-5" style={{color: 'hsl(var(--chart-2))'}} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{color: 'hsl(var(--chart-2))'}}>
                {dashboardData.totalSubjects}
              </div>
              <p className="text-xs text-muted-foreground mt-1">matérias ativas</p>
            </CardContent>
          </Card>
          
          <Card className="card-enhanced group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Média Geral</CardTitle>
              <div className="p-2 rounded-lg bg-chart-3/10 group-hover:bg-chart-3/20 transition-colors">
                <TrendingUp className="h-5 w-5" style={{color: 'hsl(var(--chart-3))'}} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{color: 'hsl(var(--chart-3))'}}>
                {dashboardData.averageGrade}
              </div>
              <p className="text-xs text-muted-foreground mt-1">de 10 pontos</p>
            </CardContent>
          </Card>
          
          <Card className="card-enhanced group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Performance</CardTitle>
              <div className="p-2 rounded-lg bg-chart-4/10 group-hover:bg-chart-4/20 transition-colors">
                <Award className="h-5 w-5" style={{color: 'hsl(var(--chart-4))'}} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{color: 'hsl(var(--chart-4))'}}>
                {dashboardData.averageGrade >= 7 ? 'Boa' : dashboardData.averageGrade >= 5 ? 'Regular' : 'Baixa'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">classificação geral</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <Card className="chart-container">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-1 rounded bg-primary/20">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                Distribuição de Notas
              </CardTitle>
              <CardDescription className="text-base">Quantidade de notas por faixa de desempenho</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dashboardData.gradeDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-elegant)'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--chart-1))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="chart-container">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-1 rounded bg-chart-2/20">
                  <TrendingUp className="h-4 w-4" style={{color: 'hsl(var(--chart-2))'}} />
                </div>
                Performance por Disciplina
              </CardTitle>
              <CardDescription className="text-base">Média de notas por disciplina</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dashboardData.performanceBySubject} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-elegant)'
                    }}
                  />
                  <Bar 
                    dataKey="average" 
                    fill="hsl(var(--chart-2))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="chart-container">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-1 rounded bg-chart-3/20">
                  <TrendingUp className="h-4 w-4" style={{color: 'hsl(var(--chart-3))'}} />
                </div>
                Tendência por Tipo de Avaliação
              </CardTitle>
              <CardDescription className="text-base">Evolução da média por tipo de avaliação</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={dashboardData.gradesTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="assessment" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value) => Math.round(value).toString()}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-elegant)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="average" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--chart-3))', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, fill: 'hsl(var(--chart-3))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="chart-container">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-1 rounded bg-chart-4/20">
                  <div className="h-4 w-4 rounded-full" style={{backgroundColor: 'hsl(var(--chart-4))'}} />
                </div>
                Distribuição Visual de Notas
              </CardTitle>
              <CardDescription className="text-base">Proporção visual de notas por faixa</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.gradeDistribution.reduce((sum, item) => sum + item.count, 0) === 0 ? (
                <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                  <p>Nenhuma nota cadastrada</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={dashboardData.gradeDistribution.filter(item => item.count > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ range, percent }) => percent > 0.05 ? `${range}: ${(percent * 100).toFixed(0)}%` : ''}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {dashboardData.gradeDistribution.filter(item => item.count > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-elegant)',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                      labelStyle={{
                        color: 'hsl(var(--popover-foreground))'
                      }}
                      itemStyle={{
                        color: 'hsl(var(--popover-foreground))'
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} ${value === 1 ? 'nota' : 'notas'}`, 
                        'Quantidade'
                      ]}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      wrapperStyle={{
                        color: 'hsl(var(--foreground))',
                        fontSize: '14px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Race Distribution */}
          <Card className="chart-container mb-8">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-1 rounded bg-chart-2/20">
                  <div className="h-4 w-4 rounded-full" style={{backgroundColor: 'hsl(var(--chart-2))'}} />
                </div>
                Distribuição por Raça/Etnia
              </CardTitle>
              <CardDescription className="text-base">Quantidade de alunos por raça/etnia</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={dashboardData.raceDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ race, percent }) => `${race}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {dashboardData.raceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-elegant)',
                      color: 'hsl(var(--popover-foreground))'
                    }}
                    labelStyle={{
                      color: 'hsl(var(--popover-foreground))'
                    }}
                    itemStyle={{
                      color: 'hsl(var(--popover-foreground))'
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} ${value === 1 ? 'aluno' : 'alunos'}`, 
                      'Quantidade'
                    ]}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value: string, entry: any) => 
                      `${entry.payload.race} (${entry.payload.count} ${entry.payload.count === 1 ? 'aluno' : 'alunos'})`
                    }
                    wrapperStyle={{
                      color: 'hsl(var(--foreground))',
                      fontSize: '14px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Income Distribution */}
          <Card className="chart-container">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-1 rounded bg-chart-3/20">
                  <BarChart3 className="h-4 w-4" style={{color: 'hsl(var(--chart-3))'}} />
                </div>
                Distribuição de Renda Per Capita
              </CardTitle>
              <CardDescription className="text-base">Faixas de renda per capita mensal (R$)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dashboardData.incomeDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    angle={-20}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-elegant)'
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} ${value === 1 ? 'aluno' : 'alunos'}`, 
                      'Quantidade'
                    ]}
                    labelFormatter={(label: string) => `Faixa: ${label}`}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    wrapperStyle={{
                      paddingTop: '20px',
                      color: 'hsl(var(--foreground))',
                      fontSize: '14px'
                    }}
                    formatter={() => 'Quantidade de Alunos'}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--chart-3))" 
                    radius={[4, 4, 0, 0]}
                    name="Alunos"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-12" />

        {/* Assessment Distribution Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Distribuição de Pontos</h2>
          
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
                  {distributionData.reduce((sum, item) => sum + item.total_points, 0).toFixed(1)}
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
                      label={({ assessment_type, total_points }) => {
                        const totalPoints = distributionData.reduce((sum, item) => sum + item.total_points, 0);
                        return `${assessment_type}: ${((total_points / totalPoints) * 100).toFixed(1)}%`;
                      }}
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
                      {distributionData.map((item, index) => {
                        const totalPoints = distributionData.reduce((sum, item) => sum + item.total_points, 0);
                        return (
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
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold bg-muted/30">
                        <td className="p-2">Total</td>
                        <td className="text-right p-2">
                          {distributionData.reduce((sum, item) => sum + item.total_points, 0).toFixed(1)}
                        </td>
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
    </div>
  );
};

export default Dashboard;