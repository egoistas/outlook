'use strict';
const $=s=>document.querySelector(s), form=$('#eventForm');
let user, events=[], active=new Date(), editing=null, rangeStart, rangeEnd;
const day=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const ymd=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const local=d=>ymd(d)+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
const human=(d,opts)=>d.toLocaleDateString('el-GR',opts);
const time=d=>new Date(d).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'});
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
async function api(path,method='GET',body){const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':user?.csrf||''},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json();if(!r.ok){if(r.status===401&&path!='/login')showLogin();throw Error(d.error||'Αποτυχία αιτήματος');}return d;}
function showLogin(){$('#login').hidden=false;$('#workspace').hidden=true;user=null;}
function enter(u){user=u;$('#login').hidden=true;$('#workspace').hidden=false;$('#identity').textContent=u.name;$('#newEvent').hidden=u.role!=='writer';$('#roleHint').textContent=u.role==='writer'?'Έχετε δικαίωμα επεξεργασίας.':'Κοινό ημερολόγιο · Μόνο ανάγνωση';load();}
$('#loginForm').onsubmit=async e=>{e.preventDefault();try{enter(await api('/login','POST',Object.fromEntries(new FormData(e.target))));e.target.reset();$('#loginError').textContent='';}catch(x){$('#loginError').textContent=x.message;}};
$('#logout').onclick=async()=>{await api('/logout','POST',{});showLogin();};
function dates(){let start=day(active);const view=$('#view').value;if(view==='month'){start=new Date(active.getFullYear(),active.getMonth(),1);start=add(start,-((start.getDay()+6)%7));return[start,add(start,42)];}if(['week','workweek'].includes(view)){start=add(start,-((start.getDay()+6)%7));return[start,add(start,view==='week'?7:5)];}return[start,add(start,view==='day'?1:30)];}
let loadNumber=0;
async function load(){const generation=++loadNumber;[rangeStart,rangeEnd]=dates();$('#datePicker').value=ymd(active);$('#period').textContent=human(active,{month:'long',year:'numeric'});try{const result=await api('/events?start='+encodeURIComponent(rangeStart.toISOString())+'&end='+encodeURIComponent(rangeEnd.toISOString()));if(generation!==loadNumber)return;events=result;$('#notice').textContent='';render();}catch(e){$('#notice').textContent=e.message;}}
function filtered(){const q=$('#search').value.toLocaleLowerCase();return events.filter(e=>(e.title+' '+e.location+' '+e.description).toLocaleLowerCase().includes(q));}
function inDay(e,d){return new Date(e.occurrence_start)<add(d,1)&&new Date(e.occurrence_end)>d;}
function eventButton(e){const b=node('button','event '+e.category,(e.all_day?'':time(e.occurrence_start)+' ')+e.title+(e.recurrence!=='none'?' ↻':''));b.title=e.title+(e.location?' · '+e.location:'');b.ondblclick=ev=>ev.stopPropagation();b.onclick=ev=>{ev.stopPropagation();open(e);};if(user.role==='writer'&&e.recurrence==='none'){b.draggable=true;b.ondragstart=ev=>ev.dataTransfer.setData('text/plain',String(e.id));}return b;}
function dropTarget(el,d,h=null){if(user.role!=='writer')return;el.ondragover=e=>e.preventDefault();el.ondrop=async ev=>{ev.preventDefault();ev.stopPropagation();const item=events.find(e=>String(e.id)===ev.dataTransfer.getData('text/plain'));if(!item||item.recurrence!=='none')return;const old=new Date(item.start), start=new Date(d);start.setHours(h===null?old.getHours():h,old.getMinutes());const end=new Date(start.getTime()+(new Date(item.end).getTime()-old.getTime()));try{await api('/events/'+item.id,'PUT',{...item,start:start.toISOString(),end:end.toISOString()});load();}catch(e){$('#notice').textContent=e.message;}};el.ondblclick=()=>open(null,d,h);}
function render(){const root=$('#calendar');const previous={key:root.dataset.range,top:root.scrollTop,left:root.scrollLeft};root.replaceChildren();const es=filtered();const view=$('#view').value;const isTime=['week','workweek','day'].includes(view);root.classList.toggle('time-view',isTime);root.dataset.range=view+':'+ymd(rangeStart);
 if(view==='month'){const grid=node('div','month');['Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ','Κυρ'].forEach(t=>grid.append(node('div','weekday',t)));for(let i=0;i<42;i++){const d=add(rangeStart,i),cell=node('div','dayCell'+(d.getMonth()!==active.getMonth()?' outside':'')+(ymd(d)===ymd(new Date())?' today':''));cell.append(node('span','dayNumber',d.getDate()));es.filter(e=>inDay(e,d)).sort((a,b)=>a.occurrence_start.localeCompare(b.occurrence_start)).forEach(e=>cell.append(eventButton(e)));dropTarget(cell,d);grid.append(cell);}root.append(grid);
 }else if(view==='agenda'){for(let d=new Date(rangeStart);d<rangeEnd;d=add(d,1)){const list=es.filter(e=>inDay(e,d));if(!list.length)continue;const row=node('section','agendaDay');row.append(node('h3','',human(d,{weekday:'long',day:'numeric',month:'long'})));list.sort((a,b)=>a.occurrence_start.localeCompare(b.occurrence_start)).forEach(e=>row.append(eventButton(e)));root.append(row);}if(!root.childElementCount)root.append(node('p','empty','Δεν υπάρχουν συμβάντα σε αυτή την περίοδο.'));
 }else{renderTimeGrid(root,es,previous);}}

function renderTimeGrid(root, es, previous) {
 const days=[]; for(let d=new Date(rangeStart);d<rangeEnd;d=add(d,1))days.push(new Date(d));
 const template=`64px repeat(${days.length}, minmax(0, 1fr))`;
 const canvas=node('div','timeCanvas');
 if(days.length===1)canvas.classList.add('singleDay');
 const head=node('div','timeHeader');
 const titles=node('div','timeTitles');titles.style.gridTemplateColumns=template;
 titles.append(node('div','zoneLabel','Ώρα'));
 for(const d of days){const cell=node('div','timeTitle'+(ymd(d)===ymd(new Date())?' isToday':''));cell.append(node('span','',human(d,{weekday:'short'})),node('strong','',d.getDate()));titles.append(cell);}
 const all=node('div','allDayRow');all.style.gridTemplateColumns=template;
 all.append(node('div','allDayLabel','Ολοήμερα'));
 for(const d of days){const cell=node('div','allDayCell');es.filter(e=>e.all_day&&inDay(e,d)).forEach(e=>cell.append(eventButton(e)));all.append(cell);}
 head.append(titles,all);canvas.append(head);
 const body=node('div','timeBody');body.style.gridTemplateColumns=template;
 const gutter=node('div','timeGutter');
 for(let hour=0;hour<24;hour++){const label=node('span','timeLabel',String(hour).padStart(2,'0')+':00');label.style.top=hour*60+'px';gutter.append(label);}
 body.append(gutter);
 for(const d of days){
  const col=node('div','timeColumn'+(ymd(d)===ymd(new Date())?' currentDay':''));
  for(let half=0;half<48;half++){
   const slot=node('div','timeSlot');
   if(user.role==='writer'){
    slot.tabIndex=0;slot.setAttribute('role','button');
    slot.setAttribute('aria-label','Νέο συμβάν '+human(d,{day:'numeric',month:'long'})+' '+String(Math.floor(half/2)).padStart(2,'0')+':'+(half%2?'30':'00'));
    const create=()=>{open(null,d,Math.floor(half/2));const start=new Date(d);start.setHours(Math.floor(half/2),half%2*30,0,0);form.elements.start.value=local(start);form.elements.end.value=local(new Date(start.getTime()+3600000));};
    slot.ondblclick=create;slot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();create();}};
   }
   col.append(slot);
  }
  if(user.role==='writer'){
   col.ondragover=e=>e.preventDefault();
   col.ondrop=async ev=>{
    ev.preventDefault();const item=events.find(e=>String(e.id)===ev.dataTransfer.getData('text/plain'));
    if(!item||item.all_day||item.recurrence!=='none')return;
    const minutes=Math.max(0,Math.min(1425,Math.round((ev.clientY-col.getBoundingClientRect().top)/15)*15));
    const start=new Date(d);start.setHours(0,minutes,0,0);
    const end=new Date(start.getTime()+(new Date(item.end)-new Date(item.start)));
    try{await api('/events/'+item.id,'PUT',{...item,start:start.toISOString(),end:end.toISOString()});load();}catch(e){$('#notice').textContent=e.message;}
   };
  }
  for(const item of CalendarLayout.layout(es,d)){
   const e=item.event,b=eventButton(e);b.classList.add('timedEvent');b.replaceChildren();
   b.append(node('strong','eventTitle',e.title+(e.recurrence!=='none'?' ↻':'')),node('span','eventTime',time(e.occurrence_start)+' – '+time(e.occurrence_end)));
   if(e.location)b.append(node('span','eventLocation',e.location));
   b.title=e.title+' · '+time(e.occurrence_start)+' – '+time(e.occurrence_end)+(e.location?' · '+e.location:'');
   b.setAttribute('aria-label',b.title);
   b.style.top=item.from+'px';b.style.height=(item.to-item.from)+'px';
   b.style.left=`calc(${item.column/item.columns*100}% + 2px)`;
   b.style.width=`calc(${100/item.columns}% - 4px)`;
   col.append(b);
  }
  if(ymd(d)===ymd(new Date())){const now=new Date(),line=node('div','nowLine');line.style.top=(now.getHours()*60+now.getMinutes())+'px';line.setAttribute('aria-hidden','true');col.append(line);}
  body.append(col);
 }
 canvas.append(body);root.append(canvas);
 if(previous.key===root.dataset.range){root.scrollTop=previous.top;root.scrollLeft=previous.left;}
 else{root.scrollTop=8*60;root.scrollLeft=0;}
}

