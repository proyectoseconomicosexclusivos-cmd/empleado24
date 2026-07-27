import Link from 'next/link';
import { CheckCircle2, Mail, Users } from 'lucide-react';
import { CompanyService } from '@/services/company-service';
import { createClient } from '@/lib/supabase/server';

export default async function EmailSpecialistPage() {
  const membership = await CompanyService.current();
  const companyRelation = membership?.companies;
  const company = Array.isArray(companyRelation) ? companyRelation[0] : companyRelation;
  if (!company) return null;
  const supabase = await createClient() as any;
  const [{ data: employee }, { count: contacts }, { count: templates }, { count: campaigns }] = await Promise.all([
    supabase.from('employees').select('id,name,runtime_status').eq('company_id', company.id).eq('employee_type', 'email_specialist').maybeSingle(),
    supabase.from('email_contacts').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    supabase.from('email_templates').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    supabase.from('email_campaigns').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
  ]);

  if (!employee) {
    return <main className="grid min-h-[75vh] place-items-center px-6 py-16">
      <div className="max-w-lg text-center">
        <Mail className="mx-auto text-[var(--muted)]" size={32} aria-hidden="true" />
        <p className="eyebrow mt-8">Tu equipo</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.05em]">Tu Especialista Email aún no se ha incorporado.</h1>
        <p className="mt-3 text-[var(--muted)]">Cuando lo contrates, aquí encontrarás sus contactos, borradores y campañas de tu empresa.</p>
        <Link href="/app/facturacion" className="mt-7 inline-flex rounded-full bg-[#111315] px-5 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]">Incorporar Especialista Email</Link>
      </div>
    </main>;
  }

  return <main className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14">
    <header className="flex flex-wrap items-start justify-between gap-6">
      <div><p className="eyebrow">Tu equipo</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em] md:text-5xl">{employee.name}</h1><p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">Mantiene el contacto por email con tus clientes desde la misma empresa y sin compartir información con nadie más.</p></div>
      <span className="inline-flex items-center gap-2 rounded-full bg-[#e9ffcf] px-4 py-2 text-sm font-medium text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]"><CheckCircle2 size={16}/> Activo</span>
    </header>
    <section className="mt-12 grid gap-4 md:grid-cols-3">
      <Metric icon={Users} value={contacts ?? 0} label="Contactos de tu empresa" />
      <Metric icon={Mail} value={templates ?? 0} label="Mensajes preparados" />
      <Metric icon={CheckCircle2} value={campaigns ?? 0} label="Campañas guardadas" />
    </section>
    <section className="mt-8 rounded-3xl border border-dashed border-[var(--line)] p-8"><p className="font-medium">Su espacio de trabajo está listo.</p><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Los contactos, plantillas y campañas de correo quedan separados por empresa y se preparan desde aquí.</p></section>
  </main>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof Mail; value: number; label: string }) {
  return <article className="surface rounded-3xl p-6"><Icon size={19} className="text-[#789500]"/><p className="mt-8 text-3xl font-semibold tracking-[-.05em]">{value}</p><p className="mt-1 text-sm text-[var(--muted)]">{label}</p></article>;
}
