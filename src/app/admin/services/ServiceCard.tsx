'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ServiceCard({
  id,
  editing,
  editor,
  children,
}: {
  id: string;
  editing: boolean;
  editor: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const wasEditing = useRef(false);
  const searchParams = useSearchParams();
  const isEditing = editing && searchParams.get('edit') === id;

  useEffect(() => {
    if (isEditing) {
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
    wasEditing.current = isEditing;
  }, [isEditing]);

  return (
    <li
      ref={ref}
      data-service-id={id}
      className="scroll-mb-24 scroll-mt-24 rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm"
    >
      {isEditing ? editor : children}
    </li>
  );
}
