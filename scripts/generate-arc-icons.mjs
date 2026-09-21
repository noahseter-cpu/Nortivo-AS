import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// One outlined master supplies web, launcher, themed icon and splash artwork.
// Regenerate with: node scripts/generate-arc-icons.mjs
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const master = await readFile(resolve(root, "public/arc-wordmark.svg"), "utf8");
const viewBox = master.match(/\bviewBox\s*=\s*["']([^"']+)["']/)?.[1]
  .trim().split(/[\s,]+/).map(Number);
if (!viewBox || viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n)) || viewBox[2] <= 0 || viewBox[3] <= 0) {
  throw new Error("Arc master must define a finite positive SVG viewBox.");
}
if (/<(?:g|text|rect|circle|ellipse|polygon|polyline|line|use|image)\b|\btransform\s*=|\bstroke\s*=/i.test(master)) {
  throw new Error("Arc master must contain outlined paths only, without transforms or strokes.");
}
const paths = [...master.matchAll(/<path\b([^>]*?)\/?\s*>/g)].map((match) => {
  const d = match[1].match(/\bd\s*=\s*(["'])(.*?)\1/s)?.[2];
  if (!d || /[<>"'&]/.test(d)) throw new Error("Arc master contains an invalid path.");
  const fillRule = match[1].match(/\bfill-rule\s*=\s*["'](evenodd|nonzero)["']/)?.[1] ?? "nonzero";
  return { d, fillRule };
});
if (!paths.length) throw new Error("Arc master has no outlined artwork.");

const dark = "#242d2a";
const ivory = "#faf9f6";
const decimal = (number) => Number(number.toFixed(9)).toString();
const fit = (canvas, width) => {
  const scale = width / viewBox[2];
  const height = viewBox[3] * scale;
  return {
    scale: decimal(scale),
    x: decimal((canvas - width) / 2 - viewBox[0] * scale),
    y: decimal((canvas - height) / 2 - viewBox[1] * scale),
    width,
    height,
  };
};
const svgPaths = paths.map(({ d, fillRule }) => `    <path fill-rule="${fillRule}" d="${d}"/>`).join("\n");
const fullSvg = () => {
  const placement = fit(512, 512 * 0.72);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title">\n  <title id="title">Arc</title>\n  <rect width="512" height="512" rx="112" fill="${dark}"/>\n  <g fill="${ivory}" transform="translate(${placement.x} ${placement.y}) scale(${placement.scale})">\n${svgPaths}\n  </g>\n</svg>\n`;
};
const nativePaths = (fill) => paths.map(({ d, fillRule }) => `    <path android:fillColor="${fill}" android:fillType="${fillRule === "evenodd" ? "evenOdd" : "nonZero"}" android:pathData="${d}"/>`).join("\n");
const nativeVector = (fill, width, background = false) => {
  const placement = fit(108, width);
  return `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n${background ? `  <path android:fillColor="${dark}" android:pathData="M24,0H84Q108,0 108,24V84Q108,108 84,108H24Q0,108 0,84V24Q0,0 24,0Z"/>\n` : ""}  <group android:scaleX="${placement.scale}" android:scaleY="${placement.scale}" android:translateX="${placement.x}" android:translateY="${placement.y}">\n${nativePaths(fill)}\n  </group>\n</vector>\n`;
};

// The centered bounding rectangle lies inside Android's 66dp safe circle.
// This is deliberately smaller than the legacy/web artwork: launcher masks
// and motion use the outer part of the 108dp adaptive canvas.
const adaptive = fit(108, 54);
const radius = Math.hypot(adaptive.width / 2, adaptive.height / 2);
if (radius > 33) throw new Error(`Arc adaptive artwork exceeds its safe circle (${radius}dp).`);
const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/arc_icon_background"/>\n  <foreground android:drawable="@drawable/noah_icon"/>\n  <monochrome android:drawable="@drawable/arc_icon_monochrome"/>\n</adaptive-icon>\n`;
const resources = "android/app/src/main/res";
const outputs = [
  ["public/arc-logo.svg", fullSvg()],
  ["public/favicon.svg", fullSvg()],
  ["public/arc-mark.svg", fullSvg()],
  [`${resources}/drawable/noah_icon.xml`, nativeVector(ivory, 54)],
  [`${resources}/drawable/arc_icon_monochrome.xml`, nativeVector("#ffffff", 54)],
  [`${resources}/drawable/arc_splash.xml`, nativeVector(dark, 54)],
  [`${resources}/mipmap-anydpi/ic_launcher.xml`, nativeVector(ivory, 108 * 0.72, true)],
  [`${resources}/mipmap-anydpi-v26/ic_launcher.xml`, adaptiveXml],
  [`${resources}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptiveXml],
  [`${resources}/values/arc_icon_colors.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="arc_icon_background">${dark}</color>\n</resources>\n`],
];
await Promise.all(outputs.map(([path, contents]) => writeFile(resolve(root, path), contents, "utf8")));
console.log(`Generated ${outputs.length} Arc assets from ${paths.length} master paths; adaptive bounds ${adaptive.width} × ${decimal(adaptive.height)}dp, corner radius ${decimal(radius)}dp (safe circle33dp).`);
