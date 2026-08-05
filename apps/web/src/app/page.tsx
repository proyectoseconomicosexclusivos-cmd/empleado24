'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Clock3, ShieldCheck, Sparkles, Star, Users } from 'lucide-react';
import { EmployeeAvatar } from '@/components/employee-avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { employeeShowcase, hiringHref } from '@/lib/employee-showcase';
import { AutopilotShowcase } from '@/components/autopilot-showcase';
import { MissionsShowcase } from '@/components/missions-showcase';

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.1 },
  transition: { duration: 0.45 },
};

function Section({
  id,
  children,
  className = '',
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`mx-auto max-w-7xl px-5 py-20 sm:px-6 md:px-10 md:py-28 ${className}`}
    >
      {children}
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[color:var(--bg)]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 md:px-10">
          <Link className="text-lg font-bold tracking-[-.07em]" href="#inicio">
            EMPLEADO<span className="text-[#789500]">24</span>
          </Link>
          <nav className="hidden gap-7 text-sm text-[var(--muted)] md:flex">
            <Link href="#empleados">Empleados</Link>
            <Link href="#empresa">Tu empresa</Link>
            <Link href="#packs">Packs</Link>
            <Link href="/demo">Ver demo</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="#empleados" className={buttonVariants({ variant: 'lime' })}>
              Contratar <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <section id="inicio" className="grid-bg relative overflow-hidden pt-16">
        <div className="noise" />
        <Section className="relative py-20 md:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
            <motion.div {...reveal}>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-xs">
                <i className="h-1.5 w-1.5 rounded-full bg-[#789500]" />
                Tu equipo puede crecer hoy
              </span>
              <h1 className="mt-7 text-5xl font-semibold tracking-[-.075em] sm:text-6xl md:text-7xl">
                Contrata empleados con IA desde 97 €/mes.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                Elige la función que necesitas y suma a tu empresa alguien preparado para atender,
                organizar y hacer seguimiento cada día.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="#empleados" className={buttonVariants({ variant: 'lime' })}>
                  Conocer al equipo <ArrowRight size={16} />
                </Link>
                <Link href="#packs" className={buttonVariants({ variant: 'outline' })}>
                  Ver packs de equipo
                </Link>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--muted)]">
                {['3 días para probarlo', 'Sin permanencia', 'Incorporación guiada'].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <Check size={15} className="text-[#789500]" />
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>
            <HeroTeam />
          </div>
        </Section>
      </section>

      <Section id="empleados">
        <div className="max-w-3xl">
          <p className="eyebrow">Empleados IA</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-6xl">
            Incorpora exactamente a quien necesitas.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
            Cada empleado tiene una función clara. Puedes contratarlo individualmente, conocer cómo
            trabaja y ampliar el equipo cuando lo necesites.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {employeeShowcase.map((employee) => (
            <EmployeeCard key={employee.slug} employee={employee} />
          ))}
        </div>
      </Section>
      <section
        id="empresa"
        className="border-y border-[var(--line)] bg-black/[.018] dark:bg-white/[.018]"
      >
        <Section>
          <div className="max-w-3xl">
            <p className="eyebrow">Tu empresa con Empleado24</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-5xl">
              Un equipo que comparte el mismo contexto.
            </h2>
            <p className="mt-4 leading-7 text-[var(--muted)]">
              Cada empleado conoce su responsabilidad y puede pasar el trabajo al siguiente miembro
              del equipo cuando hace falta.
            </p>
          </div>
          <OrgChart />
          <OfficeDay />
        </Section>
      </section>
      <AutopilotShowcase />
      <MissionsShowcase />

      <section className="border-y border-[var(--line)] bg-black/[.018] dark:bg-white/[.018]">
        <Section id="packs">
          <div className="max-w-3xl">
            <p className="eyebrow">Packs IA</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-5xl">
              Cuando el trabajo necesita un equipo.
            </h2>
            <p className="mt-4 leading-7 text-[var(--muted)]">
              Los packs agrupan funciones que se pasan el contexto entre sí. Están separados de los
              empleados individuales para que elijas el ritmo de crecimiento de tu empresa.
            </p>
          </div>
          <div className="mt-8 rounded-3xl border border-[#cfe69a] bg-[#f8ffe9] p-5 text-sm dark:border-[#405422] dark:bg-[#202900]">
            <p className="font-semibold">
              Pack Comercial: contratar por separado cuesta <s>391 €/mes</s>; el departamento
              comercial actual cuesta 297 €/mes.
            </p>
            <p className="mt-1 text-[var(--muted)]">
              Incluye Recepcionista, WhatsApp y Closer, con una diferencia de 94 €/mes frente a esas
              tres incorporaciones individuales.
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <Pack
              name="Pack Comercial"
              price="297 €/mes"
              status="Disponible"
              members={['Recepcionista IA', 'Closer IA', 'WhatsApp IA']}
              description="Atiende, organiza oportunidades y acompaña cada venta."
              href="/register?employee=department_commercial&from=pack-comercial"
            />
            <Pack
              name="Pack Marketing"
              price="Próximamente"
              status="Próximamente"
              members={['Especialista Email IA', 'Contenido y campañas', 'Seguimiento comercial']}
              description="Una base preparada para mantener el contacto y generar demanda."
            />
            <Pack
              name="Empresa Completa"
              price="Próximamente"
              status="Próximamente"
              members={['Comercial', 'Marketing', 'Atención al cliente']}
              description="El conjunto de empleados para coordinar varias áreas del negocio."
            />
          </div>
        </Section>
      </section>

      <Section id="comparativa">
        <div className="grid gap-12 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
          <div>
            <p className="eyebrow">Más capacidad</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-5xl">
              Un empleado que se incorpora a tu ritmo.
            </h2>
            <p className="mt-5 leading-7 text-[var(--muted)]">
              Tu equipo humano conserva las decisiones y las relaciones importantes. Empleado24 se
              ocupa de las tareas repetitivas, los seguimientos y la disponibilidad constante.
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--card)]">
            <div className="grid grid-cols-[1fr_.9fr_.9fr] border-b border-[var(--line)] bg-[#111315] px-4 py-4 text-xs font-semibold text-white sm:px-6">
              <span>Comparativa</span>
              <span>Empleado humano</span>
              <span className="text-[#ccff00]">Empleado IA</span>
            </div>
            {[
              ['Disponibilidad', 'Horario acordado', 'Todos los días'],
              ['Incorporación', 'Selección y formación', 'Bienvenida guiada'],
              ['Trabajo repetitivo', 'Tiempo limitado', 'Capacidad constante'],
              ['Ampliar equipo', 'Nueva contratación', 'Añade otro empleado'],
            ].map(([label, human, ai]) => (
              <div
                key={label}
                className="grid grid-cols-[1fr_.9fr_.9fr] gap-2 border-b border-[var(--line)] px-4 py-5 text-xs last:border-b-0 sm:px-6 sm:text-sm"
              >
                <strong className="font-medium">{label}</strong>
                <span className="text-[var(--muted)]">{human}</span>
                <span>{ai}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <section className="border-y border-[var(--line)] bg-black/[.018] dark:bg-white/[.018]">
        <Section id="como-funciona">
          <p className="eyebrow">Incorporación clara</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.06em] md:text-6xl">
            Elige. Conecta. Empieza a trabajar.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              ['01', 'Elige un empleado', 'Conoce su función, precio y forma de trabajar.'],
              ['02', 'Crea tu empresa', 'Empezamos una incorporación corta y guiada.'],
              [
                '03',
                'Conecta lo necesario',
                'Teléfono, calendario o cuenta de envío cuando corresponda.',
              ],
              [
                '04',
                'Comprueba el resultado',
                'Revisa la primera actividad desde tu espacio privado.',
              ],
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

      <section className="bg-[#111315] text-white dark:bg-[#ccff00] dark:text-[#111315]">
        <Section>
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="eyebrow text-white/55 dark:text-[#111315]/60">
                Tu próximo miembro del equipo
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.06em] md:text-6xl">
                Empieza con la función que más tiempo te quita hoy.
              </h2>
              <p className="mt-5 max-w-2xl leading-7 text-white/65 dark:text-[#111315]/65">
                Conoce a cada empleado antes de contratarlo. Cuando estés listo, empieza su
                incorporación guiada.
              </p>
            </div>
            <Link
              href="#empleados"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-[#111315] dark:bg-[#111315] dark:text-white"
            >
              Ver empleados <ArrowRight size={17} />
            </Link>
          </div>
        </Section>
      </section>
      <Section>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              ShieldCheck,
              'Tu empresa, tu información',
              'Cada empresa trabaja en un espacio privado.',
            ],
            [Clock3, 'Incorporación guiada', 'Sabrás qué hacer en cada momento.'],
            [
              Users,
              'Un equipo que puede crecer',
              'Añade empleados individuales o un departamento.',
            ],
          ].map(([Icon, title, text]) => {
            const ItemIcon = Icon as typeof ShieldCheck;
            return (
              <article key={String(title)} className="surface rounded-3xl p-6">
                <ItemIcon className="text-[#789500]" size={21} />
                <h3 className="mt-10 text-lg font-semibold">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{String(text)}</p>
              </article>
            );
          })}
        </div>
      </Section>
      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 text-sm text-[var(--muted)] sm:px-6 md:flex-row md:items-end md:justify-between md:px-10">
          <div>
            <b className="text-lg text-[var(--fg)]">
              EMPLEADO<span className="text-[#789500]">24</span>
            </b>
            <p className="mt-3">Empleados con IA preparados para formar parte de tu empresa.</p>
          </div>
          <div className="flex flex-wrap gap-6">
            <Link href="/login">Entrar en mi empresa</Link>
            <Link href="#empleados">Ver empleados</Link>
            <Link href="#packs">Ver packs</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function EmployeeCard({ employee }: { employee: (typeof employeeShowcase)[number] }) {
  return (
    <motion.article
      {...reveal}
      className="surface group flex flex-col overflow-hidden rounded-[2rem] p-3 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10"
    >
      <div className="relative aspect-[1.25/1] overflow-hidden rounded-[1.45rem] bg-[#dfe8c2]">
        <EmployeeAvatar
          portrait={employee.portrait}
          name={employee.person}
          className="h-full w-full rounded-none transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between">
          <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            {employee.person} · {employee.specialty}
          </span>
          <span className="rounded-full bg-[#e9ffcf] px-3 py-1.5 text-xs font-medium text-[#486500]">
            Disponible
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3 pt-5">
        <div
          className="flex items-center gap-1 text-[#789500]"
          aria-label="Valoración visual de cinco estrellas"
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} size={14} fill="currentColor" />
          ))}
        </div>
        <p className="eyebrow mt-5">{employee.role}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-.05em]">{employee.name}</h3>
        <p className="mt-3 min-h-20 text-sm leading-6 text-[var(--muted)]">{employee.summary}</p>
        <ul className="mt-6 grid gap-2 text-sm">
          {employee.benefits.slice(0, 3).map((benefit) => (
            <li className="flex gap-2" key={benefit}>
              <Check size={16} className="mt-0.5 shrink-0 text-[#789500]" />
              {benefit}
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-2xl bg-[#efffcf] px-4 py-3 text-xs font-medium text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">
        Función preparada para {employee.specialty.toLowerCase()}.
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
          <span className="text-xl font-semibold">{employee.price}</span>
          <div className="flex gap-2">
            <Link
              href={`/empleados/${employee.slug}`}
              className="rounded-full border border-[var(--line)] px-3 py-2 text-sm font-semibold"
            >
              Ver más
            </Link>
            <Link
              href={hiringHref(employee)}
              className="inline-flex items-center gap-1 rounded-full bg-[#111315] px-3 py-2 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]"
            >
              Contratar
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function OfficeDay() {
  const events = [
    ['08:00', 'Laura responde llamadas', 'recepcionista-ia'],
    ['09:15', 'Carlos prepara un seguimiento', 'closer-ia'],
    ['10:00', 'Marta organiza un presupuesto', 'especialista-presupuestos-ia'],
    ['11:30', 'Elena responde WhatsApp', 'whatsapp-ia'],
    ['13:00', 'David prepara un email', 'especialista-email-ia'],
  ] as const;
  return (
    <article className="surface mt-12 overflow-hidden rounded-[2rem]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-5">
        <div>
          <p className="eyebrow">DEMO</p>
          <h3 className="mt-1 text-xl font-semibold">Un día en la oficina</h3>
        </div>
        <span className="rounded-full bg-[#fff4c2] px-3 py-1 text-xs font-semibold text-[#6e5a00] dark:bg-[#3d3300] dark:text-[#ffe78a]">
          Ejemplo, no actividad real
        </span>
      </div>
      <ol className="grid divide-y divide-[var(--line)] md:grid-cols-5 md:divide-x md:divide-y-0">
        {events.map(([time, detail, slug]) => {
          const employee = employeeShowcase.find((item) => item.slug === slug);
          return (
            <li key={time} className="p-5">
              <span className="font-mono text-xs text-[#789500]">{time}</span>
              <div className="mt-5 flex items-center gap-3">
                {employee && (
                  <EmployeeAvatar
                    portrait={employee.portrait}
                    name={employee.person}
                    className="h-10 w-10"
                  />
                )}
                <p className="text-sm font-medium leading-5">{detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function Pack({
  name,
  price,
  status,
  members,
  description,
  href,
}: {
  name: string;
  price: string;
  status: string;
  members: string[];
  description: string;
  href?: string;
}) {
  return (
    <article
      className={`rounded-[2rem] border p-7 ${href ? 'border-[#9abd00] bg-[#f9ffe9] dark:bg-[#202900]' : 'border-[var(--line)] bg-[var(--card)]'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#111315] text-[#ccff00] dark:bg-[#f4f5f0] dark:text-[#526a00]">
          <Users size={20} />
        </span>
        <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--muted)] dark:bg-white/5">
          {status}
        </span>
      </div>
      <h3 className="mt-8 text-2xl font-semibold tracking-[-.05em]">{name}</h3>
      <p className="mt-3 min-h-12 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <ul className="mt-6 grid gap-2 text-sm">
        {members.map((member) => (
          <li key={member} className="flex gap-2">
            <Check size={16} className="text-[#789500]" />
            {member}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex items-center justify-between border-t border-[var(--line)] pt-5">
        <span className="text-xl font-semibold">{price}</span>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-full bg-[#111315] px-4 py-2 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]"
          >
            Conocer pack <ArrowRight size={14} />
          </Link>
        ) : (
          <span className="text-sm font-medium text-[var(--muted)]">Próximamente</span>
        )}
      </div>
    </article>
  );
}

function OrgChart() {
  const [selected, setSelected] = useState(employeeShowcase[0]?.slug ?? '');
  const [laura, david, carlos, elena, marta] = employeeShowcase;
  if (!laura || !david || !carlos || !elena || !marta) return null;
  const selectedEmployee = employeeShowcase.find((employee) => employee.slug === selected) ?? laura;
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_19rem]">
      <div className="overflow-x-auto pb-3">
        <div className="min-w-[700px]">
          <div className="mx-auto grid h-16 w-44 place-items-center rounded-2xl bg-[#111315] text-sm font-semibold text-white">
            CEO · Tu empresa
          </div>
          <div className="mx-auto h-8 w-px bg-[#789500]" />
          <div className="grid grid-cols-3 gap-3">
            <OrgNode employee={laura} selected={selected === laura.slug} onSelect={setSelected} />
            <OrgNode employee={carlos} selected={selected === carlos.slug} onSelect={setSelected} />
            <OrgNode employee={marta} selected={selected === marta.slug} onSelect={setSelected} />
          </div>
          <div className="mx-auto h-8 w-px bg-[#789500]" />
          <div className="grid grid-cols-2 gap-3 px-24">
            <OrgNode employee={elena} selected={selected === elena.slug} onSelect={setSelected} />
            <OrgNode employee={david} selected={selected === david.slug} onSelect={setSelected} />
          </div>
        </div>
      </div>
      <aside className="surface rounded-3xl p-6">
        <p className="eyebrow">Miembro seleccionado</p>
        <div className="mt-5 flex items-center gap-3">
          <EmployeeAvatar
            portrait={selectedEmployee.portrait}
            name={selectedEmployee.person}
            className="h-14 w-14"
          />
          <div>
            <h3 className="font-semibold">{selectedEmployee.person}</h3>
            <p className="text-sm text-[#789500]">{selectedEmployee.name}</p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-[var(--muted)]">{selectedEmployee.summary}</p>
        <p className="mt-5 rounded-2xl bg-[#efffcf] p-3 text-xs leading-5 text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">
          Recomendación: empieza por la función que hoy concentra más tareas repetitivas.
        </p>
        <Link
          href={`/empleados/${selectedEmployee.slug}`}
          className="mt-5 inline-flex text-sm font-semibold underline underline-offset-4"
        >
          Conocer a {selectedEmployee.person}
        </Link>
      </aside>
    </div>
  );
}
function OrgNode({
  employee,
  selected,
  onSelect,
}: {
  employee: (typeof employeeShowcase)[number];
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(employee.slug)}
      className={`flex items-center gap-3 rounded-2xl border bg-[var(--card)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#789500] ${selected ? 'border-[#789500] ring-2 ring-[#ccff00]/60' : 'border-[var(--line)]'}`}
    >
      <EmployeeAvatar portrait={employee.portrait} name={employee.person} className="h-10 w-10" />
      <span className="min-w-0">
        <b className="block truncate text-sm">{employee.person}</b>
        <span className="block truncate text-xs text-[var(--muted)]">{employee.name}</span>
      </span>
    </button>
  );
}

function HeroTeam() {
  return (
    <motion.div {...reveal} className="surface rounded-[2rem] p-4 shadow-2xl shadow-black/10">
      <div className="flex items-center justify-between border-b border-[var(--line)] p-3">
        <span className="text-sm font-semibold">Tu futuro equipo</span>
        <span className="rounded-full bg-[#e9ffcf] px-2 py-1 text-[10px] font-medium text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">
          Listos para incorporar
        </span>
      </div>
      <div className="grid gap-3 p-3 pt-4">
        {employeeShowcase.slice(0, 4).map((employee) => (
          <div
            key={employee.slug}
            className="flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3"
          >
            <EmployeeAvatar
              portrait={employee.portrait}
              name={employee.person}
              className="h-11 w-11"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {employee.person} · {employee.name}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">{employee.role}</p>
            </div>
            <Sparkles size={15} className="text-[#789500]" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-[#111315] p-5 text-white">
        <p className="text-sm text-white/55">Tu primera incorporación</p>
        <p className="mt-2 text-2xl font-semibold">Elige la función que necesitas.</p>
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-[#ccff00]">
          <Check size={15} /> 3 días para comprobarlo
        </p>
      </div>
    </motion.div>
  );
}
