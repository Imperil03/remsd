# РемСД

Статический сайт на HTML, CSS и JS для компании по ремонту грузовых автомобилей и спецтехники в Сургуте.

## Структура

- `src/pages/` — страницы с подключаемыми partials.
- `src/partials/` — общие блоки: шапка, hero, брендовые карточки, перечень услуг, SEO/FAQ-блоки, футер, мобильная CTA-плашка.
- `src/data/seo-pages.json` — контент SEO-страниц услуг и служебных разделов.
- `src/templates/seo-page.html` — шаблон генерируемых SEO-страниц.
- `assets/css/styles.css` — дизайн-система и стили.
- `assets/js/main.js` — поведение мобильного меню, нижней CTA-плашки и просмотра медиа.
- `assets/img/brands/`, `assets/img/gallery/`, `assets/img/certificates/` — оптимизированные WebP-медиа с remsd.ru, включая превью и крупные версии для просмотра.
- `docs/design-guideline.md` — короткий дизайн-гайд.
- `docs/project-handoff.md` — текущий контекст, решения и ближайшие шаги.
- `tools/build.js` — сборка готового сайта в `dist/`.
- `tools/prepare-media.js` — загрузка и оптимизация фото/логотипов из исходного сайта.
- `.agent/` — проектные инструкции, SEO-структура и текстовые agent-роли.
- `docs/skills.md` — инструкция по project skills, лицензиям, установке на другом компьютере и правилам конфликтов.

## Сборка

```bash
node tools/build.js
```

Готовый файл главной страницы появится в `dist/index.html`.

Если нужно заново подготовить фото и логотипы с remsd.ru:

```bash
npm.cmd install
npm.cmd run prepare:media
```

Скрипт сохраняет только оптимизированные WebP-файлы, без исходных тяжелых изображений и метаданных.

В PowerShell `npm run build` может блокироваться системной политикой. В этом случае используйте `node tools/build.js` или `npm.cmd run build`.

Версия CSS/JS задается в `tools/build.js` через `assetVersion`. При необходимости можно переопределить:

```bash
ASSET_VERSION=20260509 node tools/build.js
```

В PowerShell:

```powershell
$env:ASSET_VERSION = "20260509"; node tools/build.js
```

## Текущий статус

- Бывшая v3-главная перенесена в production `/`; отдельные `/v2/` и `/v3/` удалены.
- Главная собрана из v3-only partials: hero, категории техники, марки грузовиков, блок грузового автосервиса, типы спецтехники, услуги по узлам, доказательный блок базы, контактный сценарий и отдельный footer.
- Шапка использует кириллический логотип, меню, адрес `Сургут, Домостроителей, 13`, email `info@remsd.ru` и телефон. На мобильных адрес/email и верхний телефон скрываются.
- Mega-menu `Ремонт` построен вокруг трех выборов: тип техники, спецтехника, марки грузовиков. КАМАЗ, МАЗ и УРАЛ идут первыми как существующие официальные страницы; остальные брендовые URL пока placeholder через `data-future-href`.
- В группе `Марки грузовиков` не выводится отдельная строка `Официальный сервис`: статус передан порядком, компактными маркерами и `aria-label`.
- Dropdown `Аренда техники` отделен от ремонта и использует отдельную промо-карточку с фото автокрана.
- Брендовые страницы КАМАЗ, МАЗ и УРАЛ — первый SEO-слой; общие страницы по узлам остаются support-контентом.
- Страницы `/remontnaya-baza/` и `/sertifikaty/` сделаны отдельными HTML-страницами, а не generic SEO-шаблонами.
- Основная SEO-структура хранится в `.agent/SEO_STRUCTURE.md`; текущий handoff — в `docs/project-handoff.md`.
- Удаленные `.agent/CONTENT_GUIDE.md`, `.agent/CLAIMS_LEDGER.md` и `.agent/skills/` не восстанавливать без отдельного запроса.

## Деплой

GitHub Pages забирает собранный `dist/` из workflow. После изменения исходников нужно запускать сборку и коммитить обновленный `dist/`.

Проверить прод:

- https://imperil03.github.io/remsd/
- https://imperil03.github.io/remsd/remont/kamaz/
- https://imperil03.github.io/remsd/remont/maz/
- https://imperil03.github.io/remsd/remont/ural/
- https://imperil03.github.io/remsd/remont-gbc/
