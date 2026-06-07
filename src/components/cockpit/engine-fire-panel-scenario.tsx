"use client";

// HUB_TAG: ENG1_FIRE_PANEL_HUB_BASELINE_V1

// ─────────────────────────────────────────────────────────────────────────────
// FIRE panel — SCENARIO integration wrapper
//
// Embeds the canonical FIRE panel design (FireSection from
// engine-fire-panel-mockup.tsx) into the live training scenario, wired to
// ScenarioState booleans and the perform()/STEP action stream.
//
// The mockup file is the SINGLE SOURCE OF TRUTH for visual styling.  This
// file should never replicate visuals — only the outer container chrome
// (corner screws, FIRE title, cyan-teal background) is duplicated, because
// the mockup's outer container is part of its default-export demo page.
//
// Why local state for guardOpen + testActive?
//   – guardOpen is a UI-only mechanical step (no scenario step exists for
//     "lift wire guard").  The two-tap pattern is: tap 1 → guard up,
//     tap 2 → perform `eng1_fire_pb`.
//   – testActive is a TEST pb feature, not part of the ENG 1 FIRE drill.
//
// firePbOutAt is captured the first time the scenario marks `eng1_fire_pb`
// done, so the FireSection's internal 10-s SQUIB arming pulse animates.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { FireSection } from "./engine-fire-panel-mockup";

export interface EngineFireScenarioPanelProps {
  /** True when the scenario `fire_warn` trigger is active. */
  fireDetected: boolean;
  /** True when `eng1_fire_pb` step is done. */
  firePbDone:   boolean;
  /** True when `agent1` step is done. */
  agent1Disch:  boolean;
  /** True when `agent2` step is done. */
  agent2Disch:  boolean;
  /** True when the conditional AGENT 2 branch is applicable. */
  agent2Available?: boolean;
  /** Called when the user presses the FIRE pb after the guard is open. */
  onPushFirePb: () => void;
  /** Called when the user presses AGENT 1 (after 10-s arming window). */
  onPushAgent1: () => void;
  /** Called when the user presses AGENT 2. */
  onPushAgent2: () => void;
  /** Optional CSS scale; defaults to 0.55 so the panel content fits a
   *  ~260×230 slot inside the action panel row. */
  scale?: number;
  /** When true, draws the canonical outer chrome (rounded border, FIRE
   *  title, four corner screws).  Defaults to false — most embeds want
   *  only the FireSection content + cyan background, no chrome. */
  chrome?: boolean;
}

// Outer chrome — replicated from mockup default export.  Mockup file owns
// the canonical screw/title styling; if it changes there, mirror here.
const PANEL_W = 470;
const PANEL_H = 420;

// In-scenario embed crops empty cyan from all four sides of the canonical
// 470×420 panel so the cyan footprint hugs the content tighter:
//   – Top   25 %  (above ENG 1 title / FIRE-chrome area)
//   – Bot   35 %  (keeps guard cover's bottom tab visible at canonical y≈267)
//   – Left  8 %   (just clear of the vertical FIRE bar at canonical x=44)
//   – Right 15 %  (right of AGENT 2)
// Net visible area: 75 % × 35 %  of the canonical panel.  Content (FIRE
// pb / AGENT pbs / TEST / FIRE bar) keeps its current scale — only the
// background is trimmed.
const CROP_TOP_PCT   = 0.25;
const CROP_BOT_PCT   = 0.35;
const CROP_LEFT_PCT  = 0.08;
const CROP_RIGHT_PCT = 0.15;
const VISIBLE_W      = PANEL_W * (1 - CROP_LEFT_PCT - CROP_RIGHT_PCT); // 352.5
const VISIBLE_H      = PANEL_H * (1 - CROP_TOP_PCT - CROP_BOT_PCT);    // 147

