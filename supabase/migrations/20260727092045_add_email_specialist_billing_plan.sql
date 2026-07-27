-- Email Specialist is sold through the same subscription catalogue as the
-- existing Empleado24 employees. Stripe remains the provider of record.

insert into public.billing_plans (
  plan_key,
  name,
  description,
  monthly_price_cents,
  currency,
  trial_days,
  active,
  self_serve_enabled,
  customer_portal_enabled,
  sort_order,
  employee_limit,
  member_limit,
  knowledge_item_limit,
  retention_days
)
values (
  'employee_email',
  'Especialista Email IA',
  'Prepara campañas, organiza contactos y mantiene el seguimiento por email.',
  9700,
  'EUR',
  3,
  true,
  true,
  true,
  5,
  1,
  2,
  50,
  30
)
on conflict (plan_key) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price_cents = excluded.monthly_price_cents,
  currency = excluded.currency,
  trial_days = excluded.trial_days,
  active = excluded.active,
  self_serve_enabled = excluded.self_serve_enabled,
  customer_portal_enabled = excluded.customer_portal_enabled,
  sort_order = excluded.sort_order,
  employee_limit = excluded.employee_limit,
  member_limit = excluded.member_limit,
  knowledge_item_limit = excluded.knowledge_item_limit,
  retention_days = excluded.retention_days,
  updated_at = now();
