import Image from 'next/image';

export function EmployeeAvatar({
  portrait,
  name,
  className,
  priority = false,
}: {
  portrait: string;
  name: string;
  className?: string;
  priority?: boolean;
}) {
  return <span className={`relative block shrink-0 overflow-hidden rounded-2xl bg-[#dfe8c2] shadow-inner ${className ?? ''}`}>
    <Image
      src={portrait}
      alt={`Retrato de ${name}, empleado IA de Empleado24`}
      fill
      sizes="(max-width: 640px) 96px, 180px"
      priority={priority}
      className="object-cover object-center"
    />
  </span>;
}

