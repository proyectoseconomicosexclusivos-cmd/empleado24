import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { inspectCallForSales } from '@/lib/call-sales-insights';

type EventMetadata = { action?: string; label?: string; device?: string; scroll_depth?: number; plan_key?: string; [key: string]: unknown };
type Event = { event_name: string; created_at: string; anonymous_id: string | null; visitor_id: string | null; user_id: string | null; company_id: string | null; path: string | null; utm_source: string | null; utm_campaign: string | null; referrer: string | null; landing: string | null; metadata: EventMetadata | null };
type Conversation = { sector: string | null; objection: string | null; created_at: string };
type Subscription = { state: string; plan_key: string | null };
type Lead = { id: string; name: string | null; company_name: string | null; anonymous_id: string | null; registered_user_id: string | null; registered_company_id: string | null; checkout_started_at: string | null; payment_completed_at: string | null; commercial_state: string | null; roi_snapshot: unknown; objections: unknown; demo_opened_at: string | null; created_at: string; lead_source: string | null };
type VoiceCall = { status: string | null; started_at: string | null; ended_at: string | null; duration_ms: number | null; transcript: string | null; summary: string | null; error_code: string | null; latency: Record<string, unknown> | null; created_at: string };

const prices: Record<string, number> = { one_employee: 9700, employee_email: 9700, employee_whatsapp: 9700, employee_budget: 19700, employee_closer: 19700, department_commercial: 29700, two_employees: 19700, five_employees: 39700 };
const visitNames = new Set(['landing_view', 'page_view', 'pricing_view']);
const day = 86_400_000;

