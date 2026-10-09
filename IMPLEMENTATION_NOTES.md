# Implementation Notes

## 1. What I changed

I kept the existing standalone components, reactive forms, mock API contract, and styling conventions.
The unchanged scaffold is saved in the first commit, followed by separate commits for each verified stage and its tests.

- The diff now detects quantity, price, and description changes. The preview shows all four kinds with before/after descriptions and values.
- The list filters locally by status, distinguishes an empty organization from no filter matches, formats currency, and has keyboard-accessible selection buttons.
- Detail selection reloads the request. Totals and delta are labeled, history is oldest first, and loading/empty/error states have messages.
- Approval/rejection check both status and permission. Rejection validates and trims its reason; decisions show progress, block duplicates, and refresh the list without clearing its filter.
- Failed responses trigger a status check before another decision is allowed. The demo exposes delay/failure controls, and a small layout change prevents the list from overlapping the preview.

## 2. Component and state model

The list loads the current user's organization and keeps its selected filter separate from the API data.
The detail loads one request and displays its preview, totals, history, and permitted decisions.
Both components expose a `ViewState` that the template uses for loading, loaded, empty, or error content.
The shell holds the selected ID, reads the acting user from `SessionService`, and connects selection and list-refresh events.
`ngOnChanges` loads bound IDs and subsequent changes. `ngOnInit` loads a directly assigned initial ID only when no load has started,
so the original test setup works without making duplicate initial API calls.

I kept decision state separate from loading state: `submitting` disables controls while leaving the preview visible, and
`actionError` reports a failed response. `rejectControl` holds the reason, validity, and touched state.
A small `loadVersion` counter and captured user identify the current request, so older responses cannot overwrite a new selection.
Switching users clears selection and recreates both panes; destroying a component invalidates its pending responses.

## 3. Invariants I keep

| Invariant | How and where |
|---|---|
| Both status and permission are required | `canApprove`/`canReject`, hidden and disabled Approve, conditional Reject, and guards in both action methods |
| One decision at a time in the current view | `submitting` is set before awaiting; methods guard it and both buttons are disabled |
| Rejection has a meaningful reason | Trim-aware validator, disabled Reject, method validation, and trimmed API argument |
| A failed response cannot cause a blind repeat | Refresh while still submitting; show Retry with no actions if verification fails |
| Older responses cannot replace current data | Compare the captured load version and user before changing state |
| Derivation does not mutate API arrays | Build new diff rows and sort a copy of the audit array |
| The list reflects completed decisions | `changed` reloads the existing list and preserves its filter |

## 4. Testing and verification

The suite passes **87 tests across eight suites**, including all seven original scaffold tests unchanged in their original files.
The original three spec files match commit `db9d76b` byte for byte and also pass when run separately.
I kept extra coverage in `.additional.spec.ts`, the decision suite, and the shell suite. Lifecycle spies verify one initial API call
for direct assignment or `setInput`, followed by one call for each subsequent input change. Pure tests cover diff classification and input preservation.
DOM tests cover list states/filtering, preview values, totals, history, permissions, validation, and decision outcomes.
Shell integration tests cover selection, role switching, list refresh, and mock controls.

I used `latencyMs`/`failNext` with Angular `fakeAsync`/`tick` so slow/error tests do not wait in real time.
Spies cover failure before saving and failure of the verification fetch. The test-only TypeScript target is ES2016 for
Zone's async tracking; the app stays ES2022, following the [Jest Angular preset guidance](https://thymikee.github.io/jest-preset-angular/docs/getting-started/installation).

The original-test run, `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`, and `npm run format:check` passed with Node 18.20.3 on 8 October 2026.
The formatter only wrapped existing long lines in the mock service and fixtures; their behavior is unchanged. Browser checks confirmed filtering, selection,
whitespace validation, slow rejection, failed approval reconciliation, load-error Retry, viewer restrictions, and organization isolation.
The original-test compatibility correction keeps Approve in the loaded DOM but hides and disables it when permission or status forbids it.
The action-method guard still blocks direct calls. Browser checks confirmed `hidden: true`, `disabled: true`, and `display: none` for a viewer.
`.gitattributes` keeps text files in LF after a Windows checkout, so formatting does not depend on local Git line-ending settings.
Cross-browser regression testing and a real backend remain unverified.

## 5. Assumptions and decisions

- The mock saves a decision **before** its response can fail. I treat a network error as an uncertain response, report it,
  and fetch the latest status. If that read also fails, Retry must confirm the status before further decisions. API behavior and response shapes are preserved.
- Rejection uses the approval policy because no separate rejection policy is supplied. The existing helper accepts
  `cr_a_u`, `cr_a_w`, and `cr_a_o`. No owner/workspace fields exist for finer checks, so I retained the supplied helper and organization boundary rather than inventing metadata.
- Totals/delta come from the API. I retained the existing two-decimal formatter and assumed unique SKUs and valid ISO dates.
  Equal-time history entries keep their source order.
- A new selection resets its reason and action error. A completed older decision can refresh the list for the same user,
  but cannot replace the new detail. One shared decision method keeps identical pending/error handling in one place.

## 6. Where I used AI

I used OpenAI Codex to assist with implementation, tests, and documentation. This included the diff and permission fixes, list filtering, detail preview and timeline, and approval/rejection behavior with validation and error handling.

## 7. Limitations and remaining work

No required UI feature is intentionally deferred. The supplied Angular 15 dependency versions remain unchanged; installation
reported 99 audit advisories (3 low, 18 moderate, 75 high, 3 critical). Upgrading that dependency set is outside the implementation scope.
With more time, I would add browser regression tests, use a real API with server-enforced permissions and idempotency, and improve date/currency presentation.

## 8. Repository and walkthrough

- [GitHub repository](https://github.com/hujaafar/cr-assessment-frontend-20260721), including the full commit history.
- [Recorded walkthrough](https://drive.google.com/file/d/1La3sDh78gIAxagpqtTA8qmYvAAs9w53e/view).
