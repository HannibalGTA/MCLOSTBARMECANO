-- =========================================================
-- THE LOST MC — schema Supabase (bar + mécano)
-- A exécuter dans Supabase > SQL Editor, en une fois, sur un projet neuf.
-- =========================================================

-- Extension pour uuid
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 1. PROFILS (rôles) — liés aux comptes Supabase Auth
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('mecano','barman','gestionnaire','superviseur')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Fonction utilitaire : rôle de l'utilisateur courant
create or replace function public.current_role_name()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Fonction utilitaire : est-ce que l'utilisateur courant a un des rôles donnés ?
create or replace function public.has_role(roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = any(roles), false);
$$;

alter table public.profiles enable row level security;

create policy "profiles: lecture de son propre profil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: gestionnaire peut tout lire"
  on public.profiles for select
  using (public.has_role(array['gestionnaire']));

-- ---------------------------------------------------------
-- 2. ITEMS (catalogue) — un jeu pour le bar, un pour le mécano
-- ---------------------------------------------------------
create table if not exists public.bar_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buy_price numeric(12,2) not null check (buy_price >= 0),
  sell_price numeric(12,2) not null check (sell_price >= buy_price),
  stock integer not null default 0,
  image_data text, -- data URL base64, redimensionnée côté client (max ~150ko)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mecano_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buy_price numeric(12,2) not null check (buy_price >= 0),
  sell_price numeric(12,2) not null check (sell_price >= buy_price),
  stock integer not null default 0,
  image_data text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bar_items enable row level security;
alter table public.mecano_items enable row level security;

-- Lecture : tout profil connecté peut voir les catalogues (nécessaire pour les caisses et bilans)
create policy "bar_items: lecture connectés" on public.bar_items for select using (auth.uid() is not null);
create policy "mecano_items: lecture connectés" on public.mecano_items for select using (auth.uid() is not null);

-- Ecriture : uniquement gestionnaire (création items) ; le stock est aussi modifié par triggers de vente/achat (security definer)
create policy "bar_items: ecriture gestionnaire" on public.bar_items for all
  using (public.has_role(array['gestionnaire'])) with check (public.has_role(array['gestionnaire']));
create policy "mecano_items: ecriture gestionnaire" on public.mecano_items for all
  using (public.has_role(array['gestionnaire'])) with check (public.has_role(array['gestionnaire']));

-- ---------------------------------------------------------
-- 3. VENTES BAR (caisse enregistreuse)
-- ---------------------------------------------------------
create table if not exists public.bar_sales (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id),
  seller_name text,
  total numeric(12,2) not null default 0,
  note text,
  sale_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.bar_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.bar_sales(id) on delete cascade,
  item_id uuid references public.bar_items(id),
  item_name text not null,
  unit_price numeric(12,2) not null,
  quantity numeric(12,2) not null,
  line_total numeric(12,2) not null
);

alter table public.bar_sales enable row level security;
alter table public.bar_sale_lines enable row level security;

create policy "bar_sales: lecture gestionnaire+superviseur+barman"
  on public.bar_sales for select
  using (public.has_role(array['gestionnaire','superviseur','barman']));
create policy "bar_sales: creation barman+gestionnaire"
  on public.bar_sales for insert
  with check (public.has_role(array['barman','gestionnaire']));
create policy "bar_sales: modif/suppr gestionnaire+superviseur"
  on public.bar_sales for update using (public.has_role(array['gestionnaire','superviseur']));
create policy "bar_sales: suppr gestionnaire+superviseur"
  on public.bar_sales for delete using (public.has_role(array['gestionnaire','superviseur']));

create policy "bar_sale_lines: lecture" on public.bar_sale_lines for select
  using (public.has_role(array['gestionnaire','superviseur','barman']));
create policy "bar_sale_lines: creation" on public.bar_sale_lines for insert
  with check (public.has_role(array['barman','gestionnaire']));
create policy "bar_sale_lines: modif" on public.bar_sale_lines for update
  using (public.has_role(array['gestionnaire','superviseur']));
create policy "bar_sale_lines: suppr" on public.bar_sale_lines for delete
  using (public.has_role(array['gestionnaire','superviseur']));

