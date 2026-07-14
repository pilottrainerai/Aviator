# ECAM Logic Mapping

How the ECAM system works. Use this when designing or reviewing
`src/engine/ecam/*` and `src/components/ewd/*`.

## What ECAM is (Electronic Centralised Aircraft Monitor)

ECAM is two displays + the warning system:

- **EWD** (Engine/Warning Display, upper-center) — engine parameters at
  top; warning, caution, and MEMO area at bottom.
- **SD** (System Display, lower-center) — system pages, auto-switched on
  failure, manually selectable via ECAM control panel.
- **FWC** (Flight Warning Computer) — drives the alerts; two redundant
  units (FWC 1 and 2).

A failure of **FWS-FWC 1+2** disables ALL ECAM warnings, master warn/caut
lights, and aural warnings. In that case the crew has only the overhead
red FIRE light — the procedure must be looked up in the FCOM (it is not
in the QRH either). Source: `abnormal-notes.txt`, p3.

## Alert levels

| Level | Display | Aural | Crew response |
|---|---|---|---|
| **3 — Warning** (red) | Red ECAM line + MASTER WARN red | Continuous repetitive chime (CRC) for fire; cavalry charge for AP disconnect; specific synthetic voices for some | Immediate action |
| **2 — Caution** (amber) | Amber ECAM line + MASTER CAUT amber | Single chime | Action required, less time-critical |
| **1 — Advisory** | Pulsing parameter on SD; no master light | None | Awareness; monitor parameter |
| **MEMO** | Green/white text in MEMO area | None | Status reminder (e.g. "SEAT BELTS", "LDG INHIBIT") |

Inhibit phases exist (e.g. T.O. INHIBIT, LDG INHIBIT) where some alerts
are suppressed so they don't trigger during critical flight phases.

## Procedure rendering (L1 / L2 lines)

ECAM procedure lines have two roles:

- **`L1`** = action line. Format: `ITEM NAME ........... ACTION` with
  dotted leader; **action right-justified, uppercase**. The crew reads
  these aloud and acts.
- **`L2`** = sub-note. Italic or muted color. Conditions, results,
  explanations. **Never read aloud as an action.**

Example (FCOM ENG 1(2) FIRE on ground):
```
ENG MASTER (AFFECTED) ............................... OFF       ← L1 action
  LP and HP valves close.                                       ← L2 note
ENG FIRE P/B (AFFECTED) .............................. PUSH     ← L1
  Aural warning stops.                                          ← L2
  ENG FIRE pb remains on, as long as a fire is detected.        ← L2
  FADEC is no longer supplied.                                  ← L2
AGENT 1 AFTER 10 S .................................. DISCH    ← L1
  The 10 s delay allows N1 to decrease...                       ← L2
ATC ................................................ NOTIFY   ← L1
```

Render L1 and L2 visually distinct in the EWD.

## Primary & secondary failure display (FCOM DSC-31-15)

Verbatim rule `[fcom:L53500-53501]`:
> "The ECAM DU displays **a primary failure as a boxed title**. It identifies a
> **secondary failure by putting a star in front** of the title of the affected system."

- **Primary failure = boxed title.** The box frames the failure NAME. The underlined
  system prefix (HYD / F/CTL / AUTO FLT / ENG …) sits *before* the box; only the failure
  name is boxed. So `HYD [G+Y SYS LO PR]` and `[ENG 1 FIRE]` are both correctly boxed —
  boxing a primary title is FCOM-correct, not a bug.
- **Secondary failure = `* <SYSTEM>`** under a `SECONDARY FAILURES` header, in the right
  column. System name is terse (`* HYD`, `* FUEL`, `* F/CTL`, `* AVNCS VENT` — see the
  DSC-31-15 worked example `[fcom:L89371]`).
- **Overflow symbol** (green ↓) shows if primary or secondary failures overflow the area.
- **ELEC EMER CONFIG inhibits** secondary failures (they are not displayed) `[fcom:L53502]`.

**Sourcing the secondary list — they ARE in FCOM.** A "secondary failure" is *the loss of a
system resulting from the primary* `[fcom:L53140]`. The FCOM abnormal procedure **prints the
secondary list in its right column, below LAND ASAP, under a `SECONDARY FAILURES` header** —
do NOT invent it, and do NOT assume redundancy (GEN 2 / PTU / BLEED 2) removes it: the star
marks the *affected* system, which still shows even when a redundant source covers the
function. When a failure leads to an ASSOCIATED procedure, the secondaries live on that
procedure's page. Worked source — **ENG 1(2) SHUT DOWN** (where ENG 1(2) FIRE lands after
securing), PRO-ABN-ENG P 72/94: below LAND ASAP → `* HYD` / `* ELEC` / `* AIR BLEED`
`[fcom:L96079-L96083]`. To find any failure's secondaries: `grep -n "SECONDARY FAILURES"`
the procedure region, read the `*`-lines. (The DSC-31-15 *illustration* is a figure, but the
per-procedure `SECONDARY FAILURES` blocks ARE text.)

## Conditional branches

ECAM procedures branch on sub-conditions, marked with bullets:

