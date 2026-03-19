'use client';

import dynamic from 'next/dynamic';

const FormatBuilder = dynamic(
  () => import('@/components/post/FormatBuilder').then((mod) => ({ default: mod.FormatBuilder })),
  { ssr: false }
);

export default function FormatsPage() {
  return <FormatBuilder />;
}
