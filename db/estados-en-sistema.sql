-- ==============================================================
--  EL PORTÓN CAJICÁ — Pasar los pedidos viejos al estado "En sistema"
--
--  2026-11: los estados del panel quedaron en
--      Nuevo · En sistema · Entregado · Cancelado
--  Los pedidos guardados como "preparando" o "en_camino" (estados que
--  ya no existen) pasan a "en_sistema": si estaban así, es que ya los
--  habían cargado al POS.
--
--  Cómo correrlo: Supabase → SQL Editor → pegar esto → Run.
--  Es seguro repetirlo: la segunda vez no cambia nada.
--  (El panel ya los muestra como "En sistema" aunque no se corra.)
-- ==============================================================

update public.orders
   set status = 'en_sistema'
 where status in ('preparando', 'en_camino');

-- Para ver cómo quedaron:
-- select status, count(*) from public.orders group by status order by 2 desc;
