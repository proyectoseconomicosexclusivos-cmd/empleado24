import type { CSSProperties } from 'react';
import type { EmployeeShowcase } from '@/lib/employee-showcase';

export function EmployeeIdentity({
  employee,
  compact = false,
  className = '',
}: {
  employee: Pick<EmployeeShowcase, 'person' | 'name' | 'identity'>;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`employee-identity ${compact ? 'employee-identity--compact' : ''} ${className}`}
      style={{ '--employee-accent': employee.identity.accent } as CSSProperties}
    >
      <span className="employee-identity__mark" aria-hidden="true">
        {employee.identity.icon}
      </span>
      <span>
        <span className="employee-identity__name">{employee.person}</span>
        <span className="employee-identity__signature">{employee.identity.signature}</span>
      </span>
    </div>
  );
}
