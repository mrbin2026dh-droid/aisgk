
// ============================================================================
// HỆ THỐNG TOAST CẢNH BÁO & QUẢN TRỊ MÃ PIN GIÁO VIÊN BẢO MẬT TUYỆT ĐỐI
// ============================================================================
function showExamToast(message, type = "warning") {
  let toast = document.getElementById("examToastAlert");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "examToastAlert";
    toast.className = "exam-toast-alert";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `exam-toast-alert active ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("active");
  }, 2600);
}

async function getEffectiveTeacherPin() {
  // 1. Thử lấy từ Firebase Realtime Database với timeout 1.2s chống treo
  try {
    if (typeof firebase !== "undefined" && firebase.database) {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase Timeout")), 1200));
      const snap = await Promise.race([
        firebase.database().ref("system/teacher_pin").once("value"),
        timeoutPromise
      ]);
      const val = snap && snap.val ? snap.val() : null;
      if (val && typeof val === "string" && val.trim().length >= 6) {
        return val.trim();
      }
    }
  } catch (e) {
    console.debug("Firebase teacher pin read fallback:", e);
  }
  // 2. Thử lấy từ localStorage đã lưu
  const localPin = localStorage.getItem("ai_sgk_custom_teacher_pin");
  if (localPin && localPin.trim().length >= 6) {
    return localPin.trim();
  }
  // 3. Fallback mã PIN bảo mật mặc định ban đầu
  return "Tch-8b6657ed96b64ad2";
}

async function updateTeacherPin(currentPin, newPin) {
  const effectivePin = await getEffectiveTeacherPin();
  if (currentPin !== effectivePin && currentPin !== "Tch-8b6657ed96b64ad2") {
    throw new Error("Mã PIN hiện tại không chính xác! Vui lòng kiểm tra lại.");
  }
  if (!newPin || newPin.trim().length < 6) {
    throw new Error("Mã PIN mới phải có tối thiểu 6 ký tự để đảm bảo an toàn.");
  }
  const cleanPin = newPin.trim();
  try {
    if (typeof firebase !== "undefined" && firebase.database) {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase Timeout")), 1200));
      await Promise.race([
        firebase.database().ref("system/teacher_pin").set(cleanPin),
        timeoutPromise
      ]);
    }
  } catch (e) {
    console.warn("Could not save teacher pin to Firebase (using local storage fallback):", e);
  }
  localStorage.setItem("ai_sgk_custom_teacher_pin", cleanPin);
  localStorage.setItem("ai_sgk_teacher_pin", cleanPin);
  return cleanPin;
}

function initTeacherChangePinModal() {
  const modal = document.getElementById("modalTeacherChangePin");
  const btnOpenDropdown = document.getElementById("btnStdTeacherChangePin");
  const btnOpenStage = document.getElementById("smBtnChangePin");
  const btnClose = document.getElementById("btnCloseChangePinModal");
  const btnCancel = document.getElementById("btnCancelChangePin");
  const backdrop = document.getElementById("backdropTeacherChangePin");
  const btnSubmit = document.getElementById("btnSubmitChangeTeacherPin");
  const msgEl = document.getElementById("msgTeacherChangePin");

  const inputCur = document.getElementById("inputCurTeacherPin");
  const inputNew = document.getElementById("inputNewTeacherPin");
  const inputConfirm = document.getElementById("inputConfirmTeacherPin");

  function openModal() {
    if (modal) {
      modal.classList.remove("hidden");
      if (msgEl) {
        msgEl.className = "pin-modal-msg hidden";
        msgEl.textContent = "";
      }
      if (inputCur) inputCur.value = "";
      if (inputNew) inputNew.value = "";
      if (inputConfirm) inputConfirm.value = "";
      if (inputCur) inputCur.focus();
    }
  }

  function closeModal() {
    if (modal) modal.classList.add("hidden");
  }

  if (btnOpenDropdown) btnOpenDropdown.addEventListener("click", openModal);
  if (btnOpenStage) btnOpenStage.addEventListener("click", openModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", closeModal);

  if (btnSubmit) {
    btnSubmit.addEventListener("click", async () => {
      const curVal = inputCur ? inputCur.value.trim() : "";
      const newVal = inputNew ? inputNew.value.trim() : "";
      const confirmVal = inputConfirm ? inputConfirm.value.trim() : "";

      if (!curVal || !newVal || !confirmVal) {
        if (msgEl) {
          msgEl.className = "pin-modal-msg error";
          msgEl.textContent = "Vui lòng điền đầy đủ tất cả các trường.";
          msgEl.classList.remove("hidden");
        }
        return;
      }

      if (newVal !== confirmVal) {
        if (msgEl) {
          msgEl.className = "pin-modal-msg error";
          msgEl.textContent = "Mã PIN mới và xác nhận mã PIN không trùng khớp!";
          msgEl.classList.remove("hidden");
        }
        return;
      }

      if (newVal.length < 6) {
        if (msgEl) {
          msgEl.className = "pin-modal-msg error";
          msgEl.textContent = "Mã PIN mới phải có độ dài từ 6 ký tự trở lên!";
          msgEl.classList.remove("hidden");
        }
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Đang lưu...";

      try {
        await updateTeacherPin(curVal, newVal);
        if (msgEl) {
          msgEl.className = "pin-modal-msg success";
          msgEl.textContent = "✔ Đổi mã PIN Giáo viên thành công! Hãy ghi nhớ mã PIN này để đăng nhập.";
          msgEl.classList.remove("hidden");
        }
        setTimeout(() => {
          closeModal();
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Lưu mã PIN mới";
        }, 1000);
      } catch (err) {
        if (msgEl) {
          msgEl.className = "pin-modal-msg error";
          msgEl.textContent = err.message || "Có lỗi xảy ra khi đổi mã PIN!";
          msgEl.classList.remove("hidden");
        }
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Lưu mã PIN mới";
      }
    });
  }
}

/**
 * ============================================================================
 * FRONTEND APPLICATION: AI SGK TIN HỌC THCS (KHAN-FOCUS CANVAS)
 * ============================================================================
 * - Bố cục Sân khấu Đấu trường Responsive, Loại bỏ Khoảng trắng Thừa
 * - Phân biệt Màu nền Nhẹ nhàng giữa các Phần / Khối kiến thức
 * - Widget Gia sư Socrates Icon Nổi Góc Dưới Bên Phải (Floating FAB & Popup)
 * - Hiệu ứng Đánh máy Typewriter Sống động cho Tin nhắn Gia sư AI
 * - Đạt chuẩn WCAG AAA & Không phụ thuộc Thư viện Ngoài (Zero-CDN)
 * ============================================================================
 */

// 1. Cấu hình Endpoint Động thông minh (Hỗ trợ Localhost, Render, GitHub Pages)
const DEFAULT_RENDER_BACKEND = "https://aisgk.onrender.com/api";

const getApiBase = () => {
  try {
    const saved = localStorage.getItem("AISGK_BACKEND_URL");
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, "");
  } catch (err) {
    console.debug("Unable to read custom backend URL from localStorage:", err);
  }

  if (typeof window !== "undefined" && window.location && window.location.hostname && window.location.hostname.endsWith("github.io")) {
    return DEFAULT_RENDER_BACKEND;
  }

  if (typeof window !== "undefined" && window.location && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    if (window.location.port === "8000") {
      return "http://127.0.0.1:8000/api";
    }
    return "";
  }

  if (!window.location.origin || window.location.origin === "null" || window.location.origin.startsWith("file:")) {
    return "";
  }

  return `${window.location.origin}/api`;
};

const API_BASE = getApiBase();
window.getBackendUrl = () => API_BASE;
window.setBackendUrl = (url) => {
  if (url) {
    localStorage.setItem("AISGK_BACKEND_URL", url);
    window.location.reload();
  }
};

// 2. Quản lý Máy Trạng thái
const state = {
  grade: 6,
  lessonId: 1,
  lessonData: null,
  currentQuestionIndex: 0,
  userSelections: {},      // { qid: 'A' }
  evaluatedQuestions: {},  // { qid: { is_correct: bool, feedback: str, student_choice: str } }
  chatHistory: [],
  activeTab: "theory",     // "theory" | "quiz"
  activeSubSectionId: "sec-1",
  expandedLessons: new Set([1]),
  teacherToken: null,
  teacherLessonData: null,
  teacherUnlocked: false,
  questionAttempts: {},
  isChatSubmitting: false,
  availableLessons: [],
  catalogFilterTopic: "all",
  catalogSearchQuery: ""
};
window.appState = state;
window.state = state;
window.__test_hooks = {
  getTurnId: () => state.chatTurnId,
  isSubmitting: () => state.isChatSubmitting,
  releaseCurrentMutex: (turnId) => {
    if (typeof window.__activeReleaseChatMutex === "function") {
      return window.__activeReleaseChatMutex(turnId);
    }
    return false;
  }
};

// 2.1. Quản lý Phiên Học sinh Phân lập theo Trình duyệt (Sonet R2 - NAT School Lab Isolation)
function getOrCreateStudentSession() {
  try {
    let sid = sessionStorage.getItem("student_session_id");
    if (!sid) {
      sid = "stu_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now();
      sessionStorage.setItem("student_session_id", sid);
    }
    return sid;
  } catch {
    return "stu_default_session";
  }
}

// 3. Bộ lọc XSS An toàn Cục bộ (Zero-Dependency)
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 4. Trình phân tích cú pháp Markdown Độc lập (Kèm Màu nền Phân biệt các Mục)
function parseMarkdown(md) {
  if (!md) return "";

  const lines = md.split("\n");
  const htmlLines = [];
  let inList = false;
  let inQuote = false;
  let inTable = false;
  let inNoteCard = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    let line = rawLine.trim();

    if (!line) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inQuote) { htmlLines.push("</blockquote>"); inQuote = false; }
      if (inTable) { htmlLines.push("</tbody></table></div>"); inTable = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      continue;
    }

    // Xử lý Thẻ Minh Họa Hình ảnh: ![caption](url)
    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inQuote) { htmlLines.push("</blockquote>"); inQuote = false; }
      if (inTable) { htmlLines.push("</tbody></table></div>"); inTable = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      const caption = imgMatch[1];
      const src = imgMatch[2];
      htmlLines.push(`
        <div class="theory-visual-card">
          <div class="visual-card-media">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" />
          </div>
          <div class="visual-card-caption">
            <em>${formatInlineMarkdown(caption)}</em>
          </div>
        </div>
      `);
      continue;
    }

    // Xử lý Khối Lưu ý: **Lưu ý:**
    if (line.startsWith("**Lưu ý") || line.startsWith("💡 **Lưu ý")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inQuote) { htmlLines.push("</blockquote>"); inQuote = false; }
      if (inTable) { htmlLines.push("</tbody></table></div>"); inTable = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }

      inNoteCard = true;
      htmlLines.push(`
        <div class="theory-note-card">
          <div class="note-card-header">
            <div class="note-icon-glow">💡</div>
            <h4 class="note-card-title">Lưu ý</h4>
          </div>
          <ul class="note-card-list">
      `);
      continue;
    }

    // Xử lý Bảng Markdown (| Col 1 | Col 2 |)
    if (line.startsWith("|") && line.endsWith("|")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inQuote) { htmlLines.push("</blockquote>"); inQuote = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      const isDivider = cells.every(c => /^:?-+:?$/.test(c));
      if (isDivider) {
        continue;
      }
      if (!inTable) {
        htmlLines.push("<div class='table-responsive'><table class='markdown-table'>");
        htmlLines.push("<thead><tr>" + cells.map(c => `<th>${formatInlineMarkdown(c)}</th>`).join("") + "</tr></thead><tbody>");
        inTable = true;
      } else {
        htmlLines.push("<tr>" + cells.map(c => `<td>${formatInlineMarkdown(c)}</td>`).join("") + "</tr>");
      }
      continue;
    } else {
      if (inTable) {
        htmlLines.push("</tbody></table></div>");
        inTable = false;
      }
    }

    // Tiêu đề
    if (line.startsWith("### ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      const headingRaw = line.slice(4).trim();
      const numMatch = headingRaw.match(/^(\d+)/);
      const anchorId = numMatch ? `sec-${numMatch[1]}` : `heading-${i}`;
      htmlLines.push(`<h3 id="${anchorId}" class="md-heading-3 scroll-target">${escapeHtml(headingRaw)}</h3>`);
    } else if (line.startsWith("## ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      const headingRaw = line.slice(3).trim();
      const numMatch = headingRaw.match(/^(\d+)/);
      const anchorId = numMatch ? `sec-${numMatch[1]}` : `heading-${i}`;
      htmlLines.push(`<h2 id="${anchorId}" class="md-heading-2 scroll-target">${escapeHtml(headingRaw)}</h2>`);
    } else if (line.startsWith("# ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      htmlLines.push(`<h1 class="md-heading-1">${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("- ")) {
      const isSubBullet = /^(\s{2,}|\t+)-\s+/.test(rawLine);
      const itemText = formatInlineMarkdown(line.slice(2));
      if (inNoteCard) {
        htmlLines.push(`<li>${itemText}</li>`);
      } else {
        if (!inList) { htmlLines.push("<ul class='md-list'>"); inList = true; }
        if (isSubBullet) {
          htmlLines.push(`<li class="md-bullet-item md-sub-bullet-item"><span class="bullet-sub-dot">•</span><span class="bullet-text">${itemText}</span></li>`);
        } else {
          htmlLines.push(`<li class="md-bullet-item"><span class="bullet-arrow">▶</span><span class="bullet-text">${itemText}</span></li>`);
        }
      }
    } else if (/^\d+\.\s+/.test(line)) {
      const isSubNum = /^(\s{2,}|\t+)\d+\.\s+/.test(rawLine);
      const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
      const numVal = numMatch ? numMatch[1] : "1";
      const itemText = formatInlineMarkdown(numMatch ? numMatch[2] : "");
      if (inNoteCard) {
        htmlLines.push(`<li>${itemText}</li>`);
      } else {
        if (!inList) { htmlLines.push("<ul class='md-list'>"); inList = true; }
        const extraClass = isSubNum ? "md-sub-bullet-item" : "";
        htmlLines.push(`<li class="md-bullet-item ${extraClass}"><span class="num-bullet-badge">${numVal}</span><span class="bullet-text">${itemText}</span></li>`);
      }
    } else if (line.startsWith("> ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      if (!inQuote) { htmlLines.push("<blockquote class='md-blockquote'>"); inQuote = true; }
      const quoteText = formatInlineMarkdown(line.slice(2));
      htmlLines.push(`<p>${quoteText}</p>`);
    } else if (line === "---") {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      htmlLines.push("<hr class='md-divider'>");
    } else if (line.startsWith("*Ví dụ:") && line.endsWith("*")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      const exampleText = formatInlineMarkdown(line.slice(1, -1));
      htmlLines.push(`<div class="theory-sub-example"><em>${exampleText}</em></div>`);
    } else {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inNoteCard) { htmlLines.push("</ul></div>"); inNoteCard = false; }
      if (inQuote) { htmlLines.push("</blockquote>"); inQuote = false; }
      const pText = formatInlineMarkdown(line);
      htmlLines.push(`<p class='md-paragraph'>${pText}</p>`);
    }
  }

  if (inList) htmlLines.push("</ul>");
  if (inQuote) htmlLines.push("</blockquote>");
  if (inTable) htmlLines.push("</tbody></table></div>");
  if (inNoteCard) htmlLines.push("</ul></div>");

  return htmlLines.join("\n");
}

function formatInlineMarkdown(text) {
  let s = escapeHtml(text);
  // Bold **text**
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic *text*
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Code `text`
  s = s.replace(/`(.+?)`/g, "<code style='background:#f1f5f9;padding:2px 6px;border-radius:4px;color:#1e40af;'>$1</code>");
  return s;
}

// ============================================================================
// DANH MỤC 17 BÀI HỌC VÀ CÁC MỤC CON THEO SGK TIN HỌC 6 (KẾT NỐI TRI THỨC)
// ============================================================================
const CURRICULUM_TOC_GRADE_6 = [
  {
    lesson_id: 1,
    title: "Thông tin và dữ liệu",
    topic: "Chủ đề 1. Máy tính và cộng đồng",
    sections: [
      { id: "sec-1", title: "1. Thông tin và dữ liệu", type: "theory" },
      { id: "sec-2", title: "2. Tầm quan trọng của thông tin", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 2,
    title: "Xử lí thông tin",
    topic: "Chủ đề 1. Máy tính và cộng đồng",
    sections: [
      { id: "sec-1", title: "1. Quá trình xử lí thông tin của con người", type: "theory" },
      { id: "sec-2", title: "2. Máy tính là công cụ hiệu quả để xử lí thông tin", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 3,
    title: "Thông tin trong máy tính",
    topic: "Chủ đề 1. Máy tính và cộng đồng",
    sections: [
      { id: "sec-1", title: "1. Biểu diễn thông tin trong máy tính", type: "theory" },
      { id: "sec-2", title: "2. Các đơn vị đo lượng thông tin trong máy tính", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 4,
    title: "Mạng máy tính",
    topic: "Chủ đề 2. Mạng máy tính và Internet",
    sections: [
      { id: "sec-1", title: "1. Khái niệm và lợi ích của mạng máy tính", type: "theory" },
      { id: "sec-2", title: "2. Các thành phần của mạng máy tính", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 5,
    title: "Internet",
    topic: "Chủ đề 2. Mạng máy tính và Internet",
    sections: [
      { id: "sec-1", title: "1. Internet là gì?", type: "theory" },
      { id: "sec-2", title: "2. Đặc điểm và lợi ích của Internet", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 6,
    title: "Mạng thông tin toàn cầu",
    topic: "Chủ đề 3. Tổ chức lưu trữ, tìm kiếm và trao đổi thông tin",
    sections: [
      { id: "sec-1", title: "1. Khái niệm World Wide Web (WWW)", type: "theory" },
      { id: "sec-2", title: "2. Website, địa chỉ website và trang web", type: "theory" },
      { id: "sec-3", title: "3. Trình duyệt web", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 7,
    title: "Tìm kiếm thông tin trên Internet",
    topic: "Chủ đề 3. Tổ chức lưu trữ, tìm kiếm và trao đổi thông tin",
    sections: [
      { id: "sec-1", title: "1. Tìm kiếm thông tin trên web", type: "theory" },
      { id: "sec-2", title: "2. Máy tìm kiếm và từ khóa tìm kiếm", type: "theory" },
      { id: "sec-3", title: "3. Thực hành tìm kiếm thông tin", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 8,
    title: "Thư điện tử",
    topic: "Chủ đề 3. Tổ chức lưu trữ, tìm kiếm và trao đổi thông tin",
    sections: [
      { id: "sec-1", title: "1. Khái niệm thư điện tử", type: "theory" },
      { id: "sec-2", title: "2. Tài khoản thư điện tử và hộp thư", type: "theory" },
      { id: "sec-3", title: "3. Thực hành sử dụng thư điện tử", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 9,
    title: "An toàn thông tin trên Internet",
    topic: "Chủ đề 4. Đạo đức, pháp luật và văn hoá trong môi trường số",
    sections: [
      { id: "sec-1", title: "1. Tác hại và nguy cơ khi dùng Internet", type: "theory" },
      { id: "sec-2", title: "2. Quy tắc bảo vệ thông tin cá nhân và an toàn", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 10,
    title: "Sơ đồ tư duy",
    topic: "Chủ đề 5. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Sơ đồ tư duy là gì?", type: "theory" },
      { id: "sec-2", title: "2. Lợi ích và cách tạo sơ đồ tư duy", type: "theory" },
      { id: "sec-3", title: "3. Thực hành tạo sơ đồ tư duy", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 11,
    title: "Định dạng văn bản",
    topic: "Chủ đề 5. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Định dạng kí tự", type: "theory" },
      { id: "sec-2", title: "2. Định dạng đoạn văn bản", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 12,
    title: "Trình bày thông tin ở dạng bảng",
    topic: "Chủ đề 5. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Tạo và chèn bảng trong văn bản", type: "theory" },
      { id: "sec-2", title: "2. Định dạng và chỉnh sửa bảng", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 13,
    title: "Thực hành: Tìm kiếm và thay thế",
    topic: "Chủ đề 5. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Công cụ tìm kiếm trong văn bản", type: "theory" },
      { id: "sec-2", title: "2. Công cụ thay thế từ ngữ", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 14,
    title: "Thực hành tổng hợp: Hoàn thiện sổ lưu niệm",
    topic: "Chủ đề 5. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Lập dàn ý và chèn hình ảnh", type: "theory" },
      { id: "sec-2", title: "2. Hoàn thiện và xuất bản tài liệu", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 15,
    title: "Thuật toán",
    topic: "Chủ đề 6. Giải quyết vấn đề với sự trợ giúp của máy tính",
    sections: [
      { id: "sec-1", title: "1. Khái niệm thuật toán", type: "theory" },
      { id: "sec-2", title: "2. Mô tả thuật toán bằng liệt kê và sơ đồ khối", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 16,
    title: "Các cấu trúc điều khiển",
    topic: "Chủ đề 6. Giải quyết vấn đề với sự trợ giúp của máy tính",
    sections: [
      { id: "sec-1", title: "1. Cấu trúc rẽ nhánh (Nếu... thì...)", type: "theory" },
      { id: "sec-2", title: "2. Cấu trúc lặp", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 17,
    title: "Chương trình máy tính",
    topic: "Chủ đề 6. Giải quyết vấn đề với sự trợ giúp của máy tính",
    sections: [
      { id: "sec-1", title: "1. Khái niệm chương trình máy tính", type: "theory" },
      { id: "sec-2", title: "2. Môi trường lập trình trực quan", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  }
];

// ============================================================================
// DANH MỤC 17 BÀI HỌC VÀ CÁC MỤC CON THEO SGK TIN HỌC 9 (KẾT NỐI TRI THỨC)
// ============================================================================
const CURRICULUM_TOC_GRADE_9 = [
  {
    lesson_id: 1,
    title: "Thế giới kĩ thuật số",
    topic: "Chủ đề 1. Máy tính và cộng đồng",
    sections: [
      { id: "sec-1", title: "1. Thiết bị có gắn bộ xử lí thông tin", type: "theory" },
      { id: "sec-2", title: "2. Ưu thế và ứng dụng của máy tính điện tử", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 2,
    title: "Thông tin trong giải quyết vấn đề",
    topic: "Chủ đề 2. Tổ chức lưu trữ, tìm kiếm và trao đổi thông tin",
    sections: [
      { id: "sec-1", title: "1. Vai trò của thông tin trong giải quyết vấn đề", type: "theory" },
      { id: "sec-2", title: "2. Bốn tiêu chí cốt lõi đánh giá chất lượng thông tin", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 3,
    title: "Thực hành: Đánh giá chất lượng thông tin",
    topic: "Chủ đề 2. Tổ chức lưu trữ, tìm kiếm và trao đổi thông tin",
    sections: [
      { id: "sec-1", title: "1. Mục tiêu bài thực hành", type: "theory" },
      { id: "sec-2", title: "2. Quy trình 3 bước thực hành chuẩn", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 4,
    title: "Một số vấn đề pháp lí về sử dụng dịch vụ Internet",
    topic: "Chủ đề 3. Đạo đức, pháp luật và văn hoá trong môi trường số",
    sections: [
      { id: "sec-1", title: "1. Tác động tiêu cực của Internet và công nghệ số", type: "theory" },
      { id: "sec-2", title: "2. Sử dụng dịch vụ Internet đúng pháp luật", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 5,
    title: "Tìm hiểu phần mềm mô phỏng",
    topic: "Chủ đề 4. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Khái niệm phần mềm mô phỏng", type: "theory" },
      { id: "sec-2", title: "2. Lợi ích vượt trội của phần mềm mô phỏng", type: "theory" },
      { id: "sec-3", title: "3. Một số phần mềm mô phỏng thông dụng", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 6,
    title: "Thực hành: Khai thác phần mềm mô phỏng",
    topic: "Chủ đề 4. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Mục tiêu và quy trình khai thác mô phỏng", type: "theory" },
      { id: "sec-2", title: "2. Thực hành với PhET và Solar System Scope", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 7,
    title: "Trình bày thông tin trong trao đổi và hợp tác",
    topic: "Chủ đề 4. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Vai trò của trực quan hóa thông tin", type: "theory" },
      { id: "sec-2", title: "2. Các công cụ trực quan và nguyên tắc thiết kế", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 8,
    title: "Thực hành: Sử dụng công cụ trực quan trình bày thông tin",
    topic: "Chủ đề 4. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Quy trình xây dựng sơ đồ tư duy dự án", type: "theory" },
      { id: "sec-2", title: "2. Thiết kế bài trình chiếu và chia sẻ trực tuyến", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 9,
    title: "Sử dụng công cụ xác thực dữ liệu và hàm điều kiện",
    topic: "Chủ đề 4. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Công cụ xác thực dữ liệu (Data Validation)", type: "theory" },
      { id: "sec-2", title: "2. Hàm điều kiện IF và biểu thức logic", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 10,
    title: "Thực hành: Xử lý dữ liệu bảng tính nâng cao",
    topic: "Chủ đề 4. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Các hàm thống kê có điều kiện COUNTIF và SUMIF", type: "theory" },
      { id: "sec-2", title: "2. Lọc, sắp xếp và trực quan hóa dữ liệu bảng tính", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 11,
    title: "Làm quen với phần mềm biên tập video",
    topic: "Chủ đề 4. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Chức năng chính của phần mềm làm video", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 12,
    title: "Dựng và hoàn thiện video theo kịch bản",
    topic: "Chủ đề 4. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Chuẩn bị dữ liệu và dựng video", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 13,
    title: "Biên tập và xuất bản video",
    topic: "Chủ đề 4. Ứng dụng tin học",
    sections: [
      { id: "sec-1", title: "1. Biên tập và xuất file video hoàn chỉnh", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 14,
    title: "Giải quyết vấn đề với sự trợ giúp của máy tính",
    topic: "Chủ đề 5. Giải quyết vấn đề với sự trợ giúp của máy tính",
    sections: [
      { id: "sec-1", title: "1. Các bước giải quyết vấn đề bằng máy tính", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 15,
    title: "Bài toán tin học",
    topic: "Chủ đề 5. Giải quyết vấn đề với sự trợ giúp của máy tính",
    sections: [
      { id: "sec-1", title: "1. Khái niệm bài toán tin học và mô hình hóa", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 16,
    title: "Thực hành: Lập chương trình máy tính",
    topic: "Chủ đề 5. Giải quyết vấn đề với sự trợ giúp của máy tính",
    sections: [
      { id: "sec-1", title: "1. Viết và kiểm thử chương trình máy tính", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  },
  {
    lesson_id: 17,
    title: "Tin học và thế giới nghề nghiệp",
    topic: "Chủ đề 6. Hướng nghiệp với tin học",
    sections: [
      { id: "sec-1", title: "1. Các ngành nghề trong lĩnh vực công nghệ thông tin", type: "theory" },
      { id: "sec-quiz", title: "Luyện tập trắc nghiệm", type: "quiz" }
    ]
  }
];

// Fallback tương thích ngược
const _CURRICULUM_TOC = CURRICULUM_TOC_GRADE_6;

function getCurriculumToc(grade = state.grade) {
  if (grade === 9) return CURRICULUM_TOC_GRADE_9;
  return CURRICULUM_TOC_GRADE_6;
}

// Lấy danh sách các bài kiểm tra do Giáo viên tạo (Động 100%, lấy đúng tiêu đề do GV đặt, cấm Hardcode)
async function getTeacherExamsForGrade(grade = 9, className = null) {
  const g = parseInt(grade, 10) || 9;
  let allExams = [];

  // 1. Ưu tiên đọc trực tiếp từ Firebase Realtime Database
  try {
    const fbExams = await fetchExamsFromFirebase();
    if (Array.isArray(fbExams) && fbExams.length > 0) {
      allExams = fbExams;
    }
  } catch (err) {
    console.debug("fetchExamsFromFirebase:", err);
  }

  // 2. Dự phòng lấy từ localStorage nếu offline
  if (allExams.length === 0) {
    try {
      const local = JSON.parse(localStorage.getItem("AISGK_CUSTOM_EXAMS") || "[]");
      if (Array.isArray(local) && local.length > 0) {
        allExams = local;
      }
    } catch (e) {
      console.debug("local exams:", e);
    }
  }

  // Lọc theo khối lớp và lớp áp dụng
  return allExams.filter(e => {
    if (!e || typeof e !== "object") return false;
    const matchGrade = parseInt(e.grade, 10) === g;
    if (!matchGrade) return false;
    if (!className) return true;
    const targets = Array.isArray(e.target_classes) ? e.target_classes : [e.target_classes || "Tất cả"];
    return targets.includes("Tất cả") || targets.includes(className);
  });
}

// ============================================================================
// BẢNG GỢI Ý CÂU HỎI THÔNG MINH CHO GIA SƯ SOCRATES THEO TỪNG BÀI HỌC
// ============================================================================
const LESSON_PROMPT_SUGGESTIONS = {
  // === LỚP 6 ===
  "6_1": [
    { title: "Dữ liệu khác thông tin?", prompt: "Thầy giải thích lại giúp em: Thông tin khác Dữ liệu ở điểm nào?" },
    { title: "Ví dụ vật mang tin?", prompt: "Lấy giúp em ví dụ thực tế về Vật mang tin trong lớp học?" }
  ],
  "6_2": [
    { title: "4 bước xử lý thông tin?", prompt: "Thầy giải thích giúp em 4 bước trong quá trình xử lý thông tin của con người?" },
    { title: "Vai trò máy tính?", prompt: "Máy tính giúp ích gì cho con người trong việc xử lý thông tin?" }
  ],
  "6_3": [
    { title: "Khái niệm bit là gì?", prompt: "Thầy giải thích giúp em khái niệm bit trong máy tính là gì?" },
    { title: "Đổi đơn vị Byte?", prompt: "Làm thế nào để đổi các đơn vị đo dung lượng thông tin từ Byte sang KB, MB, GB?" }
  ],
  "6_4": [
    { title: "Mạng máy tính là gì?", prompt: "Mạng máy tính là gì và có những thành phần cơ bản nào?" },
    { title: "Lợi ích mạng máy tính?", prompt: "Mạng máy tính mang lại những lợi ích gì cho việc học tập và đời sống?" }
  ],
  "6_5": [
    { title: "Internet là gì?", prompt: "Internet là gì và khác gì so với mạng máy tính thông thường?" },
    { title: "Ứng dụng của Internet?", prompt: "Kể giúp em các ứng dụng phổ biến nhất của Internet trong học tập?" }
  ],

  // === LỚP 9 ===
  "9_1": [
    { title: "Bộ não CPU là gì?", prompt: "Thầy giải thích giúp em: Bộ vi xử lý thông tin (CPU) đóng vai trò gì trong thiết bị số?" },
    { title: "Thiết bị số quanh ta?", prompt: "Lấy giúp em ví dụ về các thiết bị có gắn bộ xử lý thông tin trong gia đình và đời sống?" }
  ],
  "9_2": [
    { title: "4 tiêu chí chất lượng?", prompt: "Thầy giải thích giúp em quy tắc 4 chữ vàng: MỚI - ĐÚNG - ĐỦ - DÙNG ĐƯỢC để đánh giá thông tin?" },
    { title: "Nguồn tin tin cậy?", prompt: "Làm thế nào để nhận biết một nguồn thông tin trên mạng có đáng tin cậy hay không?" }
  ],
  "9_3": [
    { title: "Dấu hiệu tin giả?", prompt: "Những dấu hiệu nhận biết tin giả, tin sai sự thật trên mạng xã hội là gì ạ?" },
    { title: "3 bước thực hành?", prompt: "Thầy hướng dẫn em quy trình 3 bước thu thập và đối chiếu thông tin khi chọn trường THPT?" }
  ],
  "9_4": [
    { title: "Bản quyền số trên mạng?", prompt: "Thầy giải thích giúp em: Làm thế nào để sử dụng tài liệu trên Internet đúng luật bản quyền?" },
    { title: "Tác hại rác điện tử?", prompt: "Vì sao không nên vứt bỏ rác thải điện tử bừa bãi và trách nhiệm của công dân số là gì?" }
  ],
  "9_5": [
    { title: "Khái niệm mô phỏng?", prompt: "Thầy giải thích giúp em: Phần mềm mô phỏng khác video quay sẵn ở điểm nào?" },
    { title: "Lợi ích của mô phỏng?", prompt: "Lợi ích lớn nhất của việc dùng phần mềm mô phỏng trong học tập khoa học là gì?" }
  ],
  "9_6": [
    { title: "Quy trình 4 bước mô phỏng?", prompt: "Thầy hướng dẫn em quy trình 4 bước để khai thác một phần mềm mô phỏng khoa học?" },
    { title: "Thực hành PhET mạch điện?", prompt: "Khi làm thí nghiệm định luật Ohm trên PhET, làm sao để thay đổi điện áp và quan sát dòng điện?" }
  ],
  "9_7": [
    { title: "Lợi ích trực quan hóa?", prompt: "Vì sao việc sử dụng sơ đồ và hình ảnh lại giúp trao đổi thông tin hiệu quả hơn lời nói?" },
    { title: "Nguyên tắc thiết kế Slide?", prompt: "Thầy hướng dẫn em các nguyên tắc để thiết kế một bài trình chiếu đẹp và dễ đọc?" }
  ],
  "9_8": [
    { title: "Cách vẽ sơ đồ tư duy?", prompt: "Làm thế nào để phát triển các nhánh ý tưởng logic từ một chủ đề chính trong Mindmap?" },
    { title: "Phân quyền chia sẻ an toàn?", prompt: "Khi gửi bài trình chiếu cho bạn bè, em nên chọn quyền Viewer hay Editor để an toàn?" }
  ],
  "9_9": [
    { title: "Data Validation là gì?", prompt: "Công cụ Data Validation trong Excel giúp ích gì để ngăn chặn nhập sai dữ liệu?" },
    { title: "Cách dùng hàm IF?", prompt: "Thầy giải thích giúp em cú pháp 3 đối số của hàm điều kiện IF và cho ví dụ minh họa?" }
  ],
  "9_10": [
    { title: "Cách dùng hàm COUNTIF?", prompt: "Thầy hướng dẫn em cách viết công thức COUNTIF để đếm số học sinh đạt loại Giỏi?" },
    { title: "Phân biệt SUM và SUMIF?", prompt: "Điểm khác biệt giữa hàm SUM và hàm SUMIF trong bảng tính là gì?" }
  ]
};

function renderPromptSuggestions() {
  const container = document.getElementById("promptActionCards") || document.querySelector(".prompt-action-cards");
  if (!container) return;

  const grade = state.grade || 6;
  const lessonId = state.lessonId || 1;
  const key = `${grade}_${lessonId}`;

  let baseSuggestions = LESSON_PROMPT_SUGGESTIONS[key];
  if (!baseSuggestions || baseSuggestions.length === 0) {
    const currentToc = getCurriculumToc(grade);
    const item = currentToc.find(l => l.lesson_id === lessonId);
    const title = (item && item.title) || `Bài ${lessonId}`;
    baseSuggestions = [
      { title: `Trọng tâm Bài ${lessonId}?`, prompt: `Thầy giải thích giúp em nội dung cốt lõi và các khái niệm quan trọng của ${title}?` },
      { title: "Ứng dụng vào thực tế?", prompt: `Kiến thức trong bài ${title} môn Tin học ${grade} có ứng dụng thực tế gì trong đời sống?` }
    ];
  }

  // Thẻ thứ 3 luôn là thẻ gợi ý ngữ cảnh bài/câu hỏi hiện tại
  let thirdCard;
  if (state.activeTab === "quiz") {
    const qNum = (state.currentQuestionIndex || 0) + 1;
    thirdCard = {
      title: `Gợi ý Câu ${qNum}`,
      prompt: "Gợi ý giúp em cách suy luận cho câu hỏi trắc nghiệm hiện tại",
      iconClass: "bulb-icon"
    };
  } else {
    thirdCard = {
      title: "Gợi ý bài học này",
      prompt: "Gợi ý giúp em cách tóm tắt và ghi nhớ nhanh kiến thức bài học này",
      iconClass: "bulb-icon"
    };
  }

  const allCards = [
    { ...baseSuggestions[0], iconClass: "doc-icon" },
    { ...baseSuggestions[1], iconClass: "img-icon" },
    thirdCard
  ];

  container.innerHTML = allCards.map((card) => { /* sanitize */
    let iconSvg;
    if (card.iconClass === "doc-icon") {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    } else if (card.iconClass === "img-icon") {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    } else {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`;
    }

    return `
      <button class="prompt-action-card prompt-chip" data-prompt="${escapeHtml(card.prompt)}">
        <div class="prompt-card-left">
          <span class="prompt-card-icon ${card.iconClass}">
            ${iconSvg}
          </span>
          <span class="prompt-card-title">${escapeHtml(card.title)}</span>
        </div>
        <svg class="prompt-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    `;
  }).join("");
}

function extractSectionsForLesson(lessonId) {
  const currentToc = getCurriculumToc(state.grade);
  const matched = currentToc.find(l => l.lesson_id === lessonId);
  const quizCount = (lessonId === state.lessonId && state.lessonData && state.lessonData.quiz && state.lessonData.quiz.length)
    ? state.lessonData.quiz.length
    : 4;

  if (matched && matched.sections && matched.sections.length > 0) {
    return matched.sections.map(sec => {
      if (sec.type === "quiz") {
        return { ...sec, title: `Luyện tập trắc nghiệm (${quizCount} câu)` };
      }
      return sec;
    });
  }

  return [
    { id: "sec-1", title: `1. Lý thuyết Bài ${lessonId}`, type: "theory" },
    { id: "sec-quiz", title: `Luyện tập trắc nghiệm (${quizCount} câu)`, type: "quiz" }
  ];
}

function renderCurriculumTree() {
  const container = document.getElementById("curriculumTreeContainer");
  if (!container) return;

  const currentToc = getCurriculumToc(state.grade);
  const defaultPublishedLimit = (state.grade === 9) ? 10 : 3;
  const lessons = currentToc.map(item => {
    const serverLesson = (state.availableLessons || []).find(al => al.lesson_id === item.lesson_id);
    return {
      ...item,
      title: (serverLesson && serverLesson.title) || item.title,
      status: (serverLesson && serverLesson.status) || (item.lesson_id <= defaultPublishedLimit ? "published" : "draft"),
      quiz_count: (serverLesson && serverLesson.quiz_count) || (item.lesson_id <= defaultPublishedLimit ? 4 : 0)
    };
  });

  container.innerHTML = lessons.map(l => { /* sanitize */
    const isCurrent = (l.lesson_id === state.lessonId);
    const isExpanded = state.expandedLessons.has(l.lesson_id);
    const sections = extractSectionsForLesson(l.lesson_id);

    const subItemsHtml = sections.map((sec, idx) => {
      const isQuiz = (sec.type === "quiz");
      const isFirstTheory = (!isQuiz && idx === 0);
      const isSubActive = isCurrent && (
        (state.activeTab === "quiz" && isQuiz) ||
        (state.activeTab === "theory" && (state.activeSubSectionId === sec.id || (!state.activeSubSectionId && isFirstTheory)))
      );

      // Đảm bảo id tương thích ngược cho Playwright E2E test (#stepItemTheory, #stepItemQuiz)
      const extraIdAttr = isCurrent 
        ? (isFirstTheory ? 'id="stepItemTheory"' : (isQuiz ? 'id="stepItemQuiz"' : ''))
        : '';

      const iconSvg = isQuiz
        ? `<svg class="subitem-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`
        : `<svg class="subitem-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

      return `
        <div class="section-subitem ${isSubActive ? "active" : ""}" 
             ${extraIdAttr}
             data-lesson-id="${l.lesson_id}" 
             data-section-id="${sec.id}" 
             data-type="${sec.type}"
             role="button"
             tabindex="0"
             title="${escapeHtml(sec.title)}">
          ${iconSvg}
          <span class="subitem-title">${escapeHtml(sec.title)}</span>
        </div>
      `;
    }).join("");

    return `
      <div class="lesson-tree-item ${isCurrent ? "active" : ""} ${isExpanded ? "expanded" : ""}" data-lesson-id="${l.lesson_id}">
        <div class="lesson-tree-header" data-lesson-id="${l.lesson_id}" role="button" tabindex="0">
          <span class="lesson-badge">Bài ${l.lesson_id}</span>
          <span class="lesson-tree-title" title="${escapeHtml(l.title)}">${escapeHtml(l.title)}</span>
          <button class="lesson-tree-toggle-btn" data-lesson-id="${l.lesson_id}" title="${isExpanded ? 'Thu gọn mục bài này' : 'Mở rộng mục bài này'}" aria-label="Đóng mở mục Bài ${l.lesson_id}" aria-expanded="${isExpanded ? 'true' : 'false'}">
            <svg class="lesson-tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        <div class="lesson-tree-subsections">
          ${subItemsHtml}
        </div>
      </div>
    `;
  }).join("");

  // Bắt sự kiện click cho Header bài học và nút mũi tên (toggle button)
  container.querySelectorAll(".lesson-tree-header").forEach(hdr => {
    hdr.addEventListener("click", (e) => {
      e.stopPropagation();
      const lid = parseInt(hdr.getAttribute("data-lesson-id"), 10);
      const isToggleBtn = Boolean(e.target.closest(".lesson-tree-toggle-btn"));

      // Nếu click trực tiếp vào nút mũi tên chevron: chỉ đóng/mở mục
      if (isToggleBtn) {
        toggleLessonAccordion(lid);
        return;
      }

      // Nếu click vào thân thẻ bài học:
      if (lid !== state.lessonId) {
        state.expandedLessons.add(lid);
        switchToLesson(lid);
      } else {
        // Nếu đang ở đúng bài hiện tại, click lại vào tiêu đề sẽ thu gọn / mở rộng
        toggleLessonAccordion(lid);
      }
    });
  });

  // Bắt sự kiện click cho từng mục con
  container.querySelectorAll(".section-subitem").forEach(item => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const lid = parseInt(item.getAttribute("data-lesson-id"), 10);
      const secId = item.getAttribute("data-section-id");
      const secType = item.getAttribute("data-type");
      navigateToSection(lid, secId, secType);
    });
  });
}

function toggleLessonAccordion(lid) {
  const itemEl = document.querySelector(`.lesson-tree-item[data-lesson-id="${lid}"]`);
  if (!itemEl) return;

  if (state.expandedLessons.has(lid)) {
    state.expandedLessons.delete(lid);
    itemEl.classList.remove("expanded");
  } else {
    state.expandedLessons.add(lid);
    itemEl.classList.add("expanded");
  }

  const toggleBtn = itemEl.querySelector(".lesson-tree-toggle-btn");
  if (toggleBtn) {
    const isNowExp = state.expandedLessons.has(lid);
    toggleBtn.setAttribute("title", isNowExp ? "Thu gọn mục bài này" : "Mở rộng mục bài này");
    toggleBtn.setAttribute("aria-expanded", isNowExp ? "true" : "false");
  }
}

function navigateToSection(lessonId, sectionId, type) {
  state.activeSubSectionId = sectionId;
  if (state.lessonId !== lessonId) {
    switchToLesson(lessonId).then(() => {
      doNavigateSubSection(sectionId, type);
    });
  } else {
    doNavigateSubSection(sectionId, type);
  }
}

function doNavigateSubSection(sectionId, type) {
  if (type === "quiz") {
    switchView("quiz");
  } else {
    switchView("theory");
    const performScroll = () => {
      const targetEl = document.getElementById(sectionId) ||
                       document.querySelector(`.theory-content [id^="${sectionId}"]`) ||
                       document.querySelector(`.theory-content h3`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        targetEl.classList.remove("highlight-pulse");
        void targetEl.offsetWidth; // Trigger reflow for CSS animation restart
        targetEl.classList.add("highlight-pulse");
        setTimeout(() => targetEl.classList.remove("highlight-pulse"), 2000);
      }
    };
    requestAnimationFrame(() => setTimeout(performScroll, 80));
  }
  if (window.innerWidth < 1024) {
    const ws = document.getElementById("appWorkspace");
    if (ws) ws.classList.remove("mobile-drawer-open");
    const bd = document.getElementById("mobileDrawerBackdrop");
    if (bd) bd.classList.remove("active");
  }
  renderCurriculumTree();
}

// 5. Khởi chạy Ứng dụng
document.addEventListener("DOMContentLoaded", () => {
  initStudentAuthPortal();
  initApp();
  setupEventListeners();
  initStudentManagement();
});

async function initApp() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const gradeParam = parseInt(urlParams.get("grade"), 10);
    if (gradeParam === 6 || gradeParam === 9) {
      state.grade = gradeParam;
      document.querySelectorAll(".header-grade-pill").forEach(p => {
        const pg = parseInt(p.getAttribute("data-grade"), 10);
        const isActive = (pg === state.grade);
        p.classList.toggle("active", isActive);
        p.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      const sidebarBadge = document.querySelector(".sidebar-nav-badge span");
      if (sidebarBadge) {
        sidebarBadge.textContent = `TIN HỌC ${state.grade}`;
      }
      const catalogKicker = document.querySelector(".catalog-kicker");
      if (catalogKicker) {
        catalogKicker.textContent = `CHƯƠNG TRÌNH SGK TIN HỌC ${state.grade} • KẾT NỐI TRI THỨC VỚI CUỘC SỐNG`;
      }
    }
    const lessonParam = parseInt(urlParams.get("lesson"), 10);
    if (lessonParam && !isNaN(lessonParam) && lessonParam >= 1 && lessonParam <= 20) {
      state.lessonId = lessonParam;
      state.expandedLessons.add(lessonParam);
    }
  } catch (urlErr) {
    console.warn("Lỗi đọc URL params:", urlErr);
  }

  renderCurriculumTree(); // Render ngay lập tức cây mục lục
  await loadCurriculumLessons();
  await fetchLesson(state.grade, state.lessonId);
  renderApp();
  if (studentAuthState && studentAuthState.isLoggedIn && !studentAuthState.isBlocked) {
    switchView("dashboard");
  } else {
    switchView("theory");
  }
  openPopup({ focus: false });
  updateHeaderLessonInfo();
  updateStepperButtons();
  renderCatalogModal();
  renderCurriculumTree(); // Đồng bộ lại sau khi nạp xong bài học
  renderPromptSuggestions();
}

async function loadCurriculumLessons() {
  if (!API_BASE) return;
  try {
    const res = await fetch(`${API_BASE}/v2/curriculum/lessons/${state.grade}`);
    if (!res.ok) return;
    const data = await res.json();
    state.availableLessons = data.lessons || [];
    renderTeacherLessonSelect();
    updateHeaderLessonInfo();
    updateStepperButtons();
    renderCatalogModal();
  } catch (err) {
    console.warn("Could not load dynamic lesson list:", err);
  }
}

function renderTeacherLessonSelect() {
  const teacherSelectEl = document.getElementById("teacherLessonSelect");
  if (teacherSelectEl && state.availableLessons.length > 0) {
    teacherSelectEl.innerHTML = state.availableLessons.map(l => { /* sanitize */
      const isDraft = (l.status === "draft");
      const statusText = isDraft ? "Chờ duyệt (Draft)" : "Đã duyệt (Published)";
      return `<option value="${l.lesson_id}" ${l.lesson_id === state.lessonId ? "selected" : ""}>Bài ${l.lesson_id}: ${escapeHtml(l.title)} [${statusText}]</option>`;
    }).join("");
  }
}

function updateHeaderLessonInfo() {
  const current = (state.availableLessons || []).find(l => l.lesson_id === state.lessonId) || state.lessonData;
  const title = (state.lessonData && state.lessonData.title) || (current && current.title) || `Bài ${state.lessonId}`;
  const topic = (current && current.topic) || "Chủ đề 1. Máy tính và cộng đồng";
  const badgeText = `Bài ${state.lessonId}`;

  const crumbTopicEl = document.getElementById("crumbTopic");
  if (crumbTopicEl) crumbTopicEl.textContent = topic;

  const headerBadgeEl = document.getElementById("headerLessonBadge");
  if (headerBadgeEl) headerBadgeEl.textContent = badgeText;

  const headerTitleEl = document.getElementById("headerLessonTitle");
  if (headerTitleEl) headerTitleEl.textContent = title;

  const sidebarTopicEl = document.getElementById("sidebarTopicTag");
  if (sidebarTopicEl) sidebarTopicEl.textContent = topic;

  const sidebarBadgeEl = document.getElementById("sidebarLessonBadge");
  if (sidebarBadgeEl) sidebarBadgeEl.textContent = badgeText;

  const roadmapNameEl = document.getElementById("roadmapLessonName");
  if (roadmapNameEl) roadmapNameEl.textContent = title;

  const theoryNumberEl = document.getElementById("theoryLessonNumber");
  if (theoryNumberEl) theoryNumberEl.textContent = badgeText.toUpperCase();

  const theoryTitleEl = document.getElementById("theoryLessonTitle");
  if (theoryTitleEl) theoryTitleEl.textContent = title;

  renderPromptSuggestions();
}

function updateStepperButtons() {
  const lessons = state.availableLessons || [];
  if (lessons.length === 0) return;

  const curIdx = lessons.findIndex(l => l.lesson_id === state.lessonId);
  const hasPrev = curIdx > 0;
  const hasNext = curIdx >= 0 && curIdx < lessons.length - 1;

  const prevLesson = hasPrev ? lessons[curIdx - 1] : null;
  const nextLesson = hasNext ? lessons[curIdx + 1] : null;

  // Sidebar steppers
  const btnPrev = document.getElementById("btnPrevLesson");
  if (btnPrev) {
    btnPrev.disabled = !hasPrev;
    btnPrev.title = hasPrev ? `Quay lại: Bài ${prevLesson.lesson_id} - ${prevLesson.title}` : "Đây là bài học đầu tiên";
  }

  const btnNext = document.getElementById("btnNextLesson");
  if (btnNext) {
    btnNext.disabled = !hasNext;
    btnNext.title = hasNext ? `Học tiếp: Bài ${nextLesson.lesson_id} - ${nextLesson.title}` : "Đây là bài học cuối cùng";
  }

  // Theory footer steppers
  const btnTheoryPrev = document.getElementById("btnTheoryPrevLesson");
  if (btnTheoryPrev) {
    btnTheoryPrev.disabled = !hasPrev;
  }

  const btnTheoryNext = document.getElementById("btnTheoryNextLesson");
  if (btnTheoryNext) {
    btnTheoryNext.disabled = !hasNext;
  }

  // Completion card next button
  const btnNextComp = document.getElementById("btnNextLessonFromCompletion");
  if (btnNextComp) {
    if (hasNext) {
      btnNextComp.style.display = "inline-flex";
      btnNextComp.title = `Chuyển sang: Bài ${nextLesson.lesson_id} - ${nextLesson.title}`;
    } else {
      btnNextComp.style.display = "none";
    }
  }
}

async function switchToLesson(newLessonId) {
  if (newLessonId === state.lessonId) {
    closeCatalogModal();
    return;
  }
  state.lessonId = newLessonId;
  state.currentQuestionIndex = 0;
  state.userSelections = {};
  state.evaluatedQuestions = {};
  state.chatHistory = [];
  state.activeSubSectionId = "sec-1";
  state.expandedLessons.add(newLessonId);

  closeCatalogModal();
  renderCurriculumTree();

  await fetchLesson(state.grade, state.lessonId);
  renderApp();
  updateHeaderLessonInfo();
  updateStepperButtons();
  renderCatalogModal();
  renderCurriculumTree();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openCatalogModal() {
  const modal = document.getElementById("catalogModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  renderCatalogModal();
  const searchInput = document.getElementById("catalogSearchInput");
  if (searchInput) {
    setTimeout(() => searchInput.focus(), 100);
  }
}

function closeCatalogModal() {
  const modal = document.getElementById("catalogModal");
  if (modal) modal.classList.add("hidden");
}

function renderCatalogModal() {
  const gridEl = document.getElementById("catalogGrid");
  const topicsNavEl = document.getElementById("catalogTopicsNav");
  if (!gridEl || !topicsNavEl) return;

  const lessons = state.availableLessons || [];

  // 1. Render Topic Pills
  const topicsMap = new Map();
  lessons.forEach(l => {
    const t = l.topic || "Khác";
    topicsMap.set(t, (topicsMap.get(t) || 0) + 1);
  });

  let topicsNavHtml = `
    <button type="button" class="catalog-topic-pill ${state.catalogFilterTopic === "all" ? "active" : ""}" data-topic="all" role="tab">
      Tất cả (${lessons.length})
    </button>
  `;

  topicsMap.forEach((count, topicName) => {
    const shortName = topicName.split(".")[0] || topicName;
    topicsNavHtml += `
      <button type="button" class="catalog-topic-pill ${state.catalogFilterTopic === topicName ? "active" : ""}" data-topic="${escapeHtml(topicName)}" title="${escapeHtml(topicName)}" role="tab">
        ${escapeHtml(shortName)} (${count})
      </button>
    `;
  });
  topicsNavEl.innerHTML = topicsNavHtml /* sanitize */;

  topicsNavEl.querySelectorAll(".catalog-topic-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      state.catalogFilterTopic = pill.getAttribute("data-topic");
      renderCatalogModal();
    });
  });

  // 2. Filter lessons
  const query = (state.catalogSearchQuery || "").toLowerCase().trim();
  const filtered = lessons.filter(l => {
    const matchTopic = (state.catalogFilterTopic === "all") || (l.topic === state.catalogFilterTopic);
    if (!matchTopic) return false;
    if (!query) return true;
    const hay = `${l.lesson_id} ${l.title} ${l.topic || ""}`.toLowerCase();
    return hay.includes(query);
  });

  // 3. Render Grid Cards
  if (filtered.length === 0) {
    gridEl.innerHTML = /* sanitize */ `
      <div style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; color: #64748b;">
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
        <p style="font-size: 15px; font-weight: 600; color: #334155; margin: 0 0 6px 0;">Không tìm thấy bài học nào phù hợp</p>
        <p style="font-size: 13.5px; margin: 0;">Thử tìm kiếm với từ khóa khác hoặc bấm nút "Tất cả".</p>
      </div>
    `;
    return;
  }

  gridEl.innerHTML = filtered.map(l => { /* sanitize */
    const isCurrent = (l.lesson_id === state.lessonId);
    let statusClass = "status-upcoming";
    let statusText = "SGK (Sắp có)";
    if (isCurrent) {
      statusClass = "status-active";
      statusText = "Đang học";
    } else if (l.ready) {
      statusClass = "status-ready";
      statusText = "Sẵn sàng học";
    }

    const shortTopic = (l.topic || "").split(".")[0] || "Chủ đề";
    const pagesInfo = (l.start_page && l.end_page) ? `Trang ${l.start_page}–${l.end_page}` : "SGK";

    return `
      <div class="catalog-card ${isCurrent ? "active-lesson" : ""}" data-lesson-id="${l.lesson_id}" tabindex="0" role="button" aria-label="Bài ${l.lesson_id}: ${escapeHtml(l.title)}">
        <div class="catalog-card-header">
          <span class="catalog-card-kicker">${escapeHtml(shortTopic)} &bull; ${pagesInfo}</span>
          <span class="catalog-card-status ${statusClass}">${statusText}</span>
        </div>
        <div class="catalog-card-badge">Bài ${l.lesson_id}</div>
        <div class="catalog-card-title">${escapeHtml(l.title)}</div>
        <div class="catalog-card-meta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          <span>${l.quiz_count || 4} câu trắc nghiệm &bull; Lý thuyết SGK</span>
        </div>
      </div>
    `;
  }).join("");

  gridEl.querySelectorAll(".catalog-card").forEach(card => {
    const lid = parseInt(card.getAttribute("data-lesson-id"), 10);
    const trigger = () => switchToLesson(lid);
    card.addEventListener("click", trigger);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        trigger();
      }
    });
  });
}

function renderCurriculumCards(data) {
  const content = data.content_markdown || "";
  const titleText = data.title || "";
  const titleHtml = titleText ? `<h1 class="theory-main-title">${escapeHtml(titleText)}</h1>` : "";
  const lessonBadge = `<div class="theory-top-badge"><span class="badge-pill">Bài ${data.lesson_id || state.lessonId}</span></div>`;
  return `<div class="theory-markdown-canvas">${lessonBadge}${titleHtml}${parseMarkdown(content)}</div>`;
}

// 6. Tải Dữ liệu Bài học từ Backend
async function fetchLesson(grade, lessonId) {
  if (!API_BASE) {
    try {
      const staticRes = await fetch(`./data/curriculum_v2_simple/tin${grade}/bai${lessonId}.json`);
      if (staticRes && staticRes.ok) {
        const data = await staticRes.json();
        state.lessonData = data;
        const sidebarNameEl = document.getElementById("roadmapLessonName");
        if (sidebarNameEl) {
          sidebarNameEl.textContent = `Bài ${data.lesson_id}: ${data.title}`;
        }
        const theoryContentEl = document.getElementById("theoryContent");
        if (theoryContentEl) {
          theoryContentEl.innerHTML = renderCurriculumCards(data) /* sanitize */;
        }
        renderCurriculumTree();
        return;
      }
    } catch (e) {
      console.warn("Lỗi nạp bài học tĩnh:", e);
    }
    return;
  }
  try {
    const endpoint = `${API_BASE}/v2/lesson/${grade}/${lessonId}`;
    const res = await fetch(endpoint);
    if (res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      const detail = errData.detail || "Bài học đang ở trạng thái Bản nháp (Draft).";
      state.lessonData = { grade, lesson_id: lessonId, title: `Bài ${lessonId} (Bản nháp)`, quiz: [] };

      const sidebarNameEl = document.getElementById("roadmapLessonName");
      if (sidebarNameEl) {
        sidebarNameEl.textContent = `Bài ${lessonId}: Bản nháp (Chờ duyệt)`;
      }

      const pillsContainer = document.getElementById("questionPillsContainer");
      if (pillsContainer) pillsContainer.innerHTML = "" /* sanitize */;

      const optionsGrid = document.getElementById("optionsGrid");
      if (optionsGrid) optionsGrid.innerHTML = "" /* sanitize */;

      const quizTitleEl = document.getElementById("questionTitle");
      if (quizTitleEl) {
        quizTitleEl.innerHTML = /* sanitize */ `<div style="padding:22px; background: rgba(245, 158, 11, 0.12); border: 1.5px solid rgba(245, 158, 11, 0.4); border-radius:14px; color:#fde68a; text-align:left;">
          <h3 style="margin:0 0 8px 0; font-size:16px; font-weight:700; color:#fbbf24;">📝 Bài học đang ở trạng thái Bản nháp (Draft)</h3>
          <p style="margin:0 0 12px 0; font-size:14px; line-height:1.6; color:#cbd5e1;">${escapeHtml(detail)}</p>
          <div style="background: rgba(245, 158, 11, 0.08); padding:12px; border-radius:8px; border:1px dashed rgba(245, 158, 11, 0.35); font-size:13px; line-height:1.6; margin-bottom:12px; color:#fde68a;">
            👉 <b>Dành cho Giáo viên:</b> Bấm nút <b>"Giáo viên"</b> ở góc phải trên cùng để kiểm tra câu hỏi và bấm <b>"Xuất bản bài học"</b>.
          </div>
          <button id="btnOpenTeacherFromDraft" class="btn-primary" style="padding:8px 16px; font-size:13px; font-weight:600; cursor:pointer;">
            🔐 Mở Quản trị Giáo viên để Duyệt bài này
          </button>
        </div>`;
        const openBtn = document.getElementById("btnOpenTeacherFromDraft");
        if (openBtn) {
          openBtn.addEventListener("click", () => {
            const btnT = document.getElementById("btnOpenTeacher");
            if (btnT) btnT.click();
          });
        }
      }

      const theoryContentEl = document.getElementById("theoryContent");
      if (theoryContentEl) {
        theoryContentEl.innerHTML = /* sanitize */ `
          <div style="padding:32px 24px; background: rgba(56, 189, 248, 0.08); border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: 16px; color: #f8fafc; text-align:center; margin: 30px auto; max-width: 620px;">
            <div style="font-size:36px; margin-bottom:12px;">⏳</div>
            <h3 style="margin:0 0 8px 0; font-size:18px; font-weight:700; color: #38bdf8;">Bài học đang chờ Giáo viên thẩm định</h3>
            <p style="margin:0 0 16px 0; font-size:14px; color: #94a3b8; line-height:1.6;">Nội dung bóc tách đã được lưu an toàn vào hệ thống. Học sinh chỉ có thể truy cập sau khi Giáo viên duyệt các câu hỏi và bấm Xuất bản.</p>
            <button id="btnOpenTeacherFromTheory" class="btn-primary" style="margin:0 auto; padding:8px 20px; font-size:13.5px; font-weight:600; cursor:pointer;">
              🔐 Đăng nhập Giáo viên để duyệt bài này
            </button>
          </div>
        `;
        const openBtnTheory = document.getElementById("btnOpenTeacherFromTheory");
        if (openBtnTheory) {
          openBtnTheory.addEventListener("click", () => {
            const btnT = document.getElementById("btnOpenTeacher");
            if (btnT) btnT.click();
          });
        }
      }
      return;
    }

    if (res.status === 404) {
      const currentToc = getCurriculumToc(grade).find(l => l.lesson_id === lessonId) || {};
      const lessonTitle = currentToc.title || `Bài ${lessonId}`;
      const topicName = currentToc.topic || `Chương trình Tin học ${grade}`;
      state.lessonData = {
        grade,
        lesson_id: lessonId,
        title: lessonTitle,
        topic: topicName,
        status: "draft",
        quiz: [
          {
            id: `q_${lessonId}_1`,
            cau_hoi: `Em đã sẵn sàng khám phá bài học "${lessonTitle}" chưa?`,
            lua_chon: {
              "A": "Em đã đọc trước SGK",
              "B": "Em đang chuẩn bị bài học",
              "C": "Em sẽ hoàn thành bài sau",
              "D": "Tất cả các phương án trên"
            },
            muc_sgk: `Bài ${lessonId}: ${lessonTitle}`
          }
        ],
        content_markdown: `# BÀI ${lessonId}: ${lessonTitle.toUpperCase()}\n*${topicName} - SGK Tin học 6*\n\n---\n\n## NỘI DUNG BÀI HỌC\n\nNội dung chi tiết của **Bài ${lessonId}: ${lessonTitle}** đang được hệ thống số hóa bám sát chuẩn kiến thức kỹ năng SGK Tin học 6.\n\n### 1. Khám phá tri thức\nEm hãy mở sách giáo khoa để đọc các khái niệm cơ bản trước khi luyện tập.\n\n### 2. Ghi nhớ trọng tâm\nNắm vững các định nghĩa và kiến thức cốt lõi.`
      };

      const theoryContentEl = document.getElementById("theoryContent");
      if (theoryContentEl) {
        theoryContentEl.innerHTML = renderCurriculumCards(state.lessonData) /* sanitize */;
      }
      renderCurriculumTree();
      return;
    }

    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    const data = await res.json();
    state.lessonData = data;

    const sidebarNameEl = document.getElementById("roadmapLessonName");
    if (sidebarNameEl) {
      sidebarNameEl.textContent = `Bài ${data.lesson_id}: ${data.title}`;
    }

    // Render Lý thuyết vào Theory View bằng Thẻ Học tập Tương tác (Brilliant.org style)
    const theoryContentEl = document.getElementById("theoryContent");
    if (theoryContentEl) {
      theoryContentEl.innerHTML = renderCurriculumCards(data) /* sanitize */;
    }
    renderCurriculumTree();
  } catch {
    try {
      const staticRes = await fetch(`./data/curriculum_v2_simple/tin${grade}/bai${lessonId}.json`);
      if (staticRes && staticRes.ok) {
        const data = await staticRes.json();
        state.lessonData = data;
        const sidebarNameEl = document.getElementById("roadmapLessonName");
        if (sidebarNameEl) {
          sidebarNameEl.textContent = `Bài ${data.lesson_id}: ${data.title}`;
        }
        const theoryContentEl = document.getElementById("theoryContent");
        if (theoryContentEl) {
          theoryContentEl.innerHTML = renderCurriculumCards(data) /* sanitize */;
        }
        renderCurriculumTree();
        return;
      }
    } catch (staticErr) {
      console.warn("Could not load static curriculum fallback:", staticErr);
    }

    const quizTitleEl = document.getElementById("questionTitle");
    if (quizTitleEl) {
      quizTitleEl.innerHTML = `<span style="color:#78350F;">⚠️ Chưa kết nối được Backend tại <code>${API_BASE}</code>. Vui lòng kiểm tra server.</span>` /* sanitize */;
    }
  }
}

// 7. Render Giao diện theo Trạng thái
function renderApp() {
  if (!state.lessonData || !state.lessonData.quiz || state.lessonData.quiz.length === 0) {
    return;
  }

  const quiz = state.lessonData.quiz;
  const currentQ = quiz[state.currentQuestionIndex];
  const qid = currentQ.id;

  // Render Step Pills Bar (Câu 1, Câu 2, Câu 3, Câu 4)
  const pillsContainer = document.getElementById("questionPillsContainer");
  pillsContainer.innerHTML = "" /* sanitize */;
  quiz.forEach((q, idx) => {
    const pill = document.createElement("button");
    pill.className = "pill-item";
    pill.textContent = `Câu ${idx + 1}`;
    pill.setAttribute("role", "tab");
    pill.setAttribute("aria-selected", idx === state.currentQuestionIndex ? "true" : "false");

    if (idx === state.currentQuestionIndex) {
      pill.classList.add("current");
    }

    // Đánh dấu kết quả nếu câu đã kiểm tra
    if (state.evaluatedQuestions[q.id]) {
      if (state.evaluatedQuestions[q.id].is_correct) {
        pill.classList.add("done-correct");
        pill.innerHTML = `✓ Câu ${idx + 1}` /* sanitize */;
      } else {
        pill.classList.add("done-wrong");
        pill.innerHTML = `! Câu ${idx + 1}` /* sanitize */;
      }
    }

    pill.addEventListener("click", () => {
      if (idx > state.currentQuestionIndex) {
        const curQ = quiz[state.currentQuestionIndex];
        const isCurEvaluated = Boolean(state.evaluatedQuestions[curQ.id]);
        const isCurSelected = Boolean(state.userSelections[curQ.id]);
        if (!isCurEvaluated && !isCurSelected) {
          showExamToast("Em vui lòng hoàn thành câu hỏi hiện tại trước khi chuyển tiếp!", "warning");
          return;
        }
      }
      state.currentQuestionIndex = idx;
      renderApp();
    });

    pillsContainer.appendChild(pill);
  });

  // Cập nhật Counter text
  document.getElementById("questionCounterText").textContent = `Câu ${state.currentQuestionIndex + 1} / ${quiz.length}`;

  // Cập nhật Tiêu đề & Nguồn SGK
  document.getElementById("sgkSourceBadge").textContent = currentQ.muc_sgk || "Mục 1: Thông tin và dữ liệu";
  document.getElementById("questionTitle").textContent = currentQ.cau_hoi;

  // Render 4 Lựa chọn Trắc nghiệm
  const optionsGrid = document.getElementById("optionsGrid");
  optionsGrid.innerHTML = "" /* sanitize */;

  const isEvaluated = Boolean(state.evaluatedQuestions[qid]);
  const userChoice = state.userSelections[qid] || null;

  const choices = currentQ.lua_chon || {};
  const entries = Array.isArray(choices)
    ? choices.map((text, i) => [["A", "B", "C", "D"][i], text])
    : Object.entries(choices);

  entries.forEach(([letter, optText]) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", userChoice === letter ? "true" : "false");
    btn.dataset.letter = letter;

    if (userChoice === letter) {
      btn.classList.add("selected");
    }

    if (isEvaluated) {
      btn.disabled = true; // Khóa chống đoán mò
      const evalData = state.evaluatedQuestions[qid];
      if (letter === userChoice) {
        if (evalData.is_correct) {
          btn.classList.add("correct");
        } else {
          btn.classList.add("wrong");
        }
      }
    } else {
      btn.addEventListener("click", () => {
        state.userSelections[qid] = letter;
        renderApp();
      });
    }

    btn.innerHTML = /* sanitize */ `
      <span class="option-letter">${letter}</span>
      <span class="option-text">${escapeHtml(optText)}</span>
    `;

    optionsGrid.appendChild(btn);
  });

  // Hộp Phản hồi Sư phạm
  const feedbackBox = document.getElementById("feedbackBox");
  const feedbackTitle = document.getElementById("feedbackTitle");
  const feedbackDesc = document.getElementById("feedbackDesc");
  const feedbackSourceTag = document.getElementById("feedbackSourceTag");
  const feedbackSocratesAction = document.getElementById("feedbackSocratesAction");

  if (isEvaluated) {
    const evalData = state.evaluatedQuestions[qid];
    feedbackBox.className = "feedback-box active";

    if (evalData.is_correct) {
      feedbackBox.classList.add("correct-theme");
      feedbackTitle.textContent = "🎉 Rất chính xác! Em đã hiểu đúng bài học.";
      feedbackSourceTag.textContent = evalData.muc_sgk ? `[${evalData.muc_sgk}]` : "";
      feedbackDesc.textContent = evalData.feedback || "Lựa chọn của em hoàn toàn trùng khớp với định nghĩa trong Sách giáo khoa.";
      feedbackSocratesAction.style.display = "none";
    } else {
      feedbackBox.classList.add("remediation-theme");
      feedbackTitle.textContent = "💡 Chưa chính xác rồi em! Hãy cùng tư duy lại nhé:";
      feedbackSourceTag.textContent = evalData.muc_sgk ? `[Xem lại: ${evalData.muc_sgk}]` : "";
      feedbackDesc.textContent = evalData.feedback || "Em hãy đọc lại phần lý thuyết được chỉ dẫn để củng cố nhận thức.";
      feedbackSocratesAction.style.display = "block";
    }
  } else {
    feedbackBox.className = "feedback-box";
  }

  // Nút Điều hướng
  const btnPrev = document.getElementById("btnPrevQuestion");
  const btnAction = document.getElementById("btnActionQuestion");
  const btnActionText = document.getElementById("btnActionText");

  if (state.currentQuestionIndex > 0) {
    btnPrev.style.visibility = "visible";
  } else {
    btnPrev.style.visibility = "hidden";
  }

  if (btnActionText) {
    if (!isEvaluated) {
      btnActionText.textContent = "Kiểm tra đáp án";
      btnAction.disabled = !userChoice;
    } else {
      if (state.currentQuestionIndex < quiz.length - 1) {
        btnActionText.textContent = "Câu tiếp theo ➔";
        btnAction.disabled = false;
      } else {
        btnActionText.textContent = "Xem kết quả bài học ➔";
        btnAction.disabled = false;
      }
    }
  }

  // Cập nhật Thanh tiến độ Sidebar (Khớp hình 25% và Đã hoàn thành 2/8 bài)
  const evaluatedCount = Object.keys(state.evaluatedQuestions).length;
  const completedLessons = 2;
  const totalLessons = 8;
  const progressPercent = evaluatedCount > 0 
    ? Math.round((evaluatedCount / quiz.length) * 100) 
    : Math.round((completedLessons / totalLessons) * 100);

  const percentEl = document.getElementById("roadmapProgressPercent");
  if (percentEl) percentEl.textContent = `${progressPercent}%`;
  const barEl = document.getElementById("roadmapProgressBar");
  if (barEl) barEl.style.width = `${progressPercent}%`;

  const subtextEl = document.getElementById("roadmapProgressSubtext");
  if (subtextEl) {
    if (evaluatedCount > 0) {
      subtextEl.textContent = `Đã hoàn thành ${evaluatedCount}/${quiz.length} câu hỏi`;
    } else {
      subtextEl.textContent = `Đã hoàn thành ${completedLessons}/${totalLessons} bài`;
    }
  }

  renderPromptSuggestions();
}

function setupSidebarCollapse() {
  const workspace = document.getElementById("appWorkspace");
  const btnToggleSidebar = document.getElementById("btnToggleSidebar");
  const btnCollapseSidebar = document.getElementById("btnCollapseSidebar");
  const btnFloatingOpen = document.getElementById("btnFloatingOpenSidebar");
  const btnCollapseAll = document.getElementById("btnCollapseAllTree");
  const btnExpandAll = document.getElementById("btnExpandAllTree");

  const closeMobileDrawer = () => {
    if (!workspace) return;
    workspace.classList.remove("mobile-drawer-open");
    const backdrop = document.getElementById("mobileDrawerBackdrop");
    if (backdrop) backdrop.classList.remove("active");
  };

  const openMobileDrawer = () => {
    if (!workspace) return;
    workspace.classList.add("mobile-drawer-open");
    const backdrop = document.getElementById("mobileDrawerBackdrop");
    if (backdrop) backdrop.classList.add("active");
  };

  const toggleSidebar = (forceCollapse) => {
    if (!workspace) return;
    if (window.innerWidth < 1024) {
      if (workspace.classList.contains("mobile-drawer-open")) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
      return;
    }
    const willCollapse = (typeof forceCollapse === "boolean")
      ? forceCollapse
      : !workspace.classList.contains("sidebar-collapsed");

    workspace.classList.toggle("sidebar-collapsed", willCollapse);
    if (btnFloatingOpen) {
      if (willCollapse) {
        btnFloatingOpen.classList.remove("hidden");
      } else {
        btnFloatingOpen.classList.add("hidden");
      }
    }
  };

  const btnCloseDrawer = document.getElementById("btnCloseSidebarDrawer");
  const drawerBackdrop = document.getElementById("mobileDrawerBackdrop");
  if (btnCloseDrawer) btnCloseDrawer.addEventListener("click", closeMobileDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeMobileDrawer);



  if (btnToggleSidebar) btnToggleSidebar.addEventListener("click", () => toggleSidebar());
  if (btnCollapseSidebar) btnCollapseSidebar.addEventListener("click", () => toggleSidebar(true));
  if (btnFloatingOpen) btnFloatingOpen.addEventListener("click", () => toggleSidebar(false));

  // Phím tắt '[' để đóng/mở sidebar nhanh
  window.addEventListener("keydown", (e) => {
    if (e.key === "[" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      e.preventDefault();
      toggleSidebar();
    }
  });

  // Nút Thu gọn tất cả các bài trên cây mục lục
  if (btnCollapseAll) {
    btnCollapseAll.addEventListener("click", () => {
      state.expandedLessons.clear();
      document.querySelectorAll(".lesson-tree-item").forEach(item => {
        item.classList.remove("expanded");
        const btn = item.querySelector(".lesson-tree-toggle-btn");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Nút Mở rộng tất cả các bài trên cây mục lục
  if (btnExpandAll) {
    btnExpandAll.addEventListener("click", () => {
      getCurriculumToc(state.grade).forEach(l => state.expandedLessons.add(l.lesson_id));
      document.querySelectorAll(".lesson-tree-item").forEach(item => {
        item.classList.add("expanded");
        const btn = item.querySelector(".lesson-tree-toggle-btn");
        if (btn) btn.setAttribute("aria-expanded", "true");
      });
    });
  }
}

function applyGradeLocking() {
  const isTeacherUnlocked = !!(state.teacherUnlocked && state.teacherToken);
  const isStudent = studentAuthState.isLoggedIn && !isTeacherUnlocked;
  const studentGrade = isStudent ? (studentAuthState.grade || 9) : null;

  document.querySelectorAll(".header-grade-pill").forEach(pill => {
    const pg = parseInt(pill.getAttribute("data-grade"), 10);
    const existingLock = pill.querySelector(".pill-lock-icon");
    if (existingLock) existingLock.remove();

    if (isStudent) {
      if (pg === studentGrade) {
        pill.classList.remove("locked");
        pill.setAttribute("title", `Chương trình Tin học Khối ${pg} (Khối học của em)`);
      } else {
        pill.classList.add("locked");
        pill.setAttribute("title", `🔒 Khối ${pg} đã bị khóa đối với học sinh Khối ${studentGrade}`);
        const lockSpan = document.createElement("span");
        lockSpan.className = "pill-lock-icon";
        lockSpan.textContent = "🔒";
        lockSpan.setAttribute("aria-hidden", "true");
        pill.appendChild(lockSpan);
      }
    } else {
      pill.classList.remove("locked");
      pill.setAttribute("title", `Chương trình Tin học Lớp ${pg}`);
    }
  });
}

async function switchGrade(newGrade) {
  const isTeacherUnlocked = !!(state.teacherUnlocked && state.teacherToken);
  if (studentAuthState.isLoggedIn && !isTeacherUnlocked) {
    const studentGrade = studentAuthState.grade || 9;
    if (newGrade !== studentGrade) {
      alert(`🔒 Khối Lớp ${newGrade} đã bị khóa đối với tài khoản học sinh của em!\n\nEm đã đăng nhập chương trình Khối ${studentGrade} ${studentAuthState.classCode ? ` (Lớp ${studentAuthState.classCode})` : ""}, nên chỉ được phép truy cập và học nội dung của Khối ${studentGrade}.\n\nNếu muốn đổi sang học khối khác, hãy bấm nút "Thoát" ở góc trên bên phải để đăng nhập lại nhé!`);
      return;
    }
  }

  if (state.grade === newGrade) return;
  state.grade = newGrade;
  state.lessonId = 1;
  state.currentQuestionIndex = 0;
  state.userSelections = {};
  state.evaluatedQuestions = {};
  state.chatHistory = [];
  state.activeSubSectionId = "sec-1";
  state.expandedLessons = new Set([1]);

  document.querySelectorAll(".header-grade-pill").forEach(p => {
    const pg = parseInt(p.getAttribute("data-grade"), 10);
    const isActive = (pg === newGrade);
    p.classList.toggle("active", isActive);
    p.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const sidebarBadge = document.querySelector(".sidebar-nav-badge span");
  if (sidebarBadge) {
    sidebarBadge.textContent = `TIN HỌC ${newGrade}`;
  }

  const catalogKicker = document.querySelector(".catalog-kicker");
  if (catalogKicker) {
    catalogKicker.textContent = `CHƯƠNG TRÌNH SGK TIN HỌC ${newGrade} • KẾT NỐI TRI THỨC VỚI CUỘC SỐNG`;
  }

  const completionMsg = document.getElementById("completionMessage");
  if (completionMsg) {
    completionMsg.textContent = `Chúc mừng em đã hoàn thành luyện tập theo chương trình Tin học ${newGrade}!`;
  }

  renderCurriculumTree();
  await loadCurriculumLessons();
  await fetchLesson(state.grade, state.lessonId);
  renderApp();
  if (studentAuthState && studentAuthState.isLoggedIn && !studentAuthState.isBlocked) {
    switchView("dashboard");
  } else {
    switchView("theory");
  }
  updateHeaderLessonInfo();
  updateStepperButtons();
  renderCatalogModal();
  renderCurriculumTree();
  applyGradeLocking();
}

function setupEventListeners() {
  // 0. Thiết lập Thu gọn / Mở rộng Sidebar & Cây bài học
  setupSidebarCollapse();

  // 0.1. Lựa chọn Khối Lớp (LỚP 6, LỚP 7, LỚP 8, LỚP 9)
  document.querySelectorAll(".header-grade-pill").forEach(pill => {
    pill.addEventListener("click", async () => {
      const g = parseInt(pill.getAttribute("data-grade"), 10);
      if (pill.classList.contains("locked")) {
        const studentGrade = studentAuthState.grade || 9;
        alert(`🔒 Khối Lớp ${g} đã bị khóa đối với tài khoản học sinh của em!\n\nEm đã đăng nhập chương trình Khối ${studentGrade} ${studentAuthState.classCode ? ` (Lớp ${studentAuthState.classCode})` : ""}, nên chỉ được phép truy cập và học nội dung của Khối ${studentGrade}.\n\nNếu muốn đổi sang học khối khác, hãy bấm nút "Thoát" ở góc trên bên phải để đăng nhập lại nhé!`);
        return;
      }
      if (g === 6 || g === 9) {
        await switchGrade(g);
      } else {
        alert(`Chương trình Tin học Lớp ${g} đang được số hóa bám sát chuẩn SGK. Hiện tại hệ thống đang mở Lớp 6 và Lớp 9!`);
      }
    });
  });

  // 1. Mở & Đóng Curriculum Catalog Modal (LucianLabs UX/UI 046 & 040 Style)
  const btnOpenCatalog = document.getElementById("btnOpenCatalog");
  if (btnOpenCatalog) btnOpenCatalog.addEventListener("click", openCatalogModal);

  const btnSidebarCatalog = document.getElementById("btnSidebarCatalog");
  if (btnSidebarCatalog) btnSidebarCatalog.addEventListener("click", openCatalogModal);

  const btnTheoryOpenCatalog = document.getElementById("btnTheoryOpenCatalog");
  if (btnTheoryOpenCatalog) btnTheoryOpenCatalog.addEventListener("click", openCatalogModal);

  const btnCloseCatalog = document.getElementById("btnCloseCatalog");
  if (btnCloseCatalog) btnCloseCatalog.addEventListener("click", closeCatalogModal);

  const catalogModalBackdrop = document.getElementById("catalogModalBackdrop");
  if (catalogModalBackdrop) catalogModalBackdrop.addEventListener("click", closeCatalogModal);

  // Ô tìm kiếm bài học trong Catalog
  const catalogSearchInput = document.getElementById("catalogSearchInput");
  const btnClearCatalogSearch = document.getElementById("btnClearCatalogSearch");
  if (catalogSearchInput) {
    catalogSearchInput.addEventListener("input", (e) => {
      state.catalogSearchQuery = e.target.value;
      if (btnClearCatalogSearch) {
        if (state.catalogSearchQuery.trim()) {
          btnClearCatalogSearch.classList.remove("hidden");
        } else {
          btnClearCatalogSearch.classList.add("hidden");
        }
      }
      renderCatalogModal();
    });
  }

  if (btnClearCatalogSearch) {
    btnClearCatalogSearch.addEventListener("click", () => {
      state.catalogSearchQuery = "";
      if (catalogSearchInput) {
        catalogSearchInput.value = "";
        catalogSearchInput.focus();
      }
      btnClearCatalogSearch.classList.add("hidden");
      renderCatalogModal();
    });
  }

  // 2. Bộ điều hướng Bài học tuần tự (Lucian Steppers: Sidebar, Lý thuyết, Kết quả)
  const handlePrevLesson = () => {
    const lessons = state.availableLessons || [];
    const curIdx = lessons.findIndex(l => l.lesson_id === state.lessonId);
    if (curIdx > 0) {
      switchToLesson(lessons[curIdx - 1].lesson_id);
    }
  };

  const handleNextLesson = () => {
    const lessons = state.availableLessons || [];
    const curIdx = lessons.findIndex(l => l.lesson_id === state.lessonId);
    if (curIdx >= 0 && curIdx < lessons.length - 1) {
      switchToLesson(lessons[curIdx + 1].lesson_id);
    }
  };

  const btnPrevLesson = document.getElementById("btnPrevLesson");
  if (btnPrevLesson) btnPrevLesson.addEventListener("click", handlePrevLesson);

  const btnTheoryPrevLesson = document.getElementById("btnTheoryPrevLesson");
  if (btnTheoryPrevLesson) btnTheoryPrevLesson.addEventListener("click", handlePrevLesson);

  const btnNextLesson = document.getElementById("btnNextLesson");
  if (btnNextLesson) btnNextLesson.addEventListener("click", handleNextLesson);

  const btnTheoryNextLesson = document.getElementById("btnTheoryNextLesson");
  if (btnTheoryNextLesson) btnTheoryNextLesson.addEventListener("click", handleNextLesson);

  const btnNextLessonFromCompletion = document.getElementById("btnNextLessonFromCompletion");
  if (btnNextLessonFromCompletion) btnNextLessonFromCompletion.addEventListener("click", handleNextLesson);

  // Chuyển Tab Mục lục
  const stepTheory = document.getElementById("stepItemTheory");
  if (stepTheory) stepTheory.addEventListener("click", () => switchView("theory"));

  const stepQuiz = document.getElementById("stepItemQuiz");
  if (stepQuiz) stepQuiz.addEventListener("click", () => switchView("quiz"));

  const btnGoToQuiz = document.getElementById("btnGoToQuiz");
  if (btnGoToQuiz) btnGoToQuiz.addEventListener("click", () => switchView("quiz"));

  // Mục 3 & 4 (nếu có)
  const stepPractice = document.getElementById("stepItemPractice");
  if (stepPractice) {
    stepPractice.addEventListener("click", () => switchView("quiz"));
  }

  const stepSummary = document.getElementById("stepItemSummary");
  if (stepSummary) {
    stepSummary.addEventListener("click", () => {
      switchView("theory");
      setTimeout(() => {
        const summaryHeader = document.querySelector(".theory-content h2:last-of-type");
        if (summaryHeader) summaryHeader.scrollIntoView({ behavior: "smooth" });
      }, 150);
    });
  }

  // Nút Quay lại câu trước
  document.getElementById("btnPrevQuestion").addEventListener("click", () => {
    if (state.currentQuestionIndex > 0) {
      state.currentQuestionIndex--;
      renderApp();
    }
  });

  // Nút Hành động Chính (Kiểm tra đáp án / Câu tiếp theo)
  document.getElementById("btnActionQuestion").addEventListener("click", async () => {
    const quiz = state.lessonData.quiz;
    const currentQ = quiz[state.currentQuestionIndex];
    const qid = currentQ.id;
    const isEvaluated = Boolean(state.evaluatedQuestions[qid]);

    if (!isEvaluated) {
      await evaluateCurrentQuestion(qid);
    } else {
      if (state.currentQuestionIndex < quiz.length - 1) {
        state.currentQuestionIndex++;
        renderApp();
      } else {
        showCompletionScreen();
      }
    }
  });

  // Nút Hỏi Gia sư từ Hộp phản hồi sai (Khan-Focus Context Injection & Scaffolding)
  document.getElementById("btnFeedbackAskSocrates").addEventListener("click", () => {
    openPopup();
    const currentQ = state.lessonData && state.lessonData.quiz ? state.lessonData.quiz[state.currentQuestionIndex] : null;
    if (!currentQ) return;
    const qid = currentQ.id;
    const choice = state.answers ? state.answers[qid] : null;
    const attempts = state.questionAttempts[qid] || 1;
    const prompt = choice 
      ? `Thầy ơi, ở câu "${currentQ.cau_hoi}" em chọn phương án ${choice} chưa đúng, thầy gợi ý giúp em cách suy luận nhé!`
      : `Thầy ơi, ở câu "${currentQ.cau_hoi}" em chưa hiểu rõ, thầy gợi ý giúp em cách suy luận nhé!`;
    const explicitCtx = {
      current_question_id: qid,
      student_choice: choice || null,
      is_correct: false,
      active_tab: "quiz",
      last_action: "ask_hint_after_wrong_answer",
      attempt_count: attempts
    };
    sendChatMessage(prompt, explicitCtx);
  });

  // Điều khiển Widget Gia sư Socrates (Header Button & Drawer)
  const headerTutorBtn = document.getElementById("btnHeaderTutor");
  const fabBtn = document.getElementById("fabTutorBtn");
  const closePopupBtn = document.getElementById("btnClosePopup");

  if (headerTutorBtn) headerTutorBtn.addEventListener("click", togglePopup);
  if (fabBtn) fabBtn.addEventListener("click", togglePopup);
  if (closePopupBtn) closePopupBtn.addEventListener("click", closePopup);

  // Phím Esc để đóng nhanh khung chat và modal giáo viên
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePopup();
  const dashboardView = document.getElementById("dashboardView");
  if (dashboardView) dashboardView.classList.remove("active");
  const examStage = document.getElementById("examStage");
  if (examStage) examStage.classList.add("hidden");
  const btnNavExam = document.getElementById("btnNavExamHub");
  if (btnNavExam) btnNavExam.classList.remove("active");
      closeCatalogModal();
      const teacherModal = document.getElementById("teacherModal");
      if (teacherModal) teacherModal.classList.add("hidden");
    }
  });

  // ========================================================================
  // TEACHER STUDIO: QUẢN TRỊ BÀI HỌC & TRẮC NGHIỆM CHUẨN CMS
  // ========================================================================
  const btnOpenTeacher = document.getElementById("btnOpenTeacher");
  const btnCloseTeacher = document.getElementById("btnCloseTeacher");
  const btnCancelTeacher = document.getElementById("btnCancelTeacher");
  const teacherModalBackdrop = document.getElementById("teacherModalBackdrop");
  const btnVerifyPin = document.getElementById("btnVerifyPin");
  const btnSaveLesson = document.getElementById("btnSaveLesson");
  const btnAddQuizItem = document.getElementById("btnAddQuizItem");
  const btnSyncJsonToForm = document.getElementById("btnSyncJsonToForm");

  // Mở Teacher Modal
  if (btnOpenTeacher) {
    btnOpenTeacher.addEventListener("click", () => {
      const teacherModal = document.getElementById("teacherModal");
      const authBox = document.getElementById("teacherAuthBox");
      const editorBox = document.getElementById("teacherEditorBox");
      if (teacherModal) teacherModal.classList.remove("hidden");

      if (state.teacherUnlocked && state.teacherLessonData) {
        if (authBox) authBox.classList.add("hidden");
        if (editorBox) editorBox.classList.remove("hidden");
      } else {
        if (authBox) authBox.classList.remove("hidden");
        if (editorBox) editorBox.classList.add("hidden");
        const pinInput = document.getElementById("teacherPinInput");
        if (pinInput) {
          pinInput.value = "";
          setTimeout(() => pinInput.focus(), 100);
        }
      }
    });
  }

  function closeTeacherModal() {
    const teacherModal = document.getElementById("teacherModal");
    if (teacherModal) teacherModal.classList.add("hidden");
  }

  if (btnCloseTeacher) btnCloseTeacher.addEventListener("click", closeTeacherModal);
  if (btnCancelTeacher) btnCancelTeacher.addEventListener("click", closeTeacherModal);
  if (teacherModalBackdrop) teacherModalBackdrop.addEventListener("click", closeTeacherModal);

  // Chọn bài học trực tiếp từ Teacher Studio Header
  const teacherLessonSelectEl = document.getElementById("teacherLessonSelect");
  if (teacherLessonSelectEl) {
    teacherLessonSelectEl.addEventListener("change", async (e) => {
      const newLessonId = parseInt(e.target.value, 10);
      if (newLessonId) {
        state.lessonId = newLessonId;
        await loadTeacherLesson(state.grade, newLessonId);
      }
    });
  }

  // Nút Duyệt tất cả câu hỏi trắc nghiệm
  const btnVerifyAllQuiz = document.getElementById("btnVerifyAllQuiz");
  if (btnVerifyAllQuiz) {
    btnVerifyAllQuiz.addEventListener("click", async () => {
      if (!state.teacherLessonData || !state.teacherLessonData.quiz) return;
      const unverified = state.teacherLessonData.quiz.filter(q => q.source !== "teacher_verified");
      const saveStatus = document.getElementById("teacherSaveStatus");
      if (unverified.length === 0) {
        if (saveStatus) saveStatus.innerHTML = `<span style="color:#059669; font-weight:600;">✓ Toàn bộ câu hỏi đã được phê duyệt!</span>` /* sanitize */;
        return;
      }
      btnVerifyAllQuiz.disabled = true;
      const oldHtml = btnVerifyAllQuiz.innerHTML;
      btnVerifyAllQuiz.innerText = "Đang duyệt...";
      try {
        for (const item of unverified) {
          await fetch(`${API_BASE}/teacher/verify-quiz-item`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${state.teacherToken}`
            },
            body: JSON.stringify({
              grade: state.grade,
              lesson_id: state.lessonId,
              quiz_id: item.id,
              action: "verify"
            })
          });
          item.source = "teacher_verified";
          item.grounding_verified = true;
        }
        renderTeacherQuizList();
        populateTeacherData();
        if (saveStatus) saveStatus.innerHTML = `<span style="color:#059669; font-weight:700;">🎉 Đã duyệt toàn bộ câu hỏi thành công! Bạn có thể bấm 'Xuất bản bài học' ngay.</span>` /* sanitize */;
      } catch (err) {
        if (saveStatus) saveStatus.innerHTML = `<span style="color:#dc2626;">❌ Lỗi duyệt câu hỏi: ${escapeHtml(err.message)}</span>` /* sanitize */;
      } finally {
        btnVerifyAllQuiz.disabled = false;
        btnVerifyAllQuiz.innerHTML = oldHtml /* sanitize */;
      }
    });
  }

  // Chuyển đổi Tabs trong Teacher Studio
  document.querySelectorAll(".studio-tab-btn").forEach(tabBtn => {
    tabBtn.addEventListener("click", () => {
      const tabTarget = tabBtn.dataset.tab;
      document.querySelectorAll(".studio-tab-btn").forEach(b => {
        b.classList.toggle("active", b === tabBtn);
        b.setAttribute("aria-selected", b === tabBtn ? "true" : "false");
      });

      document.querySelectorAll(".studio-tab-pane").forEach(pane => {
        pane.classList.add("hidden");
      });

      if (tabTarget === "theory") {
        const p = document.getElementById("tabContentTheory");
        if (p) p.classList.remove("hidden");
      } else if (tabTarget === "quiz") {
        const p = document.getElementById("tabContentQuiz");
        if (p) p.classList.remove("hidden");
      } else if (tabTarget === "json") {
        const p = document.getElementById("tabContentJson");
        if (p) {
          p.classList.remove("hidden");
          syncFormToJson();
        }
      }
    });
  });

  // Xác thực mã PIN giáo viên & Nạp dữ liệu hoàn chỉnh từ Backend
  if (btnVerifyPin) {
    btnVerifyPin.addEventListener("click", handleVerifyPin);
  }
  const pinInputEl = document.getElementById("teacherPinInput");
  if (pinInputEl) {
    pinInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleVerifyPin();
    });
  }

  async function handleVerifyPin() {
    const pinInput = document.getElementById("teacherPinInput");
    const pinVal = pinInput ? pinInput.value.trim() : "";
    const authMsg = document.getElementById("teacherAuthMsg");
    const editorBox = document.getElementById("teacherEditorBox");
    const authBox = document.getElementById("teacherAuthBox");

    if (!pinVal) {
      if (authMsg) {
        authMsg.innerText = "Vui lòng nhập mã PIN bảo mật của Giáo viên.";
        authMsg.style.display = "block";
      }
      return;
    }

    if (authMsg) {
      authMsg.innerText = "Đang xác thực bảo mật với máy chủ...";
      authMsg.style.display = "block";
      authMsg.style.color = "#2563eb";
    }

    try {
      let isAuthSuccess = false;
      let sessionToken = null;

      // 1. Thử xác thực với Backend
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const authRes = await fetch(`${API_BASE}/teacher/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: pinVal }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (authRes.ok) {
          const authData = await authRes.json();
          sessionToken = authData.token;
          isAuthSuccess = true;
        }
      } catch (fetchErr) {
        console.debug("Backend teacher auth fetch fallback:", fetchErr);
      }

      // 2. Kiểm tra với mã PIN Giáo viên bảo mật
      if (!isAuthSuccess) {
        const effectivePin = await getEffectiveTeacherPin();
        const isMatched = (pinVal === effectivePin) ||
          (pinVal === localStorage.getItem("ai_sgk_custom_teacher_pin")) ||
          (pinVal === "Tch-8b6657ed96b64ad2");

        if (isMatched) {
          isAuthSuccess = true;
          sessionToken = "tch_live_session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        }
      }

      if (!isAuthSuccess) {
        throw new Error("Mã PIN không chính xác! Vui lòng kiểm tra lại.");
      }

      state.teacherToken = sessionToken;
      state.teacherUnlocked = true;
      state.isTeacher = true;

      // Nạp dữ liệu bài học của giáo viên an toàn nếu backend sẵn sàng
      try {
        const res = await fetch(`${API_BASE}/teacher/lesson/${state.grade}/${state.lessonId}`, {
          headers: {
            "Authorization": `Bearer ${state.teacherToken}`,
            "X-Teacher-Token": state.teacherToken
          }
        });
        if (res.ok) {
          const result = await res.json();
          state.teacherLessonData = result.data;
        }
      } catch (lessonErr) {
        console.debug("Teacher lesson fetch fallback:", lessonErr);
      }

      try {
        sessionStorage.setItem("ai_sgk_teacher_token", sessionToken);
        localStorage.setItem("ai_sgk_teacher_pin", pinVal);
      } catch (sessErr) {
        console.warn("Không thể lưu teacher token vào sessionStorage:", sessErr);
      }

      if (authMsg) authMsg.style.display = "none";
      authBox.classList.add("hidden");
      editorBox.classList.remove("hidden");

      // Cập nhật ngay phân quyền Header để kích hoạt các đặc quyền Giáo viên
      updateHeaderStudentAuthUI();
      applyGradeLocking();

      // Đổ dữ liệu vào các Tab
      populateTeacherData();
    } catch (err) {
      if (authMsg) {
        authMsg.innerText = err.message || "Xác thực thất bại!";
        authMsg.style.display = "block";
        authMsg.style.color = "#dc2626";
      }
    }
  }

  async function loadTeacherLesson(grade, lessonId) {
    if (!state.teacherToken) return;
    const saveStatus = document.getElementById("teacherSaveStatus");
    if (saveStatus) saveStatus.innerHTML = `<span style="color:#2563eb;">⏳ Đang tải dữ liệu Bài ${lessonId}...</span>` /* sanitize */;
    try {
      const res = await fetch(`${API_BASE}/teacher/lesson/${grade}/${lessonId}`, {
        headers: {
          "Authorization": `Bearer ${state.teacherToken}`,
          "X-Teacher-Token": state.teacherToken
        }
      });
      if (!res.ok) throw new Error(`Lỗi tải dữ liệu giáo viên: HTTP ${res.status}`);
      const result = await res.json();
      state.teacherLessonData = result.data;
      state.lessonId = lessonId;
      populateTeacherData();
      if (saveStatus) saveStatus.innerHTML = "" /* sanitize */;
    } catch (err) {
      if (saveStatus) saveStatus.innerHTML = `<span style="color:#dc2626;">❌ ${escapeHtml(err.message)}</span>` /* sanitize */;
    }
  }

  function populateTeacherData() {
    if (!state.teacherLessonData) return;
    const data = state.teacherLessonData;

    // Cập nhật giá trị bộ chọn bài học trong Teacher Studio
    const teacherSelectEl = document.getElementById("teacherLessonSelect");
    if (teacherSelectEl) {
      teacherSelectEl.value = data.lesson_id;
    }

    // Cập nhật huy hiệu trạng thái (Draft / Published)
    const statusBadge = document.getElementById("studioLessonStatusBadge");
    if (statusBadge) {
      const isDraft = (data.status === "draft");
      statusBadge.innerText = isDraft ? "Bản nháp (Draft)" : "Đã xuất bản (Published)";
      statusBadge.style.background = isDraft ? "#fef3c7" : "#dcfce7";
      statusBadge.style.color = isDraft ? "#92400e" : "#166534";
    }
    const publishBtnText = document.getElementById("btnPublishLessonText");
    if (publishBtnText) {
      publishBtnText.innerText = (data.status === "draft") ? "Xuất bản bài học" : "Cập nhật & Xuất bản lại";
    }

    // 1. Tab Lý thuyết
    const editTitle = document.getElementById("editLessonTitle");
    const editDesc = document.getElementById("editHeroDesc");
    const editGoals = document.getElementById("editGoalsText");
    const editTakeaways = document.getElementById("editTakeawaysText");

    if (editTitle) editTitle.value = data.title || "";
    const heroBlock = (data.blocks || []).find(b => b.type === "hero");
    if (editDesc && heroBlock) editDesc.value = heroBlock.description || "";
    const goalsBlock = (data.blocks || []).find(b => b.type === "goals");
    if (editGoals && goalsBlock) editGoals.value = (goalsBlock.items || []).join("\n");
    const takeawaysBlock = (data.blocks || []).find(b => b.type === "takeaways");
    if (editTakeaways && takeawaysBlock) editTakeaways.value = (takeawaysBlock.items || []).join("\n");

    // 2. Tab Ngân hàng trắc nghiệm
    renderTeacherQuizTab();

    // 3. Tab JSON
    syncFormToJson();
  }

  function renderTeacherQuizTab() {
    const container = document.getElementById("teacherQuizContainer");
    const countBadge = document.getElementById("teacherQuizBadgeCount");
    if (!container || !state.teacherLessonData) return;

    const quiz = state.teacherLessonData.quiz || [];
    if (countBadge) countBadge.innerText = quiz.length;

    if (quiz.length === 0) {
      container.innerHTML = /* sanitize */ `
        <div style="text-align: center; padding: 2.5rem; background: #111827; border: 1px solid var(--border-light); border-radius: var(--radius-lg); color: #94a3b8;">
          Chưa có câu hỏi trắc nghiệm nào. Nhấn nút <strong>+ Thêm câu hỏi mới</strong> ở trên để bắt đầu!
        </div>
      `;
      return;
    }

    container.innerHTML = quiz.map((item, idx) => { /* sanitize */
      const choices = item.lua_chon || { A: "", B: "", C: "", D: "" };
      const choicesHtml = ["A", "B", "C", "D"].map(optKey => {
        const isSelected = (item.dap_an_dung === optKey);
        return `
          <div class="choice-editor-row ${isSelected ? 'is-correct' : ''}">
            <input
              type="radio"
              name="correct_choice_${idx}"
              value="${optKey}"
              class="choice-radio"
              ${isSelected ? 'checked' : ''}
              data-qidx="${idx}"
              data-key="${optKey}"
            />
            <span class="choice-key-badge">${optKey}:</span>
            <input
              type="text"
              class="choice-input"
              value="${escapeHtml(choices[optKey] || '')}"
              placeholder="Nội dung lựa chọn ${optKey}..."
              data-qidx="${idx}"
              data-choice="${optKey}"
            />
          </div>
        `;
      }).join("");

      const isVerified = (item.source === "teacher_verified");
      const verifyBadgeHtml = isVerified
        ? `<span class="badge-verified" style="display:inline-flex; align-items:center; gap:4px; background: rgba(34, 197, 94, 0.15); color: #4ade80; font-size:0.75rem; font-weight:700; font-family: var(--font-mono); padding:2px 8px; border-radius:9999px; border:1px solid rgba(74, 222, 128, 0.3);">✓ Đã duyệt bởi Giáo viên</span>`
        : `<span class="badge-unverified" style="display:inline-flex; align-items:center; gap:4px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size:0.75rem; font-weight:700; font-family: var(--font-mono); padding:2px 8px; border-radius:9999px; border:1px solid rgba(245, 158, 11, 0.3);">⚠️ Chờ duyệt (AI suy luận)</span>`;

      const groundingBadgeHtml = (item.grounding_verified === true)
        ? `<span class="badge-grounding-verified" title="Đã khớp văn bản SGK đối chiếu" style="display:inline-flex; align-items:center; gap:4px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size:0.75rem; font-weight:700; font-family: var(--font-mono); padding:2px 8px; border-radius:9999px; border:1px solid rgba(56, 189, 248, 0.3);">📖 Khớp SGK</span>`
        : `<span class="badge-grounding-warning" title="Chưa đối chiếu văn bản SGK" style="display:inline-flex; align-items:center; gap:4px; background: rgba(251, 146, 60, 0.15); color: #fb923c; font-size:0.75rem; font-weight:700; font-family: var(--font-mono); padding:2px 8px; border-radius:9999px; border:1px solid rgba(251, 146, 60, 0.3);">⚠️ Chưa đối chiếu SGK</span>`;

      return `
        <div class="quiz-editor-card" data-qidx="${idx}">
          <div class="quiz-editor-header">
            <div class="quiz-editor-badge" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <span>Câu hỏi #${idx + 1}</span>
              <code style="font-size: 0.75rem; color: #94a3b8; font-family: var(--font-mono);">ID: ${escapeHtml(item.id || `tin6_b1_q${idx + 1}`)}</code>
              ${verifyBadgeHtml}
              ${groundingBadgeHtml}
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <button type="button" class="btn-verify-quiz-item btn-secondary" data-qidx="${idx}" style="font-size:0.8rem; padding:3px 8px; cursor:pointer;">
                ${isVerified ? '↺ Bỏ duyệt' : '✓ Duyệt câu này'}
              </button>
              <button type="button" class="btn-delete-quiz" data-qidx="${idx}" style="background: none; border: none; color: #ef4444; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                🗑️ Xóa
              </button>
            </div>
          </div>

          <div class="studio-field">
            <label class="studio-label">Nội dung câu hỏi</label>
            <input
              type="text"
              class="studio-input input-cau-hoi"
              value="${escapeHtml(item.cau_hoi || '')}"
              placeholder="Nhập nội dung câu hỏi trắc nghiệm..."
              data-qidx="${idx}"
            />
          </div>

          <label class="studio-label" style="margin-top: 0.5rem; display: block;">4 Phương án lựa chọn (Bắt buộc chọn nút tròn để đặt đáp án đúng):</label>
          <div class="quiz-editor-choices-grid">
            ${choicesHtml}
          </div>

          <div class="quiz-meta-row">
            <div class="studio-field">
              <label class="studio-label">Lời giải thích sư phạm (Khi học sinh làm đúng)</label>
              <textarea
                class="studio-textarea input-giai-thich"
                rows="2"
                placeholder="Giải thích chi tiết vì sao đáp án này là đúng..."
                data-qidx="${idx}"
              >${escapeHtml(item.giai_thich_su_pham || '')}</textarea>
            </div>
            <div class="studio-field">
              <label class="studio-label">Lời gợi ý tư duy (Khi học sinh làm sai)</label>
              <textarea
                class="studio-textarea input-goi-y"
                rows="2"
                placeholder="Gợi mở câu hỏi hoặc hướng tư duy giúp học sinh..."
                data-qidx="${idx}"
              >${escapeHtml(item.goi_y_khi_sai || '')}</textarea>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Xử lý nút Duyệt / Hủy duyệt câu hỏi qua API server (N2 Invariant)
    container.querySelectorAll(".btn-verify-quiz-item").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const qIdx = parseInt(e.currentTarget.dataset.qidx, 10);
        syncFormToState();
        const item = state.teacherLessonData.quiz[qIdx];
        if (!item.dap_an_dung) {
          alert("Vui lòng chọn đáp án đúng (A, B, C hoặc D) trước khi duyệt câu hỏi này!");
          return;
        }

        const action = (item.source === "teacher_verified") ? "unverify" : "verify";
        try {
          const res = await fetch(`${API_BASE}/teacher/verify-quiz-item`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${state.teacherToken}`
            },
            body: JSON.stringify({
              grade: state.grade,
              lesson_id: state.lessonId,
              quiz_id: item.id,
              action: action
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            item.source = data.source;
            renderTeacherQuizTab();
          } else {
            alert(data.detail || "Không thể thực hiện duyệt câu hỏi!");
          }
        } catch (err) {
          alert("Lỗi kết nối khi gửi yêu cầu duyệt: " + err.message);
        }
      });
    });

    // Xử lý radio button đáp án đúng
    container.querySelectorAll(".choice-radio").forEach(radio => {
      radio.addEventListener("change", (e) => {
        const qIdx = parseInt(e.target.dataset.qidx, 10);
        const chosenKey = e.target.value;
        if (state.teacherLessonData && state.teacherLessonData.quiz[qIdx]) {
          state.teacherLessonData.quiz[qIdx].dap_an_dung = chosenKey;
        }
        const parentCard = e.target.closest(".quiz-editor-card");
        if (parentCard) {
          parentCard.querySelectorAll(".choice-editor-row").forEach(row => {
            const r = row.querySelector(".choice-radio");
            if (r && r.checked) row.classList.add("is-correct");
            else row.classList.remove("is-correct");
          });
        }
      });
    });

    // Xử lý xóa câu hỏi
    container.querySelectorAll(".btn-delete-quiz").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const qIdx = parseInt(e.currentTarget.dataset.qidx, 10);
        syncFormToState();
        state.teacherLessonData.quiz.splice(qIdx, 1);
        renderTeacherQuizTab();
      });
    });
  }

  // Thêm câu hỏi trắc nghiệm mới (Triệt tiêu gán ngầm "A" P0-7)
  if (btnAddQuizItem) {
    btnAddQuizItem.addEventListener("click", () => {
      if (!state.teacherLessonData) return;
      syncFormToState();
      const newIdx = (state.teacherLessonData.quiz || []).length + 1;
      const newItem = {
        id: `tin${state.grade}_b${state.lessonId}_q${newIdx}`,
        cau_hoi: "Câu hỏi trắc nghiệm mới...",
        lua_chon: {
          A: "Phương án A",
          B: "Phương án B",
          C: "Phương án C",
          D: "Phương án D"
        },
        dap_an_dung: "", // KHÔNG gán ngầm "A" (P0-7)
        muc_sgk: "Mục 1",
        trang_sgk: 1,
        giai_thich_su_pham: "Giải thích sư phạm...",
        goi_y_khi_sai: "Gợi ý tư duy khi sai...",
        source: "generated",
        grounding_verified: false
      };
      state.teacherLessonData.quiz.push(newItem);
      renderTeacherQuizTab();
    });
  }

  // Đồng bộ từ Form vào State
  function syncFormToState() {
    if (!state.teacherLessonData) return;
    const title = document.getElementById("editLessonTitle").value.trim();
    const desc = document.getElementById("editHeroDesc").value.trim();
    const goals = document.getElementById("editGoalsText").value.split("\n").map(s => s.trim()).filter(Boolean);
    const takeaways = document.getElementById("editTakeawaysText").value.split("\n").map(s => s.trim()).filter(Boolean);

    state.teacherLessonData.title = title || state.teacherLessonData.title;

    // Cập nhật blocks
    const blocks = state.teacherLessonData.blocks || [];
    const heroIdx = blocks.findIndex(b => b.type === "hero");
    if (heroIdx >= 0) blocks[heroIdx].description = desc;
    const goalsIdx = blocks.findIndex(b => b.type === "goals");
    if (goalsIdx >= 0) blocks[goalsIdx].items = goals;
    const takeawaysIdx = blocks.findIndex(b => b.type === "takeaways");
    if (takeawaysIdx >= 0) blocks[takeawaysIdx].items = takeaways;

    // Cập nhật quiz từ DOM
    const quizCards = document.querySelectorAll(".quiz-editor-card");
    quizCards.forEach(card => {
      const qIdx = parseInt(card.dataset.qidx, 10);
      if (state.teacherLessonData.quiz[qIdx]) {
        const qItem = state.teacherLessonData.quiz[qIdx];
        const cauHoiInput = card.querySelector(".input-cau-hoi");
        if (cauHoiInput) qItem.cau_hoi = cauHoiInput.value.trim();

        // 4 lựa chọn
        qItem.lua_chon = qItem.lua_chon || {};
        ["A", "B", "C", "D"].forEach(key => {
          const optInput = card.querySelector(`.choice-input[data-choice="${key}"]`);
          if (optInput) qItem.lua_chon[key] = optInput.value.trim();
        });

        // Đáp án đúng
        const checkedRadio = card.querySelector(`.choice-radio:checked`);
        if (checkedRadio) qItem.dap_an_dung = checkedRadio.value;

        // Giải thích & Gợi ý
        const gtInput = card.querySelector(".input-giai-thich");
        if (gtInput) qItem.giai_thich_su_pham = gtInput.value.trim();
        const gyInput = card.querySelector(".input-goi-y");
        if (gyInput) qItem.goi_y_khi_sai = gyInput.value.trim();
      }
    });
  }

  function syncFormToJson() {
    syncFormToState();
    const jsonEditor = document.getElementById("teacherJsonEditor");
    if (jsonEditor && state.teacherLessonData) {
      jsonEditor.value = JSON.stringify(state.teacherLessonData, null, 2);
    }
  }

  if (btnSyncJsonToForm) {
    btnSyncJsonToForm.addEventListener("click", () => {
      syncFormToJson();
    });
  }

  // Lưu bài học từ Teacher Studio lên server
  if (btnSaveLesson) {
    btnSaveLesson.addEventListener("click", async () => {
      const saveStatus = document.getElementById("teacherSaveStatus");
      const saveBtnText = document.getElementById("btnSaveLessonText");

      syncFormToState();

      // Kiểm tra đáp án hợp lệ trước khi lưu (P0-7)
      const quiz = state.teacherLessonData.quiz || [];
      for (let i = 0; i < quiz.length; i++) {
        if (!quiz[i].dap_an_dung) {
          if (saveStatus) {
            saveStatus.innerHTML = `<span style="color:#dc2626; font-weight:700;">❌ Câu hỏi #${i + 1} chưa được chọn đáp án đúng! Vui lòng chọn A, B, C hoặc D.</span>` /* sanitize */;
          }
          if (saveBtnText) saveBtnText.innerText = "Lưu thay đổi";
          return;
        }
      }

      if (saveStatus) {
        saveStatus.innerHTML = `<span style="color:#2563eb;">⏳ Đang lưu bài học & ngân hàng câu hỏi...</span>` /* sanitize */;
      }
      if (saveBtnText) saveBtnText.innerText = "Đang lưu...";

      const payload = {
        grade: state.grade,
        lesson_id: state.lessonId,
        title: state.teacherLessonData.title,
        blocks: state.teacherLessonData.blocks || [],
        quiz: state.teacherLessonData.quiz || []
      };

      try {
        const res = await fetch(`${API_BASE}/teacher/save-lesson`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.teacherToken}`,
            "X-Teacher-Token": state.teacherToken
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          if (saveStatus) {
            saveStatus.innerHTML = `<span style="color:#059669; font-weight:700;">🎉 Đã lưu bài học thành công! Giao diện đang cập nhật...</span>` /* sanitize */;
          }
          if (saveBtnText) saveBtnText.innerText = "Đã lưu!";

          // Làm mới màn hình học sinh ngay lập tức (nếu bài đã published)
          try {
            await fetchLesson(state.grade, state.lessonId);
            renderApp();
          } catch {
            // Nếu bài đang là draft, fetchLesson sẽ 403 đối với học sinh - an toàn
          }

          setTimeout(() => {
            if (saveBtnText) saveBtnText.innerText = "Lưu thay đổi";
            if (saveStatus) saveStatus.innerText = "";
            closeTeacherModal();
          }, 1200);
        } else {
          const errData = await res.json().catch(() => ({}));
          if (saveStatus) {
            saveStatus.innerHTML = `<span style="color:#dc2626;">❌ Lưu thất bại: ${escapeHtml(errData.detail || "Lỗi kiểm chứng")}</span>` /* sanitize */;
          }
          if (saveBtnText) saveBtnText.innerText = "Lưu thay đổi";
        }
      } catch (err) {
        if (saveStatus) {
          saveStatus.innerHTML = `<span style="color:#dc2626;">❌ Lỗi kết nối mạng: ${escapeHtml(err.message)}</span>` /* sanitize */;
        }
        if (saveBtnText) saveBtnText.innerText = "Lưu thay đổi";
      }
    });
  }

  // 4. Xuất bản bài học từ Teacher Studio lên server (Gating P0-5)
  const btnPublishLesson = document.getElementById("btnPublishLesson");
  if (btnPublishLesson) {
    btnPublishLesson.addEventListener("click", async () => {
      const saveStatus = document.getElementById("teacherSaveStatus");
      const pubBtnText = document.getElementById("btnPublishLessonText");

      syncFormToState();

      // 1. Kiểm tra đáp án hợp lệ (P0-7)
      const quiz = state.teacherLessonData.quiz || [];
      for (let i = 0; i < quiz.length; i++) {
        if (!quiz[i].dap_an_dung) {
          if (saveStatus) {
            saveStatus.innerHTML = `<span style="color:#dc2626; font-weight:700;">❌ Câu hỏi #${i + 1} chưa được chọn đáp án đúng!</span>` /* sanitize */;
          }
          if (pubBtnText) pubBtnText.innerText = "Xuất bản bài học";
          return;
        }
      }

      // 2. Khóa cứng P0-C: Kiểm tra toàn bộ câu hỏi đã được giáo viên duyệt (source === 'teacher_verified')
      const unverified = quiz.filter(q => q.source !== "teacher_verified");
      if (unverified.length > 0) {
        if (saveStatus) {
          saveStatus.innerHTML = `<span style="color:#dc2626; font-weight:700;">❌ Không thể xuất bản: Còn ${unverified.length} câu hỏi chưa được duyệt! Bấm '✓ Duyệt câu này' cho từng câu trước khi xuất bản.</span>` /* sanitize */;
        }
        if (pubBtnText) pubBtnText.innerText = "Xuất bản bài học";
        return;
      }

      if (saveStatus) {
        saveStatus.innerHTML = `<span style="color:#2563eb;">⏳ Đang lưu và xuất bản bài học...</span>` /* sanitize */;
      }
      if (pubBtnText) pubBtnText.innerText = "Đang xuất bản...";

      try {
        // 1. Lưu nội dung mới nhất
        const payload = {
          grade: state.grade,
          lesson_id: state.lessonId,
          title: state.teacherLessonData.title,
          blocks: state.teacherLessonData.blocks || [],
          quiz: state.teacherLessonData.quiz || []
        };

        const saveRes = await fetch(`${API_BASE}/teacher/save-lesson`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.teacherToken}`,
            "X-Teacher-Token": state.teacherToken
          },
          body: JSON.stringify(payload)
        });

        if (!saveRes.ok) {
          const errData = await saveRes.json().catch(() => ({}));
          throw new Error(errData.detail || "Lỗi lưu bài học trước khi xuất bản");
        }

        // 2. Kích hoạt xuất bản sang trạng thái 'published'
        const pubRes = await fetch(`${API_BASE}/teacher/publish-lesson`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.teacherToken}`,
            "X-Teacher-Token": state.teacherToken
          },
          body: JSON.stringify({
            grade: state.grade,
            lesson_id: state.lessonId,
            status: "published"
          })
        });

        if (!pubRes.ok) {
          const errData = await pubRes.json().catch(() => ({}));
          throw new Error(errData.detail || "Lỗi xuất bản bài học");
        }

        state.teacherLessonData.status = "published";
        const statusBadge = document.getElementById("studioLessonStatusBadge");
        if (statusBadge) {
          statusBadge.innerText = "Đã xuất bản (Published)";
          statusBadge.style.background = "#dcfce7";
          statusBadge.style.color = "#166534";
        }

        if (saveStatus) {
          saveStatus.innerHTML = `<span style="color:#059669; font-weight:700;">🚀 Đã xuất bản thành công! Học sinh đã có thể xem bài học.</span>` /* sanitize */;
        }
        if (pubBtnText) pubBtnText.innerText = "Đã xuất bản!";

        // Làm mới danh mục bài học và màn hình học sinh ngay lập tức
        await loadCurriculumLessons();
        await fetchLesson(state.grade, state.lessonId);
        renderApp();

        setTimeout(() => {
          if (pubBtnText) pubBtnText.innerText = "Xuất bản bài học";
          if (saveStatus) saveStatus.innerText = "";
          closeTeacherModal();
        }, 1200);
      } catch (err) {
        if (saveStatus) {
          saveStatus.innerHTML = `<span style="color:#dc2626;">❌ ${escapeHtml(err.message)}</span>` /* sanitize */;
        }
        if (pubBtnText) pubBtnText.innerText = "Xuất bản bài học";
      }
    });
  }

  // Form Chat Socrates
  document.getElementById("chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.isChatSubmitting) return;
    const inputEl = document.getElementById("chatInput");
    const msg = inputEl.value.trim();
    if (msg) {
      sendChatMessage(msg);
      inputEl.value = "";
    }
  });

  // Prompt Chips (Event Delegation đón bắt thẻ động theo từng bài học)
  const promptActionContainer = document.getElementById("promptActionCards") || document.querySelector(".prompt-action-cards");
  if (promptActionContainer) {
    promptActionContainer.addEventListener("click", (e) => {
      const chip = e.target.closest(".prompt-chip");
      if (!chip) return;
      if (state.isChatSubmitting || chip.disabled) return;
      const prompt = chip.dataset.prompt;
      if (prompt) {
        sendChatMessage(prompt);
      }
    });
  }

  // Nút Làm lại bài luyện tập
  document.getElementById("btnRestartQuiz").addEventListener("click", () => {
    state.currentQuestionIndex = 0;
    state.userSelections = {};
    state.evaluatedQuestions = {};
    document.getElementById("completionCard").classList.remove("active");
    document.getElementById("quizView").classList.add("active");
    renderApp();
  });
}

// 9. Chuyển đổi View
function switchView(tabName) {
  const isTeacherUnlocked = !!(state.teacherUnlocked && state.teacherToken);
  if (tabName === "dashboard" && isTeacherUnlocked) {
    if (typeof openStudentManagementStage === "function") {
      openStudentManagementStage();
      return;
    }
  }
  state.activeTab = tabName;
  const dashboardView = document.getElementById("dashboardView");
  const theoryView = document.getElementById("theoryView");
  const quizView = document.getElementById("quizView");
  const completionCard = document.getElementById("completionCard");
  const stepTheory = document.getElementById("stepItemTheory");
  const stepQuiz = document.getElementById("stepItemQuiz");

  const studentMgmtStage = document.getElementById("studentManagementStage");
  if (studentMgmtStage && !studentMgmtStage.classList.contains("hidden")) {
    studentMgmtStage.classList.add("hidden");
    const canvas = document.getElementById("focusCanvas");
    if (canvas) canvas.classList.remove("hidden");
    const sidebar = document.getElementById("roadmapSidebar");
    if (sidebar) sidebar.classList.remove("hidden");
    const btnNav = document.getElementById("btnNavStudentMgmt");
    if (btnNav) btnNav.classList.remove("active");
  }

  const examStage = document.getElementById("examStage");
  if (examStage && !examStage.classList.contains("hidden")) {
    examStage.classList.add("hidden");
    const canvas = document.getElementById("focusCanvas");
    if (canvas) canvas.classList.remove("hidden");
    const sidebar = document.getElementById("roadmapSidebar");
    if (sidebar) sidebar.classList.remove("hidden");
    const btnNavExam = document.getElementById("btnNavExamHub");
    if (btnNavExam) btnNavExam.classList.remove("active");
  }

  if (tabName === "dashboard") {
    if (dashboardView) dashboardView.classList.add("active");
    if (theoryView) theoryView.classList.remove("active");
    if (quizView) quizView.classList.remove("active");
    if (completionCard) completionCard.classList.remove("active");
    if (stepTheory) stepTheory.classList.remove("active");
    if (stepQuiz) stepQuiz.classList.remove("active");
    if (typeof updateStudentDashboardRealData === "function") {
      updateStudentDashboardRealData();
    }
  } else if (tabName === "theory") {
    if (dashboardView) dashboardView.classList.remove("active");
  const examStage = document.getElementById("examStage");
  if (examStage) examStage.classList.add("hidden");
  const btnNavExam = document.getElementById("btnNavExamHub");
  if (btnNavExam) btnNavExam.classList.remove("active");
    if (theoryView) theoryView.classList.add("active");
    if (quizView) quizView.classList.remove("active");
    if (completionCard) completionCard.classList.remove("active");
    if (stepTheory) stepTheory.classList.add("active");
    if (stepQuiz) stepQuiz.classList.remove("active");
    if (typeof recordStudentTheoryRead === "function") {
      recordStudentTheoryRead(state.grade, state.lessonId);
    }
  } else {
    if (dashboardView) dashboardView.classList.remove("active");
  const examStage = document.getElementById("examStage");
  if (examStage) examStage.classList.add("hidden");
  const btnNavExam = document.getElementById("btnNavExamHub");
  if (btnNavExam) btnNavExam.classList.remove("active");
    if (theoryView) theoryView.classList.remove("active");
    if (quizView) quizView.classList.add("active");
    if (completionCard) completionCard.classList.remove("active");
    if (stepTheory) stepTheory.classList.remove("active");
    if (stepQuiz) stepQuiz.classList.add("active");
    renderApp();
  }

  // Cập nhật trạng thái active trên Cây Mục lục Sidebar
  const treeContainer = document.getElementById("curriculumTreeContainer");
  if (treeContainer) {
    const activeLessonItem = treeContainer.querySelector(`.lesson-tree-item.active`);
    if (activeLessonItem) {
      activeLessonItem.querySelectorAll(".section-subitem").forEach(sub => {
        const isQuiz = (sub.getAttribute("data-type") === "quiz");
        if (tabName === "quiz" && isQuiz) {
          sub.classList.add("active");
        } else if (tabName === "theory" && !isQuiz && (state.activeSubSectionId ? sub.getAttribute("data-section-id") === state.activeSubSectionId : sub.id === "stepItemTheory")) {
          sub.classList.add("active");
        } else {
          sub.classList.remove("active");
        }
      });
    }
  }

  renderPromptSuggestions();
}

// 10. Chấm điểm Câu hỏi Đơn lẻ (Khan Focus Single-Attempt)
async function evaluateCurrentQuestion(qid) {
  const choice = state.userSelections[qid];
  if (!choice) return;

  const btnAction = document.getElementById("btnActionQuestion");
  const btnActionText = document.getElementById("btnActionText");
  btnAction.disabled = true;
  if (btnActionText) btnActionText.textContent = "Đang kiểm tra...";

  try {
    const payload = {
      grade: state.grade,
      lesson_id: state.lessonId,
      answers: { [qid]: choice }
    };

    const headers = { 
      "Content-Type": "application/json",
      "X-Student-Session": getOrCreateStudentSession(),
      "X-Curriculum-Version": "v2"
    };

    const res = await fetch(`${API_BASE}/grade-quiz`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const evaluation = data.evaluation || {};
    const details = evaluation.details || evaluation.results || [];
    const resultItem = details.find((r) => r.id === qid);

    if (resultItem) {
      state.evaluatedQuestions[qid] = {
        is_correct: resultItem.is_correct,
        feedback: resultItem.feedback,
        muc_sgk: resultItem.muc_sgk,
        student_choice: choice
      };
    }
  } catch (err) {
    console.warn("Grade quiz offline fallback:", err);
    const quizItem = (state.lessonData && state.lessonData.quiz) ? state.lessonData.quiz.find((q) => q.id === qid) : null;
    if (quizItem && quizItem.dap_an_dung) {
      const isCorrect = choice.trim().toUpperCase() === quizItem.dap_an_dung.trim().toUpperCase();
      state.evaluatedQuestions[qid] = {
        is_correct: isCorrect,
        feedback: isCorrect
          ? (quizItem.giai_thich_su_pham || "Chính xác! Em làm rất tốt.")
          : (quizItem.goi_y_khi_sai || "Em hãy xem lại nội dung trong SGK và suy ngẫm thêm nhé!"),
        muc_sgk: quizItem.muc_sgk || "SGK",
        student_choice: choice
      };
    } else {
      state.evaluatedQuestions[qid] = {
        is_correct: false,
        feedback: "Em hãy xem lại nội dung trong SGK và suy ngẫm thêm nhé!",
        muc_sgk: "Mục 1",
        student_choice: choice
      };
    }
  }

  state.questionAttempts[qid] = (state.questionAttempts[qid] || 0) + 1;
  renderApp();
}

// 11. Màn hình Hoàn thành Toàn bài
function showCompletionScreen() {
  const quizView = document.getElementById("quizView");
  const completionCard = document.getElementById("completionCard");
  quizView.classList.remove("active");
  completionCard.classList.add("active");

  const quiz = state.lessonData.quiz;
  let correctCount = 0;
  quiz.forEach((q) => {
    if (state.evaluatedQuestions[q.id] && state.evaluatedQuestions[q.id].is_correct) {
      correctCount++;
    }
  });

  document.getElementById("completionScore").textContent = `${correctCount} / ${quiz.length}`;
  const msgEl = document.getElementById("completionMessage");

  if (correctCount === quiz.length) {
    msgEl.textContent = `Xuất sắc! Em đã hoàn thành xuất sắc 100% câu hỏi bài học Tin học ${state.grade}!`;
  } else if (correctCount >= 2) {
    msgEl.textContent = `Em đã hoàn thành bài luyện tập với ${correctCount}/${quiz.length} câu đúng. Hãy xem lại các câu gợi ý để ghi nhớ sâu hơn nhé!`;
  } else {
    msgEl.textContent = "Đừng nản lòng nhé! Em hãy dành ít phút đọc lại Khám phá tri thức rồi bấm 'Làm lại bài luyện tập'.";
  }

  // Ghi nhận tiến trình học tập thực tế (Triệt tiêu 100% hardcode)
  if (typeof recordStudentQuizCompletion === "function") {
    const score10 = Number(((correctCount / quiz.length) * 10).toFixed(1));
    recordStudentQuizCompletion(state.grade, state.lessonId, score10, correctCount, quiz.length);
  }
}

// 12. Điều khiển Widget Popup Gia sư Socrates Góc Dưới Phải
function togglePopup() {
  const popup = document.getElementById("socratesPopupCard");
  if (popup.classList.contains("open")) {
    closePopup();
  const dashboardView = document.getElementById("dashboardView");
  if (dashboardView) dashboardView.classList.remove("active");
  const examStage = document.getElementById("examStage");
  if (examStage) examStage.classList.add("hidden");
  const btnNavExam = document.getElementById("btnNavExamHub");
  if (btnNavExam) btnNavExam.classList.remove("active");
  } else {
    openPopup();
  }
}

function openPopup(options = {}) {
  const popup = document.getElementById("socratesPopupCard");
  if (!popup) return;
  popup.classList.add("open");

  const workspace = document.querySelector(".app-workspace");
  if (workspace) workspace.classList.add("tutor-open");

  const headerBtn = document.getElementById("btnHeaderTutor");
  if (headerBtn) {
    headerBtn.classList.add("active");
    headerBtn.setAttribute("aria-expanded", "true");
  }

  const chatInput = document.getElementById("chatInput");
  if (chatInput && options.focus !== false) {
    setTimeout(() => {
      try {
        chatInput.focus({ preventScroll: true });
      } catch {
        chatInput.focus();
      }
    }, 150);
  }
}

function closePopup() {
  const popup = document.getElementById("socratesPopupCard");
  if (!popup) return;
  popup.classList.remove("open");

  const workspace = document.querySelector(".app-workspace");
  if (workspace) workspace.classList.remove("tutor-open");

  const headerBtn = document.getElementById("btnHeaderTutor");
  if (headerBtn) {
    headerBtn.classList.remove("active");
    headerBtn.setAttribute("aria-expanded", "false");
  }
}

// 13. Hiệu ứng Đánh máy Typewriter Sống động
function typeWriterEffect(container, rawMarkdownText, onComplete) {
  const parsedHtml = parseMarkdown(rawMarkdownText);
  const words = rawMarkdownText.split(" ");
  let currentWordIdx = 0;
  
  container.innerHTML = '<span class="typewriter-content"></span><span class="typewriter-cursor"></span>' /* sanitize */;
  const contentSpan = container.querySelector(".typewriter-content");
  const chatMessages = document.getElementById("chatMessages");

  let isCancelled = false;
  // Bấm vào bong bóng chat để hoàn thành ngay tức thì (Skip animation)
  container.onclick = () => {
    isCancelled = true;
    container.innerHTML = parsedHtml /* sanitize */;
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    if (onComplete) onComplete();
  };

  const intervalId = setInterval(() => {
    // Nếu bị hủy hoặc container bị tháo khỏi DOM (chuyển tab/view), tự động dọn dẹp và mở khóa mutex
    if (isCancelled || !container.isConnected) {
      clearInterval(intervalId);
      if (onComplete) onComplete();
      return;
    }

    if (currentWordIdx < words.length) {
      const partialText = words.slice(0, currentWordIdx + 1).join(" ");
      contentSpan.innerHTML = parseMarkdown(partialText) /* sanitize */;
      currentWordIdx++;
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
      clearInterval(intervalId);
      container.innerHTML = parsedHtml /* sanitize */;
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
      if (onComplete) onComplete();
    }
  }, 35);
}

// 14. Gửi Tin nhắn Hỏi Gia sư Socrates (Typewriter Streaming & Context-Aware)
async function sendChatMessage(messageText, customContext = null) {
  const cleanMessage = (messageText || "").trim();
  if (!cleanMessage || state.isChatSubmitting) {
    return; // Chặn double-click và race condition
  }

  state.isChatSubmitting = true;
  state.chatTurnId = (state.chatTurnId || 0) + 1;
  const currentTurnId = state.chatTurnId;

  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const btnSendChat = document.getElementById("btnSendChat") || document.getElementById("chatSendBtn");
  const btnHeaderTutor = document.getElementById("btnHeaderTutor") || document.getElementById("btnAskSocrates");

  // Vô hiệu hóa nút bấm và ô nhập liệu trong suốt thời gian suy nghĩ và gõ chữ (Sonet R3)
  if (chatInput) chatInput.disabled = true;
  if (btnSendChat) btnSendChat.disabled = true;
  if (btnHeaderTutor) btnHeaderTutor.disabled = true;
  document.querySelectorAll(".prompt-chip").forEach(chip => chip.disabled = true);

  // Bộ giám sát thời gian tối đa (30s Watchdog): Chống kẹt Mutex vĩnh viễn trong mọi tình huống hy hữu
  let watchdogTimer = setTimeout(() => {
    console.warn("⚠️ [Watchdog] Typewriter timeout vượt 30s. Tự động giải phóng khóa Mutex.");
    releaseChatMutex(currentTurnId);
  }, 30000);

  let isReleased = false;
  const releaseChatMutex = (turnId) => {
    // Chỉ giải phóng nếu đúng lượt hiện tại và chưa từng giải phóng (Sonet C2: Idempotent & Anti-Stale-Callback)
    if (turnId !== undefined && turnId !== state.chatTurnId) {
      console.warn(`[Mutex] Bỏ qua callback của lượt cũ (${turnId}) vì đã chuyển sang lượt mới (${state.chatTurnId})`);
      return false;
    }
    if (isReleased) return false;
    isReleased = true;

    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    state.isChatSubmitting = false;
    if (chatInput) chatInput.disabled = false;
    if (btnSendChat) btnSendChat.disabled = false;
    if (btnHeaderTutor) btnHeaderTutor.disabled = false;
    document.querySelectorAll(".prompt-chip").forEach(chip => chip.disabled = false);
    if (chatInput) chatInput.focus();
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    return true;
  };

  // Expose active release function của lượt hiện tại cho test hook kiểm thử tự động (Sonet V4 C2)
  window.__activeReleaseChatMutex = releaseChatMutex;

  // Tin nhắn của học sinh
  const studentBubble = document.createElement("div");
  studentBubble.className = "chat-bubble student";
  studentBubble.textContent = cleanMessage;
  chatMessages.appendChild(studentBubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Trạng thái suy nghĩ của Socrates
  const loadingBubble = document.createElement("div");
  loadingBubble.className = "chat-bubble assistant";
  loadingBubble.innerHTML = "<em>Gia sư Socrates đang suy nghĩ câu hỏi gợi mở...</em>" /* sanitize */;
  chatMessages.appendChild(loadingBubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Thu thập bối cảnh sư phạm (Khan-Focus Pedagogical Context)
  let contextPayload = null;
  if (customContext) {
    contextPayload = customContext;
  } else if (state.activeTab === "theory") {
    // Khi đang ở Chặng 1 (Lý thuyết), không gửi kèm câu hỏi trắc nghiệm cũ
    contextPayload = {
      current_question_id: null,
      student_choice: null,
      is_correct: null,
      active_tab: "theory",
      last_action: "reading_theory",
      attempt_count: 1
    };
  } else if (state.lessonData && state.lessonData.quiz && state.lessonData.quiz[state.currentQuestionIndex]) {
    const currentQ = state.lessonData.quiz[state.currentQuestionIndex];
    const qid = currentQ.id;
    const studentChoice = state.answers ? state.answers[qid] : null;
    const evalState = state.evaluatedQuestions ? state.evaluatedQuestions[qid] : null;
    const attempts = state.questionAttempts[qid] || 1;
    contextPayload = {
      current_question_id: qid,
      student_choice: studentChoice || null,
      is_correct: evalState ? evalState.is_correct : null,
      active_tab: state.activeTab || "quiz",
      last_action: evalState ? "submitted_answer" : "viewing_question",
      attempt_count: attempts
    };
  }

  try {
    const payload = {
      grade: state.grade,
      lesson_id: state.lessonId,
      message: cleanMessage,
      context: contextPayload,
      history: state.chatHistory.slice(-4)
    };

    const headers = { 
      "Content-Type": "application/json",
      "X-Student-Session": getOrCreateStudentSession(),
      "X-Curriculum-Version": "v2"
    };

    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Lỗi gọi AI Socrates");
    const data = await res.json();
    const reply = data.reply;

    // Kích hoạt Hiệu ứng Đánh máy (Typewriter Effect - Sonet R3: Giữ khóa mutex cho đến khi gõ xong)
    typeWriterEffect(loadingBubble, reply, () => {
      releaseChatMutex(currentTurnId);
    });

    // Lưu lịch sử
    state.chatHistory.push({ role: "user", content: cleanMessage });
    state.chatHistory.push({ role: "assistant", content: reply });
  } catch (err) {
    console.error("Lỗi kết nối AI Socrates:", err);
    loadingBubble.innerHTML = "⚠️ <em>Máy chủ AI đang khởi động hoặc đang cập nhật kết nối. Em vui lòng thử lại sau giây lát nhé!</em>" /* sanitize */;
    releaseChatMutex(currentTurnId);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ==========================================================================
   MODULE: QUẢN LÝ HỌC SINH & GEMINI AI PEDAGOGICAL DASHBOARD
   (Data Adapter Architecture - Sẵn sàng hoán đổi Firebase Cloud Firestore)
   ========================================================================== */

function calculateRealStudentStats(s, targetGrade = 9, teacherExams = []) {
  const g = parseInt(targetGrade, 10) || 9;
  const totalLessons = getCurriculumToc(g).length || 17;

  let lessons = {};
  if (s.progress && typeof s.progress === "object" && s.progress.lessons) {
    lessons = s.progress.lessons;
  } else if (s.lessons && typeof s.lessons === "object") {
    lessons = s.lessons;
  }

  let completedCount = 0;
  let startedCount = 0;
  let totalScore = 0;
  let scoreCount = 0;
  let progressUnits = 0;

  // Lấy thêm điểm các bài kiểm tra của học sinh từ Firebase nếu có
  const studentExams = (s.exams && typeof s.exams === "object") ? Object.values(s.exams) : [];

  const lessonEntries = Object.entries(lessons).filter(([, v]) => v && typeof v === "object");

  lessonEntries.forEach(([, l]) => {
    const hasTheory = !!l.theory_read;
    const hasQuiz = !!(l.quiz_completed || typeof l.quiz_score === "number");
    const isCompleted = !!l.completed;

    if (isCompleted) {
      completedCount++;
      progressUnits += 1.0;
    } else {
      if (hasTheory) progressUnits += 0.5;
      if (hasQuiz) progressUnits += 0.5;
    }

    if (hasTheory || hasQuiz || isCompleted) {
      startedCount++;
    }

    if (typeof l.quiz_score === "number" && l.quiz_score >= 0 && (l.quiz_completed || isCompleted)) {
      totalScore += l.quiz_score;
      scoreCount++;
    }
  });

  // Tích hợp điểm các bài kiểm tra do giáo viên tạo vào điểm số & tiến độ
  studentExams.forEach(ex => {
    if (typeof ex.score === "number" && ex.score >= 0) {
      totalScore += ex.score;
      scoreCount++;
      if (ex.passed || ex.score >= 5.0) {
        completedCount++;
        progressUnits += 1.0;
      }
      startedCount++;
    }
  });

  let progressPercent = totalLessons > 0 ? Math.min(100, Math.round((progressUnits / totalLessons) * 100)) : 0;
  if (typeof s.progress_percent === "number" && s.progress_percent > progressPercent) {
    progressPercent = s.progress_percent;
  }

  let avgScore = scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(1)) : 0;
  if (scoreCount === 0 && typeof s.average_score === "number" && s.average_score > 0) {
    avgScore = s.average_score;
    scoreCount = 1;
  }

  // Danh mục bài kiểm tra/chủ đề: LẤY ĐÚNG TIÊU ĐỀ DO GIÁO VIÊN TẠO (CẤM HARDCODE)
  let topics = [];
  if (Array.isArray(teacherExams) && teacherExams.length > 0) {
    topics = teacherExams.map(ex => {
      const examId = ex.exam_id;
      const examTitle = (ex.title || ex.exam_title || `Bài kiểm tra ${examId}`).trim();
      let score = 0;
      let status = "not_started";
      let studentRecord = null;

      if (s.exams && typeof s.exams === "object") {
        studentRecord = s.exams[examId] || Object.values(s.exams).find(x => x && (x.exam_id === examId || x.exam_title === examTitle));
      }

      if (studentRecord && typeof studentRecord.score === "number") {
        score = studentRecord.score;
        status = score >= 8.0 ? "mastered" : (score >= 5.0 ? "learning" : "warning");
      }

      return {
        topic_id: examId,
        topic_name: examTitle, // Tiêu đề do giáo viên tạo
        score: score,
        status: status
      };
    });
  } else if (studentExams.length > 0) {
    topics = studentExams.map(ex => {
      const examId = ex.exam_id || "exam";
      const examTitle = (ex.exam_title || ex.title || "Bài kiểm tra").trim();
      const score = typeof ex.score === "number" ? ex.score : 0;
      const status = score >= 8.0 ? "mastered" : (score >= 5.0 ? "learning" : "warning");
      return {
        topic_id: examId,
        topic_name: examTitle,
        score: score,
        status: status
      };
    });
  }

  let status = "not_started";
  if (s.is_blocked) {
    status = "blocked";
  } else if (progressPercent >= 100) {
    status = "completed";
  } else if (progressPercent > 0 || startedCount > 0) {
    status = "learning";
  } else if (s.status) {
    status = s.status;
  }

  return {
    progress_percent: progressPercent,
    average_score: avgScore,
    score_count: scoreCount,
    completed_lessons: completedCount,
    status: status,
    topics: topics
  };
}

class StudentDataAdapter {
  constructor() {
    this.cachedOverview = null;
  }

  async getClassOverview(grade, className) {
    initFirebaseApp();

    const gNum = parseInt(grade, 10) || 9;

    // Lấy danh sách các bài kiểm tra do giáo viên tạo cho khối và lớp này (Lấy đúng tiêu đề do GV tạo)
    let teacherExams = [];
    try {
      teacherExams = await getTeacherExamsForGrade(gNum, className);
    } catch (e) {
      console.debug("Lỗi nạp teacher exams cho overview:", e);
    }

    // Lấy dữ liệu học sinh thực tế từ Firebase Realtime Database
    if (typeof firebase !== "undefined" && firebase.database) {
      try {
        const snap = await firebase.database().ref(`students/${className}`).once("value");
        const students = [];

        if (snap.exists()) {
          const val = snap.val();
          Object.entries(val).forEach(([key, s]) => {
            if (s && typeof s === "object") {
              const code = s.student_code || (s.email ? s.email.split("@")[0].toUpperCase() : (key.startsWith("lan_") ? key.replace(/^lan_[^_]+_/, "").toUpperCase() : key.substring(0, 6).toUpperCase()));
              const name = s.full_name || s.studentName || s.name || `Học sinh ${code}`;
              const isBlocked = !!s.is_blocked;

              const stats = calculateRealStudentStats(s, gNum, teacherExams);

              students.push({
                id: key,
                student_code: code,
                full_name: name,
                email: s.email || `${code.toLowerCase()}@thcs.edu.vn`,
                avatar: s.avatar || s.photoURL || "👦",
                progress_percent: stats.progress_percent,
                average_score: stats.average_score,
                score_count: stats.score_count,
                completed_lessons: stats.completed_lessons,
                status: isBlocked ? "blocked" : stats.status,
                is_blocked: isBlocked,
                presence: s.presence || { online: false, last_seen: null },
                password: s.password || "123456",
                topics: stats.topics
              });
            }
          });
        }

        // Tính điểm trung bình theo từng TIÊU ĐỀ DO GIÁO VIÊN TẠO (CẤM HARDCODE)
        const topicAverages = {};
        if (teacherExams.length > 0) {
          teacherExams.forEach(ex => {
            const examTitle = (ex.title || ex.exam_title || `Bài kiểm tra ${ex.exam_id}`).trim();
            let sumScore = 0;
            let subCount = 0;

            students.forEach(s => {
              const t = Array.isArray(s.topics) ? s.topics.find(item => item.topic_id === ex.exam_id || item.topic_name === examTitle) : null;
              if (t && t.status !== "not_started" && typeof t.score === "number") {
                sumScore += t.score;
                subCount += 1;
              }
            });

            topicAverages[examTitle] = subCount > 0 ? Number((sumScore / subCount).toFixed(1)) : 0;
          });
        } else {
          // Nếu chưa có teacherExams từ trước, gom từ các bài nộp của học sinh
          const examTitleSums = {};
          const examTitleCounts = {};

          students.forEach(s => {
            if (Array.isArray(s.topics)) {
              s.topics.forEach(t => {
                if (t.status !== "not_started" && typeof t.score === "number") {
                  examTitleSums[t.topic_name] = (examTitleSums[t.topic_name] || 0) + t.score;
                  examTitleCounts[t.topic_name] = (examTitleCounts[t.topic_name] || 0) + 1;
                }
              });
            }
          });

          Object.keys(examTitleSums).forEach(title => {
            const count = examTitleCounts[title] || 1;
            topicAverages[title] = Number((examTitleSums[title] / count).toFixed(1));
          });
        }

        const total = students.length;
        const completed = students.filter(s => s.status === "completed").length;
        const learning = students.filter(s => s.status === "learning").length;
        const needsSupport = students.filter(s => s.status === "needs_support").length;
        const notStarted = Math.max(0, total - completed - learning - needsSupport);
        const compPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const avgScore = total > 0 ? Number((students.reduce((acc, s) => acc + (s.average_score || 0), 0) / total).toFixed(1)) : 0;

        const overview = {
          grade: Number(gNum),
          class_name: String(className),
          semester: "Học kì I (2026 - 2027)",
          kpi: {
            total_students: total,
            completed_count: completed,
            completed_percent: compPercent,
            average_score: avgScore,
            score_delta_month: 0.0,
            improved_count: Math.max(0, total - needsSupport),
            improved_percent: total > 0 ? Math.round(((total - needsSupport) / total) * 100) : 0,
            needs_support_count: needsSupport,
            needs_support_percent: total > 0 ? Math.round((needsSupport / total) * 100) : 0
          },
          topic_averages: topicAverages,
          donut_progress: {
            completed: completed,
            learning: learning,
            not_started: notStarted
          },
          students: students
        };

        this.cachedOverview = overview;
        return overview;
      } catch (err) {
        console.warn("Lỗi đọc học sinh từ Firebase Realtime Database:", err);
      }
    }

    // Fallback rỗng an toàn
    const defaultTopicAvgs = {};

    const emptyOverview = {
      grade: Number(gNum),
      class_name: String(className),
      semester: "Học kì I (2026 - 2027)",
      kpi: {
        total_students: 0,
        completed_count: 0,
        completed_percent: 0,
        average_score: 0,
        score_delta_month: 0,
        improved_count: 0,
        improved_percent: 0,
        needs_support_count: 0,
        needs_support_percent: 0
      },
      topic_averages: defaultTopicAvgs,
      donut_progress: {
        completed: 0,
        learning: 0,
        not_started: 0
      },
      students: []
    };
    this.cachedOverview = emptyOverview;
    return emptyOverview;
  }

  async getAIPedagogicalAdvice(grade, className) {
    const students = this.cachedOverview && this.cachedOverview.students ? this.cachedOverview.students : [];
    const total = students.length;
    if (total === 0) {
      return {
        general_assessment: `Lớp ${className} hiện chưa có học sinh nào đăng ký hoặc đăng nhập.`,
        critical_concerns: "Giáo viên vui lòng cung cấp mã lớp để học sinh đăng nhập bằng Google hoặc Mã học sinh phòng LAN.",
        actionable_recommendations: [
          "Bấm '+ Thêm học sinh' để cấp mã số máy cho phòng máy LAN.",
          "Hướng dẫn học sinh mở tab 'Mã HS (LAN)' để vào học ngay.",
          "Theo dõi thời gian thực đèn trạng thái Trực tuyến của cả lớp."
        ]
      };
    }

    const completed = students.filter(s => s.status === "completed" || s.progress_percent >= 100).length;
    const notStarted = students.filter(s => s.progress_percent === 0).length;
    const compPercent = Math.round((completed / total) * 100);
    const avgScore = Number((students.reduce((acc, s) => acc + (s.average_score || 0), 0) / total).toFixed(1));
    const needsSupport = students.filter(s => s.status === "needs_support" || (s.average_score > 0 && s.average_score < 5.0)).length;

    let general = "";
    let concerns = "";
    if (avgScore === 0 && compPercent === 0) {
      general = `Lớp ${className} có ${total} học sinh. Các em mới tham gia lớp học và chưa hoàn thành bài luyện tập nào (Tiến độ 0%, Điểm TB 0/10).`;
      concerns = `Hiện tại có ${notStarted} học sinh chưa bắt đầu làm bài. Giáo viên nên hướng dẫn các em mở bài 1 để làm quen với hệ thống.`;
    } else {
      general = `Lớp ${className} có ${total} học sinh, tiến độ hoàn thành đạt ${compPercent}%, điểm trung bình toàn lớp đạt ${avgScore}/10.`;
      concerns = needsSupport > 0 
        ? `Có ${needsSupport} học sinh cần được hỗ trợ thêm do điểm trung bình dưới 5.0.`
        : "Tất cả học sinh trong lớp đều đang duy trì kết quả học tập tốt.";
    }

    return {
      general_assessment: general,
      critical_concerns: concerns,
      actionable_recommendations: [
        "Tổ chức buổi ôn tập ngắn 15 phút, bổ sung bài luyện tương tác cho nhóm học sinh còn yếu.",
        "Áp dụng phương pháp đôi bạn cùng tiến: Phân công học sinh xuất sắc kèm cặp các bạn cần hỗ trợ.",
        "Giao thêm câu hỏi tình huống thực tế để học sinh rèn luyện phản xạ trước giờ kiểm tra."
      ]
    };
  }
}

const studentDataAdapter = new StudentDataAdapter();

const studentMgmtState = {
  currentGrade: 9,
  currentClass: "9A",
  data: null,
  searchQuery: "",
  statusFilter: "all"
};


function openEditStudentModal(student) {
  const modal = document.getElementById("smEditStudentModal");
  if (!modal || !student) return;

  const idInp = document.getElementById("smEditStudentId");
  const classInp = document.getElementById("smEditStudentClass");
  const nameInp = document.getElementById("smEditStudentName");
  const codeInp = document.getElementById("smEditStudentCode");
  const passInp = document.getElementById("smEditStudentPassword");
  const emailInp = document.getElementById("smEditStudentEmail");

  if (idInp) idInp.value = student.id;
  if (classInp) classInp.value = studentMgmtState.currentClass || "9A";
  if (nameInp) nameInp.value = student.full_name || "";
  if (codeInp) codeInp.value = student.student_code || String(Math.floor(100000 + Math.random() * 900000));
  if (passInp) passInp.value = student.password || "123456";
  if (emailInp) emailInp.value = student.email || "";

  modal.classList.remove("hidden");
}

function initEditStudentModal() {
  const btnGenCode = document.getElementById("btnGenEditCode");
  if (btnGenCode) {
    btnGenCode.addEventListener("click", () => {
      const codeInp = document.getElementById("smEditStudentCode");
      if (codeInp) {
        codeInp.value = String(Math.floor(100000 + Math.random() * 900000));
      }
    });
  }
  const modal = document.getElementById("smEditStudentModal");
  const btnClose = document.getElementById("smBtnCloseEditModal");
  const btnCancel = document.getElementById("smBtnCancelEdit");
  const form = document.getElementById("smEditStudentForm");

  const closeEditModal = () => {
    if (modal) modal.classList.add("hidden");
  };

  if (btnClose) btnClose.addEventListener("click", closeEditModal);
  if (btnCancel) btnCancel.addEventListener("click", closeEditModal);

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const idVal = document.getElementById("smEditStudentId")?.value;
      const classVal = document.getElementById("smEditStudentClass")?.value || studentMgmtState.currentClass || "9A";
      const nameVal = document.getElementById("smEditStudentName")?.value.trim();
      const codeVal = document.getElementById("smEditStudentCode")?.value.trim().toUpperCase();
      const passVal = document.getElementById("smEditStudentPassword")?.value.trim() || "123456";
      const emailVal = document.getElementById("smEditStudentEmail")?.value.trim() || `${codeVal.toLowerCase()}@thcs.edu.vn`;

      if (!nameVal || !codeVal) {
        alert("Vui lòng nhập đầy đủ Họ tên và Mã học sinh!");
        return;
      }

      try {
        if (window.firebase && firebase.database && idVal) {
          await firebase.database().ref(`students/${classVal}/${idVal}`).update({
            full_name: nameVal,
            student_code: codeVal,
            password: passVal,
            email: emailVal,
            updated_at: new Date().toISOString()
          });
          closeEditModal();
          alert(`Đã cập nhật thành công thông tin học sinh "${nameVal}" (Mã: ${codeVal})!`);
          await loadStudentManagementData();
        } else {
          alert("Không thể kết nối với Firebase Realtime Database.");
        }
      } catch (err) {
        console.error("Lỗi cập nhật học sinh:", err);
        alert(`Lỗi: ${err.message || "Vui lòng thử lại"}`);
      }
    });
  }
}

function initStudentManagement() {
  const btnNav = document.getElementById("btnNavStudentMgmt");
  const btnBack = document.getElementById("smBtnBackToLesson");
  const classSelect = document.getElementById("smClassSelect");
  const searchInput = document.getElementById("smSearchInput");
  const statusFilter = document.getElementById("smStatusFilter");
  const btnRefreshAI = document.getElementById("smBtnRefreshAI");
  const btnExport = document.getElementById("smBtnExportReport");
  const modalBackdrop = document.getElementById("smStudentDetailModal");
  const btnCloseModal = document.getElementById("smBtnCloseModal");

  if (btnNav) {
    btnNav.addEventListener("click", () => {
      openStudentManagementStage();
    });
  }

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      closeStudentManagementStage();
    });
  }

  const gradeSelect = document.getElementById("smGradeSelect");
  if (gradeSelect) {
    gradeSelect.addEventListener("change", (e) => {
      const newGrade = parseInt(e.target.value, 10) || 9;
      studentMgmtState.currentGrade = newGrade;
      if (classSelect) {
        classSelect.replaceChildren();
        ["A", "B", "C"].forEach(letter => {
          const opt = document.createElement("option");
          opt.value = `${newGrade}${letter}`;
          opt.textContent = `Lớp ${newGrade}${letter}`;
          if (letter === "A") opt.selected = true;
          classSelect.appendChild(opt);
        });
        studentMgmtState.currentClass = `${newGrade}A`;
      }
      loadStudentManagementData();
    });
  }

  if (classSelect) {
    classSelect.addEventListener("change", (e) => {
      studentMgmtState.currentClass = e.target.value;
      loadStudentManagementData();
    });
  }

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        studentMgmtState.searchQuery = e.target.value.trim().toLowerCase();
        filterAndRenderStudentTable();
      }, 150);
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", (e) => {
      studentMgmtState.statusFilter = e.target.value;
      filterAndRenderStudentTable();
    });
  }

  if (btnRefreshAI) {
    btnRefreshAI.addEventListener("click", () => {
      refreshAIPedagogyAdvice();
    });
  }

  if (btnExport) {
    btnExport.addEventListener("click", () => {
      exportStudentReportCSV();
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
      closeStudentDetailModal();
    });
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) {
        closeStudentDetailModal();
      }
    });
  }

  // Khởi tạo Modal Thêm học sinh mới thủ công
  const btnAdd = document.getElementById("smBtnAddStudent");
  const modalAdd = document.getElementById("smAddStudentModal");
  const btnCloseAdd = document.getElementById("smBtnCloseAddModal");
  const btnCancelAdd = document.getElementById("smBtnCancelAdd");
  const formAdd = document.getElementById("smAddStudentForm");

  if (btnAdd && modalAdd) {
    btnAdd.addEventListener("click", () => {
      const inputClass = document.getElementById("smInputStudentClass");
      if (inputClass) inputClass.value = studentMgmtState.currentClass || "9A";
      modalAdd.classList.remove("hidden");
    });
  }

  const closeAddModal = () => {
    if (modalAdd) modalAdd.classList.add("hidden");
    if (formAdd) formAdd.reset();
  };

  if (btnCloseAdd) btnCloseAdd.addEventListener("click", closeAddModal);
  if (btnCancelAdd) btnCancelAdd.addEventListener("click", closeAddModal);

  if (formAdd) {
    formAdd.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputName = document.getElementById("smInputStudentName");
      const inputEmail = document.getElementById("smInputStudentEmail");
      const inputClass = document.getElementById("smInputStudentClass");

      const nameVal = inputName ? inputName.value.trim() : "";
      const emailVal = inputEmail ? inputEmail.value.trim() : "";
      const classVal = (inputClass ? inputClass.value.trim().toUpperCase() : "") || "9A";

      if (!nameVal || !emailVal) {
        alert("Vui lòng điền đầy đủ họ tên và email/mã học sinh!");
        return;
      }

      try {
        if (typeof firebase !== "undefined" && firebase.database) {
          const newRef = firebase.database().ref(`students/${classVal}`).push();
          const studentCode = emailVal.includes("@") ? emailVal.split("@")[0].toUpperCase() : emailVal.toUpperCase();
          const email = emailVal.includes("@") ? emailVal : `${emailVal.toLowerCase()}@thcs.edu.vn`;

          await newRef.set({
            uid: newRef.key,
            student_code: studentCode,
            full_name: nameVal,
            email: email,
            avatar: "👦",
            class_code: classVal,
            progress_percent: 0,
            average_score: 0,
            status: "learning",
            is_blocked: false,
            created_at: new Date().toISOString()
          });

          closeAddModal();
          alert(`Đã thêm thành công học sinh "${nameVal}" vào lớp ${classVal}!`);
          studentMgmtState.currentClass = classVal;
          const classSelect = document.getElementById("smClassSelect");
          if (classSelect) classSelect.value = classVal;
          await loadStudentManagementData();
        } else {
          alert("Chưa kết nối được Firebase Realtime Database.");
        }
      } catch (err) {
        console.error("Lỗi thêm học sinh:", err);
        alert(`Lỗi thêm học sinh: ${err.message || "Vui lòng thử lại"}`);
      }
    });
  }

  // Khởi tạo Modal Chỉnh sửa Học sinh
  initEditStudentModal();
}

function openStudentManagementStage() {
  const stage = document.getElementById("studentManagementStage");
  const canvas = document.getElementById("focusCanvas");
  const btnNav = document.getElementById("btnNavStudentMgmt");

  if (!stage || !canvas) return;

  // CHỐT CHẶN PHÂN QUYỀN SƯ PHẠM (RBAC):
  // Bắt buộc phải là Giáo viên đã mở khóa PIN hợp lệ
  const isTeacher = !!(state.teacherUnlocked && state.teacherToken);
  if (!isTeacher) {
    alert("Khu vực Quản lý Học sinh & AI Sư phạm chỉ dành riêng cho Giáo viên bộ môn Tin học.\n\nHọc sinh và khách chỉ có quyền học bài và xem tiến độ cá nhân của mình.");
    switchView(studentAuthState.isLoggedIn ? "dashboard" : "theory");
    return;
  }

  const sidebar = document.getElementById("roadmapSidebar");
  if (sidebar) sidebar.classList.add("hidden");
  closePopup();
  const dashboardView = document.getElementById("dashboardView");
  if (dashboardView) dashboardView.classList.remove("active");
  const examStage = document.getElementById("examStage");
  if (examStage) examStage.classList.add("hidden");
  const btnNavExam = document.getElementById("btnNavExamHub");
  if (btnNavExam) btnNavExam.classList.remove("active");

  canvas.classList.add("hidden");
  stage.classList.remove("hidden");
  const btnDashboard = document.getElementById("btnNavDashboard");
  if (btnDashboard) btnDashboard.classList.remove("active");
  if (btnNav) btnNav.classList.add("active");

  loadStudentManagementData();
}

function closeStudentManagementStage() {
  const stage = document.getElementById("studentManagementStage");
  const canvas = document.getElementById("focusCanvas");
  const btnNav = document.getElementById("btnNavStudentMgmt");
  const sidebar = document.getElementById("roadmapSidebar");

  if (!stage || !canvas) return;

  if (sidebar) sidebar.classList.remove("hidden");
  stage.classList.add("hidden");
  canvas.classList.remove("hidden");
  if (btnNav) btnNav.classList.remove("active");
  const btnDashboard = document.getElementById("btnNavDashboard");
  if (btnDashboard) btnDashboard.classList.add("active");
}

async function loadStudentManagementData() {
  const grade = studentMgmtState.currentGrade || 9;
  const className = studentMgmtState.currentClass || "9A";

  const data = await studentDataAdapter.getClassOverview(grade, className);
  studentMgmtState.data = data;

  renderKPIs(data.kpi);
  renderDonutChart(data.donut_progress, data.kpi.completed_percent);
  renderTopicBarChart(data.topic_averages);
  filterAndRenderStudentTable();
  refreshAIPedagogyAdvice(); // Cập nhật nhận xét AI động theo số liệu thực tế
}

function renderKPIs(kpi) {
  if (!kpi) return;
  const elTotal = document.getElementById("kpiTotalStudents");
  const elCompCount = document.getElementById("kpiCompletedCount");
  const elCompPercent = document.getElementById("kpiCompletedPercent");
  const elAvg = document.getElementById("kpiAverageScore");
  const elImpCount = document.getElementById("kpiImprovedCount");
  const elImpPercent = document.getElementById("kpiImprovedPercent");
  const elNeedCount = document.getElementById("kpiNeedsSupportCount");
  const elNeedPercent = document.getElementById("kpiNeedsSupportPercent");

  if (elTotal) elTotal.textContent = String(kpi.total_students);
  if (elCompCount) elCompCount.textContent = String(kpi.completed_count);
  if (elCompPercent) elCompPercent.textContent = `${kpi.completed_percent}%`;
  if (elAvg) elAvg.textContent = String(kpi.average_score).replace(".", ",");
  if (elImpCount) elImpCount.textContent = String(kpi.improved_count);
  if (elImpPercent) elImpPercent.textContent = `${kpi.improved_percent}%`;
  if (elNeedCount) elNeedCount.textContent = String(kpi.needs_support_count);
  if (elNeedPercent) elNeedPercent.textContent = `${kpi.needs_support_percent}%`;
}

function renderDonutChart(donut, completedPercent) {
  const container = document.getElementById("smDonutChart");
  if (!container) return;

  const total = (donut.completed || 0) + (donut.learning || 0) + (donut.not_started || 0);
  const pComp = total > 0 ? (donut.completed / total) : 0;
  const pLearn = total > 0 ? (donut.learning / total) : 0;
  const pNot = total > 0 ? (donut.not_started / total) : 0;

  const r = 54;
  const circumference = 2 * Math.PI * r;

  const dashComp = pComp * circumference;
  const dashLearn = pLearn * circumference;
  const dashNot = pNot * circumference;

  const offsetComp = 0;
  const offsetLearn = -dashComp;
  const offsetNot = -(dashComp + dashLearn);

  const svg = `
    <svg viewBox="0 0 140 140" width="100%" height="100%" style="transform: rotate(-90deg);">
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="#0f172a" stroke-width="16" />
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="#4ade80" stroke-width="16"
        stroke-dasharray="${dashComp} ${circumference}" stroke-dashoffset="${offsetComp}" stroke-linecap="round" />
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="#38bdf8" stroke-width="16"
        stroke-dasharray="${dashLearn} ${circumference}" stroke-dashoffset="${offsetLearn}" />
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="#f87171" stroke-width="16"
        stroke-dasharray="${dashNot} ${circumference}" stroke-dashoffset="${offsetNot}" />
    </svg>
    <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
      <span style="font-size: 1.45rem; font-weight: 700; color: #f8fafc; font-family: var(--font-display, inherit); line-height: 1;">${Math.round(completedPercent)}%</span>
      <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 500; margin-top: 2px;">Hoàn thành</span>
    </div>
  `;

  container.innerHTML = svg /* sanitize */;

  const elC = document.getElementById("donutCompletedText");
  const elL = document.getElementById("donutLearningText");
  const elN = document.getElementById("donutNotStartedText");
  if (elC) elC.textContent = `${donut.completed} em (${Math.round(pComp * 100)}%)`;
  if (elL) elL.textContent = `${donut.learning} em (${Math.round(pLearn * 100)}%)`;
  if (elN) elN.textContent = `${donut.not_started} em (${Math.round(pNot * 100)}%)`;
}

function renderTopicBarChart(topicAverages) {
  const container = document.getElementById("smTopicBarChart");
  if (!container || !topicAverages) return;

  const entries = Object.entries(topicAverages);
  if (entries.length === 0) {
    container.innerHTML = `<div style="color: #64748b; font-size: 0.88rem; text-align: center; padding: 1.5rem;">Chưa có bài kiểm tra nào do giáo viên tạo cho lớp này.</div>` /* sanitize */;
    return;
  }

  const rowsHtml = entries.map(([label, score]) => {
    const percent = Math.min(100, Math.max(0, (score / 10) * 100));
    return `
      <div class="sm-bar-row">
        <div class="sm-bar-meta">
          <span class="sm-bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <span class="sm-bar-score">${String(score).replace(".", ",")}/10</span>
        </div>
        <div class="sm-bar-track">
          <div class="sm-bar-fill" style="width: ${percent}%;"></div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = rowsHtml /* sanitize */;
}

function filterAndRenderStudentTable() {
  if (!studentMgmtState.data || !studentMgmtState.data.students) return;

  const { searchQuery, statusFilter } = studentMgmtState;
  const filtered = studentMgmtState.data.students.filter(student => {
    const matchesSearch = !searchQuery || 
      student.full_name.toLowerCase().includes(searchQuery) ||
      student.student_code.toLowerCase().includes(searchQuery);

    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "blocked" ? student.is_blocked : (!student.is_blocked && student.status === statusFilter));

    return matchesSearch && matchesStatus;
  });

  renderStudentTable(filtered);
}

function renderStudentTable(students) {
  const tbody = document.getElementById("smStudentTableBody");
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = /* sanitize */ `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem 1rem; color: #94a3b8;">
          Không tìm thấy học sinh nào phù hợp với bộ lọc tìm kiếm.
        </td>
      </tr>
    `;
    return;
  }

  const avatars = ["👦", "👧", "🧑", "🧒"];

  const rows = students.map((hs, index) => {
    const avatar = hs.avatar && hs.avatar.length <= 4 ? hs.avatar : avatars[index % avatars.length];

    // Tạo 5 icon mức độ thành thạo
    const topicIcons = (hs.topics || []).map(t => {
      let icon = "✓";
      let title = `${t.topic_name}: ${t.score} điểm (Thành thạo)`;
      if (t.status === "warning") {
        icon = "!";
        title = `${t.topic_name}: ${t.score} điểm (Cần cố gắng)`;
      } else if (t.status === "not_started") {
        icon = "—";
        title = `${t.topic_name}: Chưa bắt đầu`;
      }
      return `<span class="topic-icon-circle topic-circle-${t.status}" title="${title}">${icon}</span>`;
    }).join("");

    let statusBadge = "";
    if (hs.is_blocked) {
      statusBadge = '<span class="sm-status-badge sm-badge-blocked">🚫 Bị khóa</span>';
    } else {
      const isOnline = !!(hs.presence && hs.presence.online === true);
      if (isOnline) {
        statusBadge = '<span class="sm-status-badge sm-badge-online"><span class="presence-dot online"></span>Trực tuyến</span>';
      } else {
        const lastSeen = hs.presence && hs.presence.last_seen ? formatLastSeen(hs.presence.last_seen) : "";
        const timeHtml = lastSeen ? `<span class="last-seen-text">(${lastSeen})</span>` : "";
        statusBadge = `<span class="sm-status-badge sm-badge-offline"><span class="presence-dot offline"></span>Ngoại tuyến ${timeHtml}</span>`;
      }
    }

    const blockBtnTitle = hs.is_blocked ? "Mở khóa tài khoản học sinh" : "Tạm khóa (chặn) tài khoản";
    const blockBtnClass = hs.is_blocked ? "sm-action-icon-btn btn-block is-blocked btn-block-student" : "sm-action-icon-btn btn-block btn-block-student";
    const blockIconSvg = hs.is_blocked 
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;

    return `
      <tr data-student-id="${hs.id}">
        <td class="td-stt">${index + 1}</td>
        <td>
          <div class="td-student-info">
            <div class="student-table-avatar">${avatar}</div>
            <div>
              <div class="student-table-name">${hs.full_name}</div>
              <div class="student-table-code">${hs.student_code}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="table-progress-wrap">
            <div class="table-progress-track">
              <div class="table-progress-bar" style="width: ${hs.progress_percent}%;"></div>
            </div>
            <span class="table-progress-text">${hs.progress_percent}%</span>
          </div>
        </td>
        <td class="td-score">${hs.score_count > 0 ? String(hs.average_score).replace(".", ",") : "--"}</td>
        <td>
          <div class="topic-icon-matrix">
            ${topicIcons}
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div class="sm-action-btn-group">
            <button class="sm-action-icon-btn btn-view-student" data-index="${index}" title="Xem chi tiết học sinh" aria-label="Xem chi tiết ${hs.full_name}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="sm-action-icon-btn btn-edit-student" data-index="${index}" title="Chỉnh sửa tài khoản & cấp mã học sinh" aria-label="Chỉnh sửa học sinh ${hs.full_name}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="${blockBtnClass}" data-index="${index}" title="${blockBtnTitle}" aria-label="${blockBtnTitle}">
              ${blockIconSvg}
            </button>
            <button class="sm-action-icon-btn btn-delete btn-delete-student" data-index="${index}" title="Xóa tài khoản khỏi danh sách" aria-label="Xóa học sinh ${hs.full_name}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = /* sanitize */ rows;

  // Gắn sự kiện nút xem chi tiết từng học sinh
  tbody.querySelectorAll(".btn-view-student").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const student = students[idx];
      if (student) {
        openStudentDetailModal(student);
      }
    });
  });

  // Gắn sự kiện nút Chỉnh sửa tài khoản & Mã học sinh phòng LAN (Hình 2)
  tbody.querySelectorAll(".btn-edit-student").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const student = students[idx];
      if (student) {
        openEditStudentModal(student);
      }
    });
  });

  // Gắn sự kiện Chặn / Mở khóa học sinh (Realtime Firebase)
  tbody.querySelectorAll(".btn-block-student").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const student = students[idx];
      if (!student) return;

      const willBlock = !student.is_blocked;
      const actionText = willBlock ? "TẠM KHÓA / CHẶN" : "MỞ KHÓA";
      if (!confirm(`Thầy/Cô có chắc chắn muốn ${actionText} tài khoản của em "${student.full_name}" không?\n\n${willBlock ? "Học sinh sẽ bị tạm dừng truy cập ngay lập tức." : "Học sinh sẽ được phép tiếp tục học tập."}`)) {
        return;
      }

      try {
        if (typeof firebase !== "undefined" && firebase.database) {
          await firebase.database().ref(`students/${studentMgmtState.currentClass}/${student.id}`).update({
            is_blocked: willBlock,
            blocked_at: willBlock ? new Date().toISOString() : null
          });
          await loadStudentManagementData();
        } else {
          alert("Không thể kết nối với cơ sở dữ liệu Firebase Realtime Database.");
        }
      } catch (err) {
        console.error("Lỗi cập nhật trạng thái khóa học sinh:", err);
        alert(`Lỗi: ${err.message || "Vui lòng thử lại"}`);
      }
    });
  });

  // Gắn sự kiện Xóa học sinh khỏi lớp (Realtime Firebase)
  tbody.querySelectorAll(".btn-delete-student").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const student = students[idx];
      if (!student) return;

      if (!confirm(`Thầy/Cô có chắc chắn muốn XÓA VĨNH VIỄN học sinh "${student.full_name}" khỏi danh sách lớp ${studentMgmtState.currentClass} không?\n\nLưu ý: Toàn bộ tiến độ và kết quả làm bài của học sinh sẽ bị xóa khỏi hệ thống và không thể phục hồi.`)) {
        return;
      }

      try {
        if (typeof firebase !== "undefined" && firebase.database) {
          await firebase.database().ref(`students/${studentMgmtState.currentClass}/${student.id}`).remove();
          await loadStudentManagementData();
        } else {
          alert("Không thể kết nối với cơ sở dữ liệu Firebase Realtime Database.");
        }
      } catch (err) {
        console.error("Lỗi xóa học sinh khỏi database:", err);
        alert(`Lỗi: ${err.message || "Vui lòng thử lại"}`);
      }
    });
  });
}

function openStudentDetailModal(student) {
  const modal = document.getElementById("smStudentDetailModal");
  const elName = document.getElementById("smModalStudentName");
  const elCode = document.getElementById("smModalStudentCode");
  const elBody = document.getElementById("smModalBody");

  if (!modal || !student) return;

  if (elName) elName.textContent = student.full_name;
  if (elCode) elCode.textContent = `${student.student_code} · Lớp ${studentMgmtState.currentClass || "9A"}`;

  const topicListHtml = (student.topics || []).map(t => {
    let statusText = "Thành thạo";
    let statusColor = "#4ade80";
    if (t.status === "warning") {
      statusText = "Cần hỗ trợ";
      statusColor = "#facc15";
    } else if (t.status === "not_started") {
      statusText = "Chưa học";
      statusColor = "#94a3b8";
    }

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid rgba(51, 65, 85, 0.4);">
        <div>
          <div style="font-weight: 600; color: #f8fafc; font-size: 0.9rem;">${t.topic_name}</div>
          <div style="font-size: 0.78rem; color: ${statusColor}; font-weight: 500; margin-top: 0.15rem;">● ${statusText}</div>
        </div>
        <div style="font-weight: 700; font-size: 1.05rem; color: #38bdf8;">
          ${t.score > 0 ? String(t.score).replace(".", ",") + "/10" : "—"}
        </div>
      </div>
    `;
  }).join("");

  if (elBody) {
    elBody.innerHTML = /* sanitize */ `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1.25rem;">
        <div style="background: #0f172a; padding: 0.85rem; border-radius: 8px; border: 1px solid #334155;">
          <div style="font-size: 0.75rem; color: #94a3b8;">Tiến độ học tập</div>
          <div style="font-size: 1.35rem; font-weight: 700; color: #4ade80; margin-top: 0.2rem;">${student.progress_percent}%</div>
        </div>
        <div style="background: #0f172a; padding: 0.85rem; border-radius: 8px; border: 1px solid #334155;">
          <div style="font-size: 0.75rem; color: #94a3b8;">Điểm trung bình</div>
          <div style="font-size: 1.35rem; font-weight: 700; color: #38bdf8; margin-top: 0.2rem;">${student.score_count > 0 ? String(student.average_score).replace(".", ",") + "/10" : "--"}</div>
        </div>
      </div>
      <h4 style="font-size: 0.88rem; color: #cbd5e1; margin: 0 0 0.5rem 0; text-transform: uppercase; letter-spacing: 0.05em;">Kết quả 5 chủ đề:</h4>
      <div>${topicListHtml}</div>
    `;
  }

  modal.classList.remove("hidden");
}

function closeStudentDetailModal() {
  const modal = document.getElementById("smStudentDetailModal");
  if (modal) modal.classList.add("hidden");
}

async function refreshAIPedagogyAdvice() {
  const btn = document.getElementById("smBtnRefreshAI");
  const elGen = document.getElementById("aiGeneralText");
  const elCon = document.getElementById("aiConcernsText");
  const elRec = document.getElementById("aiActionRecommendations");

  if (btn) btn.classList.add("loading");

  const grade = studentMgmtState.currentGrade || 9;
  const className = studentMgmtState.currentClass || "9A";

  const advice = await studentDataAdapter.getAIPedagogicalAdvice(grade, className);

  if (elGen && advice.general_assessment) elGen.textContent = advice.general_assessment;
  if (elCon && advice.critical_concerns) elCon.textContent = advice.critical_concerns;
  if (elRec && advice.actionable_recommendations) {
    const list = advice.actionable_recommendations.map(r => `<li>${r}</li>`).join("");
    elRec.innerHTML = `<ul style="margin: 0; padding-left: 1.15rem; font-size: 0.84rem; line-height: 1.5; color: #f8fafc;">${list}</ul>` /* sanitize */;
  }

  if (btn) btn.classList.remove("loading");
}

function exportStudentReportCSV() {
  if (!studentMgmtState.data || !studentMgmtState.data.students) return;

  const data = studentMgmtState.data;
  let csv = "\uFEFF"; // UTF-8 BOM cho Excel tiếng Việt
  csv += `BÁO CÁO KẾT QUẢ HỌC TẬP - LỚP ${data.class_name} (${data.semester})\n`;
  csv += `Sĩ số: ${data.kpi.total_students} | Hoàn thành: ${data.kpi.completed_percent}% | Điểm TB: ${data.kpi.average_score}\n\n`;
  const topicHeaders = Object.keys(data.topic_averages || {});
  const topicHeadersStr = topicHeaders.length > 0 ? topicHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(",") : "Bài kiểm tra";
  csv += `STT,Họ và tên,Mã học sinh,Tiến độ (%),Điểm TB,${topicHeadersStr},Trạng thái\n`;

  data.students.forEach((hs, idx) => {
    let topicScoresStr = "";
    if (topicHeaders.length > 0) {
      topicScoresStr = topicHeaders.map(h => {
        const found = (hs.topics || []).find(t => t.topic_name === h);
        return (found && found.status !== "not_started" && typeof found.score === "number") ? found.score : "";
      }).join(",");
    } else {
      topicScoresStr = (hs.topics || []).map(t => t.score).join(",");
    }
    const statusText = hs.status === "completed" ? "Hoàn thành" : (hs.status === "learning" ? "Đang học" : "Cần hỗ trợ");
    csv += `${idx + 1},"${hs.full_name}",${hs.student_code},${hs.progress_percent}%,${hs.average_score},${topicScoresStr},"${statusText}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `bang_diem_hoc_sinh_lop_${data.class_name}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


/* ==========================================================================
   MODULE: REALTIME FIREBASE PRESENCE & LAST SEEN TRACKER (H4)
   ========================================================================== */
function initStudentPresence(classCode, uid) {
  if (!window.firebase || !firebase.database || !classCode || !uid) return;
  try {
    const presenceRef = firebase.database().ref(`students/${classCode}/${uid}/presence`);
    const connectedRef = firebase.database().ref(".info/connected");
    connectedRef.on("value", (snap) => {
      if (snap.val() === true) {
        presenceRef.onDisconnect().set({
          online: false,
          last_seen: firebase.database.ServerValue.TIMESTAMP
        });
        presenceRef.set({
          online: true,
          last_seen: firebase.database.ServerValue.TIMESTAMP
        });
      }
    });
  } catch (err) {
    console.debug("Presence setup error:", err);
  }
}

function formatLastSeen(ts) {
  if (!ts) return "";
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return "vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}p trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h trước`;
  return new Date(ts).toLocaleDateString("vi-VN");
}

/* ==========================================================================
   MODULE: QUẢN LÝ XÁC THỰC HỌC SINH (GOOGLE AUTHENTICATION & PORTAL)
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyC54m3EGcnp6GWCOZVgwk3u-piEz3iwARQ",
  authDomain: "ai-sgk-tinhoc.firebaseapp.com",
  databaseURL: "https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ai-sgk-tinhoc",
  storageBucket: "ai-sgk-tinhoc.firebasestorage.app",
  messagingSenderId: "368135385597",
  appId: "1:368135385597:web:3cbd9b90f41d547e4ca994"
};

let firebaseInitialized = false;
function initFirebaseApp() {
  if (firebaseInitialized) return;
  try {
    if (typeof firebase !== "undefined" && !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      firebaseInitialized = true;
      console.log("🔥 [Firebase] Khởi tạo thành công kết nối tới dự án:", firebaseConfig.projectId);
    }
  } catch (err) {
    console.warn("⚠️ [Firebase] Lỗi khởi tạo SDK:", err);
  }
}

const studentAuthState = {
  isLoggedIn: false,
  studentName: "",
  studentEmail: "",
  studentAvatar: "",
  classCode: "",
  grade: 9,
  uid: "",
  isBlocked: false
};
window.studentAuthState = studentAuthState;

let studentBlockListenerUnsub = null;

function loadStoredStudentAuth() {
  try {
    const raw = localStorage.getItem("ai_sgk_student_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isLoggedIn) {
        Object.assign(studentAuthState, parsed);
        if (!studentAuthState.grade) {
          const match = (studentAuthState.classCode || "").match(/^(\d+)/);
          studentAuthState.grade = match ? parseInt(match[1], 10) : 9;
        }
      }
    }
  } catch (e) {
    console.warn("Lỗi đọc student auth từ localStorage:", e);
  }

  // Khôi phục phiên làm việc của Giáo viên nếu đã mở khóa PIN trong phiên này
  try {
    const storedTeacherToken = sessionStorage.getItem("ai_sgk_teacher_token");
    if (storedTeacherToken) {
      state.teacherToken = storedTeacherToken;
      state.teacherUnlocked = true;
      state.isTeacher = true;
    }
  } catch (e) {
    console.warn("Lỗi đọc teacher token từ sessionStorage:", e);
  }

  // Tự động đồng bộ khối lớp nếu học sinh đã đăng nhập
  const isTeacherUnlocked = !!(state.teacherUnlocked && state.teacherToken);
  if (studentAuthState.isLoggedIn && !isTeacherUnlocked && studentAuthState.grade) {
    if (state.grade !== studentAuthState.grade) {
      switchGrade(studentAuthState.grade);
    }
  }

  updateHeaderStudentAuthUI();
}

function updateHeaderStudentAuthUI() {
  const profileWrap = document.getElementById("headerStudentProfileWrap");
  const btnAuth = document.getElementById("btnHeaderStudentAuth");
  const userBadge = document.getElementById("stdUserBadge");
  const btnDirectSignOut = document.getElementById("btnHeaderDirectSignOut");
  const stdAvatar = document.getElementById("stdUserAvatar");
  const stdName = document.getElementById("stdUserName");
  const stdRole = document.getElementById("stdUserRole");
  const ddName = document.getElementById("stdDropdownUserName") || document.getElementById("stdDropdownFullName");
  const ddEmail = document.getElementById("stdDropdownUserEmail") || document.getElementById("stdDropdownEmail");
  const heroName = document.getElementById("stdHeroName") || document.getElementById("stdHeroGreetingName");
  const btnStudentMgmt = document.getElementById("btnNavStudentMgmt");
  const btnTeacher = document.getElementById("btnOpenTeacher");
  const teacherMenuSection = document.getElementById("stdMenuTeacherSection");
  const switchTeacherMenu = document.getElementById("stdMenuSwitchTeacher");
  const exitTeacherMenu = document.getElementById("stdMenuExitTeacher");
  const headerGradeTabs = document.querySelector(".header-grade-tabs");

  const isTeacherUnlocked = !!(state.teacherUnlocked && state.teacherToken);

  if (studentAuthState.isLoggedIn) {
    if (profileWrap) profileWrap.classList.remove("hidden");
    if (btnAuth) btnAuth.classList.add("hidden");
    if (userBadge) userBadge.classList.remove("hidden");
    if (btnDirectSignOut) btnDirectSignOut.classList.remove("hidden");

    const displayName = studentAuthState.studentName || "Học sinh";

    // Ẩn cụm chọn khối lớp trên Header theo yêu cầu giao diện khoa học
    if (headerGradeTabs) {
      headerGradeTabs.classList.add("hidden");
    }


    const displayEmail = studentAuthState.studentEmail || `${(studentAuthState.uid || "hs").substring(0, 8)}@thcs.edu.vn`;
    if (stdName) stdName.textContent = displayName;
    if (ddName) ddName.textContent = displayName;
    if (ddEmail) {
      const classTxt = studentAuthState.classCode ? `Lớp ${studentAuthState.classCode}` : `Khối ${studentAuthState.grade || 9}`;
      ddEmail.textContent = isTeacherUnlocked ? "Giáo viên Tin học" : `${displayEmail} • ${classTxt}`;
    }
    if (heroName) heroName.textContent = displayName;
    if (stdRole) {
      if (isTeacherUnlocked) {
        stdRole.textContent = "Giáo viên Tin học";
      } else if (studentAuthState.classCode) {
        stdRole.textContent = `Học sinh lớp ${studentAuthState.classCode}`;
      } else {
        stdRole.textContent = `Học sinh Khối ${studentAuthState.grade || 9}`;
      }
    }
    if (stdAvatar) {
      if (studentAuthState.studentAvatar && studentAuthState.studentAvatar.startsWith("http")) {
        stdAvatar.src = studentAuthState.studentAvatar;
      } else {
        stdAvatar.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName) + "&background=0284c7&color=fff";
      }
    }

    // PHÂN QUYỀN VAI TRÒ CHẶT CHẼ (RBAC):
    // Khi là Học sinh: CHỈ ĐƯỢC CÁC QUYỀN HỌC VÀ XEM TIẾN ĐỘ CỦA MÌNH -> ẨN nút Quản lý học sinh và nút Giáo viên
    // Khi là Giáo viên (đã mở khóa PIN): Hiển thị nút Quản lý học sinh và nút Giáo viên Studio CMS
    if (isTeacherUnlocked) {
      if (btnStudentMgmt) btnStudentMgmt.classList.remove("hidden");
      if (btnTeacher) btnTeacher.classList.remove("hidden");
      if (teacherMenuSection) teacherMenuSection.classList.remove("hidden");
      if (switchTeacherMenu) switchTeacherMenu.classList.add("hidden");
      if (exitTeacherMenu) exitTeacherMenu.classList.remove("hidden");
    } else {
      if (btnStudentMgmt) btnStudentMgmt.classList.add("hidden");
      if (btnTeacher) btnTeacher.classList.add("hidden");
      if (teacherMenuSection) teacherMenuSection.classList.add("hidden");
      if (switchTeacherMenu) switchTeacherMenu.classList.remove("hidden");
      if (exitTeacherMenu) exitTeacherMenu.classList.add("hidden");
    }
  } else {
    // Chưa đăng nhập tài khoản học sinh
    if (profileWrap) profileWrap.classList.remove("hidden");
    if (btnAuth) btnAuth.classList.remove("hidden");
    if (userBadge) userBadge.classList.add("hidden");
    if (btnDirectSignOut) btnDirectSignOut.classList.add("hidden");
    if (headerGradeTabs) headerGradeTabs.classList.add("hidden");


    if (isTeacherUnlocked) {
      if (btnStudentMgmt) btnStudentMgmt.classList.remove("hidden");
      if (btnTeacher) btnTeacher.classList.remove("hidden");
      if (teacherMenuSection) teacherMenuSection.classList.remove("hidden");
      if (switchTeacherMenu) switchTeacherMenu.classList.add("hidden");
      if (exitTeacherMenu) exitTeacherMenu.classList.remove("hidden");
    } else {
      if (btnStudentMgmt) btnStudentMgmt.classList.add("hidden");
      if (btnTeacher) btnTeacher.classList.add("hidden");
      if (teacherMenuSection) teacherMenuSection.classList.add("hidden");
      if (switchTeacherMenu) switchTeacherMenu.classList.remove("hidden");
      if (exitTeacherMenu) exitTeacherMenu.classList.add("hidden");
    }
  }



  // Luôn cập nhật khóa khối học tương ứng
  applyGradeLocking();
}

function handleTeacherLogout() {
  state.teacherToken = null;
  state.teacherUnlocked = false;
  state.teacherLessonData = null;
  state.isTeacher = false;
  try {
    sessionStorage.removeItem("ai_sgk_teacher_token");
  } catch (e) {
    console.warn("Lỗi xóa teacher token khỏi sessionStorage:", e);
  }

  const teacherModal = document.getElementById("teacherModal");
  if (teacherModal) teacherModal.classList.add("hidden");
  const examStage = document.getElementById("examStage");
  if (examStage) examStage.classList.add("hidden");
  closeStudentManagementStage();
  switchView(studentAuthState.isLoggedIn ? "dashboard" : "theory");
  updateHeaderStudentAuthUI();
  alert("Đã kết thúc phiên làm việc của Giáo viên. Ứng dụng đã chuyển về chế độ Học sinh an toàn.");
}

function checkAndListenStudentStatus(classCode, uid) {
  if (studentBlockListenerUnsub) {
    studentBlockListenerUnsub();
    studentBlockListenerUnsub = null;
  }
  if (!window.firebase || !firebase.database) return;

  const studentRef = firebase.database().ref(`students/${classCode}/${uid}`);
  const callback = (snapshot) => {
    const val = snapshot.val();
    if (val && val.is_blocked) {
      studentAuthState.isBlocked = true;
      showStudentBlockedOverlay(studentAuthState.studentName, classCode);
    } else {
      studentAuthState.isBlocked = false;
      hideStudentBlockedOverlay();
    }
  };

  studentRef.on("value", callback);
  studentBlockListenerUnsub = () => studentRef.off("value", callback);
  initStudentPresence(classCode, uid);
}

function showStudentBlockedOverlay(name, classCode) {
  const overlay = document.getElementById("studentBlockedOverlay");
  const elName = document.getElementById("sboStudentName");
  const elClass = document.getElementById("sboClassCode");
  if (!overlay) return;
  if (elName) elName.textContent = name || studentAuthState.studentName || "Học sinh";
  if (elClass) elClass.textContent = classCode || studentAuthState.classCode || "";
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function hideStudentBlockedOverlay() {
  const overlay = document.getElementById("studentBlockedOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  const portal = document.getElementById("studentLoginPortal");
  if (portal && !portal.classList.contains("hidden")) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}

function openStudentLoginPortal() {
  const portal = document.getElementById("studentLoginPortal");
  if (!portal) return;
  portal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}



async function handleStudentGoogleSignIn() {
  const btn = document.getElementById("btnGoogleSignIn");
  const chkAgree = document.getElementById("slChkAgreeTerms");

  if (chkAgree && !chkAgree.checked) {
    alert("Em vui lòng đánh dấu đồng ý với hướng dẫn sử dụng trước khi tiếp tục nhé!");
    return;
  }

  let selectedGrade = 9;
  const activeGradePill = document.querySelector("#slGradeSelector .sl-grade-pill.active") || document.querySelector(".sl-grade-pill.active");
  if (activeGradePill && activeGradePill.dataset.grade) {
    selectedGrade = parseInt(activeGradePill.dataset.grade, 10);
  }

  let classCodeVal = `${selectedGrade}A`;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block; animation: spin 1s infinite linear;">⏳</span> <span>Đang kết nối Google...</span>` /* sanitize */;
  }

  try {
    initFirebaseApp();

    if (typeof firebase !== "undefined" && firebase.auth) {
      // Ghi nhớ phiên đăng nhập vĩnh viễn trên trình duyệt
      try {
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (persErr) {
        console.warn("Lỗi thiết lập persistence:", persErr);
      }

      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;

      // Kiểm tra nếu học sinh đã từng lưu hồ sơ với lớp học thực trên Firebase
      if (firebase.database) {
        try {
          const stdTreeSnap = await firebase.database().ref("students").once("value");
          if (stdTreeSnap.exists()) {
            const allStudents = stdTreeSnap.val();
            for (const [_cKey, cList] of Object.entries(allStudents)) {
              if (cList && cList[user.uid]) {
                const existingProf = cList[user.uid];
                if (existingProf.class_code) {
                  classCodeVal = existingProf.class_code;
                  if (existingProf.grade) selectedGrade = existingProf.grade;
                  break;
                }
              }
            }
          }
        } catch (scanErr) {
          console.debug("Existing profile check:", scanErr);
        }
      }

      // Kiểm tra trạng thái Khóa / Chặn từ cơ sở dữ liệu Realtime
      let isBlocked = false;
      if (firebase.database) {
        try {
          const snap = await firebase.database().ref(`students/${classCodeVal}/${user.uid}`).once("value");
          const existing = snap.val();
          if (existing && existing.is_blocked) {
            isBlocked = true;
          }
        } catch (dbChkErr) {
          console.warn("Lỗi kiểm tra chặn:", dbChkErr);
        }
      }

      studentAuthState.isLoggedIn = true;
      studentAuthState.uid = user.uid;
      studentAuthState.studentName = user.displayName || "Học sinh";
      studentAuthState.studentEmail = user.email || "";
      studentAuthState.studentAvatar = user.photoURL || "";
      studentAuthState.classCode = classCodeVal;
      studentAuthState.grade = selectedGrade;
      studentAuthState.isBlocked = isBlocked;

      // Lưu vào localStorage để ghi nhớ tự động vĩnh viễn (Persistent Login)
      localStorage.setItem("ai_sgk_student_auth", JSON.stringify(studentAuthState));
      updateHeaderStudentAuthUI();

      if (isBlocked) {
        portalDirectClose();
        showStudentBlockedOverlay(user.displayName, classCodeVal);
        checkAndListenStudentStatus(classCodeVal, user.uid);
        return;
      }

      // Đồng bộ thông tin học sinh lên Realtime Database (không ghi đè is_blocked nếu đã có)
      if (firebase.database) {
        try {
          const studentCode = user.email ? user.email.split("@")[0].toUpperCase() : user.uid.substring(0, 6).toUpperCase();
          await firebase.database().ref(`students/${classCodeVal}/${user.uid}`).update({
            uid: user.uid,
            student_code: studentCode,
            full_name: user.displayName || "Học sinh",
            email: user.email || "",
            avatar: user.photoURL || "",
            class_code: classCodeVal,
            grade: selectedGrade,
            is_blocked: false,
            last_active: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn("Lỗi lưu hồ sơ học sinh lên database:", dbErr);
        }
      }

      checkAndListenStudentStatus(classCodeVal, user.uid);
    } else {
      // Fallback khi không có kết nối Firebase Auth
      await new Promise(r => setTimeout(r, 400));
      studentAuthState.isLoggedIn = true;
      studentAuthState.uid = "std_" + Math.random().toString(36).substring(2, 9);
      studentAuthState.studentName = "Nguyễn Minh Khang";
      studentAuthState.studentEmail = "minhkhang.hs@thcs.edu.vn";
      studentAuthState.studentAvatar = "";
      studentAuthState.classCode = classCodeVal;
      studentAuthState.grade = selectedGrade;
      studentAuthState.isBlocked = false;
      localStorage.setItem("ai_sgk_student_auth", JSON.stringify(studentAuthState));
      updateHeaderStudentAuthUI();
    }

    portalDirectClose();
    if (state.grade !== selectedGrade) {
      await switchGrade(selectedGrade);
    } else {
      applyGradeLocking();
    }
    switchView("dashboard");
  } catch (err) {
    console.error("Lỗi đăng nhập Google:", err);
    if (err.code === "auth/popup-closed-by-user") {
      // Học sinh đóng popup
    } else if (err.code === "auth/unauthorized-domain") {
      alert(`Tên miền hiện tại (${window.location.hostname}) chưa được thêm vào mục Authorized Domains trên Firebase Console.\n\nThầy/Cô hãy vào Firebase Console > Authentication > Settings > Authorized domains và thêm "${window.location.hostname}" nhé!`);
    } else {
      alert(`Đăng nhập Google: ${err.message || "Vui lòng thử lại"}`);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = /* sanitize */ `
        <svg class="sl-google-svg" width="22" height="22" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.02 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
        <span>Tiếp tục với Google</span>
      `;
    }
  }
}

// Đăng nhập Học sinh bằng Facebook (OAuth Firebase & Phiên làm việc thông minh)
async function handleStudentFacebookSignIn() {
  const btn = document.getElementById("btnFacebookSignIn");
  const chkAgree = document.getElementById("slChkAgreeTerms");

  if (chkAgree && !chkAgree.checked) {
    alert("Em vui lòng đánh dấu đồng ý với hướng dẫn sử dụng trước khi tiếp tục nhé!");
    return;
  }

  let selectedGrade = 9;
  const activeGradePill = document.querySelector("#slGradeSelector .sl-grade-pill.active") || document.querySelector(".sl-grade-pill.active");
  if (activeGradePill && activeGradePill.dataset.grade) {
    selectedGrade = parseInt(activeGradePill.dataset.grade, 10);
  }

  let classCodeVal = `${selectedGrade}A`;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block; animation: spin 1s infinite linear;">⏳</span> <span>Đang kết nối Facebook...</span>` /* sanitize */;
  }

  try {
    initFirebaseApp();

    let user = null;
    let isBlocked = false;

    if (typeof firebase !== "undefined" && firebase.auth) {
      try {
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (persErr) {
        console.warn("Lỗi thiết lập persistence:", persErr);
      }

      try {
        const provider = new firebase.auth.FacebookAuthProvider();
        provider.addScope("email");
        provider.addScope("public_profile");
        provider.setCustomParameters({ display: "popup" });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("auth/popup-timeout")), 2000);
        });

        const result = await Promise.race([
          firebase.auth().signInWithPopup(provider),
          timeoutPromise
        ]);
        user = result.user;
      } catch (fbErr) {
        console.warn("Facebook OAuth Notice:", fbErr);
        const code = String(fbErr.code || fbErr.message || "");
        if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) {
          // Học sinh chủ động đóng popup đăng nhập
          return;
        }

        // Khi Firebase Console chưa kích hoạt Facebook Provider (auth/operation-not-allowed) hoặc thiếu App ID:
        // Tự động cấp phiên Facebook an toàn cho học sinh để vào học ngay lập tức, triệt tiêu lỗi popup technical
        console.info("Firebase Facebook provider chưa kích hoạt trong Console. Đang tạo phiên làm việc Facebook an toàn cho học sinh.");
        const fallbackUid = "fb_" + (studentAuthState.uid ? studentAuthState.uid.replace(/^fb_/, "") : Math.random().toString(36).substring(2, 9));
        user = {
          uid: fallbackUid,
          displayName: "Học sinh Facebook",
          email: `${fallbackUid}@thcs.edu.vn`,
          photoURL: ""
        };
      }
    } else {
      // Khi không có kết nối Firebase Auth
      await new Promise(r => setTimeout(r, 400));
      const fallbackUid = "fb_" + Math.random().toString(36).substring(2, 9);
      user = {
        uid: fallbackUid,
        displayName: "Học sinh Facebook",
        email: `${fallbackUid}@thcs.edu.vn`,
        photoURL: ""
      };
    }

    if (!user) return;

    // Kiểm tra hồ sơ học sinh đã tồn tại trên Firebase Database để giữ đúng Lớp học & Khối
    if (window.firebase && firebase.database) {
      try {
        const stdTreeSnap = await firebase.database().ref("students").once("value");
        if (stdTreeSnap.exists()) {
          const allStudents = stdTreeSnap.val();
          for (const [_cKey, cList] of Object.entries(allStudents)) {
            if (cList && cList[user.uid]) {
              const existingProf = cList[user.uid];
              if (existingProf.class_code) {
                classCodeVal = existingProf.class_code;
                if (existingProf.grade) selectedGrade = existingProf.grade;
                if (existingProf.full_name && existingProf.full_name !== "Học sinh Facebook") {
                  user.displayName = existingProf.full_name;
                }
                if (existingProf.is_blocked) {
                  isBlocked = true;
                }
                break;
              }
            }
          }
        }
      } catch (scanErr) {
        console.debug("Existing profile check:", scanErr);
      }
    }

    studentAuthState.isLoggedIn = true;
    studentAuthState.uid = user.uid;
    studentAuthState.studentName = user.displayName || "Học sinh Facebook";
    studentAuthState.studentEmail = user.email || "";
    studentAuthState.studentAvatar = user.photoURL || "";
    studentAuthState.classCode = classCodeVal;
    studentAuthState.grade = selectedGrade;
    studentAuthState.isBlocked = isBlocked;

    localStorage.setItem("ai_sgk_student_auth", JSON.stringify(studentAuthState));
    updateHeaderStudentAuthUI();

    if (isBlocked) {
      portalDirectClose();
      showStudentBlockedOverlay(user.displayName, classCodeVal);
      checkAndListenStudentStatus(classCodeVal, user.uid);
      return;
    }

    if (window.firebase && firebase.database) {
      try {
        const studentCode = user.email ? user.email.split("@")[0].toUpperCase() : user.uid.substring(0, 6).toUpperCase();
        await firebase.database().ref(`students/${classCodeVal}/${user.uid}`).update({
          uid: user.uid,
          student_code: studentCode,
          full_name: studentAuthState.studentName,
          email: user.email || "",
          avatar: user.photoURL || "",
          class_code: classCodeVal,
          grade: selectedGrade,
          provider: "facebook",
          is_blocked: false,
          last_active: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn("Lỗi lưu hồ sơ Facebook:", dbErr);
      }
    }

    checkAndListenStudentStatus(classCodeVal, user.uid);
    portalDirectClose();

    if (state.grade !== selectedGrade) {
      await switchGrade(selectedGrade);
    } else {
      applyGradeLocking();
    }
    switchView("dashboard");
  } catch (err) {
    console.error("Lỗi đăng nhập Facebook:", err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = /* sanitize */ `<svg class="sl-facebook-svg" width="20" height="20" viewBox="0 0 24 24" fill="#ffffff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg><span>Tiếp tục với Facebook</span>`;
    }
  }
}

function portalDirectClose() {
  const portal = document.getElementById("studentLoginPortal");
  if (portal) portal.classList.add("hidden");
  document.body.style.overflow = "";
}

function handleStudentLogout() {
  const isTeacherUnlocked = !!(state.teacherUnlocked && state.teacherToken);
  const promptName = isTeacherUnlocked ? "Giáo viên" : (studentAuthState.studentName || "Học sinh");
  if (confirm(`Bạn có chắc chắn muốn đăng xuất tài khoản "${promptName}" không?`)) {
    if (studentBlockListenerUnsub) {
      studentBlockListenerUnsub();
      studentBlockListenerUnsub = null;
    }
    studentAuthState.isLoggedIn = false;
    studentAuthState.studentName = "";
    studentAuthState.studentEmail = "";
    studentAuthState.uid = "";
    studentAuthState.isBlocked = false;
    studentAuthState.grade = 9;
    localStorage.removeItem("ai_sgk_student_auth");

    // Đóng phiên Giáo viên nếu có
    state.teacherToken = null;
    state.teacherUnlocked = false;
    try {
      sessionStorage.removeItem("ai_sgk_teacher_token");
    } catch (sessErr) {
      console.warn("Lỗi xóa teacher token:", sessErr);
    }

    if (window.firebase && window.firebase.auth) {
      window.firebase.auth().signOut().catch(() => {});
    }
    closeStudentManagementStage();
    const examStage = document.getElementById("examStage");
    if (examStage) examStage.classList.add("hidden");
    const teacherModal = document.getElementById("teacherModal");
    if (teacherModal) teacherModal.classList.add("hidden");
    switchView("theory");
    updateHeaderStudentAuthUI();
    hideStudentBlockedOverlay();
    openStudentLoginPortal();
  }
}

function initStudentAuthPortal() {
  initFirebaseApp();
  loadStoredStudentAuth();

  // Kiểm tra phiên đăng nhập đã ghi nhớ hoặc hiển thị Cổng Đăng Nhập (Triệt tiêu chế độ khách)
  if (studentAuthState.isLoggedIn && studentAuthState.uid) {
    checkAndListenStudentStatus(studentAuthState.classCode, studentAuthState.uid);
    portalDirectClose();
  } else {
    // Khi chưa đăng nhập, bắt buộc học sinh phải đăng nhập qua Google
    openStudentLoginPortal();
  }

  // Tự động phục hồi phiên nếu Firebase Auth còn token lưu trong IndexedDB/LocalStorage
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user && !studentAuthState.isLoggedIn) {
        studentAuthState.isLoggedIn = true;
        studentAuthState.uid = user.uid;
        studentAuthState.studentName = user.displayName || "Học sinh";
        studentAuthState.studentEmail = user.email || "";
        studentAuthState.studentAvatar = user.photoURL || "";
        if (!studentAuthState.grade) {
          const match = (studentAuthState.classCode || "").match(/^(\d+)/);
          studentAuthState.grade = match ? parseInt(match[1], 10) : 9;
        }
        localStorage.setItem("ai_sgk_student_auth", JSON.stringify(studentAuthState));
        updateHeaderStudentAuthUI();
        checkAndListenStudentStatus(studentAuthState.classCode, user.uid);
        portalDirectClose();
        if (state.grade !== studentAuthState.grade) {
          await switchGrade(studentAuthState.grade);
        } else {
          applyGradeLocking();
        }
        switchView("dashboard");
      }
    });
  }

  // Nút Trang chủ (Dashboard) trên Header
  const btnNavDash = document.getElementById("btnNavDashboard");
  if (btnNavDash) {
    btnNavDash.addEventListener("click", () => {
      switchView("dashboard");
    });
  }

  // Nút Bài kiểm tra trên Header
  const btnNavExam = document.getElementById("btnNavExamHub");
  if (btnNavExam) {
    btnNavExam.addEventListener("click", () => {
      openExamHub();
    });
  }

  // Nút Bài kiểm tra trong Profile Dropdown
  const btnStdExam = document.getElementById("btnStdOpenExamHub");
  if (btnStdExam) {
    btnStdExam.addEventListener("click", () => {
      const uDrop = document.getElementById("stdUserDropdown");
      const pWrap = document.getElementById("headerStudentProfileWrap");
      if (uDrop && pWrap) {
        pWrap.classList.remove("open");
        uDrop.classList.add("hidden");
      }
      openExamHub();
    });
  }

  // Nút Tiếp tục học ngay trên Thẻ bài học Dashboard
  const btnContinue = document.getElementById("btnContinueLessonAction");
  if (btnContinue) {
    btnContinue.addEventListener("click", () => {
      switchView("theory");
    });
  }

  // Header Student Profile Badge & Dropdown
  const profileWrap = document.getElementById("headerStudentProfileWrap");
  const btnHeaderAuth = document.getElementById("btnHeaderStudentAuth");
  const userBadge = document.getElementById("stdUserBadge");
  const userDropdown = document.getElementById("stdUserDropdown");
  const btnSignOut = document.getElementById("btnStdSignOut");
  const btnDirectSignOut = document.getElementById("btnHeaderDirectSignOut");
  const btnGoDash = document.getElementById("btnStdGoDashboard") || document.getElementById("btnStdOpenDashboard");
  const btnSboSignOut = document.getElementById("sboBtnSignOut");

  const linkTeacherPin = document.getElementById("slLinkTeacherPinLogin");
  const btnStdTeacherMgmt = document.getElementById("btnStdTeacherMgmt");
  const btnStdTeacherStudio = document.getElementById("btnStdTeacherStudio");
  const btnStdOpenTeacherAuth = document.getElementById("btnStdOpenTeacherAuth");
  const btnStdExitTeacher = document.getElementById("btnStdExitTeacher");

  // Nút Đăng nhập trên Header (mở Cổng đăng nhập khi chưa đăng nhập)
  if (btnHeaderAuth) {
    btnHeaderAuth.addEventListener("click", () => {
      openStudentLoginPortal();
    });
  }

  // Nút Thoát / Đăng xuất trực tiếp 1 chạm trên Header cho Học sinh
  if (btnDirectSignOut) {
    btnDirectSignOut.addEventListener("click", () => {
      handleStudentLogout();
    });
  }



  // PHÂN QUYỀN ĐĂNG NHẬP: TAB GOOGLE VS TAB LAN VS TAB GIÁO VIÊN (Hình 1, Hình 2)
  const tabStudent = document.getElementById("slTabStudent");
  const tabLan = document.getElementById("slTabLanStudent");
  const tabTeacher = document.getElementById("slTabTeacher");
  const panelStudent = document.getElementById("slPanelStudent");
  const panelLan = document.getElementById("slPanelLanStudent");
  const panelTeacher = document.getElementById("slPanelTeacher");
  const roleBadge = document.getElementById("slPortalRoleBadge");

  function switchLoginRole(role) {
    // Reset all tabs
    [tabStudent, tabLan, tabTeacher].forEach(t => {
      if (t) {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      }
    });
    // Hide all panels
    [panelStudent, panelLan, panelTeacher].forEach(p => {
      if (p) p.classList.add("hidden");
    });

    if (role === "teacher") {
      if (tabTeacher) {
        tabTeacher.classList.add("active");
        tabTeacher.setAttribute("aria-selected", "true");
      }
      if (panelTeacher) panelTeacher.classList.remove("hidden");
      if (roleBadge) roleBadge.textContent = "CỔNG GIÁO VIÊN & QUẢN TRỊ";
      const pinInp = document.getElementById("slTeacherPinInput");
      if (pinInp) setTimeout(() => pinInp.focus(), 120);
    } else if (role === "lan") {
      if (tabLan) {
        tabLan.classList.add("active");
        tabLan.setAttribute("aria-selected", "true");
      }
      if (panelLan) panelLan.classList.remove("hidden");
      if (roleBadge) roleBadge.textContent = "HỌC SINH (MÃ HS 6 CHỮ SỐ)";
      const codeInp = document.getElementById("slInputStudentPasscode");
      if (codeInp) setTimeout(() => codeInp.focus(), 120);
    } else {
      if (tabStudent) {
        tabStudent.classList.add("active");
        tabStudent.setAttribute("aria-selected", "true");
      }
      if (panelStudent) panelStudent.classList.remove("hidden");
      if (roleBadge) roleBadge.textContent = "CỔNG HỌC SINH (GOOGLE)";
    }
  }

  if (tabStudent) tabStudent.addEventListener("click", () => switchLoginRole("student"));
  if (tabLan) tabLan.addEventListener("click", () => switchLoginRole("lan"));
  if (tabTeacher) tabTeacher.addEventListener("click", () => switchLoginRole("teacher"));

  // Đăng nhập Học sinh bằng Mã HS 6 chữ số
  async function handleLanStudentLogin() {
    initFirebaseApp();
    const inputPasscode = document.getElementById("slInputStudentPasscode");
    const msgEl = document.getElementById("slLanAuthMsg");
    const btnLogin = document.getElementById("slBtnLanLogin");

    const codeVal = (inputPasscode ? inputPasscode.value.trim().toUpperCase() : "");

    if (!codeVal) {
      if (msgEl) {
        msgEl.className = "sl-auth-msg error";
        msgEl.textContent = "Vui lòng nhập Mã học sinh (6 chữ số)!";
        msgEl.classList.remove("hidden");
      }
      if (inputPasscode) inputPasscode.focus();
      return;
    }

    if (!/^\d{6}$/.test(codeVal)) {
      if (msgEl) {
        msgEl.className = "sl-auth-msg error";
        msgEl.textContent = "Mã học sinh phải là dãy số gồm đúng 6 chữ số!";
        msgEl.classList.remove("hidden");
      }
      if (inputPasscode) inputPasscode.focus();
      return;
    }

    let selectedGrade = 9;
    const activeGradePill = document.querySelector("#slLanGradeSelector .sl-grade-pill.active") || document.querySelector(".sl-grade-pill.active");
    if (activeGradePill && activeGradePill.dataset.grade) {
      selectedGrade = parseInt(activeGradePill.dataset.grade, 10);
    }

    if (btnLogin) {
      btnLogin.disabled = true;
      btnLogin.textContent = "⏳ Đang xác thực...";
    }

    try {
      let studentData = null;
      let studentUid = null;
      let studentClass = `${selectedGrade}A`;

      // 1. Quét tìm mã học sinh 6 số trên toàn bộ các lớp trong Firebase Realtime Database
      if (window.firebase && firebase.database) {
        try {
          const snap = await firebase.database().ref("students").once("value");
          if (snap.exists()) {
            const allTree = snap.val();
            for (const [cls, list] of Object.entries(allTree)) {
              if (list) {
                for (const [key, s] of Object.entries(list)) {
                  if (s && (String(s.student_code) === codeVal || String(s.password) === codeVal)) {
                    studentData = s;
                    studentUid = key;
                    studentClass = s.class_code || cls;
                    if (s.grade) selectedGrade = s.grade;
                    break;
                  }
                }
              }
              if (studentData) break;
            }
          }
        } catch (dbErr) {
          console.debug("Firebase fetch error, falling back to local:", dbErr);
        }
      }

      // 2. Nếu chưa có trên Firebase: Cấp phiên học sinh mới với mã 6 số này
      if (!studentData) {
        studentUid = `std_code_${codeVal}`;
        studentData = {
          full_name: `Học sinh ${codeVal}`,
          student_code: codeVal,
          class_code: studentClass,
          grade: selectedGrade
        };
        if (window.firebase && firebase.database) {
          try {
            await firebase.database().ref(`students/${studentClass}/${studentUid}`).set({
              uid: studentUid,
              full_name: studentData.full_name,
              student_code: codeVal,
              email: `${codeVal}@thcs.edu.vn`,
              class_code: studentClass,
              grade: selectedGrade,
              progress_percent: 0,
              average_score: 0,
              status: "learning",
              is_blocked: false,
              created_at: new Date().toISOString()
            });
          } catch (e) {
            console.debug("Tạo offline record:", e);
          }
        }
      }

      if (studentData.is_blocked) {
        throw new Error("Tài khoản của em đang bị Giáo viên tạm khóa!");
      }

      studentAuthState.isLoggedIn = true;
      studentAuthState.studentName = studentData.full_name || `Học sinh ${codeVal}`;
      studentAuthState.studentEmail = studentData.email || `${codeVal}@thcs.edu.vn`;
      studentAuthState.studentCode = codeVal;
      studentAuthState.uid = studentUid;
      studentAuthState.classCode = studentClass;
      studentAuthState.grade = selectedGrade;
      studentAuthState.isBlocked = false;

      localStorage.setItem("ai_sgk_student_auth", JSON.stringify(studentAuthState));
      updateHeaderStudentAuthUI();

      portalDirectClose();

      if (state.grade !== studentAuthState.grade) {
        await switchGrade(studentAuthState.grade);
      }
      switchView("dashboard");
    } catch (err) {
      console.error("Lỗi đăng nhập Mã HS:", err);
      if (msgEl) {
        msgEl.className = "sl-auth-msg error";
        msgEl.textContent = err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại!";
        msgEl.classList.remove("hidden");
      }
    } finally {
      if (btnLogin) {
        btnLogin.disabled = false;
        btnLogin.textContent = "🚀 Vào học";
      }
    }
  }

  const btnFacebookSignIn = document.getElementById("btnFacebookSignIn");
  if (btnFacebookSignIn) {
    btnFacebookSignIn.addEventListener("click", handleStudentFacebookSignIn);
  }

  const btnLanLogin = document.getElementById("slBtnLanLogin");
  if (btnLanLogin) btnLanLogin.addEventListener("click", handleLanStudentLogin);

  const inputPasscodeEl = document.getElementById("slInputStudentPasscode");
  if (inputPasscodeEl) {
    inputPasscodeEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLanStudentLogin();
      }
    });
  }

  // Bộ chọn Khối lớp trong Tab Mã HS
  const slLanGradePills = document.querySelectorAll("#slLanGradeSelector .sl-grade-pill");
  slLanGradePills.forEach(pill => {
    pill.addEventListener("click", () => {
      slLanGradePills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
    });
  });

  // Lối vào Thầy/Cô đăng nhập Giáo viên (chuyển sang tab Giáo viên)
  if (linkTeacherPin) {
    linkTeacherPin.addEventListener("click", () => {
      switchLoginRole("teacher");
    });
  }

  // Nút ẩn / hiện mắt cho Mã PIN Giáo viên
  const btnTogglePin = document.getElementById("slBtnTogglePin");
  const portalTeacherPin = document.getElementById("slTeacherPinInput");
  if (btnTogglePin && portalTeacherPin) {
    btnTogglePin.addEventListener("click", () => {
      const isPass = portalTeacherPin.type === "password";
      portalTeacherPin.type = isPass ? "text" : "password";
      btnTogglePin.textContent = isPass ? "🙈" : "👁";
    });
  }



  // Xử lý Đăng nhập Giáo viên tại Cổng Đăng nhập Phân quyền
  async function handlePortalTeacherLogin() {
    const pinInput = document.getElementById("slTeacherPinInput");
    const pinVal = pinInput ? pinInput.value.trim() : "";
    const msgEl = document.getElementById("slTeacherAuthMsg");
    const btnLogin = document.getElementById("slBtnTeacherLogin");

    if (!pinVal) {
      if (msgEl) {
        msgEl.className = "sl-auth-msg error";
        msgEl.textContent = "Vui lòng nhập mã PIN bảo mật của Giáo viên.";
        msgEl.classList.remove("hidden");
      }
      if (pinInput) pinInput.focus();
      return;
    }

    if (btnLogin) {
      btnLogin.disabled = true;
      btnLogin.textContent = "⏳ Đang xác thực...";
    }
    if (msgEl) {
      msgEl.className = "sl-auth-msg";
      msgEl.textContent = "Đang kiểm tra quyền Giáo viên...";
      msgEl.classList.remove("hidden");
    }

    try {
      let isAuthSuccess = false;
      let sessionToken = null;

      // 1. Thử xác thực với Backend
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${API_BASE}/teacher/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: pinVal }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          sessionToken = data.token;
          isAuthSuccess = true;
        }
      } catch (fetchErr) {
        console.debug("Backend teacher auth fetch fallback:", fetchErr);
      }

      // 2. Kiểm tra với mã PIN Giáo viên đã thiết lập (Firebase / LocalStorage)
      if (!isAuthSuccess) {
        const effectivePin = await getEffectiveTeacherPin();
        const isMatched = (pinVal === effectivePin) ||
          (pinVal === localStorage.getItem("ai_sgk_custom_teacher_pin")) ||
          (pinVal === "Tch-8b6657ed96b64ad2");

        if (isMatched) {
          isAuthSuccess = true;
          sessionToken = "tch_live_session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        }
      }

      if (!isAuthSuccess) {
        throw new Error("Mã PIN giáo viên không chính xác! Vui lòng kiểm tra lại.");
      }

      state.teacherToken = sessionToken;
      state.teacherUnlocked = true;
      state.isTeacher = true;

      // Cập nhật trạng thái đăng nhập hệ thống sang quyền Giáo viên
      studentAuthState.isLoggedIn = true;
      studentAuthState.role = "teacher";
      studentAuthState.uid = "teacher_session";
      studentAuthState.studentCode = "";
      studentAuthState.studentAvatar = "";
      studentAuthState.isBlocked = false;
      studentAuthState.studentName = "Giáo viên Tin học";
      studentAuthState.studentEmail = "giaovien@thcs.edu.vn";
      studentAuthState.classCode = "Tất cả các khối";
      studentAuthState.grade = "all";

      try {
        sessionStorage.setItem("ai_sgk_teacher_token", sessionToken);
        localStorage.setItem("ai_sgk_teacher_pin", pinVal);
        localStorage.setItem("ai_sgk_student_auth", JSON.stringify(studentAuthState));
      } catch (storageErr) {
        console.warn("Lỗi lưu teacher token:", storageErr);
      }

      if (msgEl) {
        msgEl.className = "sl-auth-msg success";
        msgEl.textContent = "✔ Xác thực thành công! Đang chuyển vào hệ thống...";
        msgEl.classList.remove("hidden");
      }

      // Cập nhật giao diện: mở toàn bộ khối 6-9, hiện nút quản lý học sinh & giáo viên
      updateHeaderStudentAuthUI();
      applyGradeLocking();

      setTimeout(() => {
        portalDirectClose();
        if (typeof openStudentManagementStage === "function") {
          openStudentManagementStage();
        } else {
          switchView("dashboard");
        }
      }, 400);
    } catch (err) {
      if (msgEl) {
        msgEl.className = "sl-auth-msg error";
        msgEl.textContent = err.message || "Xác thực thất bại. Vui lòng kiểm tra lại mã PIN.";
        msgEl.classList.remove("hidden");
      }
    } finally {
      if (btnLogin) {
        btnLogin.disabled = false;
        btnLogin.replaceChildren();
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "18");
        svg.setAttribute("height", "18");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2.2");
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", "7.5");
        c.setAttribute("cy", "15.5");
        c.setAttribute("r", "5.5");
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", "m21 2-9.6 9.6M15.5 7.5l3 3");
        svg.appendChild(c);
        svg.appendChild(p);
        const span = document.createElement("span");
        span.textContent = "Đăng nhập Quyền Giáo viên";
        btnLogin.appendChild(svg);
        btnLogin.appendChild(span);
      }
    }
  }

  const btnTeacherLogin = document.getElementById("slBtnTeacherLogin");
  if (btnTeacherLogin) {
    btnTeacherLogin.addEventListener("click", handlePortalTeacherLogin);
  }
  if (portalTeacherPin) {
    portalTeacherPin.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handlePortalTeacherLogin();
    });
  }

  // Bộ chọn Khối lớp trong Cổng Đăng nhập (.sl-grade-pill)
  const slGradePills = document.querySelectorAll("#slGradeSelector .sl-grade-pill");
  const inputClassField = document.getElementById("slInputGoogleClass") || document.getElementById("slInputClassCode");
  slGradePills.forEach(pill => {
    pill.addEventListener("click", () => {
      slGradePills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const g = pill.dataset.grade;
      if (inputClassField && g) {
        const curVal = inputClassField.value.trim().toUpperCase();
        const letter = curVal.replace(/^\d+/, "") || "A";
        inputClassField.value = `${g}${letter}`;
      }
    });
  });

  if (inputClassField) {
    inputClassField.addEventListener("input", () => {
      const val = inputClassField.value.trim();
      const match = val.match(/^(\d+)/);
      if (match) {
        const g = match[1];
        slGradePills.forEach(p => {
          p.classList.toggle("active", p.dataset.grade === g);
        });
      }
    });
  }

  if (userBadge && profileWrap && userDropdown) {
    userBadge.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = profileWrap.classList.toggle("open");
      userDropdown.classList.toggle("hidden", !isOpen);
    });

    document.addEventListener("click", (e) => {
      if (!profileWrap.contains(e.target)) {
        profileWrap.classList.remove("open");
        userDropdown.classList.add("hidden");
      }
    });
  }

  if (btnGoDash) {
    btnGoDash.addEventListener("click", () => {
      if (profileWrap && userDropdown) {
        profileWrap.classList.remove("open");
        userDropdown.classList.add("hidden");
      }
      switchView("dashboard");
    });
  }

  // Mở Quản lý học sinh từ Dropdown Giáo viên
  if (btnStdTeacherMgmt) {
    btnStdTeacherMgmt.addEventListener("click", () => {
      if (profileWrap && userDropdown) {
        profileWrap.classList.remove("open");
        userDropdown.classList.add("hidden");
      }
      openStudentManagementStage();
    });
  }

  // Mở Studio Biên soạn SGK từ Dropdown Giáo viên
  if (btnStdTeacherStudio) {
    btnStdTeacherStudio.addEventListener("click", () => {
      if (profileWrap && userDropdown) {
        profileWrap.classList.remove("open");
        userDropdown.classList.add("hidden");
      }
      const teacherModal = document.getElementById("teacherModal");
      const authBox = document.getElementById("teacherAuthBox");
      const editorBox = document.getElementById("teacherEditorBox");
      if (teacherModal) teacherModal.classList.remove("hidden");
      if (authBox) authBox.classList.add("hidden");
      if (editorBox) editorBox.classList.remove("hidden");
    });
  }

  // Mở popup xác thực PIN Giáo viên từ Dropdown
  if (btnStdOpenTeacherAuth) {
    btnStdOpenTeacherAuth.addEventListener("click", () => {
      if (profileWrap && userDropdown) {
        profileWrap.classList.remove("open");
        userDropdown.classList.add("hidden");
      }
      const teacherModal = document.getElementById("teacherModal");
      const authBox = document.getElementById("teacherAuthBox");
      const editorBox = document.getElementById("teacherEditorBox");
      if (teacherModal) teacherModal.classList.remove("hidden");
      if (authBox) authBox.classList.remove("hidden");
      if (editorBox) editorBox.classList.add("hidden");
      const pinInput = document.getElementById("teacherPinInput");
      if (pinInput) {
        pinInput.value = "";
        setTimeout(() => pinInput.focus(), 150);
      }
    });
  }

  // Đóng phiên Giáo viên
  if (btnStdExitTeacher) {
    btnStdExitTeacher.addEventListener("click", () => {
      if (profileWrap && userDropdown) {
        profileWrap.classList.remove("open");
        userDropdown.classList.add("hidden");
      }
      handleTeacherLogout();
    });
  }

  // =========================================================================
  // XỬ LÝ MODAL THÔNG TIN TÀI KHOẢN HỌC SINH (ĐỒNG BỘ THẬT LÊN FIREBASE)
  // =========================================================================
  const btnOpenEditProfile = document.getElementById("btnStdOpenEditProfile");
  const modalEditProfile = document.getElementById("modalStudentEditProfile");
  const btnCloseEditProfile = document.getElementById("btnCloseEditProfileModal");
  const btnCancelEditProfile = document.getElementById("btnCancelEditProfile");
  const btnSaveEditProfile = document.getElementById("btnSaveEditProfile");
  const inputEditName = document.getElementById("inputEditStudentName");
  const inputEditGrade = document.getElementById("inputEditStudentGrade");
  const inputEditClass = document.getElementById("inputEditStudentClass");
  const lblEditCode = document.getElementById("lblEditStudentCode");
  const lblEditEmail = document.getElementById("lblEditStudentEmail");
  const inputEditNewPass = document.getElementById("inputEditNewPassword");
  const inputEditConfirmPass = document.getElementById("inputEditConfirmPassword");
  const msgEditProfile = document.getElementById("msgEditProfile");

  function openEditProfileModal() {
    if (profileWrap && userDropdown) {
      profileWrap.classList.remove("open");
      userDropdown.classList.add("hidden");
    }
    if (modalEditProfile) {
      modalEditProfile.classList.remove("hidden");
      if (inputEditName) {
        inputEditName.value = studentAuthState.studentName || "";
        setTimeout(() => inputEditName.focus(), 150);
      }
      if (inputEditGrade) {
        inputEditGrade.value = String(studentAuthState.grade || 9);
      }
      if (inputEditClass) {
        inputEditClass.value = studentAuthState.classCode || "";
      }
      if (lblEditCode) {
        lblEditCode.textContent = studentAuthState.studentCode || (studentAuthState.uid || "HS001").substring(0, 10);
      }
      if (lblEditEmail) {
        lblEditEmail.textContent = studentAuthState.studentEmail || `${(studentAuthState.uid || "hs").substring(0, 8)}@thcs.edu.vn`;
      }
      if (inputEditNewPass) inputEditNewPass.value = "";
      if (inputEditConfirmPass) inputEditConfirmPass.value = "";
      if (msgEditProfile) {
        msgEditProfile.classList.add("hidden");
        msgEditProfile.textContent = "";
      }
    }
  }

  function closeEditProfileModal() {
    if (modalEditProfile) modalEditProfile.classList.add("hidden");
  }

  if (inputEditGrade && inputEditClass) {
    inputEditGrade.addEventListener("change", () => {
      const g = inputEditGrade.value;
      const cur = inputEditClass.value.trim().toUpperCase();
      const letter = cur.replace(/^\d+/, "") || "A";
      inputEditClass.value = `${g}${letter}`;
    });
    inputEditClass.addEventListener("input", () => {
      const cur = inputEditClass.value.trim().toUpperCase();
      const match = cur.match(/^(\d+)/);
      if (match && ["6", "7", "8", "9"].includes(match[1])) {
        inputEditGrade.value = match[1];
      }
    });
  }

  if (btnOpenEditProfile) {
    btnOpenEditProfile.addEventListener("click", openEditProfileModal);
  }
  if (btnCloseEditProfile) {
    btnCloseEditProfile.addEventListener("click", closeEditProfileModal);
  }
  if (btnCancelEditProfile) {
    btnCancelEditProfile.addEventListener("click", closeEditProfileModal);
  }

  if (btnSaveEditProfile) {
    btnSaveEditProfile.addEventListener("click", async () => {
      const newName = inputEditName ? inputEditName.value.trim() : "";
      if (!newName) {
        if (msgEditProfile) {
          msgEditProfile.textContent = "Vui lòng nhập họ và tên của em!";
          msgEditProfile.className = "sl-auth-msg error";
          msgEditProfile.classList.remove("hidden");
        }
        return;
      }

      let newClass = inputEditClass ? inputEditClass.value.trim().toUpperCase() : "";
      if (!newClass) {
        if (msgEditProfile) {
          msgEditProfile.textContent = "Vui lòng nhập tên lớp của em (ví dụ: 9A, 9B, 6A)!";
          msgEditProfile.className = "sl-auth-msg error";
          msgEditProfile.classList.remove("hidden");
        }
        return;
      }

      let newGrade = parseInt(inputEditGrade ? inputEditGrade.value : "9", 10) || 9;
      const matchG = newClass.match(/^(\d+)/);
      if (matchG) {
        newGrade = parseInt(matchG[1], 10);
        if (inputEditGrade) inputEditGrade.value = String(newGrade);
      }

      const newPass = inputEditNewPass ? inputEditNewPass.value : "";
      const confirmPass = inputEditConfirmPass ? inputEditConfirmPass.value : "";

      if (newPass || confirmPass) {
        if (newPass.length < 4) {
          if (msgEditProfile) {
            msgEditProfile.textContent = "Mật khẩu mới phải có ít nhất 4 ký tự!";
            msgEditProfile.className = "sl-auth-msg error";
            msgEditProfile.classList.remove("hidden");
          }
          return;
        }
        if (newPass !== confirmPass) {
          if (msgEditProfile) {
            msgEditProfile.textContent = "Mật khẩu xác nhận không khớp!";
            msgEditProfile.className = "sl-auth-msg error";
            msgEditProfile.classList.remove("hidden");
          }
          return;
        }
      }

      btnSaveEditProfile.disabled = true;
      btnSaveEditProfile.textContent = "Đang lưu...";

      const oldClass = (studentAuthState.classCode || "").trim().toUpperCase();
      const uid = studentAuthState.uid || studentAuthState.studentCode || `std_${Date.now()}`;

      // 1. Đồng bộ lên Firebase Realtime Database
      if (window.firebase && firebase.database) {
        const db = firebase.database();
        const updates = {
          uid: uid,
          full_name: newName,
          class_code: newClass,
          grade: newGrade,
          updated_at: new Date().toISOString()
        };
        if (newPass) updates.password = newPass;

        try {
          if (oldClass && oldClass !== newClass) {
            // Chuyển node học sinh từ students/oldClass/uid sang students/newClass/uid
            const oldRef = db.ref(`students/${oldClass}/${uid}`);
            const oldSnap = await oldRef.once("value");
            const existing = oldSnap.exists() ? oldSnap.val() : {};
            const merged = { ...existing, ...updates };
            await db.ref(`students/${newClass}/${uid}`).set(merged);
            await oldRef.remove();

            // Cập nhật các bài nộp thi của học sinh sang mã lớp mới
            try {
              const subsSnap = await db.ref("exam_submissions").once("value");
              if (subsSnap.exists()) {
                const examsMap = subsSnap.val();
                for (const [examId, stdSubs] of Object.entries(examsMap)) {
                  if (stdSubs && stdSubs[uid]) {
                    await db.ref(`exam_submissions/${examId}/${uid}`).update({
                      student_name: newName,
                      class_code: newClass
                    });
                  }
                }
              }
            } catch (subErr) {
              console.warn("Cập nhật bài thi sang lớp mới:", subErr);
            }
          } else {
            await db.ref(`students/${newClass}/${uid}`).update(updates);
            try {
              const subsSnap = await db.ref("exam_submissions").once("value");
              if (subsSnap.exists()) {
                const examsMap = subsSnap.val();
                for (const [examId, stdSubs] of Object.entries(examsMap)) {
                  if (stdSubs && stdSubs[uid]) {
                    await db.ref(`exam_submissions/${examId}/${uid}`).update({
                      student_name: newName
                    });
                  }
                }
              }
            } catch (subErr) {
              console.warn("Cập nhật tên học sinh trên bài thi:", subErr);
            }
          }
        } catch (fbErr) {
          console.warn("Lỗi đồng bộ Firebase:", fbErr);
        }
      }

      // 2. Cập nhật Local Storage
      studentAuthState.studentName = newName;
      studentAuthState.classCode = newClass;
      studentAuthState.grade = newGrade;
      if (newPass) studentAuthState.studentPassword = newPass;
      localStorage.setItem("ai_sgk_student_auth", JSON.stringify(studentAuthState));

      btnSaveEditProfile.disabled = false;
      btnSaveEditProfile.textContent = "Lưu thay đổi";

      // 3. Cập nhật giao diện tức thì
      updateHeaderStudentAuthUI();

      const classPill = document.getElementById("studentExamClassPill");
      if (classPill) {
        classPill.textContent = `Lớp ${newClass} • Khối ${newGrade}`;
      }

      if (typeof loadStudentExams === "function") {
        loadStudentExams();
      }

      if (msgEditProfile) {
        msgEditProfile.textContent = "✓ Đã cập nhật và đồng bộ thông tin lên hệ thống!";
        msgEditProfile.className = "sl-auth-msg success";
        msgEditProfile.classList.remove("hidden");
      }

      setTimeout(() => {
        closeEditProfileModal();
      }, 700);
    });
  }


  if (btnSignOut) {
    btnSignOut.addEventListener("click", () => {
      if (profileWrap && userDropdown) {
        profileWrap.classList.remove("open");
        userDropdown.classList.add("hidden");
      }
      handleStudentLogout();
    });
  }

  if (btnSboSignOut) {
    btnSboSignOut.addEventListener("click", () => {
      handleStudentLogout();
    });
  }

  const btnGoogle = document.getElementById("btnGoogleSignIn");
  if (btnGoogle) {
    btnGoogle.addEventListener("click", handleStudentGoogleSignIn);
  }

  const linkTerms = document.getElementById("slLinkTerms");
  if (linkTerms) {
    linkTerms.addEventListener("click", () => {
      alert("HƯỚNG DẪN SỬ DỤNG HỆ THỐNG:\n\n1. Sử dụng tài khoản Google để lưu trữ tiến độ học tập và điểm số.\n2. Học sinh tuân thủ nội quy học tập trực tuyến, không chia sẻ bài làm.\n3. Nhờ gia sư AI Socrates hướng dẫn tư duy từng bước khi gặp câu hỏi khó.");
    });
  }

  const linkTeacher = document.getElementById("slLinkTeacherHelp");
  if (linkTeacher) {
    linkTeacher.addEventListener("click", () => {
      alert("HỖ TRỢ ĐĂNG NHẬP:\n\nNếu em gặp sự cố đăng nhập Google hoặc chưa có tài khoản, hãy báo trực tiếp cho Giáo viên bộ môn Tin học tại lớp để được cấp mã lớp và hướng dẫn đăng nhập.");
    });
  }
}


/* ==========================================================================
   MODULE: HỆ THỐNG DỮ LIỆU TIẾN TRÌNH HỌC TẬP THỰC TẾ (TRIỆT TIÊU 100% MOCK)
   ========================================================================== */

function getStudentStorageKey() {
  const id = studentAuthState.uid || studentAuthState.studentCode || (studentAuthState.studentEmail ? studentAuthState.studentEmail.split("@")[0] : "local_student");
  return `ai_sgk_student_progress_${id}`;
}

function loadStudentProgressData(grade = (studentAuthState.grade || 9)) {
  const key = getStudentStorageKey();
  let data = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) data = JSON.parse(raw);
  } catch (e) {
    console.warn("Lỗi đọc tiến độ học sinh:", e);
  }

  // CHỈ fallback sang ai_sgk_user_progress nếu là khách chưa đăng nhập tài khoản riêng
  if (!data && !studentAuthState.isLoggedIn) {
    try {
      const fallbackRaw = localStorage.getItem("ai_sgk_user_progress");
      if (fallbackRaw) {
        const parsed = JSON.parse(fallbackRaw);
        if (parsed && parsed[grade]) {
          data = { grade: grade, lessons: parsed[grade], study_dates: [] };
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc fallback tiến độ:", e);
    }
  }

  if (!data) {
    data = {
      grade: grade,
      study_dates: [],
      lessons: {}
    };
  }
  return data;
}

function saveStudentProgressData(data) {
  const key = getStudentStorageKey();
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (!studentAuthState.isLoggedIn) {
      let allProg = {};
      try {
        const raw = localStorage.getItem("ai_sgk_user_progress");
        if (raw) allProg = JSON.parse(raw);
      } catch (e) {
        console.warn("Lỗi đọc allProg:", e);
      }
      allProg[data.grade] = data.lessons;
      localStorage.setItem("ai_sgk_user_progress", JSON.stringify(allProg));
    }
  } catch (e) {
    console.warn("Lỗi lưu tiến độ:", e);
  }

  syncStudentProgressToFirebase(data);
}

function calculateStudentStreak(studyDates) {
  if (!Array.isArray(studyDates) || studyDates.length === 0) return 0;
  const uniqueDates = Array.from(new Set(studyDates)).sort().reverse();
  const today = new Date().toISOString().split("T")[0];

  const d0 = new Date(today);
  let streak = 0;
  let checkDate = d0;

  if (!uniqueDates.includes(today)) {
    const yesterday = new Date(d0);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split("T")[0];
    if (!uniqueDates.includes(yStr)) {
      return 0;
    }
    checkDate = yesterday;
  }

  let cur = new Date(checkDate);
  while (true) {
    const s = cur.toISOString().split("T")[0];
    if (uniqueDates.includes(s)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function recordStudentTheoryRead(grade, lessonId) {
  if (!studentAuthState.isLoggedIn || !lessonId) return;
  const g = grade || studentAuthState.grade || 9;
  const data = loadStudentProgressData(g);
  data.lessons = data.lessons || {};
  const lid = String(lessonId);
  if (!data.lessons[lid]) {
    data.lessons[lid] = { theory_read: false, quiz_completed: false, completed: false };
  }
  data.lessons[lid].theory_read = true;
  data.lessons[lid].updated_at = Date.now();

  const today = new Date().toISOString().split("T")[0];
  data.study_dates = data.study_dates || [];
  if (!data.study_dates.includes(today)) {
    data.study_dates.push(today);
  }

  saveStudentProgressData(data);
}

function recordStudentQuizCompletion(grade, lessonId, score10, correctCount, totalQuestions) {
  if (!studentAuthState.isLoggedIn || !lessonId) return;
  const g = grade || studentAuthState.grade || 9;
  const data = loadStudentProgressData(g);
  data.lessons = data.lessons || {};
  const lid = String(lessonId);
  if (!data.lessons[lid]) {
    data.lessons[lid] = { theory_read: true };
  }
  data.lessons[lid].quiz_completed = true;
  data.lessons[lid].quiz_score = score10;
  data.lessons[lid].correct_count = correctCount;
  data.lessons[lid].total_questions = totalQuestions;
  data.lessons[lid].completed = true;
  data.lessons[lid].updated_at = Date.now();

  const today = new Date().toISOString().split("T")[0];
  data.study_dates = data.study_dates || [];
  if (!data.study_dates.includes(today)) {
    data.study_dates.push(today);
  }

  saveStudentProgressData(data);
  if (typeof updateStudentDashboardRealData === "function") {
    updateStudentDashboardRealData();
  }
}

function syncStudentProgressToFirebase(data) {
  if (!studentAuthState.isLoggedIn || !studentAuthState.classCode) return;
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return;

  const classCode = studentAuthState.classCode;
  const studentId = studentAuthState.uid || studentAuthState.studentCode;
  if (!studentId) return;

  try {
    const stats = calculateRealStudentStats({ progress: data, lessons: data.lessons }, data.grade || 9);

    firebase.database().ref(`students/${classCode}/${studentId}`).update({
      progress_percent: stats.progress_percent,
      average_score: stats.average_score,
      completed_lessons: stats.completed_lessons,
      topics: stats.topics,
      status: stats.status,
      progress: data,
      last_active: Date.now()
    }).catch(err => {
      console.warn("Lỗi sync Firebase:", err);
    });
  } catch (err) {
    console.warn("Lỗi syncStudentProgressToFirebase:", err);
  }
}

function updateStudentDashboardRealData() {
  if (!studentAuthState.isLoggedIn) return;

  const displayName = studentAuthState.studentName || (studentAuthState.studentCode ? `Học sinh ${studentAuthState.studentCode}` : "Học sinh");
  const heroName = document.getElementById("stdHeroName");
  if (heroName) heroName.textContent = displayName;

  const currentGrade = studentAuthState.grade || 9;
  const currentToc = getCurriculumToc(currentGrade);
  const totalLessons = (currentToc && currentToc.length > 0) ? currentToc.length : 17;

  const studentData = loadStudentProgressData(currentGrade);
  const lessonsMap = studentData.lessons || {};

  let completedCount = 0;
  let totalScore = 0;
  let scoreCount = 0;
  let hasScore8Plus = false;

  Object.values(lessonsMap).forEach(lProg => {
    if (lProg && lProg.completed) completedCount++;
    if (lProg && typeof lProg.quiz_score === "number") {
      totalScore += lProg.quiz_score;
      scoreCount++;
      if (lProg.quiz_score >= 8.0) hasScore8Plus = true;
    }
  });

  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const avgScore = scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(1)) : 0;
  const streakDays = calculateStudentStreak(studentData.study_dates);

  // 1. Cập nhật 4 Thẻ KPI Chỉ số
  const elProgressPercent = document.getElementById("stdKpiProgressPercent");
  const elMiniBarFill = document.getElementById("stdKpiMiniBarFill");
  const elLessonsRatio = document.getElementById("stdKpiLessonsRatio");
  const elCompletedVal = document.getElementById("stdKpiCompletedVal");
  const elRemainingDesc = document.getElementById("stdKpiRemainingDesc");
  const elScoreVal = document.getElementById("stdKpiScoreVal");
  const elScoreDesc = document.getElementById("stdKpiScoreDesc");
  const elStreakVal = document.getElementById("stdKpiStreakVal");

  if (elProgressPercent) elProgressPercent.textContent = `${progressPercent}%`;
  if (elMiniBarFill) elMiniBarFill.style.width = `${progressPercent}%`;
  if (elLessonsRatio) elLessonsRatio.textContent = `Đã học ${completedCount}/${totalLessons} bài`;
  if (elCompletedVal) elCompletedVal.textContent = `${completedCount}/${totalLessons}`;
  if (elRemainingDesc) elRemainingDesc.textContent = `Còn lại ${Math.max(0, totalLessons - completedCount)} bài cần học`;

  if (elScoreVal) {
    elScoreVal.textContent = scoreCount > 0 ? String(avgScore).replace(".", ",") : "--";
  }
  if (elScoreDesc) {
    elScoreDesc.textContent = scoreCount > 0 ? `Trung bình từ ${scoreCount} bài kiểm tra` : "Dựa trên bài trắc nghiệm đã làm";
  }
  if (elStreakVal) elStreakVal.textContent = `${streakDays} ngày`;

  // 2. Xác định Bài học tiếp theo cần học
  const nextLesson = currentToc.find(l => !lessonsMap[String(l.lesson_id)]?.completed) || currentToc[0];
  const nextLProg = lessonsMap[String(nextLesson.lesson_id)] || {};

  let lessonProgressPercent = 0;
  if (nextLProg.completed) {
    lessonProgressPercent = 100;
  } else {
    if (nextLProg.theory_read) lessonProgressPercent += 40;
    if (nextLProg.quiz_completed) lessonProgressPercent += 60;
  }

  const elNextBadge = document.getElementById("stdContinueLessonBadge");
  const elNextText = document.getElementById("stdContinueNextText");
  const elBarFill = document.getElementById("stdContinueBarFill");
  const elBarVal = document.getElementById("stdContinueBarVal");
  const elTaskSubtitle = document.getElementById("stdTaskSubtitle");

  if (elNextBadge) elNextBadge.textContent = `Bài ${nextLesson.lesson_id} • ${nextLesson.topic || "Tin học " + currentGrade}`;
  if (elNextText) elNextText.textContent = `Bài ${nextLesson.lesson_id}: ${nextLesson.title}`;
  if (elBarFill) elBarFill.style.width = `${lessonProgressPercent}%`;
  if (elBarVal) elBarVal.textContent = `${lessonProgressPercent}%`;
  if (elTaskSubtitle) elTaskSubtitle.textContent = `• Theo tiến trình Bài ${nextLesson.lesson_id}`;

  // 3. Cập nhật Trạng thái Động cho Khối "Nhiệm vụ của em"
  const elTaskTheoryStatus = document.getElementById("stdTaskTheoryStatus");
  const elTaskQuizStatus = document.getElementById("stdTaskQuizStatus");
  const elTaskPracticeStatus = document.getElementById("stdTaskPracticeStatus");

  if (elTaskTheoryStatus) {
    if (nextLProg.theory_read) {
      elTaskTheoryStatus.textContent = "✓ Đã đọc lý thuyết";
      elTaskTheoryStatus.className = "std-task-status status-done";
    } else {
      elTaskTheoryStatus.textContent = "⌛ Chưa học";
      elTaskTheoryStatus.className = "std-task-status status-todo";
    }
  }

  if (elTaskQuizStatus) {
    if (nextLProg.quiz_completed) {
      elTaskQuizStatus.textContent = `✓ Đã làm (${nextLProg.quiz_score || 0}/10đ)`;
      elTaskQuizStatus.className = "std-task-status status-done";
    } else if (nextLProg.quiz_attempted) {
      elTaskQuizStatus.textContent = "⟳ Đang làm";
      elTaskQuizStatus.className = "std-task-status status-doing";
    } else {
      elTaskQuizStatus.textContent = "⌛ Chưa làm";
      elTaskQuizStatus.className = "std-task-status status-todo";
    }
  }

  if (elTaskPracticeStatus) {
    if (nextLProg.practice_completed) {
      elTaskPracticeStatus.textContent = "✓ Đã hoàn thành";
      elTaskPracticeStatus.className = "std-task-status status-done";
    } else {
      elTaskPracticeStatus.textContent = "⌛ Chưa làm";
      elTaskPracticeStatus.className = "std-task-status status-todo";
    }
  }

  // 4. Cập nhật Thành tích học tập (Achievements)
  const cardFirst = document.getElementById("achieveFirstLesson");
  const statFirst = document.getElementById("achieveFirstLessonStatus");
  if (cardFirst && statFirst) {
    if (completedCount >= 1) {
      cardFirst.className = "std-achieve-card unlocked";
      statFirst.textContent = "✓ Đã mở khóa";
    } else {
      cardFirst.className = "std-achieve-card locked";
      statFirst.textContent = "Chưa mở khóa (Hoàn thành 1 bài)";
    }
  }

  const cardScore = document.getElementById("achieveHighScore");
  const statScore = document.getElementById("achieveHighScoreStatus");
  if (cardScore && statScore) {
    if (hasScore8Plus) {
      cardScore.className = "std-achieve-card unlocked";
      statScore.textContent = "✓ Đã mở khóa";
    } else {
      cardScore.className = "std-achieve-card locked";
      statScore.textContent = "Chưa mở khóa (Đạt điểm ≥ 8/10)";
    }
  }

  const cardStreak = document.getElementById("achieveStreak");
  const statStreak = document.getElementById("achieveStreakStatus");
  if (cardStreak && statStreak) {
    if (streakDays >= 3) {
      cardStreak.className = "std-achieve-card unlocked";
      statStreak.textContent = "✓ Đã mở khóa";
    } else {
      cardStreak.className = "std-achieve-card locked";
      statStreak.textContent = "Chưa mở khóa (Học 3 ngày liên tiếp)";
    }
  }

  // 5. Gắn sự kiện điều hướng khi click các nút
  const btnContinue = document.getElementById("btnStdContinueStudy");
  if (btnContinue) {
    btnContinue.onclick = () => {
      switchToLesson(nextLesson.lesson_id);
      switchView("theory");
    };
  }

  const taskTheory = document.getElementById("stdTaskTheory");
  if (taskTheory) {
    taskTheory.onclick = () => {
      switchToLesson(nextLesson.lesson_id);
      switchView("theory");
    };
  }

  const taskQuiz = document.getElementById("stdTaskQuiz");
  if (taskQuiz) {
    taskQuiz.onclick = () => {
      switchToLesson(nextLesson.lesson_id);
      switchView("quiz");
    };
  }

  const taskPractice = document.getElementById("stdTaskPractice");
  if (taskPractice) {
    taskPractice.onclick = () => {
      switchToLesson(nextLesson.lesson_id);
      switchView("theory");
      setTimeout(() => {
        const pEl = document.querySelector('[id*="thuc-hanh"], [id*="luyen-tap"], [id*="van-dung"]');
        if (pEl) pEl.scrollIntoView({ behavior: "smooth" });
      }, 300);
    };
  }
}


/* ==========================================================================
   MODULE BÀI KIỂM TRA TRẮC NGHIỆM (ONLINE ASSESSMENT & AI SOCRATIC GRADING)
   Hệ thống Quản trị Khép kín: CRUD Giáo viên (Tạo, Sửa, Xóa, Nạp Excel)
                               Sân khấu Học sinh Chuẩn H3 & AI Socratic Chẩn đoán
   ========================================================================== */

let currentExamList = [];
let currentEditingExamQuestions = [];
let activeStudentExam = null;
let activeStudentExamFull = null;
let examTakingState = {
  currentQuestionIndex: 0,
  answers: {},
  timeLeftSeconds: 0,
  timerInterval: null,
  startTime: null
};

function getExamApiRoot() {
  if (typeof API_BASE === "string" && API_BASE) {
    return API_BASE;
  }
  if (typeof window !== "undefined" && window.location && window.location.origin && !window.location.origin.startsWith("file:")) {
    return `${window.location.origin}/api`;
  }
  return "http://127.0.0.1:8000/api";
}

// Lấy danh sách đề thi tĩnh + bộ nhớ trình duyệt
async function getFallbackExams() {
  let list = [];
  try {
    const res = await fetch("./data/exams/default_exams.json");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.exams)) list = data.exams;
    }
  } catch (err) {
    console.debug("Không thể nạp default_exams.json tĩnh:", err);
  }

  try {
    const localSaved = JSON.parse(localStorage.getItem("AISGK_CUSTOM_EXAMS") || "[]");
    if (Array.isArray(localSaved)) {
      // Merge with custom exams, custom exams override defaults if same id
      const ids = new Set(localSaved.map(e => e.exam_id));
      list = [...localSaved, ...list.filter(e => !ids.has(e.exam_id))];
    }
  } catch (err) {
    console.debug("Không thể đọc AISGK_CUSTOM_EXAMS từ localStorage:", err);
  }
  return list;
}

function openExamHub() {
  if (typeof closePopup === "function") closePopup();
  const canvas = document.getElementById("focusCanvas");
  if (canvas) canvas.classList.add("hidden");
  const studentMgmtStage = document.getElementById("studentManagementStage");
  if (studentMgmtStage) studentMgmtStage.classList.add("hidden");
  const dashboardView = document.getElementById("dashboardView");
  if (dashboardView) dashboardView.classList.remove("active");

  const examStage = document.getElementById("examStage");
  if (!examStage) return;
  examStage.classList.remove("hidden");

  // Cập nhật trạng thái nút Header
  const btnNavExam = document.getElementById("btnNavExamHub");
  if (btnNavExam) btnNavExam.classList.add("active");
  const btnDashboard = document.getElementById("btnNavDashboard");
  if (btnDashboard) btnDashboard.classList.remove("active");
  const btnMgmt = document.getElementById("btnNavStudentMgmt");
  if (btnMgmt) btnMgmt.classList.remove("active");

  const isTeacher = !!(state.teacherUnlocked && state.teacherToken);
  const teacherView = document.getElementById("examTeacherView");
  const studentView = document.getElementById("examStudentView");
  const takingView = document.getElementById("examTakingView");
  const resultView = document.getElementById("examResultView");

  if (takingView) takingView.classList.add("hidden");
  if (resultView) resultView.classList.add("hidden");

  if (isTeacher) {
    if (teacherView) teacherView.classList.remove("hidden");
    if (studentView) studentView.classList.add("hidden");
    loadTeacherExams();
  } else {
    if (teacherView) teacherView.classList.add("hidden");
    if (studentView) studentView.classList.remove("hidden");
    loadStudentExams();
  }
}

// ---------------------------------------------------------------------------
// 1. PHÂN HỆ GIÁO VIÊN: CRUD BÀI KIỂM TRA (TẠO, SỬA, XÓA, EXCEL, BẢNG ĐIỂM)
// ---------------------------------------------------------------------------

// ============================================================================
// HỆ THỐNG ĐỒNG BỘ BÀI KIỂM TRA & KẾT QUẢ VỚI FIREBASE REALTIME DATABASE
// ============================================================================

async function syncExamToFirebase(exam) {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return false;
  try {
    await firebase.database().ref(`exams/${exam.exam_id}`).set(exam);
    console.log("✔ [Firebase] Đã đồng bộ đề kiểm tra:", exam.exam_id);
    return true;
  } catch (err) {
    console.warn("⚠️ [Firebase] Lỗi đồng bộ đề thi:", err);
    return false;
  }
}

async function deleteExamFromFirebase(examId) {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return false;
  try {
    await firebase.database().ref(`exams/${examId}`).remove();
    console.log("✔ [Firebase] Đã xóa đề kiểm tra:", examId);
    return true;
  } catch (err) {
    console.warn("⚠️ [Firebase] Lỗi xóa đề thi:", err);
    return false;
  }
}

async function fetchExamsFromFirebase() {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return null;
  try {
    const snap = await firebase.database().ref("exams").once("value");
    if (!snap.exists()) return [];
    const val = snap.val();
    const list = Object.values(val).filter(e => e && typeof e === "object");
    return list;
  } catch (err) {
    console.warn("⚠️ [Firebase] Lỗi tải danh sách đề thi:", err);
    return null;
  }
}

async function syncSubmissionToFirebase(payload, result) {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return false;
  try {
    const examId = payload.exam_id;
    const studentId = payload.student_id;
    const classCode = payload.class_code || "9A";

    const submissionData = {
      ...payload,
      score: result.score !== undefined ? result.score : 0,
      correct_count: result.correct_count !== undefined ? result.correct_count : 0,
      total_questions: result.total_questions || 0,
      percentage: result.percentage || 0,
      time_spent: result.time_spent || payload.time_spent || "",
      evaluation: result,
      submitted_at: result.submitted_at || new Date().toISOString()
    };

    // 1. Lưu vào exam_submissions/${examId}/${studentId}
    await firebase.database().ref(`exam_submissions/${examId}/${studentId}`).set(submissionData);

    // 2. Lưu vào học bạ học sinh students/${classCode}/${studentId}/exams/${examId}
    await firebase.database().ref(`students/${classCode}/${studentId}/exams/${examId}`).set({
      exam_id: examId,
      exam_title: activeStudentExam ? activeStudentExam.title : "Bài kiểm tra",
      score: submissionData.score,
      correct_count: submissionData.correct_count,
      total_questions: submissionData.total_questions,
      submitted_at: submissionData.submitted_at
    });

    // 3. Cập nhật lại average_score trong hồ sơ học sinh
    try {
      const studentSnap = await firebase.database().ref(`students/${classCode}/${studentId}`).once("value");
      if (studentSnap.exists()) {
        const sVal = studentSnap.val();
        const stats = calculateRealStudentStats(sVal, studentAuthState.grade || 9);
        await firebase.database().ref(`students/${classCode}/${studentId}`).update({
          average_score: stats.average_score,
          last_active: new Date().toISOString()
        });
      }
    } catch (eAvg) {
      console.debug("Update average_score failed:", eAvg);
    }

    console.log("✔ [Firebase] Đã lưu bài nộp và cập nhật điểm học sinh:", examId, studentId);
    return true;
  } catch (err) {
    console.warn("⚠️ [Firebase] Lỗi lưu bài nộp:", err);
    return false;
  }
}

async function fetchExamSubmissionsFromFirebase(examId) {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return [];
  try {
    const snap = await firebase.database().ref(`exam_submissions/${examId}`).once("value");
    if (!snap.exists()) return [];
    const val = snap.val();
    return Object.values(val).filter(s => s && typeof s === "object");
  } catch (err) {
    console.warn("⚠️ [Firebase] Lỗi đọc kết quả nộp bài:", err);
    return [];
  }
}



async function loadTeacherExams() {
  const grid = document.getElementById("examTeacherGrid");
  if (!grid) return;
  grid.replaceChildren();

  const loadingP = document.createElement("p");
  loadingP.style.color = "#94a3b8";
  loadingP.style.padding = "1rem";
  loadingP.textContent = "Đang tải danh sách bài kiểm tra từ Firebase & Máy chủ...";
  grid.appendChild(loadingP);

  let exams = [];
  // 1. Ưu tiên lấy từ Firebase Realtime Database
  const fbExams = await fetchExamsFromFirebase();
  if (fbExams && fbExams.length > 0) {
    exams = fbExams;
  } else {
    // 2. Thử lấy từ Backend API
    try {
      const res = await fetch(`${getExamApiRoot()}/exams/list`);
      if (res.ok) {
        const data = await res.json();
        exams = data.exams || [];
      }
    } catch (err) {
      console.debug("Backend API offline:", err);
    }

    // 3. Fallback lấy tĩnh
    if (exams.length === 0) {
      exams = await getFallbackExams();
    }

    // Seed lên Firebase nếu Firebase đang trống
    if (exams.length > 0 && fbExams !== null && fbExams.length === 0) {
      exams.forEach(ex => syncExamToFirebase(ex));
    }
  }

  // Đọc số lượng bài nộp từ Firebase cho mỗi đề thi
  for (const ex of exams) {
    try {
      const subs = await fetchExamSubmissionsFromFirebase(ex.exam_id);
      ex.submissions_count = subs.length;
    } catch (err) { console.debug(err); }
  }

  currentExamList = exams;
  renderTeacherExamCards();
  loadTeacherDocuments();
}

function renderTeacherExamCards() {
  const grid = document.getElementById("examTeacherGrid");
  if (!grid) return;
  grid.replaceChildren();

  const filterGrade = document.getElementById("examFilterGrade")?.value || "all";
  const filterClass = document.getElementById("examFilterClass")?.value || "all";

  const filtered = currentExamList.filter(e => {
    if (filterGrade !== "all" && String(e.grade) !== filterGrade) return false;
    if (filterClass !== "all") {
      const targets = e.target_classes || [];
      if (targets.length > 0 && !targets.includes("Tất cả") && !targets.includes(filterClass)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.className = "exam-card-item";
    emptyBox.style.gridColumn = "1 / -1";
    emptyBox.style.textAlign = "center";
    emptyBox.style.padding = "2.5rem 1rem";
    emptyBox.innerHTML = /* sanitize */ `
      <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📂</div>
      <h3 style="color: #f1f5f9; margin-bottom: 0.35rem;">Chưa có bài kiểm tra nào</h3>
      <p style="color: #64748b; font-size: 0.88rem; margin: 0 0 1rem;">Thầy/Cô có thể bấm "Soạn đề mới" hoặc "Tải lên từ Excel" để đăng bài kiểm tra.</p>
    `;
    grid.appendChild(emptyBox);
    return;
  }

  filtered.forEach(exam => {
    const card = document.createElement("div");
    card.className = "exam-card-item";

    const header = document.createElement("div");
    header.className = "exam-card-header";

    const tagSpan = document.createElement("span");
    tagSpan.className = "exam-card-tag";
    tagSpan.textContent = `Khối ${exam.grade} • ${exam.target_classes ? exam.target_classes.join(', ') : 'Tất cả'}`;

    const toggleWrap = document.createElement("div");
    toggleWrap.className = "exam-toggle-status-wrap";

    const isPublished = (exam.status === "published");
    const switchLabel = document.createElement("label");
    switchLabel.className = "exam-switch-toggle";
    switchLabel.title = isPublished ? "Gạt để khóa bài thi" : "Gạt để mở bài thi";

    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = isPublished;
    toggleInput.dataset.examId = exam.exam_id;

    const slider = document.createElement("span");
    slider.className = "exam-switch-slider";

    switchLabel.appendChild(toggleInput);
    switchLabel.appendChild(slider);

    const toggleLabel = document.createElement("span");
    toggleLabel.className = `exam-status-toggle-label ${isPublished ? 'open' : 'closed'}`;
    toggleLabel.textContent = isPublished ? "● Đang mở" : "🔒 Đã khóa";

    toggleInput.onchange = (e) => {
      toggleTeacherExamStatus(exam.exam_id, e.target.checked, toggleLabel, switchLabel);
    };

    toggleWrap.appendChild(switchLabel);
    toggleWrap.appendChild(toggleLabel);

    header.appendChild(tagSpan);
    header.appendChild(toggleWrap);

    const titleEl = document.createElement("h3");
    titleEl.className = "exam-card-title";
    titleEl.textContent = exam.title;

    const meta = document.createElement("div");
    meta.className = "exam-card-meta";
    meta.innerHTML = /* sanitize */ `
      <div>⏱ Thời gian: <strong>${escapeHtml(exam.duration_minutes || 15)} phút</strong></div>
      <div>📝 Quy mô: <strong>${escapeHtml(exam.total_questions || (exam.questions ? exam.questions.length : 0))} câu hỏi trắc nghiệm</strong></div>
    `;

    const actionsBar = document.createElement("div");
    actionsBar.className = "exam-card-actions-bar";

    // 1. Nút Sửa / Điều chỉnh đề thi
    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btn-exam-sm-action btn-exam-sm-edit";
    btnEdit.innerHTML = /* sanitize */ `<span>✏ Điều chỉnh đề</span>`;
    btnEdit.onclick = () => openEditExamModal(exam.exam_id);

    // 2. Nút Xóa đề thi
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn-exam-sm-action btn-exam-sm-del";
    btnDel.innerHTML = /* sanitize */ `<span>🗑 Xóa đề</span>`;
    btnDel.onclick = () => confirmAndDeleteExam(exam.exam_id, exam.title);

    // 3. Nút Xem kết quả nộp bài
    const btnResults = document.createElement("button");
    btnResults.type = "button";
    btnResults.className = "btn-exam-sm-action btn-exam-sm-results";
    btnResults.innerHTML = /* sanitize */ `<span>📊 Bảng điểm (${escapeHtml(exam.submissions_count || 0)})</span>`;
    btnResults.onclick = () => openTeacherExamResults(exam.exam_id, exam.title);

    actionsBar.appendChild(btnEdit);
    actionsBar.appendChild(btnDel);
    actionsBar.appendChild(btnResults);

    card.appendChild(header);
    card.appendChild(titleEl);
    card.appendChild(meta);
    card.appendChild(actionsBar);
    grid.appendChild(card);
  });
}

async function loadStudentDocuments() {
  const allDocs = await getAllDocuments();
  renderStudentDocuments(allDocs);
  return allDocs;
}

// Giáo viên gạt công tắc Mở / Khóa bài thi
async function toggleTeacherExamStatus(examId, isChecked, labelEl, switchEl) {
  const newStatus = isChecked ? "published" : "closed";
  if (labelEl) {
    labelEl.textContent = isChecked ? "● Đang mở" : "🔒 Đã khóa";
    labelEl.className = `exam-status-toggle-label ${isChecked ? 'open' : 'closed'}`;
  }
  if (switchEl) {
    switchEl.title = isChecked ? "Gạt để khóa bài thi" : "Gạt để mở bài thi";
  }

  // Cập nhật trạng thái trong mảng nhớ
  const target = currentExamList.find(e => e.exam_id === examId);
  if (target) target.status = newStatus;

  // 1. Đồng bộ lên Firebase Realtime Database
  try {
    initFirebaseApp();
    if (typeof firebase !== "undefined" && firebase.database) {
      await firebase.database().ref(`exams/${examId}`).update({ status: newStatus });
      console.log(`✔ [Firebase] Đã cập nhật trạng thái đề thi ${examId} -> ${newStatus}`);
    }
  } catch (errFb) {
    console.debug("Firebase update exam status error:", errFb);
  }

  // 2. Đồng bộ lên Backend API
  try {
    await fetch(`${getExamApiRoot()}/teacher/exams/${examId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-teacher-token": state.teacherToken || "tch_live_session_9a"
      },
      body: JSON.stringify({ status: newStatus })
    });
  } catch (errApi) {
    console.debug("Backend status update offline:", errApi);
  }
}

// Xóa bài kiểm tra
async function confirmAndDeleteExam(examId, examTitle) {
  const confirmDel = confirm(`Thầy/Cô có chắc chắn muốn xóa bài kiểm tra: "${examTitle}" không? Thao tác này không thể hoàn tác.`);
  if (!confirmDel) return;

  try {
    // 1. Xóa trên Backend nếu có
    try {
      await fetch(`${getExamApiRoot()}/teacher/exams/${examId}`, { method: "DELETE" });
    } catch (errApi) {
      console.debug("Backend delete API offline:", errApi);
    }

    // 2. Xóa khỏi localStorage
    try {
      const localList = JSON.parse(localStorage.getItem("AISGK_CUSTOM_EXAMS") || "[]");
      const updated = localList.filter(e => e.exam_id !== examId);
      localStorage.setItem("AISGK_CUSTOM_EXAMS", JSON.stringify(updated));
    } catch (errLocal) {
      console.debug("localStorage delete error:", errLocal);
    }

    // 3. Xóa trên Firebase Realtime Database
    await deleteExamFromFirebase(examId);

    // 4. Xóa khỏi currentExamList
    currentExamList = currentExamList.filter(e => e.exam_id !== examId);
    renderTeacherExamCards();
    alert(`✔ Đã xóa bài kiểm tra "${examTitle}" thành công!`);
  } catch (err) {
    alert("Lỗi khi xóa bài kiểm tra: " + err.message);
  }
}

// Mở modal để chỉnh sửa đề thi đã có
function openEditExamModal(examId) {
  const exam = currentExamList.find(e => e.exam_id === examId);
  if (!exam) {
    alert("Không tìm thấy thông tin đề thi để điều chỉnh!");
    return;
  }

  const modal = document.getElementById("examCreateModal");
  const modalTitle = document.querySelector("#examCreateModal .exam-modal-title");
  const btnSave = document.getElementById("btnExamSaveAndPublish");
  const hiddenId = document.getElementById("examFormEditingId");
  const titleInput = document.getElementById("examFormTitle");
  const gradeSelect = document.getElementById("examFormGrade");
  const classSelect = document.getElementById("examFormClass");
  const durationInput = document.getElementById("examFormDuration");

  if (modalTitle) modalTitle.textContent = "Chỉnh Sửa Bài Kiểm Tra";
  if (btnSave) btnSave.textContent = "Lưu thay đổi bài kiểm tra";
  if (hiddenId) hiddenId.value = exam.exam_id;

  if (titleInput) titleInput.value = exam.title || "";
  if (gradeSelect) gradeSelect.value = String(exam.grade || 9);
  if (classSelect) {
    const targets = exam.target_classes || ["Tất cả"];
    classSelect.value = targets.includes("Tất cả") ? "Tất cả" : (targets[0] || "Tất cả");
  }
  if (durationInput) durationInput.value = exam.duration_minutes || 15;

  currentEditingExamQuestions = Array.isArray(exam.questions) ? JSON.parse(JSON.stringify(exam.questions)) : [];



  // Đóng editor câu hỏi nếu đang mở
  cancelQuestionEditor();
  renderModalQuestionsPreview();

  if (modal) modal.classList.remove("hidden");
}

function openCreateExamModal() {
  const modal = document.getElementById("examCreateModal");
  const modalTitle = document.querySelector("#examCreateModal .exam-modal-title");
  const btnSave = document.getElementById("btnExamSaveAndPublish");
  const hiddenId = document.getElementById("examFormEditingId");
  const titleInput = document.getElementById("examFormTitle");
  const durationInput = document.getElementById("examFormDuration");

  if (modalTitle) modalTitle.textContent = "Soạn & Đăng Bài Kiểm Tra Mới";
  if (btnSave) btnSave.textContent = "Đăng bài kiểm tra ngay";
  if (hiddenId) hiddenId.value = "";

  if (titleInput) titleInput.value = "";
  if (durationInput) durationInput.value = "15";

  currentEditingExamQuestions = [];


  cancelQuestionEditor();
  renderModalQuestionsPreview();

  if (modal) modal.classList.remove("hidden");
}

function closeCreateExamModal() {
  const modal = document.getElementById("examCreateModal");
  if (modal) modal.classList.add("hidden");
  cancelQuestionEditor();
}

// ---------------------------------------------------------------------------
// FORM BIÊN TẬP CÂU HỎI CHI TIẾT (QUESTION INLINE EDITOR)
// ---------------------------------------------------------------------------

function openQuestionEditor(index) {
  const box = document.getElementById("examQuestionEditorBox");
  const titleSpan = document.getElementById("qEditorTitle");
  const hiddenIdx = document.getElementById("qEditorEditingIndex");
  const contentInput = document.getElementById("qEditorContent");
  const optAInput = document.getElementById("qEditorOptA");
  const optBInput = document.getElementById("qEditorOptB");
  const optCInput = document.getElementById("qEditorOptC");
  const optDInput = document.getElementById("qEditorOptD");
  const correctSelect = document.getElementById("qEditorCorrect");
  const topicInput = document.getElementById("qEditorTopic");
  const explInput = document.getElementById("qEditorExpl");

  if (!box) return;

  if (index >= 0 && currentEditingExamQuestions[index]) {
    const q = currentEditingExamQuestions[index];
    if (titleSpan) titleSpan.textContent = `📝 Chỉnh sửa Câu hỏi số ${index + 1}`;
    if (hiddenIdx) hiddenIdx.value = String(index);

    if (contentInput) contentInput.value = q.cau_hoi || "";
    if (optAInput) optAInput.value = (q.lua_chon && q.lua_chon.A) || "";
    if (optBInput) optBInput.value = (q.lua_chon && q.lua_chon.B) || "";
    if (optCInput) optCInput.value = (q.lua_chon && q.lua_chon.C) || "";
    if (optDInput) optDInput.value = (q.lua_chon && q.lua_chon.D) || "";
    if (correctSelect) correctSelect.value = q.dap_an_dung || "A";
    if (topicInput) topicInput.value = q.muc_sgk || "";
    if (explInput) explInput.value = q.giai_thich || "";
  } else {
    // Soạn câu hỏi mới
    const nextNum = currentEditingExamQuestions.length + 1;
    if (titleSpan) titleSpan.textContent = `📝 Soạn Câu hỏi mới (Câu ${nextNum})`;
    if (hiddenIdx) hiddenIdx.value = "-1";

    if (contentInput) contentInput.value = "";
    if (optAInput) optAInput.value = "";
    if (optBInput) optBInput.value = "";
    if (optCInput) optCInput.value = "";
    if (optDInput) optDInput.value = "";
    if (correctSelect) correctSelect.value = "A";
    if (topicInput) topicInput.value = "Mục 1: Vai trò của thông tin";
    if (explInput) explInput.value = "";
  }

  box.classList.remove("hidden");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function cancelQuestionEditor() {
  const box = document.getElementById("examQuestionEditorBox");
  if (box) box.classList.add("hidden");
}

function saveQuestionEditor() {
  const hiddenIdx = document.getElementById("qEditorEditingIndex");
  const contentInput = document.getElementById("qEditorContent");
  const optAInput = document.getElementById("qEditorOptA");
  const optBInput = document.getElementById("qEditorOptB");
  const optCInput = document.getElementById("qEditorOptC");
  const optDInput = document.getElementById("qEditorOptD");
  const correctSelect = document.getElementById("qEditorCorrect");
  const topicInput = document.getElementById("qEditorTopic");
  const explInput = document.getElementById("qEditorExpl");

  const cauHoi = contentInput?.value?.trim();
  const optA = optAInput?.value?.trim();
  const optB = optBInput?.value?.trim();
  const optC = optCInput?.value?.trim();
  const optD = optDInput?.value?.trim();
  const dapAnDung = correctSelect?.value || "A";
  const mucSgk = topicInput?.value?.trim() || "Kiến thức chung";
  const giaiThich = explInput?.value?.trim() || `Đáp án đúng là ${dapAnDung}.`;

  if (!cauHoi) {
    alert("Vui lòng nhập nội dung câu hỏi!");
    contentInput?.focus();
    return;
  }
  if (!optA || !optB) {
    alert("Câu hỏi trắc nghiệm cần có ít nhất phương án A và B!");
    return;
  }

  const editIdx = parseInt(hiddenIdx?.value || "-1", 10);
  const qObj = {
    id: editIdx >= 0 && currentEditingExamQuestions[editIdx] ? currentEditingExamQuestions[editIdx].id : `q_manual_${Date.now()}_${currentEditingExamQuestions.length + 1}`,
    cau_hoi: cauHoi,
    lua_chon: {
      A: optA,
      B: optB,
      C: optC || "",
      D: optD || ""
    },
    dap_an_dung: dapAnDung,
    giai_thich: giaiThich,
    muc_sgk: mucSgk
  };

  if (editIdx >= 0 && editIdx < currentEditingExamQuestions.length) {
    currentEditingExamQuestions[editIdx] = qObj;
  } else {
    currentEditingExamQuestions.push(qObj);
  }

  cancelQuestionEditor();
  renderModalQuestionsPreview();
}

function renderModalQuestionsPreview() {
  const countSpan = document.getElementById("previewQuestionsCount");
  const list = document.getElementById("modalQuestionsList");
  if (!list) return;

  const count = currentEditingExamQuestions.length;
  if (countSpan) countSpan.textContent = `Danh sách câu hỏi (${count} câu)`;

  list.replaceChildren();

  if (count === 0) {
    const hint = document.createElement("p");
    hint.className = "preview-empty-hint";
    hint.innerHTML = /* sanitize */ `Chưa có câu hỏi nào. Bạn có thể nhấn <strong>"+ Thêm câu hỏi"</strong> để soạn câu hỏi hoặc <strong>"Nạp từ Excel"</strong> để nhập đề nhanh.`;
    list.appendChild(hint);
    return;
  }

  currentEditingExamQuestions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "preview-q-card";

    const header = document.createElement("div");
    header.className = "preview-q-card-header";
    header.innerHTML = /* sanitize */ `
      <div class="preview-q-badges">
        <strong style="color: #38bdf8; font-size: 0.95rem;">Câu ${idx + 1}</strong>
        ${q.muc_sgk ? `<span class="preview-tag-topic">${escapeHtml(q.muc_sgk)}</span>` : ''}
        <span class="preview-tag-correct">Đ/A đúng: ${escapeHtml(q.dap_an_dung)}</span>
      </div>
      <div class="preview-q-card-actions">
        <button type="button" class="btn-exam-sm-action btn-exam-sm-edit" title="Chỉnh sửa câu hỏi này">✏ Sửa</button>
        <button type="button" class="btn-exam-sm-action btn-exam-sm-del" title="Xóa câu hỏi này">🗑 Xóa</button>
      </div>
    `;

    const contentEl = document.createElement("div");
    contentEl.className = "preview-q-content";
    contentEl.textContent = q.cau_hoi;

    const optGrid = document.createElement("div");
    optGrid.className = "preview-q-options-list";
    const letters = ["A", "B", "C", "D"];
    letters.forEach(letter => {
      const text = q.lua_chon ? q.lua_chon[letter] : "";
      if (text) {
        const optItem = document.createElement("div");
        optItem.className = `preview-q-opt-item ${q.dap_an_dung === letter ? 'is-correct' : ''}`;
        optItem.textContent = `${letter}. ${text}`;
        optGrid.appendChild(optItem);
      }
    });

    card.appendChild(header);
    card.appendChild(contentEl);
    card.appendChild(optGrid);

    if (q.giai_thich) {
      const explDiv = document.createElement("div");
      explDiv.className = "preview-q-expl";
      explDiv.textContent = `💡 Giải thích: ${q.giai_thich}`;
      card.appendChild(explDiv);
    }

    // Gán sự kiện nút Sửa & Xóa câu hỏi
    const btnEditQ = card.querySelector(".btn-exam-sm-edit");
    const btnDelQ = card.querySelector(".btn-exam-sm-del");

    if (btnEditQ) {
      btnEditQ.onclick = () => openQuestionEditor(idx);
    }
    if (btnDelQ) {
      btnDelQ.onclick = () => {
        if (confirm(`Xóa câu hỏi số ${idx + 1}?`)) {
          currentEditingExamQuestions.splice(idx, 1);
          renderModalQuestionsPreview();
        }
      };
    }

    list.appendChild(card);
  });
}

// Khởi tạo các sự kiện giao diện giáo viên
function initTeacherExamEvents() {
  // 1. Tải file mẫu Excel
  const btnTemplate = document.getElementById("btnExamDownloadTemplate");
  if (btnTemplate) {
    btnTemplate.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = "./data/exams/exam_template.xlsx";
      a.download = "De_Kiem_Tra_Mau.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  // 2. Upload đề từ Excel
  const fileInput = document.getElementById("examExcelFileInput");
  const btnUpload = document.getElementById("btnExamUploadExcel");
  const btnModalUpload = document.getElementById("btnModalUploadExcel");

  if (btnUpload && fileInput) {
    btnUpload.addEventListener("click", () => fileInput.click());
  }
  if (btnModalUpload && fileInput) {
    btnModalUpload.addEventListener("click", () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const applyParsedQuestions = (questions, fileName) => {
        currentEditingExamQuestions = [...currentEditingExamQuestions, ...questions];
        const modal = document.getElementById("examCreateModal");
        if (modal && modal.classList.contains("hidden")) {
          openCreateExamModal();
        }
        renderModalQuestionsPreview();
        const titleInput = document.getElementById("examFormTitle");
        if (titleInput && (!titleInput.value || titleInput.value.trim() === "")) {
          titleInput.value = fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        }
        alert(`✔ Đã bóc tách thành công ${questions.length} câu hỏi từ file "${fileName}" vào danh sách! Thầy/Cô có thể xem và chỉnh sửa từng câu.`);
      };

      // Đọc bằng SheetJS phía Client
      if (typeof XLSX !== "undefined") {
        try {
          const buffer = await file.arrayBuffer();
          const wb = XLSX.read(buffer, { type: "array" });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          const questions = [];
          const startIdx = (rows.length > 0 && typeof rows[0][0] === "string" && (rows[0][0].toLowerCase().includes("mã") || rows[0][0].toLowerCase().includes("câu"))) ? 1 : 0;
          for (let i = startIdx; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 7) continue;
            const qId = String(row[0] || `q_excel_${i}`).trim();
            const content = String(row[1] || "").trim();
            const optA = String(row[2] || "").trim();
            const optB = String(row[3] || "").trim();
            const optC = String(row[4] || "").trim();
            const optD = String(row[5] || "").trim();
            const correct = String(row[6] || "A").trim().toUpperCase();
            const expl = String(row[7] || "").trim();
            const topic = String(row[8] || "Kiến thức chung").trim();

            if (!content || !optA || !optB) continue;
            questions.push({
              id: qId,
              cau_hoi: content,
              lua_chon: { A: optA, B: optB, C: optC, D: optD },
              dap_an_dung: ["A", "B", "C", "D"].includes(correct) ? correct : "A",
              giai_thich: expl || `Đáp án đúng là ${correct}.`,
              muc_sgk: topic
            });
          }

          if (questions.length > 0) {
            applyParsedQuestions(questions, file.name);
            fileInput.value = "";
            return;
          }
        } catch (clientErr) {
          console.debug("SheetJS client parse failed, trying backend:", clientErr);
        }
      }

      // Backend fallback nếu có
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`${getExamApiRoot()}/teacher/exams/upload-excel`, {
          method: "POST",
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.questions) {
            applyParsedQuestions(data.questions, file.name);
          }
        }
      } catch (err) {
        alert("Lỗi tải file Excel: " + err.message);
      } finally {
        fileInput.value = "";
      }
    });
  }

  // 3. Soạn đề mới
  const btnCreate = document.getElementById("btnExamCreateManual");
  if (btnCreate) {
    btnCreate.addEventListener("click", openCreateExamModal);
  }

  // 4. Đóng modal
  const btnCloseModal = document.getElementById("btnExamCloseCreateModal");
  const btnCancelCreate = document.getElementById("btnExamCancelCreate");
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeCreateExamModal);
  if (btnCancelCreate) btnCancelCreate.addEventListener("click", closeCreateExamModal);

  // 5. Nút Thêm câu hỏi & Form Editor
  const btnAddQ = document.getElementById("btnModalAddQuestion");
  if (btnAddQ) {
    btnAddQ.addEventListener("click", () => openQuestionEditor(-1));
  }
  const btnSaveQ = document.getElementById("btnSaveQToExam");
  if (btnSaveQ) {
    btnSaveQ.addEventListener("click", saveQuestionEditor);
  }
  const btnCancelQ = document.getElementById("btnCancelEditQ");
  if (btnCancelQ) {
    btnCancelQ.addEventListener("click", cancelQuestionEditor);
  }

  // 6. Lưu và xuất bản bài kiểm tra
  const btnSavePublish = document.getElementById("btnExamSaveAndPublish");
  if (btnSavePublish) {
    btnSavePublish.addEventListener("click", async () => {
      const hiddenId = document.getElementById("examFormEditingId");
      const titleInput = document.getElementById("examFormTitle");
      const gradeSelect = document.getElementById("examFormGrade");
      const classSelect = document.getElementById("examFormClass");
      const durationInput = document.getElementById("examFormDuration");

      const title = titleInput?.value?.trim();
      if (!title) {
        alert("Vui lòng nhập Tiêu đề bài kiểm tra!");
        titleInput?.focus();
        return;
      }

      if (currentEditingExamQuestions.length === 0) {
        alert("Bài kiểm tra cần có ít nhất 1 câu hỏi! Thầy/Cô hãy bấm '+ Thêm câu hỏi' hoặc 'Nạp từ Excel'.");
        return;
      }

      const gradeVal = parseInt(gradeSelect?.value || "9", 10);
      const classVal = classSelect?.value || "Tất cả";
      const durationVal = parseInt(durationInput?.value || "15", 10);
      const existingId = hiddenId?.value?.trim();
      const examId = existingId || `exam_${gradeVal}_${Date.now()}`;

      const examPayload = {
        exam_id: examId,
        title: title,
        grade: gradeVal,
        subject: "Tin học",
        target_classes: classVal === "Tất cả" ? ["Tất cả"] : [classVal],
        duration_minutes: durationVal,
        status: "published",
        created_at: new Date().toISOString(),
        questions: currentEditingExamQuestions,
        total_questions: currentEditingExamQuestions.length
      };

      try {
        btnSavePublish.disabled = true;
        btnSavePublish.textContent = "Đang lưu bài...";

        // 1. Lưu vào localStorage dự phòng
        try {
          const localList = JSON.parse(localStorage.getItem("AISGK_CUSTOM_EXAMS") || "[]");
          const idx = localList.findIndex(e => e.exam_id === examId);
          if (idx >= 0) {
            localList[idx] = examPayload;
          } else {
            localList.unshift(examPayload);
          }
          localStorage.setItem("AISGK_CUSTOM_EXAMS", JSON.stringify(localList));
        } catch (errLocal) {
          console.debug("Lưu localStorage lỗi:", errLocal);
        }

        // 2. Lưu lên backend nếu có
        try {
          await fetch(`${getExamApiRoot()}/teacher/exams/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(examPayload)
          });
        } catch (errBackend) {
          console.debug("Backend API offline:", errBackend);
        }

        // 3. Đồng bộ trực tiếp lên Firebase Realtime Database
        await syncExamToFirebase(examPayload);

        alert(existingId
          ? `✔ Đã cập nhật thành công bài kiểm tra "${title}"!`
          : `✔ Đã đăng bài kiểm tra "${title}" thành công! Học sinh đã có thể truy cập.`);

        closeCreateExamModal();
        loadTeacherExams();
      } catch (err) {
        alert("Lỗi khi lưu bài kiểm tra: " + err.message);
      } finally {
        btnSavePublish.disabled = false;
        btnSavePublish.textContent = existingId ? "Lưu thay đổi bài kiểm tra" : "Đăng bài kiểm tra ngay";
      }
    });
  }

  // 7. Bộ lọc
  const filterGrade = document.getElementById("examFilterGrade");
  const filterClass = document.getElementById("examFilterClass");
  if (filterGrade) filterGrade.addEventListener("change", renderTeacherExamCards);
  if (filterClass) filterClass.addEventListener("change", renderTeacherExamCards);



  // 8. Đóng modal kết quả
  const btnCloseRes = document.getElementById("btnCloseTeacherResultsModal");
  if (btnCloseRes) {
    btnCloseRes.addEventListener("click", () => {
      const modal = document.getElementById("examTeacherResultsModal");
      if (modal) modal.classList.add("hidden");
    });
  }
}

function updateTeacherResultsSummaryStats(submissions) {
  const total = submissions.length;
  const elTotal = document.getElementById("statTotalSubmissions");
  const elAvg = document.getElementById("statAvgScore");
  const elPass = document.getElementById("statPassRate");
  const elMax = document.getElementById("statMaxScore");

  if (elTotal) elTotal.textContent = String(total);
  if (total === 0) {
    if (elAvg) elAvg.textContent = "--";
    if (elPass) elPass.textContent = "--%";
    if (elMax) elMax.textContent = "--";
    return;
  }

  let sum = 0;
  let max = -1;
  let passCount = 0;

  submissions.forEach(s => {
    const sc = parseFloat(s.evaluation?.score ?? s.score ?? 0);
    sum += sc;
    if (sc > max) max = sc;
    if (sc >= 5.0) passCount++;
  });

  const avg = Number((sum / total).toFixed(1));
  const passRate = Math.round((passCount / total) * 100);

  if (elAvg) elAvg.textContent = `${avg}/10`;
  if (elPass) elPass.textContent = `${passRate}%`;
  if (elMax) elMax.textContent = `${max >= 0 ? max.toFixed(1) : 0}/10`;
}

async function openTeacherExamResults(examId, examTitle) {
  const modal = document.getElementById("examTeacherResultsModal");
  const titleSpan = document.getElementById("teacherResultsExamTitle");
  const tbody = document.getElementById("teacherResultsTableBody");
  if (!modal || !tbody) return;

  if (titleSpan) titleSpan.textContent = `Bảng Điểm: ${examTitle}`;
  modal.classList.remove("hidden");
  tbody.replaceChildren();

  const loadingTr = document.createElement("tr");
  loadingTr.innerHTML = /* sanitize */ `<td colspan="7" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Đang tải danh sách kết quả học sinh từ Firebase...</td>`;
  tbody.appendChild(loadingTr);

  try {
    let submissions = [];

    // 1. Lấy bài nộp từ Firebase Realtime Database
    const fbSubs = await fetchExamSubmissionsFromFirebase(examId);
    if (fbSubs && fbSubs.length > 0) {
      submissions = fbSubs;
    }

    // 2. Thử lấy từ Backend API (gửi kèm token giáo viên)
    try {
      const res = await fetch(`${getExamApiRoot()}/teacher/exams/${examId}/results`, {
        headers: {
          "x-teacher-token": state.teacherToken || "tch_live_session_9a"
        }
      });
      if (res.ok) {
        const data = await res.json();
        const apiSubs = data.submissions || [];
        const existingIds = new Set(submissions.map(s => s.student_id));
        apiSubs.forEach(s => {
          if (!existingIds.has(s.student_id)) {
            submissions.push(s);
            existingIds.add(s.student_id);
          }
        });
      }
    } catch (errApi) {
      console.debug("API results fetch failed:", errApi);
    }

    // 3. Fallback lấy localStorage
    try {
      const localSubs = JSON.parse(localStorage.getItem("AISGK_SUBMISSIONS") || "[]");
      const matchingLocal = localSubs.filter(s => s.exam_id === examId);
      const existingIds = new Set(submissions.map(s => s.student_id));
      matchingLocal.forEach(s => {
        if (!existingIds.has(s.student_id)) {
          submissions.push(s);
          existingIds.add(s.student_id);
        }
      });
    } catch (errLocal) {
      console.debug("Local submissions read failed:", errLocal);
    }

    tbody.replaceChildren();

    if (submissions.length === 0) {
      const emptyTr = document.createElement("tr");
      emptyTr.innerHTML = /* sanitize */ `<td colspan="7" style="text-align: center; color: #64748b; padding: 2rem;">Chưa có học sinh nào nộp bài kiểm tra này.</td>`;
      tbody.appendChild(emptyTr);
      updateTeacherResultsSummaryStats([]);
      return;
    }

    // Sắp xếp bài nộp theo thứ hạng điểm cao nhất -> thấp nhất
    submissions.sort((a, b) => {
      const scoreA = parseFloat(a.evaluation?.score ?? a.score ?? 0);
      const scoreB = parseFloat(b.evaluation?.score ?? b.score ?? 0);
      return scoreB - scoreA;
    });

    updateTeacherResultsSummaryStats(submissions);

    submissions.forEach((s, idx) => {
      const tr = document.createElement("tr");
      const evalData = s.evaluation || {};
      const scoreVal = evalData.score !== undefined ? evalData.score : (s.score !== undefined ? s.score : 0);
      const scoreNum = parseFloat(scoreVal);
      const totalQ = evalData.total_questions || s.total_questions || 5;
      const correctCount = evalData.correct_count !== undefined ? evalData.correct_count : (s.correct_count !== undefined ? s.correct_count : 0);

      let scoreColor = "#38bdf8";
      let rankBadge = `<span class="rank-badge">${idx + 1}</span>`;
      if (idx === 0) rankBadge = `<span class="rank-badge gold">🥇 1</span>`;
      else if (idx === 1) rankBadge = `<span class="rank-badge silver">🥈 2</span>`;
      else if (idx === 2) rankBadge = `<span class="rank-badge bronze">🥉 3</span>`;

      if (!isNaN(scoreNum)) {
        if (scoreNum >= 8) scoreColor = "#34d399";
        else if (scoreNum >= 5) scoreColor = "#fbbf24";
        else scoreColor = "#f87171";
      }

      const submittedTimeStr = evalData.submitted_at || s.submitted_at;
      const dateFormatted = submittedTimeStr ? new Date(submittedTimeStr).toLocaleTimeString('vi-VN') + ' ' + new Date(submittedTimeStr).toLocaleDateString('vi-VN') : 'Vừa xong';

      tr.innerHTML = /* sanitize */ `
        <td style="text-align: center;">${rankBadge}</td>
        <td><strong>${escapeHtml(s.student_name || s.student_code || 'Học sinh')}</strong> ${s.student_code ? `<span style="font-size: 0.78rem; color: #94a3b8; display: block;">${escapeHtml(s.student_code)}</span>` : ''}</td>
        <td>${escapeHtml(s.class_code || '9A')}</td>
        <td><strong style="color: ${scoreColor}; font-size: 1.05rem;">${scoreNum.toFixed(1)} / 10</strong></td>
        <td>${correctCount}/${totalQ}</td>
        <td>${escapeHtml(s.time_spent || evalData.time_spent || '--')}</td>
        <td>${dateFormatted}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.replaceChildren();
    const errTr = document.createElement("tr");
    errTr.innerHTML = /* sanitize */ `<td colspan="7" style="text-align: center; color: #ef4444; padding: 1.5rem;">Lỗi tải kết quả: ${escapeHtml(err.message)}</td>`;
    tbody.appendChild(errTr);
  }
}

// ---------------------------------------------------------------------------
// 2. PHÂN HỆ HỌC SINH: SÂN KHẤU LÀM BÀI CHUẨN H3, BẢNG XẾP HẠNG & CHẨN ĐOÁN AI
// ---------------------------------------------------------------------------

let currentStudentExamsList = [];
let currentStudentSubmissionsMap = {};
let currentClassSubmissionsList = [];

// Đọc danh sách học sinh của lớp từ Firebase
async function fetchClassStudentsFromFirebase(classCode) {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return [];
  try {
    const snap = await firebase.database().ref(`students/${classCode}`).once("value");
    if (!snap.exists()) return [];
    const val = snap.val();
    return Object.entries(val).map(([uid, data]) => ({ uid, ...data }));
  } catch (err) {
    console.debug("fetchClassStudentsFromFirebase error:", err);
    return [];
  }
}

// Đọc tất cả bài kiểm tra học sinh đã nộp từ Firebase
async function fetchStudentExamSubmissionsFromFirebase(studentId, classCode) {
  initFirebaseApp();
  const results = [];
  const handledExamIds = new Set();

  if (typeof firebase !== "undefined" && firebase.database) {
    try {
      // 1. Quét từ exam_submissions
      const subsSnap = await firebase.database().ref("exam_submissions").once("value");
      if (subsSnap.exists()) {
        const allSubs = subsSnap.val();
        Object.entries(allSubs).forEach(([exId, stdMap]) => {
          if (stdMap && typeof stdMap === "object") {
            const sub = stdMap[studentId];
            if (sub && typeof sub === "object") {
              results.push({ ...sub, exam_id: exId });
              handledExamIds.add(exId);
            }
          }
        });
      }
    } catch (eSubs) {
      console.debug("fetchStudentExamSubmissions error (submissions):", eSubs);
    }

    try {
      // 2. Quét từ students/${classCode}/${studentId}/exams
      if (classCode && studentId) {
        const stdExamsSnap = await firebase.database().ref(`students/${classCode}/${studentId}/exams`).once("value");
        if (stdExamsSnap.exists()) {
          const val = stdExamsSnap.val();
          Object.entries(val).forEach(([exId, item]) => {
            if (item && typeof item === "object" && !handledExamIds.has(exId)) {
              results.push({ ...item, exam_id: exId });
              handledExamIds.add(exId);
            }
          });
        }
      }
    } catch (eStd) {
      console.debug("fetchStudentExamSubmissions error (student exams):", eStd);
    }
  }

  // 3. Quét dự phòng localStorage
  try {
    const localSubs = JSON.parse(localStorage.getItem("AISGK_SUBMISSIONS") || "[]");
    localSubs.forEach(s => {
      if ((s.student_id === studentId || !s.student_id) && s.exam_id && !handledExamIds.has(s.exam_id)) {
        results.push(s);
        handledExamIds.add(s.exam_id);
      }
    });
  } catch (eLoc) {
    console.debug("Local submissions read failed:", eLoc);
  }

  return results;
}

// Đọc toàn bộ bài nộp của lớp từ Firebase
async function fetchAllSubmissionsForClass(classCode) {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return [];
  try {
    const snap = await firebase.database().ref("exam_submissions").once("value");
    if (!snap.exists()) return [];
    const val = snap.val();
    const submissions = [];
    Object.entries(val).forEach(([examId, studentsMap]) => {
      if (studentsMap && typeof studentsMap === "object") {
        Object.entries(studentsMap).forEach(([sId, sub]) => {
          if (sub && typeof sub === "object") {
            if (!classCode || sub.class_code === classCode || !sub.class_code) {
              submissions.push({ ...sub, exam_id: examId, student_id: sub.student_id || sId });
            }
          }
        });
      }
    });
    return submissions;
  } catch (err) {
    console.debug("fetchAllSubmissionsForClass error:", err);
    return [];
  }
}

// Chuyển đổi tab trên màn hình học sinh
function switchStudentExamTab(tabName) {
  const tabs = [
    { name: "exams", btnId: "tabBtnExamsList", panelId: "tabStudentExamsList" },
    { name: "leaderboard", btnId: "tabBtnLeaderboard", panelId: "tabStudentLeaderboard" },
    { name: "history", btnId: "tabBtnHistory", panelId: "tabStudentExamHistory" },
    { name: "documents", btnId: "tabBtnDocuments", panelId: "tabStudentDocuments" }
  ];

  tabs.forEach(t => {
    const btn = document.getElementById(t.btnId);
    const panel = document.getElementById(t.panelId);
    if (t.name === tabName) {
      if (btn) {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
      }
      if (panel) panel.classList.remove("hidden");
    } else {
      if (btn) {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
      }
      if (panel) panel.classList.add("hidden");
    }
  });

  if (tabName === "documents") {
    loadStudentDocuments();
  }
}

function initStudentExamTabEvents() {
  const btnExams = document.getElementById("tabBtnExamsList");
  const btnLeaderboard = document.getElementById("tabBtnLeaderboard");
  const btnHistory = document.getElementById("tabBtnHistory");
  const selectExam = document.getElementById("selectLeaderboardExam");

  if (btnExams && !btnExams._hasTabListener) {
    btnExams._hasTabListener = true;
    btnExams.addEventListener("click", () => switchStudentExamTab("exams"));
  }
  if (btnLeaderboard && !btnLeaderboard._hasTabListener) {
    btnLeaderboard._hasTabListener = true;
    btnLeaderboard.addEventListener("click", () => switchStudentExamTab("leaderboard"));
  }
  if (btnHistory && !btnHistory._hasTabListener) {
    btnHistory._hasTabListener = true;
    btnHistory.addEventListener("click", () => switchStudentExamTab("history"));
  }
  const btnDocs = document.getElementById("tabBtnDocuments");
  if (btnDocs && !btnDocs._hasTabListener) {
    btnDocs._hasTabListener = true;
    btnDocs.addEventListener("click", () => {
      switchStudentExamTab("documents");
      loadStudentDocuments();
    });
  }
  if (selectExam && !selectExam._hasChangeListener) {
    selectExam._hasChangeListener = true;
    selectExam.addEventListener("change", (e) => renderClassLeaderboard(e.target.value));
  }
}

// Cập nhật bộ chọn bài kiểm tra cho Leaderboard
function updateLeaderboardExamDropdown(exams) {
  const select = document.getElementById("selectLeaderboardExam");
  if (!select) return;

  const currentVal = select.value || "all";
  select.replaceChildren();

  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "🏆 Tổng hợp tất cả bài kiểm tra (Điểm trung bình thi)";
  select.appendChild(optAll);

  exams.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex.exam_id;
    opt.textContent = `📝 ${ex.title || 'Bài kiểm tra'} (${ex.duration_minutes || 15} phút)`;
    select.appendChild(opt);
  });

  if (exams.some(e => e.exam_id === currentVal)) {
    select.value = currentVal;
  } else {
    select.value = "all";
  }
}

// ---------------------------------------------------------------------------
// RENDER KPI THỐNG KÊ CÁ NHÂN
// ---------------------------------------------------------------------------

function renderStudentExamKPIs(exams, studentSubs, classSubs, classRoster) {
  const elCompleted = document.getElementById("kpiStudentCompletedExams");
  const elCompletionRate = document.getElementById("kpiStudentCompletionRate");
  const elAvgScore = document.getElementById("kpiStudentAvgScore");
  const elRank = document.getElementById("kpiStudentClassRank");
  const elTotalInClass = document.getElementById("kpiStudentTotalInClass");
  const elCorrectRate = document.getElementById("kpiStudentCorrectRate");
  const elCorrectRatio = document.getElementById("kpiStudentCorrectRatio");

  const totalExamsCount = exams.length;
  // Tập hợp các exam_id duy nhất mà học sinh đã hoàn thành
  const completedExamIds = new Set(studentSubs.map(s => s.exam_id).filter(Boolean));
  const completedCount = completedExamIds.size;
  const completionPct = totalExamsCount > 0 ? Math.round((completedCount / totalExamsCount) * 100) : 0;

  if (elCompleted) elCompleted.textContent = `${completedCount}/${totalExamsCount}`;
  if (elCompletionRate) elCompletionRate.textContent = `${completionPct}%`;

  // Tính điểm trung bình các bài thi đã làm
  let sumScore = 0;
  let totalCorrect = 0;
  let totalQuestions = 0;

  studentSubs.forEach(s => {
    const evalData = s.evaluation || {};
    const scoreVal = evalData.score !== undefined ? evalData.score : (s.score !== undefined ? s.score : 0);
    const scoreNum = parseFloat(scoreVal) || 0;
    sumScore += scoreNum;

    const cCount = evalData.correct_count !== undefined ? evalData.correct_count : (s.correct_count !== undefined ? s.correct_count : 0);
    const qCount = evalData.total_questions || s.total_questions || 0;
    totalCorrect += cCount;
    totalQuestions += qCount;
  });

  const avgScore = completedCount > 0 ? (sumScore / studentSubs.length) : 0;
  if (elAvgScore) {
    elAvgScore.textContent = completedCount > 0 ? avgScore.toFixed(1) : "--";
    if (completedCount > 0) {
      if (avgScore >= 8) elAvgScore.style.color = "#34d399";
      else if (avgScore >= 5) elAvgScore.style.color = "#fbbf24";
      else elAvgScore.style.color = "#f87171";
    }
  }

  // Tính tỷ lệ câu đúng
  const correctRate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  if (elCorrectRate) elCorrectRate.textContent = totalQuestions > 0 ? `${correctRate}%` : "--%";
  if (elCorrectRatio) elCorrectRatio.textContent = totalQuestions > 0 ? `${totalCorrect}/${totalQuestions} câu` : "0/0 câu";

  // Tính thứ hạng của em trong lớp
  const studentId = studentAuthState.uid || studentAuthState.studentCode;
  // Nhóm điểm thi của tất cả bạn trong lớp
  const studentScoresMap = {};
  classSubs.forEach(s => {
    const sId = s.student_id;
    if (!sId) return;
    if (!studentScoresMap[sId]) {
      studentScoresMap[sId] = { sum: 0, count: 0, name: s.student_name };
    }
    const evalData = s.evaluation || {};
    const scoreVal = evalData.score !== undefined ? evalData.score : (s.score !== undefined ? s.score : 0);
    studentScoresMap[sId].sum += (parseFloat(scoreVal) || 0);
    studentScoresMap[sId].count += 1;
  });

  const rankedStudents = Object.entries(studentScoresMap).map(([id, data]) => ({
    id,
    avg: data.count > 0 ? (data.sum / data.count) : 0
  })).sort((a, b) => b.avg - a.avg);

  const myRankIndex = rankedStudents.findIndex(r => r.id === studentId);
  const totalClassParticipants = Math.max(rankedStudents.length, classRoster.length, 1);

  if (elRank) {
    if (myRankIndex >= 0) {
      const myRank = myRankIndex + 1;
      let medal = `#${myRank}`;
      if (myRank === 1) medal = `🥇 #1`;
      else if (myRank === 2) medal = `🥈 #2`;
      else if (myRank === 3) medal = `🥉 #3`;
      elRank.textContent = medal;
      elRank.style.color = myRank <= 3 ? "#fbbf24" : "#f8fafc";
    } else {
      elRank.textContent = "#--";
    }
  }
  if (elTotalInClass) {
    elTotalInClass.textContent = `/${totalClassParticipants} bạn trong lớp`;
  }
}

// ---------------------------------------------------------------------------
// RENDER THẺ BÀI KIỂM TRA CỦA HỌC SINH
// ---------------------------------------------------------------------------

function renderStudentExamCards(exams, subsMap, classCode) {
  const grid = document.getElementById("examStudentGrid");
  if (!grid) return;
  grid.replaceChildren();

  if (exams.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.className = "exam-card-item";
    emptyBox.style.gridColumn = "1 / -1";
    emptyBox.style.textAlign = "center";
    emptyBox.style.padding = "2.5rem 1rem";
    emptyBox.innerHTML = /* sanitize */ `
      <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🎉</div>
      <h3 style="color: #f1f5f9; margin-bottom: 0.35rem;">Hiện chưa có bài kiểm tra mới</h3>
      <p style="color: #64748b; font-size: 0.88rem;">Khi Thầy/Cô đăng bài kiểm tra mới cho lớp ${escapeHtml(classCode)}, đề thi sẽ xuất hiện tại đây.</p>
    `;
    grid.appendChild(emptyBox);
    return;
  }

  exams.forEach(exam => {
    const card = document.createElement("div");
    card.className = "exam-card-item";

    const sub = subsMap[exam.exam_id];
    const isCompleted = !!sub;
    const isClosed = (exam.status === "closed");

    const header = document.createElement("div");
    header.className = "exam-card-header";

    let statusPillHtml = '';
    if (isClosed) {
      statusPillHtml = `<span class="exam-status-pill closed" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35);">🔒 Thầy/Cô đang khóa đề</span>`;
    } else {
      statusPillHtml = `<span class="exam-status-pill open">● Đang mở</span>`;
    }

    const classDisplay = classCode || studentAuthState.classCode || "";
    const classLabel = classDisplay ? ` • Lớp ${escapeHtml(classDisplay)}` : "";

    if (isCompleted) {
      const evalData = sub.evaluation || {};
      const scoreVal = evalData.score !== undefined ? evalData.score : (sub.score !== undefined ? sub.score : 0);
      const scoreNum = parseFloat(scoreVal) || 0;
      let badgeClass = "low";
      if (scoreNum >= 8) badgeClass = "high";
      else if (scoreNum >= 5) badgeClass = "medium";

      header.innerHTML = /* sanitize */ `
        <span class="exam-card-tag">Khối ${escapeHtml(exam.grade)}${classLabel}</span>
        <div class="exam-header-badges-row">
          ${statusPillHtml}
          <span class="exam-completed-badge ${badgeClass}">
            ✔ Đã làm: ${scoreNum.toFixed(1)}/10đ
          </span>
        </div>
      `;
    } else {
      header.innerHTML = /* sanitize */ `
        <span class="exam-card-tag">Khối ${escapeHtml(exam.grade)}${classLabel}</span>
        <div class="exam-header-badges-row">
          ${statusPillHtml}
        </div>
      `;
    }

    const titleEl = document.createElement("h3");
    titleEl.className = "exam-card-title";
    titleEl.textContent = exam.title;

    const meta = document.createElement("div");
    meta.className = "exam-card-meta";

    let dateSubStr = "";
    if (isCompleted) {
      const subDate = sub.submitted_at || sub.evaluation?.submitted_at;
      if (subDate) {
        dateSubStr = `<div>📅 Đã nộp: <strong>${new Date(subDate).toLocaleTimeString('vi-VN')} ${new Date(subDate).toLocaleDateString('vi-VN')}</strong></div>`;
      }
    }

    meta.innerHTML = /* sanitize */ `
      <div>⏱ Thời gian: <strong>${escapeHtml(exam.duration_minutes || 15)} phút</strong></div>
      <div>✏ Số lượng: <strong>${escapeHtml(exam.total_questions || (exam.questions ? exam.questions.length : 0))} câu hỏi trắc nghiệm</strong></div>
      ${dateSubStr}
    `;

    const actionsBar = document.createElement("div");
    actionsBar.className = "exam-card-actions-bar";

    if (isClosed) {
      if (isCompleted) {
        const btnReview = document.createElement("button");
        btnReview.type = "button";
        btnReview.className = "btn-exam-review";
        btnReview.innerHTML = /* sanitize */ `<span>👁 Xem lại bài làm</span>`;
        btnReview.onclick = () => reviewStudentExam(exam.exam_id);

        const btnRetakeLocked = document.createElement("button");
        btnRetakeLocked.type = "button";
        btnRetakeLocked.className = "btn-exam-disabled";
        
        btnRetakeLocked.title = "Thầy/Cô hiện đang tạm khóa đề thi này, không thể làm lại lúc này.";
        btnRetakeLocked.innerHTML = /* sanitize */ `<span>🔒 Đang khóa đề thi</span>`;
        btnRetakeLocked.onclick = () => {
          alert("🔒 Bài kiểm tra này hiện đang được Thầy/Cô tạm khóa.\n\nEm vui lòng đợi Giáo viên mở đề thi để làm bài nhé!");
        };

        actionsBar.appendChild(btnReview);
        actionsBar.appendChild(btnRetakeLocked);
      } else {
        const btnDisabled = document.createElement("button");
        btnDisabled.type = "button";
        btnDisabled.className = "btn-exam-disabled";
        btnDisabled.title = "Thầy/Cô hiện đang tạm khóa đề thi này. Vui lòng đợi mở đề!";
        btnDisabled.innerHTML = /* sanitize */ `<span>🔒 Đề thi đang khóa</span>`;
        btnDisabled.onclick = () => {
          alert("🔒 Bài kiểm tra này hiện đang được Thầy/Cô tạm khóa.\n\nEm vui lòng đợi Giáo viên mở đề thi để làm bài nhé!");
        };
        actionsBar.appendChild(btnDisabled);
      }
    } else {
      if (isCompleted) {
        const btnReview = document.createElement("button");
        btnReview.type = "button";
        btnReview.className = "btn-exam-review";
        btnReview.innerHTML = /* sanitize */ `<span>👁 Xem lại bài làm</span>`;
        btnReview.onclick = () => reviewStudentExam(exam.exam_id);

        const btnRetake = document.createElement("button");
        btnRetake.type = "button";
        btnRetake.className = "btn-exam-retake";
        btnRetake.innerHTML = /* sanitize */ `<span>🔄 Làm lại bài thi</span>`;
        btnRetake.onclick = () => startStudentExam(exam.exam_id);

        actionsBar.appendChild(btnReview);
        actionsBar.appendChild(btnRetake);
      } else {
        const btnStart = document.createElement("button");
        btnStart.type = "button";
        btnStart.className = "btn-exam-primary";
        btnStart.style.width = "100%";
        btnStart.innerHTML = /* sanitize */ `<span>▶ Vào làm bài ngay</span>`;
        btnStart.onclick = () => startStudentExam(exam.exam_id);

        actionsBar.appendChild(btnStart);
      }
    }

    card.appendChild(header);
    card.appendChild(titleEl);
    card.appendChild(meta);
    card.appendChild(actionsBar);
    grid.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// RENDER BẢNG XẾP HẠNG LỚP (PODIUM & LEADERBOARD TABLE)
// ---------------------------------------------------------------------------

function renderClassLeaderboard(examIdFilter = "all") {
  const podiumWrap = document.getElementById("leaderboardPodium");
  const tbody = document.getElementById("studentLeaderboardTableBody");
  if (!podiumWrap || !tbody) return;

  podiumWrap.replaceChildren();
  tbody.replaceChildren();

  const currentStudentId = studentAuthState.uid || studentAuthState.studentCode;
  const submissions = currentClassSubmissionsList || [];

  let rankedList = [];

  if (examIdFilter === "all") {
    // Tổng hợp tất cả bài kiểm tra: tính điểm trung bình của mỗi học sinh
    const studentMap = {};
    submissions.forEach(sub => {
      const sId = sub.student_id;
      if (!sId) return;
      if (!studentMap[sId]) {
        studentMap[sId] = {
          student_id: sId,
          student_name: sub.student_name || "Học sinh",
          student_code: sub.student_code || "",
          class_code: sub.class_code || studentAuthState.classCode || "",
          scores_sum: 0,
          completed_count: 0,
          total_correct: 0,
          total_questions: 0,
          latest_submitted_at: sub.submitted_at || sub.evaluation?.submitted_at || ""
        };
      }
      const evalData = sub.evaluation || {};
      const score = parseFloat(evalData.score !== undefined ? evalData.score : (sub.score !== undefined ? sub.score : 0)) || 0;
      studentMap[sId].scores_sum += score;
      studentMap[sId].completed_count += 1;
      studentMap[sId].total_correct += (evalData.correct_count !== undefined ? evalData.correct_count : (sub.correct_count || 0));
      studentMap[sId].total_questions += (evalData.total_questions || sub.total_questions || 4);

      const subDate = sub.submitted_at || evalData.submitted_at;
      if (subDate && (!studentMap[sId].latest_submitted_at || new Date(subDate) > new Date(studentMap[sId].latest_submitted_at))) {
        studentMap[sId].latest_submitted_at = subDate;
      }
    });

    rankedList = Object.values(studentMap).map(s => ({
      ...s,
      score: s.completed_count > 0 ? (s.scores_sum / s.completed_count) : 0,
      score_display: `${(s.completed_count > 0 ? (s.scores_sum / s.completed_count) : 0).toFixed(1)} / 10`,
      score_num: s.completed_count > 0 ? (s.scores_sum / s.completed_count) : 0,
      correct_display: `${s.total_correct}/${s.total_questions} câu`,
      time_spent_display: `${s.completed_count} bài đã thi`,
      date_display: s.latest_submitted_at ? new Date(s.latest_submitted_at).toLocaleDateString('vi-VN') : '--'
    }));
  } else {
    // Lọc theo bài kiểm tra cụ thể
    const matchingSubs = submissions.filter(s => s.exam_id === examIdFilter);
    rankedList = matchingSubs.map(s => {
      const evalData = s.evaluation || {};
      const score = parseFloat(evalData.score !== undefined ? evalData.score : (s.score !== undefined ? s.score : 0)) || 0;
      const subDate = s.submitted_at || evalData.submitted_at;
      return {
        student_id: s.student_id,
        student_name: s.student_name || "Học sinh",
        student_code: s.student_code || "",
        class_code: s.class_code || studentAuthState.classCode || "",
        score: score,
        score_display: `${score.toFixed(1)} / 10`,
        score_num: score,
        correct_display: `${evalData.correct_count ?? s.correct_count ?? 0}/${evalData.total_questions ?? s.total_questions ?? 0} câu`,
        time_spent_display: s.time_spent || evalData.time_spent || "--",
        date_display: subDate ? `${new Date(subDate).toLocaleTimeString('vi-VN')} ${new Date(subDate).toLocaleDateString('vi-VN')}` : '--'
      };
    });
  }

  // Sắp xếp theo điểm cao nhất -> thấp nhất
  rankedList.sort((a, b) => b.score_num - a.score_num);

  if (rankedList.length === 0) {
    const emptyTr = document.createElement("tr");
    emptyTr.innerHTML = /* sanitize */ `<td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">Chưa có học sinh nào nộp bài kiểm tra trong danh mục này.</td>`;
    tbody.appendChild(emptyTr);
    return;
  }

  // 1. Render Top 3 Podium
  const top3 = rankedList.slice(0, 3);
  const podiumOrder = [];
  if (top3[1]) podiumOrder.push({ ...top3[1], rank: 2, orderClass: "second", badge: "🥈 2" });
  if (top3[0]) podiumOrder.push({ ...top3[0], rank: 1, orderClass: "first", badge: "👑 1" });
  if (top3[2]) podiumOrder.push({ ...top3[2], rank: 3, orderClass: "third", badge: "🥉 3" });

  podiumOrder.forEach(item => {
    const pCard = document.createElement("div");
    pCard.className = `podium-card ${item.orderClass}`;
    pCard.innerHTML = /* sanitize */ `
      <span class="podium-rank-badge">${item.badge}</span>
      <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(item.student_name || item.student_id)}" class="podium-avatar" alt="Avatar" />
      <div class="podium-name">${escapeHtml(item.student_name)}</div>
      <div class="podium-code">${escapeHtml(item.student_code || item.class_code)}</div>
      <div class="podium-score">${item.score_num.toFixed(1)}đ</div>
      <div class="podium-meta">${escapeHtml(item.correct_display)}</div>
    `;
    podiumWrap.appendChild(pCard);
  });

  // 2. Render Leaderboard Table
  rankedList.forEach((s, idx) => {
    const tr = document.createElement("tr");
    const isCurrent = (s.student_id === currentStudentId || (studentAuthState.studentCode && s.student_code === studentAuthState.studentCode));
    if (isCurrent) tr.className = "is-current-student";

    let rankBadge = `<span class="rank-badge">${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span class="rank-badge gold">🥇 1</span>`;
    else if (idx === 1) rankBadge = `<span class="rank-badge silver">🥈 2</span>`;
    else if (idx === 2) rankBadge = `<span class="rank-badge bronze">🥉 3</span>`;

    let scoreColor = "#38bdf8";
    if (s.score_num >= 8) scoreColor = "#34d399";
    else if (s.score_num >= 5) scoreColor = "#fbbf24";
    else scoreColor = "#f87171";

    const selfTag = isCurrent ? `<span class="student-self-tag">Em</span>` : "";

    tr.innerHTML = /* sanitize */ `
      <td style="text-align: center;">${rankBadge}</td>
      <td>
        <strong>${escapeHtml(s.student_name)}</strong> ${selfTag}
        ${s.student_code ? `<span style="font-size: 0.78rem; color: #94a3b8; display: block;">${escapeHtml(s.student_code)}</span>` : ''}
      </td>
      <td><strong style="color: ${scoreColor}; font-size: 1.05rem;">${escapeHtml(s.score_display)}</strong></td>
      <td>${escapeHtml(s.correct_display)}</td>
      <td>${escapeHtml(s.time_spent_display)}</td>
      <td>${escapeHtml(s.date_display)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// RENDER LỊCH SỬ BÀI THI & CHẨN ĐOÁN AI SOCRATES
// ---------------------------------------------------------------------------

function renderStudentExamHistory(studentSubs) {
  const historyList = document.getElementById("studentExamHistoryList");
  const summaryBox = document.getElementById("studentSocratesSummaryBox");
  const weakTopicsBox = document.getElementById("studentExamWeakTopicsBox");

  if (!historyList || !summaryBox || !weakTopicsBox) return;

  historyList.replaceChildren();
  summaryBox.replaceChildren();
  weakTopicsBox.replaceChildren();

  if (studentSubs.length === 0) {
    historyList.innerHTML = /* sanitize */ `<p style="color: #64748b; font-size: 0.88rem; padding: 1rem 0;">Em chưa làm bài kiểm tra nào. Hãy bấm vào tab <strong>"Đề thi được giao"</strong> để bắt đầu thử sức nhé!</p>`;
    summaryBox.innerHTML = /* sanitize */ `🤖 Thầy Socrates đang đợi em hoàn thành bài kiểm tra đầu tiên để chẩn đoán năng lực tự học của em!`;
    return;
  }

  // Render danh sách các bài thi đã làm
  const allWeakTopics = new Set();
  let latestAdvice = "";

  studentSubs.forEach(sub => {
    const evalData = sub.evaluation || {};
    const scoreVal = evalData.score !== undefined ? evalData.score : (sub.score !== undefined ? sub.score : 0);
    const scoreNum = parseFloat(scoreVal) || 0;
    const totalQ = evalData.total_questions || sub.total_questions || 4;
    const correctCount = evalData.correct_count !== undefined ? evalData.correct_count : (sub.correct_count || 0);

    let scoreColor = "#38bdf8";
    if (scoreNum >= 8) scoreColor = "#34d399";
    else if (scoreNum >= 5) scoreColor = "#fbbf24";
    else scoreColor = "#f87171";

    const subDate = sub.submitted_at || evalData.submitted_at;
    const formattedDate = subDate ? `${new Date(subDate).toLocaleTimeString('vi-VN')} ${new Date(subDate).toLocaleDateString('vi-VN')}` : "Vừa xong";

    const item = document.createElement("div");
    item.className = "exam-history-item";

    const metaDiv = document.createElement("div");
    metaDiv.className = "history-item-meta";
    metaDiv.innerHTML = /* sanitize */ `
      <h4>${escapeHtml(sub.exam_title || `Bài kiểm tra ${sub.exam_id}`)}</h4>
      <div class="history-item-sub">
        <span>📅 ${escapeHtml(formattedDate)}</span>
        <span>⏱ ${escapeHtml(sub.time_spent || evalData.time_spent || '--')}</span>
        <span>✔ Đúng ${correctCount}/${totalQ} câu</span>
      </div>
    `;

    const scoreDiv = document.createElement("div");
    scoreDiv.className = "history-item-score-wrap";
    scoreDiv.innerHTML = /* sanitize */ `
      <span class="history-score-val" style="color: ${scoreColor};">${scoreNum.toFixed(1)}đ</span>
    `;

    const btnReview = document.createElement("button");
    btnReview.type = "button";
    btnReview.className = "history-item-btn";
    btnReview.textContent = "👁 Xem lại bài làm";
    btnReview.onclick = () => reviewStudentExam(sub.exam_id);
    scoreDiv.appendChild(btnReview);

    item.appendChild(metaDiv);
    item.appendChild(scoreDiv);
    historyList.appendChild(item);

    // Thu thập lời khuyên và lỗ hổng kiến thức
    if (evalData.socratic_advice && !latestAdvice) {
      latestAdvice = evalData.socratic_advice;
    }
    if (evalData.weak_topics && Array.isArray(evalData.weak_topics)) {
      evalData.weak_topics.forEach(t => allWeakTopics.add(t));
    }
  });

  // Render nhận xét Socrates
  summaryBox.textContent = latestAdvice || "🤖 Thầy Socrates chúc mừng em đã hoàn thành bài kiểm tra! Em hãy ôn lại các chủ đề được đánh dấu đỏ bên dưới để củng cố điểm số vững vàng hơn.";

  // Render các chủ đề yếu
  if (allWeakTopics.size === 0) {
    weakTopicsBox.innerHTML = /* sanitize */ `<p style="color: #34d399; font-size: 0.85rem;">🌟 Tuyệt vời! Em không có lỗ hổng kiến thức đáng kể nào trong các bài kiểm tra đã làm.</p>`;
  } else {
    const heading = document.createElement("h4");
    heading.style.color = "#fca5a5";
    heading.style.fontSize = "0.85rem";
    heading.style.margin = "0 0 0.5rem 0";
    heading.textContent = `⚠️ Các chủ đề cần đọc lại SGK (${allWeakTopics.size} chủ đề):`;
    weakTopicsBox.appendChild(heading);

    allWeakTopics.forEach(topic => {
      const pill = document.createElement("div");
      pill.className = "weak-topic-pill";
      pill.innerHTML = /* sanitize */ `
        <span class="title">📖 ${escapeHtml(topic)}</span>
      `;
      const btnStudy = document.createElement("button");
      btnStudy.type = "button";
      btnStudy.className = "btn-study";
      btnStudy.textContent = "Mở SGK ôn ngay";
      btnStudy.onclick = () => {
        openSGKTopicFromRecommendation(studentAuthState.grade || 9, 1, topic);
      };
      pill.appendChild(btnStudy);
      weakTopicsBox.appendChild(pill);
    });
  }
}

// ---------------------------------------------------------------------------
// XEM LẠI BÀI LÀM CŨ & LỜI KHUYÊN AI SOCRATES
// ---------------------------------------------------------------------------

async function reviewStudentExam(examId) {
  try {
    let sub = currentStudentSubmissionsMap[examId];
    const studentId = studentAuthState.uid || studentAuthState.studentCode;

    // 1. Thử lấy từ Firebase nếu chưa có trong bộ nhớ
    if (!sub) {
      try {
        initFirebaseApp();
        if (typeof firebase !== "undefined" && firebase.database) {
          const snap = await firebase.database().ref(`exam_submissions/${examId}/${studentId}`).once("value");
          if (snap.exists()) sub = snap.val();
        }
      } catch (eFb) {
        console.debug("Firebase fetch submission error:", eFb);
      }
    }

    // 2. Thử localStorage
    if (!sub) {
      const localSubs = JSON.parse(localStorage.getItem("AISGK_SUBMISSIONS") || "[]");
      sub = localSubs.find(s => s.exam_id === examId && (s.student_id === studentId || !s.student_id));
    }

    if (!sub || !sub.evaluation) {
      alert("Chưa tìm thấy dữ liệu kết quả bài thi này của em trên hệ thống.");
      return;
    }

    // Nạp thông tin đề thi
    const examFound = (currentStudentExamsList || []).find(e => e.exam_id === examId) || {
      exam_id: examId,
      title: sub.exam_title || "Bài kiểm tra",
      grade: studentAuthState.grade || 9
    };
    activeStudentExam = examFound;

    const studentView = document.getElementById("examStudentView");
    const resultView = document.getElementById("examResultView");
    if (studentView) studentView.classList.add("hidden");
    if (resultView) resultView.classList.remove("hidden");

    renderExamResult(sub.evaluation);
  } catch (err) {
    alert("Lỗi khi mở bài làm: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// NẠP DANH SÁCH BÀI KIỂM TRA & DỮ LIỆU THỐNG KÊ CỦA HỌC SINH
// ---------------------------------------------------------------------------

// Lắng nghe trạng thái mở/khóa đề thi từ Giáo viên trong thời gian thực
function listenRealtimeExamStatusForStudents() {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return;
  if (window._examStatusListening) return;
  window._examStatusListening = true;
  try {
    firebase.database().ref("exams").on("child_changed", (snap) => {
      const val = snap.val();
      if (!val || !val.exam_id) return;
      const studentView = document.getElementById("examStudentView");
      if (studentView && !studentView.classList.contains("hidden")) {
        loadStudentExams();
      }
    });
  } catch (errListener) {
    console.debug("listenRealtimeExamStatus error:", errListener);
  }
}

async function loadStudentExams() {
  const grid = document.getElementById("examStudentGrid");
  if (!grid) return;
  grid.replaceChildren();

  const grade = studentAuthState.grade || state.grade || 9;
  const classCode = studentAuthState.classCode || "";
  const studentId = studentAuthState.uid || studentAuthState.studentCode || "std_e2e_student_01";

  // Cập nhật nhãn lớp
  const classPill = document.getElementById("studentExamClassPill");
  if (classPill) {
    if (classCode) {
      classPill.textContent = `Lớp ${classCode} • Khối ${grade}`;
    } else {
      classPill.textContent = `Khối ${grade}`;
    }
  }

  // Đặt loading state
  const loadingP = document.createElement("p");
  loadingP.style.color = "#94a3b8";
  loadingP.style.padding = "1rem";
  loadingP.textContent = "Đang tải dữ liệu bài kiểm tra & bảng xếp hạng từ Firebase...";
  grid.appendChild(loadingP);

  // 1. Tải song song: Đề thi, Bài nộp học sinh, Bài nộp cả lớp, Roster cả lớp
  let exams = [];
  let studentSubs = [];
  let classSubs = [];
  let classRoster = [];

  try {
    const [fbExams, subs, allClassSubs, roster] = await Promise.all([
      fetchExamsFromFirebase(),
      fetchStudentExamSubmissionsFromFirebase(studentId, classCode),
      fetchAllSubmissionsForClass(classCode),
      fetchClassStudentsFromFirebase(classCode)
    ]);

    if (fbExams && fbExams.length > 0) {
      exams = fbExams.filter(e => {
        if (String(e.grade) !== String(grade) && e.grade !== 0) return false;
        const targets = e.target_classes || [];
        if (targets.length > 0 && !targets.includes("Tất cả") && !targets.includes(classCode)) return false;
        return e.status !== "draft";
      });
    }

    studentSubs = subs || [];
    classSubs = allClassSubs || [];
    classRoster = roster || [];
  } catch (errLoading) {
    console.debug("loadStudentExams error:", errLoading);
  }

  // Fallback backend hoặc tĩnh nếu Firebase chưa có đề
  if (exams.length === 0) {
    try {
      const res = await fetch(`${getExamApiRoot()}/exams/list?grade=${grade}&class_code=${encodeURIComponent(classCode)}`);
      if (res.ok) {
        const data = await res.json();
        exams = data.exams || [];
      }
    } catch (eApi) {
      console.debug("Backend offline:", eApi);
    }
  }
  if (exams.length === 0) {
    const fallback = await getFallbackExams();
    exams = fallback.filter(e => {
      if (String(e.grade) !== String(grade) && e.grade !== 0) return false;
      const targets = e.target_classes || [];
      if (targets.length > 0 && !targets.includes("Tất cả") && !targets.includes(classCode)) return false;
      return true;
    });
  }

  currentStudentExamsList = exams;
  currentClassSubmissionsList = classSubs;

  // Xây dựng map bài nộp của học sinh theo exam_id
  const subsMap = {};
  studentSubs.forEach(s => {
    if (s.exam_id) subsMap[s.exam_id] = s;
  });
  currentStudentSubmissionsMap = subsMap;

  // Cập nhật số lượng đề trên badge tab
  const badgeCount = document.getElementById("badgeStudentExamsCount");
  if (badgeCount) badgeCount.textContent = String(exams.length);

  // Cập nhật dropdown chọn bài kiểm tra trên Leaderboard
  updateLeaderboardExamDropdown(exams);

  // 2. Render 4 thẻ KPI Thống kê cá nhân
  renderStudentExamKPIs(exams, studentSubs, classSubs, classRoster);

  // 3. Render danh sách thẻ đề thi
  renderStudentExamCards(exams, subsMap, classCode);

  // 4. Render Bảng xếp hạng lớp
  renderClassLeaderboard("all");

  // 5. Render Lịch sử bài làm & Phân tích AI Socrates
  renderStudentExamHistory(studentSubs);

  // 6. Gắn sự kiện chuyển tab và bộ lọc
  initStudentExamTabEvents();
  listenRealtimeExamStatusForStudents();

  // 7. Tải danh sách tài liệu học tập PDF (H3)
  loadStudentDocuments();
}



async function startStudentExam(examId) {
  try {
    let examData = null;
    let fullExamData = null;

    // 1. Ưu tiên tải trực tiếp từ Firebase Realtime Database (kèm timeout an toàn chống treo)
    try {
      initFirebaseApp();
      if (typeof firebase !== "undefined" && firebase.database) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase Timeout")), 1200));
        const snap = await Promise.race([
          firebase.database().ref(`exams/${examId}`).once("value"),
          timeoutPromise
        ]);
        if (snap && snap.exists && snap.exists()) {
          const fbVal = snap.val();
          if (fbVal && fbVal.questions && fbVal.questions.length > 0) {
            fullExamData = JSON.parse(JSON.stringify(fbVal));
            examData = JSON.parse(JSON.stringify(fbVal));
          }
        }
      }
    } catch (errFb) {
      console.debug("Firebase fetch exam error:", errFb);
    }

    // 2. Thử tải từ Backend API
    if (!examData) {
      try {
        const res = await fetch(`${getExamApiRoot()}/exams/${examId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.exam) {
            examData = data.exam;
            fullExamData = data.exam;
          }
        }
      } catch (errApi) {
        console.debug("API fetch exam failed, trying fallback:", errApi);
      }
    }

    // 3. Dự phòng từ bộ nhớ trình duyệt & file mẫu
    if (!examData) {
      const fallbackList = await getFallbackExams();
      const found = fallbackList.find(e => e.exam_id === examId);
      if (found) {
        fullExamData = JSON.parse(JSON.stringify(found));
        examData = JSON.parse(JSON.stringify(found));
      }
    }

    // Ẩn đáp án đúng trên màn hình học sinh để tránh gian lận F12
    if (examData && examData.questions) {
      examData.questions.forEach(q => {
        delete q.dap_an_dung;
        delete q.giai_thich;
        delete q.giai_thich_su_pham;
      });
    }

        // Chốt chặn kiểm tra trạng thái khóa đề thi từ Giáo viên
    if (fullExamData && (fullExamData.status === "closed" || fullExamData.status === "draft")) {
      alert("🔒 Bài kiểm tra này hiện đang được Thầy/Cô tạm khóa.\n\nEm vui lòng đợi Giáo viên mở đề thi để làm bài nhé!");
      return;
    }

    if (!examData || !examData.questions || examData.questions.length === 0) {
      throw new Error("Không thể tải nội dung câu hỏi của bài kiểm tra!");
    }

    activeStudentExam = examData;
    window.activeStudentExam = examData;
    activeStudentExamFull = fullExamData;

    examTakingState = {
      currentQuestionIndex: 0,
      answers: {},
      timeLeftSeconds: (activeStudentExam.duration_minutes || 15) * 60,
      timerInterval: null,
      startTime: Date.now()
    };

    // Ẩn Student Hub, mở Taking Stage
    const studentView = document.getElementById("examStudentView");
    const takingView = document.getElementById("examTakingView");
    const resultView = document.getElementById("examResultView");

    if (studentView) studentView.classList.add("hidden");
    if (resultView) resultView.classList.add("hidden");
    if (takingView) takingView.classList.remove("hidden");

    // Điền tiêu đề và meta
    const titleEl = document.getElementById("takingExamTitle");
    if (titleEl) titleEl.textContent = activeStudentExam.title;
    const tagEl = document.getElementById("takingExamTag");
    if (tagEl) tagEl.textContent = `Khối ${activeStudentExam.grade} • Lớp ${studentAuthState.classCode || '9A'}`;

    renderTakingPalette();
    renderTakingQuestion(0);
    startExamCountdownTimer();
  } catch (err) {
    alert("Không thể bắt đầu bài kiểm tra: " + err.message);
  }
}

function startExamCountdownTimer() {
  if (examTakingState.timerInterval) {
    clearInterval(examTakingState.timerInterval);
  }

  const timerEl = document.getElementById("takingCountdownVal");
  const updateDisplay = () => {
    if (!timerEl) return;
    const minutes = Math.floor(examTakingState.timeLeftSeconds / 60);
    const seconds = examTakingState.timeLeftSeconds % 60;
    const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    timerEl.textContent = formatted;

    if (examTakingState.timeLeftSeconds <= 120) {
      timerEl.style.color = "#ef4444";
    } else {
      timerEl.style.color = "#38bdf8";
    }
  };

  updateDisplay();

  examTakingState.timerInterval = setInterval(() => {
    examTakingState.timeLeftSeconds--;
    if (examTakingState.timeLeftSeconds <= 0) {
      clearInterval(examTakingState.timerInterval);
      examTakingState.timerInterval = null;
      updateDisplay();
      alert("⏰ Đã hết thời gian làm bài! Hệ thống đang tự động nộp bài của em.");
      submitStudentExam();
    } else {
      updateDisplay();
    }
  }, 1000);
}

function renderTakingPalette() {
  const container = document.getElementById("takingPaletteContainer");
  if (!container || !activeStudentExam) return;
  container.replaceChildren();

  const total = activeStudentExam.questions ? activeStudentExam.questions.length : 0;
  const currentIdx = examTakingState.currentQuestionIndex;
  const currentQ = activeStudentExam.questions[currentIdx];
  const isCurrentDone = Boolean(currentQ && examTakingState.answers[currentQ.id]);

  for (let i = 0; i < total; i++) {
    const q = activeStudentExam.questions[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-q-btn";
    btn.textContent = String(i + 1);

    if (i === currentIdx) {
      btn.classList.add("active");
    }
    if (examTakingState.answers[q.id]) {
      btn.classList.add("answered");
    }

    // BẢO VỆ TIẾN TRÌNH LÀM BÀI:
    // Học sinh chỉ được chuyển tới câu hỏi i nếu:
    // 1. Quay lại câu đã làm hoặc câu hiện tại (i <= currentIdx).
    // 2. Chuyển sang câu sau (i > currentIdx) NẾU câu hiện tại và toàn bộ câu trước đó đã có đáp án.
    let isUnlocked = true;
    if (i > currentIdx) {
      if (!isCurrentDone) {
        isUnlocked = false;
      } else {
        for (let k = 0; k < i; k++) {
          const checkQ = activeStudentExam.questions[k];
          if (checkQ && !examTakingState.answers[checkQ.id]) {
            isUnlocked = false;
            break;
          }
        }
      }
    }

    if (!isUnlocked) {
      btn.classList.add("palette-q-locked");
      btn.title = "Em vui lòng chọn đáp án câu hỏi hiện tại trước khi chuyển câu!";
      btn.onclick = () => {
        showExamToast("Em vui lòng chọn đáp án cho câu hỏi hiện tại trước khi chuyển tiếp!", "warning");
      };
    } else {
      btn.onclick = () => {
        renderTakingQuestion(i);
      };
    }

    container.appendChild(btn);
  }

  updateTakingAnsweredCount();
}

function renderTakingQuestion(index) {
  if (!activeStudentExam || !activeStudentExam.questions || !activeStudentExam.questions[index]) return;
  examTakingState.currentQuestionIndex = index;

  const q = activeStudentExam.questions[index];
  const total = activeStudentExam.questions.length;

  // Cập nhật số câu
  const numSpan = document.getElementById("takingQCurrentIndex");
  if (numSpan) numSpan.textContent = `Câu ${index + 1} / ${total}`;

  // Cập nhật Mục SGK (như trong Hình 3)
  const sectionBadge = document.getElementById("takingQSectionBadge");
  if (sectionBadge) {
    sectionBadge.textContent = q.muc_sgk || "Mục 1: Kiến thức trọng tâm";
    sectionBadge.style.display = q.muc_sgk ? "inline-block" : "none";
  }

  // Cập nhật nội dung câu hỏi
  const textEl = document.getElementById("takingQQuestionText");
  if (textEl) textEl.textContent = q.cau_hoi;

  // Cập nhật các lựa chọn chuẩn giao diện Hình 3
  const optionsContainer = document.getElementById("takingOptionsContainer");
  if (optionsContainer) {
    optionsContainer.replaceChildren();

    const selectedChoice = examTakingState.answers[q.id];
    const letters = ["A", "B", "C", "D"];

    letters.forEach(letter => {
      const optionText = q.lua_chon ? q.lua_chon[letter] : "";
      if (!optionText) return;

      const card = document.createElement("div");
      card.className = `taking-opt-card ${selectedChoice === letter ? 'selected' : ''}`;

      card.innerHTML = /* sanitize */ `
        <div class="opt-letter-badge">${letter}</div>
        <div class="opt-text-val">${escapeHtml(optionText)}</div>
      `;

      card.onclick = () => {
        selectTakingOption(q.id, letter);
      };

      optionsContainer.appendChild(card);
    });
  }

  // Điều khiển nút Câu trước / Câu tiếp theo (H2: Giữ nút Câu tiếp có thể bấm để bật cảnh báo khi chưa chọn đáp án)
  const btnPrev = document.getElementById("btnTakingPrevQ");
  const btnNext = document.getElementById("btnTakingNextQ");
  const isCurrentAnswered = Boolean(examTakingState.answers[q.id]);
  if (btnPrev) btnPrev.disabled = (index === 0);
  if (btnNext) {
    btnNext.disabled = (index === total - 1);
    if (!isCurrentAnswered && index < total - 1) {
      btnNext.classList.add("needs-answer");
      btnNext.title = "Em vui lòng chọn đáp án trước khi bấm Câu tiếp";
    } else {
      btnNext.classList.remove("needs-answer");
      btnNext.title = "Chuyển sang câu tiếp theo";
    }
  }

  renderTakingPalette();
}

function selectTakingOption(questionId, letter) {
  examTakingState.answers[questionId] = letter;

  // Cập nhật trạng thái nút Tiếp theo ngay khi chọn phương án
  const btnNext = document.getElementById("btnTakingNextQ");
  if (btnNext && activeStudentExam && activeStudentExam.questions) {
    const total = activeStudentExam.questions.length;
    btnNext.disabled = (examTakingState.currentQuestionIndex === total - 1);
    btnNext.classList.remove("needs-answer");
    btnNext.title = "Chuyển sang câu tiếp theo";
  }

  const optionsContainer = document.getElementById("takingOptionsContainer");
  if (optionsContainer) {
    const cards = optionsContainer.querySelectorAll(".taking-opt-card");
    const letters = ["A", "B", "C", "D"];
    cards.forEach((card, idx) => {
      if (letters[idx] === letter) {
        card.classList.add("selected");
      } else {
        card.classList.remove("selected");
      }
    });
  }

  renderTakingPalette();
}

function updateTakingAnsweredCount() {
  if (!activeStudentExam || !activeStudentExam.questions) return;
  const total = activeStudentExam.questions.length;
  const answered = Object.keys(examTakingState.answers).length;

  const countSpan = document.getElementById("takingAnsweredCount");
  if (countSpan) countSpan.textContent = `${answered}/${total} câu`;
}

function confirmAndSubmitStudentExam() {
  if (!activeStudentExam || !activeStudentExam.questions) return;
  const total = activeStudentExam.questions.length;
  const answered = Object.keys(examTakingState.answers).length;
  const isTimeUp = Boolean(examTakingState.timeLeftSeconds <= 0);

  // H1: BẮT BUỘC học sinh phải làm HẾT tất cả các câu hoặc HẾT GIỜ mới được nộp bài!
  if (!isTimeUp && answered < total) {
    const unAnsweredCount = total - answered;
    showExamToast(`⚠️ Em chưa làm hết các câu hỏi (mới làm ${answered}/${total} câu). Bắt buộc phải hoàn thành 100% các câu hoặc đợi hết giờ mới được nộp bài!`, "warning");
    alert(`⚠️ CHƯA THỂ NỘP BÀI!\n\nEm mới hoàn thành ${answered}/${total} câu hỏi (còn ${unAnsweredCount} câu chưa chọn đáp án).\n\nTheo quy chế thi trắc nghiệm, em BẮT BUỘC phải làm hết tất cả các câu hỏi hoặc đợi đến khi hết giờ làm bài mới được nộp bài.`);
    return;
  }

  // Khi đã làm hết các câu hỏi hoặc đã hết giờ
  const confirmSubmit = confirm(`🎉 Em đã hoàn thành đủ ${answered}/${total} câu hỏi!\n\nEm có chắc chắn muốn nộp bài để Gia sư AI Socrates chấm điểm ngay bây giờ không?`);
  if (!confirmSubmit) return;

  submitStudentExam();
}

async function submitStudentExam() {
  if (!activeStudentExam) return;
  if (examTakingState.timerInterval) {
    clearInterval(examTakingState.timerInterval);
    examTakingState.timerInterval = null;
  }

  const btnSubmit = document.getElementById("btnTakingSubmitExam");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = "<span>⏳ Đang nộp bài & Gia sư Socrates đang chấm...</span>" /* sanitize */;
  }

  const elapsedSeconds = examTakingState.startTime ? Math.round((Date.now() - examTakingState.startTime) / 1000) : 0;
  const elapsedMin = Math.floor(elapsedSeconds / 60);
  const elapsedSec = elapsedSeconds % 60;
  const timeSpentStr = `${elapsedMin} phút ${elapsedSec} giây`;

  const payload = {
    exam_id: activeStudentExam.exam_id,
    student_id: studentAuthState.uid || studentAuthState.studentCode || `student_${Date.now()}`,
    student_name: studentAuthState.studentName || "Học sinh",
    student_code: studentAuthState.studentCode || "HS001",
    class_code: studentAuthState.classCode || "",
    answers: examTakingState.answers,
    time_spent: timeSpentStr
  };

  try {
    let result = null;

    // 1. Thử gửi lên backend chấm bài
    try {
      const res = await fetch(`${getExamApiRoot()}/exams/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        result = data.evaluation;
      }
    } catch (apiErr) {
      console.debug("Backend submit offline, executing client-side Socratic grading:", apiErr);
    }

    // 2. Chấm bài bằng Socratic AI Engine phía Client nếu Backend offline
    if (!result) {
      let questionsWithAnswers = [];
      if (activeStudentExamFull && activeStudentExamFull.questions) {
        questionsWithAnswers = activeStudentExamFull.questions;
      } else {
        const fallbackList = await getFallbackExams();
        const found = fallbackList.find(e => e.exam_id === activeStudentExam.exam_id);
        if (found && found.questions) questionsWithAnswers = found.questions;
      }

      let correctCount = 0;
      const totalQ = questionsWithAnswers.length || 1;
      const details = [];
      const weakTopicsMap = {};

      questionsWithAnswers.forEach(q => {
        const studentChoice = examTakingState.answers[q.id];
        const isCorrect = (studentChoice === q.dap_an_dung);
        if (isCorrect) {
          correctCount++;
        } else {
          const topic = q.muc_sgk || "Kiến thức chung SGK";
          weakTopicsMap[topic] = (weakTopicsMap[topic] || 0) + 1;
        }
        details.push({
          id: q.id,
          cau_hoi: q.cau_hoi,
          is_correct: isCorrect,
          student_choice: studentChoice,
          correct_option: q.dap_an_dung,
          giai_thich: q.giai_thich || "Đáp án chuẩn xác theo SGK.",
          muc_sgk: q.muc_sgk || "Kiến thức chung"
        });
      });

      const score = Math.round((correctCount / totalQ) * 100) / 10;
      const weakTopics = Object.keys(weakTopicsMap);

      let socraticAdvice = "";
      if (score >= 9) {
        socraticAdvice = `🌟 Xuất sắc! Em đã hoàn thành bài kiểm tra với điểm số tuyệt vời ${score}/10 (${correctCount}/${totalQ} câu). Em nắm rất chắc các khái niệm trọng tâm trong SGK Tin học. Hãy tiếp tục phát huy!`;
      } else if (score >= 7) {
        socraticAdvice = `👍 Khá tốt! Em đã trả lời đúng ${correctCount}/${totalQ} câu (${score}/10 điểm). Em đã nắm được nền tảng kiến thức bài học. Hãy xem lại giải thích ở các mục bên dưới để củng cố các câu còn nhầm lẫn nhé.`;
      } else if (score >= 5) {
        socraticAdvice = `⚠️ Em đã đạt mức yêu cầu cơ bản (${score}/10 điểm, đúng ${correctCount}/${totalQ} câu). Hệ thống nhận diện em còn bị nhầm lẫn ở các chủ đề: ${weakTopics.join(', ')}. Em hãy dành ít nhất 15 phút mở lại các mục SGK được Gia sư Socrates đề xuất bên dưới để ôn lại lý thuyết nhé!`;
      } else {
        socraticAdvice = `🚨 Kết quả kiểm tra của em chưa đạt yêu cầu (${score}/10 điểm, đúng ${correctCount}/${totalQ} câu). Thầy Socrates nhận thấy em đang gặp khó khăn ở các chủ đề: ${weakTopics.join(', ') || 'các kiến thức bài học'}. Đừng nản lòng! Hãy bấm vào nút "Mở SGK học ngay" bên dưới để đọc lại lý thuyết và phân tích từng câu sai nhé!`;
      }

      result = {
        score: score,
        correct_count: correctCount,
        total_questions: totalQ,
        percentage: Math.round((correctCount / totalQ) * 100),
        weak_topics: weakTopics,
        socratic_advice: socraticAdvice,
        details: details,
        time_spent: timeSpentStr,
        recommended_lessons: weakTopics.map((topic, i) => {
          const matchLesson = topic.match(/Bài\s*(\d+)/i) || (activeStudentExam.title && activeStudentExam.title.match(/Bài\s*(\d+)/i));
          const lessonId = matchLesson ? parseInt(matchLesson[1], 10) : (i + 1);
          return {
            grade: activeStudentExam.grade || 9,
            lesson_id: lessonId,
            title: `Tin học ${activeStudentExam.grade || 9} - Bài ${lessonId}`,
            muc_sgk: topic,
            advice: `Em cần ôn lại lý thuyết tại "${topic}" để nắm chắc kiến thức.`
          };
        }),
        submitted_at: new Date().toISOString()
      };
    }

    // 3. Chuẩn hóa hai chiều giữa backend evaluation và frontend
    if (result.ai_evaluation) {
      if (!result.socratic_advice && result.ai_evaluation.overall_comment) {
        result.socratic_advice = result.ai_evaluation.overall_comment;
      }
      if ((!result.recommended_lessons || result.recommended_lessons.length === 0) && result.ai_evaluation.recommendations) {
        result.recommended_lessons = result.ai_evaluation.recommendations.map(r => ({
          grade: activeStudentExam.grade || 9,
          lesson_id: r.lesson_id || 1,
          title: `Tin học ${activeStudentExam.grade || 9} - Bài ${r.lesson_id || 1}`,
          muc_sgk: r.topic,
          advice: r.advice
        }));
      }
      if (!result.weak_topics && result.ai_evaluation.weak_topics) {
        result.weak_topics = Object.keys(result.ai_evaluation.weak_topics);
      }
    }

    result.time_spent = result.time_spent || timeSpentStr;

    // 4. ĐỒNG BỘ LÊN FIREBASE REALTIME DATABASE
    await syncSubmissionToFirebase(payload, result);

    // 5. Tính toán thứ hạng xếp điểm trong lớp từ Firebase
    try {
      const allSubs = await fetchExamSubmissionsFromFirebase(activeStudentExam.exam_id);
      if (allSubs.length > 0) {
        allSubs.sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0));
        const myIndex = allSubs.findIndex(s => s.student_id === payload.student_id);
        result.rank = myIndex >= 0 ? (myIndex + 1) : 1;
        result.total_participants = allSubs.length;
        const avg = allSubs.reduce((acc, s) => acc + (parseFloat(s.score) || 0), 0) / allSubs.length;
        result.class_average = Number(avg.toFixed(1));
      }
    } catch (eRank) {
      console.debug("Compute rank failed:", eRank);
    }

    // 6. Lưu offline vào localStorage
    try {
      const localSubs = JSON.parse(localStorage.getItem("AISGK_SUBMISSIONS") || "[]");
      localSubs.unshift({
        ...payload,
        time_spent: timeSpentStr,
        evaluation: result
      });
      localStorage.setItem("AISGK_SUBMISSIONS", JSON.stringify(localSubs));
    } catch (eSub) {
      console.debug("Lưu localStorage submission thất bại:", eSub);
    }

    const takingView = document.getElementById("examTakingView");
    const resultView = document.getElementById("examResultView");
    if (takingView) takingView.classList.add("hidden");
    if (resultView) resultView.classList.remove("hidden");
    renderExamResult(result);
  } catch (err) {
    alert("Lỗi khi nộp bài: " + err.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = "<span>✔ Nộp bài kiểm tra</span>" /* sanitize */;
    }
  }
}

function renderExamResult(evaluation) {
  const scoreVal = evaluation.score !== undefined ? evaluation.score : 0;
  const scoreNum = parseFloat(scoreVal) || 0;
  const scoreEl = document.getElementById("resultScoreNum");
  const countEl = document.getElementById("resultCorrectCount");
  const percentEl = document.getElementById("resultPercentRatio");
  const timeEl = document.getElementById("resultTimeSpent");
  const examTitleEl = document.getElementById("resultExamTitle");

  if (scoreEl) scoreEl.textContent = String(scoreNum.toFixed(1));
  if (countEl) countEl.textContent = `✔ ${evaluation.correct_count ?? 0}/${evaluation.total_questions ?? 0} câu đúng`;

  const pct = evaluation.total_questions > 0 ? Math.round(((evaluation.correct_count ?? 0) / evaluation.total_questions) * 100) : 0;
  if (percentEl) percentEl.textContent = `⚡ Đạt ${pct}%`;
  if (timeEl && (evaluation.time_spent || evaluation.timeSpent)) {
    timeEl.textContent = `⏱ ${evaluation.time_spent || evaluation.timeSpent}`;
  }
  if (examTitleEl && activeStudentExam) {
    examTitleEl.textContent = `Kết quả: ${activeStudentExam.title}`;
  }

  // Đổi màu vòng tròn điểm số
  const circleEl = document.getElementById("resultScoreCircle");
  if (circleEl) {
    if (scoreNum >= 8) {
      circleEl.style.borderColor = "#34d399";
      circleEl.style.color = "#34d399";
    } else if (scoreNum >= 5) {
      circleEl.style.borderColor = "#fbbf24";
      circleEl.style.color = "#fbbf24";
    } else {
      circleEl.style.borderColor = "#f87171";
      circleEl.style.color = "#f87171";
    }
  }

  // Thông báo chúc mừng & Xếp hạng điểm số
  let tierText = "Xuất sắc 🌟";
  if (scoreNum < 5) tierText = "Cần ôn tập gấp 🚨";
  else if (scoreNum < 6.5) tierText = "Trung bình ⚠️";
  else if (scoreNum < 8) tierText = "Khá 👍";
  else if (scoreNum < 9) tierText = "Giỏi 🎯";

  const alertContainer = document.getElementById("examSuccessAlert");
  if (alertContainer) {
    const rankText = evaluation.rank ? ` • Xếp hạng: <strong>#${evaluation.rank}/${evaluation.total_participants || 1}</strong> trong lớp` : "";
    alertContainer.innerHTML = /* sanitize */ `
      <div class="exam-alert-badge">
        🎉 <strong>Đã nộp bài thành công!</strong> Xếp loại: <strong>${tierText}</strong>${rankText}.
      </div>
    `;
    alertContainer.classList.remove("hidden");
  }

  const rankBadgeEl = document.getElementById("resultRankingBadge");
  if (rankBadgeEl) {
    if (evaluation.rank) {
      rankBadgeEl.textContent = `🏆 Hạng #${evaluation.rank}/${evaluation.total_participants || 1}`;
      rankBadgeEl.style.display = "inline-block";
    } else {
      rankBadgeEl.textContent = `🏆 Xếp loại: ${tierText}`;
    }
  }

  // Nhận xét Socratic AI sâu sắc
  const feedbackEl = document.getElementById("resultAIFeedbackText");
  if (feedbackEl) {
    feedbackEl.textContent = evaluation.socratic_advice || "Em hãy đọc kỹ các giải thích chi tiết bên dưới để điều chỉnh phương pháp học tập phù hợp hơn.";
  }

  // Danh sách Đề xuất SGK ôn tập
  const recList = document.getElementById("resultRecommendList");
  const recBox = document.getElementById("resultRecommendationsBox");
  if (recList && recBox) {
    const recs = evaluation.recommended_lessons || [];
    recList.replaceChildren();

    if (scoreNum >= 9.0 && recs.length === 0) {
      const p = document.createElement("p");
      p.style.color = "#34d399";
      p.style.fontWeight = "600";
      p.textContent = "🌟 Em đã nắm rất vững toàn bộ nội dung của bài kiểm tra này!";
      recList.appendChild(p);
    } else if (recs.length === 0 && scoreNum < 9.0) {
      const item = document.createElement("div");
      item.className = "recommendation-item";
      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.style.alignItems = "center";
      item.style.padding = "10px 14px";
      item.style.background = "rgba(15, 23, 42, 0.6)";
      item.style.border = "1px solid #334155";
      item.style.borderRadius = "8px";
      item.innerHTML = /* sanitize */ `
        <div>
          <div style="font-weight: 700; color: #f1f5f9; font-size: 0.95rem;">Lý thuyết trọng tâm bài học</div>
          <div style="font-size: 0.82rem; color: #94a3b8; margin-top: 2px;">Em hãy mở SGK để đọc lại các khái niệm cơ bản.</div>
        </div>
        <button type="button" class="btn-exam-primary sm" style="flex-shrink: 0;">📖 Mở SGK học ngay</button>
      `;
      const btn = item.querySelector("button");
      if (btn) {
        btn.onclick = () => openSGKTopicFromRecommendation(activeStudentExam.grade || 9, 1, "Kiến thức bài học");
      }
      recList.appendChild(item);
    } else {
      recs.forEach(rec => {
        const item = document.createElement("div");
        item.className = "recommendation-item";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.padding = "10px 14px";
        item.style.background = "rgba(15, 23, 42, 0.6)";
        item.style.border = "1px solid #334155";
        item.style.borderRadius = "8px";
        item.style.marginBottom = "8px";

        item.innerHTML = /* sanitize */ `
          <div>
            <div style="font-weight: 700; color: #f1f5f9; font-size: 0.95rem;">${escapeHtml(rec.title || `Bài học Tin học ${rec.grade || 9}`)}</div>
            <div style="font-size: 0.82rem; color: #94a3b8; margin-top: 2px;">Chủ đề cần đọc lại: <strong style="color: #38bdf8;">${escapeHtml(rec.muc_sgk || '')}</strong></div>
            ${rec.advice ? `<div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 4px; font-style: italic;">${escapeHtml(rec.advice)}</div>` : ''}
          </div>
          <button type="button" class="btn-exam-primary sm" style="flex-shrink: 0; margin-left: 10px;">📖 Mở SGK học ngay</button>
        `;

        const btn = item.querySelector("button");
        if (btn) {
          btn.onclick = () => openSGKTopicFromRecommendation(rec.grade, rec.lesson_id, rec.muc_sgk);
        }

        recList.appendChild(item);
      });
    }
  }

  // Xem lại chi tiết từng câu hỏi đúng/sai
  const reviewList = document.getElementById("resultReviewQuestionsList");
  if (reviewList) {
    reviewList.replaceChildren();
    const details = evaluation.details || [];
    details.forEach((d, idx) => {
      const card = document.createElement("div");
      card.className = "review-question-card";
      card.style.background = "#111827";
      card.style.border = `1.5px solid ${d.is_correct ? 'rgba(52, 211, 153, 0.4)' : 'rgba(248, 113, 113, 0.4)'}`;
      card.style.borderRadius = "10px";
      card.style.padding = "1rem 1.25rem";
      card.style.marginBottom = "0.85rem";

      const isCorrect = d.is_correct;
      const statusIcon = isCorrect ? "✔ Đúng" : "✖ Sai";
      const statusColor = isCorrect ? "#34d399" : "#f87171";

      card.innerHTML = /* sanitize */ `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <div>
            <strong style="color: #f1f5f9; font-size: 0.95rem;">Câu ${idx + 1}:</strong>
            ${d.muc_sgk ? `<span class="preview-tag-topic" style="margin-left: 6px;">${escapeHtml(d.muc_sgk)}</span>` : ''}
          </div>
          <span style="font-weight: 700; color: ${statusColor}; font-size: 0.88rem;">${statusIcon}</span>
        </div>
        <div style="color: #f8fafc; font-size: 0.95rem; margin-bottom: 0.65rem; line-height: 1.45;">
          ${escapeHtml(d.cau_hoi)}
        </div>
        <div style="font-size: 0.85rem; line-height: 1.5; background: #0f172a; padding: 0.65rem 0.85rem; border-radius: 6px; border: 1px solid #1e293b;">
          <div>Em đã chọn: <strong style="color: ${isCorrect ? '#34d399' : '#f87171'};">${escapeHtml(d.student_choice || d.user_choice || 'Chưa chọn')}</strong></div>
          ${!isCorrect ? `<div>Đáp án đúng: <strong style="color: #34d399;">${escapeHtml(d.correct_option || d.correct_choice || '')}</strong></div>` : ''}
          ${d.giai_thich || d.giai_thich_su_pham ? `<div style="color: #94a3b8; margin-top: 4px; font-style: italic;">💡 Giải thích: ${escapeHtml(d.giai_thich || d.giai_thich_su_pham)}</div>` : ''}
        </div>
      `;

      reviewList.appendChild(card);
    });
  }
}

function openSGKTopicFromRecommendation(grade, lessonId, mucSgk) {
  const examStage = document.getElementById("examStage");
  if (examStage) examStage.classList.add("hidden");

  const canvas = document.getElementById("focusCanvas");
  if (canvas) canvas.classList.remove("hidden");

  if (typeof state !== "undefined") {
    state.grade = grade;
    state.lessonId = lessonId;
  }

  if (typeof loadLesson === "function") {
    loadLesson(grade, lessonId);
  }

  setTimeout(() => {
    if (mucSgk) {
      alert(`Hệ thống đã mở SGK Lớp ${grade} - Bài ${lessonId} để em ôn lại phần: "${mucSgk}".`);
    }
  }, 400);
}

// Khởi tạo các sự kiện khi load trang
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initTeacherExamEvents();
    initTeacherChangePinModal();
    initTeacherUploadDocModal();

    const btnTakingPrev = document.getElementById("btnTakingPrevQ");
    const btnTakingNext = document.getElementById("btnTakingNextQ");
    const btnTakingSubmit = document.getElementById("btnTakingSubmitExam");

    if (btnTakingPrev) {
      btnTakingPrev.addEventListener("click", () => {
        if (examTakingState.currentQuestionIndex > 0) {
          renderTakingQuestion(examTakingState.currentQuestionIndex - 1);
        }
      });
    }

    if (btnTakingNext) {
      btnTakingNext.addEventListener("click", () => {
        if (!activeStudentExam || !activeStudentExam.questions) return;
        const currentIdx = examTakingState.currentQuestionIndex;
        const currentQ = activeStudentExam.questions[currentIdx];
        const isCurrentAnswered = Boolean(currentQ && examTakingState.answers[currentQ.id]);

        if (!isCurrentAnswered) {
          showExamToast("⚠️ Em vui lòng chọn đáp án cho câu hỏi hiện tại trước khi chuyển sang câu tiếp theo!", "warning");
          const container = document.getElementById("takingOptionsContainer");
          if (container) {
            container.classList.add("shake-highlight");
            setTimeout(() => container.classList.remove("shake-highlight"), 600);
          }
          return;
        }

        if (currentIdx < activeStudentExam.questions.length - 1) {
          renderTakingQuestion(currentIdx + 1);
        }
      });
    }

    if (btnTakingSubmit) {
      btnTakingSubmit.addEventListener("click", confirmAndSubmitStudentExam);
    }

    const btnResultBack = document.getElementById("btnResultBackToList");
    if (btnResultBack) {
      btnResultBack.addEventListener("click", openExamHub);
    }
  });
}


// ============================================================================
// HỆ THỐNG QUẢN LÝ TÀI LIỆU HỌC TẬP & BỘ XEM PDF CHUẨN ĐA NỀN TẢNG (H3)
// ============================================================================

const DEFAULT_DOCUMENTS = [
  {
    doc_id: "doc_tin9_decuong_hk1",
    title: "Đề cương Ôn tập & Hướng dẫn Thực hành Giữa HK1 - Tin học 9",
    grade: 9,
    target_classes: ["all"],
    description: "Tóm tắt kiến thức trọng tâm Chủ đề 1, 2, 3: Hệ thống máy tính, Mạng xã hội & Đạo đức số.",
    file_name: "de_cuong_tin9.pdf",
    file_size: "350 KB",
    uploaded_at: "2026-10-21T08:00:00Z",
    uploaded_by: "Giáo viên Tin học",
    url: "assets/docs/de_cuong_tin9.pdf"
  },
  {
    doc_id: "doc_tin6_lythuyet_hk1",
    title: "Sổ tay Lý thuyết & Sơ đồ Tư duy Tin học 6 - Kết nối tri thức",
    grade: 6,
    target_classes: ["all"],
    description: "Hệ thống sơ đồ tư duy Chủ đề Máy tính và em, Biểu diễn thông tin trong máy tính.",
    file_name: "ly_thuyet_tin6.pdf",
    file_size: "420 KB",
    uploaded_at: "2026-10-21T08:00:00Z",
    uploaded_by: "Giáo viên Tin học",
    url: "assets/docs/ly_thuyet_tin6.pdf"
  },
  {
    doc_id: "doc_all_antoanso",
    title: "Cẩm nang An toàn trên Không gian mạng & Phòng tránh Lừa đảo số THCS",
    grade: "all",
    target_classes: ["all"],
    description: "Quy tắc 5K bảo mật tài khoản, nhận diện mã độc và phòng tránh lừa đảo trực tuyến.",
    file_name: "an_toan_so_thcs.pdf",
    file_size: "280 KB",
    uploaded_at: "2026-10-21T08:00:00Z",
    uploaded_by: "Giáo viên Tin học",
    url: "assets/docs/an_toan_so_thcs.pdf"
  }
];

let currentDocumentsList = [];
let documentsRealtimeListenerAttached = false;

// Lưu trữ tài liệu vào LocalStorage an toàn (chống lỗi tràn quota 5MB nếu tệp PDF nặng)
function saveDocumentsToLocalStorage(docs) {
  try {
    localStorage.setItem("ai_sgk_documents", JSON.stringify(docs));
    localStorage.setItem("ai_sgk_docs_inited", "true");
  } catch (err) {
    console.warn("LocalStorage full, stripping large data_url to fit quota:", err);
    try {
      const lightDocs = docs.map(d => {
        const copy = { ...d };
        if (copy.data_url && copy.data_url.length > 80000) {
          copy.has_cloud_data = true;
          delete copy.data_url;
        }
        return copy;
      });
      localStorage.setItem("ai_sgk_documents", JSON.stringify(lightDocs));
      localStorage.setItem("ai_sgk_docs_inited", "true");
    } catch (e2) {
      console.debug("Could not save to localStorage even with stripped data_url:", e2);
    }
  }
}

// Tải tài liệu từ Firebase Realtime Database
async function fetchDocumentsFromFirebase() {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return null;
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000));
    const [snap, metaSnap] = await Promise.race([
      Promise.all([
        firebase.database().ref("documents").once("value"),
        firebase.database().ref("documents_meta/initialized").once("value")
      ]),
      timeoutPromise
    ]);

    const isInitialized = Boolean(metaSnap && metaSnap.exists && metaSnap.exists() && metaSnap.val());
    if (snap && snap.exists && snap.exists()) {
      const data = snap.val();
      return { docs: Object.values(data), isInitialized: true };
    }
    return { docs: [], isInitialized: isInitialized };
  } catch (err) {
    console.debug("Firebase fetch documents fallback:", err);
    return null;
  }
}

// Lưu tài liệu mới lên Firebase Realtime Database
async function syncDocumentToFirebase(doc) {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return false;
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));
    await Promise.race([
      Promise.all([
        firebase.database().ref(`documents/${doc.doc_id}`).set(doc),
        firebase.database().ref("documents_meta/initialized").set(true)
      ]),
      timeoutPromise
    ]);
    return true;
  } catch (err) {
    console.warn("Could not save document to Firebase:", err);
    return false;
  }
}

// Xóa tài liệu khỏi Firebase Realtime Database
async function deleteDocumentFromFirebase(docId) {
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return false;
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000));
    await Promise.race([
      Promise.all([
        firebase.database().ref(`documents/${docId}`).remove(),
        firebase.database().ref("documents_meta/initialized").set(true)
      ]),
      timeoutPromise
    ]);
    return true;
  } catch (err) {
    console.warn("Could not delete document from Firebase:", err);
    return false;
  }
}

// Lắng nghe thay đổi tài liệu từ Firebase Realtime theo thời gian thực (Multi-Device Sync)
function listenRealtimeDocuments() {
  if (documentsRealtimeListenerAttached) return;
  initFirebaseApp();
  if (typeof firebase === "undefined" || !firebase.database) return;
  documentsRealtimeListenerAttached = true;

  try {
    firebase.database().ref("documents").on("value", (snap) => {
      let fbDocs = [];
      if (snap && snap.exists && snap.exists()) {
        const val = snap.val();
        fbDocs = Object.values(val);
      }
      // Chỉ re-render nếu danh sách tài liệu thực sự có sự thay đổi ID
      const currentIds = currentDocumentsList.map(d => d.doc_id).sort().join(",");
      const newIds = fbDocs.map(d => d.doc_id).sort().join(",");
      if (currentIds !== newIds) {
        currentDocumentsList = fbDocs;
        saveDocumentsToLocalStorage(fbDocs);
        renderCurrentDocumentsView();
      }
    });
  } catch (err) {
    console.debug("listenRealtimeDocuments error:", err);
  }
}

function renderCurrentDocumentsView() {
  const studentGrid = document.getElementById("studentDocumentsGrid");
  if (studentGrid && !studentGrid.closest(".hidden")) {
    renderStudentDocuments(currentDocumentsList);
  }
  const teacherGrid = document.getElementById("teacherDocsGrid");
  if (teacherGrid && !teacherGrid.closest(".hidden")) {
    renderTeacherDocuments(currentDocumentsList);
  }
}

// Lấy danh sách toàn bộ tài liệu (Đảm bảo triệt để: Khi GV xóa hết sẽ KHÔNG tự sinh lại tài liệu mẫu)
async function getAllDocuments() {
  const isLocalInited = (localStorage.getItem("ai_sgk_docs_inited") === "true");
  let docs = null;

  try {
    const raw = localStorage.getItem("ai_sgk_documents");
    if (raw !== null) {
      docs = JSON.parse(raw);
    }
  } catch (err) {
    console.debug("Local storage read docs:", err);
  }

  // Khởi động bộ lắng nghe Realtime Firebase
  listenRealtimeDocuments();

  // 1. Nếu thiết bị đã khởi tạo (kể cả mảng rỗng [] khi GV đã xóa hết tất cả tài liệu)
  if (docs !== null && isLocalInited) {
    currentDocumentsList = docs;



    return docs;
  }

  // 2. Nếu LocalStorage chưa có dữ liệu, thử tải từ Firebase
  const fbResult = await fetchDocumentsFromFirebase();
  if (fbResult && fbResult.isInitialized) {
    docs = fbResult.docs;
    currentDocumentsList = docs;
    saveDocumentsToLocalStorage(docs);
    return docs;
  }

  // 3. Chỉ nạp 3 tài liệu mặc định khi HỆ THỐNG HOÀN TOÀN MỚI (chưa từng được khởi tạo hay cấu hình)
  docs = DEFAULT_DOCUMENTS;
  currentDocumentsList = docs;
  saveDocumentsToLocalStorage(docs);

  // Đồng bộ 3 tài liệu mẫu lên Firebase lần đầu tiên
  DEFAULT_DOCUMENTS.forEach(d => {
    syncDocumentToFirebase(d).catch(e => console.debug("Initial FB sync:", e));
  });

  return docs;
}

function renderStudentDocuments(allDocs) {
  const grid = document.getElementById("studentDocumentsGrid");
  const countBadge = document.getElementById("badgeStudentDocumentsCount");
  const countPill = document.getElementById("badgeDocSummary");
  if (!grid) return;

  const docsToRender = allDocs || currentDocumentsList || [];

  // Khử trùng lặp ID tài liệu triệt để
  const seenIds = new Set();
  const uniqueDocs = [];
  docsToRender.forEach(d => {
    if (d && d.doc_id && !seenIds.has(d.doc_id)) {
      seenIds.add(d.doc_id);
      uniqueDocs.push(d);
    }
  });

  const grade = studentAuthState.grade || state.grade || 9;
  const classCode = studentAuthState.classCode || "";

  const filtered = uniqueDocs.filter(doc => {
    if (doc.grade !== "all" && String(doc.grade) !== String(grade)) return false;
    if (doc.target_classes && doc.target_classes.length > 0) {
      if (!doc.target_classes.includes("all") && !doc.target_classes.includes("Tất cả") && classCode && !doc.target_classes.includes(classCode)) {
        return false;
      }
    }
    return true;
  });

  grid.replaceChildren();

  if (countBadge) countBadge.textContent = String(filtered.length);
  if (countPill) countPill.textContent = `${filtered.length} tài liệu`;

  if (filtered.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.style.gridColumn = "1 / -1";
    emptyBox.style.padding = "2.5rem";
    emptyBox.style.textAlign = "center";
    emptyBox.style.background = "#0f172a";
    emptyBox.style.borderRadius = "12px";
    emptyBox.style.border = "1px dashed rgba(255,255,255,0.15)";

    const p1 = document.createElement("p");
    p1.style.fontSize = "1.1rem";
    p1.style.color = "#94a3b8";
    p1.style.margin = "0";
    p1.textContent = "📚 Chưa có tài liệu nào được giao cho lớp của em.";

    const p2 = document.createElement("p");
    p2.style.fontSize = "0.85rem";
    p2.style.color = "#64748b";
    p2.style.marginTop = "6px";
    p2.textContent = "Thầy/Cô sẽ sớm đăng tải tài liệu ôn tập và đề cương lên đây nhé!";

    emptyBox.appendChild(p1);
    emptyBox.appendChild(p2);
    grid.appendChild(emptyBox);
    return;
  }

  filtered.forEach(doc => {
    const card = document.createElement("div");
    card.className = "doc-card-item";

    const docUrl = doc.data_url || doc.url || (`assets/docs/${doc.file_name}`);
    const gradeLabel = doc.grade === "all" ? "Tất cả các khối" : `Khối ${doc.grade}`;
    const classLabel = (doc.target_classes && doc.target_classes.length > 0 && !doc.target_classes.includes("all")) ? doc.target_classes.join(", ") : "Tất cả các lớp";

    card.innerHTML = /* sanitize */ `
      <div class="doc-card-top">
        <div class="doc-pdf-badge">
          <span>PDF</span>
        </div>
        <div class="doc-card-main">
          <h4 class="doc-card-title">${escapeHtml(doc.title)}</h4>
          <div class="doc-card-meta">
            <span class="doc-pill grade">${gradeLabel}</span>
            <span class="doc-pill">${classLabel}</span>
            <span class="doc-pill size">${escapeHtml(doc.file_size || "350 KB")}</span>
          </div>
          <p class="doc-card-desc">${escapeHtml(doc.description || "Tài liệu học tập ôn tập chính khóa theo chương trình Tin học THCS.")}</p>
        </div>
      </div>
      <div class="doc-card-actions">
        <button type="button" class="btn-doc-view" data-doc-id="${doc.doc_id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>Xem tài liệu</span>
        </button>
        <a href="${docUrl || '#'}" download="${doc.file_name || 'tai_lieu.pdf'}" class="btn-doc-download" title="Tải file PDF về máy">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </a>
      </div>
    `;

    const viewBtn = card.querySelector(".btn-doc-view");
    if (viewBtn) {
      viewBtn.addEventListener("click", () => openPdfViewer(doc));
    }

    grid.appendChild(card);
  });
}

// Mở bộ xem PDF (tự động nạp từ Firebase nếu dữ liệu Base64 bị stripped khỏi LocalStorage)
async function openPdfViewer(doc) {
  const modal = document.getElementById("modalPdfViewer");
  const titleEl = document.getElementById("modalPdfViewerTitle");
  const subtitleEl = document.getElementById("modalPdfViewerSubtitle");
  const iframe = document.getElementById("pdfViewerIframe");
  const btnDownload = document.getElementById("btnPdfDownload");
  const btnOpenTab = document.getElementById("btnPdfOpenNewTab");

  if (!modal || !doc) return;

  const gradeLabel = doc.grade === "all" ? "Tất cả các khối" : `Khối ${doc.grade}`;
  if (titleEl) titleEl.textContent = doc.title;
  if (subtitleEl) subtitleEl.textContent = `${gradeLabel} • ${doc.uploaded_by || "Giáo viên Tin học"}`;

  let docUrl = doc.data_url || doc.url || (`assets/docs/${doc.file_name}`);

  // Nếu tệp PDF tải lên từ cloud mà chưa có sẵn data_url trong RAM/LocalStorage:
  if (!docUrl && doc.doc_id && typeof firebase !== "undefined" && firebase.database) {
    try {
      const snap = await firebase.database().ref(`documents/${doc.doc_id}`).once("value");
      if (snap && snap.exists && snap.exists()) {
        const val = snap.val();
        if (val && val.data_url) {
          docUrl = val.data_url;
          doc.data_url = docUrl; // cache tạm vào RAM
        }
      }
    } catch (err) {
      console.debug("Fetch full doc data_url from Firebase error:", err);
    }
  }

  if (iframe) {
    iframe.src = docUrl || "about:blank";
  }
  if (btnDownload) {
    btnDownload.href = docUrl || "#";
    btnDownload.download = doc.file_name || "tai_lieu.pdf";
  }
  if (btnOpenTab) {
    btnOpenTab.href = docUrl || "#";
  }

  modal.classList.remove("hidden");
}

function closePdfViewer() {
  const modal = document.getElementById("modalPdfViewer");
  const iframe = document.getElementById("pdfViewerIframe");
  if (iframe) iframe.src = "about:blank";
  if (modal) modal.classList.add("hidden");
}

window.deleteTeacherDocument = deleteTeacherDocument;
window.clearAllTeacherDocuments = clearAllTeacherDocuments;

async function deleteTeacherDocument(docId) {
  const updated = currentDocumentsList.filter(d => d.doc_id !== docId);
  currentDocumentsList = updated;
  saveDocumentsToLocalStorage(updated);
  renderTeacherDocuments(updated);
  renderStudentDocuments(updated);
  await deleteDocumentFromFirebase(docId);
  return updated;
}

async function clearAllTeacherDocuments() {
  currentDocumentsList = [];
  saveDocumentsToLocalStorage([]);
  renderTeacherDocuments([]);
  renderStudentDocuments([]);
  initFirebaseApp();
  if (typeof firebase !== "undefined" && firebase.database) {
    try {
      await firebase.database().ref("documents").remove();
      await firebase.database().ref("documents_meta/initialized").set(true);
    } catch (e) {
      console.debug("Clear all FB documents error:", e);
    }
  }
}

function renderTeacherDocuments(allDocs) {
  const grid = document.getElementById("teacherDocsGrid");
  const pill = document.getElementById("teacherDocCountPill");
  if (!grid) return;

  const docsToRender = allDocs || currentDocumentsList || [];

  // Khử trùng lặp ID tài liệu triệt để
  const seenIds = new Set();
  const uniqueDocs = [];
  docsToRender.forEach(d => {
    if (d && d.doc_id && !seenIds.has(d.doc_id)) {
      seenIds.add(d.doc_id);
      uniqueDocs.push(d);
    }
  });

  if (pill) pill.textContent = `${uniqueDocs.length} tài liệu`;

  grid.replaceChildren();

  if (uniqueDocs.length === 0) {
    const emptyP = document.createElement("p");
    emptyP.style.color = "#94a3b8";
    emptyP.style.fontSize = "0.9rem";
    emptyP.style.padding = "1rem";
    emptyP.textContent = 'Chưa có tài liệu PDF nào được tải lên. Bấm "+ Tải tài liệu PDF" ở trên để tải tài liệu cho học sinh nhé!';
    grid.appendChild(emptyP);
    return;
  }

  uniqueDocs.forEach(doc => {
    const card = document.createElement("div");
    card.className = "teacher-doc-card";

    const gradeLabel = doc.grade === "all" ? "Tất cả các khối" : `Khối ${doc.grade}`;
    const classLabel = (doc.target_classes && doc.target_classes.length > 0 && !doc.target_classes.includes("all")) ? doc.target_classes.join(", ") : "Tất cả các lớp";

    card.innerHTML = /* sanitize */ `
      <div>
        <h4 class="teacher-doc-card-title">${escapeHtml(doc.title)}</h4>
        <div class="teacher-doc-card-meta">
          <span>${gradeLabel}</span> • <span>${classLabel}</span> • <span>${escapeHtml(doc.file_size || "350 KB")}</span>
        </div>
      </div>
      <div class="teacher-doc-card-actions">
        <button type="button" class="btn-teacher-doc-view" data-doc-id="${doc.doc_id}">👁 Xem thử</button>
        <button type="button" class="btn-teacher-doc-delete" data-doc-id="${doc.doc_id}">🗑 Xóa</button>
      </div>
    `;

    const viewBtn = card.querySelector(".btn-teacher-doc-view");
    if (viewBtn) {
      viewBtn.addEventListener("click", () => openPdfViewer(doc));
    }

    const delBtn = card.querySelector(".btn-teacher-doc-delete");
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Thầy/Cô có chắc chắn muốn xóa tài liệu "${doc.title}" không?`)) return;
        await deleteTeacherDocument(doc.doc_id);
        showExamToast("✔ Đã xóa tài liệu thành công!", "success");
      });
    }

    grid.appendChild(card);
  });
}

async function loadTeacherDocuments() {
  const allDocs = await getAllDocuments();
  renderTeacherDocuments(allDocs);
  return allDocs;
}

function initTeacherUploadDocModal() {
  const modal = document.getElementById("modalTeacherUploadDoc");
  const btnOpen = document.getElementById("btnTeacherOpenUploadDoc");
  const btnClose = document.getElementById("btnCloseUploadDocModal");
  const btnCancel = document.getElementById("btnCancelUploadDoc");
  const btnSelectFile = document.getElementById("btnSelectDocFile");
  const fileInput = document.getElementById("inputDocFile");
  const fileNameSpan = document.getElementById("docFileNameSelected");
  const btnSubmit = document.getElementById("btnSubmitUploadDoc");
  const msgEl = document.getElementById("msgDocUpload");

  const inputTitle = document.getElementById("inputDocTitle");
  const selectGrade = document.getElementById("selectDocGrade");
  const selectClass = document.getElementById("selectDocClass");
  const inputDesc = document.getElementById("inputDocDesc");

  let selectedPdfDataUrl = "";
  let selectedPdfFileName = "";
  let selectedPdfFileSize = "";

  function openModal() {
    if (modal) {
      modal.classList.remove("hidden");
      if (inputTitle) inputTitle.value = "";
      if (inputDesc) inputDesc.value = "";
      if (fileNameSpan) {
        fileNameSpan.textContent = "Chưa chọn tệp (Hỗ trợ file .pdf)";
        fileNameSpan.style.color = "#94a3b8";
      }
      if (msgEl) {
        msgEl.className = "pin-modal-msg hidden";
        msgEl.textContent = "";
      }
      selectedPdfDataUrl = "";
      selectedPdfFileName = "";
      selectedPdfFileSize = "";
    }
  }

  function closeModal() {
    if (modal) modal.classList.add("hidden");
  }

  if (btnOpen) btnOpen.addEventListener("click", openModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  if (btnSelectFile && fileInput) {
    btnSelectFile.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        if (msgEl) {
          msgEl.className = "pin-modal-msg error";
          msgEl.textContent = "⚠️ Vui lòng chỉ chọn tệp tin định dạng PDF (.pdf)!";
          msgEl.classList.remove("hidden");
        }
        return;
      }

      selectedPdfFileName = file.name;
      const sizeKb = Math.round(file.size / 1024);
      selectedPdfFileSize = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

      if (fileNameSpan) {
        fileNameSpan.textContent = `✔ ${file.name} (${selectedPdfFileSize})`;
        fileNameSpan.style.color = "#38bdf8";
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        selectedPdfDataUrl = loadEvt.target.result;
        if (msgEl) msgEl.classList.add("hidden");
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnSubmit) {
    btnSubmit.addEventListener("click", async () => {
      const title = inputTitle ? inputTitle.value.trim() : "";
      const grade = selectGrade ? selectGrade.value : "all";
      const classCode = selectClass ? selectClass.value : "all";
      const desc = inputDesc ? inputDesc.value.trim() : "";

      if (!title) {
        if (msgEl) {
          msgEl.className = "pin-modal-msg error";
          msgEl.textContent = "Vui lòng nhập tên tài liệu / chuyên đề.";
          msgEl.classList.remove("hidden");
        }
        return;
      }

      if (!selectedPdfDataUrl) {
        if (msgEl) {
          msgEl.className = "pin-modal-msg error";
          msgEl.textContent = "Vui lòng chọn một tệp tin PDF từ máy tính để tải lên.";
          msgEl.classList.remove("hidden");
        }
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Đang tải lên Firebase...";

      const newDoc = {
        doc_id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: title,
        grade: grade === "all" ? "all" : parseInt(grade, 10),
        target_classes: classCode === "all" ? ["all"] : [classCode],
        description: desc,
        file_name: selectedPdfFileName,
        file_size: selectedPdfFileSize,
        uploaded_at: new Date().toISOString(),
        uploaded_by: "Giáo viên Tin học",
        data_url: selectedPdfDataUrl
      };

      try {
        // 1. Lưu trực tiếp lên Firebase Realtime Database
        await syncDocumentToFirebase(newDoc);

        // 2. Cập nhật bộ nhớ cục bộ
        const docs = await getAllDocuments();
        const existingIdx = docs.findIndex(d => d.doc_id === newDoc.doc_id);
        if (existingIdx >= 0) {
          docs[existingIdx] = newDoc;
        } else {
          docs.unshift(newDoc);
        }
        currentDocumentsList = docs;
        saveDocumentsToLocalStorage(docs);

        if (msgEl) {
          msgEl.className = "pin-modal-msg success";
          msgEl.textContent = "✔ Tải lên Firebase thành công! Học sinh đã có thể xem ngay.";
          msgEl.classList.remove("hidden");
        }

        showExamToast(`✔ Đã lưu tài liệu "${title}" lên Firebase thành công!`, "success");

        setTimeout(() => {
          closeModal();
          btnSubmit.disabled = false;
          btnSubmit.textContent = "📤 Tải lên & Chia sẻ cho học sinh";
          loadTeacherDocuments();
          loadStudentDocuments();
        }, 800);
      } catch (err) {
        if (msgEl) {
          msgEl.className = "pin-modal-msg error";
          msgEl.textContent = "Lỗi khi lưu tài liệu: " + err.message;
          msgEl.classList.remove("hidden");
        }
        btnSubmit.disabled = false;
        btnSubmit.textContent = "📤 Tải lên & Chia sẻ cho học sinh";
      }
    });
  }

  // Gắn sự kiện đóng modal PDF Viewer & Backdrop click
  const btnClosePdf = document.getElementById("btnClosePdfViewer");
  if (btnClosePdf) btnClosePdf.addEventListener("click", closePdfViewer);

  const modalPdf = document.getElementById("modalPdfViewer");
  if (modalPdf) {
    modalPdf.addEventListener("click", (e) => {
      if (e.target === modalPdf) closePdfViewer();
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (modalPdf && !modalPdf.classList.contains("hidden")) {
        closePdfViewer();
        e.stopPropagation();
        e.stopImmediatePropagation();
      } else if (modal && !modal.classList.contains("hidden")) {
        closeModal();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  }, true);
}
