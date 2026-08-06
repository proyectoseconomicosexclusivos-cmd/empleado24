'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Clock3,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { EmployeeAvatar } from '@/components/employee-avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { employeeShowcase, hiringHref } from '@/lib/employee-showcase';

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.1 },
  transition: { duration: 0.42 },
};

function Section({ id, children, className = '' }: { id?: string; children: React.ReactNode; className?: string }) {
  return <section id={id} className={`mx-auto max-w-7xl px-5 py-16 sm:px-6 md:px-10 md:py-24 ${className}`}>{children}</section>;
}

const defaultHero = {
  title: 'DEJA DE PERDER CLIENTES',
  emphasis: 'CUANDO NO PUEDES ATENDERLOS',
  description: 'Incorpora a Laura a tu empresa por 97 €/mes. Atiende llamadas, organiza citas y deja a tu equipo lo que realmente necesita una persona.',
};

export default function Home() {
  const [hero, setHero] = useState(defaultHero);

  useEffect(() => {
    const anonymousId = document.cookie.split('; ').find((entry) => entry.startsWith('e24_anon='))?.split('=')[1];
    if (!anonymousId) return;
    void fetch(`/api/conversion/experiment?target=homepage_headline&anonymousId=${encodeURIComponent(decodeURIComponent(anonymousId))}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { experiment?: { message?: string; submessage?: string } | null } | null) => {
        const message = payload?.experiment?.message;
        if (!message) return;
        const [title, emphasis] = message.split('\n');
        setHero({ title: title || defaultHero.title, emphasis: emphasis || defaultHero.emphasis, description: payload?.experiment?.submessage || defaultHero.description });
      })
      .catch(() => undefined);
  }, []);

  return (
    <main>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[color:var(--bg)]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 md:px-10">
          <Link className="text-lg font-bold tracking-[-.07em]" href="#inicio">EMPLEADO<span className="text-[#789500]">24</span></Link>
          <nav className="hidden items-center gap-7 text-sm text-[var(--muted)] md:flex">
            <Link href="#como-trabaja">Así trabaja</Link>
            <Link href="#equipo">El equipo</Link>
            <Link href="#preguntas">Preguntas</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/?laura_chat=1#hablar-con-laura" data-e24-track="nav_try_laura" data-e24-zone="navigation" className={buttonVariants({ variant: 'lime' })}>
              Hablar con Laura <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <section id="inicio" className="grid-bg relative overflow-hidden pt-16">
        <div className="noise" />
        <Section className="relative py-16 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.06fr_.94fr] lg:gap-16">
            <motion.div {...reveal}>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#cfe69a] bg-[#f8ffe9] px-3 py-1.5 text-xs font-medium text-[#486500] dark:border-[#405422] dark:bg-[#202900] dark:text-[#d5f899]">
                <i className="h-1.5 w-1.5 rounded-full bg-[#789500]" /> Tu primer empleado desde 97 €/mes
              </span>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-.078em] sm:text-6xl md:text-7xl">
                <span className="block">{hero.title}</span>
                <span className="block text-[#789500]">{hero.emphasis}</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">{hero.description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/?laura_chat=1#hablar-con-laura" data-e24-track="hero_try_laura" data-e24-zone="hero" className={`${buttonVariants({ variant: 'lime' })} min-h-12 px-6 text-base`}>
                  Probar a Laura ahora <ArrowRight size={17} />
                </Link>
                <Link href="#equipo" data-e24-track="hero_view_team" data-e24-zone="hero" className={`${buttonVariants({ variant: 'outline' })} min-h-12 px-6 text-base`}>
                  Ver el equipo
                </Link>
              </div>
              <div className="mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[['97 €/mes', 'Precio claro'], ['3 días', 'Para comprobarlo'], ['Sin permanencia', 'Cancelas cuando quieras']].map(([number, label]) => (
                  <div key={number} className="border-l border-[#789500] pl-3"><p className="font-semibold">{number}</p><p className="mt-1 text-xs text-[var(--muted)]">{label}</p></div>
                ))}
              </div>
            </motion.div>
            <HeroConversation />
          </div>
        </Section>
      </section>

      <section className="border-y border-[var(--line)] bg-[#111315] text-white">
        <Section className="py-8 md:py-10">
          <div className="grid gap-5 text-center sm:grid-cols-3 sm:text-left">
            <Proof icon={PhoneCall} title="No dejas llamadas sin respuesta" detail="Laura atiende las llamadas con la información de tu empresa." />
            <Proof icon={Clock3} title="Tu equipo recupera tiempo" detail="Las tareas repetitivas dejan espacio para el trabajo importante." />
            <Proof icon={ShieldCheck} title="Tú mantienes el control" detail="Revisas la actividad y decides qué conecta cada empleado." />
          </div>
        </Section>
      </section>

      <Section id="como-trabaja">
        <div className="max-w-3xl">
          <p className="eyebrow">Así trabaja tu equipo</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-.065em] md:text-6xl">Un cliente escribe. Tu empresa no se detiene.</h2>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">No necesitas aprender una herramienta nueva para entender el resultado. Ves qué ocurrió y qué sigue.</p>
        </div>
        <LiveWorkflow />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/?laura_chat=1#hablar-con-laura" data-e24-track="workflow_try_laura" data-e24-zone="workflow" className={buttonVariants({ variant: 'lime' })}>Ver cómo lo haría Laura <ArrowRight size={15} /></Link>
          <Link href="#equipo" className={buttonVariants({ variant: 'outline' })}>Conocer al equipo</Link>
        </div>
      </Section>

      <section className="border-y border-[var(--line)] bg-black/[.018] dark:bg-white/[.018]">
        <Section>
          <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <div>
              <p className="eyebrow">El coste de esperar</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-.065em] md:text-5xl">Una recepcionista no tiene por qué costarte 1.600 €/mes.</h2>
              <p className="mt-5 leading-7 text-[var(--muted)]">Laura empieza por 97 €/mes. Atiende cada día, no tiene vacaciones ni turnos, y tú defines cuándo interviene una persona de tu equipo.</p>
              <Link href="/register?employee=one_employee&from=home-comparison" data-e24-track="comparison_start" data-e24-zone="comparison" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4">Empezar con Laura <ArrowRight size={15} /></Link>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--card)]">
              <div className="grid grid-cols-3 bg-[#111315] px-5 py-4 text-sm font-semibold text-white sm:px-7"><span>Equipo</span><span>Al mes</span><span>Disponibilidad</span></div>
              <ComparisonRow name="Recepcionista humana" price="≈ 1.600 €" availability="Horario laboral" muted />
              <ComparisonRow name="Laura · Recepcionista" price="97 €" availability="24 horas" highlight />
              <div className="border-t border-[var(--line)] bg-[#f8ffe9] px-5 py-4 text-sm font-semibold text-[#486500] dark:bg-[#202900] dark:text-[#d5f899] sm:px-7">Diferencia orientativa: 1.503 €/mes antes de costes adicionales de contratación.</div>
            </div>
          </div>
        </Section>
      </section>

      <Section id="equipo">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="eyebrow">Elige cómo crecer</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-.065em] md:text-6xl">Empieza por una persona. Añade un equipo cuando lo necesites.</h2>
          </div>
          <Link href="/?laura_chat=1#hablar-con-laura" data-e24-track="team_ask_laura" data-e24-zone="team" className={buttonVariants({ variant: 'outline' })}>No sé por dónde empezar</Link>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <ChoiceCard number="01" title="Un empleado" detail="Empieza por el trabajo que más tiempo te quita ahora." cta="Ver empleados" href="#personas" active />
          <ChoiceCard number="02" title="Un departamento" detail="Para atención, seguimiento y ventas que trabajan juntas." cta="Conocer el equipo comercial" href="/register?employee=department_commercial&from=home-department" active />
          <ChoiceCard number="03" title="Tu empresa completa" detail="Añade nuevas personas a medida que lo necesita tu negocio." cta="Pedir recomendación" href="/?laura_chat=1#hablar-con-laura" />
        </div>
        <div id="personas" className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {employeeShowcase.map((employee) => <EmployeeCard key={employee.slug} employee={employee} />)}
        </div>
      </Section>

      <section className="border-y border-[var(--line)] bg-[#111315] text-white">
        <Section className="grid gap-10 lg:grid-cols-[1fr_.9fr] lg:items-center">
          <div>
            <p className="eyebrow text-white/55">Antes de pagar</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-.065em] md:text-6xl">En menos de dos minutos sabes quién necesitas.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">Laura entiende tu problema, te recomienda una persona y explica qué tendrás que conectar. La prueba empieza antes de cualquier decisión a largo plazo.</p>
            <Link href="/?laura_chat=1#hablar-con-laura" data-e24-track="final_try_laura" data-e24-zone="final_cta" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-6 py-3.5 font-semibold text-[#111315]">Hablar con Laura ahora <ArrowRight size={17} /></Link>
          </div>
          <div className="rounded-[2rem] bg-white p-6 text-[#111315] sm:p-8">
            <p className="text-sm font-semibold text-[#789500]">Tu incorporación</p>
            {[['1', 'Cuéntale a Laura qué te frena'], ['2', 'Elige el primer empleado'], ['3', 'Crea tu empresa y prueba 3 días'], ['4', 'Conecta solo lo necesario y empieza']].map(([step, text]) => <div key={step} className="mt-5 flex items-center gap-4 border-b border-[#e6e6df] pb-5 last:border-0 last:pb-0"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#efffcf] text-sm font-bold text-[#486500]">{step}</span><p className="font-medium">{text}</p></div>)}
          </div>
        </Section>
      </section>

      <Section id="preguntas">
        <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
          <div><p className="eyebrow">Todo claro</p><h2 className="mt-3 text-4xl font-semibold tracking-[-.065em] md:text-5xl">Sin letra pequeña antes de empezar.</h2><p className="mt-5 leading-7 text-[var(--muted)]">El precio, la prueba y la incorporación están claros antes de contratar.</p></div>
          <div className="grid gap-3">
            {[
              ['¿Hay permanencia?', 'No. Puedes cancelar desde el área de tu empresa cuando quieras.'],
              ['¿Qué ocurre después del pago?', 'Empiezas una incorporación guiada y conectas únicamente lo que necesite el empleado elegido.'],
              ['¿Tengo que instalar algo?', 'No. El proceso se realiza desde tu espacio de Empleado24 y las integraciones que elijas.'],
              ['¿Puedo empezar por una sola persona?', 'Sí. La mayoría de empresas empieza por el problema más urgente y amplía después.'],
            ].map(([question, answer]) => <article key={question} className="surface rounded-2xl p-5"><h3 className="font-semibold">{question}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{answer}</p></article>)}
          </div>
        </div>
      </Section>

      <footer className="border-t border-[var(--line)]"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-sm text-[var(--muted)] sm:px-6 md:flex-row md:items-center md:justify-between md:px-10"><div><b className="text-lg text-[var(--fg)]">EMPLEADO<span className="text-[#789500]">24</span></b><p className="mt-2">Personas virtuales que trabajan para tu empresa.</p></div><div className="flex flex-wrap gap-5"><Link href="/login">Entrar en mi empresa</Link><Link href="#equipo">Ver el equipo</Link><Link href="/?laura_chat=1#hablar-con-laura">Hablar con Laura</Link></div></div></footer>
    </main>
  );
}

function HeroConversation() {
  return <motion.div {...reveal} className="overflow-hidden rounded-[2rem] border border-[#cfe69a] bg-[#f9ffe9] shadow-2xl shadow-black/10 dark:border-[#405422] dark:bg-[#202900]">
    <div className="flex items-center gap-3 border-b border-[#cfe69a] px-5 py-4 dark:border-[#405422]"><EmployeeAvatar portrait="/employees/laura.jpg" name="Laura" objectPosition="50% 22%" className="h-10 w-10" /><div><p className="font-semibold">Laura · Recepcionista</p><p className="text-xs text-[#486500] dark:text-[#d5f899]">Disponible para tu empresa</p></div><span className="ml-auto h-2.5 w-2.5 rounded-full bg-[#789500]" /></div>
    <div className="space-y-4 p-5 sm:p-7"><div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white p-4 text-sm leading-6 shadow-sm dark:bg-[#111315]">Hola, soy Laura. ¿A qué se dedica tu empresa?</div><div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[#111315] p-4 text-sm leading-6 text-white">Tenemos muchas llamadas y no llegamos a todas.</div><div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white p-4 text-sm leading-6 shadow-sm dark:bg-[#111315]">Puedo atenderlas, recoger lo importante y organizar citas para que no pierdas oportunidades.</div></div>
    <div className="border-t border-[#cfe69a] px-5 py-4 dark:border-[#405422]"><Link href="/?laura_chat=1#hablar-con-laura" data-e24-track="hero_conversation_open" data-e24-zone="hero_conversation" className="inline-flex items-center gap-2 text-sm font-semibold text-[#486500] underline underline-offset-4 dark:text-[#d5f899]">Hablar con Laura sobre mi empresa <ArrowRight size={15} /></Link></div>
  </motion.div>;
}

function Proof({ icon: Icon, title, detail }: { icon: typeof PhoneCall; title: string; detail: string }) { return <div className="flex gap-3"><Icon className="mt-0.5 shrink-0 text-[#ccff00]" size={20} /><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-5 text-white/62">{detail}</p></div></div>; }

function LiveWorkflow() {
  const steps = [['Cliente', '“¿Podéis atenderme esta semana?”'], ['Laura', 'Recoge la necesidad y propone una cita'], ['Carlos', 'Recibe la oportunidad y prepara el seguimiento'], ['Tu empresa', 'Decide y continúa la conversación']];
  return <div className="mt-10 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--card)]"><div className="flex flex-col justify-between gap-2 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-center sm:px-7"><div><p className="eyebrow">DEMO</p><h3 className="mt-1 text-xl font-semibold">Así se mueve una oportunidad</h3></div><span className="rounded-full bg-[#fff4c2] px-3 py-1.5 text-xs font-medium text-[#6e5a00] dark:bg-[#3d3300] dark:text-[#ffe78a]">Ejemplo de funcionamiento</span></div><ol className="grid divide-y divide-[var(--line)] md:grid-cols-4 md:divide-x md:divide-y-0">{steps.map(([name, detail], index) => <li key={name} className="relative p-6"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#efffcf] text-sm font-bold text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">{index + 1}</span><p className="mt-8 font-semibold">{name}</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p></li>)}</ol></div>;
}

function ComparisonRow({ name, price, availability, muted, highlight }: { name: string; price: string; availability: string; muted?: boolean; highlight?: boolean }) { return <div className={`grid grid-cols-3 gap-3 border-t border-[var(--line)] px-5 py-5 text-sm sm:px-7 ${highlight ? 'bg-[#f8ffe9] dark:bg-[#202900]' : ''}`}><span className={muted ? 'text-[var(--muted)]' : 'font-semibold'}>{name}</span><span className={highlight ? 'font-semibold text-[#486500] dark:text-[#d5f899]' : 'text-[var(--muted)]'}>{price}</span><span className="text-[var(--muted)]">{availability}</span></div>; }

function ChoiceCard({ number, title, detail, cta, href, active }: { number: string; title: string; detail: string; cta: string; href: string; active?: boolean }) { return <article className={`rounded-[2rem] border p-6 ${active ? 'border-[#b5d95a] bg-[#f9ffe9] dark:border-[#405422] dark:bg-[#202900]' : 'border-[var(--line)] bg-[var(--card)]'}`}><span className="font-mono text-xs text-[#789500]">{number}</span><h3 className="mt-8 text-2xl font-semibold">{title}</h3><p className="mt-3 min-h-12 text-sm leading-6 text-[var(--muted)]">{detail}</p><Link href={href} data-e24-track={`choice_${number}`} data-e24-zone="choice" className="mt-7 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">{cta} <ArrowRight size={14} /></Link></article>; }

function EmployeeCard({ employee }: { employee: (typeof employeeShowcase)[number] }) {
  return <motion.article {...reveal} className="surface group overflow-hidden rounded-[2rem] p-3 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10"><div className="relative aspect-[1.32/1] overflow-hidden rounded-[1.45rem] bg-[#dfe8c2]"><EmployeeAvatar portrait={employee.portrait} name={employee.person} objectPosition={employee.portraitPosition} className="h-full w-full rounded-none transition duration-500 group-hover:scale-[1.03]" /><span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">{employee.person} · Disponible</span></div><div className="p-4 pb-3"><p className="text-xs font-semibold uppercase tracking-[.13em] text-[#789500]">{employee.specialty}</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.05em]">{employee.name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">{employee.role}</p><div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"><span className="text-lg font-semibold">{employee.price}</span><div className="flex gap-2"><Link href={`/empleados/${employee.slug}`} data-e24-track={`employee_info_${employee.slug}`} data-e24-zone="employee_card" className="rounded-full border border-[var(--line)] px-3 py-2 text-sm font-semibold">Ver más</Link><Link href={hiringHref(employee)} data-e24-track={`employee_contract_${employee.slug}`} data-e24-zone="employee_card" className="inline-flex items-center gap-1 rounded-full bg-[#111315] px-3 py-2 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]">Contratar <ArrowRight size={14} /></Link></div></div></div></motion.article>;
}
