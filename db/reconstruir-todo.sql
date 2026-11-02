-- ============================================================
-- EL PORTON CAJICA — reconstruccion COMPLETA de la base de datos
-- Une los 7 scripts de db/ EN ORDEN (ver README.md).
-- ANTES DE CORRER: reemplaza  __CORREO_ADMIN__  por el correo del admin.
-- NO incluye revocar-insert-anon.sql (eso va al final, tras probar un pedido).
-- ============================================================

-- ########## supabase-setup.sql ##########
-- ==============================================================
--  EL PORTÓN CAJICÁ — Setup de la base de datos del panel admin
--  Cómo usar:
--   1) Supabase → SQL Editor → New query
--   2) Reemplaza  __CORREO_ADMIN__  por el correo REAL del admin
--      (el mismo con el que crearás el usuario en Authentication)
--   3) Pega TODO esto y dale "Run".
--
--  Seguridad (RLS): el público (anon) SOLO puede INSERTAR pedidos y
--  eventos, NUNCA leerlos. Únicamente el correo admin autenticado
--  puede leer. Aunque la anon key es pública, nadie puede ver los
--  datos de tus clientes sin iniciar sesión como admin.
-- ==============================================================

-- ---------- Tabla de PEDIDOS ----------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  customer_name    text not null,
  customer_phone   text not null,
  customer_address text not null,
  payment_method   text,
  cash_change      text,
  subtotal         integer not null default 0,
  items            jsonb not null default '[]',
  status           text not null default 'nuevo'   -- nuevo | en_sistema | entregado | cancelado
);

-- ---------- Tabla de EVENTOS (embudo/analítica) ----------
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  type        text not null,   -- add_to_cart | checkout_opened | order_sent | whatsapp_click
  meta        jsonb
);

-- ---------- Activar Row Level Security ----------
alter table public.orders enable row level security;
alter table public.events enable row level security;

-- ---------- Políticas: el público solo INSERTA ----------
create policy "public inserta pedidos"
  on public.orders for insert to anon with check (true);

create policy "public inserta eventos"
  on public.events for insert to anon with check (true);

-- ---------- Políticas: solo el ADMIN lee ----------
-- 👇 Reemplaza __CORREO_ADMIN__ por tu correo admin real
create policy "admin lee pedidos"
  on public.orders for select to authenticated
  using ( (auth.jwt() ->> 'email') = '__CORREO_ADMIN__' );

create policy "admin lee eventos"
  on public.events for select to authenticated
  using ( (auth.jwt() ->> 'email') = '__CORREO_ADMIN__' );

-- ---------- Política: el admin puede cambiar el estado del pedido ----------
create policy "admin actualiza pedidos"
  on public.orders for update to authenticated
  using      ( (auth.jwt() ->> 'email') = '__CORREO_ADMIN__' )
  with check ( (auth.jwt() ->> 'email') = '__CORREO_ADMIN__' );

-- ---------- Índices útiles ----------
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists events_type_idx on public.events (type, created_at desc);

-- ########## menu-setup.sql ##########
-- ==============================================================
--  EL PORTÓN CAJICÁ — Setup del EDITOR DE MENÚ (v2)
--  Cómo usar:
--   1) Supabase → SQL Editor → New query
--   2) Reemplaza  __CORREO_ADMIN__  por tu MISMO correo admin
--      (el mismo con el que entras al panel)
--   3) Pega todo y dale "Run".
--
--  Esto crea la tabla del menú y sus reglas de seguridad. Los 43
--  productos NO van aquí: los cargarás con un clic desde el panel
--  ("Importar menú actual"), usando tu sesión de admin.
--
--  Seguridad: TODOS pueden LEER el menú (la web lo necesita para
--  mostrarlo). SOLO tu correo admin puede editar / agregar / borrar.
-- ==============================================================

create table if not exists public.menu_items (
  id          text primary key,        -- ej. "h-sencilla"
  cat         text not null,           -- categoría (hamburguesas, perros, ...)
  sort_order  int  not null default 0, -- orden de aparición
  available   boolean not null default true,  -- disponible / agotado
  data        jsonb not null,          -- el producto completo (nombre, desc, precios, foto...)
  updated_at  timestamptz not null default now()
);

