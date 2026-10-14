import type {WorkflowAction,WorkflowReceipt} from './workflows';
export type PresentationAction=Extract<WorkflowAction,{kind:'presentation'}>;
export type PresentationCommandEvent=CustomEvent<{action:PresentationAction;resolve:(receipt:WorkflowReceipt)=>void;reject:(error:Error)=>void}>;
export async function presentationCommand(action:PresentationAction):Promise<WorkflowReceipt>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Presentation controls are unavailable. Start the presentation and try again.')),2500);document.dispatchEvent(new CustomEvent('deck-studio-presentation-command',{detail:{action,resolve:(receipt:WorkflowReceipt)=>{clearTimeout(timer);resolve(receipt);},reject:(error:Error)=>{clearTimeout(timer);reject(error);}}}));});}
