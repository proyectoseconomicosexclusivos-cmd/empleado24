'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock3,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 },
  transition: { duration: 0.45 },
};

type EmployeeCard = {
  name: string;
  role: string;
  description: string;
  benefits: string[];
  price: string;
  icon: LucideIcon;
  href?: string;
  available: boolean;
};

const employees: EmployeeCard[] = [
  {
    name: 'Recepcionista IA',
    role: 'Atiende tus llamadas y organiza tus citas',
    description: 'Recibe a tus clientes, responde sus preguntas y te deja solo aquello que requiere tu atención.',
    benefits: ['Disponible todos los días', 'Habla como tu empresa', 'Lista en menos de 5 minutos'],
    price: '97 €/mes',
    icon: Headphones,
    href: '/register',
    available: true,
  },
  {
    name: 'Especialista Email IA',
    role: 'Mantiene el contacto con tus clientes',
    description: 'Prepara tus comunicaciones, organiza contactos y trabaja desde la cuenta de envío de tu empresa.',
    benefits: ['Contactos separados por empresa', 'Mensajes y campañas organizados', 'Cuenta de envío propia'],
    price: '97 €/mes',
    icon: Mail,
    href: '/register',
    available: true,
  },
  {
    name: 'Closer IA',
    role: 'Da seguimiento a oportunidades',
    description: 'Mantiene conversaciones comerciales y ayuda a convertir el interés en una decisión.',
    benefits: ['Seguimiento constante', 'Prioriza oportunidades', 'Acompaña cada venta'],
    price: '197 €/mes',
    icon: TrendingUp,
    href: '/register',
    available: true,
  },
  {
    name: 'Redes Sociales IA',
    role: 'Cuida la presencia de tu empresa',
    description: 'Ayuda a mantener una comunicación constante con tu comunidad y tus futuros clientes.',
    benefits: ['Calendario organizado', 'Tono de tu empresa', 'Presencia constante'],
    price: 'Próximamente',
    icon: MessageCircle,
    available: false,
  },
  {
    name: 'Atención al Cliente IA',
    role: 'Resuelve dudas y acompaña a tus clientes',
    description: 'Atiende consultas frecuentes y sabe cuándo pedir ayuda a una persona de tu equipo.',
    benefits: ['Respuestas rápidas', 'Atención consistente', 'Escalado cuando hace falta'],
    price: 'Próximamente',
    icon: UserRoundCheck,
    available: false,
  },
  {
    name: 'Secretaria IA',
    role: 'Ordena agenda y tareas',
    description: 'Mantiene citas, recordatorios y asuntos importantes bajo control durante toda la jornada.',
    benefits: ['Agenda al día', 'Recordatorios claros', 'Menos tareas pendientes'],
    price: 'Próximamente',
    icon: CalendarCheck,
    available: false,
  },
  {
    name: 'Administrativo IA',
    role: 'Mantiene el trabajo diario organizado',
    description: 'Ayuda con el seguimiento de documentos, solicitudes y tareas repetitivas de tu empresa.',
    benefits: ['Más orden', 'Seguimiento continuo', 'Menos trabajo repetitivo'],
    price: 'Próximamente',
    icon: Users,
    available: false,
  },
];

const comparison = [
  ['Disponibilidad', 'Depende del horario', '24 horas al día'],
  ['Coste', 'Salario y costes laborales', 'Desde 97 €/mes'],
  ['Vacaciones', 'Necesita sustitución', 'Sigue trabajando'],
  ['Incorporación', 'Semanas de selección y formación', 'Menos de 5 minutos'],
  ['Crecimiento', 'Nueva contratación', 'Añade otro empleado'],
];

function Section({ id, children, className = '' }: { id?: string; children: React.ReactNode; className?: string }) {
  return <section id={id} className={`mx-auto max-w-7xl px-5 py-20 sm:px-6 md:px-10 md:py-28 ${className}`}>{children}</section>;
}

