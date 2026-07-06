// Quiz engine — reads ?lang=<id>, loads quizzes/<id>.js, runs the quiz.
// Question types:
//   mc   → { type:"mc", q, code?, choices:[...], answer:<index>, explain, section }
//   fill → { type:"fill", q, code?, accept:[...], answerDisplay, explain, section }
(function () {
  var params = new URLSearchParams(location.search);
  var langId = params.get("lang");
  var lang = window.getLanguage(langId);
  var root = document.getElementById("quiz-root");

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

  var quiz, order, current, score, missed;

  function start() {
    quiz = (window.QUIZZES || {})[lang.id];
    if (!quiz) {
      root.innerHTML = "<div class='q-card'><p>Quiz data is empty.</p></div>";
      return;
    }
    restart();
  }

  function restart() {
    order = shuffle(quiz.questions.map(function (_, i) { return i; }));
    current = 0;
    score = 0;
    missed = [];
    renderQuestion();
  }

  function sectionLink(q) {
    var title = quiz.sections[q.section] || "Section " + q.section;
    return "<a class='review-link' href='review.html?lang=" + lang.id + "#s" + q.section + "'>" +
      "📖 Review: Section " + q.section + " — " + esc(title) + "</a>";
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
      "<span class='q-type'>" + typeLabel + "</span>" +
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

      if (isCorrect) score++;
      else missed.push(q);

      var fb = "<div class='feedback " + (isCorrect ? "ok" : "no") + "'>" +
        "<div class='verdict'>" + (isCorrect ? "✅ Correct!" : "❌ Not quite") + "</div>";
      if (!isCorrect) {
        var correctShown = q.type === "mc" ? q.choices[q.answer] : q.answerDisplay;
        fb += "<div class='correct-answer'><strong>Correct answer:</strong> " + fmt(correctShown) + "</div>";
      }
      fb += "<div class='explain'>" + fmt(q.explain) + "</div>" + sectionLink(q) + "</div>";
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

    if (missed.length) {
      // group missed questions by section, keep section order
      var bySection = {};
      missed.forEach(function (q) {
        (bySection[q.section] = bySection[q.section] || []).push(q);
      });
      html += "<h2 style='font-size:18px'>Sections to review</h2><ul class='missed-list'>";
      Object.keys(bySection).map(Number).sort(function (a, b) { return a - b; }).forEach(function (sec) {
        var title = quiz.sections[sec] || "Section " + sec;
        html += "<li><div class='sec'>Section " + sec + " — " + esc(title) + "</div>" +
          "<div>" + bySection[sec].length + " missed question" + (bySection[sec].length > 1 ? "s" : "") + "</div>" +
          "<a href='review.html?lang=" + lang.id + "#s" + sec + "'>Open this section ›</a></li>";
      });
      html += "</ul>";
    }

    html += "<div class='quiz-actions' style='margin-top:22px'>" +
      "<a class='btn' href='index.html'>Home</a>" +
      "<button class='btn primary' id='retry-btn'>Try again</button></div>";
    root.innerHTML = html;
    document.getElementById("retry-btn").addEventListener("click", restart);
  }
})();
