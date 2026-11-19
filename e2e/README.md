# claimpath-e2e

Playwright end-to-end and API tests for **ClaimPath**, a Next.js / TypeScript
claims-investigation workspace.

Eleven tests across four categories. The suite is deliberately small: it targets the
rules that decide whether a claim can move forward, rather than clicking every
control on every screen.

```
tests/
  ui/happy-path.spec.ts          3 tests  core queue → evidence → submit → approve
  ui/negative-and-state.spec.ts  4 tests  guards, empty input, and the approval state rule
  api/workspace.spec.ts          2 tests  workspace contract and error semantics
  api/fhir.spec.ts               1 test   FHIR allow-list and its guard
  a11y/axe.spec.ts               1 test   axe scan across six screens
```

Current state: 11 passed, ~13s on a cold run (Playwright starts the app itself).
Verified stable with `--repeat-each=3` (33/33).

## Running it

This suite lives in `e2e/` and tests the ClaimPath app in the repository root
beside it. Prerequisites: Node 22.13+ (the app uses `node:sqlite`) and Google Chrome.

Install the app's dependencies once, from the repository root:

```bash
pnpm install --frozen-lockfile
```

Then, from `e2e/`:

```bash
npm install
```

```bash
npx playwright test
```

Playwright starts the ClaimPath dev server itself, in the app's documented
local-storage mode (`CLAIMPATH_LOCAL_STORAGE=1`), so no PostgreSQL instance and no
deployed environment is needed. The app directory defaults to the repository root,
so no path configuration is required.

No browser download is required either: the suite runs on the locally installed
Chrome via `channel: 'chrome'`. To use Playwright's own bundled Chromium instead, run
`npx playwright install chromium` and drop the `channel` line from
`playwright.config.ts`.

To test a different checkout, or a server you started yourself:

```bash
CLAIMPATH_APP_DIR=/path/to/ClaimPath npx playwright test
```

```bash
BASE_URL=http://localhost:3000 npx playwright test
```

The suite keeps its own `package.json` so its Playwright dependencies stay out of the
app's build. It is excluded from the app's `tsconfig.json` and `eslint.config.mjs` for
the same reason, and has its own `tsconfig.json`.

## Scope

### What IS covered

**Happy path — the core flow**

| Test | Asserts |
| --- | --- |
| Claims queue lists the portfolio and search narrows it | All 30 seeded scenarios load; search filters to one case; clicking through opens that case's workspace |
| Attaching the required document closes the evidence gap | Completeness goes 2/3 → 3/3 and the app's recommended next step changes from "request documentation" to "prepare a packet" |
| Draft → submit → approve | A documented case can be drafted, submitted, approved, and ends with export as its only remaining action |

**Negative and edge cases**

| Test | Asserts |
| --- | --- |
| Missing evidence cannot be submitted | The draft names the gap, the submit control stays disabled, and `POST /api/workspace` rejects the same submission with 400 — UI guard and server guard checked against the *same* workspace |
| Unsaved or empty draft cannot be submitted | Unsaved edits block submission; an empty saved draft keeps the case unsubmittable at both layers |
| Actions requiring input stay disabled | No document attachable before a file is chosen; a "request changes" decision needs a reason, and whitespace is not one |
| **Editing an approved draft invalidates the approval** | The case leaves the review inbox, the reviewer can no longer export the packet they approved, the author can submit again, and the audit trail records why |

**API** — via Playwright's `request` fixture, against ClaimPath's own routes

| Test | Asserts |
| --- | --- |
| `GET /api/workspace` contract | 200, JSON, HttpOnly session cookie, 30 well-formed claims in known statuses, plus two invariants: nothing is "In review"/"Approved" without a draft, and no document is orphaned from its claim |
| Unknown ids and bad input | Unknown claim → 404, unknown document → 404, unknown action → 400, oversized draft → 400, premature approval → 400, and **none of them 5xx** |
| `GET /api/fhir` allow-list | Exactly the three verified Synthea patients (not "at least three"), the upstream base URL is pinned, and an unknown or malformed patient id is refused with 400 by ClaimPath's own guard before any outbound request |

**Accessibility** — one axe-core scan over Overview, Claims queue, Claim workspace,
Evidence review, Appeal studio and Review & approval, against WCAG 2.0/2.1 A and AA.
Only **critical**-impact violations fail the test. Serious and moderate findings are
attached to the HTML report as `axe-findings.json` so they stay triageable without
blocking the build.

What the scan currently finds — the test passes, but not because the app is clean:

| Impact | Rule | Scope |
| --- | --- | --- |
| serious | `color-contrast` | 167 nodes across all six screens |
| serious | `aria-progressbar-name` | the evidence-checklist progress bar, on Evidence review |
| serious | `scrollable-region-focusable` | the draft preview pane, on Review & approval |

Zero critical violations, so the gate is green. The 167 contrast failures are a real
finding worth fixing; they are set below the failure threshold deliberately, because
a suite that fails on day one gets switched off rather than fixed.

### What is NOT covered, and why

**Cross-browser.** Chromium only. The app is standard React with no browser-specific
code, so a second engine would mostly re-run the same assertions for twice the
runtime. Firefox and WebKit belong in a nightly run, not in a ten-test suite.

**Authentication and authorisation.** There is nothing to test. ClaimPath has no user
accounts and no login: each browser gets an opaque HttpOnly session cookie and its own
seeded workspace. There are no roles, so "can a reviewer approve their own draft?" —
the question a real claims system would need tested hardest — has no implementation to
check. That the cookie is set and is HttpOnly is asserted; cross-session isolation and
privilege boundaries are not, because neither exists yet.

