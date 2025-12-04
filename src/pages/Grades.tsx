import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
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

const Grades = () => {
  const queryClient = useQueryClient();
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

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
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Lançar Nota
          </Button>
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
      </main>
    </div>
  );
};

export default Grades;
