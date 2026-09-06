'use client';

import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface CommunityQuestion {
  id: string;
  authorId: string;
  title: string;
  content: string;
  tags: string[];
  status: 'open' | 'answered' | 'closed';
  acceptedAnswerId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CommunityAnswer {
  id: string;
  authorId: string;
  content: string;
  createdAt: unknown;
  updatedAt: unknown;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('AUTH_REQUIRED');
  return uid;
}

export async function createCommunityQuestion(input: { title: string; content: string; tags?: string[] }): Promise<string> {
  const authorId = currentUid();
  const title = input.title.trim().slice(0, 180);
  const content = input.content.trim().slice(0, 12000);
  const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
  if (!title || !content) throw new Error('QUESTION_CONTENT_REQUIRED');
  const ref = await addDoc(collection(db, 'questions'), {
    authorId,
    title,
    content,
    tags,
    status: 'open',
    acceptedAnswerId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listCommunityQuestions(status?: CommunityQuestion['status']): Promise<CommunityQuestion[]> {
  const ref = collection(db, 'questions');
  const snapshot = await getDocs(status
    ? query(ref, where('status', '==', status), orderBy('updatedAt', 'desc'), limit(50))
    : query(ref, orderBy('updatedAt', 'desc'), limit(50)));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<CommunityQuestion, 'id'>) }));
}

export async function addCommunityAnswer(questionId: string, contentInput: string): Promise<string> {
  const authorId = currentUid();
  const content = contentInput.trim().slice(0, 8000);
  if (!content) throw new Error('ANSWER_CONTENT_REQUIRED');
  const ref = await addDoc(collection(db, 'questions', questionId, 'answers'), {
    authorId,
    content,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listCommunityAnswers(questionId: string): Promise<CommunityAnswer[]> {
  const snapshot = await getDocs(query(collection(db, 'questions', questionId, 'answers'), orderBy('createdAt', 'asc'), limit(100)));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<CommunityAnswer, 'id'>) }));
}

export async function acceptCommunityAnswer(question: CommunityQuestion, answerId: string): Promise<void> {
  const uid = currentUid();
  if (question.authorId !== uid) throw new Error('FORBIDDEN');
  await updateDoc(doc(db, 'questions', question.id), {
    status: 'answered',
    acceptedAnswerId: answerId,
    updatedAt: serverTimestamp(),
  });
}
