const portraits: Record<string, string> = {
  '0% 0%': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"%3E%3Crect width="160" height="160" rx="28" fill="%233d5a80"/%3E%3Ccircle cx="80" cy="58" r="30" fill="%23f1c7a7"/%3E%3Cpath d="M28 150c6-40 28-58 52-58s46 18 52 58" fill="%236ea4bf"/%3E%3Cpath d="M50 48c6-28 55-33 62 2-18-11-42-10-62-2" fill="%232a1c1c"/%3E%3C/svg%3E',
  '100% 0%': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"%3E%3Crect width="160" height="160" rx="28" fill="%234d7c59"/%3E%3Ccircle cx="80" cy="58" r="30" fill="%23e5b996"/%3E%3Cpath d="M28 150c6-40 28-58 52-58s46 18 52 58" fill="%23d0a65a"/%3E%3Cpath d="M48 55c0-38 64-46 67 2-18-9-44-10-67-2" fill="%234a2c1d"/%3E%3C/svg%3E',
  '0% 100%': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"%3E%3Crect width="160" height="160" rx="28" fill="%236d597a"/%3E%3Ccircle cx="80" cy="58" r="30" fill="%237c4f37"/%3E%3Cpath d="M28 150c6-40 28-58 52-58s46 18 52 58" fill="%23d5a021"/%3E%3Cpath d="M48 58c0-38 64-47 67-1-20-10-44-10-67 1" fill="%231b1614"/%3E%3C/svg%3E',
  '100% 100%': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"%3E%3Crect width="160" height="160" rx="28" fill="%233b6d8c"/%3E%3Ccircle cx="80" cy="58" r="30" fill="%23b97855"/%3E%3Cpath d="M28 150c6-40 28-58 52-58s46 18 52 58" fill="%23d95d39"/%3E%3Cpath d="M45 55c4-32 67-40 70 0-20-10-47-10-70 0" fill="%23251c1a"/%3E%3C/svg%3E',
};

export function EmployeeAvatar({ position, className }: { position: string; className?: string }) {
  return <span
    aria-hidden="true"
    className={`block shrink-0 overflow-hidden rounded-2xl bg-[#dfe8c2] shadow-inner ${className ?? ''}`}
    style={{
      backgroundImage: `url("${portraits[position] ?? portraits['0% 0%']}")`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    }}
  />;
}
