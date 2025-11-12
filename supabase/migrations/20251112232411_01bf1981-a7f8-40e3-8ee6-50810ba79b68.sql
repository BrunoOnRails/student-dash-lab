-- Remove a constraint antiga que limita nota entre 0 e 10
ALTER TABLE public.grades 
DROP CONSTRAINT IF EXISTS grades_grade_check;

-- Adiciona nova constraint que valida nota entre 0 e max_grade
ALTER TABLE public.grades 
ADD CONSTRAINT grades_grade_check 
CHECK (grade >= 0 AND grade <= max_grade);

-- Adiciona constraint para max_grade
ALTER TABLE public.grades 
ADD CONSTRAINT grades_max_grade_check 
CHECK (max_grade > 0);