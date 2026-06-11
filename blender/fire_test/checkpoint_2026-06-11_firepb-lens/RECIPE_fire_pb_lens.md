# FIRE pushbutton lens — unlit↔lit recipe (2026-06-11 checkpoint)

This is the "better higher model" of the ENG1 FIRE pushbutton lens — a translucent
red-plastic lamp that reads correctly UNLIT and glows like a siren when fire is
detected. Snapshot of the working file is in this folder
(`fire-test-panel-3d.tsx`). Live file:
`src/components/cockpit/fire-test-panel-3d.tsx`. Dev: `PORT=3004 npm run dev` →
`/dev/fire-test-panel-3d`.

## The mental model (how a real ambulance/FIRE red lens behaves)

- **Unlit:** the pigment is still clearly RED in ambient light — a deep ruby red.
  NOT black, NOT orange. Only the *self-illumination* is off, not the hue.
- **Lit:** the same red, now SELF-LIT — a rich, deep, pulsing red glow. It must NOT
  wash toward orange/white. Only brightness/emissive changes; the hue stays pure red.

## The four levers that got us here

1. **Pure-red hue, both states.** Keep green ≈ blue and both TINY relative to red,
   so the color can never drift orange. The only off→on change is self-illumination.
   - Unlit body color: `#841010`  (deep ruby red)
   - Lit body color:   `#b40909`
   - Emissive (glow):  `#ff0505` via `C3.fireRed = #ff0603` (near-zero G/B)

2. **Moderate emissive, NOT 3.6.** With `NoToneMapping`, over-driving emissive clamps
   red at 1.0 and then lifts G/B → desaturates to pink/orange/white. That was the
   original "with light is LESS red" bug. Keep it low so it stays a deep lit red:
   - `setMaterialLight(eng1Fire.mesh, C3.fireRed, fireDetected ? 1.5 + pulse*1.0 : 0)`
   - `pulse = sin(t·2π)·0.5+0.5` gives the siren throb.

3. **Translucency for depth + the molded legend.** FIRE/PUSH is embossed geometry on
   the same mesh (`fire pb1 LIT` material) — NO separate text mesh/texture. It only
   reads via specular highlights on the raised edges + a red depth gradient through
   the translucent body. Settings that made it both see-through and legible:
   - `transmission: 0.58`  (see-through red plastic, short of clear glass)
   - `thickness: 0.7`, `ior: 1.5` (polycarbonate)
   - `attenuationColor: #7a0d0d`, `attenuationDistance: 0.85`
     → tints transmitted light red; longer distance = more transparent, the letters
       show as a subtle red depth gradient (thickness varies over the molding).

4. **Sharp sheen so the embossed edges catch light.**
   - `roughness: 0.2` (crisp body specular on raised letter edges)
   - `clearcoat: 1.0`, `clearcoatRoughness: 0.08`, `envMapIntensity: 1.7`
   - The HDRI env (`braustuble_alley_2k.hdr`) is what the clearcoat reflects —
     without the world env the metals/lens go flat (see PROCEDURE_blender_to_web.md).

## Gotcha: the per-frame code overrides color every frame

`useFrame` re-sets `fpMat.color` on ENG1 each frame, so the material-construction
default color is NOT what shows for ENG1 — keep the per-frame unlit color in sync
with the constructor (`#841010`). The constructor default only governs APU/ENG2,
which are not driven per-frame.

## Tuning knobs for tomorrow

- More transparent / glassier → raise `transmission` toward ~0.75, lengthen
  `attenuationDistance`. Too thin/glassy → dial both back.
- Legend not crisp enough → lower `roughness` / `clearcoatRoughness`, raise
  `envMapIntensity`.
- Lit glow too washed → lower emissive intensity; too dull → raise toward ~2.5,
  but keep the emissive hue pure red.
- Still pending from prior session: SQUIB white box, pixel-exact COMBINED bake,
  AGENT 2 30s FCOM gate, panel color refinements (user: panel color is "fine" but
  wants more working tomorrow).
