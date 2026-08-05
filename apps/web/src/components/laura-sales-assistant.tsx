'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, MessageCircle, X } from 'lucide-react';
import { EmployeeAvatar } from '@/components/employee-avatar';
import { employeeShowcase } from '@/lib/employee-showcase';

type Step = 'welcome' | 'sector' | 'size' | 'problem' | 'recommendation' | 'lead' | 'done';
type Identity = { anonymousId: string; sessionId: string; landing: string };

function cookie(name: string) {
  return document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.split('=')[1] ?? null;
}
function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}
function identity(): Identity {
  const anonymousId = decodeURIComponent(cookie('e24_anon') ?? crypto.randomUUID());
  const sessionId = decodeURIComponent(cookie('e24_session') ?? crypto.randomUUID());
  const landing = decodeURIComponent(cookie('e24_landing') ?? `${window.location.pathname}${window.location.search}`);
  setCookie('e24_anon', anonymousId, 60 * 60 * 24 * 365);
  setCookie('e24_session', sessionId, 60 * 30);
  setCookie('e24_landing', landing, 60 * 60 * 24 * 30);
  return { anonymousId, sessionId, landing };
}
function analytics(action: string, label: string, key: string) {
  const visitor = identity();
  const query = new URLSearchParams(window.location.search);
  const body = JSON.stringify({
    eventName: 'page_view', path: window.location.pathname, anonymousId: visitor.anonymousId,
    visitorId: visitor.anonymousId, sessionId: visitor.sessionId, eventId: crypto.randomUUID(),
    idempotencyKey: `laura:${key}:${visitor.sessionId}`, source: 'laura_sales_assistant',
    landing: visitor.landing, referrer: document.referrer || null,
    utmSource: query.get('utm_source'), utmMedium: query.get('utm_medium'),
    utmCampaign: query.get('utm_campaign'), utmContent: query.get('utm_content'),
    utmTerm: query.get('utm_term'), fbclid: query.get('fbclid'), gclid: query.get('gclid'),
    metadata: { action, label, zone: 'laura_sales_assistant' },
  });
  const beacon = new Blob([body], { type: 'application/json' });
  if (navigator.sendBeacon?.('/api/analytics/event', beacon)) return;
  void fetch('/api/analytics/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}

const options = {
  sector: ['Constructora', 'Inmobiliaria', 'Clínica', 'Restaurante', 'Despacho', 'Otro'],
  size: ['Solo yo', '2–5 personas', '6–20 personas', 'Más de 20'],
  problem: [['llamadas', 'Muchas llamadas'], ['whatsapp', 'Muchos WhatsApp'], ['ventas', 'No cierro ventas'], ['clientes', 'Pierdo clientes'], ['presupuestos', 'Hago presupuestos']],
} as const;
function recommendationFor(problem: string) {
  if (problem === 'presupuestos') return { names: ['Marta', 'Carlos'], plan: 'Marta + Carlos', employee: 'employee_budget' };
  if (problem === 'whatsapp') return { names: ['David', 'Carlos'], plan: 'David + Carlos', employee: 'employee_whatsapp' };
  if (problem === 'ventas' || problem === 'clientes') return { names: ['Laura', 'Carlos'], plan: 'Laura + Carlos', employee: 'employee_closer' };
  return { names: ['Laura', 'Carlos'], plan: 'Laura + Carlos', employee: 'one_employee' };
}

export function LauraSalesAssistant() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('welcome');
  const [sector, setSector] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [problem, setProblem] = useState('');
  const [exitCopy, setExitCopy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const activated = useRef(false);
  const recommendation = useMemo(() => recommendationFor(problem), [problem]);
  const laura = employeeShowcase.find((employee) => employee.person === 'Laura');

  useEffect(() => {
    const reveal = (reason: 'timer' | 'scroll') => {
      if (activated.current) return;
      activated.current = true;
      setVisible(true);
      analytics('laura_presented', reason, `presented:${reason}`);
    };
    const timer = window.setTimeout(() => reveal('timer'), 4000);
    const onScroll = () => {
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      if (maximum > 0 && window.scrollY / maximum >= 0.4) reveal('scroll');
    };
    const onExit = (event: MouseEvent) => {
      if (event.clientY > 0 || step === 'done') return;
      setExitCopy(true);
      setVisible(true);
      analytics('laura_exit_intent', 'before_leave', 'exit_intent');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseout', onExit);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onExit);
    };
  }, [step]);

  function start() {
    setExitCopy(false);
    setStep('sector');
    analytics('laura_conversation_started', 'start', 'conversation_started');
  }

  async function createLead(form: FormData) {
    setSaving(true);
    setError('');
    const visitor = identity();
    const query = new URLSearchParams(window.location.search);
    const idempotencyKey = `lead:${visitor.sessionId}:${problem}:${String(form.get('email')).trim().toLowerCase()}`;
    const response = await fetch('/api/sales-assistant/lead', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'), email: form.get('email'), companyName: form.get('company'),
        sector, companySize, primaryProblem: problem, recommendation: recommendation.names,
        anonymousId: visitor.anonymousId, sessionId: visitor.sessionId, landing: visitor.landing,
        referrer: document.referrer || null, utmSource: query.get('utm_source'), utmMedium: query.get('utm_medium'),
        utmCampaign: query.get('utm_campaign'), utmContent: query.get('utm_content'), utmTerm: query.get('utm_term'),
        fbclid: query.get('fbclid'), idempotencyKey,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { leadToken?: string };
    if (!response.ok || !data.leadToken) {
      setError('No he podido guardar tu recomendación. Vuelve a intentarlo.');
      setSaving(false);
      return;
    }
    analytics('laura_conversation_completed', recommendation.plan, 'conversation_completed');
    setStep('done');
    setSaving(false);
    const next = new URL(window.location.href);
    next.searchParams.set('laura', data.leadToken);
    window.history.replaceState(null, '', `${next.pathname}${next.search}`);
  }

  if (!visible) return null;
  const continuation = new URLSearchParams(window.location.search).get('laura');
  const registerHref = `/register?employee=${recommendation.employee}&from=laura${continuation ? `&laura=${encodeURIComponent(continuation)}` : ''}`;
  return <aside className="fixed bottom-5 right-4 z-[60] w-[min(92vw,390px)] rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-5 text-[var(--fg)] shadow-2xl" aria-label="Hablar con Laura">
    <div className="flex items-start gap-3">
      {laura && <EmployeeAvatar portrait={laura.portrait} name="Laura" className="h-12 w-12 shrink-0 rounded-2xl" objectPosition={laura.portraitPosition} />}
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Laura · Recepcionista IA</p><p className="mt-0.5 text-xs text-[var(--muted)]">Estoy aquí para ayudarte a elegir tu equipo.</p></div>
      <button type="button" onClick={() => setVisible(false)} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)]" aria-label="Cerrar conversación"><X size={15}/></button>
    </div>
    {step === 'welcome' && <div className="mt-5"><p className="text-[15px] leading-6">{exitCopy ? 'Antes de irte… ¿quieres que te prepare gratis qué empleados contrataría para tu empresa?' : 'Hola 👋 Soy Laura. Trabajo como recepcionista virtual. ¿A qué se dedica tu empresa?'}</p><button type="button" onClick={start} data-e24-track="laura_start" data-e24-zone="laura_sales_assistant" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-4 py-2.5 text-sm font-semibold text-[#111315]">Hablar con Laura <MessageCircle size={15}/></button></div>}
    {step === 'sector' && <Choice title="¿A qué se dedica tu empresa?" choices={options.sector} onSelect={(value) => { setSector(value); setStep('size'); analytics('laura_answer', `sector:${value}`, `sector:${value}`); }} />}
    {step === 'size' && <Choice title="¿Cuántas personas trabajan contigo?" choices={options.size} onSelect={(value) => { setCompanySize(value); setStep('problem'); analytics('laura_answer', `size:${value}`, `size:${value}`); }} />}
    {step === 'problem' && <Choice title="¿Cuál es tu mayor problema ahora?" choices={options.problem.map(([value, label]) => ({ value, label }))} onSelect={(value) => { setProblem(value); setStep('recommendation'); analytics('laura_answer', `problem:${value}`, `problem:${value}`); }} />}
    {step === 'recommendation' && <div className="mt-5 rounded-2xl bg-[#efffcf] p-4 text-sm text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]"><p className="font-semibold">Creo que con {recommendation.plan} ahorrarías unas 20 horas al mes.</p><p className="mt-1 leading-5">Es una estimación inicial: confirmaremos qué necesita tu empresa antes de activar nada.</p><button type="button" onClick={() => { setStep('lead'); analytics('laura_intent', recommendation.plan, 'intent'); }} data-e24-track="laura_start_plan" data-e24-zone="laura_sales_assistant" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#111315] px-4 py-2.5 font-semibold text-white">Quiero empezar <ArrowRight size={15}/></button></div>}
    {step === 'lead' && <form action={createLead} className="mt-5"><p className="text-sm font-semibold">Te preparo el plan para tu empresa.</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Solo necesito estos tres datos. No te llamaré sin que tú lo pidas.</p><input className="input mt-4 w-full" name="name" required minLength={2} placeholder="Tu nombre" autoComplete="name" /><input className="input mt-3 w-full" name="email" type="email" required placeholder="Tu email de trabajo" autoComplete="email" /><input className="input mt-3 w-full" name="company" required minLength={2} placeholder="Nombre de tu empresa" autoComplete="organization" /><button disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ccff00] px-4 py-3 text-sm font-semibold text-[#111315] disabled:opacity-60">{saving ? 'Preparando tu plan…' : 'Preparar mi plan'} <ArrowRight size={15}/></button>{error && <p role="alert" className="mt-3 text-xs text-[#b23a22]">{error}</p>}</form>}
    {step === 'done' && <div className="mt-5"><p className="text-sm font-semibold">Ya tengo tu recomendación.</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Cuando quieras, continuamos con la incorporación de {recommendation.plan}.</p><Link href={registerHref} data-e24-track="laura_continue_registration" data-e24-zone="laura_sales_assistant" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-4 py-2.5 text-sm font-semibold text-[#111315]">Continuar con mi incorporación <ArrowRight size={15}/></Link></div>}
  </aside>;
}

function Choice({ title, choices, onSelect }: { title: string; choices: readonly string[] | Array<{ value: string; label: string }>; onSelect: (value: string) => void }) {
  return <div className="mt-5"><p className="text-sm font-semibold">{title}</p><div className="mt-3 flex flex-wrap gap-2">{choices.map((choice) => { const value = typeof choice === 'string' ? choice : choice.value; const label = typeof choice === 'string' ? choice : choice.label; return <button type="button" key={value} onClick={() => onSelect(value)} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-medium transition hover:border-[#789500]">{label}</button>; })}</div></div>;
}
