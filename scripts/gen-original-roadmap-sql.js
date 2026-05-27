// One-off: emits SQL to insert the original roadmap into the new `roadmaps`
// table, split into Q2 2026 (May/June) and Q3 2026 (Jul/Aug/Sep).

const initiatives = [
  { key: 'catina', name: 'Catina: New Editor', meta: 'Editor · Migration · Meter · Collaboration', color: 'catina' },
  { key: 'ai-assistant', name: 'AI Assistant', meta: 'In-product AI chat', color: 'ai-assistant' },
  { key: 'risk', name: 'AI Risk Review', meta: 'Document risk analysis', color: 'risk' },
  { key: 'enterprise', name: 'Enterprise APIs & Partnerships', meta: 'Integrations & partner platform', color: 'enterprise' },
  { key: 'commerce', name: 'Commerce & Buying Journey', meta: 'DOD+ · eComm · Pricing', color: 'commerce' },
  { key: 'ubp', name: 'Define the Meter', meta: 'Usage Based Pricing · Staged UI Elements', color: 'ubp' },
  { key: 'platform', name: 'Platform & Internal Tooling', meta: 'Infra · Auth · SC · Internal apps', color: 'platform' },
];

// Original seed (absolute month 0..4 = May,Jun,Jul,Aug,Sep).
const seed = [
  { stream: 'catina', lane: 'dev', month: 0, color: 'catina', milestone: false, badges: [], items: ['FF cleanup / Amplitude / Collaboration — Discovery', 'DOD+ scoping'] },
  { stream: 'catina', lane: 'dev', month: 1, color: 'catina', milestone: false, badges: [], items: ['New Editor Improvements, stabilization', 'View other editors; simplify variable entry; monitor load time', 'Collaboration — development'] },
  { stream: 'catina', lane: 'dev', month: 2, color: 'catina', milestone: false, badges: [], items: ['Transition Forms to V2 Catina', 'Add Attachments to Agreements in New Editor workflow', 'Move pay app calculations to the front end', 'Collaboration — testing'] },
  { stream: 'catina', lane: 'dev', month: 3, color: 'catina', milestone: false, badges: [], items: ['Add Revision History / Versions for documents'] },
  { stream: 'catina', lane: 'dev', month: 4, color: 'catina', milestone: false, badges: [], items: ['Low-cost E-Signature replacement w/ per-signer tracking display'] },
  { stream: 'catina', lane: 'release', month: 0, color: 'catina', milestone: true, badges: [], items: ['GA Release of New Editor', 'Catina migration starts'] },
  { stream: 'catina', lane: 'release', month: 1, color: 'catina', milestone: false, badges: [], items: ['Catina migration completes'] },
  { stream: 'catina', lane: 'release', month: 2, color: 'catina', milestone: false, badges: [], items: ['DoD+ Migration to Catina', 'Attachments Appended to Documents'] },
  { stream: 'catina', lane: 'release', month: 3, color: 'catina', milestone: false, badges: [], items: ['Version History', 'Collaboration — first release'] },
  { stream: 'catina', lane: 'release', month: 4, color: 'catina', milestone: false, badges: [], items: ['Collaboration — post-MVP enhancements'] },

  { stream: 'ai-assistant', lane: 'dev', month: 0, color: 'ai-assistant', milestone: false, badges: [], items: ['Product POC — AI Chat v2'] },
  { stream: 'ai-assistant', lane: 'release', month: 0, color: 'ai-assistant', milestone: false, badges: [], items: ['AI Assistant MVP — Opt-In'] },
  { stream: 'ai-assistant', lane: 'release', month: 2, color: 'ai-assistant', milestone: true, badges: [], items: ['GA Release of AI Assistant'] },

  { stream: 'risk', lane: 'dev', month: 0, color: 'risk', milestone: false, badges: [], items: ['Product POC for Risk Review', 'Team getting set up / Enterprise API'] },
  { stream: 'risk', lane: 'dev', month: 1, color: 'risk', milestone: false, badges: [], items: ['Complete MVP Risk Review', 'Risk Review app'] },
  { stream: 'risk', lane: 'dev', month: 2, color: 'risk', milestone: false, badges: [], items: ['Risk Review Support / Refinements', 'Risk Review App'] },
  { stream: 'risk', lane: 'release', month: 3, color: 'risk', milestone: true, badges: [], items: ['Risk Review App Release'] },

  { stream: 'enterprise', lane: 'dev', month: 0, color: 'enterprise', milestone: false, badges: [], items: ['Enterprise API Solutioning', 'FusionAuth POC for partners', 'Procore Integration / Pipelines'] },
  { stream: 'enterprise', lane: 'dev', month: 1, color: 'enterprise', milestone: false, badges: [], items: ['Enterprise API Development', 'FusionAuth Configuration for Partners'] },
  { stream: 'enterprise', lane: 'dev', month: 2, color: 'enterprise', milestone: false, badges: [], items: ['Procore Integration Kick-off'] },
  { stream: 'enterprise', lane: 'dev', month: 3, color: 'enterprise', milestone: false, badges: [], items: ['Procore API Integration Development'] },
  { stream: 'enterprise', lane: 'release', month: 2, color: 'enterprise', milestone: true, badges: [], items: ['Enterprise API — MVP Release'] },
  { stream: 'enterprise', lane: 'release', month: 4, color: 'enterprise', milestone: true, badges: [], items: ['Procore API Integration — Beta Release'] },

  { stream: 'commerce', lane: 'dev', month: 0, color: 'commerce', milestone: false, badges: ['catina'], items: ['DOD+ Entitlements - Catina'] },
  { stream: 'commerce', lane: 'dev', month: 0, color: 'commerce', milestone: false, badges: ['ecomm'], items: ['DOD+ Entitlements - eCommerce'] },
  { stream: 'commerce', lane: 'dev', month: 1, color: 'commerce', milestone: false, badges: [], items: ['DOD+ Entitlements', 'DOD+ Purchase Migrations', 'eComm — Enhancements'] },
  { stream: 'commerce', lane: 'dev', month: 2, color: 'commerce', milestone: false, badges: [], items: ['eComm — Ongoing Marketing Enhancements'] },
  { stream: 'commerce', lane: 'dev', month: 3, color: 'commerce', milestone: false, badges: [], items: ['eComm — Ongoing Marketing Enhancements'] },
  { stream: 'commerce', lane: 'dev', month: 4, color: 'commerce', milestone: false, badges: [], items: ['eComm — Ongoing Marketing Enhancements'] },

  { stream: 'ubp', lane: 'dev', month: 0, color: 'ubp', milestone: false, badges: ['product'], items: ['Requirement Gathering'] },
  { stream: 'ubp', lane: 'dev', month: 0, color: 'ubp', milestone: false, badges: [], label: 'eCommerce', items: ['eComm: Stripe UBP scoping'] },
  { stream: 'ubp', lane: 'dev', month: 0, color: 'ubp', milestone: false, badges: ['catina'], items: ['Catina: staged UI rollout scoping'] },
  { stream: 'ubp', lane: 'dev', month: 1, color: 'ubp', milestone: false, badges: [], items: ['Metered billing architecture', 'Usage tracking instrumentation'] },
  { stream: 'ubp', lane: 'dev', month: 1, color: 'ubp', milestone: false, badges: ['catina'], items: ['Any Outstanding Usage Based Statistics'] },
  { stream: 'ubp', lane: 'dev', month: 1, color: 'ubp', milestone: false, badges: ['catina'], items: ['Integrate Usage Based Pricing into v2 Editor'] },
  { stream: 'ubp', lane: 'dev', month: 1, color: 'ubp', milestone: false, badges: ['ecomm'], items: ['Estuate Scoping and Requirement Writing'] },
  { stream: 'ubp', lane: 'dev', month: 2, color: 'ubp', milestone: false, badges: ['ecomm'], items: ['Implement Usage Based Pricing'] },
  { stream: 'ubp', lane: 'dev', month: 2, color: 'ubp', milestone: false, badges: ['catina'], items: ['Usage Based UI Elements - Next Items'] },
  { stream: 'ubp', lane: 'dev', month: 3, color: 'ubp', milestone: false, badges: [], items: ['Customer-facing usage dashboard'] },
  { stream: 'ubp', lane: 'dev', month: 3, color: 'ubp-ecomm', milestone: false, badges: [], label: 'eCommerce', items: ['eCommerce — Stripe — Usage Based Pricing (cont.)'] },
  { stream: 'ubp', lane: 'dev', month: 4, color: 'ubp-ecomm', milestone: false, badges: [], label: 'eCommerce', items: ['eCommerce — Stripe — UBP finalization'] },
  { stream: 'ubp', lane: 'dev', month: 4, color: 'ubp', milestone: false, badges: ['catina'], items: ['Customers Usage Based Statistics'] },
  { stream: 'ubp', lane: 'release', month: 1, color: 'ubp', milestone: false, badges: ['catina'], items: ['Finalization Address Mismatch Flow'] },
  { stream: 'ubp', lane: 'release', month: 1, color: 'ubp', milestone: false, badges: ['ecomm'], items: ['Estuate POC in Our Env'] },

  { stream: 'platform', lane: 'dev', month: 1, color: 'platform', milestone: false, badges: [], items: ['Increased logging in Catina (~10% of effort)', 'API / front-end containerization / Doc Certificate', 'Minor enhancements to SC v1; begin rebuilding separately'] },
  { stream: 'platform', lane: 'dev', month: 2, color: 'platform', milestone: false, badges: [], items: ['Increased logging in Catina (~10% of effort)', 'Fusion Auth rollout', 'Development of SCV2'] },
  { stream: 'platform', lane: 'dev', month: 3, color: 'platform', milestone: false, badges: [], items: ['Fusion Auth rollout'] },
  { stream: 'platform', lane: 'release', month: 0, color: 'platform', milestone: false, badges: [], items: ['License transfer tooling', 'Migration status page'] },
  { stream: 'platform', lane: 'release', month: 3, color: 'platform', milestone: true, badges: ['platform'], items: ['Deliver SCv2'] },
];

