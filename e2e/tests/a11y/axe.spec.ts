import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CASES, VIEW, waitForWorkspace } from '../helpers/app';

/** The six screens a user actually works through, in workflow order. */
const SCREENS = [
  { name: 'Overview', path: VIEW.overview },
  { name: 'Claims queue', path: VIEW.claims },
  { name: 'Claim workspace', path: `${VIEW.workspace}?case=${CASES.missingEvidence.id}` },
  { name: 'Evidence review', path: `${VIEW.evidence}?case=${CASES.missingEvidence.id}` },
  { name: 'Appeal studio', path: `${VIEW.appeals}?case=${CASES.readyToDraft.id}` },
  { name: 'Review & approval', path: `${VIEW.review}?case=${CASES.inReview.id}` },
];

type Finding = { screen: string; id: string; impact: string; help: string; nodes: number };

test('no critical accessibility violations on the main screens', async ({ page }, testInfo) => {
  const all: Finding[] = [];

  for (const screen of SCREENS) {
    await page.goto(screen.path);
    await waitForWorkspace(page);

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    all.push(
      ...violations.map((v) => ({
        screen: screen.name,
        id: v.id,
        impact: v.impact ?? 'unknown',
        help: v.help,
        nodes: v.nodes.length,
      })),
    );
  }

  // The full result set is attached to the HTML report either way, so serious and
  // moderate findings stay visible and triageable without blocking the build.
  await testInfo.attach('axe-findings.json', {
    body: JSON.stringify(all, null, 2),
    contentType: 'application/json',
  });

  // The gate: only critical-impact violations fail the suite.
  const critical = all.filter((f) => f.impact === 'critical');
  expect(
    critical,
    `critical accessibility violations:\n${JSON.stringify(critical, null, 2)}`,
  ).toEqual([]);
});