alter table public.menu_items enable row level security;

-- Todos (incluido el público) pueden LEER el menú
create policy "todos leen menu"
  on public.menu_items for select using (true);

-- 👇 Reemplaza __CORREO_ADMIN__ por tu correo admin real (en las 3)
create policy "admin inserta menu"
  on public.menu_items for insert to authenticated
  with check ( (auth.jwt() ->> 'email') = '__CORREO_ADMIN__' );

create policy "admin actualiza menu"
  on public.menu_items for update to authenticated
  using      ( (auth.jwt() ->> 'email') = '__CORREO_ADMIN__' )
  with check ( (auth.jwt() ->> 'email') = '__CORREO_ADMIN__' );

create policy "admin borra menu"
  on public.menu_items for delete to authenticated
  using ( (auth.jwt() ->> 'email') = '__CORREO_ADMIN__' );

create index if not exists menu_items_cat_idx on public.menu_items (cat, sort_order);

-- ########## storage-setup.sql ##########
-- ==============================================================
--  EL PORTÓN CAJICÁ — Setup del BUCKET DE FOTOS del menú
--  Cómo usar:
--   1) Supabase → SQL Editor → New query
--   2) Reemplaza  __CORREO_ADMIN__  por tu MISMO correo admin
--      (el mismo correo que usaste en menu-setup.sql / supabase-setup.sql)
--   3) Pega todo y dale "Run".
--
--  Esto crea un espacio de almacenamiento ("bucket") llamado
--  "menu-photos" donde el panel admin sube las fotos de los
--  productos. Sin esto, el botón "Cambiar foto" del editor de
--  menú va a fallar con un error claro (no rompe nada más).
--
--  Seguridad: TODOS pueden VER las fotos (la web pública las
--  necesita para mostrar el catálogo). SOLO tu correo admin
--  puede subir / reemplazar / borrar fotos.
-- ==============================================================

insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;

-- Todos (incluido el público) pueden VER las fotos
create policy "todos ven fotos del menu"
  on storage.objects for select
  using (bucket_id = 'menu-photos');

-- 👇 Reemplaza __CORREO_ADMIN__ por tu correo admin real (en las 3)
create policy "admin sube fotos del menu"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-photos' and (auth.jwt() ->> 'email') = '__CORREO_ADMIN__');

create policy "admin reemplaza fotos del menu"
  on storage.objects for update to authenticated
  using      (bucket_id = 'menu-photos' and (auth.jwt() ->> 'email') = '__CORREO_ADMIN__')
  with check (bucket_id = 'menu-photos' and (auth.jwt() ->> 'email') = '__CORREO_ADMIN__');

create policy "admin borra fotos del menu"
  on storage.objects for delete to authenticated
  using (bucket_id = 'menu-photos' and (auth.jwt() ->> 'email') = '__CORREO_ADMIN__');

-- ########## multi-admin-setup.sql ##########
-- ==============================================================
--  EL PORTÓN CAJICÁ — Habilitar VARIOS administradores
--  Cómo usar:
--   1) Supabase → SQL Editor → New query
--   2) Reemplaza  __CORREO_ADMIN__  por TU correo admin
--      actual (el que ya usas para entrar al panel)
--   3) Pega todo y dale "Run"
--
--  Qué hace: crea una tabla "admins" (lista de correos permitidos) y
--  cambia TODAS las políticas de seguridad que antes solo aceptaban
--  UN correo fijo, para que ahora acepten a cualquiera que esté en
--  esa lista. Después de correr esto, agregar un jefe nuevo es un
--  solo INSERT (ver el final de este archivo) — no hay que tocar
--  ninguna política de seguridad nunca más.
--
--  IMPORTANTE: esto NO crea las cuentas de tus jefes. Eso se hace
--  aparte, invitándolos desde Supabase → Authentication → Users →
--  "Invite user" (les llega un correo y ellos ponen su propia clave).
-- ==============================================================

