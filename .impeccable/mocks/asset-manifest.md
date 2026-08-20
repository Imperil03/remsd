# Asset manifest — `/remont-gruzovyh-avtomobiley/`

## Reuse

| Role | Public asset | Native size | Placement / crop |
| --- | --- | ---: | --- |
| Hero proof image | `assets/img/v3-structure/category-trucks.webp` | 760×560 | Use at its native 19:14 ratio with `object-fit: cover; object-position: 50% 50%`. Keep both truck cabs and the workshop context visible; do not tighten to a cinematic crop. |
| Gallery card + lightbox | `assets/img/gallery/thumb/engine-work.webp` / `large/engine-work.webp` | 720×520 / 1024×682 | Use the prepared thumb uncropped at 18:13 for the card. Use the large file uncropped/contained in the lightbox; keep the mechanic, hoist and engine block in frame. |
| Gallery card + lightbox | `assets/img/gallery/thumb/production-zone.webp` / `large/production-zone.webp` | 720×520 / 1280×960 | Use the prepared thumb uncropped at 18:13 for the card. Use the large file uncropped/contained in the lightbox; preserve the central workshop aisle and equipment on both sides. |
| Gallery card + lightbox | `assets/img/gallery/thumb/volvo-service-bay.webp` / `large/volvo-service-bay.webp` | 720×520 / 937×1080 | Use the prepared landscape thumb uncropped at 18:13 for the card. Use the portrait large file uncropped/contained in the lightbox; do not force it into a landscape crop. |
| Official brand proof | `assets/img/brands/kamaz.webp`, `maz.webp`, `ural.webp` | 300×170 each | Render with `object-fit: contain`; no crop, recolour or distortion. Normalize optically with CSS max-width/max-height inside a shared logo field. |
| Brand register | `assets/img/brands/*.webp` | 23 transparent WebP files; 174–384×107–180 | Reuse only the marks required by the supplied register. Use `object-fit: contain`, preserve transparency and intrinsic proportions; do not rasterize text or synthesize missing marks. |

## Produce

_Empty — no new public assets are needed._ The approved comp is layout guidance only: do not crop imagery from it, generate replacement workshop photographs, or create synthetic proof. Technical frames, lines, labels, controls and CTA treatment remain semantic HTML/CSS/SVG.
