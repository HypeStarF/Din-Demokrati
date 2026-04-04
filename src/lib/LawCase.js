const API_BASE = "https://data.riksdagen.se";

/* =================================
   GENERELLA HELPERS
================================= */

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstDate(value) {
  return value?.split(" ")?.[0] ?? null;
}

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

function normalizeDocType(docType) {
  if (docType === "prop") return "Proposition";
  if (docType === "mot") return "Motion";
  return docType || "Dokument";
}

/* =================================
   FETCH HELPERS
================================= */

async function fetchJSON(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${url}`);
  }

  return res.json();
}

async function fetchDocumentStatus(docId) {
  return fetchJSON(`${API_BASE}/dokumentstatus/${docId}.json`);
}

async function fetchDocumentList(params) {
  return fetchJSON(`${API_BASE}/dokumentlista/?${params}&utformat=json`);
}

async function fetchVoteListByDocId(docId) {
  return fetchJSON(`${API_BASE}/voteringlista/?dok_id=${docId}&utformat=json`);
}

/* =================================
   PARSERS / NORMALISERING
================================= */

function parseSponsors(status) {
  return toArray(status?.dokintressent?.intressent).map((person) => ({
    name: person.namn,
    party: person.partibet,
  }));
}

function parseProposals(status) {
  return toArray(status?.dokforslag?.forslag);
}

function parseAttachments(status) {
  return toArray(status?.dokument?.dokumentbilaga?.bilaga)
    .map((attachment) => ({
      filtyp: attachment.filtyp || "",
      fil_url: attachment.fil_url || attachment.url || "",
    }))
    .filter((attachment) => attachment.fil_url);
}

function parseReferences(status) {
  return toArray(status?.dokreferens?.referens);
}

function parseReportFromReferences(refs) {
  const reportRef = refs.find((ref) => ref.ref_dok_typ === "bet");

  if (!reportRef) return null;

  return {
    id: reportRef.ref_dok_id,
    title: reportRef.ref_dok_titel,
    bet: reportRef.ref_dok_bet,
  };
}

function parseRelatedDocumentsFromReferences(refs) {
  return refs
    .filter((ref) => ref.ref_dok_typ === "prop" || ref.ref_dok_typ === "mot")
    .map((ref) => ({
      id: ref.ref_dok_id,
      title: ref.ref_dok_titel,
      type: ref.ref_dok_typ,
    }));
}

function parseVotes(voteData) {
  return toArray(voteData?.voteringlista?.votering).map((vote) => ({
    title: vote.beteckning,
    date: vote.datum,
    yes: toInt(vote.ja),
    no: toInt(vote.nej),
    abstain: toInt(vote.avstar),
  }));
}

function parseCommitteeProposal(statusData) {
  return toArray(statusData?.dokumentstatus?.dokforslag?.forslag).map(
    (proposal) => ({
      punkt: proposal.nummer,
      text: proposal.lydelse,
      decision: proposal.kammaren || null,
    })
  );
}

function computeStage({ report, votes, committeeProposal }) {
  const hasDecision = committeeProposal.some(
    (proposal) => proposal.decision && proposal.decision !== ""
  );

  if (hasDecision) return "decision";
  if (votes.length > 0) return "vote";
  if (report) return "report";
  return "proposal";
}

/* =================================
   API-SPECIFIKA HJÄLPFUNKTIONER
================================= */

async function findCommitteeReportFallback(docId, rm) {
  if (!rm) return null;

  try {
    const data = await fetchDocumentList(`doktyp=bet&rm=${rm}`);
    const reports = toArray(data?.dokumentlista?.dokument);

    for (const report of reports) {
      try {
        const statusData = await fetchDocumentStatus(report.dok_id);
        const refs = parseReferences(statusData?.dokumentstatus);

        const matchesCurrentDoc = refs.some(
          (ref) => ref.dok_id === docId || ref.relaterat_id === docId
        );

        if (matchesCurrentDoc) {
          return {
            id: report.dok_id,
            title: report.titel,
          };
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function getDocumentsInReport(reportId) {
  const data = await fetchDocumentStatus(reportId);
  const status = data?.dokumentstatus || {};
  const refs = parseReferences(status);

  return parseRelatedDocumentsFromReferences(refs);
}

async function getVotes(reportId) {
  const data = await fetchVoteListByDocId(reportId);
  return parseVotes(data);
}

async function getCommitteeProposal(reportId) {
  const data = await fetchDocumentStatus(reportId);
  return parseCommitteeProposal(data);
}

/* =================================
   HUVUDFUNKTION
================================= */

export async function getLawCase(id) {
  const data = await fetchDocumentStatus(id);

  const status = data?.dokumentstatus || {};
  const doc = status?.dokument || {};

  const refs = parseReferences(status);

  const docType = doc.typ || null;
  const type = normalizeDocType(docType);
  const date = firstDate(doc.datum);

  let report = parseReportFromReferences(refs);

  if (!report && doc.rm) {
    report = await findCommitteeReportFallback(doc.dok_id, doc.rm);
  }

  let relatedDocs = [];
  let votes = [];
  let committeeProposal = [];

  if (report?.id) {
    const [relatedDocsResult, votesResult, committeeProposalResult] =
      await Promise.all([
        getDocumentsInReport(report.id),
        getVotes(report.id),
        getCommitteeProposal(report.id),
      ]);

    relatedDocs = relatedDocsResult;
    votes = votesResult;
    committeeProposal = committeeProposalResult;
  }

  const sponsors = parseSponsors(status);
  const proposals = parseProposals(status);
  const attachments = parseAttachments(status);

  const stage = computeStage({
    report,
    votes,
    committeeProposal,
  });

  const lawCase = {
    id: doc.dok_id,
    title: doc.titel,
    docType,
    type,
    date,

    committee: doc.organ,
    committeeName: doc.organ,

    submitted: doc.datum || null,
    tabled: doc.systemdatum || null,
    referred: status?.behandlas_i || null,
    motionCategory: doc.subtyp || null,

    motionBase: null,

    report,
    relatedDocs,
    votes,
    committeeProposal,

    stage,

    sponsors,
    proposals,
    attachments,

    html: doc.html || null,
  };

  console.log("LAWCASE:", {
    id: lawCase.id,
    stage: lawCase.stage,
    report: !!lawCase.report,
    votes: lawCase.votes.length,
    decision: lawCase.committeeProposal.length,
  });

  return lawCase;
}