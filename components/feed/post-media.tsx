'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { resolveStorageUrl } from '@/lib/storage-service';

export function PostMedia({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (paths.length === 0) {
      setUrls([]);
      return () => { active = false; };
    }

    void Promise.all(paths.map(resolveStorageUrl))
      .then((resolved) => {
        if (active) setUrls(resolved);
      })
      .catch(() => {
        if (active) setUrls([]);
      });

    return () => { active = false; };
  }, [paths]);

  if (paths.length === 0) return null;

  if (urls.length === 0) {
    return (
      <div className="mt-4 grid min-h-40 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <ImageIcon className="h-6 w-6" />
      </div>
    );
  }

  const layoutClass = urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <div className={`mt-4 grid ${layoutClass} gap-2 overflow-hidden rounded-2xl`}>
      {urls.map((url, index) => (
        <div
          key={paths[index]}
          className={`relative min-h-52 overflow-hidden bg-slate-100 ${urls.length === 3 && index === 0 ? 'row-span-2' : ''}`}
        >
          <Image
            src={url}
            alt={`Ảnh đính kèm bài viết ${index + 1}`}
            fill
            sizes={urls.length === 1 ? '(max-width: 768px) 100vw, 680px' : '(max-width: 768px) 50vw, 340px'}
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