-- ---------- Tabla de administradores permitidos ----------
create table if not exists public.admins (
  email      text primary key,
  added_at   timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Cualquier admin ya en la lista puede ver/gestionar la lista
drop policy if exists "admins ven la lista" on public.admins;
create policy "admins ven la lista"
  on public.admins for select to authenticated
  using ( (auth.jwt() ->> 'email') in (select email from public.admins) );

drop policy if exists "admins agregan administradores" on public.admins;
create policy "admins agregan administradores"
  on public.admins for insert to authenticated
  with check ( (auth.jwt() ->> 'email') in (select email from public.admins) );

drop policy if exists "admins borran administradores" on public.admins;
create policy "admins borran administradores"
  on public.admins for delete to authenticated
  using ( (auth.jwt() ->> 'email') in (select email from public.admins) );

-- 👇 Siembra con TU correo actual (así no te quedas afuera)
insert into public.admins (email) values ('__CORREO_ADMIN__')
on conflict (email) do nothing;

-- ---------- Migrar políticas de PEDIDOS y EVENTOS ----------
drop policy if exists "admin lee pedidos" on public.orders;
create policy "admin lee pedidos"
  on public.orders for select to authenticated
  using ( (auth.jwt() ->> 'email') in (select email from public.admins) );

drop policy if exists "admin actualiza pedidos" on public.orders;
create policy "admin actualiza pedidos"
  on public.orders for update to authenticated
  using      ( (auth.jwt() ->> 'email') in (select email from public.admins) )
  with check ( (auth.jwt() ->> 'email') in (select email from public.admins) );

drop policy if exists "admin lee eventos" on public.events;
create policy "admin lee eventos"
  on public.events for select to authenticated
  using ( (auth.jwt() ->> 'email') in (select email from public.admins) );

-- ---------- Migrar políticas del MENÚ ----------
drop policy if exists "admin inserta menu" on public.menu_items;
create policy "admin inserta menu"
  on public.menu_items for insert to authenticated
  with check ( (auth.jwt() ->> 'email') in (select email from public.admins) );

drop policy if exists "admin actualiza menu" on public.menu_items;
create policy "admin actualiza menu"
  on public.menu_items for update to authenticated
  using      ( (auth.jwt() ->> 'email') in (select email from public.admins) )
  with check ( (auth.jwt() ->> 'email') in (select email from public.admins) );

drop policy if exists "admin borra menu" on public.menu_items;
create policy "admin borra menu"
  on public.menu_items for delete to authenticated
  using ( (auth.jwt() ->> 'email') in (select email from public.admins) );

-- ---------- Migrar políticas de FOTOS del menú (Storage) ----------
drop policy if exists "admin sube fotos del menu" on storage.objects;
create policy "admin sube fotos del menu"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'menu-photos' and (auth.jwt() ->> 'email') in (select email from public.admins) );

drop policy if exists "admin reemplaza fotos del menu" on storage.objects;
create policy "admin reemplaza fotos del menu"
  on storage.objects for update to authenticated
  using      ( bucket_id = 'menu-photos' and (auth.jwt() ->> 'email') in (select email from public.admins) )
  with check ( bucket_id = 'menu-photos' and (auth.jwt() ->> 'email') in (select email from public.admins) );

drop policy if exists "admin borra fotos del menu" on storage.objects;
create policy "admin borra fotos del menu"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'menu-photos' and (auth.jwt() ->> 'email') in (select email from public.admins) );

-- ==============================================================
--  PARA AGREGAR UN JEFE DESPUÉS DE INVITARLO (repite esto por cada uno):
--
--  insert into public.admins (email) values ('correo-del-jefe@ejemplo.com');
--
--  Para QUITAR a alguien:
--  delete from public.admins where email = 'correo-a-quitar@ejemplo.com';
-- ==============================================================

-- ########## fix-admins-recursion.sql ##########
-- ==============================================================
--  EL PORTÓN CAJICÁ — Arreglo: "infinite recursion detected in
--  policy for relation admins"
--
--  Cómo usar:
--   1) Supabase → SQL Editor → New query
--   2) Pega todo esto tal cual (NO hay que reemplazar ningún correo,
--      ya quedaron guardados en la tabla admins la vez anterior)
--   3) Dale "Run"
--
--  Qué pasó: las políticas de "admins" se preguntaban a sí mismas
--  "¿este correo está en la tabla admins?" consultando la MISMA
--  tabla admins — y para responder esa pregunta, Postgres vuelve a
--  aplicar la misma política, que vuelve a preguntar lo mismo, sin
--  parar nunca (recursión infinita).
--
--  Arreglo: una función que consulta la tabla "por fuera" de las
--  reglas de seguridad (evita el ciclo). Todas las políticas que
--  antes preguntaban directamente a la tabla ahora usan esta función.
-- ==============================================================

