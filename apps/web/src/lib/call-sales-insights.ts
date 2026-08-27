import 'server-only';

export type CallSalesInsight = {
  intent: 'NO_DETERMINADO' | 'CURIOSIDAD' | 'QUIERE_PRECIO' | 'QUIERE_PRUEBA' | 'INTERESADO' | 'NO_INTERESADO';
  result: 'LLAMADA_ABANDONADA' | 'CONVERSACION_COMPLETADA' | 'ERROR_TECNICO';
  opportunityLost: string;
  recommendation: string;
  userResponded: boolean;
  firstAgentMessage: string | null;
};

type CallInput = {
  status?: string | null;
  durationMs?: number | null;
  transcript?: string | null;
  summary?: string | null;
  analysis?: Record<string, unknown> | null;
};

function firstAgentMessage(transcript: string | null | undefined) {
  if (!transcript) return null;
  const line = transcript.split(/\r?\n/).find((item) => /^agent\s*:/i.test(item));
  return line ? line.replace(/^agent\s*:\s*/i, '').trim().slice(0, 280) || null : null;
}

export function inspectCallForSales(call: CallInput): CallSalesInsight {
  const transcript = (call.transcript ?? '').trim();
  const userLines = transcript.match(/^(user|caller|cliente)\s*:/gim) ?? [];
  const userResponded = userLines.length > 0;
  const custom = call.analysis && typeof call.analysis.custom_analysis_data === 'object' && call.analysis.custom_analysis_data && !Array.isArray(call.analysis.custom_analysis_data)
    ? call.analysis.custom_analysis_data as Record<string, unknown>
    : {};
  const classifiedIntent = typeof custom.commercial_intent === 'string' ? custom.commercial_intent.toLocaleLowerCase('es-ES') : '';
  const text = `${transcript}\n${call.summary ?? ''}`.toLocaleLowerCase('es-ES');
  const short = (call.durationMs ?? 0) < 30_000;

  if (call.status === 'error') return {
    intent: 'NO_DETERMINADO', result: 'ERROR_TECNICO', userResponded,
    firstAgentMessage: firstAgentMessage(transcript),
    opportunityLost: 'La llamada no llegó a completarse por un error técnico.',
    recommendation: 'Revisar el error concreto antes de volver a contactar.',
  };
  if (!userResponded && short) return {
    intent: 'NO_DETERMINADO', result: 'LLAMADA_ABANDONADA', userResponded: false,
    firstAgentMessage: firstAgentMessage(transcript),
    opportunityLost: 'La persona colgó antes de responder; no hay evidencia de interés ni de que entendiera la propuesta.',
    recommendation: 'Abrir con una frase breve de valor y una sola pregunta: “Soy Laura, de Empleado24. ¿A qué se dedica tu empresa?”',
  };
  if (classifiedIntent === 'no_interesado') return {
    intent: 'NO_INTERESADO', result: 'CONVERSACION_COMPLETADA', userResponded,
    firstAgentMessage: firstAgentMessage(transcript),
    opportunityLost: 'La persona indicó que no desea continuar.',
    recommendation: 'No iniciar seguimiento comercial salvo que otorgue un consentimiento nuevo.',
  };
  if (classifiedIntent === 'listo_para_probar') return {
    intent: 'QUIERE_PRUEBA', result: 'CONVERSACION_COMPLETADA', userResponded,
    firstAgentMessage: firstAgentMessage(transcript),
    opportunityLost: 'La persona está lista para probar y necesita un siguiente paso inmediato.',
    recommendation: 'Ofrecer registro o checkout sólo después de confirmar los datos y el consentimiento.',
  };
  if (/precio|cu[aá]nto cuesta|coste|tarifa/.test(text)) return {
    intent: 'QUIERE_PRECIO', result: 'CONVERSACION_COMPLETADA', userResponded,
    firstAgentMessage: firstAgentMessage(transcript),
    opportunityLost: 'La llamada contiene una pregunta de precio y requiere una propuesta clara.',
    recommendation: 'Presentar el empleado recomendado, el precio y una prueba antes de pedir el siguiente paso.',
  };
  if (/prueba|demo|probar/.test(text)) return {
    intent: 'QUIERE_PRUEBA', result: 'CONVERSACION_COMPLETADA', userResponded,
    firstAgentMessage: firstAgentMessage(transcript),
    opportunityLost: 'La persona pidió comprobar el producto; la siguiente acción es una demo o prueba.',
    recommendation: 'Ofrecer la prueba correspondiente y capturar los datos sólo con consentimiento.',
  };
  if (/interesa|quiero|necesito|ll[aá]mame|presupuesto/.test(text)) return {
    intent: 'INTERESADO', result: 'CONVERSACION_COMPLETADA', userResponded,
    firstAgentMessage: firstAgentMessage(transcript),
    opportunityLost: 'Hay una señal de interés que debe convertirse en un siguiente paso concreto.',
    recommendation: 'Confirmar sector, problema y el siguiente paso antes de cerrar.',
  };
  return {
    intent: userResponded ? 'CURIOSIDAD' : 'NO_DETERMINADO',
    result: call.status === 'ended' ? 'CONVERSACION_COMPLETADA' : 'LLAMADA_ABANDONADA', userResponded,
    firstAgentMessage: firstAgentMessage(transcript),
    opportunityLost: userResponded ? 'No hay una señal comercial concluyente en la conversación.' : 'No hay respuesta suficiente para clasificar la oportunidad.',
    recommendation: 'Mantener una apertura corta, escuchar primero y cerrar con un único siguiente paso.',
  };
}
