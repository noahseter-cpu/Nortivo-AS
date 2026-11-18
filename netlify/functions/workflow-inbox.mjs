import {createWorkflowHandler} from '../conversations/handler.mjs';
export const createWorkflowInbox = options => createWorkflowHandler({...options,business:'nortivo',operator:true});
export const handler = createWorkflowInbox();
