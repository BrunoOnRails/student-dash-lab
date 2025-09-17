-- Add unique constraint to prevent duplicate students in the same subject
ALTER TABLE public.students ADD CONSTRAINT unique_student_per_subject UNIQUE (student_id, subject_id);

-- Add unique constraint to prevent duplicate grades for the same assessment
ALTER TABLE public.grades ADD CONSTRAINT unique_grade_per_assessment UNIQUE (student_id, assessment_name, assessment_type, date_assigned);