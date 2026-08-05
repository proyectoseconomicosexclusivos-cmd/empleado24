'use client';

import { useMemo, useState } from 'react';
import { HelpCircle, MessageCircle, X } from 'lucide-react';

type CopilotContext = {
  companyName?: string;
  hasPhone?: boolean;
  hasCalendar?: boolean;
  employeeTypes?: string[];
  hasDepartment?: boolean;
};

const answers = [
  { keys: ['qué empleado', 'recomiendas', 'necesito', 'pack'], title: 'Te recomiendo según tu objetivo', text: 'Para atender llamadas: Laura, Recepcionista IA. Para mensajes: David, WhatsApp IA. Para vender: Carlos, Closer IA. Para presupuestos: Marta. Para mantener el contacto: Elena, Especialista Email IA. El Pack Comercial reúne Recepcionista, WhatsApp y Closer.' },
  { keys: ['diferencia', 'whatsapp', 'recepcionista'], title: 'WhatsApp y Recepcionista', text: 'David atiende mensajes de WhatsApp. Laura atiende llamadas y puede organizar citas. Los dos pueden compartir el historial de tu empresa.' },
  { keys: ['ahorro', 'roi', 'horas'], title: 'Tiempo que puede recuperar tu equipo', text: 'Cada ficha muestra una estimación de tiempo recuperable según su función. El resultado depende del volumen de trabajo y de la información que aportes durante la incorporación.' },
  { keys: ['teléfono', 'numero', 'número', 'zadarma'], title: 'Conectar tu teléfono', text: 'Abre “Conectar teléfono”, compra o elige el número que quieres usar y sigue los pasos para verificarlo. Cuando aparezca “Todo correcto”, puedes continuar.' },
  { keys: ['calendar', 'cita', 'agenda', 'google'], title: 'Conectar tu agenda', text: 'Puedes conectar Google Calendar para que tu Recepcionista reserve citas. También puedes omitirlo y conectarlo más tarde.' },
  { keys: ['empleado', 'recepcionista', 'crear'], title: 'Crear tu Recepcionista', text: 'En “Mi Recepcionista” indica el nombre de tu empresa, el idioma y el horario. Empleado24 prepara el resto automáticamente.' },
  { keys: ['llamada', 'probar', 'funciona'], title: 'Hacer una llamada de prueba', text: 'Ve a “Primera llamada” y llama al número grande que aparece. Cuando termine, vuelve a la pantalla y pulsa “Ya he realizado la llamada”.' },
  { keys: ['precio', 'pago', 'factura', 'plan', 'minutos', 'recarga'], title: 'Pagos y minutos', text: 'Puedes consultar tu plan, el próximo cobro y tus minutos desde “Facturación”. Las recargas se añaden a tu saldo después de confirmar el pago.' },
  { keys: ['presupuesto', 'partida', 'margen', 'descuento', 'pdf', 'versión'], title: 'Preparar un presupuesto', text: 'Abre “Presupuestos IA”, describe el trabajo y añade la primera partida. Puedes indicar el margen o descuento en la descripción. El Especialista guarda una versión, la vincula al cliente y prepara el seguimiento.' },
];

export function HelpCenter({ context }: { context?: CopilotContext }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [salesStep, setSalesStep] = useState(0);
  const [salesProblem, setSalesProblem] = useState('');
  const isPublic = !context;
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return answers.slice(0, 3);
    return answers.filter((answer) => answer.keys.some((key) => normalized.includes(key) || key.includes(normalized)));
  }, [query]);

  const recommendation = !context ? null
    : !context.hasPhone ? { text: 'Conecta tu teléfono para que tu Recepcionista pueda atender llamadas.', href: '/app/integraciones/zadarma', action: 'Conectar teléfono' }
    : !context.hasCalendar ? { text: 'Puedes conectar tu agenda ahora o dejarla para más adelante.', href: '/app/integraciones/google_calendar', action: 'Conectar agenda' }
    : !context.employeeTypes?.includes('whatsapp') ? { text: 'Cuando conectes WhatsApp, el equipo podrá convertir mensajes en oportunidades.', href: '/app/facturacion', action: 'Ver mi equipo' }
    : !context.hasDepartment ? { text: 'Tu equipo puede trabajar coordinado desde el Departamento Comercial IA.', href: '/app/facturacion', action: 'Ver departamentos' }
    : { text: 'Tu equipo está conectado. Revisa la actividad para decidir su siguiente acción.', href: '/app#jornada', action: 'Ver actividad' };
  return <>
    {open && <aside className="fixed bottom-24 right-4 z-[60] w-[min(92vw,380px)] rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5 text-[var(--fg)] shadow-2xl" aria-label="Experto Empleado24">
      <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{isPublic ? 'Tu incorporación' : 'Tu copiloto'}</p><h2 className="mt-1 text-lg font-semibold">{isPublic ? 'Encuentra a la persona adecuada' : 'Experto Empleado24'}</h2><p className="mt-1 text-sm text-[var(--muted)]">{isPublic ? 'Te hago tres preguntas y te recomiendo por dónde empezar.' : 'Te acompaño paso a paso.'}</p></div><button className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)]" aria-label="Cerrar ayuda" onClick={() => setOpen(false)}><X size={16} /></button></div>
      {isPublic && <SalesGuide step={salesStep} setStep={setSalesStep} problem={salesProblem} setProblem={setSalesProblem} />}
      {recommendation && <article className="mt-4 rounded-2xl bg-[#efffcf] p-4 text-sm text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]"><p className="font-semibold">¿Qué deberías hacer ahora?</p><p className="mt-1 leading-5">{recommendation.text}</p><a href={recommendation.href} className="mt-3 inline-block font-semibold underline underline-offset-4">{recommendation.action}</a></article>}
      <label className="mt-4 block text-sm"><span className="sr-only">¿En qué necesitas ayuda?</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isPublic ? 'O escribe una pregunta' : '¿Qué quieres hacer?'} className="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-[#ccff00]" /></label>
      <div className="mt-4 space-y-3">{results.length ? results.map((result) => <article key={result.title} className="rounded-2xl bg-[var(--bg)] p-3"><p className="text-sm font-semibold">{result.title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{result.text}</p></article>) : <p className="rounded-2xl bg-[var(--bg)] p-3 text-sm text-[var(--muted)]">No he encontrado una respuesta. <a className="font-semibold text-[#789500] underline" href="mailto:proyectoseconomicosexclusivos@gmail.com?subject=Ayuda%20con%20Empleado24">Pedir ayuda al equipo</a>.</p>}</div>
    </aside>}
    <button onClick={() => setOpen((value) => !value)} data-e24-track="copilot_open" data-e24-zone="public_copilot" className="fixed bottom-5 right-4 z-[60] inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-4 py-3 text-sm font-semibold text-[#111315] shadow-lg" aria-label="Abrir Experto Empleado24"><MessageCircle size={17} /><span className="hidden sm:inline">{isPublic ? 'Encontrar mi empleado' : 'Experto Empleado24'}</span><HelpCircle size={16} /></button>
  </>;
}

