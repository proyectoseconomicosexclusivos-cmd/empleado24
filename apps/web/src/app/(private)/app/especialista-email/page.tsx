import Link from 'next/link';
import { ArrowRight, CheckCircle2, Mail, Send, Users } from 'lucide-react';
import { CompanyService } from '@/services/company-service';
import { IntegrationService } from '@/services/integration-service';
import { createClient } from '@/lib/supabase/server';

export default async function EmailSpecialistPage() {
  const membership = await CompanyService.current();
  const companyRelation = membership?.companies;
  const company = Array.isArray(companyRelation) ? companyRelation[0] : companyRelation;
  if (!company) return null;
  const supabase = await createClient() as any;
  const [{ data: employee }, { count: contacts }, { count: templates }, { count: campaigns }, integrationsResult] = await Promise.all([
    supabase.from('employees').select('id,name,runtime_status').eq('company_id', company.id).eq('employee_type', 'email_specialist').maybeSingle(),
    supabase.from('email_contacts').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    supabase.from('email_templates').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    supabase.from('email_campaigns').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    IntegrationService.list(company.id),
  ]);
  const emailConnection = (integrationsResult.data ?? []).find((item) => item.provider_key === 'brevo');
  const emailReady = emailConnection?.enabled && emailConnection.status === 'connected';

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
      <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${emailReady ? 'bg-[#e9ffcf] text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]' : 'bg-[#fff8e5] text-[#5f4b16] dark:bg-[#2c260f] dark:text-[#f4dda0]'}`}>{emailReady ? <CheckCircle2 size={16}/> : <Send size={16}/>} {emailReady ? 'Listo para trabajar' : 'Pendiente de conectar el envío'}</span>
    </header>
    {!emailReady && <section className="mt-8 rounded-3xl border border-[#ead9a7] bg-[#fff8e5] p-6 text-[#5f4b16] dark:border-[#4d421f] dark:bg-[#2c260f] dark:text-[#f4dda0]"><p className="font-semibold">Conecta la cuenta de envío de {company.name}.</p><p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">Tu Especialista utilizará exclusivamente la cuenta de tu empresa. Empleado24 comprobará la conexión y mantendrá la clave cifrada.</p><Link href="/app/integraciones/brevo" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#111315] px-5 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]">Conectar cuenta de envío <ArrowRight size={15}/></Link></section>}
    <section className="mt-12 grid gap-4 md:grid-cols-3">
      <Metric icon={Users} value={contacts ?? 0} label="Contactos de tu empresa" />
      <Metric icon={Mail} value={templates ?? 0} label="Mensajes preparados" />
      <Metric icon={CheckCircle2} value={campaigns ?? 0} label="Campañas guardadas" />
    </section>
    <section className="mt-8 rounded-3xl border border-dashed border-[var(--line)] p-8"><p className="font-medium">{emailReady ? 'Ya puede empezar a trabajar.' : 'Su espacio privado ya está preparado.'}</p><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{emailReady ? 'Los contactos, mensajes y campañas de correo quedan separados por empresa y saldrán únicamente desde tu cuenta conectada.' : 'Conecta la cuenta de envío para completar su incorporación. Los contactos y mensajes seguirán separados de cualquier otra empresa.'}</p></section>
  </main>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof Mail; value: number; label: string }) {
  return <article className="surface rounded-3xl p-6"><Icon size={19} className="text-[#789500]"/><p className="mt-8 text-3xl font-semibold tracking-[-.05em]">{value}</p><p className="mt-1 text-sm text-[var(--muted)]">{label}</p></article>;
}
