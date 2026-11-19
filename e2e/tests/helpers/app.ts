import { expect, type Page } from '@playwright/test';

/** The eight ClaimPath screens, by their route. Overview is mounted at `/`. */
export const VIEW = {
  overview: '/',
  claims: '/claims',
  workspace: '/workspace',
  documents: '/documents',
  evidence: '/evidence',
  appeals: '/appeals',
  review: '/review',
  analytics: '/analytics',
} as const;

export type View = keyof typeof VIEW;

/**
 * Seeded scenario cases, read from the app's own `seed()` in lib/claims.ts and
 * re-verified against a running server. The seed is deterministic, so these are
 * stable fixtures rather than assumptions about test data.
 */
export const CASES = {
  /** No required evidence attached: every "ready" gate should refuse it. */
  missingEvidence: { id: 'CP-1001', patient: 'Maya Chen', required: 'Referral' },
  /** Evidence present, no draft yet: the entry point for the submission flow. */
  readyToDraft: { id: 'CP-1013', patient: 'Mia Thompson', required: 'Referral' },
  /** Already submitted, awaiting a human decision. */
  inReview: { id: 'CP-1021', patient: 'Abigail Walker' },
  /** Already approved, with a saved draft: the subject of the state rule. */
  approved: { id: 'CP-1026', patient: 'Jack Wright', required: 'Authorization' },
} as const;

/** The three Synthea patients the FHIR importer will accept. */
export const ALLOWED_FHIR_PATIENTS = [
  { id: '7b9146b3-8b1b-4cf9-af36-530d8c4fcf05', name: 'Theola Stoltenberg' },
  { id: 'b91edab6-1db2-46e5-b074-d089e6fb5626', name: 'Tasha Miller' },
  { id: '3e757f52-60a6-49c0-972c-c9339605a836', name: 'Trent Donnelly' },
] as const;

export const CLAIM_STATUSES = ['Missing evidence', 'Ready to draft', 'In review', 'Approved'];

/**
 * The workspace is client-fetched, so every navigation renders a loading state
 * first. Gate on it once here instead of scattering waits through the tests.
 *
 * The footer is the gate because it renders only inside the branch that requires
 * a resolved workspace, and its text is unique across all eight screens. The
 * sidebar is a poor gate: it renders immediately, before any data arrives, so
 * waiting on it would let assertions run against a half-rendered page.
 */
export async function waitForWorkspace(page: Page): Promise<void> {
  await expect(page.getByText('ClaimPath · Evidence before action.')).toBeVisible();
}

/** Deep-link to a screen with a case selected, the way the app's own links do. */
export async function openCase(page: Page, view: View, claimId: string): Promise<void> {
  await page.goto(`${VIEW[view]}?case=${encodeURIComponent(claimId)}`);
  await waitForWorkspace(page);
}

/** Open a screen with no case selected. */
export async function openView(page: Page, view: View): Promise<void> {
  await page.goto(VIEW[view]);
  await waitForWorkspace(page);
}
