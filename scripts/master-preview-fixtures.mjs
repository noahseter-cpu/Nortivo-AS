import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as OTPAuth from 'otpauth';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createInitialState } from '../netlify/terminal/engine.mjs';
import { hashPassword } from '../netlify/terminal/auth.mjs';
import { handleMfa } from '../netlify/product/mfa.mjs';
import { createOwnerGrant } from '../netlify/product/owner.mjs';

const layout = { database:'workspace.sqlite', credentials:'credentials.private.json', keys:'keys.private.json' };
const within = (root, dir) => {
  const relative = path.relative(root,dir);
  return relative !== '..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);
};
async function exists(file) {
  try { await stat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function privateDirectory(directory) {
  if (process.platform !== 'win32') return chmod(directory,0o700);
  const output = execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true});
  const sid = output.match(/\bS-1-\d+(?:-\d+)+\b/)?.[0];
  if (!sid) throw Error('Cannot restrict access to the local fixture folder.');
  execFileSync('icacls.exe',[directory,'/grant:r','*'+sid+':(OI)(CI)F','/inheritance:r'],{stdio:'ignore',windowsHide:true});
}
async function privateJson(file) {
  const info = await lstat(file);
  if (!info.isFile() || info.size>32768) throw Error('The local fixture configuration is invalid.');
  return JSON.parse(await readFile(file,'utf8'));
}
const writeJson = (file,value) => writeFile(file,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});

function createEnv(keys,ownerId) {
  return {
    NETLIFY_DEV:'true', TERMINAL_LOCAL:'true', PRODUCT_TEST_MODE:'true', PRODUCT_ENABLED:'true',
    TERMINAL_ALLOW_SIGNUP:'true', PRODUCT_LIVE_TRANSMISSION_ENABLED:'false',
    TERMINAL_SESSION_SECRET:keys.session, SECURITY_CORE_ADMIN_KEY:keys.admin, SECURITY_CORE_RATE_KEY:keys.rate,
    PRODUCT_ENCRYPTION_KEY:keys.encryption, PRODUCT_ADMIN_USER_IDS:ownerId,
    WORKFLOW_VAULT_CURRENT:'local-v1', WORKFLOW_VAULT_KEYS:JSON.stringify({'local-v1':keys.vault}),
    KORVNT_OPERATOR_USER_IDS:ownerId,KORVNT_SESSION_SECRET:keys.korvntSession,
    KORVNT_VAULT_CURRENT:'local-korvnt-v1',KORVNT_VAULT_KEYS:JSON.stringify({'local-korvnt-v1':keys.korvntVault}),
  };
}
async function seed(directory) {
  await privateDirectory(directory);
  const secret = size => randomBytes(size).toString('base64url');
  const keys = {session:secret(48),admin:secret(48),rate:secret(48),encryption:secret(32),vault:randomBytes(32).toString('base64'),korvntSession:secret(48),korvntVault:randomBytes(32).toString('base64')};
  const account = label => ({id:randomUUID(),email:label+'@review.example.invalid',password:secret(24)});
  const credentials = {owner:account('owner'),customer:account('customer')};
  const env=createEnv(keys,credentials.owner.id), store=await createLocalStore(path.join(directory,layout.database));
  try {
    // A previous TOTP step confirms enrollment without consuming the operator's current sign-in code.
    const now=Date.now(), enrollmentTime=now-30000;
    for (const [role,info] of Object.entries(credentials)) {
      const user={id:info.id,email:info.email,name:role==='owner'?'Review owner':'Review customer',
        kind:'user',created_at:now-60000,expires_at:null,password_hash:await hashPassword(info.password)};
      const value={emailVerified:true,verifiedAt:now-50000,createdAt:user.created_at,locale:'en',returnPath:'/en/portfolio/',
        billing:{status:'none',paidUntil:null},...(role==='owner'?{access:createOwnerGrant(now-45000)}:{})};
      await store.productIdentity({operation:'create',user,state:createInitialState({now:user.created_at}),
        changes:[{ns:'accounts',key:user.id,ownerId:user.id,expectedVersion:null,value}]});
      if(role==='owner') {
        const ctx={store:store.product,legacyStore:store,user,account:value,env,now:enrollmentTime};
        const enrollment=await handleMfa(ctx,'product-mfa-enroll',{password:info.password});
        const totp=new OTPAuth.TOTP({issuer:'Nortivo',label:info.email,algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(enrollment.secret)});
        const confirmed=await handleMfa(ctx,'product-mfa-confirm',{code:totp.generate({timestamp:enrollmentTime})});
        Object.assign(info,{totpSecret:enrollment.secret,recoveryCodes:confirmed.recoveryCodes});
      }
    }
  } finally { store.close(); }
  await writeJson(path.join(directory,layout.keys),keys);
  await writeJson(path.join(directory,layout.credentials),credentials);
  await chmod(path.join(directory,layout.database),0o600);
}
async function cleanStaging(directory,parent) {
  if (path.dirname(directory)!==parent || !path.basename(directory).startsWith('.seed-')) throw Error('Unexpected fixture staging path.');
  for (const name of [...Object.values(layout),layout.database+'-wal',layout.database+'-shm']) await rm(path.join(directory,name),{force:true});
  await rmdir(directory);
}
function captureFile(file,limit) {
  let writes=Promise.resolve();
  return record=>{
    const line=JSON.stringify(record)+'\n';
    if(Buffer.byteLength(line)>16000) throw Error('Local capture record is too large.');
    const operation=writes.then(async()=>{
      let previous='';
      if(await exists(file)) {
        const meta=await lstat(file);
        if(!meta.isFile() || meta.size>limit+16000) throw Error('Invalid local capture file.');
        previous=await readFile(file,'utf8');
      }
      const lines=(previous+line).trimEnd().split('\n');
      let bytes=Buffer.byteLength(previous+line);
      while(bytes>limit && lines.length>1) bytes-=Buffer.byteLength(lines.shift())+1;
      const temporary=file+'.'+randomUUID()+'.tmp';
      try {
        await writeFile(temporary,lines.join('\n')+'\n',{mode:0o600,flag:'wx'});
        await rename(temporary,file);
      } finally { await rm(temporary,{force:true}); }
    });
    writes=operation.catch(()=>{});
    return operation;
  };
}
function auditCapture(file) {
  const persist=captureFile(file,512000);
  return async line=>{
    if(typeof line!=='string' || Buffer.byteLength(line)>2048) throw Error('Invalid local audit event.');
    const r=JSON.parse(line);
    if(!['request_allowed','request_denied','dependency_unavailable'].includes(r.event) ||
       !['allow','deny'].includes(r.decision) || !Number.isInteger(r.status) || r.status<100 || r.status>599 ||
       !/^[a-z0-9:_-]{1,80}$/i.test(r.routeId) || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(r.timestamp)) throw Error('Invalid local audit fields.');
    const event={version:1,timestamp:r.timestamp,event:r.event,decision:r.decision,routeId:r.routeId,status:r.status};
    if (/^[a-f0-9-]{36}$/i.test(r.requestId||'')) event.requestId=r.requestId;
    if (/^[A-Z][A-Z0-9_]{1,63}$/.test(r.reason||'')) event.reason=r.reason;
    for(const key of ['subjectId','clientId']) if(/^[a-f0-9]{64}$/.test(r[key]||'')) event[key]=r[key];
    await persist(event);
  };
}

