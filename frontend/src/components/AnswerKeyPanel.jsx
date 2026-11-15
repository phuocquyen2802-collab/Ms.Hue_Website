import { useState } from 'react';
import api from '../services/api';
import UiIcon from './UiIcon';

// Panel "Đáp án chi tiết" hiển thị cho học sinh SAU KHI đã nộp bài 1 đề có
// giáo viên đính kèm file đáp án chi tiết (PDF/ảnh) - cho phép xem trực tiếp
// trên web hoặc tải về máy (link tải là link công khai không cần đăng nhập,
// xem examController.downloadAnswerKey).
//
// `compact`: true khi cần nhét vừa CHUNG 1 hàng với các nút khác (VD "Làm
// lại"/"Lịch sử" ở StudentDashboard) - chỉ còn 2 nút nhỏ, bỏ nhãn và khung
// viền bao quanh; phần xem trước (nếu bấm "Xem") vẫn hiện full-width bên dưới.
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
    <div className={`answer-key-preview${compact ? ' is-full' : ''}`}>
      {isImage ? (
        <img src={viewUrl} alt="Đáp án chi tiết" />
      ) : isPdf ? (
        <iframe title="Đáp án chi tiết" src={viewUrl} />
      ) : (
        <div className="answer-key-unsupported">
          Không xem trước được định dạng này ({answerKeyFile.originalName}). Hãy tải về để xem.
        </div>
      )}
    </div>
  );

  const viewButton = (
    <button
      type="button"
      className="btn sm secondary"
      onClick={() => setViewing((v) => !v)}
      aria-expanded={viewing}
      title="Xem đáp án chi tiết"
    >
      <UiIcon name="eye" size={15} /> {viewing ? 'Ẩn đáp án' : 'Đáp án'}
    </button>
  );

  if (compact) {
    return (
      <>
        {viewButton}
        <a href={downloadUrl} className="btn sm secondary" title="Tải đáp án chi tiết" aria-label="Tải đáp án chi tiết">
          <UiIcon name="download" size={15} />
        </a>
        {preview}
      </>
    );
  }

  return (
    <div className="answer-key-panel">
      <div className="answer-key-head">
        <span className="answer-key-label">
          <UiIcon name="file" size={15} /> Đáp án chi tiết
        </span>
        <div className="answer-key-actions">
          {viewButton}
          <a href={downloadUrl} className="btn sm secondary">
            <UiIcon name="download" size={15} /> Tải về
          </a>
        </div>
      </div>
      {preview}
    </div>
  );
}