-- ---------------------------------------------------------
-- 4. VENTES MECANO (caisse + infos véhicule/client)
-- ---------------------------------------------------------
create table if not exists public.mecano_sales (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id),
  seller_name text,
  client_name text,
  plate text,
  vehicle_model text,
  doc_type text not null default 'facture' check (doc_type in ('facture','devis')),
  total numeric(12,2) not null default 0,
  note text,
  sale_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.mecano_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.mecano_sales(id) on delete cascade,
  item_id uuid references public.mecano_items(id),
  item_name text not null,
  unit_price numeric(12,2) not null,
  quantity numeric(12,2) not null,
  line_total numeric(12,2) not null
);

alter table public.mecano_sales enable row level security;
alter table public.mecano_sale_lines enable row level security;

create policy "mecano_sales: lecture" on public.mecano_sales for select
  using (public.has_role(array['gestionnaire','superviseur','mecano']));
create policy "mecano_sales: creation" on public.mecano_sales for insert
  with check (public.has_role(array['mecano','gestionnaire']));
create policy "mecano_sales: modif" on public.mecano_sales for update
  using (public.has_role(array['gestionnaire','superviseur']));
create policy "mecano_sales: suppr" on public.mecano_sales for delete
  using (public.has_role(array['gestionnaire','superviseur']));

create policy "mecano_sale_lines: lecture" on public.mecano_sale_lines for select
  using (public.has_role(array['gestionnaire','superviseur','mecano']));
create policy "mecano_sale_lines: creation" on public.mecano_sale_lines for insert
  with check (public.has_role(array['mecano','gestionnaire']));
create policy "mecano_sale_lines: modif" on public.mecano_sale_lines for update
  using (public.has_role(array['gestionnaire','superviseur']));
create policy "mecano_sale_lines: suppr" on public.mecano_sale_lines for delete
  using (public.has_role(array['gestionnaire','superviseur']));

-- ---------------------------------------------------------
-- 5. ACHATS (gestionnaire uniquement) — alimente compta + stock
-- ---------------------------------------------------------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('bar','mecano')),
  buyer_id uuid references public.profiles(id),
  total numeric(12,2) not null default 0,
  note text,
  purchase_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  domain text not null check (domain in ('bar','mecano')),
  item_id uuid, -- null si dépense libre
  label text not null,
  unit_price numeric(12,2) not null,
  quantity numeric(12,2) not null,
  line_total numeric(12,2) not null
);

alter table public.purchases enable row level security;
alter table public.purchase_lines enable row level security;

create policy "purchases: lecture gestionnaire+superviseur"
  on public.purchases for select using (public.has_role(array['gestionnaire','superviseur']));
create policy "purchases: ecriture gestionnaire"
  on public.purchases for all
  using (public.has_role(array['gestionnaire'])) with check (public.has_role(array['gestionnaire']));

create policy "purchase_lines: lecture gestionnaire+superviseur"
  on public.purchase_lines for select using (public.has_role(array['gestionnaire','superviseur']));
create policy "purchase_lines: ecriture gestionnaire"
  on public.purchase_lines for all
  using (public.has_role(array['gestionnaire'])) with check (public.has_role(array['gestionnaire']));

-- ---------------------------------------------------------
-- 6. TRIGGERS DE STOCK (automatiques, cohérents même en cas de suppression/modif)
-- ---------------------------------------------------------

-- Vente bar : décrémente stock à l'insertion d'une ligne, ré-incrémente si supprimée
create or replace function public.trg_bar_sale_line_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.item_id is not null then
      update public.bar_items set stock = stock - new.quantity, updated_at = now() where id = new.item_id;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    if old.item_id is not null then
      update public.bar_items set stock = stock + old.quantity, updated_at = now() where id = old.item_id;
    end if;
    return old;
  elsif TG_OP = 'UPDATE' then
    if new.item_id is not null and new.item_id = old.item_id then
      update public.bar_items set stock = stock - (new.quantity - old.quantity), updated_at = now() where id = new.item_id;
    else
      if old.item_id is not null then
        update public.bar_items set stock = stock + old.quantity, updated_at = now() where id = old.item_id;
      end if;
      if new.item_id is not null then
        update public.bar_items set stock = stock - new.quantity, updated_at = now() where id = new.item_id;
      end if;
    end if;
    return new;
  end if;
  return null;
end; $$;

