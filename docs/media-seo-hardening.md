# Media, public indexing and browser regression notes

## Operational boundary

This change does not deploy, migrate a production database, run a backfill, or alter PR135.
An operator must verify the configured public origin, storage origin, quotas and migration
in a disposable environment before release. No production credentials are needed for
the offline backfill below.

Dependency integration retains Next 15.5.24, sharp 0.35 and nodemailer 8.0.11.
Nodemailer 9 is not forced because Auth.js beta32's supported peer range excludes
it. Retaining the compatible version is not a claim that every advisory is resolved:
residual dependency risk requires separate release acceptance or a compatible
Auth.js upgrade, not a peer-dependency override.

## Media budgets and ownership

- Both upload routes reject inactive/deletion-pending tenants before parsing content,
  then recheck ownership/lifecycle under a PostgreSQL business row lock before storage.
  Multipart streams have a 15-second deadline. A process permits four simultaneous
  uploads, at most one per tenant; other requests return 429. This is not a distributed
  request-rate limiter; the database lock is the cross-replica storage-quota boundary.
- Compressed source images: at most 8 MiB / 20 million pixels, raster JPEG/PNG/WebP only.
  Every accepted image is decoded, orientation-corrected, stripped of metadata and
  encoded as WebP, at most 1600 pixels and 250 KiB. SVG/animation are rejected.
- Videos retain the existing 30 MiB upload limit and require a matching container
  signature. This is **not** a full video codec validation/transcoding service.
  File hero videos no longer autoplay and use `preload=none`; YouTube/Vimeo players
  are click-to-load, with controls enabled and autoplay disabled. Video transfer
  is outside the hero image budget and requires user action.
- Tenant object/byte limits: basic 30 / 30 MiB; premium 100 / 150 MiB;
  exclusive 200 / 300 MiB. These are conservative implementation defaults requiring
  product approval, not a claim about a previously sold storage entitlement.
- Quotas count *all* blobs under the tenant's old and new prefixes, including
  unsaved drafts and abandoned uploads. Content-addressing deduplicates new uploads.
  A failed DB commit after an upload does not free its quota. Business row locks
  serialize concurrent uploads across application replicas; storage must remain
  Azure Blob's strongly consistent primary endpoint, not an eventually consistent mirror.
- No automated deletion is performed: this avoids deleting a saved page asset during
  a concurrent editor save. For orphan cleanup, take a reviewed snapshot of all
  `logoUrl`, `coverImageUrl`, landing JSON and staff avatar references, list the
  three prefixes in `MEDIA_PREFIXES`, and remove only unreferenced objects older than
  the chosen retention period **under the same business row lock**, after a second
  reference check, and only after all reference writers (including staff-avatar
  updates) participate in that lock or editing is paused. A purge workflow must retain the tenant ID until its blobs are
  deleted; DB cascade alone cannot clean blob storage. Existing lifecycle cleanup
  remains an explicit operator follow-up, not an automated-cleanup claim.

## Legacy data and safe fetches

Public props are projected before SSR/RSC serialization. Raster data URLs become
short content-addressed `/api/public/image` links, so old inline images remain
visible without appearing repeatedly in HTML or client props. Invalid/oversized
data URLs are removed. Long strings/arrays are bounded only within optional
landing JSON. A4000-node budget cannot null required service/staff/hours relations;
excess optional content becomes an empty object with an observable limit event.
The image handler decodes legacy content on demand without a production mutation.
It returns WebP variants (320/640/960/1600); heroes are high priority, other images lazy.
There is a bounded per-process cache (24 MiB/96 variants), two concurrent render
jobs, 24 waiting jobs with a 12-second queue deadline, and duplicate-request coalescing.
Configure an edge cache for larger traffic. Previously published images can remain
in the process cache for one hour and downstream caches for their response TTL
(one hour plus up to one day stale-while-revalidate); account deletion is not instant
media revocation. A release-time purge/invalidation policy remains necessary.