function identity(event: Event) { return event.visitor_id ?? event.anonymous_id ?? event.user_id ?? null; }
function unique(events: Event[]) { return new Set(events.map(identity).filter(Boolean)).size; }
function rate(value: number, base: number) { return base ? value / base : null; }
function percent(value: number | null) { return value === null ? 'Sin muestra' : `${(value * 100).toFixed(1)}%`; }
function formatMoney(cents: number) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100); }
function labelCounts(values: Array<string | null | undefined>) { return [...values.filter((value): value is string => Boolean(value)).reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]); }
function todayStart(now: Date) { const value = new Date(now); value.setHours(0, 0, 0, 0); return value; }
function commercialObjection(value: string) { const lower = value.toLowerCase(); if (/car|precio|cost/.test(lower)) return 'Precio'; if (/tiempo|luego|pens/.test(lower)) return 'Momento'; if (/conf[ií]|segur/.test(lower)) return 'Confianza'; if (/demo|probar/.test(lower)) return 'Quiere demostración'; return 'Otra duda'; }
function bounded(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function scorePart(observed: number | null, target: number, weight: number) { return observed === null ? 0 : Math.min(weight, (observed / target) * weight); }
function envNumber(name: string, fallback: number) { const value = Number(process.env[name]); return Number.isFinite(value) && value > 0 ? value : fallback; }
function sourceFor(event: Event) {
  const source = (event.utm_source ?? '').toLowerCase();
  if (/meta|facebook|instagram|fb/.test(source)) return 'Meta';
  if (/google|adwords/.test(source) || event.referrer?.includes('google.')) return 'Google';
  if (/email|newsletter/.test(source)) return 'Email';
  if (/refer|partner|affiliate/.test(source)) return 'Referidos';
  if (source) return 'Orgánico';
  return event.referrer ? 'Referidos' : 'Directo';
}
function stageRecommendation(stage: string) {
  const copy: Record<string, string> = {
    Landing: 'Haz que la primera propuesta y el CTA expliquen el valor antes de pedir un registro.',
    Laura: 'Ajusta el primer mensaje de Laura para llevar la conversación a una recomendación concreta.',
    Registro: 'Reduce dudas antes del registro y mide si la propuesta de prueba es suficientemente clara.',
    Checkout: 'Revisa las objeciones previas al checkout y la explicación de la prueba; no modifiques el precio sin evidencia.',
    Pago: 'Revisa los intentos de pago y el contexto mostrado justo antes de finalizar el checkout.',
    Retención: 'Prioriza la activación de las empresas ya activas antes de ampliar adquisición.',
  };
  return copy[stage] ?? 'Mantén la medición activa hasta reunir una muestra suficiente para priorizar una acción.';
}

export type CeoBrief = {
  generatedAt: string;
  today: { visitors: number; registrations: number; checkouts: number; payments: number; lauraConversations: number; conversion: number | null };
  sevenDays: { visitors: number; registrations: number; checkouts: number; payments: number; lauraConversations: number; conversion: number | null };
  mrrCents: number;
  funnels: Array<{ label: string; value: number; conversion: number | null }>;
  alerts: string[];
  recommendations: string[];
  ranking: Array<{ label: string; value: string }>;
  prediction: string;
  weekly: { best: string; worst: string; changes: string; actions: string[] };
  reportEnabled: boolean;
  growth: { score: number; coverage: number; bottleneck: { label: string; rate: number | null; explanation: string; recommendation: string; estimatedMonthlyGainCents: number }; moneyLost: { targetConversion: number; averageMrrCents: number; todayCents: number; monthCents: number; explanation: string }; simulator: { onePointCents: number; tenCustomersCents: number } };
  campaigns: Array<{ source: string; visitors: number; registrations: number; sales: number; mrrCents: number | null; cost: null }>;
  hotLeads: Array<{ label: string; score: number; state: string; reason: string }>;
  investor: { mrrCents: number; arrCents: number; cac: string; ltv: string; churn: string; conversion: string; objectives: string[] };
  callSales: { total: number; completed: number; under30: number; over60: number; over120: number; retellLeads: number; latest: { durationSeconds: number; result: string; reason: string; summary: string; opportunityLost: string; recommendation: string; firstAgentMessage: string | null; userResponded: boolean; latency: string } | null; alerts: string[] };
};

export async function buildCeoBrief(now = new Date()): Promise<CeoBrief> {
  const admin = createAdminClient() as any;
  const from = new Date(now.getTime() - 30 * day).toISOString();
  const [eventsResult, conversationsResult, subscriptionsResult, leadsResult, callsResult] = await Promise.all([
    admin.from('business_events').select('event_name,created_at,anonymous_id,visitor_id,user_id,company_id,path,utm_source,utm_campaign,referrer,landing,metadata').gte('created_at', from).order('created_at', { ascending: false }).limit(20_000),
    admin.from('sales_assistant_conversations').select('sector,objection,created_at').gte('created_at', from).limit(5_000),
    admin.from('subscriptions').select('state,plan_key').limit(5_000),
    admin.from('sales_assistant_leads').select('id,name,company_name,anonymous_id,registered_user_id,registered_company_id,checkout_started_at,payment_completed_at,commercial_state,roi_snapshot,objections,demo_opened_at,created_at,lead_source').gte('created_at', from).limit(5_000),
    admin.from('voice_calls').select('status,started_at,ended_at,duration_ms,transcript,summary,error_code,latency,created_at').gte('created_at', from).order('created_at', { ascending: false }).limit(5_000),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  const events = (eventsResult.data ?? []) as Event[];
  const conversations = (conversationsResult.data ?? []) as Conversation[];
  const subscriptions = (subscriptionsResult.data ?? []) as Subscription[];
  const leads = (leadsResult.data ?? []) as Lead[];
  const calls = (callsResult.data ?? []) as VoiceCall[];
  const today = todayStart(now);
  const last7 = new Date(now.getTime() - 7 * day);
  const previous7 = new Date(now.getTime() - 14 * day);
  const inRange = (start: Date, end = now) => events.filter((event) => { const value = new Date(event.created_at); return value >= start && value < end; });
  const visits = (rows: Event[]) => unique(rows.filter((event) => visitNames.has(event.event_name) && event.metadata?.action !== 'scroll_depth' && event.metadata?.action !== 'click' && !event.path?.startsWith('/ops')));
  const count = (rows: Event[], name: string) => rows.filter((event) => event.event_name === name).length;
  const summary = (rows: Event[]) => ({ visitors: visits(rows), registrations: count(rows, 'signup_completed'), checkouts: count(rows, 'checkout_started'), payments: count(rows, 'payment_completed'), lauraConversations: rows.filter((event) => event.metadata?.action === 'laura_conversation_started').length });
  const todayRaw = summary(inRange(today));
  const weekRaw = summary(inRange(last7));
  const previousRaw = summary(inRange(previous7, last7));
  const dataToday = { ...todayRaw, conversion: rate(todayRaw.registrations, todayRaw.visitors) };
  const dataSeven = { ...weekRaw, conversion: rate(weekRaw.registrations, weekRaw.visitors) };
  const active = subscriptions.filter((subscription) => ['active', 'canceling'].includes(subscription.state));
  const canceled = subscriptions.filter((subscription) => ['canceled', 'cancelled', 'past_due'].includes(subscription.state));
  const mrrCents = active.reduce((sum, subscription) => sum + (prices[subscription.plan_key ?? ''] ?? 0), 0);
  const hiredCount = count(inRange(last7), 'employee_hired');
  const funnels = [
    { label: 'Visitas', value: dataSeven.visitors, conversion: null },
    { label: 'Conversaciones con Laura', value: dataSeven.lauraConversations, conversion: rate(dataSeven.lauraConversations, dataSeven.visitors) },
    { label: 'Registros', value: dataSeven.registrations, conversion: rate(dataSeven.registrations, dataSeven.visitors) },
    { label: 'Checkout', value: dataSeven.checkouts, conversion: rate(dataSeven.checkouts, dataSeven.registrations) },
    { label: 'Pagos', value: dataSeven.payments, conversion: rate(dataSeven.payments, dataSeven.checkouts) },
  ];
  const objections = labelCounts(conversations.map((item) => item.objection ? commercialObjection(item.objection) : null));
  const sectors = labelCounts(conversations.map((item) => item.sector));
  const campaigns = labelCounts(events.filter((event) => visitNames.has(event.event_name)).map((event) => event.utm_campaign));
  const devices = labelCounts(events.filter((event) => visitNames.has(event.event_name)).map((event) => event.metadata?.device));
  const employeeClicks = labelCounts(events.filter((event) => event.metadata?.action === 'click' && /(employee|equipo|laura|closer|whatsapp|presupuesto)/i.test(event.metadata?.label ?? '')).map((event) => event.metadata?.label));
  const hired = labelCounts(events.filter((event) => event.event_name === 'employee_hired').map((event) => String(event.metadata?.plan_key ?? 'Empleado')));
  const stages = [
    { label: 'Landing', value: rate(dataSeven.lauraConversations, dataSeven.visitors), base: dataSeven.visitors },
    { label: 'Laura', value: rate(dataSeven.registrations, dataSeven.lauraConversations), base: dataSeven.lauraConversations },
    { label: 'Registro', value: rate(dataSeven.checkouts, dataSeven.registrations), base: dataSeven.registrations },
    { label: 'Checkout', value: rate(dataSeven.payments, dataSeven.checkouts), base: dataSeven.checkouts },
    { label: 'Pago', value: rate(hiredCount, dataSeven.payments), base: dataSeven.payments },
    { label: 'Retención', value: rate(active.length, active.length + canceled.length), base: active.length + canceled.length },
  ].filter((stage) => stage.base > 0);
  const weakest = stages.sort((a, b) => (a.value ?? 1) - (b.value ?? 1))[0] ?? { label: 'Landing', value: null, base: 0 };
  const targetConversion = envNumber('GROWTH_TARGET_CONVERSION', 0.03);
  const averageMrrCents = Math.round(envNumber('GROWTH_AVERAGE_CUSTOMER_MRR_CENTS', active.length ? mrrCents / active.length : 9700));
  const expectedDailyCustomers = dataToday.visitors * targetConversion;
  const moneyLostToday = Math.max(0, expectedDailyCustomers - dataToday.payments) * averageMrrCents;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const moneyLostMonth = Math.round(moneyLostToday * daysInMonth);
  const potentialOnePointCustomers = Math.max(0, dataSeven.visitors * 0.01 * (30 / 7));
  const onePointCents = Math.round(potentialOnePointCustomers * averageMrrCents);
  const growthParts = [
    scorePart(dataSeven.visitors ? Math.min(1, dataSeven.visitors / 100) : null, 1, 10),
    scorePart(dataSeven.conversion, targetConversion, 25),
    scorePart(rate(dataSeven.lauraConversations, dataSeven.visitors), 0.15, 10),
    scorePart(rate(dataSeven.checkouts, dataSeven.registrations), 0.30, 15),
    scorePart(rate(dataSeven.payments, dataSeven.checkouts), 0.60, 20),
    scorePart(rate(active.length, active.length + canceled.length), 0.90, 10),
    scorePart(rate(hiredCount, dataSeven.payments), 1, 10),
  ];
  const coverage = [dataSeven.visitors > 0, dataSeven.registrations > 0, dataSeven.lauraConversations > 0, dataSeven.checkouts > 0, dataSeven.payments > 0, active.length + canceled.length > 0, dataSeven.payments > 0].filter(Boolean).length;
  const growthScore = bounded(growthParts.reduce((sum, item) => sum + item, 0));
  const bottleneck = { label: weakest.label, rate: weakest.value, explanation: weakest.base ? `${weakest.label} retiene ${percent(weakest.value)} de la etapa anterior con ${weakest.base} casos medidos.` : 'Aún no hay muestra suficiente para localizar un cuello de botella.', recommendation: stageRecommendation(weakest.label), estimatedMonthlyGainCents: onePointCents };
  const alerts: string[] = [];
  if (dataToday.visitors >= 50 && (dataToday.conversion ?? 0) < 0.02) alerts.push(`Conversión baja hoy: ${dataToday.visitors} visitas y ${dataToday.registrations} registros (${percent(dataToday.conversion)}).`);
  if (dataSeven.registrations >= 3 && dataSeven.checkouts === 0) alerts.push('Hay registros esta semana, pero ninguno ha iniciado checkout.');
  if (dataSeven.checkouts >= 2 && dataSeven.payments === 0) alerts.push('Hay checkouts iniciados sin pagos confirmados durante los últimos 7 días.');
  if (objections[0] && objections[0][1] >= 3) alerts.push(`La objeción más repetida es “${objections[0][0]}” (${objections[0][1]} conversaciones).`);
  const recommendations = [bottleneck.recommendation];
  const remaining = Math.max(0, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
  const projected = Math.round((dataSeven.registrations / 7) * (remaining + 1));
  const ranking = [
    { label: 'Empleado más visto', value: employeeClicks[0] ? `${employeeClicks[0][0]} · ${employeeClicks[0][1]} clics` : 'Sin muestra suficiente' },
    { label: 'Empleado más contratado', value: hired[0] ? `${hired[0][0]} · ${hired[0][1]} altas` : 'Sin contrataciones medidas' },
    { label: 'Sector con más interés', value: sectors[0] ? `${sectors[0][0]} · ${sectors[0][1]} conversaciones` : 'Sin sectores medidos' },
    { label: 'Campaña con más visitas', value: campaigns[0] ? `${campaigns[0][0]} · ${campaigns[0][1]} visitas` : 'Sin campañas atribuidas' },
    { label: 'Dispositivo predominante', value: devices[0] ? `${devices[0][0]} · ${devices[0][1]} visitas` : 'Sin dispositivo medido' },
  ];
  const sourceEvents = events.filter((event) => !event.path?.startsWith('/ops'));
  const campaignRows = ['Meta', 'Google', 'Directo', 'Referidos', 'Email', 'Orgánico'].map((source) => {
    const rows = sourceEvents.filter((event) => sourceFor(event) === source);
    const registrations = count(rows, 'signup_completed');
    const sales = count(rows, 'payment_completed');
    const paymentMrr = rows.filter((event) => event.event_name === 'payment_completed').reduce((sum, event) => sum + (prices[String(event.metadata?.plan_key ?? '')] ?? 0), 0);
    return { source, visitors: visits(rows), registrations, sales, mrrCents: paymentMrr || null, cost: null };
  });
  const hotLeads = leads.map((lead) => {
    const matching = sourceEvents.filter((event) => event.anonymous_id === lead.anonymous_id || event.user_id === lead.registered_user_id || event.company_id === lead.registered_company_id);
    const visitCount = visits(matching);
    const conversationCount = matching.filter((event) => event.metadata?.action === 'laura_conversation_started').length;
    const scrollCount = matching.filter((event) => event.metadata?.action === 'scroll_depth' || Number(event.metadata?.scroll_depth ?? 0) >= 75).length;
    const score = Math.min(100, visitCount * 8 + conversationCount * 12 + scrollCount * 4 + (lead.roi_snapshot ? 12 : 0) + (lead.demo_opened_at ? 16 : 0) + (lead.registered_user_id ? 18 : 0) + (lead.checkout_started_at ? 25 : 0) - (lead.payment_completed_at ? 100 : 0));
    const reasons = [lead.checkout_started_at ? 'checkout iniciado' : null, lead.registered_user_id ? 'registro completado' : null, lead.demo_opened_at ? 'demo abierta' : null, conversationCount ? `${conversationCount} conversación(es)` : null].filter(Boolean).join(' · ') || 'interés inicial';
    return { label: lead.company_name || lead.name || 'Lead sin empresa', score, state: lead.commercial_state || 'nuevo', reason: reasons };
  }).filter((lead) => lead.score > 0).sort((a, b) => b.score - a.score).slice(0, 20);
  const change = dataSeven.registrations - previousRaw.registrations;
  const churnDenominator = active.length + canceled.length;
  const recentCalls = calls.filter((call) => new Date(call.created_at) >= last7);
  const latestCall = calls[0] ?? null;
  const latestInsight = latestCall ? inspectCallForSales(latestCall) : null;
  const latency = latestCall?.latency ?? {};
  const llm = latency.llm as { p90?: number } | undefined;
  const tts = latency.tts as { p90?: number } | undefined;
  const latencyText = llm?.p90 || tts?.p90 ? `LLM p90 ${Math.round(llm?.p90 ?? 0)} ms · voz p90 ${Math.round(tts?.p90 ?? 0)} ms` : 'No disponible';
  const callAlerts = [
    recentCalls.length >= 3 && recentCalls.filter((call) => (call.duration_ms ?? 0) < 30_000).length / recentCalls.length >= 0.5 ? 'Muchas llamadas duran menos de 30 segundos: revisar la apertura.' : null,
    recentCalls.length >= 3 && !leads.some((lead) => lead.lead_source === 'retell') ? 'Hay llamadas sin leads atribuibles a Retell: revisar captura y consentimiento.' : null,
  ].filter((value): value is string => Boolean(value));
  return {
    generatedAt: now.toISOString(), today: dataToday, sevenDays: dataSeven, mrrCents, funnels, alerts, recommendations, ranking,
    prediction: `Estimación: manteniendo el ritmo de los últimos 7 días, el mes podría cerrar con aproximadamente ${projected} registros adicionales. Es una proyección, no una promesa.`,
    weekly: { best: ranking[0]!.value, worst: alerts[0] ?? bottleneck.explanation, changes: `Registros últimos 7 días: ${dataSeven.registrations} (${change >= 0 ? '+' : ''}${change} frente a los 7 días anteriores).`, actions: recommendations },
    reportEnabled: process.env.CEO_WEEKLY_REPORT_ENABLED === 'true',
    growth: { score: growthScore, coverage, bottleneck, moneyLost: { targetConversion, averageMrrCents, todayCents: Math.round(moneyLostToday), monthCents: moneyLostMonth, explanation: `Estimación usando una meta configurable de ${(targetConversion * 100).toFixed(1)}% y un MRR medio de ${formatMoney(averageMrrCents)}. No es ingreso real.` }, simulator: { onePointCents, tenCustomersCents: averageMrrCents * 10 } },
    campaigns: campaignRows,
    hotLeads,
    investor: { mrrCents, arrCents: mrrCents * 12, cac: 'No disponible: no hay gasto publicitario conectado.', ltv: active.length && mrrCents ? 'No suficiente: falta histórico de permanencia pagada.' : 'No suficiente: aún no hay base de clientes activos.', churn: churnDenominator ? percent(canceled.length / churnDenominator) : 'Sin muestra', conversion: percent(dataSeven.conversion), objectives: [bottleneck.recommendation, `Elevar la conversión visita → registro hacia ${(targetConversion * 100).toFixed(1)}%.`, 'Mantener los costes de campaña visibles antes de usar CAC o ROI.'] },
    callSales: {
      total: recentCalls.length,
      completed: recentCalls.filter((call) => call.status === 'ended').length,
      under30: recentCalls.filter((call) => (call.duration_ms ?? 0) < 30_000).length,
      over60: recentCalls.filter((call) => (call.duration_ms ?? 0) >= 60_000).length,
      over120: recentCalls.filter((call) => (call.duration_ms ?? 0) >= 120_000).length,
      retellLeads: leads.filter((lead) => lead.lead_source === 'retell').length,
      latest: latestCall && latestInsight ? { durationSeconds: Math.round((latestCall.duration_ms ?? 0) / 100) / 10, result: latestInsight.result, reason: latestCall.error_code ?? (latestCall.status === 'ended' ? 'finalizada' : String(latestCall.status ?? 'desconocido')), summary: latestCall.summary || 'Sin resumen disponible.', opportunityLost: latestInsight.opportunityLost, recommendation: latestInsight.recommendation, firstAgentMessage: latestInsight.firstAgentMessage, userResponded: latestInsight.userResponded, latency: latencyText } : null,
      alerts: callAlerts,
    },
  };
}

export function weeklyCeoEmail(brief: CeoBrief) {
  return `Hoy solo haría esto\n${brief.growth.bottleneck.recommendation}\n\nPor qué\n${brief.growth.bottleneck.explanation}\n\nQué podrías ganar\nUn punto porcentual adicional de conversión equivale a aproximadamente ${formatMoney(brief.growth.simulator.onePointCents)} de MRR mensual estimado.\n\n${brief.prediction}`;
}
