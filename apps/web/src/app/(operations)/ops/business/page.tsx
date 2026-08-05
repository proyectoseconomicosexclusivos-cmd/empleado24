import Link from 'next/link';
import { OperationsService } from '@/services/operations-service';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Metadata = {
  action?: string;
  label?: string;
  zone?: string;
  scroll_depth?: number;
  duration_seconds?: number;
  ad?: string | null;
  device?: string | null;
  browser?: string | null;
  language?: string | null;
  country?: string | null;
  city?: string | null;
  gclid?: string | null;
};

type EventRow = {
  event_name: string;
  created_at: string;
  anonymous_id: string | null;
  visitor_id: string | null;
  session_id: string | null;
  user_id: string | null;
  company_id: string | null;
  path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  referrer: string | null;
  landing: string | null;
  metadata: Metadata | null;
};

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—';
}

function key(event: EventRow) {
  return event.visitor_id ?? event.anonymous_id ?? event.user_id ?? null;
}

function isPageVisit(event: EventRow) {
  return ['landing_view', 'page_view', 'pricing_view'].includes(event.event_name)
    && !['click', 'scroll_depth', 'page_leave'].includes(event.metadata?.action ?? '')
    && !event.path?.startsWith('/ops');
}

function since(events: EventRow[], from: Date) {
  return events.filter((event) => new Date(event.created_at) >= from);
}

function uniqueEvents(events: EventRow[]) {
  return new Set(events.map(key).filter(Boolean)).size;
}

function eventCount(events: EventRow[], name: string) {
  return events.filter((event) => event.event_name === name).length;
}

function conversion(value: number, base: number) {
  return base ? `${((value / base) * 100).toFixed(1)}%` : '—';
}

const planMonthlyCents: Record<string, number> = {
  one_employee: 9700,
  two_employees: 19700,
  five_employees: 39700,
  employee_email: 9700,
  employee_budget: 19700,
  employee_closer: 19700,
  employee_whatsapp: 9700,
  department_commercial: 29700,
};

