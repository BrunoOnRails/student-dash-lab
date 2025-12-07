-- Rename columns from Portuguese to English
ALTER TABLE public.students RENAME COLUMN sexo TO gender;
ALTER TABLE public.students RENAME COLUMN renda_media TO average_income;
ALTER TABLE public.students RENAME COLUMN raca TO ethnicity;