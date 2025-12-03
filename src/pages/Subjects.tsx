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
import { Plus, Edit, Trash2, FileSpreadsheet } from 'lucide-react';
import Header from '@/components/Header';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';

interface Subject {
  id: string;
  name: string;
  code: string;
  semester: number;
  year: number;
  created_at: string;
  course_id?: string;
}

const Subjects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    semester: '',
    year: new Date().getFullYear().toString()
  });
  const [uploadedData, setUploadedData] = useState<any[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSubjects();
    }
  }, [user]);

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
      toast({
        title: "Erro",
        description: "Erro ao carregar disciplinas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

      setFormData({ name: '', code: '', semester: '', year: new Date().getFullYear().toString() });
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
      year: subject.year.toString()
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
    setFormData({ name: '', code: '', semester: '', year: new Date().getFullYear().toString() });
    setEditingSubject(null);
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

  const processSubjects = async () => {
    try {
      const subjectsToInsert = uploadedData.map(row => {
        const semesterRaw = row.Semestre || row.semestre || row.Semester || row.semester || '';
        const yearRaw = row.Ano || row.ano || row.Year || row.year || '';
        
        return {
          name: String(row.Nome || row.Name || row.name || '').trim(),
          code: String(row.Codigo || row.Code || row.code || '').trim(),
          semester: semesterRaw ? parseInt(String(semesterRaw), 10) : 1,
          year: yearRaw ? parseInt(String(yearRaw), 10) : new Date().getFullYear(),
          professor_id: user?.id
        };
      }).filter(subject => subject.name && subject.code);

      if (subjectsToInsert.length === 0) {
        throw new Error('Nenhuma disciplina válida encontrada. Verifique se as colunas Nome e Codigo estão preenchidas.');
      }

      const { error } = await supabase
        .from('subjects')
        .insert(subjectsToInsert);

      if (error) throw error;

      toast({
        title: "Disciplinas importadas com sucesso",
        description: `${subjectsToInsert.length} disciplinas foram adicionadas`,
      });

      await fetchSubjects();
      setUploadedData([]);
      setShowUploadDialog(false);
    } catch (error) {
      console.error('Error importing subjects:', error);
      toast({
        title: "Erro ao importar disciplinas",
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
                  <DialogTitle>Importar Disciplinas</DialogTitle>
                  <DialogDescription>
                    Faça upload de uma planilha Excel ou CSV com os dados das disciplinas. Colunas aceitas: Nome, Codigo, Semestre, Ano
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
                            <TableHead>Semestre</TableHead>
                            <TableHead>Ano</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadedData.slice(0, 5).map((row, index) => (
                            <TableRow key={index}>
                              <TableCell>{row.Nome || row.Name || row.name || ''}</TableCell>
                              <TableCell>{row.Codigo || row.Code || row.code || ''}</TableCell>
                              <TableCell>{row.Semestre || row.semestre || row.Semester || row.semester || ''}</TableCell>
                              <TableCell>{row.Ano || row.ano || row.Year || row.year || ''}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {uploadedData.length > 5 && (
                      <p className="text-sm text-muted-foreground mt-2">... e mais {uploadedData.length - 5} registros</p>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Button onClick={processSubjects}>Importar Disciplinas</Button>
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
                    <TableHead>Semestre</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>{subject.code}</TableCell>
                      <TableCell>{subject.semester}º</TableCell>
                      <TableCell>{subject.year}</TableCell>
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
    </div>
  );
};

export default Subjects;
