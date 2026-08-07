'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ExternalLink, Headphones, Mail, MessageCircle, Phone, Sparkles, Timer } from 'lucide-react';
import { skipGoogleCalendar } from '@/app/actions/integrations';

type SetupStep = 'company' | 'email' | 'phone' | 'whatsapp' | 'schedule' | 'call' | 'whatsapp_test' | 'email_test' | 'quote' | 'ready';

interface SetupWizardProps {
  companyName: string;
  employeeName: string;
  zadarmaConnected: boolean;
  calendarConnected: boolean;
  calendarSkipped: boolean;
  retellConnected: boolean;
  emailConnected: boolean;
  whatsappConnected: boolean;
  configured?: string;
  children: ReactNode;
}

const steps: Array<{ id: SetupStep; label: string; minutes: string }> = [
  { id: 'company', label: 'Empresa', minutes: '1 min' }, { id: 'email', label: 'Correo', minutes: '1 min' }, { id: 'phone', label: 'Teléfono', minutes: '2 min' }, { id: 'whatsapp', label: 'WhatsApp', minutes: '1 min' }, { id: 'schedule', label: 'Horario', minutes: '1 min' }, { id: 'call', label: 'Prueba llamada', minutes: '1 min' }, { id: 'whatsapp_test', label: 'Prueba WhatsApp', minutes: '1 min' }, { id: 'email_test', label: 'Primer email', minutes: '1 min' }, { id: 'quote', label: 'Presupuesto', minutes: '1 min' }, { id: 'ready', label: 'Empresa lista', minutes: '—' },
];

