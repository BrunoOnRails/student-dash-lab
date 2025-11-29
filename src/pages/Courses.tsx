import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { Plus, Edit, Trash2, Users, FileSpreadsheet, GraduationCap, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';

interface Course {
  id: string;
  name: string;
  code: string;
  total_semesters: number;
  start_date: string;
  created_at: string;
  _count?: {
    students: number;
    subjects: number;
  };
}

interface Subject {
  id: string;
  name: string;
  code: string;
  semester: number;
  year: number;
}

const Courses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    total_semesters: 8,
    start_date: new Date().toISOString().split('T')[0]
  });
  const [subjectFormData, setSubjectFormData] = useState({
    name: '',
    code: '',
    semester: 1,
    year: new Date().getFullYear()
  });
  const [uploadedData, setUploadedData] = useState<any[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCourses();
      fetchSubjects();
    }
  }, [user]);

  const fetchCourses = async () => {
    try {
      // Get courses first
      const { data: coursesData, error } = await (supabase as any)
        .from('courses')
        .select('*')
        .order('name');

      if (error) throw error;

      // Get counts for each course
      const coursesWithCounts = await Promise.all(
        (coursesData || []).map(async (course: any) => {
          // Count students through subjects
          const { data: subjectsData } = await supabase
            .from('subjects')
            .select('id')
            .eq('course_id', course.id);

          const subjectIds = subjectsData?.map(s => s.id) || [];
          
          // Count students in this course directly
          const { data: studentsData } = await supabase
            .from('students')
            .select('id')
            .eq('course_id', course.id);
          
          const studentCount = studentsData?.length || 0;

          return {
            ...course,
            _count: {
              students: studentCount,
              subjects: subjectsData?.length || 0
            }
          };
        })
      );

      setCourses(coursesWithCounts);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast({
        title: "Erro ao carregar cursos",
        description: "Não foi possível carregar a lista de cursos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('professor_id', user?.id)
        .order('year', { ascending: false })
        .order('semester', { ascending: false });

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({
        title: "Erro de validação",
        description: "Nome e código do curso são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingCourse) {
        const { error } = await (supabase as any)
          .from('courses')
          .update({
            name: formData.name.trim(),
            code: formData.code.trim(),
            total_semesters: formData.total_semesters,
            start_date: formData.start_date
          })
          .eq('id', editingCourse.id);

        if (error) throw error;

        toast({
          title: "Curso atualizado",
          description: "Curso foi atualizado com sucesso",
        });
      } else {
        const { error } = await (supabase as any)
          .from('courses')
          .insert({
            name: formData.name.trim(),
            code: formData.code.trim(),
            total_semesters: formData.total_semesters,
            start_date: formData.start_date,
            user_id: user?.id
          });

        if (error) throw error;

        toast({
          title: "Curso criado",
          description: "Novo curso foi criado com sucesso",
        });
      }

      await fetchCourses();
      resetForm();
    } catch (error) {
      console.error('Error saving course:', error);
      toast({
        title: "Erro ao salvar curso",
        description: "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCourseId || !subjectFormData.name.trim() || !subjectFormData.code.trim()) {
      toast({
        title: "Erro de validação",
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('subjects')
        .insert({
          name: subjectFormData.name.trim(),
          code: subjectFormData.code.trim(),
          semester: subjectFormData.semester,
          year: subjectFormData.year,
          course_id: selectedCourseId,
          professor_id: user?.id
        });

      if (error) throw error;

      toast({
        title: "Disciplina criada",
        description: "Nova disciplina foi criada com sucesso",
      });

      await fetchCourses();
      await fetchSubjects();
      resetSubjectForm();
    } catch (error) {
      console.error('Error saving subject:', error);
      toast({
        title: "Erro ao salvar disciplina",
        description: "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      code: course.code,
      total_semesters: course.total_semesters,
      start_date: course.start_date
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (courseId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      toast({
        title: "Curso excluído",
        description: "Curso foi excluído com sucesso",
      });

      await fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast({
        title: "Erro ao excluir curso",
        description: "Não foi possível excluir o curso",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      code: '', 
      total_semesters: 8,
      start_date: new Date().toISOString().split('T')[0]
    });
    setEditingCourse(null);
    setIsDialogOpen(false);
  };

  const resetSubjectForm = () => {
    setSubjectFormData({
      name: '',
      code: '',
      semester: 1,
      year: new Date().getFullYear()
    });
    setSelectedCourseId('');
    setIsSubjectDialogOpen(false);
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        setUploadedData(jsonData);
        setShowUploadDialog(true);
      } catch (error) {
        toast({
          title: "Erro ao processar arquivo",
          description: "Verifique se o arquivo está no formato correto",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processCourses = async () => {
    try {
      const coursesToInsert = uploadedData.map(row => ({
        name: String(row.Nome || row.Name || row.name || '').trim(),
        code: String(row.Codigo || row.Code || row.code || '').trim() || null,
        user_id: user?.id
      })).filter(course => course.name);

      if (coursesToInsert.length === 0) {
        throw new Error('Nenhum curso válido encontrado. Verifique se a coluna Nome está preenchida.');
      }

      const { error } = await (supabase as any)
        .from('courses')
        .insert(coursesToInsert);

      if (error) throw error;

      toast({
        title: "Cursos importados com sucesso",
        description: `${coursesToInsert.length} cursos foram adicionados`,
      });

      await fetchCourses();
      setUploadedData([]);
      setShowUploadDialog(false);
    } catch (error) {
      console.error('Error importing courses:', error);
      toast({
        title: "Erro ao importar cursos",
        description: error instanceof Error ? error.message : "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: false
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando cursos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Header />
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Cursos</h1>
          <p className="text-muted-foreground">Gerencie os cursos da instituição</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Importar Planilha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Cursos</DialogTitle>
                <DialogDescription>
                  Faça upload de uma planilha Excel ou CSV com os dados dos cursos
                </DialogDescription>
              </DialogHeader>
              
              {uploadedData.length === 0 ? (
                <div {...getRootProps()} className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors">
                  <input {...getInputProps()} />
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  {isDragActive ? (
                    <p>Solte o arquivo aqui...</p>
                  ) : (
                    <div>
                      <p className="text-lg font-medium">Arraste e solte um arquivo aqui</p>
                      <p className="text-muted-foreground">ou clique para selecionar</p>
                      <p className="text-sm text-muted-foreground mt-2">Formatos aceitos: .xlsx, .xls, .csv</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="mb-4">Dados encontrados ({uploadedData.length} registros):</p>
                  <div className="max-h-64 overflow-auto border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Código</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadedData.slice(0, 5).map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>{row.Nome || row.Name || row.name || ''}</TableCell>
                            <TableCell>{row.Codigo || row.Code || row.code || ''}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {uploadedData.length > 5 && (
                    <p className="text-sm text-muted-foreground mt-2">... e mais {uploadedData.length - 5} registros</p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button onClick={processCourses}>Importar Cursos</Button>
                    <Button variant="outline" onClick={() => {
                      setUploadedData([]);
                      setShowUploadDialog(false);
                    }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <GraduationCap className="mr-2 h-4 w-4" />
                Nova Disciplina
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Disciplina ao Curso</DialogTitle>
                <DialogDescription>
                  Crie uma nova disciplina vinculada a um curso
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubjectSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="course-select">Curso</Label>
                  <select
                    id="course-select"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full p-2 border border-input rounded-md bg-background"
                    required
                  >
                    <option value="">Selecione um curso</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name} {course.code ? `(${course.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="subject-name">Nome da Disciplina</Label>
                  <Input
                    id="subject-name"
                    value={subjectFormData.name}
                    onChange={(e) => setSubjectFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="subject-code">Código</Label>
                  <Input
                    id="subject-code"
                    value={subjectFormData.code}
                    onChange={(e) => setSubjectFormData(prev => ({ ...prev, code: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="semester">Semestre</Label>
                    <Input
                      id="semester"
                      type="number"
                      min="1"
                      max="10"
                      value={subjectFormData.semester}
                      onChange={(e) => setSubjectFormData(prev => ({ ...prev, semester: parseInt(e.target.value) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Ano</Label>
                    <Input
                      id="year"
                      type="number"
                      value={subjectFormData.year}
                      onChange={(e) => setSubjectFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit">Criar Disciplina</Button>
                  <Button type="button" variant="outline" onClick={resetSubjectForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Curso
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCourse ? 'Editar Curso' : 'Novo Curso'}</DialogTitle>
                <DialogDescription>
                  {editingCourse ? 'Edite as informações do curso' : 'Adicione um novo curso'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome do Curso</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="total_semesters">Total de Semestres</Label>
                  <Input
                    id="total_semesters"
                    type="number"
                    min="1"
                    value={formData.total_semesters}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_semesters: parseInt(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="start_date">Data de Início</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit">
                    {editingCourse ? 'Atualizar' : 'Criar'} Curso
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum curso encontrado</CardTitle>
            <CardDescription>
              Comece criando seu primeiro curso ou importe dados de uma planilha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Curso
              </Button>
              <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Importar Planilha
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Alunos</TableHead>
                  <TableHead>Disciplinas</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.name}</TableCell>
                    <TableCell>{course.code || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/courses/${course.id}`)}
                        className="flex items-center gap-1 p-0 h-auto"
                      >
                        <Users className="h-4 w-4" />
                        {course._count?.students || 0}
                      </Button>
                    </TableCell>
                    <TableCell>{course._count?.subjects || 0}</TableCell>
                    <TableCell>
                      {new Date(course.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/courses/${course.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(course)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir curso</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o curso "{course.name}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(course.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Courses;