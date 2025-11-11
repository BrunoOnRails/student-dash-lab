import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import Header from '@/components/Header';

interface Subject {
  id: string;
  name: string;
  code: string;
  semester: number;
  year: number;
  created_at: string;
  student_count?: number;
  course?: {
    id: string;
    name: string;
    code?: string;
  };
}

interface Student {
  id: string;
  name: string;
  student_id: string;
  email?: string;
  course?: string;
}

interface Course {
  id: string;
  name: string;
  code?: string;
}

const Subjects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [viewingStudents, setViewingStudents] = useState<Subject | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    semester: '',
    year: new Date().getFullYear().toString(),
    course_id: ''
  });

  useEffect(() => {
    if (user) {
      fetchSubjects();
      fetchCourses();
    }
  }, [user]);

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select(`
          *,
          course:courses(
            id,
            name,
            code
          ),
          students(count)
        `)
        .eq('professor_id', user?.id)
        .order('year', { ascending: false })
        .order('semester', { ascending: false });

      if (error) throw error;
      
      const subjectsWithCount = data?.map(subject => ({
        ...subject,
        student_count: subject.students?.[0]?.count || 0
      })) || [];
      
      setSubjects(subjectsWithCount);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar disciplinas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('courses')
        .select('*')
        .order('name');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code || !formData.semester || !formData.year) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      const subjectData = {
        name: formData.name,
        code: formData.code,
        semester: parseInt(formData.semester),
        year: parseInt(formData.year),
        course_id: formData.course_id || null,
        professor_id: user?.id
      };

      if (editingSubject) {
        const { error } = await supabase
          .from('subjects')
          .update(subjectData)
          .eq('id', editingSubject.id);
        
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Disciplina atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('subjects')
          .insert([subjectData]);
        
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Disciplina criada com sucesso"
        });
      }

      setFormData({ name: '', code: '', semester: '', year: new Date().getFullYear().toString(), course_id: '' });
      setEditingSubject(null);
      setIsDialogOpen(false);
      fetchSubjects();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar disciplina",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code,
      semester: subject.semester.toString(),
      year: subject.year.toString(),
      course_id: subject.course?.id || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta disciplina?')) return;

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Disciplina excluída com sucesso"
      });
      fetchSubjects();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir disciplina",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', code: '', semester: '', year: new Date().getFullYear().toString(), course_id: '' });
    setEditingSubject(null);
  };

  const handleViewStudents = async (subject: Subject) => {
    setViewingStudents(subject);
    setLoadingStudents(true);
    
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('subject_id', subject.id)
        .order('name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar alunos",
        variant: "destructive"
      });
    } finally {
      setLoadingStudents(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando disciplinas...</p>
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
            <h1 className="text-3xl font-bold">Minhas Disciplinas</h1>
            <p className="text-muted-foreground">Gerencie suas disciplinas e anos letivos</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Disciplina
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSubject ? 'Editar Disciplina' : 'Nova Disciplina'}
                </DialogTitle>
                <DialogDescription>
                  {editingSubject ? 'Atualize os dados da disciplina' : 'Cadastre uma nova disciplina'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Disciplina</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Matemática I"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: MAT001"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="course">Curso (opcional)</Label>
                  <select
                    id="course"
                    value={formData.course_id}
                    onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                    className="w-full p-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Selecione um curso</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name} {course.code ? `(${course.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="semester">Semestre</Label>
                    <Input
                      id="semester"
                      type="number"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      placeholder="1 ou 2"
                      min="1"
                      max="2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Ano</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      placeholder="2024"
                      min="2000"
                      max="2100"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingSubject ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Disciplinas Cadastradas</CardTitle>
            <CardDescription>
              {subjects.length === 0 ? 'Nenhuma disciplina cadastrada' : `${subjects.length} disciplina(s) encontrada(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Você ainda não cadastrou nenhuma disciplina</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeira Disciplina
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Semestre</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Alunos</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>{subject.code}</TableCell>
                      <TableCell>
                        {subject.course ? (
                          <span>
                            {subject.course.name}
                            {subject.course.code && ` (${subject.course.code})`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{subject.semester}º</TableCell>
                      <TableCell>{subject.year}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleViewStudents(subject)}
                          className="gap-1"
                        >
                          <Users className="h-4 w-4" />
                          {subject.student_count || 0}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(subject)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(subject.id)}>
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
      </div>

      <Dialog open={!!viewingStudents} onOpenChange={() => setViewingStudents(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Alunos - {viewingStudents?.name}</DialogTitle>
            <DialogDescription>
              {viewingStudents?.code} | {viewingStudents?.semester}º Semestre {viewingStudents?.year}
            </DialogDescription>
          </DialogHeader>
          
          {loadingStudents ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum aluno matriculado nesta disciplina</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Curso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.student_id}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.email || '-'}</TableCell>
                    <TableCell>{student.course || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Subjects;