```
■ IF UNSUCCESSFUL:
   BUS TIE ......................................... OFF
   GEN 1 + 2 ....................................... OFF THEN ON
```

Render branches as nested groups with the condition as a header.

## Action verbs (exact)

The crew is trained to expect specific verbs. Don't paraphrase:

| Verb | Meaning |
|---|---|
| `OFF` | Set switch/pb to off position |
| `ON` | Set to on |
| `OFF THEN ON` | Cycle off, then back on |
| `PUSH` | Press a guarded latching pb (releases it) |
| `PRESS` | Press a momentary pb |
| `SET` | Configure to specified value |
| `CHECK` | Verify; do not change |
| `DISCH` | Discharge fire agent |
| `CRANK` | Mode selector to CRANK position |
| `AS RQRD` | Configure as appropriate to situation |
| `NOTIFY` | Inform (typically ATC) |
| `MAN` | Manual mode |
| `MAINTAIN` | Hold current value |

## Memory items

Some procedures begin with **memory items** the crew must execute *before*
opening the ECAM:

- EMER DESCENT
- STALL RECOVERY
- WINDSHEAR
- UNRELIABLE SPEED INDICATION
- LOSS OF BRAKING
- (and a few others, type-specific)

Render memory items in a **distinct visual style** — historically a red
border or red-text panel, "MEMORY" tagged. They are NOT rendered as ECAM
line actions in the EWD because there's no ECAM yet — the crew is
working from training.

## ECAM clear / recall

- **CLR** pb (ECAM control panel): clears the current ECAM warning/caution
  page after actions are complete. Removes from EWD list.
- **RCL** pb: recalls the most recently cleared item. Useful for review
  or resuming an interrupted procedure.

## STATUS page

After all warnings/cautions are cleared, the SD auto-switches to STATUS,
which shows:

- **STATUS** column: operational status messages, advisories
  (e.g. "GA THR : LVR CLB ABV TGD ALT")
- **INOP SYS** column: list of systems inoperative as a result of the
  failure (e.g. `ELAC 1`, `CAT 3 DUAL`, `FUEL CONSUMPT INCRSD`)
- **LAND ASAP** banner — red OR amber, semantic (see below)

## LAND ASAP semantics

- **Red LAND ASAP** = time-critical. Crew lands at the **nearest airport**
  at which a safe landing can be made. Default radio call: MAYDAY.
- **Amber LAND ASAP** = consider landing at the **nearest suitable**
  airport (suitability per operator policy). Default: PAN-PAN.
- The color **changes** the radio call. Announcing the color when
  reviewing STATUS is part of CRM: "STATUS: LAND ASAP RED — MAYDAY."

## INOP SYS list (training-relevant)

Many ECAM procedures result in INOP systems beyond what the immediate
warning suggests. Source `abnormal-notes.txt` p12 lists examples for AC
ESS BUS SHED — `MCDU 1`, `CVR`, `Passenger oxygen masks (auto + manual)`,
etc. — some of which are ONLY in FCOM, not on the ECAM. Capture those
when modeling.

## FCTM-only nuances

The FCTM contains technique that supplements ECAM/FCOM:

- AVIONICS SMOKE: only apply if smoke is **perceptible**. Else stop and
  consider spurious. *Source: abnormal-notes.txt p13, FCTM AS section.*
- ENG 1 SHUTDOWN: technique guidance for inflight failure vs ground
  shutdown. *FCTM AO/AS sections.*
- Engine Tailpipe Fire: only at start or shutdown — distinct from engine
  fire. Procedure: stop fuel flow, ventilate engine. *FCTM topic.*

When modeling these, label each as `official-source-derived: FCTM`.

## Data shape sketch (for state-machine work)

```ts
type AlertLevel = 'WARNING' | 'CAUTION' | 'ADVISORY' | 'MEMO';

type EcamLine =
  | { kind: 'L1'; itemName: string; action: string; done?: boolean }
  | { kind: 'L2'; text: string }
  | { kind: 'BRANCH'; condition: string; lines: EcamLine[] };

type EcamWarning = {
  id: string;              // e.g. 'eng-1-fire-on-ground'
  title: string;           // e.g. 'ENG 1 FIRE'
  level: AlertLevel;
  trigger: TriggerSpec;    // when this warning fires
  procedureLines: EcamLine[];
  memoryItems?: MemoryItem[];
  status: {
    landAsap?: 'RED' | 'AMBER';
    inopSys: string[];
    statusMessages: string[];
  };
  source: { fcom?: string; fctm?: string; qrh?: string };
};
```

This shape is illustrative — match it to whatever the existing
`src/engine/ecam/*` already uses. Don't introduce a new shape unless
the user asks.

## Anti-patterns

- ❌ Treating L2 lines as actions.
- ❌ Hardcoding `LAND ASAP` color to red for all scenarios.
- ❌ Modeling `MASTER WARN` press as "clearing the warning" — it only
  silences the aural and visual.
- ❌ Putting MEMO items in the ECAM warning list. MEMO is a separate
  area of the EWD.
- ❌ Skipping STATUS — the procedure isn't complete until STATUS is
  reviewed.
- ❌ Ignoring inhibit phases. T.O. INHIBIT exists for a reason.
