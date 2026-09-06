'use client';

import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type RegistrationStatus = 'registered' | 'waitlisted' | 'cancelled';

export interface ActivityRegistration {
  uid: string;
  status: RegistrationStatus;
  registeredAt: unknown;
  updatedAt: unknown;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('AUTH_REQUIRED');
  return uid;
}

export async function registerForActivity(activityId: string): Promise<RegistrationStatus> {
  const uid = currentUid();
  const activityRef = doc(db, 'activities', activityId);
  const registrationRef = doc(db, 'activities', activityId, 'registrations', uid);

  return runTransaction(db, async (transaction) => {
    const [activity, existing] = await Promise.all([
      transaction.get(activityRef),
      transaction.get(registrationRef),
    ]);
    if (!activity.exists() || activity.data().status !== 'published') throw new Error('ACTIVITY_NOT_AVAILABLE');
    const data = activity.data();
    const capacity = Number(data.capacity ?? 0);
    const registeredCount = Number(data.registeredCount ?? 0);
    const waitlistCount = Number(data.waitlistCount ?? 0);
    if (existing.exists() && existing.data().status !== 'cancelled') return existing.data().status as RegistrationStatus;

    const status: RegistrationStatus = capacity > 0 && registeredCount >= capacity ? 'waitlisted' : 'registered';
    transaction.set(registrationRef, {
      uid,
      status,
      registeredAt: existing.exists() ? existing.data().registeredAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(activityRef, status === 'registered'
      ? { registeredCount: registeredCount + 1, updatedAt: serverTimestamp() }
      : { waitlistCount: waitlistCount + 1, updatedAt: serverTimestamp() }, { merge: true });
    return status;
  });
}

export async function cancelActivityRegistration(activityId: string): Promise<void> {
  const uid = currentUid();
  const activityRef = doc(db, 'activities', activityId);
  const registrationRef = doc(db, 'activities', activityId, 'registrations', uid);
  await runTransaction(db, async (transaction) => {
    const [activity, registration] = await Promise.all([
      transaction.get(activityRef),
      transaction.get(registrationRef),
    ]);
    if (!registration.exists() || registration.data().status === 'cancelled') return;
    const activityData = activity.data() ?? {};
    const status = registration.data().status as RegistrationStatus;
    transaction.set(registrationRef, { status: 'cancelled', updatedAt: serverTimestamp() }, { merge: true });
    if (activity.exists()) {
      if (status === 'registered') {
        transaction.set(activityRef, { registeredCount: Math.max(0, Number(activityData.registeredCount ?? 0) - 1), updatedAt: serverTimestamp() }, { merge: true });
      } else if (status === 'waitlisted') {
        transaction.set(activityRef, { waitlistCount: Math.max(0, Number(activityData.waitlistCount ?? 0) - 1), updatedAt: serverTimestamp() }, { merge: true });
      }
    }
  });
}

export async function loadMyActivityRegistration(activityId: string): Promise<ActivityRegistration | null> {
  const uid = currentUid();
  const snapshot = await getDoc(doc(db, 'activities', activityId, 'registrations', uid));
  return snapshot.exists() ? snapshot.data() as ActivityRegistration : null;
}

export async function loadMyRegistrations(): Promise<Array<ActivityRegistration & { activityId: string }>> {
  const uid = currentUid();
  const registrations = await getDocs(query(collection(db, 'activityRegistrations'), where('uid', '==', uid), orderBy('updatedAt', 'desc'))).catch(() => null);
  if (!registrations) return [];
  return registrations.docs.map((item) => ({ activityId: String(item.data().activityId ?? item.id), ...(item.data() as ActivityRegistration) }));
}
