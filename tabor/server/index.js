import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { v4 as uuid } from 'uuid';
import db from './db.js';
import OpenAI from 'openai';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '../data/uploads');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `${uuid()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-mode',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const DEMO_MODE = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-mode';

async function callAI(systemPrompt, userPrompt, json = false) {
  if (DEMO_MODE) {
    return demoAIResponse(userPrompt);
  }
  const resp = await openai.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    response_format: json ? { type: 'json_object' } : undefined,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 1500,
  });
  return resp.choices[0].message.content;
}

function demoAIResponse(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes('flashcard') || lower.includes('generate')) {
    return JSON.stringify({
      flashcards: [
        { front: 'What is the Cue-Craving-Response-Reward loop?', back: 'The four-stage habit loop from Atomic Habits. Cue triggers a craving, which motivates a response, delivering a reward that reinforces the loop.' },
        { front: 'What is the 1% rule in habit formation?', back: 'Small improvements of 1% each day compound to a 37x improvement over a year. Tiny gains build remarkable results over time.' },
        { front: 'What is "habit stacking"?', back: 'Linking a new habit to an existing one using the formula: After [current habit], I will [new habit]. Anchors new behavior to established routines.' },
      ]
    });
  }
  if (lower.includes('summary') || lower.includes('summarize')) {
    return 'This chapter explores the foundational mechanics of habit formation. The author argues that habits are not built through sheer willpower but through environmental design and the strategic layering of small behaviors. Key insight: systems beat goals every time.';
  }
  if (lower.includes('quiz') || lower.includes('question')) {
    return JSON.stringify({
      questions: [
        { question: 'In your own words, explain how environment shapes behavior more than motivation.', type: 'open' },
        { question: 'Which concept from this chapter can you immediately apply to your daily routine? Describe a specific plan.', type: 'open' },
        { question: 'What is the difference between outcome-based habits and identity-based habits?', type: 'open' },
      ]
    });
  }
  return `Great question! Based on the text, this concept relates to how systems and environments shape our behavior more than motivation alone. The key insight is that small, consistent actions compound into significant change over time. Would you like me to generate a flashcard from this insight?`;
}

// ── Books ──────────────────────────────────────────────────────────────────
app.get('/api/books', (_, res) => {
  const books = db.prepare('SELECT * FROM books ORDER BY last_read DESC').all();
  res.json(books);
});

app.post('/api/books/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    let title = req.body.title || file.originalname.replace(/\.[^.]+$/, '');
    const author = req.body.author || '';
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
    const cover_color = colors[Math.floor(Math.random() * colors.length)];

    const id = uuid();
    db.prepare(`INSERT INTO books (id, title, author, filename, cover_color, total_pages) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, title, author, file.filename, cover_color, 0);

    res.json({ id, title, author, filename: file.filename, cover_color });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  res.json(book);
});

app.patch('/api/books/:id', (req, res) => {
  const { current_page, total_pages, title, author } = req.body;
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });

  db.prepare(`UPDATE books SET
    current_page = COALESCE(?, current_page),
    total_pages = COALESCE(?, total_pages),
    title = COALESCE(?, title),
    author = COALESCE(?, author),
    last_read = datetime('now')
    WHERE id = ?`).run(current_page ?? null, total_pages ?? null, title ?? null, author ?? null, req.params.id);

  if (current_page) {
    const profile = db.prepare("SELECT value FROM user_profile WHERE key = 'total_pages_read'").get();
    const total = parseInt(profile?.value || '0') + 1;
    db.prepare("UPDATE user_profile SET value = ? WHERE key = 'total_pages_read'").run(String(total));
  }

  res.json({ success: true });
});

