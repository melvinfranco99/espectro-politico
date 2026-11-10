(() => {
  const STORE_KEY = "espectro-respuestas-v1";
  const $app = document.getElementById("app");

  // ---------- Estado ----------
  let answers = load();
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(answers)); } catch {}
  }
  const qid = (axisId, i) => `${axisId}-${i}`;
  const axisById = Object.fromEntries(AXES.map(a => [a.id, a]));

  function answeredCount(axis) {
    return axis.questions.filter((_, i) => answers[qid(axis.id, i)] !== undefined).length;
  }

  function computeScores(src = answers) {
    const scores = {};
    for (const a of AXES) {
      let sum = 0, n = 0;
      a.questions.forEach(([, dir], i) => {
        const v = src[qid(a.id, i)];
        if (v !== undefined) { sum += v * dir; n++; }
      });
      scores[a.id] = n ? Math.round((sum / (2 * n)) * 100) : null;
    }
    return scores;
  }

  function matchIdeologies(scores) {
    const idx = AXES.map((a, i) => (scores[a.id] !== null ? i : -1)).filter(i => i >= 0);
    if (!idx.length) return [];
    return IDEOLOGIES.map(ideo => {
      const sq = idx.reduce((s, i) => s + (ideo.v[i] - scores[AXES[i].id]) ** 2, 0);
      const rms = Math.sqrt(sq / idx.length);
      return { ...ideo, match: Math.max(0, Math.round(100 - rms / 1.6)) };
    }).sort((a, b) => b.match - a.match);
  }

  // ---------- Codificación para compartir ----------
  function encodeScores(s) {
    return AXES.map(a => (s[a.id] === null ? "x" : s[a.id])).join("_");
  }
  function decodeScores(str) {
    const parts = str.split("_");
    const s = {};
    AXES.forEach((a, i) => {
      const n = parseInt(parts[i], 10);
      s[a.id] = Number.isFinite(n) ? Math.max(-100, Math.min(100, n)) : null;
    });
    return s;
  }

  // ---------- Router ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const [view, arg] = h.split("/");
    window.scrollTo(0, 0);
    if (view === "test" && (arg === "completo" || axisById[arg])) return renderQuiz(arg);
    if (view === "resultados") return renderResults(computeScores(), false);
    if (view === "r" && arg) return renderResults(decodeScores(arg), true);
    renderHome();
  }
  window.addEventListener("hashchange", route);

  // ---------- Inicio ----------
  function renderHome() {
    const total = AXES.reduce((s, a) => s + a.questions.length, 0);
    const done = AXES.reduce((s, a) => s + answeredCount(a), 0);
    $app.innerHTML = `
      <section class="hero">
        <h1>¿Dónde estás en el <span class="grad">espectro político</span>?</h1>
        <p class="lead">Responde a afirmaciones sobre economía, libertades, valores, nación y medio ambiente.
        Descubre tu posición en cinco ejes, tu lugar en la brújula política y las ideologías que más se parecen a ti.</p>
        <div class="hero-actions">
          <a class="btn primary" href="#/test/completo">${done && done < total ? "Continuar test completo" : "Hacer el test completo"} · ${total} preguntas</a>
          ${done ? `<a class="btn ghost" href="#/resultados">Ver mis resultados</a>` : ""}
        </div>
        ${done ? `<div class="overall"><div class="bar"><span style="width:${(done / total) * 100}%"></span></div><small>${done} de ${total} preguntas respondidas</small></div>` : ""}
      </section>
      <h2 class="section-title">O elige un tema</h2>
      <p class="muted center">Cada tema mide un eje. Puedes hacerlos por separado: tus respuestas se van sumando.</p>
      <div class="cards">
        ${AXES.map(a => {
          const n = answeredCount(a), t = a.questions.length;
          return `<a class="card" href="#/test/${a.id}">
            <div class="card-icon">${a.icon}</div>
            <h3>${a.name}</h3>
            <p>${a.desc}</p>
            <div class="poles"><span>${a.neg}</span><span>↔</span><span>${a.pos}</span></div>
            <div class="bar small"><span style="width:${(n / t) * 100}%"></span></div>
            <small class="muted">${n === t ? "✓ Completado" : n ? `${n}/${t} respondidas` : `${t} preguntas`}</small>
          </a>`;
        }).join("")}
      </div>
      ${done ? `<p class="center"><button class="link danger" id="reset">Borrar todas mis respuestas</button></p>` : ""}
      <p class="disclaimer">Este test es orientativo y no recoge datos: tus respuestas se guardan solo en tu navegador.
      Las posiciones de las ideologías son aproximaciones simplificadas con fines divulgativos.</p>
    `;
    const r = document.getElementById("reset");
    if (r) r.onclick = () => {
      if (confirm("¿Seguro que quieres borrar todas tus respuestas?")) { answers = {}; save(); renderHome(); }
    };
  }

  // ---------- Test ----------
  function buildQueue(which) {
    if (which !== "completo") {
      const a = axisById[which];
      return a.questions.map((q, i) => ({ axis: a, i, text: q[0] }));
    }
    // Intercalar los ejes para que el test completo sea variado
    const q = [];
    const max = Math.max(...AXES.map(a => a.questions.length));
    for (let i = 0; i < max; i++) for (const a of AXES) if (a.questions[i]) q.push({ axis: a, i, text: a.questions[i][0] });
    return q;
  }

  let keyHandler = null;
  function renderQuiz(which) {
    const queue = buildQueue(which);
    let pos = queue.findIndex(item => answers[qid(item.axis.id, item.i)] === undefined);
    if (pos === -1) pos = 0;
    const title = which === "completo" ? "Test completo" : `${axisById[which].icon} ${axisById[which].name}`;

    function draw() {
      const item = queue[pos];
      const cur = answers[qid(item.axis.id, item.i)];
      const doneN = queue.filter(it => answers[qid(it.axis.id, it.i)] !== undefined).length;
      $app.innerHTML = `
        <div class="quiz">
          <div class="quiz-head">
            <a href="#/" class="link">← Inicio</a>
            <span class="muted">${title}</span>
            <span class="muted">${pos + 1} / ${queue.length}</span>
          </div>
          <div class="bar"><span style="width:${(doneN / queue.length) * 100}%"></span></div>
          <div class="qcard">
            <div class="tag">${item.axis.icon} ${item.axis.name}</div>
            <p class="question">${item.text}</p>
            <div class="options">
              ${SCALE.map((s, k) => `<button class="opt opt-${k} ${cur === s.v ? "selected" : ""}" data-v="${s.v}">
                <span class="key">${k + 1}</span>${s.label}</button>`).join("")}
            </div>
          </div>
          <div class="quiz-nav">
            <button class="btn ghost" id="prev" ${pos === 0 ? "disabled" : ""}>← Anterior</button>
            ${pos < queue.length - 1 && cur !== undefined ? `<button class="btn ghost" id="next">Siguiente →</button>` : ""}
            ${doneN === queue.length ? `<a class="btn primary" href="#/resultados">Ver resultados</a>` : ""}
          </div>
          <p class="muted center small">Atajos: teclas 1–5 para responder, ← para volver.</p>
        </div>`;
      $app.querySelectorAll(".opt").forEach(b => b.onclick = () => answer(+b.dataset.v));
      document.getElementById("prev").onclick = () => { if (pos > 0) { pos--; draw(); } };
      const nx = document.getElementById("next");
      if (nx) nx.onclick = () => { pos++; draw(); };
    }

    function answer(v) {
      const item = queue[pos];
      answers[qid(item.axis.id, item.i)] = v;
      save();
      const nextUnanswered = queue.findIndex((it, k) => k > pos && answers[qid(it.axis.id, it.i)] === undefined);
      const anyLeft = queue.some(it => answers[qid(it.axis.id, it.i)] === undefined);
      if (!anyLeft) { location.hash = "#/resultados"; return; }
      pos = nextUnanswered !== -1 ? nextUnanswered : Math.min(pos + 1, queue.length - 1);
      draw();
    }

    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = e => {
      if (!location.hash.startsWith("#/test/")) return;
      if (e.key >= "1" && e.key <= "5") answer(SCALE[+e.key - 1].v);
      else if (e.key === "ArrowLeft" && pos > 0) { pos--; draw(); }
    };
    document.addEventListener("keydown", keyHandler);
    draw();
  }

  // ---------- Resultados ----------
  function label(axis, v) {
    const a = Math.abs(v);
    if (a < 10) return "Centro";
    const pole = v < 0 ? axis.neg : axis.pos;
    if (a < 35) return `Centro-${pole.toLowerCase()}`;
    if (a < 70) return pole;
    return `${pole} radical`;
  }

  function renderResults(scores, shared) {
    const have = AXES.filter(a => scores[a.id] !== null);
    if (!have.length) {
      $app.innerHTML = `<div class="empty"><h2>Aún no hay resultados</h2>
        <p class="muted">Responde al menos un tema para ver tu posición.</p>
        <a class="btn primary" href="#/test/completo">Empezar el test</a></div>`;
      return;
    }
    const matches = matchIdeologies(scores);
    const top = matches[0];
    const missing = AXES.filter(a => scores[a.id] === null);
    const shareUrl = `${location.origin}${location.pathname}#/r/${encodeScores(scores)}`;

    $app.innerHTML = `
      <section class="result-hero">
        <p class="muted">${shared ? "Resultado compartido" : "Tu resultado"}</p>
        <h1>${top.name}</h1>
        <p class="lead">${top.d}</p>
        <p class="pill">Afinidad ${top.match}%</p>
        ${missing.length && !shared ? `<p class="warn">Te faltan ${missing.length} tema(s): ${missing.map(a => `<a href="#/test/${a.id}">${a.name}</a>`).join(", ")}. El resultado será más preciso si los completas.</p>` : ""}
      </section>

      <div class="grid2">
        <section class="panel">
          <h2>Brújula política</h2>
          <div class="selects">
            <label>Eje X <select id="sx">${AXES.map(a => `<option value="${a.id}">${a.name}</option>`).join("")}</select></label>
            <label>Eje Y <select id="sy">${AXES.map(a => `<option value="${a.id}">${a.name}</option>`).join("")}</select></label>
          </div>
          <div id="compass"></div>
          <label class="check"><input type="checkbox" id="showIdeo" checked> Mostrar ideologías de referencia</label>
        </section>

        <section class="panel">
          <h2>Tus cinco ejes</h2>
          <div class="axes">
            ${AXES.map(a => {
              const v = scores[a.id];
              if (v === null) return `<div class="axis off"><div class="axis-top"><strong>${a.icon} ${a.name}</strong><a href="#/test/${a.id}">Hacer test</a></div>
                <div class="axis-bar"><div class="axis-labels"><span>${a.neg}</span><span>${a.pos}</span></div></div></div>`;
              const pct = (v + 100) / 2;
              return `<div class="axis">
                <div class="axis-top"><strong>${a.icon} ${a.name}</strong><span class="axis-val">${label(a, v)}</span></div>
                <div class="axis-track ax-${a.id}"><span class="axis-dot" style="left:${pct}%"></span><span class="mid"></span></div>
                <div class="axis-labels"><span title="${a.negDesc}">${a.neg} ${v < 0 ? Math.abs(v) + "%" : ""}</span><span title="${a.posDesc}">${v > 0 ? v + "%" : ""} ${a.pos}</span></div>
              </div>`;
            }).join("")}
          </div>
        </section>
      </div>

      <section class="panel">
        <h2>Ideologías más afines</h2>
        <ol class="matches">
          ${matches.slice(0, 6).map((m, i) => `<li class="${i === 0 ? "first" : ""}">
            <div class="m-top"><strong>${m.name}</strong><span>${m.match}%</span></div>
            <div class="bar small"><span style="width:${m.match}%"></span></div>
            <p class="muted small">${m.d}</p></li>`).join("")}
        </ol>
        <details><summary>Ver todas las ideologías</summary>
          <ul class="all">${matches.slice(6).map(m => `<li><span>${m.name}</span><span class="muted">${m.match}%</span></li>`).join("")}</ul>
        </details>
      </section>

      <section class="panel share">
        <h2>Compartir</h2>
        <div class="share-row"><input id="shareUrl" readonly value="${shareUrl}"><button class="btn primary" id="copy">Copiar enlace</button></div>
        <div class="hero-actions">
          ${shared ? `<a class="btn ghost" href="#/">Hacer el test yo</a>` : `<a class="btn ghost" href="#/">Volver al inicio</a>`}
        </div>
      </section>
    `;

    const sx = document.getElementById("sx"), sy = document.getElementById("sy");
    sx.value = "eco"; sy.value = "aut";
    const showIdeo = document.getElementById("showIdeo");
    const redraw = () => drawCompass(scores, sx.value, sy.value, showIdeo.checked);
    sx.onchange = sy.onchange = showIdeo.onchange = redraw;
    redraw();

    document.getElementById("copy").onclick = async e => {
      const inp = document.getElementById("shareUrl");
      try { await navigator.clipboard.writeText(inp.value); } catch { inp.select(); document.execCommand("copy"); }
      e.target.textContent = "¡Copiado!";
      setTimeout(() => (e.target.textContent = "Copiar enlace"), 1600);
    };
  }

  function drawCompass(scores, xId, yId, showIdeo) {
    const el = document.getElementById("compass");
    const S = 400, P = 34, W = S - 2 * P;
    const xi = AXES.findIndex(a => a.id === xId), yi = AXES.findIndex(a => a.id === yId);
    const ax = AXES[xi], ay = AXES[yi];
    const px = v => P + ((v + 100) / 200) * W;
    const py = v => P + ((100 - v) / 200) * W; // polo positivo arriba
    const grid = [];
    for (let k = -100; k <= 100; k += 20) {
      grid.push(`<line x1="${px(k)}" y1="${P}" x2="${px(k)}" y2="${P + W}" class="g"/>`);
      grid.push(`<line x1="${P}" y1="${py(k)}" x2="${P + W}" y2="${py(k)}" class="g"/>`);
    }
    const ideos = showIdeo ? IDEOLOGIES.map(i => `<g class="ideo"><circle cx="${px(i.v[xi])}" cy="${py(i.v[yi])}" r="4"/>
      <text x="${px(i.v[xi]) + 6}" y="${py(i.v[yi]) + 3}">${i.name}</text><title>${i.name}</title></g>`).join("") : "";
    const ux = scores[xId], uy = scores[yId];
    const user = ux !== null && uy !== null
      ? `<g class="you"><circle cx="${px(ux)}" cy="${py(uy)}" r="13" class="halo"/><circle cx="${px(ux)}" cy="${py(uy)}" r="8"/><title>Tú (${ux}, ${uy})</title></g>`
      : `<text x="${S / 2}" y="${S / 2 + 4}" text-anchor="middle" class="nodata">Completa ambos temas para verte aquí</text>`;
    el.innerHTML = `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="Brújula política">
      <rect x="${P}" y="${P}" width="${W / 2}" height="${W / 2}" class="q1"/>
      <rect x="${P + W / 2}" y="${P}" width="${W / 2}" height="${W / 2}" class="q2"/>
      <rect x="${P}" y="${P + W / 2}" width="${W / 2}" height="${W / 2}" class="q3"/>
      <rect x="${P + W / 2}" y="${P + W / 2}" width="${W / 2}" height="${W / 2}" class="q4"/>
      ${grid.join("")}
      <line x1="${P}" y1="${S / 2}" x2="${P + W}" y2="${S / 2}" class="axisline"/>
      <line x1="${S / 2}" y1="${P}" x2="${S / 2}" y2="${P + W}" class="axisline"/>
      <text x="${S / 2}" y="${P - 12}" text-anchor="middle" class="pole">${ay.pos}</text>
      <text x="${S / 2}" y="${S - 10}" text-anchor="middle" class="pole">${ay.neg}</text>
      <text x="${P - 14}" y="${S / 2}" text-anchor="middle" class="pole" transform="rotate(-90 ${P - 14} ${S / 2})">${ax.neg}</text>
      <text x="${S - P + 14}" y="${S / 2}" text-anchor="middle" class="pole" transform="rotate(90 ${S - P + 14} ${S / 2})">${ax.pos}</text>
      ${ideos}
      ${user}
    </svg>`;
  }

  route();
})();
