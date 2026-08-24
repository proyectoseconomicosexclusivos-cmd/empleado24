import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type InstallationStep = { id: string; label: string; complete: boolean; href: string; detail: string };
export type InstallationStatus = { progress: number; completedSteps: InstallationStep[]; pendingSteps: InstallationStep[]; nextAction: InstallationStep | null; estimatedRemainingMinutes: number; isOperational: boolean };

export async function getInstallationStatus(companyId: string): Promise<InstallationStatus> {
  const supabase = await createClient() as any;
  const [companyResult, employeesResult, integrationsResult, callsResult, whatsappResult, quotesResult, technicalProjectsResult] = await Promise.all([
    supabase.from('companies').select('id').eq('id', companyId).maybeSingle(),
    supabase.from('employees').select('employee_type,status,runtime_status').eq('company_id', companyId),
    supabase.from('company_integrations').select('provider_key,status,enabled').eq('company_id', companyId),
    supabase.from('calls').select('id').eq('company_id', companyId).limit(1),
    supabase.from('whatsapp_messages').select('id').eq('company_id', companyId).limit(1),
    supabase.from('quotes').select('id').eq('company_id', companyId).limit(1),
    supabase.from('technical_projects').select('id').eq('company_id', companyId).eq('status', 'ready').limit(1),
  ]);
  const employees = employeesResult.data ?? [];
  const integrations = integrationsResult.data ?? [];
  const connected = (key: string) => integrations.some((item: any) => item.provider_key === key && item.enabled && item.status === 'connected');
  const receptionist = employees.some((item: any) => item.employee_type === 'receptionist' && item.status !== 'archived');
  const has = (type: string) => employees.some((item: any) => item.employee_type === type && item.status === 'active');
  const steps: InstallationStep[] = [
    { id: 'company', label: 'Empresa creada', complete: Boolean(companyResult.data), href: '/onboarding', detail: 'Tu espacio de empresa está preparado.' },
    { id: 'receptionist', label: 'Recepcionista instalada', complete: receptionist, href: '/onboarding', detail: 'Laura ya forma parte de tu equipo.' },
    { id: 'phone', label: 'Teléfono conectado', complete: connected('zadarma'), href: '/app/integraciones/zadarma', detail: 'Laura podrá atender llamadas.' },
    { id: 'whatsapp', label: 'WhatsApp conectado', complete: connected('whatsapp_meta'), href: '/app/integraciones/whatsapp_meta', detail: 'Atiende mensajes de tus clientes.' },
    { id: 'email', label: 'Correo conectado', complete: connected('brevo'), href: '/app/integraciones/brevo', detail: 'Envía seguimientos desde tu empresa.' },
    { id: 'calendar', label: 'Calendar conectado', complete: connected('google_calendar'), href: '/app/integraciones/google_calendar', detail: 'Reserva sin solapar citas.' },
    { id: 'call', label: 'Primera llamada realizada', complete: Boolean(callsResult.data?.length), href: '/app/primera-llamada', detail: 'Comprueba la atención de Laura.' },
    { id: 'whatsapp-proof', label: 'Primer WhatsApp real', complete: Boolean(whatsappResult.data?.length), href: '/app/whatsapp', detail: 'Valida la atención por WhatsApp.' },
    { id: 'quote', label: 'Primer presupuesto generado', complete: Boolean(quotesResult.data?.length), href: '/app/presupuestos', detail: has('budget_specialist') ? 'Crea una propuesta para un cliente.' : 'Se activará al contratar Presupuestos IA.' },
    ...(has('technical_architect') ? [{ id: 'technical-project', label: 'Primer proyecto técnico analizado', complete: Boolean(technicalProjectsResult.data?.length), href: '/app/arquitecto-tecnico', detail: 'Sube un PDF o imagen para preparar una memoria técnica preliminar.' }] : []),
  ];
  const completedSteps = steps.filter((step) => step.complete);
  const pendingSteps = steps.filter((step) => !step.complete);
  const operational = ['company', 'receptionist', 'phone', 'call'].every((id) => steps.find((step) => step.id === id)?.complete);
  return { progress: Math.round((completedSteps.length / steps.length) * 100), completedSteps, pendingSteps, nextAction: pendingSteps.find((step) => step.id !== 'quote' || has('budget_specialist')) ?? null, estimatedRemainingMinutes: pendingSteps.filter((step) => step.id !== 'quote' || has('budget_specialist')).length * 1, isOperational: operational };
}
