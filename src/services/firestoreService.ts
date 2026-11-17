import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  INITIAL_DEMO_CAMPAIGNS,
  INITIAL_DEMO_CUSTOMERS,
  INITIAL_DEMO_EXPENSES,
  INITIAL_DEMO_MOVEMENTS,
  INITIAL_DEMO_ORDERS,
  INITIAL_DEMO_PRODUCTS,
  INITIAL_INTEGRATIONS,
  INITIAL_REGIONAL_CONFIGS,
} from '../data/seedData';

export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function logAuditEvent(params: {
  actorRole: string;
  action: string;
  module: string;
  targetId?: string;
  details: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const logId = makeId('log');
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      ownerUid: user.uid,
      actorEmail: user.email || 'unknown@7sense.local',
      actorRole: params.actorRole,
      action: params.action,
      module: params.module,
      targetId: params.targetId || '',
      details: params.details.slice(0, 490),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `auditLogs/${logId}`);
  }
}

export async function seedDemoWorkspace(ownerUid: string): Promise<void> {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  for (const reg of INITIAL_REGIONAL_CONFIGS) {
    batch.set(doc(db, 'regionalConfigs', reg.id), {
      ...reg,
      ownerUid,
      updatedAt: now,
    });
  }

  for (const prod of INITIAL_DEMO_PRODUCTS) {
    batch.set(doc(db, 'products', prod.id), {
      ...prod,
      ownerUid,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const cust of INITIAL_DEMO_CUSTOMERS) {
    batch.set(doc(db, 'customers', cust.id), {
      ...cust,
      ownerUid,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const ord of INITIAL_DEMO_ORDERS) {
    batch.set(doc(db, 'orders', ord.id), {
      ...ord,
      ownerUid,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const camp of INITIAL_DEMO_CAMPAIGNS) {
    batch.set(doc(db, 'campaigns', camp.id), {
      ...camp,
      ownerUid,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const exp of INITIAL_DEMO_EXPENSES) {
    batch.set(doc(db, 'expenses', exp.id), {
      ...exp,
      ownerUid,
      createdAt: now,
    });
  }

  for (const mov of INITIAL_DEMO_MOVEMENTS) {
    batch.set(doc(db, 'stockMovements', mov.id), {
      ...mov,
      ownerUid,
      createdAt: now,
    });
  }

  for (const integ of INITIAL_INTEGRATIONS) {
    batch.set(doc(db, 'integrationSettings', integ.id), {
      ...integ,
      ownerUid,
      updatedAt: now,
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'batch-seed-demo-workspace');
  }
}

export async function clearDemoRecords(): Promise<number> {
  const collectionsWithDemo = [
    'products',
    'customers',
    'orders',
    'campaigns',
    'expenses',
    'stockMovements',
    'messagingCampaigns',
  ];
  let deleted = 0;
  for (const colName of collectionsWithDemo) {
    try {
      const snap = await getDocs(collection(db, colName));
      const batch = writeBatch(db);
      let countInBatch = 0;
      snap.forEach((docSnap) => {
        if (docSnap.data()?.isDemo === true) {
          batch.delete(docSnap.ref);
          countInBatch++;
          deleted++;
        }
      });
      if (countInBatch > 0) {
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, colName);
    }
  }
  return deleted;
}

export async function createDocWithTimestamps(
  colName: string,
  id: string,
  payload: Record<string, unknown>,
  includeUpdatedAt = true
): Promise<void> {
  try {
    const data: Record<string, unknown> = {
      ...payload,
      createdAt: serverTimestamp(),
    };
    if (includeUpdatedAt) {
      data.updatedAt = serverTimestamp();
    }
    await setDoc(doc(db, colName, id), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${colName}/${id}`);
  }
}

export async function updateDocWithTimestamp(
  colName: string,
  id: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await updateDoc(doc(db, colName, id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${colName}/${id}`);
  }
}

export async function removeDocById(colName: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, colName, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${colName}/${id}`);
  }
}