app.delete('/api/books/:id', (req, res) => {
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM highlights WHERE book_id = ?').run(req.params.id);
  db.prepare('DELETE FROM flashcards WHERE book_id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Highlights ─────────────────────────────────────────────────────────────
app.get('/api/books/:id/highlights', (req, res) => {
  const highlights = db.prepare('SELECT * FROM highlights WHERE book_id = ? ORDER BY page, created_at').all(req.params.id);
  res.json(highlights);
});

app.post('/api/books/:id/highlights', (req, res) => {
  const { page, text, color, note } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO highlights (id, book_id, page, text, color, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.id, page, text, color || 'yellow', note || '');
  res.json({ id, book_id: req.params.id, page, text, color, note });
});

app.delete('/api/highlights/:id', (req, res) => {
  db.prepare('DELETE FROM highlights WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Flashcards ─────────────────────────────────────────────────────────────
app.get('/api/flashcards', (req, res) => {
  const { book_id, due } = req.query;
  let query = 'SELECT * FROM flashcards';
  const params = [];
  const conditions = [];
  if (book_id) { conditions.push('book_id = ?'); params.push(book_id); }
  if (due === 'true') { conditions.push("next_review <= datetime('now')"); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY next_review ASC';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/flashcards', (req, res) => {
  const { book_id, book_title, chapter, front, back, tags, source } = req.body;
  const id = uuid();
  db.prepare(`INSERT INTO flashcards (id, book_id, book_title, chapter, front, back, tags, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, book_id || null, book_title || '', chapter || 0, front, back, JSON.stringify(tags || []), source || 'manual');
  res.json({ id, front, back });
});

app.patch('/api/flashcards/:id/review', (req, res) => {
  const { quality } = req.body; // 0-5 SM-2 scale
  const card = db.prepare('SELECT * FROM flashcards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Not found' });

  let { ease_factor, interval, repetitions } = card;
  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease_factor);
    ease_factor = Math.max(1.3, ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  const next = new Date();
  next.setDate(next.getDate() + interval);

  db.prepare(`UPDATE flashcards SET ease_factor=?, interval=?, repetitions=?, next_review=? WHERE id=?`)
    .run(ease_factor, interval, repetitions, next.toISOString(), req.params.id);

  const profile = db.prepare("SELECT value FROM user_profile WHERE key = 'total_cards_reviewed'").get();
  db.prepare("UPDATE user_profile SET value = ? WHERE key = 'total_cards_reviewed'").run(String(parseInt(profile?.value || '0') + 1));

  res.json({ ease_factor, interval, repetitions, next_review: next.toISOString() });
});

app.delete('/api/flashcards/:id', (req, res) => {
  db.prepare('DELETE FROM flashcards WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/flashcards/:id/vote', (req, res) => {
  db.prepare('UPDATE flashcards SET community_votes = community_votes + 1 WHERE id = ?').run(req.params.id);
  const card = db.prepare('SELECT community_votes FROM flashcards WHERE id = ?').get(req.params.id);
  res.json(card);
});

// ── AI Endpoints ────────────────────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const { message, context, book_id, page } = req.body;
  try {
    const systemPrompt = `You are Tabor, an intelligent reading assistant embedded in an active learning platform. 
You help users understand, retain, and connect ideas from what they're reading.
${context ? `\nRelevant text from current page:\n"${context}"` : ''}
Be concise, insightful, and suggest flashcards or highlights when relevant.
If you suggest a flashcard, format it as: FLASHCARD: [front] | [back]`;

    const answer = await callAI(systemPrompt, message);
    
    // Extract flashcard suggestions
    const flashcardMatch = answer.match(/FLASHCARD:\s*(.+?)\s*\|\s*(.+?)(?:\n|$)/i);
    let suggestedFlashcard = null;
    if (flashcardMatch) {
      suggestedFlashcard = { front: flashcardMatch[1].trim(), back: flashcardMatch[2].trim() };
    }

    res.json({ answer, suggestedFlashcard });
  } catch (err) {
    console.error(err);
    res.json({ answer: demoAIResponse(req.body.message), suggestedFlashcard: null });
  }
});

app.post('/api/ai/generate-flashcards', async (req, res) => {
  const { text, book_id, book_title, chapter } = req.body;
  try {
    const systemPrompt = `You are an expert educator generating Anki flashcards. Create concise, atomic flashcards using the minimum information principle. Output valid JSON only.`;
    const userPrompt = `Generate 3-5 high-quality flashcards from this text. Output JSON: {"flashcards": [{"front": "...", "back": "..."}]}

Text: ${text.substring(0, 3000)}`;

    const raw = await callAI(systemPrompt, userPrompt, true);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = JSON.parse(demoAIResponse('flashcard')); }

    const inserted = (parsed.flashcards || []).map(fc => {
      const id = uuid();
      db.prepare(`INSERT INTO flashcards (id, book_id, book_title, chapter, front, back, source) VALUES (?, ?, ?, ?, ?, ?, 'ai')`)
        .run(id, book_id || null, book_title || '', chapter || 0, fc.front, fc.back);
      return { id, ...fc };
    });

    res.json({ flashcards: inserted });
  } catch (err) {
    console.error(err);
    const parsed = JSON.parse(demoAIResponse('flashcard'));
    res.json({ flashcards: parsed.flashcards });
  }
});

app.post('/api/ai/quiz', async (req, res) => {
  const { text, previous_struggles } = req.body;
  try {
    const systemPrompt = `You are an adaptive tutor. Generate open-ended questions that promote active recall and critical thinking. Output JSON only.`;
    const userPrompt = `Generate 3 thought-provoking questions for this text. ${previous_struggles ? `The learner found these concepts difficult: ${previous_struggles}. Weave them in.` : ''}
Output JSON: {"questions": [{"question": "...", "type": "open"}]}

Text: ${text.substring(0, 3000)}`;

    const raw = await callAI(systemPrompt, userPrompt, true);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = JSON.parse(demoAIResponse('quiz')); }
    res.json(parsed);
  } catch (err) {
    res.json(JSON.parse(demoAIResponse('quiz')));
  }
});

app.post('/api/ai/summarize', async (req, res) => {
  const { text, book_id, chapter } = req.body;
  try {
    const systemPrompt = `You are a knowledge extraction engine. Summarize text into dense, concept-rich notes that can be used to build a knowledge profile. Be concise but thorough.`;
    const summary = await callAI(systemPrompt, `Summarize this chapter text:\n\n${text.substring(0, 4000)}`);

    if (book_id) {
      const id = uuid();
      db.prepare(`INSERT OR REPLACE INTO ai_knowledge (id, book_id, chapter, summary, key_concepts) VALUES (?, ?, ?, ?, ?)`)
        .run(id, book_id, chapter || 0, summary, '[]');
    }

    res.json({ summary });
  } catch (err) {
    res.json({ summary: demoAIResponse('summarize ' + req.body.text) });
  }
});

// ── Profile / Stats ─────────────────────────────────────────────────────────
app.get('/api/profile', (_, res) => {
  const rows = db.prepare('SELECT * FROM user_profile').all();
  const profile = {};
  rows.forEach(r => { profile[r.key] = r.value; });

  const totalBooks = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
  const totalHighlights = db.prepare('SELECT COUNT(*) as c FROM highlights').get().c;
  const totalFlashcards = db.prepare('SELECT COUNT(*) as c FROM flashcards').get().c;
  const dueCards = db.prepare("SELECT COUNT(*) as c FROM flashcards WHERE next_review <= datetime('now')").get().c;

  // Streak logic
  const today = new Date().toISOString().split('T')[0];
  const lastDate = profile.last_study_date || '';
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let streak = parseInt(profile.streak_days || '0');
  if (lastDate === today) { /* same day, keep */ }
  else if (lastDate === yesterday) { /* do nothing, streak stays until updated */ }
  else if (lastDate && lastDate !== today) { streak = 0; }

  res.json({ ...profile, totalBooks, totalHighlights, totalFlashcards, dueCards, streak });
});

app.patch('/api/profile', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  Object.entries(req.body).forEach(([key, value]) => {
    db.prepare('INSERT OR REPLACE INTO user_profile (key, value) VALUES (?, ?)').run(key, String(value));
  });

  // Update streak when study activity is recorded
  if (req.body.study_activity) {
    const profile = db.prepare('SELECT * FROM user_profile').all().reduce((a, r) => ({ ...a, [r.key]: r.value }), {});
    const lastDate = profile.last_study_date || '';
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let streak = parseInt(profile.streak_days || '0');
    if (lastDate === today) { /* already counted */ }
    else if (lastDate === yesterday) { streak += 1; }
    else { streak = 1; }
    db.prepare('INSERT OR REPLACE INTO user_profile (key, value) VALUES (?, ?)').run('streak_days', String(streak));
    db.prepare('INSERT OR REPLACE INTO user_profile (key, value) VALUES (?, ?)').run('last_study_date', today);
  }

  res.json({ success: true });
});

// ── Focus Sessions ──────────────────────────────────────────────────────────
app.post('/api/focus-sessions', (req, res) => {
  const { type, duration_minutes, pages_goal, flashcards_goal } = req.body;
  const id = uuid();
  db.prepare(`INSERT INTO focus_sessions (id, type, duration_minutes, pages_goal, flashcards_goal) VALUES (?, ?, ?, ?, ?)`)
    .run(id, type || 'timer', duration_minutes || 25, pages_goal || 0, flashcards_goal || 0);
  res.json({ id });
});

app.patch('/api/focus-sessions/:id', (req, res) => {
  const { completed } = req.body;
  db.prepare(`UPDATE focus_sessions SET completed = ?, completed_at = datetime('now') WHERE id = ?`)
    .run(completed ? 1 : 0, req.params.id);
  if (completed) {
    db.prepare(`UPDATE user_profile SET value = 'true' WHERE key = 'study_activity'`);
  }
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Tabor API running on :${PORT} | Demo mode: ${DEMO_MODE}`));
