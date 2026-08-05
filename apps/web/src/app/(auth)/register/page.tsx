'use client';

import Link from 'next/link';
import { ArrowRight, Check, Headphones } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { employeeShowcase } from '@/lib/employee-showcase';

export default function Register() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--bg)]" />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedEmployee = employeeShowcase.find(
    (employee) => employee.planKey === searchParams.get('employee'),
  );
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage('');
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: String(formData.get('name')),
        email: String(formData.get('email')),
        password: String(formData.get('password')),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      authenticated?: boolean;
      error?: string;
    };
    if (!response.ok) {
      setIsError(true);
      setMessage(
        data.error === 'confirmation_email_rate_limited'
          ? 'Ahora mismo no podemos enviar el email de confirmación. Vuelve a intentarlo dentro de unos minutos.'
          : data.error === 'weak_password'
            ? 'Elige una contraseña más segura: al menos 8 caracteres, con mayúsculas, minúsculas y números.'
            : response.status === 429
              ? 'Has hecho demasiados intentos. Espera antes de volver a probar.'
              : 'No hemos podido empezar la contratación. Revisa los datos e inténtalo de nuevo.',
      );
      setPending(false);
      return;
    }
    if (data.authenticated) {
      router.replace('/app');
      router.refresh();
      return;
    }
    setIsError(false);
    setMessage(
      `Te hemos enviado un email. Confírmalo para darle la bienvenida a ${selectedEmployee?.name ?? 'tu nuevo empleado'}.`,
    );
    setPending(false);
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      <aside className="relative hidden overflow-hidden bg-[#111315] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="noise" />
        <Link href="/" className="relative text-lg font-bold tracking-[-.07em]">
          EMPLEADO<span className="text-[#ccff00]">24</span>
        </Link>
        <div className="relative max-w-xl">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[#ccff00] text-[#111315]">
            <Headphones size={27} />
          </span>
          <h2 className="mt-10 text-5xl font-semibold tracking-[-.065em]">
            Hoy puede ser su primer día.
          </h2>
          <ul className="mt-8 grid gap-4 text-sm text-white/65">
            {[
              'Aprenderá cómo funciona tu empresa',
              'Atenderá con tus palabras',
              'Te pedirá ayuda cuando la necesite',
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <Check size={17} className="text-[#ccff00]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/45">Empieza sin perder el trato humano.</p>
      </aside>
      <section className="grid place-items-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="text-lg font-bold tracking-[-.07em] lg:hidden">
            EMPLEADO<span className="text-[#789500]">24</span>
          </Link>
          <p className="eyebrow mt-12 lg:mt-0">Empieza la contratación</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">
            {selectedEmployee
              ? `Conoce a ${selectedEmployee.name}.`
              : 'Conoce a tu nuevo empleado.'}
          </h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            Primero necesitamos saber quién lo incorpora al equipo.
          </p>
          <form action={submit} className="mt-9">
            <label className="text-sm font-medium" htmlFor="name">
              ¿Cómo te llamas?
            </label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              required
              placeholder="Tu nombre"
              className="input mt-2"
            />
            <label className="mt-5 block text-sm font-medium" htmlFor="email">
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
            <label className="mt-5 block text-sm font-medium" htmlFor="password">
              Crea una contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="Mínimo 8 caracteres"
              className="input mt-2"
            />
            <button
              data-e24-track="register_started"
              data-e24-zone="registration"
              disabled={pending}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ccff00] p-3 font-semibold text-[#111315] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
            >
              {pending ? 'Preparando la bienvenida…' : 'Empezar la contratación'}{' '}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            {message && (
              <p
                role={isError ? 'alert' : 'status'}
                className={`mt-5 rounded-xl p-4 text-sm ${isError ? 'bg-[#fff0eb] text-[#7b3c2b] dark:bg-[#3c211a] dark:text-[#ffc9b8]' : 'bg-[#efffcf] text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]'}`}
              >
                {message}
              </p>
            )}
          </form>
          <p className="mt-7 text-sm text-[var(--muted)]">
            ¿Ya forma parte de tu equipo?{' '}
            <Link href="/login" className="font-medium text-[var(--fg)]">
              Entrar en tu empresa
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
