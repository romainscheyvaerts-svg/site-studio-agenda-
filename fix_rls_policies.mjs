const API_KEY = "sbp_3e9c5a04c8a35aba19390e3619a4a18baddc2230";
const PROJECT_ID = "bbdylrwiwnwjpeblxriq";

async function runSQL(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const data = await res.json();
  return data;
}

async function main() {
  console.log("=== Fixing RLS policies ===\n");

  // Step 1: Drop old functions first
  console.log("1. Dropping old functions...");
  let result = await runSQL(`
    DROP FUNCTION IF EXISTS public.is_studio_member(uuid, uuid);
    DROP FUNCTION IF EXISTS public.is_studio_owner(uuid, uuid);
    DROP FUNCTION IF EXISTS public.get_user_studio_ids(uuid);
  `);
  console.log("  Result:", JSON.stringify(result).substring(0, 300));

  // Step 2: Create SECURITY DEFINER helper functions
  console.log("\n2. Creating helper functions...");
  result = await runSQL(`
    CREATE FUNCTION public.is_studio_member(p_user_id uuid, p_studio_id uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.studio_members 
        WHERE user_id = p_user_id AND studio_id = p_studio_id
      );
    $$;
  `);
  console.log("  is_studio_member:", JSON.stringify(result).substring(0, 200));

  result = await runSQL(`
    CREATE FUNCTION public.is_studio_owner(p_user_id uuid, p_studio_id uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.studio_members 
        WHERE user_id = p_user_id AND studio_id = p_studio_id AND role = 'owner'
      );
    $$;
  `);
  console.log("  is_studio_owner:", JSON.stringify(result).substring(0, 200));

  result = await runSQL(`
    CREATE FUNCTION public.get_user_studio_ids(p_user_id uuid)
    RETURNS SETOF uuid
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT studio_id FROM public.studio_members WHERE user_id = p_user_id;
    $$;
  `);
  console.log("  get_user_studio_ids:", JSON.stringify(result).substring(0, 200));

  // Step 3: Drop old problematic policies
  console.log("\n3. Dropping old policies...");
  result = await runSQL(`
    DROP POLICY IF EXISTS "Studio admins can view members" ON public.studio_members;
    DROP POLICY IF EXISTS "Studio owner can manage members" ON public.studio_members;
    DROP POLICY IF EXISTS "Members can view their studio" ON public.studios;
    DROP POLICY IF EXISTS "Public can view active studios" ON public.studios;
    DROP POLICY IF EXISTS "Authenticated users can create studios" ON public.studios;
    DROP POLICY IF EXISTS "Users can view own memberships" ON public.studio_members;
    DROP POLICY IF EXISTS "Members can view studio colleagues" ON public.studio_members;
    DROP POLICY IF EXISTS "Studio owners can manage members" ON public.studio_members;
    DROP POLICY IF EXISTS "Users can add themselves to new studio" ON public.studio_members;
  `);
  console.log("  Result:", JSON.stringify(result).substring(0, 200));

  // Step 4: Create fixed studio_members policies
  console.log("\n4. Creating studio_members policies...");
  
  result = await runSQL(`
    CREATE POLICY "Users can view own memberships"
    ON public.studio_members FOR SELECT
    USING (user_id = auth.uid());
  `);
  console.log("  own memberships:", JSON.stringify(result).substring(0, 200));

  result = await runSQL(`
    CREATE POLICY "Members can view studio colleagues"
    ON public.studio_members FOR SELECT
    USING (studio_id IN (SELECT public.get_user_studio_ids(auth.uid())));
  `);
  console.log("  colleagues:", JSON.stringify(result).substring(0, 200));

  result = await runSQL(`
    CREATE POLICY "Studio owners can manage members"
    ON public.studio_members FOR ALL
    USING (public.is_studio_owner(auth.uid(), studio_id))
    WITH CHECK (public.is_studio_owner(auth.uid(), studio_id));
  `);
  console.log("  owners manage:", JSON.stringify(result).substring(0, 200));

  result = await runSQL(`
    CREATE POLICY "Users can add themselves to new studio"
    ON public.studio_members FOR INSERT
    WITH CHECK (user_id = auth.uid());
  `);
  console.log("  self-add:", JSON.stringify(result).substring(0, 200));

  // Step 5: Create fixed studios policies
  console.log("\n5. Creating studios policies...");

  result = await runSQL(`
    CREATE POLICY "Members can view their studio"
    ON public.studios FOR SELECT
    USING (id IN (SELECT public.get_user_studio_ids(auth.uid())));
  `);
  console.log("  members view:", JSON.stringify(result).substring(0, 200));

  result = await runSQL(`
    CREATE POLICY "Public can view active studios"
    ON public.studios FOR SELECT
    USING (
      (is_active = true AND subscription_status IN ('active', 'trialing'))
      OR id IN (SELECT public.get_user_studio_ids(auth.uid()))
    );
  `);
  console.log("  public view:", JSON.stringify(result).substring(0, 200));

  result = await runSQL(`
    CREATE POLICY "Authenticated users can create studios"
    ON public.studios FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
  `);
  console.log("  create studios:", JSON.stringify(result).substring(0, 200));

  console.log("\n=== Done! ===");
}

main().catch(console.error);