External image fetching is disabled unless the exact HTTPS origin is in
`MEDIA_ALLOWED_ORIGINS` (comma-separated) or is the deployment's owned blob
endpoint from `MEDIA_STORAGE_CONNECTION`. No wildcard hosts or arbitrary URLs
are trusted. Deployments must explicitly review any existing external image origins;
non-allowlisted legacy external images intentionally fail closed.
Every DNS answer must be public and the chosen address is pinned to the connection.
Redirects are rejected; credentials, unusual ports, private IPv4/IPv6 and non-raster
responses are rejected. Source reads are capped at 8 MiB and an 8-second network
deadline. Local files must remain inside the owned public brand/icons/images folders.
Egress firewall restrictions remain recommended defense in depth.

### Offline backfill (never run against production)

1. Prepare a **reviewed synthetic or authorized exported** JSON fixture in the checkout.
   Do not read `.env`, export customer data, or retrieve production content for this test.
2. Run `node --import tsx scripts/legacy-media-backfill.ts ./fixture.json` for a dry run.
3. In a disposable checkout only, add `--write` to generate deduplicated normalized
   `public/brand/migrated/*.webp` files and `.session-scratch/media-backfill/result.json`.
   The script has no DB/storage calls, rejects production mode and never overwrites
   its JSON result. Source JSON remains unchanged.
4. Review the diff and storage/accounting plan. A separate human-approved staging
   migration can import the result; the script never updates a live database.
5. Revalidate the affected public pages after the approved import. Before that,
   the read-only legacy image route provides compatibility.

## PR135 overlap

Read-only reference: PR135 commit `7abcd5cd2b4ce9b16154f0dde384b2ac5dbde220`.
Reused locally: `/businesses`, ≥3-business navigation/footer gate, a shared listed
predicate for directory/sitemap/metadata, and client-loaded status preserving
static home HTML. The implementation uses `src/server/repos/publicDirectory.ts`
instead of editing the shared `business.ts`.

Deliberate differences: `listed` defaults false (explicit approval); missing flags
fail closed; ACTIVE lifecycle, completed onboarding and unexpired plan are required;
known unlisted demos stay excluded. PR135's default-true migration, seed backfill
and superadmin actions/UI were **not** copied. This branch adds its own protected
superadmin listing checkbox and default-false schema. Applying both changes later requires reconciling
the listed migration, metadata gate, directory query, sitemap and navigation; do
not blindly merge/cherry-pick PR135 over this implementation.

**Integrated schema contract:** the coordinator added
`Business.listed Boolean @default(false)` and its migration. Apply the supported
migration entrypoint and regenerate Prisma before deployment; TypeScript's
structural checking of the shared `where` object is not a database migration check.
There is no additional media-table requirement: upload quotas use storage listings
under a business row lock, not a `MediaAsset` ledger.

Directory/sitemap evaluate eligibility on each request. Business profiles use
`revalidate = 300`, `generateStaticParams` and `dynamicParams = true`: shared cached
HTML is preserved, including on-demand generation of new slugs. Unlike the previous
indefinite cache, a request after 300 seconds can trigger background regeneration
to reassess indexing eligibility after time-based plan expiry. The triggering
request can still receive stale HTML; an idle page does not regenerate, and failed
regeneration can keep serving the old page until a later successful refresh.
**This is not a strict five-minute de-indexing/removal SLA.** The tradeoff is periodic
database/render work for visited profiles instead of indefinitely cached metadata.
Explicit listing/lifecycle changes must still call `revalidatePath`; current server
authorization and booking policy—not cached HTML—remain the security boundaries.
The booking shell keeps `revalidate = false` (on-demand invalidation only), and the
home page remains `force-static`. Business-midnight/date widgets hydrate in the
browser independently of cache age; no per-user server rendering is introduced.
`src/app/publicPagesStatic.test.ts` asserts these distinct cache contracts.

## Verification and honest limits

