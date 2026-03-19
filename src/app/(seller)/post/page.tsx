'use client';

import dynamic from 'next/dynamic';

const PostGenerator = dynamic(
  () => import('@/components/pages/PostGenerator').then((mod) => ({ default: mod.PostGenerator })),
  { ssr: false }
);

export default function PostPage() {
  return <PostGenerator />;
}
