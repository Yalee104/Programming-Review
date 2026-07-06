// Quiz engine — reads ?lang=<id>, loads quizzes/<id>.js, runs the quiz.
// Question types:
//   mc   → { type:"mc", q, code?, choices:[...], answer:<index>, explain, section, level }
//   fill → { type:"fill", q, code?, accept:[...], answerDisplay, explain, section, level }
// level: "beginner" | "intermediate" | "advanced"
(function () {
  var params = new URLSearchParams(location.search);
  var langId = params.get("lang");
  var lang = window.getLanguage(langId);
  var root = document.getElementById("quiz-root");

  var LEVELS = ["beginner", "intermediate", "advanced"];
  var LEVEL_ICON = { beginner: "🟢", intermediate: "🟡", advanced: "🔴" };
  function levelLabel(l) { return l.charAt(0).toUpperCase() + l.slice(1); }

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

  function start() {
    quiz = (window.QUIZZES || {})[lang.id];
    if (!quiz || !quiz.questions || !quiz.questions.length) {
      root.innerHTML = "<div class='q-card'><p>Quiz data is empty.</p></div>";
      return;
    }
    renderStart();
  }

  function poolIndices(level) {
    var idx = [];
    quiz.questions.forEach(function (q, i) {
      if (level === "all" || q.level === level) idx.push(i);
    });
    return idx;
  }

  // ---- Start screen: pick difficulty + how many questions ----
  function renderStart() {
    var counts = { all: quiz.questions.length };
    LEVELS.forEach(function (l) { counts[l] = poolIndices(l).length; });
    if (!counts[chosenLevel]) chosenLevel = "all";   // guard: never land on an empty level

    var chips =
      "<div class='level-chips' id='level-chips'>" +
      ["all"].concat(LEVELS).map(function (l) {
        var label = l === "all" ? "All" : LEVEL_ICON[l] + " " + levelLabel(l);
        var disabled = counts[l] === 0;
        return "<button class='level-chip" + (l === chosenLevel ? " active" : "") +
          (disabled ? " disabled" : "") + "' data-level='" + l + "'" +
          (disabled ? " disabled" : "") + ">" + label +
          "<span class='chip-count'>" + counts[l] + "</span></button>";
      }).join("") +
      "</div>";

    root.innerHTML =
      "<div class='q-card start-card'>" +
        "<span class='q-type'>" + esc(lang.name) + " Quiz</span>" +
        "<p class='q-text'>Difficulty</p>" +
        chips +
        "<p class='q-text' style='margin-top:18px'>How many questions?</p>" +
        "<div id='count-area'></div>" +
        "<div class='quiz-actions'><button class='btn primary' id='start-btn'>Start quiz</button></div>" +
        "<p class='start-note' id='start-note'></p>" +
      "</div>";

    var countArea = document.getElementById("count-area");
    var note = document.getElementById("start-note");

    function renderCountControl() {
      var pool = counts[chosenLevel];
      var min = Math.min(10, pool);
      if (chosenCount == null) chosenCount = pool;
      chosenCount = Math.max(min, Math.min(chosenCount, pool));

      if (pool <= min) {
        // pool too small for a meaningful slider — fixed count
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
      note.textContent = "Questions are drawn at random from the " +
        (chosenLevel === "all" ? "full pool" : levelLabel(chosenLevel).toLowerCase() + " pool") +
        " of " + pool + ".";
    }

    document.getElementById("level-chips").addEventListener("click", function (e) {
      var chip = e.target.closest(".level-chip");
      if (!chip || chip.disabled) return;
      chosenLevel = chip.getAttribute("data-level");
      Array.prototype.forEach.call(
        document.querySelectorAll(".level-chip"),
        function (c) { c.classList.toggle("active", c === chip); }
      );
      renderCountControl();
    });

    renderCountControl();
    document.getElementById("start-btn").addEventListener("click", function () {
      restart(chosenCount, chosenLevel);
    });
  }

  function restart(count, level) {
    order = shuffle(poolIndices(level)).slice(0, count);
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
    var typeLabel = q.type === "mc" ? "Multiple choice" : "Fill in the blank";

    var html =
      "<div class='progress-track'><div class='progress-fill' style='width:" +
      Math.round((current / order.length) * 100) + "%'></div></div>" +
      "<div class='progress-label'>Question " + (current + 1) + " of " + order.length +
      " · Score " + score + "</div>" +
      "<div class='q-card'>" +
      "<div class='badge-row'><span class='q-type'>" + typeLabel + "</span>" + levelBadge(q.level) + "</div>" +
      "<p class='q-text'>" + fmt(q.q) + "</p>" +
      (q.code ? "<pre><code>" + esc(q.code) + "</code></pre>" : "");

    if (q.type === "mc") {
      html += "<div class='choices' id='choices'></div>";
    } else {
      html += "<input class='fill-input' id='fill-input' type='text' autocomplete='off' " +
        "autocapitalize='off' autocorrect='off' spellcheck='false' placeholder='Type your answer…'>";
    }
    html += "<div id='feedback-slot'></div>" +
      "<div class='quiz-actions'><button class='btn primary' id='submit-btn' disabled>Check answer</button></div>" +
      "</div>";
    root.innerHTML = html;

    var submitBtn = document.getElementById("submit-btn");
    var selected = -1;
    var choiceOrder = [];

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
    } else {
      var input = document.getElementById("fill-input");
      input.addEventListener("input", function () {
        submitBtn.disabled = input.value.trim() === "";
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !submitBtn.disabled) submitBtn.click();
      });
      setTimeout(function () { input.focus(); }, 50);
    }

    submitBtn.addEventListener("click", function () {
      var isCorrect, userShown;
      if (q.type === "mc") {
        var box = document.getElementById("choices");
        isCorrect = choiceOrder[selected] === q.answer;
        Array.prototype.forEach.call(box.children, function (c, pos) {
          c.disabled = true;
          if (choiceOrder[pos] === q.answer) c.classList.add("correct");
          else if (pos === selected && !isCorrect) c.classList.add("wrong");
        });
        userShown = q.choices[choiceOrder[selected]];
      } else {
        var input = document.getElementById("fill-input");
        input.disabled = true;
        var user = normalize(input.value);
        isCorrect = q.accept.some(function (a) { return normalize(a) === user; });
        userShown = input.value;
      }

      var correctShown = q.type === "mc" ? q.choices[q.answer] : q.answerDisplay;

      // per-level tally for the results breakdown
      if (q.level) {
        var st = levelStats[q.level] || (levelStats[q.level] = { right: 0, total: 0 });
        st.total++;
        if (isCorrect) st.right++;
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
          explain: q.explain
        });
      }

      var fb = "<div class='feedback " + (isCorrect ? "ok" : "no") + "'>" +
        "<div class='verdict'>" + (isCorrect ? "✅ Correct!" : "❌ Not quite") + "</div>";
      if (!isCorrect) {
        fb += "<div class='correct-answer'><strong>Correct answer:</strong> " + fmt(correctShown) + "</div>";
      }
      fb += "<div class='explain'>" + fmt(q.explain) + "</div>" + sectionLink(q.section) + "</div>";
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
      // compact "sections to review" summary, grouped and ordered by section
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

      // expandable per-question recap: tap to see the question, your answer vs correct
      html += "<h2 class='results-subhead'>Your incorrect answers <span class='subhead-hint'>(tap to expand)</span></h2>";
      html += "<div class='miss-details'>";
      missed.forEach(function (m) {
        html +=
          "<details class='miss-item'>" +
            "<summary><span class='miss-badge'>✕</span>" +
              "<span class='miss-sum-text'>" + fmt(m.question) + "</span></summary>" +
            "<div class='miss-body'>" +
              (m.level ? "<div class='miss-level'>" + levelBadge(m.level) + "</div>" : "") +
              (m.code ? "<pre><code>" + esc(m.code) + "</code></pre>" : "") +
              "<div class='miss-line your'><span class='miss-lbl'>Your answer</span>" + fmt(m.yourAnswer) + "</div>" +
              "<div class='miss-line correct'><span class='miss-lbl'>Correct answer</span>" + fmt(m.correctAnswer) + "</div>" +
              "<div class='miss-explain'>" + fmt(m.explain) + "</div>" +
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
