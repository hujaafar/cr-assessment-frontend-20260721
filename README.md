# Change Request Review

My solution to the Angular frontend assessment. The app lets a reviewer see what a change request would
alter in a purchase agreement, check its history, and approve or reject it.

It uses the supplied Angular 15 scaffold and mock API, with standalone components, reactive forms, and
plain HTML/CSS. The mock keeps its data in memory, so refreshing the browser resets the requests.

## Walkthrough

[Watch the recorded walkthrough](https://drive.google.com/file/d/1La3sDh78gIAxagpqtTA8qmYvAAs9w53e/view).

## Run locally

Use **Node 18.20.3**, as specified in `.nvmrc`. Verification used npm **10.7.0**. After selecting the
Node version, run these commands from the project folder:

```bash
npm ci
npm start
```

Open [localhost:4200](http://localhost:4200). Keep the supplied `.npmrc` and `package-lock.json`;
installation relies on the existing peer-dependency settings. The scaffold's dependency versions
are unchanged, including their existing deprecation and audit notices.

## Try the app

The list on the left shows requests for the current user's organization. Select a request to see its
details on the right. The status filter narrows the list locally without another API call.

Two useful examples:

- **CR-1** increases SKU-A from 10 to 11 units. The total goes from USD 8,000 to USD 8,500.
- **CR-2** changes an item's description while keeping its quantity and price the same. It still
  appears as a changed item, with a delta of zero.

The preview also handles added, removed, and unchanged items. The timeline shows events from oldest
to newest.

The header has a few controls for trying different situations:

| Control | What to try |
| --- | --- |
| Acting as | Choose `viewer` to see read-only access, or `otherOrg` to see a separate organization's requests. Select a request after switching users. |
| Response delay | Choose 3 seconds, then approve or reject a pending request. The preview stays visible while the decision is saving. |
| Fail next response | Arm a single failure, then select a different request to see the error state. Retry loads it again. |

Approval and rejection require both a pending request and the current user's approval permission.
Rejection also needs a reason; an empty value or spaces alone will not enable it. A completed decision
updates the detail and reloads the list while keeping its selected filter.

Refresh the browser whenever you want to start again with the original demo data.

## Handling a failed decision

One detail of the supplied mock matters here: it saves a decision **before** its response can fail.
A response error therefore does not prove that the decision failed.

After a failed approval or rejection response, the app fetches the request again and displays its
confirmed status alongside the error. If that check also fails, the screen offers Retry before any
further decision. To see this behavior, open a pending request, arm **Fail next response**, and approve
it. The response fails, but the refreshed status is approved.

While a decision is in progress, `submitting` disables the controls and guards the action methods
against another submission in the current view.

## Code structure

| File or folder | Responsibility |
| --- | --- |
| `src/app/` | Page layout, request selection, user switching, and demo controls |
| `src/components/cr-list/` | List loading states and status filtering |
| `src/components/cr-detail/` | Preview, totals, timeline, permissions, validation, and decisions |
| `src/components/diff.util.ts` | Compare items by SKU, including quantity, price, and description changes |
| `src/api/` | Supplied mock API and sample requests |
| `src/session/` | Current user |
| `src/common/` | View state, permission helpers, and currency formatting |
| `src/models/` | Request, line item, user, and timeline types |

The shell passes the selected request ID to the detail component. After a decision, the detail emits
an event that tells the list to reload. Both components represent loading, loaded, empty, and error
states explicitly. Detail loading and decision submission have separate state, so saving does not
hide the preview. A load counter and a check of the current user prevent older responses from
overwriting a newer selection.

## Tests and checks

```bash
npm test
npm run typecheck
npm run build
npm run lint
npm run format:check
```

All checks passed on **8 October 2026** with Node 18.20.3. The test suite has **87 passing tests across
eight suites**, including the seven original scaffold tests unchanged. Installation and tests were
also verified from a clean clone. `.gitattributes` keeps line endings consistent after checkout.

Coverage includes list filtering and states, diff classification, timeline order, permissions,
rejection validation, slow and failed decisions, request selection, and user switching. Component
tests use Jest and Angular TestBed to check rendered behavior. Slow-response tests use `fakeAsync`
and `tick()` instead of waiting in real time.

To run just the original tests:

```bash
npm test -- --runTestsByPath src/components/diff.spec.ts src/components/cr-list/cr-list.component.spec.ts src/components/cr-detail/cr-detail.component.spec.ts
```

`npm run format` applies the project's formatting rules when making changes.

## Implementation notes and AI use

[IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) covers the state model, permission assumptions,
testing choices, and limitations. The original requirements are in
[CANDIDATE_BRIEF.md](./CANDIDATE_BRIEF.md).

I used OpenAI Codex to assist with implementation, tests, and documentation. This included the diff and permission fixes, list filtering, detail preview and timeline, and approval/rejection behavior with validation and error handling.

The app uses a mock API; a real backend and cross-browser regression testing are outside the work
verified here.
