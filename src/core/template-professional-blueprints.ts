import type {TemplatePage} from './template-blueprints';
export const PROFESSIONAL_LAYOUTS=[
 {id:'architecture',name:'System architecture',description:'Connect clients, services and data responsibilities'},
 {id:'gantt',name:'Project schedule',description:'Plan tasks and owners across configurable work periods'},
 {id:'kanban',name:'Work board',description:'Group tasks by status and review stage'},
 {id:'swot',name:'SWOT assessment',description:'Separate strengths, weaknesses, opportunities and threats'},
 {id:'funnel',name:'Stage funnel',description:'Explain conversion stages with explicit values'},
 {id:'content',name:'Standard content',description:'Explain three to five points'},
 {id:'annotation',name:'Screenshot and callouts',description:'Connect numbered details to a readable interface'},
 {id:'dashboard',name:'Metric dashboard',description:'Compare targets, changes and status'},
 {id:'category-chart',name:'Category comparison',description:'Compare values with readable long labels'},
 {id:'trend',name:'Trend',description:'Show actual and forecast series distinctly'},
 {id:'composition',name:'Composition',description:'Define a whole and explain its parts'},
 {id:'comparison',name:'Option comparison',description:'Use the same criteria for each option'},
 {id:'workstreams',name:'Parallel roadmap',description:'Place multiple workstreams on a time grid'},
 {id:'matrix',name:'Priority matrix',description:'Locate objects on two defined axes'},
 {id:'hierarchy',name:'Hierarchy',description:'Explain two to three levels of ownership'},
 {id:'case-study',name:'Case and evidence',description:'Connect a challenge, action, result and proof'},
 {id:'decision',name:'Decision request',description:'State the recommendation, cost and decision owner'},
 {id:'action-plan',name:'Action plan',description:'Assign work, a due date and a completion criterion'},
 {id:'appendix',name:'Methods and sources',description:'Keep definitions and references readable'},
 {id:'freeform',name:'Foundation',description:'Create within the theme, margins and grid'},
] as const;
export const professionalBlueprints=():Record<string,TemplatePage>=>Object.fromEntries(PROFESSIONAL_LAYOUTS.map(l=>[l.id,{name:l.name,section:l.name,heading:l.name,body:'',purpose:l.description,fields:[['Observe','Review the current workflow and its constraints.'],['Choose','Compare the alternatives against the same criteria.'],['Deliver','Verify the outcome with the team and users.']]}]));
