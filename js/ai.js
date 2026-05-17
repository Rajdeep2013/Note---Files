window.Notepilot.AISummarizer = (() => {
  const chatMessages = document.getElementById("chatMessages");
  const aiFileInput = document.getElementById("aiFileInput");
  const attachFileBtn = document.getElementById("attachFileBtn");
  const summarizeBtn = document.getElementById("summarizeBtn");
  const uploadedFilePreview = document.getElementById("uploadedFilePreview");
  const pastedNotesInput = document.getElementById("pastedNotesInput");

  const summarizerState = {
    file: null,
    extractedText: "",
    pendingSource: ""
  };

  const extractorMap = {
    txt: extractTextFromTxt,
    pdf: extractTextFromPdfFuture,
    docx: extractTextFromDocxFuture
  };

  function appendAssistantBubble(text) {
    if (!chatMessages) return;
    const row = document.createElement("div");
    row.className = "chat-row bot";
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = text;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTypingIndicator() {
    if (!chatMessages) return null;
    const row = document.createElement("div");
    row.className = "chat-row bot";
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = `
      <div class="processing-state">
        <span class="processing-label">Analyzing content</span>
        <div class="typing-bubble">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return row;
  }

  function getExtension(name) {
    if (!name || !name.includes(".")) return "";
    return name.split(".").pop().toLowerCase();
  }

  function renderUploadedFileCard(file) {
    if (!uploadedFilePreview) return;
    uploadedFilePreview.classList.remove("hidden");
    const ext = getExtension(file.name).toUpperCase() || "FILE";
    uploadedFilePreview.innerHTML = `
      <span class="file-chip-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <div class="file-chip-meta">
        <p class="file-chip-name">${window.Notepilot.utils.escapeText(file.name)}</p>
        <p class="file-chip-type">${ext} - ${window.Notepilot.utils.formatBytes(file.size || 0)}</p>
      </div>
    `;
  }

  function extractTextFromTxt(file) {
    return file.text();
  }

  function extractTextFromPdfFuture() {
    return Promise.resolve("[PDF extractor placeholder] Integrate parser in next version.");
  }

  function extractTextFromDocxFuture() {
    return Promise.resolve("[DOCX extractor placeholder] Integrate parser in next version.");
  }

  function summarizeText(text) {
    const cleaned = window.Notepilot.utils.cleanText(text);
    if (!cleaned) {
      return {
        html: "<p>I could not find enough text to summarize.</p>",
        sourceWords: 0,
        summaryWords: 0,
        sentenceCount: 0,
        keywords: []
      };
    }
    const sentences = window.Notepilot.utils.splitIntoSentences(cleaned);
    const sourceWords = window.Notepilot.utils.countWords(cleaned);
    if (sentences.length <= 2 || sourceWords < 30) {
      const compact = sentences.slice(0, 1).join(" ");
      return {
        html: formatSummaryHtml({ summaryText: compact || cleaned }),
        sourceWords,
        summaryWords: window.Notepilot.utils.countWords(compact || cleaned),
        sentenceCount: sentences.length,
        keywords: window.Notepilot.utils.getTopKeywords(cleaned, 5)
      };
    }
    const frequencyMap = window.Notepilot.utils.buildFrequencyMap(cleaned);
    const ranked = window.Notepilot.utils.scoreSentences(sentences, frequencyMap);
    const targetCount = window.Notepilot.utils.getTargetSummarySentenceCount(sentences.length);
    const selected = window.Notepilot.utils.selectBestSentences(ranked, targetCount);
    const conciseSummary = window.Notepilot.utils.buildFinalSummary(selected);
    const keywords = window.Notepilot.utils.getTopKeywords(cleaned, 6);
    const summaryWords = window.Notepilot.utils.countWords(conciseSummary);
    return {
      html: formatSummaryHtml({ summaryText: conciseSummary }),
      sourceWords,
      summaryWords,
      sentenceCount: sentences.length,
      keywords
    };
  }

  function formatSummaryHtml({ summaryText }) {
    return `
      <div class="summary-panel">
        <div class="summary-header">
          <svg class="summary-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l2.6 2.6L18 6l-1.4 3.4L19 12l-2.4 2.6L18 18l-3.4.4L12 21l-2.6-2.6L6 18l1.4-3.4L5 12l2.4-2.6L6 6l3.4-.4L12 3zm0 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
          <h3 class="summary-title">Summary</h3>
        </div>
        <div class="summary-divider"></div>
        <p class="summary-text">${window.Notepilot.utils.escapeHtml(summaryText)}</p>
      </div>
    `;
  }

  async function readSelectedFile(file) {
    const extension = getExtension(file.name);
    const extractor = extractorMap[extension];
    if (!extractor) {
      return "";
    }
    return extractor(file);
  }

  async function runSummarization() {
    const pastedText = pastedNotesInput ? pastedNotesInput.value.trim() : "";
    const sourceText = pastedText || summarizerState.extractedText;
    if (!sourceText) {
      appendAssistantBubble("Please upload a .txt file or paste notes first.");
      return;
    }
    const typingRow = showTypingIndicator();
    await new Promise((resolve) => setTimeout(resolve, 1050));
    if (typingRow) typingRow.remove();
    const summaryResult = summarizeText(sourceText);
    appendAssistantBubble(summaryResult.html);
  }

  function bindEvents() {
    if (attachFileBtn && aiFileInput) {
      attachFileBtn.addEventListener("click", () => {
        aiFileInput.click();
      });
    }
    if (aiFileInput) {
      aiFileInput.addEventListener("change", async () => {
        const file = aiFileInput.files[0];
        if (!file) return;
        summarizerState.file = file;
        renderUploadedFileCard(file);
        const extension = getExtension(file.name);
        if (extension !== "txt") {
          summarizerState.extractedText = "";
          appendAssistantBubble("Version 1 currently summarizes .txt files and pasted notes. PDF/DOCX support is prepared for next versions.");
          return;
        }
        const extracted = await readSelectedFile(file);
        summarizerState.extractedText = window.Notepilot.utils.cleanText(extracted);
        appendAssistantBubble(`Loaded <strong>${window.Notepilot.utils.escapeText(file.name)}</strong>. Click <strong>Summarize File</strong> when ready.`);
      });
    }
    if (summarizeBtn) {
      summarizeBtn.addEventListener("click", runSummarization);
    }
  }

  function init() {
    bindEvents();
  }

  return {
    init
  };
})();

window.Notepilot.registerModule(window.Notepilot.AISummarizer.init);
