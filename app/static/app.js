/* Tabor — front-end logic. Vanilla JS, no build step. */
window.Tabor = (function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  async function api(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`${method} ${url} -> ${r.status}`);
    const ct = r.headers.get("content-type") || "";
    return ct.includes("json") ? r.json() : r.text();
  }

  // ------------------------------------------------------------------
  // Library page
  // ------------------------------------------------------------------
  function initLibrary() {
    const form = $("#upload-form");
    const drop = $(".drop");
    const input = $("#file");
    const status = $("#upload-status");

    if (drop) {
      drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
      drop.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.classList.remove("drag");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          input.files = e.dataTransfer.files;
          updateDropName();
        }
      });
      input.addEventListener("change", updateDropName);
    }
    function updateDropName() {
      if (input.files[0]) {
        $(".drop-title").textContent = input.files[0].name;
      }
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!input.files[0]) return;
        const fd = new FormData();
        fd.append("file", input.files[0]);
        status.textContent = "Parsing…";
        try {
          const r = await fetch("/api/upload", { method: "POST", body: fd });
          if (!r.ok) {
            const txt = await r.text();
            throw new Error(txt);
          }
          const data = await r.json();
          status.textContent = `Imported ${data.title} (${data.chapters} chapters). Reloading…`;
          setTimeout(() => window.location.reload(), 600);
        } catch (err) {
          status.textContent = "Failed: " + err.message;
        }
      });
    }

    $$(".book-card .delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Remove this book?")) return;
        await api("POST", `/api/book/${btn.dataset.id}/delete`);
        window.location.reload();
      });
    });
  }

  // ------------------------------------------------------------------
  // Reader page
  // ------------------------------------------------------------------
  function initReader() {
    const shell = $(".reader-shell");
    const bookId = shell.dataset.bookId;
    const chapterId = shell.dataset.chapterId;

    setupTabs();
    setupSelectionHighlight(chapterId);
    setupChat(chapterId);
    setupActions(chapterId);
    setupHighlightList();
    setupChapterDone(chapterId);
    setupFocusTimer();
  }

  function setupTabs() {
    $$(".tabs .tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".tabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
        $$(".tab-pane").forEach((p) => {
          p.classList.toggle("hidden", p.dataset.pane !== tab.dataset.tab);
        });
      });
    });
  }

  function setupSelectionHighlight(chapterId) {
    const body = $("#chapter-body");
    if (!body) return;
    body.addEventListener("mouseup", async () => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text.length < 8) return;
      const note = prompt(`Save highlight?\n\n"${text.substring(0, 200)}${text.length > 200 ? "…" : ""}"\n\nOptional note:`, "");
      if (note === null) return;
      const r = await api("POST", `/api/chapter/${chapterId}/highlights`, { text, note });
      addHighlightToList(r);
    });
  }

  function addHighlightToList(h) {
    const list = $("#highlight-list");
    const placeholder = list.querySelector(".muted");
    if (placeholder) placeholder.remove();
    const li = document.createElement("li");
    li.dataset.id = h.id;
    li.innerHTML = `<blockquote>${escapeHtml(h.text)}</blockquote>${h.note ? `<p class='note'>${escapeHtml(h.note)}</p>` : ""}<button class='link-btn'>remove</button>`;
    li.querySelector(".link-btn").addEventListener("click", async () => {
      await api("POST", `/api/highlight/${h.id}/delete`);
      li.remove();
    });
    list.prepend(li);
    bumpTab("highlights");
  }

  function setupHighlightList() {
    $$("#highlight-list li").forEach((li) => {
      const btn = li.querySelector(".link-btn");
      if (!btn) return;
      btn.addEventListener("click", async () => {
        await api("POST", `/api/highlight/${li.dataset.id}/delete`);
        li.remove();
      });
    });
  }

  function bumpTab(name) {
    const tab = $(`.tab[data-tab='${name}']`);
    if (!tab) return;
    const m = tab.textContent.match(/^(.*?)\((\d+)\)/);
    if (m) tab.textContent = `${m[1]}(${parseInt(m[2], 10) + 1})`;
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }

  function setupChat(chapterId) {
    const form = $("#chat-form");
    const input = $("#chat-input");
    const log = $("#chat-log");
    const mic = $("#mic-btn");

    function append(role, content) {
      const placeholder = log.querySelector(".muted");
      if (placeholder) placeholder.remove();
      const div = document.createElement("div");
      div.className = `msg ${role}`;
      div.innerHTML = `<span class='role'>${role}</span><div class='bubble'></div>`;
      div.querySelector(".bubble").textContent = content;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = input.value.trim();
      if (!msg) return;
      append("user", msg);
      input.value = "";
      const thinking = document.createElement("div");
      thinking.className = "msg assistant"; thinking.innerHTML = "<span class='role'>assistant</span><div class='bubble'>…</div>";
      log.appendChild(thinking);
      try {
        const r = await api("POST", `/api/chapter/${chapterId}/chat`, { message: msg });
        thinking.querySelector(".bubble").textContent = r.answer;
      } catch (err) {
        thinking.querySelector(".bubble").textContent = "Error: " + err.message;
      }
    });

    setupMic(mic, input, form);
  }

  function setupMic(mic, input, form) {
    if (!mic) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      mic.title = "Speech recognition not supported in this browser";
      mic.disabled = true;
      mic.style.opacity = 0.5;
      return;
    }
    let rec = null;
    let listening = false;
    function start() {
      rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e) => {
        let t = "";
        for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
        input.value = t;
      };
      rec.onend = () => {
        listening = false;
        mic.classList.remove("active");
        if (input.value.trim()) form.dispatchEvent(new Event("submit", { cancelable: true }));
      };
      rec.start();
      listening = true;
      mic.classList.add("active");
    }
    mic.addEventListener("click", () => {
      if (listening) { rec && rec.stop(); }
      else { start(); }
    });
  }

  function setupActions(chapterId) {
    $("#btn-summarize")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Thinking…";
      try {
        const r = await api("POST", `/api/chapter/${chapterId}/summarize`);
        $("#notes-block").classList.remove("hidden");
        $("#notes-text").textContent = r.notes;
      } finally { btn.disabled = false; btn.textContent = "Generate study notes"; }
    });

    $("#btn-suggest")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Thinking…";
      try {
        const r = await api("POST", `/api/chapter/${chapterId}/highlights/suggest`);
        switchTab("highlights");
        const box = $("#suggestion-box");
        const list = $("#suggestion-list");
        list.innerHTML = "";
        r.suggestions.forEach((text) => {
          const li = document.createElement("li");
          const span = document.createElement("span");
          span.textContent = text;
          const btnSave = document.createElement("button");
          btnSave.textContent = "save";
          btnSave.addEventListener("click", async () => {
            const h = await api("POST", `/api/chapter/${chapterId}/highlights`, { text, note: "AI suggested" });
            addHighlightToList(h);
            li.remove();
            if (!list.children.length) box.classList.add("hidden");
          });
          li.append(span, btnSave);
          list.appendChild(li);
        });
        box.classList.toggle("hidden", !r.suggestions.length);
      } finally { btn.disabled = false; btn.textContent = "Suggest highlights"; }
    });

    $("#btn-flashcards")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Generating…";
      try {
        const r = await api("POST", `/api/chapter/${chapterId}/flashcards`);
        switchTab("cards");
        const preview = $("#card-preview");
        r.cards.forEach((c) => {
          const div = document.createElement("div");
          div.className = "pcard";
          div.innerHTML = `<div class='pfront'></div><div class='pback'></div><div class='ptags'></div>`;
          div.querySelector(".pfront").textContent = c.front;
          div.querySelector(".pback").textContent = c.back;
          div.querySelector(".ptags").textContent = c.tags || "";
          preview.appendChild(div);
        });
        bumpTabExact("cards", r.cards.length);
      } finally { btn.disabled = false; btn.textContent = "Make flashcards"; }
    });

    $("#btn-quiz")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Thinking…";
      try {
        const r = await api("POST", `/api/chapter/${chapterId}/quiz`);
        const block = $("#quiz-block");
        const list = $("#quiz-list");
        list.innerHTML = "";
        r.questions.forEach((q) => {
          const li = document.createElement("li");
          li.textContent = q;
          list.appendChild(li);
        });
        block.classList.remove("hidden");
        block.scrollIntoView({ behavior: "smooth", block: "center" });
      } finally { btn.disabled = false; btn.textContent = "End-of-chapter quiz"; }
    });
  }

  function bumpTabExact(name, addN) {
    const tab = $(`.tab[data-tab='${name}']`);
    if (!tab) return;
    const m = tab.textContent.match(/^(.*?)\((\d+)\)/);
    if (m) tab.textContent = `${m[1]}(${parseInt(m[2], 10) + addN})`;
  }

  function switchTab(name) {
    $$(".tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $$(".tab-pane").forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== name));
  }

  function setupChapterDone(chapterId) {
    const cb = $("#chapter-done");
    if (!cb) return;
    cb.addEventListener("change", async () => {
      await fetch(`/api/chapter/${chapterId}/complete?completed=${cb.checked}`, { method: "POST" });
    });
  }

  function setupFocusTimer() {
    const btn = $("#focus-toggle");
    const display = $("#focus-timer");
    if (!btn || !display) return;
    let running = false;
    let total = parseInt(display.textContent.split(":")[0], 10) * 60;
    let remaining = total;
    let intervalId = null;

    function format(s) {
      const m = Math.floor(s / 60).toString().padStart(2, "0");
      const r = (s % 60).toString().padStart(2, "0");
      return `${m}:${r}`;
    }
    btn.addEventListener("click", () => {
      if (!running) {
        running = true;
        document.body.classList.add("focus-mode");
        btn.textContent = "End focus";
        intervalId = setInterval(() => {
          remaining -= 1;
          display.textContent = format(remaining);
          if (remaining <= 0) {
            stop();
            alert("Focus session complete. Take a breath.");
          }
        }, 1000);
      } else { stop(); }
    });
    function stop() {
      running = false;
      clearInterval(intervalId);
      document.body.classList.remove("focus-mode");
      btn.textContent = "Focus session";
      remaining = total;
      display.textContent = format(remaining);
    }
  }

  // ------------------------------------------------------------------
  // Review page
  // ------------------------------------------------------------------
  function initReview() {
    const stack = $("#card-stack");
    if (!stack) return;
    const cards = $$(".rcard", stack);
    const total = cards.length;
    const progress = $("#review-progress");
    let cursor = 0;
    let done = 0;

    function showCurrent() {
      cards.forEach((c, i) => c.classList.toggle("active", i === cursor));
      const cur = cards[cursor];
      if (!cur) return;
      cur.querySelector(".rcard-back").classList.add("hidden");
      cur.querySelector(".show").classList.remove("hidden");
      cur.querySelector(".rate").classList.add("hidden");
    }

    function bind(card) {
      const showBtn = card.querySelector(".show");
      const back = card.querySelector(".rcard-back");
      const rate = card.querySelector(".rate");
      showBtn.addEventListener("click", () => {
        back.classList.remove("hidden");
        showBtn.classList.add("hidden");
        rate.classList.remove("hidden");
      });
      $$(".quality", rate).forEach((b) => {
        b.addEventListener("click", async () => {
          const q = parseInt(b.dataset.q, 10);
          await api("POST", `/api/flashcard/${card.dataset.id}/review`, { quality: q });
          done += 1;
          progress.textContent = `${done} / ${total}`;
          cursor += 1;
          if (cursor >= cards.length) {
            stack.innerHTML = `<div class='empty'><h3>Queue cleared.</h3><p>Great work — see you when more cards are due.</p><p><a class='btn primary' href='/'>Back to library</a></p></div>`;
          } else {
            showCurrent();
          }
        });
      });
    }

    cards.forEach(bind);
    showCurrent();
  }

  return { initLibrary, initReader, initReview };
})();
