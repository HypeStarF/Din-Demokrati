const BASE = "https://data.riksdagen.se";

/* =================================
   FETCH / NORMALISERING
================================= */

async function safeFetch(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const type = res.headers.get("content-type");

  if (!type || !type.includes("json")) {
    throw new Error("Non JSON response");
  }

  return res.json();
}

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mapDocument(doc) {
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

/* =================================
   LISTNING
================================= */

async function getLatestDocumentsByType(doktyp, maxStart = 200) {
  const results = [];
  const seen = new Set();

  for (let start = 0; start <= maxStart; start += 100) {
    const startParam = start === 0 ? "" : `&start=${start}`;

    const data = await safeFetch(
      `${BASE}/dokumentlista/?doktyp=${doktyp}&sort=datum&sortorder=desc&utformat=json${startParam}`
    );

    const docs = ensureArray(data?.dokumentlista?.dokument);

    if (docs.length === 0) {
      break;
    }

    for (const doc of docs) {
      if (!seen.has(doc.dok_id)) {
        seen.add(doc.dok_id);
        results.push(doc);
      }
    }
  }

  results.sort(
    (a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime()
  );

  return results.map(mapDocument);
}

export async function getLatestMotions() {
  return getLatestDocumentsByType("mot", 200);
}

export async function getLatestPropositions() {
  return getLatestDocumentsByType("prop", 200);
}

/* =================================
   ENSKILT DOKUMENT
================================= */

export async function getDocument(id) {
  try {
    const data = await safeFetch(`${BASE}/dokumentstatus/${id}.json`);
    const doc = data?.dokumentstatus?.dokument ?? {};

    return {
      id: doc.dok_id,
      title: doc.titel,
      date: doc.datum,
      type: doc.doktyp,
      organ: doc.organ,
      pdf: doc.dokument_url_pdf,
      excerpt: doc.sammandrag || doc.sammanfattning || null
    };
  } catch (err) {
    console.error("Riksdagen API error:", err);
    return null;
  }
}

/* =================================
   LAGPROCESS
================================= */

export async function getLawSteps(id) {
  try {
    const data = await safeFetch(`${BASE}/dokumentstatus/${id}.json`);
    const status = data?.dokumentstatus ?? {};

    const steps = [];

    if (status.datum) steps.push({ label: "Motion registrerad", completed: true });
    if (status.utskott) steps.push({ label: "Utskott behandlar", completed: true });
    if (status.betankande) steps.push({ label: "Betänkande", completed: true });
    if (status.votering) steps.push({ label: "Omröstning", completed: true });
    if (status.beslut) steps.push({ label: "Beslut", completed: true });

    return steps;
  } catch (err) {
    console.error("Tracker error:", err);
    return [];
  }
}

export async function getLawTimeline(id) {
  try {
    const data = await safeFetch(`${BASE}/dokumentstatus/${id}.json`);
    const events = ensureArray(data?.dokumentstatus?.aktivitet);

    return events.map((e) => ({
      label: e.handelsetext,
      date: e.datum
    }));
  } catch (err) {
    console.error("Timeline error:", err);
    return [];
  }
}

/* =================================
   VOTERINGAR
================================= */

export async function getVotesForDocument(id) {
  try {
    const data = await safeFetch(`${BASE}/voteringlista/?dokid=${id}&utformat=json`);
    const votes = ensureArray(data?.voteringlista?.votering);

    return votes.map((v) => {
      const parties = ensureArray(v.voteringresultat);

      return {
        title: v.punkt,
        date: v.datum,
        yes: v.ja,
        no: v.nej,
        abstain: v.avstar,
        absent: v.fravarande,
        parties: parties.map((p) => ({
          party: p.parti,
          vote: p.rostat
        }))
      };
    });
  } catch (err) {
    console.error("Vote API error:", err);
    return [];
  }
}

/* =================================
   DOKUMENTUTDRAG
================================= */

export async function getDocumentExcerpt(id, type) {
  try {
    const res = await fetch(`${BASE}/dokument/${id}.html`);

    if (!res.ok) {
      throw new Error("HTML fetch failed");
    }

    let html = await res.text();

    let heading = "";

    if (type === "prop") {
      heading = "Propositionens huvudsakliga innehåll";
    }

    if (type === "mot") {
      heading = "Förslag till riksdagsbeslut";
    }

    if (!heading) return null;

    const start = html.indexOf(heading);

    if (start === -1) {
      return null;
    }

    let section = html.slice(start);

    const endMatch = section.match(/<h[1-6][^>]*>/i);

    if (endMatch) {
      section = section.slice(0, endMatch.index);
    }

    section = section
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return section;
  } catch (err) {
    console.error("Excerpt error:", err);
    return null;
  }
}

export async function getCommitteeReport(id) {
  try {
    const data = await safeFetch(`${BASE}/dokumentstatus/${id}.json`);
    const refs = ensureArray(data?.dokumentstatus?.dokreferens);

    const report = refs.find((r) => r.doktyp === "bet");

    if (!report) return null;

    return {
      id: report.dok_id,
      title: report.titel
    };
  } catch (err) {
    console.error("Report lookup error:", err);
    return null;
  }
}

export async function getVotesForReport(reportId) {
  try {
    const data = await safeFetch(`${BASE}/voteringlista/?dokid=${reportId}&utformat=json`);
    const votes = ensureArray(data?.voteringlista?.votering);

    return votes.map((v) => ({
      date: v.datum,
      title: v.punkt,
      yes: v.ja,
      no: v.nej,
      abstain: v.avstar
    }));
  } catch (err) {
    console.error("Vote lookup error:", err);
    return [];
  }
}

export async function getDocumentStatus(id) {
  const res = await fetch(`${BASE}/dokumentstatus/${id}.json`);
  const data = await res.json();

  return data?.dokumentstatus ?? {};
}