import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, AlertCircle, CheckCircle, Eye, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';

interface StudentData {
  name: string;
  email: string;
  student_id: string;
  course: string; // Course name or code to link student to course
  sexo?: string;
  renda_media?: number;
  raca?: string;
}

interface GradeData {
  student_id: string;
  subject: string; // Subject name or code
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
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [detectionDetails, setDetectionDetails] = useState<string>('');
  const [showForceTypeDialog, setShowForceTypeDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let jsonData: any[] = [];
        
        if (file.name.toLowerCase().endsWith('.csv')) {
          // Enhanced CSV processing
          const text = e.target?.result as string;
          jsonData = parseCSVData(text);
        } else {
          // Excel processing
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
        detectDataType(jsonData);
        
        toast({
          title: "Planilha carregada",
          description: `${jsonData.length} registros encontrados`,
        });
      } catch (error) {
        toast({
          title: "Erro ao processar planilha",
          description: error instanceof Error ? error.message : "Verifique se o arquivo está no formato correto",
          variant: "destructive",
        });
      }
    };
    
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const parseCSVData = (text: string): any[] => {
    // Try different separators
    const separators = [',', ';', '\t'];
    let bestResult: any[] = [];
    let bestSeparator = ',';
    
    for (const separator of separators) {
      try {
        const lines = text.trim().split('\n');
        if (lines.length < 2) continue;
        
        const headers = lines[0].split(separator).map(h => h.trim().replace(/["\r]/g, ''));
        const rows = lines.slice(1).map(line => {
          const values = line.split(separator).map(v => v.trim().replace(/["\r]/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
        
        // Check if this separator gives better results (more non-empty cells)
        const nonEmptyCells = rows.reduce((count, row) => {
          return count + Object.values(row).filter(v => v && String(v).trim()).length;
        }, 0);
        
        if (nonEmptyCells > bestResult.reduce((count, row) => {
          return count + Object.values(row).filter(v => v && String(v).trim()).length;
        }, 0)) {
          bestResult = rows;
          bestSeparator = separator;
        }
      } catch (error) {
        continue;
      }
    }
    
    return bestResult;
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      processFile(file);
    }
  };

  const detectDataType = (data: any[]) => {
    if (data.length === 0) return;
    
    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    const normalizedKeys = columns.map(k => k.toLowerCase().trim());
    
    setDetectedColumns(columns);
    
    // Enhanced detection with Portuguese support
    const studentKeywords = [
      'name', 'nome', 'student_name', 'nome_aluno',
      'student_id', 'matricula', 'matrícula', 'id_aluno', 'codigo_aluno',
      'email', 'e-mail', 'student_email',
      'course', 'curso'
    ];
    
    const gradeKeywords = [
      'grade', 'nota', 'score', 'pontuacao', 'pontuação',
      'student_id', 'matricula', 'matrícula', 'id_aluno',
      'subject', 'disciplina', 'subject_name', 'nome_disciplina', 'subject_code', 'codigo_disciplina',
      'assessment_type', 'tipo', 'tipo_avaliacao', 'tipo_avaliação',
      'assessment_name', 'avaliacao', 'avaliação', 'nome_avaliacao',
      'max_grade', 'nota_maxima', 'nota_máxima', 'pontuacao_maxima'
    ];
    
    // Check for student data indicators
    const hasStudentName = normalizedKeys.some(key => 
      ['name', 'nome', 'student_name', 'nome_aluno'].includes(key)
    );
    const hasStudentId = normalizedKeys.some(key => 
      ['student_id', 'matricula', 'matrícula', 'id_aluno', 'codigo_aluno'].includes(key)
    );
    
    // Check for grade data indicators  
    const hasGrade = normalizedKeys.some(key => 
      ['grade', 'nota', 'score', 'pontuacao', 'pontuação'].includes(key)
    );
    const hasSubject = normalizedKeys.some(key => 
      ['subject', 'disciplina', 'subject_name', 'nome_disciplina', 'subject_code', 'codigo_disciplina'].includes(key)
    );
    const hasAssessmentType = normalizedKeys.some(key => 
      ['assessment_type', 'tipo', 'tipo_avaliacao', 'tipo_avaliação'].includes(key)
    );
    
    let detectedType: 'students' | 'grades' | null = null;
    let details = '';
    
    // More flexible detection logic
    if ((hasStudentName || hasStudentId) && !hasGrade) {
      detectedType = 'students';
      details = `Detectado como ALUNOS. Colunas encontradas: ${columns.join(', ')}`;
      if (hasStudentName && hasStudentId) {
        details += ' ✓ Nome e matrícula encontrados';
      } else if (hasStudentName) {
        details += ' ✓ Nome encontrado (matrícula opcional)';
      } else {
        details += ' ✓ Matrícula encontrada (nome opcional)';
      }
    } else if (hasGrade && hasStudentId && hasSubject) {
      detectedType = 'grades';
      details = `Detectado como NOTAS. Colunas encontradas: ${columns.join(', ')}`;
      details += ' ✓ Nota, matrícula e disciplina encontrados';
      if (hasAssessmentType) {
        details += ' ✓ Tipo de avaliação encontrado';
      }
    } else {
      details = `Formato não reconhecido automaticamente. Colunas encontradas: ${columns.join(', ')}. `;
      details += 'Para ALUNOS: precisa de "nome" ou "matricula". ';
      details += 'Para NOTAS: precisa de "nota", "matricula" e "disciplina".';
    }
    
    setDataType(detectedType);
    setDetectionDetails(details);
    
    if (!detectedType) {
      toast({
        title: "Formato não reconhecido automaticamente",
        description: "Verifique as colunas ou force o tipo de dados",
        variant: "destructive",
      });
    }
  };

  const forceDataType = (type: 'students' | 'grades') => {
    setDataType(type);
    setShowForceTypeDialog(false);
    setDetectionDetails(`Tipo forçado para ${type === 'students' ? 'ALUNOS' : 'NOTAS'}. Colunas: ${detectedColumns.join(', ')}`);
    toast({
      title: `Tipo definido como ${type === 'students' ? 'Alunos' : 'Notas'}`,
      description: "Verifique se os dados estão corretos antes de salvar",
    });
  };

  const processStudents = async () => {
    setIsProcessing(true);
    try {
      const studentsToInsert: StudentData[] = uploadedData.map(row => ({
        name: String(row.Nome || row.Name || row.name || '').trim(),
        email: String(row['E-mail'] || row.Email || row.email || '').trim(),
        student_id: String(row.Matricula || row.Student_ID || row.student_id || row.matrícula || '').trim(),
        course: String(row.Curso || row.Course || row.course || '').trim(),
        sexo: String(row.Sexo || row.sexo || row.Sex || row.sex || '').trim() || undefined,
        renda_media: parseFloat(String(row.Renda || row['Renda Média'] || row.renda_media || row['Renda Media'] || row.Income || '0').replace(',', '.')) || undefined,
        raca: String(row.Raça || row.Raca || row.raca || row.Race || row.Etnia || row.etnia || '').trim() || undefined
      }));

      // Filter out empty records
      const validStudents = studentsToInsert.filter(student => 
        student.name && student.student_id
      );

      if (validStudents.length === 0) {
        throw new Error('Nenhum aluno válido encontrado. Verifique se as colunas Nome e Matricula estão preenchidas.');
      }

      // Validate that all students have a course
      const missingCourse = validStudents.some(s => !s.course || s.course.trim() === '');
      if (missingCourse) {
        throw new Error('Todos os alunos devem ter um curso informado (nome ou código)');
      }

      // Get all courses to match by name or code
      const { data: allCourses } = await supabase
        .from('courses')
        .select('id, name, code');

      if (!allCourses || allCourses.length === 0) {
        throw new Error('Nenhum curso cadastrado. Cadastre os cursos antes de importar alunos.');
      }

      // Create a map of course names/codes to IDs
      const courseMap = new Map<string, string>();
      allCourses.forEach(course => {
        if (course.name) courseMap.set(course.name.toLowerCase().trim(), course.id);
        if (course.code) courseMap.set(course.code.toLowerCase().trim(), course.id);
      });

      // Check which students already exist
      const studentIds = validStudents.map(s => s.student_id);
      const { data: existingStudents } = await supabase
        .from('students')
        .select('student_id, id, name, email')
        .in('student_id', studentIds);

      const existingStudentMap = new Map(existingStudents?.map(s => [s.student_id, s]) || []);
      
      const newStudents = validStudents.filter(student => !existingStudentMap.has(student.student_id));
      const studentsToUpdate = validStudents.filter(student => existingStudentMap.has(student.student_id));

      let insertedCount = 0;
      let updatedCount = 0;
      const warnings: string[] = [];

      // Insert new students
      if (newStudents.length > 0) {
        const studentsWithCourseId = newStudents.map(student => {
          const courseKey = student.course.toLowerCase().trim();
          const courseId = courseMap.get(courseKey);
          
          if (!courseId) {
            warnings.push(`Curso não encontrado para aluno ${student.name}: ${student.course}`);
            return null;
          }

          return {
            name: student.name,
            email: student.email || null,
            student_id: student.student_id,
            course_id: courseId,
            sexo: student.sexo || null,
            renda_media: student.renda_media || null,
            raca: student.raca || null
          };
        }).filter(Boolean);

        if (studentsWithCourseId.length > 0) {
          const { error: insertError } = await supabase
            .from('students')
            .insert(studentsWithCourseId);

          if (insertError) throw insertError;
          insertedCount = studentsWithCourseId.length;
        }
      }

      // Update existing students
      if (studentsToUpdate.length > 0) {
        for (const student of studentsToUpdate) {
          const existingStudent = existingStudentMap.get(student.student_id);
          const courseKey = student.course.toLowerCase().trim();
          const courseId = courseMap.get(courseKey);
          
          if (!courseId) {
            warnings.push(`Curso não encontrado para aluno ${student.name}: ${student.course}`);
            continue;
          }
          
          if (existingStudent) {
            const { error: updateError } = await supabase
              .from('students')
              .update({
                name: student.name,
                email: student.email || null,
                course_id: courseId,
                sexo: student.sexo || null,
                renda_media: student.renda_media || null,
                raca: student.raca || null
              })
              .eq('id', existingStudent.id);

            if (updateError) throw updateError;
            updatedCount++;
          }
        }
      }

      const totalProcessed = insertedCount + updatedCount;

      if (warnings.length > 0) {
        console.warn('Warnings durante importação:', warnings);
      }

      toast({
        title: "Alunos processados com sucesso",
        description: `${insertedCount} novos, ${updatedCount} atualizados${warnings.length > 0 ? `. ${warnings.length} avisos (veja console)` : ''}`,
      });
      
      setUploadedData([]);
      setDataType(null);
    } catch (error) {
      console.error('Error importing students:', error);
      toast({
        title: "Erro ao importar alunos",
        description: error instanceof Error ? error.message : "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processGrades = async () => {
    setIsProcessing(true);
    try {
      // Helper function to convert Brazilian decimal format (comma) to JavaScript format (dot)
      const parseDecimal = (value: any): number => {
        if (!value) return 0;
        const str = String(value).replace(',', '.');
        return Number(str) || 0;
      };

      const gradesToInsert: Partial<GradeData>[] = uploadedData.map(row => ({
        student_id: row.student_id || row.Student_ID || row.Matricula || row.matricula,
        subject: row.subject || row.Subject || row.Disciplina || row.disciplina || row.subject_name || row.Subject_Name || row.nome_disciplina || row.subject_code || row.Subject_Code || row.codigo_disciplina,
        assessment_type: row.assessment_type || row.Assessment_Type || row.Tipo || row.tipo || 'Prova',
        assessment_name: row.assessment_name || row.Assessment_Name || row.Avaliacao || row.avaliacao || '',
        grade: parseDecimal(row.grade || row.Grade || row.Nota || row.nota),
        max_grade: parseDecimal(row.max_grade || row.Max_Grade || row.Nota_Maxima || row.nota_maxima || 10),
        date_assigned: row.date_assigned || row.Date_Assigned || row.Data || row.data || new Date().toISOString().split('T')[0],
      }));

      // Validate required fields
      const missingSubject = gradesToInsert.some(g => !g.subject);
      if (missingSubject) {
        throw new Error('Todas as notas devem ter uma disciplina informada (nome ou código)');
      }

      // Get all subjects from the current user to match by name or code
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('professor_id', user?.id);

      if (!subjects || subjects.length === 0) {
        throw new Error('Você precisa criar disciplinas antes de importar notas');
      }

      // Create a map of subject names/codes to IDs
      const subjectMap = new Map<string, string>();
      subjects.forEach(subject => {
        if (subject.name) subjectMap.set(subject.name.toLowerCase().trim(), subject.id);
        if (subject.code) subjectMap.set(subject.code.toLowerCase().trim(), subject.id);
      });

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
        .filter(g => g.student_id && g.subject && studentMap.has(g.student_id))
        .map(g => {
          const subjectKey = g.subject!.toLowerCase().trim();
          const subjectId = subjectMap.get(subjectKey);
          
          if (!subjectId) {
            console.warn(`Disciplina não encontrada: ${g.subject}`);
            return null;
          }

          return {
            student_id: studentMap.get(g.student_id!)!,
            subject_id: subjectId,
            assessment_type: g.assessment_type || 'Prova',
            assessment_name: g.assessment_name || 'Avaliação',
            grade: g.grade || 0,
            max_grade: g.max_grade || 10,
            date_assigned: g.date_assigned || new Date().toISOString().split('T')[0],
          };
        })
        .filter(Boolean) as Array<{
          student_id: string;
          subject_id: string;
          assessment_type: string;
          assessment_name: string;
          grade: number;
          max_grade: number;
          date_assigned: string;
        }>;

      if (validGrades.length === 0) {
        throw new Error('Nenhuma nota válida encontrada. Verifique se as disciplinas informadas existem no seu cadastro.');
      }

      // Check which grades already exist
      const gradeKeys = validGrades.map(g => 
        `${g.student_id}_${g.subject_id}_${g.assessment_name}_${g.assessment_type}_${g.date_assigned}`
      );
      
      const { data: existingGrades } = await supabase
        .from('grades')
        .select('student_id, subject_id, assessment_name, assessment_type, date_assigned, id, grade')
        .in('student_id', validGrades.map(g => g.student_id));

      const existingGradeMap = new Map(
        existingGrades?.map(g => [
          `${g.student_id}_${g.subject_id}_${g.assessment_name}_${g.assessment_type}_${g.date_assigned}`,
          g
        ]) || []
      );

      const newGrades = validGrades.filter(grade => 
        !existingGradeMap.has(`${grade.student_id}_${grade.subject_id}_${grade.assessment_name}_${grade.assessment_type}_${grade.date_assigned}`)
      );
      
      const gradesToUpdate = validGrades.filter(grade => 
        existingGradeMap.has(`${grade.student_id}_${grade.subject_id}_${grade.assessment_name}_${grade.assessment_type}_${grade.date_assigned}`)
      );

      let insertedCount = 0;
      let updatedCount = 0;

      // Insert new grades
      if (newGrades.length > 0) {
        const { error: insertError } = await supabase
          .from('grades')
          .insert(newGrades);

        if (insertError) throw insertError;
        insertedCount = newGrades.length;
      }

      // Update existing grades
      if (gradesToUpdate.length > 0) {
        for (const grade of gradesToUpdate) {
          const gradeKey = `${grade.student_id}_${grade.subject_id}_${grade.assessment_name}_${grade.assessment_type}_${grade.date_assigned}`;
          const existingGrade = existingGradeMap.get(gradeKey);
          
          if (existingGrade && existingGrade.grade !== grade.grade) {
            const { error: updateError } = await supabase
              .from('grades')
              .update({
                grade: grade.grade,
                max_grade: grade.max_grade
              })
              .eq('id', existingGrade.id);

            if (updateError) throw updateError;
            updatedCount++;
          }
        }
      }

      const totalProcessed = insertedCount + updatedCount;
      const ignoredCount = validGrades.length - totalProcessed;

      toast({
        title: "Notas processadas com sucesso",
        description: `${insertedCount} novas, ${updatedCount} atualizadas${ignoredCount > 0 ? `, ${ignoredCount} ignoradas` : ''}`,
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
                {detectionDetails && (
                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                    <Eye className="h-4 w-4 inline mr-1" />
                    {detectionDetails}
                  </div>
                )}
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

              <div className="mt-6 flex gap-4 flex-wrap">
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
                
                {!dataType && (
                  <Button 
                    variant="outline"
                    onClick={() => setShowForceTypeDialog(true)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Forçar Tipo
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setUploadedData([]);
                    setDataType(null);
                    setDetectedColumns([]);
                    setDetectionDetails('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Force Type Dialog */}
        <Dialog open={showForceTypeDialog} onOpenChange={setShowForceTypeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Forçar Tipo de Dados</DialogTitle>
              <DialogDescription>
                O sistema não conseguiu detectar automaticamente o tipo de dados.
                Selecione manualmente o que esta planilha contém:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Colunas detectadas: {detectedColumns.join(', ')}
              </p>
              <div className="flex gap-4">
                <Button onClick={() => forceDataType('students')}>
                  Dados de Alunos
                </Button>
                <Button onClick={() => forceDataType('grades')}>
                  Dados de Notas
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowForceTypeDialog(false)}
              >
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                    await processStudents();
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
                <li>• <strong>name/nome/Nome</strong>: Nome completo do aluno (obrigatório)</li>
                <li>• <strong>student_id/matricula/Matricula</strong>: Número de matrícula (obrigatório)</li>
                <li>• <strong>course/curso/Curso</strong>: Nome ou código do curso (obrigatório)</li>
                <li>• <strong>email/E-mail</strong>: E-mail do aluno (opcional)</li>
                <li>• <strong>sexo/Sexo</strong>: Sexo do aluno (opcional)</li>
                <li>• <strong>renda/Renda/renda_media/Renda Média</strong>: Renda média do aluno (opcional)</li>
                <li>• <strong>raca/Raça/etnia/Etnia</strong>: Raça/etnia do aluno (opcional)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Nota:</strong> Nome, matrícula e curso são obrigatórios.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Para importar notas:</h4>
              <p className="text-sm text-muted-foreground mb-2">
                A planilha deve conter as seguintes colunas:
              </p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• <strong>student_id/matricula/Matricula</strong>: Número de matrícula do aluno</li>
                <li>• <strong>subject/disciplina/Disciplina</strong>: Nome ou código da disciplina (obrigatório)</li>
                <li>• <strong>grade/nota/Nota</strong>: Nota obtida</li>
                <li>• <strong>assessment_type/tipo/Tipo</strong>: Tipo de avaliação (opcional)</li>
                <li>• <strong>assessment_name/avaliacao/Avaliacao</strong>: Nome da avaliação (opcional)</li>
                <li>• <strong>max_grade/nota_maxima/Nota_Maxima</strong>: Nota máxima (opcional, padrão: 10)</li>
                <li>• <strong>date_assigned/data/Data</strong>: Data da avaliação (opcional)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Nota:</strong> As colunas "matrícula", "disciplina" e "nota" são obrigatórias para notas.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>CSV:</strong> Suporte automático para separadores: vírgula (,), ponto e vírgula (;) e tab.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}