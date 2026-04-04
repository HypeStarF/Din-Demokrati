const BASE = "https://data.riksdagen.se";

/* säker fetch */

async function safeFetch(url){

const res = await fetch(url);

if(!res.ok){
throw new Error(`HTTP ${res.status}`);
}

const type = res.headers.get("content-type");

if(!type || !type.includes("json")){
throw new Error("Non JSON response");
}

return res.json();

}

/* normalisera dokument */

function mapDocument(doc){

return {
id: doc.dok_id,
title: doc.titel,
date: doc.datum,
type: doc.doktyp,
organ: doc.organ,
pdf: doc.dokument_url_pdf,
url: `/lagforslag/${doc.dok_id}`
};

}

/* motioner */

export async function getLatestMotions(){

let results = [];
const seen = new Set();

/* hämta nyaste först */

const first = await safeFetch(
`${BASE}/dokumentlista/?doktyp=mot&sort=datum&sortorder=desc&utformat=json`
);

let docs = first?.dokumentlista?.dokument ?? [];

docs.forEach(d=>{
if(!seen.has(d.dok_id)){
seen.add(d.dok_id);
results.push(d);
}
});

/* hämta äldre */

for(let start = 100; start <= 500; start += 100){

const data = await safeFetch(
`${BASE}/dokumentlista/?doktyp=mot&sort=datum&sortorder=desc&utformat=json&start=${start}`
);

const batch = data?.dokumentlista?.dokument ?? [];

batch.forEach(d=>{
if(!seen.has(d.dok_id)){
seen.add(d.dok_id);
results.push(d);
}
});

}

/* sortera säkert */

results.sort((a,b)=>
new Date(b.datum).getTime() - new Date(a.datum).getTime()
);

return results.map(doc => mapDocument(doc));

}



/* propositioner */

export async function getLatestPropositions(){

let results = [];
const seen = new Set();

const first = await safeFetch(
`${BASE}/dokumentlista/?doktyp=prop&sort=datum&sortorder=desc&utformat=json`
);

let docs = first?.dokumentlista?.dokument ?? [];

docs.forEach(d=>{
if(!seen.has(d.dok_id)){
seen.add(d.dok_id);
results.push(d);
}
});

for(let start = 100; start <= 500; start += 100){

const data = await safeFetch(
`${BASE}/dokumentlista/?doktyp=prop&sort=datum&sortorder=desc&utformat=json&start=${start}`
);

const batch = data?.dokumentlista?.dokument ?? [];

batch.forEach(d=>{
if(!seen.has(d.dok_id)){
seen.add(d.dok_id);
results.push(d);
}
});

}

results.sort((a,b)=>
new Date(b.datum).getTime() - new Date(a.datum).getTime()
);

return results.map(doc => mapDocument(doc));

}




/* dokument */

export async function getDocument(id){

try{

const data = await safeFetch(
`${BASE}/dokumentstatus/${id}.json`
);

const doc = data?.dokumentstatus?.dokument ?? {};

return {
id: doc.dok_id,
title: doc.titel,
date: doc.datum,
type: doc.doktyp,
organ: doc.organ,
pdf: doc.dokument_url_pdf,

/* detta är propositionens huvudsakliga innehåll */
excerpt: doc.sammandrag || doc.sammanfattning || null

};

}catch(err){

console.error("Riksdagen API error:",err);
return null;

}

}


/* lagprocess */

export async function getLawSteps(id){

try{

const data = await safeFetch(
`${BASE}/dokumentstatus/${id}.json`
);

const status = data?.dokumentstatus ?? {};

const steps = [];

if(status.datum) steps.push({label:"Motion registrerad",completed:true});
if(status.utskott) steps.push({label:"Utskott behandlar",completed:true});
if(status.betankande) steps.push({label:"Betänkande",completed:true});
if(status.votering) steps.push({label:"Omröstning",completed:true});
if(status.beslut) steps.push({label:"Beslut",completed:true});

return steps;

}catch(err){

console.error("Tracker error:",err);
return [];

}

}

/* lagprocess tidslinje */

export async function getLawTimeline(id){

try{

const data = await safeFetch(
`${BASE}/dokumentstatus/${id}.json`
);

const events = data?.dokumentstatus?.aktivitet ?? [];

return events.map(e => ({
label:e.handelsetext,
date:e.datum
}));

}catch(err){

console.error("Timeline error:",err);
return [];

}

}

/* voteringar */

export async function getVotesForDocument(id){

try{

const data = await safeFetch(
`${BASE}/voteringlista/?dokid=${id}&utformat=json`
);

let votes = data?.voteringlista?.votering ?? [];

if(!Array.isArray(votes)){
votes = [votes];
}

return votes.map(v => {

let parties = v.voteringresultat ?? [];

if(!Array.isArray(parties)){
parties = [parties];
}

return {
title: v.punkt,
date: v.datum,

yes: v.ja,
no: v.nej,
abstain: v.avstar,
absent: v.fravarande,

parties: parties.map(p => ({
party: p.parti,
vote: p.rostat
}))

};

});

}catch(err){

console.error("Vote API error:",err);
return [];

}

}




/* extrahera relevant dokumentdel */

export async function getDocumentExcerpt(id,type){

try{

const res = await fetch(
`https://data.riksdagen.se/dokument/${id}.html`
);

if(!res.ok){
throw new Error("HTML fetch failed");
}

let html = await res.text();

/* välj rubrik */

let heading = "";

if(type === "prop"){
heading = "Propositionens huvudsakliga innehåll";
}

if(type === "mot"){
heading = "Förslag till riksdagsbeslut";
}

if(!heading) return null;

/*
hitta rubriken och texten efter
*/

const start = html.indexOf(heading);

if(start === -1){
return null;
}

let section = html.slice(start);

/*
stoppa vid nästa rubrik
*/

const endMatch = section.match(/<h[1-6][^>]*>/i);

if(endMatch){
section = section.slice(0,endMatch.index);
}

/*
ta bort HTML
*/

section = section
.replace(/<[^>]*>/g," ")
.replace(/\s+/g," ")
.trim();

return section;

}catch(err){

console.error("Excerpt error:",err);
return null;

}

}
export async function getCommitteeReport(id){

try{

const data = await safeFetch(
`${BASE}/dokumentstatus/${id}.json`
);

let refs = data?.dokumentstatus?.dokreferens ?? [];

if(!Array.isArray(refs)){
refs = [refs];
}

/* hitta betänkande */

const report = refs.find(r => r.doktyp === "bet");

if(!report) return null;

return {
id: report.dok_id,
title: report.titel
};

}catch(err){

console.error("Report lookup error:",err);
return null;

}

}
export async function getVotesForReport(reportId){

try{

const data = await safeFetch(
`${BASE}/voteringlista/?dokid=${reportId}&utformat=json`
);

let votes = data?.voteringlista?.votering ?? [];

if(!Array.isArray(votes)){
votes = [votes];
}

return votes.map(v => ({
date: v.datum,
title: v.punkt,
yes: v.ja,
no: v.nej,
abstain: v.avstar
}));

}catch(err){

console.error("Vote lookup error:",err);
return [];

}

}
export async function getDocumentStatus(id){

const res = await fetch(
`https://data.riksdagen.se/dokumentstatus/${id}.json`
);

const data = await res.json();

return data?.dokumentstatus ?? {};
}




