function ensureArray(v){
if(!v) return []
return Array.isArray(v) ? v : [v]
}

async function fetchJSON(url){
const res = await fetch(url)
if(!res.ok) throw new Error("API error: " + url)
return res.json()
}


/* =================================
FALLBACK – SÖK BETÄNKANDE
================================= */

async function findCommitteeReportFallback(docId, rm){

try{

const data = await fetchJSON(
`https://data.riksdagen.se/dokumentlista/?doktyp=bet&rm=${rm}&utformat=json`
)

let reports = ensureArray(data?.dokumentlista?.dokument)

for(const rep of reports){

try{

const statusData = await fetchJSON(
`https://data.riksdagen.se/dokumentstatus/${rep.dok_id}.json`
)

let refs = ensureArray(
statusData?.dokumentstatus?.dokreferens?.referens
)

for(const r of refs){

if(r.dok_id === docId || r.relaterat_id === docId){

return {
id: rep.dok_id,
title: rep.titel
}

}

}

}catch(e){ continue }

}

}catch(e){}

return null
}


/* =================================
HÄMTA ALLA DOKUMENT I BETÄNKANDE
================================= */

async function getDocumentsInReport(reportId){

const data = await fetchJSON(
`https://data.riksdagen.se/dokumentstatus/${reportId}.json`
)

let refs = ensureArray(
data?.dokumentstatus?.dokreferens?.referens
)

const docs = []

refs.forEach(r=>{

if(r.ref_dok_typ === "prop" || r.ref_dok_typ === "mot"){

docs.push({
id: r.ref_dok_id,
title: r.ref_dok_titel,
type: r.ref_dok_typ
})

}

})

return docs
}


/* =================================
HÄMTA VOTERING
================================= */

async function getVotes(reportId){

const data = await fetchJSON(
`https://data.riksdagen.se/voteringlista/?dok_id=${reportId}&utformat=json`
)

let votes = ensureArray(
data?.voteringlista?.votering
)

return votes.map(v=>({
title: v.beteckning,
date: v.datum,
yes: parseInt(v.ja) || 0,
no: parseInt(v.nej) || 0,
abstain: parseInt(v.avstar) || 0
}))
}


/* =================================
UTSKOTTETS FÖRSLAG
================================= */

async function getCommitteeProposal(reportId){

const data = await fetchJSON(
`https://data.riksdagen.se/dokumentstatus/${reportId}.json`
)

let proposals = ensureArray(
data?.dokumentstatus?.dokforslag?.forslag
)

return proposals.map(p=>({
punkt: p.nummer,
text: p.lydelse,
decision: p.kammaren || null
}))
}


/* =================================
HUVUDFUNKTION
================================= */

export async function getLawCase(id){

const data = await fetchJSON(
`https://data.riksdagen.se/dokumentstatus/${id}.json`
)

const status = data?.dokumentstatus || {}
const doc = status?.dokument || {}



/* ========================
GRUNDINFO
======================== */

const type = doc.typ === "prop" ? "Proposition" : "Motion"
const date = doc.datum?.split(" ")[0]



/* ========================
BETÄNKANDE (PRIMÄR)
======================== */

let refs = ensureArray(status?.dokreferens?.referens)

let report = null

for(const r of refs){

if(r.ref_dok_typ === "bet"){

report = {
id: r.ref_dok_id,
title: r.ref_dok_titel,
bet: r.ref_dok_bet
}

break
}

}



/* ========================
FALLBACK
======================== */

if(!report && doc.rm){
report = await findCommitteeReportFallback(doc.dok_id, doc.rm)
}



/* ========================
RELATERAT + VOTERING + FÖRSLAG
======================== */

let relatedDocs = []
let votes = []
let committeeProposal = []

if(report){

relatedDocs = await getDocumentsInReport(report.id)
votes = await getVotes(report.id)
committeeProposal = await getCommitteeProposal(report.id)

}



/* ========================
INTRESSENTER
======================== */

let sponsors = ensureArray(
status?.dokintressent?.intressent
).map(i=>({
name: i.namn,
party: i.partibet
}))



/* ========================
YRKANDEN
======================== */

let proposals = ensureArray(
status?.dokforslag?.forslag
)



/* ========================
STATUS (VIKTIGASTE DELEN)
======================== */

let stage = "proposal"

const hasDecision = committeeProposal.some(p =>
p.decision && p.decision !== ""
)

const hasVote = votes.length > 0

if(hasDecision){
stage = "decision"
}
else if(hasVote){
stage = "vote"
}
else if(report){
stage = "report"
}



/* ========================
RESULTAT
======================== */

const lawCase = {

id: doc.dok_id,
title: doc.titel,
type,
date,

committee: doc.organ,

report,

relatedDocs,
votes,
committeeProposal,

stage, // 🔥 central

sponsors,
proposals,

html: doc.html

}


/* DEBUG */

console.log("LAWCASE:",{
id: lawCase.id,
stage: lawCase.stage,
report: !!lawCase.report,
votes: lawCase.votes.length,
decision: lawCase.committeeProposal.length
})

return lawCase

}