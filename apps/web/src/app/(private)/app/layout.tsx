import Link from 'next/link';
import { Bell, Calculator, Clock3, CreditCard, Headphones, Home, Mail, MessageCircle, PlugZap, Settings, Sparkles, TrendingUp } from 'lucide-react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AuthService } from '@/services/auth-service';
import { SignOutButton } from '@/components/sign-out-button';
import { createClient } from '@/lib/supabase/server';
import { HelpCenter } from '@/components/help-center';

const baseNavigation = [
  { href: '/app', label: 'Mi oficina', icon: Home },
  { href: '/app/recepcionista', label: 'Mi Recepcionista', icon: Headphones },
  { href: '/app#jornada', label: 'Actividad', icon: Clock3 },
  { href: '/app#avisos', label: 'Avisos', icon: Bell },
  { href: '/app/configuracion', label: 'Su forma de trabajar', icon: Settings },
  { href: '/app/integraciones', label: 'Conexiones', icon: PlugZap },
  { href: '/app/facturacion', label: 'Mis empleados', icon: CreditCard },
];

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const user = await AuthService.currentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const departmentClient = supabase as any;
  const { data: membership } = await supabase.from('members').select('company_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (!membership) redirect('/onboarding');
  const { data: settings } = await supabase.from('settings').select('data').eq('company_id', membership.company_id).maybeSingle();
  const [{ data: employees }, { data: integrations }, { data: companyDepartments }] = await Promise.all([
    supabase
    .from('employees')
    .select('employee_type')
    .eq('company_id', membership.company_id),
    supabase.from('company_integrations').select('provider_key,status,enabled').eq('company_id', membership.company_id),
    departmentClient.from('company_departments').select('id').eq('company_id', membership.company_id).eq('status', 'active').limit(1),
  ]);
  const employeeTypes = new Set((employees ?? []).map((employee) => employee.employee_type));
  const navigation = [
    ...baseNavigation.slice(0, 2),
    ...(employeeTypes.has('email_specialist') ? [{ href: '/app/especialista-email', label: 'Especialista Email', icon: Mail }] : []),
    ...(employeeTypes.has('budget_specialist') ? [{ href: '/app/presupuestos', label: 'Presupuestos IA', icon: Calculator }] : []),
    ...(employeeTypes.has('closer') ? [{ href: '/app/centro-ventas', label: 'Centro de Ventas', icon: TrendingUp }] : []),
    ...(employeeTypes.has('whatsapp') ? [{ href: '/app/whatsapp', label: 'WhatsApp IA', icon: MessageCircle }] : []),
    ...baseNavigation.slice(2),
  ];
  const settingsData = settings?.data;
  const completed = Boolean(settingsData && typeof settingsData === 'object' && !Array.isArray(settingsData) && settingsData.onboarding_completed === true);
  const pathname = (await headers()).get('x-pathname') ?? '';
  const setupRoute = [
    '/app/integraciones',
    '/app/recepcionista',
    '/app/primera-llamada',
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!completed && !setupRoute) redirect('/onboarding');

  return (
    <div className="min-h-screen bg-[var(--bg)] md:grid md:grid-cols-[256px_1fr]">
      <aside className="border-b border-[var(--line)] bg-[var(--card)] md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-5 md:block md:px-6 md:py-7">
          <Link href="/app" className="text-lg font-bold tracking-[-.07em]">
            EMPLEADO<span className="text-[#789500]">24</span>
          </Link>
          <span className="hidden text-xs text-[var(--muted)] md:mt-2 md:block">Tu equipo sigue en marcha.</span>
          <div className="md:hidden"><SignOutButton /></div>
        </div>

        <nav aria-label="Tu empresa" className="flex gap-1 overflow-x-auto px-3 pb-4 md:mt-6 md:grid md:px-4">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--fg)] dark:hover:bg-white/5"
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden px-4 md:absolute md:inset-x-0 md:bottom-5 md:block">
          <div className="mb-3 rounded-2xl bg-[#111315] p-4 text-white dark:bg-[#ccff00] dark:text-[#111315]">
            <Sparkles size={17} className="text-[#ccff00] dark:text-[#111315]" aria-hidden="true" />
            <p className="mt-5 text-sm font-medium">Estás construyendo su forma de trabajar.</p>
            <p className="mt-1 text-xs text-white/55 dark:text-[#111315]/60">Cada detalle la ayuda a representar mejor a tu empresa.</p>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <section className="min-w-0">{children}</section>
      <HelpCenter context={{
        hasPhone: (integrations ?? []).some((item) => item.provider_key === 'zadarma' && item.enabled && item.status === 'connected'),
        hasCalendar: (integrations ?? []).some((item) => item.provider_key === 'google_calendar' && item.enabled && item.status === 'connected'),
        employeeTypes: [...employeeTypes],
        hasDepartment: (companyDepartments ?? []).length > 0,
      }} />
    </div>
  );
}
