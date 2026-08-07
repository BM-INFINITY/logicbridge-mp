const assert = require('assert');
const WorkflowSerializer = require('../services/WorkflowSerializer');
const WorkflowImportValidator = require('../validators/WorkflowImportValidator');

function runTests() {
  console.log('🧪 Starting Serialization Unit Tests...');

  // Sample valid workflow
  const validWorkflow = {
    name: 'Test Pipeline',
    description: 'Unit test workflow',
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 0, y: 0 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http', position: { x: 100, y: 0 }, data: { label: 'API' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
    ],
  };

  // Test 1: Round Trip Test
  const roundTrip = WorkflowSerializer.roundTripTest(validWorkflow);
  assert.strictEqual(roundTrip.success, true, 'Round trip serialization test failed');
  console.log('✅ Pass 1: Round-trip serialization passed cleanly');

  // Test 2: Malformed export payload
  const malformedRes = WorkflowImportValidator.validate('not an object');
  assert.strictEqual(malformedRes.valid, false, 'Failed to reject string payload');
  assert.strictEqual(malformedRes.errors.length > 0, true);
  console.log('✅ Pass 2: Rejected malformed export payload');

  // Test 3: Unsupported schema version
  const badVersionRes = WorkflowImportValidator.validate({
    manifest: { schemaVersion: '99.0.0' },
    workflow: { nodes: [], edges: [] },
  });
  assert.strictEqual(badVersionRes.valid, false, 'Failed to reject unsupported version 99.0.0');
  console.log('✅ Pass 3: Rejected unsupported schema version');

  // Test 4: Duplicate node IDs
  const duplicateNodesRes = WorkflowImportValidator.validate({
    manifest: { schemaVersion: '1.0.0' },
    workflow: {
      nodes: [
        { id: 'n1', type: 'trigger-manual' },
        { id: 'n1', type: 'action-http' },
      ],
      edges: [],
    },
  });
  assert.strictEqual(duplicateNodesRes.valid, false, 'Failed to detect duplicate node IDs');
  console.log('✅ Pass 4: Detected duplicate node IDs');

  // Test 5: Missing edge references
  const missingEdgeRes = WorkflowImportValidator.validate({
    manifest: { schemaVersion: '1.0.0' },
    workflow: {
      nodes: [{ id: 'n1', type: 'trigger-manual' }],
      edges: [{ id: 'e1', source: 'n1', target: 'n999' }],
    },
  });
  assert.strictEqual(missingEdgeRes.valid, false, 'Failed to detect non-existent edge target');
  console.log('✅ Pass 5: Detected missing edge target reference');

  // Test 6: Corrupted checksum warning
  const serialized = WorkflowSerializer.serialize(validWorkflow);
  serialized.manifest.checksum = 'corrupted_checksum_hash';
  const checksumWarningRes = WorkflowImportValidator.validate(serialized);
  assert.strictEqual(checksumWarningRes.valid, true, 'Checksum warning should not block valid payload');
  assert.strictEqual(checksumWarningRes.warnings.length > 0, true, 'Failed to flag checksum warning');
  console.log('✅ Pass 6: Successfully flagged corrupted checksum warning');

  console.log('\n🎉 ALL SERIALIZATION UNIT TESTS PASSED!');
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
