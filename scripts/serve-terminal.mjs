import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { previewResponse } from './serve.mjs';
import { createTerminalHandler } from '../netlify/functions/terminal.mjs';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { BODY_LIMIT } from '../netlify/terminal/security.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'";
async function localSecret(filename) {
  await mkdir(path.dirname(filename),{recursive:true,mode:0o700});
  try {
    const value = await readFile(filename,'utf8');
    if (Buffer.byteLength(value.trim()) < 32) throw new Error('Invalid local security configuration.');
    return value.trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const value = crypto.randomBytes(48).toString('base64url');
    try { await writeFile(filename,value,{flag:'wx',mode:0o600}); return value; }
    catch (writeError) { if (writeError.code === 'EEXIST') return localSecret(filename); throw writeError; }
  }
}
export async function createTerminalPreviewServer({ port = 4420, distDir = path.join(root,'dist'), dataDir = path.join(root,'.local','terminal'), store: suppliedStore, secret: suppliedSecret } = {}) {
  if (process.env.NETLIFY === 'true' || process.env.CONTEXT === 'production') throw new Error('The local terminal server cannot run in the hosted production runtime.');
  const store = suppliedStore || await createLocalStore(path.join(dataDir,'terminal.sqlite'));
  const secret = suppliedSecret || await localSecret(path.join(dataDir,'session-secret'));
  // Deliberately do not load .env, support credentials, or provider keys in this local preview.
  const env = {TERMINAL_LOCAL:'true',TERMINAL_SESSION_SECRET:secret,TERMINAL_ORIGIN:`http://127.0.0.1:${port}`};
  const api = createTerminalHandler({store,env});
  const server = http.createServer(async (request,res) => {
    const baseHeaders = {'Content-Security-Policy':CSP,'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
    try {
      const url = new URL(request.url,env.TERMINAL_ORIGIN);
      if (url.pathname === '/.netlify/functions/terminal') {
        const chunks = [];
        let length = 0;
        for await (const chunk of request) {
          length += chunk.length;
          if (length > BODY_LIMIT) {
            res.writeHead(413,{...baseHeaders,'Content-Type':'application/json','Cache-Control':'no-store','Connection':'close'});
            res.end(JSON.stringify({error:{code:'INVALID_BODY',message:'Request body is too large.'}}));
            request.destroy();
            return;
          }
          chunks.push(chunk);
        }
        const result = await api({httpMethod:request.method,rawUrl:url.href,headers:{...request.headers,'x-nf-client-connection-ip':request.socket.remoteAddress || 'local'},queryStringParameters:Object.fromEntries(url.searchParams),body:Buffer.concat(chunks).toString('utf8'),isBase64Encoded:false});
        res.writeHead(result.statusCode,{...baseHeaders,...result.headers}); res.end(result.body);
        return;
      }
      const result = await previewResponse(request,distDir);
      res.writeHead(result.status,{...baseHeaders,...result.headers}); res.end(result.body);
    } catch {
      res.writeHead(503,{...baseHeaders,'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({error:{code:'LOCAL_UNAVAILABLE',message:'Local trading workspace is unavailable.'}}));
    }
  });
  server.on('close',() => { if (!suppliedStore) store.close(); });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const flag = process.argv.indexOf('--port');
  const port = flag === -1 ? 4420 : Number(process.argv[flag+1]);
  if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('Use a valid --port between 1 and 65535.');
  const server = await createTerminalPreviewServer({port});
  server.on('error',() => { console.error('Local terminal could not start. Check whether its port is already in use.'); process.exitCode=1; });
  server.listen(port,'127.0.0.1',() => console.log(`Nortivo paper terminal: http://127.0.0.1:${port}/en/terminal/ (private local SQLite; support/email and external providers are not connected)`));
}
