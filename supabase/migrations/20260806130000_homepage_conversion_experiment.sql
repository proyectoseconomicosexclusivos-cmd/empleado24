alter table public.conversion_experiments
  drop constraint if exists conversion_experiments_target_check;

alter table public.conversion_experiments
  add constraint conversion_experiments_target_check
  check (target in ('laura_opening', 'homepage_headline'));

insert into public.conversion_experiments (experiment_key, display_name, target, status, variants, started_at)
values (
  'homepage_headline_20260806',
  'Titular de la Home · ronda 1',
  'homepage_headline',
  'active',
  jsonb_build_array(
    jsonb_build_object('key', 'control', 'message', 'CONTRATA EMPLEADOS CON IA' || chr(10) || 'DESDE 97 €/MES', 'submessage', 'Personas virtuales que trabajan para tu empresa 24 horas al día. Laura te recomienda por dónde empezar en menos de dos minutos.'),
    jsonb_build_object('key', 'first_employee', 'message', 'CONTRATA TU PRIMER EMPLEADO IA' || chr(10) || 'POR 97 €/MES', 'submessage', 'Prueba cómo Laura atendería a tus clientes antes de decidir. Sin registro y sin compromiso.'),
    jsonb_build_object('key', 'stop_losing', 'message', 'DEJA DE PERDER CLIENTES' || chr(10) || 'CUANDO NO CONTESTAS', 'submessage', 'Laura atiende las conversaciones que hoy se te escapan y te dice qué reforzar después.'),
    jsonb_build_object('key', 'always_on', 'message', 'TU EMPRESA TRABAJANDO' || chr(10) || '24 HORAS AL DÍA', 'submessage', 'Incorpora a Laura en minutos y deja de depender de estar siempre disponible.'),
    jsonb_build_object('key', 'not_software', 'message', 'NO COMPRES SOFTWARE.' || chr(10) || 'CONTRATA A LAURA.', 'submessage', 'Conócela, dile a qué te dedicas y recibe una recomendación para tu empresa.'),
    jsonb_build_object('key', 'calls', 'message', 'CADA LLAMADA SIN RESPONDER' || chr(10) || 'PUEDE SER UN CLIENTE MENOS', 'submessage', 'Prueba a Laura ahora y comprueba cómo protege tus oportunidades.'),
    jsonb_build_object('key', 'recover_time', 'message', 'RECUPERA HORAS CADA SEMANA' || chr(10) || 'SIN CONTRATAR MÁS PERSONAL', 'submessage', 'Empieza con una recomendación adaptada a tu negocio en menos de dos minutos.'),
    jsonb_build_object('key', 'human_cost', 'message', 'UNA RECEPCIONISTA HUMANA CUESTA' || chr(10) || 'HASTA 36.000 €/AÑO', 'submessage', 'Laura cuesta 97 €/mes, trabaja 24/7 y puedes probarla tres días.'),
    jsonb_build_object('key', 'try_first', 'message', 'PRUEBA A LAURA PRIMERO.' || chr(10) || 'DECIDE DESPUÉS.', 'submessage', 'Habla con ella sin crear una cuenta y descubre qué empleado te conviene.'),
    jsonb_build_object('key', 'guided', 'message', 'TU PRÓXIMO EMPLEADO' || chr(10) || 'EMPIEZA HOY', 'submessage', 'Laura te guía, te recomienda el equipo adecuado y tú eliges cuándo activarlo.')
  ),
  now()
)
on conflict (experiment_key) do update set
  display_name = excluded.display_name,
  target = excluded.target,
  status = excluded.status,
  variants = excluded.variants,
  started_at = excluded.started_at,
  ended_at = null,
  updated_at = now();