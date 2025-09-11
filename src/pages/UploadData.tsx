import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';

interface StudentData {
  name: string;
  email: string;
  student_id: string;
  course: string;
}

interface GradeData {
  student_id: string;
  assessment_type: string;
  assessment_name: string;
  grade: number;
  max_grade: number;
  date_assigned: string;
}

export default function UploadData() {
  const [uploadedData, setUploadedData] = useState<any[]>([]);
  const [dataType, setDataType] = useState<'students' | 'grades' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'students' | 'grades' | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          setUploadedData(jsonData);
          detectDataType(jsonData);
          
          toast({
            title: "Planilha carregada",
            description: `${jsonData.length} registros encontrados`,
          });
        } catch (error) {
          toast({
            title: "Erro ao processar planilha",
            description: "Verifique se o arquivo está no formato correto",
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const detectDataType = (data: any[]) => {
    if (data.length === 0) return;
    
    const firstRow = data[0];
    const keys = Object.keys(firstRow).map(k => k.toLowerCase());
    
    if (keys.includes('name') && keys.includes('student_id')) {
      setDataType('students');
    } else if (keys.includes('grade') && keys.includes('assessment_type')) {
      setDataType('grades');
    } else {
      toast({
        title: "Formato não reconhecido",
        description: "A planilha deve conter colunas específicas para alunos ou notas",
        variant: "destructive",
      });
    }
  };

  const processStudents = async (subjectId: string) => {
    setIsProcessing(true);
    try {
      const studentsToInsert: StudentData[] = uploadedData.map(row => ({
        name: row.name || row.Name || row.Nome || '',
        email: row.email || row.Email || row['E-mail'] || '',
        student_id: String(row.student_id || row.Student_ID || row.Matricula || row.matrícula || ''),
        course: row.course || row.Course || row.Curso || '',
      }));

      const { data, error } = await supabase
        .from('students')
        .insert(studentsToInsert.map(student => ({
          ...student,
          subject_id: subjectId
        })));

      if (error) throw error;

      toast({
        title: "Alunos importados com sucesso",
        description: `${studentsToInsert.length} alunos foram adicionados`,
      });
      
      setUploadedData([]);
      setDataType(null);
    } catch (error) {
      toast({
        title: "Erro ao importar alunos",
        description: "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processGrades = async () => {
    setIsProcessing(true);
    try {
      const gradesToInsert: Partial<GradeData>[] = uploadedData.map(row => ({
        student_id: row.student_id || row.Student_ID || row.Matricula,
        assessment_type: row.assessment_type || row.Assessment_Type || row.Tipo || row.tipo || 'Prova',
        assessment_name: row.assessment_name || row.Assessment_Name || row.Avaliacao || row.avaliacao || '',
        grade: Number(row.grade || row.Grade || row.Nota || row.nota || 0),
        max_grade: Number(row.max_grade || row.Max_Grade || row.Nota_Maxima || row.nota_maxima || 10),
        date_assigned: row.date_assigned || row.Date_Assigned || row.Data || row.data || new Date().toISOString().split('T')[0],
      }));

      // Get student IDs to validate they exist
      const studentIds = gradesToInsert.map(g => g.student_id).filter(Boolean);
      const { data: students } = await supabase
        .from('students')
        .select('id, student_id')
        .in('student_id', studentIds);

      if (!students || students.length === 0) {
        throw new Error('Nenhum aluno encontrado com as matrículas fornecidas');
      }

      const studentMap = new Map(students.map(s => [s.student_id, s.id]));
      
      const validGrades = gradesToInsert
        .filter(g => g.student_id && studentMap.has(g.student_id))
        .map(g => ({
          student_id: studentMap.get(g.student_id)!,
          assessment_type: g.assessment_type || 'Prova',
          assessment_name: g.assessment_name || 'Avaliação',
          grade: g.grade || 0,
          max_grade: g.max_grade || 10,
          date_assigned: g.date_assigned || new Date().toISOString().split('T')[0],
        }));

      const { error } = await supabase
        .from('grades')
        .insert(validGrades);

      if (error) throw error;

      toast({
        title: "Notas importadas com sucesso",
        description: `${validGrades.length} notas foram adicionadas`,
      });
      
      setUploadedData([]);
      setDataType(null);
    } catch (error) {
      toast({
        title: "Erro ao importar notas",
        description: error instanceof Error ? error.message : "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Importar Dados</h1>
          <p className="text-muted-foreground">
            Faça upload de planilhas com informações de alunos ou notas
          </p>
        </div>

        {/* Upload Area */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Planilha
            </CardTitle>
            <CardDescription>
              Suporte para arquivos .xlsx, .xls e .csv
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-lg">Solte o arquivo aqui...</p>
              ) : (
                <div>
                  <p className="text-lg mb-2">Arraste um arquivo ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground">
                    Formatos aceitos: Excel (.xlsx, .xls) e CSV (.csv)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Preview */}
        {uploadedData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {dataType === 'students' ? (
                  <><CheckCircle className="h-5 w-5 text-green-600" /> Dados de Alunos Detectados</>
                ) : dataType === 'grades' ? (
                  <><CheckCircle className="h-5 w-5 text-green-600" /> Dados de Notas Detectados</>
                ) : (
                  <><AlertCircle className="h-5 w-5 text-orange-600" /> Formato Não Reconhecido</>
                )}
              </CardTitle>
              <CardDescription>
                {uploadedData.length} registros encontrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr className="bg-muted">
                      {Object.keys(uploadedData[0]).map((key) => (
                        <th key={key} className="border border-border p-2 text-left">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedData.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex} className="border border-border p-2">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {uploadedData.length > 5 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Mostrando apenas os primeiros 5 registros de {uploadedData.length}
                  </p>
                )}
              </div>

              {dataType && (
                <div className="mt-6 flex gap-4">
                  {dataType === 'students' && (
                    <Button 
                      onClick={() => {
                        setPendingAction('students');
                        setShowConfirmDialog(true);
                      }} 
                      disabled={isProcessing}
                    >
                      Salvar Alunos
                    </Button>
                  )}
                  {dataType === 'grades' && (
                    <Button 
                      onClick={() => {
                        setPendingAction('grades');
                        setShowConfirmDialog(true);
                      }} 
                      disabled={isProcessing}
                    >
                      Salvar Notas
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setUploadedData([]);
                      setDataType(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Importação</DialogTitle>
              <DialogDescription>
                Deseja salvar os {uploadedData.length} {pendingAction === 'students' ? 'alunos' : 'notas'} no banco de dados?
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingAction(null);
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={async () => {
                  setShowConfirmDialog(false);
                  if (pendingAction === 'students') {
                    await processStudents('temp-subject-id');
                  } else if (pendingAction === 'grades') {
                    await processGrades();
                  }
                  setPendingAction(null);
                }}
                disabled={isProcessing}
              >
                {isProcessing ? 'Salvando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Formato das Planilhas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Para importar alunos:</h4>
              <p className="text-sm text-muted-foreground mb-2">
                A planilha deve conter as seguintes colunas:
              </p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• <strong>name</strong> (ou Nome): Nome completo do aluno</li>
                <li>• <strong>student_id</strong> (ou Matricula): Número de matrícula</li>
                <li>• <strong>email</strong> (ou E-mail): E-mail do aluno (opcional)</li>
                <li>• <strong>course</strong> (ou Curso): Curso do aluno (opcional)</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Para importar notas:</h4>
              <p className="text-sm text-muted-foreground mb-2">
                A planilha deve conter as seguintes colunas:
              </p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• <strong>student_id</strong> (ou Matricula): Número de matrícula do aluno</li>
                <li>• <strong>assessment_type</strong> (ou Tipo): Tipo de avaliação (Prova, Trabalho, etc.)</li>
                <li>• <strong>assessment_name</strong> (ou Avaliacao): Nome da avaliação</li>
                <li>• <strong>grade</strong> (ou Nota): Nota obtida</li>
                <li>• <strong>max_grade</strong> (ou Nota_Maxima): Nota máxima (opcional, padrão: 10)</li>
                <li>• <strong>date_assigned</strong> (ou Data): Data da avaliação (opcional)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}