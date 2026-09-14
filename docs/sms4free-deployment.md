# SMS4Free deployment contract

This is a source preparation contract. Console remains the default. Storing
credentials, activating delivery, changing pending work and sending a test each
require explicit operational approval. An unavailable user has granted none of
those approvals. The existing release owner controls integration and production.

## Secure operator inputs

After secret-storage approval, the authorized operator stores the existing account
values directly in the existing Container App secret store using the approved
private entry process. This source change creates no store, account, key,
permission or GitHub secret. Keep all four values private, including the account
user and approved sender identity. Never put them in source, parameter files,
examples, workflow inputs, artifacts, prompts, shell arguments or logs.

The four runtime environment bindings must use `secretRef`:

| Runtime name | Required existing secret name |
|---|---|
| `SMS4FREE_API_KEY` | `sms4free-api-key` |
| `SMS4FREE_USER` | `sms4free-user` |
| `SMS4FREE_PASS` | `sms4free-pass` |
| `SMS4FREE_SENDER` | `sms4free-sender` |

These are **names only**. After approved staging/activation, record matching
nonsecret deployment variables in the existing production environment:

* `MESSAGING_PROVIDER`: `console` while inactive, `sms4free` only after approved
  activation. It takes precedence over the runtime legacy `SMS_PROVIDER`.
* `SMS4FREE_SECRET_NAMES`: a JSON object with exactly the four runtime names above
  as keys and the corresponding dedicated secret names as values. Both the local
  preflight and ARM parameter schema reject arbitrary source-secret names.
  Leave unset until configured.
* `MESSAGING_CONFIG`: optional JSON object for public settings. Leave unset when
  using defaults. Any existing `SMS4FREE_BASE_URL`, `SMS4FREE_SEND_PATH` and
  `SMS_DEFAULT_COUNTRY_CODE` overrides must be supplied unchanged.

The deployment workflow runs `scripts/prepare-messaging-deployment.mjs` before
Bicep. It validates complete input locally, then reads only current secret names,
provider selectors, binding metadata and the three public SMS settings.
It never calls `listSecrets` or reads credential values from the operator machine.
Missing access, partial configuration, inline credentials, omitted bindings,
changed secret names, external secret references, changed provider or lost public
settings block deployment. Staged dedicated secrets are protected even before
their environment bindings exist.
The resulting parameter overlay contains names and public settings only.

Bicep resolves **only the explicit four-name contract** against existing runtime
secrets, inside ARM, and passes the selected values to the Container App module as
`secureObject`. No credential values are supplied by GitHub or written to template
outputs. The platform `listSecrets` operation returns the store to ARM; the
template selects the four exact names and does not blanket copy other entries.
This operation requires the existing deployment identity to already have that
access. Missing permission is a blocker requiring owner review, never an
instruction to grant a role. Null configuration performs no SMS secret lookup.
This avoids relying on undocumented name-only secret replacement behavior.

For an authorized **existing-app infrastructure deployment**, run the same
preflight locally, with the nonsecret variables above and exact target set:

```sh
node scripts/prepare-messaging-deployment.mjs --check-input
export AZURE_RESOURCE_GROUP=torchick-prod-rg
export AZURE_CONTAINER_APP=torchick-app-prod
node scripts/prepare-messaging-deployment.mjs --output "$MESSAGING_PARAMETERS"
```

Choose a new operator-private output path outside the repository for
`MESSAGING_PARAMETERS`. Pass that file after the normal parameter file to both
`az deployment group what-if` and `az deployment group create`; never override its
messaging fields afterward. Do not print full deployment parameters, debug output,
secret responses or runtime environment dumps. A fresh console-only bootstrap
has no existing connection to preserve and uses the unchanged null template
default; the existing-app preflight intentionally refuses an absent target.

## Pending-send preflight and controlled activation

1. Obtain explicit approval covering secret storage and the live selector change,
   including future phone OTP and otherwise eligible SMS reminders/campaigns.
   Approval to inspect balance or log in is separate from activation or sending.
2. Immediately before activation, the authorized owner rechecks aggregate pending
   campaigns, RESERVED/UNKNOWN message attempts, active OTPs, scheduled reminders
   and appointment-driven reminder eligibility. The earlier snapshot contained
   four legacy scheduled SMS reminders with past send times. Treat all four as
   potentially sendable until the eligibility aggregate is known and each intent
   is reconciled under an approved operation. Do not infer safety from empty
   MessageLog/campaign aggregates. A failed aggregate read blocks activation.
3. Preserve the exact current revision/image, traffic, selectors, binding names,
   configuration and rollback state. Use the owner's established zero-traffic
   revision procedure for approved binding/selector changes. The generic Bicep
   resource uses Single revision mode and latest-revision traffic at 100 percent;
   **it is unsuitable for activation, staging or rollback**. The routine preflight
   intentionally refuses provider changes. A staged revision must not receive
   cron, OTP or customer requests before the pending-send gate is satisfied.
4. Validate readiness without provider calls or sensitive logging, then switch
   traffic only under approval. Any real test send needs separate approval for
   the exact recipient and message. Record the verified source/image, active
   revision and names-only bindings. Persist the matching nonsecret deployment
   variables before the next routine infrastructure deployment.

The selector change does not itself dispatch a message. Future OTP requests and
the next eligible reminder/campaign run can dispatch. This source task changes
no quota, entitlement, cron policy, cancellation rule, cutoff or queued row and
provides no automatic stale-reminder replay or suppression.

## Rollback and release evidence

The authorized release owner restores the recorded traffic/revision and inactive
selector through the established revision procedure, then verifies the absence
of newly enabled delivery. Restore the deployment provider variable to match and
retain the four name bindings in both runtime and deployment inputs. Existing
secret values stay in the runtime store; deleting or rotating them is a separate
approved operation because secrets are shared across revisions. Reconcile any
in-flight/unknown provider attempt before retrying. Configuration rollback cannot
recall a message already accepted by the provider.

Offline preparation checks are Bicep compilation, the existing infra/provider
tests and `smsDeployment.test.ts`. These prove source wiring and fail-closed
preflight behavior using synthetic metadata. They do not prove live ARM secret
resolution, provider readiness, staging, production delivery or pending-row
reconciliation. Those remain owner-operated approval and release gates.

Authoritative platform references:

* [Container Apps List Secrets, API 2024-03-01](https://learn.microsoft.com/en-us/rest/api/resource-manager/containerapps/container-apps/list-secrets?view=rest-resource-manager-containerapps-2024-03-01)
  defines the `value` collection and each secret's `name`/`value` fields.
* [Bicep resource list functions](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/bicep-functions-resource#list)
  documents resource-instance list calls and warns against exposing their results
  in outputs. The source resource is explicitly `existing`; the compiled
  Container App module depends only on the environment module, with no
  self-dependency on its own deployed output.
* [Bicep secure parameters](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/parameters#secure-parameters)
  documents that secure objects are excluded from deployment history and logging.
* [Container Apps secret scope and lifecycle](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
  explains application-scoped secrets shared across revisions.

These contracts support the proposed server-side pattern. Successful live
retention still requires separate authorized Azure staging evidence.
