import Link from 'next/link';
import { Activity, BrainCircuit, CheckCircle2, Clock3, Users } from 'lucide-react';
import { OperationsService } from '@/services/operations-service';
import { createAdminClient } from '@/lib/supabase/admin';

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}

export default async function BrainPage() {
  await OperationsService.requireOwner();
  const admin = createAdminClient() as any;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: customers }, { data: memories }, { data: events }, { data: tasks }, { data: employees }] = await Promise.all([
    admin.from('customers').select('id,company_id,display_name,status,last_contact_at,created_at').order('last_contact_at', { ascending: false }).limit(100),
    admin.from('brain_memories').select('id').limit(1_000),
    admin.from('brain_events').select('id,event_name,company_id,customer_id,occurred_at,payload,processed_at').order('occurred_at', { ascending: false }).limit(100),
    admin.from('brain_tasks').select('id,status,task_type,title,company_id,created_at').order('created_at', { ascending: false }).limit(100),
    admin.from('employees').select('id,employee_type,status'),
  ]);
  const customerRows = customers ?? [];
  const eventRows = events ?? [];
  const taskRows = tasks ?? [];
  const eventsMinute = eventRows.filter((event: { occurred_at: string }) => new Date(event.occurred_at) >= new Date(Date.now() - 60_000)).length;
  const activeEmployees = (employees ?? []).filter((employee: { status: string }) => employee.status === 'active').length;
  const latestCustomers = new Map(customerRows.map((customer: { id: string; display_name: string | null }) => [customer.id, customer.display_name || 'Cliente']));

  return <main className="px-5 py-8 md:px-8 md:py-10"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#ccff00]">Centro de inteligencia</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">Empleado24 Brain</h1><p className="mt-3 text-sm text-white/50">La memoria y coordinación compartida de todos los empleados.</p></div><Link href="/ops/business" className="rounded-xl border border-white/10 px-4 py-2 text-sm">Dashboard CEO</Link></header>
    <section className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Users} label="Clientes únicos" value={String(customerRows.length)}/><Metric icon={BrainCircuit} label="Memorias guardadas" value={String(memories?.length ?? 0)}/><Metric icon={Activity} label="Eventos por minuto" value={String(eventsMinute)}/><Metric icon={Clock3} label="Tareas pendientes" value={String(taskRows.filter((task: { status: string }) => ['open','in_progress'].includes(task.status)).length)}/><Metric icon={CheckCircle2} label="Eventos procesados" value={String(eventRows.filter((event: { processed_at: string | null }) => Boolean(event.processed_at)).length)}/><Metric icon={Users} label="Empleados activos" value={String(activeEmployees)}/></section>
    <section className="mt-10 grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-lg font-semibold">Actividad compartida</h2>{eventRows.length ? <ul className="mt-4 divide-y divide-white/10">{eventRows.slice(0, 16).map((event: { id: string; event_name: string; customer_id: string | null; occurred_at: string }) => <li key={event.id} className="flex justify-between gap-4 py-3 text-sm"><span>{event.event_name}{event.customer_id ? ` · ${latestCustomers.get(event.customer_id) ?? 'Cliente'}` : ''}</span><span className="text-white/45">{date(event.occurred_at)}</span></li>)}</ul> : <p className="mt-4 text-sm text-white/45">El Brain mostrará la actividad cuando los empleados publiquen sus primeros eventos.</p>}</article><article className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-lg font-semibold">Automatizaciones</h2><ul className="mt-4 grid gap-3 text-sm text-white/70"><li>Lead nuevo → tarea de seguimiento para Closer.</li><li>Presupuesto enviado → llamada en 48 horas.</li><li>Venta conseguida → aviso comercial y cierre de tareas.</li></ul><h3 className="mt-8 text-sm font-semibold">Tareas recientes</h3>{taskRows.length ? <ul className="mt-3 divide-y divide-white/10">{taskRows.slice(0, 8).map((task: { id: string; title: string; status: string }) => <li key={task.id} className="flex justify-between gap-4 py-2 text-sm"><span>{task.title}</span><span className="text-[#ddff57]">{task.status}</span></li>)}</ul> : <p className="mt-3 text-sm text-white/45">No hay tareas pendientes.</p>}</article></section>
    <section className="mt-10 rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-lg font-semibold">Clientes recientes</h2>{customerRows.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{customerRows.slice(0, 20).map((customer: { id: string; display_name: string | null; status: string; last_contact_at: string | null }) => <Link key={customer.id} href={`/ops/brain/customers/${customer.id}`} className="flex items-center justify-between rounded-xl border border-white/10 p-3 text-sm hover:border-[#ccff00]/50"><span>{customer.display_name || 'Cliente'}</span><span className="text-white/45">{customer.status} · {date(customer.last_contact_at)}</span></Link>)}</div> : <p className="mt-4 text-sm text-white/45">Aún no hay clientes en el Brain.</p>}</section>
  </main>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) { return <article className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><Icon size={17} className="text-[#ccff00]"/><p className="mt-5 text-3xl font-semibold tracking-[-.05em]">{value}</p><p className="mt-1 text-xs text-white/45">{label}</p></article>; }
