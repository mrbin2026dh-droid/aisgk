/**
 * Frontend Application: AI SGK Tin học THCS
 * Tuân thủ chuẩn Alibaba Open-Code-Review (Zero XSS) và Educational Light Theme
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
    const errorHtml = '<div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">⚠️ Không thể kết nối với Backend API. Vui lòng đảm bảo server đang chạy tại <code>127.0.0.1:8000</code>.</div>';
    lessonContentEl.innerHTML = DOMPurify.sanitize(errorHtml);
  }
}

// Render các câu hỏi trắc nghiệm (Chuẩn Educational Light Theme)
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
      <div class="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3" id="quiz-card-${q.id}">
        <div class="flex items-start gap-2.5">
          <span class="w-6 h-6 rounded-md bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
            ${idx + 1}
          </span>
          <p class="font-bold text-slate-800 text-xs leading-relaxed">${escapeHtml(q.cau_hoi)}</p>
        </div>

        <div class="space-y-2 pt-1">
          ${Object.entries(q.lua_chon).map(([optKey, optText]) => `
            <div class="quiz-option-label" data-qid="${q.id}" data-key="${optKey}">
              <span class="w-6 h-6 rounded-md bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                ${optKey}
              </span>
              <span class="text-xs text-slate-700 font-medium">${escapeHtml(optText)}</span>
            </div>
          `).join("")}
        </div>

        <!-- Vùng hiển thị nhận xét sư phạm sau khi chấm -->
        <div id="feedback-${q.id}" class="hidden p-3 rounded-xl text-xs leading-relaxed"></div>
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
  btnSubmitQuizEl.addEventListener("click", submitQuiz);

  chatFormEl.addEventListener("submit", (e) => {
    e.preventDefault();
    sendChatMessage();
  });

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

// Hiển thị kết quả chấm điểm & nhận xét sư phạm (Chuẩn Giáo Dục Ánh Sáng)
function displayQuizEvaluation(evaluation) {
  quizScoreBannerEl.classList.remove("hidden");
  quizScoreBannerEl.className = "mb-3 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs shadow-xs space-y-1.5";

  const summaryHtml = `
    <div class="flex items-center justify-between border-b border-blue-200/80 pb-2 mb-1.5">
      <span class="font-extrabold text-blue-700 text-sm">Điểm số: ${evaluation.score}/10</span>
      <span class="text-slate-600 font-semibold">Đúng ${evaluation.correct_count}/${evaluation.total_questions} câu</span>
    </div>
    <p class="text-slate-700 font-medium leading-relaxed">${escapeHtml(evaluation.summary_comment)}</p>
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
      // Màu xanh ngọc lục bảo khen ngợi
      feedbackEl.className = "p-3 rounded-xl text-xs leading-relaxed bg-emerald-50 border border-emerald-200 text-emerald-900 mt-2.5 space-y-1";
      const goodHtml = `<p class="font-bold text-emerald-700 flex items-center gap-1.5"><i class="fa-solid fa-circle-check text-emerald-600"></i> Rất tốt!</p><p class="text-slate-700">${escapeHtml(item.feedback)}</p>`;
      feedbackEl.innerHTML = DOMPurify.sanitize(goodHtml);
      const selectedLabel = cardEl.querySelector(`.quiz-option-label[data-key="${item.student_choice}"]`);
      if (selectedLabel) selectedLabel.classList.add("correct");
    } else {
      // Màu cam ấm hổ phách chữa bài (Triệt tiêu màu đỏ trừng phạt)
      feedbackEl.className = "p-3 rounded-xl text-xs leading-relaxed bg-amber-50 border border-amber-200 text-amber-950 mt-2.5 space-y-1.5";
      const wrongHtml = `
        <div class="space-y-1">
          <p class="font-bold text-amber-800 flex items-center gap-1.5"><i class="fa-solid fa-circle-question text-amber-600"></i> Chưa chính xác rồi em! Hãy cùng suy nghĩ thêm:</p>
          <p class="text-slate-700">${escapeHtml(item.feedback)}</p>
          ${item.muc_sgk ? `<p class="text-[11px] text-amber-800 font-bold mt-1">👉 Xem lại: ${escapeHtml(item.muc_sgk)}</p>` : ""}
        </div>
      `;
      feedbackEl.innerHTML = DOMPurify.sanitize(wrongHtml);
      const selectedLabel = cardEl.querySelector(`.quiz-option-label[data-key="${item.student_choice}"]`);
      if (selectedLabel) selectedLabel.classList.add("wrong");
    }
  });
}

// Gửi tin nhắn chat đến Gia sư Socrates
async function sendChatMessage() {
  const text = chatInputEl.value.trim();
  if (!text) return;

  appendMessage("user", text);
  chatInputEl.value = "";
  chatInputEl.focus();

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

// Append tin nhắn vào giao diện (Chuẩn Giáo Dục Ánh Sáng)
function appendMessage(sender, text) {
  const msgId = "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
  const isUser = (sender === "user");

  const msgDiv = document.createElement("div");
  msgDiv.id = msgId;
  msgDiv.className = isUser 
    ? "bg-blue-600 text-white rounded-2xl p-3 text-xs ml-4 shadow-xs"
    : "bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl p-3 text-xs mr-2 shadow-xs";

  const msgContentHtml = `
    <div class="font-bold text-[11px] mb-1 flex items-center gap-1.5 ${isUser ? 'text-blue-100 justify-end' : 'text-blue-700'}">
      <span>${isUser ? 'Em' : 'Thầy Socrates'}</span>
    </div>
    <div class="whitespace-pre-line leading-relaxed">${escapeHtml(text)}</div>
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