function SalesGuide({
  step,
  setStep,
  problem,
  setProblem,
}: {
  step: number;
  setStep: (value: number) => void;
  problem: string;
  setProblem: (value: string) => void;
}) {
  const plans: Record<string, { person: string; job: string; href: string }> = {
    llamadas: { person: 'Laura', job: 'Recepcionista IA', href: '/register?employee=one_employee&from=public_copilot' },
    whatsapp: { person: 'Elena', job: 'WhatsApp IA', href: '/register?employee=employee_whatsapp&from=public_copilot' },
    ventas: { person: 'Carlos', job: 'Closer IA', href: '/register?employee=employee_closer&from=public_copilot' },
    clientes: { person: 'David', job: 'Especialista Email IA', href: '/register?employee=employee_email&from=public_copilot' },
    presupuestos: { person: 'Marta', job: 'Especialista Presupuestos IA', href: '/register?employee=employee_budget&from=public_copilot' },
  };
  if (step === 3) {
    const plan = plans[problem] ?? { person: 'Laura', job: 'Recepcionista IA', href: '/register?employee=one_employee&from=public_copilot' };
    return <article className="mt-5 rounded-2xl bg-[#efffcf] p-4 text-sm text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">
      <p className="font-semibold">Te recomendamos empezar con {plan.person}.</p>
      <p className="mt-1 leading-5">{plan.job}. Puedes conocerle antes o iniciar su incorporación ahora.</p>
      <a href={plan.href} data-e24-track={`copilot_contract_${problem || 'default'}`} data-e24-zone="public_copilot" className="mt-3 inline-block font-semibold underline underline-offset-4">Contratar a {plan.person}</a>
      <button type="button" onClick={() => { setStep(0); setProblem(''); }} className="ml-4 text-xs font-semibold underline underline-offset-4">Empezar de nuevo</button>
    </article>;
  }
  if (step === 2) {
    return <article className="mt-5 rounded-2xl bg-[var(--bg)] p-4"><p className="text-sm font-semibold">¿Cuál es tu mayor problema ahora?</p><div className="mt-3 flex flex-wrap gap-2">{[['llamadas', 'Muchas llamadas'], ['whatsapp', 'Muchos WhatsApp'], ['ventas', 'No cierro ventas'], ['clientes', 'Pierdo clientes'], ['presupuestos', 'Hago presupuestos']].map(([value, label]) => <button key={value} type="button" data-e24-track={`copilot_problem_${value}`} data-e24-zone="public_copilot" onClick={() => { setProblem(value ?? ''); setStep(3); }} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-medium hover:border-[#789500]">{label}</button>)}</div></article>;
  }
  if (step === 1) {
    return <article className="mt-5 rounded-2xl bg-[var(--bg)] p-4"><p className="text-sm font-semibold">¿Cuántas personas trabajan contigo?</p><div className="mt-3 flex flex-wrap gap-2">{['Solo yo', '2–5 personas', '6–20 personas', 'Más de 20'].map((option) => <button key={option} type="button" data-e24-track={`copilot_size_${option.toLowerCase().replaceAll(' ', '_')}`} data-e24-zone="public_copilot" onClick={() => setStep(2)} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-medium hover:border-[#789500]">{option}</button>)}</div></article>;
  }
  return <article className="mt-5 rounded-2xl bg-[var(--bg)] p-4"><p className="text-sm font-semibold">¿Qué tipo de negocio tienes?</p><div className="mt-3 flex flex-wrap gap-2">{['Constructora', 'Inmobiliaria', 'Clínica', 'Restaurante', 'Despacho', 'Otro'].map((option) => <button key={option} type="button" data-e24-track={`copilot_business_${option.toLowerCase().replaceAll(' ', '_')}`} data-e24-zone="public_copilot" onClick={() => setStep(1)} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-medium hover:border-[#789500]">{option}</button>)}</div></article>;
}
