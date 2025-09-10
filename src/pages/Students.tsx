import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, ArrowLeft, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Student {
  id: string;
  name: string;
  email: string;
  student_id: string;
  course: string;
  subject_id: string;
  subject?: {
    name: string;
    code: string;
  };
}

interface Subject {
  id: string;
  name: string;
  code: string;
  semester: number;
  year: number;
}

const Students = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    student_id: '',
    course: '',
    subject_id: ''
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('professor_id', user?.id)
        .order('year', { ascending: false })
        .order('semester', { ascending: false });

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Fetch students with subject information
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          *,
          subjects!inner(name, code, professor_id)
        `)
        .eq('subjects.professor_id', user?.id)
        .order('name');

      if (studentsError) throw studentsError;
      
      const studentsWithSubjects = studentsData?.map(student => ({
        ...student,
        subject: student.subjects
      })) || [];

      setStudents(studentsWithSubjects);
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
    
    if (!formData.name || !formData.student_id || !formData.subject_id) {
      toast({
        title: "Erro",
        description: "Nome, matrícula e disciplina são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      const studentData = {
        name: formData.name,
        email: formData.email || null,
        student_id: formData.student_id,
        course: formData.course || null,
        subject_id: formData.subject_id
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

      setFormData({ name: '', email: '', student_id: '', course: '', subject_id: '' });
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
      course: student.course || '',
      subject_id: student.subject_id
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
    setFormData({ name: '', email: '', student_id: '', course: '', subject_id: '' });
    setEditingStudent(null);
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Alunos</h1>
              <p className="text-muted-foreground">Gerencie os alunos das suas disciplinas</p>
            </div>
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
                    <Label htmlFor="course">Curso (opcional)</Label>
                    <Input
                      id="course"
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                      placeholder="Nome do curso"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject">Disciplina</Label>
                    <Select value={formData.subject_id} onValueChange={(value) => setFormData({ ...formData, subject_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma disciplina" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.code} - {subject.name} ({subject.year}/{subject.semester})
                          </SelectItem>
                        ))}
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

        {subjects.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground mb-4">Você precisa cadastrar pelo menos uma disciplina antes de adicionar alunos</p>
              <Button onClick={() => navigate('/subjects')}>
                Cadastrar Disciplinas
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
                      <TableHead>Disciplina</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.student_id}</TableCell>
                        <TableCell>{student.email || '-'}</TableCell>
                        <TableCell>{student.course || '-'}</TableCell>
                        <TableCell>
                          {student.subject ? `${student.subject.code} - ${student.subject.name}` : '-'}
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
      </div>
    </div>
  );
};

export default Students;