import {createWorkflowHandler} from '../conversations/handler.mjs';
export const createKorvntInbox=options=>createWorkflowHandler({...options,business:'korvnt',operator:true});
export const handler=createKorvntInbox();
