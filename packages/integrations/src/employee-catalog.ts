export type EmployeeProductKey =
  | 'receptionist'
  | 'closer'
  | 'secretary'
  | 'sales_premium'
  | 'sales_director';

export interface EmployeeProduct {
  key: EmployeeProductKey;
  name: string;
  description: string;
  monthlyPriceCents: number;
  includedMinutes: number | null;
  capabilities: readonly string[];
  active: boolean;
}

/** Product catalogue: each future employee is a product, not a new core module. */
export const employeeProducts: readonly EmployeeProduct[] = [
  { key: 'receptionist', name: 'Recepcionista', description: 'Atiende llamadas y organiza las primeras conversaciones.', monthlyPriceCents: 9700, includedMinutes: null, capabilities: ['llamadas', 'citas', 'preguntas frecuentes'], active: true },
  { key: 'closer', name: 'Closer IA', description: 'Hace seguimiento de oportunidades y ayuda a convertirlas en clientes.', monthlyPriceCents: 19700, includedMinutes: null, capabilities: ['seguimiento', 'llamadas', 'email', 'agenda', 'calificación'], active: true },
  { key: 'secretary', name: 'Secretaria', description: 'Ordena tareas, avisos y coordinación diaria.', monthlyPriceCents: 19700, includedMinutes: null, capabilities: ['agenda', 'recordatorios', 'coordinación'], active: false },
  { key: 'sales_premium', name: 'Ventas Premium', description: 'Acompaña conversaciones comerciales de alto valor.', monthlyPriceCents: 29700, includedMinutes: null, capabilities: ['ventas', 'seguimiento', 'resumen'], active: false },
  { key: 'sales_director', name: 'Director Comercial', description: 'Coordina el rendimiento comercial del equipo.', monthlyPriceCents: 49700, includedMinutes: null, capabilities: ['supervisión', 'ventas', 'previsión'], active: false },
];

export function employeeProductForPlan(planKey: string | null | undefined) {
  if (planKey === 'one_employee') return employeeProducts[0];
  if (planKey === 'employee_closer') return employeeProducts[1];
  return null;
}
