# Pending patches — copy-paste handoff

This doc collects every change Claude could not write directly because of an
EPERM permission revocation on this Aviator directory. Apply each block in
your editor, save, then run the git steps at the bottom to push for the team.

> **Why this doc exists**: a previous Claude session lost macOS TCC file
> permission on `/Users/czar/Desktop/pilottrainerai/Aviator` mid-session. Read,
> Edit, Write-overwrite, and subprocess execution all return `EPERM`. New-file
> writes still work — that's how this doc + `instruments-and-panels.md` +
> `nd-mockup.tsx` updates landed. Everything else is below for paste.

---

## 1. macOS permission fix (so Claude can resume direct edits)

1. Quit Claude Code fully (`⌘Q`, or right-click the dock icon → Quit).
2. **System Settings → Privacy & Security → Files and Folders → Claude Code**
   - Toggle **Desktop Folder** ON (and Documents Folder if asked).
3. Reopen Claude Code. macOS may show a TCC dialog — click **Allow**.
4. After that, Claude can edit files directly and you won't need this handoff
   doc for future iterations.

---

## 2. PFD patches — `src/components/cockpit/pfd-mockup.tsx`

### 2.1 Replace the FMA function

Find `const drawFMA = () => {` (around line 110-ish) and replace through its
closing `};` with:

```ts
    const drawFMA = () => {
      const live = stateRef.current ? buildAircraftState(stateRef.current) : null;
      const thrMode  = live?.thrMode  ?? "MAN TOGA";
      const vertMode = live?.vertMode ?? "SRS";
      const latMode  = live?.latMode  ?? "RWY TRK";
      const apEngaged  = !!live?.apEngaged;
      const athrActive = live?.athrActive ?? true;
      const eng1Fail   = !!live?.eng1Failed;

      const C_ACTIVE = "#00ff00";
      const C_ARMED  = "#00bfff";  // FCOM blue for armed modes
      const C_WHITE  = "#ffffff";
      const C_AMBER  = "#ffb000";

      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, FH);
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
      [105, 210, 312, 418].forEach(x => line(x, 2, x, FH - 2, "#555", 1));
      line(0, FH - 1, W, FH - 1, "#555", 1);

      const activeBox = (x: number, w: number) => {
        const g = ctx.createLinearGradient(0, 2, 0, 30);
        g.addColorStop(0, "#003300");
        g.addColorStop(1, "#001a00");
        ctx.fillStyle = g; ctx.fillRect(x, 2, w, 28);
      };
      activeBox(2, 102); activeBox(107, 102); activeBox(213, 98);

      // Row 1 — ACTIVE modes (GREEN)
      txt(thrMode,  52,  16, 14, C_ACTIVE, "center", true, 5);
      txt(vertMode, 156, 16, 14, C_ACTIVE, "center", true, 5);
      txt(latMode,  260, 16, 14, C_ACTIVE, "center", true, 5);
      if (apEngaged)  txt("AP1",    466, 13, 11, C_WHITE, "center", true);
      txt("1 FD 2", 466, 30, 11, C_WHITE, "center", true);
      if (athrActive) txt("A/THR",  466, 47, 11, C_WHITE, "center", true);

      // Row 2 — ARMED modes (BLUE)
      ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 30, W, 28);
      txt("CLB", 156, 44, 12, C_ARMED, "center", true, 3);
      txt("NAV", 260, 44, 12, C_ARMED, "center", true, 3);
      if (eng1Fail) txt("ENG OUT", 362, 44, 11, C_AMBER, "center", true, 3);

      ctx.fillStyle = "#111"; ctx.fillRect(0, 58, W, FH - 58);
      line(0, 58, W, 58, "#444", 1);
    };
```

### 2.2 Symmetric FD bars (in `drawADI`)

Find:

```ts
      // Flight Director crosshairs — with subtle green CRT glow
      ctx.save(); ctx.translate(cx, cy);
      ctx.shadowColor = "#00dd00";
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "#00dd00"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-60, -14); ctx.lineTo(60, -14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( 18, -48); ctx.lineTo(18,  28); ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.restore();
```

Replace with:

```ts
      // Flight Director — symmetric crossed bars, centred on aircraft
      const fdPitchOffset = -12;   // climb command (above center)
      const fdRollOffset  = 0;     // wings level (centred)
      ctx.save(); ctx.translate(cx, cy);
      ctx.shadowColor = "#00dd00";
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "#00dd00"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-55, fdPitchOffset); ctx.lineTo(55, fdPitchOffset); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fdRollOffset, -45); ctx.lineTo(fdRollOffset,  45); ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.restore();
```

### 2.3 VS pointer from LEFT edge (in `drawVS`)

Find:

```ts
      const vc = Math.max(-2000, Math.min(2000, d.vs));
      const ny = mid - (vc / 2000) * (h / 2 - 22);
      ctx.strokeStyle = "#00cc00"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, mid); ctx.lineTo(x + w - 4, ny); ctx.stroke();
```

Replace with:

```ts
      const vc = Math.max(-2000, Math.min(2000, d.vs));
      const ny = mid - (vc / 2000) * (h / 2 - 22);
      ctx.strokeStyle = "#00cc00"; ctx.lineWidth = 3;
      // Pivot from LEFT edge of VS strip → tip at value position on RIGHT
      ctx.beginPath();
      ctx.moveTo(x + 2, mid);
      ctx.lineTo(x + w - 4, ny);
      ctx.stroke();
```

---

## 3. FIRE panel patch — `src/components/cockpit/fire-panel.tsx`

FIRE pb is **wider than tall** per FCOM (longer length, not taller).

### 3.1 Widen the pb container

Find (around line ~285):

```ts
        width: large ? "90px" : wide ? "80px" : "68px",
```

Replace with:

```ts
        width: large ? "108px" : wide ? "80px" : "68px",
```

### 3.2 Reduce legend cell height (so the pb looks landscape, not portrait)

Find (around line ~462):

```ts
            padding: large ? "12px 6px 10px" : "4px 5px",
            textAlign: "center",
            minHeight: large ? "40px" : "24px",
```

Replace with:

```ts
            padding: large ? "8px 6px 6px" : "4px 5px",
            textAlign: "center",
            minHeight: large ? "26px" : "24px",
```

This produces a ~108 × ~62 pb (length 1.7× height) — matches the FCOM photo
proportions for ENG 1(2) FIRE pb.

---

## 4. Files Claude already wrote in this session ✅

These are committed to disk; just include them in the next git push.

| File | Purpose |
|---|---|
| `src/components/cockpit/nd-mockup.tsx` | ND ARC-mode canvas, ranges 5/10/20/40 NM, click-to-cycle |
| `src/app/mockups/nd/page.tsx` | ND preview route |
| `src/components/cockpit/engine-fire-panel-mockup.tsx` | Standalone FIRE panel mockup with 10-s arming |
| `src/app/mockups/fire-panel/page.tsx` | FIRE panel preview route |
| `src/components/cockpit/pfd-mockup.tsx` | PFD canvas (without sections 2.1–2.3 yet) |
| `src/app/mockups/pfd/page.tsx` | PFD preview route |
| `docs/aviation/instruments-and-panels.md` | Full FCOM-aligned instrument reference |
| `docs/aviation/handoff-pending-patches.md` | This file |

---

## 5. Git steps to push and share

After applying §2 and §3 above, run from your terminal:

```bash
cd ~/Desktop/pilottrainerai/Aviator

# Confirm the changes
git status --short
git diff src/components/cockpit/pfd-mockup.tsx
git diff src/components/cockpit/fire-panel.tsx

# Stage everything
git add src/components/cockpit/pfd-mockup.tsx \
        src/components/cockpit/nd-mockup.tsx \
        src/components/cockpit/fire-panel.tsx \
        src/components/cockpit/engine-fire-panel-mockup.tsx \
        src/app/mockups \
        docs/aviation

# Commit
git commit -m "Add canvas PFD/ND/FIRE-panel mockups + FCOM-aligned refinements

- ND ARC mode: tens-digit headings, magenta TO leg, range 5/10/20/40 NM
- PFD: FMA active GREEN / armed BLUE / engagement WHITE; takeoff and
  ENG-FAIL mode strings (MAN TOGA / SRS / RWY TRK / CLB / NAV); symmetric
  FD bars; VS pointer from left-edge pivot to right-side value
- FIRE pb: rectangular wider-than-tall (FCOM proportions); wireframe metal
  guard; FIRE light independent of pb position
- AGENT pb: square with stacked SQUIB/DISCH; 10-s ECAM arming pulse
- ENG MASTER: FIRE/FAULT box inline below lever
- Reference docs at docs/aviation/instruments-and-panels.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

# Push to your feature branch
git push
```

If git complains about identity, prepend the commit with:
```bash
git -c user.name="rohita320-spec" -c user.email="rohit.a320@gmail.com" commit -m "..."
```

---

## 6. Sharing with the team

Once pushed, you can share via:

### Option A — direct PR link
```bash
gh pr create --base main --title "Canvas PFD/ND/FIRE mockups + FCOM refinements" \
             --body "Adds three canvas-based instrument mockups to /mockups/{pfd,nd,fire-panel} and wires PFD/ND into the live scenario at /train/eng1-fire-after-v1. Reference doc at docs/aviation/instruments-and-panels.md."
gh pr view --web
```

### Option B — branch URL
After pushing, share this URL with the team:
```
https://github.com/pilottrainerai/Aviator/tree/feat/ui-popup-layout-coach
```

### Option C — Vercel preview
The branch already has Vercel auto-deploys hooked up. After push, the team
gets a preview link automatically. Find it with:
```bash
vercel ls
```
Or in the GitHub PR — Vercel posts a comment with the preview URL.

---

## 7. URLs to test locally before pushing

```
http://localhost:3000/train/eng1-fire-after-v1   # full scenario
http://localhost:3000/mockups/pfd                # standalone PFD canvas
http://localhost:3000/mockups/nd                 # standalone ND canvas
http://localhost:3000/mockups/fire-panel         # standalone FIRE panel
```

Start dev server with:
```bash
cd ~/Desktop/pilottrainerai/Aviator && npm run dev
```