**Performance and load.** No page-load budgets, no concurrency testing. Playwright can
measure these but assertions on timing are environment-dependent and would make the
suite flaky on a laptop. The workspace is also a single JSON blob read and rewritten per
mutation, which is worth a load test later — it is a design question, not an e2e one.

**The non-deterministic LLM output.** One correction worth making: *appeal drafting is
not the LLM feature.* Drafts come from `makeDraft()`, a deterministic template, which is
why the happy-path test can assert their content exactly. The non-deterministic surface
is the **Copilot**, which calls the OpenAI API when a server-side key is configured and
otherwise falls back to a labelled rules-based mode.

The Copilot is untested here on purpose. Asserting on generated prose is either trivial
(the response is non-empty) or brittle (it contains some expected phrase). What it
actually needs is a labelled evaluation set — fixed question/case pairs with
human-graded expectations for groundedness, correct citation of the supplied source IDs,
and refusal to assert medical necessity or promise payment — scored as a pass rate over
a run, not as a boolean per assertion. That is an eval harness, not a Playwright test.
The suite runs with no `OPENAI_API_KEY`, so the Copilot stays in its deterministic mode
and makes no outbound calls.

**FHIR resource-level assertions (`resourceType`, R4 conformance).** ClaimPath is a
*consumer* of an external FHIR R4 server (SMART Health IT), not a FHIR server. It
exposes no FHIR resource endpoints of its own. Asserting `resourceType` on a real
resource would mean either pointing tests at `r4.smarthealthit.org` — a third-party
domain, out of bounds — or triggering a live import and making every run depend on a
public sandbox's uptime and contents. Both trade determinism for coverage that is not
ClaimPath's behaviour to begin with. What *is* ClaimPath's own logic — the allow-list,
the pinned upstream base URL, and the pre-flight guard — is tested without any network
call. The provenance checks that run during a live import (Synthea identifier match,
`CapabilityStatement` must be R4, cross-patient contamination rejection) are good logic
and currently unverified; they need a stubbed FHIR server to test properly.

**File upload path.** The evidence test uses the app's own built-in sample document. The
real `<input type="file">` path, and its validation (TXT/Markdown only, 100 KB cap,
rejection of empty files), is not exercised.

**Downloads and export.** Export buttons are asserted to be present and correctly gated,
but no download is intercepted and no exported packet, CSV or audit JSON is validated.

**Visual regression and the deployed environment.** No screenshot comparison. Everything
runs against a local dev server; the Vercel deployment and its PostgreSQL backend are
untested, so nothing here would catch a database or environment misconfiguration.

## Test data and isolation

No cleanup code, by design. ClaimPath keys each workspace to an HttpOnly session cookie,
so every Playwright browser context gets its own freshly seeded 30 claims. Tests mutate
state freely — approving packets, invalidating approvals — without touching each other
or any shared data. The API tests get their own session the same way.

Fixtures in `tests/helpers/app.ts` were read out of the app's `seed()` and re-verified
against a running server, so the specs name real cases rather than guessing at test data.

`workers: 1` is deliberate: in local-storage mode the app persists to a single-writer
SQLite file, so parallel workers would contend on it. Against PostgreSQL that limit does
not apply and `workers` can be raised.

Selectors are `getByRole` / `getByLabel` throughout — no CSS, no XPath.

Running the suite writes to `.data/workspaces.sqlite` in the repository root. That is
the app's own documented local-dev store, is safe to delete, and should not be
committed.

### One note on how the readiness gate was chosen

The first version of `waitForWorkspace()` waited on the sidebar's "Claims queue"
button. The suite passed — by luck. `getByRole` name matching is substring-based by
default, and the Overview screen also has an "Open claims queue" button, so the
locator matched two elements and should have been a strict-mode violation. It passed
only because the sidebar renders before the workspace fetch resolves, so the
assertion was satisfied on its first poll, before the second button existed. On a
faster machine or a warm cache it would have started failing for reasons that look
like a product bug.

The gate is now the footer text, which renders only inside the branch that requires a
resolved workspace and is unique across all eight screens. Worth stating plainly: a
green suite is not evidence that the assertions are sound.

## Defects and observations found while writing these tests

1. **`GET /api/fhir?patient=<unknown>` returned 502 — fixed.** A patient id that fails
   the allow-list is rejected before any outbound request, so it is a client error and
   belongs in the 4xx range. The route caught every throw from `fetchPatient()` into a
   single 502, which made caller mistakes indistinguishable from genuine upstream FHIR
   failures and would send an on-call engineer to the wrong system.

   Fixed in `app/api/fhir/route.ts` by checking the allow-list in the route before
   calling `fetchPatient()` and returning 400 with the same message. The 502 path is
   kept for real upstream faults (server unreachable, non-R4 `CapabilityStatement`,
   failed provenance), which is what it was for. `fetchPatient()` keeps its own
   allow-list guard, so the check is duplicated deliberately rather than moved.
   `tests/api/fhir.spec.ts` now asserts 400 for both an unknown and a malformed id.

2. **`originCheck` failures surface as 409 Conflict.** A rejected cross-origin request
   returns 409 (`POST /api/workspace` with a foreign `Origin`). 403 is the right code.
   Not asserted in the suite; noted here.

3. **The approval-invalidation rule returns a case to "Ready to draft", not "In
   review".** Editing an approved draft clears the approval and sends the case back to
   the *author's* queue. That is defensible — the draft changed, so the author should
   resubmit — but if the intent was "back to review", the implementation and the intent
   disagree. The test asserts the implemented behaviour. Worth settling which is correct
   before anyone writes a requirement around it.

4. **`POST /api/fhir` has a mismatched limit message.** The guard checks
   `claims.length >= 50` but the error reads "This supports up to 20 imported cases."
   Cosmetic, but the number a user is told is not the number enforced.
