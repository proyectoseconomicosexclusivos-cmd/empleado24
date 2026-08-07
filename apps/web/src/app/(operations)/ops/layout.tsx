import Link from 'next/link';
import { Activity, BarChart3, BrainCircuit, Building2, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { SignOutButton } from '@/components/sign-out-button';
import { OperationsService } from '@/services/operations-service';

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  const admin = await OperationsService.requireAdmin();
  return (
    <div className="min-h-screen bg-[#0b0d0c] text-[#f5f7f2]">
      <header className="border-b border-white/10 bg-[#0b0d0c]/95">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-5 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <Link href="/ops" className="text-lg font-bold tracking-[-.07em]">EMPLEADO<span className="text-[#ccff00]">24</span></Link>
            <span className="hidden h-5 w-px bg-white/15 sm:block" />
            <span className="hidden items-center gap-2 text-xs text-white/55 sm:flex"><ShieldCheck size={14} className="text-[#ccff00]" /> Operations Center</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/55">
            <span className="hidden md:inline">{admin.email} · {admin.role}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] md:grid-cols-[210px_1fr]">
        <aside className="hidden min-h-[calc(100vh-65px)] border-r border-white/10 p-5 md:block">
          <nav className="grid gap-1 text-sm">
            <Link href="/ops/ceo" className="flex items-center gap-3 rounded-xl bg-white/8 px-3 py-2.5"><BrainCircuit size={16} className="text-[#ccff00]" /> CEO IA</Link>
            <Link href="/ops" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/8"><Activity size={16} className="text-[#ccff00]" /> Operaciones</Link>
            <Link href="/ops/business" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/8"><BarChart3 size={16} className="text-[#ccff00]" /> CEO Dashboard</Link>
            <Link href="/ops/audit" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/8"><ClipboardCheck size={16} className="text-[#ccff00]" /> Auditoría</Link>
            <span className="mt-1 flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-white/35" aria-disabled="true"><Building2 size={16} /> Sin impersonación</span>
          </nav>
          <div className="mt-8 rounded-2xl border border-[#ccff00]/20 bg-[#ccff00]/5 p-4 text-xs leading-5 text-white/55">
            Las acciones de soporte quedan registradas. Este panel nunca entra en la sesión de un cliente.
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
