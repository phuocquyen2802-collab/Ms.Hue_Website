import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const EMPTY_STUDENT_FORM = { name: '', email: '', password: '', className: '' };

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  // Modal tạo/sửa nhóm học sinh
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null); // null = tạo mới, object = đang sửa
  const [groupForm, setGroupForm] = useState({ name: '', studentIds: [] });
  const [groupSearch, setGroupSearch] = useState('');
  const [groupError, setGroupError] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

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
      const [studentsRes, groupsRes] = await Promise.all([
        api.get('/teacher/students'),
        api.get('/teacher/groups'),
      ]);
      setStudents(studentsRes.data);
      setGroups(groupsRes.data);
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

  function openCreateGroupModal() {
    setEditingGroup(null);
    setGroupForm({ name: '', studentIds: [] });
    setGroupSearch('');
    setGroupError('');
    setShowGroupModal(true);
  }

  function openEditGroupModal(group) {
    setEditingGroup(group);
    setGroupForm({ name: group.name, studentIds: group.studentIds });
    setGroupSearch('');
    setGroupError('');
    setShowGroupModal(true);
  }

  function toggleGroupStudent(studentId) {
    setGroupForm((prev) => {
      const has = prev.studentIds.includes(studentId);
      return {
        ...prev,
        studentIds: has ? prev.studentIds.filter((id) => id !== studentId) : [...prev.studentIds, studentId],
      };
    });
  }

  async function handleSaveGroup(e) {
    e.preventDefault();
    setGroupError('');
    if (!groupForm.name.trim()) {
      setGroupError('Vui lòng đặt tên nhóm');
      return;
    }
    if (groupForm.studentIds.length === 0) {
      setGroupError('Vui lòng chọn ít nhất 1 học sinh cho nhóm');
      return;
    }
    setSavingGroup(true);
    try {
      if (editingGroup) {
        await api.put(`/teacher/groups/${editingGroup.id}`, groupForm);
      } else {
        await api.post('/teacher/groups', groupForm);
      }
      setShowGroupModal(false);
      loadData();
    } catch (err) {
      setGroupError(err.response?.data?.message || 'Lỗi khi lưu nhóm');
    } finally {
      setSavingGroup(false);
    }
  }

  async function handleDeleteGroup(group) {
    if (!window.confirm(`Xoá nhóm "${group.name}"? (không ảnh hưởng đề đã giao trước đó)`)) return;
    try {
      await api.delete(`/teacher/groups/${group.id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi xoá nhóm');
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
                placeholder="Tìm tên, email…"
                aria-label="Tìm học sinh theo tên hoặc email"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                spellCheck={false}
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
            <div className="empty-state-title">Đang tải danh sách…</div>
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
                            aria-label="Họ và tên"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            autoFocus
                          />
                        </td>
                        <td className="nowrap">
                          <input
                            type="text"
                            aria-label="Lớp học"
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
                        <Link
                          to={`/teacher/analytics?studentId=${s.id}`}
                          className="table-avatar-cell"
                          style={{ textDecoration: 'none' }}
                          title="Xem kết quả bài làm của học sinh này"
                        >
                          <div className="table-avatar">{initial}</div>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.name}</span>
                        </Link>
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

      {/* Quản lý nhóm học sinh - dùng để giao bài nhanh cho 1 tập học sinh tuỳ ý (không nhất thiết cùng lớp) */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Nhóm học sinh ({groups.length})</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Gom học sinh tuỳ ý thành nhóm để giao bài nhanh (VD: nhóm ôn thêm, đội tuyển…)
            </p>
          </div>
          <button className="btn sm" onClick={openCreateGroupModal}>
            + Tạo nhóm
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🗂️</div>
            <div className="empty-state-title">Chưa có nhóm nào</div>
            <p className="empty-state-desc">Tạo nhóm để giao bài nhanh cho nhiều học sinh cùng lúc, không cần chọn tay từng người mỗi lần.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '12px 16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  background: '#ffffff',
                }}
              >
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-main)' }}>
                    🗂️ {g.name} <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 12.5 }}>({g.students.length} học sinh)</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    {g.students.map((s) => s.name).join(', ') || '—'}
                  </div>
                </div>
                <div className="action-buttons">
                  <button type="button" className="btn sm secondary" onClick={() => openEditGroupModal(g)}>
                    Sửa
                  </button>
                  <button type="button" className="btn sm outline-danger" onClick={() => handleDeleteGroup(g)}>
                    Xoá
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Tạo/Sửa nhóm học sinh */}
      {showGroupModal && (
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
          onClick={() => setShowGroupModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, margin: 0, boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h2>{editingGroup ? 'Sửa nhóm học sinh' : 'Tạo nhóm học sinh'}</h2>
              <button
                type="button"
                aria-label="Đóng"
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowGroupModal(false)}
              >
                ✕
              </button>
            </div>

            <form className="form-panel" onSubmit={handleSaveGroup}>
              <div className="form-group">
                <label htmlFor="group-name">Tên nhóm <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  id="group-name"
                  type="text"
                  placeholder="VD: Nhóm ôn thi lại, Đội tuyển HSG…"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Chọn học sinh <span style={{ color: 'var(--danger)' }}>*</span>{' '}
                  <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({groupForm.studentIds.length} đã chọn)</span>
                </label>
                <input
                  type="text"
                  placeholder="Tìm tên học sinh…"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  spellCheck={false}
                  style={{ marginBottom: 8 }}
                />
                <div
                  style={{
                    maxHeight: 260,
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: 8,
                  }}
                >
                  {students
                    .filter((s) => s.name.toLowerCase().includes(groupSearch.toLowerCase()))
                    .map((s) => (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 13.5,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={groupForm.studentIds.includes(s.id)}
                          onChange={() => toggleGroupStudent(s.id)}
                          style={{ width: 'auto' }}
                        />
                        <span>{s.name}</span>
                        {s.className && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({s.className})</span>}
                      </label>
                    ))}
                  {students.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Chưa có học sinh nào.</p>
                  )}
                </div>
              </div>

              {groupError && (
                <p className="error-text" role="alert" aria-live="polite">
                  <span aria-hidden="true">⚠️</span> {groupError}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn secondary" onClick={() => setShowGroupModal(false)}>
                  Huỷ
                </button>
                <button className="btn" type="submit" disabled={savingGroup}>
                  {savingGroup ? 'Đang lưu…' : editingGroup ? 'Lưu thay đổi' : 'Tạo nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                aria-label="Đóng"
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            <form className="form-panel" onSubmit={handleAddStudent}>
              <div className="form-group">
                <label htmlFor="add-student-name">Họ và tên học sinh <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  id="add-student-name"
                  type="text"
                  placeholder="Nguyễn Văn An…"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="add-student-email">Email / Tên đăng nhập <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    id="add-student-email"
                    type="email"
                    placeholder="an.nguyen@email.com…"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    autoComplete="email"
                    spellCheck={false}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="add-student-class">Lớp học</label>
                  <input
                    id="add-student-class"
                    type="text"
                    placeholder="12A1…"
                    value={newStudent.className}
                    onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="add-student-password">Mật khẩu <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  id="add-student-password"
                  type="password"
                  placeholder="Tối thiểu 6 ký tự…"
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>

              {addError && (
                <p className="error-text" role="alert" aria-live="polite">
                  <span aria-hidden="true">⚠️</span> {addError}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn secondary" onClick={() => setShowAddModal(false)}>
                  Huỷ
                </button>
                <button className="btn" type="submit" disabled={adding}>
                  {adding ? 'Đang tạo…' : 'Thêm học sinh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