Focused tests cover script-context serialization, encoded adversarial text,
large repeated legacy images with compressed SSR fixture under 100 KiB, raster
budgets, URL/address rejection, quota arithmetic, multipart limits, contact
feedback and business-midnight/DST calculations.
The compression fixture renders real React components and representative serialized
props; it is **not** a production Next navigation/RSC measurement, Lighthouse score,
real-user LCP result or load-capacity certification.

Authoritative final counts, runtime version and measurements are recorded in
`docs/audit-fixes-he.md`, from the complete Node22 release gate. The original
focused React compression experiment remains distinct from the actual production
navigation measurements. The integrated gate exercises real PostgreSQL quota
locks with a synthetic object store and real production browser pages.
The offline backfill dry-run/write experiment produced one deduplicated WebP
from a synthetic PNG with unchanged input and zero DB calls. No live Azure upload,
customer export or production mutation is part of this verification.

```sh
node --import tsx --test src/server/media/hardening.test.ts \
  src/lib/publicUiHardening.test.ts src/lib/videoEmbed.test.ts \
  src/app/api/upload/media/route.test.ts 'src/app/b/*/metadata.test.ts'
```

Client booking retries send `Idempotency-Key: <randomUUID>`. An in-memory ref binds
that key to a SHA-256 fingerprint of the exact serialized request and client-known
identity. Failed responses/network failures retain it; a different payload or
confirmed success starts a new attempt. A synchronous in-flight guard prevents
double submission while hashing or awaiting the response. This ref does not survive
page reloads and does not replace the server's principal/tenant-bound idempotency
checks. A terminal replay receipt returns the customer to slot selection instead
of showing confirmation; unknown/malformed receipts never show booking success.
All confirmed plans use delivery-neutral cancel/rebook copy, without claiming that
email or reminders were sent. Four tests in `src/lib/bookingIdempotency.test.ts`
and two existing booking-copy tests pass with zero-warning scoped ESLint.
No dependency or schema changes were needed for these client additions.

Browser checks in the disposable seeded production app:

`e2e/legacy-media.spec.ts` now automates the large-legacy full-navigation case using
the shared guarded fixtures. It creates a unique synthetic business, persists a
real noisy JPEG in repeated legacy fields, asserts compressed navigation HTML
under 100 KiB, checks script-safe JSON-LD and nonexecution, verifies responsive
WebP hero bytes/dimensions and lazy non-hero images, then deletes its DB fixture.
Measured sizes are attached as `legacy-media-budgets.json`. The shared release
runner discovers this spec automatically; it must not run against a non-isolated
database. The shared runner owns its isolated PostgreSQL and standalone app.
`e2e/media-seo.spec.ts` additionally records three cold mobile LCP measurements
for home, clinic and a heavy fixture. Neither measurement is a field-performance
certification. See the authoritative finding map for the final values and scope.

1. Load an old cached business page with a browser clock advanced several days;
   SSR has no selected date, hydration shows the business timezone's current day.
   Cross midnight (also a DST transition), background/resume, and confirm past
   selections clear without changing valid future selections.
2. Render the large-image fixture, verify compressed HTML/RSC sizes separately;
   hero request is responsive WebP ≤250 KiB, deferred media has no eager transfer,
   no broken allowlisted images and no hydration errors. Repeat slow-mobile LCP.
3. Exercise valid guest booking; invalid phone/email produce inline feedback and
   no book request. Server validation remains mandatory and unmodified by UI.
4. Inspect canonical/robots/title for login, owner login/signup, quote, business
   and booking variants; unlisted/expired/incomplete/demo businesses never enter
   directory or sitemap; a zero/one/two directory count hides the navigation link.
5. Race uploads near each quota and attempt expired/deletion-pending uploads;
   assert storage object/bytes don't exceed caps. Test failed storage/DB responses.

JSON-LD escapes `<`, `>`, `&` and Unicode line separators. The static-compatible CSP
adds object/base/frame restrictions only; it is **not** a strict script CSP. A
nonce/hash script CSP requires a separate caching and auth-provider compatibility
review and must not be claimed as implemented here.
