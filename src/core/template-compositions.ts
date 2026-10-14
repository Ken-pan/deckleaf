import type {ColorRole,TextRole} from './design-system-schema';
import type {Slide,SlideElement} from './model';
import type {TemplateCollection,LayoutId} from './template-collections';
import type {TemplatePage} from './template-blueprints';

type Text=(value:string,x:number,y:number,w:number,h:number,role?:TextRole,size?:number,color?:ColorRole,extra?:Partial<SlideElement>)=>SlideElement;
type Shape=(x:number,y:number,w:number,h:number,color?:ColorRole,extra?:Partial<SlideElement>)=>SlideElement;
export interface TemplatePainter {
  s:Slide;text:Text;shape:Shape;
  label:(value:string,x:number,y:number,w?:number,color?:ColorRole,extra?:Partial<SlideElement>)=>SlideElement;
  rule:(x:number,y:number,w:number,color?:ColorRole,group?:string)=>unknown;
  photo:(x:number,y:number,w:number,h:number,key?:string)=>SlideElement;
  spot:(key:string,x:number,y:number,size?:number)=>SlideElement;
  image:(key:string,x:number,y:number,w:number,h:number,fit?:'cover'|'contain',opacity?:number)=>SlideElement;
  mockup:(x:number,y:number,w:number,h:number,variant?:'before'|'after'|'result')=>SlideElement;
  table:(cells:string[][],x?:number,y?:number,w?:number,h?:number)=>unknown;
  chart:(labels:string[],values:number[],type?:'column'|'bar'|'line'|'area',box?:{x:number;y:number;w:number;h:number})=>unknown;
}

