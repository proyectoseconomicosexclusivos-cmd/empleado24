import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote, parseQuoteBrief } from './quote-engine.ts';

test('calcula capítulos, costes indirectos, margen real, descuento e impuesto', () => {
  const totals = calculateQuote({
    lines: [
      { chapter: 'Instalación', concept: 'Horas', unit: 'h', quantity: 10, unitCostCents: 2000, plannedDays: 2 },
      { chapter: 'Materiales', concept: 'Kit', unit: 'ud', quantity: 1, unitCostCents: 10000, plannedDays: 1 },
    ],
    indirectCosts: [{ name: 'Desplazamiento', kind: 'percent', basis: 'cost', amount: 1000 }],
    marginBps: 3500, discountBps: 1000, taxBps: 2100,
  });
  assert.equal(totals.directCostCents, 30000);
  assert.equal(totals.indirectCostCents, 3000);
  assert.equal(totals.costCents, 33000);
  assert.equal(totals.plannedDays, 3);
  assert.equal(totals.chapterTotals.length, 2);
  assert.equal(totals.totalCents, 55287);
});

test('interpreta margen y descuento del encargo sin fijar sector ni precio', () => {
  assert.deepEqual(parseQuoteBrief('Haz un presupuesto para una campaña. Margen del 35%. Aplica un descuento del 10%.'), {
    brief: 'Haz un presupuesto para una campaña. Margen del 35%. Aplica un descuento del 10%.', marginBps: 3500, discountBps: 1000,
  });
});
