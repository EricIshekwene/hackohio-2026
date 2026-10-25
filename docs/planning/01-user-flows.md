# User flows: the four we drew, how we scored them, and what we built

Written Sat 24 Oct 2026, about 7:15 PM ET, before any client code existed, so the frontend could pick one flow with the team. It is kept here as it was then, with one correction note per section. **What we finally built is at the end.**

> **Correction (later the same night).** These diagrams use 3 verdict colours and say "reg no. not in the snapshot = amber". The backend spec landed minutes later with **4 tiers** (adding grey "We couldn't check this") and made "not found" **red**. We followed the spec ([spec reconciliation](03-spec-reconciliation.md)). At 9:52 PM we changed "not found" back to **amber**, because a real pack (AquaMal QS, B4-0910) was missing from the snapshot ([process log](../process-log.md#952-pm-r1-red-to-amber)).


Four flows for the same core loop: **photo → AI reads label → user confirms fields → deterministic check against NAFDAC Greenbook + falsified-medicine alerts → red / amber / green verdict with sources.** The app never says "genuine". Each diagram covers screens, loading states and error paths.

Shared verdict rules (same in every flow, computed by code, never by the AI):

| Verdict | When |
|---|---|
| 🔴 Red | Product matches a NAFDAC falsified-medicine alert, **or** the reg no. exists but belongs to a different product or maker (the hero "R3 mismatch" case) |
| 🟡 Amber | Reg no. not in the snapshot, registration expired, partial field match, or a key field could not be read |
| 🟢 Green | Reg no. found, name and maker match, no alert hit. Copy says "No problems found in NAFDAC records", never "genuine" |

---

## Flow A: Linear 4-step wizard

One screen per step with a progress bar (Snap, Read, Confirm, Result). The easiest to build and the easiest to narrate in a video.

```mermaid
flowchart TD
    Start([Landing: What is MedCheck + Check a medicine button]) --> Cam

    subgraph S1["Step 1 · Snap"]
        Cam[Camera / upload screen<br/>framing guide over the pack]
        Cam -->|Permission denied| Upload[Fallback: upload from gallery]
        Cam --> Preview[Photo preview<br/>Retake / Use photo]
        Upload --> Preview
        Preview -->|Retake| Cam
    end

    Preview -->|Use photo| Reading

    subgraph S2["Step 2 · Read"]
        Reading[Loading: Reading the label...<br/>skeleton fields]
        Reading -->|Blurry / no text| Blurry[Error: Could not read the pack<br/>tips: light, flat, fill frame]
        Reading -->|Network or AI error| NetErr[Error: Could not reach the reader<br/>Retry / Type it in]
        Reading -->|AI budget used up| Manual
        Blurry -->|Retake| Cam
        NetErr -->|Retry| Reading
    end

    Reading -->|Fields extracted| Confirm
    NetErr -->|Type it in| Manual[Manual entry form<br/>reg no. required]

    subgraph S3["Step 3 · Confirm"]
        Confirm[Confirm screen<br/>name, maker, reg no., batch, expiry<br/>each field: check / edit<br/>low-confidence fields highlighted]
        Confirm -->|Edit a field| Confirm
        Confirm -->|Reg no. missing or bad format| FieldErr[Inline error on reg no.<br/>format hint e.g. A4-1234]
        FieldErr --> Confirm
    end

    Manual --> Checking
    Confirm -->|All fields confirmed| Checking

    subgraph S4["Step 4 · Result"]
        Checking[Loading: Checking NAFDAC records...]
        Checking -->|Alert match| Red[RED verdict<br/>Matches NAFDAC alert + link]
        Checking -->|Reg no. belongs to another product| RedMis[RED verdict<br/>side by side: what pack says vs what NAFDAC lists]
        Checking -->|Not found / expired / partial| Amber[AMBER verdict<br/>what is missing + what to do]
        Checking -->|All match, no alert| Green[GREEN verdict<br/>No problems found in NAFDAC records]
        Checking -->|Lookup failed| LookErr[Error: Could not check records<br/>Retry]
        LookErr -->|Retry| Checking
    end

    Red --> Actions
    RedMis --> Actions
    Amber --> Actions
    Green --> Actions
    Actions[Sources panel + actions<br/>Report to NAFDAC / Share / Check another]
    Actions -->|Check another| Cam
```

**Pros:** clear mental model, each step is one component, progress bar tells the story on video, error states are isolated per step.
**Cons:** four screens of navigation; feels a little form-like.

---

## Flow B: Single-screen progressive scan

One page. The photo sits at the top, fields fill in under it as the AI returns, and the verdict card slides up from the bottom. It feels fast and "magic".

```mermaid
flowchart TD
    Open([Scan page opens: camera live]) --> Capture[Tap shutter or upload]
    Capture --> Thumb[Photo shrinks to thumbnail at top<br/>field rows appear as skeletons]

    Thumb --> AIState{AI read result}
    AIState -->|Success| Fill[Fields animate in<br/>each row has confidence dot<br/>tap row to edit inline]
    AIState -->|Partial| FillPartial[Some rows filled<br/>missing rows show Tap to type]
    AIState -->|Unreadable| Banner[Inline banner: Could not read<br/>Retake / Type instead]
    AIState -->|Network or budget error| Banner

    Banner -->|Retake| Open
    Banner -->|Type instead| FillPartial

    Fill --> Gate{All required rows confirmed?}
    FillPartial --> Gate
    Gate -->|No| Nudge[Check button disabled<br/>unconfirmed rows pulse]
    Nudge --> Gate
    Gate -->|Yes| Check[Tap Check against NAFDAC<br/>button becomes spinner]

    Check --> Res{Deterministic check}
    Res -->|Alert or R3 mismatch| SheetR[Bottom sheet RED<br/>mismatched fields glow red in the list above]
    Res -->|Not found / expired / partial| SheetA[Bottom sheet AMBER]
    Res -->|All match| SheetG[Bottom sheet GREEN]
    Res -->|Lookup error| Toast[Toast: Check failed, Retry]
    Toast --> Check

    SheetR --> Expand[Swipe up: full sources, NAFDAC record vs pack, report link]
    SheetA --> Expand
    SheetG --> Expand
    Expand -->|New scan| Open
    SheetR -->|Edit a field| Fill
    SheetA -->|Edit a field| Fill
```

**Pros:** most polished feel; the R3 mismatch reads instantly because the wrong field lights up in place; fewest route changes.
**Cons:** more state on one component (scan, extract, confirm, result all live together); animation polish costs time; harder on small screens.

---

## Flow C: Dual entry (scan or type) with history

The home screen offers two equal paths: scan the pack or type the reg no. The idea is to serve low-end phones and poor connections, and to keep a local history of checks.

```mermaid
flowchart TD
    Home([Home<br/>Scan a pack · Type a NAFDAC number · Recent checks]) -->|Scan| Cam[Camera / upload]
    Home -->|Type| Type[Reg no. input<br/>+ optional name]
    Home -->|Recent| Hist[History list<br/>colour-coded past verdicts]
    Hist -->|Open one| Detail[Saved result detail]
    Hist -->|Empty| EmptyH[Empty state: No checks yet]

    Cam --> Read[Loading: Reading label]
    Read -->|OK| Confirm[Confirm fields screen]
    Read -->|Fail or offline| Fallback[Message: Could not read photo<br/>switch to typing, prefilled with anything read]
    Fallback --> Type

    Type -->|Invalid format| TypeErr[Inline format error]
    TypeErr --> Type
    Type -->|Submit| Lookup
    Confirm -->|Confirm| Lookup[Loading: Checking records]

    Lookup -->|Offline| Queue[Offline: saved, will check when back online<br/>or use cached snapshot]
    Lookup --> V{Verdict}
    V -->|Red| R[RED result]
    V -->|Amber| A[AMBER result]
    V -->|Green| G[GREEN result]

    R --> Save[(Save to local history)]
    A --> Save
    G --> Save
    Save --> Result[Result page with sources<br/>Report / Share / Back home]
    Result --> Home
    Detail --> Home
```

**Pros:** strongest "real-world Africa" story (low bandwidth, typing fallback), history adds breadth, the typing path is a backup when the AI fails during the demo.
**Cons:** more screens and states to build; typed-only checks skip the photo-vs-registry mismatch, which is the hero moment; offline queue is mostly theatre in a hackathon.

---

## Flow D: Conversational assistant

Chat-style UI. The user sends a photo, the assistant replies with what it read as tappable chips, the user confirms, and the verdict arrives as a rich card.

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Chat UI
    participant AI as Label reader (AI)
    participant DB as NAFDAC check (code)

    U->>UI: Attach photo of pack
    UI->>UI: Show photo bubble + typing indicator
    UI->>AI: Send image
    alt Read OK
        AI-->>UI: Fields + confidence
        UI-->>U: Bubble: I read these. Tap any that are wrong. [chips]
    else Unreadable
        AI-->>UI: Low confidence / no text
        UI-->>U: Bubble: I could not read it. Try more light, or type the NAFDAC number.
        U->>UI: Types reg no.
    else Network / budget error
        UI-->>U: Bubble: Reader is unavailable. Type the NAFDAC number instead.
        U->>UI: Types reg no.
    end
    U->>UI: Edits chip(s), taps Looks right
    UI->>DB: Confirmed fields
    alt Alert match or reg no. on another product
        DB-->>UI: RED + reasons + sources
        UI-->>U: Red card: pack says X, NAFDAC lists Y. Do not use. Report link.
    else Not found / expired / partial
        DB-->>UI: AMBER + reasons
        UI-->>U: Amber card: could not confirm, here is what to check
    else All match
        DB-->>UI: GREEN + sources
        UI-->>U: Green card: no problems found in NAFDAC records
    else Lookup error
        DB-->>UI: Error
        UI-->>U: Bubble: Check failed. [Retry]
    end
    U->>UI: Ask follow-up or send another photo
```

**Pros:** friendly, familiar (feels like WhatsApp, which is how many users would share it), natural place for follow-up questions.
**Cons:** chat invites free-form AI answers, which blurs the "code decides, not the AI" message judges should hear; free-form follow-ups burn the $40 budget; verdicts are harder to make visually striking inside a chat stream.

---

## Ratings

Scored 1 to 5 for a hackathon demo with ~11 hours left and one frontend dev.

| Criterion | A · Wizard | B · Single screen | C · Dual entry | D · Chat |
|---|:-:|:-:|:-:|:-:|
| Build speed tonight | 5 | 3 | 3 | 3 |
| Demo clarity in a 3-min video | 5 | 4 | 3 | 3 |
| Shows the R3 mismatch hero moment | 4 | 5 | 3 | 4 |
| Shows "user confirms, code decides" | 5 | 4 | 4 | 2 |
| Error-path robustness (survives a live AI failure) | 4 | 3 | 5 | 4 |
| Wow / polish | 3 | 5 | 3 | 4 |
| AI budget safety | 5 | 5 | 5 | 2 |
| **Total (out of 35)** | **31** | **29** | **26** | **22** |

## Recommendation: Flow A (wizard), borrowing two pieces from B and C

Build **Flow A**. It is the fastest to ship, every step maps to a sentence in the video ("snap it, the AI reads it, you confirm it, code checks it"), and the Confirm step makes the human-in-the-loop design obvious to judges.

Two cheap upgrades make it the best of all four:

1. **From B:** on the red mismatch result, show a side-by-side "what the pack says vs what NAFDAC lists" with the mismatched field highlighted. This is the hero shot, so spend polish here.
2. **From C:** the "Type it in" manual path off every read error. It costs one form and means the demo survives a dead AI call or an exhausted budget.

Skip history, the offline queue and chat for now; add history only if there is time after the video is recorded.

Suggested component list for Flow A: `Landing`, `CaptureStep`, `ReadingStep` (loading + errors), `ConfirmStep` (editable field rows with confidence), `ManualEntry`, `ResultStep` (`VerdictBanner`, `MismatchCompare`, `SourcesPanel`, `ActionsBar`), plus a `Stepper` header.

---

## The detailed Flow A diagram (plain language)

Drawn for the whole team, including the non-engineers, after Flow A was chosen. Blue boxes are screens, orange boxes are problems with a way out, diamonds are choices the app makes.

```mermaid
flowchart TD
    %% ===== HOW TO READ THIS =====
    %% Blue = a screen the user sees
    %% Grey = the app is working (loading)
    %% Orange = something went wrong, here is the fix
    %% Diamond = the app makes a choice
    %% Red / Yellow / Green = the final answer

    START(["📱 User opens MedCheck"]) --> HOME

    HOME["🏠 HOME SCREEN<br/>Shows: what MedCheck does<br/>Button: Check a medicine"]
    HOME -->|"User taps<br/>Check a medicine"| SNAP

    %% ---------- STEP 1 ----------
    subgraph STEP1["STEP 1 · SNAP: take a photo of the box"]
        SNAP["📷 CAMERA SCREEN<br/>Shows: a box outline to line up the pack<br/>Buttons: Take photo · Upload photo"]
        SNAP -->|"User takes or<br/>picks a photo"| PREVIEW
        PREVIEW["🖼️ PHOTO PREVIEW<br/>Shows: the photo they just took<br/>Buttons: Retake · Use this photo"]
        PREVIEW -->|"Photo is bad,<br/>user taps Retake"| SNAP
    end

    PREVIEW -->|"User taps<br/>Use this photo"| READING

    %% ---------- STEP 2 ----------
    subgraph STEP2["STEP 2 · READ: the AI reads the words on the box"]
        READING["⏳ LOADING<br/>Shows: Reading the label...<br/>Behind the scenes: photo is sent to the AI"]
        READING --> READOK{"Could the AI<br/>read the box?"}
        READOK -->|"No, photo too<br/>blurry or dark"| ERRBLUR["⚠️ PROBLEM: Could not read the box<br/>Tip: more light, hold it flat<br/>Buttons: Retake · Type it in"]
        READOK -->|"No, internet or<br/>AI is down"| ERRNET["⚠️ PROBLEM: Could not reach the reader<br/>Buttons: Try again · Type it in"]
    end

    ERRBLUR -->|"Retake"| SNAP
    ERRNET -->|"Try again"| READING
    ERRBLUR -->|"Type it in"| MANUAL
    ERRNET -->|"Type it in"| MANUAL

    READOK -->|"Yes ✅"| CONFIRM

    %% ---------- STEP 3 ----------
    subgraph STEP3["STEP 3 · CONFIRM: the person checks what the AI read"]
        CONFIRM["✍️ CHECK THE DETAILS<br/>Shows a list:<br/>• Medicine name<br/>• Company that made it<br/>• NAFDAC number<br/>• Batch number<br/>• Expiry date<br/>Unsure lines are highlighted yellow"]
        CONFIRM -->|"A line is wrong,<br/>user fixes it"| CONFIRM
        CONFIRM --> ALLOK{"Every line ticked<br/>and NAFDAC number<br/>looks right?"}
        ALLOK -->|"Not yet"| NOTYET["⚠️ Check button stays grey<br/>Shows: Confirm 2 more lines<br/>or: NAFDAC numbers look like A4-1234"]
        NOTYET -.->|"User fixes it"| CONFIRM
        MANUAL["⌨️ TYPE IT IN<br/>Same list, but the user<br/>types every line themselves<br/>Backup if the AI fails"]
    end

    ALLOK -->|"Yes, user taps<br/>Check against NAFDAC"| CHECKING
    MANUAL -->|"User taps<br/>Check against NAFDAC"| CHECKING

    %% ---------- STEP 4 ----------
    subgraph STEP4["STEP 4 · RESULT: plain code compares the details to NAFDAC records"]
        CHECKING["⏳ LOADING<br/>Shows: Checking NAFDAC records...<br/>Behind the scenes: NO AI here,<br/>just looking things up in the official lists"]
        CHECKING --> LOOKOK{"Did the<br/>lookup work?"}
        LOOKOK -->|"No"| ERRLOOK["⚠️ PROBLEM: Could not check records<br/>Details are kept, nothing lost<br/>Button: Try again"]
        LOOKOK -->|"Yes"| Q1{"Is this medicine on<br/>NAFDAC's list of<br/>fake medicine warnings?"}
        Q1 -->|"Yes"| RED1
        Q1 -->|"No"| Q2{"Is the NAFDAC number<br/>in the official list<br/>of approved medicines?"}
        Q2 -->|"No, or it has expired"| AMBER
        Q2 -->|"Yes"| Q3{"Does the official list<br/>show the SAME medicine<br/>and company as the box?"}
        Q3 -->|"No, the number belongs<br/>to a different product"| RED2
        Q3 -->|"Only partly"| AMBER
        Q3 -->|"Yes, everything matches"| GREEN

        RED1["🔴 RED<br/>This medicine matches a<br/>NAFDAC fake-medicine warning<br/>Do not take it"]
        RED2["🔴 RED · THE DEMO STAR ⭐<br/>Real NAFDAC number, WRONG product<br/>Side-by-side table:<br/>what the box says vs what NAFDAC lists"]
        AMBER["🟡 AMBER<br/>We could not confirm this medicine<br/>Be careful, ask a pharmacist"]
        GREEN["🟢 GREEN<br/>No problems found in NAFDAC records<br/>Never says genuine"]
    end

    ERRLOOK -->|"Try again"| CHECKING

    RED1 --> FINISH
    RED2 --> FINISH
    AMBER --> FINISH
    GREEN --> FINISH

    FINISH["📋 BOTTOM OF RESULT SCREEN<br/>Sources: links to the NAFDAC records used<br/>Buttons: Report to NAFDAC · Share<br/>Edit details · Check another"]
    FINISH -.->|"Check another medicine:<br/>start again"| SNAP

    %% ===== COLOURS =====
    classDef screen fill:#dbeafe,stroke:#2563eb,color:#0f172a,stroke-width:2px
    classDef loading fill:#e5e7eb,stroke:#6b7280,color:#111827,stroke-dasharray:5 3
    classDef problem fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef choice fill:#f3e8ff,stroke:#7c3aed,color:#2e1065
    classDef red fill:#fee2e2,stroke:#dc2626,color:#450a0a,stroke-width:3px
    classDef amber fill:#fef9c3,stroke:#ca8a04,color:#422006,stroke-width:3px
    classDef green fill:#dcfce7,stroke:#16a34a,color:#052e16,stroke-width:3px
    classDef start fill:#0f172a,stroke:#0f172a,color:#ffffff

    class START start
    class HOME,SNAP,PREVIEW,CONFIRM,MANUAL,FINISH screen
    class READING,CHECKING loading
    class ERRBLUR,ERRNET,NOTYET,ERRLOOK problem
    class READOK,ALLOK,LOOKOK,Q1,Q2,Q3 choice
    class RED1,RED2 red
    class AMBER amber
    class GREEN green
```

---

## What we actually built (main, Sun 25 Oct)

Flow A survived, with B's side-by-side comparison and C's typed path, as recommended. What changed on the way:

| Plan | Built | Why |
|---|---|---|
| One photo | **1 to 3 photos of one pack, any side, any order** | Packs print the reg no., batch and expiry on different sides. A guided 3-shot sequence (front, NAFDAC no., batch) was built and then removed at Eric's request: it felt like a form. See the [process log](../process-log.md#951-pm-the-photo-flow-reversal). |
| Snap step = file input | Live camera with 7 handled states (prompt, live, denied, no camera, busy, insecure http, tab hidden) plus multi-pick from the photo library | [Hardening pass](04-hardening.md) |
| 3 tiers | 4 tiers from `shared/legend.ts` | Backend spec |
| Per-row ✓ on every field | One "These details match the pack" tick, but low-confidence rows must be tapped ("Looks right") or edited first; any edit un-ticks | Decision 8 in the [design decisions](../design/decisions.md) |
| Stepper Snap · Read · Confirm · Result on every path | Typed path shows Type · Check · Result | UX critique #10: the stepper "lied" on the typed path |
| Report as a mailto link | Report screen: editable draft to NAFDAC, Send email / Call / Share, sent by the user | Backend spec |
| History, offline queue, chat | Not built | Cut as planned |

```mermaid
flowchart LR
    Start([Start]) -->|Scan| Snap[Snap<br/>1–3 photos]
    Start -->|Type it| Typed[Type the details]
    Snap --> Read[Read<br/>AI transcribes]
    Read -->|404 / 429 / 503| Typed
    Read -->|422 unreadable,<br/>not medicine, several packs| Snap
    Read --> Confirm[Confirm<br/>user checks every field]
    Typed --> Confirm
    Confirm -->|confirmedByUser: true| Check[Check<br/>rules engine, no AI]
    Check --> Result{Result}
    Result --> R[Red: Do not use]
    Result --> A[Amber: Check before use]
    Result --> U[Grey: We couldn't check this]
    Result --> G[Green: No problems found<br/>Not proof of authenticity]
    R --> Report[Report to NAFDAC<br/>user sends it]
    A --> Report
    U --> Report
    Result -->|Edit details| Confirm
```

Screens from the final build are in [design/screens](../design/screens/).
