import Link from 'next/link';
import { OperationsService } from '@/services/operations-service';
import { createAdminClient } from '@/lib/supabase/admin';

function stamp(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}

export default async function AuditPage() {
  await OperationsService.requireOwner();
  const admin = createAdminClient() as any;
  const now = new Date().toISOString();
  const [{ data: events }, { data: webhooks }, { data: subscriptions }, { data: invoices }, { data: users }, { data: members }, { data: companies }] = await Promise.all([
    admin.from('business_events').select('idempotency_key,event_name,created_at').order('created_at', { ascending: false }).limit(5000),
    admin.from('webhook_delivery_queue').select('id,status,attempts,updated_at').in('status', ['pending', 'processing', 'retrying', 'dead']).order('updated_at', { ascending: false }).limit(100),
    admin.from('subscriptions').select('company_id,state,trial_ends_at,updated_at').order('updated_at', { ascending: false }).limit(1000),
    admin.from('invoices').select('id,company_id,status,amount_due_cents,due_at').in('status', ['open', 'uncollectible', 'past_due']).limit(1000),
    admin.from('users').select('id').limit(5000),
    admin.from('members').select('user_id,company_id').limit(5000),
    admin.from('companies').select('id').limit(5000),
  ]);
  const eventRows = (events ?? []) as Array<{ idempotency_key: string | null; event_name: string; created_at: string }>;
  const keys = new Map<string, number>();
  eventRows.forEach((event) => event.idempotency_key && keys.set(event.idempotency_key, (keys.get(event.idempotency_key) ?? 0) + 1));
  const duplicatedEvents = [...keys.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
  const subscriptionRows = (subscriptions ?? []) as Array<{ company_id: string; state: string; trial_ends_at: string | null; updated_at: string }>;
  const expiredTrials = subscriptionRows.filter((subscription) => subscription.state === 'trialing' && subscription.trial_ends_at && subscription.trial_ends_at < now);
  const memberUserIds = new Set((members ?? []).map((member: { user_id: string }) => member.user_id));
  const memberCompanyIds = new Set((members ?? []).map((member: { company_id: string }) => member.company_id));
  const usersWithoutCompany = (users ?? []).filter((user: { id: string }) => !memberUserIds.has(user.id)).length;
  const companiesWithoutUser = (companies ?? []).filter((company: { id: string }) => !memberCompanyIds.has(company.id)).length;
  const health = duplicatedEvents || (webhooks ?? []).some((webhook: { status: string }) => webhook.status === 'dead') || expiredTrials.length ? 'Atención' : 'Todo correcto';
  return <main className="px-5 py-8 md:px-8 md:py-10">
    <header className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#ccff00]">Producción · {stamp(now)}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">Auditoría comercial</h1><p className="mt-3 text-sm text-white/50">Integridad de eventos, cobros, suscripciones y webhooks.</p></div><Link href="/ops/business" className="rounded-xl border border-white/10 px-4 py-2 text-sm">CEO Dashboard</Link></header>
    <section className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Estado" value={health} /><Card label="Duplicados de eventos" value={String(duplicatedEvents)} /><Card label="Webhooks pendientes o fallidos" value={String((webhooks ?? []).length)} /><Card label="Trials vencidos sin sincronizar" value={String(expiredTrials.length)} /><Card label="Usuarios sin empresa" value={String(usersWithoutCompany)} /><Card label="Empresas sin usuario" value={String(companiesWithoutUser)} /><Card label="Facturas pendientes" value={String((invoices ?? []).length)} /><Card label="Eventos analizados" value={String(eventRows.length)} /></section>
    <section className="mt-10 grid gap-4 lg:grid-cols-2"><Issue title="Suscripciones desincronizadas" items={expiredTrials.map((item) => `Empresa ${item.company_id} · trial vencido ${stamp(item.trial_ends_at)}`)} empty="No hay trials vencidos en estado trialing." /><Issue title="Webhooks pendientes" items={(webhooks ?? []).map((item: { id: string; status: string; attempts: number; updated_at: string }) => `${item.id} · ${item.status} · intento ${item.attempts} · ${stamp(item.updated_at)}`)} empty="No hay webhooks pendientes, reintentando o muertos." /><Issue title="Facturas pendientes" items={(invoices ?? []).map((item: { company_id: string; status: string; amount_due_cents: number; due_at: string | null }) => `Empresa ${item.company_id} · ${item.status} · ${(item.amount_due_cents / 100).toFixed(2)} € · vence ${stamp(item.due_at)}`)} empty="No hay facturas abiertas o vencidas." /></section>
  </main>;
}

function Card({ label, value }: { label: string; value: string }) { return <article className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-2xl font-semibold tracking-[-.04em]">{value}</p><p className="mt-1 text-xs text-white/40">{label}</p></article>; }
function Issue({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-lg font-semibold">{title}</h2>{items.length ? <ul className="mt-4 grid gap-2 text-xs text-amber-100/80">{items.slice(0, 50).map((item) => <li key={item} className="rounded-lg bg-amber-300/5 p-3">{item}</li>)}</ul> : <p className="mt-4 text-sm text-white/45">{empty}</p>}</article>; }
