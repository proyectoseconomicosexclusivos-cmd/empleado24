'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bell, BrainCircuit, CalendarDays, Check, ChevronRight, Mail, MessageCircle, PhoneCall, Sparkles, Users } from 'lucide-react';
import { EmployeeAvatar } from '@/components/employee-avatar';
import { employeeShowcase, hiringHref } from '@/lib/employee-showcase';

const simulation = [
  { employee: 'Laura', title: 'Entra una llamada', detail: 'Cliente: “Quiero pedir presupuesto para esta semana.”', result: 'Necesidad y horario recogidos', metric: 'Llamadas atendidas' },
  { employee: 'Laura', title: 'Detecta una oportunidad', detail: 'Clasifica la conversación como solicitud de presupuesto.', result: 'Lead creado en el historial', metric: 'Leads creados' },
  { employee: 'Carlos', title: 'Recibe el seguimiento', detail: 'La oportunidad pasa al equipo comercial con todo el contexto.', result: 'Próxima acción preparada', metric: 'Seguimientos' },
  { employee: 'David', title: 'Prepara el mensaje', detail: 'Confirma la información y envía el siguiente paso al cliente.', result: 'Email de seguimiento listo', metric: 'Emails enviados' },
  { employee: 'Marta', title: 'Organiza el presupuesto', detail: 'Relaciona la solicitud con el cliente y sus necesidades.', result: 'Borrador de presupuesto listo', metric: 'Presupuestos' },
  { employee: 'Laura', title: 'Propone una cita', detail: 'Encuentra una hora disponible y la deja preparada para revisión.', result: 'Cita creada en la agenda', metric: 'Citas creadas' },
] as const;

const employeeDetail: Record<string, { receives: string; returns: string; triggers: string }> = {
  Laura: { receives: 'Llamadas, horario y la necesidad inicial del cliente.', returns: 'Una respuesta, datos recogidos y una cita si corresponde.', triggers: 'Lead, cita y siguiente acción para el equipo.' },
  Carlos: { receives: 'La oportunidad y el historial que dejó Laura.', returns: 'Prioridad comercial y seguimiento recomendado.', triggers: 'Tarea de seguimiento o aviso al equipo.' },
  David: { receives: 'Contexto de la conversación y el siguiente paso.', returns: 'Un email alineado con el cliente y la empresa.', triggers: 'Seguimiento y actualización del historial.' },
  Elena: { receives: 'Mensajes de WhatsApp y contexto del cliente.', returns: 'Respuesta y detección de intención comercial.', triggers: 'Oportunidad, cita o traspaso al equipo.' },
  Marta: { receives: 'Solicitud, necesidades y datos de presupuesto.', returns: 'Un borrador organizado para revisión.', triggers: 'Presupuesto y tarea de seguimiento.' },
};