export default function Home() {
  return (
    <main>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[color:var(--bg)]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 md:px-10">
          <Link className="text-lg font-bold tracking-[-.07em]" href="#inicio">EMPLEADO<span className="text-[#789500]">24</span></Link>
          <nav aria-label="Principal" className="hidden gap-7 text-sm text-[var(--muted)] md:flex">
            <Link href="#empleados">Empleados</Link>
            <Link href="#como-funciona">Cómo funciona</Link>
            <Link href="#comparativa">Por qué Empleado24</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/register" className={buttonVariants({ variant: 'lime' })}>Contratar <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </header>

      <section id="inicio" className="grid-bg relative overflow-hidden pt-16">
        <div className="noise" />
        <Section className="relative py-20 md:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-16">
            <motion.div {...reveal}>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-xs">
                <i className="h-1.5 w-1.5 rounded-full bg-[#789500]" /> Tu primer empleado puede empezar hoy
              </span>
              <h1 className="mt-7 text-5xl font-semibold tracking-[-.075em] sm:text-6xl md:text-7xl">Contrata empleados con IA para tu empresa.</h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)]">Trabajan 24 horas al día. No enferman. No tienen vacaciones. No necesitan formación. Desde solo <strong className="font-semibold text-[var(--fg)]">97 €/mes</strong>.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className={buttonVariants({ variant: 'lime' })}>Contratar mi primer empleado <ArrowRight size={16} /></Link>
                <Link href="#empleados" className={buttonVariants({ variant: 'outline' })}>Ver empleados</Link>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--muted)]">
                {['3 días para probarlo', 'Sin permanencia', 'Incorporación guiada'].map((item) => <span key={item} className="flex items-center gap-2"><Check size={15} className="text-[#789500]" />{item}</span>)}
              </div>
            </motion.div>
            <TeamPreview />
          </div>
        </Section>
      </section>

      <Section id="empleados">
        <div className="max-w-3xl">
          <p className="eyebrow">Empleados disponibles</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-6xl">Elige quién se incorpora hoy.</h2>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">No instalas una herramienta. Contratas a alguien que llega con una función clara y aprende cómo trabaja tu empresa.</p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {employees.map((employee, index) => <Employee key={employee.name} employee={employee} featured={index < 2} />)}
        </div>
      </Section>

      <section className="border-y border-[var(--line)] bg-black/[.018] dark:bg-white/[.018]">
        <Section id="como-funciona">
          <p className="eyebrow">En menos de 5 minutos</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.06em] md:text-6xl">De elegirlo a verlo trabajar.</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              ['01', 'Crear tu cuenta', 'Dinos quién incorpora al nuevo miembro del equipo.'],
              ['02', 'Elegir empleado', 'Elige la función que quieres cubrir primero.'],
              ['03', 'Confirmar contratación', 'Revisa el precio y empieza tus 3 días de prueba.'],
              ['04', 'Empieza a trabajar', 'Completa su bienvenida y comprueba el resultado.'],
            ].map(([number, title, detail]) => (
              <motion.article {...reveal} key={number} className="surface rounded-3xl p-6">
                <span className="font-mono text-xs text-[#789500]">{number}</span>
                <h3 className="mt-12 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{detail}</p>
              </motion.article>
            ))}
          </div>
        </Section>
      </section>

      <Section id="comparativa">
        <div className="grid gap-12 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
          <div>
            <p className="eyebrow">Una contratación diferente</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-5xl">Más capacidad sin ampliar la plantilla tradicional.</h2>
            <p className="mt-5 leading-7 text-[var(--muted)]">Incorpora ayuda para el trabajo repetitivo y deja a tu equipo humano las decisiones, las relaciones y los casos que de verdad lo necesitan.</p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--card)]">
            <div className="grid grid-cols-[1fr_.9fr_.9fr] border-b border-[var(--line)] bg-[#111315] px-4 py-4 text-xs font-semibold text-white sm:px-6">
              <span>Comparativa</span><span>Tradicional</span><span className="text-[#ccff00]">Empleado IA</span>
            </div>
            {comparison.map(([label, traditional, ai]) => (
              <div key={label} className="grid grid-cols-[1fr_.9fr_.9fr] gap-2 border-b border-[var(--line)] px-4 py-5 text-xs last:border-b-0 sm:px-6 sm:text-sm">
                <strong className="font-medium">{label}</strong><span className="text-[var(--muted)]">{traditional}</span><span>{ai}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <section className="bg-[#111315] text-white dark:bg-[#ccff00] dark:text-[#111315]">
        <Section>
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="eyebrow text-white/55 dark:text-[#111315]/60">Oferta de lanzamiento</p>
              <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.06em] md:text-6xl">Prueba a tu primer empleado durante 3 días.</h2>
              <p className="mt-5 max-w-2xl leading-7 text-white/65 dark:text-[#111315]/65">Hoy pagas 0 €. Después, desde 97 €/mes. Verás la fecha del primer cobro antes de confirmar y podrás cancelar si no encaja.</p>
            </div>
            <Link href="/register" className="inline-flex w-fit items-center gap-2 rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-[#111315] dark:bg-[#111315] dark:text-white">Empezar ahora <ArrowRight size={17} /></Link>
          </div>
        </Section>
      </section>

      <Section>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [ShieldCheck, 'Tus datos siguen siendo tuyos', 'Cada empresa trabaja en su espacio privado.'],
            [Clock3, 'Empieza hoy', 'La incorporación está guiada paso a paso.'],
            [Scale, 'Control total', 'Consulta actividad, consumo y documentos cuando quieras.'],
          ].map(([Icon, title, detail]) => {
            const CardIcon = Icon as LucideIcon;
            return <article key={String(title)} className="surface rounded-3xl p-6"><CardIcon className="text-[#789500]" size={21} /><h3 className="mt-10 text-lg font-semibold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{String(detail)}</p></article>;
          })}
        </div>
      </Section>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 text-sm text-[var(--muted)] sm:px-6 md:flex-row md:items-end md:justify-between md:px-10">
          <div><b className="text-lg text-[var(--fg)]">EMPLEADO<span className="text-[#789500]">24</span></b><p className="mt-3">Empleados con IA preparados para formar parte de tu empresa.</p></div>
          <div className="flex flex-wrap gap-6"><Link href="/login">Entrar en mi empresa</Link><Link href="#empleados">Ver empleados</Link><Link href="/register">Contratar</Link></div>
        </div>
      </footer>
    </main>
  );
}