export async function createMasterFixtures({dataDir}={}) {
  if(process.env.NETLIFY==='true' || ['production','deploy-preview','branch-deploy'].includes(process.env.CONTEXT) || process.env.NODE_ENV==='production')
    throw Error('The review fixtures require a local development runtime.');
  if(typeof dataDir!=='string' || !dataDir.trim()) throw Error('Supply a private local data directory.');
  const dir=path.resolve(dataDir), allowed=[path.resolve(fileURLToPath(new URL('../.local/',import.meta.url))),path.resolve(tmpdir())];
  if(!allowed.some(root=>dir!==root && within(root,dir))) throw Error('Choose a dedicated directory in the checkout .local or temporary directory.');
  await mkdir(dir,{recursive:true,mode:0o700});
  const actual=await realpath(dir);
  if(!allowed.some(root=>dir!==root && within(root,actual)) || (await lstat(dir)).isSymbolicLink()) throw Error('Invalid local fixture destination.');
  const final=path.join(actual,'fixtures-v1');
  if(!await exists(final)) {
    const stage=await mkdtemp(path.join(actual,'.seed-'));
    let installed=false;
    try {
      await seed(stage);
      try { await rename(stage,final); installed=true; }
      catch(error) { if(!await exists(final)) throw error; }
    } finally { if(!installed) await cleanStaging(stage,actual); }
  }
  if((await lstat(final)).isSymbolicLink() || path.dirname(await realpath(final))!==actual) throw Error('Invalid local fixture bundle.');
  const credentialsFile=path.join(final,layout.credentials), dbFile=path.join(final,layout.database);
  const [credentials,keys,dbStat]=await Promise.all([privateJson(credentialsFile),privateJson(path.join(final,layout.keys)),lstat(dbFile)]);
  if(!dbStat.isFile() || !credentials.owner?.id || !credentials.customer?.id || !keys.vault) throw Error('Incomplete fixture bundle. Choose a new local review directory.');
  // Add independently generated keys to older local bundles without changing their accounts or history.
  if(!keys.korvntSession || !keys.korvntVault){
    keys.korvntSession=randomBytes(48).toString('base64url');keys.korvntVault=randomBytes(32).toString('base64');
    const temporary=path.join(final,layout.keys+'.'+randomUUID()+'.tmp');
    await writeJson(temporary,keys);await rename(temporary,path.join(final,layout.keys));
  }
  const store=await createLocalStore(dbFile), env=createEnv(keys,credentials.owner.id);
  const sendToCapture=captureFile(path.join(final,'mail.private.jsonl'),256000);
  const captureEmail=async ({to,subject,text,url,purpose})=>{
    if(!['reset','verify'].includes(purpose) || typeof to!=='string' || to.length>160 || typeof url!=='string' || url.length>1500) throw Error('Invalid local mail.');
    await sendToCapture({timestamp:new Date().toISOString(),to,purpose,subject:String(subject).slice(0,200),url,text:String(text).slice(0,2500)});
  };
  return {store,env,credentialsFile,captureEmail,auditSink:auditCapture(path.join(final,'audit.private.jsonl')),dispose:()=>store.close()};
}
