function createPolicySections({ requireArray, requireText, escapeHtml: esc }) {
  const textArray = (values, label) => requireArray(values, label, { nonEmpty: true })
    .forEach((text, index) => requireText(text, `${label}[${index}]`));
  return {
    policyText: {
      validate(section, label) {
        requireArray(section.blocks, `${label}.blocks`, { nonEmpty: true }).forEach((block, index) => {
          const blockLabel = `${label}.blocks[${index}]`;
          if (block.type === "paragraph") requireText(block.text, `${blockLabel}.text`);
          else if (block.type === "list") textArray(block.items, `${blockLabel}.items`);
          else if (block.type === "table") requireArray(block.rows, `${blockLabel}.rows`, { nonEmpty: true }).forEach((row, rowIndex) => {
            requireText(row.label, `${blockLabel}.rows[${rowIndex}].label`);
            textArray(row.values, `${blockLabel}.rows[${rowIndex}].values`);
          });
          else throw new Error(`${blockLabel}.type: неизвестный текстовый блок`);
        });
      },
      render(section) {
        const list = (items) => `<ul>${items.map((text) => `<li>${esc(text)}</li>`).join("")}</ul>`;
        const blocks = section.blocks.map((block) => {
          if (block.type === "paragraph") return `<p>${esc(block.text).replaceAll("\n", "<br>")}</p>`;
          if (block.type === "list") return list(block.items);
          return `<dl class="policy-table">${block.rows.map((row) => `<div><dt>${esc(row.label)}</dt><dd>${row.values.length > 1 ? list(row.values) : esc(row.values[0])}</dd></div>`).join("")}</dl>`;
        }).join("");
        return `<section class="policy-section" id="${esc(section.id)}" aria-labelledby="${esc(section.id)}-title"><h2 id="${esc(section.id)}-title">${esc(section.title)}</h2>${blocks}</section>`;
      },
    },
  };
}

function policyText(page) {
  return [page.hero.h1, ...page.sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) =>
    block.type === "paragraph" ? [block.text] : block.type === "list" ? block.items : block.rows.flatMap((row) => [row.label, ...row.values]))])]
    .join(" ").replace(/\s+/g, " ").trim();
}

module.exports = { createPolicySections, policyText };
