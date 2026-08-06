'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Clock3,
  ShieldCheck,
  Sparkles,
  Star,
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
  const [hero, setHero] = useState({
    title: 'CONTRATA EMPLEADOS CON IA',
    emphasis: 'DESDE 97 €/MES',
    description: 'Personas virtuales que trabajan para tu empresa 24 horas al día. Laura te recomienda por dónde empezar en menos de dos minutos.',
  });

  useEffect(() => {
    const anonymousId = document.cookie.split('; ').find((entry) => entry.startsWith('e24_anon='))?.split('=')[1];
    if (!anonymousId) return;
    void fetch(`/api/conversion/experiment?target=homepage_headline&anonymousId=${encodeURIComponent(decodeURIComponent(anonymousId))}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { experiment?: { message?: string; submessage?: string } | null } | null) => {
        const message = payload?.experiment?.message;
        if (!message) return;
        const [title, emphasis] = message.split('\n');
        setHero((current) => ({ title: title ?? current.title, emphasis: emphasis ?? current.emphasis, description: payload?.experiment?.submessage ?? current.description }));
      })
      .catch(() => undefined);
  }, []);

  return (
    <main>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[color:var(--bg)]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 md:px-10">
          <Link className="text-lg font-bold tracking-[-.07em]" href="#inicio">
            EMPLEADO<span className="text-[#789500]">24</span>
          </Link>
          <nav className="hidden gap-7 text-sm text-[var(--muted)] md:flex">
            <Link href="#empleados">Empleados</Link>
            <Link href="#empleados">Conoce al equipo</Link>
            <Link href="#recomendar">Encontrar mi empleado</Link>
            <Link href="#preguntas">Preguntas frecuentes</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/?laura_chat=1#hablar-con-laura"
              data-e24-track="nav_contract"
              data-e24-zone="navigation"
              className={buttonVariants({ variant: 'lime' })}
            >
              Probar a Laura <ArrowRight size={15} />
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
              <span className="block">{hero.title}</span>
              <span className="block text-[#789500]">{hero.emphasis}</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                {hero.description}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/?laura_chat=1#hablar-con-laura"
                  data-e24-track="hero_try_laura"
                  data-e24-zone="hero"
                  className={buttonVariants({ variant: 'lime' })}
                >
                  Probar a Laura ahora <ArrowRight size={16} />
                </Link>
                <Link
                  href="#empleados"
                  data-e24-track="hero_team"
                  data-e24-zone="hero"
                  className={buttonVariants({ variant: 'outline' })}
                >
                  Ver a quién contratar
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
          <p className="eyebrow">Conoce a tu próximo empleado</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-6xl">
            No contratas software. Incorporas a una persona a tu equipo.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
            Cada uno tiene un cargo, una especialidad y una forma clara de ayudarte. Conócelos,
            prueba una demo y contrata solo la persona que tu empresa necesita hoy.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {employeeShowcase.map((employee) => (
            <EmployeeCard key={employee.slug} employee={employee} />
          ))}
        </div>
      </Section>
      <section id="recomendar" className="border-y border-[var(--line)] bg-[#111315] text-white">
        <Section>
          <HiringQuiz />
        </Section>
      </section>

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
        <div className="max-w-3xl">
          <p className="eyebrow">Capacidad que puedes incorporar</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-6xl">
            ¿Cuánto te cuesta no tener a la persona adecuada?
          </h2>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
            Una comparación orientativa de coste anual. Cada negocio define su equipo y sus costes;
            aquí puedes ver la diferencia de partida antes de decidir.
          </p>
        </div>
        <CostComparison />
        <Link
          href="#recomendar"
          data-e24-track="comparison_recommendation"
          data-e24-zone="comparison"
          className="mt-9 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"
        >
          Encontrar mi empleado <ArrowRight size={15} />
        </Link>
      </Section>

      <section id="empresa" className="border-y border-[var(--line)] bg-black/[.018] dark:bg-white/[.018]">
        <Section>
          <div className="max-w-3xl">
            <p className="eyebrow">Un equipo, un objetivo</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-5xl">
              Cada persona sabe cuándo pasar el trabajo a la siguiente.
            </h2>
            <p className="mt-4 leading-7 text-[var(--muted)]">
              Atiende, responde, sigue una oportunidad y organiza la siguiente acción. Tú conservas
              las decisiones importantes; el equipo mantiene el ritmo.
            </p>
          </div>
          <OrgChart />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#empleados" className={buttonVariants({ variant: 'outline' })}>
              Conocer al equipo <ArrowRight size={15} />
            </Link>
            <Link href="#packs" className={buttonVariants({ variant: 'lime' })}>
              Ver equipos preparados <Users size={15} />
            </Link>
          </div>
        </Section>
      </section>

      <section id="como-funciona" className="border-y border-[var(--line)] bg-black/[.018] dark:bg-white/[.018]">
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
          <Link href="#empleados" className="mt-9 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4">
            Elegir mi primer empleado <ArrowRight size={15} />
          </Link>
        </Section>
      </section>

      <Section id="preguntas">
        <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="eyebrow">Antes de incorporar</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-5xl">
              Todo claro antes de empezar.
            </h2>
            <p className="mt-5 leading-7 text-[var(--muted)]">
              Empiezas con una prueba de 3 días. Puedes cancelar cuando quieras y solo conectas lo
              que corresponda a la persona que has elegido.
            </p>
            <Link href="#recomendar" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4">
              Recibir una recomendación <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-3">
            {[
              ['¿Cuánto tarda en empezar?', 'La incorporación es guiada. El tiempo depende de la información y de la conexión que necesite cada empleado.'],
              ['¿Tengo permanencia?', 'No. Puedes revisar tu contratación desde tu espacio privado.'],
              ['¿Mis datos se mezclan con otras empresas?', 'No. Tu empresa trabaja en un espacio privado y separado.'],
              ['¿Puedo empezar por una sola persona?', 'Sí. Puedes contratar a Laura, David, Carlos, Elena o Marta de forma individual.'],
            ].map(([question, answer]) => (
              <article key={question} className="surface rounded-2xl p-5">
                <h3 className="font-semibold">{question}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </Section>

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
          objectPosition={employee.portraitPosition}
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
        <p className="mt-1 text-sm font-medium text-[#789500]">{employee.person} · {employee.specialty}</p>
        <p className="mt-3 min-h-20 text-sm leading-6 text-[var(--muted)]">{employee.summary}</p>
        <Link
          href={`/empleados/${employee.slug}`}
          data-e24-track={`employee_detail_${employee.slug}`}
          data-e24-zone="employee_card"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4"
        >
          Conocer a {employee.person} <ArrowRight size={14} />
        </Link>
        <ul className="mt-6 grid gap-2 text-sm">
          {employee.benefits.slice(0, 3).map((benefit) => (
            <li className="flex gap-2" key={benefit}>
              <Check size={16} className="mt-0.5 shrink-0 text-[#789500]" />
              {benefit}
            </li>
          ))}
        </ul>
        <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
          <span className="rounded-xl bg-[#efffcf] px-3 py-2 font-medium text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">
            {employee.languages.join(' · ')}
          </span>
          <span className="rounded-xl bg-black/[.04] px-3 py-2 font-medium text-[var(--muted)] dark:bg-white/[.06]">
            {employee.department}
          </span>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
          <span className="text-xl font-semibold">{employee.price}</span>
          <div className="flex gap-2">
            <Link
              href={`/demo?employee=${employee.slug}`}
              data-e24-track={`employee_demo_${employee.slug}`}
              data-e24-zone="employee_card"
              className="rounded-full border border-[var(--line)] px-3 py-2 text-sm font-semibold"
            >
              Probar gratis
            </Link>
            <Link
              href={hiringHref(employee)}
              data-e24-track={`employee_contract_${employee.slug}`}
              data-e24-zone="employee_card"
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

const recommendations = {
  llamadas: ['recepcionista-ia', 'closer-ia'],
  whatsapp: ['whatsapp-ia', 'closer-ia'],
  ventas: ['closer-ia', 'especialista-presupuestos-ia'],
  clientes: ['especialista-email-ia', 'whatsapp-ia'],
  presupuestos: ['especialista-presupuestos-ia', 'closer-ia'],
} as const;

function HiringQuiz() {
  const [business, setBusiness] = useState('');
  const [problem, setProblem] = useState<keyof typeof recommendations | ''>('');
  const [size, setSize] = useState('');
  const ready = Boolean(business && problem && size);
  const selectedProblem = (problem || 'llamadas') as keyof typeof recommendations;
  const people = ready
    ? recommendations[selectedProblem]
        .map((slug: string) => employeeShowcase.find((employee) => employee.slug === slug))
        .filter(Boolean)
    : [];
  const first = people[0];

  return (
    <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
      <div>
        <p className="eyebrow text-white/55">Una recomendación en menos de un minuto</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-.065em] text-white md:text-6xl">
          Dinos qué te preocupa. Te presentamos a la persona adecuada.
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-8 text-white/65">
          Tres preguntas. Sin datos de contacto. Sin compromiso.
        </p>
      </div>
      <div className="rounded-[2rem] bg-white p-5 text-[#111315] shadow-2xl sm:p-7">
        <QuizQuestion
          number="01"
          title="¿Qué tipo de negocio tienes?"
          value={business}
          onChange={setBusiness}
          options={['Constructora', 'Inmobiliaria', 'Clínica', 'Restaurante', 'Despacho', 'Otro']}
          tracking="quiz_business"
        />
        <QuizQuestion
          number="02"
          title="¿Cuál es el problema que más te frena?"
          value={problem}
          onChange={(value) => setProblem(value as keyof typeof recommendations)}
          options={[
            ['llamadas', 'Muchas llamadas'],
            ['whatsapp', 'Muchos WhatsApp'],
            ['ventas', 'No cierro ventas'],
            ['clientes', 'Pierdo clientes'],
            ['presupuestos', 'Hago presupuestos'],
          ]}
          tracking="quiz_problem"
        />
        <QuizQuestion
          number="03"
          title="¿Cuántas personas trabajan contigo?"
          value={size}
          onChange={setSize}
          options={['Solo yo', '2–5 personas', '6–20 personas', 'Más de 20']}
          tracking="quiz_size"
        />
        {ready && first ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-7 rounded-2xl bg-[#efffcf] p-5"
          >
            <p className="text-sm font-semibold text-[#486500]">Tu equipo recomendado</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {people.map((employee) =>
                employee ? (
                  <span key={employee.slug} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-sm">
                    <EmployeeAvatar portrait={employee.portrait} name={employee.person} objectPosition={employee.portraitPosition} className="h-7 w-7 rounded-full" />
                    {employee.person}
                  </span>
                ) : null,
              )}
            </div>
            <p className="mt-4 text-sm leading-6 text-[#486500]">
              Empieza por {first.person}. Puedes incorporar al resto cuando lo necesites.
            </p>
            <Link
              href={hiringHref(first)}
              data-e24-track={`quiz_contract_${first.slug}`}
              data-e24-zone="hiring_quiz"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#111315] px-5 py-3 text-sm font-semibold text-white"
            >
              Contratar mi recomendación <ArrowRight size={15} />
            </Link>
          </motion.div>
        ) : (
          <p className="mt-7 rounded-2xl bg-[#f4f5f0] px-4 py-3 text-sm text-[#626560]">
            Responde las tres preguntas para ver tu recomendación.
          </p>
        )}
      </div>
    </div>
  );
}

function QuizQuestion({
  number,
  title,
  value,
  onChange,
  options,
  tracking,
}: {
  number: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | [string, string]>;
  tracking: string;
}) {
  return (
    <fieldset className="mt-6 first:mt-0">
      <legend className="flex items-baseline gap-3 text-sm font-semibold">
        <span className="font-mono text-xs text-[#789500]">{number}</span>
        {title}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const label = Array.isArray(option) ? option[1] : option;
          const selected = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              data-e24-track={`${tracking}_${optionValue.toLowerCase().replaceAll(' ', '_')}`}
              data-e24-zone="hiring_quiz"
              className={`rounded-full border px-3 py-2 text-sm transition ${selected ? 'border-[#789500] bg-[#efffcf] font-semibold text-[#486500]' : 'border-[#deded8] bg-white hover:border-[#789500]'}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function CostComparison() {
  const rows = [
    ['Laura', 'Recepcionista IA', '≈ 36.000 €/año', '1.164 €/año', '≈ 34.836 €/año'],
    ['Carlos', 'Closer IA', '≈ 46.000 €/año', '2.364 €/año', '≈ 43.636 €/año'],
    ['Marta', 'Presupuestos IA', '≈ 42.000 €/año', '2.364 €/año', '≈ 39.636 €/año'],
    ['Elena', 'WhatsApp IA', '≈ 34.000 €/año', '1.164 €/año', '≈ 32.836 €/año'],
  ];
  return (
    <div className="mt-12 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--card)]">
      <div className="grid grid-cols-[1.25fr_.85fr_.85fr] gap-3 bg-[#111315] px-5 py-4 text-xs font-semibold text-white sm:grid-cols-[1.25fr_.85fr_.85fr_1fr] sm:px-7 sm:text-sm">
        <span>Persona</span>
        <span>Coste humano*</span>
        <span className="text-[#ccff00]">Empleado24</span>
        <span className="hidden sm:block">Ahorro orientativo</span>
      </div>
      {rows.map(([person, role, human, ai, saving]) => (
        <div key={person} className="grid grid-cols-[1.25fr_.85fr_.85fr] gap-3 border-t border-[var(--line)] px-5 py-5 text-xs sm:grid-cols-[1.25fr_.85fr_.85fr_1fr] sm:px-7 sm:text-sm">
          <span><b className="block text-base">{person}</b><span className="text-[var(--muted)]">{role}</span></span>
          <span className="text-[var(--muted)]">{human}</span>
          <span className="font-semibold">{ai}</span>
          <span className="hidden font-semibold text-[#6e8700] sm:block">{saving}</span>
        </div>
      ))}
      <p className="border-t border-[var(--line)] px-5 py-4 text-xs leading-5 text-[var(--muted)] sm:px-7">
        *Comparación anual orientativa que incluye salario y costes habituales de contratación. No es una promesa de ahorro ni sustituye el cálculo laboral de tu empresa.
      </p>
    </div>
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
                    objectPosition={employee.portraitPosition}
                    className="h-10 w-10"
                  />
                )}
                <p className="text-sm font-medium leading-5">{detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-[var(--line)] px-6 py-5">
        <Link
          href="/demo?employee=recepcionista-ia"
          data-e24-track="office_demo_laura"
          data-e24-zone="office_demo"
          className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"
        >
          Ver trabajar a Laura <ArrowRight size={15} />
        </Link>
      </div>
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
            data-e24-track={`pack_${name.toLowerCase().replaceAll(' ', '_')}`}
            data-e24-zone="pack"
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
            objectPosition={selectedEmployee.portraitPosition}
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
          data-e24-track={`orgchart_${selectedEmployee.slug}`}
          data-e24-zone="org_chart"
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
      <EmployeeAvatar
        portrait={employee.portrait}
        name={employee.person}
        objectPosition={employee.portraitPosition}
        className="h-10 w-10"
      />
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
              objectPosition={employee.portraitPosition}
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
