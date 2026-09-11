# ClaimPath

A healthcare claims investigation workspace by Prathamesh Adarkar. Connect a denial to supporting evidence, identify missing documents, prepare a reconsideration draft, and route it for human review.

## Included

- Eight application screens plus a project case-study page at `/project`.
- Thirty authored claim scenarios and an external SMART Health IT FHIR R4 importer for three verified Synthea patients.
- Document intake (TXT/Markdown up to 100 KB), evidence checks, editable drafts, review/approval, exports, and an audit trail.
- Browser-session workspaces persisted in PostgreSQL, including document contents and imported FHIR Bundles.
- A rules-based evidence assistant. Set an OpenAI API key to enable AI explanations grounded in retrieved facts.

## Stack

Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS · shadcn components · Recharts · PostgreSQL · FHIR R4.

This is a standalone Vercel edition. It has no Cloudflare, ChatGPT Sites, D1, or R2 dependency. GitHub hosts the source; Vercel runs the application and its API routes. GitHub Pages cannot run this backend.

## Deploy from GitHub to Vercel

1. Create a GitHub repository, then upload **the contents of this folder** at the repository root. Include `package.json`, `pnpm-lock.yaml`, `app/`, `lib/`, `public/`, and the other configuration files. Never upload `.env.local`, `node_modules`, `.next`, or `.data`.
2. In Vercel, choose **Add New → Project**, import that repository, and use the **Next.js** framework preset with Node.js **22.x**. The included settings provide the build command and API duration.
3. Connect a PostgreSQL database through Vercel's Storage/Marketplace, such as Neon, or use an existing PostgreSQL provider. Set the provider's pooled connection string as `DATABASE_URL` in Vercel for Production and Preview. Keep the provider's SSL parameters; use its recommended connection URL.
4. Initialize the database once. Either run the SQL below in the provider's SQL editor, or set the same `DATABASE_URL` in local `.env.local` and run `pnpm db:setup`.
5. Optionally set `OPENAI_API_KEY` and `OPENAI_MODEL` (defaults to `gpt-4.1-mini`) in Vercel. Without a key, the evidence assistant still works through explicit rules. API usage is billed to the key owner.
6. Deploy or redeploy after the environment variables and table are ready. Visit `/claims`, open a case, and try the import and review workflows.

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL
);
```

Each browser receives an opaque, HttpOnly session cookie. There are no user accounts or cross-device login. A different browser creates a separate workspace. Concurrent edits are guarded by a version check. The reset action replaces the current session's saved state. If you enable a paid AI key for a publicly accessible app, use Vercel Deployment Protection or add authentication and quotas before inviting unrestricted traffic.

## Run locally

Install Node.js 22.13 or newer (22.x recommended) and pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

For PostgreSQL, fill in `DATABASE_URL`, run `pnpm db:setup`, then `pnpm dev`.

For a local preview without setting up a database, set `CLAIMPATH_LOCAL_STORAGE=1` in `.env.local`, then run `pnpm dev`. This stores state in `.data/workspaces.sqlite` using Node's built-in SQLite. The local option is explicitly disabled on Vercel; hosted persistence always requires PostgreSQL. Never commit the local database.

```sh
pnpm build
pnpm start
```

## Verification

The Next.js production build and workflow checks were verified locally using the local SQLite option. A hosted PostgreSQL connection and a Vercel deployment have not been provisioned or tested in this export. The GitHub Actions workflow builds every push and pull request. For API workflow checks, start the application first:

```sh
CLAIMPATH_TEST_URL=http://localhost:3000 python3 tests/workflow.py
CLAIMPATH_TEST_URL=http://localhost:3000 python3 tests/fhir_workflow.py
```

The FHIR test calls the external sandbox and depends on its availability. Each test uses a separate browser session.

## Data provenance and scope

All patient data is synthetic. The original thirty claim scenarios are authored examples. Imported patient, encounter, condition, and procedure records come from Synthea through `https://r4.smarthealthit.org`; the importer checks allowlisted patient identifiers, Synthea provenance, and patient/encounter references. It preserves actual service dates and source resource links. The external API is a shared sandbox and may change or become unavailable.

Imported claim amounts, denial reasons, payer names, member IDs, and review targets are authored scenarios, not payer records returned by FHIR. Missing Coverage resources do not imply that a patient is uninsured. Evidence checks verify identifiers and document markers, not clinical sufficiency or medical necessity. Approval is an internal workflow state; exports are not submitted to an insurer. No real patient information should be uploaded.

## Reference documentation

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [PostgreSQL on Vercel](https://vercel.com/docs/postgres)
- [SMART Health IT](https://docs.smarthealthit.org/)
- [FHIR R4](https://hl7.org/fhir/R4/)

## Deployment status

This export is ready for your own GitHub repository and Vercel project. No repository, cloud database, or Vercel project has been created by the export. Existing data from the ChatGPT-hosted version is not migrated; this version initializes new workspaces.
