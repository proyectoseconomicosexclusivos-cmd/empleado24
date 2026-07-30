-- Cover all Brain foreign keys for deletion checks and high-volume timelines.
create index if not exists brain_events_customer_idx on public.brain_events(customer_id);
create index if not exists brain_events_employee_idx on public.brain_events(employee_id);
create index if not exists brain_memories_customer_idx on public.brain_memories(customer_id);
create index if not exists brain_memories_employee_idx on public.brain_memories(source_employee_id);
create index if not exists brain_tasks_customer_idx on public.brain_tasks(customer_id);
create index if not exists brain_tasks_employee_idx on public.brain_tasks(assigned_employee_id);
