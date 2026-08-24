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
  portraitPosition?: string;
  identity: {
    accent: string;
    icon: string;
    signature: string;
    personality: string;
    tone: string;
  };
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
    portraitPosition: '50% 22%',
    identity: {
      accent: '#789500',
      icon: '●',
      signature: 'Atención que no se detiene',
      personality: 'Cercana y resolutiva',
      tone: 'Claro, cálido y profesional',
    },
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
    portraitPosition: '50% 24%',
    identity: {
      accent: '#4b67bf',
      icon: '✦',
      signature: 'Cada contacto, bien cuidado',
      personality: 'Metódico y atento',
      tone: 'Sereno, preciso y amable',
    },
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
    portraitPosition: '50% 20%',
    identity: {
      accent: '#a85c1d',
      icon: '↗',
      signature: 'El siguiente paso siempre claro',
      personality: 'Directo y estratégico',
      tone: 'Seguro, consultivo y concreto',
    },
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
    portraitPosition: '50% 22%',
    identity: {
      accent: '#b44c7d',
      icon: '◌',
      signature: 'Conversaciones con contexto',
      personality: 'Ágil y empática',
      tone: 'Natural, atento y cercano',
    },
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
    portraitPosition: '50% 22%',
    identity: {
      accent: '#397d73',
      icon: '▦',
      signature: 'Presupuestos con criterio',
      personality: 'Analítica y rigurosa',
      tone: 'Ordenado, claro y orientado a detalle',
    },
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
  {
    slug: 'arquitecto-tecnico-ia',
    planKey: 'employee_technical_architect',
    name: 'Arquitecto Técnico IA',
    person: 'Nora',
    specialty: 'Planos y memoria técnica preliminar',
    personalIntro: 'Convierto la información visible de tus planos en un punto de partida técnico que puedes revisar.',
    age: 34,
    languages: ['Español'],
    yearsExperience: 9,
    sectors: ['Construcción', 'Reformas', 'Instalaciones'],
    objectives: ['vender', 'organizar'],
    businesses: ['construccion', 'servicios'],
    department: 'Técnico',
    role: 'Analiza planos e imágenes y prepara mediciones preliminares',
    price: '197 €/mes',
    portrait: '/images/empleado24-team-studio.jpg',
    portraitPosition: '50% 30%',
    identity: { accent: '#7555b8', icon: '⌗', signature: 'Del plano a una base técnica revisable', personality: 'Rigurosa y transparente', tone: 'Preciso, prudente y claro' },
    summary: 'Lee la información visible de planos PDF e imágenes, genera una memoria técnica preliminar y propone mediciones sin inventar precios ni datos.',
    benefits: ['Archivos privados por empresa', 'Evidencias y límites explícitos', 'Borrador conectado a Presupuestos IA'],
    does: ['Analiza PDF e imágenes compatibles', 'Identifica texto, espacios, cotas y materiales visibles', 'Prepara una memoria técnica y partidas preliminares para revisar'],
    doesNot: ['No certifica medidas ni sustituye a un técnico competente', 'No procesa todavía DWG, IFC/BIM ni genera renders', 'No asigna precios sin el catálogo de tu empresa'],
    integrations: ['Supabase Storage privado', 'Empleado24 Brain', 'Especialista Presupuestos IA', 'Closer IA'],
    examples: ['“Analiza este plano PDF y prepara una memoria preliminar.”', '“Extrae las partidas visibles para revisarlas antes de presupuestar.”'],
    faq: [
      { question: '¿Los archivos son públicos?', answer: 'No. Se guardan en un espacio privado y separado por empresa.' },
      { question: '¿El resultado es un documento firmado?', answer: 'No. Es una base técnica preliminar con evidencias y limitaciones para revisión profesional.' },
    ],
  },
];

export const employeeBySlug = Object.fromEntries(
  employeeShowcase.map((employee) => [employee.slug, employee]),
);

export function hiringHref(employee: Pick<EmployeeShowcase, 'planKey' | 'slug'>) {
  return `/register?employee=${encodeURIComponent(employee.planKey)}&from=${encodeURIComponent(employee.slug)}`;
}
