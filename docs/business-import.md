# Business import

The super admin import flow accepts a public business website, a public
Instagram or Facebook profile, or a deep public profile on a scheduling
platform such as Calmark.

## Contract

1. Every URL is fetched through the DNS pinned SSRF boundary in
   `src/server/businessImport/network.ts`. Redirect targets are revalidated,
   response size and type are bounded, and authenticated or private endpoints
   are never used.
2. Extraction produces a normalized draft with field level evidence,
   confidence, source URLs, warnings, and explicit missing fields. Supported
   facts include profile text, contacts, location, hours, services, staff,
   booking policy, social links, and public media.
3. Images and direct video files are downloaded, validated, deduplicated, and
   copied to business owned storage. External image URLs are never persisted as
   public page media.
4. Provisioning applies the draft under the existing import claim, child
   baseline, row lock, serializable transaction, and same source retry
   protections. Imported services remain bookable, explicit staff service
   assignments are preserved, and unsupported prices or durations stay hidden
   pending review. A public staff profile can remain unclaimed until an
   administrator assigns a verified phone identity.
5. Imported landing content is marked as imported so the public page uses only
   source backed copy. Generic marketing benefits, testimonials, prices,
   addresses, and staff claims are not synthesized.
6. Onboarding steps are marked complete only when the corresponding imported
   data was applied. `onboardingCompleted` becomes true only when services,
   staff, hours, branding, and rich content are all present.

## Platform limitations

Instagram and Facebook are read from anonymous public HTML metadata only.
Availability varies by region, rate limits, login challenges, and platform
markup. When useful metadata is unavailable, the review records a warning and
leaves unsupported fields empty.

Competitor pages are supported when the business profile and its structured
data are public. The importer does not bypass authentication, paywalls, robots
directives, or private APIs. Direct public videos can be copied when they use a
supported media type. Hosted social videos remain official embeds.

## Safe remediation for an existing sparse import

After the change is reviewed and deployed, do not overwrite an owner edited
business in place. Export or record its current profile, services, staff,
hours, settings, and media first. Reimport the same public source into a new
unlisted draft tenant, compare the review and public preview, then migrate the
approved fields through an explicit operator action or a dedicated
data-preserving repair script. Publish only after the owner approves the
result.
