const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const port = Number(process.argv[3] || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/') pathname = '/index.html';

    const filePath = path.normalize(path.join(root, pathname));
    if (!filePath.startsWith(root)) {
      send(res, 403, 'Forbidden');
      return;
    }

    fs.stat(filePath, (statErr, stats) => {
      if (statErr || !stats.isFile()) {
        send(res, 404, 'Not Found');
        return;
      }

      const extension = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[extension] || 'application/octet-stream';
      const stream = fs.createReadStream(filePath);

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      });

      stream.pipe(res);
      stream.on('error', () => send(res, 500, 'Server Error'));
    });
  } catch (error) {
    send(res, 500, String(error && error.message ? error.message : error));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Fine Dashboard local server running at http://127.0.0.1:${port}`);
});