function Employee({ employee, featured }: { employee: EmployeeCard; featured: boolean }) {
  const Icon = employee.icon;
  return (
    <motion.article {...reveal} className={`relative overflow-hidden rounded-[2rem] border p-6 sm:p-8 ${featured ? 'border-[#9abd00] bg-[#f9ffe9] dark:bg-[#202900]' : 'border-[var(--line)] bg-[var(--card)]'}`}>
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#111315] text-[#ccff00] dark:bg-[#f4f5f0] dark:text-[#526a00]"><Icon size={23} /></span>
        <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${employee.available ? 'bg-[#e9ffcf] text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]' : 'bg-black/5 text-[var(--muted)] dark:bg-white/5'}`}>{employee.available ? 'Disponible' : 'Próximamente'}</span>
      </div>
      <p className="eyebrow mt-10">{employee.role}</p>
      <h3 className="mt-2 text-3xl font-semibold tracking-[-.05em]">{employee.name}</h3>
      <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">{employee.description}</p>
      <ul className="mt-6 grid gap-3 text-sm">{employee.benefits.map((benefit) => <li key={benefit} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#789500]" />{benefit}</li>)}</ul>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-6">
        <p className="text-2xl font-semibold tracking-[-.04em]">{employee.price}</p>
        {employee.available && employee.href ? <Link href={employee.href} className={buttonVariants({ variant: 'default' })}>Contratar <ArrowRight size={15} /></Link> : <span className="text-sm font-medium text-[var(--muted)]">Te avisaremos cuando esté disponible</span>}
      </div>
    </motion.article>
  );
}

function TeamPreview() {
  return (
    <motion.div {...reveal} className="surface rounded-[2rem] p-4 shadow-2xl shadow-black/10">
      <div className="flex items-center justify-between border-b border-[var(--line)] p-3">
        <span className="text-sm font-semibold">Tu equipo Empleado24</span>
        <span className="rounded-full bg-black/5 px-2 py-1 text-[10px] text-[var(--muted)] dark:bg-white/5">Listos para incorporar</span>
      </div>
      <div className="grid gap-3 p-3 pt-4">
        {[
          [Headphones, 'Recepcionista IA', 'Atiende llamadas y citas', 'Disponible'],
          [Mail, 'Especialista Email IA', 'Cuida contactos y campañas', 'Disponible'],
          [TrendingUp, 'Closer IA', 'Da seguimiento a oportunidades', 'Disponible'],
        ].map(([EmployeeIcon, name, role, status]) => {
          const Icon = EmployeeIcon as LucideIcon;
          return <div key={String(name)} className="flex items-center gap-4 rounded-2xl border border-[var(--line)] p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#efffcf] text-[#526a00] dark:bg-[#263300] dark:text-[#d7f897]"><Icon size={18} /></span><div className="min-w-0 flex-1"><p className="font-semibold">{String(name)}</p><p className="mt-1 text-xs text-[var(--muted)]">{String(role)}</p></div><span className={`hidden text-xs sm:block ${status === 'Disponible' ? 'text-[#789500]' : 'text-[var(--muted)]'}`}>{String(status)}</span></div>;
        })}
      </div>
      <div className="rounded-2xl bg-[#111315] p-5 text-white">
        <p className="text-sm text-white/55">Tu primera incorporación</p>
        <p className="mt-2 text-2xl font-semibold">Lista en menos de 5 minutos.</p>
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-[#ccff00]"><Sparkles size={15} /> 3 días para comprobarlo</p>
      </div>
    </motion.div>
  );
}
