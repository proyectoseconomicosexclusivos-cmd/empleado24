'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, MessageCircle, Play, Sparkles, X } from 'lucide-react';
import { EmployeeAvatar } from '@/components/employee-avatar';
import { employeeShowcase } from '@/lib/employee-showcase';
import { businessSectors, workdayFor } from '@/lib/personalized-workday';

type Step = 'welcome' | 'sector' | 'size' | 'problem' | 'recommendation' | 'objection' | 'lead' | 'done';
type CommercialState = 'COLD' | 'INTERESTED' | 'VERY_INTERESTED' | 'READY_TO_BUY' | 'CLIENT' | 'QUALIFIED';
type Identity = { anonymousId: string; sessionId: string; landing: string };
type SavedConversation = {
  commercial_state: CommercialState;
  sector: string | null;
  company_size: string | null;
  primary_problem: string | null;
  recommended_employees: string[];
  roi_snapshot: Roi | null;
  visit_count: number;
  objection: string | null;
};
type Roi = { monthlyHours: number; hourlyValue: number; monthlySaving: number; monthlyCost: number; monthlyBenefit: number };
type Intervention = 'timer' | 'scroll' | 'faq' | 'price' | 'comparison' | 'exit';
type Attribution = { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmContent: string | null; utmTerm: string | null; fbclid: string | null; gclid: string | null };

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

function attribution(): Attribution {
  try {
    const saved = cookie('e24_attribution');
    if (saved) {
      const value = JSON.parse(decodeURIComponent(saved)) as Attribution;
      if (value && typeof value === 'object') return value;
    }
  } catch { /* optional client attribution */ }
  const query = new URLSearchParams(window.location.search);
  const current = { utmSource: query.get('utm_source'), utmMedium: query.get('utm_medium'), utmCampaign: query.get('utm_campaign'), utmContent: query.get('utm_content'), utmTerm: query.get('utm_term'), fbclid: query.get('fbclid'), gclid: query.get('gclid') };
  setCookie('e24_attribution', JSON.stringify(current), 60 * 60 * 24 * 30);
  return current;
}

function analytics(action: string, label: string, key: string, extra: Record<string, unknown> = {}) {
  const visitor = identity();
  const source = attribution();
  const eventName = action === 'laura_personalized_demo_started' || action === 'laura_demo_opened'
    ? 'demo_started'
    : action === 'laura_demo_offer' ? 'demo_offered'
      : action === 'laura_objection' ? 'objection_detected'
        : action === 'laura_answer' && label.startsWith('problem:') ? 'need_detected'
          : action === 'laura_answer' && label.startsWith('sector:') ? 'employee_recommended'
            : action === 'laura_conversation_completed' ? 'offer_presented'
              : action === 'laura_conversation_started' || action === 'laura_presented' || action === 'laura_demo_started' ? 'conversation_started'
                : 'page_view';
  const payload = {
    eventName, path: window.location.pathname, anonymousId: visitor.anonymousId,
    visitorId: visitor.anonymousId, sessionId: visitor.sessionId, eventId: crypto.randomUUID(),
    idempotencyKey: `laura:${key}:${visitor.sessionId}`, source: 'laura_sales_assistant',
    landing: visitor.landing, referrer: document.referrer || null,
    ...source,
    metadata: { action, label, zone: 'laura_sales_assistant', ...extra },
  };
  const body = JSON.stringify(payload);
  const beacon = new Blob([body], { type: 'application/json' });
  if (navigator.sendBeacon?.('/api/analytics/event', beacon)) return;
  void fetch('/api/analytics/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}

async function remember(input: Record<string, unknown>) {
  const visitor = identity();
  const response = await fetch('/api/sales-assistant/conversation', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, anonymousId: visitor.anonymousId, sessionId: visitor.sessionId }),
  });
  return (await response.json().catch(() => null)) as { conversation?: SavedConversation } | null;
}