let counter = 0;
const id = () => `seed-${(counter++).toString(36)}`;

// Q2 2026 columns: Apr(0) May(1) Jun(2). Original May(0)->1, June(1)->2.
const q2Map = { 0: 1, 1: 2 };
// Q3 2026 columns: Jul(0) Aug(1) Sep(2). Original Jul(2)->0, Aug(3)->1, Sep(4)->2.
const q3Map = { 2: 0, 3: 1, 4: 2 };

function build(map) {
  return seed
    .filter((t) => t.month in map)
    .map((t) => ({ ...t, id: id(), month: map[t.month] }));
}

const q2Tiles = build(q2Map);
const q3Tiles = build(q3Map);

const initJson = JSON.stringify(initiatives);
function stmt(quarter, year, tiles) {
  return `insert into roadmaps (quarter, year, initiatives, tiles, published)\nvalues (${quarter}, ${year}, $j$${initJson}$j$::jsonb, $j$${JSON.stringify(tiles)}$j$::jsonb, false)\non conflict (quarter, year) do update set initiatives = excluded.initiatives, tiles = excluded.tiles;`;
}

console.log('-- Original roadmap, preserved in the new format (created as drafts).');
console.log('-- Q2 2026 (May/June) and Q3 2026 (Jul/Aug/Sep).\n');
console.log(stmt(2, 2026, q2Tiles));
console.log('');
console.log(stmt(3, 2026, q3Tiles));
