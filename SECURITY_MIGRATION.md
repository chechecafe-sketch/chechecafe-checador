# Plan de migración de seguridad (NO aplicado)

Estado al 2026-10-31: el frontend habla directo con Supabase usando la anon key
y las tablas operativas no tienen RLS. Cualquiera con esa key (visible en el JS
publicado) puede leer/modificar `employees` (incluye `password_hash`), `records`,
`cuts`, etc. Los roles (super admin / gerente) y el PIN de admin se validan solo
en el navegador.

## Hallazgos
1. 14 tablas sin RLS: employees, records, cuts, products, store_maximos, orders,
   order_items, reception_records, task_assignments, announcements, sales_goals,
   compliance_strikes, store_streak_state, task_templates.
2. `password_hash` = SHA-256(password + "checheCafe2024") (sal fija, hash rápido) y
   legible con la anon key.
3. `ADMIN_PIN` hardcodeado en `src/App.jsx`.
4. Roles decididos en el cliente (`SUPER_ADMIN_USERS`, `MANAGER_USERS`).
5. `api/*.js` no validan quién llama (cualquiera puede disparar correos) y
   `check-missing-cuts` cae a la anon key si falta `SUPABASE_SERVICE_KEY`.

## Orden recomendado (para no romper la app)
1. **Rotar secretos hoy**: PIN de admin, `RESEND_API_KEY`, `SUPABASE_SERVICE_KEY`,
   y la anon/JWT secret de Supabase si hay sospecha de uso indebido. Revisar
   Vercel, GitHub (colaboradores, deploy keys, tokens), Supabase (miembros de la
   organización) y Resend, y quitar a quien ya no deba tener acceso.
2. **Login en servidor**: Edge Function `login` que reciba usuario/contraseña,
   verifique con bcrypt/argon2 (migrar los hashes en el primer login) y emita un
   JWT firmado con claims `employee_id`, `store_id`, `role`.
3. **Cliente**: usar ese JWT en `createClient(..., {global:{headers:{Authorization}}})`;
   eliminar `ADMIN_PIN` y las listas de usuarios del frontend.
4. **RLS**: aplicar `supabase/draft_rls.sql` (borrador) solo después de 2 y 3.
5. **API de Vercel**: exigir un secreto (header o Vercel Cron secret) y usar
   siempre la service key en servidor.
6. Quitar `password_hash` de cualquier `select("*")` (líneas 376, 772, 800, 1049).

## Importante
Habilitar RLS sin políticas bloquea toda la app. No ejecutar `draft_rls.sql`
hasta tener listos los pasos 2 y 3.
