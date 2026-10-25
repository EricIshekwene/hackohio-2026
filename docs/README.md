# MedCheck docs

How we chose the problem, how we planned and designed the product, and what happened along the way. Everything here was written from the night's real artifacts (research files, plans, design pages, commit history). Sources are cited inline.

**Start here:** [the problem](research/01-problem.md) → [why MedCheck](research/03-why-medcheck.md) → [process log](process-log.md).

## Research
| | |
|---|---|
| [01 The problem](research/01-problem.md) | Falsified medicines in Nigeria: sourced stats, Alert 042/2026, Aisha Musa, who the user is, what exists and the gap |
| [02 Method and options](research/02-method-and-options.md) | The 16-minute research run: 6 research agents, 28 → 6 filter, 6 adversarial councils, scores, what the Skeptics caught, dead ends |
| [03 Why MedCheck](research/03-why-medcheck.md) | The tie with the Ebola Rumour Desk, the case against MedCheck, the Season Planner conversation |
| [04 Data sources](research/04-data-sources.md) | Greenbook, NAFDAC alerts, references; how the snapshot works and what it can't tell us |

## Planning
| | |
|---|---|
| [01 User flows](planning/01-user-flows.md) | Four flows with Mermaid diagrams and scores, the detailed Flow A, and what we built |
| [02 Verdict rules](planning/02-verdict-rules.md) | The four tiers, every rule and why it's shaped that way, how we tested them |
| [03 Spec reconciliation](planning/03-spec-reconciliation.md) | 25 differences between the backend spec and our frontend plan, and who won |
| [04 Hardening](planning/04-hardening.md) | Every step's input, output, edge cases and Back behaviour; real-device demo |
| [05 API contract](planning/05-api-contract.md) | Endpoints, input and output shapes |
| [06 Team plan](planning/06-team-plan.md) | Roles, the two-AI loop, the clock, cut order and never-cuts |

## Design
| | |
|---|---|
| [Design system](design/design-system.md) | Principles, colour, type, components, final screens, audits |
| [Decisions](design/decisions.md) | The 18 v1 decisions, the "vibecoded" redesign, later decisions |
| [UX critique](design/ux-critique.md) | 19 problems found in v1 and how v2 fixed them |
| [Mobbin references](design/mobbin-references.md) | The 37 real app screens we designed from |

## Process
| | |
|---|---|
| [Process log](process-log.md) | Timeline and the 8 pivots |
| [Challenges](challenges.md) | The hard parts and what we did |
| [AI use and validation](ai-use-and-validation.md) | AI reads, people confirm, code decides; what we measured and what we didn't |

## Where each judging criterion is covered

| Criterion | Read |
|---|---|
| Innovation | [The gap](research/01-problem.md#5-what-already-exists-and-the-gap), [the cloned-number check](research/03-why-medcheck.md#2-the-case-against-medcheck-and-how-we-answered-it) |
| Curiosity | [Research method](research/02-method-and-options.md), [questions that changed direction](research/02-method-and-options.md#5-questions-that-changed-direction) |
| Communication | [Design system](design/design-system.md), [user flows](planning/01-user-flows.md) |
| Breadth & Complexity | [Verdict rules](planning/02-verdict-rules.md), [data sources](research/04-data-sources.md), [challenges](challenges.md) |
| Impact | [The problem](research/01-problem.md), [who the user is](research/01-problem.md#4-who-the-user-is) |
| Challenge Navigation | [Process log](process-log.md), [challenges](challenges.md) |
| AI for Impact | [AI use and validation](ai-use-and-validation.md) |

## Not in this repo
- The raw research samples (76 small files) and the council transcripts are in the team's Drive.
- The interactive design and pitch pages were hosted as private Claude artifacts; their content is summarised here.
