/**
 * Placeholder brand icon: a manila folder with a speech-bubble cutout
 * ("paperwork" + "chika"). Replace with the final mascot/logo later.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M3 8a2 2 0 0 1 2-2h7l3 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="var(--folder)" />
      <path d="M11 13h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-6l-3.5 2.5V21H11a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" fill="var(--primary)" />
    </svg>
  );
}