const options = {
  sector: businessSectors,
  size: ['Solo yo', '2–5 personas', '6–20 personas', 'Más de 20'],
  problem: [
    ['llamadas', 'Pierdo llamadas'], ['whatsapp', 'Muchos WhatsApp'], ['ventas', 'No cierro ventas'],
    ['clientes', 'Pierdo clientes'], ['presupuestos', 'Hago presupuestos'],
  ],
} as const;

function recommendationFor(sector: string, problem: string) {
  if (sector === 'Construcción') return { names: ['Laura', 'Marta', 'Carlos'], plan: 'Laura + Presupuestos IA + Carlos', employee: 'employee_budget', cost: 391 };
  if (sector === 'Clínica') return { names: ['Laura', 'Agenda'], plan: 'Laura + Agenda', employee: 'one_employee', cost: 97 };
  if (sector === 'Inmobiliaria') return { names: ['Laura', 'Carlos'], plan: 'Laura + Carlos', employee: 'employee_closer', cost: 294 };
  if (sector === 'Restaurante' || sector === 'Tienda') return { names: ['Laura', 'Elena'], plan: 'Laura + Elena', employee: 'employee_whatsapp', cost: 194 };
  if (sector === 'Taller') return { names: ['Laura', 'Marta'], plan: 'Laura + Presupuestos IA', employee: 'employee_budget', cost: 294 };
  if (sector === 'Agencia') return { names: ['Laura', 'Carlos', 'Marta'], plan: 'Laura + Carlos + Presupuestos IA', employee: 'employee_closer', cost: 391 };
  if (problem === 'presupuestos') return { names: ['Marta', 'Carlos'], plan: 'Marta + Carlos', employee: 'employee_budget', cost: 394 };
  if (problem === 'whatsapp') return { names: ['Elena', 'Carlos'], plan: 'Elena + Carlos', employee: 'employee_whatsapp', cost: 294 };
  if (problem === 'ventas' || problem === 'clientes') return { names: ['Laura', 'Carlos'], plan: 'Laura + Carlos', employee: 'employee_closer', cost: 294 };
  return { names: ['Laura'], plan: 'Laura', employee: 'one_employee', cost: 97 };
}

function roiFor(size: string, cost: number): Roi {
  const monthlyHours = size === 'Más de 20' ? 60 : size === '6–20 personas' ? 40 : size === '2–5 personas' ? 25 : 15;
  const hourlyValue = 20;
  const monthlySaving = monthlyHours * hourlyValue;
  return { monthlyHours, hourlyValue, monthlySaving, monthlyCost: cost, monthlyBenefit: Math.max(0, monthlySaving - cost) };
}

const stateCopy: Record<CommercialState, string> = {
  COLD: 'Cuéntame un poco sobre tu empresa y te ayudo a decidir.',
  INTERESTED: 'La última vez hablamos de tu empresa. Seguimos desde ahí.',
  VERY_INTERESTED: 'Ya tengo una recomendación para ti. Te enseño el ahorro estimado.',
  READY_TO_BUY: 'Ya tienes tu equipo recomendado. Puedes activarlo cuando quieras.',
  QUALIFIED: 'Ya tengo los datos necesarios para preparar tu recomendación.',
  CLIENT: 'Gracias por confiar en el equipo. Estoy preparada para ayudarte.',
};

const interventionCopy: Record<Intervention, string> = {
  timer: '¿Quieres que te diga qué empleado puede ayudarte primero? Solo necesito dos respuestas.',
  scroll: 'Parece que estás revisando el equipo. ¿Quieres una recomendación directa para tu empresa?',
  faq: 'Parece que estás comparando opciones. Dime qué te preocupa y te recomiendo por dónde empezar.',
  price: '¿Quieres comprobar cuánto tiempo recuperarías antes de decidir? Te lo calculo en menos de un minuto.',
  comparison: '¿Estás valorando alternativas? Dime a qué te dedicas y te digo qué empleado te conviene primero.',
  exit: 'Antes de irte: ¿quieres que te prepare gratis qué empleado contrataría para tu empresa?',
};

