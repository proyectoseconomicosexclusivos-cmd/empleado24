export const departments = {
  commercial: {
    key: 'commercial',
    planKey: 'department_commercial',
    name: 'Departamento Comercial IA',
    description: 'Un equipo que atiende, conversa, hace seguimiento, reserva y prepara presupuestos.',
    employeeTypes: ['receptionist', 'whatsapp', 'closer', 'booking', 'budget_specialist'],
    members: ['Recepcionista IA', 'WhatsApp IA', 'Closer IA', 'Booking IA', 'Especialista Presupuestos IA'],
    flow: 'Conversación → oportunidad → seguimiento → cita → presupuesto → venta',
    hours: '12 h/semana',
  },
  technical: {
    key: 'technical',
    planKey: 'department_technical',
    name: 'Departamento Técnico IA',
    description: 'Analiza planos PDF e imágenes, prepara una memoria técnica y deja mediciones preliminares para revisar.',
    employeeTypes: ['technical_architect', 'budget_specialist'],
    members: ['Arquitecto Técnico IA', 'Especialista Presupuestos IA'],
    flow: 'Archivo → análisis verificable → memoria técnica → borrador de presupuesto → Closer',
    hours: '8 h/semana',
  },
  marketing: { key: 'marketing', name: 'Departamento Marketing IA', description: 'Email, contenido, posicionamiento y campañas conectados.', employeeTypes: ['email_specialist', 'social_media', 'youtube', 'seo', 'ads'], members: ['Especialista Email IA', 'Social Media IA', 'YouTube IA', 'SEO IA', 'Ads IA'], comingSoon: true },
  company: { key: 'company', name: 'Departamento Empresa IA', description: 'Clientes, operaciones y administración unidos.', employeeTypes: ['crm', 'finance', 'hr', 'customer_success', 'ceo_advisor'], members: ['CRM IA', 'Finanzas IA', 'RRHH IA', 'Atención Cliente IA', 'CEO Advisor IA'], comingSoon: true },
} as const;

export type DepartmentKey = keyof typeof departments;

export function departmentForPlan(planKey: string | null | undefined) {
  return Object.values(departments).find((department) => 'planKey' in department && department.planKey === planKey) ?? null;
}
