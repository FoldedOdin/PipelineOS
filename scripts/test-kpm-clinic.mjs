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
  const signature = crypto.createHmac('sha256', secretKey).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function main() {
  const commitSha = 'seed';
  const pipelineId = 'foldedodin/kpm-clinic';

  // 1. Read the local .pipelineos.yml from the freelance project path
  const yamlPath = '/home/foldedodin/Storage/Projects/Freelance/kpm-clinic/.pipelineos.yml';
  let rawYaml;
  try {
    rawYaml = await fs.promises.readFile(yamlPath, 'utf8');
    console.log('Loaded pipeline configuration from kpm-clinic...');
  } catch (err) {
    console.error('Error reading .pipelineos.yml from kpm-clinic directory. Did you create it at /home/foldedodin/Storage/Projects/Freelance/kpm-clinic/.pipelineos.yml ?');
    process.exit(1);
  }

  // 2. Seed it into the PipelineOS cache database
  console.log('Seeding pipeline config...');
  const seedRes = await fetch(`${apiBase}/internal/seed/pipelines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-api-key': internalApiKey },
    body: JSON.stringify({ pipelineId, rawYaml })
  });

  if (!seedRes.ok) {
    console.error('Failed to seed pipeline:', await seedRes.text());
    process.exit(1);
  }

  // 3. Trigger the webhook locally
  console.log('Triggering the webhook locally...');
  const runPayload = JSON.stringify({
    ref: 'refs/heads/main',
    after: commitSha,
    repository: { clone_url: `https://github.com/${pipelineId}.git` },
    commits: [{ message: 'Local kpm-clinic test run', id: commitSha }]
  });

  const hmac = crypto.createHmac('sha256', secret);
  const signature = `sha256=${hmac.update(runPayload).digest('hex')}`;

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
  
  console.log('Webhook accepted. Waiting for run ID...');
  await new Promise((r) => setTimeout(r, 1500));

  const jwtToken = generateJwt('e2e_validator', jwtSecret);
  const runsRes = await fetch(`${apiBase}/api/runs`, {
    headers: { Cookie: `token=${jwtToken}` }
  });

  const runs = await runsRes.json();
  const latestRun = runs[0];
  const runId = latestRun._id || latestRun.id;
  console.log('Found Run ID:', runId);

  // 4. Connect to SSE to monitor logs in real-time
  console.log('Connecting to Event Stream...');
  const es = new EventSource(`${apiBase}/api/runs/${runId}/stream`, {
    headers: { Cookie: `token=${jwtToken}` }
  });

  es.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === 'log') {
      process.stdout.write(data.payload.chunk);
    } else {
      console.log('\n[SSE EVENT]', data.type, data.payload || data);
    }
  };
}

main().catch(console.error);