export function LauraSalesAssistant() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('welcome');
  const [sector, setSector] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [problem, setProblem] = useState('');
  const [state, setState] = useState<CommercialState>('COLD');
  const [visitCount, setVisitCount] = useState(0);
  const [exitCopy, setExitCopy] = useState(false);
  const [nudge, setNudge] = useState<'demo' | 'trial' | null>(null);
  const [objection, setObjection] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openingMessage, setOpeningMessage] = useState('Hola, soy Laura. Si me dices a qué se dedica tu empresa, en menos de un minuto te enseño cómo trabajaríamos para ti.');
  const activated = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const pointerDistance = useRef(0);
  const recommendation = useMemo(() => recommendationFor(sector, problem), [sector, problem]);
  const roi = useMemo(() => roiFor(companySize, recommendation.cost), [companySize, recommendation.cost]);
  const laura = employeeShowcase.find((employee) => employee.person === 'Laura');

  useEffect(() => {
    const visitor = identity();
    void fetch(`/api/sales-assistant/conversation?anonymousId=${encodeURIComponent(visitor.anonymousId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data: { conversation?: SavedConversation } | null) => {
        const saved = data?.conversation;
        if (!saved) return;
        setState(saved.commercial_state);
        setVisitCount(saved.visit_count);
        setSector(saved.sector ?? '');
        setCompanySize(saved.company_size ?? '');
        setProblem(saved.primary_problem ?? '');
      }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('laura_chat') !== '1') return;
    activated.current = true;
    setVisible(true);
    setStep('sector');
    analytics('laura_demo_started', 'hero_primary_cta', 'hero_primary_cta');
    void remember({ action: 'intent', commercialState: 'INTERESTED' });
    setState('INTERESTED');
  }, []);

  useEffect(() => {
    const visitor = identity();
    void fetch(`/api/conversion/experiment?anonymousId=${encodeURIComponent(visitor.anonymousId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data: { experiment?: { key?: string; variant?: string; message?: string | null } | null } | null) => {
        const experiment = data?.experiment;
        if (!experiment?.message || !experiment.key || !experiment.variant) return;
        setOpeningMessage(experiment.message);
        analytics('conversion_experiment_assigned', `${experiment.key}:${experiment.variant}`, `experiment:${experiment.key}`);
      }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const reveal = (reason: Intervention) => {
      if (activated.current && step !== 'welcome') return;
      activated.current = true;
      setVisible(true);
      setOpeningMessage(interventionCopy[reason]);
      setExitCopy(reason === 'exit');
      analytics('laura_presented', reason, `presented:${reason}`);
      void remember({ action: 'presented', commercialState: state }).then((data) => setVisitCount(data?.conversation?.visit_count ?? 0));
    };
    const timer = window.setTimeout(() => reveal('timer'), 12_000);
    const onScroll = () => {
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      if (maximum > 0 && window.scrollY / maximum >= 0.4) reveal('scroll');
    };
    const onPointerMove = (event: MouseEvent) => {
      const previous = lastPointer.current;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      if (!previous || activated.current) return;
      pointerDistance.current += Math.hypot(event.clientX - previous.x, event.clientY - previous.y);
      if (pointerDistance.current >= 900) reveal('comparison');
    };
    const onExit = (event: MouseEvent) => {
      if (event.clientY > 0 || step === 'done') return;
      reveal('exit');
      analytics('laura_exit_intent', 'before_leave', 'exit_intent');
    };
    const observers = ['preguntas', 'precio'].map((id) => {
      const element = document.getElementById(id);
      if (!element) return null;
      const observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) reveal(id === 'preguntas' ? 'faq' : 'price');
      }, { threshold: 0.45 });
      observer.observe(element);
      return observer;
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    document.addEventListener('mouseout', onExit);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseout', onExit);
      observers.forEach((observer) => observer?.disconnect());
    };
  }, [state, step]);

  useEffect(() => {
    if (!visible || step === 'done') return;
    const demoTimer = window.setTimeout(() => { setNudge('demo'); analytics('laura_demo_offer', 'two_minutes', 'demo_offer'); }, 120_000);
    const trialTimer = window.setTimeout(() => { setNudge('trial'); analytics('laura_trial_offer', 'four_minutes', 'trial_offer'); }, 240_000);
    return () => { window.clearTimeout(demoTimer); window.clearTimeout(trialTimer); };
  }, [visible]);

  function start() {
    setExitCopy(false);
    if (sector && companySize && problem) { setStep('recommendation'); return; }
    setStep(sector ? 'size' : 'sector');
    analytics('laura_conversation_started', 'start', 'conversation_started');
    void remember({ action: 'intent', commercialState: 'INTERESTED' }); setState('INTERESTED');
  }

  function selectAnswer(field: 'sector' | 'size' | 'problem', value: string) {
    const next = field === 'sector' ? { sector: value, companySize, problem } : field === 'size' ? { sector, companySize: value, problem } : { sector, companySize, problem: value };
    if (field === 'sector') { setSector(value); setStep('size'); }
    if (field === 'size') { setCompanySize(value); setStep('problem'); }
    if (field === 'problem') { setProblem(value); setStep('recommendation'); }
    const nextState: CommercialState = field === 'problem' ? 'VERY_INTERESTED' : 'INTERESTED';
    analytics('laura_answer', `${field}:${value}`, `${field}:${value}`);
    void remember({ action: 'answer', field, value, commercialState: nextState, sector: next.sector, companySize: next.companySize, primaryProblem: next.problem }); setState(nextState);
  }

  function showRecommendation() {
    setState('READY_TO_BUY');
    const workday = workdayFor(sector);
    analytics('laura_personalized_demo_started', sector || 'Otro', 'personalized_demo_started', { recommendation: recommendation.names, problem, companySize });
    void remember({ action: 'roi', commercialState: 'READY_TO_BUY', sector, companySize, primaryProblem: problem, recommendation: recommendation.names, roi });
    const query = new URLSearchParams({ sector: workday.sector, problem, size: companySize, employee: recommendation.employee });
    window.location.assign(`/demo?${query.toString()}`);
  }

  function beginLeadCapture() {
    analytics('laura_lead_capture_opened', recommendation.plan, 'lead_capture_opened', { recommendation: recommendation.names, sector, problem });
    void remember({ action: 'intent', commercialState: 'VERY_INTERESTED', sector, companySize, primaryProblem: problem, recommendation: recommendation.names });
    setStep('lead');
  }

  async function sendObjection(form: FormData) {
    const value = String(form.get('objection') ?? '').trim().slice(0, 200);
    if (!value) return;
    setObjection(value);
    analytics('laura_objection', value.toLowerCase().includes('car') || value.toLowerCase().includes('precio') ? 'price' : 'other', 'objection');
    await remember({ action: 'objection', value, commercialState: 'VERY_INTERESTED', sector, companySize, primaryProblem: problem, recommendation: recommendation.names });
  }

  async function createLead(form: FormData) {
    setSaving(true); setError('');
    const visitor = identity(); const source = attribution();
    const idempotencyKey = `lead:${visitor.sessionId}:${problem}`;
    const response = await fetch('/api/sales-assistant/lead', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'), email: form.get('email'), companyName: form.get('company'), phone: form.get('phone'), sector, companySize,
        primaryProblem: problem, recommendation: recommendation.names, anonymousId: visitor.anonymousId, sessionId: visitor.sessionId,
        landing: visitor.landing, referrer: document.referrer || null, ...source, roiSnapshot: roi, idempotencyKey,
        contactConsent: form.get('contactConsent') === 'on',
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { leadToken?: string };
    if (!response.ok || !data.leadToken) { setError('No he podido guardar tu recomendación. Vuelve a intentarlo.'); setSaving(false); return; }
    analytics('laura_conversation_completed', recommendation.plan, 'conversation_completed');
    void remember({ action: 'completed', commercialState: 'QUALIFIED', sector, companySize, primaryProblem: problem, recommendation: recommendation.names, roi });
    setStep('done'); setSaving(false);
    const next = new URL(window.location.href); next.searchParams.set('laura', data.leadToken);
    window.history.replaceState(null, '', `${next.pathname}${next.search}`);
  }

  function openDemo() {
    analytics('laura_demo_opened', recommendation.plan, 'demo_opened');
    void remember({ action: 'demo', commercialState: state, sector, companySize, primaryProblem: problem, recommendation: recommendation.names });
  }

  if (!visible) return null;
  const continuation = new URLSearchParams(window.location.search).get('laura');
  const registerHref = `/register?employee=${recommendation.employee}&from=laura${continuation ? `&laura=${encodeURIComponent(continuation)}` : ''}`;
  const priceObjection = objection && /(car|precio|coste|costoso)/i.test(objection);
  return <aside id="hablar-con-laura" className="fixed bottom-5 right-4 z-[60] w-[min(92vw,400px)] rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-5 text-[var(--fg)] shadow-2xl" aria-label="Hablar con Laura">
    <div className="flex items-start gap-3">{laura && <EmployeeAvatar portrait={laura.portrait} name="Laura" className="h-12 w-12 shrink-0 rounded-2xl" objectPosition={laura.portraitPosition} />}<div className="min-w-0 flex-1"><p className="text-sm font-semibold">Laura · Recepcionista IA</p><p className="mt-0.5 text-xs text-[var(--muted)]">Estoy aquí para ayudarte a decidir.</p></div><button type="button" onClick={() => setVisible(false)} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)]" aria-label="Cerrar conversación"><X size={15}/></button></div>
    {step === 'welcome' && <div className="mt-5"><p className="text-[15px] leading-6">{exitCopy ? interventionCopy.exit : visitCount >= 3 ? 'Creo que ya has visto cómo funciona. ¿Quieres activarlo ahora?' : state === 'COLD' ? openingMessage : stateCopy[state]}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-4 py-2.5 text-sm font-semibold text-[#111315]">Quiero mi recomendación <MessageCircle size={15}/></button><button type="button" onClick={() => { setVisible(false); analytics('laura_prompt_dismissed', 'not_now', 'prompt_dismissed'); }} className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-medium">Ahora no</button></div></div>}
    {step === 'sector' && <Choice title="¿A qué se dedica tu empresa?" choices={options.sector} onSelect={(value) => selectAnswer('sector', value)} />}
    {step === 'size' && <Choice title="¿Cuántas personas trabajan contigo?" choices={options.size} onSelect={(value) => selectAnswer('size', value)} />}
    {step === 'problem' && <Choice title="¿Qué te quita más tiempo ahora?" choices={options.problem.map(([value, label]) => ({ value, label }))} onSelect={(value) => selectAnswer('problem', value)} />}
    {step === 'recommendation' && <div className="mt-5 rounded-2xl bg-[#efffcf] p-4 text-sm text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]"><p className="font-semibold">Para una {sector || 'empresa'} como la tuya, empezaría con {recommendation.plan}.</p><p className="mt-2 leading-5">Con {roi.monthlyHours} horas recuperadas al mes, a {roi.hourlyValue} €/hora: ahorras {roi.monthlySaving} €, cuesta {roi.monthlyCost} € y el beneficio estimado es {roi.monthlyBenefit} €/mes.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={beginLeadCapture} className="inline-flex items-center gap-2 rounded-full bg-[#111315] px-4 py-2.5 font-semibold text-white">Guardar mi recomendación <ArrowRight size={15}/></button><button type="button" onClick={showRecommendation} className="rounded-full border border-[#789500] px-4 py-2.5 font-semibold">Ver cómo trabajaría</button></div><button type="button" onClick={() => setStep('objection')} className="mt-3 text-xs font-medium underline">Tengo una duda</button></div>}
    {step === 'objection' && <form action={sendObjection} className="mt-5"><p className="text-sm font-semibold">¿Qué te hace dudar?</p><input className="input mt-3 w-full" name="objection" required placeholder="Por ejemplo: me parece caro" /><button className="mt-3 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium">Resolver mi duda</button>{objection && <div className="mt-3 rounded-xl bg-[#efffcf] p-3 text-sm text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">{priceObjection ? `Lo entiendo. Si recuperas ${roi.monthlyHours} horas, el coste de ${roi.monthlyCost} €/mes equivale a ${Math.max(1, Math.round(roi.monthlyCost / roi.hourlyValue))} horas de trabajo. La estimación deja ${roi.monthlyBenefit} €/mes de margen de tiempo y dinero.` : `Gracias por contármelo. La prueba de 3 días te permite comprobarlo con tu empresa antes de decidir.`}<button type="button" onClick={() => setStep('recommendation')} className="ml-2 font-semibold underline">Volver al plan</button></div>}</form>}
    {step === 'lead' && <form action={createLead} className="mt-5"><p className="text-sm font-semibold">Te envío este plan personalizado.</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Solo necesito tu nombre y un email. Lo demás puede esperar.</p><input className="input mt-4 w-full" name="name" required minLength={2} placeholder="Tu nombre" autoComplete="name" /><input className="input mt-3 w-full" name="email" type="email" required placeholder="Tu email de trabajo" autoComplete="email" /><input className="input mt-3 w-full" name="company" minLength={2} placeholder="Empresa (opcional)" autoComplete="organization" /><input className="input mt-3 w-full" name="phone" type="tel" placeholder="WhatsApp (opcional)" autoComplete="tel" /><label className="mt-3 flex gap-2 text-xs leading-5 text-[var(--muted)]"><input name="contactConsent" type="checkbox" className="mt-1" />Acepto que Empleado24 me contacte personalmente sobre esta recomendación.</label><button disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ccff00] px-4 py-3 text-sm font-semibold text-[#111315] disabled:opacity-60">{saving ? 'Guardando tu plan…' : 'Guardar mi recomendación'} <ArrowRight size={15}/></button>{error && <p role="alert" className="mt-3 text-xs text-[#b23a22]">{error}</p>}</form>}
    {step === 'done' && <div className="mt-5"><p className="text-sm font-semibold">Tu recomendación está lista.</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Empiezas con 3 días de prueba y puedes cancelar cuando quieras.</p><Link href={registerHref} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-4 py-2.5 text-sm font-semibold text-[#111315]">Activar mi prueba <ArrowRight size={15}/></Link></div>}
    {nudge && step !== 'done' && <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#d7ed91] bg-[#fbfff0] p-3 text-sm text-[#486500] dark:border-[#4a6412] dark:bg-[#202a05] dark:text-[#d5f899]"><span>{nudge === 'demo' ? '¿Quieres que te enseñe cómo trabajaría con tu empresa?' : 'Hoy puedes probarlo gratis durante 3 días.'}</span>{nudge === 'demo' ? <Link href={`/demo?employee=recepcionista-ia&from=laura`} onClick={openDemo} className="inline-flex shrink-0 items-center gap-1 font-semibold underline">Ver demo <Play size={13}/></Link> : <button type="button" onClick={() => setStep('recommendation')} className="shrink-0 font-semibold underline">Ver plan <Sparkles size={13} className="inline" /></button>}</div>}
  </aside>;
}

function Choice({ title, choices, onSelect }: { title: string; choices: readonly string[] | Array<{ value: string; label: string }>; onSelect: (value: string) => void }) {
  return <div className="mt-5"><p className="text-sm font-semibold">{title}</p><div className="mt-3 flex flex-wrap gap-2">{choices.map((choice) => { const value = typeof choice === 'string' ? choice : choice.value; const label = typeof choice === 'string' ? choice : choice.label; return <button type="button" key={value} onClick={() => onSelect(value)} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-medium transition hover:border-[#789500]">{label}</button>; })}</div></div>;
}
