/** One browser-tab identity shared by workflow claims and editor context. */
function editorSession(){const key='deck-studio-workflow-client';try{const current=sessionStorage.getItem(key);if(current&&/^[\da-f-]{36}$/.test(current))return current;const id=crypto.randomUUID();sessionStorage.setItem(key,id);return id;}catch{return crypto.randomUUID();}}
export const workflowClientId=editorSession();
