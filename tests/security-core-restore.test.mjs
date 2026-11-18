import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createTerminalHandler } from '../netlify/functions/terminal.mjs';
import { createKorvntService } from '../netlify/functions/korvnt-service.mjs';
import { csrfToken, sha256 } from '../netlify/terminal/security.mjs';

test('restored synthetic SQLite snapshot preserves both companies’ encrypted conversations, ownership, key boundaries and prior revocation', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'nortivo-restore-'));
  const files = ['source.sqlite', 'restored.sqlite'].map(name => path.join(folder, name));
  const origin = 'https://restore.invalid', time = Date.now();
  const bytes = () => randomBytes(32);
  const env = {
    PRODUCT_ENABLED: 'true', TERMINAL_ORIGIN: origin, TERMINAL_SESSION_SECRET: bytes().toString('base64url'),
    WORKFLOW_VAULT_CURRENT: 'restore', WORKFLOW_VAULT_KEYS: JSON.stringify({restore:bytes().toString('base64')}),
    KORVNT_SITE_READY:'true', KORVNT_SESSION_SECRET:bytes().toString('base64url'),
    KORVNT_VAULT_CURRENT:'child', KORVNT_VAULT_KEYS:JSON.stringify({child:bytes().toString('base64')}),
  };
  const makeHandler = (store, config = env) => createTerminalHandler({store, env:config, now:()=>time,
    auditSink:async()=>{}, fetcher:async()=>{ throw new Error('No external I/O in restore exercise.'); }});
  const chat = (handler, cookie, command) => handler({
    httpMethod:'POST', rawUrl:origin+'/.netlify/functions/terminal?action=workflow-chat',
    queryStringParameters:{action:'workflow-chat'}, headers:{origin,'content-type':'application/json',
      cookie:'nortivo_terminal='+cookie,'x-csrf-token':csrfToken(cookie,env.TERMINAL_SESSION_SECRET)}, body:JSON.stringify(command),
  });
  const korvnt=(db,config=env)=>createKorvntService({store:db,env:config,now:()=>time,auditSink:async()=>{}});
  function visit(handler,action,body,auth={}) {
    const origin='https://korvnt.no';
    return handler({httpMethod:body?'POST':'GET',rawUrl:origin+'/.netlify/functions/korvnt-service?action=workflow-'+action,
      headers:{origin,'content-type':'application/json',cookie:auth.cookie||'','x-csrf-token':auth.csrf||''},...(body?{body:JSON.stringify(body)}:{})});
  }
  let source, restored;
  try {
    source = await createLocalStore(files[0]);
    const users = [];
    for (const label of ['first','second']) {
      const id = randomUUID(), cookie = bytes().toString('base64url');
      await source.createUser({id,kind:'user',email:label+'@example.invalid',created_at:time}, {});
      await source.product.transact([{ns:'accounts',key:id,ownerId:id,expectedVersion:null,value:{emailVerified:true}}]);
      await source.createSession({token_hash:sha256(cookie),user_id:id,created_at:time,expires_at:time+600000});
      users.push({id,cookie});
    }
    const revoked = bytes().toString('base64url');
    await source.createSession({token_hash:sha256(revoked),user_id:users[0].id,created_at:time,expires_at:time+600000});
    await source.deleteSession(sha256(revoked));
    const message = 'Synthetic restore exercise '+randomUUID();
    const saved = await chat(makeHandler(source), users[0].cookie, {op:'send',requestId:randomUUID(),text:message});
    assert.equal(saved.statusCode,200);
    const threadId = JSON.parse(saved.body).threadId;
    const childHandler=korvnt(source), guest=await visit(childHandler,'session');
    assert.equal(guest.statusCode,200);
    const childAuth={cookie:guest.headers['Set-Cookie'].split(';')[0],csrf:JSON.parse(guest.body).csrfToken};
    const childText='Synthetic service restoration '+randomUUID();
    const childSaved=await visit(childHandler,'chat',{op:'send',requestId:randomUUID(),text:childText},childAuth);
    assert.equal(childSaved.statusCode,200);
    const childRead={op:'read',id:JSON.parse(childSaved.body).threadId};
    source.close(); source = null; // Checkpoint the SQLite WAL before taking the offline copy.
    await copyFile(files[0],files[1]);
    const snapshot = await readFile(files[1]);
    assert.equal(snapshot.includes(Buffer.from(message)),false);
    assert.equal(snapshot.includes(Buffer.from(childText)),false);
    restored = await createLocalStore(files[1]);
    const read = {op:'read',id:threadId}, handler = makeHandler(restored);
    const history = await chat(handler, users[0].cookie, read);
    assert.equal(history.statusCode,200);
    assert.equal(JSON.parse(history.body).thread.messages[0].text,message);
    assert.equal((await chat(handler, users[1].cookie, read)).statusCode,404);
    assert.equal((await chat(handler, revoked, read)).statusCode,401);
    const wrong = makeHandler(restored, {...env,WORKFLOW_VAULT_KEYS:JSON.stringify({restore:bytes().toString('base64')})});
    assert.equal((await chat(wrong,users[0].cookie,read)).statusCode,503);
    const childRestore=korvnt(restored);
    const childHistory=await visit(childRestore,'chat',childRead,childAuth);
    assert.equal(childHistory.statusCode,200);assert.equal(JSON.parse(childHistory.body).thread.messages[0].text,childText);
    assert.equal((await visit(childRestore,'chat',read,childAuth)).statusCode,404);
    assert.equal((await chat(handler,users[0].cookie,childRead)).statusCode,404);
    const wrongChild=korvnt(restored,{...env,KORVNT_VAULT_KEYS:JSON.stringify({child:bytes().toString('base64')})});
    assert.equal((await visit(wrongChild,'chat',childRead,childAuth)).statusCode,503);
  } finally {
    source?.close(); restored?.close();
    for (const file of files) for (const suffix of ['', '-wal', '-shm']) await rm(file+suffix,{force:true});
    await rmdir(folder);
  }
});
