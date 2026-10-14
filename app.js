/**
 * Frontend Application: AI SGK Tin học THCS
 * Tuân thủ chuẩn Alibaba Open-Code-Review (Zero XSS) và stitch-type-safe-ui
 */

const API_BASE = "http://127.0.0.1:8000/api";

const state = {
  grade: 6,
  lessonId: 1,
  lessonData: null,
  selectedAnswers: {},
  chatHistory: []
};

// DOM Elements
const lessonContentEl = document.getElementById("lessonContent");
const quizContainerEl = document.getElementById("quizContainer");
const quizScoreBannerEl = document.getElementById("quizScoreBanner");
const btnSubmitQuizEl = document.getElementById("btnSubmitQuiz");
const chatMessagesEl = document.getElementById("chatMessages");
const chatFormEl = document.getElementById("chatForm");
const chatInputEl = document.getElementById("chatInput");
const btnSendChatEl = document.getElementById("btnSendChat");
const quizBadgeEl = document.getElementById("quizBadge");

// Khởi chạy ứng dụng
document.addEventListener("DOMContentLoaded", () => {
  loadLesson(state.grade, state.lessonId);
  setupEvents();
});

// Tải nội dung bài học từ Backend API
async function loadLesson(grade, lessonId) {
  try {
    const loadingHtml = '<div class="flex items-center justify-center py-20 text-slate-400 gap-3"><span>Đang nạp dữ liệu SGK chuẩn xác...</span></div>';
    lessonContentEl.innerHTML = DOMPurify.sanitize(loadingHtml);

    const res = await fetch(`${API_BASE}/lesson/${grade}/${lessonId}`);
    if (!res.ok) throw new Error("Không thể tải bài học");
    const data = await res.json();
    state.lessonData = data;

    // 1. Render nội dung lý thuyết Markdown đã qua lọc XSS bằng DOMPurify
    if (window.marked) {
      const parsedHtml = marked.parse(data.content_markdown);
      lessonContentEl.innerHTML = DOMPurify.sanitize(parsedHtml);
    } else {
      lessonContentEl.textContent = data.content_markdown;
    }

    // 2. Render danh sách câu hỏi trắc nghiệm
    renderQuiz(data.quiz);

  } catch (err) {
    const errorHtml = '<div class="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">⚠️ Không thể kết nối với Backend API. Vui lòng đảm bảo server đang chạy tại <code>127.0.0.1:8000</code>.</div>';
    lessonContentEl.innerHTML = DOMPurify.sanitize(errorHtml);
  }
}

// Render các câu hỏi trắc nghiệm
function renderQuiz(quizList) {
  if (!quizList || quizList.length === 0) {
    quizContainerEl.innerHTML = DOMPurify.sanitize('<p class="text-xs text-slate-500">Bài học này chưa có câu hỏi trắc nghiệm.</p>');
    return;
  }

  quizBadgeEl.textContent = `${quizList.length} câu hỏi`;
  state.selectedAnswers = {};
  quizScoreBannerEl.classList.add("hidden");

  let html = "";
  quizList.forEach((q, idx) => {
    html += `
      <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/80 space-y-2.5" id="quiz-card-${q.id}">
        <div class="flex items-start gap-2">
          <span class="w-5 h-5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
            ${idx + 1}
          </span>
          <p class="font-medium text-slate-200 text-xs leading-relaxed">${escapeHtml(q.cau_hoi)}</p>
        </div>

        <div class="space-y-1.5 pt-1">
          ${Object.entries(q.lua_chon).map(([optKey, optText]) => `
            <div class="quiz-option-label" data-qid="${q.id}" data-key="${optKey}">
              <span class="w-5 h-5 rounded-md bg-slate-700/50 text-slate-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                ${optKey}
              </span>
              <span class="text-xs text-slate-300">${escapeHtml(optText)}</span>
            </div>
          `).join("")}
        </div>

        <!-- Vùng hiển thị nhận xét sư phạm sau khi chấm -->
        <div id="feedback-${q.id}" class="hidden p-2.5 rounded-lg text-xs leading-relaxed"></div>
      </div>
    `;
  });

  quizContainerEl.innerHTML = DOMPurify.sanitize(html);

  // Gắn sự kiện chọn đáp án
  document.querySelectorAll(".quiz-option-label").forEach(label => {
    label.addEventListener("click", () => {
      const qid = label.dataset.qid;
      const key = label.dataset.key;
      state.selectedAnswers[qid] = key;

      // Xóa style đã chọn ở các anh em cùng câu hỏi
      document.querySelectorAll(`.quiz-option-label[data-qid="${qid}"]`).forEach(sibling => {
        sibling.classList.remove("selected");
      });
      label.classList.add("selected");
    });
  });
}

// Thiết lập sự kiện tương tác
function setupEvents() {
  // Nộp bài trắc nghiệm
  btnSubmitQuizEl.addEventListener("click", submitQuiz);

  // Gửi tin nhắn chat với Gia sư
  chatFormEl.addEventListener("submit", (e) => {
    e.preventDefault();
    sendChatMessage();
  });

  // Gợi ý câu hỏi nhanh (Quick chips)
  document.querySelectorAll(".quick-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chatInputEl.value = chip.dataset.prompt;
      sendChatMessage();
    });
  });
}

