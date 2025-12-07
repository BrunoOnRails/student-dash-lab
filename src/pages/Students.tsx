import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Upload, FileText } from 'lucide-react';
import Header from '@/components/Header';

interface Student {
  id: string;
  name: string;
  email: string;
  student_id: string;
  course_id: string;
  course?: {
    id: string;
    name: string;
    code: string;
  };
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface Grade {
  id: string;
  assessment_type: string;
  assessment_name: string;
  grade: number;
  max_grade: number;
  date_assigned: string | null;
  subject_id: string | null;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

const Students = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    student_id: '',
    course_id: '',
    gender: '',
    average_income: '',
    ethnicity: ''
  });
  const [viewingGrades, setViewingGrades] = useState<Student | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [isAddGradeOpen, setIsAddGradeOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [gradeFormData, setGradeFormData] = useState({
    assessment_type: '',
    assessment_name: '',
    grade: '',
    max_grade: '10',
    date_assigned: new Date().toISOString().split('T')[0],
    subject_id: ''
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('name');

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch subjects for the logged-in professor
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('professor_id', user?.id)
        .order('name');

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Fetch students with course information
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          *,
          course:courses!inner(id, name, code)
        `)
        .order('name');

      if (studentsError) throw studentsError;
      
      setStudents(studentsData || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.student_id || !formData.course_id) {
      toast({
        title: "Erro",
        description: "Nome, matrícula e curso são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      const studentData = {
        name: formData.name,
        email: formData.email || null,
        student_id: formData.student_id,
        course_id: formData.course_id,
        gender: formData.gender || null,
        average_income: formData.average_income ? parseFloat(formData.average_income) : null,
        ethnicity: formData.ethnicity || null
      };

      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update(studentData)
          .eq('id', editingStudent.id);
        
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Aluno atualizado com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('students')
          .insert([studentData]);
        
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Aluno cadastrado com sucesso"
        });
      }

      setFormData({ name: '', email: '', student_id: '', course_id: '', gender: '', average_income: '', ethnicity: '' });
      setEditingStudent(null);
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar aluno",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      email: student.email || '',
      student_id: student.student_id,
      course_id: student.course_id,
      gender: (student as any).gender || '',
      average_income: (student as any).average_income?.toString() || '',
      ethnicity: (student as any).ethnicity || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este aluno?')) return;

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Aluno excluído com sucesso"
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir aluno",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', student_id: '', course_id: '', gender: '', average_income: '', ethnicity: '' });
    setEditingStudent(null);
  };

  const handleViewGrades = async (student: Student) => {
    setViewingGrades(student);
    setLoadingGrades(true);
    
    try {
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', student.id)
        .order('date_assigned', { ascending: false });

      if (error) throw error;
      setGrades(data || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar notas",
        variant: "destructive"
      });
    } finally {
      setLoadingGrades(false);
    }
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!viewingGrades || !gradeFormData.assessment_type || !gradeFormData.assessment_name || !gradeFormData.grade || !gradeFormData.subject_id) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingGrade) {
        // Update existing grade
        const { error } = await supabase
          .from('grades')
          .update({
            assessment_type: gradeFormData.assessment_type,
            assessment_name: gradeFormData.assessment_name,
            grade: parseFloat(gradeFormData.grade),
            max_grade: parseFloat(gradeFormData.max_grade),
            date_assigned: gradeFormData.date_assigned || null,
            subject_id: gradeFormData.subject_id
          })
          .eq('id', editingGrade.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Nota atualizada com sucesso"
        });
      } else {
        // Insert new grade
        const { error } = await supabase
          .from('grades')
          .insert([{
            student_id: viewingGrades.id,
            assessment_type: gradeFormData.assessment_type,
            assessment_name: gradeFormData.assessment_name,
            grade: parseFloat(gradeFormData.grade),
            max_grade: parseFloat(gradeFormData.max_grade),
            date_assigned: gradeFormData.date_assigned || null,
            subject_id: gradeFormData.subject_id
          }]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Nota lançada com sucesso"
        });
      }
      
      setGradeFormData({
        assessment_type: '',
        assessment_name: '',
        grade: '',
        max_grade: '10',
        date_assigned: new Date().toISOString().split('T')[0],
        subject_id: ''
      });
      setEditingGrade(null);
      setIsAddGradeOpen(false);
      handleViewGrades(viewingGrades);
    } catch (error) {
      toast({
        title: "Erro",
        description: editingGrade ? "Erro ao atualizar nota" : "Erro ao lançar nota",
        variant: "destructive"
      });
    }
  };

  const handleDeleteGrade = async (gradeId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta nota?')) return;

    try {
      const { error } = await supabase
        .from('grades')
        .delete()
        .eq('id', gradeId);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Nota excluída com sucesso"
      });
      
      if (viewingGrades) {
        handleViewGrades(viewingGrades);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir nota",
        variant: "destructive"
      });
    }
  };

  const handleEditGrade = (grade: Grade) => {
    setEditingGrade(grade);
    setGradeFormData({
      assessment_type: grade.assessment_type,
      assessment_name: grade.assessment_name,
      grade: grade.grade.toString(),
      max_grade: grade.max_grade.toString(),
      date_assigned: grade.date_assigned || new Date().toISOString().split('T')[0],
      subject_id: grade.subject_id || ''
    });
    setIsAddGradeOpen(true);
  };

  const resetGradeForm = () => {
    setGradeFormData({
      assessment_type: '',
      assessment_name: '',
      grade: '',
      max_grade: '10',
      date_assigned: new Date().toISOString().split('T')[0],
      subject_id: ''
    });
    setEditingGrade(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando alunos...</p>
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
            <h1 className="text-3xl font-bold">Alunos</h1>
            <p className="text-muted-foreground">Gerencie os alunos das suas disciplinas</p>
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => navigate('/upload')}>
              <Upload className="h-4 w-4 mr-2" />
              Importar Planilha
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Aluno
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingStudent ? 'Editar Aluno' : 'Novo Aluno'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingStudent ? 'Atualize os dados do aluno' : 'Cadastre um novo aluno'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome do aluno"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="student_id">Matrícula</Label>
                    <Input
                      id="student_id"
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                      placeholder="Número da matrícula"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email (opcional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="course">Curso</Label>
                    <Select value={formData.course_id} onValueChange={(value) => setFormData({ ...formData, course_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um curso" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.code} - {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="gender">Sexo (opcional)</Label>
                    <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o sexo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Feminino">Feminino</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                        <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="average_income">Renda Média Familiar (opcional)</Label>
                    <Input
                      id="average_income"
                      type="number"
                      step="0.01"
                      value={formData.average_income}
                      onChange={(e) => setFormData({ ...formData, average_income: e.target.value })}
                      placeholder="Ex: 3500.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ethnicity">Raça/Etnia (opcional)</Label>
                    <Select value={formData.ethnicity} onValueChange={(value) => setFormData({ ...formData, ethnicity: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a raça/etnia" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Branca">Branca</SelectItem>
                        <SelectItem value="Preta">Preta</SelectItem>
                        <SelectItem value="Parda">Parda</SelectItem>
                        <SelectItem value="Amarela">Amarela</SelectItem>
                        <SelectItem value="Indígena">Indígena</SelectItem>
                        <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingStudent ? 'Atualizar' : 'Cadastrar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {courses.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground mb-4">Você precisa cadastrar pelo menos um curso antes de adicionar alunos</p>
              <Button onClick={() => navigate('/courses')}>
                Cadastrar Cursos
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Alunos Cadastrados</CardTitle>
              <CardDescription>
                {students.length === 0 ? 'Nenhum aluno cadastrado' : `${students.length} aluno(s) encontrado(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Você ainda não cadastrou nenhum aluno</p>
                  <div className="flex justify-center space-x-2">
                    <Button onClick={() => setIsDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar Aluno
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/upload')}>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Planilha
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.student_id}</TableCell>
                        <TableCell>{student.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {student.course?.code || 'N/A'} - {student.course?.name || 'Sem curso'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleViewGrades(student)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(student)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(student.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!viewingGrades} onOpenChange={(open) => !open && setViewingGrades(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Notas de {viewingGrades?.name}</DialogTitle>
              <DialogDescription>
                Matrícula: {viewingGrades?.student_id}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Dialog open={isAddGradeOpen} onOpenChange={(open) => {
                setIsAddGradeOpen(open);
                if (!open) resetGradeForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Lançar Nota
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingGrade ? 'Editar Nota' : 'Lançar Nova Nota'}</DialogTitle>
                    <DialogDescription>
                      {editingGrade ? `Edite a nota de ${viewingGrades?.name}` : `Adicione uma nova nota para ${viewingGrades?.name}`}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddGrade} className="space-y-4">
                    <div>
                      <Label htmlFor="subject_id">Disciplina *</Label>
                      <Select value={gradeFormData.subject_id} onValueChange={(value) => setGradeFormData({ ...gradeFormData, subject_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a disciplina" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.code} - {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="assessment_type">Tipo de Avaliação</Label>
                      <Select value={gradeFormData.assessment_type} onValueChange={(value) => setGradeFormData({ ...gradeFormData, assessment_type: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Prova">Prova</SelectItem>
                          <SelectItem value="Trabalho">Trabalho</SelectItem>
                          <SelectItem value="Projeto">Projeto</SelectItem>
                          <SelectItem value="Seminário">Seminário</SelectItem>
                          <SelectItem value="Atividade">Atividade</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="assessment_name">Nome da Avaliação</Label>
                      <Input
                        id="assessment_name"
                        value={gradeFormData.assessment_name}
                        onChange={(e) => setGradeFormData({ ...gradeFormData, assessment_name: e.target.value })}
                        placeholder="Ex: Prova 1, Trabalho Final, etc."
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="grade">Nota Obtida</Label>
                        <Input
                          id="grade"
                          type="number"
                          step="0.01"
                          min="0"
                          value={gradeFormData.grade}
                          onChange={(e) => setGradeFormData({ ...gradeFormData, grade: e.target.value })}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="max_grade">Nota Máxima</Label>
                        <Input
                          id="max_grade"
                          type="number"
                          step="0.01"
                          min="0"
                          value={gradeFormData.max_grade}
                          onChange={(e) => setGradeFormData({ ...gradeFormData, max_grade: e.target.value })}
                          placeholder="10.00"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="date_assigned">Data da Avaliação</Label>
                      <Input
                        id="date_assigned"
                        type="date"
                        value={gradeFormData.date_assigned}
                        onChange={(e) => setGradeFormData({ ...gradeFormData, date_assigned: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddGradeOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingGrade ? 'Atualizar Nota' : 'Lançar Nota'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {loadingGrades ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Carregando notas...</p>
                </div>
              ) : grades.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhuma nota lançada ainda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Avaliação</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades.map((grade) => (
                      <TableRow key={grade.id}>
                        <TableCell>{grade.assessment_type}</TableCell>
                        <TableCell>{grade.assessment_name}</TableCell>
                        <TableCell>
                          {grade.grade}/{grade.max_grade}
                        </TableCell>
                        <TableCell>
                          {grade.date_assigned ? new Date(grade.date_assigned).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditGrade(grade)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteGrade(grade.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Students;