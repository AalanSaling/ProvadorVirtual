// server/tests/phase2a_perfectcorp.test.ts
import assert from 'node:assert';
import { PerfectCorpTryOnProvider } from '../providers/PerfectCorpTryOnProvider.js';
import { TryOnInput } from '../types/index.js';

console.log('🧪 Starting Phase 2A Perfect Corp Unit Test Suite...\n');

async function runTests() {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.PERFECTCORP_API_KEY;
  const originalHost = process.env.PERFECTCORP_API_HOST;

  process.env.PERFECTCORP_API_KEY = 'test-perfectcorp-key';
  process.env.PERFECTCORP_API_HOST = 'https://yce-api-01.makeupar.com';

  const validInput: TryOnInput = {
    personImage: 'https://cdn.example.com/person_subject.jpg',
    garmentImage: 'https://cdn.example.com/garment_reference.jpg',
    garmentCategory: 'full_body',
    storeId: 'store-1',
    userId: 'user-1',
  };

  const createValidPngBuffer = (w = 1024, h = 768, seed = 'A') => {
    const buf = Buffer.alloc(48);
    buf.writeUInt8(0x89, 0); buf.writeUInt8(0x50, 1); buf.writeUInt8(0x4e, 2); buf.writeUInt8(0x47, 3);
    buf.writeUInt8(0x0d, 4); buf.writeUInt8(0x0a, 5); buf.writeUInt8(0x1a, 6); buf.writeUInt8(0x0a, 7);
    buf.writeUInt32BE(13, 8);
    buf.write('IHDR', 12);
    buf.writeUInt32BE(w, 16);
    buf.writeUInt32BE(h, 20);
    buf.write(seed.repeat(16), 24);
    return buf;
  };

  const personPngBuffer = createValidPngBuffer(1024, 768, 'P');
  const garmentPngBuffer = createValidPngBuffer(1024, 768, 'G');
  const resultPngBuffer = createValidPngBuffer(1024, 768, 'R');

  try {
    // Test 1: Authentication Missing / Unconfigured
    console.log('Test 1: Unconfigured API Key or Host');
    delete process.env.PERFECTCORP_API_KEY;
    const providerNoKey = new PerfectCorpTryOnProvider();
    const resAuthMissing = await providerNoKey.generateTryOn(validInput);
    assert.strictEqual(resAuthMissing.status, 'failed');
    assert.strictEqual(resAuthMissing.errorCode, 'PERFECTCORP_AUTH_ERROR');
    console.log('  ✅ Unconfigured API Key caught as PERFECTCORP_AUTH_ERROR');

    process.env.PERFECTCORP_API_KEY = 'test-perfectcorp-key';

    // Test 2: Payload Directions & Correct Header Mapping
    console.log('\nTest 2: Payload directions (src_file_url = personImage, ref_file_url = garmentImage)');
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('/s2s/v2.0/task/cloth-v3') && init?.method === 'POST') {
        capturedHeaders = init.headers;
        capturedBody = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ task_id: 'task-test-123' }), { status: 200 });
      }
      if (urlStr.includes('/s2s/v2.0/task/cloth-v3/task-test-123') && init?.method === 'GET') {
        return new Response(JSON.stringify({ status: 'SUCCESS', result_file_url: 'https://cdn.example.com/result.jpg' }), { status: 200 });
      }
      if (urlStr === 'https://cdn.example.com/result.jpg') {
        return new Response(resultPngBuffer, { status: 200 });
      }
      if (urlStr === 'https://cdn.example.com/person_subject.jpg') {
        return new Response(personPngBuffer, { status: 200 });
      }
      if (urlStr === 'https://cdn.example.com/garment_reference.jpg') {
        return new Response(garmentPngBuffer, { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    const mockStorageService: any = {
      saveResultImage: async (_buf: Buffer, filename: string) => `https://cdn.example.com/signed_${filename}`,
    };

    const providerSuccess = new PerfectCorpTryOnProvider(mockStorageService);
    const resSuccess = await providerSuccess.generateTryOn(validInput);

    assert.strictEqual(resSuccess.status, 'success');
    assert.strictEqual(capturedBody.src_file_url, 'https://cdn.example.com/person_subject.jpg');
    assert.strictEqual(capturedBody.ref_file_url, 'https://cdn.example.com/garment_reference.jpg');
    assert.strictEqual(capturedBody.garment_category, 'full_body');
    assert.strictEqual(capturedHeaders?.Authorization, 'Bearer test-perfectcorp-key');
    console.log('  ✅ Payload src_file_url = PESSOA and ref_file_url = ROUPA verified without inversion');

    // Test 3: HTTP 401 / 403 Authentication Rejection
    console.log('\nTest 3: HTTP 401 / 403 Authentication Error');
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('person_subject.jpg')) {
        return new Response(personPngBuffer, { status: 200 });
      }
      if (urlStr.includes('garment_reference.jpg')) {
        return new Response(garmentPngBuffer, { status: 200 });
      }
      return new Response('Unauthorized', { status: 401 });
    }) as typeof fetch;

    const res401 = await providerSuccess.generateTryOn(validInput);
    assert.strictEqual(res401.status, 'failed');
    assert.strictEqual(res401.errorCode, 'PERFECTCORP_AUTH_ERROR');
    console.log('  ✅ HTTP 401 caught as PERFECTCORP_AUTH_ERROR');

    // Test 4: HTTP 429 Rate Limit
    console.log('\nTest 4: HTTP 429 Rate Limit');
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('person_subject.jpg')) {
        return new Response(personPngBuffer, { status: 200 });
      }
      if (urlStr.includes('garment_reference.jpg')) {
        return new Response(garmentPngBuffer, { status: 200 });
      }
      return new Response('Rate limited', { status: 429 });
    }) as typeof fetch;

    const res429 = await providerSuccess.generateTryOn(validInput);
    assert.strictEqual(res429.status, 'failed');
    assert.strictEqual(res429.errorCode, 'PERFECTCORP_RATE_LIMITED');
    console.log('  ✅ HTTP 429 caught as PERFECTCORP_RATE_LIMITED');

    // Test 5: Engine Task Processing Failure (FAILED / ERROR status in polling)
    console.log('\nTest 5: Task Processing Failure');
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('person_subject.jpg')) {
        return new Response(personPngBuffer, { status: 200 });
      }
      if (urlStr.includes('garment_reference.jpg')) {
        return new Response(garmentPngBuffer, { status: 200 });
      }
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ task_id: 'task-failed-456' }), { status: 200 });
      }
      if (urlStr.includes('/s2s/v2.0/task/cloth-v3/task-failed-456')) {
        return new Response(JSON.stringify({ status: 'FAILED', error: 'Person face obstructed.' }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    const resFailed = await providerSuccess.generateTryOn(validInput);
    assert.strictEqual(resFailed.status, 'failed');
    assert.strictEqual(resFailed.errorCode, 'PERFECTCORP_TASK_FAILED');
    assert.ok(resFailed.errorMessage?.includes('Person face obstructed'));
    console.log('  ✅ Engine failure caught as PERFECTCORP_TASK_FAILED');

    // Test 6: Missing result URL in successful task response
    console.log('\nTest 6: Missing Result URL in Completed Task');
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('person_subject.jpg')) {
        return new Response(personPngBuffer, { status: 200 });
      }
      if (urlStr.includes('garment_reference.jpg')) {
        return new Response(garmentPngBuffer, { status: 200 });
      }
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ task_id: 'task-no-url-789' }), { status: 200 });
      }
      if (urlStr.includes('/s2s/v2.0/task/cloth-v3/task-no-url-789')) {
        return new Response(JSON.stringify({ status: 'SUCCESS' }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    const resNoUrl = await providerSuccess.generateTryOn(validInput);
    assert.strictEqual(resNoUrl.status, 'failed');
    assert.strictEqual(resNoUrl.errorCode, 'PERFECTCORP_TASK_FAILED');
    console.log('  ✅ Missing result URL caught as PERFECTCORP_TASK_FAILED');

    // Test 7: Invalid non-HTTP image URL
    console.log('\nTest 7: Invalid Non-HTTP Image URL');
    const invalidInput: TryOnInput = {
      ...validInput,
      personImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
    };
    const resInvalidImg = await providerSuccess.generateTryOn(invalidInput);
    assert.strictEqual(resInvalidImg.status, 'failed');
    assert.strictEqual(resInvalidImg.errorCode, 'PERFECTCORP_INVALID_IMAGE');
    console.log('  ✅ Non-HTTP image URL caught as PERFECTCORP_INVALID_IMAGE');

    // Test 8: Small dimensions (<512x384px) rejected
    console.log('\nTest 8: Small dimensions image (<512x384px) rejected');
    const tinyPngBuffer = createValidPngBuffer(200, 200, 'T');
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('person_subject.jpg')) {
        return new Response(tinyPngBuffer, { status: 200 });
      }
      return new Response(garmentPngBuffer, { status: 200 });
    }) as typeof fetch;

    const resSmallImg = await providerSuccess.generateTryOn(validInput);
    assert.strictEqual(resSmallImg.status, 'failed');
    assert.strictEqual(resSmallImg.errorCode, 'PERFECTCORP_INVALID_IMAGE');
    assert.ok(resSmallImg.errorMessage?.includes('inferiores ao mínimo exigido'));
    console.log('  ✅ Small image dimensions (<512x384px) caught as PERFECTCORP_INVALID_IMAGE');

    // Test 9: Oversize image (>10MB) rejected
    console.log('\nTest 9: Oversize image (>10MB) rejected');
    const hugeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('person_subject.jpg')) {
        return new Response(hugeBuffer, { status: 200 });
      }
      return new Response(garmentPngBuffer, { status: 200 });
    }) as typeof fetch;

    const resHugeImg = await providerSuccess.generateTryOn(validInput);
    assert.strictEqual(resHugeImg.status, 'failed');
    assert.strictEqual(resHugeImg.errorCode, 'PERFECTCORP_INVALID_IMAGE');
    assert.ok(resHugeImg.errorMessage?.includes('10 MB'));
    console.log('  ✅ Oversize image (>10MB) caught as PERFECTCORP_INVALID_IMAGE');

    console.log('\n🎉 ALL PHASE 2A PERFECT CORP UNIT TESTS PASSED SUCCESSFULLY!\n');

  } finally {
    globalThis.fetch = originalFetch;
    process.env.PERFECTCORP_API_KEY = originalApiKey;
    process.env.PERFECTCORP_API_HOST = originalHost;
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
