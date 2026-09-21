# Arc wordmark reference

The user selected a clean “Arc” wordmark on2026-09-21. `arc-wordmark-reference.png` was generated with the built-in image-generation tool, then reconstructed as outlined SVG geometry in `public/arc-wordmark.svg` for consistent web and Android use. The SVG is the implementation master; do not derive launcher artwork from an unrelated font or reintroduce the rejected A-symbol.

Final generation prompt: preserve the Arc lettering and its proportions; remove glow, shadows, blur and bevel; use flat ivory `#faf9f6` lettering on an opaque deep green `#242d2a` square; center the word with generous margins; no extra wording, effects or mockup. No CLI/image API key was used.

Run `node scripts/generate-arc-icons.mjs` after editing the master. The Android build does this automatically. The asset generator emits SVGs and Android vectors with one shared letter geometry, separate monochrome/foreground/background, and a checked adaptive safe area.
