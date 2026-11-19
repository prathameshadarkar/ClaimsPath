import { test, expect } from '@playwright/test';
import { CASES, openCase } from '../helpers/app';

test.describe('Negative and edge cases', () => {
  test('a case with missing evidence cannot be submitted, in the UI or through the API', async ({ page }) => {
    const { id, required } = CASES.missingEvidence;
    await openCase(page, 'appeals', id);

    await page.getByRole('button', { name: 'Generate draft' }).click();

    // A draft can always be produced, but it names the gap instead of hiding it.
    const editor = page.getByRole('textbox', { name: 'Appeal draft' });
    await expect(editor).toHaveValue(/NOT YET VERIFIED/);
    await expect(page.getByText(`${required} evidence present`)).toBeVisible();

    // Having a draft is not enough: the readiness gate still refuses.
    await expect(page.getByRole('button', { name: 'Send for human review' })).toBeDisabled();

    // The same rule is enforced server-side. `page.request` reuses this browser's
    // session cookie, so this hits the very workspace the UI is showing — which is
    // what makes the two assertions comparable rather than two separate stories.
    const res = await page.request.post('/api/workspace', {
      data: { action: 'submit', claimId: id },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({
      error: 'Verify required evidence and generate a draft first.',
    });
  });

  test('the appeal cannot be submitted with unsaved or empty draft text', async ({ page }) => {
    const { id } = CASES.readyToDraft;
    await openCase(page, 'appeals', id);

    const editor = page.getByRole('textbox', { name: 'Appeal draft' });
    const submit = page.getByRole('button', { name: 'Send for human review' });
    const save = page.getByRole('button', { name: 'Save draft' });

    await page.getByRole('button', { name: 'Generate draft' }).click();
    await expect(page.getByText('Saved version')).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(save).toBeDisabled();

    // Unsaved edits: the reviewer must not receive text the author has not committed.
    await editor.fill('Locally edited appeal text that was never saved.');
    await expect(page.getByText('Unsaved edits')).toBeVisible();
    await expect(page.getByText('Save your edits before submitting.')).toBeVisible();
    await expect(submit).toBeDisabled();
    await expect(save).toBeEnabled();

    // Empty required field: saving an empty draft leaves the case unsubmittable
    // rather than sending an empty packet forward.
    await editor.fill('');
    await save.click();
    await expect(submit).toBeDisabled();

    const res = await page.request.post('/api/workspace', { data: { action: 'submit', claimId: id } });
    expect(res.status()).toBe(400);
  });

  test('actions that require input stay disabled until the input is given', async ({ page }) => {
    // Document intake: nothing can be attached before a file is chosen.
    await openCase(page, 'documents', CASES.missingEvidence.id);
    await expect(page.getByRole('button', { name: /Attach and check evidence/ })).toBeDisabled();

    // Review: a "request changes" decision must carry a reason for the author.
    await openCase(page, 'review', CASES.inReview.id);
    await page.getByRole('button', { name: 'Request changes' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Request changes' })).toBeVisible();

    const returnToAuthor = dialog.getByRole('button', { name: 'Return to author' });
    await expect(returnToAuthor).toBeDisabled();

    // Whitespace is not a reason.
    await dialog.getByRole('textbox').fill('   ');
    await expect(returnToAuthor).toBeDisabled();

    await dialog.getByRole('textbox').fill('Please cite the itemised record explicitly.');
    await expect(returnToAuthor).toBeEnabled();
  });
});

test.describe('State transition rules', () => {
  /**
   * The rule under test: once a packet is approved, editing its draft must
   * invalidate that approval. Nothing here reads a status badge — the test
   * checks the consequences a user would actually notice.
   *
   * Note on the implemented behaviour: the app returns the case to
   * "Ready to draft" (the author's queue), not to "In review". See README.
   */
  test('editing an approved draft invalidates the approval and returns the case to the author', async ({ page }) => {
    const { id, patient } = CASES.approved;

    // Precondition: the case is approved, sitting in the review inbox, and its
    // only remaining action is export.
    await openCase(page, 'review', id);
    await expect(page.getByRole('button', { name: new RegExp(id) })).toBeVisible();
    await expect(page.getByRole('heading', { name: patient, level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export approved packet' })).toBeVisible();

    // Edit the approved draft and save it.
    await openCase(page, 'appeals', id);
    const editor = page.getByRole('textbox', { name: 'Appeal draft' });
    await expect(editor).not.toHaveValue('');
    await expect(page.getByText('Saved version')).toBeVisible();

    await editor.fill('Revised reconsideration wording for the approved packet.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Saved version')).toBeVisible();

    // Consequence 1: the case is back in the author's hands and submittable again,
    // which it would not be if it were still approved.
    await expect(page.getByRole('button', { name: 'Send for human review' })).toBeEnabled();

    // Consequence 2: it has left the review inbox entirely, and the reviewer can
    // no longer export the packet they approved.
    await openCase(page, 'review', id);
    await expect(page.getByRole('button', { name: new RegExp(id) })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export approved packet' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Select a packet to review' })).toBeVisible();

    // Consequence 3: the invalidation is recorded in the audit trail, so the lost
    // approval is explainable after the fact.
    await openCase(page, 'analytics', id);
    await expect(
      page.getByRole('cell', { name: /previous approval or review invalidated by editing/ }),
    ).toBeVisible();
  });
});