export default async function BusinessPage() {
  await OperationsService.requireOwner();
  const admin = createAdminClient() as any;
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    { data: eventData },
    { data: companies },
    { data: subscriptionData },
    { data: invoices },
    { data: purchases },
    { data: guardian },
    { data: lauraLeadData },
    { data: lauraConversationData },
  ] = await Promise.all([
    admin
      .from('business_events')
      .select('event_name,created_at,anonymous_id,visitor_id,session_id,user_id,company_id,path,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,referrer,landing,metadata')
      .gte('created_at', last30d.toISOString())
      .order('created_at', { ascending: false })
      .limit(20_000),
    admin.from('companies').select('id,name,created_at').order('created_at', { ascending: false }).limit(500),
    admin.from('subscriptions').select('company_id,state,plan_key,trial_ends_at,updated_at').order('updated_at', { ascending: false }).limit(1_000),
    admin.from('invoices').select('company_id,amount_paid_cents,status,paid_at,created_at').eq('status', 'paid').order('created_at', { ascending: false }).limit(5_000),
    admin.from('prepaid_minute_purchases').select('company_id,amount_minor,status,created_at').eq('status', 'paid').order('created_at', { ascending: false }).limit(5_000),
    admin.from('release_guardian_runs').select('status,started_at,results').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('sales_assistant_leads').select('id,registered_user_id,registered_company_id,checkout_started_at,payment_completed_at,commercial_state,recommended_employees,roi_snapshot,objections,demo_opened_at,created_at').gte('created_at', last30d.toISOString()).order('created_at', { ascending: false }).limit(5_000),
    admin.from('sales_assistant_conversations').select('commercial_state,sector,company_size,primary_problem,objection,recommended_employees,roi_snapshot,answer_history,visit_count,conversation_started_at,conversation_completed_at,demo_opened_at,created_at,updated_at').gte('created_at', last30d.toISOString()).order('updated_at', { ascending: false }).limit(5_000),
  ]);

  const events = (eventData ?? []) as EventRow[];
  const subscriptions = (subscriptionData ?? []) as Array<{ company_id: string; state: string; plan_key: string | null; trial_ends_at: string | null }>;
  const visitEvents = events.filter(isPageVisit);
  const eventsToday = since(events, today);
  const eventsYesterday = events.filter((event) => {
    const stamp = new Date(event.created_at);
    return stamp >= yesterday && stamp < today;
  });
  const events7d = since(events, last7d);
  const visitorsToday = uniqueEvents(eventsToday.filter(isPageVisit));
  const visitorsYesterday = uniqueEvents(eventsYesterday.filter(isPageVisit));
  const visitors7d = uniqueEvents(events7d.filter(isPageVisit));
  const visitors30d = uniqueEvents(visitEvents);
  const registrations = events.filter((event) => event.event_name === 'signup_completed');
  const confirmed = events.filter((event) => event.event_name === 'email_confirmed');
  const logins = events.filter((event) => event.event_name === 'login');
  const checkouts = events.filter((event) => event.event_name === 'checkout_started');
  const trials = events.filter((event) => event.event_name === 'trial_started');
  const payments = events.filter((event) => event.event_name === 'payment_completed');
  const employees = events.filter((event) => event.event_name === 'employee_hired');
  const paymentCompanies = new Set(payments.map((event) => event.company_id).filter(Boolean));
  const paidCheckoutKeys = new Set(
    [...payments, ...employees].map((event) => event.company_id ?? event.user_id).filter(Boolean),
  );
  const checkoutAbandoned = checkouts.filter((event) => {
    const checkoutKey = event.company_id ?? event.user_id;
    return Boolean(checkoutKey) && !paidCheckoutKeys.has(checkoutKey) && new Date(event.created_at) < last24h;
  });
  const active = subscriptions.filter((subscription) => ['active', 'canceling'].includes(subscription.state));
  const trialing = subscriptions.filter((subscription) => subscription.state === 'trialing' && (!subscription.trial_ends_at || new Date(subscription.trial_ends_at) >= now));
  const expiredTrials = subscriptions.filter((subscription) => subscription.state === 'trialing' && subscription.trial_ends_at && new Date(subscription.trial_ends_at) < now);
  const mrr = active.reduce((sum, subscription) => sum + (planMonthlyCents[subscription.plan_key ?? ''] ?? 0), 0);
  const invoiceRows = (invoices ?? []) as Array<{ company_id: string | null; amount_paid_cents: number | null; paid_at: string | null; created_at: string }>;
  const purchaseRows = (purchases ?? []) as Array<{ company_id: string | null; amount_minor: number | null; created_at: string }>;
  const revenueThisMonth = [...invoiceRows, ...purchaseRows]
    .filter((row) => new Date(row.created_at) >= month)
    .reduce((sum, row) => sum + Number('amount_paid_cents' in row ? row.amount_paid_cents ?? 0 : row.amount_minor ?? 0), 0);
  const revenueToday = [...invoiceRows, ...purchaseRows]
    .filter((row) => new Date(row.created_at) >= today)
    .reduce((sum, row) => sum + Number('amount_paid_cents' in row ? row.amount_paid_cents ?? 0 : row.amount_minor ?? 0), 0);
  const paidByCompany = new Map<string, number>();
  for (const row of invoiceRows) if (row.company_id) paidByCompany.set(row.company_id, (paidByCompany.get(row.company_id) ?? 0) + Number(row.amount_paid_cents ?? 0));
  for (const row of purchaseRows) if (row.company_id) paidByCompany.set(row.company_id, (paidByCompany.get(row.company_id) ?? 0) + Number(row.amount_minor ?? 0));
  const observedLtv = active.length ? [...paidByCompany.values()].reduce((sum, value) => sum + value, 0) / active.length : null;
  const interactionEvents = events.filter((event) => event.metadata?.action === 'click');
  const interested = uniqueEvents(interactionEvents);
  const revenueAlerts = [
    ...(visitors24AndFewRegistrations(visitorsToday, eventCount(eventsToday, 'signup_completed'))
      ? ['Problema grave de conversión: más de 500 visitantes en 24 h y menos de 2 registros.']
      : []),
    ...(registrations.length >= 5 && payments.length === 0
      ? ['Problema en checkout: hay registros recientes sin pagos confirmados.']
      : []),
    ...(metaDiscrepancy(events) ? ['Revisar campañas o discrepancia de medición: clics Meta sin visitas identificadas.'] : []),
  ];
  const latestVisitor = [...events].find((event) => key(event));
  const latestVisitorKey = latestVisitor ? key(latestVisitor) : null;
  const journey = latestVisitorKey
    ? events.filter((event) => key(event) === latestVisitorKey).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)).slice(-20)
    : [];
  const firstJourneyEvent = journey[0] ?? null;
  const clicks = interactionEvents
    .reduce((result, event) => {
      const label = event.metadata?.label ?? event.metadata?.zone ?? 'Sin etiqueta';
      result.set(label, (result.get(label) ?? 0) + 1);
      return result;
    }, new Map<string, number>());
  const latestGuardian = guardian as { status?: string; started_at?: string } | null;
  const lauraLeads = (lauraLeadData ?? []) as Array<{ id: string; registered_user_id: string | null; registered_company_id: string | null; checkout_started_at: string | null; payment_completed_at: string | null; commercial_state: string; recommended_employees: string[] | null; roi_snapshot: Record<string, unknown> | null; objections: unknown[] | null; demo_opened_at: string | null; created_at: string }>;
  const lauraConversations = (lauraConversationData ?? []) as Array<{ commercial_state: string; sector: string | null; company_size: string | null; primary_problem: string | null; objection: string | null; recommended_employees: string[] | null; roi_snapshot: Record<string, unknown> | null; answer_history: Array<{ action?: string; field?: string; value?: string }> | null; visit_count: number; conversation_started_at: string | null; conversation_completed_at: string | null; demo_opened_at: string | null; created_at: string; updated_at: string }>;
  const lauraConversationsStarted = events.filter((event) => event.metadata?.action === 'laura_conversation_started').length;
  const lauraConversationsCompleted = events.filter((event) => event.metadata?.action === 'laura_conversation_completed').length;
  const lauraRegistrations = lauraLeads.filter((lead) => Boolean(lead.registered_user_id)).length;
  const lauraCheckouts = lauraLeads.filter((lead) => Boolean(lead.checkout_started_at)).length;
  const lauraSales = lauraLeads.filter((lead) => Boolean(lead.payment_completed_at)).length;
  const lauraDemos = lauraConversations.filter((conversation) => Boolean(conversation.demo_opened_at)).length;
  const lauraRoiShown = lauraConversations.filter((conversation) => Boolean(conversation.roi_snapshot && Object.keys(conversation.roi_snapshot).length)).length;
  const conversationSeconds = lauraConversations
    .filter((conversation) => conversation.conversation_started_at && conversation.conversation_completed_at)
    .map((conversation) => (+new Date(conversation.conversation_completed_at!) - +new Date(conversation.conversation_started_at!)) / 1000);
  const averageLauraConversation = conversationSeconds.length ? Math.round(conversationSeconds.reduce((sum, seconds) => sum + seconds, 0) / conversationSeconds.length) : null;
  const objections = lauraConversations.flatMap((conversation) => [
    ...(conversation.objection ? [conversation.objection] : []),
    ...((conversation.answer_history ?? []).filter((answer) => answer.action === 'objection').map((answer) => answer.value ?? '')),
  ]).filter(Boolean);
  const objectionCounts = countLabels(objections);
  const winningRecommendations = lauraLeads.filter((lead) => lead.payment_completed_at).flatMap((lead) => lead.recommended_employees ?? []);
  const mostSoldEmployee = topLabel(winningRecommendations);
  const mostSoldPack = topLabel(lauraLeads.filter((lead) => lead.payment_completed_at && (lead.recommended_employees?.length ?? 0) > 1).map((lead) => (lead.recommended_employees ?? []).join(' + ')));
  const responseOutcomes = lauraConversations.reduce((result, conversation) => {
    const answer = conversation.primary_problem ?? 'Sin respuesta';
    const entry = result.get(answer) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (conversation.conversation_completed_at) entry.completed += 1;
    result.set(answer, entry);
    return result;
  }, new Map<string, { total: number; completed: number }>());

  return (
    <main className="px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#ccff00]">Datos persistidos · {date(now.toISOString())}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">REVENUE</h1>
          <p className="mt-3 text-sm text-white/50">Ventas, conversión y recorridos reales de los últimos 30 días.</p>
        </div>
        <Link href="/ops" className="rounded-xl border border-white/10 px-4 py-2 text-sm">Centro operativo</Link>
      </header>

      {revenueAlerts.length > 0 && (
        <section className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 p-5 text-sm text-red-100">
          <h2 className="font-semibold">Atención comercial</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">{revenueAlerts.map((alert) => <li key={alert}>{alert}</li>)}</ul>
        </section>
      )}

      <section className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Visitantes · hoy" value={String(visitorsToday)} />
        <Metric label="Visitantes · ayer" value={String(visitorsYesterday)} />
        <Metric label="Visitantes · 7 días" value={String(visitors7d)} />
        <Metric label="Visitantes · 30 días" value={String(visitors30d)} />
        <Metric label="Usuarios registrados" value={String(registrations.length)} />
        <Metric label="Usuarios confirmados" value={String(confirmed.length)} />
        <Metric label="Trials iniciados" value={String(trials.length)} />
        <Metric label="Trials activos" value={String(trialing.length)} />
        <Metric label="Trials expirados" value={String(expiredTrials.length)} />
        <Metric label="Checkout iniciados" value={String(checkouts.length)} />
        <Metric label="Checkout abandonados (+24 h)" value={String(checkoutAbandoned.length)} />
        <Metric label="Pagos confirmados" value={String(payments.length)} />
        <Metric label="MRR activo" value={money(mrr)} />
        <Metric label="ARR proyectado" value={money(mrr * 12)} />
        <Metric label="LTV observado" value={observedLtv === null ? '—' : money(Math.round(observedLtv))} />
        <Metric label="CAC / ROI publicidad" value="—" />
        <Metric label="Ingresos cobrados · hoy" value={money(revenueToday)} />
        <Metric label="Ingresos cobrados · mes" value={money(revenueThisMonth)} />
        <Metric label="Clientes de pago" value={String(active.length)} />
        <Metric label="Primeros accesos" value={String(logins.length)} />
        <Metric label="Conversaciones con Laura" value={String(lauraConversationsStarted)} />
        <Metric label="Conversaciones completadas" value={String(lauraConversationsCompleted)} />
        <Metric label="Leads de Laura" value={String(lauraLeads.length)} />
        <Metric label="Registros desde Laura" value={String(lauraRegistrations)} />
        <Metric label="Checkout desde Laura" value={String(lauraCheckouts)} />
        <Metric label="Ventas desde Laura" value={String(lauraSales)} />
        <Metric label="Tiempo medio conversación Laura" value={averageLauraConversation === null ? '—' : `${averageLauraConversation} s`} />
        <Metric label="Objeciones recibidas" value={String(objections.length)} />
        <Metric label="ROI mostrado" value={String(lauraRoiShown)} />
        <Metric label="Demos abiertas desde Laura" value={String(lauraDemos)} />
        <Metric label="Ingresos generados por Laura" value={money(lauraLeads.filter((lead) => lead.payment_completed_at).reduce((sum, lead) => sum + (lead.registered_company_id ? paidByCompany.get(lead.registered_company_id) ?? 0 : 0), 0))} />
        <Metric label="Empleado más vendido por Laura" value={mostSoldEmployee ?? '—'} />
        <Metric label="Equipo más vendido por Laura" value={mostSoldPack ?? '—'} />
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <h2 className="text-lg font-semibold">Embudo de ingresos · 30 días</h2>
          <p className="mt-2 text-sm text-white/45">Cada paso se calcula con eventos persistentes e idempotentes.</p>
          <div className="mt-5 grid gap-3 text-sm text-white/70">
            <FunnelRow label="Landing" value={visitors30d} />
            <FunnelRow label="Empleado visto / interés" value={interested} previous={visitors30d} />
            <FunnelRow label="Registro" value={registrations.length} previous={interested} />
            <FunnelRow label="Confirmación email" value={confirmed.length} previous={registrations.length} />
            <FunnelRow label="Login" value={logins.length} previous={confirmed.length} />
            <FunnelRow label="Checkout" value={checkouts.length} previous={logins.length} />
            <FunnelRow label="Trial" value={trials.length} previous={checkouts.length} />
            <FunnelRow label="Pago" value={payments.length} previous={trials.length} />
            <FunnelRow label="Empleado activo" value={employees.length} previous={payments.length} />
          </div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <h2 className="text-lg font-semibold">Origen de la demanda</h2>
          <p className="mt-2 text-sm text-white/45">Atribución conservada desde la primera visita. Ciudad solo se muestra cuando el proxy aporta una cabecera fiable.</p>
          <div className="mt-5 grid gap-3 text-sm text-white/70">
            <Row label="Visitas con fbclid" value={String(visitEvents.filter((event) => Boolean(event.fbclid)).length)} />
            <Row label="Visitas con gclid" value={String(visitEvents.filter((event) => Boolean(event.metadata?.gclid)).length)} />
            <Row label="Campañas UTM" value={String(new Set(visitEvents.map((event) => event.utm_campaign).filter(Boolean)).size)} />
            <Row label="Dispositivos registrados" value={String(new Set(visitEvents.map((event) => event.metadata?.device).filter(Boolean)).size)} />
            <Row label="CAC / ROI" value="Sin gasto publicitario conectado" />
          </div>
        </article>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <h2 className="text-lg font-semibold">Recorrido más reciente</h2>
          {firstJourneyEvent ? (
            <>
              <p className="mt-2 text-sm text-white/45">Entrada: {firstJourneyEvent.landing ?? firstJourneyEvent.path ?? '—'} · campaña: {firstJourneyEvent.utm_campaign ?? 'directa / sin UTM'} · dispositivo: {firstJourneyEvent.metadata?.device ?? '—'}</p>
              <div className="mt-5 space-y-3 text-sm text-white/70">
                {journey.map((event) => <Row key={`${event.created_at}:${event.event_name}:${event.metadata?.action ?? ''}`} label={`${date(event.created_at)} · ${describeEvent(event)}`} value={event.path ?? '—'} />)}
              </div>
            </>
          ) : <p className="mt-5 text-sm text-white/45">Aún no hay recorridos persistidos.</p>}
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <h2 className="text-lg font-semibold">Interacción y lectura</h2>
          <p className="mt-2 text-sm text-white/45">Mapa agregado por zonas y profundidades; no se graban teclas, formularios ni vídeo.</p>
          <div className="mt-5 grid gap-3 text-sm text-white/70">
            {Array.from(clicks.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => <Row key={label} label={label.replaceAll('_', ' ')} value={`${count} clic${count === 1 ? '' : 's'}`} />)}
            {[25, 50, 75, 100].map((depth) => <Row key={depth} label={`${depth}% de lectura`} value={`${events.filter((event) => event.metadata?.action === 'scroll_depth' && event.metadata.scroll_depth === depth).length} sesiones`} />)}
          </div>
        </article>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <h2 className="text-lg font-semibold">Checkout y seguimiento</h2>
          <p className="mt-2 text-sm text-white/45">Se considera abandono cuando pasan 24 h sin pago ni activación para la misma empresa o cuenta.</p>
          <div className="mt-5 grid gap-3 text-sm text-white/70">
            <Row label="Abandonos detectados" value={String(checkoutAbandoned.length)} />
            <Row label="Empresas con pago" value={String(paymentCompanies.size)} />
            <Row label="Conversión checkout → pago" value={conversion(payments.length, checkouts.length)} />
          </div>
          <p className="mt-5 text-xs text-white/40">Las tareas internas para el Closer se crean por el Guardian cuando hay un empleado de WhatsApp activo. No se envían mensajes sin consentimiento del contacto.</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <h2 className="text-lg font-semibold">Estado de operación</h2>
          <div className="mt-5 grid gap-3 text-sm text-white/70">
            <Row label="Release Guardian" value={latestGuardian?.status === 'succeeded' ? 'Operativo' : latestGuardian?.status ?? 'Sin ejecución'} />
            <Row label="Última ejecución" value={date(latestGuardian?.started_at ?? null)} />
            <Row label="Eventos persistidos (30 d)" value={String(events.length)} />
            <Row label="Idempotencia" value="Clave única por evento" />
          </div>
        </article>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <h2 className="text-lg font-semibold">Aprendizaje de Laura</h2>
          <p className="mt-2 text-sm text-white/45">Respuestas y objeciones agregadas de conversaciones comerciales. No se muestran datos personales.</p>
          <div className="mt-5 grid gap-3 text-sm text-white/70">
            {Array.from(responseOutcomes.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 5).map(([answer, result]) => <Row key={answer} label={answer} value={`${result.completed}/${result.total} completan · ${conversion(result.completed, result.total)}`} />)}
            {!responseOutcomes.size && <p className="text-sm text-white/45">Aún no hay respuestas de Laura suficientes para aprender.</p>}
          </div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <h2 className="text-lg font-semibold">Objeciones y oportunidad</h2>
          <p className="mt-2 text-sm text-white/45">Sirve para ajustar el argumento comercial sin grabar conversaciones ni teclas.</p>
          <div className="mt-5 grid gap-3 text-sm text-white/70">
            {Array.from(objectionCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([objection, count]) => <Row key={objection} label={objection} value={`${count} vez${count === 1 ? '' : 'es'}`} />)}
            {!objectionCounts.size && <p className="text-sm text-white/45">Aún no hay objeciones registradas.</p>}
          </div>
        </article>
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/[.035] p-6">
        <h2 className="text-lg font-semibold">Empresas reales</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-white/35"><tr><th className="py-3">Empresa</th><th>Alta</th><th>Plan</th><th>Estado</th><th>Ingresos observados</th></tr></thead>
            <tbody>{(companies ?? []).slice(0, 25).map((company: { id: string; name: string; created_at: string }) => {
              const subscription = subscriptions.find((item) => item.company_id === company.id);
              return <tr key={company.id} className="border-t border-white/10"><td className="py-3">{company.name}</td><td>{date(company.created_at)}</td><td>{subscription?.plan_key ?? '—'}</td><td>{subscription?.state ?? 'sin suscripción'}</td><td>{money(paidByCompany.get(company.id) ?? 0)}</td></tr>;
            })}</tbody>
          </table>
          {!(companies ?? []).length && <p className="py-6 text-sm text-white/45">No hay empresas registradas.</p>}
        </div>
      </section>
    </main>
  );
}

