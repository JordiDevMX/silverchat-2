select json_build_object(
 'ledger', (select coalesce(json_agg(x),'[]') from (
    select version, name, statements from supabase_migrations.schema_migrations order by version) x)
)::text as payload;
