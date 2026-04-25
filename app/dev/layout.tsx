import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

import { isDemoMode } from '@/lib/env';

type Props = Readonly<{
  children: ReactNode;
}>;

export default function DevLayout({ children }: Props) {
  if (!isDemoMode) {
    notFound();
  }

  return <>{children}</>;
}