// Xử lý nộp bài và chấm điểm qua Backend
async function submitQuiz() {
  const qCount = state.lessonData?.quiz?.length || 0;
  const answeredCount = Object.keys(state.selectedAnswers).length;

  if (answeredCount < qCount) {
    if (!confirm(`Em mới chọn ${answeredCount}/${qCount} câu. Em có chắc chắn muốn nộp bài luôn không?`)) {
      return;
    }
  }

  btnSubmitQuizEl.disabled = true;
  btnSubmitQuizEl.textContent = "Đang chấm điểm & phân tích sư phạm...";

  try {
    const res = await fetch(`${API_BASE}/grade-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grade: state.grade,
        lesson_id: state.lessonId,
        answers: state.selectedAnswers
      })
    });

    const result = await res.json();
    if (!result.success) throw new Error(result.detail || "Lỗi chấm bài");

    displayQuizEvaluation(result.evaluation);

  } catch (err) {
    alert("Có lỗi khi chấm điểm: " + err.message);
  } finally {
    btnSubmitQuizEl.disabled = false;
    btnSubmitQuizEl.textContent = "Nộp bài & Chấm điểm tức thì";
  }
}

// Hiển thị kết quả chấm điểm & nhận xét sư phạm
function displayQuizEvaluation(evaluation) {
  quizScoreBannerEl.classList.remove("hidden");
  const summaryHtml = `
    <div class="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
      <span class="font-bold text-amber-400">Điểm số: ${evaluation.score}/10</span>
      <span class="text-slate-400">Đúng ${evaluation.correct_count}/${evaluation.total_questions} câu</span>
    </div>
    <p class="text-slate-300 font-medium">${escapeHtml(evaluation.summary_comment)}</p>
  `;
  quizScoreBannerEl.innerHTML = DOMPurify.sanitize(summaryHtml);

  // Duyệt qua từng câu hỏi để hiển thị nhãn Đúng/Sai và nhận xét chi tiết
  evaluation.details.forEach(item => {
    const cardEl = document.getElementById(`quiz-card-${item.id}`);
    const feedbackEl = document.getElementById(`feedback-${item.id}`);
    if (!feedbackEl || !cardEl) return;

    cardEl.querySelectorAll('.quiz-option-label').forEach(l => l.classList.remove('correct', 'wrong'));
    feedbackEl.classList.remove("hidden");

    if (item.is_correct) {
      feedbackEl.className = "p-2.5 rounded-lg text-xs leading-relaxed bg-emerald-950/40 border border-emerald-600/50 text-emerald-300 mt-2";
      const goodHtml = `<strong>✔ Lời khen:</strong> ${escapeHtml(item.feedback)}`;
      feedbackEl.innerHTML = DOMPurify.sanitize(goodHtml);
      // Highlight nhãn đã chọn là màu xanh
      const selectedLabel = cardEl.querySelector(`.quiz-option-label[data-key="${item.student_choice}"]`);
      if (selectedLabel) selectedLabel.classList.add("correct");
    } else {
      feedbackEl.className = "p-2.5 rounded-lg text-xs leading-relaxed bg-rose-950/40 border border-rose-600/50 text-rose-300 mt-2";
      const wrongHtml = `
        <div class="space-y-1">
          <p><strong>❌ Chưa chính xác!</strong></p>
          <p>${escapeHtml(item.feedback)}</p>
          ${item.muc_sgk ? `<p class="text-[11px] text-amber-300 italic">👉 Đọc lại: ${escapeHtml(item.muc_sgk)}</p>` : ""}
        </div>
      `;
      feedbackEl.innerHTML = DOMPurify.sanitize(wrongHtml);
      // Highlight nhãn đã chọn là màu đỏ
      const selectedLabel = cardEl.querySelector(`.quiz-option-label[data-key="${item.student_choice}"]`);
      if (selectedLabel) selectedLabel.classList.add("wrong");
    }
  });
}

// Gửi tin nhắn chat đến Gia sư Socrates
async function sendChatMessage() {
  const text = chatInputEl.value.trim();
  if (!text) return;

  // Append tin nhắn của học sinh
  appendMessage("user", text);
  chatInputEl.value = "";
  chatInputEl.focus();

  // Hiển thị indicator đang suy nghĩ
  const loadingId = appendMessage("tutor", "Thầy đang đọc bài và suy nghĩ hướng dẫn cho em nhé...");

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grade: state.grade,
        lesson_id: state.lessonId,
        message: text,
        history: state.chatHistory
      })
    });

    const result = await res.json();
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    if (result.success) {
      appendMessage("tutor", result.reply);
      state.chatHistory.push({ role: "user", content: text });
      state.chatHistory.push({ role: "assistant", content: result.reply });
    } else {
      appendMessage("tutor", "Thầy gặp trục trặc khi kết nối, em hỏi lại nhé!");
    }
  } catch (err) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    appendMessage("tutor", "⚠️ Không thể kết nối với hệ thống Backend.");
  }
}

// Append tin nhắn vào giao diện an toàn
function appendMessage(sender, text) {
  const msgId = "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
  const isUser = (sender === "user");

  const msgDiv = document.createElement("div");
  msgDiv.id = msgId;
  msgDiv.className = isUser 
    ? "bg-sky-600/30 border border-sky-500/40 rounded-xl p-3 text-slate-200 ml-4"
    : "bg-slate-700/40 border border-slate-600/50 rounded-xl p-3 text-slate-300 mr-2";

  const msgContentHtml = `
    <div class="font-bold text-[11px] mb-1 flex items-center gap-1.5 ${isUser ? 'text-sky-300 justify-end' : 'text-emerald-400'}">
      <span>${isUser ? 'Học sinh' : 'Gia sư Socrates'}</span>
    </div>
    <div class="whitespace-pre-line">${escapeHtml(text)}</div>
  `;
  msgDiv.innerHTML = DOMPurify.sanitize(msgContentHtml);

  chatMessagesEl.appendChild(msgDiv);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  return msgId;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
