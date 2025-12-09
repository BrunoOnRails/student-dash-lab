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
  gender?: string;
  average_income?: number;
  ethnicity?: string;
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

interface CourseData {
  name: string;
  code: string;
  total_semesters: number;
  start_date: string;
}

interface ImportError {
  row: number;
  studentName: string;
  studentId: string;
  reason: string;
}

interface GradeImportError {
  row: number;
  studentId: string;
  subject: string;
  assessmentName: string;
  reason: string;
}

export default function UploadData() {
  const [uploadedData, setUploadedData] = useState<any[]>([]);
  const [dataType, setDataType] = useState<'students' | 'grades' | 'courses' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'students' | 'grades' | 'courses' | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [detectionDetails, setDetectionDetails] = useState<string>('');
  const [showForceTypeDialog, setShowForceTypeDialog] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [showErrorsDialog, setShowErrorsDialog] = useState(false);
  const [gradeImportErrors, setGradeImportErrors] = useState<GradeImportError[]>([]);
  const [showGradeErrorsDialog, setShowGradeErrorsDialog] = useState(false);
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
    const normalizedKeys = columns.map(k => k.toLowerCase().trim().replace(/[_-]/g, ''));
    
    setDetectedColumns(columns);
    
    // Check for course data indicators FIRST (most specific)
    const hasCourseCode = normalizedKeys.some(key => 
      ['codigo', 'code', 'codigocurso', 'coursecode'].includes(key)
    );
    const hasTotalSemesters = normalizedKeys.some(key => 
      ['totalsemestre', 'totalsemestres', 'semestres', 'semesters', 'totalsemesters'].includes(key)
    );
    const hasStartDate = normalizedKeys.some(key => 
      ['datainicio', 'startdate', 'inicio', 'dataini'].includes(key)
    );
    const hasCourseName = normalizedKeys.some(key => 
      ['nome', 'name', 'nomecurso', 'coursename'].includes(key)
    );
    // Check if it looks like a course (has code AND doesn't have student-specific fields)
    const hasStudentId = normalizedKeys.some(key => 
      ['studentid', 'matricula', 'matrícula', 'idaluno', 'codigoaluno'].includes(key)
    );
    
    // Check for grade data indicators  
    const hasGrade = normalizedKeys.some(key => 
      ['grade', 'nota', 'score', 'pontuacao', 'pontuação'].includes(key)
    );
    const hasSubject = normalizedKeys.some(key => 
      ['subject', 'disciplina', 'subjectname', 'nomedisciplina', 'subjectcode', 'codigodisciplina'].includes(key)
    );
    const hasAssessmentType = normalizedKeys.some(key => 
      ['assessmenttype', 'tipo', 'tipoavaliacao', 'tipoavaliação'].includes(key)
    );
    
    let detectedType: 'students' | 'grades' | 'courses' | null = null;
    let details = '';
    
    // Detection logic - check courses first since they're more specific
    if ((hasCourseCode || hasTotalSemesters) && !hasStudentId && !hasGrade) {
      detectedType = 'courses';
      details = `Detectado como CURSOS. Colunas encontradas: ${columns.join(', ')}`;
      if (hasCourseName) details += ' ✓ Nome do curso encontrado';
      if (hasCourseCode) details += ' ✓ Código encontrado';
      if (hasTotalSemesters) details += ' ✓ Total de semestres encontrado';
      if (hasStartDate) details += ' ✓ Data de início encontrada';
    } else if (hasGrade && hasStudentId && hasSubject) {
      detectedType = 'grades';
      details = `Detectado como NOTAS. Colunas encontradas: ${columns.join(', ')}`;
      details += ' ✓ Nota, matrícula e disciplina encontrados';
      if (hasAssessmentType) {
        details += ' ✓ Tipo de avaliação encontrado';
      }
    } else if ((hasCourseName || hasStudentId) && !hasGrade && !hasTotalSemesters) {
      detectedType = 'students';
      details = `Detectado como ALUNOS. Colunas encontradas: ${columns.join(', ')}`;
      if (hasCourseName && hasStudentId) {
        details += ' ✓ Nome e matrícula encontrados';
      } else if (hasCourseName) {
        details += ' ✓ Nome encontrado (matrícula opcional)';
      } else {
        details += ' ✓ Matrícula encontrada (nome opcional)';
      }
    } else {
      details = `Formato não reconhecido automaticamente. Colunas encontradas: ${columns.join(', ')}. `;
      details += 'Para CURSOS: precisa de "codigo" ou "total_semestres". ';
      details += 'Para ALUNOS: precisa de "nome" e "matricula". ';
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

  const forceDataType = (type: 'students' | 'grades' | 'courses') => {
    setDataType(type);
    setShowForceTypeDialog(false);
    const typeLabels = { students: 'ALUNOS', grades: 'NOTAS', courses: 'CURSOS' };
    setDetectionDetails(`Tipo forçado para ${typeLabels[type]}. Colunas: ${detectedColumns.join(', ')}`);
    toast({
      title: `Tipo definido como ${typeLabels[type]}`,
      description: "Verifique se os dados estão corretos antes de salvar",
    });
  };

  const capitalizeFirst = (text: string): string => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  const processStudents = async () => {
    setIsProcessing(true);
    const errors: ImportError[] = [];
    
    try {
      const studentsToInsert: StudentData[] = uploadedData.map((row, index) => {
        const genderRaw = String(row.Sexo || row.sexo || row.Sex || row.sex || row.Gender || row.gender || '').trim();
        const ethnicityRaw = String(row.Raça || row.Raca || row.raca || row.Race || row.Etnia || row.etnia || row.Ethnicity || row.ethnicity || '').trim();
        
        return {
          name: String(row.Nome || row.Name || row.name || '').trim(),
          email: String(row['E-mail'] || row.Email || row.email || '').trim(),
          student_id: String(row.Matricula || row.Student_ID || row.student_id || row.matrícula || '').trim(),
          course: String(row.Curso || row.Course || row.course || '').trim(),
          gender: genderRaw ? capitalizeFirst(genderRaw) : undefined,
          average_income: parseFloat(String(row.Renda || row['Renda Média'] || row.renda_media || row['Renda Media'] || row.Income || row.average_income || '0').replace(',', '.')) || undefined,
          ethnicity: ethnicityRaw ? capitalizeFirst(ethnicityRaw) : undefined,
          _rowIndex: index + 2 // +2 for header row and 1-based index
        };
      });

      // Validate and track invalid records
      const validStudents: (StudentData & { _rowIndex: number })[] = [];
      studentsToInsert.forEach((student: any) => {
        if (!student.name || !student.student_id) {
          errors.push({
            row: student._rowIndex,
            studentName: student.name || '(sem nome)',
            studentId: student.student_id || '(sem matrícula)',
            reason: !student.name && !student.student_id 
              ? 'Nome e matrícula vazios' 
              : !student.name 
                ? 'Nome vazio' 
                : 'Matrícula vazia'
          });
        } else if (!student.course || student.course.trim() === '') {
          errors.push({
            row: student._rowIndex,
            studentName: student.name,
            studentId: student.student_id,
            reason: 'Curso não informado'
          });
        } else {
          validStudents.push(student);
        }
      });

      if (validStudents.length === 0) {
        setImportErrors(errors);
        setShowErrorsDialog(true);
        throw new Error('Nenhum aluno válido encontrado.');
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

      // Process new students
      const studentsWithCourseId: any[] = [];
      newStudents.forEach((student: any) => {
        const courseKey = student.course.toLowerCase().trim();
        const courseId = courseMap.get(courseKey);
        
        if (!courseId) {
          errors.push({
            row: student._rowIndex,
            studentName: student.name,
            studentId: student.student_id,
            reason: `Curso não encontrado: "${student.course}"`
          });
          return;
        }

        studentsWithCourseId.push({
          name: student.name,
          email: student.email || null,
          student_id: student.student_id,
          course_id: courseId,
          gender: student.gender || null,
          average_income: student.average_income || null,
          ethnicity: student.ethnicity || null
        });
      });

      if (studentsWithCourseId.length > 0) {
        const { error: insertError } = await supabase
          .from('students')
          .insert(studentsWithCourseId);

        if (insertError) {
          // If batch insert fails, try individual inserts to identify problematic records
          for (let i = 0; i < studentsWithCourseId.length; i++) {
            const student = studentsWithCourseId[i];
            const originalStudent = newStudents.find(s => s.student_id === student.student_id) as any;
            
            const { error: singleError } = await supabase
              .from('students')
              .insert(student);
            
            if (singleError) {
              errors.push({
                row: originalStudent?._rowIndex || i + 2,
                studentName: student.name,
                studentId: student.student_id,
                reason: singleError.message || 'Erro ao inserir'
              });
            } else {
              insertedCount++;
            }
          }
        } else {
          insertedCount = studentsWithCourseId.length;
        }
      }

      // Update existing students
      for (const student of studentsToUpdate as any[]) {
        const existingStudent = existingStudentMap.get(student.student_id);
        const courseKey = student.course.toLowerCase().trim();
        const courseId = courseMap.get(courseKey);
        
        if (!courseId) {
          errors.push({
            row: student._rowIndex,
            studentName: student.name,
            studentId: student.student_id,
            reason: `Curso não encontrado: "${student.course}"`
          });
          continue;
        }
        
        if (existingStudent) {
          const { error: updateError } = await supabase
            .from('students')
            .update({
              name: student.name,
              email: student.email || null,
              course_id: courseId,
              gender: student.gender || null,
              average_income: student.average_income || null,
              ethnicity: student.ethnicity || null
            })
            .eq('id', existingStudent.id);

          if (updateError) {
            errors.push({
              row: student._rowIndex,
              studentName: student.name,
              studentId: student.student_id,
              reason: updateError.message || 'Erro ao atualizar'
            });
          } else {
            updatedCount++;
          }
        }
      }

      // Store errors and show dialog if there are any
      if (errors.length > 0) {
        setImportErrors(errors);
        setShowErrorsDialog(true);
      }

      toast({
        title: errors.length > 0 ? "Importação parcial" : "Alunos processados com sucesso",
        description: `${insertedCount} novos, ${updatedCount} atualizados${errors.length > 0 ? `. ${errors.length} erros encontrados.` : ''}`,
        variant: errors.length > 0 ? "destructive" : "default",
      });
      
      setUploadedData([]);
      setDataType(null);
    } catch (error) {
      console.error('Error importing students:', error);
      if (errors.length > 0) {
        setImportErrors(errors);
        setShowErrorsDialog(true);
      }
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
    const errors: GradeImportError[] = [];
    
    try {
      // Helper function to convert Brazilian decimal format (comma) to JavaScript format (dot)
      const parseDecimal = (value: any): number => {
        if (!value) return 0;
        const str = String(value).replace(',', '.');
        return Number(str) || 0;
      };

      // Helper function to parse date from various formats including Excel serial numbers
      const parseDate = (value: any): string => {
        if (!value) return new Date().toISOString().split('T')[0];
        
        // If it's already a valid date string (YYYY-MM-DD format)
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return value;
        }
        
        // If it's a number (Excel serial date), convert it
        if (typeof value === 'number' && value > 0) {
          // Excel serial date: days since 1899-12-30 (with Excel's leap year bug)
          // JavaScript Date starts from 1970-01-01
          const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
          const jsDate = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
          return jsDate.toISOString().split('T')[0];
        }
        
        // If it's a string that looks like a number
        const numValue = Number(value);
        if (!isNaN(numValue) && numValue > 0) {
          const excelEpoch = new Date(1899, 11, 30);
          const jsDate = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
          return jsDate.toISOString().split('T')[0];
        }
        
        // Try to parse as a date string
        const parsedDate = new Date(value);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString().split('T')[0];
        }
        
        return new Date().toISOString().split('T')[0];
      };

      const gradesToInsert: (Partial<GradeData> & { _rowIndex: number })[] = uploadedData.map((row, index) => {
        // Get the assessment name from Tipo column (e.g., "Prova 1", "Trabalho", "Seminário")
        const assessmentName = String(row.assessment_name || row.Assessment_Name || row.Avaliacao || row.avaliacao || row.Tipo || row.tipo || 'Avaliação').trim();
        
        // Extract assessment type from the name (e.g., "Prova 1" -> "Prova", "Trabalho" -> "Trabalho")
        const assessmentType = row.assessment_type || row.Assessment_Type || assessmentName.split(/\s+\d/)[0] || 'Prova';
        
        const rawDate = row.date_assigned || row.Date_Assigned || row.Data || row.data;
        
        return {
          student_id: String(row.student_id || row.Student_ID || row.Matricula || row.matricula || '').trim(),
          subject: String(row.subject || row.Subject || row.Disciplina || row.disciplina || row.subject_name || row.Subject_Name || row.nome_disciplina || row.subject_code || row.Subject_Code || row.codigo_disciplina || '').trim(),
          assessment_type: assessmentType,
          assessment_name: assessmentName,
          grade: parseDecimal(row.grade || row.Grade || row.Nota || row.nota),
          max_grade: parseDecimal(row.max_grade || row.Max_Grade || row.Nota_Maxima || row.nota_maxima || 10),
          date_assigned: parseDate(rawDate),
          _rowIndex: index + 2, // +2 for header row and 1-based index
        };
      });

      // Validate and track errors for missing fields
      const validatedGrades: (Partial<GradeData> & { _rowIndex: number })[] = [];
      gradesToInsert.forEach(grade => {
        if (!grade.student_id) {
          errors.push({
            row: grade._rowIndex,
            studentId: '(sem matrícula)',
            subject: grade.subject || '(sem disciplina)',
            assessmentName: grade.assessment_name || '',
            reason: 'Matrícula do aluno não informada'
          });
        } else if (!grade.subject) {
          errors.push({
            row: grade._rowIndex,
            studentId: grade.student_id,
            subject: '(sem disciplina)',
            assessmentName: grade.assessment_name || '',
            reason: 'Disciplina não informada'
          });
        } else {
          validatedGrades.push(grade);
        }
      });

      if (validatedGrades.length === 0 && errors.length > 0) {
        setGradeImportErrors(errors);
        setShowGradeErrorsDialog(true);
        throw new Error('Nenhuma nota válida encontrada. Verifique os erros.');
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
      const studentIds = validatedGrades.map(g => g.student_id).filter(Boolean) as string[];
      const { data: students } = await supabase
        .from('students')
        .select('id, student_id')
        .in('student_id', studentIds);

      const studentMap = new Map(students?.map(s => [s.student_id, s.id]) || []);
      
      // Process grades and track errors
      const processedGrades: Array<{
        student_id: string;
        subject_id: string;
        assessment_type: string;
        assessment_name: string;
        grade: number;
        max_grade: number;
        date_assigned: string;
        _rowIndex: number;
        _originalStudentId: string;
        _subjectName: string;
      }> = [];

      validatedGrades.forEach(g => {
        const subjectKey = g.subject!.toLowerCase().trim();
        const subjectId = subjectMap.get(subjectKey);
        const studentDbId = studentMap.get(g.student_id!);
        
        if (!studentDbId) {
          errors.push({
            row: g._rowIndex,
            studentId: g.student_id!,
            subject: g.subject || '',
            assessmentName: g.assessment_name || '',
            reason: `Aluno não encontrado (matrícula: ${g.student_id})`
          });
          return;
        }
        
        if (!subjectId) {
          errors.push({
            row: g._rowIndex,
            studentId: g.student_id!,
            subject: g.subject || '',
            assessmentName: g.assessment_name || '',
            reason: `Disciplina não encontrada: "${g.subject}"`
          });
          return;
        }

        processedGrades.push({
          student_id: studentDbId,
          subject_id: subjectId,
          assessment_type: g.assessment_type || 'Prova',
          assessment_name: g.assessment_name || 'Avaliação',
          grade: g.grade || 0,
          max_grade: g.max_grade || 10,
          date_assigned: g.date_assigned || new Date().toISOString().split('T')[0],
          _rowIndex: g._rowIndex,
          _originalStudentId: g.student_id!,
          _subjectName: g.subject!,
        });
      });

      if (processedGrades.length === 0) {
        if (errors.length > 0) {
          setGradeImportErrors(errors);
          setShowGradeErrorsDialog(true);
        }
        throw new Error('Nenhuma nota válida encontrada. Verifique se os alunos e disciplinas existem no sistema.');
      }

      // Check which grades already exist
      const { data: existingGrades } = await supabase
        .from('grades')
        .select('student_id, subject_id, assessment_name, assessment_type, date_assigned, id, grade')
        .in('student_id', processedGrades.map(g => g.student_id));

      const existingGradeMap = new Map(
        existingGrades?.map(g => [
          `${g.student_id}_${g.subject_id}_${g.assessment_name}_${g.assessment_type}_${g.date_assigned}`,
          g
        ]) || []
      );

      const newGrades = processedGrades.filter(grade => 
        !existingGradeMap.has(`${grade.student_id}_${grade.subject_id}_${grade.assessment_name}_${grade.assessment_type}_${grade.date_assigned}`)
      );
      
      const gradesToUpdate = processedGrades.filter(grade => 
        existingGradeMap.has(`${grade.student_id}_${grade.subject_id}_${grade.assessment_name}_${grade.assessment_type}_${grade.date_assigned}`)
      );

      let insertedCount = 0;
      let updatedCount = 0;

      // Insert new grades in batches with individual error tracking
      const BATCH_SIZE = 100;
      if (newGrades.length > 0) {
        for (let i = 0; i < newGrades.length; i += BATCH_SIZE) {
          const batch = newGrades.slice(i, i + BATCH_SIZE);
          const batchToInsert = batch.map(({ _rowIndex, _originalStudentId, _subjectName, ...rest }) => rest);
          
          const { error: insertError } = await supabase
            .from('grades')
            .insert(batchToInsert);

          if (insertError) {
            // If batch insert fails, try individual inserts
            for (const grade of batch) {
              const { _rowIndex, _originalStudentId, _subjectName, ...gradeData } = grade;
              const { error: singleError } = await supabase
                .from('grades')
                .insert(gradeData);
              
              if (singleError) {
                errors.push({
                  row: _rowIndex,
                  studentId: _originalStudentId,
                  subject: _subjectName,
                  assessmentName: grade.assessment_name,
                  reason: singleError.message || 'Erro ao inserir nota'
                });
              } else {
                insertedCount++;
              }
            }
          } else {
            insertedCount += batch.length;
          }
        }
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

            if (updateError) {
              errors.push({
                row: grade._rowIndex,
                studentId: grade._originalStudentId,
                subject: grade._subjectName,
                assessmentName: grade.assessment_name,
                reason: updateError.message || 'Erro ao atualizar nota'
              });
            } else {
              updatedCount++;
            }
          }
        }
      }

      // Show errors dialog if there are any
      if (errors.length > 0) {
        setGradeImportErrors(errors);
        setShowGradeErrorsDialog(true);
      }

      const totalProcessed = insertedCount + updatedCount;

      toast({
        title: errors.length > 0 ? "Importação parcial" : "Notas processadas com sucesso",
        description: `${insertedCount} novas, ${updatedCount} atualizadas${errors.length > 0 ? `. ${errors.length} erros encontrados.` : ''}`,
        variant: errors.length > 0 ? "destructive" : "default",
      });
      
      setUploadedData([]);
      setDataType(null);
    } catch (error) {
      console.error('Error importing grades:', error);
      if (errors.length > 0) {
        setGradeImportErrors(errors);
        setShowGradeErrorsDialog(true);
      }
      toast({
        title: "Erro ao importar notas",
        description: error instanceof Error ? error.message : "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processCourses = async () => {
    setIsProcessing(true);
    try {
      const coursesToInsert: CourseData[] = uploadedData.map(row => ({
        name: String(row.nome || row.Nome || row.name || row.Name || '').trim(),
        code: String(row.codigo || row.Codigo || row.code || row.Code || '').trim(),
        total_semesters: parseInt(String(row.total_semestre || row.Total_Semestre || row.total_semesters || row.Total_Semesters || row.Semestres || row.semestres || '8').replace(/\D/g, '')) || 8,
        start_date: String(row.Data_Inicio || row.data_inicio || row.DataInicio || row.start_date || row.Start_Date || row.Inicio || row.inicio || new Date().toISOString().split('T')[0]).trim()
      }));

      // Filter out empty records
      const validCourses = coursesToInsert.filter(course => 
        course.name && course.code
      );

      if (validCourses.length === 0) {
        throw new Error('Nenhum curso válido encontrado. Verifique se as colunas Nome e Codigo estão preenchidas.');
      }

      // Check which courses already exist by code
      const courseCodes = validCourses.map(c => c.code);
      const { data: existingCourses } = await supabase
        .from('courses')
        .select('code, id, name')
        .in('code', courseCodes);

      const existingCourseMap = new Map(existingCourses?.map(c => [c.code.toLowerCase(), c]) || []);
      
      const newCourses = validCourses.filter(course => !existingCourseMap.has(course.code.toLowerCase()));
      const coursesToUpdate = validCourses.filter(course => existingCourseMap.has(course.code.toLowerCase()));

      let insertedCount = 0;
      let updatedCount = 0;

      // Insert new courses
      if (newCourses.length > 0) {
        const coursesWithUserId = newCourses.map(course => ({
          name: course.name,
          code: course.code,
          total_semesters: course.total_semesters,
          start_date: course.start_date,
          user_id: user?.id
        }));

        const { error: insertError } = await supabase
          .from('courses')
          .insert(coursesWithUserId);

        if (insertError) throw insertError;
        insertedCount = coursesWithUserId.length;
      }

      // Update existing courses
      if (coursesToUpdate.length > 0) {
        for (const course of coursesToUpdate) {
          const existingCourse = existingCourseMap.get(course.code.toLowerCase());
          
          if (existingCourse) {
            const { error: updateError } = await supabase
              .from('courses')
              .update({
                name: course.name,
                total_semesters: course.total_semesters,
                start_date: course.start_date
              })
              .eq('id', existingCourse.id);

            if (updateError) throw updateError;
            updatedCount++;
          }
        }
      }

      toast({
        title: "Cursos processados com sucesso",
        description: `${insertedCount} novos, ${updatedCount} atualizados`,
      });
      
      setUploadedData([]);
      setDataType(null);
    } catch (error) {
      console.error('Error importing courses:', error);
      toast({
        title: "Erro ao importar cursos",
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
            Faça upload de planilhas com informações de cursos, alunos ou notas
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
                  <p className="text-sm text-muted-foreground mb-4">
                    Formatos aceitos: Excel (.xlsx, .xls) e CSV (.csv)
                  </p>
                  <div className="text-left text-sm text-muted-foreground border-t pt-4 mt-4">
                    <p className="font-medium mb-2">Colunas aceitas:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="font-medium text-primary mb-1">Para Cursos:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-xs">
                          <li><strong>Nome:</strong> Nome, name, nome</li>
                          <li><strong>Código:</strong> Codigo, code, codigo</li>
                          <li><strong>Semestres:</strong> Total_Semestre, Semestres</li>
                          <li><strong>Data Início:</strong> Data_Inicio, start_date</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-primary mb-1">Para Alunos:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-xs">
                          <li><strong>Nome:</strong> Nome, Name, nome</li>
                          <li><strong>Matrícula:</strong> Matricula, Student_ID</li>
                          <li><strong>Email:</strong> Email, email</li>
                          <li><strong>Curso:</strong> Curso, Course, curso</li>
                          <li><strong>Sexo:</strong> Sexo, sexo</li>
                          <li><strong>Renda:</strong> Renda_Media, Renda</li>
                          <li><strong>Raça:</strong> Raca, raca</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-primary mb-1">Para Notas:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-xs">
                          <li><strong>Matrícula:</strong> Matricula, Student_ID</li>
                          <li><strong>Disciplina:</strong> Disciplina, Subject</li>
                          <li><strong>Tipo:</strong> Tipo, Assessment_Type</li>
                          <li><strong>Avaliação:</strong> Avaliacao, Assessment_Name</li>
                          <li><strong>Nota:</strong> Nota, Grade, nota</li>
                          <li><strong>Nota Máxima:</strong> Nota_Maxima, Max_Grade</li>
                          <li><strong>Data:</strong> Data, Date_Assigned</li>
                        </ul>
                      </div>
                    </div>
                  </div>
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
              {dataType === 'courses' ? (
                  <><CheckCircle className="h-5 w-5 text-green-600" /> Dados de Cursos Detectados</>
                ) : dataType === 'students' ? (
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
                      {Object.keys(uploadedData[0])
                        .filter(key => {
                          // Hide date columns from grades preview
                          if (dataType === 'grades') {
                            const lowerKey = key.toLowerCase();
                            return !['data', 'date_assigned', 'date'].includes(lowerKey);
                          }
                          return true;
                        })
                        .map((key) => (
                          <th key={key} className="border border-border p-2 text-left">
                            {key}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedData.slice(0, 5).map((row, index) => {
                      const filteredKeys = Object.keys(row).filter(key => {
                        if (dataType === 'grades') {
                          const lowerKey = key.toLowerCase();
                          return !['data', 'date_assigned', 'date'].includes(lowerKey);
                        }
                        return true;
                      });
                      return (
                        <tr key={index}>
                          {filteredKeys.map((key) => (
                            <td key={key} className="border border-border p-2">
                              {String(row[key])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {uploadedData.length > 5 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Mostrando apenas os primeiros 5 registros de {uploadedData.length}
                  </p>
                )}
              </div>

              <div className="mt-6 flex gap-4 flex-wrap">
                {dataType === 'courses' && (
                  <Button 
                    onClick={() => {
                      setPendingAction('courses');
                      setShowConfirmDialog(true);
                    }} 
                    disabled={isProcessing}
                  >
                    Salvar Cursos
                  </Button>
                )}
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
              <div className="flex gap-4 flex-wrap">
                <Button onClick={() => forceDataType('courses')}>
                  Dados de Cursos
                </Button>
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
                Deseja salvar os {uploadedData.length} {pendingAction === 'courses' ? 'cursos' : pendingAction === 'students' ? 'alunos' : 'notas'} no banco de dados?
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
                  if (pendingAction === 'courses') {
                    await processCourses();
                  } else if (pendingAction === 'students') {
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

        {/* Import Errors Dialog */}
        <Dialog open={showErrorsDialog} onOpenChange={setShowErrorsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Erros na Importação ({importErrors.length})
              </DialogTitle>
              <DialogDescription>
                Os seguintes registros não puderam ser processados:
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Linha</th>
                    <th className="text-left p-2 font-medium">Nome</th>
                    <th className="text-left p-2 font-medium">Matrícula</th>
                    <th className="text-left p-2 font-medium">Motivo do Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {importErrors.map((error, index) => (
                    <tr key={index} className="border-t hover:bg-muted/50">
                      <td className="p-2">{error.row}</td>
                      <td className="p-2">{error.studentName}</td>
                      <td className="p-2">{error.studentId}</td>
                      <td className="p-2 text-destructive">{error.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  // Copy errors to clipboard
                  const text = importErrors.map(e => 
                    `Linha ${e.row}: ${e.studentName} (${e.studentId}) - ${e.reason}`
                  ).join('\n');
                  navigator.clipboard.writeText(text);
                  toast({ title: "Erros copiados para a área de transferência" });
                }}
              >
                Copiar Erros
              </Button>
              <Button onClick={() => setShowErrorsDialog(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Grade Import Errors Dialog */}
        <Dialog open={showGradeErrorsDialog} onOpenChange={setShowGradeErrorsDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Erros na Importação de Notas ({gradeImportErrors.length})
              </DialogTitle>
              <DialogDescription>
                Os seguintes registros de notas não puderam ser processados:
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Linha</th>
                    <th className="text-left p-2 font-medium">Matrícula</th>
                    <th className="text-left p-2 font-medium">Disciplina</th>
                    <th className="text-left p-2 font-medium">Avaliação</th>
                    <th className="text-left p-2 font-medium">Motivo do Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeImportErrors.map((error, index) => (
                    <tr key={index} className="border-t hover:bg-muted/50">
                      <td className="p-2">{error.row}</td>
                      <td className="p-2">{error.studentId}</td>
                      <td className="p-2">{error.subject}</td>
                      <td className="p-2">{error.assessmentName}</td>
                      <td className="p-2 text-destructive">{error.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  const text = gradeImportErrors.map(e => 
                    `Linha ${e.row}: ${e.studentId} | ${e.subject} | ${e.assessmentName} - ${e.reason}`
                  ).join('\n');
                  navigator.clipboard.writeText(text);
                  toast({ title: "Erros copiados para a área de transferência" });
                }}
              >
                Copiar Erros
              </Button>
              <Button onClick={() => setShowGradeErrorsDialog(false)}>
                Fechar
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
              <h4 className="font-semibold mb-2">Para importar cursos:</h4>
              <p className="text-sm text-muted-foreground mb-2">
                A planilha deve conter as seguintes colunas:
              </p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• <strong>nome/Nome</strong>: Nome do curso (obrigatório)</li>
                <li>• <strong>codigo/Codigo</strong>: Código do curso (obrigatório)</li>
                <li>• <strong>total_semestre/Semestres</strong>: Quantidade de semestres (opcional, padrão: 8)</li>
                <li>• <strong>Data_Inicio/start_date</strong>: Data de início do curso (opcional, padrão: data atual)</li>
              </ul>
            </div>

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
                <li>• <strong>renda/Renda/renda_media/Renda Média</strong>: Renda per capita do aluno (opcional)</li>
                <li>• <strong>raca/Raça/etnia/Etnia</strong>: Raça/etnia do aluno (opcional)</li>
              </ul>
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