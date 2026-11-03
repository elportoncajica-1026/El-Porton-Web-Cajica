-- ==============================================================
--  EL PORTÓN CAJICÁ — Tabla de ajustes (tiempos de entrega)
--
--  Guarda ajustes que el panel puede cambiar sin tocar el código.
--  Por ahora: cuánto tarda cada tipo de pedido, que se muestra en el
--  carrito (domicilio, recoger en el local, comer en el restaurante).
--
--  Cómo correrlo: Supabase → SQL Editor → pegar todo esto → Run.
--  Es seguro repetirlo. Mientras no se corra, la página usa los
--  tiempos por defecto (domicilio 40–50 min, los demás 15–20 min).
--
--  Requiere la función public.is_admin (db/fix-admins-recursion.sql),
--  la misma que ya protege pedidos y menú.
-- ==============================================================

create table if not exists public.ajustes (
  clave       text primary key,
  valor       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.ajustes enable row level security;

-- La página pública necesita LEER los tiempos (para el carrito).
drop policy if exists "todos leen ajustes" on public.ajustes;
create policy "todos leen ajustes"
  on public.ajustes for select to anon, authenticated
  using ( true );

-- Solo los administradores del panel los cambian.
drop policy if exists "admin crea ajustes" on public.ajustes;
create policy "admin crea ajustes"
  on public.ajustes for insert to authenticated
  with check ( public.is_admin(auth.jwt() ->> 'email') );

drop policy if exists "admin actualiza ajustes" on public.ajustes;
create policy "admin actualiza ajustes"
  on public.ajustes for update to authenticated
  using      ( public.is_admin(auth.jwt() ->> 'email') )
  with check ( public.is_admin(auth.jwt() ->> 'email') );

-- Valores iniciales (no pisa lo que ya se haya guardado desde el panel).
insert into public.ajustes (clave, valor) values
  ('tiempos', '{"domicilio":{"min":40,"max":50},"recoger":{"min":15,"max":20},"restaurante":{"min":15,"max":20}}')
on conflict (clave) do nothing;
