import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const EMPTY_STUDENT_FORM = { name: '', email: '', password: '', className: '' };

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  // Modal thêm học sinh
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState(EMPTY_STUDENT_FORM);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', className: '', password: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const studentsRes = await api.get('/teacher/students');
      setStudents(studentsRes.data);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddStudent(e) {
    e.preventDefault();
    setAddError('');
    setAdding(true);
    try {
      await api.post('/teacher/students', newStudent);
      setNewStudent(EMPTY_STUDENT_FORM);
      setShowAddModal(false);
      loadData();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Tạo tài khoản thất bại');
    } finally {
      setAdding(false);
    }
  }

  function startEdit(student) {
    setEditingId(student.id);
    setEditForm({ name: student.name, className: student.className || '' });
  }

  async function handleSaveEdit(studentId) {
    try {
      await api.put(`/teacher/students/${studentId}`, editForm);
      setEditingId(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi cập nhật');
    }
  }

  async function handleDeleteStudent(student) {
    if (!window.confirm(`Xoá tài khoản học sinh "${student.name}"?`)) return;
    try {
      await api.delete(`/teacher/students/${student.id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi xoá tài khoản');
    }
  }

  // Danh sách các lớp
  const distinctClasses = Array.from(new Set(students.map((s) => s.className).filter(Boolean)));

  // Lọc học sinh
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.className && s.className.toLowerCase().includes(studentSearch.toLowerCase()));

    if (!matchesSearch) return false;
    if (classFilter === 'all') return true;
    return s.className === classFilter;
  });

  return (
    <div className="container">
      {/* Tiêu đề & Nút hành động */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý học sinh</h1>
          <p className="page-subtitle">Theo dõi số lượng học sinh theo lớp và danh sách tài khoản</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => setShowAddModal(true)}>
            + Thêm học sinh
          </button>
        </div>
      </div>

      {/* Thẻ thống kê số lượng */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Tổng số học sinh</span>
            <span className="metric-value">{students.length}</span>
            <span className="metric-sub">Học sinh trong hệ thống</span>
          </div>
          <div className="metric-icon-box blue">👥</div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Số lớp học</span>
            <span className="metric-value">{distinctClasses.length}</span>
            <span className="metric-sub">Các lớp đang phụ trách</span>
          </div>
          <div className="metric-icon-box green">🏫</div>
        </div>
      </div>

      {/* Danh sách học sinh */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Danh sách học sinh ({filteredStudents.length})</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div className="search-input-wrapper" style={{ width: 220, margin: 0 }}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Tìm tên, email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{ padding: '8px 12px 8px 32px', height: 38 }}
              />
            </div>

            <select
              style={{ width: 'auto', minWidth: 140, padding: '8px 12px', height: 38, margin: 0 }}
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="all">Tất cả lớp ({students.length})</option>
              {distinctClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Lớp {cls}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Đang tải danh sách...</div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-title">Chưa có học sinh nào</div>
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setShowAddModal(true)}>
              + Thêm học sinh mới
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th className="nowrap" style={{ width: 120 }}>Lớp</th>
                  <th className="nowrap" style={{ width: 220 }}>Tài khoản / Email</th>
                  <th className="nowrap" style={{ textAlign: 'right', width: 240 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const isEditing = editingId === s.id;
                  const initial = s.name ? s.name.trim().charAt(0).toUpperCase() : 'H';

                  if (isEditing) {
                    return (
                      <tr key={s.id} style={{ background: 'var(--primary-light)' }}>
                        <td>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            autoFocus
                          />
                        </td>
                        <td className="nowrap">
                          <input
                            type="text"
                            value={editForm.className}
                            onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                          />
                        </td>
                        <td className="nowrap">{s.email}</td>
                        <td className="nowrap" style={{ textAlign: 'right' }}>
                          <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn sm" onClick={() => handleSaveEdit(s.id)}>
                              Lưu
                            </button>
                            <button className="btn sm secondary" onClick={() => setEditingId(null)}>
                              Huỷ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="table-avatar-cell">
                          <div className="table-avatar">{initial}</div>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.name}</span>
                        </div>
                      </td>
                      <td className="nowrap">
                        <span className="tag-badge" style={{ margin: 0 }}>
                          {s.className ? `Lớp ${s.className}` : 'Chưa phân lớp'}
                        </span>
                      </td>
                      <td className="nowrap" style={{ color: 'var(--text-muted)' }}>
                        {s.email}
                      </td>
                      <td className="nowrap" style={{ textAlign: 'right' }}>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn sm secondary"
                            onClick={() => startEdit(s)}
                            title="Sửa thông tin"
                            style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            className="btn sm outline-danger"
                            onClick={() => handleDeleteStudent(s)}
                            title="Xoá học sinh"
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            <span>Xoá</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Thêm học sinh */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 460, margin: 0, boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h2>Thêm học sinh mới</h2>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStudent}>
              <div className="form-group">
                <label>Họ và tên học sinh <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  placeholder="VD: Nguyễn Văn An"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email / Tên đăng nhập <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="email"
                    placeholder="VD: an.nguyen@gmail.com"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Lớp học</label>
                  <input
                    type="text"
                    placeholder="VD: 12A1"
                    value={newStudent.className}
                    onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Mật khẩu <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="password"
                  placeholder="Tối thiểu 6 ký tự"
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  minLength={6}
                  required
                />
              </div>

              {addError && <p className="error-text">⚠️ {addError}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn secondary" onClick={() => setShowAddModal(false)}>
                  Huỷ
                </button>
                <button className="btn" type="submit" disabled={adding}>
                  {adding ? 'Đang tạo...' : 'Thêm học sinh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
