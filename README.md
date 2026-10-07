# Change Request Review UI — Frontend Exercise (Angular)

A small **Angular** exercise for a procurement platform. You'll complete the UI an approver uses to
review and act on **Change Requests (CRs)** — proposed amendments to a live Purchase Agreement.

You do **not** build a backend. A mock API service (`src/api/cr-api.service.ts`) with realistic fixtures
is provided; treat it as the contract your components talk to. Start with
[`CANDIDATE_BRIEF.md`](./CANDIDATE_BRIEF.md) for the scenario, tasks, and acceptance criteria.

## Stack & setup

Angular 15 (standalone components, reactive forms). It's a real, runnable app: `npm start` serves the UI
in a browser, and `npm test` renders the components via `jest-preset-angular` (TestBed in jsdom). Plain
HTML/CSS.

```bash
nvm use            # Node 18.20.3
npm ci             # uses .npmrc (legacy-peer-deps) — please keep it
npm start          # ng serve -> http://localhost:4200  (run the UI to click through / record your demo)
npm test           # Jest — component/DOM, integration, and pure diff tests
npm run build      # ng build (production)
npm run lint
npm run format     # applies the supplied Prettier conventions
npm run format:check
```

### Running the UI

`npm start` boots a small demo shell (`src/app/`) that hosts the list + detail screens. Use the
**"Acting as"** switcher in the header to change the current user (approver / viewer / otherOrg). Select
a request after switching; the old selection is cleared. **Response delay** simulates a slow call, and
**Fail next response** arms a single network failure. To demonstrate a load error, arm it and select a
different request, then use Retry. Refreshing the browser resets the in-memory data. The shell is glue for the
demo — the exercise itself is the list/detail components and their templates.

## Policy-string convention

The current user (from `SessionService`) carries permission strings shaped **`cr_{action}_{scope}`**:

| action | meaning | | scope | meaning |
|---|---|---|---|---|
| `r` | read | | `u` | user — own CRs |
| `a` | approve | | `w` | workspace |
| `x` | apply | | `o` | org |

e.g. `cr_a_o` = may approve any CR in the org; a user with only `cr_r_o` is read-only. The UI must only
offer/enable an action the current user is actually permitted to perform.

## CR statuses (read-only context)

`DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → APPLIED`, with `REJECTED` / `CANCELLED` terminal.
Approve/Reject act on a `PENDING_APPROVAL` CR. You consume these statuses; you don't drive backend
transitions.

## Where to work

- `src/components/cr-list/cr-list.component.{ts,html}` — API load states and local status filtering.
- `src/components/cr-detail/cr-detail.component.{ts,html}` — preview, totals, timeline, permission checks,
  decision state, reason validation, and failed-response recovery.
- `src/components/diff.util.ts` — pure SKU comparison for quantity, price, and description changes.
- `src/app/app.component.{ts,html}` — selection, role switching, mock controls, and list refresh after decisions.

The visible tests are a starting point, not the full specification.

## Testing components

Component tests use `TestBed` and assert on rendered DOM. The mock API resolves on a timer. Most new
tests use `fakeAsync` and `tick()` to advance it deterministically, followed by `detectChanges()` to
update the DOM. The test-only TypeScript target is ES2016 for Zone's async tracking; the app remains
ES2022. Detail tests use `componentRef.setInput()` to exercise Angular's `ngOnChanges` lifecycle.

### Failed decisions

The supplied mock saves a decision before its promise can fail. After a failed response the detail
fetches the current request, reports the response error, and shows the confirmed status. It does not
assume the request is still pending. If this verification also fails, only Retry is offered until the
current status loads successfully. See [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) for the
permission scope assumptions and AI disclosure.

### Verification and submission

Use Node **18.20.3** from `.nvmrc`; check `node --version` before installing. Keep `.npmrc` and the lockfile.
On Windows, run the same npm commands from PowerShell after selecting/installing Node 18. The assessment's
existing dependencies produce npm deprecation/audit notices; no dependency versions were changed.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run lint
npm run format:check
```

Verified on 8 October 2026 with Node 18.20.3: a fresh Windows clone passed `npm ci`, all **84 tests**
across five suites, typecheck, production build, lint (no warnings), and format check. The worktree
remained clean. `.gitattributes` keeps text line endings consistent after checkout.

Read [LEARNING_GUIDE.md](./LEARNING_GUIDE.md) for the data flow, small changes to practice without AI,
and a 5–8 minute walkthrough outline. Before submission, review all code and the notes yourself,
record the walkthrough (including rejection and an error), and share the repository with its full
commit history according to the recruiting contact's delivery instructions. No remote has been configured.

## Files

```
src/
  models/cr.models.ts              # CrSummary, CrDetail, LineItem, TimelineEntry, ReqUser
  common/                          # view-state, money.util, permissions (policy helpers)
  api/                             # fixtures + CrApiService (mock, org-scoped, latency/failNext)
  session/session.service.ts       # current user
  components/
    diff.util.ts                   # baseline-vs-proposed line-item diff
    cr-list/cr-list.component.{ts,html}
    cr-detail/cr-detail.component.{ts,html}
    diff.spec.ts                           # pure diff cases
    cr-list/cr-list.component.spec.ts       # list DOM and state tests
    cr-detail/cr-detail.component.spec.ts   # detail preview, state, permission tests
    cr-detail/cr-detail.actions.spec.ts     # decisions, validation, slow/error cases
  app/app.component.spec.ts                # selection, role, and list-refresh integration
```

## A note on AI tools

Using AI tools is allowed and expected — see the brief for the (light) disclosure policy. The follow-up
interview is built around your own code, so make sure you understand what you submit.