export function EngineFireScenarioPanel({
  fireDetected,
  firePbDone,
  agent1Disch,
  agent2Disch,
  agent2Available = false,
  onPushFirePb,
  onPushAgent1,
  onPushAgent2,
  // Bumped 0.55 → 0.80 so content (AGENT pbs, FIRE pb, FIRE bar, TEST)
  // grows proportionally into the shorter cropped panel — keeps the
  // tap-target sizes usable now that empty cyan above/below is clipped.
  scale  = 0.80,
  chrome = false,
}: EngineFireScenarioPanelProps) {
  // UI-local state (no scenario step backs these).
  const [guardOpen,  setGuardOpen]  = useState(false);
  const [testActive, setTestActive] = useState(false);

  // Capture the moment the scenario marks `eng1_fire_pb` done so the
  // FireSection's 10-s SQUIB arming pulse can run.  Once captured, never
  // overwritten.
  const [firePbOutAt, setFirePbOutAt] = useState<number | null>(null);
  const capturedRef = useRef(false);
  useEffect(() => {
    if (firePbDone && !capturedRef.current) {
      capturedRef.current = true;
      setFirePbOutAt(Date.now());
    }
  }, [firePbDone]);

  // Click handlers — the FIRE pb's two-tap pattern is owned by FireSection's
  // FirePushbutton component (tap 1 opens guard locally; tap 2 calls
  // onPushFirePb).  We expose the same callbacks the mockup uses.
  const handleOpenGuard = () => setGuardOpen(true);
  const handlePushFirePb = () => {
    if (firePbDone) return;
    onPushFirePb();
  };
  const handlePushAgent1 = () => {
    if (agent1Disch) return;
    onPushAgent1();
  };
  const handlePushAgent2 = () => {
    if (agent2Disch) return;
    onPushAgent2();
  };
  const handleToggleTest = () => setTestActive(t => !t);

  const fireSectionEl = (
    <FireSection
      title="ENG 1"
      testSide="left"
      fireDetected={fireDetected}
      guardOpen={guardOpen}
      firePbOut={firePbDone}
      firePbOutAt={firePbOutAt}
      agent1Disch={agent1Disch}
      agent2Disch={agent2Disch}
      agent2Available={agent2Available}
      testActive={testActive}
      onOpenGuard={handleOpenGuard}
      onPushFirePb={handlePushFirePb}
      onPushAgent1={handlePushAgent1}
      onPushAgent2={handlePushAgent2}
      onPushTest={handleToggleTest}
    />
  );

  // Chrome mode = uncropped canonical look (full 470×420).  Chromeless
  // embed = cropped on all four sides so the cyan footprint matches the
  // content density better in the scenario row.
  const cropEnabled = !chrome;
  const renderedW   = (cropEnabled ? VISIBLE_W : PANEL_W) * scale;
  const renderedH   = (cropEnabled ? VISIBLE_H : PANEL_H) * scale;
  // Shift FireSection so the cropped window's top-left aligns with the
  // (CROP_LEFT_PCT × PANEL_W, CROP_TOP_PCT × PANEL_H) point of the
  // canonical layout.  translateX/Y values are in pre-scale units because
  // the transform applies scale first, then translate, with origin top-left.
  const innerLeftShift = cropEnabled ? -PANEL_W * CROP_LEFT_PCT : 0;
  const innerTopShift  = cropEnabled ? -PANEL_H * CROP_TOP_PCT  : 0;

  return (
    <div
      style={{
        width:  renderedW,
        height: renderedH,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className={chrome ? "relative rounded-xl border shadow-2xl flex" : "relative flex"}
        style={{
          width:  PANEL_W,
          height: PANEL_H,
          transform: `scale(${scale}) translate(${innerLeftShift}px, ${innerTopShift}px)`,
          transformOrigin: "top left",
          background: "linear-gradient(to bottom, #75B5C5 0%, #5A98A8 100%)",
          // Chrome on = canonical mockup look; off = bare cyan background
          // with the FireSection content only (the user's preferred embed
          // for the in-scenario action panel).
          ...(chrome
            ? { border: "1px solid #1D1818", boxShadow: "inset 0 0 25px rgba(0,0,0,0.45), 0 0 30px rgba(0,0,0,0.5)" }
            : { boxShadow: "inset 0 0 18px rgba(0,0,0,0.35)" }),
        }}
      >
        {chrome && (
          <>
            {/* Four corner panel screws — replicated from mockup */}
            {[[12, 12], [446, 12], [12, 396], [446, 396]].map(([x, y], i) => (
              <div key={i} className="absolute rounded-full"
                style={{
                  left: x, top: y, width: 12, height: 12,
                  background: "radial-gradient(circle at 30% 30%, #c8ced6 0%, #6a7280 60%, #2a303a 100%)",
                  boxShadow: "0 1px 1px rgba(0,0,0,0.55)",
                  border: "1px solid #2a303a",
                }}
              />
            ))}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 text-gray-200 font-bold"
                 style={{ letterSpacing: "6px", fontSize: "20px", fontFamily: "monospace" }}>
              FIRE
            </div>
          </>
        )}
        {fireSectionEl}
      </div>
    </div>
  );
}
