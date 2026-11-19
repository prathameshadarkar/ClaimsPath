import { test, expect } from '@playwright/test';
import { CASES, CLAIM_STATUSES } from '../helpers/app';

type Claim = {
  id: string; patient: string; member: string; payer: string;
  amount: number; status: string; required: string; draft: string;
};
type Doc = { id: string; claimId: string; name: string; kind: string };
type WorkspaceState = { claims: Claim[]; docs: Doc[]; events: { claimId: string; action: string }[] };

test.describe('API · workspace', () => {
  test('GET /api/workspace returns a seeded workspace that satisfies its own state rules', async ({ request }) => {
    const res = await request.get('/api/workspace');

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');

    // Each caller gets an isolated workspace behind an HttpOnly session cookie.
    // That is what lets this suite mutate state without touching anyone else's.
    const setCookie = res.headers()['set-cookie'] ?? '';
    expect(setCookie).toContain('claimpath_session=');
    expect(setCookie).toContain('HttpOnly');

    const state = (await res.json()) as WorkspaceState;
    expect(state.claims).toHaveLength(30);
    expect(state.docs.length).toBeGreaterThan(0);
    expect(state.events.length).toBeGreaterThan(0);

    // Every claim is well-formed and in a status the UI knows how to render.
    for (const claim of state.claims) {
      expect(claim.id).toMatch(/^CP-\d{4}$/);
      expect(claim.member).toMatch(/^SYN-\d{4}$/);
      expect(CLAIM_STATUSES).toContain(claim.status);
      expect(claim.amount).toBeGreaterThan(0);
    }

    // Invariant: a case cannot be awaiting or past review without a draft. This is
    // the seed honouring the same rule the submit endpoint enforces at runtime.
    const awaitingDecision = state.claims.filter((c) => ['In review', 'Approved'].includes(c.status));
    expect(awaitingDecision.length).toBeGreaterThan(0);
    for (const claim of awaitingDecision) {
      expect(claim.draft.trim(), `${claim.id} is "${claim.status}" with an empty draft`).not.toBe('');
    }

    // Invariant: no orphaned documents. Every document hangs off a real claim.
    const claimIds = new Set(state.claims.map((c) => c.id));
    for (const doc of state.docs) {
      expect(claimIds, `document ${doc.id} references unknown claim ${doc.claimId}`).toContain(doc.claimId);
    }

    // The fixtures the UI tests rely on are really in the seed.
    expect(state.claims.find((c) => c.id === CASES.approved.id)?.status).toBe('Approved');
    expect(state.claims.find((c) => c.id === CASES.missingEvidence.id)?.status).toBe('Missing evidence');
  });

  test('unknown ids and bad input are rejected as client errors, never as a 500', async ({ request }) => {
    // An unknown claim is a 404 against a valid route, not a crash.
    const unknownClaim = await request.post('/api/workspace', {
      data: { action: 'approve', claimId: 'CP-9999' },
    });
    expect(unknownClaim.status()).toBe(404);
    expect(await unknownClaim.json()).toMatchObject({ error: 'Claim not found' });

    // Same contract on the document endpoint.
    const unknownDoc = await request.get('/api/documents?id=00000000-0000-4000-8000-000000000000');
    expect(unknownDoc.status()).toBe(404);
    expect(await unknownDoc.json()).toMatchObject({ error: 'Document not found' });

    // An unrecognised action is refused rather than silently ignored.
    const unknownAction = await request.post('/api/workspace', {
      data: { action: 'definitely-not-an-action', claimId: CASES.missingEvidence.id },
    });
    expect(unknownAction.status()).toBe(400);
    expect(await unknownAction.json()).toMatchObject({ error: 'Unknown action' });

    // Oversized payloads are bounded at the edge (the route's limit is 20,000).
    const oversizedDraft = await request.post('/api/workspace', {
      data: { action: 'saveDraft', claimId: CASES.missingEvidence.id, text: 'x'.repeat(20_001) },
    });
    expect(oversizedDraft.status()).toBe(400);

    // Approving something that is not in review is a rule violation, not an error.
    const prematureApproval = await request.post('/api/workspace', {
      data: { action: 'approve', claimId: CASES.readyToDraft.id },
    });
    expect(prematureApproval.status()).toBe(400);

    // The point of the test: none of the above is a server fault.
    for (const res of [unknownClaim, unknownDoc, unknownAction, oversizedDraft, prematureApproval]) {
      expect(res.status(), `${res.url()} returned a 5xx for bad client input`).toBeLessThan(500);
    }
  });
});
