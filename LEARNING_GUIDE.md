# Understanding and changing this project

## Follow one complete data flow

1. The list's `ngOnInit()` calls `load()`: show loading, await the API, then store loaded/empty/error state.
2. Its template uses `*ngIf` to select the content. `visibleRows` filters loaded data; changing status does not call the API.
3. Selecting a request emits its ID. The shell stores `selectedId` and passes it to the detail through `[id]`.
4. The detail's `ngOnChanges()` loads that ID. Getters derive the diff, sorted history, and permitted actions from its data.
5. A decision method checks permissions/status; rejection also checks the reason. It sets `submitting` before the API call.
6. Both buttons are disabled while saving. Success replaces the detail; a failed response triggers a read to confirm the outcome.
7. The detail emits `changed`. The shell reloads the existing list, updating its statuses while preserving the filter.

## Find the right file

| Change | Where to look |
|---|---|
| A label, message, or displayed field | The list/detail `.html` template |
| Which requests the list shows | List `.ts`, especially `visibleRows` |
| Whether a decision is allowed | Detail `canApprove`/`canReject` and `src/common/permissions.ts` |
| Validation or saving/error handling | Detail `rejectControl`, `approve`, `reject`, and `submitDecision` |
| Which items changed | `src/components/diff.util.ts` |
| Role switching or demo controls | `src/app/app.component.ts` and `.html` |
| Demo data and API behavior | `src/api/fixtures.ts` and `cr-api.service.ts` |

## Read the Angular bindings

| Syntax | Meaning |
|---|---|
| `{{ cr.title }}` | Display a value as text |
| `[disabled]="submitting"` | Set a DOM property from state |
| `(click)="approve()"` | Call a method when an event happens |
| `*ngIf="canApprove"` | Create the button only when true |
| `*ngFor="let row of diff"` | Repeat markup for each row |
| `[formControl]="rejectControl"` | Connect the textarea to its value, validity, and touched state |
| `[id]="selectedId"` / `(changed)="requestList.load()"` | Pass an input to a child / respond to its output |

Getters such as `visibleRows` and `timeline` calculate results when read. These arrays are small, so explicit calculations
are sufficient here. Dependency injection supplies the API and session through constructors; components do not create their own services.

## Practice changes without AI

Start by changing “Proposed changes” in the detail template. Search for the old text in tests and adjust any expectation that
deliberately checks it. Run `npm test` and `npm run build`, then inspect the UI. A label change should not alter permission or data behavior.

For a slightly larger exercise, add an optional “Only cost increases” checkbox:

1. Add `onlyIncreases = false` beside the list's `statusFilter`.
2. In `visibleRows`, apply the existing status filter first, then filter for `delta > 0` when the checkbox is selected.
3. Bind `[checked]` to that field and use `(change)` to update it, following the existing select binding pattern.
4. Add DOM tests for off/on, combining it with status, no matches, and restoring the original list.
5. Run tests, typecheck, lint, format, and build. Review `git diff` before committing.

This checkbox is a practice exercise, not an implemented feature. Keep action guards in methods as well as templates:
a hidden or disabled button alone does not prevent a direct method call.

## Explain two decisions

**Why set `submitting` before awaiting?** A second click can happen while the first promise is unresolved. The synchronous guard
blocks the second call, and the template makes the waiting state visible.

**Why reload after a failed decision?** The mock writes before simulating a response error. That error does not prove the write failed.
Checking the latest status prevents an accidental repeat. If the check fails too, only Retry is offered.

`loadVersion` handles a different problem: an earlier load can finish after a newer selection. Each load gets a number;
only the current number and acting user may update the view. Sorting a copied history array likewise avoids changing API data.

## Plan the required 5–8 minute walkthrough

- **0–1 min:** Start the app, name the screens, and point to their components/templates.
- **1–2 min:** Show a status filter, no matches, and switching back to ALL.
- **2–3 min:** Explain CR-1's quantity change, totals/delta, and history. Select CR-2 for a description-only change.
- **3–4 min:** Switch to viewer and select a request: data is readable and decisions are absent. Show otherOrg's separate list.
- **4–5 min:** Refresh the browser, try a blank/whitespace reason, then reject with a valid reason and a 3-second delay. Show history/list updates.
- **5–6 min:** Refresh again. Arm “Fail next response,” select CR-2, and show error/Retry. Optionally show a failed approval response that still saved.
- **6–8 min:** Explain duplicate prevention or failure reconciliation, show tests, and give the AI disclosure from the notes.

Rehearse in your own words and practice a small change without AI. Before sharing, review the implementation and notes,
record the video, and follow the recruiting contact's repository delivery instructions. Preserve the original and feature commits.
