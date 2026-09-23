import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import net from 'node:net';

const TARGET_PORT = 55568;
const TARGET_HOST = '127.0.0.1';
const LISTEN_PORT = 9099;

const server = http.createServer((req, res) => {
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${TARGET_HOST}:${TARGET_PORT}`,
      origin: `https://${TARGET_HOST}:${TARGET_PORT}`,
      referer: `https://${TARGET_HOST}:${TARGET_PORT}/`,
    },
    rejectUnauthorized: false,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Forward headers
    const headers = { ...proxyRes.headers };
    // Allow any origin
    headers['access-control-allow-origin'] = '*';
    headers['access-control-allow-headers'] = '*';
    delete headers['content-security-policy']; // Prevent iframe/origin blocking on mobile
    
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[Proxy Error HTTP]', err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Antigravity Proxy Error: ' + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

// Handle WebSocket / raw upgrades
server.on('upgrade', (req, socket, head) => {
  const tlsSocket = tls.connect(
    {
      host: TARGET_HOST,
      port: TARGET_PORT,
      rejectUnauthorized: false,
    },
    () => {
      // Rebuild the HTTP Upgrade request
      let rawRequest = `${req.method} ${req.url} HTTP/1.1\r\n`;
      for (const [key, val] of Object.entries(req.headers)) {
        if (key.toLowerCase() === 'host') {
          rawRequest += `host: ${TARGET_HOST}:${TARGET_PORT}\r\n`;
        } else if (key.toLowerCase() === 'origin') {
          rawRequest += `origin: https://${TARGET_HOST}:${TARGET_PORT}\r\n`;
        } else {
          rawRequest += `${key}: ${val}\r\n`;
        }
      }
      rawRequest += '\r\n';

      tlsSocket.write(rawRequest);
      if (head && head.length > 0) {
        tlsSocket.write(head);
      }

      socket.pipe(tlsSocket);
      tlsSocket.pipe(socket);
    }
  );

  tlsSocket.on('error', (err) => {
    console.error('[Proxy Error WS/TLS]', err.message);
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.error('[Proxy Error Client Socket]', err.message);
    tlsSocket.destroy();
  });
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[Antigravity Remote Bridge] Listening on 0.0.0.0:${LISTEN_PORT} -> https://${TARGET_HOST}:${TARGET_PORT}`);
});
