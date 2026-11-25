'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, testFirestoreConnection } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import {
  clampValueMmol,
  DEFAULT_USER_SETTINGS,
  sanitizeDisplayName,
  sanitizeNote,
} from '@/lib/glucose-utils';
import { generateSampleGlucoseRecords } from '@/lib/sample-data';
import type {
  GlucoseRecord,
  GlucoseRecordInput,
  GlucoseUnit,
  UserSettings,
} from '@/lib/types';

const LOCAL_RECORDS_KEY = 'qingtang_local_records_v1';
const LOCAL_SETTINGS_KEY = 'qingtang_local_settings_v1';

interface GlucoseDataContextValue {
  user: User | null;
  authReady: boolean;
  loadingData: boolean;
  isCloudMode: boolean;
  authError: string | null;
  clearAuthError: () => void;
  records: GlucoseRecord[];
  settings: UserSettings;
  localDraftCount: number;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  addRecord: (input: GlucoseRecordInput) => Promise<void>;
  editRecord: (id: string, input: GlucoseRecordInput) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  updateSettings: (partial: Partial<Omit<UserSettings, 'uid'>>) => Promise<void>;
  toggleUnit: (unit: GlucoseUnit) => Promise<void>;
  importSampleData: () => Promise<void>;
  importLocalRecordsToCloud: () => Promise<number>;
  clearLocalRecords: () => void;
}

const GlucoseDataContext = createContext<GlucoseDataContextValue | null>(null);

function makeDefaultLocalSettings(): UserSettings {
  return {
    uid: 'local_preview',
    displayName: '本地试用用户',
    ...DEFAULT_USER_SETTINGS,
  };
}

function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

