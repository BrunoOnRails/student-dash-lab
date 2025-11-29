-- Add user_id column to courses table
ALTER TABLE public.courses ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Set user_id for existing courses (optional: set to first user or leave null)
-- This will allow existing courses to be visible to all users initially
-- You can manually assign them later

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Anyone can view courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can manage courses" ON public.courses;

-- Create new RLS policies for user-specific access
CREATE POLICY "Users can view their own courses"
ON public.courses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own courses"
ON public.courses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own courses"
ON public.courses
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own courses"
ON public.courses
FOR DELETE
USING (auth.uid() = user_id);