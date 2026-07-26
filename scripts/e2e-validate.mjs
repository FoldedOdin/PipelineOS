import { EventSource } from 'eventsource';
import fetch from 'node-fetch';

const apiBase = 'http://localhost:3000';

async function main() {
  // Create a run
  const res = await fetch(`${apiBase}/webhooks/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-github-event': 'push' },
    body: JSON.stringify({
      ref: 'refs/heads/main',
      after: '1234567890abcdef',
      repository: { clone_url: 'https://github.com/foldedodin/PipelineOS.git' },
      commits: [{ message: 'test stream', id: '1234567890abcdef' }]
    })
  });
  
  if (!res.ok) {
    console.error('Failed to trigger run:', await res.text());
    process.exit(1);
  }
  
  const { id: runId } = await res.json();
  console.log('Started run:', runId);

  // Connect SSE
  const es = new EventSource(`${apiBase}/runs/${runId}/stream`);
  es.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    console.log('SSE EVENT:', data.type, data.payload || data);
  };
  es.onerror = (err) => {
    console.error('SSE Error:', err);
  };
}

main().catch(console.error);
