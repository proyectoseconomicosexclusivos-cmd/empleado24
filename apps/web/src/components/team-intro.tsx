'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmployeeIdentity } from '@/components/employee-identity';
import { employeeShowcase } from '@/lib/employee-showcase';

const moments = [
  { employee: 0, label: 'Una llamada encuentra respuesta', detail: 'Laura organiza una cita' },
  { employee: 3, label: 'Un mensaje recibe contexto', detail: 'Elena detecta una oportunidad' },
  { employee: 2, label: 'El equipo sabe qué hacer', detail: 'Carlos prepara el siguiente paso' },
  { employee: 4, label: 'La oportunidad avanza', detail: 'Marta ordena el presupuesto' },
  { employee: 1, label: 'El seguimiento no se enfría', detail: 'David cuida la conversación' },
];

export function TeamIntro() {
  const [activeMoment, setActiveMoment] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setActiveMoment((current) => (current + 1) % moments.length),
      3600,
    );
    return () => window.clearInterval(timer);
  }, [playing]);

  const moment = moments[activeMoment]!;
  const employee = employeeShowcase[moment.employee]!;

  return (
    <section className="premium-film overflow-hidden rounded-[2rem] border border-black/10 bg-[#111315] text-white shadow-[0_28px_80px_rgba(17,19,21,.18)] dark:border-white/10">
      <div className="relative min-h-[500px] overflow-hidden p-5 sm:p-7">
        <Image
          src="/images/empleado24-team-studio.jpg"
          alt="Equipo de empleados IA de Empleado24 reunido en una oficina"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 48vw"
          className="object-cover opacity-65 transition-transform duration-[3500ms] ease-out"
          style={{ transform: `scale(${playing ? 1.04 : 1})` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,14,13,.12),rgba(12,14,13,.82)_72%)]" />

        <div className="relative flex items-start justify-between gap-4">
          <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] backdrop-blur">
            Empresa en marcha
          </span>
          <button
            type="button"
            onClick={() => setPlaying((current) => !current)}
            className="grid size-9 place-items-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur transition hover:bg-white hover:text-[#111315]"
            aria-label={playing ? 'Pausar demostración' : 'Reanudar demostración'}
          >
            {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
        </div>

        <div className="relative flex min-h-[378px] flex-col justify-end">
          <p className="text-xs font-medium uppercase tracking-[.16em] text-white/60">
            {String(activeMoment + 1).padStart(2, '0')} / {String(moments.length).padStart(2, '0')}
          </p>
          <h2 className="mt-3 max-w-md text-3xl font-semibold leading-[.98] tracking-[-.06em] sm:text-4xl">
            {moment.label}.
          </h2>
          <p className="mt-3 text-sm text-white/70">{moment.detail}.</p>
          <div className="mt-5">
            <EmployeeIdentity employee={employee} compact className="text-white" />
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-4 py-2.5 text-sm font-semibold text-[#111315] transition hover:scale-[1.02]"
            >
              Ver la demostración
              <ArrowUpRight size={16} />
            </Link>
            <span className="text-xs text-white/55">Simulación visual · sin datos reales</span>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 bg-black/30 px-5 py-4 sm:px-7" aria-label="Progreso de demostración">
        {moments.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setActiveMoment(index)}
            className="h-1 flex-1 overflow-hidden rounded-full bg-white/20"
            aria-label={`Mostrar momento ${index + 1}`}
          >
            <span
              className={`block h-full bg-[#ccff00] transition-all duration-500 ${index === activeMoment ? 'w-full' : 'w-0'}`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
