import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { ArrowLeft, Users, GraduationCap, Mail, User } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email?: string;
  student_id: string;
  course?: string;
  created_at: string;
  subject: {
    id: string;
    name: string;
    code: string;
    semester: number;
    year: number;
  };
}

interface Course {
  id: string;
  name: string;
  code?: string;
  created_at: string;
}

const CourseDetails = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (courseId) {
      fetchCourseDetails();
    }
  }, [courseId]);

  const fetchCourseDetails = async () => {
    try {
      // Fetch course details
      const { data: courseData, error: courseError } = await (supabase as any)
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      // Fetch students in this course (via subjects)
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          *,
          subject:subjects!inner(
            id,
            name,
            code,
            semester,
            year,
            course_id
          )
        `)
        .eq('subjects.course_id', courseId)
        .order('name');

      if (studentsError) throw studentsError;

      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error fetching course details:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os detalhes do curso",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando detalhes do curso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto p-6">
        <Header />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Curso não encontrado</h1>
          <Button onClick={() => navigate('/courses')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Cursos
          </Button>
        </div>
      </div>
    );
  }

  // Group students by subject
  const studentsBySubject = students.reduce((acc, student) => {
    const subjectKey = `${student.subject.name} (${student.subject.code})`;
    if (!acc[subjectKey]) {
      acc[subjectKey] = {
        subject: student.subject,
        students: []
      };
    }
    acc[subjectKey].students.push(student);
    return acc;
  }, {} as Record<string, { subject: any, students: Student[] }>);

  return (
    <div className="container mx-auto p-6">
      <Header />
      
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigate('/courses')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Cursos
        </Button>
        
        <div className="flex items-center gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold">{course.name}</h1>
            {course.code && (
              <p className="text-muted-foreground">Código: {course.code}</p>
            )}
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {students.length} alunos
          </Badge>
        </div>
        
        <p className="text-muted-foreground">
          Curso criado em {new Date(course.created_at).toLocaleDateString('pt-BR')}
        </p>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum aluno encontrado</CardTitle>
            <CardDescription>
              Ainda não há alunos matriculados em disciplinas deste curso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/subjects')}>
                <GraduationCap className="mr-2 h-4 w-4" />
                Gerenciar Disciplinas
              </Button>
              <Button variant="outline" onClick={() => navigate('/students')}>
                <User className="mr-2 h-4 w-4" />
                Cadastrar Alunos
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(studentsBySubject).map(([subjectKey, data]) => (
            <Card key={subjectKey}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  {data.subject.name}
                </CardTitle>
                <CardDescription>
                  {data.subject.code} • {data.subject.semester}º Semestre • {data.subject.year}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Data de Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {student.name}
                          </div>
                        </TableCell>
                        <TableCell>{student.student_id}</TableCell>
                        <TableCell>
                          {student.email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {student.email}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(student.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseDetails;