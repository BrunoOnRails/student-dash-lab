-- Remove the restrictive RLS policy on students table
DROP POLICY IF EXISTS "Professors can manage students in their courses" ON students;

-- Create a more permissive policy allowing all authenticated users to manage students
CREATE POLICY "Authenticated users can manage students"
ON students
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);