export function GlucoseDataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [cloudRecords, setCloudRecords] = useState<GlucoseRecord[]>([]);
  const [cloudSettings, setCloudSettings] = useState<UserSettings | null>(null);

  const [localRecords, setLocalRecords] = useState<GlucoseRecord[]>([]);
  const [localSettings, setLocalSettings] = useState<UserSettings>(makeDefaultLocalSettings);
  const [localInitialized, setLocalInitialized] = useState(false);

  // Load local preview state on mount
  useEffect(() => {
    testFirestoreConnection();

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const savedSettingsRaw = window.localStorage.getItem(LOCAL_SETTINGS_KEY);
        if (savedSettingsRaw) {
          const parsed = JSON.parse(savedSettingsRaw) as Partial<UserSettings>;
          setLocalSettings({
            ...makeDefaultLocalSettings(),
            ...parsed,
            uid: 'local_preview',
          });
        }

        const savedRecordsRaw = window.localStorage.getItem(LOCAL_RECORDS_KEY);
        if (savedRecordsRaw) {
          const parsed = JSON.parse(savedRecordsRaw) as GlucoseRecord[];
          if (Array.isArray(parsed)) {
            setLocalRecords(parsed.sort((a, b) => b.measuredAtMs - a.measuredAtMs));
          } else {
            const sample = generateSampleGlucoseRecords();
            setLocalRecords(sample);
            window.localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(sample));
          }
        } else {
          const sample = generateSampleGlucoseRecords();
          setLocalRecords(sample);
          window.localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(sample));
        }
      } catch {
        setLocalRecords(generateSampleGlucoseRecords());
      } finally {
        setLocalInitialized(true);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        setLoadingData(true);
      } else {
        setCloudRecords([]);
        setCloudSettings(null);
        setLoadingData(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Ensure parent user doc exists & subscribe to Firestore when authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;

    const userDocPath = `users/${user.uid}`;
    const userDocRef = doc(db, 'users', user.uid);

    const ensureUserDoc = async () => {
      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists() && !cancelled) {
          const initialPayload = {
            uid: user.uid,
            displayName: sanitizeDisplayName(user.displayName || user.email?.split('@')[0] || '控糖用户'),
            unit: localSettings.unit,
            fastingLow: localSettings.fastingLow,
            fastingHigh: localSettings.fastingHigh,
            postMealLow: localSettings.postMealLow,
            postMealHigh: localSettings.postMealHigh,
            generalLow: localSettings.generalLow,
            generalHigh: localSettings.generalHigh,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userDocRef, initialPayload);
        }
      } catch (error) {
        if (!cancelled) {
          handleFirestoreError(error, OperationType.WRITE, userDocPath);
        }
      }
    };

    ensureUserDoc();

    const unsubSettings = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setCloudSettings({
            uid: String(d.uid ?? user.uid),
            displayName: String(d.displayName ?? ''),
            unit: d.unit === 'mg/dL' ? 'mg/dL' : 'mmol/L',
            fastingLow: Number(d.fastingLow ?? DEFAULT_USER_SETTINGS.fastingLow),
            fastingHigh: Number(d.fastingHigh ?? DEFAULT_USER_SETTINGS.fastingHigh),
            postMealLow: Number(d.postMealLow ?? DEFAULT_USER_SETTINGS.postMealLow),
            postMealHigh: Number(d.postMealHigh ?? DEFAULT_USER_SETTINGS.postMealHigh),
            generalLow: Number(d.generalLow ?? DEFAULT_USER_SETTINGS.generalLow),
            generalHigh: Number(d.generalHigh ?? DEFAULT_USER_SETTINGS.generalHigh),
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userDocPath);
      }
    );

    const recordsPath = `users/${user.uid}/glucoseRecords`;
    const recordsQuery = query(
      collection(db, 'users', user.uid, 'glucoseRecords'),
      where('uid', '==', user.uid)
    );

    const unsubRecords = onSnapshot(
      recordsQuery,
      (snapshot) => {
        const list: GlucoseRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            uid: String(d.uid ?? user.uid),
            valueMmol: Number(d.valueMmol),
            context: d.context,
            measuredAtMs: Number(d.measuredAtMs),
            note: String(d.note ?? ''),
            mealLevel: d.mealLevel ?? 'none',
            exerciseLevel: d.exerciseLevel ?? 'none',
            medicationTaken: Boolean(d.medicationTaken),
          };
        });
        list.sort((a, b) => b.measuredAtMs - a.measuredAtMs);
        setCloudRecords(list);
        setLoadingData(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, recordsPath);
      }
    );

    return () => {
      cancelled = true;
      unsubSettings();
      unsubRecords();
    };
  }, [authReady, user, localSettings.unit, localSettings.fastingLow, localSettings.fastingHigh, localSettings.postMealLow, localSettings.postMealHigh, localSettings.generalLow, localSettings.generalHigh]);

  const persistLocalRecords = useCallback((next: GlucoseRecord[]) => {
    const sorted = [...next].sort((a, b) => b.measuredAtMs - a.measuredAtMs);
    setLocalRecords(sorted);
    try {
      window.localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(sorted));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const persistLocalSettings = useCallback((next: UserSettings) => {
    setLocalSettings(next);
    try {
      window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/popup-blocked') {
        setAuthError('浏览器拦截了登录弹窗，请允许弹窗后重试。');
        return;
      }
      setAuthError('Google 登录未完成，请稍后重试。');
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const ensureParentUserDocForWrite = useCallback(async (currentUser: User) => {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      await setDoc(userDocRef, {
        uid: currentUser.uid,
        displayName: sanitizeDisplayName(
          currentUser.displayName || currentUser.email?.split('@')[0] || '控糖用户'
        ),
        ...DEFAULT_USER_SETTINGS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }, []);

  const addRecord = useCallback(
    async (input: GlucoseRecordInput) => {
      const sanitizedValue = clampValueMmol(input.valueMmol);
      const sanitizedNote = sanitizeNote(input.note);
      const measuredAtMs = Math.max(1, Math.round(input.measuredAtMs));

      if (!user) {
        const newRec: GlucoseRecord = {
          id: generateSafeId('rec'),
          uid: 'local_preview',
          valueMmol: sanitizedValue,
          context: input.context,
          measuredAtMs,
          note: sanitizedNote,
          mealLevel: input.mealLevel,
          exerciseLevel: input.exerciseLevel,
          medicationTaken: Boolean(input.medicationTaken),
        };
        persistLocalRecords([newRec, ...localRecords]);
        return;
      }

      const recordId = generateSafeId('rec');
      const path = `users/${user.uid}/glucoseRecords/${recordId}`;
      try {
        await ensureParentUserDocForWrite(user);
        await setDoc(doc(db, 'users', user.uid, 'glucoseRecords', recordId), {
          uid: user.uid,
          valueMmol: sanitizedValue,
          context: input.context,
          measuredAtMs,
          note: sanitizedNote,
          mealLevel: input.mealLevel,
          exerciseLevel: input.exerciseLevel,
          medicationTaken: Boolean(input.medicationTaken),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, localRecords, persistLocalRecords, ensureParentUserDocForWrite]
  );

  const editRecord = useCallback(
    async (id: string, input: GlucoseRecordInput) => {
      const sanitizedValue = clampValueMmol(input.valueMmol);
      const sanitizedNote = sanitizeNote(input.note);
      const measuredAtMs = Math.max(1, Math.round(input.measuredAtMs));

      if (!user) {
        const updated = localRecords.map((item) =>
          item.id === id
            ? {
                ...item,
                valueMmol: sanitizedValue,
                context: input.context,
                measuredAtMs,
                note: sanitizedNote,
                mealLevel: input.mealLevel,
                exerciseLevel: input.exerciseLevel,
                medicationTaken: Boolean(input.medicationTaken),
              }
            : item
        );
        persistLocalRecords(updated);
        return;
      }

      const path = `users/${user.uid}/glucoseRecords/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'glucoseRecords', id), {
          valueMmol: sanitizedValue,
          context: input.context,
          measuredAtMs,
          note: sanitizedNote,
          mealLevel: input.mealLevel,
          exerciseLevel: input.exerciseLevel,
          medicationTaken: Boolean(input.medicationTaken),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, localRecords, persistLocalRecords]
  );

  const removeRecord = useCallback(
    async (id: string) => {
      if (!user) {
        persistLocalRecords(localRecords.filter((item) => item.id !== id));
        return;
      }

      const path = `users/${user.uid}/glucoseRecords/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'glucoseRecords', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, localRecords, persistLocalRecords]
  );

  const updateSettings = useCallback(
    async (partial: Partial<Omit<UserSettings, 'uid'>>) => {
      const current = user && cloudSettings ? cloudSettings : localSettings;
      const merged: UserSettings = {
        ...current,
        ...partial,
        displayName: sanitizeDisplayName(partial.displayName ?? current.displayName),
      };

      // Validate range ordering
      if (merged.fastingHigh <= merged.fastingLow) {
        merged.fastingHigh = Number((merged.fastingLow + 0.5).toFixed(1));
      }
      if (merged.postMealHigh <= merged.postMealLow) {
        merged.postMealHigh = Number((merged.postMealLow + 0.5).toFixed(1));
      }
      if (merged.generalHigh <= merged.generalLow) {
        merged.generalHigh = Number((merged.generalLow + 0.5).toFixed(1));
      }

      if (!user) {
        persistLocalSettings(merged);
        return;
      }

      const path = `users/${user.uid}`;
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          await setDoc(userDocRef, {
            uid: user.uid,
            displayName: merged.displayName,
            unit: merged.unit,
            fastingLow: merged.fastingLow,
            fastingHigh: merged.fastingHigh,
            postMealLow: merged.postMealLow,
            postMealHigh: merged.postMealHigh,
            generalLow: merged.generalLow,
            generalHigh: merged.generalHigh,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(userDocRef, {
            displayName: merged.displayName,
            unit: merged.unit,
            fastingLow: merged.fastingLow,
            fastingHigh: merged.fastingHigh,
            postMealLow: merged.postMealLow,
            postMealHigh: merged.postMealHigh,
            generalLow: merged.generalLow,
            generalHigh: merged.generalHigh,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, cloudSettings, localSettings, persistLocalSettings]
  );

  const toggleUnit = useCallback(
    async (unit: GlucoseUnit) => {
      await updateSettings({ unit });
    },
    [updateSettings]
  );

  const importSampleData = useCallback(async () => {
    const sample = generateSampleGlucoseRecords();
    if (!user) {
      persistLocalRecords(sample);
      return;
    }

    const path = `users/${user.uid}/glucoseRecords`;
    try {
      await ensureParentUserDocForWrite(user);
      const batch = writeBatch(db);
      for (const item of sample) {
        const recordId = generateSafeId('demo');
        const ref = doc(db, 'users', user.uid, 'glucoseRecords', recordId);
        batch.set(ref, {
          uid: user.uid,
          valueMmol: clampValueMmol(item.valueMmol),
          context: item.context,
          measuredAtMs: item.measuredAtMs,
          note: sanitizeNote(item.note),
          mealLevel: item.mealLevel,
          exerciseLevel: item.exerciseLevel,
          medicationTaken: item.medicationTaken,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }, [user, persistLocalRecords, ensureParentUserDocForWrite]);

  const importLocalRecordsToCloud = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    const customLocal = localRecords.filter((r) => !r.id.startsWith('sample_rec_'));
    if (customLocal.length === 0) return 0;

    const path = `users/${user.uid}/glucoseRecords`;
    try {
      await ensureParentUserDocForWrite(user);
      const batch = writeBatch(db);
      for (const item of customLocal) {
        const recordId = generateSafeId('imp');
        const ref = doc(db, 'users', user.uid, 'glucoseRecords', recordId);
        batch.set(ref, {
          uid: user.uid,
          valueMmol: clampValueMmol(item.valueMmol),
          context: item.context,
          measuredAtMs: item.measuredAtMs,
          note: sanitizeNote(item.note),
          mealLevel: item.mealLevel,
          exerciseLevel: item.exerciseLevel,
          medicationTaken: item.medicationTaken,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      // Remove imported custom records from local draft bucket so they aren't re-imported
      persistLocalRecords(localRecords.filter((r) => r.id.startsWith('sample_rec_')));
      return customLocal.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }, [user, localRecords, persistLocalRecords, ensureParentUserDocForWrite]);

  const clearLocalRecords = useCallback(() => {
    persistLocalRecords([]);
  }, [persistLocalRecords]);

  const localDraftCount = useMemo(
    () => localRecords.filter((r) => !r.id.startsWith('sample_rec_')).length,
    [localRecords]
  );

  const activeRecords = useMemo(() => {
    if (user) return cloudRecords;
    return localInitialized ? localRecords : [];
  }, [user, cloudRecords, localInitialized, localRecords]);

  const activeSettings = useMemo(() => {
    if (user && cloudSettings) return cloudSettings;
    if (user) {
      return {
        ...localSettings,
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || '控糖用户',
      };
    }
    return localSettings;
  }, [user, cloudSettings, localSettings]);

  const value: GlucoseDataContextValue = {
    user,
    authReady,
    loadingData: user ? loadingData : !localInitialized,
    isCloudMode: Boolean(user),
    authError,
    clearAuthError,
    records: activeRecords,
    settings: activeSettings,
    localDraftCount,
    signInWithGoogle,
    signOutUser,
    addRecord,
    editRecord,
    removeRecord,
    updateSettings,
    toggleUnit,
    importSampleData,
    importLocalRecordsToCloud,
    clearLocalRecords,
  };

  return <GlucoseDataContext.Provider value={value}>{children}</GlucoseDataContext.Provider>;
}

export function useGlucoseData(): GlucoseDataContextValue {
  const ctx = useContext(GlucoseDataContext);
  if (!ctx) {
    throw new Error('useGlucoseData must be used inside GlucoseDataProvider');
  }
  return ctx;
}
