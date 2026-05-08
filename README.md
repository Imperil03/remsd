# РемСД

Статический сайт на HTML, CSS и JS для компании по ремонту грузовых автомобилей и спецтехники в Сургуте.

## Структура

- `src/pages/` — страницы с подключаемыми partials.
- `src/partials/` — общие блоки: шапка, hero, футер.
- `assets/css/styles.css` — дизайн-система и стили.
- `assets/js/main.js` — поведение меню и форм.
- `docs/design-guideline.md` — короткий дизайн-гайд.
- `tools/build.js` — сборка готового сайта в `dist/`.

## Сборка

```bash
node tools/build.js
```

Готовый файл главной страницы появится в `dist/index.html`.

В PowerShell `npm run build` может блокироваться системной политикой. В этом случае используйте `node tools/build.js` или `npm.cmd run build`.