export function SetupWizard({ companyName, employeeName, zadarmaConnected, calendarConnected, calendarSkipped, retellConnected, emailConnected, whatsappConnected, configured, children }: SetupWizardProps) {
  const calendarReady = calendarConnected || calendarSkipped;
  const [step, setStep] = useState<SetupStep>(emailConnected ? (zadarmaConnected ? 'whatsapp' : 'phone') : 'email');
  const index = steps.findIndex((item) => item.id === step);
  const progress = Math.round(((index + 1) / steps.length) * 100);
  const completed: Record<SetupStep, boolean> = { company: true, email: emailConnected, phone: zadarmaConnected, whatsapp: whatsappConnected, schedule: calendarReady, call: retellConnected, whatsapp_test: whatsappConnected, email_test: emailConnected, quote: false, ready: false };
  const remaining = steps.filter((item) => !completed[item.id]).length;
  useEffect(() => {
    const payload = JSON.stringify({ eventName: 'onboarding_step_viewed', path: '/onboarding', source: 'installation_assistant', idempotencyKey: `onboarding:view:${step}`, metadata: { action: 'onboarding_step', label: step } });
    void fetch('/api/analytics/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(() => undefined);
  }, [step]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-14">
      <Link href="/" className="text-lg font-bold tracking-[-.07em]">EMPLEADO<span className="text-[#789500]">24</span></Link>
      <header className="mt-12 max-w-3xl">
        <p className="eyebrow">Tu puesta en marcha</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-.065em] md:text-6xl">Vamos a poner a {employeeName} a trabajar.</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--muted)]">En menos de 10 minutos tu oficina puede empezar a atender. Completa solo los pasos que necesite {companyName}; Laura te acompaña cuando lo necesites.</p>
      </header>

      <section className="mt-9 rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5 md:p-7" aria-label="Progreso de configuración">
        <div className="flex items-center justify-between gap-4 text-sm"><span className="font-semibold">{progress}% preparado</span><span className="text-[var(--muted)]">{remaining ? `${remaining} pasos · menos de 10 min` : 'Empresa lista'}</span></div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-[#ccff00] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
        <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((item, itemIndex) => <li key={item.id}><button type="button" onClick={() => setStep(item.id)} className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs transition ${item.id === step ? 'bg-[#111315] text-white dark:bg-[#f4f5f0] dark:text-[#111315]' : 'text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/5'}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${completed[item.id] ? 'bg-[#ccff00] text-[#111315]' : 'bg-black/10 dark:bg-white/10'}`}>{completed[item.id] ? <Check size={13} /> : itemIndex + 1}</span><span>{item.label}<small className="block opacity-60">{item.minutes}</small></span></button></li>)}
        </ol>
      </section>

      {configured && <p role="status" className="mt-6 rounded-2xl bg-[#efffcf] p-4 text-sm text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">{configured === 'calendar_skipped' ? 'Puedes conectar Calendar más adelante. Seguimos con tu Recepcionista.' : 'Conexión verificada. Seguimos con tu Recepcionista.'}</p>}
      <div className="mt-8">{step === 'company' && <EmployeeStep employeeName={employeeName} onBack={() => setStep('schedule')}>{children}</EmployeeStep>}{step === 'email' && <IntegrationStep icon={Mail} title="Conecta tu correo" gain="Podrás enviar seguimiento y presupuestos desde tu empresa." href="/app/integraciones/brevo" connected={emailConnected} next={() => setStep('phone')} />}{step === 'phone' && <ZadarmaStep connected={zadarmaConnected} onNext={() => setStep('whatsapp')} />}{step === 'whatsapp' && <IntegrationStep icon={MessageCircle} title="Conecta WhatsApp" gain="Responderás a tus clientes desde el canal que ya utilizan." href="/app/integraciones/whatsapp_meta" connected={whatsappConnected} next={() => setStep('schedule')} />}{step === 'schedule' && <CalendarStep connected={calendarConnected} skipped={calendarSkipped} onBack={() => setStep('whatsapp')} onNext={() => setStep('call')} />}{step === 'call' && <TestStep retellConnected={retellConnected} onBack={() => setStep('schedule')} />}{step === 'whatsapp_test' && <IntegrationStep icon={MessageCircle} title="Prueba WhatsApp" gain="Envía un mensaje de prueba y confirma que tu equipo responde." href="/app/whatsapp" connected={whatsappConnected} next={() => setStep('email_test')} />}{step === 'email_test' && <IntegrationStep icon={Mail} title="Envía tu primer email" gain="Verás un correo enviado desde tu espacio de empresa." href="/app/especialista-email" connected={emailConnected} next={() => setStep('quote')} />}{step === 'quote' && <IntegrationStep icon={Timer} title="Prepara tu primer presupuesto" gain="Comprueba cómo tu equipo prepara una propuesta rentable." href="/app/presupuestos" connected={false} next={() => setStep('ready')} />}{step === 'ready' && <ReadyStep companyName={companyName} />}</div>
    </main>
  );
}

function IntegrationStep({ icon: Icon, title, gain, href, connected, next }: { icon: typeof Mail; title: string; gain: string; href: string; connected: boolean; next: () => void }) { return <StepShell icon={Icon} eyebrow="Instalación guiada" title={connected ? `${title}: listo.` : title} detail={gain}><div className="mt-7 rounded-2xl border border-[var(--line)] p-5 text-sm leading-6 text-[var(--muted)]">{connected ? 'Conexión verificada. Puedes continuar o revisarla.' : 'Laura puede ayudarte si te atascas: no necesitas soporte humano para seguir.'}</div><div className="mt-7 flex flex-wrap gap-3"><Link className="action-primary" href={href}>{connected ? 'Revisar conexión' : 'Conectar ahora'} <ArrowRight size={16}/></Link><button className="action-ghost" type="button" onClick={next}>Continuar <ArrowRight size={16}/></button></div></StepShell>; }
function ReadyStep({ companyName }: { companyName: string }) { return <StepShell icon={Sparkles} eyebrow="Paso 10 · Empresa lista" title={`${companyName} ya tiene una oficina preparada.`} detail="Vuelve a tu espacio para ver el siguiente paso recomendado. Laura seguirá contigo cuando haya algo que completar."><Link className="action-primary mt-7" href="/app">Ir a mi oficina <ArrowRight size={16}/></Link></StepShell>; }

function PhoneChoiceStep({ onChoose }: { onChoose: (choice: 'new_number' | 'existing_fixed' | 'existing_mobile' | 'pbx') => void }) {
  return <StepShell icon={Phone} eyebrow="Paso 1 · Tu teléfono" title="¿Qué teléfono quieres utilizar?" detail="Puedes estrenar un número o mantener el que ya conocen tus clientes.">
    <div className="mt-7 grid gap-3 md:grid-cols-2">
      <ChoiceCard title="Quiero un número nuevo" detail="Compra uno y lo conectaremos automáticamente." onClick={() => onChoose('new_number')} />
      <ChoiceCard title="Quiero usar mi fijo actual" detail="Mantén tu número con un desvío o una portabilidad." onClick={() => onChoose('existing_fixed')} />
      <ChoiceCard title="Quiero usar mi móvil" detail="Conserva tu número y activa un desvío de llamadas." onClick={() => onChoose('existing_mobile')} />
      <ChoiceCard title="Tengo una centralita" detail="Estamos preparando esta conexión para tu centralita." disabled onClick={() => onChoose('pbx')} />
    </div>
    <Help title="¿Qué significa cada opción?"><p>Un número nuevo es la opción más rápida. Con tu fijo o móvil actual, las llamadas se desvían a tu Recepcionista sin cambiar el número que ya tienes.</p><p className="mt-3">En un móvil puedes activar el desvío desde Ajustes de llamadas (Android o iPhone) o pedirlo a tu operador (Movistar, Vodafone, Orange, Yoigo y Digi). La conexión con centralitas estará disponible próximamente.</p></Help>
  </StepShell>;
}

function ChoiceCard({ title, detail, disabled = false, onClick }: { title: string; detail: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="rounded-2xl border border-[var(--line)] p-5 text-left transition hover:border-[#789500] disabled:cursor-not-allowed disabled:opacity-60"><span className="font-semibold">{title}</span><span className="mt-2 block text-sm leading-6 text-[var(--muted)]">{detail}</span>{disabled && <span className="mt-3 inline-block text-xs font-semibold uppercase tracking-[.12em] text-[#789500]">Próximamente</span>}</button>;
}

function ZadarmaStep({ connected, onNext }: { connected: boolean; onNext: () => void }) {
  return <StepShell icon={Phone} eyebrow="Paso 2 · Conectar tu teléfono" title="Conecta el teléfono que has elegido." detail="Te guiaremos para comprar un número o conectar el que ya utilizas. Empleado24 no cambia tu número ni lo comparte.">
    <div className="mt-7 grid gap-3 sm:grid-cols-2"><a className="action-secondary" href="https://zadarma.com/es/order/numbers/" target="_blank" rel="noreferrer">Comprar un número <ExternalLink size={15} /></a><a className="action-secondary" href="https://my.zadarma.com/marketplace/#tab-apiKeys" target="_blank" rel="noreferrer">Crear claves de conexión <ExternalLink size={15} /></a></div>
    <div className="mt-5 rounded-2xl bg-[#efffcf] p-4 text-sm leading-6 text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">Cuando tengas el número y las credenciales, conéctalos y verifícalos. Después podrás continuar.</div>
    <Help title="Ayuda rápida · menos de 30 segundos"><ol className="list-decimal space-y-1 pl-5"><li>Compra un número local o activa un desvío.</li><li>Abre la página de claves y copia las dos claves.</li><li>Vuelve aquí y pulsa Conectar teléfono.</li></ol></Help>
    <div className="mt-7 flex flex-wrap gap-3"><Link className="action-primary" href="/app/integraciones/zadarma">{connected ? 'Revisar conexión' : 'Conectar teléfono'} <ArrowRight size={16} /></Link><button className="action-ghost disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!connected} onClick={onNext}>{connected ? 'Continuar' : 'Conecta tu teléfono para continuar'} <ArrowRight size={16} /></button></div>
  </StepShell>;
}

function CalendarStep({ connected, skipped, onBack, onNext }: { connected: boolean; skipped: boolean; onBack: () => void; onNext: () => void }) {
  return <StepShell icon={CalendarDays} eyebrow="Paso 3 · Tu agenda" title="Que nunca se solape una cita." detail="Conecta Google Calendar para que tu Recepcionista pueda consultar disponibilidad y reservar sin que tengas que intervenir.">
    <div className="mt-7 rounded-2xl border border-[var(--line)] p-5"><p className="font-medium">{connected ? 'Google Calendar ya está conectado.' : skipped ? 'Has dejado Calendar para más adelante.' : 'Todavía no hay una agenda conectada.'}</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Puedes omitir este paso. Sin Calendar, la IA no podrá reservar citas automáticamente.</p></div>
    <Help title="Ayuda rápida · menos de 30 segundos"><p>Autoriza la cuenta que utilizas para gestionar tus citas. No compartiremos tu calendario con ninguna otra empresa.</p></Help>
    <div className="mt-7 flex flex-wrap gap-3"><Link className="action-primary" href="/app/integraciones/google_calendar">{connected ? 'Revisar Calendar' : 'Conectar Google Calendar'} <ArrowRight size={16} /></Link>{!connected && !skipped && <form action={skipGoogleCalendar}><button className="action-ghost" type="submit">Omitir por ahora <ArrowRight size={16} /></button></form>}<button className="action-ghost" type="button" onClick={onNext}>Continuar <ArrowRight size={16} /></button><button className="action-ghost" type="button" onClick={onBack}><ArrowLeft size={16} /> Atrás</button></div>
  </StepShell>;
}

function EmployeeStep({ employeeName, onBack, children }: { employeeName: string; onBack: () => void; children: ReactNode }) {
  return <StepShell icon={Headphones} eyebrow="Paso 4 · Tu empleado" title={`${employeeName} está listo para conocerte.`} detail="Cuéntale cómo funciona tu empresa y nosotros prepararemos su forma de trabajar."><Help title="Ayuda rápida · qué necesita saber"><p>Piensa en tres cosas: qué debe resolver, cómo debe saludar y cuándo debe pedir ayuda a una persona.</p></Help><div className="mt-7">{children}</div><button className="action-ghost mt-4" type="button" onClick={onBack}><ArrowLeft size={16} /> Atrás</button></StepShell>;
}

function TestStep({ retellConnected, onBack }: { retellConnected: boolean; onBack: () => void }) {
  return <StepShell icon={Sparkles} eyebrow="Paso 5 · Primera llamada" title="Ya casi está trabajando." detail={retellConnected ? 'Su conexión está preparada. Haz una llamada de prueba para escuchar cómo atiende.' : 'Cuando conectes su línea, aquí podrás hacer una llamada de prueba y comprobar que todo está en su sitio.'}><div className="mt-7 rounded-2xl bg-[#efffcf] p-5 text-sm leading-6 text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">Ve a Tu Recepcionista para preparar la línea y pulsar “Llamarme ahora”.</div><div className="mt-7 flex flex-wrap gap-3"><Link className="action-primary" href="/app/recepcionista?prepare=1">Ir a la llamada de prueba <ArrowRight size={16} /></Link><button className="action-ghost" type="button" onClick={onBack}><ArrowLeft size={16} /> Atrás</button></div></StepShell>;
}

function StepShell({ icon: Icon, eyebrow, title, detail, children }: { icon: typeof Phone; eyebrow: string; title: string; detail: string; children: ReactNode }) {
  return <section className="surface rounded-3xl p-6 md:p-9"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ccff00] text-[#111315]"><Icon size={21} /></span><p className="eyebrow mt-7">{eyebrow}</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-.055em] md:text-4xl">{title}</h2><p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">{detail}</p>{children}</section>;
}

function Help({ title, children }: { title: string; children: ReactNode }) {
  return <details className="mt-5 rounded-2xl border border-[var(--line)] p-4 text-sm"><summary className="cursor-pointer font-medium">{title}</summary><div className="mt-3 leading-6 text-[var(--muted)]">{children}</div></details>;
}
