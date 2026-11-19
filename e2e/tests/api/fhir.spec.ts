import { test, expect } from '@playwright/test';
import { ALLOWED_FHIR_PATIENTS } from '../helpers/app';

/**
 * ClaimPath is a *client* of an external FHIR R4 server (SMART Health IT), not a
 * FHIR server itself. The endpoint below is the part of that integration that is
 * ClaimPath's own: the allow-list it publishes and the guard it applies before
 * any outbound request. Both assertions here complete without the app contacting
 * r4.smarthealthit.org, which is why they are deterministic.
 *
 * What is deliberately not tested here is covered in the README's Scope section.
 */
test.describe('API · FHIR integration', () => {
  test('GET /api/fhir publishes only the allow-listed synthetic patients and refuses anything else', async ({
    request,
  }) => {
    const res = await request.get('/api/fhir');
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { patients: { id: string; name: string }[]; source: string };

    // The allow-list is exactly three verified Synthea patients — not "at least".
    // An extra entry here would mean an un-reviewed patient became importable.
    expect(body.patients).toHaveLength(ALLOWED_FHIR_PATIENTS.length);
    expect(body.patients.map((p) => p.id).sort()).toEqual(
      ALLOWED_FHIR_PATIENTS.map((p) => p.id).sort(),
    );
    expect(body.patients.map((p) => p.name).sort()).toEqual(
      ALLOWED_FHIR_PATIENTS.map((p) => p.name).sort(),
    );

    // The upstream server is pinned, so an import cannot be redirected elsewhere.
    expect(body.source).toBe('https://r4.smarthealthit.org');

    // A well-formed but non-allow-listed patient id is refused by ClaimPath's own
    // guard, before any request leaves the app. That makes it a client error, so it
    // must be reported as 4xx: a 5xx here would send someone investigating the
    // upstream FHIR server for a mistake the caller made.
    const rejected = await request.get('/api/fhir?patient=00000000-0000-4000-8000-000000000000');
    expect(rejected.status()).toBe(400);
    expect(await rejected.json()).toMatchObject({
      error: 'Select a patient from the verified synthetic list.',
    });

    // A malformed id takes the same path.
    const malformed = await request.get('/api/fhir?patient=not-a-uuid');
    expect(malformed.status()).toBe(400);
  });
});
