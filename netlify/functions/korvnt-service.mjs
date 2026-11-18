import {createWorkflowHandler} from '../conversations/handler.mjs';
export const createKorvntService=options=>createWorkflowHandler({...options,business:'korvnt',operator:false});
export const handler=createKorvntService();