function open(event=null,d=active,h=9){if(!event&&user.role!=='writer')return;editing=event;form.reset();const start=new Date(d);start.setHours(h??9,0,0,0);const defaults={title:'',description:'',location:'',start:start.toISOString(),end:new Date(start.getTime()+3600000).toISOString(),category:'blue',recurrence:'none',until_date:'',all_day:false};const data=event||defaults;for(const name of Object.keys(defaults)){const field=form.elements[name];if(name==='all_day')field.checked=!!data[name];else if(name==='start'||name==='end')field.value=local(new Date(data[name]));else field.value=data[name]||'';}const writer=user.role==='writer';[...form.elements].forEach(e=>{if(e.name)e.disabled=!writer;});$('#editorTitle').textContent=writer?(event?'Επεξεργασία συμβάντος':'Νέο συμβάν'):'Λεπτομέρειες συμβάντος';$('#save').hidden=!writer;$('#delete').hidden=!writer||!event;$('#seriesNote').hidden=data.recurrence==='none';$('#formError').textContent='';$('#editor').showModal();}
$('#close').onclick=()=>$('#editor').close();$('#newEvent').onclick=()=>open();
form.elements.recurrence.onchange=()=>$('#seriesNote').hidden=form.elements.recurrence.value==='none';
form.elements.all_day.onchange=()=>{if(form.elements.all_day.checked){const start=day(new Date(form.elements.start.value));form.elements.start.value=local(start);form.elements.end.value=local(add(start,1));}};
form.onsubmit=async ev=>{ev.preventDefault();const data=Object.fromEntries(new FormData(form));data.all_day=form.elements.all_day.checked;data.start=new Date(data.start).toISOString();data.end=new Date(data.end).toISOString();if(editing)data.version=editing.version;try{await api('/events'+(editing?'/'+editing.id:''),editing?'PUT':'POST',data);$('#editor').close();load();}catch(e){$('#formError').textContent=e.message;}};
$('#delete').onclick=async()=>{if(!confirm(editing.recurrence==='none'?'Διαγραφή συμβάντος;':'Διαγραφή ολόκληρης της σειράς;'))return;try{await api('/events/'+editing.id,'DELETE',{version:editing.version});$('#editor').close();load();}catch(e){$('#formError').textContent=e.message;}};
$('#view').onchange=load;$('#datePicker').onchange=e=>{if(e.target.value){active=new Date(e.target.value+'T12:00');load();}};$('#search').oninput=render;$('#today').onclick=()=>{active=new Date();load();};
for(const [id,n] of [['prev',-1],['next',1]])$('#'+id).onclick=()=>{const v=$('#view').value;if(v==='month')active=new Date(active.getFullYear(),active.getMonth()+n,1);else active=add(active,n*(v==='day'?1:v==='agenda'?30:7));load();};
api('/me').then(enter).catch(showLogin);

setInterval(()=>{if(user&&!document.hidden&&!$('#editor').open)load();},60000);
