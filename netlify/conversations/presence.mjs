import {lookupAdminSession} from '../security-core/admin.mjs';
import {fail} from '../terminal/security.mjs';
import {INDEX,fields,invalid} from './model.mjs';
import {canOperateKorvnt} from './tenancy.mjs';

const KEY='operator-check-in', LEASE=45000;

export async function recordAvailability(ctx,body) {
  fields(body,['op','available']);
  if(typeof body.available!=='boolean')invalid();
  for(let attempt=0;attempt<5;attempt++){
    const row=await ctx.db.get(INDEX,KEY)||{ns:INDEX,key:KEY,ownerId:'system',version:null,data:{members:[]}};
    row.data.members=row.data.members.filter(m=>m.until>ctx.time && m.sessionHash!==ctx.adminSessionHash);
    if(body.available){
      if(row.data.members.length>=12)fail('PRESENCE_LIMIT','Operator coverage is full.',409);
      row.data.members.push({id:ctx.actor,sessionHash:ctx.adminSessionHash,until:ctx.time+LEASE});
    }
    if((await ctx.db.transact([row])).status==='applied')return {available:body.available,until:body.available?ctx.time+LEASE:null};
  }
  fail('CONFLICT','Refresh the operator workspace and try again.',409);
}

export async function availability(ctx){
  const row=await ctx.db.get(INDEX,KEY);
  for(const m of row?.data.members||[]){
    if(m.until<=ctx.time || m.until>ctx.time+LEASE)continue;
    if(ctx.business==='korvnt' && !canOperateKorvnt(ctx.env,m.id))continue;
    const principal=await lookupAdminSession(ctx.store,ctx.env,m.sessionHash,ctx.time);
    if(principal?.subjectId===m.id && Number.isSafeInteger(principal.mfaVerifiedAt) && principal.createdAt<=ctx.time && principal.expiresAt>ctx.time){
      const until=Math.min(m.until,principal.expiresAt,principal.mfaVerifiedAt+5*60_000);
      return {availability:'online',availabilityLeaseMs:Math.max(0,until-ctx.time)};
    }
  }
  return {availability:'asynchronous',availabilityLeaseMs:0};
}
