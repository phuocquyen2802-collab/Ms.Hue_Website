import { useEffect, useState } from 'react';
import api from '../services/api';

const EMPTY_STUDENT_FORM = { name: '', email: '', password: '', className: '' };

export default function SettingsPage() {
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('account');

  // Password
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Student accounts (for teacher)
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [newStudent, setNewStudent] = useState(EMPTY_STUDENT_FORM);
  const [studentError, setStudentError] = useState('');
  const [studentSuccess, setStudentSuccess] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);

  // Edit student inline
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', className: '' });

  async function loadInitialData() {
    try {
      const res = await api.get('/me');
      setProfile(res.data);

      if (res.data.role === 'teacher') {
        const studentsRes = await api.get('/teacher/students');
        setStudents(studentsRes.data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu mới nhập lại không khớp');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess('Đổi mật khẩu thành công!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleCreateStudent(e) {
    e.preventDefault();
    setStudentError('');
    setStudentSuccess('');
    setCreatingStudent(true);
    try {
      await api.post('/teacher/students', newStudent);
      setStudentSuccess(`Đã tạo tài khoản "${newStudent.name}" thành công!`);
      setNewStudent(EMPTY_STUDENT_FORM);
      const res = await api.get('/teacher/students');
      setStudents(res.data);
    } catch (err) {
      setStudentError(err.response?.data?.message || 'Tạo tài khoản thất bại');
    } finally {
      setCreatingStudent(false);
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
      const res = await api.get('/teacher/students');
      setStudents(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Cập nhật thất bại');
    }
  }

  async function handleDeleteStudent(student) {
    if (!window.confirm(`Xoá tài khoản "${student.name}"?`)) return;
    try {
      await api.delete(`/teacher/students/${student.id}`);
      const res = await api.get('/teacher/students');
      setStudents(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Xoá thất bại');
    }
  }

  if (!profile) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải cài đặt...</div>
        </div>
      </div>
    );
  }

  const isTeacher = profile.role === 'teacher';

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.className && s.className.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cài đặt</h1>
          <p className="page-subtitle">Quản lý thông tin cá nhân và tài khoản</p>
        </div>
      </div>

      {isTeacher && (
        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <span>👤</span>
            <span>Tài khoản cá nhân</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <span>👥</span>
            <span>Thêm tài khoản học sinh</span>
            <span className="tab-count">{students.length}</span>
          </button>
        </div>
      )}

      {/* TAB 1: Tài khoản cá nhân */}
      {activeTab === 'account' && (
        <>
          <div className="card">
            <div className="card-header">
              <h2>Thông tin tài khoản</h2>
            </div>
            <div className="table-responsive" style={{ border: 'none' }}>
              <table>
                <tbody>
                  <tr>
                    <td className="nowrap" style={{ color: 'var(--text-muted)', width: 160, fontWeight: 600 }}>Họ và tên</td>
                    <td style={{ fontWeight: 600 }}>{profile.name}</td>
                  </tr>
                  <tr>
                    <td className="nowrap" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Email / Tên đăng nhập</td>
                    <td>{profile.email}</td>
                  </tr>
                  <tr>
                    <td className="nowrap" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Vai trò</td>
                    <td>
                      <span className={`status-pill ${isTeacher ? 'approved' : 'assigned'}`}>
                        {isTeacher ? 'Giáo viên' : 'Học sinh'}
                      </span>
                    </td>
                  </tr>
                  {profile.className && (
                    <tr>
                      <td className="nowrap" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Lớp</td>
                      <td>
                        <span className="tag-badge">Lớp {profile.className}</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Đổi mật khẩu</h2>
            </div>
            <form onSubmit={handleChangePassword} style={{ maxWidth: 420 }}>
              <div className="form-group">
                <label>Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Mật khẩu mới</label>
                <input
                  type="password"
                  placeholder="Tối thiểu 6 ký tự"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nhập lại mật khẩu mới</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  minLength={6}
                  required
                />
              </div>

              {passwordError && <p className="error-text">⚠️ {passwordError}</p>}
              {passwordSuccess && <p className="success-text">✓ {passwordSuccess}</p>}

              <button className="btn" type="submit" disabled={savingPassword} style={{ marginTop: 6 }}>
                {savingPassword ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* TAB 2: Thêm tài khoản học sinh */}
      {isTeacher && activeTab === 'students' && (
        <>
          <div className="card" style={{ border: '2px solid var(--primary-border)' }}>
            <div className="card-header">
              <h2>Thêm tài khoản học sinh</h2>
            </div>
            <form onSubmit={handleCreateStudent}>
              <div className="form-row">
                <div className="form-group">
                  <label>Họ và tên học sinh <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    placeholder="VD: Trần Minh Đức"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Lớp học</label>
                  <input
                    type="text"
                    placeholder="VD: 12A2"
                    value={newStudent.className}
                    onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email / Tên đăng nhập <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="email"
                    placeholder="VD: duc.tran@gmail.com"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Mật khẩu khởi tạo <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="password"
                    placeholder="Tối thiểu 6 ký tự"
                    value={newStudent.password}
                    onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                    minLength={6}
                    required
                  />
                </div>
              </div>

              {studentError && <p className="error-text">⚠️ {studentError}</p>}
              {studentSuccess && <p className="success-text">✓ {studentSuccess}</p>}

              <button className="btn" type="submit" disabled={creatingStudent} style={{ marginTop: 4 }}>
                {creatingStudent ? 'Đang tạo...' : '+ Thêm học sinh'}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Danh sách học sinh ({students.length})</h2>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👤</div>
                <div className="empty-state-title">Chưa có học sinh nào</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Học sinh</th>
                      <th className="nowrap" style={{ width: 120 }}>Lớp</th>
                      <th className="nowrap" style={{ width: 220 }}>Email / Đăng nhập</th>
                      <th className="nowrap" style={{ textAlign: 'right', width: 180 }}>Thao tác</th>
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
                              <span style={{ fontWeight: 600 }}>{s.name}</span>
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
                                title="Xoá tài khoản"
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
        </>
      )}
    </div>
  );
}
