# Implementation Notes

> Fill this in as part of your submission. 1–2 pages, bullet points are fine. Delete these
> instructions before submitting.

## 1. What I changed
<!-- Grouped by task: bugs fixed and features implemented (component + template). -->

-

## 2. Component & state model
The list loads the current user's organization and keeps the selected status filter separate from the API data.
The detail screen loads one request and shows its before/after items, totals, history, and available decisions.
Both screens expose an explicit view state so the template can show loading, data, an empty result, or an error.
The session supplies the acting user; decision availability depends on that user's policies and the request status.

## 3. Invariants I keep
<!-- Which properties the UI guarantees, and where in the component/template each is enforced. -->

| Invariant | How / where |
|---|---|

## 4. Testing strategy
<!-- What you tested (component/DOM vs pure) and why; what you deliberately skipped given the budget. -->

-

## 5. Assumptions
<!-- Where the requirements left room for interpretation, the calls you made and why. -->

-

## 6. Where I used AI
- OpenAI Codex read the assessment and scaffold, planned the stages, and wrote the diff and permission fixes, the list filter and states, and their tests.
  Codex also drafted these notes and ran verification commands. AI contributions will be updated as the remaining stages are completed.
- The candidate still needs to review and understand the submitted code and record the walkthrough; those steps have not been performed by Codex.

## 7. What I'd improve with more time
-
