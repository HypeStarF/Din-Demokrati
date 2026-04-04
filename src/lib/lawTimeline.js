export function buildLawTimeline(lawCase){

const steps=[

{ label: lawCase.type === "prop" ? "Proposition" : "Motion" },
{ label:"Utskottsbehandling" },
{ label:"Betänkande" },
{ label:"Debatt" },
{ label:"Omröstning" },
{ label:"Beslut" }

]

/* ========================
MAPPA STAGE → STEG
======================== */

const stageMap = {
proposal: 0,
committee: 1,
report: 2,
debate: 3,
vote: 4,
decision: 5
}

const current = stageMap[lawCase.stage] ?? 0

return steps.map((step,i)=>({

label: step.label,

date: i === 0 ? lawCase.date : undefined,

completed: i < current,

current: i === current

}))

}