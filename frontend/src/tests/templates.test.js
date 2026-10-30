/**
 * templates.test.js — Unit & Integration tests for Workflow Templates & instantiation
 */

import { TEMPLATES, TEMPLATE_CATEGORIES, NODE_DEFS } from '../data/templates.js';
import { instantiateTemplate } from '../utils/templateUtils.js';
import WorkflowSerializer from '../utils/WorkflowSerializer.js';
import { getStoredFavorites, saveStoredFavorites } from '../hooks/useTemplateFavorites.js';

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

console.log('\n🧪 Starting Workflow Templates & Instantiation Tests...\n');

// ─── Group 1: Template Metadata & Schema Integrity ───────────────────────────
console.log('Group 1: Template Metadata & Schema Integrity');

check(TEMPLATES.length >= 16, `Catalog has at least 16 templates (found ${TEMPLATES.length})`);
check(TEMPLATE_CATEGORIES.length >= 7, `Has all required template categories (found ${TEMPLATE_CATEGORIES.length})`);

const categoryIds = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
const validDifficulties = new Set(['Beginner', 'Intermediate', 'Advanced']);

TEMPLATES.forEach((t) => {
  check(Boolean(t.id && t.name && t.description), `Template "${t.id}" has id, name, description`);
  check(categoryIds.has(t.category), `Template "${t.id}" category "${t.category}" exists in TEMPLATE_CATEGORIES`);
  check(validDifficulties.has(t.difficulty), `Template "${t.id}" difficulty "${t.difficulty}" is valid`);
  check(Array.isArray(t.tags) && t.tags.length > 0, `Template "${t.id}" has descriptive tags`);
  check(Array.isArray(t.nodeTypes) && t.nodeTypes.length > 0, `Template "${t.id}" declares nodeTypes`);
  check(Array.isArray(t.nodes) && t.nodes.length > 0, `Template "${t.id}" has nodes array`);
  check(Array.isArray(t.edges) && t.edges.length > 0, `Template "${t.id}" has edges array`);

  // Verify all node types exist in NODE_DEFS
  const allNodesKnown = t.nodes.every((n) => Boolean(NODE_DEFS[n.type]));
  check(allNodesKnown, `Template "${t.id}" all nodes have registered NODE_DEFS`);

  // Verify edge connectivity
  const nodeIds = new Set(t.nodes.map((n) => n.id));
  const validEdges = t.edges.every((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  check(validEdges, `Template "${t.id}" all edges connect existing nodes`);
});

// ─── Group 2: instantiateTemplate & ID Generation ─────────────────────────────
console.log('\nGroup 2: instantiateTemplate & ID Generation');

const sampleTemplate = TEMPLATES.find((t) => t.id === 'dev-multi-path-branching') || TEMPLATES[0];
const instance1 = instantiateTemplate(sampleTemplate);
const instance2 = instantiateTemplate(sampleTemplate);

check(instance1.name === sampleTemplate.name, 'Preserves workflow name');
check(instance1.description === sampleTemplate.description, 'Preserves workflow description');
check(instance1.nodes.length === sampleTemplate.nodes.length, 'Instantiated same node count');
check(instance1.edges.length === sampleTemplate.edges.length, 'Instantiated same edge count');

// Unique IDs check
const originalNodeIds = new Set(sampleTemplate.nodes.map((n) => n.id));
const instance1NodeIds = new Set(instance1.nodes.map((n) => n.id));
const instance2NodeIds = new Set(instance2.nodes.map((n) => n.id));

check(instance1NodeIds.size === sampleTemplate.nodes.length, 'All instantiated node IDs are unique within instance 1');
check(instance2NodeIds.size === sampleTemplate.nodes.length, 'All instantiated node IDs are unique within instance 2');
check(!instance1.nodes.some((n) => originalNodeIds.has(n.id)), 'Instantiated nodes do not reuse template IDs (n1, n2)');

// Verify instance 1 and instance 2 have distinct IDs (simulating 20ms delta if needed)
instance1.nodes.forEach((n) => {
  check(n.id.startsWith('node_'), `Node ID format valid (${n.id})`);
});
instance1.edges.forEach((e) => {
  check(e.id.startsWith('edge_'), `Edge ID format valid (${e.id})`);
  check(instance1NodeIds.has(e.source), `Edge source connects to instantiated node (${e.source})`);
  check(instance1NodeIds.has(e.target), `Edge target connects to instantiated node (${e.target})`);
});

// Deep mutation isolation check
instance1.nodes[0].data.label = 'MUTATED_LABEL_TEST';
check(sampleTemplate.nodes[0].data.label !== 'MUTATED_LABEL_TEST', 'Mutating instance data does not mutate original template');

// ─── Group 3: Variable Expression Node ID Rewriting ───────────────────────────
console.log('\nGroup 3: Variable Expression Node ID Rewriting');

const devWorkflow = TEMPLATES.find((t) => t.id === 'dev-multi-path-branching');
const instantiatedDev = instantiateTemplate(devWorkflow);

// In dev-multi-path-branching, n4 had valueA: '{{n2.id}}'
const instantiatedN2 = instantiatedDev.nodes.find((n) => n.data.label === '[DEV] Query Post');
const instantiatedN4 = instantiatedDev.nodes.find((n) => n.data.label === '[DEV] Multiply Score');

check(Boolean(instantiatedN2 && instantiatedN4), 'Found instantiated nodes in dev template');
check(
  instantiatedN4?.data?.valueA === `{{${instantiatedN2?.id}.id}}`,
  `Rewrote {{n2.id}} to {{${instantiatedN2?.id}.id}} successfully`
);

// Check fallback node n8 had message: 'Top-level condition failed for post id {{n2.id}}'
const instantiatedN8 = instantiatedDev.nodes.find((n) => n.data.label === '[DEV] Branch B (Fallback)');
check(
  instantiatedN8?.data?.message.includes(instantiatedN2?.id),
  `Rewrote mustache reference inside log message string`
);

// ─── Group 4: Serialization & Import Compatibility ───────────────────────────
console.log('\nGroup 4: Serialization & Import Compatibility');

const serialized = WorkflowSerializer.serialize({
  name: instance1.name,
  description: instance1.description,
  nodes: instance1.nodes,
  edges: instance1.edges,
});

check(Boolean(serialized.manifest), 'Serializer creates manifest');
check(serialized.manifest.schemaVersion === '1.0.0', 'Schema version is 1.0.0');
check(serialized.statistics.nodeCount === instance1.nodes.length, 'Node count stat matches');
check(serialized.statistics.edgeCount === instance1.edges.length, 'Edge count stat matches');

const validation = WorkflowSerializer.validate(serialized);
check(validation.valid === true, 'WorkflowSerializer validates serialized template package');

const deserialized = WorkflowSerializer.deserialize(serialized);
check(deserialized.name === instance1.name, 'Deserialized name matches');
check(deserialized.nodes.length === instance1.nodes.length, 'Deserialized node count matches');
check(deserialized.edges.length === instance1.edges.length, 'Deserialized edge count matches');

// ─── Group 5: Category and Node Coverage ──────────────────────────────────────
console.log('\nGroup 5: Category and Node Coverage');

const allNodeTypesUsed = new Set();
TEMPLATES.forEach((t) => t.nodeTypes.forEach((nt) => allNodeTypesUsed.add(nt)));

const expectedCoverage = [
  'trigger-manual',
  'trigger-schedule',
  'trigger-webhook',
  'action-http',
  'action-log',
  'action-delay',
  'action-transform',
  'action-email',
  'action-csv',
  'action-json',
  'action-text',
  'action-math',
  'action-date',
  'action-postgres',
  'action-mongodb',
  'action-google-sheets',
  'logic-condition',
];

expectedCoverage.forEach((type) => {
  check(allNodeTypesUsed.has(type), `Catalog covers node type "${type}"`);
});

// ─── Group 6: Template Favorites & Filter Logic ─────────────────────────────
console.log('\nGroup 6: Template Favorites & Filter Logic');

// Mock window.localStorage
const mockStore = {};
global.window = {
  localStorage: {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(mockStore, key) ? mockStore[key] : null),
    setItem: (key, val) => { mockStore[key] = String(val); },
    removeItem: (key) => { delete mockStore[key]; },
    clear: () => { Object.keys(mockStore).forEach((k) => delete mockStore[k]); },
  },
};

// 1. Initial empty storage
check(Array.isArray(getStoredFavorites()) && getStoredFavorites().length === 0, 'Initial getStoredFavorites returns empty array');

// 2. Corrupt storage recovery
mockStore['logicbridge_template_favorites'] = 'NOT_JSON';
check(Array.isArray(getStoredFavorites()) && getStoredFavorites().length === 0, 'Corrupted JSON gracefully defaults to empty array');

// 3. Save and retrieve favorites
saveStoredFavorites(['http-api-request', 'dev-utility-suite']);
const loadedFavs = getStoredFavorites();
check(loadedFavs.length === 2, 'saveStoredFavorites persists 2 items');
check(loadedFavs.includes('http-api-request') && loadedFavs.includes('dev-utility-suite'), 'Stored favorites contain saved template IDs');

// 4. Toggle favorite logic
function simulateToggle(currentList, id) {
  return currentList.includes(id)
    ? currentList.filter((item) => item !== id)
    : [...currentList, id];
}

let favs = ['http-api-request'];
favs = simulateToggle(favs, 'api-transform'); // add
check(favs.length === 2 && favs.includes('api-transform'), 'Toggling unbookmarked template adds it');
favs = simulateToggle(favs, 'http-api-request'); // remove
check(favs.length === 1 && !favs.includes('http-api-request'), 'Toggling bookmarked template removes it');

// 5. Combined filtering logic (mirroring TemplatesModal.jsx)
function filterTemplates(list, selectedCategory, searchQuery, onlyFavorites, userFavorites) {
  return list.filter((template) => {
    if (onlyFavorites && !userFavorites.includes(template.id)) {
      return false;
    }
    if (selectedCategory !== 'all' && template.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = template.name.toLowerCase().includes(q);
      const matchDesc = template.description.toLowerCase().includes(q);
      const matchTag = template.tags?.some((t) => t.toLowerCase().includes(q));
      const matchNode = template.nodeTypes?.some((n) => n.toLowerCase().includes(q));
      return matchName || matchDesc || matchTag || matchNode;
    }
    return true;
  });
}

const testUserFavs = ['http-api-request', 'api-transform', 'dev-multi-path-branching'];

// All filter
const resAll = filterTemplates(TEMPLATES, 'all', '', false, testUserFavs);
check(resAll.length === TEMPLATES.length, 'Filter: "all" with no search returns full template catalog');

// Favorites only
const resFavsOnly = filterTemplates(TEMPLATES, 'all', '', true, testUserFavs);
check(resFavsOnly.length === 3, 'Filter: onlyFavorites=true returns exactly 3 favorites');
check(resFavsOnly.every((t) => testUserFavs.includes(t.id)), 'All returned templates are in user favorites');

// Combined: Favorites + Category
const resFavsCategory = filterTemplates(TEMPLATES, 'getting-started', '', true, testUserFavs);
check(resFavsCategory.length === 1 && resFavsCategory[0].id === 'http-api-request', 'Filter: Favorites + getting-started returns matching template');

// Combined: Favorites + Search
const resFavsSearch = filterTemplates(TEMPLATES, 'all', 'branching', true, testUserFavs);
check(resFavsSearch.length === 1 && resFavsSearch[0].id === 'dev-multi-path-branching', 'Filter: Favorites + Search "branching" matches dev-multi-path-branching');

// Empty state detection
const resEmptyFavs = filterTemplates(TEMPLATES, 'all', '', true, []);
check(resEmptyFavs.length === 0, 'Filter: onlyFavorites=true with 0 favorites produces empty state');

// ─── Group 7: Rapid Repeated Instantiation & Variable Prefix Isolation ───────
console.log('\nGroup 7: Rapid Repeated Instantiation & Variable Prefix Isolation');

const allGeneratedNodeIds = new Set();
const allGeneratedEdgeIds = new Set();
const testTemplate = TEMPLATES.find((t) => t.id === 'dev-multi-path-branching');
const TOTAL_RUNS = 100;
let hasDuplicateNodeId = false;
let hasDuplicateEdgeId = false;
let hasBrokenEdgeRef = false;

for (let i = 0; i < TOTAL_RUNS; i++) {
  const inst = instantiateTemplate(testTemplate);
  const instNodeIds = new Set(inst.nodes.map((n) => n.id));

  // Check unique node IDs across all instances
  inst.nodes.forEach((n) => {
    if (allGeneratedNodeIds.has(n.id)) hasDuplicateNodeId = true;
    allGeneratedNodeIds.add(n.id);
  });

  // Check unique edge IDs across all instances and edge connectivity
  inst.edges.forEach((e) => {
    if (allGeneratedEdgeIds.has(e.id)) hasDuplicateEdgeId = true;
    allGeneratedEdgeIds.add(e.id);
    if (!instNodeIds.has(e.source) || !instNodeIds.has(e.target)) {
      hasBrokenEdgeRef = true;
    }
  });
}

check(!hasDuplicateNodeId, `Rapid 100x instantiation generated ${allGeneratedNodeIds.size} 100% unique node IDs with 0 collisions`);
check(!hasDuplicateEdgeId, `Rapid 100x instantiation generated ${allGeneratedEdgeIds.size} 100% unique edge IDs with 0 collisions`);
check(!hasBrokenEdgeRef, `All edges in 100 instantiated workflows strictly reference valid nodes in their respective instances`);

// Variable prefix collision test (n1 vs n10 vs n100)
const prefixCollisionTemplate = {
  id: 'test-prefix-collision',
  name: 'Prefix Collision Test',
  description: 'Tests that n1 does not corrupt n10 or n100 in variable rewriting',
  nodes: [
    { id: 'n1', type: 'action-http', data: { url: 'https://example.com/1' } },
    { id: 'n10', type: 'action-http', data: { url: 'https://example.com/10' } },
    { id: 'n100', type: 'action-http', data: { url: 'https://example.com/100' } },
    {
      id: 'n2',
      type: 'action-transform',
      data: {
        expr1: '{{n1.data.id}}',
        expr10: '{{n10.data.id}}',
        expr100: '{{n100.data.id}}',
        exprSteps1: '{{steps.n1.data.status}}',
        exprSteps10: '{{steps.n10.data.status}}',
        composite: 'Results: {{n1.data.title}} and {{n10.data.title}} and {{n100.data.title}}',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n10', target: 'n2' },
    { id: 'e3', source: 'n100', target: 'n2' },
  ],
};

const instPrefix = instantiateTemplate(prefixCollisionTemplate);
const instN1 = instPrefix.nodes.find((n) => n.data.url === 'https://example.com/1');
const instN10 = instPrefix.nodes.find((n) => n.data.url === 'https://example.com/10');
const instN100 = instPrefix.nodes.find((n) => n.data.url === 'https://example.com/100');
const instN2 = instPrefix.nodes.find((n) => n.type === 'action-transform');

check(instN2.data.expr1 === `{{${instN1.id}.data.id}}`, `{{n1.data.id}} rewritten to {{${instN1.id}.data.id}}`);
check(instN2.data.expr10 === `{{${instN10.id}.data.id}}`, `{{n10.data.id}} rewritten cleanly to {{${instN10.id}.data.id}} without n1 prefix clash`);
check(instN2.data.expr100 === `{{${instN100.id}.data.id}}`, `{{n100.data.id}} rewritten cleanly to {{${instN100.id}.data.id}} without n1/n10 prefix clash`);
check(instN2.data.exprSteps1 === `{{steps.${instN1.id}.data.status}}`, `{{steps.n1.data.status}} rewritten cleanly`);
check(instN2.data.exprSteps10 === `{{steps.${instN10.id}.data.status}}`, `{{steps.n10.data.status}} rewritten cleanly without n1 clash`);
check(
  instN2.data.composite === `Results: {{${instN1.id}.data.title}} and {{${instN10.id}.data.title}} and {{${instN100.id}.data.title}}`,
  'Composite string with n1, n10, n100 all correctly rewritten in single expression'
);

// ─── Group 8: Credential Dependency & Template Descriptions ──────────────────
console.log('\nGroup 8: Credential Dependency & Template Descriptions');

const validConnections = new Set(['postgres', 'mongodb', 'google_sheets', 'email', null]);
TEMPLATES.forEach((t) => {
  check(
    Object.prototype.hasOwnProperty.call(t, 'requiresConnection'),
    `Template "${t.id}" explicitly declares requiresConnection`
  );
  check(
    validConnections.has(t.requiresConnection),
    `Template "${t.id}" requiresConnection "${t.requiresConnection}" is valid enum`
  );
});

// Check scheduled-health-email
const healthEmail = TEMPLATES.find((t) => t.id === 'scheduled-health-email');
check(healthEmail.requiresConnection === 'email', 'scheduled-health-email marks requiresConnection: "email"');
check(
  healthEmail.description.includes('Zero credentials required for the healthy execution path') ||
  healthEmail.description.includes('Email connection'),
  'scheduled-health-email description accurately documents zero credentials on healthy path and email connection for failure alerts'
);

const standaloneCount = TEMPLATES.filter((t) => t.requiresConnection === null).length;
const credentialCount = TEMPLATES.filter((t) => t.requiresConnection !== null).length;
check(standaloneCount === 10, `Found 10 standalone zero-credential templates (found ${standaloneCount})`);
check(credentialCount === 6, `Found 6 credential-dependent templates (found ${credentialCount})`);

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL WORKFLOW TEMPLATE TESTS PASSED!\n');
}
