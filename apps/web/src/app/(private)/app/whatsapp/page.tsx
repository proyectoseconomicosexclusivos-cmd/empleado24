import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, MessageCircle, Users } from 'lucide-react';
import { CompanyService } from '@/services/company-service';
import { createClient } from '@/lib/supabase/server';
import { IntegrationService } from '@/services/integration-service';

function averageResponse(rows: Array<{ last_customer_message_at: string | null; first_response_at: string | null }>) {
  const values = rows.map((row) => row.last_customer_message_at && row.first_response_at ? new Date(row.first_response_at).getTime() - new Date(row.last_customer_message_at).getTime() : null).filter((value): value is number => value !== null && value >= 0);
  return values.length ? `${Math.max(1, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length / 60000))} min` : '—';
}

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ connected?: string }> }) {
  const membership = await CompanyService.current(); const company = Array.isArray(membership?.companies) ? membership?.companies[0] : membership?.companies;
  if (!company) return null;
  const supabase = await createClient() as any;
  const [{ data: employee }, integrations, { data: conversations }, { data: messages }] = await Promise.all([
    supabase.from('employees').select('id,name,status,runtime_status').eq('company_id', company.id).eq('employee_type', 'whatsapp').maybeSingle(),
    IntegrationService.list(company.id),
    supabase.from('whatsapp_conversations').select('id,status,last_customer_message_at,first_response_at,updated_at').eq('company_id', company.id).order('updated_at', { ascending: false }).limit(100),
    supabase.from('whatsapp_messages').select('id,direction,sent_at').eq('company_id', company.id).order('sent_at', { ascending: false }).limit(500),
  ]);
  const connected = (integrations.data ?? []).find((row) => row.provider_key === 'whatsapp_meta' && row.status === 'connected');
  const rows = (conversations ?? []) as Array<{ id: string; status: string; last_customer_message_at: string | null; first_response_at: string | null; updated_at: string }>;
  const messagesRows = (messages ?? []) as Array<{ id: string; direction: string; sent_at: string }>;
  const query = await searchParams;
  if (!employee) return <main className="mx-auto max-w-3xl px-5 py-12"><p className="eyebrow">Tu equipo</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">Incorpora WhatsApp IA</h1><p className="mt-4 text-[var(--muted)]">Atenderá los mensajes de tu empresa, todos los días.</p><Link href="/app/facturacion" className="mt-7 inline-flex rounded-full bg-[#111315] px-5 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]">Ver empleados disponibles</Link></main>;
  return <main className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14"><header className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Tu empleado</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">💬 {employee.name}</h1><p className="mt-3 text-[var(--muted)]">Tu Empleado WhatsApp IA está trabajando para {company.name}.</p></div><Link href="/app/integraciones/whatsapp_meta" className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium">{connected ? 'Revisar WhatsApp Business' : 'Conectar WhatsApp Business'} <ArrowRight size={14}/></Link></header>
    {(query.connected === '1' || connected) && <div className="mt-8 rounded-2xl bg-[#e9ffcf] p-4 text-sm text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]"><CheckCircle2 className="mr-2 inline" size={17}/>Tu WhatsApp Business está conectado y pertenece solo a tu empresa.</div>}
    <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Fact icon={MessageCircle} label="Conversaciones abiertas" value={String(rows.filter((row) => ['open','waiting'].includes(row.status)).length)}/><Fact icon={CheckCircle2} label="Conversaciones cerradas" value={String(rows.filter((row) => row.status === 'closed').length)}/><Fact icon={Users} label="Clientes derivados" value={String(rows.filter((row) => row.status === 'escalated').length)}/><Fact icon={Clock3} label="Respuesta media" value={averageResponse(rows)}/><Fact icon={MessageCircle} label="Mensajes recibidos" value={String(messagesRows.filter((row) => row.direction === 'inbound').length)}/><Fact icon={MessageCircle} label="Mensajes enviados" value={String(messagesRows.filter((row) => row.direction === 'outbound').length)}/></section>
    <section className="mt-10 rounded-3xl border border-[var(--line)] p-6"><h2 className="text-xl font-semibold">Conversaciones recientes</h2>{rows.length ? <ul className="mt-5 divide-y divide-[var(--line)]">{rows.slice(0,12).map((row) => <li key={row.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-medium">Cliente de WhatsApp</p><p className="mt-1 text-sm text-[var(--muted)]">Última actividad: {new Date(row.updated_at).toLocaleString('es-ES')}</p></div><span className="rounded-full bg-black/5 px-3 py-1 text-xs capitalize text-[var(--muted)] dark:bg-white/5">{row.status === 'open' ? 'Abierta' : row.status === 'waiting' ? 'Esperando' : row.status === 'escalated' ? 'Derivada' : 'Cerrada'}</span></li>)}</ul> : <p className="mt-5 text-sm leading-6 text-[var(--muted)]">Cuando un cliente escriba por WhatsApp, tu empleado atenderá la conversación aquí.</p>}</section>
  </main>;
}
function Fact({ icon: Icon, label, value }: { icon: typeof MessageCircle; label: string; value: string }) { return <article className="surface rounded-3xl p-5"><Icon size={18} className="text-[#789500]"/><p className="mt-6 text-3xl font-semibold tracking-[-.06em]">{value}</p><p className="mt-1 text-sm text-[var(--muted)]">{label}</p></article>; }
