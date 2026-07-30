import Link from 'next/link';
import { ArrowLeft, BrainCircuit, CheckCircle2, ClipboardList, History, UserRound } from 'lucide-react';
import { OperationsService } from '@/services/operations-service';
import { createAdminClient } from '@/lib/supabase/admin';

function when(value: string | null) { return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }

export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  await OperationsService.requireOwner();
  const { id } = await params;
  const admin = createAdminClient() as any;
  const { data: customer, error } = await admin.from('customers').select('*').eq('id', id).single();
  if (error || !customer) return <main className="p-10 text-white">Cliente no encontrado.</main>;
  const [{ data: identities }, { data: memories }, { data: events }, { data: tasks }, { data: opportunities }] = await Promise.all([
    admin.from('customer_identities').select('identity_type,normalized_value').eq('customer_id', id),
    admin.from('brain_memories').select('id,memory_type,content,created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(80),
    admin.from('brain_events').select('id,event_name,source,payload,occurred_at').eq('customer_id', id).order('occurred_at', { ascending: false }).limit(120),
    admin.from('brain_tasks').select('id,task_type,title,status,due_at,created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(80),
    admin.from('sales_opportunities').select('id,name,stage,value_cents,created_at,updated_at').eq('company_id', customer.company_id).or(`email.eq.${customer.email ?? '__none__'},phone.eq.${customer.phone ?? '__none__'}`).order('updated_at', { ascending: false }).limit(30),
  ]);
  const identityRows = identities ?? [];
  return <main className="px-5 py-8 text-white md:px-8 md:py-10"><Link href="/ops/brain" className="inline-flex items-center gap-2 text-sm text-white/55"><ArrowLeft size={15}/>Volver al Brain</Link><header className="mt-7 flex flex-wrap items-start justify-between gap-5"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#ccff00]">Customer 360</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">{customer.display_name || 'Cliente'}</h1><p className="mt-3 text-sm text-white/50">{customer.company_name || 'Sin empresa'} · Estado: {customer.status}</p></div><p className="rounded-full border border-white/10 px-4 py-2 text-sm">Último contacto: {when(customer.last_contact_at)}</p></header>
    <section className="mt-9 grid gap-3 md:grid-cols-4"><Card icon={UserRound} label="Email" value={customer.email || identityRows.find((row: { identity_type: string }) => row.identity_type === 'email')?.normalized_value || '—'}/><Card icon={UserRound} label="Teléfono" value={customer.phone || '—'}/><Card icon={UserRound} label="WhatsApp" value={customer.whatsapp || '—'}/><Card icon={CheckCircle2} label="Valor estimado" value={`${(Number(customer.estimated_value_cents ?? 0) / 100).toLocaleString('es-ES')} €`}/></section>
    <section className="mt-10 grid gap-4 lg:grid-cols-2"><Panel icon={History} title="Timeline completo">{events?.length ? events.map((event: { id: string; event_name: string; source: string; occurred_at: string }) => <Row key={event.id} title={event.event_name} detail={event.source} date={event.occurred_at}/>) : <Empty text="Aún no hay actividad registrada."/>}</Panel><Panel icon={BrainCircuit} title="Memoria compartida">{memories?.length ? memories.map((memory: { id: string; memory_type: string; content: string; created_at: string }) => <Row key={memory.id} title={memory.content} detail={memory.memory_type} date={memory.created_at}/>) : <Empty text="Aún no hay memoria guardada."/>}</Panel><Panel icon={ClipboardList} title="Tareas">{tasks?.length ? tasks.map((task: { id: string; title: string; task_type: string; status: string; due_at: string | null }) => <Row key={task.id} title={task.title} detail={`${task.task_type} · ${task.status}`} date={task.due_at}/>) : <Empty text="No hay tareas abiertas."/>}</Panel><Panel icon={CheckCircle2} title="Ventas y presupuestos">{opportunities?.length ? opportunities.map((item: { id: string; name: string; stage: string; value_cents: number; updated_at: string }) => <Row key={item.id} title={item.name} detail={`${item.stage} · ${(Number(item.value_cents ?? 0) / 100).toLocaleString('es-ES')} €`} date={item.updated_at}/>) : <Empty text="No hay oportunidades comerciales vinculadas."/>}</Panel></section>
  </main>;
}

function Card({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) { return <article className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><Icon size={16} className="text-[#ccff00]"/><p className="mt-5 break-all text-lg font-semibold">{value}</p><p className="mt-1 text-xs text-white/45">{label}</p></article>; }
function Panel({ icon: Icon, title, children }: { icon: typeof History; title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><div className="flex items-center gap-2"><Icon size={17} className="text-[#ccff00]"/><h2 className="text-lg font-semibold">{title}</h2></div><div className="mt-4 divide-y divide-white/10">{children}</div></section>; }
function Row({ title, detail, date }: { title: string; detail: string; date: string | null }) { return <article className="py-3"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-white/45">{detail} · {when(date)}</p></article>; }
function Empty({ text }: { text: string }) { return <p className="py-5 text-sm text-white/45">{text}</p>; }
