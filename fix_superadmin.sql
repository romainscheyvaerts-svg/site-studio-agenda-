DROP POLICY IF EXISTS "Super admin can manage all studios" ON public.studios;

CREATE POLICY "Super admin can manage all studios" ON public.studios FOR ALL USING (
  auth.jwt() ->> 'email' = 'romain.scheyvaerts@gmail.com'
) WITH CHECK (
  auth.jwt() ->> 'email' = 'romain.scheyvaerts@gmail.com'
);
