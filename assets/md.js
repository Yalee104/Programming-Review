// Minimal, dependency-free markdown renderer covering what the study
// summaries use: headings, fenced code blocks, inline code, bold, links,
// lists, blockquotes and horizontal rules.
// Returns { html, toc } where toc = [{ id, num, title }] built from
// "## N. Title" section headings.
(function () {
  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Inline formatting on already-escaped text. Backtick spans are protected
  // first so bold/link markup inside code (e.g. `**kwargs`) is left alone.
  function inline(escaped) {
    var codeSpans = [];
    var out = escaped.replace(/`([^`]+)`/g, function (_, code) {
      codeSpans.push(code);
      return "\u0000" + (codeSpans.length - 1) + "\u0000";
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    out = out.replace(/\u0000(\d+)\u0000/g, function (_, i) {
      return "<code>" + codeSpans[+i] + "</code>";
    });
    return out;
  }

  window.renderMarkdown = function (src) {
    var lines = src.split(/\r?\n/);
    var html = [];
    var toc = [];
    var i = 0;
    var para = [];
    var listType = null; // "ul" | "ol" | null

    function flushPara() {
      if (para.length) {
        html.push("<p>" + inline(escapeHtml(para.join(" "))) + "</p>");
        para = [];
      }
    }
    function closeList() {
      if (listType) {
        html.push("</" + listType + ">");
        listType = null;
      }
    }

    while (i < lines.length) {
      var line = lines[i];

      // fenced code block
      var fence = line.match(/^```(\w*)/);
      if (fence) {
        flushPara();
        closeList();
        var buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        html.push(
          '<pre><code class="lang-' + (fence[1] || "text") + '">' +
            escapeHtml(buf.join("\n")) +
            "</code></pre>"
        );
        continue;
      }

      // heading
      var h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        flushPara();
        closeList();
        var level = h[1].length;
        var text = h[2];
        var attrs = "";
        if (level === 2) {
          var sec = text.match(/^(\d+)\.\s*(.*)$/);
          if (sec) {
            var id = "s" + sec[1];
            attrs = ' id="' + id + '"';
            toc.push({ id: id, num: +sec[1], title: sec[2] });
          }
        }
        html.push("<h" + level + attrs + ">" + inline(escapeHtml(text)) + "</h" + level + ">");
        i++;
        continue;
      }

      // horizontal rule
      if (/^\s*---+\s*$/.test(line)) {
        flushPara();
        closeList();
        html.push("<hr>");
        i++;
        continue;
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        flushPara();
        closeList();
        var qbuf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          qbuf.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        html.push("<blockquote><p>" + inline(escapeHtml(qbuf.join(" "))) + "</p></blockquote>");
        continue;
      }

      // list items
      var ul = line.match(/^\s*[-*]\s+(.*)$/);
      var ol = line.match(/^\s*\d+\.\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        var want = ul ? "ul" : "ol";
        if (listType !== want) {
          closeList();
          html.push("<" + want + ">");
          listType = want;
        }
        // gather soft-wrapped continuation lines (indented, non-list)
        var item = (ul || ol)[1];
        i++;
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i]) &&
          !/^\s*[-*]\s+/.test(lines[i]) &&
          !/^\s*\d+\.\s+/.test(lines[i])
        ) {
          item += " " + lines[i].trim();
          i++;
        }
        html.push("<li>" + inline(escapeHtml(item)) + "</li>");
        continue;
      }

      // blank line
      if (/^\s*$/.test(line)) {
        flushPara();
        closeList();
        i++;
        continue;
      }

      // paragraph text
      para.push(line.trim());
      i++;
    }
    flushPara();
    closeList();
    return { html: html.join("\n"), toc: toc };
  };
})();
