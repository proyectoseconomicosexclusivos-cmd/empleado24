export type BrainAutomation = { employeeType?: 'closer'; taskType?: 'follow_up'; title?: string; notifyOwner?: boolean };

export function automationForBrainEvent(eventName: string): BrainAutomation | null {
  if (eventName === 'LeadCreated') return { employeeType: 'closer', taskType: 'follow_up', title: 'Revisar nuevo cliente interesado' };
  if (eventName === 'BudgetSent') return { employeeType: 'closer', taskType: 'follow_up', title: 'Hacer seguimiento del presupuesto enviado' };
  if (eventName === 'SaleWon') return { notifyOwner: true };
  return null;
}
