import { describe, it, expect, vi, afterEach } from 'vitest';
import { LinkIntimeAdapter } from '@/lib/services/allotment/linkintime.adapter';
import { KFintechAdapter } from '@/lib/services/allotment/kfintech.adapter';
import { BigshareAdapter } from '@/lib/services/allotment/bigshare.adapter';
import * as fx from './fixtures/registrars';

const json = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(...responses: Array<Response | Error>) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const PAN = 'ABCDE1234F';

describe('LinkIntime (MUFG Intime) adapter', () => {
  const a = new LinkIntimeAdapter();
  it('maps shares > 0 to ALLOTTED (XML inside a stringified wrapper)', async () => {
    mockFetch(json(fx.linkintimeAllotted));
    const r = await a.checkStatus('1234', PAN);
    expect(r.status).toBe('ALLOTTED');
    expect(r.sharesAllotted).toBe(78);
    expect(r.applicationNumber).toBe('1234567890');
  });
  it('maps zero shares to NOT_ALLOTTED', async () => {
    mockFetch(json(fx.linkintimeNotAllotted));
    expect((await a.checkStatus('1234', PAN)).status).toBe('NOT_ALLOTTED');
  });
  it('maps an empty record to NOT_ALLOTTED', async () => {
    mockFetch(json(fx.linkintimeEmpty));
    expect((await a.checkStatus('1234', PAN)).status).toBe('NOT_ALLOTTED');
  });
  it('handles a JSON string wrapper', async () => {
    mockFetch(json(fx.linkintimeJsonWrapped));
    const r = await a.checkStatus('1234', PAN);
    expect(r.status).toBe('ALLOTTED');
    expect(r.sharesAllotted).toBe(78);
  });
  it('falls back to manual verification on 403', async () => {
    mockFetch(new Response('Forbidden', { status: 403 }));
    const r = await a.checkStatus('1234', PAN);
    expect(r.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(r.errorCode).toBe('HTTP_ERROR');
  });
  it('falls back on timeout', async () => {
    const err = new Error('timed out');
    err.name = 'TimeoutError';
    mockFetch(err);
    const r = await a.checkStatus('1234', PAN);
    expect(r.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(r.errorCode).toBe('TIMEOUT');
  });
  it('falls back on an HTML / CAPTCHA body', async () => {
    mockFetch(new Response(fx.captchaHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }));
    const r = await a.checkStatus('1234', PAN);
    expect(r.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(r.errorCode).toBe('CAPTCHA_OR_HTML');
  });
  it('falls back on malformed JSON', async () => {
    mockFetch(json('{"d": [unterminated'));
    const r = await a.checkStatus('1234', PAN);
    expect(r.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(r.errorCode).toBe('MALFORMED_RESPONSE');
  });
});

describe('KFintech adapter', () => {
  it('parses an allotted record', async () => {
    mockFetch(json(fx.kfintechAllotted));
    const r = await new KFintechAdapter(() => 0.9).checkStatus('kf1', PAN);
    expect(r.status).toBe('ALLOTTED');
    expect(r.sharesAllotted).toBe(78);
    expect(r.sharesApplied).toBe(156);
  });
  it('parses a not-allotted record', async () => {
    mockFetch(json(fx.kfintechNotAllotted));
    expect((await new KFintechAdapter(() => 0.9).checkStatus('kf1', PAN)).status).toBe('NOT_ALLOTTED');
  });
  it('fails over to the second mirror once', async () => {
    const fetchFn = mockFetch(new Response('down', { status: 503 }), json(fx.kfintechAllotted));
    const r = await new KFintechAdapter(() => 0.9).checkStatus('kf1', PAN);
    expect(r.status).toBe('ALLOTTED');
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const hosts = fetchFn.mock.calls.map((c) => new URL(String(c[0])).host);
    expect(new Set(hosts).size).toBe(2);
  });
  it('falls back after both mirrors fail', async () => {
    const fetchFn = mockFetch(new Response('down', { status: 503 }), new Response(fx.captchaHtml, { status: 200 }));
    const r = await new KFintechAdapter(() => 0.1).checkStatus('kf1', PAN);
    expect(r.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('Bigshare adapter', () => {
  it('parses an allotted record', async () => {
    mockFetch(json(fx.bigshareAllotted));
    const r = await new BigshareAdapter().checkStatus('bs1', PAN);
    expect(r.status).toBe('ALLOTTED');
    expect(r.sharesAllotted).toBe(78);
  });
  it('treats a "not allotted" message as NOT_ALLOTTED', async () => {
    mockFetch(json(fx.bigshareNotFound));
    expect((await new BigshareAdapter().checkStatus('bs1', PAN)).status).toBe('NOT_ALLOTTED');
  });
});
