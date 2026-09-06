'use client';

import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type RegistrationStatus = 'registered' | 'waitlisted' | 'cancelled';

export interface ActivityRegistration {
  uid: string;
  activityId: string;
  status: RegistrationStatus;
  registeredAt: unknown;
  updatedAt: unknown;
}

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${await user.getIdToken()}`,
  };
}

async function mutateRegistration(activityId: string, action: 'register' | 'cancel'): Promise<RegistrationStatus> {
  const response = await fetch('/api/activities/registration', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ activityId, action }),
  });
  const payload = await response.json() as { status?: RegistrationStatus; error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'ACTIVITY_REGISTRATION_FAILED');
  return payload.status ?? 'registered';
}

export function registerForActivity(activityId: string): Promise<RegistrationStatus> {
  return mutateRegistration(activityId, 'register');
}

export async function cancelActivityRegistration(activityId: string): Promise<void> {
  await mutateRegistration(activityId, 'cancel');
}

export async function loadMyActivityRegistration(activityId: string): Promise<ActivityRegistration | null> {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const registrationRef = doc(db, 'activities', activityId, 'registrations', user.uid);

  // Read in a transaction so the caller never observes a partially-updated registration.
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(registrationRef);
    return snapshot.exists() ? snapshot.data() as ActivityRegistration : null;
  });
}
