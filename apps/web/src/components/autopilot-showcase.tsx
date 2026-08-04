import Link from 'next/link';
import { ArrowRight, CheckCircle2, MessageCircle, PhoneCall, Send, Sparkles } from 'lucide-react';

const flow = [
  { time: '09:02', person: 'David', action: 'respondió un mensaje de WhatsApp', icon: MessageCircle },
  { time: '09:04', person: 'Brain', action: 'detectó interés y recuperó el historial', icon: Sparkles },
  { time: '09:08', person: 'Carlos', action: 'preparó el siguiente seguimiento', icon: PhoneCall },
  { time: '09:15', person: 'Marta', action: 'dejó listo el presupuesto', icon: CheckCircle2 },
  { time: '09:22', person: 'Elena', action: 'envió la documentación acordada', icon: Send },
];

export function AutopilotShowcase() {
  return <section className="border-y border-[var(--line)] bg-[#111315] text-white dark:bg-[#ccff00] dark:text-[#111315]"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-6 md:grid-cols-[.92fr_1.08fr] md:px-10 md:py-28"><div><p className="eyebrow text-white/55 dark:text-[#111315]/60">Autopilot Empleado24</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] md:text-6xl">Una empresa funcionando sola.</h2><p className="mt-5 max-w-xl text-lg leading-8 text-white/65 dark:text-[#111315]/65">Los empleados reciben una necesidad, entienden el contexto compartido y preparan el siguiente paso sin obligarte a repetir información.</p><Link href="/empresa-ia" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-5 py-3 text-sm font-semibold text-[#111315] dark:bg-[#111315] dark:text-white">Conocer Empresa IA <ArrowRight size={16}/></Link></div><div className="rounded-[2rem] border border-white/15 bg-white/[.07] p-5 dark:border-[#111315]/15 dark:bg-[#111315]/[.06]"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Timeline de ejemplo</p><p className="mt-1 text-xs text-white/55 dark:text-[#111315]/60">Demostración · no son datos de producción</p></div><span className="rounded-full bg-[#ccff00] px-3 py-1 text-xs font-semibold text-[#111315] dark:bg-[#111315] dark:text-white">Autopilot</span></div><div className="mt-6 grid gap-2">{flow.map(({ time, person, action, icon: Icon }) => <div key={time} className="grid grid-cols-[3rem_2rem_1fr] items-center gap-3 rounded-2xl bg-black/15 p-3 dark:bg-white/20"><span className="font-mono text-xs text-[#ccff00] dark:text-[#111315]">{time}</span><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-[#ccff00] dark:bg-[#111315]/10 dark:text-[#111315]"><Icon size={15}/></span><p className="text-sm"><strong>{person}</strong> {action}</p></div>)}</div><p className="mt-5 text-xs leading-5 text-white/50 dark:text-[#111315]/60">En tu empresa, la actividad real aparece únicamente dentro de tu espacio privado y del Dashboard CEO.</p></div></div></section>;
}
