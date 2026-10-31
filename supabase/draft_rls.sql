-- BORRADOR. NO EJECUTAR hasta que el login emita JWT con claims
-- (employee_id, store_id, role). Ver SECURITY_MIGRATION.md.

create or replace function public.jwt_role() returns text language sql stable as
$$ select coalesce(auth.jwt() ->> 'role_app','') $$;
create or replace function public.jwt_store() returns text language sql stable as
$$ select coalesce(auth.jwt() ->> 'store_id','') $$;
create or replace function public.jwt_emp() returns text language sql stable as
$$ select coalesce(auth.jwt() ->> 'employee_id','') $$;

alter table public.employees enable row level security;
alter table public.records enable row level security;
alter table public.cuts enable row level security;
alter table public.task_assignments enable row level security;
alter table public.announcements enable row level security;
alter table public.sales_goals enable row level security;
alter table public.compliance_strikes enable row level security;
alter table public.store_streak_state enable row level security;
alter table public.task_templates enable row level security;
alter table public.products enable row level security;
alter table public.store_maximos enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reception_records enable row level security;

-- employees: sin acceso directo a password_hash desde el cliente
revoke select (password_hash) on public.employees from anon, authenticated;
create policy emp_read on public.employees for select to authenticated
  using (jwt_role()='super' or store_id = jwt_store());

-- records: cada quien ve/crea los suyos; super ve todo; gerente su tienda
create policy rec_read on public.records for select to authenticated
  using (jwt_role()='super' or employee_id=jwt_emp() or (jwt_role()='manager' and store_id=jwt_store()));
create policy rec_insert on public.records for insert to authenticated
  with check (employee_id=jwt_emp());

-- cuts: solo super admin (y el autor al insertar)
create policy cuts_read on public.cuts for select to authenticated using (jwt_role()='super');
create policy cuts_insert on public.cuts for insert to authenticated with check (employee_id=jwt_emp());

-- task_assignments / announcements / strikes: lectura propia o de tienda
create policy ta_read on public.task_assignments for select to authenticated
  using (jwt_role()='super' or employee_id=jwt_emp() or store_id=jwt_store());
create policy ann_read on public.announcements for select to authenticated using (true);
create policy strikes_read on public.compliance_strikes for select to authenticated
  using (jwt_role()='super' or employee_id=jwt_emp());

-- Escrituras de admin (employees, goals, announcements, etc.): hacerlas por
-- Edge Function con service role; no abrir políticas de update/delete al cliente.
