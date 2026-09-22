
import { transcodeRelayService } from './transcode-relay-service.mjs';

export async function handleGridRoute(req, res, gridService) {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (url.pathname === '/api/grid/status') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(gridService.getStatus()));
    return true;
  }

  if (url.pathname === '/api/grid/transcode/capabilities') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, ...transcodeRelayService.getCapabilities() }));
    return true;
  }

  if (url.pathname === '/api/grid/transcode/job' && (req.method || 'GET').toUpperCase() === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let jobReq = {};
    try { jobReq = JSON.parse(body); } catch {}
    const result = await transcodeRelayService.evaluateTranscodeJob(jobReq);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, result }));
    return true;
  }

  return false;
}
