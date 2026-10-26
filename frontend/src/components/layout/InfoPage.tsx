import type { ReactNode } from 'react';
import { PageHeader } from '../ui/PageHeader';

/**
 * Shared shell for the public information pages. Keeps typography and spacing
 * consistent without introducing a heavy prose plugin.
 */
export function InfoPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="mt-8 space-y-8">{children}</div>
      <p className="mt-10 border-t border-ink-200 pt-5 text-xs leading-relaxed text-ink-400">
        BloodBridge is an educational prototype. It does not replace clinical compatibility
        testing, professional medical advice, donor eligibility assessment or hospital procedures.
        For a life-threatening emergency, contact your local emergency number and the hospital
        directly.
      </p>
    </div>
  );
}

export function InfoSection({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-ink-900">{title}</h2>
      <div className="mt-2.5 space-y-3 text-sm leading-relaxed text-ink-600">{children}</div>
    </section>
  );
}

export function InfoList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
