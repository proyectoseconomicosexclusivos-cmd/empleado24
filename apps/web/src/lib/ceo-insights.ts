import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

type Event = { event_name: string; created_at: string; anonymous_id: string | null; visitor_id: string | null; user_id: string | null; company_id: string | null; path: string | null; utm_campaign: string | null; metadata: { action?: string; label?: string; device?: string } | null };
type Conversation = { sector: string | null; objection: string | null; created_at: string };
type Subscription = { state: string; plan_key: string | null };

const prices: Record<string, number> = { one_employee: 9700, employee_email: 9700, employee_whatsapp: 9700, employee_budget: 19700, employee_closer: 19700, department_commercial: 29700, two_employees: 19700, five_employees: 39700 };
const visitNames = new Set(['landing_view', 'page_view', 'pricing_view']);
const day = 86_400_000;

function identity(event: Event) { return event.visitor_id ?? event.anonymous_id ?? event.user_id ?? null; }
function unique(events: Event[]) { return new Set(events.map(identity).filter(Boolean)).size; }
function rate(value: number, base: number) { return base ? value / base : null; }
function percent(value: number | null) { return value === null ? 'Sin muestra' : `${(value * 100).toFixed(1)}%`; }
function labelCounts(values: Array<string | null | undefined>) { return [...values.filter((value): value is string => Boolean(value)).reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]); }
function todayStart(now: Date) { const value = new Date(now); value.setHours(0, 0, 0, 0); return value; }
function commercialObjection(value: string) { const lower = value.toLowerCase(); if (/car|precio|cost/.test(lower)) return 'Precio'; if (/tiempo|luego|pens/.test(lower)) return 'Momento'; if (/conf[ií]|segur/.test(lower)) return 'Confianza'; if (/demo|probar/.test(lower)) return 'Quiere demostración'; return 'Otra duda'; }

export type CeoBrief = {
  generatedAt: string;
  today: { visitors: number; registrations: number; checkouts: number; payments: number; lauraConversations: number; conversion: number | null };
  sevenDays: { visitors: number; registrations: number; checkouts: number; payments: number; conversion: number | null };
  mrrCents: number;
  funnels: Array<{ label: string; value: number; conversion: number | null }>;
  alerts: string[];
  recommendations: string[];
  ranking: Array<{ label: string; value: string }>;
  prediction: string;
  weekly: { best: string; worst: string; changes: string; actions: string[] };
  reportEnabled: boolean;
};

export async function buildCeoBrief(now = new Date()): Promise<CeoBrief> {
  const admin = createAdminClient() as any;
  const from = new Date(now.getTime() - 30 * day).toISOString();
  const [eventsResult, conversationsResult, subscriptionsResult] = await Promise.all([
    admin.from('business_events').select('event_name,created_at,anonymous_id,visitor_id,user_id,company_id,path,utm_campaign,metadata').gte('created_at', from).order('created_at', { ascending: false }).limit(20_000),
    admin.from('sales_assistant_conversations').select('sector,objection,created_at').gte('created_at', from).limit(5_000),
    admin.from('subscriptions').select('state,plan_key').limit(5_000),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  const events = (eventsResult.data ?? []) as Event[];
  const conversations = (conversationsResult.data ?? []) as Conversation[];
  const subscriptions = (subscriptionsResult.data ?? []) as Subscription[];
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
  const mrrCents = active.reduce((sum, subscription) => sum + (prices[subscription.plan_key ?? ''] ?? 0), 0);
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
  const hired = labelCounts(events.filter((event) => event.event_name === 'employee_hired').map((event) => String((event.metadata as Record<string, unknown> | null)?.plan_key ?? 'Empleado')));
  const alerts: string[] = [];
  const recommendations: string[] = [];
  if (dataToday.visitors >= 50 && (dataToday.conversion ?? 0) < 0.02) { alerts.push(`Conversión baja hoy: ${dataToday.visitors} visitas y ${dataToday.registrations} registros (${percent(dataToday.conversion)}).`); recommendations.push('Revisa el primer CTA y la intervención de Laura: el tráfico llega, pero no está avanzando al registro.'); }
  if (dataSeven.registrations >= 3 && dataSeven.checkouts === 0) { alerts.push('Hay registros esta semana, pero ninguno ha iniciado checkout.'); recommendations.push('Revisa el momento de la recomendación y la claridad de la prueba antes de enviar al checkout.'); }
  if (dataSeven.checkouts >= 2 && dataSeven.payments === 0) { alerts.push('Hay checkouts iniciados sin pagos confirmados durante los últimos 7 días.'); recommendations.push('Comprueba las objeciones y el contexto de prueba antes del pago; no cambies precios sin evidencia.'); }
  if (objections[0] && objections[0][1] >= 3) { alerts.push(`La objeción más repetida es “${objections[0][0]}” (${objections[0][1]} conversaciones).`); recommendations.push(`Prepara una respuesta más clara para “${objections[0][0]}” en Laura y mide su efecto antes de cambiarla.`); }
  if (devices[0]?.[0] === 'mobile' && dataSeven.visitors > 0) recommendations.push('La mayoría de visitas medidas llegan desde móvil. Prioriza revisar manualmente el recorrido móvil antes de invertir más tráfico.');
  if (!recommendations.length) recommendations.push('No hay una señal estadísticamente suficiente para recomendar un cambio. Mantén la medición activa y revisa de nuevo mañana.');
  const remaining = Math.max(0, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
  const projected = Math.round((dataSeven.registrations / 7) * (remaining + 1));
  const ranking = [
    { label: 'Empleado más visto', value: employeeClicks[0] ? `${employeeClicks[0][0]} · ${employeeClicks[0][1]} clics` : 'Sin muestra suficiente' },
    { label: 'Empleado más contratado', value: hired[0] ? `${hired[0][0]} · ${hired[0][1]} altas` : 'Sin contrataciones medidas' },
    { label: 'Sector con más interés', value: sectors[0] ? `${sectors[0][0]} · ${sectors[0][1]} conversaciones` : 'Sin sectores medidos' },
    { label: 'Campaña con más visitas', value: campaigns[0] ? `${campaigns[0][0]} · ${campaigns[0][1]} visitas` : 'Sin campañas atribuidas' },
    { label: 'Dispositivo predominante', value: devices[0] ? `${devices[0][0]} · ${devices[0][1]} visitas` : 'Sin dispositivo medido' },
  ];
  const change = dataSeven.registrations - previousRaw.registrations;
  return {
    generatedAt: now.toISOString(), today: dataToday, sevenDays: dataSeven, mrrCents, funnels, alerts, recommendations, ranking,
    prediction: `Estimación: manteniendo el ritmo de los últimos 7 días, el mes podría cerrar con aproximadamente ${projected} registros adicionales. Es una proyección, no una promesa.`,
    weekly: { best: ranking[0]!.value, worst: alerts[0] ?? 'No hay alerta comercial activa con la muestra disponible.', changes: `Registros últimos 7 días: ${dataSeven.registrations} (${change >= 0 ? '+' : ''}${change} frente a los 7 días anteriores).`, actions: recommendations.slice(0, 3) },
    reportEnabled: process.env.CEO_WEEKLY_REPORT_ENABLED === 'true',
  };
}

export function weeklyCeoEmail(brief: CeoBrief) {
  return `Lo mejor\n${brief.weekly.best}\n\nLo que requiere atención\n${brief.weekly.worst}\n\nCambio semanal\n${brief.weekly.changes}\n\nTres acciones recomendadas\n${brief.weekly.actions.map((action, index) => `${index + 1}. ${action}`).join('\n')}\n\n${brief.prediction}`;
}
