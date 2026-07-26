import { EventSource } from 'eventsource';
import fetch from 'node-fetch';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config({ path: path.resolve(process.cwd(), 'deploy/.env') });

const secret = process.env.GITHUB_WEBHOOK_SECRET;
const jwtSecret = process.env.JWT_SECRET ?? 'fallback_secret_do_not_use_in_prod';
const internalApiKey = process.env.INTERNAL_API_KEY;
const apiBase = 'http://localhost:3001';

function generateJwt(username, secretKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    username,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secretKey)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function main() {
  const commitSha = 'seed';
  const pipelineId = 'foldedodin/PipelineOS';

  // 1. Read the local .pipelineos.yml config file
  let rawYaml;
  try {
    const yamlPath = path.resolve(process.cwd(), '.pipelineos.yml');
    rawYaml = await fs.promises.readFile(yamlPath, 'utf8');
    console.log('Loaded pipeline configuration from .pipelineos.yml');
  } catch (err) {
    console.error('Error: Could not find or read .pipelineos.yml at the repository root.');
    process.exit(1);
  }

  // 2. Seed the mock pipeline config into the database
  console.log('Seeding mock pipeline config...');
  const seedRes = await fetch(`${apiBase}/internal/seed/pipelines`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': internalApiKey
    },
    body: JSON.stringify({
      pipelineId,
      rawYaml
    })
  });

  if (!seedRes.ok) {
    console.error('Failed to seed pipeline:', await seedRes.text());
    process.exit(1);
  }
  console.log('Mock pipeline seeded successfully.');

  // 2. Trigger the run via webhook
  const runPayload = JSON.stringify({
    ref: 'refs/heads/main',
    after: commitSha,
    repository: { clone_url: `https://github.com/${pipelineId}.git` },
    commits: [{ message: 'test stream', id: commitSha }]
  });

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(runPayload).digest('hex');
  const signature = `sha256=${digest}`;

  console.log('Sending webhook request...');
  const res = await fetch(`${apiBase}/api/webhooks/github`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-github-event': 'push',
      'x-hub-signature-256': signature
    },
    body: runPayload
  });
  
  if (!res.ok) {
    console.error('Failed to trigger run:', await res.text());
    process.exit(1);
  }
  
  const webhookResult = await res.json();
  console.log('Webhook accepted:', webhookResult);

  // Since webhook returns 202 accepted and enqueues the job in BullMQ,
  // we need to poll the API to find the newly created run.
  console.log('Waiting for job queue to process webhook...');
  await new Promise((r) => setTimeout(r, 1500));

  const jwtToken = generateJwt('e2e_validator', jwtSecret);

  // Fetch runs list to find the latest run
  const runsRes = await fetch(`${apiBase}/api/runs`, {
    headers: {
      Cookie: `token=${jwtToken}`
    }
  });

  if (!runsRes.ok) {
    console.error('Failed to fetch runs:', await runsRes.text());
    process.exit(1);
  }

  const runs = await runsRes.json();
  const latestRun = runs[0];
  if (!latestRun) {
    console.error('No runs found in database.');
    process.exit(1);
  }

  const runId = latestRun._id || latestRun.id;
  console.log('Found latest run ID:', runId);

  // Connect SSE
  console.log('Connecting to Event Stream...');
  const es = new EventSource(`${apiBase}/api/runs/${runId}/stream`, {
    headers: {
      Cookie: `token=${jwtToken}`
    }
  });

  es.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === 'log') {
      process.stdout.write(data.payload.chunk);
    } else {
      console.log('\n[SSE EVENT]', data.type, data.payload || data);
    }
  };

  es.onerror = (err) => {
    console.error('SSE Error:', err);
  };
}

main().catch(console.error);


