-- Add subject_id column to grades table
ALTER TABLE public.grades
ADD COLUMN subject_id uuid REFERENCES public.subjects(id);

-- Add index for better query performance
CREATE INDEX idx_grades_subject_id ON public.grades(subject_id);

-- Update RLS policy to ensure professors can only manage grades for their subjects
DROP POLICY IF EXISTS "Professors can manage grades for their students" ON public.grades;

CREATE POLICY "Professors can manage grades for their subjects"
ON public.grades
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.subjects
    WHERE subjects.id = grades.subject_id
    AND subjects.professor_id = auth.uid()
  )
);