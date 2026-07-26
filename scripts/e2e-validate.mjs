import { EventSource } from 'eventsource';
import fetch from 'node-fetch';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), 'deploy/.env') });

const secret = process.env.GITHUB_WEBHOOK_SECRET;
const jwtSecret = process.env.JWT_SECRET ?? 'fallback_secret_do_not_use_in_prod';
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
  const runPayload = JSON.stringify({
    ref: 'refs/heads/main',
    after: '1234567890abcdef',
    repository: { clone_url: 'https://github.com/foldedodin/PipelineOS.git' },
    commits: [{ message: 'test stream', id: '1234567890abcdef' }]
  });

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(runPayload).digest('hex');
  const signature = `sha256=${digest}`;

  // Create a run via webhook
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
  // we need to poll the API to find the newly created run or look for running runs.
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
    console.log('SSE EVENT:', data.type, data.payload || data);
  };

  es.onerror = (err) => {
    console.error('SSE Error:', err);
  };
}

main().catch(console.error);

