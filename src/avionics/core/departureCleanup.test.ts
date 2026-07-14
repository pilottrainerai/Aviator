import { describe, expect, it } from "vitest";
import { departureCleanup, type DepartureConfig } from "./departureCleanup";

const CONF1: DepartureConfig = { takeoffConf: 1, v1: 140, vr: 145, v2: 150, sSpeed: 205, fSpeed: 160, greenDot: 218, climbSpeed: 230 };
const CONF2: DepartureConfig = { takeoffConf: 2, v1: 145, vr: 150, v2: 155, sSpeed: 210, fSpeed: 175, greenDot: 222 };

describe("departureCleanup — acceleration & cleanup governor", () => {
  it("takeoff roll shows V1/VR, no char speed", () => {
    const m = departureCleanup(CONF1, 145, false);
    expect(m.v1).toBe(140);
    expect(m.vr).toBe(145);
    expect(m.sSpeed).toBeUndefined();
    expect(m.greenDot).toBeUndefined();
  });

  it("CONF 1+F airborne shows GREEN S until S speed, never F", () => {
    const below = departureCleanup(CONF1, 160, true);
    expect(below.sSpeed).toBe(205);
    expect(below.fSpeed).toBeUndefined(); // a 1+F takeoff (lever 1) never shows F
    expect(below.v1).toBeUndefined();     // cleared at liftoff
    expect(below.conf).toBe(1);
  });

  it("CONF 1+F reaches green dot at S speed and accelerates to the climb speed", () => {
    const clean = departureCleanup(CONF1, 205, true);
    expect(clean.greenDot).toBe(218);
    expect(clean.sSpeed).toBeUndefined();
    expect(clean.conf).toBe(0);
    expect(clean.climbSpeed).toBe(230); // FCTM: at least 230
  });

  it("CONF 2 falls through F → S → green dot on the speed schedule", () => {
    expect(departureCleanup(CONF2, 160, true)).toMatchObject({ fSpeed: 175, conf: 2 }); // <F: flaps 2/3 → F
    expect(departureCleanup(CONF2, 175, true)).toMatchObject({ sSpeed: 210, conf: 1 }); // at F: retract to CONF 1 → S
    expect(departureCleanup(CONF2, 210, true)).toMatchObject({ greenDot: 222, conf: 0 }); // at S: clean → green dot
  });

  it("climb speed defaults to 250 (>=230) when not specified", () => {
    const m = departureCleanup(CONF2, 240, true);
    expect(m.climbSpeed).toBe(250);
    expect(m.climbSpeed).toBeGreaterThanOrEqual(230);
  });
});
