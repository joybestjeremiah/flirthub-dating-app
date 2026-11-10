-- Wrap auth helpers in scalar subqueries so Postgres can evaluate them once per statement.
do $$
declare
  p record;
  new_qual text;
  new_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~ 'auth\.(uid|role|jwt)\(\)'
        or coalesce(with_check, '') ~ 'auth\.(uid|role|jwt)\(\)'
      )
  loop
    new_qual := p.qual;
    new_check := p.with_check;
    if new_qual is not null then
      new_qual := regexp_replace(new_qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      new_qual := regexp_replace(new_qual, 'auth\.role\(\)', '(select auth.role())', 'g');
      new_qual := regexp_replace(new_qual, 'auth\.jwt\(\)', '(select auth.jwt())', 'g');
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, new_qual);
    end if;
    if new_check is not null then
      new_check := regexp_replace(new_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      new_check := regexp_replace(new_check, 'auth\.role\(\)', '(select auth.role())', 'g');
      new_check := regexp_replace(new_check, 'auth\.jwt\(\)', '(select auth.jwt())', 'g');
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, new_check);
    end if;
  end loop;
end $$;
