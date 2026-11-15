import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import UiIcon from '../components/UiIcon';
import { useAuth } from '../context/AuthContext';
import {
  loadCreatedAccounts,
  saveCreatedAccounts,
  exportAccountsToXlsx,
  generatePassword,
} from '../utils/studentAccountsExport';

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

  // Tài khoản vừa tạo (kèm mật khẩu giáo viên vừa nhập) để xuất file Excel
  // gửi cho lớp - xem utils/studentAccountsExport.js
  const { user } = useAuth();
  const [createdAccounts, setCreatedAccounts] = useState(() => loadCreatedAccounts(user?.id));
  const [exportClass, setExportClass] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  function updateCreatedAccounts(updater) {
    setCreatedAccounts((prev) => {
      const next = updater(prev);
      saveCreatedAccounts(user?.id, next);
      return next;
    });
  }

  function openAddModal() {
    setAddError('');
    setAddSuccess('');
    setShowAddModal(true);
  }

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
    // Nút "Lưu và thêm tiếp" giữ modal mở và giữ nguyên lớp
    const keepOpen = e.nativeEvent?.submitter?.dataset?.action === 'continue';
    setAddError('');
    setAddSuccess('');
    setAdding(true);
    try {
      const payload = {
        ...newStudent,
        name: newStudent.name.trim(),
        email: newStudent.email.trim(),
        className: newStudent.className.trim(),
      };
      const { data } = await api.post('/teacher/students', payload);
      updateCreatedAccounts((prev) => [
        ...prev,
        {
          id: data.id,
          name: data.name,
          email: data.email,
          className: data.className || '',
          password: payload.password,
          createdAt: new Date().toISOString(),
        },
      ]);
      if (keepOpen) {
        setNewStudent({ ...EMPTY_STUDENT_FORM, className: payload.className });
        setAddSuccess(`Đã tạo tài khoản cho ${data.name}. Nhập học sinh tiếp theo.`);
        setTimeout(() => document.getElementById('add-student-name')?.focus(), 0);
      } else {
        setNewStudent(EMPTY_STUDENT_FORM);
        setShowAddModal(false);
      }
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
      updateCreatedAccounts((prev) =>
        prev.map((a) => (a.id === studentId ? { ...a, name: editForm.name, className: editForm.className || '' } : a))
      );
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
      updateCreatedAccounts((prev) => prev.filter((a) => a.id !== student.id));
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

  // Xuất file Excel các tài khoản vừa tạo (theo lớp)
  const createdClasses = Array.from(new Set(createdAccounts.map((a) => a.className || ''))).sort();
  const effectiveExportClass = createdClasses.includes(exportClass) ? exportClass : 'all';
  const accountsToExport = effectiveExportClass === 'all'
    ? createdAccounts
    : createdAccounts.filter((a) => (a.className || '') === effectiveExportClass);

  async function handleExport() {
    setExportError('');
    setExporting(true);
    try {
      const fileClass = effectiveExportClass !== 'all'
        ? effectiveExportClass
        : createdClasses.length === 1 ? createdClasses[0] : '';
      await exportAccountsToXlsx(accountsToExport, fileClass);
    } catch (err) {
      console.error(err);
      setExportError('Không tạo được file Excel. Hãy thử lại hoặc dùng trình duyệt khác.');
    } finally {
      setExporting(false);
    }
  }

  function handleClearCreated() {
    if (!window.confirm('Xoá danh sách tài khoản vừa tạo? Sau khi xoá sẽ không xem lại được mật khẩu.')) return;
    updateCreatedAccounts(() => []);
    setExportClass('all');
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý học sinh</h1>
          <p className="page-subtitle">Tài khoản học sinh, lớp học và nhóm để giao bài nhanh</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={openAddModal}>
            <UiIcon name="plus" size={17} />
            Thêm học sinh
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Tổng số học sinh</span>
            <span className="metric-value">{students.length}</span>
            <span className="metric-sub">Tài khoản đang hoạt động</span>
          </div>
          <div className="metric-icon-box blue"><UiIcon name="users" size={20} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Số lớp học</span>
            <span className="metric-value">{distinctClasses.length}</span>
            <span className="metric-sub">Lớp đang phụ trách</span>
          </div>
          <div className="metric-icon-box green"><UiIcon name="book" size={20} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Nhóm học sinh</span>
            <span className="metric-value">{groups.length}</span>
            <span className="metric-sub">Dùng để giao bài nhanh</span>
          </div>
          <div className="metric-icon-box slate"><UiIcon name="folder" size={20} /></div>
        </div>
      </div>

      {/* Tài khoản vừa tạo - xuất file Excel gửi cho lớp */}
      {createdAccounts.length > 0 && (
        <div className="card created-accounts">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-title-row">
                <UiIcon name="file" size={18} className="title-icon" />
                <h2>Tài khoản vừa tạo</h2>
                <span className="count-badge">{createdAccounts.length}</span>
              </div>
              <p className="card-hint">
                Tải file Excel để gửi cho lớp. Mật khẩu chỉ được giữ ở đây đến khi bạn xoá danh sách, đăng xuất hoặc đóng tab này.
              </p>
            </div>
            <div className="toolbar">
              {createdClasses.length > 1 && (
                <select
                  aria-label="Chọn lớp để xuất file"
                  value={effectiveExportClass}
                  onChange={(e) => setExportClass(e.target.value)}
                >
                  <option value="all">Tất cả lớp ({createdAccounts.length})</option>
                  {createdClasses.map((cls) => (
                    <option key={cls || 'none'} value={cls}>
                      {cls ? `Lớp ${cls}` : 'Chưa phân lớp'} ({createdAccounts.filter((a) => (a.className || '') === cls).length})
                    </option>
                  ))}
                </select>
              )}
              <button className="btn sm" onClick={handleExport} disabled={exporting || accountsToExport.length === 0}>
                {exporting ? (
                  <><span className="spinner is-on-primary" /> Đang tạo file…</>
                ) : (
                  <><UiIcon name="download" size={15} /> Tải file Excel</>
                )}
              </button>
              <button className="btn sm secondary" onClick={handleClearCreated}>
                Xoá danh sách
              </button>
            </div>
          </div>

          {exportError && (
            <div className="notice is-danger" style={{ marginBottom: 12 }}>
              <UiIcon name="alert" size={18} />
              <div className="notice-body">{exportError}</div>
            </div>
          )}

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 56 }}>STT</th>
                  <th>Họ và tên</th>
                  <th style={{ width: 120 }}>Lớp</th>
                  <th>Tài khoản / Email</th>
                  <th style={{ width: 160 }}>Mật khẩu</th>
                </tr>
              </thead>
              <tbody>
                {accountsToExport.map((a, idx) => (
                  <tr key={a.id || idx}>
                    <td className="text-muted-cell">{idx + 1}</td>
                    <td>{a.name}</td>
                    <td>{a.className ? <span className="class-badge">{a.className}</span> : <span className="text-muted-cell">—</span>}</td>
                    <td>{a.email}</td>
                    <td><span className="credential">{a.password}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Danh sách học sinh */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <h2>Danh sách học sinh</h2>
            <span className="count-badge">{filteredStudents.length}</span>
          </div>
          <div className="toolbar">
            <select aria-label="Lọc theo lớp" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="all">Tất cả lớp ({students.length})</option>
              {distinctClasses.map((cls) => (
                <option key={cls} value={cls}>Lớp {cls}</option>
              ))}
            </select>
            <div className="search-field">
              <UiIcon name="search" size={16} />
              <input
                type="search"
                placeholder="Tìm tên hoặc email"
                aria-label="Tìm học sinh theo tên hoặc email"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                spellCheck={false}
                style={{ width: 220 }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div className="empty-state-title">Đang tải danh sách…</div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="users" size={22} /></div>
            {students.length === 0 ? (
              <>
                <div className="empty-state-title">Chưa có học sinh nào</div>
                <p className="empty-state-desc">Tạo tài khoản cho học sinh để giao bài và theo dõi kết quả học tập.</p>
                <button className="btn" onClick={openAddModal}>
                  <UiIcon name="plus" size={17} />
                  Thêm học sinh
                </button>
              </>
            ) : (
              <>
                <div className="empty-state-title">Không tìm thấy học sinh phù hợp</div>
                <p className="empty-state-desc">Thử đổi từ khoá tìm kiếm hoặc chọn lớp khác.</p>
              </>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th style={{ width: 150 }}>Lớp</th>
                  <th style={{ width: 240 }}>Tài khoản</th>
                  <th style={{ textAlign: 'right', width: 120 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const isEditing = editingId === s.id;
                  const initial = s.name ? s.name.trim().charAt(0).toUpperCase() : 'H';

                  if (isEditing) {
                    return (
                      <tr key={s.id} className="is-editing">
                        <td>
                          <input
                            type="text"
                            aria-label="Họ và tên"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            autoFocus
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            aria-label="Lớp học"
                            value={editForm.className}
                            onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                          />
                        </td>
                        <td className="text-muted-cell">{s.email}</td>
                        <td>
                          <div className="row-actions">
                            <button className="btn sm" onClick={() => handleSaveEdit(s.id)}>Lưu</button>
                            <button className="btn sm secondary" onClick={() => setEditingId(null)}>Huỷ</button>
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
                          className="person-link"
                          title="Xem kết quả học tập của học sinh này"
                        >
                          <span className="avatar" aria-hidden="true">{initial}</span>
                          <span className="person-name">{s.name}</span>
                        </Link>
                      </td>
                      <td>
                        <span className="class-badge">{s.className ? `Lớp ${s.className}` : 'Chưa phân lớp'}</span>
                      </td>
                      <td className="text-muted-cell">{s.email}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => startEdit(s)}
                            aria-label={`Sửa thông tin ${s.name}`}
                            title="Sửa thông tin"
                          >
                            <UiIcon name="edit" size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn is-danger"
                            onClick={() => handleDeleteStudent(s)}
                            aria-label={`Xoá học sinh ${s.name}`}
                            title="Xoá học sinh"
                          >
                            <UiIcon name="trash" size={15} />
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

      {/* Nhóm học sinh - giao bài nhanh cho 1 tập học sinh tuỳ ý (không nhất thiết cùng lớp) */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-title-row">
              <h2>Nhóm học sinh</h2>
              <span className="count-badge">{groups.length}</span>
            </div>
            <p className="card-hint">Gom học sinh thành nhóm để giao bài nhanh, VD nhóm ôn thêm hoặc đội tuyển.</p>
          </div>
          <button className="btn sm secondary" onClick={openCreateGroupModal}>
            <UiIcon name="plus" size={15} />
            Tạo nhóm
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="folder" size={22} /></div>
            <div className="empty-state-title">Chưa có nhóm nào</div>
            <p className="empty-state-desc">Tạo nhóm để giao bài cho nhiều học sinh cùng lúc, không phải chọn tay từng người.</p>
          </div>
        ) : (
          <ul className="group-list">
            {groups.map((g) => (
              <li key={g.id} className="group-row">
                <span className="group-icon" aria-hidden="true"><UiIcon name="folder" size={18} /></span>
                <div className="group-info">
                  <div className="group-name">
                    {g.name}
                    <span className="count-badge">{g.students.length} học sinh</span>
                  </div>
                  <div className="group-members" title={g.students.map((st) => st.name).join(', ')}>
                    {g.students.map((st) => st.name).join(', ') || 'Chưa có thành viên'}
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => openEditGroupModal(g)}
                    aria-label={`Sửa nhóm ${g.name}`}
                    title="Sửa nhóm"
                  >
                    <UiIcon name="edit" size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn is-danger"
                    onClick={() => handleDeleteGroup(g)}
                    aria-label={`Xoá nhóm ${g.name}`}
                    title="Xoá nhóm"
                  >
                    <UiIcon name="trash" size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
              <button type="button" className="ce-close" aria-label="Đóng" onClick={() => setShowGroupModal(false)}>
                <UiIcon name="close" size={18} />
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
                <div className="search-field" style={{ display: 'flex', marginBottom: 8 }}>
                  <UiIcon name="search" size={16} />
                  <input
                    type="search"
                    placeholder="Tìm tên học sinh"
                    aria-label="Tìm học sinh"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div className="pick-list">
                  {students
                    .filter((s) => s.name.toLowerCase().includes(groupSearch.toLowerCase()))
                    .map((s) => {
                      const isChecked = groupForm.studentIds.includes(s.id);
                      return (
                        <label key={s.id} className={`ce-student${isChecked ? ' is-checked' : ''}`}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleGroupStudent(s.id)} />
                          <span className="ce-student-name">{s.name}</span>
                          <span className="ce-student-class">{s.className ? `Lớp ${s.className}` : 'Chưa phân lớp'}</span>
                        </label>
                      );
                    })}
                  {students.length === 0 && <div className="ce-empty">Chưa có học sinh nào.</div>}
                </div>
              </div>

              {groupError && (
                <p className="error-text" role="alert" aria-live="polite">
                  {groupError}
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
              <button type="button" className="ce-close" aria-label="Đóng" onClick={() => setShowAddModal(false)}>
                <UiIcon name="close" size={18} />
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
                    type="text"
                    placeholder="an.nguyen hoặc an@email.com"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    autoComplete="off"
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
                <div className="label-row">
                  <label htmlFor="add-student-password">Mật khẩu <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setNewStudent({ ...newStudent, password: generatePassword() })}
                  >
                    Tạo ngẫu nhiên
                  </button>
                </div>
                <input
                  id="add-student-password"
                  type="text"
                  placeholder="Tối thiểu 6 ký tự"
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                  minLength={6}
                  required
                />
                <p className="field-hint">Mật khẩu sẽ có trong file Excel ở mục "Tài khoản vừa tạo".</p>
              </div>

              {addError && (
                <p className="error-text" role="alert" aria-live="polite">
                  {addError}
                </p>
              )}
              {addSuccess && (
                <div className="notice is-success" role="status" aria-live="polite">
                  <UiIcon name="check" size={18} />
                  <div className="notice-body">{addSuccess}</div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setShowAddModal(false)}>
                  {addSuccess ? 'Xong' : 'Huỷ'}
                </button>
                <button className="btn secondary" type="submit" data-action="continue" disabled={adding}>
                  Lưu và thêm tiếp
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
