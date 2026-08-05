import Link from 'next/link';
import {
  BriefcaseBusiness,
  Calculator,
  Check,
  CreditCard,
  FileText,
  Headphones,
  Mail,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { CompanyService } from '@/services/company-service';
import { createClient } from '@/lib/supabase/server';
import { BillingActionButton } from '@/components/billing-action-button';
import { departments } from '@/lib/departments';
import { EmployeeAvatar } from '@/components/employee-avatar';
import { employeeShowcase } from '@/lib/employee-showcase';

const stateCopy: Record<string, string> = {
  incomplete: 'Pendiente de elegir',
  trialing: 'Periodo de prueba activo',
  active: 'Equipo activo',
  past_due: 'Pago pendiente',
  grace_period: 'Necesita atención',
  canceling: 'Finaliza al acabar el periodo',
  canceled: 'Suscripción finalizada',
  paused: 'En pausa',
  frozen: 'Cuenta congelada',
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

const employeePresentation = {
  one_employee: {
    name: 'Recepcionista IA',
    description: 'Atiende llamadas, resuelve preguntas y organiza citas para tu empresa.',
    icon: Headphones,
    benefits: ['Atención todos los días', 'Incorporación guiada', '3 días para probarla'],
  },
  employee_email: {
    name: 'Especialista Email IA',
    description:
      'Organiza contactos, prepara mensajes y trabaja desde la cuenta de envío de tu empresa.',
    icon: Mail,
    benefits: ['Cuenta de envío propia', 'Datos separados por empresa', '3 días para probarlo'],
  },
  employee_budget: {
    name: 'Especialista Presupuestos IA',
    description:
      'Prepara presupuestos claros y rentables, y coordina el seguimiento con tu equipo.',
    icon: Calculator,
    benefits: ['Márgenes y costes controlados', 'Historial por cliente', '3 días para probarlo'],
  },
  employee_closer: {
    name: 'Closer IA',
    description:
      'Nunca vuelvas a perder una venta. Sigue oportunidades, prepara contactos y agenda reuniones.',
    icon: TrendingUp,
    benefits: ['Seguimiento constante', 'Centro de Ventas incluido', '3 días para probarlo'],
  },
  employee_whatsapp: {
    name: 'WhatsApp IA',
    description:
      'Atiende clientes por WhatsApp, detecta oportunidades y avisa a tu equipo cuando hace falta.',
    icon: MessageCircle,
    benefits: [
      'Atiende 24 horas',
      'Responde automáticamente',
      'Detecta oportunidades',
      'Prepara citas y presupuestos',
      'Pasa clientes al Closer',
      '3 días para probarlo',
    ],
  },
} as const;

const upcomingEmployees = [
  {
    name: 'Redes Sociales IA',
    description: 'Mantiene activa la comunicación con tu comunidad.',
    icon: Megaphone,
  },
  {
    name: 'Atención al Cliente IA',
    description: 'Resuelve dudas y sabe cuándo pedir ayuda.',
    icon: MessageCircle,
  },
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string;
    department?: string;
    price?: string;
    objective?: string;
    business?: string;
    popularity?: string;
  }>;
}) {
  const membership = await CompanyService.current();
  const relation = membership?.companies;
  const company = Array.isArray(relation) ? relation[0] : relation;
  if (!company) return null;
  const supabase = (await createClient()) as any;
  const [{ data: plans }, { data: subscription }, { data: invoices }, query] = await Promise.all([
    supabase.from('billing_plans').select('*').eq('active', true).order('sort_order'),
    supabase
      .from('subscriptions')
      .select('*,billing_plans(*)')
      .eq('company_id', company.id)
      .maybeSingle(),
    supabase
      .from('invoices')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(12),
    searchParams,
  ]);
  const currentPlan = subscription?.billing_plans;
  const hasProviderSubscription = Boolean(
    subscription?.provider_subscription_id &&
    !['canceled', 'incomplete'].includes(subscription.state),
  );
  type BillingPlan = {
    id: string;
    self_serve_enabled: boolean;
    name: string;
    description: string | null;
    monthly_price_cents: number;
    currency: string;
    employee_limit: number;
    trial_days: number;
    plan_key: string;
  };
  const availablePlans = (plans ?? []) as BillingPlan[];
  type BillingInvoice = {
    id: string;
    amount_paid_cents: number | null;
    amount_due_cents: number;
    currency: string;
    status: string;
    created_at: string;
    invoice_url: string | null;
  };
  const availableInvoices = (invoices ?? []) as BillingInvoice[];
  const visibleEmployeePlans = availablePlans.filter((plan) => {
    if (!plan.self_serve_enabled || !(plan.plan_key in employeePresentation)) return false;
    const employee = employeeShowcase.find((candidate) => candidate.planKey === plan.plan_key);
    if (!employee) return true;
    const priceMatches =
      !query.price ||
      query.price === 'all' ||
      (query.price === 'up_to_100'
        ? plan.monthly_price_cents <= 10000
        : plan.monthly_price_cents > 10000);
    const objectiveMatches =
      !query.objective ||
      query.objective === 'all' ||
      employee.objectives.includes(query.objective);
    const businessMatches =
      !query.business || query.business === 'all' || employee.businesses.includes(query.business);
    const departmentMatches =
      !query.department ||
      query.department === 'all' ||
      employee.department.toLowerCase() === query.department;
    return priceMatches && objectiveMatches && businessMatches && departmentMatches;
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14">
      <header className="max-w-3xl">
        <p className="eyebrow">Mis empleados</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em] md:text-5xl">
          Elige quién quieres incorporar.
        </h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          Cada empleado tiene una forma de ayudarte. Puedes incorporarlo, cambiarlo o ver sus
          documentos cuando lo necesites.
        </p>
      </header>

      {query.checkout === 'success' && (
        <div
          role="status"
          className="mt-8 rounded-2xl bg-[#e9ffcf] p-5 text-sm text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]"
        >
          <p className="font-semibold">Hemos recibido tu contratación.</p>
          <p className="mt-1 opacity-80">
            Estamos confirmando tu periodo de prueba. Aquí aparecerá el estado real en cuanto
            termine la comprobación.
          </p>
        </div>
      )}
      {query.checkout === 'canceled' && (
        <div
          role="status"
          className="mt-8 rounded-2xl bg-[#fff8e5] p-5 text-sm text-[#5f4b16] dark:bg-[#2c260f] dark:text-[#f4dda0]"
        >
          No se ha realizado ningún cargo ni se ha activado ningún plan.
        </div>
      )}

      <section className="mt-10 rounded-[2rem] bg-[#111315] p-7 text-white dark:bg-[#ccff00] dark:text-[#111315] md:flex md:items-center md:justify-between md:gap-8 md:p-9">
        <div>
          <div className="flex items-center gap-2 text-[#ccff00] dark:text-[#111315]">
            <ShieldCheck size={19} />
            <span className="text-xs font-semibold uppercase tracking-[.12em]">
              Estado de tu equipo
            </span>
          </div>
          <h2 className="mt-6 text-3xl font-semibold tracking-[-.05em]">
            {stateCopy[subscription?.state ?? 'incomplete'] ?? 'Pendiente'}
          </h2>
          <p className="mt-2 text-sm text-white/60 dark:text-[#111315]/60">
            {currentPlan
              ? `${currentPlan.name} · ${money(currentPlan.monthly_price_cents, currentPlan.currency)} al mes`
              : 'Todavía no has elegido a quién incorporar.'}
          </p>
        </div>
        {subscription?.provider_customer_id && (
          <BillingActionButton
            action="portal"
            className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#111315] transition hover:-translate-y-0.5 dark:bg-[#111315] dark:text-white md:mt-0"
          >
            Gestionar contratación y facturas
          </BillingActionButton>
        )}
      </section>

      <section className="mt-14">
        <p className="eyebrow">Departamentos IA</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">
          Un equipo completo, una única incorporación.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Todos comparten el historial de tus clientes y se pasan el trabajo sin que tengas que
          repetir información.
        </p>
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {Object.values(departments).map((department) => {
            const plan =
              'planKey' in department
                ? availablePlans.find((candidate) => candidate.plan_key === department.planKey)
                : null;
            const commercial = department.key === 'commercial';
            const comingSoon = 'comingSoon' in department && department.comingSoon;
            return (
              <article
                key={department.key}
                className={`surface rounded-3xl p-6 md:p-7 ${commercial ? 'ring-1 ring-[#789500]' : 'opacity-80'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#efffcf] text-[#526a00] dark:bg-[#263300] dark:text-[#d7f897]">
                    <BriefcaseBusiness size={20} />
                  </span>
                  <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--muted)] dark:bg-white/5">
                    {comingSoon ? 'Próximamente' : 'Disponible'}
                  </span>
                </div>
                <h3 className="mt-7 text-xl font-semibold tracking-[-.04em]">{department.name}</h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-[var(--muted)]">
                  {department.description}
                </p>
                <ul className="mt-5 grid gap-2 text-sm">
                  {department.members.map((member) => (
                    <li key={member} className="flex items-center gap-2">
                      <Check size={15} className="text-[#789500]" />
                      {member}
                    </li>
                  ))}
                </ul>
                {'flow' in department && (
                  <p className="mt-5 rounded-2xl bg-[#efffcf] p-3 text-xs font-medium leading-5 text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">
                    {department.flow}
                  </p>
                )}
                {plan && (
                  <p className="mt-6 text-3xl font-semibold tracking-[-.05em]">
                    {money(plan.monthly_price_cents, plan.currency)}
                    <span className="ml-1 text-sm font-normal tracking-normal text-[var(--muted)]">
                      /mes
                    </span>
                  </p>
                )}
                {!comingSoon && plan && (
                  <div className="mt-7">
                    {hasProviderSubscription ? (
                      <BillingActionButton
                        action="portal"
                        className="w-full rounded-full bg-[#111315] px-4 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]"
                      >
                        Gestionar mi equipo
                      </BillingActionButton>
                    ) : (
                      <BillingActionButton
                        action="checkout"
                        planKey={plan.plan_key}
                        className="w-full rounded-full bg-[#111315] px-4 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]"
                      >
                        Incorporar departamento
                      </BillingActionButton>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-14">
        <p className="eyebrow">Empleados IA</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">
          ¿A quién quieres incorporar?
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Cada empleado tiene una función propia y comparte el contexto de tu empresa con el resto
          del equipo.
        </p>
        <form
          className="surface mt-7 grid gap-3 rounded-3xl p-4 md:grid-cols-6"
          aria-label="Filtrar empleados"
        >
          <Filter
            name="department"
            label="Departamento"
            value={query.department}
            options={[
              ['all', 'Todos'],
              ['atención', 'Atención'],
              ['comercial', 'Comercial'],
              ['marketing', 'Marketing'],
            ]}
          />
          <Filter
            name="price"
            label="Precio"
            value={query.price}
            options={[
              ['all', 'Cualquier precio'],
              ['up_to_100', 'Hasta 100 €'],
              ['over_100', 'Más de 100 €'],
            ]}
          />
          <Filter
            name="objective"
            label="Objetivo"
            value={query.objective}
            options={[
              ['all', 'Cualquier objetivo'],
              ['atender', 'Atender clientes'],
              ['vender', 'Vender más'],
              ['organizar', 'Organizar trabajo'],
            ]}
          />
          <Filter
            name="business"
            label="Negocio"
            value={query.business}
            options={[
              ['all', 'Cualquier negocio'],
              ['servicios', 'Servicios'],
              ['comercio', 'Comercio'],
              ['construccion', 'Construcción'],
              ['inmobiliaria', 'Inmobiliaria'],
            ]}
          />
          <Filter
            name="popularity"
            label="Popularidad"
            value={query.popularity}
            options={[
              ['all', 'Todos'],
              ['popular', 'Más elegidos'],
            ]}
          />
          <button className="self-end rounded-xl bg-[#111315] px-4 py-2.5 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]">
            Aplicar
          </button>
        </form>
        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          {visibleEmployeePlans.map((plan) => {
            const presentation =
              employeePresentation[plan.plan_key as keyof typeof employeePresentation];
            const EmployeeIcon = presentation.icon;
            const showcase = employeeShowcase.find(
              (employee) => employee.planKey === plan.plan_key,
            );
            const badge =
              plan.plan_key === 'one_employee'
                ? 'Para empezar'
                : plan.plan_key === 'employee_closer'
                  ? 'Enfocado a ventas'
                  : plan.plan_key === 'employee_budget'
                    ? 'Nuevo'
                    : plan.plan_key === 'employee_whatsapp'
                      ? 'Atención 24 h'
                      : 'Seguimiento continuo';
            return (
              <article
                key={plan.id}
                className={`surface rounded-3xl p-6 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 md:p-7 ${currentPlan?.id === plan.id ? 'ring-2 ring-[#789500]' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {showcase ? (
                    <EmployeeAvatar
                      portrait={showcase.portrait}
                      name={showcase.person}
                      className="h-14 w-14"
                    />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#efffcf] text-[#526a00] dark:bg-[#263300] dark:text-[#d7f897]">
                      <EmployeeIcon size={20} />
                    </span>
                  )}
                  <span className="rounded-full bg-[#e9ffcf] px-3 py-1 text-xs font-medium text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">
                    {currentPlan?.id === plan.id ? 'En tu equipo' : badge}
                  </span>
                </div>
                <div
                  className="mt-5 flex gap-1 text-[#789500]"
                  aria-label="Valoración visual de cinco estrellas"
                >
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} size={13} fill="currentColor" />
                  ))}
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-.04em]">
                  {presentation.name}
                </h3>
                <p className="mt-3 min-h-14 text-sm leading-6 text-[var(--muted)]">
                  {presentation.description}
                </p>
                <p className="mt-3 text-xs font-medium text-[#789500]">
                  Compatible con Empleado24 Brain
                </p>
                {showcase && (
                  <p className="mt-4 rounded-2xl bg-[#efffcf] px-3 py-2 text-xs font-medium text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">
            Conoce su función antes de incorporarlo.
                  </p>
                )}
                <p className="mt-6 text-4xl font-semibold tracking-[-.06em]">
                  {money(plan.monthly_price_cents, plan.currency)}
                  <span className="ml-1 text-sm font-normal tracking-normal text-[var(--muted)]">
                    /mes
                  </span>
                </p>
                <ul className="mt-6 grid gap-3 text-sm">
                  {presentation.benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-2">
                      <Check size={16} className="text-[#789500]" />
                      {benefit}
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex gap-3">
                  {showcase && (
                    <Link
                      href={`/empleados/${showcase.slug}`}
                      className="inline-flex items-center justify-center rounded-full border border-[var(--line)] px-4 py-3 text-sm font-semibold"
                    >
                      Ver más
                    </Link>
                  )}
                  {hasProviderSubscription ? (
                    <BillingActionButton
                      action="portal"
                      className="flex-1 rounded-full bg-[#111315] px-4 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]"
                    >
                      {currentPlan?.id === plan.id
                        ? 'Gestionar contratación'
                        : `Cambiar a ${presentation.name}`}
                    </BillingActionButton>
                  ) : (
                    <BillingActionButton
                      action="checkout"
                      planKey={plan.plan_key}
                      className="flex-1 rounded-full bg-[#111315] px-4 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]"
                    >
                      Contratar
                    </BillingActionButton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {!visibleEmployeePlans.length && (
          <div className="mt-7 rounded-3xl border border-dashed border-[var(--line)] p-7 text-sm text-[var(--muted)]">
            No hay un empleado disponible con esa combinación. Prueba a quitar algún filtro.
          </div>
        )}
      </section>

      <section className="mt-14">
        <p className="eyebrow">Próximas incorporaciones</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">
          Tu equipo seguirá creciendo.
        </h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {upcomingEmployees.map(({ name, description, icon: EmployeeIcon }) => (
            <article
              key={name}
              className="rounded-3xl border border-dashed border-[var(--line)] p-6"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black/5 text-[var(--muted)] dark:bg-white/5">
                <EmployeeIcon size={18} />
              </span>
              <h3 className="mt-7 text-lg font-semibold">{name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">{description}</p>
              <span className="mt-5 inline-block text-xs font-semibold uppercase tracking-[.12em] text-[#789500]">
                Próximamente
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <p className="eyebrow">Packs IA</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">
          Equipos preparados para varias áreas.
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Los packs son distintos de un empleado individual: reúnen varias funciones para empresas
          con mayor volumen.
        </p>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {availablePlans
            .filter(
              (plan) =>
                plan.self_serve_enabled &&
                !(plan.plan_key in employeePresentation) &&
                plan.plan_key !== 'department_commercial',
            )
            .map((plan) => (
              <article
                key={plan.id}
                className={`surface rounded-3xl p-6 ${currentPlan?.id === plan.id ? 'ring-2 ring-[#789500]' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efffcf] text-[#526a00] dark:bg-[#263300] dark:text-[#d7f897]">
                    <Users size={18} />
                  </span>
                  {currentPlan?.id === plan.id && (
                    <span className="rounded-full bg-[#e9ffcf] px-3 py-1 text-xs font-medium text-[#486500]">
                      Tu equipo
                    </span>
                  )}
                </div>
                <h3 className="mt-7 text-xl font-semibold">{plan.name}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">
                  {plan.description}
                </p>
                <p className="mt-6 text-3xl font-semibold tracking-[-.05em]">
                  {money(plan.monthly_price_cents, plan.currency)}
                  <span className="ml-1 text-sm font-normal tracking-normal text-[var(--muted)]">
                    /mes
                  </span>
                </p>
                <div className="mt-7">
                  {hasProviderSubscription ? (
                    <BillingActionButton
                      action="portal"
                      className="w-full rounded-full border border-[var(--line)] px-4 py-3 text-sm font-semibold"
                    >
                      Revisar mi equipo
                    </BillingActionButton>
                  ) : (
                    <BillingActionButton
                      action="checkout"
                      planKey={plan.plan_key}
                      className="w-full rounded-full border border-[var(--line)] px-4 py-3 text-sm font-semibold"
                    >
                      Elegir {plan.name}
                    </BillingActionButton>
                  )}
                </div>
              </article>
            ))}
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Documentos reales</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Tus facturas.</h2>
          </div>
          <CreditCard className="text-[var(--muted)]" />
        </div>
        {availableInvoices.length ? (
          <div className="surface mt-7 overflow-hidden rounded-3xl">
            <ul className="divide-y divide-[var(--line)]">
              {availableInvoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-[#789500]" />
                    <div>
                      <p className="text-sm font-medium">
                        {money(
                          invoice.amount_paid_cents || invoice.amount_due_cents,
                          invoice.currency,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {invoice.status} ·{' '}
                        {new Date(invoice.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                  {invoice.invoice_url && (
                    <a
                      href={invoice.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium underline underline-offset-4"
                    >
                      Ver factura
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-7 rounded-3xl border border-dashed border-[var(--line)] p-8">
            <FileText className="text-[var(--muted)]" />
            <p className="mt-5 font-medium">Aún no hay facturas confirmadas.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Aparecerán aquí únicamente cuando el proveedor de pagos las envíe y queden guardadas.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function Filter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={value ?? 'all'}
        className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
