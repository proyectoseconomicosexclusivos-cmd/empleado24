import Link from 'next/link';
import { ArrowRight, CalendarCheck, Check, Mail, MessageCircle, PhoneCall, Sparkles, UserRoundCheck } from 'lucide-react';

type FirstDayGuideProps = {
  employeeReady: boolean;
  phoneReady: boolean;
  whatsappReady: boolean;
  emailReady: boolean;
  calendarReady: boolean;
  firstCallReady: boolean;
};

export function FirstDayGuide({ employeeReady, phoneReady, whatsappReady, emailReady, calendarReady, firstCallReady }: FirstDayGuideProps) {
  const items = [
    { label: 'Conoce a Laura', detail: 'Tu oficina ya incluye una compañera preparada para aprender cómo atiendes.', href: '/onboarding', done: employeeReady, icon: UserRoundCheck },
    { label: 'Conecta tu teléfono', detail: 'Así Laura podrá atender a las personas que ya llaman a tu empresa.', href: '/app/integraciones/zadarma', done: phoneReady, icon: PhoneCall },
    { label: 'Conecta WhatsApp', detail: 'Cuando lo necesites, tu equipo podrá responder desde el canal de tus clientes.', href: '/app/integraciones/whatsapp_meta', done: whatsappReady, icon: MessageCircle },
    { label: 'Conecta el email', detail: 'Usa la cuenta de tu empresa para enviar seguimiento y presupuestos.', href: '/app/integraciones/brevo', done: emailReady, icon: Mail },
    { label: 'Prepara tu agenda', detail: 'Conecta el calendario para reservar citas sin cruzarlas.', href: '/app/integraciones/google_calendar', done: calendarReady, icon: CalendarCheck },
    { label: 'Haz la primera llamada', detail: 'Comprueba cómo trabaja tu oficina y deja listo el siguiente paso.', href: '/app/primera-llamada', done: firstCallReady, icon: Sparkles },
  ];
  const complete = items.filter((item) => item.done).length;
  const next = items.find((item) => !item.done);

  return (
    <section className="mt-10 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(17,19,21,.05)] md:p-8" aria-labelledby="first-day-title">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="eyebrow">Primer día</p>
          <h2 id="first-day-title" className="mt-2 text-2xl font-semibold tracking-[-.04em]">Tu oficina está preparada. Tú marcas el siguiente paso.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Laura, el historial compartido y tu espacio de trabajo ya están listos. Conecta solo lo que necesites para empezar hoy.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#efffcf] px-3 py-1.5 text-sm font-semibold text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">{complete}/{items.length} listos</span>
      </div>
      {next && <Link href={next.href} className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-[#111315] px-5 py-4 text-white transition hover:-translate-y-0.5 dark:bg-[#ccff00] dark:text-[#111315]"><span><span className="block text-xs text-white/60 dark:text-[#111315]/60">Siguiente paso recomendado</span><span className="mt-1 block font-semibold">{next.label}</span></span><ArrowRight size={17} /></Link>}
      <ol className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ label, detail, href, done, icon: Icon }) => (
          <li key={label} className="rounded-2xl border border-[var(--line)] p-4">
            <div className="flex items-start gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${done ? 'bg-[#efffcf] text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]' : 'bg-black/5 text-[var(--muted)] dark:bg-white/5'}`}>{done ? <Check size={16} /> : <Icon size={16} />}</span><div className="min-w-0"><p className="font-medium">{label}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{done ? 'Listo con los datos de tu empresa.' : detail}</p>{!done && <Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#526a00] hover:underline dark:text-[#d5f899]">Guíame <ArrowRight size={13} /></Link>}</div></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
