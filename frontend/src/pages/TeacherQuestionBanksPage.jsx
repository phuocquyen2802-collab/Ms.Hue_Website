import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import UiIcon from '../components/UiIcon';
import { renderMath } from '../utils/mathRender';

// Ngân hàng đề: giáo viên tải nhiều file Word, mỗi file đặt 1 tên chủ đề.
// Câu hỏi trong đó dùng cho trò chơi "Đường đua Toán học" của học sinh.

// Gợi ý tên chủ đề từ tên file: "Cap_so_cong-11A.docx" -> "Cap so cong 11A"
function topicFromFileName(name) {
  return name.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return '';
  }
}

let uploadSeq = 0;

export default function TeacherQuestionBanksPage() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [uploads, setUploads] = useState([]); // { key, file, title, status: ready|uploading|done|error, message }
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [preview, setPreview] = useState(null); // { bank, questions } | { loading: true }

  async function loadBanks() {
    try {
      const { data } = await api.get('/teacher/question-banks');
      setBanks(data);
      setLoadError('');
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Không tải được danh sách ngân hàng đề');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBanks();
  }, []);

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => /\.docx$/i.test(f.name));
    if (!files.length) return;
    setUploads((prev) => [
      ...prev.filter((u) => u.status !== 'done'),
      ...files.map((file) => {
        uploadSeq += 1;
        return { key: `up-${uploadSeq}`, file, title: topicFromFileName(file.name), status: 'ready', message: '' };
      }),
    ]);
  }

  function updateUpload(key, changes) {
    setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...changes } : u)));
  }

  async function handleUploadAll() {
    const pending = uploads.filter((u) => u.status === 'ready' || u.status === 'error');
    if (pending.some((u) => !u.title.trim())) {
      pending.filter((u) => !u.title.trim()).forEach((u) => updateUpload(u.key, { status: 'error', message: 'Nhập tên chủ đề' }));
      return;
    }
    setUploading(true);
    // Xử lý lần lượt từng file: bóc tách công thức tốn nhiều tài nguyên máy chủ.
    for (const item of pending) {
      updateUpload(item.key, { status: 'uploading', message: '' });
      try {
        const form = new FormData();
        form.append('file', item.file);
        form.append('title', item.title.trim());
        form.append('fileName', item.file.name);
        const { data } = await api.post('/teacher/question-banks', form, { timeout: 300000 });
        updateUpload(item.key, {
          status: 'done',
          message: data.skippedCount
            ? `Đã nhập ${data.questionCount} câu, bỏ qua ${data.skippedCount} câu thiếu đáp án`
            : `Đã nhập ${data.questionCount} câu`,
        });
      } catch (err) {
        updateUpload(item.key, { status: 'error', message: err.response?.data?.message || 'Tải lên thất bại' });
      }
    }
    setUploading(false);
    loadBanks();
  }

  async function saveTitle(bank) {
    const title = editTitle.trim();
    if (!title) return;
    try {
      await api.put(`/teacher/question-banks/${bank.id}`, { title });
      setEditingId(null);
      loadBanks();
    } catch (err) {
      alert(err.response?.data?.message || 'Đổi tên thất bại');
    }
  }

  async function deleteBank(bank) {
    if (!window.confirm(`Xoá ngân hàng đề "${bank.title}"? Học sinh sẽ không chơi được chủ đề này nữa.`)) return;
    try {
      await api.delete(`/teacher/question-banks/${bank.id}`);
      loadBanks();
    } catch (err) {
      alert(err.response?.data?.message || 'Xoá thất bại');
    }
  }

  async function openPreview(bank) {
    setPreview({ loading: true, bank });
    try {
      const { data } = await api.get(`/teacher/question-banks/${bank.id}/questions`);
      setPreview(data);
    } catch (err) {
      setPreview(null);
      alert(err.response?.data?.message || 'Không tải được câu hỏi');
    }
  }

  const readyCount = uploads.filter((u) => u.status === 'ready' || u.status === 'error').length;
  const totalQuestions = banks.reduce((sum, b) => sum + b.questionCount, 0);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ngân hàng đề</h1>
          <p className="page-subtitle">Tải đề Word theo từng chủ đề để học sinh luyện tập qua trò chơi Đường đua Toán học</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <h2>Tải đề lên ngân hàng</h2>
            <p className="card-hint">Mỗi file Word là một chủ đề. Chỉ những câu có đủ 4 đáp án A, B, C, D và có trong bảng đáp án mới được đưa vào trò chơi.</p>
          </div>
        </div>

        <button
          type="button"
          className={`ce-dropzone${dragActive ? ' is-drag' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
        >
          <span className="ce-dropzone-icon"><UiIcon name="upload" size={22} /></span>
          <span className="ce-dropzone-title">Kéo thả một hoặc nhiều file Word vào đây</span>
          <span className="ce-dropzone-sub">hoặc <span className="ce-dropzone-link">chọn file từ máy</span> (.docx)</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />

        {uploads.length > 0 && (
          <>
            <ul className="qb-upload-list">
              {uploads.map((u) => (
                <li key={u.key} className={`qb-upload is-${u.status}`}>
                  <span className="qb-upload-icon" aria-hidden="true"><UiIcon name="file" size={18} /></span>
                  <div className="qb-upload-main">
                    <div className="qb-upload-file" title={u.file.name}>{u.file.name}</div>
                    <input
                      type="text"
                      aria-label={`Tên chủ đề cho ${u.file.name}`}
                      placeholder="Tên chủ đề, VD: Cấp số cộng"
                      value={u.title}
                      disabled={u.status === 'uploading' || u.status === 'done'}
                      onChange={(e) => updateUpload(u.key, { title: e.target.value, status: u.status === 'error' ? 'ready' : u.status })}
                    />
                  </div>
                  <div className="qb-upload-status">
                    {u.status === 'uploading' && <><span className="spinner" aria-hidden="true" /> Đang xử lý…</>}
                    {u.status === 'done' && <><UiIcon name="check" size={15} /> {u.message}</>}
                    {u.status === 'error' && <><UiIcon name="alert" size={15} /> {u.message}</>}
                  </div>
                  {u.status !== 'uploading' && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Bỏ file ${u.file.name}`}
                      onClick={() => setUploads((prev) => prev.filter((x) => x.key !== u.key))}
                    >
                      <UiIcon name="close" size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="qb-upload-actions">
              <button type="button" className="btn secondary" disabled={uploading} onClick={() => setUploads([])}>
                Xoá danh sách
              </button>
              <button type="button" className="btn" disabled={uploading || readyCount === 0} onClick={handleUploadAll}>
                <UiIcon name="upload" size={16} />
                {uploading ? 'Đang tải lên…' : `Tải lên ${readyCount} file`}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <h2>
              Các chủ đề trong ngân hàng <span className="count-badge">{banks.length}</span>
            </h2>
            <p className="card-hint">Tổng {totalQuestions} câu hỏi. Học sinh chọn chủ đề trong mục Trò chơi.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><div className="empty-state-title">Đang tải…</div></div>
        ) : loadError ? (
          <div className="notice is-danger"><UiIcon name="alert" size={18} /><div className="notice-body">{loadError}</div></div>
        ) : banks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="folder" size={22} /></div>
            <div className="empty-state-title">Chưa có chủ đề nào</div>
            <p className="empty-state-desc">Tải file Word ở trên để tạo chủ đề đầu tiên cho trò chơi.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Chủ đề</th>
                  <th style={{ width: 110 }}>Số câu</th>
                  <th>File gốc</th>
                  <th style={{ width: 120 }}>Ngày tải</th>
                  <th style={{ textAlign: 'right', width: 150 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {banks.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {editingId === b.id ? (
                        <div className="qb-rename">
                          <input
                            type="text"
                            aria-label="Tên chủ đề"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(b); if (e.key === 'Escape') setEditingId(null); }}
                            autoFocus
                          />
                          <button type="button" className="btn sm" onClick={() => saveTitle(b)}>Lưu</button>
                          <button type="button" className="btn sm secondary" onClick={() => setEditingId(null)}>Huỷ</button>
                        </div>
                      ) : (
                        <span className="qb-title">{b.title}</span>
                      )}
                    </td>
                    <td>
                      <span className="qb-count">{b.questionCount}</span>
                      {b.skippedCount > 0 && (
                        <span className="qb-skipped" title="Câu thiếu đáp án hoặc thiếu lựa chọn, không dùng trong trò chơi">
                          bỏ qua {b.skippedCount}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-cell qb-file" title={b.fileName || ''}>{b.fileName || '—'}</td>
                    <td className="text-muted-cell">{formatDate(b.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-btn" aria-label={`Xem câu hỏi ${b.title}`} title="Xem câu hỏi" onClick={() => openPreview(b)}>
                          <UiIcon name="eye" size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Đổi tên ${b.title}`}
                          title="Đổi tên chủ đề"
                          onClick={() => { setEditingId(b.id); setEditTitle(b.title); }}
                        >
                          <UiIcon name="edit" size={15} />
                        </button>
                        <button type="button" className="icon-btn is-danger" aria-label={`Xoá ${b.title}`} title="Xoá chủ đề" onClick={() => deleteBank(b)}>
                          <UiIcon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="qb-preview-title" onClick={() => setPreview(null)}>
          <div className="modal-panel qb-preview" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 id="qb-preview-title">{preview.bank?.title}</h3>
                {!preview.loading && <p>{preview.questions.length} câu hỏi · đáp án đúng tô màu xanh</p>}
              </div>
              <button type="button" className="icon-btn" aria-label="Đóng" onClick={() => setPreview(null)}>
                <UiIcon name="close" size={16} />
              </button>
            </div>
            <div className="qb-preview-body">
              {preview.loading ? (
                <p className="qb-muted">Đang tải…</p>
              ) : (
                <ol className="qb-preview-list">
                  {preview.questions.map((q) => (
                    <li key={q.id}>
                      <div className="question-content" dangerouslySetInnerHTML={{ __html: renderMath(q.content) }} />
                      <ul className="qb-preview-options">
                        {q.options.map((o) => (
                          <li key={o.key} className={o.key === q.correctAnswer ? 'is-correct' : ''}>
                            <b>{o.key}.</b> <span dangerouslySetInnerHTML={{ __html: renderMath(o.text) }} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
