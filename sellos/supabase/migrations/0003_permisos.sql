-- ═════════════════════════════════════════════
-- 0003: Ordena los permisos de las funciones (lo pide el revisor de seguridad de Supabase).
--
-- Postgres deja que CUALQUIERA ejecute una función nueva. Las funciones ya se protegían por dentro
-- (piden sesión, ser del equipo o superadmin), pero así queda cerrado también por fuera:
-- · Sin sesión (anon) solo se pueden usar las funciones públicas: unirse, ver la tarjeta, sumar con QR, la API, etc.
-- · Las funciones internas y de triggers no se pueden llamar desde la web.
-- Se puede volver a ejecutar sin romper nada.
-- ═════════════════════════════════════════════

-- 1. Nadie ejecuta nada por defecto (ni las funciones que se creen después).
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- 2. Funciones de triggers e internas: tampoco con sesión.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.prorettype = 'trigger'::regtype or p.proname in ('premio_disponible', 'clave_telefono'))
  loop
    execute format('revoke execute on function %s from authenticated', f);
  end loop;
end $$;

-- 3. Lo que sí puede usar alguien sin sesión (el cliente con su tarjeta y la API con su clave).
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('vigente', 'dia_doble', 'negocio_publico', 'unirse', 'ver_tarjeta', 'sumar_qr', 'suscribir_tarjeta',
                        'ver_invitacion', 'quien_invita', 'promocion_hoy', 'plan_incluye',
                        'api_sellar', 'api_tarjeta', 'api_clientes', 'api_resumen')
  loop
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
