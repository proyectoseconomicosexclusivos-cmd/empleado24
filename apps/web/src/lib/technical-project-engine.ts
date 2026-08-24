import 'server-only';

import { calculateQuote, type QuoteLineInput } from '@/lib/quote-engine';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCustomer, publishEvent, saveMemory } from '@/lib/empleado24-brain';
import { recordBusinessEvent } from '@/lib/business-events';

type TechnicalMeasure = { label: string; value: number | null; unit: string; evidence: string; confidence: number };
type TechnicalLine = { chapter: string; concept: string; unit: string; quantity: number; evidence: string };
export type TechnicalAnalysis = {
  summary: string;
  technicalMemory: string;
  visibleText: string[];
  spaces: Array<{ name: string; evidence: string; confidence: number }>;
  measurements: TechnicalMeasure[];
  visibleMaterials: Array<{ name: string; evidence: string; confidence: number }>;
  suggestedQuoteLines: TechnicalLine[];
  limitations: string[];
  confidence: number;
};

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function boundedText(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : minimum;
}

function array(value: unknown) { return Array.isArray(value) ? value : []; }

function cleanAnalysis(value: unknown): TechnicalAnalysis {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    summary: boundedText(input.summary, 1600) || 'No se ha podido generar un resumen fiable del archivo.',
    technicalMemory: boundedText(input.technicalMemory, 5000) || 'Resultado preliminar pendiente de revisión por un técnico competente.',
    visibleText: array(input.visibleText).map((item) => boundedText(item, 300)).filter(Boolean).slice(0, 60),
    spaces: array(input.spaces).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { name: boundedText(row.name, 160), evidence: boundedText(row.evidence, 500), confidence: boundedNumber(row.confidence, 0, 1) };
    }).filter((item) => item.name && item.evidence).slice(0, 80),
    measurements: array(input.measurements).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const numeric = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : null;
      return { label: boundedText(row.label, 160), value: numeric, unit: boundedText(row.unit, 24), evidence: boundedText(row.evidence, 500), confidence: boundedNumber(row.confidence, 0, 1) };
    }).filter((item) => item.label && item.unit && item.evidence).slice(0, 120),
    visibleMaterials: array(input.visibleMaterials).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { name: boundedText(row.name, 160), evidence: boundedText(row.evidence, 500), confidence: boundedNumber(row.confidence, 0, 1) };
    }).filter((item) => item.name && item.evidence).slice(0, 80),
    suggestedQuoteLines: array(input.suggestedQuoteLines).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { chapter: boundedText(row.chapter, 120) || 'Mediciones preliminares', concept: boundedText(row.concept, 180), unit: boundedText(row.unit, 30) || 'unidad', quantity: boundedNumber(row.quantity, 0.001, 1000000), evidence: boundedText(row.evidence, 500) };
    }).filter((item) => item.concept && item.evidence).slice(0, 80),
    limitations: array(input.limitations).map((item) => boundedText(item, 400)).filter(Boolean).slice(0, 30),
    confidence: boundedNumber(input.confidence, 0, 1),
  };
}

function jsonFromModel(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return cleanAnalysis(JSON.parse(trimmed));
}