create or replace function public.is_admin(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where email = p_email);
$$;

revoke all on function public.is_admin(text) from public;
grant execute on function public.is_admin(text) to authenticated;

-- ---------- Tabla ADMINS ----------
drop policy if exists "admins ven la lista" on public.admins;
create policy "admins ven la lista"
  on public.admins for select to authenticated
  using ( public.is_admin(auth.jwt() ->> 'email') );

drop policy if exists "admins agregan administradores" on public.admins;
create policy "admins agregan administradores"
  on public.admins for insert to authenticated
  with check ( public.is_admin(auth.jwt() ->> 'email') );

drop policy if exists "admins borran administradores" on public.admins;
create policy "admins borran administradores"
  on public.admins for delete to authenticated
  using ( public.is_admin(auth.jwt() ->> 'email') );

-- ---------- PEDIDOS y EVENTOS ----------
drop policy if exists "admin lee pedidos" on public.orders;
create policy "admin lee pedidos"
  on public.orders for select to authenticated
  using ( public.is_admin(auth.jwt() ->> 'email') );

drop policy if exists "admin actualiza pedidos" on public.orders;
create policy "admin actualiza pedidos"
  on public.orders for update to authenticated
  using      ( public.is_admin(auth.jwt() ->> 'email') )
  with check ( public.is_admin(auth.jwt() ->> 'email') );

drop policy if exists "admin lee eventos" on public.events;
create policy "admin lee eventos"
  on public.events for select to authenticated
  using ( public.is_admin(auth.jwt() ->> 'email') );

-- ---------- MENÚ ----------
drop policy if exists "admin inserta menu" on public.menu_items;
create policy "admin inserta menu"
  on public.menu_items for insert to authenticated
  with check ( public.is_admin(auth.jwt() ->> 'email') );

drop policy if exists "admin actualiza menu" on public.menu_items;
create policy "admin actualiza menu"
  on public.menu_items for update to authenticated
  using      ( public.is_admin(auth.jwt() ->> 'email') )
  with check ( public.is_admin(auth.jwt() ->> 'email') );

drop policy if exists "admin borra menu" on public.menu_items;
create policy "admin borra menu"
  on public.menu_items for delete to authenticated
  using ( public.is_admin(auth.jwt() ->> 'email') );

-- ---------- FOTOS del menú (Storage) ----------
drop policy if exists "admin sube fotos del menu" on storage.objects;
create policy "admin sube fotos del menu"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'menu-photos' and public.is_admin(auth.jwt() ->> 'email') );

drop policy if exists "admin reemplaza fotos del menu" on storage.objects;
create policy "admin reemplaza fotos del menu"
  on storage.objects for update to authenticated
  using      ( bucket_id = 'menu-photos' and public.is_admin(auth.jwt() ->> 'email') )
  with check ( bucket_id = 'menu-photos' and public.is_admin(auth.jwt() ->> 'email') );

drop policy if exists "admin borra fotos del menu" on storage.objects;
create policy "admin borra fotos del menu"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'menu-photos' and public.is_admin(auth.jwt() ->> 'email') );

-- ########## visitas-setup.sql ##########
-- ==============================================================
--  EL PORTÓN CAJICÁ — Registro de visitas a la página
--
--  Cómo usar:
--   1) Supabase → SQL Editor → New query
--   2) Pega TODO esto y dale "Run". (No hay nada que reemplazar:
--      usa la tabla `admins` que ya existe, vía public.is_admin.)
--
--  REQUISITO: haber corrido antes `multi-admin-setup.sql` y
--  `fix-admins-recursion.sql` (de ahí sale public.is_admin).
--
--  Qué mide y qué NO:
--   · PERSONAS  = navegadores distintos (uuid en localStorage).
--                 No es "seres humanos": el mismo señor en celular y
--                 computador cuenta 2, y si borra datos vuelve a contar.
--   · VISITAS   = sesiones. Se corta a los 30 min de inactividad.
--   · VISTAS    = cargas de página (si recarga 5 veces, son 5).
--
--  Privacidad (Ley 1581): NO se guarda IP, ni nombre, ni correo, ni
--  huella del dispositivo. Solo un identificador aleatorio que el
--  propio visitante puede borrar limpiando el navegador. Aun así,
--  conviene mencionarlo en la Política de Tratamiento de Datos.
-- ==============================================================

