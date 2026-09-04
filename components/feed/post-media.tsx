'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { resolveStorageUrl } from '@/lib/storage-service';

interface ResolvedMedia {
  key: string;
  urls: string[];
}

export function PostMedia({ paths }: { paths: string[] }) {
  const pathsKey = useMemo(() => paths.join('\n'), [paths]);
  const [resolvedMedia, setResolvedMedia] = useState<ResolvedMedia>({ key: '', urls: [] });

  useEffect(() => {
    let active = true;
    if (paths.length === 0) {
      return () => { active = false; };
    }

    void Promise.all(paths.map(resolveStorageUrl))
      .then((resolved) => {
        if (active) setResolvedMedia({ key: pathsKey, urls: resolved });
      })
      .catch(() => {
        if (active) setResolvedMedia({ key: pathsKey, urls: [] });
      });

    return () => { active = false; };
  }, [paths, pathsKey]);

  if (paths.length === 0) return null;

  const urls = resolvedMedia.key === pathsKey ? resolvedMedia.urls : [];

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
