// Quiz engine — reads ?lang=<id>, loads quizzes/<id>.js, runs the quiz.
// Question types:
//   mc       → { type:"mc", q, code?, choices:[...], answer:<index>, explain, section, level }
//   fill     → { type:"fill", q, code?, accept:[...], answerDisplay, explain, section, level }
//   assemble → { type:"assemble", q, template (uses {#} blanks), blanks:[...], distractors:[...],
//                explain, section, level }  — tap tokens in order to fill the blanks
// level: "beginner" | "intermediate" | "advanced"
(function () {
  var params = new URLSearchParams(location.search);
  var langId = params.get("lang");
  var lang = window.getLanguage(langId);
  var root = document.getElementById("quiz-root");

  var LEVELS = ["beginner", "intermediate", "advanced"];
  var LEVEL_ICON = { beginner: "🟢", intermediate: "🟡", advanced: "🔴" };
  function levelLabel(l) { return l.charAt(0).toUpperCase() + l.slice(1); }

  var FORMATS = ["mc", "fill", "assemble"];
  var FORMAT_LABEL = { all: "All", mc: "📝 Multiple-choice", fill: "✍️ Fill-in", assemble: "🧩 Code-assembly" };
  var TYPE_LABEL = { mc: "Multiple choice", fill: "Fill in the blank", assemble: "Assemble the code" };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // inline formatting for question/choice/explanation text: `code` and **bold**
  function fmt(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function normalize(s) {
    return s
      .toLowerCase()
      .trim()
      .replace(/^[`"']+|[`"']+$/g, "")
      .replace(/\s+/g, " ")
      .replace(/\.$/, "");
  }
  function levelBadge(level) {
    if (!level) return "";
    return "<span class='level-badge " + level + "'>" + LEVEL_ICON[level] + " " + levelLabel(level) + "</span>";
  }
  // optional usage-example code block shown after answering
  function exampleBlock(ex) {
    if (!ex) return "";
    return "<div class='example'><div class='example-label'>💡 Example usage</div>" +
      "<pre><code>" + esc(ex) + "</code></pre></div>";
  }
  // fill each {#} in a template with the next value, in order
  function assembleTemplate(t, values) {
    var i = 0;
    return t.replace(/\{#\}/g, function () { return values[i++]; });
  }

  if (!lang || !lang.quiz) {
    root.innerHTML = "<div class='q-card'><p>No quiz available for this language yet. " +
      "<a href='index.html'>Back to home</a>.</p></div>";
    return;
  }

  document.title = lang.name + " Quiz";
  document.getElementById("bar-title").textContent = lang.name + " Quiz";
  var reviewLinkTop = document.getElementById("review-link");
  reviewLinkTop.href = "review.html?lang=" + lang.id;
  reviewLinkTop.style.display = "";

  // load the question bank
  var script = document.createElement("script");
  script.src = "quizzes/" + lang.id + ".js";
  script.onload = start;
  script.onerror = function () {
    root.innerHTML = "<div class='q-card'><p>Could not load the quiz data " +
      "(<code>quizzes/" + lang.id + ".js</code>).</p></div>";
  };
  document.head.appendChild(script);

  var quiz, order, current, score, missed, levelStats;
  var chosenCount = null;
  var chosenLevel = "all";
  var chosenFormat = "all";

  function start() {
    quiz = (window.QUIZZES || {})[lang.id];
    if (!quiz || !quiz.questions || !quiz.questions.length) {
      root.innerHTML = "<div class='q-card'><p>Quiz data is empty.</p></div>";
      return;
    }
    renderStart();
  }

  // indices of questions matching BOTH the level and format filters ("all" = no filter)
  function poolIndices(level, format) {
    var idx = [];
    quiz.questions.forEach(function (q, i) {
      var lvOk = level === "all" || q.level === level;
      var fmtOk = format === "all" || q.type === format;
      if (lvOk && fmtOk) idx.push(i);
    });
    return idx;
  }

  // ---- Start screen: pick difficulty, format, and how many questions ----
  function renderStart() {
    // guard: if the current selection has an empty intersection, relax it
    if (poolIndices(chosenLevel, chosenFormat).length === 0) chosenFormat = "all";
    if (poolIndices(chosenLevel, chosenFormat).length === 0) chosenLevel = "all";

    function chipRow(id, keys, activeKey, labelFn, countFn) {
      return "<div class='level-chips' id='" + id + "'>" +
        keys.map(function (k) {
          var count = countFn(k);
          var disabled = count === 0;
          return "<button class='level-chip" + (k === activeKey ? " active" : "") +
            (disabled ? " disabled" : "") + "' data-key='" + k + "'" + (disabled ? " disabled" : "") +
            ">" + labelFn(k) + "<span class='chip-count'>" + count + "</span></button>";
        }).join("") + "</div>";
    }

    var levelChips = chipRow(
      "level-chips", ["all"].concat(LEVELS), chosenLevel,
      function (l) { return l === "all" ? "All" : LEVEL_ICON[l] + " " + levelLabel(l); },
      function (l) { return poolIndices(l, chosenFormat).length; }
    );
    var formatChips = chipRow(
      "format-chips", ["all"].concat(FORMATS), chosenFormat,
      function (f) { return FORMAT_LABEL[f]; },
      function (f) { return poolIndices(chosenLevel, f).length; }
    );

    root.innerHTML =
      "<div class='q-card start-card'>" +
        "<span class='q-type'>" + esc(lang.name) + " Quiz</span>" +
        "<p class='q-text'>Difficulty</p>" + levelChips +
        "<p class='q-text' style='margin-top:18px'>Format</p>" + formatChips +
        "<p class='q-text' style='margin-top:18px'>How many questions?</p>" +
        "<div id='count-area'></div>" +
        "<div class='quiz-actions'><button class='btn primary' id='start-btn'>Start quiz</button></div>" +
        "<p class='start-note' id='start-note'></p>" +
      "</div>";

    var countArea = document.getElementById("count-area");
    var note = document.getElementById("start-note");

    function renderCountControl() {
      var pool = poolIndices(chosenLevel, chosenFormat).length;
      var min = Math.min(10, pool);
      if (chosenCount == null) chosenCount = pool;
      chosenCount = Math.max(min, Math.min(chosenCount, pool));

      if (pool <= min) {
        chosenCount = pool;
        countArea.innerHTML = "<div class='slider-val'><span id='count-val'>" + pool + "</span> question" +
          (pool === 1 ? "" : "s") + " (whole pool)</div>";
      } else {
        countArea.innerHTML =
          "<div class='slider-row'>" +
            "<input type='range' id='count-slider' min='" + min + "' max='" + pool +
              "' value='" + chosenCount + "' step='1' aria-label='Number of questions'>" +
          "</div>" +
          "<div class='slider-val'><span id='count-val'>" + chosenCount + "</span> of " + pool + " questions</div>";
        var slider = document.getElementById("count-slider");
        slider.addEventListener("input", function () {
          chosenCount = +slider.value;
          document.getElementById("count-val").textContent = slider.value;
        });
      }
      var fmtWord = chosenFormat === "all" ? "" : " " + FORMAT_LABEL[chosenFormat].replace(/^\S+\s/, "").toLowerCase();
      note.textContent = "Drawing " + pool + fmtWord + " question" + (pool === 1 ? "" : "s") +
        (chosenLevel === "all" ? "" : " at " + levelLabel(chosenLevel).toLowerCase() + " level") + " at random.";
    }

    // any chip tap re-renders the start screen (all state lives in outer vars)
    document.getElementById("level-chips").addEventListener("click", function (e) {
      var chip = e.target.closest(".level-chip");
      if (!chip || chip.disabled) return;
      chosenLevel = chip.getAttribute("data-key");
      renderStart();
    });
    document.getElementById("format-chips").addEventListener("click", function (e) {
      var chip = e.target.closest(".level-chip");
      if (!chip || chip.disabled) return;
      chosenFormat = chip.getAttribute("data-key");
      renderStart();
    });

    renderCountControl();
    document.getElementById("start-btn").addEventListener("click", function () {
      restart(chosenCount, chosenLevel, chosenFormat);
    });
  }

  function restart(count, level, format) {
    order = shuffle(poolIndices(level, format)).slice(0, count);
    current = 0;
    score = 0;
    missed = [];
    levelStats = {};
    renderQuestion();
  }

  function sectionLink(section) {
    var title = quiz.sections[section] || "Section " + section;
    return "<a class='review-link' href='review.html?lang=" + lang.id + "#s" + section + "'>" +
      "📖 Review: Section " + section + " — " + esc(title) + "</a>";
  }

  function renderQuestion() {
    var q = quiz.questions[order[current]];

    var html =
      "<div class='progress-track'><div class='progress-fill' style='width:" +
      Math.round((current / order.length) * 100) + "%'></div></div>" +
      "<div class='progress-label'>Question " + (current + 1) + " of " + order.length +
      " · Score " + score + "</div>" +
      "<div class='q-card'>" +
      "<div class='badge-row'><span class='q-type'>" + (TYPE_LABEL[q.type] || "") + "</span>" + levelBadge(q.level) + "</div>" +
      "<p class='q-text'>" + fmt(q.q) + "</p>" +
      (q.code ? "<pre><code>" + esc(q.code) + "</code></pre>" : "");

    if (q.type === "mc") {
      html += "<div class='choices' id='choices'></div>";
    } else if (q.type === "fill") {
      html += "<input class='fill-input' id='fill-input' type='text' autocomplete='off' " +
        "autocapitalize='off' autocorrect='off' spellcheck='false' placeholder='Type your answer…'>";
    } else if (q.type === "assemble") {
      var segs = q.template.split("{#}");
      var codeHtml = "";
      for (var si = 0; si < segs.length; si++) {
        codeHtml += esc(segs[si]);
        if (si < segs.length - 1) {
          codeHtml += "<button type='button' class='blank' data-b='" + si + "'></button>";
        }
      }
      html += "<pre class='assemble-code'><code>" + codeHtml + "</code></pre>" +
        "<div class='assemble-hint'>Tap the tokens in order to fill the blanks:</div>" +
        "<div class='token-bank' id='token-bank'></div>";
    }
    html += "<div id='feedback-slot'></div>" +
      "<div class='quiz-actions'><button class='btn primary' id='submit-btn' disabled>Check answer</button></div>" +
      "</div>";
    root.innerHTML = html;

    var submitBtn = document.getElementById("submit-btn");
    var selected = -1;
    var choiceOrder = [];
    var placed = null;      // assemble: per-blank { tile, value } or null
    var bank = null;        // assemble: shuffled token values

    if (q.type === "mc") {
      var box = document.getElementById("choices");
      choiceOrder = shuffle(q.choices.map(function (_, i) { return i; }));
      choiceOrder.forEach(function (origIdx, pos) {
        var b = document.createElement("button");
        b.className = "choice";
        b.innerHTML = fmt(q.choices[origIdx]);
        b.addEventListener("click", function () {
          selected = pos;
          Array.prototype.forEach.call(box.children, function (c) { c.classList.remove("selected"); });
          b.classList.add("selected");
          submitBtn.disabled = false;
        });
        box.appendChild(b);
      });
    } else if (q.type === "fill") {
      var input = document.getElementById("fill-input");
      input.addEventListener("input", function () {
        submitBtn.disabled = input.value.trim() === "";
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !submitBtn.disabled) submitBtn.click();
      });
      setTimeout(function () { input.focus(); }, 50);
    } else if (q.type === "assemble") {
      placed = q.blanks.map(function () { return null; });
      bank = shuffle(q.blanks.concat(q.distractors || []));
      var bankEl = document.getElementById("token-bank");
      var blankEls = document.querySelectorAll(".blank");

      function refresh() {
        blankEls.forEach(function (b) {
          var i = +b.getAttribute("data-b");
          if (placed[i]) { b.textContent = placed[i].value; b.classList.add("filled"); }
          else { b.textContent = ""; b.classList.remove("filled"); }
        });
        Array.prototype.forEach.call(bankEl.children, function (t) {
          var k = +t.getAttribute("data-t");
          t.classList.toggle("used", placed.some(function (p) { return p && p.tile === k; }));
        });
        submitBtn.disabled = placed.some(function (p) { return p === null; });
      }

      bank.forEach(function (val, k) {
        var t = document.createElement("button");
        t.type = "button";
        t.className = "token";
        t.setAttribute("data-t", k);
        t.textContent = val;
        t.addEventListener("click", function () {
          if (placed.some(function (p) { return p && p.tile === k; })) return;  // already used
          for (var i = 0; i < placed.length; i++) {
            if (placed[i] === null) { placed[i] = { tile: k, value: val }; break; }
          }
          refresh();
        });
        bankEl.appendChild(t);
      });
      blankEls.forEach(function (b) {
        b.addEventListener("click", function () {
          var i = +b.getAttribute("data-b");
          if (placed[i] === null) return;
          placed[i] = null;   // clear -> its token returns to the bank
          refresh();
        });
      });
      refresh();
    }

    submitBtn.addEventListener("click", function () {
      var isCorrect, userShown, correctShown;
      if (q.type === "mc") {
        var mbox = document.getElementById("choices");
        isCorrect = choiceOrder[selected] === q.answer;
        Array.prototype.forEach.call(mbox.children, function (c, pos) {
          c.disabled = true;
          if (choiceOrder[pos] === q.answer) c.classList.add("correct");
          else if (pos === selected && !isCorrect) c.classList.add("wrong");
        });
        userShown = q.choices[choiceOrder[selected]];
        correctShown = q.choices[q.answer];
      } else if (q.type === "fill") {
        var fin = document.getElementById("fill-input");
        fin.disabled = true;
        var user = normalize(fin.value);
        isCorrect = q.accept.some(function (a) { return normalize(a) === user; });
        userShown = fin.value;
        correctShown = q.answerDisplay;
      } else { // assemble
        isCorrect = placed.every(function (p, i) { return p && p.value === q.blanks[i]; });
        document.querySelectorAll(".blank").forEach(function (b) {
          var i = +b.getAttribute("data-b");
          b.disabled = true;
          if (placed[i] && placed[i].value === q.blanks[i]) b.classList.add("ok");
          else b.classList.add("bad");
        });
        document.querySelectorAll(".token").forEach(function (t) { t.disabled = true; });
        userShown = assembleTemplate(q.template, placed.map(function (p) { return p ? p.value : "▢"; }));
        correctShown = assembleTemplate(q.template, q.blanks);
      }

      // per-level tally for the results breakdown
      if (q.level) {
        var stt = levelStats[q.level] || (levelStats[q.level] = { right: 0, total: 0 });
        stt.total++;
        if (isCorrect) stt.right++;
      }

      if (isCorrect) {
        score++;
      } else {
        missed.push({
          section: q.section,
          level: q.level,
          type: q.type,
          question: q.q,
          code: q.code || null,
          yourAnswer: userShown,
          correctAnswer: correctShown,
          explain: q.explain,
          example: q.example || null
        });
      }

      var fb = "<div class='feedback " + (isCorrect ? "ok" : "no") + "'>" +
        "<div class='verdict'>" + (isCorrect ? "✅ Correct!" : "❌ Not quite") + "</div>";
      if (!isCorrect) {
        if (q.type === "assemble") {
          fb += "<div class='correct-answer'><strong>Correct code:</strong></div>" +
            "<pre class='answer-code'><code>" + esc(correctShown) + "</code></pre>";
        } else {
          fb += "<div class='correct-answer'><strong>Correct answer:</strong> " + fmt(correctShown) + "</div>";
        }
      }
      fb += "<div class='explain'>" + fmt(q.explain) + "</div>" +
        exampleBlock(q.example) + sectionLink(q.section) + "</div>";
      document.getElementById("feedback-slot").innerHTML = fb;

      var last = current === order.length - 1;
      submitBtn.textContent = last ? "See results" : "Next question";
      submitBtn.disabled = false;
      var fresh = submitBtn.cloneNode(true); // drop old listeners
      submitBtn.parentNode.replaceChild(fresh, submitBtn);
      fresh.addEventListener("click", function () {
        current++;
        if (current < order.length) renderQuestion();
        else renderResults();
      });
      fresh.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function renderResults() {
    var pct = Math.round((score / order.length) * 100);
    var msg =
      pct === 100 ? "Perfect score — you know this cold. 🎉" :
      pct >= 80 ? "Great job — just a couple of spots to polish." :
      pct >= 60 ? "Solid — review the sections below and try again." :
      "Good effort — the sections below are worth a re-read.";

    var html =
      "<div class='progress-track'><div class='progress-fill' style='width:100%'></div></div>" +
      "<div class='score-big'>" + score + " / " + order.length + "</div>" +
      "<p class='score-msg'>" + pct + "% — " + msg + "</p>";

    // per-level breakdown (only levels that appeared in this run)
    var parts = LEVELS.filter(function (l) { return levelStats[l]; }).map(function (l) {
      var st = levelStats[l];
      return "<span class='level-score " + l + "'>" + LEVEL_ICON[l] + " " +
        levelLabel(l) + " " + st.right + "/" + st.total + "</span>";
    });
    if (parts.length > 1) {
      html += "<div class='level-score-row'>" + parts.join("") + "</div>";
    }

    if (missed.length) {
      var bySection = {};
      missed.forEach(function (m) {
        (bySection[m.section] = bySection[m.section] || []).push(m);
      });
      html += "<h2 class='results-subhead'>Sections to review</h2><ul class='missed-list'>";
      Object.keys(bySection).map(Number).sort(function (a, b) { return a - b; }).forEach(function (sec) {
        var title = quiz.sections[sec] || "Section " + sec;
        var n = bySection[sec].length;
        html += "<li><div class='sec'>Section " + sec + " — " + esc(title) + "</div>" +
          "<div>" + n + " missed question" + (n > 1 ? "s" : "") + "</div>" +
          "<a href='review.html?lang=" + lang.id + "#s" + sec + "'>Open this section ›</a></li>";
      });
      html += "</ul>";

      html += "<h2 class='results-subhead'>Your incorrect answers <span class='subhead-hint'>(tap to expand)</span></h2>";
      html += "<div class='miss-details'>";
      missed.forEach(function (m) {
        var answers;
        if (m.type === "assemble") {
          answers =
            "<div class='miss-line your'><span class='miss-lbl'>Your answer</span>" +
              "<pre class='answer-code'><code>" + esc(m.yourAnswer) + "</code></pre></div>" +
            "<div class='miss-line correct'><span class='miss-lbl'>Correct answer</span>" +
              "<pre class='answer-code'><code>" + esc(m.correctAnswer) + "</code></pre></div>";
        } else {
          answers =
            "<div class='miss-line your'><span class='miss-lbl'>Your answer</span>" + fmt(m.yourAnswer) + "</div>" +
            "<div class='miss-line correct'><span class='miss-lbl'>Correct answer</span>" + fmt(m.correctAnswer) + "</div>";
        }
        html +=
          "<details class='miss-item'>" +
            "<summary><span class='miss-badge'>✕</span>" +
              "<span class='miss-sum-text'>" + fmt(m.question) + "</span></summary>" +
            "<div class='miss-body'>" +
              (m.level ? "<div class='miss-level'>" + levelBadge(m.level) + "</div>" : "") +
              (m.code ? "<pre><code>" + esc(m.code) + "</code></pre>" : "") +
              answers +
              "<div class='miss-explain'>" + fmt(m.explain) + "</div>" +
              exampleBlock(m.example) +
              sectionLink(m.section) +
            "</div>" +
          "</details>";
      });
      html += "</div>";
    }

    html += "<div class='quiz-actions' style='margin-top:22px'>" +
      "<a class='btn' href='index.html'>Home</a>" +
      "<button class='btn primary' id='retry-btn'>Try again</button></div>";
    root.innerHTML = html;
    document.getElementById("retry-btn").addEventListener("click", renderStart);
  }
})();
