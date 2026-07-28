import Link from 'next/link';
import { OperationsService } from '@/services/operations-service';
import { createAdminClient } from '@/lib/supabase/admin';

function money(cents: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100); }
function date(value: string | null) { return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }

export default async function BusinessPage() {
  await OperationsService.requireOwner();
  const admin = createAdminClient() as any;
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [{ data: events }, { data: companies }, { data: subscriptions }, { data: invoices }, { data: purchases }, { data: calls }, { data: usage }, { data: blocked }, { data: webhooks }, { data: guardian }, { data: opportunities }, { data: whatsappConversations }, { data: whatsappMessages }] = await Promise.all([
    admin.from('business_events').select('event_name,created_at,anonymous_id,path').gte('created_at', last30d.toISOString()),
    admin.from('companies').select('id,name,created_at,timezone').order('created_at', { ascending: false }).limit(500),
    admin.from('subscriptions').select('company_id,state,plan_key,updated_at').order('updated_at', { ascending: false }).limit(500),
    admin.from('invoices').select('company_id,amount_paid_cents,status,paid_at,created_at').eq('status', 'paid').gte('created_at', month.toISOString()),
    admin.from('prepaid_minute_purchases').select('company_id,pack_key,amount_minor,minutes_added,created_at').eq('status', 'paid').gte('created_at', month.toISOString()),
    admin.from('voice_calls').select('company_id,duration_ms,status,created_at').gte('created_at', month.toISOString()),
    admin.from('usage_events').select('company_id,consumed_seconds,total_cost_micros,created_at').gte('created_at', month.toISOString()),
    admin.from('usage_limit_events').select('company_id,event_type,created_at').eq('event_type', 'blocked').gte('created_at', month.toISOString()),
    admin.from('integration_webhook_events').select('id,status,received_at').in('status', ['failed', 'dead', 'retrying']).gte('received_at', last24h.toISOString()),
    admin.from('release_guardian_runs').select('status,started_at,completed_at,results').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('sales_opportunities').select('stage,heat,value_cents,created_at').gte('created_at', month.toISOString()),
    admin.from('whatsapp_conversations').select('status,first_response_at,last_customer_message_at,created_at').gte('created_at', month.toISOString()),
    admin.from('whatsapp_messages').select('direction,created_at').gte('created_at', month.toISOString()),
  ]);
  const rows = (companies ?? []) as Array<{ id: string; name: string; created_at: string }>;
  const subs = (subscriptions ?? []) as Array<{ company_id: string; state: string; plan_key: string | null }>;
  const ev = (events ?? []) as Array<{ event_name: string; created_at: string; anonymous_id: string | null; path: string | null }>;
  const paid = (invoices ?? []) as Array<{ amount_paid_cents: number }>;
  const packs = (purchases ?? []) as Array<{ amount_minor: number }>;
  const callsRows = (calls ?? []) as Array<{ duration_ms: number | null }>;
  const usageRows = (usage ?? []) as Array<{ consumed_seconds: number | null }>;
  const todayCount = (items: Array<{ created_at: string }>) => items.filter((item) => new Date(item.created_at) >= today).length;
  const active = subs.filter((s) => ['active', 'trialing', 'canceling'].includes(s.state));
  const trialing = subs.filter((s) => s.state === 'trialing');
  const mrr = active.reduce((sum, s) => sum + ({ one_employee: 9700, two_employees: 19700, five_employees: 39700, employee_email: 9700, employee_closer: 19700, employee_whatsapp: 9700 }[s.plan_key ?? ''] ?? 0), 0);
  const revenue = paid.reduce((sum, row) => sum + Number(row.amount_paid_cents ?? 0), 0) + packs.reduce((sum, row) => sum + Number(row.amount_minor ?? 0), 0);
  const pageViews = ev.filter((e) => e.event_name === 'page_view');
  const visitors = (since: Date) => new Set(pageViews.filter((e) => new Date(e.created_at) >= since).map((e) => e.anonymous_id ?? `${e.created_at.slice(0, 16)}:${e.path ?? ''}`)).size;
  const pageViews24 = pageViews.filter((e) => new Date(e.created_at) >= last24h).length;
  const registrations = ev.filter((e) => e.event_name === 'registration_started');
  const latestGuardian = guardian as { status?: string; started_at?: string; results?: { warnings?: unknown[] } } | null;
  const salesRows = (opportunities ?? []) as Array<{ stage: string; heat: string; value_cents: number }>;
  const openSales = salesRows.filter((row) => !['won', 'lost'].includes(row.stage));
  const wonSales = salesRows.filter((row) => row.stage === 'won');
  const potentialRevenue = openSales.reduce((sum, row) => sum + Number(row.value_cents ?? 0), 0);
  const wonRevenue = wonSales.reduce((sum, row) => sum + Number(row.value_cents ?? 0), 0);
  const whatsappRows = (whatsappConversations ?? []) as Array<{ status: string; first_response_at: string | null; last_customer_message_at: string | null }>;
  const whatsappMessageRows = (whatsappMessages ?? []) as Array<{ direction: string }>;
  const responseMinutes = whatsappRows.map((row) => row.first_response_at && row.last_customer_message_at ? (new Date(row.first_response_at).getTime() - new Date(row.last_customer_message_at).getTime()) / 60000 : null).filter((value): value is number => value !== null && value >= 0);

  return <main className="px-5 py-8 md:px-8 md:py-10">
    <header className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#ccff00]">Datos reales · {date(now.toISOString())}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">CEO Dashboard</h1><p className="mt-3 text-sm text-white/50">Cómo va el negocio: clientes, ingresos, conversión y actividad.</p></div><Link href="/ops" className="rounded-xl border border-white/10 px-4 py-2 text-sm">Centro operativo</Link></header>
    <section className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Visitas (páginas) últimas 24 h" value={String(pageViews24)} /><Metric label="Visitantes únicos últimas 24 h" value={String(visitors(last24h))} /><Metric label="Visitantes únicos últimos 7 días" value={String(visitors(last7d))} /><Metric label="Visitantes únicos últimos 30 días" value={String(visitors(last30d))} />
      <Metric label="Registros hoy" value={String(registrations.filter((event) => new Date(event.created_at) >= today).length)} /><Metric label="Empresas creadas" value={String(rows.length)} /><Metric label="Trials activos" value={String(trialing.length)} /><Metric label="Clientes de pago" value={String(active.filter((s) => s.state === 'active').length)} />
      <Metric label="MRR actual" value={money(mrr)} /><Metric label="Ingresos este mes" value={money(revenue)} /><Metric label="Compras de packs" value={String(packs.length)} /><Metric label="Conversión visita → registro" value={`${pageViews.length ? ((registrations.length / pageViews.length) * 100).toFixed(1) : '0.0'}%`} />
      <Metric label="Llamadas este mes" value={String(callsRows.length)} /><Metric label="Minutos consumidos" value={String(Math.round(usageRows.reduce((sum, row) => sum + Number(row.consumed_seconds ?? 0), 0) / 60))} /><Metric label="Clientes bloqueados" value={String((blocked ?? []).length)} /><Metric label="Webhooks fallidos 24 h" value={String((webhooks ?? []).length)} />
      <Metric label="Nuevos leads este mes" value={String(salesRows.length)} /><Metric label="Clientes muy interesados" value={String(salesRows.filter((row) => row.heat === 'very_hot').length)} /><Metric label="Ingresos potenciales" value={money(potentialRevenue)} /><Metric label="Ventas cerradas" value={money(wonRevenue)} />
      <Metric label="Conversaciones WhatsApp" value={String(whatsappRows.length)} /><Metric label="Mensajes WhatsApp recibidos" value={String(whatsappMessageRows.filter((row) => row.direction === 'inbound').length)} /><Metric label="Conversaciones abiertas" value={String(whatsappRows.filter((row) => ['open','waiting'].includes(row.status)).length)} /><Metric label="Respuesta media WhatsApp" value={responseMinutes.length ? `${Math.max(1, Math.round(responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length))} min` : '—'} />
    </section>
    <section className="mt-10 grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-lg font-semibold">Embudo real</h2><div className="mt-5 grid gap-3 text-sm text-white/70"><Row label="Visitas (páginas) últimas 24 h" value={String(pageViews24)} /><Row label="Visitantes únicos últimas 24 h" value={String(visitors(last24h))} /><Row label="Registros capturados (30 días)" value={String(registrations.length)} /><Row label="Empresas creadas" value={String(rows.length)} /><Row label="Trials activos" value={String(trialing.length)} /><Row label="Pagos" value={String(paid.length)} /><Row label="Primeras llamadas" value={String(callsRows.length)} /></div></article><article className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-lg font-semibold">Estado Guardian</h2><p className="mt-5 text-3xl font-semibold text-[#ddff57]">{latestGuardian?.status === 'succeeded' ? 'Operativo' : latestGuardian?.status ?? 'Sin ejecución'}</p><p className="mt-2 text-sm text-white/45">Última ejecución: {date(latestGuardian?.started_at ?? null)}</p><p className="mt-3 text-xs text-amber-200/70">Los avisos de Brevo, Redis y backups son warnings operativos.</p></article></section>
    <section className="mt-10 rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-lg font-semibold">Clientes reales encontrados</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-white/35"><tr><th className="py-3">Empresa</th><th>Alta</th><th>Plan</th><th>Estado</th></tr></thead><tbody>{rows.slice(0, 25).map((company) => { const sub = subs.find((item) => item.company_id === company.id); return <tr key={company.id} className="border-t border-white/10"><td className="py-3">{company.name}</td><td>{date(company.created_at)}</td><td>{sub?.plan_key ?? '—'}</td><td>{sub?.state ?? 'sin suscripción'}</td></tr>; })}</tbody></table>{!rows.length && <p className="py-6 text-sm text-white/45">No hay empresas registradas.</p>}</div></section>
    <section className="mt-10 rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-lg font-semibold">Embudo comercial</h2><div className="mt-5 grid gap-3 text-sm text-white/70 sm:grid-cols-2 lg:grid-cols-4"><Row label="Nuevos" value={String(salesRows.filter((row) => row.stage === 'new').length)} /><Row label="Contactados" value={String(salesRows.filter((row) => row.stage === 'contacted').length)} /><Row label="Interesados" value={String(salesRows.filter((row) => ['interested', 'quote_sent', 'negotiation'].includes(row.stage)).length)} /><Row label="Conversión" value={`${salesRows.length ? ((wonSales.length / salesRows.length) * 100).toFixed(1) : '0.0'}%`} /></div></section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-2xl font-semibold tracking-[-.04em]">{value}</p><p className="mt-1 text-xs text-white/40">{label}</p></article>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-white/8 pb-2"><span>{label}</span><strong className="text-[#ddff57]">{value}</strong></div>; }
