-- Add indexes for single-column public foreign keys that lack a usable leading-column index.
do $$
declare
  fk record;
  idx_name text;
begin
  for fk in
    select c.conrelid as relid, c.conkey[1] as attnum,
           a.attname, n.nspname, t.relname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and n.nspname = 'public'
      and cardinality(c.conkey) = 1
  loop
    if not exists (
      select 1 from pg_index i
      where i.indrelid = fk.relid
        and i.indisvalid
        and i.indisready
        and i.indpred is null
        and i.indkey[0] = fk.attnum
        and i.indnkeyatts >= 1
    ) then
      idx_name := left(fk.relname || '_' || fk.attname || '_fk_idx', 63);
      execute format('create index if not exists %I on %I.%I (%I)',
                     idx_name, fk.nspname, fk.relname, fk.attname);
    end if;
  end loop;
end $$;
