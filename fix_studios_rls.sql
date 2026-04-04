-- Fix studios INSERT policy for registration
DROP POLICY IF EXISTS "Authenticated users can create studios" ON public.studios;
CREATE POLICY "Authenticated users can create studios" ON public.studios FOR INSERT TO authenticated WITH CHECK (true);

-- Simplify studios SELECT - allow all authenticated users to see studios
-- (the front-end and useStudio already filter by status)
DROP POLICY IF EXISTS "Creator can see their new studio" ON public.studios;
DROP POLICY IF EXISTS "Members can view their studio" ON public.studios;
DROP POLICY IF EXISTS "Public can view active studios" ON public.studios;
CREATE POLICY "Anyone can view studios" ON public.studios FOR SELECT USING (true);

-- Also fix studios UPDATE - owners can update via helper function
DROP POLICY IF EXISTS "Owner can update studio" ON public.studios;
CREATE POLICY "Owner can update studio" ON public.studios FOR UPDATE USING (public.is_studio_owner(auth.uid(), id)) WITH CHECK (public.is_studio_owner(auth.uid(), id));
