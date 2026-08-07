import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { InstallationStatus } from '@/lib/installation-engine';

type Props = { companyName: string; employeeName: string; installation: InstallationStatus; configured?: string; children: ReactNode };

export function SetupWizard({ companyName, employeeName, installation, configured, children }: Props) {
  const next = installation.nextAction;
  const showCompanyForm = next?.id === 'company' || next?.id === 'receptionist';
  return <main className="mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-14">
    <Link href="/" className="text-lg font-bold tracking-[-.07em]">EMPLEADO<span className="text-[#789500]">24</span></Link>
    <header className="mt-14 max-w-3xl"><p className="eyebrow">Empresa IA</p><h1 className="mt-4 text-4xl font-semibold tracking-[-.065em] md:text-6xl">{installation.isOperational ? 'Tu empresa ya está funcionando.' : `He revisado ${companyName}.`}</h1><p className="mt-5 text-lg leading-8 text-[var(--muted)]">{installation.isOperational ? `${employeeName} ya puede atender. Tu instalación sigue disponible cuando incorpores más equipo.` : next ? `Solo nos falta: ${next.label.toLowerCase()}.` : 'Todo está correcto.'}</p></header>
    <section className="mt-10 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(17,19,21,.06)] md:p-8"><div className="flex items-end justify-between gap-5"><div><p className="eyebrow">Estado de instalación</p><p className="mt-2 text-4xl font-semibold tracking-[-.06em]">{installation.progress}%</p></div><span className={`rounded-full px-4 py-2 text-sm font-semibold ${installation.isOperational ? 'bg-[#e9ffcf] text-[#486500]' : 'bg-black/5 text-[var(--muted)] dark:bg-white/5'}`}>{installation.isOperational ? '● Empresa operativa' : `~${installation.estimatedRemainingMinutes} min`}</span></div><div className="mt-6 h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-[#ccff00] transition-all duration-500" style={{ width: `${installation.progress}%` }}/></div>{next && <div className="mt-7 rounded-2xl border border-[var(--line)] p-5"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#789500]">Siguiente acción</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">{next.label}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{next.detail}</p><Link href={next.href} className="action-primary mt-5">Resolver ahora <ArrowRight size={16}/></Link></div>}</section>
    {configured && <p role="status" className="mt-6 rounded-2xl bg-[#efffcf] p-4 text-sm text-[#486500]">Conexión verificada. He actualizado el estado real de tu empresa.</p>}
    {showCompanyForm && <section className="mt-8"><div className="surface rounded-3xl p-6 md:p-8"><p className="eyebrow">Configuración de empresa</p><h2 className="mt-2 text-2xl font-semibold">Dale a {employeeName} el contexto que necesita.</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Solo se muestra mientras esta configuración sea el requisito pendiente.</p></div>{children}</section>}
    <section className="mt-8 grid gap-3 sm:grid-cols-2">{installation.completedSteps.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--line)] p-4"><div className="flex items-center gap-2 text-[#486500]"><Check size={16}/><span className="text-sm font-semibold">{item.label}</span></div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Detectado automáticamente.</p></article>)}</section>
    {installation.isOperational && <Link href="/app" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#111315] px-5 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]"><Sparkles size={16}/> Entrar en mi empresa <ArrowRight size={16}/></Link>}
  </main>;
}
