function monitorBrowserErrors(page) {
  const errors = [];
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  let label = "Browser", expectedStatus = 200;
  return {
    begin(name, status) { label = name; expectedStatus = status; errors.length = 0; },
    assert() {
      const relevant = expectedStatus === 404 ? errors.filter(error => !/^console: Failed to load resource: the server responded with a status of 404/.test(error)) : errors;
      if (relevant.length) throw new Error(`${label}: ${relevant.join("; ")}`);
    },
  };
}
module.exports = { monitorBrowserErrors };
