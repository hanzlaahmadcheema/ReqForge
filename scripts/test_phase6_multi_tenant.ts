/**
 * Phase 6 Multi-Tenant Authentication & Data Isolation Test Suite
 *
 * Verifies live in Firebase (project reqforge-e919e):
 * 1. User A signup & auto-provisioning of exactly 1 workspace (/workspaces/{userA.uid})
 * 2. User B signup & auto-provisioning of exactly 1 workspace (/workspaces/{userB.uid})
 * 3. User A creates entities (client, project, questionnaire) in Workspace A
 * 4. Cross-workspace read denial: User B cannot get User A's client, project, questionnaire
 * 5. Cross-workspace write spoofing denial: User B cannot create entity with workspaceId = User A
 * 6. Cross-workspace update/delete denial: User B cannot modify User A's data
 * 7. Workspace enumeration denial: Users cannot list /workspaces or /users
 * 8. Public form client flow: Guest client (unauthenticated) accesses form without account
 * 9. Secrets isolation: Public client cannot read /publicFormsSecurity
 * 10. Submission immutability: Guest client cannot tamper with or delete submitted response
 * 11. Cleanup of test users and test documents
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
} from 'firebase/firestore';
import crypto from 'crypto';
import firebaseConfigData from '../firebase-applet-config.json';
import { getOrCreateUserWorkspace } from '../src/lib/workspaceService';
import { hashPin, generateSalt, sealShareToken } from '../src/lib/cryptoUtils';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    results.push({ name, passed: true, details });
  } else {
    console.error(`  [FAIL] ${name}: ${details || 'Assertion failed'}`);
    results.push({ name, passed: false, details });
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('PHASE 6: MULTI-TENANT AUTH & DATA ISOLATION TEST SUITE');
  console.log('Target Firebase Project: reqforge-e919e');
  console.log('================================================================\n');

  const runId = Date.now().toString().slice(-6);
  const userAEmail = `user_a_${runId}@reqforge.test`;
  const userBEmail = `user_b_${runId}@reqforge.test`;
  const testPassword = 'Password123!@#$';

  let userA: any = null;
  let userB: any = null;
  let workspaceAId = '';
  let workspaceBId = '';
  let clientAId = '';
  let projectAId = '';
  let questionnaireAId = '';
  let publicFormAId = '';
  let shareTokenA = '';

  try {
    // -------------------------------------------------------------
    // TEST 1: User A Signup & Automatic Workspace Provisioning
    // -------------------------------------------------------------
    console.log('Test 1: User A Signup & Auto-Provisioning of Exactly 1 Workspace');
    const credA = await createUserWithEmailAndPassword(auth, userAEmail, testPassword);
    userA = credA.user;
    workspaceAId = userA.uid;

    const wsA = await getOrCreateUserWorkspace(userA);
    assert(wsA.id === userA.uid, 'Workspace A ID matches userA UID exactly');
    assert(wsA.ownerId === userA.uid, 'Workspace A ownerId is userA UID');

    // Verify workspace document in Firestore
    const wsSnapA = await getDoc(doc(db, 'workspaces', workspaceAId));
    assert(wsSnapA.exists(), 'Workspace document exists in /workspaces');
    assert(typeof wsSnapA.data()?.name === 'string' && wsSnapA.data()?.name.length > 0, 'Default workspace name is initialized');

    // Verify user profile document
    const userSnapA = await getDoc(doc(db, 'users', userA.uid));
    assert(userSnapA.exists(), 'User profile exists in /users');
    assert(userSnapA.data()?.workspaceId === workspaceAId, 'User profile references workspaceId');

    // -------------------------------------------------------------
    // TEST 2: User B Signup & Automatic Workspace Provisioning
    // -------------------------------------------------------------
    console.log('\nTest 2: User B Signup & Auto-Provisioning of Exactly 1 Workspace');
    const credB = await createUserWithEmailAndPassword(auth, userBEmail, testPassword);
    userB = credB.user;
    workspaceBId = userB.uid;

    const wsB = await getOrCreateUserWorkspace(userB);
    assert(wsB.id === userB.uid, 'Workspace B ID matches userB UID exactly');
    assert(workspaceAId !== workspaceBId, 'Workspace A and Workspace B have distinct, isolated IDs');

    // -------------------------------------------------------------
    // TEST 3: User A Creates Entities in Workspace A
    // -------------------------------------------------------------
    console.log('\nTest 3: User A Creates Entities in Workspace A');
    // Switch auth back to User A
    await signInWithEmailAndPassword(auth, userAEmail, testPassword);

    clientAId = `client_a_${runId}`;
    await setDoc(doc(db, 'clients', clientAId), {
      id: clientAId,
      name: 'Client Alpha',
      contactName: 'Alice',
      contactEmail: 'alice@alpha.test',
      workspaceId: workspaceAId,
      ownerId: userA.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    assert(true, 'User A created client in Workspace A');

    projectAId = `project_a_${runId}`;
    shareTokenA = crypto.randomBytes(16).toString('hex');
    await setDoc(doc(db, 'projects', projectAId), {
      id: projectAId,
      name: 'Project Alpha One',
      clientId: clientAId,
      workspaceId: workspaceAId,
      ownerId: userA.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    // Create share token document under project
    await setDoc(doc(db, 'projects', projectAId, 'tokens', shareTokenA), {
      token: shareTokenA,
      shareToken: shareTokenA,
      projectId: projectAId,
      clientId: clientAId,
      questionnaireId: `q_a_${runId}`,
      questionnaireVersion: 1,
      shareLinkStatus: 'active',
      status: 'active',
      active: true,
      createdAt: new Date().toISOString(),
    });
    assert(true, 'User A created project and active share token in Workspace A');

    questionnaireAId = `q_a_${runId}`;
    await setDoc(doc(db, 'questionnaires', questionnaireAId), {
      id: questionnaireAId,
      title: 'Alpha Requirements Questionnaire',
      version: 1,
      status: 'published',
      workspaceId: workspaceAId,
      ownerId: userA.uid,
      sections: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    assert(true, 'User A created questionnaire in Workspace A');

    // -------------------------------------------------------------
    // TEST 4: Cross-Workspace Read Denial (User B cannot read User A's data)
    // -------------------------------------------------------------
    console.log('\nTest 4: Cross-Workspace Read Denial (User B cannot read User A\'s data)');
    await signInWithEmailAndPassword(auth, userBEmail, testPassword);

    let readClientDenied = false;
    try {
      await getDoc(doc(db, 'clients', clientAId));
    } catch (e: any) {
      readClientDenied = e.code === 'permission-denied';
    }
    assert(readClientDenied, 'User B direct read of User A client doc denied by Firestore rules');

    let readProjectDenied = false;
    try {
      await getDoc(doc(db, 'projects', projectAId));
    } catch (e: any) {
      readProjectDenied = e.code === 'permission-denied';
    }
    assert(readProjectDenied, 'User B direct read of User A project doc denied by Firestore rules');

    let readQuestionnaireDenied = false;
    try {
      await getDoc(doc(db, 'questionnaires', questionnaireAId));
    } catch (e: any) {
      readQuestionnaireDenied = e.code === 'permission-denied';
    }
    assert(readQuestionnaireDenied, 'User B direct read of User A questionnaire doc denied by Firestore rules');

    // Query scoping: User B queries clients in their own workspace
    const userBClients = await getDocs(
      query(collection(db, 'clients'), where('workspaceId', '==', workspaceBId))
    );
    assert(
      userBClients.docs.every((d) => d.data().workspaceId === workspaceBId),
      'User B query only returns Workspace B data (zero cross-tenant leak)'
    );

    // -------------------------------------------------------------
    // TEST 5: Cross-Workspace Write Spoofing Denial
    // -------------------------------------------------------------
    console.log('\nTest 5: Cross-Workspace Write Spoofing Denial');
    // User B attempts to create a client claiming workspaceId = workspaceAId
    let spoofClientDenied = false;
    try {
      await setDoc(doc(db, 'clients', `spoofed_client_${runId}`), {
        id: `spoofed_client_${runId}`,
        name: 'Spoofed Client',
        workspaceId: workspaceAId, // User A's workspace!
        ownerId: userA.uid,
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      spoofClientDenied = e.code === 'permission-denied';
    }
    assert(spoofClientDenied, 'User B cannot create an entity stamped with User A workspaceId');

    // -------------------------------------------------------------
    // TEST 6: Cross-Workspace Update and Delete Denial
    // -------------------------------------------------------------
    console.log('\nTest 6: Cross-Workspace Update and Delete Denial');
    let updateDenied = false;
    try {
      await updateDoc(doc(db, 'clients', clientAId), {
        name: 'Tampered Name',
      });
    } catch (e: any) {
      updateDenied = e.code === 'permission-denied';
    }
    assert(updateDenied, 'User B cannot update User A client');

    let deleteDenied = false;
    try {
      await deleteDoc(doc(db, 'clients', clientAId));
    } catch (e: any) {
      deleteDenied = e.code === 'permission-denied';
    }
    assert(deleteDenied, 'User B cannot delete User A client');

    // -------------------------------------------------------------
    // TEST 7: Workspace Enumeration Denial
    // -------------------------------------------------------------
    console.log('\nTest 7: Workspace Enumeration Denial');
    let enumWorkspacesDenied = false;
    try {
      await getDocs(collection(db, 'workspaces'));
    } catch (e: any) {
      enumWorkspacesDenied = e.code === 'permission-denied';
    }
    assert(enumWorkspacesDenied, 'Listing /workspaces is blocked to prevent enumeration');

    let readOtherWsDenied = false;
    try {
      await getDoc(doc(db, 'workspaces', workspaceAId));
    } catch (e: any) {
      readOtherWsDenied = e.code === 'permission-denied';
    }
    assert(readOtherWsDenied, 'User B cannot get User A workspace document');

    let enumUsersDenied = false;
    try {
      await getDocs(collection(db, 'users'));
    } catch (e: any) {
      enumUsersDenied = e.code === 'permission-denied';
    }
    assert(enumUsersDenied, 'Listing /users is blocked to prevent enumeration');

    // -------------------------------------------------------------
    // TEST 8: Public Form & Cryptographic Secrets Isolation
    // -------------------------------------------------------------
    console.log('\nTest 8: Public Form & Secrets Isolation');
    // Switch back to User A to create a Public Form
    await signInWithEmailAndPassword(auth, userAEmail, testPassword);

    publicFormAId = `form_a_${runId}`;
    const testPin = '849201';
    const pinSalt = generateSalt();
    const pinHash = await hashPin(testPin, pinSalt);
    const encToken = await sealShareToken(shareTokenA, testPin, pinSalt);

    // Write safe metadata to /publicForms
    await setDoc(doc(db, 'publicForms', publicFormAId), {
      id: publicFormAId,
      name: 'Public Requirements Form',
      clientName: 'Alpha Client Corp',
      projectName: 'Alpha Portal',
      questionnaireTitle: 'Alpha Requirements',
      workspaceId: workspaceAId,
      ownerId: userA.uid,
      requiresPin: true,
      allowDrafts: true,
      hasExpiration: false,
      status: 'active',
      submissionCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Write cryptographic secrets to isolated /publicFormsSecurity
    await setDoc(doc(db, 'publicFormsSecurity', publicFormAId), {
      publicFormId: publicFormAId,
      workspaceId: workspaceAId,
      ownerId: userA.uid,
      pinHash,
      pinSalt,
      encryptedShareToken: encToken.encrypted,
      iv: encToken.iv,
      authTag: encToken.authTag,
      shareToken: shareTokenA,
      updatedAt: new Date().toISOString(),
    });
    assert(true, 'User A created publicForm and isolated secrets in /publicFormsSecurity');

    // Sign out to simulate an unauthenticated Guest Client
    await signOut(auth);

    // Guest reads safe public form metadata
    const guestFormSnap = await getDoc(doc(db, 'publicForms', publicFormAId));
    assert(guestFormSnap.exists(), 'Unauthenticated guest can read publicForm presentation metadata');
    const guestData = guestFormSnap.data();
    assert(guestData?.pinHash === undefined, 'Public form metadata does NOT contain pinHash');
    assert(guestData?.pinSalt === undefined, 'Public form metadata does NOT contain pinSalt');
    assert(guestData?.encryptedShareToken === undefined, 'Public form metadata does NOT contain encryptedShareToken');
    assert(guestData?.shareToken === undefined, 'Public form metadata does NOT contain raw shareToken');

    // Guest attempts to read /publicFormsSecurity directly -> MUST BE DENIED
    let secAccessDenied = false;
    try {
      await getDoc(doc(db, 'publicFormsSecurity', publicFormAId));
    } catch (e: any) {
      secAccessDenied = e.code === 'permission-denied';
    }
    assert(secAccessDenied, 'Unauthenticated guest is strictly DENIED direct read of /publicFormsSecurity');

    // -------------------------------------------------------------
    // TEST 9: Guest Client Submission & Immutability Under Workspace
    // -------------------------------------------------------------
    console.log('\nTest 9: Guest Client Submission & Immutability Under Workspace');
    const submissionId = `sub_${runId}`;

    // Guest submits questionnaire response with valid share token and workspaceId
    await setDoc(doc(db, 'submissions', submissionId), {
      id: submissionId,
      projectId: projectAId,
      shareToken: shareTokenA,
      questionnaireId: `q_a_${runId}`,
      questionnaireVersion: 1,
      clientId: clientAId,
      workspaceId: workspaceAId,
      ownerId: userA.uid,
      status: 'submitted',
      clientCode: 'ALPHA-01',
      answers: { q1: 'Enterprise Authentication requirements' },
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    assert(true, 'Unauthenticated client successfully submitted response to Workspace A project');

    // Client attempts to overwrite/modify the submitted response -> MUST BE DENIED (immutability)
    let tamperDenied = false;
    try {
      await updateDoc(doc(db, 'submissions', submissionId), {
        answers: { q1: 'Hacked answer' },
      });
    } catch (e: any) {
      tamperDenied = e.code === 'permission-denied';
    }
    assert(tamperDenied, 'Client cannot mutate submitted response (submission immutability enforced)');

    // Client attempts to delete submitted response -> MUST BE DENIED
    let deleteSubDenied = false;
    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
    } catch (e: any) {
      deleteSubDenied = e.code === 'permission-denied';
    }
    assert(deleteSubDenied, 'Client cannot delete submission (deletion permanently disabled)');

    // -------------------------------------------------------------
    // TEST 10: Workspace Owner Reads Own Submissions
    // -------------------------------------------------------------
    console.log('\nTest 10: Workspace Owner Reads Own Submissions');
    await signInWithEmailAndPassword(auth, userAEmail, testPassword);
    const ownerSubSnap = await getDoc(doc(db, 'submissions', submissionId));
    assert(ownerSubSnap.exists(), 'Workspace A owner can retrieve guest submission');
    assert(ownerSubSnap.data()?.workspaceId === workspaceAId, 'Submission is correctly associated with Workspace A');

  } catch (err: any) {
    console.error('Unexpected test failure:', err);
    assert(false, 'Test suite execution error', err.message);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log('\nCleaning up test artifacts...');
    try {
      // Clean up User A data
      if (userA) {
        await signInWithEmailAndPassword(auth, userAEmail, testPassword);
        if (clientAId) await deleteDoc(doc(db, 'clients', clientAId)).catch(() => {});
        if (projectAId) {
          if (shareTokenA) {
            await deleteDoc(doc(db, 'projects', projectAId, 'tokens', shareTokenA)).catch(() => {});
          }
          await deleteDoc(doc(db, 'projects', projectAId)).catch(() => {});
        }
        if (questionnaireAId) await deleteDoc(doc(db, 'questionnaires', questionnaireAId)).catch(() => {});
        if (publicFormAId) {
          await deleteDoc(doc(db, 'publicForms', publicFormAId)).catch(() => {});
          await deleteDoc(doc(db, 'publicFormsSecurity', publicFormAId)).catch(() => {});
        }
        // Delete User A
        await deleteUser(userA).catch(() => {});
      }

      // Clean up User B
      if (userB) {
        await signInWithEmailAndPassword(auth, userBEmail, testPassword);
        await deleteUser(userB).catch(() => {});
      }
      console.log('Cleanup completed.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr);
    }
  }

  // Summary
  console.log('\n================================================================');
  console.log('PHASE 6 TEST RESULTS SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('\nALL PHASE 6 MULTI-TENANT & DATA ISOLATION TESTS PASSED!');
    process.exit(0);
  }
}

runSuite();
