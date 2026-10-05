/** Simple arch-and-sun mark. Replace with the real logo when available. */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#1e3a5f" />
      <path d="M9 31V19a11 11 0 0 1 22 0v12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="19" r="4" fill="#f2b33d" />
      <path d="M7 31h26" stroke="#f2b33d" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
