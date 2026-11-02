/**
 * Adversarial File Security Tests — Per-user isolation & manipulated paths
 */

const fs = require('fs');
const path = require('path');
const {
  resolveSafePath,
  getRelativeStoragePath,
  buildFileReference,
} = require('../utils/FileSecurity');
const FileNode = require('../nodes/FileNode');
const ExecutionContext = require('../utils/ExecutionContext');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runAdversarialSecurityTests() {
  console.log('\n🧪 Starting Adversarial File Security Tests...\n');

  const testBaseDir = path.resolve(process.cwd(), 'data', 'test_sandbox_adversarial');
  if (!fs.existsSync(testBaseDir)) {
    fs.mkdirSync(testBaseDir, { recursive: true });
  }

  // ── Group 1: Percent-Encoded Path Traversal Attacks ───────────────────────
  console.log('Group 1: Percent-Encoded & Obfuscated Traversal Attacks');
  try {
    let threw = false;
    try {
      resolveSafePath('%2e%2e%2f%2e%2e%2fetc%2fpasswd', { baseDir: testBaseDir });
    } catch (e) {
      threw = e.message.includes('Security Error');
    }
    assert(threw, 'Rejects URL-encoded %2e%2e%2f traversal');

    threw = false;
    try {
      resolveSafePath('..%2f..%2fsecret.key', { baseDir: testBaseDir });
    } catch (e) {
      threw = e.message.includes('Security Error');
    }
    assert(threw, 'Rejects mixed encoded ..%2f traversal');

    threw = false;
    try {
      resolveSafePath('folder/%2e%2e/%2e%2e/root.txt', { baseDir: testBaseDir });
    } catch (e) {
      threw = e.message.includes('Security Error');
    }
    assert(threw, 'Rejects nested URL-encoded traversal within subfolders');
  } catch (err) {
    console.error('Unexpected error in Group 1:', err);
    failedTests++;
  }

  // ── Group 2: Null Bytes & Control Characters ───────────────────────────────
  console.log('\nGroup 2: Null Bytes & UNC Path Injections');
  try {
    let threw = false;
    try {
      resolveSafePath('safe_file.txt\0.exe', { baseDir: testBaseDir });
    } catch (e) {
      threw = e.message.includes('Null bytes are not permitted');
    }
    assert(threw, 'Rejects null-byte poisoning in filename');

    threw = false;
    try {
      resolveSafePath('safe_file.txt%00.png', { baseDir: testBaseDir });
    } catch (e) {
      threw = e.message.includes('Null bytes are not permitted');
    }
    assert(threw, 'Rejects percent-encoded %00 null byte');

    threw = false;
    try {
      resolveSafePath('\\\\evil-host\\share\\payload.txt', { baseDir: testBaseDir });
    } catch (e) {
      threw = e.message.includes('UNC network paths are not permitted');
    }
    assert(threw, 'Rejects Windows UNC network share paths');
  } catch (err) {
    console.error('Unexpected error in Group 2:', err);
    failedTests++;
  }

  // ── Group 3: Per-User Sandbox Isolation ───────────────────────────────────
  console.log('\nGroup 3: Per-User Storage Sandbox Isolation');
  try {
    const user1 = 'usr_alice_101';
    const user2 = 'usr_bob_202';

    // Alice writes a secret file into her storage
    const aliceFile = resolveSafePath('private/secret.json', { baseDir: testBaseDir, ownerId: user1 });
    fs.mkdirSync(path.dirname(aliceFile), { recursive: true });
    fs.writeFileSync(aliceFile, JSON.stringify({ token: 'ALICE_SUPER_SECRET' }), 'utf8');

    assert(fs.existsSync(aliceFile), 'Alice file created inside alice user sandbox');
    assert(aliceFile.includes(path.join('users', user1)), 'Alice path is strictly within user1 namespace');

    // Bob attempts to read Alice's file via path traversal
    let bobEscapeThrew = false;
    try {
      resolveSafePath(`../../users/${user1}/private/secret.json`, { baseDir: testBaseDir, ownerId: user2 });
    } catch (e) {
      bobEscapeThrew = e.message.includes('Path traversal attempt rejected');
    }
    assert(bobEscapeThrew, 'Bob cannot traverse out of his user sandbox to reach Alice files');

    // Bob attempts to use manipulated relative traversal
    let bobRelThrew = false;
    try {
      resolveSafePath(`../${user1}/private/secret.json`, { baseDir: testBaseDir, ownerId: user2 });
    } catch (e) {
      bobRelThrew = e.message.includes('Path traversal attempt rejected');
    }
    assert(bobRelThrew, 'Bob cannot reach adjacent user directories with relative paths');

    // Bob writes a file with same relative name - must not collide with Alice
    const bobFile = resolveSafePath('private/secret.json', { baseDir: testBaseDir, ownerId: user2 });
    fs.mkdirSync(path.dirname(bobFile), { recursive: true });
    fs.writeFileSync(bobFile, JSON.stringify({ token: 'BOB_SECRET' }), 'utf8');

    assert(bobFile !== aliceFile, 'Alice and Bob files reside in completely separate sandboxes');
    const aliceContent = JSON.parse(fs.readFileSync(aliceFile, 'utf8'));
    const bobContent = JSON.parse(fs.readFileSync(bobFile, 'utf8'));
    assert(aliceContent.token === 'ALICE_SUPER_SECRET', 'Alice content was not overwritten by Bob');
    assert(bobContent.token === 'BOB_SECRET', 'Bob content was isolated successfully');
  } catch (err) {
    console.error('Unexpected error in Group 3:', err);
    failedTests++;
  }

  // ── Group 4: Manipulated File References & Node Execution ─────────────────
  console.log('\nGroup 4: Manipulated File References in FileNode');
  try {
    const fileNode = new FileNode();
    const attackerContext = new ExecutionContext({
      workflowId: 'wf_attacker',
      ownerId: 'usr_attacker_666',
    });

    // Attacker passes manipulated object reference pointing to system file
    let nodeAttackThrew = false;
    try {
      await fileNode.execute(
        {
          id: 'n_malicious',
          data: {
            operation: 'read_file',
            path: { path: '../../../../../../windows/system32/drivers/etc/hosts' },
          },
        },
        attackerContext
      );
    } catch (e) {
      nodeAttackThrew = e.message.includes('Security Error') || e.message.includes('Path traversal attempt rejected');
    }
    assert(nodeAttackThrew, 'FileNode rejects object reference with path traversal attempt');

    // Attacker passes ownerId with path traversal attempt (e.g. ownerId: '../../root')
    const badOwnerDir = resolveSafePath('my_file.txt', { baseDir: testBaseDir, ownerId: '../../root' });
    assert(
      !badOwnerDir.includes('root') || badOwnerDir.includes('users'),
      'Sanitized malicious ownerId prevents directory escape'
    );
  } catch (err) {
    console.error('Unexpected error in Group 4:', err);
    failedTests++;
  }

  // Clean up test directory
  try {
    fs.rmSync(testBaseDir, { recursive: true, force: true });
  } catch (_) {}

  console.log(`\nAdversarial File Security Tests: ${passedTests} passed, ${failedTests} failed`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runAdversarialSecurityTests();

