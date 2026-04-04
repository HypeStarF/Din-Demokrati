/* -------------------------------- */
/* helpers                          */
/* -------------------------------- */

function ensureArray(v){
if(!v) return []
return Array.isArray(v) ? v : [v]
}

async function fetchJSON(url){

const res = await fetch(url)

if(!res.ok){
throw new Error("Riksdagen API error")
}

return res.json()

}

/* -------------------------------- */
/* main                             */
/* -------------------------------- */

export async function getMotionDetails(id){

/* -------------------------------- */
/* dokument                         */
/* -------------------------------- */

const docData = await fetchJSON(
`https://data.riksdagen.se/dokument/${id}.json`
)

const doc = docData?.dokument ?? {}

/* -------------------------------- */
/* dokumentstatus                   */
/* -------------------------------- */

const statusData = await fetchJSON(
`https://data.riksdagen.se/dokumentstatus/${id}.json`
)

const status = statusData?.dokumentstatus ?? {}

/* -------------------------------- */
/* normalisera data                 */
/* -------------------------------- */

const references = ensureArray(status.dokreferens)
const activities = ensureArray(status.aktivitet)
const proposals = ensureArray(status.utskottsforslag)
const decisions = ensureArray(status.beslut)
const interests = ensureArray(status?.dokintressent?.intressent)
const votering = ensureArray(status.votering)

/* -------------------------------- */
/* motionärer                       */
/* -------------------------------- */

const sponsors = interests.map(i => ({
name: i.namn,
party: i.parti,
role: i.roll
}))

/* -------------------------------- */
/* utskott                          */
/* -------------------------------- */

let committee = null

if(status.bereddav){
committee = status.bereddav
}

for(const a of activities){

if(a.organ && a.organ.endsWith("U")){
committee = a.organ
break
}

}

/* -------------------------------- */
/* betänkande                       */
/* -------------------------------- */

let committeeReport = null

for(const r of references){

if(r.doktyp === "bet"){

committeeReport = {
id: r.dok_id,
title: r.titel,
url: `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/${r.dok_id}`
}

break

}

}

/* -------------------------------- */
/* utskottets förslag               */
/* -------------------------------- */

const committeeProposal = proposals
.map(p => p.forslag)
.filter(Boolean)

/* -------------------------------- */
/* beslut                           */
/* -------------------------------- */

const chamberDecision = decisions
.map(d => d.beslut)
.filter(Boolean)

/* -------------------------------- */
/* voteringar                       */
/* -------------------------------- */

let votes = []

try{

const voteData = await fetchJSON(
`https://data.riksdagen.se/voteringlista/?hangar_id=${id}&utformat=json`
)

votes = ensureArray(voteData?.voteringlista?.votering)

}catch(e){

votes = []

}

/* -------------------------------- */
/* status                           */
/* -------------------------------- */

let stage = "proposal"

if(decisions.length > 0){
stage = "decision"
}
else if(votes.length > 0){
stage = "vote"
}
else if(committeeReport){
stage = "report"
}
else if(committee){
stage = "committee"
}

/* -------------------------------- */
/* komplett objekt                  */
/* -------------------------------- */

const motion = {

id: doc?.dok_id,
title: doc?.titel,
date: doc?.datum,
type: doc?.doktyp,
organ: doc?.organ,
summary: doc?.summary,

committee,
committeeReport,

committeeProposal,
chamberDecision,

sponsors,

votes,

stage,

raw:{
document: doc,
status: status
}

}

/* -------------------------------- */
/* debug                            */
/* -------------------------------- */

console.log("\n===== MOTION DATA =====")
console.log(JSON.stringify(motion,null,2))
console.log("===== END MOTION DATA =====\n")

return motion

}