drop trigger if exists bar_sale_line_stock on public.bar_sale_lines;
create trigger bar_sale_line_stock
  after insert or delete or update of quantity, item_id on public.bar_sale_lines
  for each row execute function public.trg_bar_sale_line_stock();

create or replace function public.trg_mecano_sale_line_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.item_id is not null then
      update public.mecano_items set stock = stock - new.quantity, updated_at = now() where id = new.item_id;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    if old.item_id is not null then
      update public.mecano_items set stock = stock + old.quantity, updated_at = now() where id = old.item_id;
    end if;
    return old;
  elsif TG_OP = 'UPDATE' then
    if new.item_id is not null and new.item_id = old.item_id then
      update public.mecano_items set stock = stock - (new.quantity - old.quantity), updated_at = now() where id = new.item_id;
    else
      if old.item_id is not null then
        update public.mecano_items set stock = stock + old.quantity, updated_at = now() where id = old.item_id;
      end if;
      if new.item_id is not null then
        update public.mecano_items set stock = stock - new.quantity, updated_at = now() where id = new.item_id;
      end if;
    end if;
    return new;
  end if;
  return null;
end; $$;

drop trigger if exists mecano_sale_line_stock on public.mecano_sale_lines;
create trigger mecano_sale_line_stock
  after insert or delete or update of quantity, item_id on public.mecano_sale_lines
  for each row execute function public.trg_mecano_sale_line_stock();

-- Achat : incrémente stock à l'insertion d'une ligne (si liée à un item), ré-décrémente si supprimée
create or replace function public.trg_purchase_line_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.item_id is not null and new.domain = 'bar' then
      update public.bar_items set stock = stock + new.quantity, updated_at = now() where id = new.item_id;
    elsif new.item_id is not null and new.domain = 'mecano' then
      update public.mecano_items set stock = stock + new.quantity, updated_at = now() where id = new.item_id;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    if old.item_id is not null and old.domain = 'bar' then
      update public.bar_items set stock = stock - old.quantity, updated_at = now() where id = old.item_id;
    elsif old.item_id is not null and old.domain = 'mecano' then
      update public.mecano_items set stock = stock - old.quantity, updated_at = now() where id = old.item_id;
    end if;
    return old;
  elsif TG_OP = 'UPDATE' then
    if old.item_id is not null and old.domain = 'bar' then
      update public.bar_items set stock = stock - old.quantity, updated_at = now() where id = old.item_id;
    elsif old.item_id is not null and old.domain = 'mecano' then
      update public.mecano_items set stock = stock - old.quantity, updated_at = now() where id = old.item_id;
    end if;
    if new.item_id is not null and new.domain = 'bar' then
      update public.bar_items set stock = stock + new.quantity, updated_at = now() where id = new.item_id;
    elsif new.item_id is not null and new.domain = 'mecano' then
      update public.mecano_items set stock = stock + new.quantity, updated_at = now() where id = new.item_id;
    end if;
    return new;
  end if;
  return null;
end; $$;

drop trigger if exists purchase_line_stock on public.purchase_lines;
create trigger purchase_line_stock
  after insert or delete or update of quantity, item_id, domain on public.purchase_lines
  for each row execute function public.trg_purchase_line_stock();

-- ---------------------------------------------------------
-- 7. Bucket de stockage optionnel (non utilisé si images en base64, gardé au cas où)
-- ---------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('item-images','item-images', true)
--   on conflict (id) do nothing;

-- =========================================================
-- FIN DU SCRIPT
-- Après exécution :
-- 1) Aller dans Authentication > Users et créer 4 comptes :
--    barman@lostmc.local / mecano@lostmc.local / gestionnaire@lostmc.local / superviseur@lostmc.local
--    avec les mots de passe voulus (min 8 caractères).
-- 2) Pour chacun, noter l'UUID (colonne "UID") puis exécuter, en remplaçant les UUID :
--    insert into public.profiles (id, role, display_name) values
--      ('<uuid-barman>', 'barman', 'Barman'),
--      ('<uuid-mecano>', 'mecano', 'Mécano'),
--      ('<uuid-gestionnaire>', 'gestionnaire', 'Gestionnaire'),
--      ('<uuid-superviseur>', 'superviseur', 'Superviseur');
-- =========================================================
