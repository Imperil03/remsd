const postcss = require("postcss");
const { transform: transformCss } = require("lightningcss");

// Compare every descriptor after the same normalization used by the build.
// In particular, unicode-range and quoted URLs differ between source and critical CSS.
function fontFaceKey(node) {
  return transformCss({ code: Buffer.from(node.toString()), minify: true }).code.toString();
}

function isFontFace(node) {
  return node.type === "atrule" && node.name.toLowerCase() === "font-face";
}

function extractFontFaces(css) {
  const root = postcss.parse(css);
  const seen = new Set();
  const faces = postcss.root();
  for (const node of root.nodes) {
    if (!isFontFace(node)) continue;
    const key = fontFaceKey(node);
    if (seen.has(key)) continue;
    seen.add(key);
    faces.append(node.clone());
  }
  return faces.toString();
}

function removeCoveredFontFaces(css, criticalCss) {
  if (!criticalCss) return css;
  // Only unconditional definitions can replace unconditional bundle definitions.
  const covered = new Set(postcss.parse(criticalCss).nodes.filter(isFontFace).map(fontFaceKey));
  if (!covered.size) return css;
  const root = postcss.parse(css);
  for (const node of [...root.nodes]) {
    if (isFontFace(node) && covered.has(fontFaceKey(node))) node.remove();
  }
  return root.toString();
}

module.exports = { extractFontFaces, removeCoveredFontFaces };
