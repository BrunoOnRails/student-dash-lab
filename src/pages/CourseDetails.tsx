import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { ArrowLeft, Users, GraduationCap, Mail, User, Plus, Link2, Trash2 } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email?: string;
  student_id: string;
  course_id: string;
  created_at: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  total_semesters: number;
  start_date: string;
  created_at: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  year: number;
  semester: number;
  professor_id: string;
  course_id: string | null;
}

interface Professor {
  id: string;
  name: string;
  email: string | null;
}

const CourseDetails = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  
  // New subject form
  const [newSubject, setNewSubject] = useState({
    name: "",
    code: "",
    year: 1,
    semester: 1,
    professor_id: ""
  });

  useEffect(() => {
    if (courseId) {
      fetchCourseDetails();
    }
  }, [courseId]);

  const fetchCourseDetails = async () => {
    try {
      // Fetch course details
      const { data: courseData, error: courseError} = await (supabase as any)
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      // Fetch students in this course
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('course_id', courseId)
        .order('name');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Fetch subjects linked to this course
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('course_id', courseId)
        .order('year', { ascending: true })
        .order('semester', { ascending: true });

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Fetch all available subjects (not linked or user's subjects)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: allSubjectsData, error: allSubjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('professor_id', user?.id)
        .order('name');

      if (allSubjectsError) throw allSubjectsError;
      setAvailableSubjects(allSubjectsData || []);

      // Fetch professors for the dropdown
      const { data: professorsData, error: professorsError } = await supabase
        .from('professors')
        .select('*')
        .order('name');

      if (professorsError) throw professorsError;
      setProfessors(professorsData || []);

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

  const handleLinkSubject = async () => {
    if (!selectedSubjectId) {
      toast({
        title: "Erro",
        description: "Selecione uma disciplina",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('subjects')
        .update({ course_id: courseId })
        .eq('id', selectedSubjectId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Disciplina vinculada ao curso",
      });

      setIsLinkDialogOpen(false);
      setSelectedSubjectId("");
      fetchCourseDetails();
    } catch (error) {
      console.error('Error linking subject:', error);
      toast({
        title: "Erro",
        description: "Não foi possível vincular a disciplina",
        variant: "destructive",
      });
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubject.name || !newSubject.code || !newSubject.professor_id) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('subjects')
        .insert({
          name: newSubject.name,
          code: newSubject.code,
          year: newSubject.year,
          semester: newSubject.semester,
          professor_id: user?.id,
          professor_db_id: newSubject.professor_id,
          course_id: courseId
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Disciplina criada e vinculada ao curso",
      });

      setIsCreateDialogOpen(false);
      setNewSubject({
        name: "",
        code: "",
        year: 1,
        semester: 1,
        professor_id: ""
      });
      fetchCourseDetails();
    } catch (error) {
      console.error('Error creating subject:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a disciplina",
        variant: "destructive",
      });
    }
  };

  const handleAddSubjectToSemester = (semester: number) => {
    setNewSubject({
      name: "",
      code: "",
      year: 1,
      semester: semester,
      professor_id: ""
    });
    setIsCreateDialogOpen(true);
  };

  const handleUnlinkSubject = async (subjectId: string) => {
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ course_id: null })
        .eq('id', subjectId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Disciplina desvinculada do curso",
      });

      fetchCourseDetails();
    } catch (error) {
      console.error('Error unlinking subject:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desvincular a disciplina",
        variant: "destructive",
      });
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

  const totalStudents = students.length;

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
            <p className="text-muted-foreground">Código: {course.code}</p>
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

      {/* Timeline Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Grade Curricular por Semestre</CardTitle>
          <CardDescription>
            Visualize as disciplinas organizadas por semestre
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma disciplina vinculada ainda.
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from({ length: course.total_semesters }, (_, i) => i + 1).map((semester) => {
                const semesterSubjects = subjects.filter(s => s.semester === semester);
                
                return (
                  <div key={semester} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        {semester}º Semestre
                        <Badge variant="secondary" className="ml-2">
                          {semesterSubjects.length} {semesterSubjects.length === 1 ? 'disciplina' : 'disciplinas'}
                        </Badge>
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddSubjectToSemester(semester)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Disciplina
                      </Button>
                    </div>
                    {semesterSubjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground ml-7">
                        Nenhuma disciplina neste semestre
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-7">
                        {semesterSubjects.map((subject) => (
                          <div
                            key={subject.id}
                            className="border rounded-md p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <p className="font-medium">{subject.name}</p>
                            <p className="text-sm text-muted-foreground">{subject.code}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disciplinas Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciar Disciplinas</CardTitle>
              <CardDescription>
                Vincule ou crie disciplinas para este curso
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Link2 className="mr-2 h-4 w-4" />
                    Vincular Disciplina
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Vincular Disciplina Existente</DialogTitle>
                    <DialogDescription>
                      Selecione uma disciplina já criada para vincular a este curso
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Disciplina</Label>
                      <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma disciplina" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSubjects
                            .filter(s => !s.course_id || s.course_id === courseId)
                            .map((subject) => (
                              <SelectItem key={subject.id} value={subject.id}>
                                {subject.name} ({subject.code})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleLinkSubject}>Vincular</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Disciplina
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Disciplina</DialogTitle>
                    <DialogDescription>
                      Crie uma nova disciplina e vincule-a diretamente a este curso
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da Disciplina</Label>
                      <Input
                        id="name"
                        value={newSubject.name}
                        onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                        placeholder="Ex: Cálculo I"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code">Código</Label>
                      <Input
                        id="code"
                        value={newSubject.code}
                        onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })}
                        placeholder="Ex: MAT101"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="year">Ano</Label>
                        <Select 
                          value={newSubject.year.toString()} 
                          onValueChange={(value) => setNewSubject({ ...newSubject, year: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}º Ano
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="semester">Semestre</Label>
                        <Select 
                          value={newSubject.semester.toString()} 
                          onValueChange={(value) => setNewSubject({ ...newSubject, semester: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1º Semestre</SelectItem>
                            <SelectItem value="2">2º Semestre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="professor">Professor</Label>
                      <Select 
                        value={newSubject.professor_id} 
                        onValueChange={(value) => setNewSubject({ ...newSubject, professor_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um professor" />
                        </SelectTrigger>
                        <SelectContent>
                          {professors.map((professor) => (
                            <SelectItem key={professor.id} value={professor.id}>
                              {professor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateSubject}>Criar e Vincular</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma disciplina vinculada a este curso ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Semestre</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>{subject.code}</TableCell>
                    <TableCell>{subject.year}º Ano</TableCell>
                    <TableCell>{subject.semester}º Semestre</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlinkSubject(subject.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {students.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum aluno encontrado</CardTitle>
            <CardDescription>
              Ainda não há alunos matriculados neste curso.
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
        <>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Alunos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalStudents}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Código do Curso</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{course.code}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Alunos Matriculados</CardTitle>
                <CardDescription>
                  Lista de alunos matriculados neste curso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
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
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default CourseDetails;
