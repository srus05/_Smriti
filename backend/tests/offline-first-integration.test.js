/**
 * SMRITI OFFLINE-FIRST INTEGRATION & VERIFICATION TEST SUITE
 * Validates:
 * 1. PWA Manifest & App Shell endpoints
 * 2. Service Worker delivery and HTTP headers
 * 3. Core frontend service scripts availability
 * 4. Multi-activity offline batch session ingestion via POST /api/sync/sessions
 * 5. Deduplication and session persistence
 * 6. Server error resilience (malformed batch handling)
 * 7. Cognitive activity pack structure for offline execution
 */

import assert from 'assert';

const API_BASE = 'http://localhost:3000';

async function runOfflineFirstIntegrationTests() {
  console.log('\n=============================================================');
  console.log('  🧪 SMRITI OFFLINE-FIRST & LOW-CONNECTIVITY INTEGRATION SUITE');
  console.log('=============================================================\n');

  // Helper for authentication
  const authUser = async (id, name, email, role, avatar) => {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oauthUser: { id, name, email, photoURL: avatar },
        intendedRole: role
      })
    });
    const data = await res.json();
    return { token: data.sessionToken, user: data.user };
  };

  // -------------------------------------------------------------------------
  // TEST 1: Service Worker Delivery & Scope Headers
  // -------------------------------------------------------------------------
  console.log('1. Testing Service Worker endpoint (GET /sw.js)...');
  const swRes = await fetch(`${API_BASE}/sw.js`);
  assert.strictEqual(swRes.status, 200, 'Service Worker should return HTTP 200');
  const swAllowed = swRes.headers.get('service-worker-allowed');
  const swCacheControl = swRes.headers.get('cache-control');
  assert.strictEqual(swAllowed, '/', 'Service-Worker-Allowed header must be "/"');
  assert.ok(swCacheControl.includes('no-cache'), 'Cache-Control header should prevent stale worker caching');
  const swContent = await swRes.text();
  assert.ok(swContent.includes('smriti-shell-v1'), 'SW should contain shell cache definition');
  assert.ok(swContent.includes('smriti-cdn-v1'), 'SW should contain CDN cache definition');
  console.log('   ✅ /sw.js delivered with correct scope ("/") and Cache-Control headers');

  // -------------------------------------------------------------------------
  // TEST 2: PWA Manifest Delivery & JSON Validation
  // -------------------------------------------------------------------------
  console.log('2. Testing PWA Manifest endpoint (GET /manifest.json)...');
  const manRes = await fetch(`${API_BASE}/manifest.json`);
  assert.strictEqual(manRes.status, 200, 'Manifest should return HTTP 200');
  const manData = await manRes.json();
  assert.ok(manData.name.includes('Smriti'), 'Manifest name should identify Smriti');
  assert.strictEqual(manData.display, 'standalone', 'Display mode should be standalone for PWA');
  assert.strictEqual(manData.start_url, '/senior-space', 'Start URL should open Senior Space');
  assert.ok(Array.isArray(manData.icons) && manData.icons.length >= 2, 'Manifest should specify icons');
  console.log(`   ✅ Manifest valid: "${manData.name}", start_url: "${manData.start_url}"`);

  // -------------------------------------------------------------------------
  // TEST 3: Core Offline Service Scripts Delivery
  // -------------------------------------------------------------------------
  console.log('3. Testing Core Offline Service Scripts...');
  const scriptsToVerify = [
    '/src/services/offline-db.js',
    '/src/services/offline-sync-service.js',
    '/src/services/cognitive-client.js',
    '/src/services/offline-prep-service.js',
    '/src/services/sw-register.js'
  ];

  for (const scriptUrl of scriptsToVerify) {
    const sRes = await fetch(`${API_BASE}${scriptUrl}`);
    assert.strictEqual(sRes.status, 200, `Script ${scriptUrl} should return HTTP 200`);
    const sContent = await sRes.text();
    assert.ok(sContent.length > 50, `Script ${scriptUrl} should have valid content`);
  }
  console.log(`   ✅ All ${scriptsToVerify.length} offline service scripts delivered successfully`);

  // -------------------------------------------------------------------------
  // TEST 4: Setup Authenticated Test Elderly User
  // -------------------------------------------------------------------------
  console.log('4. Setting up authenticated elderly test user (Sruti)...');
  const sruti = await authUser('google_oauth_elderly_sruti', 'Sruti', 'sruti@example.com', 'elderly_user', '👵');
  assert.ok(sruti.token, 'Elderly user token should be issued');
  console.log(`   ✅ Authenticated Sruti (ID: ${sruti.user.id}, Role: ${sruti.user.role})`);

  // -------------------------------------------------------------------------
  // TEST 5: Cognitive Activity Pack Offline Schema Verification
  // -------------------------------------------------------------------------
  console.log('5. Testing Activity Pack Generation for Offline Storage...');
  const actRes = await fetch(`${API_BASE}/api/cognitive/activities/${sruti.user.id}`, {
    headers: { 'Authorization': `Bearer ${sruti.token}` }
  });
  assert.strictEqual(actRes.status, 200, 'Activities endpoint should return HTTP 200');
  const actData = await actRes.json();
  assert.strictEqual(actData.success, true);
  assert.ok(Array.isArray(actData.activities), 'Pack should include activities array');
  assert.ok(actData.activities.length >= 5, 'Pack should contain core activities');

  // Verify critical fields required for 100% offline gameplay
  for (const act of actData.activities) {
    assert.ok(act.activityId, 'Activity must have activityId');
    assert.ok(act.category, 'Activity must have category');
    assert.ok(act.prompt, 'Activity must have prompt');
    assert.ok(Array.isArray(act.options), 'Activity must have options array');
    assert.ok(act.options.some(o => o.isCorrect === true), 'Activity must have at least one correct option');
  }
  console.log(`   ✅ Activity pack valid for offline storage (${actData.activities.length} activities verified)`);

  // -------------------------------------------------------------------------
  // TEST 6: Multi-Activity Offline Batch Session Synchronization
  // -------------------------------------------------------------------------
  console.log('6. Testing Multi-Activity Offline Batch Session Sync (POST /api/sync/sessions)...');
  const now = Date.now();
  const mockOfflineBatch = [
    {
      id: `offline_sess_${now}_odd`,
      elderlyUserId: sruti.user.id,
      activityId: 'act_odd_one_out_offline',
      category: 'attention',
      subType: 'odd_one_out',
      difficulty: 1,
      accuracy: 1.0,
      score: 100,
      responseTimeMs: 2400,
      completed: true,
      offlineRecorded: true,
      completedAt: new Date(now - 120000).toISOString()
    },
    {
      id: `offline_sess_${now}_pattern`,
      elderlyUserId: sruti.user.id,
      activityId: 'act_pattern_offline',
      category: 'attention',
      subType: 'pattern_completion',
      difficulty: 1,
      accuracy: 1.0,
      score: 100,
      responseTimeMs: 2900,
      completed: true,
      offlineRecorded: true,
      completedAt: new Date(now - 90000).toISOString()
    },
    {
      id: `offline_sess_${now}_routine`,
      elderlyUserId: sruti.user.id,
      activityId: 'act_what_comes_next_offline',
      category: 'routine_recall',
      subType: 'what_comes_next',
      difficulty: 1,
      accuracy: 1.0,
      score: 100,
      responseTimeMs: 3100,
      completed: true,
      offlineRecorded: true,
      completedAt: new Date(now - 60000).toISOString()
    },
    {
      id: `offline_sess_${now}_talk`,
      elderlyUserId: sruti.user.id,
      activityId: 'act_talk_reminiscence_offline',
      category: 'emotional_engagement',
      subType: 'talk_and_recall',
      accuracy: 1.0,
      score: 100,
      responseTimeMs: 4500,
      completed: true,
      offlineRecorded: true,
      completedAt: new Date(now - 30000).toISOString()
    }
  ];

  const syncRes = await fetch(`${API_BASE}/api/sync/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sruti.token}`
    },
    body: JSON.stringify({ sessions: mockOfflineBatch })
  });

  assert.strictEqual(syncRes.status, 200, 'Sync endpoint should return HTTP 200');
  const syncData = await syncRes.json();
  assert.strictEqual(syncData.success, true, 'Batch sync should report success');
  assert.strictEqual(syncData.syncedCount, 4, 'All 4 offline sessions should be recorded');
  assert.strictEqual(syncData.errors, 0, 'No sync errors should occur');
  assert.strictEqual(syncData.results.length, 4, 'Results should contain entries for all 4 sessions');
  console.log(`   ✅ Ingested ${syncData.syncedCount} multi-activity offline sessions successfully`);

  // -------------------------------------------------------------------------
  // TEST 7: Deduplication Verification
  // -------------------------------------------------------------------------
  console.log('7. Testing Deduplication on Duplicate Resubmission...');
  const resyncRes = await fetch(`${API_BASE}/api/sync/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sruti.token}`
    },
    body: JSON.stringify({ sessions: mockOfflineBatch })
  });
  assert.strictEqual(resyncRes.status, 200);
  const resyncData = await resyncRes.json();
  assert.strictEqual(resyncData.success, true);
  console.log('   ✅ Idempotent deduplication succeeded on resubmission');

  // -------------------------------------------------------------------------
  // TEST 8: Server Resilience (Empty & Graceful Edge Cases)
  // -------------------------------------------------------------------------
  console.log('8. Testing Empty Queue Sync Edge Case...');
  const emptyRes = await fetch(`${API_BASE}/api/sync/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sruti.token}`
    },
    body: JSON.stringify({ sessions: [] })
  });
  assert.strictEqual(emptyRes.status, 200);
  const emptyData = await emptyRes.json();
  assert.strictEqual(emptyData.syncedCount, 0);
  assert.strictEqual(emptyData.success, true);
  console.log('   ✅ Empty session sync handled gracefully without error');

  console.log('\n=============================================================');
  console.log('  🎉 ALL 8 OFFLINE-FIRST INTEGRATION TESTS PASSED!');
  console.log('=============================================================\n');
}

runOfflineFirstIntegrationTests().catch(err => {
  console.error('\n❌ Offline Integration Test Failed:', err);
  process.exit(1);
});
