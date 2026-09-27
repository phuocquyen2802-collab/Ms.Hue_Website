import { useState } from 'react';
import api from '../services/api';

// Panel "Đáp án chi tiết" hiển thị cho học sinh SAU KHI đã nộp bài 1 đề có
// giáo viên đính kèm file đáp án chi tiết (PDF/ảnh) - cho phép xem trực tiếp
// trên web hoặc tải về máy (link tải là link công khai không cần đăng nhập,
// xem examController.downloadAnswerKey).
//
// `compact`: true khi cần nhét vừa CHUNG 1 hàng với các nút khác (VD "Làm
// lại"/"Lịch sử" ở StudentDashboard) - chỉ còn 2 nút nhỏ, bỏ nhãn "📄 Đáp án
// chi tiết" và khung viền bao quanh; phần xem trước (nếu bấm "Xem") vẫn hiện
// full-width bên dưới như bình thường.
export default function AnswerKeyPanel({ examId, answerKeyFile, compact = false }) {
  const [viewing, setViewing] = useState(false);

  if (!answerKeyFile) return null;

  const downloadUrl = `${api.defaults.baseURL}/exams/${examId}/answer-key/download`;
  const viewUrl = `${downloadUrl}?inline=1`;
  const isImage = (answerKeyFile.mimeType || '').startsWith('image/');
  // File Word đã được máy chủ tự chuyển sẵn 1 bản PDF để xem trước
  // (`previewPdfFilename`) - trình duyệt hiển thị PDF trực tiếp được, nên
  // coi như "xem được qua iframe" giống file PDF gốc.
  const isPdf = (answerKeyFile.mimeType || '').includes('pdf') || Boolean(answerKeyFile.previewPdfFilename);

  const preview = viewing && (
    <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1', background: '#fff', ...(compact ? { flexBasis: '100%', width: '100%' } : {}) }}>
      {isImage ? (
        <img src={viewUrl} alt="Đáp án chi tiết" style={{ width: '100%', display: 'block' }} />
      ) : isPdf ? (
        <iframe title="Đáp án chi tiết" src={viewUrl} style={{ width: '100%', height: 520, border: 'none' }} />
      ) : (
        <div style={{ padding: 16, fontSize: 13, color: '#475569', textAlign: 'center' }}>
          Không xem trước được định dạng này ({answerKeyFile.originalName}) - hãy tải về để xem.
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <>
        <button
          type="button"
          className="btn sm secondary"
          onClick={() => setViewing((v) => !v)}
          title="Xem đáp án chi tiết"
          style={{ height: 35, padding: '0 10px', fontSize: 12.5, borderRadius: 7 }}
        >
          👁️ {viewing ? 'Ẩn đáp án' : 'Đáp án'}
        </button>
        <a
          href={downloadUrl}
          className="btn sm secondary"
          title="Tải đáp án chi tiết"
          style={{ height: 35, padding: '0 10px', fontSize: 12.5, borderRadius: 7, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          ⬇️
        </a>
        {preview}
      </>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        border: '1px solid #bfdbfe',
        background: '#eff6ff',
        borderRadius: 8,
        padding: '6px 10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
          📄 Đáp án chi tiết
        </span>
        <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn sm secondary"
            onClick={() => setViewing((v) => !v)}
            style={{ padding: '3px 10px', fontSize: 11.5 }}
          >
            👁️ {viewing ? 'Ẩn' : 'Xem'}
          </button>
          <a href={downloadUrl} className="btn sm secondary" style={{ textDecoration: 'none', padding: '3px 10px', fontSize: 11.5 }}>
            ⬇️ Tải về
          </a>
        </div>
      </div>
      {preview}
    </div>
  );
}
