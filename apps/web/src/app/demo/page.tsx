'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, BrainCircuit, CalendarDays, Check, CircleCheck, Clock3, Mail, MessageCircle, PhoneCall, Sparkles, Users } from 'lucide-react';
import { EmployeeAvatar } from '@/components/employee-avatar';
import { employeeShowcase } from '@/lib/employee-showcase';
import { workdayFor } from '@/lib/personalized-workday';

type Activity = { employee: string; title: string; detail: string; result: string };

function analytics(eventName: string, label: string, sector: string, startedAt: number) {
  const anonymousId = document.cookie.split('; ').find((entry) => entry.startsWith('e24_anon='))?.split('=')[1] ?? crypto.randomUUID();
  const sessionId = document.cookie.split('; ').find((entry) => entry.startsWith('e24_session='))?.split('=')[1] ?? crypto.randomUUID();
  const payload = JSON.stringify({
    eventName, path: '/demo', anonymousId: decodeURIComponent(anonymousId), visitorId: decodeURIComponent(anonymousId), sessionId: decodeURIComponent(sessionId),
    eventId: crypto.randomUUID(), idempotencyKey: `personalized-demo:${eventName}:${sessionId}:${sector}`, source: 'personalized_workday_demo',
    metadata: { sector, label, elapsed_seconds: Math.round((Date.now() - startedAt) / 1000) },
  });
  const blob = new Blob([payload], { type: 'application/json' });
  if (navigator.sendBeacon?.('/api/analytics/event', blob)) return;
  void fetch('/api/analytics/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(() => undefined);
}

function avatarFor(person: string) {
  return employeeShowcase.find((employee) => employee.person === person) ?? employeeShowcase[0]!;
}

export default function DemoPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#101210] px-6 text-center text-white"><p className="text-sm text-white/65">Estamos preparando tu ejemplo personalizado.</p></main>}><PersonalizedWorkday /></Suspense>;
}

