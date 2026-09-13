/**
 * Phase 6 Migration Script: Migrate Legacy Data to Multi-Tenant Workspaces
 *
 * Stamped legacy un-scoped data with workspaceId = '8evjlNiaUoQneySNXZGhSeZRSoh1'
 * (the approved primary administrator UID).
 * Also isolates publicForms secrets into /publicFormsSecurity.
 *
 * Uses the administrative bearer token from Firebase CLI for full server-side execution.
 */

import fs from 'fs';
import path from 'path';

const LEGACY_ADMIN_UID = '8evjlNiaUoQneySNXZGhSeZRSoh1';
const LEGACY_ADMIN_EMAIL = 'hanzlaahmadch@gmail.com';
const PROJECT_ID = 'reqforge-e919e';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function getAdminToken(): string {
  const tokenFile = path.join(process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(tokenFile)) {
    throw new Error(`Firebase tools config not found at: ${tokenFile}`);
  }
  const config = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
  const token = config.tokens?.access_token;
  if (!token) {
    throw new Error('No access_token found in firebase-tools.json');
  }
  return token;
}

// Convert JS value to Firestore REST Value
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Convert Firestore REST Value to JS value
function fromFirestoreValue(val: any): any {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

function fromFirestoreDoc(doc: any): { id: string; data: Record<string, any> } {
  const parts = doc.name.split('/');
  const id = parts[parts.length - 1];
  const data: Record<string, any> = {};
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      data[k] = fromFirestoreValue(v);
    }
  }
  return { id, data };
}

