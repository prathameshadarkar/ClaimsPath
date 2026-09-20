# ClaimPath

A healthcare claims investigation workspace by Prathamesh Adarkar. Connect a denial to supporting evidence, identify missing documents, prepare a reconsideration draft, and route it for human review.

## Included

- Eight application screens plus a project case-study page at `/project`.
- 30 authored claim scenarios and an external SMART Health IT FHIR R4 importer for three verified Synthetic patients.
- Document intake, evidence checks, editable drafts, review/approval, exports, and an audit trail.
- Browser-session workspaces persisted in PostgreSQL, including document contents and imported FHIR Bundles.
- A rules-based evidence assistant. Set an OpenAI API key to enable AI explanations grounded in retrieved facts.

## Stack

Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS · shadcn components · Recharts · PostgreSQL · FHIR R4.

The FHIR test calls the external sandbox and depends on its availability. Each test uses a separate browser session.

## Data provenance and scope

All patient data is synthetic. The original thirty claim scenarios are authored examples. Imported patient, encounter, condition, and procedure records come from Synthea through `https://r4.smarthealthit.org`; the importer checks allowlisted patient identifiers, Synthea provenance, and patient/encounter references. It preserves actual service dates and source resource links. The external API is a shared sandbox and may change or become unavailable.

Imported claim amounts, denial reasons, payer names, member IDs, and review targets are authored scenarios, not payer records returned by FHIR. Missing Coverage resources do not imply that a patient is uninsured. Evidence checks verify identifiers and document markers, not clinical sufficiency or medical necessity. Approval is an internal workflow state; exports are not submitted to an insurer. No real patient information should be uploaded.

## Reference documentation

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [PostgreSQL on Vercel](https://vercel.com/docs/postgres)
- [SMART Health IT](https://docs.smarthealthit.org/)
- [FHIR R4](https://hl7.org/fhir/R4/)