function PersonalizedWorkday() {
  const query = useSearchParams();
  const plan = useMemo(() => workdayFor(query.get('sector')), [query]);
  const selectedPlan = query.get('employee') || plan.employeePlan;
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState('Laura');
  const startedAt = useMemo(() => Date.now(), []);
  const activities = useMemo<Activity[]>(() => [
    { employee: 'Laura', title: 'Entra un cliente', detail: `“${plan.customerNeed}”`, result: 'Laura recoge la necesidad y responde con el tono de tu empresa.' },
    { employee: plan.recommended.includes('Elena') ? 'Elena' : 'Laura', title: 'La conversación continúa', detail: 'El cliente recibe una respuesta clara por el canal que eligió.', result: 'El contexto queda preparado para el siguiente paso.' },
    { employee: 'Carlos', title: 'La oportunidad tiene seguimiento', detail: 'Carlos ve el interés y prioriza la acción comercial.', result: 'La siguiente conversación no se enfría.' },
    { employee: plan.recommended.includes('Marta') ? 'Marta' : 'David', title: plan.recommended.includes('Marta') ? 'El presupuesto se prepara' : 'El cliente recibe seguimiento', detail: plan.recommended.includes('Marta') ? plan.budget : 'David prepara el mensaje adecuado para continuar.', result: plan.recommended.includes('Marta') ? 'Borrador listo para revisar.' : 'Seguimiento preparado para enviar.' },
    { employee: 'Laura', title: 'Se reserva el siguiente paso', detail: plan.appointment, result: 'Tu equipo ve qué ocurrió y qué necesita su aprobación.' },
  ], [plan]);
  const active = activities[current]!;
  const selectedEmployee = avatarFor(selected);
  const registerHref = `/register?employee=${encodeURIComponent(selectedPlan)}&from=personalized_demo&sector=${encodeURIComponent(plan.sector)}`;

  useEffect(() => {
    analytics('personalized_demo_opened', 'opened', plan.sector, startedAt);
    const leave = () => analytics('personalized_demo_abandoned', 'pagehide', plan.sector, startedAt);
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, [plan.sector, startedAt]);

  function advance(index: number) {
    setCurrent(index);
    setSelected(activities[index]!.employee);
    analytics('personalized_demo_step_viewed', activities[index]!.title, plan.sector, startedAt);
  }

  return (
    <main className="min-h-screen bg-[#101210] text-white">
      <header className="border-b border-white/10 bg-[#101210]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 md:px-10">
          <Link href="/" className="text-lg font-bold tracking-[-.07em]">EMPLEADO<span className="text-[#ccff00]">24</span></Link>
          <span className="rounded-full border border-[#516b18] bg-[#253206] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#d5f899]">Ejemplo personalizado</span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6 md:px-10 md:py-14">
        <p className="font-mono text-xs uppercase tracking-[.16em] text-[#ccff00]">Simulación · sin datos reales</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl"><h1 className="text-4xl font-semibold tracking-[-.07em] sm:text-5xl md:text-7xl">Así habría trabajado hoy {plan.companyLabel}.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">Una jornada de ejemplo para una empresa de {plan.sector.toLowerCase()}. No representa actividad, clientes ni resultados reales.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4 text-sm"><p className="text-white/50">Equipo recomendado</p><p className="mt-1 font-semibold text-[#ccff00]">{plan.recommended.join(' + ')}</p></div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric icon={PhoneCall} label="Llamadas atendidas" value={plan.metrics.calls} />
          <Metric icon={MessageCircle} label="WhatsApps respondidos" value={plan.metrics.messages} />
          <Metric icon={CalendarDays} label="Citas preparadas" value={plan.metrics.appointments} />
          <Metric icon={Mail} label="Presupuestos" value={plan.metrics.budgets} />
          <Metric icon={Users} label="Clientes recuperados" value={plan.metrics.recovered} />
          <Metric icon={Clock3} label="Horas ahorradas" value={`${plan.metrics.hours} h`} />
        </div>
        <p className="mt-3 text-xs text-white/45">Métricas estimadas de ejemplo para ilustrar el flujo. Los resultados reales dependen de la configuración y actividad de tu empresa.</p>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#171a17]">
            <div className="border-b border-white/10 px-5 py-5 sm:px-7"><p className="font-mono text-xs uppercase tracking-[.14em] text-[#ccff00]">La jornada de ejemplo</p><h2 className="mt-1 text-2xl font-semibold">Un cliente entra. Tu equipo ya sabe qué hacer.</h2></div>
            <div className="p-5 sm:p-7"><div className="rounded-3xl border border-[#516b18] bg-[#202a05] p-5"><div className="flex items-start gap-4"><EmployeeAvatar portrait={avatarFor(active.employee).portrait} name={active.employee} objectPosition={avatarFor(active.employee).portraitPosition} className="h-12 w-12" /><div><span className="rounded-full bg-[#ccff00] px-2 py-1 text-[10px] font-bold text-[#111315]">EJEMPLO</span><h3 className="mt-3 text-xl font-semibold">{active.title}</h3><p className="mt-2 leading-7 text-white/70">{active.detail}</p><div className="mt-4 flex items-center gap-2 rounded-2xl bg-black/20 p-3 text-sm text-[#d5f899]"><CircleCheck size={16} /> {active.result}</div></div></div></div>
              <ol className="mt-5 grid gap-2">{activities.map((activity, index) => <li key={activity.title}><button type="button" onClick={() => advance(index)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${index === current ? 'bg-white text-[#111315]' : 'bg-white/[.03] text-white/65 hover:bg-white/[.08]'}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index === current ? 'bg-[#111315] text-[#ccff00]' : 'bg-white/10'}`}>{index + 1}</span><span className="flex-1 text-sm font-medium">{activity.title}</span><ArrowRight size={15} /></button></li>)}</ol>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-[#171a17] p-5 sm:p-7"><p className="font-mono text-xs uppercase tracking-[.14em] text-[#ccff00]">Oficina preparada</p><h2 className="mt-2 text-2xl font-semibold">Tu primer día, con un siguiente paso claro.</h2><div className="mt-6 grid gap-3"><Ready icon={PhoneCall} title="Laura" detail="Atiende y organiza la primera respuesta." /><Ready icon={BrainCircuit} title="Historial compartido" detail="La conversación no empieza de cero." /><Ready icon={CalendarDays} title="Calendario" detail="Las citas se preparan cuando lo conectes." /><Ready icon={Sparkles} title="Marketplace" detail="Puedes ampliar el equipo después." /></div><p className="mt-6 text-sm leading-6 text-white/55">Al registrarte tendrás una oficina preparada, no un panel vacío. La conexión de teléfono, email o calendario la decides tú.</p></section>
        </div>

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#171a17] p-5 sm:p-7"><div className="flex items-center gap-3"><BrainCircuit className="text-[#ccff00]" /><div><p className="font-mono text-xs uppercase tracking-[.14em] text-[#ccff00]">Contexto de ejemplo</p><h2 className="mt-1 text-2xl font-semibold">Todos trabajan con la misma información.</h2></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Context title="Cliente" text={plan.customerNeed} /><Context title="Estado" text="Interesado · esperando la siguiente acción" /><Context title="Siguiente paso" text={plan.appointment} /></div></section>

        <section className="mt-10 rounded-[2rem] bg-[#ccff00] p-7 text-[#111315] sm:p-10"><p className="font-mono text-xs uppercase tracking-[.14em] text-[#486500]">Cuando ya has visto el resultado</p><div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="max-w-3xl text-4xl font-semibold tracking-[-.06em] md:text-6xl">¿Quieres tener exactamente esto funcionando hoy?</h2><p className="mt-4 max-w-2xl text-lg leading-7 text-[#314300]">Crea tu empresa, prueba durante 3 días y sigue la guía de tu primer día.</p></div><Link href={registerHref} onClick={() => analytics('personalized_demo_register_clicked', selectedPlan, plan.sector, startedAt)} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#111315] px-6 py-3.5 font-semibold text-white">Crear mi empresa <ArrowRight size={17} /></Link></div></section>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof PhoneCall; label: string; value: string | number }) { return <article className="rounded-2xl border border-white/10 bg-[#171a17] p-4"><Icon className="text-[#ccff00]" size={18} /><p className="mt-6 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-white/50">{label}</p></article>; }
function Ready({ icon: Icon, title, detail }: { icon: typeof PhoneCall; title: string; detail: string }) { return <div className="flex gap-3 rounded-2xl bg-black/15 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-[#ccff00]"><Icon size={16} /></span><div><p className="font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-white/55">{detail}</p></div></div>; }
function Context({ title, text }: { title: string; text: string }) { return <article className="rounded-2xl bg-black/15 p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#ccff00]">{title}</p><p className="mt-2 text-sm leading-6 text-white/65">{text}</p></article>; }
