import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { guardRateLimit } from '@/lib/api-guard';
import { createAndAnalyzeTechnicalProject } from '@/lib/technical-project-engine';

export async function POST(request: Request) {
  const supabase = await createClient() as any;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: member } = await supabase.from('members').select('company_id,role').eq('user_id', auth.user.id).in('role', ['owner', 'admin']).limit(1).maybeSingle();
  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const limited = await guardRateLimit(request, { action: 'technical_project.analyze', maxRequests: 8, windowSeconds: 3600, dimensions: [{ kind: 'user', value: auth.user.id }, { kind: 'company', value: member.company_id }] });
  if (limited) return limited;
  const form = await request.formData();
  const file = form.get('file');
  const title = typeof form.get('title') === 'string' ? String(form.get('title')).trim() : '';
  const customerName = typeof form.get('customer_name') === 'string' ? String(form.get('customer_name')).trim() : '';
  if (!(file instanceof File) || !title || !customerName) return NextResponse.json({ error: 'invalid_input', message: 'Indica el proyecto, el cliente y un archivo compatible.' }, { status: 400 });
  const { data: employee } = await supabase.from('employees').select('id').eq('company_id', member.company_id).eq('employee_type', 'technical_architect').eq('status', 'active').maybeSingle();
  if (!employee) return NextResponse.json({ error: 'technical_architect_not_active', message: 'Primero incorpora el Arquitecto Técnico IA a tu equipo.' }, { status: 409 });
  try {
    const result = await createAndAnalyzeTechnicalProject({ companyId: member.company_id, userId: auth.user.id, employeeId: employee.id, title, customer: { name: customerName, email: typeof form.get('customer_email') === 'string' ? String(form.get('customer_email')) : null, phone: typeof form.get('customer_phone') === 'string' ? String(form.get('customer_phone')) : null }, file });
    return NextResponse.json({ projectId: result.projectId, quoteId: result.quoteId });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'technical_analysis_failed';
    const message = code === 'gemini_not_configured' ? 'El análisis técnico aún no está configurado. Contacta con tu administrador.' : code === 'technical_file_invalid' || code === 'technical_file_type_not_supported' ? 'El archivo debe ser PDF, JPG, PNG o WebP y no superar 20 MB.' : 'No se ha podido completar el análisis. El proyecto se ha marcado para revisión.';
    return NextResponse.json({ error: code, message }, { status: code === 'gemini_not_configured' ? 503 : 422 });
  }
}
