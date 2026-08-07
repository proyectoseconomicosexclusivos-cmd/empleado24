import { redirect } from 'next/navigation';
import { CompanyOnboardingForm } from '@/components/company-onboarding-form';
import { SetupWizard } from '@/components/setup-wizard';
import { createClient } from '@/lib/supabase/server';
import { ensureCentralRetellIntegration } from '@/lib/retell-runtime';
import { getInstallationStatus } from '@/lib/installation-engine';

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string; configured?: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/register');

  const { data: membership } = await supabase.from('members').select('companies(*)').eq('user_id', auth.user.id).limit(1).maybeSingle();
  const relation = membership?.companies;
  const company = Array.isArray(relation) ? relation[0] : relation;
  if (!company) redirect('/register');

  const { data: employees } = await supabase.from('employees').select('*').eq('company_id', company.id).eq('employee_type', 'receptionist').limit(1);
  const employee = employees?.[0];
  if (!employee) redirect('/app');
  await ensureCentralRetellIntegration(supabase, company.id);
  const { data: config } = await supabase.from('employee_configs').select('*').eq('employee_id', employee.id).maybeSingle();
  const query = await searchParams;

  const installation = await getInstallationStatus(company.id);
  return <SetupWizard companyName={company.name} employeeName={employee.name} installation={installation} configured={query.configured}>
    <CompanyOnboardingForm error={query.error} values={{ companyId: company.id, companyName: company.name, sector: company.sector, country: company.country, currency: company.currency, locale: company.locale, timezone: company.timezone, businessHours: company.business_hours, receptionistName: employee.name, secondaryLocales: employee.secondary_locales, description: employee.description, greeting: config?.greeting ?? null, farewell: config?.farewell ?? null, unknownAnswerPolicy: config?.unknown_answer_policy ?? null, handoffPolicy: config?.human_handoff_policy ?? null }} />
  </SetupWizard>;
}
