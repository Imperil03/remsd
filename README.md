# РемСД

Статический сайт на HTML, CSS и JS для компании по ремонту грузовых автомобилей и спецтехники в Сургуте.

## Структура

- `src/pages/` — страницы с подключаемыми partials.
- `src/partials/` — общие блоки: шапка, hero, брендовые карточки, плитки услуг, футер, мобильная CTA-плашка.
- `src/data/seo-pages.json` — контент SEO-страниц услуг и служебных разделов.
- `src/templates/seo-page.html` — шаблон генерируемых SEO-страниц.
- `assets/css/styles.css` — дизайн-система и стили.
- `assets/js/main.js` — поведение мобильного меню и нижней CTA-плашки.
- `docs/design-guideline.md` — короткий дизайн-гайд.
- `docs/project-handoff.md` — текущий контекст, решения и ближайшие шаги.
- `tools/build.js` — сборка готового сайта в `dist/`.
- `.agent/` — только проектные инструкции. Локальные копии agent skills в репозиторий не добавлять.

## Сборка

```bash
node tools/build.js
```

Готовый файл главной страницы появится в `dist/index.html`.

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

- Главная страница собрана из partials: шапка, hero, блок официального сервиса КАМАЗ/МАЗ/УРАЛ, плитка направлений ремонта, перечень услуг, строка доверия, футер.
- Брендовые страницы КАМАЗ, МАЗ и УРАЛ — первый SEO-слой; страница `/remont-gbc/` собирает низкочастотные обращения по ГБЦ без создания тонких страниц под каждую марку.
- На мобильных ширинах телефон убран из шапки, а CTA `Позвонить` появляется в нижней фиксированной плашке после начала скролла.
- Форма заявки пока не добавлена: ее планируем поставить ниже блоков услуг/доверия на следующем этапе.
- Основная SEO-структура страниц хранится в `.agent/SEO_STRUCTURE.md`, правила контента — в `.agent/CONTENT_GUIDE.md`.

## Деплой

GitHub Pages забирает собранный `dist/` из workflow. После изменения исходников нужно запускать сборку и коммитить обновленный `dist/`.

Проверить прод:

- https://imperil03.github.io/remsd/
- https://imperil03.github.io/remsd/remont/kamaz/
- https://imperil03.github.io/remsd/remont/maz/
- https://imperil03.github.io/remsd/remont/ural/
- https://imperil03.github.io/remsd/remont-gbc/
