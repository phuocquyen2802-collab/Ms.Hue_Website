import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import api from '../services/api';

// Panel "Đáp án chi tiết" hiển thị cho học sinh SAU KHI đã nộp bài 1 đề có
// giáo viên đính kèm file đáp án chi tiết (PDF/ảnh) - cho phép xem trực tiếp
// trên web, tải về máy, hoặc quét mã QR để mở ngay trên điện thoại (link tải
// là link công khai không cần đăng nhập, xem examController.downloadAnswerKey).
export default function AnswerKeyPanel({ examId, answerKeyFile }) {
  const [mode, setMode] = useState(null); // null | 'view' | 'qr'
  const [qrDataUrl, setQrDataUrl] = useState('');

  const downloadUrl = `${api.defaults.baseURL}/exams/${examId}/answer-key/download`;
  const viewUrl = `${downloadUrl}?inline=1`;
  const absoluteViewUrl = viewUrl.startsWith('http') ? viewUrl : `${window.location.origin}${viewUrl}`;

  useEffect(() => {
    if (mode !== 'qr') return;
    let cancelled = false;
    QRCode.toDataURL(absoluteViewUrl, { width: 220, margin: 1 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (!answerKeyFile) return null;

  const isImage = (answerKeyFile.mimeType || '').startsWith('image/');
  // File Word đã được máy chủ tự chuyển sẵn 1 bản PDF để xem trước
  // (`previewPdfFilename`) - trình duyệt hiển thị PDF trực tiếp được, nên
  // coi như "xem được qua iframe" giống file PDF gốc.
  const isPdf = (answerKeyFile.mimeType || '').includes('pdf') || Boolean(answerKeyFile.previewPdfFilename);

  return (
    <div
      style={{
        marginTop: 10,
        border: '1px solid #bfdbfe',
        background: '#eff6ff',
        borderRadius: 10,
        padding: '10px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>
          📄 Đáp án chi tiết đã có sẵn
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn sm secondary"
            onClick={() => setMode(mode === 'view' ? null : 'view')}
          >
            👁️ {mode === 'view' ? 'Ẩn' : 'Xem trên web'}
          </button>
          <a href={downloadUrl} className="btn sm secondary" style={{ textDecoration: 'none' }}>
            ⬇️ Tải về
          </a>
          <button
            type="button"
            className="btn sm secondary"
            onClick={() => setMode(mode === 'qr' ? null : 'qr')}
          >
            📱 {mode === 'qr' ? 'Ẩn mã QR' : 'Quét QR bằng điện thoại'}
          </button>
        </div>
      </div>

      {mode === 'view' && (
        <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1', background: '#fff' }}>
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
      )}

      {mode === 'qr' && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          {qrDataUrl ? (
            <>
              <img src={qrDataUrl} alt="Mã QR mở đáp án chi tiết trên điện thoại" style={{ borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', padding: 8 }} />
              <p style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>
                Dùng camera điện thoại quét mã để mở trực tiếp đáp án chi tiết, không cần đăng nhập.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 12.5, color: '#94a3b8' }}>Đang tạo mã QR...</p>
          )}
        </div>
      )}
    </div>
  );
}
