import Link from 'next/link';
import { ArrowRight, Bell, BookOpen, CalendarCheck, Clock3, Coins, Headphones, Languages, PhoneCall, Sparkles, Timer } from 'lucide-react';
import { ActivityService } from '@/services/activity-service';
import { CompanyService } from '@/services/company-service';
import { EmployeeService } from '@/services/employee-service';
import { NotificationService } from '@/services/notification-service';
import { IntegrationService } from '@/services/integration-service';
import { CallService } from '@/services/call-service';
import { AutoRefresh } from '@/components/auto-refresh';
import { activityMessage, employeeNextStep, employeeState, localeName, relativeTime } from '@/lib/employee-experience';
import { ActivationChecklist } from '@/components/activation-checklist';
import { FirstDayGuide } from '@/components/first-day-guide';
import { createClient } from '@/lib/supabase/server';
import { BillingActionButton } from '@/components/billing-action-button';
import { calculatePrepaidPriceMinor } from '@empleado24/integrations/billing-provider';

function greeting(timezone: string) {
  let hour = 10;
  try {
    hour = Number(new Intl.DateTimeFormat('es', { hour: '2-digit', hour12: false, timeZone: timezone }).format(new Date()));
  } catch {
    // A company timezone may still be incomplete during the first visit.
  }
  if (hour < 13) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function duration(milliseconds: number) {
  if (!milliseconds) return '0 min';
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  return minutes ? `${minutes} min ${seconds}s` : `${seconds}s`;
}

export default async function AppHome() {
  const membership = await CompanyService.current();
  const companyRelation = membership?.companies;
  const company = Array.isArray(companyRelation) ? companyRelation[0] : companyRelation;

  if (!company) {
    return (
      <main className="grid min-h-[75vh] place-items-center px-6 py-16">
        <div className="max-w-xl text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#ccff00] text-[#111315]"><Sparkles /></span>
          <p className="eyebrow mt-8">Primer día</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">Estamos preparando tu empresa.</h1>
          <p className="mt-4 text-[var(--muted)]">En cuanto esté lista, conocerás aquí al empleado que se incorporará a tu equipo.</p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const [employeesResult, notificationsResult, activityResult, integrationsResult, callDashboard, settingsResult, prepaidBalanceResult, prepaidPoliciesResult, prepaidRatesResult, profitabilityResult] = await Promise.all([
    EmployeeService.list(company.id),
    NotificationService.list(company.id),
    ActivityService.list(company.id),
    IntegrationService.list(company.id),
    CallService.dashboard(company.id, company.timezone),
    supabase.from('settings').select('data').eq('company_id', company.id).maybeSingle(),
    supabase.from('prepaid_minute_balances').select('purchased_seconds,consumed_seconds').eq('company_id', company.id).maybeSingle(),
    supabase.from('prepaid_minute_policies').select('pack_key,name,minutes,target_margin_bps,currency').eq('active', true).order('minutes'),
    supabase.from('provider_cost_rates').select('cost_per_unit_micros').eq('unit', 'minute').eq('currency', 'EUR').eq('active', true),
    supabase.from('company_profitability').select('revenue_micros,cost_micros,net_profit_micros,margin_bps,inputs_complete,blocked_reason').eq('company_id', company.id).order('period_start', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const employees = employeesResult.data ?? [];
  const receptionist = employees.find((employee) => employee.employee_type === 'receptionist') ?? employees[0];
  const notifications = notificationsResult.data ?? [];
  const activity = activityResult.data ?? [];
  const voiceConnected = (integrationsResult.data ?? []).some((integration) => integration.provider_key === 'retell' && integration.enabled && integration.status === 'connected');
  const zadarmaConnected = (integrationsResult.data ?? []).some((integration) => integration.provider_key === 'zadarma' && integration.enabled && integration.status === 'connected');
  const calendarConnected = (integrationsResult.data ?? []).some((integration) => integration.provider_key === 'google_calendar' && integration.enabled && integration.status === 'connected');
  const whatsappConnected = (integrationsResult.data ?? []).some((integration) => integration.provider_key === 'whatsapp_meta' && integration.enabled && integration.status === 'connected');
  const emailConnected = (integrationsResult.data ?? []).some((integration) => integration.provider_key === 'brevo' && integration.enabled && integration.status === 'connected');
  const settingsData = settingsResult.data?.data;
  const prepaidBalance = prepaidBalanceResult.data;
  const prepaidAvailableMinutes = Math.max(0, Math.floor(((prepaidBalance?.purchased_seconds ?? 0) - (prepaidBalance?.consumed_seconds ?? 0)) / 60));
  const configuredMinuteCost = (prepaidRatesResult.data ?? []).reduce((sum, rate) => sum + Number(rate.cost_per_unit_micros), 0);
  const profitability = profitabilityResult.data;
  const calendarSkipped = Boolean(settingsData && typeof settingsData === 'object' && !Array.isArray(settingsData) && settingsData.calendar_skipped === true);
  const employeeReady = Boolean(receptionist?.description && receptionist.description.trim().length > 0 && receptionist.runtime_status !== 'unconfigured');
  const effectiveStatus = receptionist && !voiceConnected && receptionist.runtime_status === 'active' ? 'pending_connection' : receptionist?.runtime_status;
  const state = effectiveStatus ? employeeState(effectiveStatus) : null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14">
      <AutoRefresh />
      <header className="max-w-4xl">
        <p className="eyebrow">{greeting(company.timezone)}, {company.name} 👋</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-.065em] md:text-6xl">
          {state?.label ?? 'Tu nueva compañera está llegando.'}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          {state?.detail ?? 'En cuanto termine de incorporarse, aquí verás cómo avanza su jornada.'}
        </p>
      </header>

      <ActivationChecklist items={[
        { label: 'Conecta su teléfono', detail: 'Elige un número nuevo o conserva el que ya conocen tus clientes.', href: '/app/integraciones/zadarma', done: zadarmaConnected, icon: PhoneCall },
        { label: 'Conecta tu agenda', detail: 'Conecta Google Calendar para que pueda reservar citas sin solaparlas.', href: '/app/integraciones/google_calendar', done: calendarConnected || calendarSkipped, icon: CalendarCheck },
        { label: 'Cuéntale cómo ayudarte', detail: 'Completa su forma de hablar y la información de tu empresa.', href: '/onboarding', done: employeeReady, icon: Headphones },
        { label: 'Haz la primera llamada', detail: 'Escucha cómo atiende y confirma que todo está listo.', href: '/app/primera-llamada', done: callDashboard.totalCalls > 0, icon: PhoneCall },
      ]} />

      <FirstDayGuide
        employeeReady={employeeReady}
        phoneReady={zadarmaConnected}
        whatsappReady={whatsappConnected}
        emailReady={emailConnected}
        calendarReady={calendarConnected || calendarSkipped}
        firstCallReady={callDashboard.totalCalls > 0}
      />

      <section className="mt-8 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-7 md:p-8" aria-labelledby="prepaid-title">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="eyebrow">Minutos disponibles</p><h2 id="prepaid-title" className="mt-2 text-2xl font-semibold tracking-[-.04em]">Saldo de minutos prepago</h2><p className="mt-2 text-sm text-[var(--muted)]">Se usan después de los minutos incluidos en tu plan y no caducan.</p></div>
          <p className="text-4xl font-semibold tracking-[-.06em]">{prepaidAvailableMinutes} <span className="text-base font-normal text-[var(--muted)]">min</span></p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {(prepaidPoliciesResult.data ?? []).map((pack) => {
            const amount = configuredMinuteCost ? calculatePrepaidPriceMinor(configuredMinuteCost, pack.minutes, pack.target_margin_bps) : null;
            return amount === null
              ? <span key={pack.pack_key} className="rounded-full border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]" title="El precio aparecerá cuando Empleado24 tenga configurados los costes reales.">Pack {pack.minutes} min · Próximamente</span>
              : <BillingActionButton key={pack.pack_key} action="prepaid-checkout" packKey={pack.pack_key} className="action-secondary">Comprar {pack.minutes} min · {(amount / 100).toFixed(2)} €</BillingActionButton>;
          })}
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-7 md:p-8" aria-labelledby="profit-title">
        <p className="eyebrow">Salud económica</p>
        <h2 id="profit-title" className="mt-2 text-2xl font-semibold tracking-[-.04em]">Rentabilidad de tu empresa</h2>
        {profitability?.inputs_complete ? <div className="mt-6 grid gap-4 sm:grid-cols-4"><Metric icon={Coins} value={`${(Number(profitability.revenue_micros) / 1_000_000).toFixed(2)} €`} label="Ingresos este mes" /><Metric icon={Coins} value={`${(Number(profitability.cost_micros) / 1_000_000).toFixed(2)} €`} label="Coste este mes" /><Metric icon={Coins} value={`${(Number(profitability.net_profit_micros) / 1_000_000).toFixed(2)} €`} label="Beneficio" /><Metric icon={Coins} value={profitability.margin_bps === null ? '—' : `${(profitability.margin_bps / 100).toFixed(2)}%`} label="Margen" /></div> : <p className="mt-5 rounded-2xl border border-dashed border-[var(--line)] p-5 text-sm leading-6 text-[var(--muted)]">{profitability?.blocked_reason ? `Rentabilidad pendiente: ${profitability.blocked_reason}.` : 'La rentabilidad aparecerá cuando el catálogo de costes esté completo.'}</p>}
      </section>

      {receptionist ? (
        <section className="mt-12 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--card)] shadow-[0_24px_80px_rgba(17,19,21,.07)]">
          <div className="grid lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-7 md:p-10">
              <div className="flex items-start justify-between gap-5">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#ccff00] text-[#111315]">
                  <Headphones size={24} aria-hidden="true" />
                </span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${state?.tone}`}>
                  <i className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  {state?.label}
                </span>
              </div>
              <p className="eyebrow mt-10">Tu Recepcionista</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-[-.06em]">{receptionist.name}</h2>
              <p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">
                {receptionist.description || 'Atenderá a tus clientes, aprenderá cómo funciona tu empresa y te dejará solo lo importante.'}
              </p>
              <Link href="/app/recepcionista" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#111315] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 dark:bg-[#f4f5f0] dark:text-[#111315]">
                {employeeNextStep(effectiveStatus ?? receptionist.runtime_status)} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-2 border-t border-[var(--line)] bg-black/[.018] p-6 dark:bg-white/[.018] lg:border-l lg:border-t-0 md:p-8">
              <Fact icon={Languages} value={localeName(receptionist.primary_locale)} label="Idioma principal" />
              <Fact icon={BookOpen} value={receptionist.knowledge_score === null ? 'Empezando' : `${receptionist.knowledge_score}%`} label="Lo que ya conoce" />
              <Fact icon={Clock3} value={relativeTime(receptionist.updated_at)} label="Última señal" />
              <Fact icon={PhoneCall} value={voiceConnected ? 'Verificada' : 'Pendiente'} label="Su línea" />
            </div>
          </div>
          {!voiceConnected && <div className="flex flex-col gap-4 border-t border-[#ead9a7] bg-[#fff8e5] px-7 py-5 text-[#5f4b16] dark:border-[#4d421f] dark:bg-[#2c260f] dark:text-[#f4dda0] sm:flex-row sm:items-center sm:justify-between md:px-10"><div><p className="font-medium">Pendiente de conectar su teléfono</p><p className="mt-1 text-sm opacity-75">Elige un número nuevo o conserva el que ya conocen tus clientes. Nosotros haremos el resto.</p></div><Link href="/app/integraciones/zadarma" className="shrink-0 rounded-full bg-[#111315] px-4 py-2 text-center text-sm font-medium text-white dark:bg-[#f4f5f0] dark:text-[#111315]">Conectar teléfono</Link></div>}
        </section>
      ) : (
        <section className="mt-12 rounded-[2rem] border border-dashed border-[var(--line)] p-10 text-center">
          <Headphones className="mx-auto text-[var(--muted)]" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-semibold">Tu Recepcionista aún no se ha incorporado.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Cuando termine de crearse aparecerá aquí, sin datos de ejemplo.</p>
        </section>
      )}

      <section className="mt-14" aria-labelledby="real-activity-title">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Resultados reales</p><h2 id="real-activity-title" className="mt-2 text-2xl font-semibold tracking-[-.04em]">Lo que ha atendido hoy.</h2></div><p className="text-xs text-[var(--muted)]">Se actualiza automáticamente desde Supabase.</p></div>
        {callDashboard.totalCalls ? <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={PhoneCall} value={String(callDashboard.todayCalls)} label="Llamadas hoy" /><Metric icon={Timer} value={duration(callDashboard.talkedMs)} label="Tiempo hablado" /><Metric icon={CalendarCheck} value={String(callDashboard.todayAppointments)} label="Citas creadas hoy" /><Metric icon={Clock3} value={duration(callDashboard.handledWithoutHumanMs)} label="Tiempo resuelto sin ayuda" /><Metric icon={Coins} value={callDashboard.costCurrency ? `${(callDashboard.costMinor / 100).toFixed(2)} ${callDashboard.costCurrency}` : 'Sin coste registrado'} label="Coste acumulado hoy" /><Metric icon={PhoneCall} value={`${Math.ceil(Number(callDashboard.usage.find((item) => item.metric_key === 'voice_seconds')?.quantity ?? 0) / 60)} min`} label="Consumo registrado del plan" /><Metric icon={Clock3} value={callDashboard.latest?.started_at ? relativeTime(callDashboard.latest.started_at) : 'Pendiente'} label="Última llamada" /></div> : <div className="mt-7 rounded-3xl border border-dashed border-[var(--line)] p-8"><PhoneCall className="text-[var(--muted)]" size={22} /><p className="mt-5 font-medium">Aún no hay llamadas reales.</p><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Cuando tu Recepcionista complete su primera llamada, aparecerán aquí únicamente duración, coste, citas y consumo confirmados por Retell y Supabase.</p></div>}
      </section>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1.15fr_.85fr]">
        <section id="jornada" className="scroll-mt-8">
          <p className="eyebrow">Su jornada</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Lo último que ha hecho.</h2>
          {activity.length ? (
            <ol className="mt-7 border-l border-[var(--line)]">
              {activity.map((item) => (
                <li key={item.id} className="relative ml-6 border-b border-[var(--line)] py-5 last:border-0">
                  <i className="absolute -left-[30px] top-7 h-3 w-3 rounded-full border-[3px] border-[var(--bg)] bg-[#789500]" />
                  <p className="font-medium">{activityMessage(item.event_type, item.payload)}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{relativeTime(item.created_at)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-7 rounded-2xl border border-dashed border-[var(--line)] p-7">
              <Clock3 className="text-[var(--muted)]" size={20} aria-hidden="true" />
              <p className="mt-5 font-medium">Su primera jornada aún no ha empezado.</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Cuando atienda, aprenda o reserve algo para un cliente, lo verás aquí. No mostraremos actividad inventada.</p>
            </div>
          )}
        </section>

        <section id="avisos" className="scroll-mt-8 rounded-[2rem] bg-[#111315] p-7 text-white dark:bg-[#ccff00] dark:text-[#111315] md:p-8">
          <Bell size={20} className="text-[#ccff00] dark:text-[#111315]" aria-hidden="true" />
          <p className="eyebrow mt-8 text-white/55 dark:text-[#111315]/60">Para ti</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Lo que necesita tu atención.</h2>
          {notifications.length ? (
            <ul className="mt-7 grid gap-3">
              {notifications.slice(0, 5).map((notification) => (
                <li key={notification.id} className="rounded-2xl bg-white/8 p-4 dark:bg-[#111315]/8">
                  <p className="text-sm font-medium">{notification.title}</p>
                  {notification.body && <p className="mt-1 text-xs text-white/55 dark:text-[#111315]/60">{notification.body}</p>}
                  <p className="mt-2 text-[11px] text-white/40 dark:text-[#111315]/45">{relativeTime(notification.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-7 rounded-2xl bg-white/8 p-5 text-sm leading-6 text-white/65 dark:bg-[#111315]/8 dark:text-[#111315]/65">
              Nada requiere tu atención. Tu Recepcionista te avisará cuando necesite una decisión.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Fact({ icon: Icon, value, label }: { icon: typeof Clock3; value: string; label: string }) {
  return (
    <div className="border-b border-r border-[var(--line)] p-4 odd:border-l-0 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 md:p-5">
      <Icon size={17} className="text-[#789500]" aria-hidden="true" />
      <p className="mt-7 text-lg font-semibold tracking-[-.03em]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Clock3; value: string; label: string }) {
  return <article className="surface rounded-2xl p-5"><Icon size={17} className="text-[#789500]" aria-hidden="true" /><p className="mt-7 text-2xl font-semibold tracking-[-.04em]">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{label}</p></article>;
}
