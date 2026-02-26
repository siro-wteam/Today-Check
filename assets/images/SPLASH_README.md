# Splash screen assets

- **Source (vector):** `splash-screen.svg`  
  - Icon, "TodayCheck", and tagline are drawn smaller for a cleaner look.
  - Edit this file to change design; then re-export PNG.

- **Runtime asset:** `splash-screen.png`  
  - Used by `expo-splash-screen` in `app.json`.
  - Generated at **3x** (1242×2688) from the SVG so it stays sharp on all devices.

## Re-export after editing the SVG

```bash
npm run splash:export
```

This overwrites `splash-screen.png` with a high-resolution export from `splash-screen.svg`.