export default function DemoPage() {
  const [current, setCurrent] = useState(0);
  const [running, setRunning] = useState(true);
  const [selected, setSelected] = useState('Laura');
  const active = simulation[current] ?? simulation[0]!;
  const selectedEmployee = employeeShowcase.find((employee) => employee.person === selected) ?? employeeShowcase[0];
  const detail = employeeDetail[selectedEmployee?.person ?? 'Laura'] ?? employeeDetail.Laura!;
  const totals = useMemo(() => ({ calls: 24 + current, messages: 38 + current * 2, emails: 12 + Math.max(0, current - 2), meetings: 3 + Math.max(0, current - 4), budgets: Math.max(0, current - 3) }), [current]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setCurrent((value) => (value + 1) % simulation.length), 6500);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <main className="min-h-screen bg-[#101210] text-white">
      <header className="border-b border-white/10 bg-[#101210]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 md:px-10">
          <Link href="/" className="text-lg font-bold tracking-[-.07em]">EMPLEADO<span className="text-[#ccff00]">24</span></Link>
          <div className="flex items-center gap-3"><span className="hidden rounded-full border border-[#516b18] bg-[#253206] px-3 py-1 text-xs font-medium text-[#d5f899] sm:inline">SIMULACIÓN INTERACTIVA</span><Link href={hiringHref(employeeShowcase[0]!)} data-e24-track="demo_total_start" data-e24-zone="demo_total" className="rounded-full bg-[#ccff00] px-4 py-2 text-sm font-semibold text-[#111315]">Quiero esto en mi empresa <ArrowRight size={14} className="inline" /></Link></div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6 md:px-10 md:py-14">
        <div className="max-w-4xl"><p className="font-mono text-xs uppercase tracking-[.16em] text-[#ccff00]">Ejemplo interactivo · sin datos de clientes</p><h1 className="mt-4 text-4xl font-semibold tracking-[-.07em] sm:text-5xl md:text-7xl">Así se ve una empresa cuando el equipo trabaja junto.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">Pulsa a cualquier empleado, mira cómo pasa una oportunidad y revisa la memoria compartida. Todo lo que ves es una simulación.</p></div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Counter icon={PhoneCall} label="Llamadas atendidas" value={totals.calls} />
          <Counter icon={MessageCircle} label="WhatsApps respondidos" value={totals.messages} />
          <Counter icon={Mail} label="Emails enviados" value={totals.emails} />
          <Counter icon={CalendarDays} label="Citas creadas" value={totals.meetings} />
          <Counter icon={Check} label="Presupuestos enviados" value={totals.budgets} />
        </div>
        <p className="mt-3 text-xs text-white/40">Todos los contadores son datos de demostración.</p>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#171a17]">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:px-7"><div><p className="font-mono text-xs uppercase tracking-[.14em] text-[#ccff00]">Oficina virtual · ejemplo</p><h2 className="mt-1 text-2xl font-semibold">Actividad de la empresa</h2></div><button type="button" onClick={() => setRunning((value) => !value)} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">{running ? 'Pausar simulación' : 'Continuar simulación'}</button></div>
            <div className="p-4 sm:p-6"><div className="rounded-3xl border border-[#516b18] bg-[#202a05] p-5"><div className="flex items-start gap-4"><EmployeeBadge person={active.employee} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#ccff00] px-2 py-1 text-[10px] font-bold text-[#111315]">AHORA</span><span className="text-sm text-[#d5f899]">Datos de demostración</span></div><h3 className="mt-3 text-xl font-semibold">{active.title}</h3><p className="mt-2 leading-7 text-white/70">{active.detail}</p><div className="mt-5 flex items-center gap-2 rounded-2xl bg-black/20 p-3 text-sm text-[#d5f899]"><Check size={16} /> {active.result}</div></div></div></div>
              <ol className="mt-5 grid gap-2">{simulation.map((step, index) => <li key={step.title} className={`flex items-center gap-3 rounded-2xl p-3 transition ${index === current ? 'bg-white text-[#111315]' : index < current ? 'bg-white/5 text-white/65' : 'text-white/35'}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index === current ? 'bg-[#111315] text-[#ccff00]' : 'bg-white/10'}`}>{index + 1}</span><span className="flex-1 text-sm font-medium">{step.title}</span>{index === current && <Sparkles size={16} />}</li>)}</ol>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-[#171a17] p-5 sm:p-6"><p className="font-mono text-xs uppercase tracking-[.14em] text-[#ccff00]">Equipo · ejemplo</p><h2 className="mt-2 text-xl font-semibold">Pulsa a una persona</h2><div className="mt-5 grid gap-2">{employeeShowcase.map((employee) => <button type="button" key={employee.slug} onClick={() => setSelected(employee.person)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${selectedEmployee?.person === employee.person ? 'border-[#ccff00] bg-[#283509]' : 'border-white/10 hover:border-white/30'}`}><EmployeeAvatar portrait={employee.portrait} name={employee.person} objectPosition={employee.portraitPosition} className="h-10 w-10" /><span><b className="block text-sm">{employee.person}</b><span className="block text-xs text-white/50">{employee.name}</span></span><ChevronRight className="ml-auto text-white/40" size={16} /></button>)}</div></section>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
          <section className="rounded-[2rem] border border-white/10 bg-[#171a17] p-5 sm:p-7"><div className="flex items-center gap-4"><EmployeeAvatar portrait={selectedEmployee?.portrait ?? '/employees/laura.jpg'} name={selectedEmployee?.person ?? 'Laura'} objectPosition={selectedEmployee?.portraitPosition} className="h-16 w-16" /><div><p className="font-mono text-xs uppercase tracking-[.14em] text-[#ccff00]">Empleado seleccionado</p><h2 className="mt-1 text-2xl font-semibold">{selectedEmployee?.person}</h2><p className="text-sm text-white/55">{selectedEmployee?.name}</p></div></div><div className="mt-7 grid gap-3 text-sm"><DemoDetail label="Recibe" value={detail.receives} /><DemoDetail label="Devuelve" value={detail.returns} /><DemoDetail label="Activa" value={detail.triggers} /></div></section>
          <section className="rounded-[2rem] border border-white/10 bg-[#171a17] p-5 sm:p-7"><div className="flex items-center gap-3"><BrainCircuit className="text-[#ccff00]" /><div><p className="font-mono text-xs uppercase tracking-[.14em] text-[#ccff00]">Brain · ejemplo</p><h2 className="mt-1 text-2xl font-semibold">Una sola memoria para el cliente</h2></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><MemoryCard title="Cliente" body="Solicitud de presupuesto · esta semana" /><MemoryCard title="Contexto" body="Necesita cita y presupuesto" /><MemoryCard title="Siguiente paso" body="Carlos confirma el seguimiento" /></div><p className="mt-5 text-sm leading-6 text-white/55">Esta vista enseña cómo se comparte el contexto. Es una simulación y no representa información de ningún cliente real.</p></section>
        </div>

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#171a17] p-5 sm:p-7"><div className="flex items-center gap-3"><Users className="text-[#ccff00]" /><div><p className="font-mono text-xs uppercase tracking-[.14em] text-[#ccff00]">CRM · ejemplo</p><h2 className="mt-1 text-2xl font-semibold">La oportunidad avanza sin perder el hilo</h2></div></div><div className="mt-7 grid gap-3 sm:grid-cols-5">{['Nuevo', 'Contactado', 'Interesado', 'Presupuesto', 'Venta'].map((stage, index) => <div key={stage} className={`rounded-2xl border p-4 ${index <= Math.min(4, current) ? 'border-[#516b18] bg-[#202a05]' : 'border-white/10 bg-black/10'}`}><span className="text-xs text-white/45">{String(index + 1).padStart(2, '0')}</span><p className="mt-5 font-semibold">{stage}</p>{index === Math.min(4, current) && <p className="mt-2 text-xs text-[#d5f899]">Ejemplo activo</p>}</div>)}</div></section>

        <section className="mt-10 rounded-[2rem] bg-[#ccff00] p-7 text-[#111315] sm:p-10"><p className="font-mono text-xs uppercase tracking-[.14em] text-[#486500]">Tu empresa, no una simulación</p><div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="max-w-3xl text-4xl font-semibold tracking-[-.06em] md:text-6xl">¿Quieres que este sea el primer flujo de tu empresa?</h2><p className="mt-4 max-w-2xl text-lg leading-7 text-[#314300]">Empieza con Laura, prueba 3 días y decide después. Sin permanencia.</p></div><Link href={hiringHref(employeeShowcase[0]!)} data-e24-track="demo_total_activate" data-e24-zone="demo_total" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#111315] px-6 py-3.5 font-semibold text-white">Quiero esto en mi empresa <ArrowRight size={17} /></Link></div></section>
      </section>
    </main>
  );
}

function Counter({ icon: Icon, label, value }: { icon: typeof PhoneCall; label: string; value: number }) { return <article className="rounded-2xl border border-white/10 bg-[#171a17] p-4"><Icon className="text-[#ccff00]" size={18} /><p className="mt-6 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-white/50">{label}</p></article>; }
function EmployeeBadge({ person }: { person: string }) { const employee = employeeShowcase.find((item) => item.person === person); return employee ? <EmployeeAvatar portrait={employee.portrait} name={employee.person} objectPosition={employee.portraitPosition} className="h-12 w-12" /> : <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Bell size={18} /></span>; }
function DemoDetail({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-black/15 p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#ccff00]">{label}</p><p className="mt-2 leading-6 text-white/65">{value}</p></div>; }
function MemoryCard({ title, body }: { title: string; body: string }) { return <article className="rounded-2xl bg-black/15 p-4"><p className="text-sm font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-white/55">{body}</p></article>; }