function visitors24AndFewRegistrations(visitors: number, registrations: number) {
  return visitors > 500 && registrations < 2;
}

function metaDiscrepancy(events: EventRow[]) {
  const metaClicks = events.filter((event) => Boolean(event.fbclid));
  const visits = metaClicks.filter(isPageVisit);
  return metaClicks.length >= 20 && visits.length / metaClicks.length < 0.5;
}

function describeEvent(event: EventRow) {
  if (event.metadata?.action === 'click') return `pulsa ${event.metadata.label ?? 'un botón'}`;
  if (event.metadata?.action === 'scroll_depth') return `lee hasta ${event.metadata.scroll_depth ?? 0}%`;
  if (event.metadata?.action === 'page_leave') return `permanece ${event.metadata.duration_seconds ?? 0} s`;
  return event.event_name.replaceAll('_', ' ');
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-2xl font-semibold tracking-[-.04em]">{value}</p><p className="mt-1 text-xs text-white/40">{label}</p></article>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-2"><span>{label}</span><strong className="text-right text-[#ddff57]">{value}</strong></div>;
}

function FunnelRow({ label, value, previous }: { label: string; value: number; previous?: number }) {
  return <div className="flex items-center justify-between border-b border-white/8 pb-2"><span>{label}</span><strong className="text-[#ddff57]">{value}{previous === undefined ? '' : ` · ${conversion(value, previous)}`}</strong></div>;
}

function countLabels(labels: string[]) {
  return labels.reduce((result, label) => {
    const normalized = label.trim();
    if (normalized) result.set(normalized, (result.get(normalized) ?? 0) + 1);
    return result;
  }, new Map<string, number>());
}

function topLabel(labels: string[]) {
  const counts = countLabels(labels);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