-- ---------- Tabla de VISITAS ----------
create table if not exists public.visits (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor_id  uuid not null,      -- persiste en el navegador  → "personas"
  session_id  uuid not null,      -- caduca a los 30 min       → "visitas"
  path        text,               -- ruta visitada (/, /index.html…)
  referrer    text                -- SOLO el dominio de origen (instagram.com…)
);

alter table public.visits enable row level security;

-- El público solo INSERTA; jamás puede leer (igual que orders/events).
drop policy if exists "public inserta visitas" on public.visits;
create policy "public inserta visitas"
  on public.visits for insert to anon with check (true);

drop policy if exists "admin lee visitas" on public.visits;
create policy "admin lee visitas"
  on public.visits for select to authenticated
  using ( public.is_admin(auth.jwt() ->> 'email') );

-- Índices: las 3 consultas del panel filtran por fecha y agrupan por visitante.
create index if not exists visits_created_at_idx on public.visits (created_at desc);
create index if not exists visits_visitor_idx    on public.visits (visitor_id);

-- ==============================================================
--  FUNCIONES DE AGREGACIÓN
--
--  Por qué en la base de datos y no en el navegador:
--   1) PostgREST devuelve máximo 1000 filas por consulta. Con visitas
--      reales eso se pasa en días y los números saldrían MAL (topados),
--      sin ningún error visible.
--   2) Las personas únicas NO se pueden sumar por día: alguien que
--      entra lunes y martes es 1 persona en la semana, no 2. El conteo
--      distinto tiene que hacerse sobre el periodo completo.
--
--  Son `security definer` (se saltan RLS), así que cada una verifica
--  is_admin de entrada y se le revoca el permiso a anon.
--  Las fechas se cortan en hora de Bogotá, no en UTC: si no, "hoy"
--  arrancaría a las 7 p.m. del día anterior.
-- ==============================================================

-- ---------- Resumen: hoy / últimos 7 días / últimos 30 días ----------
create or replace function public.visitas_resumen()
returns table (periodo text, personas bigint, visitas bigint, vistas bigint)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not public.is_admin(auth.jwt() ->> 'email') then
    raise exception 'no autorizado';
  end if;

  return query
  with b as (
    select v.visitor_id, v.session_id,
           (v.created_at at time zone 'America/Bogota')::date as d
    from public.visits v
  ),
  hoy as (select (now() at time zone 'America/Bogota')::date as d)
  select 'hoy'::text, count(distinct b.visitor_id), count(distinct b.session_id), count(*)
    from b, hoy where b.d = hoy.d
  union all
  select 'semana'::text, count(distinct b.visitor_id), count(distinct b.session_id), count(*)
    from b, hoy where b.d >= hoy.d - 6
  union all
  select 'mes'::text, count(distinct b.visitor_id), count(distinct b.session_id), count(*)
    from b, hoy where b.d >= hoy.d - 29;
end;
$$;

-- ---------- Serie diaria (para la gráfica de barras) ----------
-- Devuelve TODOS los días del rango, incluidos los de cero, para que la
-- gráfica no se vea con huecos.
create or replace function public.visitas_serie(dias int default 30)
returns table (dia date, personas bigint, visitas bigint, vistas bigint)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not public.is_admin(auth.jwt() ->> 'email') then
    raise exception 'no autorizado';
  end if;
  if dias is null or dias < 1 or dias > 365 then dias := 30; end if;

  return query
  with hoy as (select (now() at time zone 'America/Bogota')::date as d),
  rango as (
    select generate_series((select d from hoy) - (dias - 1), (select d from hoy), interval '1 day')::date as dia
  ),
  b as (
    select v.visitor_id, v.session_id,
           (v.created_at at time zone 'America/Bogota')::date as d
    from public.visits v
    where (v.created_at at time zone 'America/Bogota')::date >= (select d from hoy) - (dias - 1)
  )
  select r.dia,
         count(distinct b.visitor_id),
         count(distinct b.session_id),
         count(b.visitor_id)
  from rango r left join b on b.d = r.dia
  group by r.dia
  order by r.dia;