export async function analyzeTechnicalFile(input: { bytes: ArrayBuffer; mimeType: string; originalName: string }) {
  if (!allowedTypes.has(input.mimeType)) throw new Error('technical_file_type_not_supported');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('gemini_not_configured');
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const file = Buffer.from(input.bytes).toString('base64');
  const prompt = `Eres Arquitecto Técnico IA de apoyo. Analiza este plano PDF o imagen sin inventar información. Devuelve SOLO JSON válido con: summary, technicalMemory, visibleText, spaces, measurements, visibleMaterials, suggestedQuoteLines, limitations, confidence. Cada espacio, medida, material y partida debe incluir evidence con el texto, cota o elemento visual que lo sustenta. Solo extrae medidas que aparezcan explícitamente o que puedan justificarse con una escala visible; si no, indícalo como limitación. No certificas medidas, no sustituyes a un arquitecto/arquitecto técnico y no preparas documentos para firma. Las partidas son mediciones preliminares sin precios. Archivo: ${input.originalName}.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: input.mimeType, data: file } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok) throw new Error(`gemini_http_${response.status}`);
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: unknown }) => typeof part.text === 'string' ? part.text : '').join('') ?? '';
  if (!text) throw new Error('gemini_empty_response');
  return { model, result: jsonFromModel(text) };
}

export async function createTechnicalQuoteDraft(input: { companyId: string; customerId: string; architectEmployeeId: string; projectId: string; versionId: string; title: string; analysis: TechnicalAnalysis; userId: string }) {
  const admin = createAdminClient() as any;
  const { data: budgetEmployee } = await admin.from('employees').select('id').eq('company_id', input.companyId).eq('employee_type', 'budget_specialist').eq('status', 'active').maybeSingle();
  if (!budgetEmployee) return null;
  const lines: QuoteLineInput[] = input.analysis.suggestedQuoteLines.map((line) => ({ chapter: line.chapter, concept: line.concept, unit: line.unit, quantity: line.quantity, unitCostCents: 0 }));
  if (!lines.length) return null;
  const totals = calculateQuote({ lines, marginBps: 3500, taxBps: 2100 });
  const { data: quote, error } = await admin.from('quotes').insert({
    company_id: input.companyId, customer_id: input.customerId, employee_id: budgetEmployee.id,
    title: `Borrador técnico · ${input.title}`, brief: input.analysis.summary, currency: 'EUR', current_version: 1,
    cost_cents: totals.costCents, subtotal_cents: totals.subtotalCents, tax_cents: totals.taxCents, total_cents: totals.totalCents,
    profit_cents: totals.profitCents, margin_bps: totals.actualMarginBps, created_by: input.userId,
  }).select('id').single();
  if (error || !quote) throw error ?? new Error('technical_quote_create_failed');
  const snapshot = { source: 'technical_project', project_id: input.projectId, project_version_id: input.versionId, analysis: input.analysis, lines, totals, price_notice: 'Las partidas no incluyen costes ni precios hasta que la empresa los revise.' };
  const { data: version, error: versionError } = await admin.from('quote_versions').insert({ quote_id: quote.id, company_id: input.companyId, version: 1, source: 'assistant', snapshot, created_by: input.userId }).select('id').single();
  if (versionError || !version) throw versionError ?? new Error('technical_quote_version_failed');
  const { error: linesError } = await admin.from('quote_lines').insert(lines.map((line, sortOrder) => ({ quote_version_id: version.id, company_id: input.companyId, chapter: line.chapter, concept: line.concept, unit: line.unit, quantity: line.quantity, unit_cost_cents: line.unitCostCents, planned_days: 0, sort_order: sortOrder, metadata: { source: 'technical_project', project_id: input.projectId } })));
  if (linesError) throw linesError;
  await publishEvent({ companyId: input.companyId, customerId: input.customerId, employeeId: budgetEmployee.id, name: 'TechnicalQuoteDrafted', source: 'technical_project', idempotencyKey: `technical:quote:${quote.id}`, payload: { quote_id: quote.id, project_id: input.projectId, pending_prices: true } });
  return quote.id as string;
}

export async function createAndAnalyzeTechnicalProject(input: { companyId: string; userId: string; employeeId: string; title: string; customer: { name: string; email?: string | null; phone?: string | null }; file: File }) {
  if (!allowedTypes.has(input.file.type) || input.file.size > 20 * 1024 * 1024 || input.file.size <= 0) throw new Error('technical_file_invalid');
  const admin = createAdminClient() as any;
  const customer = await getCustomer({ companyId: input.companyId, name: input.customer.name, email: input.customer.email, phone: input.customer.phone, source: 'technical_architect' });
  const { data: project, error: projectError } = await admin.from('technical_projects').insert({ company_id: input.companyId, customer_id: customer.id, employee_id: input.employeeId, title: input.title, status: 'processing', created_by: input.userId }).select('id').single();
  if (projectError || !project) throw projectError ?? new Error('technical_project_create_failed');
  const { data: version, error: versionError } = await admin.from('technical_project_versions').insert({ project_id: project.id, company_id: input.companyId, version: 1, created_by: input.userId }).select('id').single();
  if (versionError || !version) throw versionError ?? new Error('technical_project_version_create_failed');
  const bytes = await input.file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
  const extension = input.file.type === 'application/pdf' ? 'pdf' : input.file.type.split('/')[1] || 'bin';
  const storagePath = `${input.companyId}/${project.id}/${version.id}/source.${extension}`;
  const upload = await admin.storage.from('technical-projects').upload(storagePath, bytes, { contentType: input.file.type, upsert: false });
  if (upload.error) throw upload.error;
  const { error: fileError } = await admin.from('technical_project_files').insert({ project_version_id: version.id, company_id: input.companyId, storage_path: storagePath, original_name: input.file.name, mime_type: input.file.type, byte_size: input.file.size, sha256: hash });
  if (fileError) throw fileError;
  const idempotencyKey = `technical:analysis:${version.id}:${hash}`;
  const { data: analysisRow, error: analysisError } = await admin.from('technical_project_analyses').insert({ project_version_id: version.id, company_id: input.companyId, model: process.env.GEMINI_MODEL || 'gemini-3.5-flash', status: 'processing', idempotency_key: idempotencyKey, started_at: new Date().toISOString() }).select('id').single();
  if (analysisError || !analysisRow) throw analysisError ?? new Error('technical_analysis_create_failed');
  try {
    const analyzed = await analyzeTechnicalFile({ bytes, mimeType: input.file.type, originalName: input.file.name });
    const quoteId = await createTechnicalQuoteDraft({ companyId: input.companyId, customerId: customer.id, architectEmployeeId: input.employeeId, projectId: project.id, versionId: version.id, title: input.title, analysis: analyzed.result, userId: input.userId });
    const now = new Date().toISOString();
    await Promise.all([
      admin.from('technical_project_analyses').update({ status: 'completed', model: analyzed.model, result: analyzed.result, confidence: analyzed.result.confidence, completed_at: now, updated_at: now }).eq('id', analysisRow.id),
      admin.from('technical_projects').update({ status: 'ready', updated_at: now }).eq('id', project.id),
      saveMemory({ companyId: input.companyId, customerId: customer.id, employeeId: input.employeeId, type: 'summary', content: `Análisis técnico preliminar preparado: ${input.title}. ${analyzed.result.summary}`, metadata: { project_id: project.id, project_version_id: version.id } }),
      publishEvent({ companyId: input.companyId, customerId: customer.id, employeeId: input.employeeId, name: 'TechnicalProjectAnalyzed', source: 'technical_architect', idempotencyKey, payload: { project_id: project.id, project_version_id: version.id, confidence: analyzed.result.confidence, quote_id: quoteId } }),
      recordBusinessEvent({ eventName: 'technical_project_analyzed', companyId: input.companyId, idempotencyKey, metadata: { project_id: project.id, quote_id: quoteId } }),
    ]);
    return { projectId: project.id as string, quoteId, analysis: analyzed.result };
  } catch (error) {
    const now = new Date().toISOString();
    await Promise.all([
      admin.from('technical_project_analyses').update({ status: 'failed', error_code: error instanceof Error ? error.message.slice(0, 120) : 'technical_analysis_failed', completed_at: now, updated_at: now }).eq('id', analysisRow.id),
      admin.from('technical_projects').update({ status: 'failed', updated_at: now }).eq('id', project.id),
    ]);
    throw error;
  }
}
