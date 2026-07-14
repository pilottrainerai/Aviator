import { describe, expect, it } from "vitest";
import { approachMarkers, type ApproachConfigData } from "./approachConfig";

const CFG: ApproachConfigData = {
  greenDot: 215, sSpeed: 205, fSpeed: 165, vApp: 145,
  vls: { clean: 180, conf1: 168, conf2: 152, conf3: 142, full: 133 },
};

describe("approachMarkers — deceleration & configuration governor", () => {
  it("clean (CONF 0) shows green dot, managed = green dot", () => {
    expect(approachMarkers(CFG, 0)).toMatchObject({ greenDot: 215, managedTarget: 215, vls: 180 });
    expect(approachMarkers(CFG, 0).sSpeed).toBeUndefined();
    expect(approachMarkers(CFG, 0).fSpeed).toBeUndefined();
  });

  it("CONF 1 shows GREEN S (the bug that was skipped), managed = S", () => {
    const m = approachMarkers(CFG, 1);
    expect(m.sSpeed).toBe(205);
    expect(m.greenDot).toBeUndefined(); // NOT green dot — this was the reported defect
    expect(m.managedTarget).toBe(205);
    expect(m.vls).toBe(168);
  });

  it("CONF 2 and CONF 3 both show F (FCOM), managed = F, VLS drops", () => {
    expect(approachMarkers(CFG, 2)).toMatchObject({ fSpeed: 165, managedTarget: 165, vls: 152 });
    expect(approachMarkers(CFG, 3)).toMatchObject({ fSpeed: 165, managedTarget: 165, vls: 142 });
  });

  it("CONF FULL shows no char marker, managed = VAPP, lowest VLS", () => {
    const m = approachMarkers(CFG, 4);
    expect(m.greenDot).toBeUndefined();
    expect(m.sSpeed).toBeUndefined();
    expect(m.fSpeed).toBeUndefined();
    expect(m.managedTarget).toBe(145);
    expect(m.vls).toBe(133);
  });

  it("VLS and the alpha band DROP as flaps extend (band moves with config)", () => {
    const vls = [0, 1, 2, 3, 4].map((c) => approachMarkers(CFG, c as 0).vls);
    expect(vls).toEqual([180, 168, 152, 142, 133]); // strictly decreasing
    const m = approachMarkers(CFG, 4);
    expect(m.alphaProt).toBe(133 - 8);
    expect(m.alphaMax).toBe(133 - 16);
  });
});
