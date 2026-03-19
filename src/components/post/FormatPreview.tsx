'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface FormatPreviewProps {
  template: string;
  config: any;
  inventoryData?: any;
}

export function FormatPreview({
  template,
  config,
  inventoryData,
}: FormatPreviewProps) {
  const { data: postData, isLoading } = useQuery({
    queryKey: ['post-preview', template, config],
    queryFn: () =>
      api<{ text: string }>('/api/post/generate', {
        method: 'POST',
        body: {
          selectedFormatIds: [],
          template: template, // Pass template directly for preview
          config: config,
        },
      }),
    enabled: !!inventoryData && template.trim().length > 0,
  });

  // For preview, we need to generate post with custom template
  // This is a simplified version - in production, you might want a separate preview endpoint
  const previewText = postData?.text || 'Загрузка превью...';

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#F5F5F7]">Предпросмотр поста:</p>
      <div className="bg-[#1B2030] rounded-[16px] p-5">
        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-[#F5F5F7]">
          {isLoading ? 'Загрузка...' : previewText || 'Введите шаблон для предпросмотра'}
        </pre>
      </div>
      <p className="text-xs text-[#9CA3AF]">
        Это предпросмотр с текущими данными склада
      </p>
    </div>
  );
}
