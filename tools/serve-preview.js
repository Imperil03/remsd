const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(__dirname, "../dist");
const port = Number(process.env.PREVIEW_PORT || 4179);
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".pdf": "application/pdf" };
http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname).replace(/^\/remsd\//, "/");
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const exists = fs.existsSync(file) && fs.statSync(file).isFile();
    if (!exists) file = path.join(root, '404.html');
    const stream = fs.createReadStream(file);
    stream.once('open', () => {
      res.writeHead(exists ? 200 : 404, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      stream.pipe(res);
    });
    // The build removes and repopulates dist; a request may be between stat
    // and open while that directory is rebuilt.
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '1' });
      res.end('Preview is rebuilding. Reload in a moment.');
    });
  } catch { res.writeHead(400); res.end(); }
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/arenda/`));
