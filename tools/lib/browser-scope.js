function selectBrowserScope(pagePaths, referencePath, value = "") {
  const routes = [...new Set(value.split(",").map((route) => route.trim()).filter(Boolean)
    .map((route) => `/${route.replace(/^\/+|\/+$/g, "")}/`.replace("//", "/")))];
  if (value.trim() && !routes.length) throw new Error("BROWSER_ROUTES: пустой список маршрутов");
  const known = new Set(["/", ...pagePaths.map((route) => `/${route}/`)]);
  for (const route of routes) if (!known.has(route)) throw new Error(`BROWSER_ROUTES: неизвестный маршрут ${route}`);
  const focused = routes.length > 0;
  return {
    focused,
    routes,
    home: !focused || routes.includes("/"),
    reference: !focused || routes.includes(`/${referencePath}/`),
    additional: pagePaths.filter((route) => route !== referencePath && (!focused || routes.includes(`/${route}/`))),
  };
}

module.exports = { selectBrowserScope };
