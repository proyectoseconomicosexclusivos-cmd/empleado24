'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TechnicalProjectUploader() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setMessage(null);
    const result = await fetch('/api/technical-projects', { method: 'POST', body: new FormData(form) });
    const payload = await result.json().catch(() => ({}));
    setBusy(false);
    if (!result.ok) {
      setMessage(payload.message ?? 'No se ha podido preparar el análisis. Revisa el archivo e inténtalo de nuevo.');
      return;
    }
    form.reset();
    setMessage(payload.quoteId ? 'Análisis listo. También hemos creado un borrador sin precios para que lo revises en Presupuestos IA.' : 'Análisis listo. Añade Presupuestos IA cuando quieras convertir las partidas en un presupuesto.');
    router.refresh();
  }

  return <form onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }} className="grid gap-3" aria-label="Subir proyecto técnico">
    <input name="title" required minLength={2} maxLength={180} className="input" placeholder="Ej. Reforma vivienda Calle Mayor" />
    <div className="grid gap-3 sm:grid-cols-2"><input name="customer_name" required minLength={2} className="input" placeholder="Nombre del cliente" /><input name="customer_email" type="email" className="input" placeholder="Email (opcional)" /></div>
    <input name="customer_phone" className="input" placeholder="Teléfono (opcional)" />
    <label className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">PDF, JPG, PNG o WebP · máximo 20 MB<input required name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-3 block w-full text-sm text-[var(--fg)]" /></label>
    <p className="text-xs leading-5 text-[var(--muted)]">El resultado es preliminar: muestra la evidencia encontrada y sus limitaciones. No certifica medidas ni sustituye una revisión profesional.</p>
    <button disabled={busy} className="rounded-full bg-[#111315] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-[#f4f5f0] dark:text-[#111315]">{busy ? 'Analizando archivo privado…' : 'Analizar proyecto'}</button>
    {message && <p role="status" className="text-sm text-[var(--muted)]">{message}</p>}
  </form>;
}