end;
$$;

-- ---------- Recurrencia: ¿cuántas veces vuelve la gente? ----------
-- Agrupa a las personas del periodo según cuántas VISITAS distintas hicieron.
create or replace function public.visitas_recurrencia(dias int default 30)
returns table (tramo text, personas bigint)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not public.is_admin(auth.jwt() ->> 'email') then
    raise exception 'no autorizado';
  end if;
  if dias is null or dias < 1 or dias > 365 then dias := 30; end if;

  return query
  with hoy as (select (now() at time zone 'America/Bogota')::date as d),
  por_persona as (
    select v.visitor_id, count(distinct v.session_id) as n
    from public.visits v
    where (v.created_at at time zone 'America/Bogota')::date >= (select d from hoy) - (dias - 1)
    group by v.visitor_id
  ),
  clasificado as (
    select case when n = 1 then '1 vez'
                when n between 2 and 3 then '2-3 veces'
                else '4 o más' end as tramo,
           case when n = 1 then 1 when n between 2 and 3 then 2 else 3 end as orden
    from por_persona
  )
  select c.tramo, count(*)::bigint
  from clasificado c
  group by c.tramo, c.orden
  order by c.orden;
end;
$$;

-- ---------- Permisos: solo el admin autenticado puede llamarlas ----------
revoke all on function public.visitas_resumen()          from public, anon;
revoke all on function public.visitas_serie(int)         from public, anon;
revoke all on function public.visitas_recurrencia(int)   from public, anon;
grant execute on function public.visitas_resumen()        to authenticated;
grant execute on function public.visitas_serie(int)       to authenticated;
grant execute on function public.visitas_recurrencia(int) to authenticated;

-- ==============================================================
--  LIMPIEZA (opcional, recomendada)
--  Una fila por carga de página crece rápido. Esto borra lo que pase
--  de 1 año. Córrelo a mano de vez en cuando, o progrÁmalo con pg_cron
--  si algún día activas esa extensión.
--
--    delete from public.visits where created_at < now() - interval '1 year';
-- ==============================================================

-- ########## analitica-setup.sql ##########
-- ==============================================================
--  EL PORTÓN CAJICÁ — Gráficos de ventas del panel
--
--  Cómo usar:
--   1) Supabase → SQL Editor → New query
--   2) Pega TODO esto y dale "Run". No hay nada que reemplazar.
--
--  REQUISITO: haber corrido antes `multi-admin-setup.sql` y
--  `fix-admins-recursion.sql` (de ahí sale public.is_admin).
--
--  POR QUÉ ESTO VIVE EN LA BASE Y NO EN EL NAVEGADOR:
--   La API de Supabase devuelve como máximo 1000 filas por consulta.
--   El panel venía leyendo TODOS los pedidos con select('*') para
--   calcular los KPIs: al pasar de 1000 pedidos esos números se
--   quedarían topados y MAL, sin ningún error visible. Con ~20
--   pedidos al día eso pasa en menos de dos meses. Agregando en
--   Postgres el número siempre es exacto y viajan 30 filas, no 1000.
--
--  Criterio de dinero: se excluyen los pedidos 'cancelado', igual
--  que el KPI "Ingreso" que ya existía. Las fechas se cortan en
--  hora de Bogotá (si no, el día arrancaría a las 7 p.m. anterior).
-- ==============================================================

-- ---------- Serie de ventas: por día, semana o mes ----------
-- Devuelve TODOS los periodos del rango, incluidos los de cero, para
-- que la gráfica no salga con huecos.
create or replace function public.ventas_serie(p_gran text default 'dia', p_periodos int default 30)
returns table (inicio date, ingreso bigint, pedidos bigint)
language plpgsql security definer set search_path = public stable
as $$
declare
  v_unit text;
