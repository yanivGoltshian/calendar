'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export default function ServiceCard({
  id,
  editing,
  children,
}: {
  id: string;
  editing: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) {
      ref.current
        ?.querySelector<HTMLInputElement>('input[name="name"]')
        ?.focus({ preventScroll: true });
    } else if (
      wasEditing.current &&
      !new URL(window.location.href).searchParams.has('edit')
    ) {
      ref.current
        ?.querySelector<HTMLAnchorElement>('[data-service-edit]')
        ?.focus({ preventScroll: true });
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
    wasEditing.current = editing;
  }, [editing]);

  return (
    <li
      ref={ref}
      data-service-id={id}
      className="scroll-mb-24 scroll-mt-24 rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm"
    >
      {children}
    </li>
  );
}
