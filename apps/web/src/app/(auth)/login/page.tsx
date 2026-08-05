'use client';

import Link from 'next/link';
import { ArrowRight, Headphones } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Login() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage('');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(formData.get('email')),
        password: String(formData.get('password')),
      }),
    });
    if (!response.ok) {
      setPending(false);
      setMessage(
        response.status === 429
          ? 'Demasiados intentos. Espera unos minutos antes de volver a probar.'
          : 'No hemos podido abrir tu empresa. Revisa el email y la contraseña.',
      );
      return;
    }
    router.replace('/app');
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[.9fr_1.1fr]">
      <section className="grid place-items-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="text-lg font-bold tracking-[-.07em]">
            EMPLEADO<span className="text-[#789500]">24</span>
          </Link>
          <p className="eyebrow mt-14">Vuelve a tu empresa</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">
            Tu Recepcionista puede tener novedades.
          </h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            Entra para ver cómo va su jornada y si necesita algo de ti.
          </p>
          <form action={submit} className="mt-9">
            <label className="text-sm font-medium" htmlFor="email">
              Tu email de trabajo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="tu@empresa.com"
              className="input mt-2"
            />
            <div className="mt-5 flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor="password">
                Tu contraseña
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--muted)] underline-offset-4 hover:underline"
              >
                La he olvidado
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Tu contraseña"
              className="input mt-2"
            />
            <button
              data-e24-track="login_started"
              data-e24-zone="login"
              disabled={pending}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ccff00] p-3 font-semibold text-[#111315] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
            >
              {pending ? 'Abriendo tu empresa…' : 'Ver cómo va el día'}{' '}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            {message && (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-[#fff0eb] p-3 text-sm text-[#7b3c2b] dark:bg-[#3c211a] dark:text-[#ffc9b8]"
              >
                {message}
              </p>
            )}
          </form>
          <p className="mt-7 text-sm text-[var(--muted)]">
            ¿Aún no tienes una Recepcionista?{' '}
            <Link href="/register" className="font-medium text-[var(--fg)]">
              Conócela
            </Link>
          </p>
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-[#111315] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="noise" />
        <span className="relative grid h-16 w-16 place-items-center rounded-3xl bg-[#ccff00] text-[#111315]">
          <Headphones size={27} />
        </span>
        <blockquote className="relative max-w-xl text-4xl font-semibold leading-tight tracking-[-.055em]">
          “Mientras tú estabas fuera, ella siguió cuidando de tus clientes.”
        </blockquote>
        <p className="relative text-sm text-white/50">Tu empresa, acompañada las 24 horas.</p>
      </aside>
    </main>
  );
}
