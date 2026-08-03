/**
 * Universal, integer-only pricing engine. It intentionally contains no sector
 * prices: each company owns its catalogue and the engine simply composes it.
 * It reuses the two proven calculator models: measured line items grouped in
 * chapters, and direct cost + indirect cost + margin + tax + milestones.
 */
export type QuoteLineInput = {
  chapter: string;
  concept: string;
  unit: string;
  quantity: number;
  unitCostCents: number;
  plannedDays?: number;
};

export type QuoteAdjustment = {
  name: string;
  kind: 'fixed' | 'percent';
  basis: 'cost' | 'sale';
  amount: number;
};

export type QuoteCalculationInput = {
  lines: QuoteLineInput[];
  indirectCosts?: QuoteAdjustment[];
  marginBps: number;
  discountBps?: number;
  taxBps?: number;
};

export type QuoteTotals = {
  directCostCents: number;
  indirectCostCents: number;
  costCents: number;
  saleBeforeDiscountCents: number;
  discountCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  profitCents: number;
  actualMarginBps: number;
  plannedDays: number;
  chapterTotals: Array<{ chapter: string; totalCents: number }>;
};

function cents(value: number) {
  if (!Number.isFinite(value)) throw new Error('quote_amount_invalid');
  return Math.round(value);
}

function rate(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0 || value >= 10000) throw new Error(`${label}_invalid`);
  return value;
}

/** Calculates a sell price from a genuine margin, never a misleading markup. */
export function calculateQuote(input: QuoteCalculationInput): QuoteTotals {
  const marginBps = rate(input.marginBps, 'quote_margin');
  const discountBps = rate(input.discountBps ?? 0, 'quote_discount');
  const taxBps = rate(input.taxBps ?? 0, 'quote_tax');
  if (!input.lines.length) throw new Error('quote_requires_lines');

  const chapterMap = new Map<string, number>();
  let directCostCents = 0;
  let plannedDays = 0;
  for (const line of input.lines) {
    if (!line.chapter.trim() || !line.concept.trim() || !line.unit.trim() || line.quantity <= 0 || line.unitCostCents < 0) throw new Error('quote_line_invalid');
    const total = cents(line.quantity * line.unitCostCents);
    directCostCents += total;
    plannedDays += Math.max(0, Math.round(line.plannedDays ?? 0));
    chapterMap.set(line.chapter, (chapterMap.get(line.chapter) ?? 0) + total);
  }
  const indirectCostCents = (input.indirectCosts ?? []).reduce((total, adjustment) => {
    if (!adjustment.name.trim() || !Number.isFinite(adjustment.amount) || adjustment.amount < 0) throw new Error('quote_adjustment_invalid');
    const base = adjustment.basis === 'cost' ? directCostCents : 0;
    return total + (adjustment.kind === 'percent' ? cents(base * adjustment.amount / 10000) : cents(adjustment.amount));
  }, 0);
  const costCents = directCostCents + indirectCostCents;
  const saleBeforeDiscountCents = cents(costCents * 10000 / (10000 - marginBps));
  const discountCents = cents(saleBeforeDiscountCents * discountBps / 10000);
  const subtotalCents = saleBeforeDiscountCents - discountCents;
  const taxCents = cents(subtotalCents * taxBps / 10000);
  const totalCents = subtotalCents + taxCents;
  const profitCents = subtotalCents - costCents;
  return {
    directCostCents, indirectCostCents, costCents, saleBeforeDiscountCents, discountCents,
    subtotalCents, taxCents, totalCents, profitCents,
    actualMarginBps: subtotalCents > 0 ? Math.round(profitCents * 10000 / subtotalCents) : 0,
    plannedDays,
    chapterTotals: [...chapterMap.entries()].map(([chapter, totalCents]) => ({ chapter, totalCents })),
  };
}

export function parseQuoteBrief(brief: string) {
  const normalized = brief.trim();
  if (normalized.length < 8) throw new Error('quote_brief_too_short');
  const margin = normalized.match(/margen\s*(?:del)?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i);
  const discount = normalized.match(/descuento\s*(?:del)?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i);
  const percent = (match: RegExpMatchArray | null) => {
    const value = match?.[1];
    return value ? Math.round(Number(value.replace(',', '.')) * 100) : undefined;
  };
  return { brief: normalized, marginBps: percent(margin), discountBps: percent(discount) };
}
