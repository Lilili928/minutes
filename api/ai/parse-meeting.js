const OpenAI = require('openai');

// Helper to read JSON body from request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'DeepSeek API not configured',
      detail: 'Set DEEPSEEK_API_KEY in Vercel environment variables.',
    }));
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Invalid JSON body' }));
  }

  const { text } = body;
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Invalid input',
      detail: 'Provide a meeting transcript with at least 10 characters.',
    }));
  }

  const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: deepseekKey,
  });

  const systemPrompt = `You are a meeting-graph parser. Your task is to read a meeting transcript and output a valid JSON object that describes the meeting structure as a graph with nodes and edges.

=== NODE TYPES ===
You must classify every extracted entity into exactly one of these four types:

1. "people" — meeting participants
   - data fields: { "label": "Full Name", "role": "Job Title" }
2. "topic" — agenda items discussed
   - data fields: { "label": "Topic Title", "duration": "time estimate" }
3. "decision" — conclusions or choices made
   - data fields: { "label": "Decision Summary", "voters": "e.g. 3/4 Approved" }
4. "action" — follow-up tasks with owners
   - data fields: { "label": "Task Description", "assignee": "person name" }

=== EDGES ===
Every edge connects two nodes and MUST include a "label" string describing the relationship.
Use these relationship labels: "owns", "facilitates", "participates", "presents", "resulted in", "triggers", "assigned to".

=== POSITIONING ===
Place nodes at fixed x-columns, staggering y by 180px per node within each column:
- people   → x: 60
- topic    → x: 380
- decision → x: 700
- action   → x: 1020

=== OUTPUT FORMAT ===
You MUST output a single JSON object with this exact structure and nothing else:

{
  "nodes": [
    { "id": "unique-id", "type": "people", "position": { "x": 60, "y": 0 }, "data": { "label": "Alice", "role": "PM" } }
  ],
  "edges": [
    { "id": "e1", "source": "alice-id", "target": "topic-id", "label": "participates" }
  ]
}

=== RULES ===
- Extract ALL people, topics, decisions, and actions mentioned in the transcript.
- Every node MUST have a unique string "id".
- Every node MUST use one of the four exact "type" values: "people" | "topic" | "decision" | "action".
- Every edge MUST have "id", "source", "target", and "label" fields.
- The output must be pure JSON — no markdown fences, no explanatory text.`;

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 4096,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Parse the following meeting transcript into a graph JSON:\n\n${text}` },
      ],
    });

    const raw = response.choices[0]?.message?.content || '';

    if (!raw) {
      console.error('DeepSeek returned no content');
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: 'DeepSeek returned empty response',
        detail: 'No content in the AI response.',
      }));
    }

    let parsed;
    try {
      const jsonStr = raw
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: 'DeepSeek returned invalid JSON',
        detail: 'The AI response could not be parsed as JSON.',
        raw: raw.slice(0, 500),
      }));
    }

    if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: 'Invalid graph structure',
        detail: 'Response missing "nodes" array.',
        raw: raw.slice(0, 500),
      }));
    }

    const edges = (parsed.edges || []).map((e, i) => ({
      id: e.id || `edge-${i}`,
      source: e.source,
      target: e.target,
      label: e.label || '',
      type: 'smoothstep',
      style: { stroke: '#2e2e4a', strokeDasharray: '6,4' },
      markerEnd: { type: 'arrowclosed', color: '#2e2e4a', width: 14, height: 14 },
    }));

    const validTypes = ['people', 'topic', 'decision', 'action'];
    const nodes = parsed.nodes.map((n) => ({
      ...n,
      type: validTypes.includes(n.type) ? n.type : 'topic',
      position: n.position || { x: 400, y: 0 },
      data: {
        label: n.data?.label || 'Untitled',
        role: n.data?.role,
        duration: n.data?.duration,
        voters: n.data?.voters,
        assignee: n.data?.assignee,
      },
    }));

    console.log(`Parsed meeting: ${nodes.length} nodes, ${edges.length} edges`);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ nodes, edges }));
  } catch (error) {
    console.error('Parse error:', error.message);
    if (error.status === 401) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Invalid API key', detail: error.message }));
    }
    if (error.status === 429) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Rate limited', detail: 'DeepSeek API rate limit reached. Try again in a moment.' }));
    }
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Parse failed', detail: error.message }));
  }
};