/** The page's reader task determines its composition, rather than one shared grid. */
export function composeInterior(c:TemplateCollection,p:TemplatePage,id:LayoutId,d:TemplatePainter):boolean {
  const {s,text,shape,label,rule,photo,spot,image,mockup,table,chart}=d;
  const heading=(value=p.heading,x=80,y=138,w=1280,size=64,color:ColorRole='ink')=>text(value,x,y,w,180,'heading',size,color);
  const body=(value:string,x:number,y:number,w:number,size=30,color:ColorRole='muted')=>text(value,x,y,w,Math.max(1,Math.min(220,736-y)),'body',size,color);
  const note=(value:string,x=84,y=710,w=1196,color:ColorRole='muted')=>text(value,x,y,w,44,'caption',22,color);
  const number=(value:string,x:number,y:number,size=80,color:ColorRole='accent')=>text(value,x,y,240,140,'heading',size,color);
  const fields=p.fields??[];const steps=p.columns??[];
  if(c.id==='portfolio'){
    if(id==='facts'){
      heading('The project\nat a glance.',80,162,740,80);body(p.body,84,410,632,34);
      label('ROLE / TIME / OUTPUT',84,676,650);rule(84,650,632);
      fields.forEach(([a,b],i)=>{const y=166+i*164;rule(858,y,502);label(a.toUpperCase(),858,y+24,502);body(b,858,y+73,492,36,'ink');});
    }else if(id==='statement'){
      label('THE DESIGN CHALLENGE',84,174,1120,'onDark');heading('Make the next\nstep obvious.',76,278,1170,110,'onDark');
      rule(84,600,1276,'onDark');body(p.body,84,642,1010,30,'onDark');
    }else if(id==='split'){
      heading(p.heading,80,146,480,66);label('01 / OBSERVATION',84,320,470);body('Describe what you observed.',84,374,470,30);
      mockup(664,148,696,492);note('Sample interface · Replace with your evidence',664,670,696);
      rule(84,478,470);label('02 / DESIGN RESPONSE',84,510,470);body('Explain how it shaped\nyour design decisions.',84,566,470,30);
    }else if(id==='before-after'){
      heading('A clearer path\nforward.',80,130,1120,68);
      [84,742].forEach((x,i)=>{label(i?'AFTER / PROPOSED':'BEFORE / CURRENT',x,306,614);mockup(x,358,614,306,i?'after':'before');body(i?'What improved, and how you know.':'What made the original difficult.',x,688,606,27);});
    }else if(id==='process'){
      heading('From questions\nto decisions.',80,126,1000,68);
      steps.forEach(([a,b],i)=>{
        const x=84+i*432,y=350+i*60,group=`decision-${s.id}-${i}`;
        (s.groups??=[]).push({id:group,name:a});rule(x,y,392,'line',group);
        number(`0${i+1}`,x,y+24,74).group=group;
        const mark=spot(['spot-01-search','spot-07-compare','spot-22-test'][i],x+280,y+16,112);
        if(mark.group)(s.groups??=[]).push({id:mark.group,name:'Decision illustration',parent:group});
        body(a,x,y+128,392,36,'ink').group=group;body(b,x,y+190,392,27).group=group;
      });
    }else if(id==='evidence'){
      heading('The work,\nin detail.',80,192,420,72);body('Give the finished work\nroom to be read.',84,460,340,30);
      mockup(500,116,940,582);rule(84,668,330);note('Source and context',84,710,370);note('Editable sample interface · Replace with your project',500,710,748);
    }else if(id==='close'){
      heading('What I\nlearned.',76,194,760,112,'onDark');body(p.body,84,540,686,32,'onDark');
      label('CONTINUE THE CONVERSATION',904,188,456,'onDark');rule(904,252,456,'onDark');
      body('Your name',904,298,456,42,'onDark');body('Your email or\nportfolio URL',904,410,448,30,'onDark');
      spot('spot-23-feedback',904,582,128);
    }else return false;
  }else if(c.id==='review'){
    if(id==='facts'){
      heading('What we’re\nsolving.',80,154,684,80);body(p.body,84,426,614,32);
      shape(778,116,662,620,'surface',{name:'Scope column'});
      fields.forEach(([a,b],i)=>{const y=156+i*176;label(`0${i+1} / ${a.toUpperCase()}`,828,y,532);body(b,828,y+58,514,38,'ink');if(i<2)rule(828,y+136,532);});
    }else if(id==='split'){
      heading('What the evidence\ntells us.',80,132,1200,62);
      table([['Task','Observation'],['Find next task','Competing lists slow the choice'],['Review evidence','Source needs to stay visible'],['Hand off work','A named owner clarifies action']],84,340,550,338);note('Synthetic observation record · Replace with your research',84,697,550);
      ['One observation.','What it means for the design.','Which decision it informs.'].forEach((v,i)=>{const y=322+i*128;rule(744,y,616);label(['OBSERVATION','MEANING','DECISION'][i],744,y+18,616);body(v,744,y+60,600,31,'ink');});
    }else if(id==='process'){
      heading();steps.forEach(([a,b],i)=>{const y=310+i*130;rule(84,y,1276);number(`0${i+1}`,84,y+22,56);body(a,236,y+28,274,36,'ink');body(b,594,y+24,632,27);spot(['spot-01-search','spot-07-compare','spot-22-test'][i],1280,y+20,80);});
    }else if(id==='before-after'){
      heading('What changes\nfor people.',80,126,1120,68);
      [84,742].forEach((x,i)=>{shape(x,316,614,48,i?'ink':'surface',{name:'Comparison header'});label(i?'PROPOSED EXPERIENCE':'CURRENT EXPERIENCE',x+24,323,550,i?'background':'muted');mockup(x,380,614,296,i?'after':'before');body(i?'What improved, and how you know.':'What made the original difficult.',x,692,606,27);});
    }else if(id==='metrics'){
      heading('How we’ll\nmeasure success.',80,146,640,68);number('68%',84,390,132);
      body('Example target',84,559,434,32,'ink');body('42% baseline\nDefine the target and test period.',84,632,434,26);
      chart(['Baseline','Target'],[42,68],'bar',{x:704,y:190,w:656,h:476});note('Example data · Replace before presenting',728,696,632);
    }else if(id==='roadmap'){
      heading();
      steps.forEach(([a,b],i)=>{const y=310+i*134;shape(110,y+48,2,i<2?134:1,'line',{name:'Timeline connector'});number(`0${i+1}`,84,y+18,48);body(a,218,y+18,256,34,'ink');body(b,518,y+20,542,29);text('Owner · Your team\nTiming · Target date',1090,y+20,270,72,'caption',23,'muted');if(i<2)rule(218,y+116,1142);});
    }else if(id==='close'){
      heading('The decision to make.',80,172,1276,88);body(p.body,84,342,1000,34);
      [['CHOICE','Agree the direction'],['OWNER','Who carries it forward?'],['NEXT TEST','What will you validate?']].forEach(([a,b],i)=>{const x=84+i*432;number(`0${i+1}`,x,498,56);label(a,x,578,392);body(b,x,631,392,30,'ink');rule(x,470,392);});
    }else return false;
  }else if(c.id==='proposal'){
    if(id==='statement'){
      photo(1032,116,408,620,'material');label('THE PRINCIPLE',84,174,842,'onDark');heading('A direction rooted\nin what matters.',76,284,926,90,'onDark');body(p.body,84,625,876,29,'onDark');
    }else if(id==='facts'){
      heading();number('01',84,340,128);
      label('OBJECTIVE',368,302,992);body(fields[0][1],368,354,950,46,'ink');rule(368,466,992);
      fields.slice(1).forEach(([a,b],i)=>{const x=368+i*512;label(a.toUpperCase(),x,526,480);body(b,x,590,480,34,'ink');});
    }else if(id==='split'){
      photo(624,116,816,570,'material');heading('Warmth.\nClarity.\nRoom to breathe.',80,150,510,66);body(p.body,84,447,460,28);
      ['surface','accent','ink'].forEach((color,i)=>{shape(84+i*156,658,140,36,color as ColorRole,{name:`Direction color ${i+1}`});text(color.toUpperCase(),84+i*156,704,140,28,'caption',20,'muted');});note('AI-generated concept · Replace as needed',624,704,652);
    }else if(id==='quote'){
      photo(0,116,384,620,'paper');heading('“Add an actual quote\nthat supports\nthis direction.”',464,254,866,65);label('WHAT WE HEARD',468,166,828);rule(468,626,892);body('Participant / role',468,672,536,28,'ink');note('Date · Context',1114,676,246);
    }else if(id==='process'){
      heading();rule(84,428,1276,'accent');steps.forEach(([a,b],i)=>{const x=84+i*432;number(`0${i+1}`,x,278,82);body(a,x,374,386,32,'ink');shape(x,422,12,12,'accent',{type:'ellipse',name:'Milestone'});body(b,x,494,386,29);label('PHASE / ADD TIMING',x,659,386);});
    }else if(id==='evidence'){
      photo(0,116,496,582,'paper');heading('One coherent\ndirection.',564,144,788,70);label('TYPE / MESSAGE',568,362,764);heading('A clear point\nof view.',564,410,782,62);
      ['surface','accent','ink'].forEach((color,i)=>{const x=568+i*264;shape(x,634,240,54,color as ColorRole,{name:`Direction color ${i+1}`});label(['BACKGROUND','ACCENT','INK'][i],x,701,240);});note('AI artwork · Replace as needed',84,710,396);
    }else if(id==='close'){
      photo(1048,116,392,336,'material');heading('Let’s align on\nwhat comes next.',76,190,918,90);body(p.body,84,484,900,32);rule(84,590,1276);
      [['DIRECTION','Confirm the choice'],['SCOPE','Agree the deliverables'],['START','Set the first milestone']].forEach(([a,b],i)=>{const x=84+i*432;label(a,x,606,392);body(b,x,654,392,28,'ink');});
    }else return false;
  }else if(c.id==='pitch'){
    if(id==='statement'){
      label('THE CUSTOMER’S PROBLEM',84,174,1100,'onDark');heading('The work is harder\nthan it needs to be.',76,250,1260,88,'onDark');
      ['Find','Choose','Act'].forEach((v,i)=>{const x=84+i*432;rule(x,552,392,'onDark');label(`0${i+1} / ${v.toUpperCase()}`,x,580,392,'onDark');});body(p.body,84,664,1196,29,'onDark');
    }else if(id==='split'){
      heading('Your next task,\nmade simpler.',80,204,500,61);body(p.body,84,456,440,30);
      mockup(616,146,744,506);note('Sample interface · Replace with your evidence',616,688,744);
    }else if(id==='metrics'){
      heading();number('68%',84,330,132);body('Example adoption metric',84,510,418,31,'ink');
      chart(['Q1','Q2','Q3','Q4'],[29,42,53,68],'area',{x:518,y:244,w:842,h:412});
      rule(84,612,394);body('29% → 68% over four quarters.\nAdd your own data and source.',84,639,394,24);note('Example data · Replace before presenting',542,698,818);
    }else if(id==='before-after'){
      heading('Why choose\nthis approach.',80,126,980,66);table([['Criteria','Current approach','Your product'],['Customer value','Describe the limitation','Describe the benefit'],['Time and effort','What creates friction?','What becomes easier?'],['Reason to choose','What is missing?','What makes it distinct?']],84,344,954,332);
      shape(1080,344,280,332,'surface',{name:'Product distinction'});label('YOUR EDGE',1110,376,220);body('Describe why\nit matters.',1110,454,220,32,'ink');note('Add the evidence that supports the comparison.',84,711,1196);
    }else if(id==='process'){
      heading();
      const positions=[[84,312,588],[772,312,588],[428,526,588]];
      steps.forEach(([a,b],i)=>{const [x,y,w]=positions[i];rule(x,y,w,'accent');label(`0${i+1} / ${a.toUpperCase()}`,x,y+22,w);body(b,x,y+84,w-110,32,'ink');spot(['spot-01-search','spot-21-prototype','spot-04-complete'][i],x+w-88,y+84,88);});
      text('→',672,364,80,72,'body',46,'accent');
    }else if(id==='roadmap'){
      heading();steps.forEach(([a,b],i)=>{const x=84+i*82,y=310+i*122,w=1276-i*164;shape(x,y,w,102,'surface',{name:`Go-to-market stage ${i+1}`});label(`0${i+1} / ${a.toUpperCase()}`,x+24,y+34,258);body(b,x+312,y+25,w-348,32,'ink');});note('Owner · Your team                  Timing · Target date',248,714,980);
    }else if(id==='facts'){
      heading('The people behind\nthe work.',80,128,1220,66);
      fields.forEach(([a,b],i)=>{const x=84+i*432;rule(x,350,392);spot(['spot-13-handoff','spot-21-prototype','spot-04-complete'][i],x,390,128);label(`0${i+1} / ${a.toUpperCase()}`,x,568,392);body(b,x,626,392,31,'ink');});
    }else if(id==='close'){
      photo(1050,116,390,620,'glass');heading('Let’s take the\nnext step.',76,176,920,90);body(p.body,84,422,854,30);
      [['ASK','Funding or support needed'],['USE','What it makes possible'],['NEXT','The milestone to reach']].forEach(([a,b],i)=>{const y=526+i*72;label(a,84,y,154);body(b,302,y-3,644,28,'ink');rule(302,y+51,644);});
    }else return false;
  }else if(c.id==='report'){
    if(id==='facts'){
      shape(0,116,656,620,'dark',{name:'Executive finding panel'});heading('The period\nat a glance.',80,172,548,70,'onDark');body(p.body,84,388,484,42,'onDark');text('Report period\nAdd the scope and source.',84,624,484,100,'caption',25,'onDark');
      [['FINDING','What changed?'],['IMPLICATION','Why does it matter?'],['ACTION','What should happen next?']].forEach(([a,b],i)=>{const y=164+i*174;rule(744,y,616);label(a,744,y+28,616);body(b,744,y+88,610,35,'ink');});
    }else if(id==='metrics'){
      heading('Performance\nagainst target.',80,134,620,68);number('68%',84,385,132);body('Example completion rate',84,554,432,30,'ink');body('42% previous period\nAdd the population and period.',84,638,432,25);
      chart(['Previous','Current'],[42,68],'column',{x:590,y:196,w:770,h:470});note('Example data · Replace before presenting',614,696,746);
    }else if(id==='table'){
      heading(p.heading,328,138,1032);number('68%',84,154,100).name='Current result';text('CURRENT RESULT\nExample completion.',84,302,198,100,'caption',25,'muted');
      table([['Metric','Previous','Current','Change'],['Completion','42%','68%','+26 pp'],['Response time','9 min','6 min','−3 min'],['Active use','55%','62%','+7 pp']],328,306,1032,366);note('Example data · Replace with your numbers and source.',328,710,952);
    }else if(id==='before-after'){
      heading();['METRIC','PREVIOUS','CURRENT','CHANGE'].forEach((v,i)=>label(v,[84,480,812,1142][i],298,[350,280,280,218][i]));
      [['Completion','42%','68%','+26 pp'],['Response time','9 min','6 min','−3 min'],['Active use','55%','62%','+7 pp']].forEach(([a,b,v,delta],i)=>{const y=364+i*108;rule(84,y-20,1276);body(a,84,y+6,350,31,'muted');text(b,480,y,280,70,'body',46,'ink');text(v,812,y,280,70,'body',46,'ink',{fontWeight:600});text(delta,1142,y+8,218,66,'body',30,'accent');});note('Example data · Compare the same population and period.',84,714,1196);
    }else if(id==='quote'){
      label('THE CONTEXT BEHIND THE RESULT',84,174,1000,'onDark');heading('“Add a real observation\nthat explains the result.”',80,300,1260,70,'onDark');
      rule(84,622,1276,'onDark');body('Source · Team, customer, or study',84,670,854,28,'onDark');note('Date · Context',1090,676,270,'onDark');
    }else if(id==='roadmap'){
      heading('Actions for\nthe next period.',80,180,550,68);body('Set a priority,\nan owner, and a due date.',84,482,446,30);
      ['Choose the priority','Assign the next test','Set the review date'].forEach((v,i)=>{const y=172+i*176;rule(656,y,704);label(`0${i+1} / ACTION`,656,y+20,704);body(v,656,y+66,686,36,'ink');text('Owner · Your team      Due · Target date',656,y+124,686,42,'caption',24,'muted');});
    }else if(id==='close'){
      heading('A clear\nnext decision.',80,198,700,96);body(p.body,84,540,686,34);
      shape(854,116,586,620,'surface',{name:'Decision record'});
      [['DECISION','Agree the priority'],['OWNER','Assign responsibility'],['REVIEW','Set the next review date']].forEach(([a,b],i)=>{const y=176+i*172;label(a,910,y,450);body(b,910,y+58,450,34,'ink');if(i<2)rule(910,y+132,450);});
    }else return false;
  }else return false;
  s.notes=`${p.purpose}. Replace sample copy and data. AI imagery is project-owned decorative artwork, not project evidence. Text, shapes, diagrams, charts and tables remain editable.`;
  return true;
}
