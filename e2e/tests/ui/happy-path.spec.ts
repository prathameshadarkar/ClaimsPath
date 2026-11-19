import { test, expect } from '@playwright/test';
import { CASES, openCase, openView } from '../helpers/app';

test.describe('Happy path', () => {
  test('the claims queue lists the seeded portfolio and search narrows it to one case', async ({ page }) => {
    await openView(page, 'claims');

    // The panel heading carries the filtered count, so it doubles as the assertion
    // that all 30 seeded scenarios loaded.
    await expect(page.getByRole('heading', { name: 'All claims 30' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Open CP-/ })).toHaveCount(30);

    await page.getByRole('textbox', { name: 'Search claims' }).fill(CASES.readyToDraft.patient);

    await expect(page.getByRole('heading', { name: 'All claims 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Open ${CASES.readyToDraft.id}` })).toBeVisible();

    // Clicking through the queue is the app's primary entry point into a case,
    // so this is the one test that navigates by clicking rather than deep-linking.
    await page.getByRole('button', { name: `Open ${CASES.readyToDraft.id}` }).click();

    await expect(page).toHaveURL(new RegExp(`/workspace\\?case=${CASES.readyToDraft.id}$`));
    await expect(page.getByRole('heading', { name: 'Claim workspace', level: 1 })).toBeVisible();
    await expect(page.getByText(CASES.readyToDraft.patient).first()).toBeVisible();
  });

  test('attaching the required document closes the evidence gap and unblocks drafting', async ({ page }) => {
    const { id, required } = CASES.missingEvidence;

    // Before: the third completeness check fails and the app's recommendation is
    // to go and get the document, not to draft.
    await openCase(page, 'evidence', id);
    await expect(page.getByText('2 of 3 completeness checks passed')).toBeVisible();
    await expect(page.getByRole('heading', { name: `Request ${required.toLowerCase()} documentation` })).toBeVisible();
    await expect(page.getByRole('heading', { name: `${required} missing` })).toBeVisible();

    // Attach the app's own clearly-labelled sample document for this claim.
    await openCase(page, 'documents', id);
    await page.getByRole('button', { name: new RegExp(`Use sample ${required.toLowerCase()}`) }).click();
    await expect(page.getByText('Document saved. Evidence assessment updated.')).toBeVisible();

    // After: the gap is closed and the recommended next step has changed. This is
    // the behaviour that matters — the evidence assessment is re-derived, not a
    // flag someone set.
    await openCase(page, 'evidence', id);
    await expect(page.getByText('3 of 3 completeness checks passed')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prepare a reconsideration packet' })).toBeVisible();
    await expect(page.getByRole('heading', { name: `${required} attached` })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open appeal studio/ })).toBeVisible();
  });

  test('a documented case goes draft to submission to approval and becomes exportable', async ({ page }) => {
    const { id, patient } = CASES.readyToDraft;
    await openCase(page, 'appeals', id);

    const editor = page.getByRole('textbox', { name: 'Appeal draft' });
    await expect(editor).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Send for human review' })).toBeDisabled();

    await page.getByRole('button', { name: 'Generate draft' }).click();

    // The generated draft is the deterministic evidence template: it cites the
    // claim and confirms the evidence was found.
    await expect(editor).toHaveValue(/DRAFT — FOR HUMAN REVIEW/);
    await expect(editor).toHaveValue(new RegExp(id));
    await expect(editor).not.toHaveValue(/NOT YET VERIFIED/);
    await expect(page.getByText('Saved version')).toBeVisible();

    await page.getByRole('button', { name: 'Send for human review' }).click();

    // Submission hands the case to the reviewer screen, where a human decision
    // is the only way forward.
    await expect(page).toHaveURL(new RegExp(`/review\\?case=${id}$`));
    await expect(page.getByRole('heading', { name: patient, level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request changes' })).toBeVisible();

    await page.getByRole('button', { name: 'Approve packet' }).click();

    // Approval is terminal for the author: the decision buttons are replaced by
    // the export action.
    await expect(page.getByRole('button', { name: 'Export approved packet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve packet' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Request changes' })).toBeHidden();
  });
});
