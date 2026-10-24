---
name: grill-me
description: Question the user hard about a plan, design or build step, one decision at a time, giving a recommended answer for each, until the plan is solid. Use when the user says "grill me", asks to stress-test a plan, or reaches a new build step.
---

# Grill me

Interview the user relentlessly about the plan or step in front of you until
both of you agree on every decision that matters. The goal is a plan with no
open questions, not a pleasant conversation.

## How to run it

1. **Scope the step.** Name the plan or step being grilled in one line and the
   outcome it must deliver. If it is part of a larger plan (for MedCheck, the
   Flow A wizard in the project docs), grill one step at a time, in build order.
2. **Check the code first.** If a question can be answered by reading the repo,
   read the repo instead of asking. Only ask what the user actually has to decide.
3. **Ask a focused set.** Ask 3 to 6 questions per step, numbered. Each one must:
   - target a real decision, risk or gap (data shapes, error paths, edge cases,
     scope cuts, demo risk, time cost), not trivia;
   - come with **your recommended answer** and a one-line reason;
   - be answerable in a few words ("1 yes, 2 go with B, 3 skip").
4. **Walk the decision tree.** Resolve decisions that others depend on first
   (contracts before components, state before screens). When an answer opens a
   new branch, follow it before moving on.
5. **Push back.** If an answer is vague, risky or contradicts an earlier one,
   say so plainly and ask again. Do not accept "we'll figure it out later" for
   anything on the critical path.
6. **Respect the clock.** Weigh every question against the deadline. Prefer
   the answer that ships and demos reliably over the one that is elegant.
   Flag anything that should be cut.
7. **Close the step.** When the step's questions are settled, write a short
   summary: the decisions made, anything cut, and your final recommendation
   for what to build next. Then move to the next step only when the user is ready.

## Format per step

```
### Step N: <name>
Goal: <one line>

1. <question>
   Recommend: <answer>, because <reason>.
2. ...

Reply with your answers (or "all recommended").
```

## Rules

- One step at a time. Never dump every step's questions at once.
- Always give a recommendation. A question without one is not finished.
- Keep each question to one decision.
- If the user says "all recommended", record those answers and move on.
