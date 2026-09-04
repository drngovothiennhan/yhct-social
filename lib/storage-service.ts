'use client';

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type StorageReference,
} from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
  safeStorageFileName,
  validatePostImages,
} from '@/lib/domain/media';
import type { SocialMedia } from '@/lib/domain/social';

export type UploadProgressHandler = (progress: number) => void;

function uploadOne(
  storageRef: StorageReference,
  file: File,
  onProgress?: UploadProgressHandler,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      cacheControl: 'public,max-age=31536000,immutable',
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
        }
      },
      reject,
      () => resolve(),
    );
  });
}

export async function uploadSocialPostImages(input: {
  uid: string;
  postId: string;
  files: File[];
  onProgress?: UploadProgressHandler;
}): Promise<SocialMedia[]> {
  validatePostImages(input.files);
  if (input.files.length === 0) return [];

  const uploaded: StorageReference[] = [];
  const basePath = `social/posts/${input.uid}/${input.postId}`;

  try {
    for (let index = 0; index < input.files.length; index += 1) {
      const file = input.files[index];
      const fileName = `${crypto.randomUUID()}-${safeStorageFileName(file.name)}`;
      const storageRef = ref(storage, `${basePath}/${fileName}`);

      await uploadOne(storageRef, file, (currentFileProgress) => {
        const overall = (index + currentFileProgress) / input.files.length;
        input.onProgress?.(Math.min(1, overall));
      });
      uploaded.push(storageRef);
    }

    const result = await Promise.all(uploaded.map(async (item): Promise<SocialMedia> => ({
      type: 'image',
      storagePath: item.fullPath,
      downloadURL: await getDownloadURL(item),
      width: null,
      height: null,
    })));
    input.onProgress?.(1);
    return result;
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => deleteObject(item)));
    throw error;
  }
}

// Legacy v1 media uploader retained until old composer is fully retired.
export async function uploadPostImages(input: {
  uid: string;
  postId: string;
  files: File[];
  onProgress?: UploadProgressHandler;
}): Promise<string[]> {
  validatePostImages(input.files);
  if (input.files.length === 0) return [];

  const uploaded: StorageReference[] = [];

  try {
    for (let index = 0; index < input.files.length; index += 1) {
      const file = input.files[index];
      const fileName = `${crypto.randomUUID()}-${safeStorageFileName(file.name)}`;
      const path = `post-media/${input.uid}/${input.postId}/${fileName}`;
      const storageRef = ref(storage, path);
      await uploadOne(storageRef, file, (currentFileProgress) => {
        const overall = (index + currentFileProgress) / input.files.length;
        input.onProgress?.(Math.min(1, overall));
      });
      uploaded.push(storageRef);
    }

    input.onProgress?.(1);
    return uploaded.map((item) => item.fullPath);
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => deleteObject(item)));
    throw error;
  }
}

export async function deleteStoragePaths(paths: string[]): Promise<void> {
  await Promise.allSettled(paths.map((path) => deleteObject(ref(storage, path))));
}

export async function resolveStorageUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}