begin
  if not public.is_admin(auth.jwt() ->> 'email') then
    raise exception 'no autorizado';
  end if;

  v_unit := case p_gran when 'semana' then 'week' when 'mes' then 'month' else 'day' end;
  if p_periodos is null or p_periodos < 1 or p_periodos > 120 then p_periodos := 30; end if;

  return query
  with tope as (
    select date_trunc(v_unit, (now() at time zone 'America/Bogota'))::date as t
  ),
  rango as (
    select generate_series(
             (select t from tope) - ((p_periodos - 1) || ' ' || v_unit)::interval,
             (select t from tope),
             ('1 ' || v_unit)::interval
           )::date as inicio
  ),
  ped as (
    select date_trunc(v_unit, (o.created_at at time zone 'America/Bogota'))::date as inicio,
           o.subtotal
    from public.orders o
    where o.status <> 'cancelado'
  )
  select r.inicio,
         coalesce(sum(p.subtotal), 0)::bigint,
         count(p.subtotal)::bigint
  from rango r
  left join ped p on p.inicio = r.inicio
  group by r.inicio
  order by r.inicio;
end;
$$;

-- ---------- Productos más pedidos en la misma ventana ----------
-- Sale de `items` (jsonb) de cada pedido. `unidades` suma cantidades y
-- `ingreso` suma cantidad × precio unitario del momento de la compra.
create or replace function public.ventas_top(p_gran text default 'dia', p_periodos int default 30, p_limite int default 8)
returns table (producto text, categoria text, unidades bigint, ingreso bigint)
language plpgsql security definer set search_path = public stable
as $$
declare
  v_unit  text;
  v_desde date;
begin
  if not public.is_admin(auth.jwt() ->> 'email') then
    raise exception 'no autorizado';
  end if;

  v_unit := case p_gran when 'semana' then 'week' when 'mes' then 'month' else 'day' end;
  if p_periodos is null or p_periodos < 1 or p_periodos > 120 then p_periodos := 30; end if;
  if p_limite  is null or p_limite  < 1 or p_limite  > 50  then p_limite  := 8;  end if;

  v_desde := (date_trunc(v_unit, (now() at time zone 'America/Bogota'))
              - ((p_periodos - 1) || ' ' || v_unit)::interval)::date;

  return query
  select coalesce(it ->> 'name', '(sin nombre)')::text,
         coalesce(it ->> 'cat', '')::text,
         sum(coalesce((it ->> 'qty')::int, 1))::bigint,
         sum(coalesce((it ->> 'qty')::int, 1) * coalesce((it ->> 'unitPrice')::int, 0))::bigint
  from public.orders o
  cross join lateral jsonb_array_elements(o.items) as it
  where o.status <> 'cancelado'
    and (o.created_at at time zone 'America/Bogota')::date >= v_desde
    and jsonb_typeof(o.items) = 'array'
  group by 1, 2
  order by 3 desc, 4 desc
  limit p_limite;
end;
$$;

-- ---------- Totales de arriba (los 4 KPIs) ----------
-- Mismo criterio que tenía el panel, pero exacto pasando las 1000 filas.
create or replace function public.ventas_totales()
returns table (pedidos_totales bigint, pedidos_hoy bigint, ingreso bigint, ticket bigint)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not public.is_admin(auth.jwt() ->> 'email') then
    raise exception 'no autorizado';
  end if;

  return query
  select count(*)::bigint,
         count(*) filter (
           where (o.created_at at time zone 'America/Bogota')::date
               = (now() at time zone 'America/Bogota')::date
         )::bigint,
         coalesce(sum(o.subtotal) filter (where o.status <> 'cancelado'), 0)::bigint,
         case when count(*) filter (where o.status <> 'cancelado') > 0
              then (coalesce(sum(o.subtotal) filter (where o.status <> 'cancelado'), 0)
                    / count(*) filter (where o.status <> 'cancelado'))::bigint
              else 0::bigint
         end
  from public.orders o;
end;
$$;

-- ---------- Permisos: solo el admin autenticado ----------
revoke all on function public.ventas_serie(text, int)      from public, anon;
revoke all on function public.ventas_top(text, int, int)   from public, anon;
revoke all on function public.ventas_totales()             from public, anon;
grant execute on function public.ventas_serie(text, int)    to authenticated;
grant execute on function public.ventas_top(text, int, int) to authenticated;
grant execute on function public.ventas_totales()           to authenticated;
