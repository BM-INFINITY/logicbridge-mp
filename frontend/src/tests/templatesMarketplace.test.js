/**
 * templatesMarketplace.test.js — Comprehensive Unit & Integration Tests
 * for LogicBridge Workflow Templates & Marketplace Architecture (Iteration 36)
 */

import { TEMPLATES, TEMPLATE_CATEGORIES, NODE_DEFS } from '../data/templates.js';
import {
  instantiateTemplate,
  validateTemplate,
  sortTemplates,
  filterTemplates,
  installTemplateWorkflow,
} from '../utils/templateUtils.js';
import {
  getStoredRecentTemplates,
  saveStoredRecentTemplates,
} from '../hooks/useRecentTemplates.js';

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// Mock window and localStorage for node test runner
const mockStore = {};
global.window = {
  localStorage: {
    getItem: (key) => mockStore[key] ?? null,
    setItem: (key, val) => { mockStore[key] = String(val); },
    removeItem: (key) => { delete mockStore[key]; },
    clear: () => { Object.keys(mockStore).forEach((k) => delete mockStore[k]); },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

console.log('\n🧪 Starting Templates & Marketplace Architecture Tests...\n');

// ─── Group 1: Template Catalog Metadata Architecture ────────────────────────
console.log('Group 1: Template Catalog Metadata Architecture');

check(TEMPLATES.length === 16, `Catalog contains 16 registered templates (found ${TEMPLATES.length})`);
check(TEMPLATE_CATEGORIES.length >= 8, `Categories contains all standard categories + AI (found ${TEMPLATE_CATEGORIES.length})`);
check(TEMPLATE_CATEGORIES.some((c) => c.id === 'ai'), 'Template categories includes "ai"');

const validDifficulties = new Set(['Beginner', 'Intermediate', 'Advanced']);
const categoryIds = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
const templateIds = new Set();

TEMPLATES.forEach((t) => {
  // Unique ID
  check(!templateIds.has(t.id), `Template ID "${t.id}" is unique`);
  templateIds.add(t.id);

  // Core metadata
  check(Boolean(t.id && t.name && t.description), `Template "${t.id}" has valid id, name, and description`);
  check(typeof t.useCase === 'string' && t.useCase.length > 20, `Template "${t.id}" has descriptive useCase`);
  check(categoryIds.has(t.category), `Template "${t.id}" category "${t.category}" is registered`);
  check(validDifficulties.has(t.difficulty), `Template "${t.id}" difficulty "${t.difficulty}" is valid`);
  check(Boolean(t.author?.name && t.author?.role), `Template "${t.id}" has author metadata`);
  check(Boolean(t.version && t.schemaVersion), `Template "${t.id}" declares version and schemaVersion`);
  check(typeof t.popularity === 'number' && t.popularity > 0, `Template "${t.id}" has numerical popularity score`);
  check(Boolean(t.createdAt && t.updatedAt), `Template "${t.id}" has ISO createdAt and updatedAt timestamps`);

  // Requirements & Backward Compatibility
  check(Array.isArray(t.requiredConnections), `Template "${t.id}" has requiredConnections array`);
  check(Array.isArray(t.requiredVariables), `Template "${t.id}" has requiredVariables array`);
  if (t.requiresConnection) {
    check(t.requiredConnections.includes(t.requiresConnection), `Template "${t.id}" requiredConnections contains requiresConnection "${t.requiresConnection}"`);
  } else {
    check(t.requiredConnections.length === 0, `Template "${t.id}" zero-credential template has empty requiredConnections`);
  }

  // Preview metadata
  check(Boolean(t.preview?.triggers && t.preview?.actions && t.preview?.expectedOutcome), `Template "${t.id}" has structured preview metadata`);
  check(Array.isArray(t.preview.stepSummary) && t.preview.stepSummary.length === t.nodes.length, `Template "${t.id}" preview stepSummary matches node count (${t.nodes.length})`);
});

// ─── Group 2: Template Validation (validateTemplate) ─────────────────────────
console.log('\nGroup 2: Template Validation');

// 2.1 Valid templates all pass
TEMPLATES.forEach((t) => {
  const res = validateTemplate(t, NODE_DEFS);
  check(res.valid === true && res.errors.length === 0, `validateTemplate passes for "${t.id}"`);
});

// 2.2 Rejects missing required properties
const invalidNoId = { name: 'Broken', description: 'Desc', nodes: [{ id: 'n1', type: 'trigger-manual' }], edges: [] };
const resNoId = validateTemplate(invalidNoId, NODE_DEFS);
check(resNoId.valid === false && resNoId.errors.some((e) => e.includes('missing a valid id')), 'validateTemplate catches missing id');

// 2.3 Rejects empty nodes
const invalidNoNodes = { id: 'empty-nodes', name: 'Empty', description: 'Desc', nodes: [], edges: [] };
const resNoNodes = validateTemplate(invalidNoNodes, NODE_DEFS);
check(resNoNodes.valid === false && resNoNodes.errors.some((e) => e.includes('nodes array')), 'validateTemplate catches empty nodes');

// 2.4 Rejects duplicate node IDs
const invalidDupes = {
  id: 'dup-nodes',
  name: 'Dupe Test',
  description: 'Desc',
  nodes: [
    { id: 'n1', type: 'trigger-manual' },
    { id: 'n1', type: 'action-log' },
  ],
  edges: [],
};
const resDupes = validateTemplate(invalidDupes, NODE_DEFS);
check(resDupes.valid === false && resDupes.errors.some((e) => e.includes('Duplicate node id')), 'validateTemplate catches duplicate node IDs');

// 2.5 Rejects unsupported node types
const invalidUnsupported = {
  id: 'unsupported-node',
  name: 'Unsupported Node',
  description: 'Desc',
  nodes: [
    { id: 'n1', type: 'action-non-existent-quantum-ai-v99' },
  ],
  edges: [],
};
const resUnsupported = validateTemplate(invalidUnsupported, NODE_DEFS);
check(resUnsupported.valid === false && resUnsupported.errors.some((e) => e.includes('Unsupported node type')), 'validateTemplate catches unsupported node types');

// 2.6 Rejects dangling edges
const invalidDanglingEdge = {
  id: 'dangling-edge',
  name: 'Dangling Edge',
  description: 'Desc',
  nodes: [
    { id: 'n1', type: 'trigger-manual' },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'ghost_node_99' },
  ],
};
const resDangling = validateTemplate(invalidDanglingEdge, NODE_DEFS);
check(resDangling.valid === false && resDangling.errors.some((e) => e.includes('non-existent target node')), 'validateTemplate catches dangling edge targets');

// 2.7 Rejects self-referential edges
const invalidSelfLoop = {
  id: 'self-loop',
  name: 'Self Loop',
  description: 'Desc',
  nodes: [
    { id: 'n1', type: 'trigger-manual' },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n1' },
  ],
};
const resSelfLoop = validateTemplate(invalidSelfLoop, NODE_DEFS);
check(resSelfLoop.valid === false && resSelfLoop.errors.some((e) => e.includes('self-referencing loop')), 'validateTemplate catches self-referencing loops');

// 2.8 Rejects incompatible future schemaVersion
const invalidSchemaVer = {
  id: 'future-schema',
  name: 'Future Schema',
  description: 'Desc',
  schemaVersion: '3.1.0',
  nodes: [
    { id: 'n1', type: 'trigger-manual' },
  ],
  edges: [],
};
const resFutureVer = validateTemplate(invalidSchemaVer, NODE_DEFS);
check(resFutureVer.valid === false && resFutureVer.errors.some((e) => e.includes('requires a newer version')), 'validateTemplate catches incompatible future schemaVersion (v3.x)');

// ─── Group 3: Marketplace Filtering (filterTemplates) ────────────────────────
console.log('\nGroup 3: Marketplace Filtering');

// 3.1 Search by name
const searchName = filterTemplates(TEMPLATES, { search: 'PostgreSQL' });
check(searchName.length >= 2, `Search "PostgreSQL" found ${searchName.length} templates`);
check(searchName.every((t) => t.name.toLowerCase().includes('database') || (t.useCase || '').toLowerCase().includes('postgresql')), 'Search "PostgreSQL" accurately matched relevant items');

// 3.2 Search by tag
const searchTag = filterTemplates(TEMPLATES, { search: 'csv' });
check(searchTag.some((t) => t.id === 'student-attendance-csv'), 'Search "csv" found student-attendance-csv');

// 3.3 Search by useCase
const searchUseCase = filterTemplates(TEMPLATES, { search: 'heartbeat' });
check(searchUseCase.some((t) => t.id === 'http-api-request'), 'Search by useCase "heartbeat" found http-api-request');

// 3.4 Filter by Category
const dbTemplates = filterTemplates(TEMPLATES, { category: 'database' });
check(dbTemplates.length === 3, `Filter category "database" returned 3 templates (found ${dbTemplates.length})`);
check(dbTemplates.every((t) => t.category === 'database'), 'All returned templates have category "database"');

// 3.5 Filter by Difficulty
const beginnerTemplates = filterTemplates(TEMPLATES, { difficulty: 'Beginner' });
check(beginnerTemplates.length >= 4, `Filter difficulty "Beginner" found ${beginnerTemplates.length} templates`);
check(beginnerTemplates.every((t) => t.difficulty === 'Beginner'), 'All returned templates have difficulty "Beginner"');

// 3.6 Filter by Favorites
const favIds = ['http-api-request', 'webhook-to-postgres'];
const favFiltered = filterTemplates(TEMPLATES, { onlyFavorites: true, favorites: favIds });
check(favFiltered.length === 2, `Filter onlyFavorites returned 2 favorites (found ${favFiltered.length})`);
check(favFiltered.every((t) => favIds.includes(t.id)), 'Filtered favorites strictly match favorite IDs');

// 3.7 Filter by Connection Requirement
const zeroCredTemplates = filterTemplates(TEMPLATES, { hasConnections: 'zero-creds' });
check(zeroCredTemplates.length === 10, `Filter hasConnections "zero-creds" found 10 templates (found ${zeroCredTemplates.length})`);
check(zeroCredTemplates.every((t) => !t.requiresConnection), 'All zero-creds templates have requiresConnection: null');

const credTemplates = filterTemplates(TEMPLATES, { hasConnections: 'requires-creds' });
check(credTemplates.length === 6, `Filter hasConnections "requires-creds" found 6 templates (found ${credTemplates.length})`);
check(credTemplates.every((t) => Boolean(t.requiresConnection)), 'All requires-creds templates require credentials');

// ─── Group 4: Marketplace Sorting (sortTemplates) ────────────────────────────
console.log('\nGroup 4: Marketplace Sorting');

// 4.1 Popularity
const sortedByPop = sortTemplates(TEMPLATES, 'popularity');
check(sortedByPop[0].id === 'http-api-request', `Highest popularity is "${sortedByPop[0].name}" (score: ${sortedByPop[0].popularity})`);
check(sortedByPop[0].popularity >= sortedByPop[sortedByPop.length - 1].popularity, 'Popularity is sorted in descending order');

// 4.2 Recency
const sortedByRecency = sortTemplates(TEMPLATES, 'recent');
const newestDate = new Date(sortedByRecency[0].updatedAt).getTime();
const oldestDate = new Date(sortedByRecency[sortedByRecency.length - 1].updatedAt).getTime();
check(newestDate >= oldestDate, `Recency sorts newest updated first (${sortedByRecency[0].updatedAt} >= ${sortedByRecency[sortedByRecency.length - 1].updatedAt})`);

// 4.3 Alphabetical
const sortedByName = sortTemplates(TEMPLATES, 'name');
check(sortedByName[0].name.localeCompare(sortedByName[1].name) <= 0, `Alphabetical sort correctly ordered "${sortedByName[0].name}" before "${sortedByName[1].name}"`);

// 4.4 Difficulty
const sortedByDiff = sortTemplates(TEMPLATES, 'difficulty');
check(sortedByDiff[0].difficulty === 'Beginner', `Difficulty sort starts with Beginner (found "${sortedByDiff[0].difficulty}")`);
check(sortedByDiff[sortedByDiff.length - 1].difficulty === 'Advanced', `Difficulty sort ends with Advanced (found "${sortedByDiff[sortedByDiff.length - 1].difficulty}")`);

// ─── Group 5: Recently Used Templates Tracking ──────────────────────────────
console.log('\nGroup 5: Recently Used Templates Tracking');

window.localStorage.clear();
check(getStoredRecentTemplates().length === 0, 'Recent templates initializes empty');

saveStoredRecentTemplates([
  { id: 't1', name: 'T1' },
  { id: 't2', name: 'T2' },
  { id: 't3', name: 'T3' },
  { id: 't4', name: 'T4' },
  { id: 't5', name: 'T5' },
  { id: 't6', name: 'T6' }, // Excess beyond max 5
]);

const recents = getStoredRecentTemplates();
check(recents.length === 5, `Limits stored recent templates to maximum 5 items (found ${recents.length})`);
check(recents[0].id === 't1' && recents[4].id === 't5', 'Preserves FIFO ordering of recent items');

// ─── Group 6: Template Instantiation, ID Regeneration & Ref Rewriting ────────
console.log('\nGroup 6: Template Instantiation & Expression Rewriting');

const original = TEMPLATES.find((t) => t.id === 'dev-utility-suite');
const instanceA = instantiateTemplate(original);
const instanceB = instantiateTemplate(original);

check(instanceA.nodes[0].id !== original.nodes[0].id, `Node ID is regenerated (${original.nodes[0].id} -> ${instanceA.nodes[0].id})`);
check(instanceA.nodes[0].id !== instanceB.nodes[0].id, 'Multiple instantiations generate distinct IDs');
check(instanceA.edges[0].id !== instanceB.edges[0].id, 'Multiple instantiations generate distinct edge IDs');

// Verify connection integrity: all edges point to newly generated node IDs
const nodeIdsA = new Set(instanceA.nodes.map((n) => n.id));
const edgesValidA = instanceA.edges.every((e) => nodeIdsA.has(e.source) && nodeIdsA.has(e.target));
check(edgesValidA, 'All instantiated edges connect existing instantiated nodes');

// Verify mustache variable rewriting
const logNodeA = instanceA.nodes.find((n) => n.type === 'action-log');
check(!logNodeA.data.message.includes('steps.n3.data'), `Mustache reference "steps.n3.data" was rewritten: "${logNodeA.data.message}"`);
check(logNodeA.data.message.includes('Verified Product:'), 'Static message text is preserved');

// Custom name & variable overrides
const customInstance = instantiateTemplate(original, {
  name: 'My Custom Accounting Pipeline',
  description: 'Custom description for production',
  variables: { TAX_RATE: 0.18 },
});
check(customInstance.name === 'My Custom Accounting Pipeline', 'Custom workflow name applied');
check(customInstance.description === 'Custom description for production', 'Custom description applied');
check(customInstance.variables?.TAX_RATE === 0.18, 'Custom initial variables attached');

// Verify immutability: original template is unchanged
check(original.name === 'Utility Nodes Test Suite', 'Original template is not mutated');
check(original.nodes[0].id === 'n1', 'Original template nodes array is intact');

// ─── Group 7: Installation Flow & Safe Rollback (installTemplateWorkflow) ────
console.log('\nGroup 7: Installation Flow & Safe Rollback');

async function testInstallation() {
  const tmpl = TEMPLATES.find((t) => t.id === 'http-api-request');

  // Case 7.1: Successful creation
  let createdPayload = null;
  const mockCreateFn = async (payload) => {
    createdPayload = payload;
    return { _id: 'wf_new_123', ...payload };
  };

  const result = await installTemplateWorkflow(tmpl, {
    name: 'Production Weather Ingestion',
    createFn: mockCreateFn,
  });

  check(result._id === 'wf_new_123', 'installTemplateWorkflow returns created workflow instance');
  check(createdPayload.name === 'Production Weather Ingestion', 'createFn received custom workflow name');
  check(createdPayload.nodes.length === tmpl.nodes.length, `createFn received all ${tmpl.nodes.length} nodes`);

  // Case 7.2: Validation failure blocks createFn
  let createCalledOnInvalid = false;
  try {
    await installTemplateWorkflow({ id: 'broken', name: '', nodes: [] }, {
      createFn: async () => { createCalledOnInvalid = true; },
    });
  } catch (err) {
    check(err.message.includes('Template validation failed'), `Validation failure threw error: "${err.message}"`);
  }
  check(!createCalledOnInvalid, 'createFn was NOT called when template was invalid');

  // Case 7.3: Safe Rollback on createFn failure
  try {
    await installTemplateWorkflow(tmpl, {
      name: 'Failing DB Workflow',
      createFn: async () => { throw new Error('Database connection timeout on save'); },
    });
  } catch (err) {
    check(err.message.includes('Failed to create workflow from template'), `createFn failure wrapped with descriptive error: "${err.message}"`);
  }
}

await testInstallation();

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\nMarketplace Tests: ${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL WORKFLOW TEMPLATES & MARKETPLACE TESTS PASSED!\n');
}
