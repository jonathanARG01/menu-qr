-- 0040 · Mesa "por limpiar" en el salón
--
-- Después de cobrar, la mesa queda "por limpiar" en el plano hasta que alguien del equipo la marca lista
-- (indicador que se activa desde Salón → Indicadores). Se guarda en la cuenta ya cerrada: cuándo se limpió.
-- Las cuentas cerradas antes de esta migración no aparecen (solo se miran las cerradas en las últimas 4 horas).
--
-- Se puede ejecutar más de una vez sin problema.

alter table public.cuentas add column if not exists limpia_at timestamptz;

-- Las cuentas cerradas hasta hoy se dan por limpias, así no aparece todo el salón "por limpiar" al activarlo.
update public.cuentas set limpia_at = coalesce(cerrada_at, now())
where estado <> 'abierta' and limpia_at is null;

-- Para buscar rápido las mesas cobradas que faltan por limpiar.
create index if not exists cuentas_por_limpiar_idx on public.cuentas (restaurante_id, cerrada_at)
  where estado = 'cerrada' and limpia_at is null and mesa_id is not null;
