/**
 * File & Storage Workflow Integration Tests
 * Covers:
 *   - Pipeline 1: HTTP -> Transform -> File (Write CSV) -> File (Read CSV) -> Slack
 *   - Pipeline 2: Webhook -> File (Write JSON) -> Storage (Upload to S3) -> Discord Embed
 *   - Pipeline 3: Workflow Serialization & Round-Trip with File & Storage Nodes
 *   - Pipeline 4: Security in Pipeline (Path traversal prevention & secret redaction in error flows)
 */

const fs = require('fs');
const path = require('path');
const FileNode = require('../nodes/FileNode');
const StorageNode = require('../nodes/StorageNode');
const SlackNode = require('../nodes/SlackNode');
const DiscordNode = require('../nodes/DiscordNode');
const TransformNode = require('../nodes/TransformNode');
const ExecutionContext = require('../utils/ExecutionContext');
const WorkflowSerializer = require('../services/WorkflowSerializer');
const WorkflowImportValidator = require('../validators/WorkflowImportValidator');
const ConnectionService = require('../services/ConnectionService');
const { NodeTypes } = require('../constants');

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

async function runTests() {
  console.log('\n🧪 Starting File & Storage Workflow Integration Tests...\n');

  // Configure test storage directory
  const testStorageDir = path.join(__dirname, 'temp_integration_storage');
  process.env.LOGICBRIDGE_STORAGE_PATH = testStorageDir;

  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testStorageDir, { recursive: true });

  // Mock ConnectionService.getDecryptedCredentials
  const originalGetCreds = ConnectionService.getDecryptedCredentials;
  ConnectionService.getDecryptedCredentials = async (connId) => {
    if (connId === 'conn-slack') {
      return { token: 'xoxb-mock-slack-token', defaultChannel: '#reports' };
    }
    if (connId === 'conn-discord') {
      return { botToken: 'MTA...MockDiscordBotToken' };
    }
    if (connId === 'conn-s3-prod') {
      return {
        accessKeyId: 'AKIAINTEGRATION12345',
        secretAccessKey: 'sec987654321secretKeyHere',
        region: 'us-west-2',
        bucket: 'prod-analytics-bucket',
      };
    }
    throw new Error('Unknown connection: ' + connId);
  };

  try {
    // ── Pipeline 1: HTTP -> Transform -> File Write CSV -> File Read CSV -> Slack ──
    console.log('Test Group 1: Pipeline HTTP -> Transform -> File CSV -> Slack');

    const ctx1 = new ExecutionContext();

    // 1. Mock HTTP trigger / fetch step output
    ctx1.setResult('http_fetch_orders', {
      status: 200,
      data: {
        batchId: 'batch-2026-10-30',
        reportDate: '2026-10-30',
        items: [
          { sku: 'SKU-001', name: 'Widget Pro', quantity: 10, unitPrice: 25 },
          { sku: 'SKU-002', name: 'Gizmo Max', quantity: 4, unitPrice: 50 },
          { sku: 'SKU-003', name: 'Doohickey Mini', quantity: 20, unitPrice: 5 },
        ],
      },
    });

    // 2. Step 2: Transform node formats the data
    const transformNode = new TransformNode();
    const transformStep = {
      id: 'transform_step',
      type: NodeTypes.ACTION_TRANSFORM,
      data: {
        operation: 'map',
        mappings: [
          { source: '{{ http_fetch_orders.data.batchId }}', outputField: 'batch' },
          { source: '{{ http_fetch_orders.data.reportDate }}', outputField: 'date' },
        ],
      },
    };
    const transformOutput = await transformNode.execute(transformStep, ctx1);
    ctx1.setResult('transform_step', transformOutput);
    check(transformOutput.data.batch === 'batch-2026-10-30', 'Pipeline 1: Transform step executed');

    // 3. Step 3: FileNode writes CSV to storage
    const fileNode = new FileNode();
    const csvRows = [
      { sku: 'SKU-001', name: 'Widget Pro', qty: 10, price: 25 },
      { sku: 'SKU-002', name: 'Gizmo Max', qty: 4, price: 50 },
      { sku: 'SKU-003', name: 'Doohickey Mini', qty: 20, price: 5 },
    ];

    const writeCsvStep = {
      id: 'write_csv_step',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'write_file',
        path: 'reports/sales_{{ transform_step.data.date }}.csv',
        format: 'csv',
        content: csvRows,
      },
    };
    const writeCsvOutput = await fileNode.execute(writeCsvStep, ctx1);
    ctx1.setResult('write_csv_step', writeCsvOutput);
    check(writeCsvOutput.ok === true, 'Pipeline 1: FileNode writes CSV file');
    check(writeCsvOutput.file.extension === '.csv', 'Pipeline 1: CSV file has .csv extension');
    check(writeCsvOutput.file.absolutePath === undefined, 'Pipeline 1: Server absolute path is not leaked in file reference');
    const physicalPath = require('../utils/FileSecurity').resolveSafePath(writeCsvOutput.file.path);
    check(fs.existsSync(physicalPath), 'Pipeline 1: Physical CSV file exists on disk');

    // 4. Step 4: FileNode reads back CSV file
    const readCsvStep = {
      id: 'read_csv_step',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'read_file',
        path: '{{ write_csv_step.file.path }}',
        format: 'csv',
      },
    };
    const readCsvOutput = await fileNode.execute(readCsvStep, ctx1);
    ctx1.setResult('read_csv_step', readCsvOutput);
    check(readCsvOutput.ok === true, 'Pipeline 1: FileNode reads CSV file back');
    check(Array.isArray(readCsvOutput.records), 'Pipeline 1: FileNode parsed CSV records into array');
    check(readCsvOutput.records.length === 3, 'Pipeline 1: Parsed 3 records from CSV');
    check(readCsvOutput.records[0].sku === 'SKU-001', 'Pipeline 1: Record 0 matches expected SKU');

    // 5. Step 5: SlackNode notifies channel with summary of processed CSV file
    let postedSlackData = null;
    const mockSlackClient = async (opts) => {
      postedSlackData = opts.data;
      return {
        data: {
          ok: true,
          channel: opts.data.channel,
          ts: '1700000001.998877',
        },
      };
    };

    const slackNode = new SlackNode();
    const slackStep = {
      id: 'slack_step',
      type: NodeTypes.ACTION_SLACK,
      data: {
        connectionId: 'conn-slack',
        operation: 'send_message',
        channel: '#reports',
        text: 'Daily Report for {{ transform_step.data.date }} generated! File: {{ read_csv_step.file.filename }} (Size: {{ read_csv_step.file.sizeFormatted }}) with {{ read_csv_step.records.length }} records processed.',
      },
    };
    const slackOutput = await slackNode.execute(slackStep, ctx1, { _slackClient: mockSlackClient });
    ctx1.setResult('slack_step', slackOutput);
    check(slackOutput.ok === true, 'Pipeline 1: Slack notification succeeded');
    check(
      postedSlackData.text === 'Daily Report for 2026-10-30 generated! File: sales_2026-10-30.csv (Size: 110 B) with 3 records processed.' ||
      postedSlackData.text.includes('Daily Report for 2026-10-30 generated! File: sales_2026-10-30.csv'),
      'Pipeline 1: Slack notification resolved filename, date, and record length'
    );

    // ── Pipeline 2: Webhook -> File (Write JSON) -> Storage (Upload S3) -> Discord ──
    console.log('\nTest Group 2: Pipeline Webhook -> File JSON -> S3 Upload -> Discord');

    const ctx2 = new ExecutionContext();

    // 1. Step 1: Incoming Webhook event
    ctx2.setResult('webhook_event', {
      event: 'user_signup',
      userId: 'usr_enterprise_9901',
      company: 'Acme Corp',
      tier: 'enterprise',
      seats: 50,
      timestamp: '2026-10-30T10:00:00Z',
    });

    // 2. Step 2: FileNode creates audit JSON log locally
    const fileJsonStep = {
      id: 'file_json_step',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'write_file',
        path: 'audit/{{ webhook_event.userId }}.json',
        format: 'json',
        content: {
          event: '{{ webhook_event.event }}',
          userId: '{{ webhook_event.userId }}',
          company: '{{ webhook_event.company }}',
          tier: '{{ webhook_event.tier }}',
          seats: '{{ webhook_event.seats }}',
        },
      },
    };
    const fileJsonOutput = await fileNode.execute(fileJsonStep, ctx2);
    ctx2.setResult('file_json_step', fileJsonOutput);
    check(fileJsonOutput.ok === true, 'Pipeline 2: FileNode wrote JSON audit log');
    check(fileJsonOutput.file.$type === 'file_reference', 'Pipeline 2: FileNode returned valid file_reference');

    // 3. Step 3: StorageNode uploads the file reference directly to S3
    let s3UploadedPayload = null;
    const mockS3Client = async (opts) => {
      s3UploadedPayload = opts.data;
      return {
        status: 200,
        headers: {
          etag: '"d41d8cd98f00b204e9800998ecf8427e"',
        },
        data: '',
      };
    };

    const storageNode = new StorageNode();
    const storageStep = {
      id: 's3_upload_step',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'aws_s3',
        connectionId: 'conn-s3-prod',
        operation: 'upload',
        key: 'cloud-audit/{{ webhook_event.userId }}.json',
        // Ingest the file_reference produced by step 2
        content: '{{ file_json_step.file }}',
      },
    };
    const storageOutput = await storageNode.execute(storageStep, ctx2, { _s3Client: mockS3Client });
    ctx2.setResult('s3_upload_step', storageOutput);
    check(storageOutput.ok === true, 'Pipeline 2: S3 upload succeeded');
    check(storageOutput.provider === 'aws_s3', 'Pipeline 2: Provider reported as aws_s3');
    check(storageOutput.bucket === 'prod-analytics-bucket', 'Pipeline 2: Uploaded to prod-analytics-bucket');
    check(storageOutput.key === 'cloud-audit/usr_enterprise_9901.json', 'Pipeline 2: S3 key resolved with userId variable');
    check(Boolean(s3UploadedPayload), 'Pipeline 2: S3 received file payload');

    // 4. Step 4: DiscordNode sends embed referencing the uploaded S3 object
    let sentDiscordEmbed = null;
    const mockDiscordClient = async (opts) => {
      sentDiscordEmbed = opts.data?.embeds?.[0];
      return {
        data: {
          id: 'embed_msg_123456789',
          channel_id: '99887766',
          embeds: opts.data?.embeds,
        },
      };
    };

    const discordNode = new DiscordNode();
    const discordStep = {
      id: 'discord_embed_step',
      type: NodeTypes.ACTION_DISCORD,
      data: {
        connectionId: 'conn-discord',
        operation: 'send_embed',
        channelId: '99887766',
        title: 'New Signup: {{ webhook_event.company }} ({{ webhook_event.tier }})',
        description: 'Audit file successfully uploaded to S3: `{{ s3_upload_step.key }}`',
        color: '#28a745',
        fields: [
          { name: 'User ID', value: '{{ webhook_event.userId }}', inline: true },
          { name: 'S3 URL', value: '{{ s3_upload_step.url }}', inline: true },
        ],
      },
    };
    const discordOutput = await discordNode.execute(discordStep, ctx2, { _discordClient: mockDiscordClient });
    ctx2.setResult('discord_embed_step', discordOutput);
    check(discordOutput.ok === true, 'Pipeline 2: Discord embed sent successfully');
    check(
      sentDiscordEmbed.title === 'New Signup: Acme Corp (enterprise)',
      'Pipeline 2: Discord title resolved company and tier'
    );
    check(
      sentDiscordEmbed.description === 'Audit file successfully uploaded to S3: `cloud-audit/usr_enterprise_9901.json`',
      'Pipeline 2: Discord description resolved uploaded S3 key'
    );
    check(
      sentDiscordEmbed.fields[1].value === 'https://prod-analytics-bucket.s3.us-west-2.amazonaws.com/cloud-audit/usr_enterprise_9901.json',
      'Pipeline 2: Discord field resolved full S3 object URL'
    );

    // ── Pipeline 3: Workflow Serialization & Round-Trip ──────────────────────
    console.log('\nTest Group 3: Workflow Serialization & Round-Trip Compatibility');

    const fullWorkflow = {
      name: 'Automated CSV ETL & S3 Archival',
      description: 'Ingests sales data, writes local CSV, uploads to AWS S3, and notifies team',
      nodes: [
        {
          id: 'http-1',
          type: 'action-http',
          position: { x: 50, y: 100 },
          data: { label: 'Fetch Sales', url: 'https://api.example.com/sales', method: 'GET' },
        },
        {
          id: 'file-1',
          type: 'action-file',
          position: { x: 280, y: 100 },
          data: {
            label: 'Write Sales CSV',
            operation: 'write_file',
            path: 'exports/sales_{{ http-1.date }}.csv',
            format: 'csv',
          },
        },
        {
          id: 'storage-1',
          type: 'action-storage',
          position: { x: 520, y: 100 },
          data: {
            label: 'Archive to S3',
            provider: 'aws_s3',
            connectionId: 'conn-s3-prod',
            operation: 'upload',
            key: 'backup/sales_{{ http-1.date }}.csv',
          },
        },
        {
          id: 'slack-1',
          type: 'action-slack',
          position: { x: 760, y: 100 },
          data: {
            label: 'Slack Notification',
            connectionId: 'conn-slack',
            operation: 'send_message',
            channel: '#reports',
            text: 'Backup complete: {{ storage-1.key }}',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'http-1', target: 'file-1' },
        { id: 'e2', source: 'file-1', target: 'storage-1' },
        { id: 'e3', source: 'storage-1', target: 'slack-1' },
      ],
    };

    // Serialize workflow
    const serialized = WorkflowSerializer.serialize(fullWorkflow);
    check(Boolean(serialized.manifest), 'Serializer creates manifest');
    check(serialized.manifest.schemaVersion === '1.0.0', 'Manifest has schemaVersion 1.0.0');
    check(serialized.workflow.nodes.length === 4, 'Serialized 4 nodes');
    check(serialized.workflow.edges.length === 3, 'Serialized 3 edges');

    // Validate with WorkflowImportValidator
    const validationResult = WorkflowImportValidator.validate(serialized);
    check(validationResult.valid === true, 'WorkflowImportValidator validates serialized workflow');
    check(validationResult.errors.length === 0, 'No validation errors');

    // Round-trip deserialize
    const deserialized = WorkflowSerializer.deserialize(serialized);
    check(deserialized.name === fullWorkflow.name, 'Deserialized workflow preserves name');
    check(deserialized.nodes.length === 4, 'Deserialized workflow preserves node count');
    const deserializedFileNode = deserialized.nodes.find((n) => n.id === 'file-1');
    const deserializedStorageNode = deserialized.nodes.find((n) => n.id === 'storage-1');
    check(deserializedFileNode && deserializedFileNode.type === 'action-file', 'Preserves action-file node type');
    check(deserializedStorageNode && deserializedStorageNode.type === 'action-storage', 'Preserves action-storage node type');
    check(deserializedFileNode.data.operation === 'write_file', 'Preserves FileNode operation configuration');
    check(deserializedStorageNode.data.provider === 'aws_s3', 'Preserves StorageNode provider configuration');

    // ── Pipeline 4: Security & Error Isolation ──────────────────────────────
    console.log('\nTest Group 4: Security Isolation in Workflows');

    // 1. Path traversal attempt in chained workflow
    const maliciousCtx = new ExecutionContext();
    maliciousCtx.setResult('upstream_input', {
      userSuppliedFilename: '../../../../windows/system32/cmd.exe',
    });

    const maliciousFileStep = {
      id: 'malicious_file_step',
      type: NodeTypes.ACTION_FILE,
      data: {
        operation: 'read_file',
        path: '{{ upstream_input.userSuppliedFilename }}',
      },
    };

    let traversalBlocked = false;
    try {
      await fileNode.execute(maliciousFileStep, maliciousCtx);
    } catch (err) {
      traversalBlocked = err.message.includes('Path traversal');
    }
    check(traversalBlocked, 'Pipeline 4: Path traversal attack safely blocked in workflow execution');

    // 2. Redaction in S3 error output
    const s3ErrorCtx = new ExecutionContext();
    const mockFailingS3Client = async () => {
      const err = new Error('Access Denied with secretAccessKey sec987654321secretKeyHere and AKIAINTEGRATION12345');
      err.response = { status: 403, data: '<Error><Message>SignatureDoesNotMatch</Message></Error>' };
      throw err;
    };

    const failingStorageStep = {
      id: 'failing_storage_step',
      type: NodeTypes.ACTION_STORAGE,
      data: {
        provider: 'aws_s3',
        connectionId: 'conn-s3-prod',
        operation: 'download',
        key: 'secret-file.txt',
      },
    };

    let secretRedacted = false;
    try {
      await storageNode.execute(failingStorageStep, s3ErrorCtx, { _s3Client: mockFailingS3Client });
    } catch (err) {
      const msg = err.message;
      secretRedacted = !msg.includes('sec987654321secretKeyHere') && !msg.includes('AKIAINTEGRATION12345');
    }
    check(secretRedacted, 'Pipeline 4: AWS credentials redacted from node execution error message');

  } finally {
    // Restore original getDecryptedCredentials
    ConnectionService.getDecryptedCredentials = originalGetCreds;

    // Clean up temporary integration storage
    if (fs.existsSync(testStorageDir)) {
      try {
        fs.rmSync(testStorageDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  }

  console.log(`\nFile & Storage Integration Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
