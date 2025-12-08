import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Upload, FileText, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Grade {
  id: string;
  student_id: string;
  subject_id: string | null;
  grade: number;
  max_grade: number;
  assessment_type: string;
  assessment_name: string;
  date_assigned: string | null;
  students: {
    name: string;
    student_id: string;
  };
}

interface Student {
  id: string;
  name: string;
  student_id: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

const BATCH_SIZE = 100; // Insert grades in batches of 100

const Grades = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const { data: grades, isLoading } = useQuery({
    queryKey: ["grades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grades")
        .select(`
          *,
          students (
            name,
            student_id
          )
        `)
        .order("date_assigned", { ascending: false });

      if (error) throw error;
      return data as Grade[];
    },
  });

  const { data: students } = useQuery({
    queryKey: ["students-for-grades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, student_id")
        .order("name");

      if (error) throw error;
      return data as Student[];
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects-for-grades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, code")
        .order("name");

      if (error) throw error;
      return data as Subject[];
    },
  });

  const createGradeMutation = useMutation({
    mutationFn: async (values: {
      student_id: string;
      subject_id: string;
      grade: number;
      max_grade: number;
      assessment_type: string;
      assessment_name: string;
      date_assigned: string | null;
    }) => {
      const { error } = await supabase.from("grades").insert({
        student_id: values.student_id,
        subject_id: values.subject_id,
        grade: values.grade,
        max_grade: values.max_grade,
        assessment_type: values.assessment_type,
        assessment_name: values.assessment_name,
        date_assigned: values.date_assigned,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success("Nota lançada com sucesso!");
      setIsCreateDialogOpen(false);
      setSelectedStudentId("");
      setSelectedSubjectId("");
    },
    onError: (error) => {
      console.error("Erro ao lançar nota:", error);
      toast.error("Erro ao lançar nota");
    },
  });

  const updateGradeMutation = useMutation({
    mutationFn: async (values: {
      id: string;
      grade: number;
      max_grade: number;
      assessment_type: string;
      assessment_name: string;
      date_assigned: string | null;
    }) => {
      const { error } = await supabase
        .from("grades")
        .update({
          grade: values.grade,
          max_grade: values.max_grade,
          assessment_type: values.assessment_type,
          assessment_name: values.assessment_name,
          date_assigned: values.date_assigned,
        })
        .eq("id", values.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success("Nota atualizada com sucesso!");
      setIsEditDialogOpen(false);
      setEditingGrade(null);
    },
    onError: (error) => {
      console.error("Erro ao atualizar nota:", error);
      toast.error("Erro ao atualizar nota");
    },
  });

  const deleteGradeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("grades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success("Nota excluída com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao excluir nota:", error);
      toast.error("Erro ao excluir nota");
    },
  });

  const handleEdit = (grade: Grade) => {
    setEditingGrade(grade);
    setIsEditDialogOpen(true);
  };

  const handleSubmitEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGrade) return;

    const formData = new FormData(e.currentTarget);
    updateGradeMutation.mutate({
      id: editingGrade.id,
      grade: parseFloat(formData.get("grade") as string),
      max_grade: parseFloat(formData.get("max_grade") as string),
      assessment_type: formData.get("assessment_type") as string,
      assessment_name: formData.get("assessment_name") as string,
      date_assigned: formData.get("date_assigned") as string || null,
    });
  };

  const handleSubmitCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedStudentId || !selectedSubjectId) {
      toast.error("Selecione um aluno e uma disciplina");
      return;
    }

    const formData = new FormData(e.currentTarget);
    createGradeMutation.mutate({
      student_id: selectedStudentId,
      subject_id: selectedSubjectId,
      grade: parseFloat(formData.get("grade") as string),
      max_grade: parseFloat(formData.get("max_grade") as string),
      assessment_type: formData.get("assessment_type") as string,
      assessment_name: formData.get("assessment_name") as string,
      date_assigned: formData.get("date_assigned") as string || null,
    });
  };

  // Import functionality
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let jsonData: any[] = [];
        
        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = e.target?.result as string;
          const lines = text.trim().split('\n');
          if (lines.length < 2) throw new Error('Arquivo vazio');
          
          const separators = [',', ';', '\t'];
          let bestResult: any[] = [];
          
          for (const separator of separators) {
            const headers = lines[0].split(separator).map(h => h.trim().replace(/["\r]/g, ''));
            const rows = lines.slice(1).map(line => {
              const values = line.split(separator).map(v => v.trim().replace(/["\r]/g, ''));
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              return row;
            });
            
            const nonEmptyCells = rows.reduce((count, row) => {
              return count + Object.values(row).filter(v => v && String(v).trim()).length;
            }, 0);
            
            if (nonEmptyCells > bestResult.reduce((count, row) => {
              return count + Object.values(row).filter(v => v && String(v).trim()).length;
            }, 0)) {
              bestResult = rows;
            }
          }
          jsonData = bestResult;
        } else {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }
        
        if (jsonData.length === 0) {
          throw new Error('Arquivo vazio ou sem dados válidos');
        }
        
        setUploadedData(jsonData);
        toast.success(`${jsonData.length} registros encontrados`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao processar arquivo");
      }
    };
    
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: false
  });

  const getRowValue = (row: any, keys: string[]): string => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      const foundKey = rowKeys.find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  };

  const parseDecimal = (value: any): number => {
    if (!value) return 0;
    const str = String(value).replace(',', '.');
    return Number(str) || 0;
  };

  const parseExcelDate = (value: any): string => {
    if (!value) return '';
    const strValue = String(value).trim();
    
    // If it's already a date string (YYYY-MM-DD or DD/MM/YYYY format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
      return strValue;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(strValue)) {
      const [day, month, year] = strValue.split('/');
      return `${year}-${month}-${day}`;
    }
    
    // Excel serial date number conversion
    const numValue = Number(strValue);
    if (!isNaN(numValue) && numValue > 0 && numValue < 100000) {
      // Excel dates start from 1900-01-01, serial 1 = 1900-01-01
      // But Excel incorrectly considers 1900 as a leap year, so we adjust
      const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
      const date = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    return strValue;
  };

  const formatDateForDisplay = (value: any): string => {
    const dateStr = parseExcelDate(value);
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(value);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return String(value);
    }
  };

  const processGrades = async () => {
    try {
      const gradesToProcess = uploadedData.map(row => ({
        student_id: getRowValue(row, ['Matricula', 'matricula', 'Student_ID', 'student_id']),
        subject: getRowValue(row, ['Disciplina', 'disciplina', 'Subject', 'subject', 'subject_code', 'codigo_disciplina']),
        assessment_type: getRowValue(row, ['Tipo', 'tipo', 'Assessment_Type', 'assessment_type']) || 'Prova',
        assessment_name: getRowValue(row, ['Avaliacao', 'avaliacao', 'Avaliação', 'Assessment_Name', 'assessment_name']),
        grade: parseDecimal(getRowValue(row, ['Nota', 'nota', 'Grade', 'grade'])),
        max_grade: parseDecimal(getRowValue(row, ['Nota_Maxima', 'nota_maxima', 'Max_Grade', 'max_grade'])) || 10,
        date_assigned: parseExcelDate(getRowValue(row, ['Data', 'data', 'Date_Assigned', 'date_assigned'])) || new Date().toISOString().split('T')[0],
      }));

      // Validate required fields
      const missingSubject = gradesToProcess.some(g => !g.subject);
      if (missingSubject) {
        throw new Error('Todas as notas devem ter uma disciplina informada');
      }

      const missingStudent = gradesToProcess.some(g => !g.student_id);
      if (missingStudent) {
        throw new Error('Todas as notas devem ter uma matrícula informada');
      }

      // Get subjects from current user
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('professor_id', user?.id);

      if (!subjectsData || subjectsData.length === 0) {
        throw new Error('Você precisa criar disciplinas antes de importar notas');
      }

      // Create subject map
      const subjectMap = new Map<string, string>();
      subjectsData.forEach(subject => {
        if (subject.name) subjectMap.set(subject.name.toLowerCase().trim(), subject.id);
        if (subject.code) subjectMap.set(subject.code.toLowerCase().trim(), subject.id);
      });

      // Get students
      const studentIds = gradesToProcess.map(g => g.student_id).filter(Boolean);
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, student_id')
        .in('student_id', studentIds);

      if (!studentsData || studentsData.length === 0) {
        throw new Error('Nenhum aluno encontrado com as matrículas informadas');
      }

      const studentMap = new Map<string, string>();
      studentsData.forEach(student => {
        studentMap.set(student.student_id.toLowerCase().trim(), student.id);
      });

      // Process grades
      const validGrades = gradesToProcess.map(grade => {
        const subjectKey = grade.subject.toLowerCase().trim();
        const subjectId = subjectMap.get(subjectKey);
        const studentKey = grade.student_id.toLowerCase().trim();
        const studentDbId = studentMap.get(studentKey);

        if (!subjectId || !studentDbId) return null;

        return {
          student_id: studentDbId,
          subject_id: subjectId,
          assessment_type: grade.assessment_type,
          assessment_name: grade.assessment_name || grade.assessment_type,
          grade: grade.grade,
          max_grade: grade.max_grade,
          date_assigned: grade.date_assigned,
        };
      }).filter(Boolean);

      if (validGrades.length === 0) {
        throw new Error('Nenhuma nota válida para importar. Verifique se as disciplinas e matrículas correspondem aos cadastrados.');
      }

      // Insert in batches for better performance
      setIsImporting(true);
      setImportProgress({ current: 0, total: validGrades.length });

      let insertedCount = 0;
      const totalBatches = Math.ceil(validGrades.length / BATCH_SIZE);

      for (let i = 0; i < validGrades.length; i += BATCH_SIZE) {
        const batch = validGrades.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('grades').insert(batch);
        
        if (error) throw error;
        
        insertedCount += batch.length;
        setImportProgress({ current: insertedCount, total: validGrades.length });
      }

      setIsImporting(false);
      setImportProgress(null);
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success(`${validGrades.length} notas importadas com sucesso!`);
      setUploadedData([]);
      setIsUploadDialogOpen(false);
    } catch (error) {
      setIsImporting(false);
      setImportProgress(null);
      toast.error(error instanceof Error ? error.message : "Erro ao importar notas");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Notas</h1>
            <p className="text-muted-foreground">
              Visualize e edite as notas importadas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar Planilha
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Lançar Nota
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p>Carregando...</p>
        ) : (
          <div className="bg-card rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades?.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell className="font-medium">{grade.students?.name || "-"}</TableCell>
                    <TableCell>{grade.students?.student_id || "-"}</TableCell>
                    <TableCell>{grade.assessment_name}</TableCell>
                    <TableCell>{grade.assessment_type}</TableCell>
                    <TableCell>
                      {grade.grade} / {grade.max_grade}
                    </TableCell>
                    <TableCell>
                      {grade.date_assigned
                        ? format(new Date(grade.date_assigned), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(grade)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm("Deseja realmente excluir esta nota?")) {
                              deleteGradeMutation.mutate(grade.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Dialog de Edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Nota</DialogTitle>
            </DialogHeader>
            {editingGrade && (
              <form onSubmit={handleSubmitEdit} className="space-y-4">
                <div>
                  <Label>Aluno</Label>
                  <Input value={editingGrade.students?.name || ""} disabled />
                </div>
                <div>
                  <Label htmlFor="assessment_name">Nome da Avaliação</Label>
                  <Input
                    id="assessment_name"
                    name="assessment_name"
                    defaultValue={editingGrade.assessment_name}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="assessment_type">Tipo</Label>
                  <Input
                    id="assessment_type"
                    name="assessment_type"
                    defaultValue={editingGrade.assessment_type}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grade">Nota</Label>
                    <Input
                      id="grade"
                      name="grade"
                      type="number"
                      step="0.01"
                      defaultValue={editingGrade.grade}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_grade">Nota Máxima</Label>
                    <Input
                      id="max_grade"
                      name="max_grade"
                      type="number"
                      step="0.01"
                      defaultValue={editingGrade.max_grade}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="date_assigned">Data</Label>
                  <Input
                    id="date_assigned"
                    name="date_assigned"
                    type="date"
                    defaultValue={
                      editingGrade.date_assigned
                        ? format(new Date(editingGrade.date_assigned), "yyyy-MM-dd")
                        : ""
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateGradeMutation.isPending}>
                    Salvar
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Criação */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lançar Nova Nota</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <Label>Aluno</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {students?.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} ({student.student_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Disciplina</Label>
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects?.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="create_assessment_name">Nome da Avaliação</Label>
                <Input
                  id="create_assessment_name"
                  name="assessment_name"
                  placeholder="Ex: Prova 1, Trabalho Final"
                  required
                />
              </div>
              <div>
                <Label htmlFor="create_assessment_type">Tipo</Label>
                <Input
                  id="create_assessment_type"
                  name="assessment_type"
                  placeholder="Ex: Prova, Trabalho, Seminário"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create_grade">Nota</Label>
                  <Input
                    id="create_grade"
                    name="grade"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create_max_grade">Nota Máxima</Label>
                  <Input
                    id="create_max_grade"
                    name="max_grade"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="10"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="create_date_assigned">Data</Label>
                <Input
                  id="create_date_assigned"
                  name="date_assigned"
                  type="date"
                  defaultValue={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setSelectedStudentId("");
                    setSelectedSubjectId("");
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createGradeMutation.isPending}>
                  Lançar Nota
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Importação */}
        <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
          setIsUploadDialogOpen(open);
          if (!open) setUploadedData([]);
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importar Notas</DialogTitle>
              <DialogDescription>
                Faça upload de uma planilha com as notas dos alunos
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Colunas aceitas:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Matricula</strong> - Matrícula do aluno (obrigatório)</li>
                  <li><strong>Disciplina</strong> - Nome ou código da disciplina (obrigatório)</li>
                  <li><strong>Nota</strong> - Valor da nota</li>
                  <li><strong>Nota_Maxima</strong> - Valor máximo (padrão: 10)</li>
                  <li><strong>Tipo</strong> - Tipo de avaliação (Prova, Trabalho, etc.)</li>
                  <li><strong>Avaliacao</strong> - Nome da avaliação</li>
                  <li><strong>Data</strong> - Data da avaliação</li>
                </ul>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-primary">Solte o arquivo aqui...</p>
                ) : (
                  <div>
                    <p className="text-muted-foreground">
                      Arraste um arquivo ou clique para selecionar
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Formatos aceitos: .xlsx, .xls, .csv
                    </p>
                  </div>
                )}
              </div>

              {uploadedData.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{uploadedData.length} registros encontrados</span>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Disciplina</TableHead>
                          <TableHead>Nota</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadedData.slice(0, 5).map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>{getRowValue(row, ['Matricula', 'matricula', 'Student_ID', 'student_id'])}</TableCell>
                            <TableCell>{getRowValue(row, ['Disciplina', 'disciplina', 'Subject', 'subject'])}</TableCell>
                            <TableCell>{getRowValue(row, ['Nota', 'nota', 'Grade', 'grade'])}</TableCell>
                            <TableCell>{getRowValue(row, ['Tipo', 'tipo', 'Assessment_Type', 'assessment_type'])}</TableCell>
                            <TableCell>{formatDateForDisplay(getRowValue(row, ['Data', 'data', 'Date_Assigned', 'date_assigned']))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {uploadedData.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        ... e mais {uploadedData.length - 5} registros
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {isImporting && importProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando notas...
                  </span>
                  <span className="font-medium">
                    {importProgress.current} / {importProgress.total}
                  </span>
                </div>
                <Progress value={(importProgress.current / importProgress.total) * 100} />
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setUploadedData([]);
                }}
                disabled={isImporting}
              >
                Cancelar
              </Button>
              <Button
                onClick={processGrades}
                disabled={uploadedData.length === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  `Importar ${uploadedData.length} notas`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Grades;