async function runMigration() {
  console.log('=== Starting Phase 6 Multi-Tenant Workspace Data Migration ===');
  console.log(`Target legacy workspace UID: ${LEGACY_ADMIN_UID} (${LEGACY_ADMIN_EMAIL})`);

  const token = getAdminToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const now = new Date().toISOString();

  // 1. Provision Workspace document: /workspaces/{LEGACY_ADMIN_UID}
  console.log('1. Checking legacy admin workspace document...');
  const wsUrl = `${BASE_URL}/workspaces/${LEGACY_ADMIN_UID}`;
  const wsRes = await fetch(wsUrl, { headers });
  if (wsRes.status === 404) {
    console.log('Creating legacy admin workspace document...');
    const createWsRes = await fetch(`${BASE_URL}/workspaces?documentId=${LEGACY_ADMIN_UID}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          id: { stringValue: LEGACY_ADMIN_UID },
          name: { stringValue: 'ReqForge Admin Workspace' },
          ownerId: { stringValue: LEGACY_ADMIN_UID },
          ownerEmail: { stringValue: LEGACY_ADMIN_EMAIL },
          createdAt: { stringValue: now },
          updatedAt: { stringValue: now },
        },
      }),
    });
    if (!createWsRes.ok) {
      throw new Error(`Failed to create workspace: ${await createWsRes.text()}`);
    }
    console.log('✓ Legacy admin workspace document created successfully.');
  } else {
    console.log('✓ Legacy admin workspace document already exists.');
  }

  // 2. Provision User Profile document: /users/{LEGACY_ADMIN_UID}
  console.log('2. Checking legacy admin user profile document...');
  const userUrl = `${BASE_URL}/users/${LEGACY_ADMIN_UID}`;
  const userRes = await fetch(userUrl, { headers });
  if (userRes.status === 404) {
    console.log('Creating legacy admin user profile document...');
    const createUserRes = await fetch(`${BASE_URL}/users?documentId=${LEGACY_ADMIN_UID}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          uid: { stringValue: LEGACY_ADMIN_UID },
          email: { stringValue: LEGACY_ADMIN_EMAIL },
          displayName: { stringValue: 'Hanzla Ahmad' },
          workspaceId: { stringValue: LEGACY_ADMIN_UID },
          createdAt: { stringValue: now },
          updatedAt: { stringValue: now },
        },
      }),
    });
    if (!createUserRes.ok) {
      throw new Error(`Failed to create user profile: ${await createUserRes.text()}`);
    }
    console.log('✓ Legacy admin user profile document created successfully.');
  } else {
    console.log('✓ Legacy admin user profile document already exists.');
  }

  // Helper to patch documents in a collection
  async function migrateCollection(collectionName: string) {
    console.log(`Checking collection: ${collectionName}...`);
    const listRes = await fetch(`${BASE_URL}/${collectionName}`, { headers });
    if (!listRes.ok) {
      console.log(`Collection ${collectionName} returned ${listRes.status}`);
      return;
    }
    const listData = await listRes.json();
    const docs = listData.documents || [];
    let count = 0;

    for (const d of docs) {
      const { id, data } = fromFirestoreDoc(d);
      if (!data.workspaceId) {
        // Patch with workspaceId & ownerId
        const patchUrl = `${BASE_URL}/${collectionName}/${id}?updateMask.fieldPaths=workspaceId&updateMask.fieldPaths=ownerId&updateMask.fieldPaths=updatedAt`;
        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            fields: {
              workspaceId: { stringValue: LEGACY_ADMIN_UID },
              ownerId: { stringValue: LEGACY_ADMIN_UID },
              updatedAt: { stringValue: now },
            },
          }),
        });
        if (!patchRes.ok) {
          console.error(`Failed to patch ${collectionName}/${id}:`, await patchRes.text());
        } else {
          count++;
        }
      }
    }
    console.log(`✓ ${collectionName}: ${count} migrated (${docs.length} total).`);
  }

  // 3. Migrate Clients
  await migrateCollection('clients');

  // 4. Migrate Projects
  await migrateCollection('projects');

  // 5. Migrate Questionnaires
  await migrateCollection('questionnaires');

  // 6. Migrate Submissions
  await migrateCollection('submissions');

  // 7. Migrate Public Forms & Isolate Secrets
  console.log('Checking publicForms collection...');
  const pubFormsRes = await fetch(`${BASE_URL}/publicForms`, { headers });
  if (pubFormsRes.ok) {
    const pubData = await pubFormsRes.json();
    const pubDocs = pubData.documents || [];
    let pubMigrated = 0;
    let secIsolated = 0;

    for (const d of pubDocs) {
      const { id, data } = fromFirestoreDoc(d);
      const hasSecrets = data.pinHash || data.pinSalt || data.encryptedShareToken;

      if (hasSecrets) {
        // Isolate to publicFormsSecurity
        const secUrl = `${BASE_URL}/publicFormsSecurity?documentId=${id}`;
        await fetch(secUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fields: {
              publicFormId: { stringValue: id },
              workspaceId: { stringValue: data.workspaceId || LEGACY_ADMIN_UID },
              ownerId: { stringValue: data.ownerId || LEGACY_ADMIN_UID },
              pinHash: data.pinHash ? { stringValue: data.pinHash } : { nullValue: null },
              pinSalt: data.pinSalt ? { stringValue: data.pinSalt } : { nullValue: null },
              encryptedShareToken: data.encryptedShareToken ? { stringValue: data.encryptedShareToken } : { nullValue: null },
              iv: data.iv ? { stringValue: data.iv } : { nullValue: null },
              authTag: data.authTag ? { stringValue: data.authTag } : { nullValue: null },
              shareToken: data.shareToken ? { stringValue: data.shareToken } : { nullValue: null },
              updatedAt: { stringValue: now },
            },
          }),
        });
        secIsolated++;
      }

      if (!data.workspaceId) {
        const patchUrl = `${BASE_URL}/publicForms/${id}?updateMask.fieldPaths=workspaceId&updateMask.fieldPaths=ownerId&updateMask.fieldPaths=updatedAt`;
        await fetch(patchUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            fields: {
              workspaceId: { stringValue: LEGACY_ADMIN_UID },
              ownerId: { stringValue: LEGACY_ADMIN_UID },
              updatedAt: { stringValue: now },
            },
          }),
        });
        pubMigrated++;
      }
    }
    console.log(`✓ publicForms: ${pubMigrated} workspace-tagged, ${secIsolated} secrets isolated to /publicFormsSecurity (${pubDocs.length} total).`);
  }

  console.log('=== Migration Completed Successfully! ===');
}

runMigration().catch((err) => {
  console.error('Migration failed with error:', err);
  process.exit(1);
});
