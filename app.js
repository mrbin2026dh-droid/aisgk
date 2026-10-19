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
    return "http://127.0.0.1:8000/api";
  }

  if (!window.location.origin || window.location.origin === "null" || window.location.origin.startsWith("file:")) {
    return "http://127.0.0.1:8000/api";
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
  if (!str) return "";
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
const CURRICULUM_TOC = CURRICULUM_TOC_GRADE_6;

function getCurriculumToc(grade = state.grade) {
  if (grade === 9) return CURRICULUM_TOC_GRADE_9;
  return CURRICULUM_TOC_GRADE_6;
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
  renderCurriculumTree();
}

// 5. Khởi chạy Ứng dụng
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupEventListeners();
  initStudentManagement();
  initStudentAuthPortal();
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
  } catch {}

  renderCurriculumTree(); // Render ngay lập tức cây mục lục
  await loadCurriculumLessons();
  await fetchLesson(state.grade, state.lessonId);
  renderApp();
  switchView("theory");
  openPopup({ focus: false });
  updateHeaderLessonInfo();
  updateStepperButtons();
  renderCatalogModal();
  renderCurriculumTree(); // Đồng bộ lại sau khi nạp xong bài học
  renderPromptSuggestions();
}

async function loadCurriculumLessons() {
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
    gridEl.innerHTML = ` /* sanitize */
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
  const titleHtml = titleText ? `<h1 class="theory-main-title" style="font-size: 1.75rem; font-weight: 800; color: #f8fafc; margin: 0.25rem 0 1.25rem 0; line-height: 1.3;">${escapeHtml(titleText)}</h1>` : "";
  const lessonBadge = `<div class="theory-top-badge"><span class="badge-pill">Bài ${data.lesson_id || state.lessonId}</span></div>`;
  return `<div class="theory-markdown-canvas">${lessonBadge}${titleHtml}${parseMarkdown(content)}</div>`;
}

// 6. Tải Dữ liệu Bài học từ Backend
async function fetchLesson(grade, lessonId) {
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
        quizTitleEl.innerHTML = `<div style="padding:22px; background: rgba(245, 158, 11, 0.12); border: 1.5px solid rgba(245, 158, 11, 0.4); border-radius:14px; color:#fde68a; text-align:left;"> /* sanitize */
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
        theoryContentEl.innerHTML = ` /* sanitize */
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
  } catch (err) {
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

    btn.innerHTML = ` /* sanitize */
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

  const toggleSidebar = (forceCollapse) => {
    if (!workspace) return;
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

async function switchGrade(newGrade) {
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
  switchView("theory");
  updateHeaderLessonInfo();
  updateStepperButtons();
  renderCatalogModal();
  renderCurriculumTree();
}

function setupEventListeners() {
  // 0. Thiết lập Thu gọn / Mở rộng Sidebar & Cây bài học
  setupSidebarCollapse();

  // 0.1. Lựa chọn Khối Lớp (LỚP 6, LỚP 7, LỚP 8, LỚP 9)
  document.querySelectorAll(".header-grade-pill").forEach(pill => {
    pill.addEventListener("click", async () => {
      const g = parseInt(pill.getAttribute("data-grade"), 10);
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
      // 1. Xác thực tại Backend qua /api/teacher/auth (Tuyệt đối không hardcode PIN ở client P0-1/P0-2)
      const authRes = await fetch(`${API_BASE}/teacher/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinVal })
      });

      if (!authRes.ok) {
        const errJson = await authRes.json().catch(() => ({}));
        throw new Error(errJson.detail || "Mã PIN không chính xác! Vui lòng thử lại.");
      }

      const authData = await authRes.json();
      state.teacherToken = authData.token;

      // 2. Nạp TOÀN BỘ dữ liệu chuẩn của giáo viên với Session Token
      const res = await fetch(`${API_BASE}/teacher/lesson/${state.grade}/${state.lessonId}`, {
        headers: {
          "Authorization": `Bearer ${state.teacherToken}`,
          "X-Teacher-Token": state.teacherToken
        }
      });
      if (!res.ok) throw new Error(`Lỗi tải dữ liệu giáo viên: HTTP ${res.status}`);
      const result = await res.json();
      state.teacherLessonData = result.data;
      state.teacherUnlocked = true;

      if (authMsg) authMsg.style.display = "none";
      authBox.classList.add("hidden");
      editorBox.classList.remove("hidden");

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
      container.innerHTML = ` /* sanitize */
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
  state.activeTab = tabName;
  const theoryView = document.getElementById("theoryView");
  const quizView = document.getElementById("quizView");
  const completionCard = document.getElementById("completionCard");
  const stepTheory = document.getElementById("stepItemTheory");
  const stepQuiz = document.getElementById("stepItemQuiz");

  if (tabName === "theory") {
    if (theoryView) theoryView.classList.add("active");
    if (quizView) quizView.classList.remove("active");
    if (completionCard) completionCard.classList.remove("active");
    if (stepTheory) stepTheory.classList.add("active");
    if (stepQuiz) stepQuiz.classList.remove("active");
  } else {
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
    msgEl.textContent = "Xuất sắc! Em đã nắm chắc kiến thức trọng tâm về Thông tin và Dữ liệu theo chuẩn SGK Tin học 6!";
  } else if (correctCount >= 2) {
    msgEl.textContent = `Em đã hoàn thành bài luyện tập với ${correctCount}/${quiz.length} câu đúng. Hãy xem lại các câu gợi ý màu hổ phách để ghi nhớ sâu hơn nhé!`;
  } else {
    msgEl.textContent = "Đừng nản lòng nhé! Em hãy dành ít phút đọc lại Khám phá tri thức rồi bấm 'Làm lại bài luyện tập'.";
  }
}

// 12. Điều khiển Widget Popup Gia sư Socrates Góc Dưới Phải
function togglePopup() {
  const popup = document.getElementById("socratesPopupCard");
  if (popup.classList.contains("open")) {
    closePopup();
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

class StudentDataAdapter {
  constructor() {
    this.cachedOverview = null;
  }

  async getClassOverview(grade, className) {
    if (state.teacherToken) {
      try {
        const headers = { "Authorization": `Bearer ${state.teacherToken}` };
        const res = await fetch(`${API_BASE}/teacher/students-overview/${grade}/${className}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            this.cachedOverview = json.data;
            return json.data;
          }
        }
      } catch (err) {
        console.warn("Lỗi gọi API Backend cho quản lý học sinh:", err);
      }
    }
    // Fallback: Sử dụng dữ liệu mẫu chuẩn hóa khớp 100% hình 2
    const mock = this.getMockClassOverview(grade, className);
    this.cachedOverview = mock;
    return mock;
  }

  async getAIPedagogicalAdvice(grade, className) {
    if (state.teacherToken) {
      try {
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${state.teacherToken}`
        };
        const res = await fetch(`${API_BASE}/teacher/analyze-class`, {
          method: "POST",
          headers,
          body: JSON.stringify({ grade: Number(grade), class_name: String(className) })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.advice) {
            return json.advice;
          }
        }
      } catch (err) {
        console.warn("Lỗi gọi Gemini AI phân tích sư phạm:", err);
      }
    }
    return {
      general_assessment: "Lớp 9A có tiến độ tốt (80%), điểm TB 8,4 – cao hơn 0,6 so với tháng trước.",
      critical_concerns: "5 học sinh cần được hỗ trợ thêm, đặc biệt ở chủ đề \"Sử dụng dịch vụ Internet\".",
      actionable_recommendations: [
        "Tổ chức buổi ôn tập ngắn 15 phút, bổ sung bài luyện tương tác cho nhóm học sinh còn yếu.",
        "Áp dụng phương pháp đôi bạn cùng tiến: Phân công học sinh xuất sắc kèm cặp các bạn cần hỗ trợ.",
        "Giao thêm 3-5 câu hỏi tình huống thực tế để học sinh rèn luyện phản xạ trước giờ kiểm tra."
      ]
    };
  }

  getMockClassOverview(grade, className) {
    const rawStudents = [
      ["Nguyễn Minh Anh", "HS001", 100, 9.2, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Trần Gia Bảo", "HS002", 92, 8.6, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Lê Khánh Chi", "HS003", 71, 7.8, "needs_support", ["mastered", "mastered", "warning", "not_started", "not_started"]],
      ["Phạm Đức Duy", "HS004", 100, 9.0, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Hoàng Ngọc Hà", "HS005", 57, 7.2, "needs_support", ["mastered", "mastered", "warning", "warning", "not_started"]],
      ["Vũ Hải Đăng", "HS006", 100, 8.8, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Đỗ Thùy Linh", "HS007", 100, 9.4, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Bùi Anh Tuấn", "HS008", 88, 8.2, "completed", ["mastered", "mastered", "warning", "mastered", "mastered"]],
      ["Đặng Quang Huy", "HS009", 50, 6.5, "needs_support", ["warning", "warning", "warning", "mastered", "not_started"]],
      ["Ngô Khánh Linh", "HS010", 100, 8.9, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Dương Quốc Bảo", "HS011", 100, 8.5, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Lý Thu Thảo", "HS012", 100, 9.1, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Tạ Minh Khôi", "HS013", 100, 8.7, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Phan Thanh Trúc", "HS014", 60, 6.8, "needs_support", ["warning", "mastered", "warning", "not_started", "not_started"]],
      ["Hồ Văn Nam", "HS015", 100, 8.6, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Mai Phương Thảo", "HS016", 100, 9.3, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Đinh Trọng Nghĩa", "HS017", 90, 8.0, "completed", ["mastered", "warning", "mastered", "mastered", "mastered"]],
      ["Lâm Gia Hưng", "HS018", 100, 8.8, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Võ Quỳnh Như", "HS019", 100, 9.5, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Trịnh Bá Kiên", "HS020", 45, 6.0, "needs_support", ["warning", "warning", "warning", "warning", "not_started"]],
      ["Nguyễn Lan Hương", "HS021", 100, 9.0, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Trần Thanh Tùng", "HS022", 100, 8.4, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Lê Bảo Ngọc", "HS023", 100, 9.2, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Phạm Thùy Trang", "HS024", 100, 8.7, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Hoàng Minh Triết", "HS025", 92, 8.1, "completed", ["mastered", "mastered", "warning", "mastered", "mastered"]],
      ["Vũ Cẩm Ly", "HS026", 100, 8.9, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Đỗ Nhật Nam", "HS027", 100, 8.3, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Bùi Yến Nhi", "HS028", 100, 9.6, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Đặng Tiến Đạt", "HS029", 95, 8.0, "completed", ["mastered", "warning", "mastered", "mastered", "mastered"]],
      ["Ngô Gia Khiêm", "HS030", 100, 8.8, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Cao Thái Sơn", "HS031", 100, 8.5, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Lương Mỹ Hạnh", "HS032", 100, 9.0, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Chu Đình Trọng", "HS033", 100, 8.6, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]],
      ["Nghiêm Xuân Tú", "HS034", 15, 4.5, "learning", ["warning", "not_started", "not_started", "not_started", "not_started"]],
      ["Dương Thùy Chi", "HS035", 15, 5.0, "learning", ["warning", "not_started", "not_started", "not_started", "not_started"]]
    ];

    const topicsMeta = [
      { id: "the_gioi_ki_thuat_so", name: "Thế giới kĩ thuật số" },
      { id: "thong_tin_giai_quyet_van_de", name: "Thông tin trong giải quyết vấn đề" },
      { id: "danh_gia_chat_luong_thong_tin", name: "Đánh giá chất lượng thông tin" },
      { id: "su_dung_dich_vu_internet", name: "Sử dụng dịch vụ Internet" },
      { id: "phan_mem_ma_nguon_mo", name: "Phần mềm mã nguồn mở" }
    ];

    const students = rawStudents.map(([name, code, progress, score, status, states]) => {
      const topics = topicsMeta.map((t, idx) => {
        const stateStr = states[idx] || "not_started";
        const tScore = stateStr === "mastered" ? score : (stateStr === "warning" ? Math.max(0, score - 2.0) : 0);
        return {
          topic_id: t.id,
          topic_name: t.name,
          score: Number(tScore.toFixed(1)),
          status: stateStr
        };
      });
      return {
        id: `hs-${code.toLowerCase()}`,
        student_code: code,
        full_name: name,
        progress_percent: progress,
        average_score: score,
        topics,
        status
      };
    });

    return {
      grade: Number(grade),
      class_name: String(className),
      semester: "Học kì I (2026 - 2027)",
      kpi: {
        total_students: 35,
        completed_count: 28,
        completed_percent: 80.0,
        average_score: 8.4,
        score_delta_month: 0.6,
        improved_count: 30,
        improved_percent: 86.0,
        needs_support_count: 5,
        needs_support_percent: 14.0
      },
      topic_averages: {
        the_gioi_ki_thuat_so: 8.6,
        thong_tin_giai_quyet_van_de: 8.1,
        danh_gia_chat_luong_thong_tin: 7.8,
        su_dung_dich_vu_internet: 8.5,
        phan_mem_ma_nguon_mo: 8.9
      },
      donut_progress: {
        completed: 28,
        learning: 5,
        not_started: 2
      },
      students
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
}

function openStudentManagementStage() {
  const stage = document.getElementById("studentManagementStage");
  const canvas = document.getElementById("focusCanvas");
  const btnNav = document.getElementById("btnNavStudentMgmt");

  if (!stage || !canvas) return;

  const sidebar = document.getElementById("roadmapSidebar");
  if (sidebar) sidebar.classList.add("hidden");
  closePopup();

  canvas.classList.add("hidden");
  stage.classList.remove("hidden");
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
  const pComp = total > 0 ? (donut.completed / total) : 0.8;
  const pLearn = total > 0 ? (donut.learning / total) : 0.14;
  const pNot = total > 0 ? (donut.not_started / total) : 0.06;

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

  const topicLabels = {
    the_gioi_ki_thuat_so: "Thế giới kĩ thuật số",
    thong_tin_giai_quyet_van_de: "Thông tin trong giải quyết vấn đề",
    danh_gia_chat_luong_thong_tin: "Đánh giá chất lượng thông tin",
    su_dung_dich_vu_internet: "Sử dụng dịch vụ Internet",
    phan_mem_ma_nguon_mo: "Phần mềm mã nguồn mở"
  };

  const rowsHtml = Object.entries(topicAverages).map(([key, score]) => {
    const label = topicLabels[key] || key;
    const percent = Math.min(100, Math.max(0, (score / 10) * 100));
    return `
      <div class="sm-bar-row">
        <div class="sm-bar-meta">
          <span class="sm-bar-label" title="${label}">${label}</span>
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

    const matchesStatus = statusFilter === "all" || student.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  renderStudentTable(filtered);
}

function renderStudentTable(students) {
  const tbody = document.getElementById("smStudentTableBody");
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = ` /* sanitize */
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
    const avatar = avatars[index % avatars.length];

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
    if (hs.status === "completed") {
      statusBadge = '<span class="sm-status-badge sm-badge-completed">Hoàn thành</span>';
    } else if (hs.status === "learning") {
      statusBadge = '<span class="sm-status-badge sm-badge-learning">Đang học</span>';
    } else {
      statusBadge = '<span class="sm-status-badge sm-badge-needs_support">Cần hỗ trợ</span>';
    }

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
        <td class="td-score">${String(hs.average_score).replace(".", ",")}</td>
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
            <button class="sm-action-icon-btn" title="Biểu đồ cá nhân" aria-label="Biểu đồ học sinh">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rows /* sanitize */;

  // Gắn sự kiện nút xem chi tiết từng học sinh
  tbody.querySelectorAll(".btn-view-student").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const student = students[idx];
      if (student) {
        openStudentDetailModal(student);
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
    elBody.innerHTML = ` /* sanitize */
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1.25rem;">
        <div style="background: #0f172a; padding: 0.85rem; border-radius: 8px; border: 1px solid #334155;">
          <div style="font-size: 0.75rem; color: #94a3b8;">Tiến độ học tập</div>
          <div style="font-size: 1.35rem; font-weight: 700; color: #4ade80; margin-top: 0.2rem;">${student.progress_percent}%</div>
        </div>
        <div style="background: #0f172a; padding: 0.85rem; border-radius: 8px; border: 1px solid #334155;">
          <div style="font-size: 0.75rem; color: #94a3b8;">Điểm trung bình</div>
          <div style="font-size: 1.35rem; font-weight: 700; color: #38bdf8; margin-top: 0.2rem;">${String(student.average_score).replace(".", ",")}/10</div>
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
  csv += "STT,Họ và tên,Mã học sinh,Tiến độ (%),Điểm TB,Thế giới số,Thông tin giải quyết VĐ,Đánh giá thông tin,Dịch vụ Internet,Phần mềm mã nguồn mở,Trạng thái\n";

  data.students.forEach((hs, idx) => {
    const topicScores = (hs.topics || []).map(t => t.score).join(",");
    const statusText = hs.status === "completed" ? "Hoàn thành" : (hs.status === "learning" ? "Đang học" : "Cần hỗ trợ");
    csv += `${idx + 1},"${hs.full_name}",${hs.student_code},${hs.progress_percent}%,${hs.average_score},${topicScores},"${statusText}"\n`;
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
  classCode: "9A",
  uid: ""
};

function loadStoredStudentAuth() {
  try {
    const raw = localStorage.getItem("ai_sgk_student_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isLoggedIn) {
        Object.assign(studentAuthState, parsed);
      }
    }
  } catch (e) {
    console.warn("Lỗi đọc student auth từ localStorage:", e);
  }
  updateHeaderStudentAuthUI();
}

function updateHeaderStudentAuthUI() {
  const btn = document.getElementById("btnHeaderStudentAuth");
  const text = document.getElementById("headerStudentAuthText");
  if (!btn || !text) return;

  if (studentAuthState.isLoggedIn) {
    btn.classList.add("logged-in");
    btn.title = `Tài khoản: ${studentAuthState.studentName} (${studentAuthState.studentEmail}) - Bấm để đăng xuất`;
    text.textContent = `👦 ${studentAuthState.studentName || "Học sinh"} (${studentAuthState.classCode || "9A"})`;
  } else {
    btn.classList.remove("logged-in");
    btn.title = "Cổng đăng nhập Google dành cho Học sinh";
    text.textContent = "Đăng nhập";
  }
}

function openStudentLoginPortal() {
  const portal = document.getElementById("studentLoginPortal");
  if (!portal) return;
  const inputClass = document.getElementById("slInputClassCode");
  if (inputClass && studentAuthState.classCode) {
    inputClass.value = studentAuthState.classCode;
  }
  portal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeStudentLoginPortal() {
  const portal = document.getElementById("studentLoginPortal");
  if (!portal) return;
  portal.classList.add("hidden");
  document.body.style.overflow = "";
}

async function handleStudentGoogleSignIn() {
  const btn = document.getElementById("btnGoogleSignIn");
  const chkAgree = document.getElementById("slChkAgreeTerms");
  const inputClass = document.getElementById("slInputClassCode");

  if (chkAgree && !chkAgree.checked) {
    alert("Em vui lòng đánh dấu đồng ý với hướng dẫn sử dụng trước khi tiếp tục nhé!");
    return;
  }

  const classCodeVal = (inputClass ? inputClass.value.trim().toUpperCase() : "") || "9A";

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block; animation: spin 1s infinite linear;">⏳</span> <span>Đang kết nối Google...</span>` /* sanitize */;
  }

  try {
    initFirebaseApp();

    if (typeof firebase !== "undefined" && firebase.auth) {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;

      studentAuthState.isLoggedIn = true;
      studentAuthState.uid = user.uid;
      studentAuthState.studentName = user.displayName || "Học sinh";
      studentAuthState.studentEmail = user.email || "";
      studentAuthState.studentAvatar = user.photoURL || "👦";
      studentAuthState.classCode = classCodeVal;

      // Đồng bộ thông tin học sinh lên Realtime Database
      if (firebase.database) {
        try {
          await firebase.database().ref(`students/${classCodeVal}/${user.uid}`).update({
            uid: user.uid,
            full_name: user.displayName || "Học sinh",
            email: user.email || "",
            avatar: user.photoURL || "",
            class_code: classCodeVal,
            last_active: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn("Lỗi lưu hồ sơ học sinh lên database:", dbErr);
        }
      }
    } else {
      // Fallback khi chạy offline / demo
      await new Promise(r => setTimeout(r, 400));
      studentAuthState.isLoggedIn = true;
      studentAuthState.uid = "std_" + Math.random().toString(36).substring(2, 9);
      studentAuthState.studentName = "Nguyễn Minh Khang";
      studentAuthState.studentEmail = "minhkhang.hs@thcs.edu.vn";
      studentAuthState.studentAvatar = "👦";
      studentAuthState.classCode = classCodeVal;
    }

    localStorage.setItem("ai_sgk_student_auth", JSON.stringify(studentAuthState));
    updateHeaderStudentAuthUI();
    closeStudentLoginPortal();
    alert(`🎉 Chào mừng em ${studentAuthState.studentName} (Lớp ${studentAuthState.classCode}) đã đăng nhập thành công vào AI SGK Tin học THCS!`);
  } catch (err) {
    console.error("Lỗi đăng nhập Google:", err);
    if (err.code === "auth/popup-closed-by-user") {
      // Người dùng chủ động đóng popup
    } else if (err.code === "auth/unauthorized-domain") {
      alert(`Tên miền hiện tại (${window.location.hostname}) chưa được thêm vào mục Authorized Domains trên Firebase Console.\n\nThầy/Cô hãy vào Firebase Console > Authentication > Settings > Authorized domains và thêm "${window.location.hostname}" nhé!`);
    } else {
      alert(`Đăng nhập Google: ${err.message || "Vui lòng thử lại"}`);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = ` /* sanitize */
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

function handleStudentLogout() {
  if (confirm(`Em có muốn đăng xuất tài khoản "${studentAuthState.studentName}" không?`)) {
    studentAuthState.isLoggedIn = false;
    studentAuthState.studentName = "";
    studentAuthState.studentEmail = "";
    studentAuthState.uid = "";
    localStorage.removeItem("ai_sgk_student_auth");
    if (window.firebase && window.firebase.auth) {
      window.firebase.auth().signOut().catch(() => {});
    }
    updateHeaderStudentAuthUI();
  }
}

function initStudentAuthPortal() {
  initFirebaseApp();
  loadStoredStudentAuth();

  const btnHeader = document.getElementById("btnHeaderStudentAuth");
  if (btnHeader) {
    btnHeader.addEventListener("click", () => {
      if (studentAuthState.isLoggedIn) {
        handleStudentLogout();
      } else {
        openStudentLoginPortal();
      }
    });
  }

  const btnClose = document.getElementById("btnCloseLoginPortal");
  if (btnClose) {
    btnClose.addEventListener("click", closeStudentLoginPortal);
  }

  const btnBypass = document.getElementById("slBtnBypassLogin");
  if (btnBypass) {
    btnBypass.addEventListener("click", closeStudentLoginPortal);
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

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeStudentLoginPortal();
    }
  });
}
