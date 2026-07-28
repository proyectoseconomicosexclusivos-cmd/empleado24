import Link from 'next/link';
import { CalendarDays, CheckCircle2, CircleDollarSign, Flame, Phone, Plus, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { CompanyService } from '@/services/company-service';
import { createClient } from '@/lib/supabase/server';
import { createOpportunity, createSalesActivity, updateOpportunityStage } from '@/app/actions/sales';

const stageCopy: Record<string, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  interested: 'Interesado',
  quote_sent: 'Presupuesto enviado',
  negotiation: 'Negociación',
  won: 'Ganado',
  lost: 'Perdido',
};

const heatCopy: Record<string, { label: string; className: string }> = {
  very_hot: { label: 'Muy caliente', className: 'bg-[#ffe9d7] text-[#9a3d00]' },
  interested: { label: 'Interesado', className: 'bg-[#efffcf] text-[#526a00]' },
  cold: { label: 'Frío', className: 'bg-black/5 text-[var(--muted)] dark:bg-white/5' },
  lost: { label: 'Perdido', className: 'bg-[#f2f2ef] text-[#73736e] dark:bg-white/5' },
};

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function SalesCenterPage() {
  const membership = await CompanyService.current();
  const relation = membership?.companies;
  const company = Array.isArray(relation) ? relation[0] : relation;
  if (!company) return null;
  const supabase = await createClient() as any;
  const [{ data: closer }, { data: opportunities }, { data: activities }] = await Promise.all([
    supabase.from('employees').select('id,name,status,runtime_status').eq('company_id', company.id).eq('employee_type', 'closer').limit(1).maybeSingle(),
    supabase.from('sales_opportunities').select('*').eq('company_id', company.id).order('updated_at', { ascending: false }),
    supabase.from('sales_activities').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(30),
  ]);

  if (!closer) {
    return <main className="mx-auto max-w-4xl px-5 py-14 md:px-10">
      <p className="eyebrow">Centro de Ventas</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">Incorpora a tu Director Comercial IA.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">Tu Closer hará el seguimiento de cada posible cliente y te dirá cuál es el siguiente paso.</p>
      <Link href="/app/facturacion" className="mt-8 inline-flex rounded-full bg-[#111315] px-6 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]">Ver empleados disponibles</Link>
    </main>;
  }

  type Opportunity = { id: string; name: string; company_name: string | null; email: string | null; phone: string | null; stage: string; heat: string; value_cents: number; notes: string | null; next_action_at: string | null; updated_at: string };
  type Activity = { id: string; opportunity_id: string; activity_type: string; status: string; title: string; scheduled_at: string | null };
  const sales = (opportunities ?? []) as Opportunity[];
  const actions = (activities ?? []) as Activity[];
  const open = sales.filter((item) => !['won', 'lost'].includes(item.stage));
  const won = sales.filter((item) => item.stage === 'won');
  const hot = sales.filter((item) => item.heat === 'very_hot');
  const meetings = actions.filter((item) => item.activity_type === 'meeting' && item.status === 'planned');
  const followups = actions.filter((item) => item.status === 'planned');
  const potentialValue = open.reduce((sum, item) => sum + item.value_cents, 0);
  const wonValue = won.reduce((sum, item) => sum + item.value_cents, 0);

  return <main className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14">
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div><p className="eyebrow">Centro de Ventas</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em] md:text-5xl">Tu Closer está trabajando.</h1><p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">Aquí ves a quién está siguiendo, quién muestra interés y qué acción toca ahora.</p></div>
      <span className="rounded-full bg-[#e9ffcf] px-4 py-2 text-sm font-semibold text-[#486500]">● Operativo</span>
    </header>

    <section className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {([
        ['Oportunidades', open.length, TrendingUp],
        ['Clientes', won.length, Users],
        ['Seguimientos', followups.length, Phone],
        ['Reuniones', meetings.length, CalendarDays],
        ['Muy interesados', hot.length, Flame],
        ['Ventas', money(wonValue), CircleDollarSign],
      ] as Array<[string, string | number, LucideIcon]>).map(([label, value, Icon]) => <article key={label} className="surface rounded-3xl p-5"><Icon size={18} className="text-[#789500]"/><p className="mt-6 text-3xl font-semibold tracking-[-.05em]">{String(value)}</p><p className="mt-1 text-xs text-[var(--muted)]">{label}</p></article>)}
    </section>

    <section className="mt-10 grid gap-6 xl:grid-cols-[1fr_1.8fr]">
      <div className="surface rounded-[2rem] p-6">
        <div className="flex items-center gap-2"><Plus size={18}/><h2 className="text-xl font-semibold">Añadir posible cliente</h2></div>
        <form action={createOpportunity} className="mt-6 grid gap-3">
          <input name="name" required minLength={2} placeholder="Nombre de la persona" className="input"/>
          <input name="company_name" placeholder="Empresa" className="input"/>
          <div className="grid gap-3 sm:grid-cols-2"><input name="email" type="email" placeholder="Email" className="input"/><input name="phone" placeholder="Teléfono" className="input"/></div>
          <input name="value_euros" type="number" min="0" step="1" placeholder="Valor aproximado (€)" className="input"/>
          <textarea name="notes" placeholder="¿Qué necesita?" className="input min-h-24"/>
          <button className="mt-2 rounded-full bg-[#111315] px-5 py-3 text-sm font-semibold text-white dark:bg-[#f4f5f0] dark:text-[#111315]">Encargar seguimiento</button>
        </form>
        <div className="mt-8 rounded-2xl bg-[#f4f5f0] p-5 dark:bg-white/5"><p className="text-xs uppercase tracking-[.12em] text-[var(--muted)]">Valor en seguimiento</p><p className="mt-2 text-3xl font-semibold">{money(potentialValue)}</p></div>
      </div>

      <div>
        <div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">Trabajo comercial</p><h2 className="mt-2 text-2xl font-semibold">Oportunidades</h2></div><span className="text-sm text-[var(--muted)]">{sales.length} en total</span></div>
        {sales.length ? <div className="grid gap-4">{sales.map((opportunity) => {
          const score = heatCopy[opportunity.heat] ?? { label: 'Frío', className: 'bg-black/5 text-[var(--muted)] dark:bg-white/5' };
          return <article key={opportunity.id} className="surface rounded-3xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold">{opportunity.name}</h3><span className={`rounded-full px-3 py-1 text-xs font-medium ${score.className}`}>{score.label}</span></div><p className="mt-1 text-sm text-[var(--muted)]">{opportunity.company_name || opportunity.email || opportunity.phone || 'Datos por completar'}</p></div><p className="text-xl font-semibold">{money(opportunity.value_cents)}</p></div>
            {opportunity.notes && <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{opportunity.notes}</p>}
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <form action={updateOpportunityStage} className="flex gap-2"><input type="hidden" name="opportunity_id" value={opportunity.id}/><select name="stage" defaultValue={opportunity.stage} aria-label="Estado de la oportunidad" className="input min-w-0 flex-1">{Object.entries(stageCopy).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-xl border border-[var(--line)] px-4 text-sm font-semibold">Guardar</button></form>
              <form action={createSalesActivity} className="grid grid-cols-[auto_1fr_auto] gap-2"><input type="hidden" name="opportunity_id" value={opportunity.id}/><select name="activity_type" aria-label="Tipo de próxima acción" className="input"><option value="task">Tarea</option><option value="call">Llamada</option><option value="email">Email</option><option value="meeting">Reunión</option><option value="quote">Presupuesto</option></select><input name="title" required placeholder="Siguiente paso" className="input min-w-0"/><button title="Añadir acción" className="rounded-xl bg-[#ccff00] px-4 text-[#111315]"><Plus size={17}/></button></form>
            </div>
          </article>;
        })}</div> : <div className="rounded-3xl border border-dashed border-[var(--line)] p-10 text-center"><CheckCircle2 className="mx-auto text-[#789500]"/><p className="mt-5 font-medium">Todavía no hay oportunidades.</p><p className="mt-2 text-sm text-[var(--muted)]">Añade la primera y tu Closer organizará el seguimiento.</p></div>}
      </div>
    </section>
  </main>;
}
