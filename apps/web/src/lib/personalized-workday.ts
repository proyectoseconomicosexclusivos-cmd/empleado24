export type BusinessSector =
  | 'Construcción'
  | 'Inmobiliaria'
  | 'Clínica'
  | 'Restaurante'
  | 'Taller'
  | 'Tienda'
  | 'Agencia'
  | 'Otro';

export type WorkdayPlan = {
  sector: BusinessSector;
  companyLabel: string;
  customerNeed: string;
  appointment: string;
  budget: string;
  recommended: string[];
  employeePlan: string;
  metrics: { calls: number; messages: number; appointments: number; budgets: number; recovered: number; hours: number };
};

const plans: Record<BusinessSector, Omit<WorkdayPlan, 'sector'>> = {
  Construcción: { companyLabel: 'Tu constructora', customerNeed: 'Necesito presupuesto para una reforma esta semana.', appointment: 'Visita de obra preparada para mañana.', budget: 'Marta prepara un borrador con los criterios de tu empresa.', recommended: ['Laura', 'Marta', 'Carlos'], employeePlan: 'employee_budget', metrics: { calls: 14, messages: 21, appointments: 4, budgets: 3, recovered: 5, hours: 7 } },
  Inmobiliaria: { companyLabel: 'Tu inmobiliaria', customerNeed: 'Quiero visitar una vivienda esta semana.', appointment: 'Visita a la vivienda coordinada con el cliente.', budget: 'Carlos registra el interés y prepara el seguimiento.', recommended: ['Laura', 'Carlos'], employeePlan: 'employee_closer', metrics: { calls: 18, messages: 26, appointments: 6, budgets: 0, recovered: 7, hours: 8 } },
  Clínica: { companyLabel: 'Tu clínica', customerNeed: 'Quiero pedir cita para esta semana.', appointment: 'Cita reservada sin solaparse en la agenda.', budget: 'Laura confirma la cita y deja las indicaciones necesarias.', recommended: ['Laura'], employeePlan: 'one_employee', metrics: { calls: 22, messages: 18, appointments: 9, budgets: 0, recovered: 8, hours: 9 } },
  Restaurante: { companyLabel: 'Tu restaurante', customerNeed: 'Quiero reservar una mesa para esta noche.', appointment: 'Reserva confirmada con número de comensales.', budget: 'Elena responde el mensaje y deja el contexto listo.', recommended: ['Laura', 'Elena'], employeePlan: 'employee_whatsapp', metrics: { calls: 16, messages: 35, appointments: 11, budgets: 0, recovered: 10, hours: 8 } },
  Taller: { companyLabel: 'Tu taller', customerNeed: 'Necesito una cita para revisar mi coche.', appointment: 'Hueco de taller reservado y necesidad anotada.', budget: 'Marta deja preparado un presupuesto orientativo para revisión.', recommended: ['Laura', 'Marta'], employeePlan: 'employee_budget', metrics: { calls: 17, messages: 23, appointments: 7, budgets: 4, recovered: 6, hours: 8 } },
  Tienda: { companyLabel: 'Tu tienda', customerNeed: '¿Tenéis este producto disponible?', appointment: 'El cliente recibe una respuesta y el siguiente paso.', budget: 'David prepara el seguimiento de la consulta.', recommended: ['Elena', 'David'], employeePlan: 'employee_whatsapp', metrics: { calls: 9, messages: 42, appointments: 0, budgets: 0, recovered: 12, hours: 6 } },
  Agencia: { companyLabel: 'Tu agencia', customerNeed: 'Quiero saber cómo podéis ayudar a mi negocio.', appointment: 'Reunión de descubrimiento preparada.', budget: 'Carlos y Marta ordenan la oportunidad y el presupuesto.', recommended: ['Laura', 'Carlos', 'Marta'], employeePlan: 'employee_closer', metrics: { calls: 12, messages: 19, appointments: 5, budgets: 3, recovered: 5, hours: 7 } },
  Otro: { companyLabel: 'Tu empresa', customerNeed: 'Quiero saber cómo podéis ayudarme.', appointment: 'Siguiente conversación preparada para tu equipo.', budget: 'El equipo deja una propuesta clara para revisar.', recommended: ['Laura', 'Carlos'], employeePlan: 'one_employee', metrics: { calls: 12, messages: 18, appointments: 3, budgets: 1, recovered: 4, hours: 6 } },
};

export const businessSectors = Object.keys(plans) as BusinessSector[];

export function workdayFor(sector: string | null | undefined): WorkdayPlan {
  const key = businessSectors.includes(sector as BusinessSector) ? (sector as BusinessSector) : 'Otro';
  return { sector: key, ...plans[key] };
}
