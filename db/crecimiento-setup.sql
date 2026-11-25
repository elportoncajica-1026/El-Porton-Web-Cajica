-- ==============================================================
--  EL PORTÓN CAJICÁ — Origen de cada pedido (panel "Crecimiento")
--
--  Cómo usar: Supabase → SQL Editor → New query → pegar todo → Run.
--  Se puede correr más de una vez sin dañar nada.
--
--  Agrega UNA columna. No borra ni cambia datos ni permisos:
--  los pedidos anteriores quedan con `origen` vacío ("Sin dato").
--  La escribe solo el servidor (POST /api/pedidos).
--
--  Guarda: por dónde llegó la persona (red, campaña, anuncio), la
--  respuesta a "¿cómo nos conociste?", si aceptó promociones y qué
--  versión del texto de autorización aceptó.
-- ==============================================================

alter table public.orders add column if not exists origen jsonb;

comment on column public.orders.origen is
  'Atribución del pedido: {primero, ultimo, conocio, promos, autorizacion}. Ver src/lib/rastreo.ts';
