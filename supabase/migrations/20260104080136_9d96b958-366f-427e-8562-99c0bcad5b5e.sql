-- Drop the current overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create new policy: users see own profile, admins see all
CREATE POLICY "Users can view own profile or admin sees all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR public.has_role(auth.uid(), 'admin')
);