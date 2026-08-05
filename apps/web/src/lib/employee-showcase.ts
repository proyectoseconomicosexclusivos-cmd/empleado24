export type EmployeeShowcase = {
  slug: string;
  planKey: string;
  name: string;
  role: string;
  person: string;
  specialty: string;
  personalIntro: string;
  age: number;
  languages: string[];
  yearsExperience: number;
  sectors: string[];
  objectives: string[];
  businesses: string[];
  department: string;
  price: string;
  portrait: string;
  summary: string;
  benefits: string[];
  does: string[];
  doesNot: string[];
  integrations: string[];
  examples: string[];
  faq: Array<{ question: string; answer: string }>;
};

export const employeeShowcase: EmployeeShowcase[] = [
  {
    slug: 'recepcionista-ia',
    planKey: 'one_employee',
    name: 'Recepcionista IA',
    person: 'Laura',
    specialty: 'Atención al cliente',
    personalIntro: 'Contesto llamadas con el estilo que definas para tu empresa.',
    age: 32,
    languages: ['Español', 'Inglés'],
    yearsExperience: 8,
    sectors: ['Clínicas', 'Servicios profesionales', 'Inmobiliarias'],
    objectives: ['atender', 'organizar'],
    businesses: ['servicios', 'salud', 'inmobiliaria'],
    department: 'Atención',
    role: 'Atiende llamadas y organiza citas',
    price: '97 €/mes',
    portrait: '/employees/laura.jpg',
    summary:
      'Recibe llamadas, resuelve las dudas habituales y deja a tu equipo las conversaciones que necesitan una persona.',
    benefits: ['Atiende cada llamada', 'Habla como tu empresa', 'Organiza citas'],
    does: [
      'Contesta llamadas con el tono de tu empresa',
      'Recoge datos y necesidades',
      'Organiza una cita cuando procede',
    ],
    doesNot: [
      'No inventa respuestas cuando no tiene información',
      'No sustituye decisiones delicadas de tu equipo',
    ],
    integrations: ['Tu teléfono', 'Google Calendar', 'Empleado24 Brain'],
    examples: ['“Quiero pedir una cita para esta semana.”', '“¿Cuál es vuestro horario?”'],
    faq: [
      {
        question: '¿Necesito cambiar mi número?',
        answer: 'No. Puedes usar un número nuevo o mantener el tuyo con un desvío de llamadas.',
      },
      {
        question: '¿Cuándo puede empezar?',
        answer: 'Después de su bienvenida guiada y una llamada de prueba.',
      },
    ],
  },
  {
    slug: 'especialista-email-ia',
    planKey: 'employee_email',
    name: 'Especialista Email IA',
    person: 'David',
    specialty: 'Comunicación y seguimiento',
    personalIntro: 'Cuido cada contacto para que ninguna conversación se enfríe.',
    age: 31,
    languages: ['Español', 'Inglés'],
    yearsExperience: 6,
    sectors: ['Comercio', 'Formación', 'Servicios profesionales'],
    objectives: ['vender', 'organizar'],
    businesses: ['comercio', 'servicios', 'formacion'],
    department: 'Marketing',
    role: 'Cuida el contacto con tus clientes',
    price: '97 €/mes',
    portrait: '/employees/david.jpg',
    summary:
      'Prepara comunicaciones, organiza contactos y mantiene una conversación constante desde la cuenta de tu empresa.',
    benefits: ['Mensajes organizados', 'Contactos por empresa', 'Seguimiento claro'],
    does: [
      'Prepara emails alineados con tu negocio',
      'Organiza contactos y campañas',
      'Guarda la actividad en el historial del cliente',
    ],
    doesNot: [
      'No envía comunicaciones fuera de la cuenta configurada',
      'No comparte contactos entre empresas',
    ],
    integrations: ['Brevo', 'Empleado24 Brain', 'Google Calendar'],
    examples: [
      '“Envía el presupuesto que hablamos.”',
      '“Haz seguimiento a quienes no respondieron.”',
    ],
    faq: [
      {
        question: '¿Usa mi cuenta de email?',
        answer: 'Sí, trabaja desde la cuenta de envío configurada para tu empresa.',
      },
      {
        question: '¿Ve los datos de otras empresas?',
        answer: 'No. Cada empresa mantiene sus contactos y actividad separados.',
      },
    ],
  },
  {
    slug: 'closer-ia',
    planKey: 'employee_closer',
    name: 'Closer IA',
    person: 'Carlos',
    specialty: 'Dirección comercial',
    personalIntro:
      'Doy seguimiento a cada oportunidad para que el equipo sepa cuál es el siguiente paso.',
    age: 38,
    languages: ['Español', 'Inglés'],
    yearsExperience: 12,
    sectors: ['Ventas B2B', 'Reformas', 'Inmobiliarias'],
    objectives: ['vender'],
    businesses: ['servicios', 'construccion', 'inmobiliaria'],
    department: 'Comercial',
    role: 'Convierte interés en oportunidades',
    price: '197 €/mes',
    portrait: '/employees/carlos.jpg',
    summary:
      'Da seguimiento a cada oportunidad, prioriza las más valiosas y ayuda a que ninguna conversación comercial se enfríe.',
    benefits: ['Seguimiento constante', 'Prioriza oportunidades', 'Centro de Ventas'],
    does: [
      'Ordena oportunidades comerciales',
      'Crea seguimientos claros',
      'Coordina próximas acciones con tu equipo',
    ],
    doesNot: [
      'No promete precios que no hayas autorizado',
      'No cierra decisiones que requieran tu aprobación',
    ],
    integrations: ['Empleado24 Brain', 'Google Calendar', 'Recepcionista IA'],
    examples: ['“Pide presupuesto para una reforma.”', '“Llama mañana para resolver las dudas.”'],
    faq: [
      {
        question: '¿Sabe qué habló el cliente antes?',
        answer:
          'Sí, consulta el historial compartido de tu empresa antes de continuar una conversación.',
      },
      {
        question: '¿Puedo revisar las oportunidades?',
        answer: 'Sí, todas se organizan en tu Centro de Ventas.',
      },
    ],
  },
  {
    slug: 'whatsapp-ia',
    planKey: 'employee_whatsapp',
    name: 'WhatsApp IA',
    person: 'Elena',
    specialty: 'Atención por WhatsApp',
    personalIntro: 'Respondo clientes con el contexto de tu empresa, cada día.',
    age: 29,
    languages: ['Español', 'Inglés'],
    yearsExperience: 7,
    sectors: ['Comercio', 'Hostelería', 'Servicios locales'],
    objectives: ['atender', 'vender'],
    businesses: ['comercio', 'hosteleria', 'servicios'],
    department: 'Atención',
    role: 'Atiende mensajes y detecta oportunidades',
    price: '97 €/mes',
    portrait: '/employees/elena.jpg',
    summary:
      'Responde por WhatsApp, entiende cuándo hay interés comercial y pasa cada oportunidad al miembro adecuado del equipo.',
    benefits: ['Responde todos los días', 'Detecta interés', 'Pasa oportunidades'],
    does: [
      'Atiende mensajes habituales',
      'Detecta solicitudes de presupuesto o cita',
      'Guarda la conversación en el historial del cliente',
    ],
    doesNot: [
      'No responde fuera de tus reglas de negocio',
      'No pierde el contexto de un cliente existente',
    ],
    integrations: ['WhatsApp Business', 'Empleado24 Brain', 'Google Calendar'],
    examples: ['“Hola, necesito presupuesto.”', '“¿Podéis llamarme mañana?”'],
    faq: [
      {
        question: '¿Puedo mantener mi WhatsApp Business?',
        answer: 'Sí, se conecta a la cuenta de WhatsApp Business de tu empresa.',
      },
      {
        question: '¿Qué ocurre con un cliente interesado?',
        answer: 'El interés queda registrado y puede pasar al Closer IA o a tu equipo.',
      },
    ],
  },
  {
    slug: 'especialista-presupuestos-ia',
    planKey: 'employee_budget',
    name: 'Especialista Presupuestos IA',
    person: 'Marta',
    specialty: 'Presupuestos y márgenes',
    personalIntro:
      'Convierto solicitudes en presupuestos claros, alineados con tus reglas de negocio.',
    age: 35,
    languages: ['Español'],
    yearsExperience: 10,
    sectors: ['Construcción', 'Reformas', 'Instalaciones'],
    objectives: ['vender', 'organizar'],
    businesses: ['construccion', 'servicios'],
    department: 'Comercial',
    role: 'Prepara presupuestos claros y rentables',
    price: '197 €/mes',
    portrait: '/employees/marta.jpg',
    summary:
      'Organiza costes, márgenes y seguimientos para que prepares presupuestos consistentes sin empezar de cero.',
    benefits: ['Márgenes controlados', 'Historial por cliente', 'Seguimiento preparado'],
    does: [
      'Prepara presupuestos con tus datos',
      'Relaciona cada presupuesto con su cliente',
      'Avisa para continuar el seguimiento',
    ],
    doesNot: [
      'No fija precios sin tu catálogo o indicaciones',
      'No envía un presupuesto sin que lo revises cuando sea necesario',
    ],
    integrations: ['Empleado24 Brain', 'Especialista Email IA', 'Closer IA'],
    examples: [
      '“Prepara el presupuesto de la reforma del salón.”',
      '“Recuérdame llamar a este cliente en dos días.”',
    ],
    faq: [
      {
        question: '¿Puedo usar mis propios precios?',
        answer: 'Sí, parte de los costes y márgenes que indiques para tu empresa.',
      },
      {
        question: '¿Dónde se guarda el historial?',
        answer: 'Queda asociado al cliente dentro de tu empresa.',
      },
    ],
  },
];

export const employeeBySlug = Object.fromEntries(
  employeeShowcase.map((employee) => [employee.slug, employee]),
);

export function hiringHref(employee: Pick<EmployeeShowcase, 'planKey' | 'slug'>) {
  return `/register?employee=${encodeURIComponent(employee.planKey)}&from=${encodeURIComponent(employee.slug)}`;
}
