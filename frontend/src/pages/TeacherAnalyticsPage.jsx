import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import WeakTopicsChart from '../components/WeakTopicsChart';

export default function TeacherAnalyticsPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [groups, setGroups] = useState([]);

  // So sánh điểm giữa học sinh (theo lớp/nhóm + chọn đề)
  const [compareExamId, setCompareExamId] = useState('all');
  const [compareScopeType, setCompareScopeType] = useState('class'); // 'class' | 'group'
  const [compareScopeValue, setCompareScopeValue] = useState('all');

  // Filter state
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Analytics data
  const [studentStats, setStudentStats] = useState(null);
  const [studentStatsLoading, setStudentStatsLoading] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('all');

  // Distinct classes list for filtering
  const classesList = useMemo(() => {
    const set = new Set();
    students.forEach((st) => {
      if (st.className && st.className.trim()) {
        set.add(st.className.trim());
      }
    });
    return Array.from(set).sort();
  }, [students]);

  // Danh sách đề để chọn so sánh (lấy từ toàn bộ bài nộp, mỗi đề chỉ hiện 1 lần)
  const examOptionsForCompare = useMemo(() => {
    const map = new Map();
    allSubmissions.forEach((s) => {
      if (s.examId && !map.has(s.examId)) {
        map.set(s.examId, s.examTitle || s.examId);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [allSubmissions]);

  // Bảng xếp hạng so sánh điểm - theo đúng phạm vi (lớp/nhóm) + đề đã chọn
  const comparisonRows = useMemo(() => {
    let scopeStudentIds;
    if (compareScopeType === 'group') {
      const g = groups.find((grp) => grp.id === compareScopeValue);
      scopeStudentIds = new Set(g ? g.studentIds : []);
    } else {
      scopeStudentIds = new Set(
        (compareScopeValue === 'all'
          ? students
          : students.filter((s) => (s.className || '').trim() === compareScopeValue)
        ).map((s) => s.id)
      );
    }

    const relevantSubs = allSubmissions.filter(
      (s) => scopeStudentIds.has(s.studentId) && (compareExamId === 'all' || s.examId === compareExamId)
    );

    const byStudent = new Map();
    relevantSubs.forEach((s) => {
      if (!byStudent.has(s.studentId)) byStudent.set(s.studentId, []);
      byStudent.get(s.studentId).push(s);
    });

    const rows = [];
    byStudent.forEach((subs, studentId) => {
      const student = students.find((st) => st.id === studentId);
      if (!student) return;

      let score;
      let label;
      if (compareExamId === 'all') {
        score = subs.reduce((sum, s) => sum + (s.score || 0), 0) / subs.length;
        label = `Trung bình ${subs.length} đề`;
      } else {
        const latest = [...subs].sort((a, b) => (b.attempt || 1) - (a.attempt || 1))[0];
        score = latest.score || 0;
        label = `Lần ${latest.attempt || 1}`;
      }

      rows.push({ studentId, name: student.name, className: student.className, score, label });
    });

    rows.sort((a, b) => b.score - a.score);
    return rows;
  }, [allSubmissions, students, groups, compareExamId, compareScopeType, compareScopeValue]);

  // Load basic initial data (students + submissions)
  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const [stRes, subRes, groupsRes] = await Promise.all([
          api.get('/teacher/students'),
          api.get('/teacher/submissions'),
          api.get('/teacher/groups').catch(() => ({ data: [] })),
        ]);
        const stList = stRes.data || [];
        setStudents(stList);
        setAllSubmissions(subRes.data || []);
        setGroups(groupsRes.data || []);

        // Nếu được điều hướng tới kèm ?studentId=... (VD: bấm tên học sinh
        // từ trang "Quản lý học sinh") thì chọn sẵn đúng học sinh đó.
        const studentIdFromUrl = searchParams.get('studentId');
        if (studentIdFromUrl && stList.some((s) => s.id === studentIdFromUrl)) {
          setSelectedStudentId(studentIdFromUrl);
        } else if (stList.length > 0) {
          setSelectedStudentId(stList[0].id);
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách học sinh:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Filtered students according to class filter
  const filteredStudents = useMemo(() => {
    if (selectedClassFilter === 'all') return students;
    return students.filter((s) => (s.className || '').trim() === selectedClassFilter);
  }, [students, selectedClassFilter]);

  // Auto pick first student when class filter changes if current student is not in that class
  const handleClassFilterChange = (cls) => {
    setSelectedClassFilter(cls);
    const inCls = cls === 'all' ? students : students.filter((s) => (s.className || '').trim() === cls);
    if (inCls.length > 0 && !inCls.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(inCls[0].id);
    }
  };

  // Fetch single student stats when selectedStudentId changes
  useEffect(() => {
    setSelectedSubmissionId('all');
    if (!selectedStudentId) {
      setStudentStats(null);
      return;
    }

    async function fetchStudentStats() {
      setStudentStatsLoading(true);
      try {
        const res = await api.get(`/teacher/students/${selectedStudentId}/stats`);
        setStudentStats(res.data || null);
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu học sinh:', err);
        setStudentStats(null);
      } finally {
        setStudentStatsLoading(false);
      }
    }

    fetchStudentStats();
  }, [selectedStudentId]);

  // Submissions of selected student
  const studentSubmissions = useMemo(() => {
    if (!selectedStudentId) return [];
    return allSubmissions.filter((sub) => sub.studentId === selectedStudentId);
  }, [allSubmissions, selectedStudentId]);

  // Group submissions of selected student by exam
  const groupedSubmissions = useMemo(() => {
    if (!studentSubmissions || studentSubmissions.length === 0) return [];

    const groupsMap = {};
    studentSubmissions.forEach((sub) => {
      const key = sub.examId || sub.examTitle || 'unknown';
      if (!groupsMap[key]) {
        groupsMap[key] = {
          examId: sub.examId,
          examTitle: sub.examTitle || 'Đề thi trắc nghiệm',
          submissions: [],
        };
      }
      groupsMap[key].submissions.push(sub);
    });

    // Sort submissions within each group: newest attempt first (Lần 2, Lần 1...)
    Object.values(groupsMap).forEach((g) => {
      g.submissions.sort((a, b) => (b.attempt || 1) - (a.attempt || 1));
    });

    // Sort exam groups by latest submission date
    return Object.values(groupsMap).sort((a, b) => {
      const timeA = new Date(a.submissions[0]?.submittedAt || 0).getTime();
      const timeB = new Date(b.submissions[0]?.submittedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [studentSubmissions]);

  // Current selected student info
  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Active submission if a specific attempt is clicked
  const activeSubmission = useMemo(() => {
    if (!selectedSubmissionId || selectedSubmissionId === 'all') return null;
    return studentSubmissions.find((s) => s.id === selectedSubmissionId) || null;
  }, [studentSubmissions, selectedSubmissionId]);

  // Topic stats to display (either of the single attempt or all submissions)
  const displayedTopicStats = useMemo(() => {
    if (activeSubmission && activeSubmission.topicStats) {
      return activeSubmission.topicStats;
    }
    return studentStats?.allTopicStats || [];
  }, [activeSubmission, studentStats]);

  // Weak topics for highlight cards
  const displayedWeakTags = useMemo(() => {
    if (activeSubmission) {
      return (activeSubmission.weakTopics || []).map((wt) => ({
        tag: wt.tag,
        wrongRate: wt.wrongRate,
        totalWrong: wt.totalWrong,
        totalAnswered: wt.totalAnswered,
      }));
    }
    return studentStats?.weakTags || [];
  }, [activeSubmission, studentStats]);

  // Average score of selected student
  const avgScore = useMemo(() => {
    if (studentSubmissions.length === 0) return null;
    const total = studentSubmissions.reduce((acc, cur) => acc + (cur.score || 0), 0);
    return (total / studentSubmissions.length).toFixed(1);
  }, [studentSubmissions]);

  return (
    <div className="container" style={{ maxWidth: 1200, paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">📊 Giám sát chất lượng học sinh</h1>
          <p className="page-subtitle">
            Theo dõi tiến độ và đánh giá năng lực học sinh
          </p>
        </div>
      </div>

      {/* So sánh điểm giữa học sinh - theo lớp/nhóm + chọn đề */}
      <div
        className="card"
        style={{
          padding: '18px 20px',
          marginBottom: 20,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>🏆 So sánh điểm giữa học sinh</h2>
        </div>

        {/* Bộ lọc: đề + phạm vi (lớp/nhóm) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <select
            value={compareExamId}
            onChange={(e) => setCompareExamId(e.target.value)}
            style={{ width: 'auto', minWidth: 220, padding: '8px 12px', fontSize: 13 }}
          >
            <option value="all">📊 Điểm trung bình mọi đề</option>
            {examOptionsForCompare.map((ex) => (
              <option key={ex.id} value={ex.id}>📝 {ex.title}</option>
            ))}
          </select>

          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: 4, borderRadius: 20, border: '1px solid #e2e8f0', gap: 4 }}>
            <button
              type="button"
              onClick={() => { setCompareScopeType('class'); setCompareScopeValue('all'); }}
              className={`btn sm ${compareScopeType === 'class' ? '' : 'secondary'}`}
              style={{ borderRadius: 16, padding: '5px 14px' }}
            >
              🏫 Theo lớp
            </button>
            <button
              type="button"
              onClick={() => { setCompareScopeType('group'); setCompareScopeValue(groups[0]?.id || 'all'); }}
              className={`btn sm ${compareScopeType === 'group' ? '' : 'secondary'}`}
              style={{ borderRadius: 16, padding: '5px 14px' }}
              disabled={groups.length === 0}
              title={groups.length === 0 ? 'Chưa có nhóm nào - tạo ở mục Quản lý học sinh' : ''}
            >
              🗂️ Theo nhóm
            </button>
          </div>

          {compareScopeType === 'class' ? (
            <select
              value={compareScopeValue}
              onChange={(e) => setCompareScopeValue(e.target.value)}
              style={{ width: 'auto', minWidth: 160, padding: '8px 12px', fontSize: 13 }}
            >
              <option value="all">Tất cả lớp</option>
              {classesList.map((cls) => (
                <option key={cls} value={cls}>Lớp {cls}</option>
              ))}
            </select>
          ) : (
            <select
              value={compareScopeValue}
              onChange={(e) => setCompareScopeValue(e.target.value)}
              style={{ width: 'auto', minWidth: 160, padding: '8px 12px', fontSize: 13 }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Bảng xếp hạng */}
        {comparisonRows.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">Chưa có dữ liệu để so sánh</div>
            <p className="empty-state-desc">Chưa có học sinh nào trong phạm vi này nộp bài đề đã chọn.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comparisonRows.map((row, idx) => {
              const rank = idx + 1;
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
              const barPercent = Math.max(0, Math.min(100, (row.score / 10) * 100));
              return (
                <div
                  key={row.studentId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-light)',
                    background: rank <= 3 ? 'var(--gold-soft, #fef9ec)' : '#ffffff',
                  }}
                >
                  <div style={{ width: 28, textAlign: 'center', fontWeight: 800, fontSize: medal ? 18 : 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {medal || rank}
                  </div>
                  <Link
                    to={`/teacher/analytics?studentId=${row.studentId}`}
                    style={{ minWidth: 160, fontWeight: 700, fontSize: 13.5, color: 'var(--text-main)', textDecoration: 'none', flexShrink: 0 }}
                  >
                    {row.name}
                  </Link>
                  <span className="tag-badge" style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>
                    {row.className ? `Lớp ${row.className}` : 'Chưa phân lớp'}
                  </span>
                  <div style={{ flex: 1, minWidth: 80, height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${barPercent}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: row.score >= 5 ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)',
                      }}
                    />
                  </div>
                  <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
                    <strong style={{ fontSize: 14, color: row.score >= 5 ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)' }}>
                      {row.score.toFixed(1)}
                    </strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>/10</span>
                  </div>
                  <div style={{ width: 100, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                    {row.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter Control Bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: 20,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          {/* Class Filter helper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
              🏫 Lọc theo Lớp:
            </span>
            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: '4px',
                borderRadius: '30px',
                border: '1px solid #e2e8f0',
                gap: '4px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => handleClassFilterChange('all')}
                style={{
                  border: 'none',
                  borderRadius: '24px',
                  padding: '5px 14px',
                  fontSize: 12.5,
                  fontWeight: selectedClassFilter === 'all' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background:
                    selectedClassFilter === 'all'
                      ? 'var(--ink)'
                      : 'transparent',
                  color: selectedClassFilter === 'all' ? '#ffffff' : '#64748b',
                  boxShadow:
                    selectedClassFilter === 'all'
                      ? '0 2px 8px rgba(27,35,64,0.3)'
                      : 'none',
                }}
              >
                Tất cả ({students.length})
              </button>
              {classesList.map((cls) => {
                const count = students.filter((s) => (s.className || '').trim() === cls).length;
                const isSelected = selectedClassFilter === cls;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => handleClassFilterChange(cls)}
                    style={{
                      border: 'none',
                      borderRadius: '24px',
                      padding: '5px 14px',
                      fontSize: 12.5,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: isSelected
                        ? 'var(--primary)'
                        : 'transparent',
                      color: isSelected ? '#ffffff' : '#64748b',
                      boxShadow: isSelected
                        ? '0 2px 8px rgba(138,97,31,0.3)'
                        : 'none',
                    }}
                  >
                    Lớp {cls} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Student Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              👤 Học sinh:
            </label>
            <select
              className="input-field"
              style={{
                minWidth: 160,
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: '1.5px solid #cbd5e1',
              }}
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              {filteredStudents.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {selectedClassFilter === 'all' && st.className ? `[Lớp ${st.className}]` : ''}
                </option>
              ))}
              {filteredStudents.length === 0 && <option value="">Không có học sinh</option>}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Individual Student Quality Profile */}
      <div>
        {loading || studentStatsLoading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Đang tải hồ sơ học sinh...</div>
          </div>
        ) : !currentStudent ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <div className="empty-state-title">Vui lòng chọn một học sinh</div>
            </div>
          </div>
        ) : (
          <>
            {/* Student Summary Card */}
            <div
              className="card"
              style={{
                marginBottom: 20,
                background: 'linear-gradient(135deg, rgba(27,35,64,0.05) 0%, rgba(138,97,31,0.08) 100%)',
                borderColor: 'rgba(138,97,31,0.2)',
                padding: '16px 20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                      {currentStudent.name}
                    </h2>
                    {currentStudent.className && (
                      <span
                        style={{
                          background: 'var(--primary)',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 12,
                        }}
                      >
                        Lớp {currentStudent.className}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
                      {studentSubmissions.length}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                      Bài thi đã nộp
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: avgScore >= 8 ? 'var(--success)' : avgScore >= 5 ? '#f59e0b' : 'var(--danger)',
                      }}
                    >
                      {avgScore !== null ? `${avgScore}/10` : 'Chưa có'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                      Điểm trung bình
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: (studentStats?.weakTags?.length || 0) > 0 ? 'var(--danger)' : 'var(--success)',
                      }}
                    >
                      {studentStats?.weakTags?.length || 0}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                      Chuyên đề cần phụ đạo
                    </div>
                  </div>
                </div>
              </div>

              {/* Weak Tags Highlight Cards */}
              {displayedWeakTags && displayedWeakTags.length > 0 && (
                <div
                  style={{
                    marginTop: 18,
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(254,242,242,0.9) 0%, rgba(255,237,237,0.8) 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    boxShadow: '0 1px 4px rgba(239, 68, 68, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>⚠️</span>
                      <strong style={{ fontSize: 13, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        Chuyên đề hổng kiến thức {activeSubmission ? `(Lần ${activeSubmission.attempt || 1})` : 'cần lưu ý'}:
                      </strong>
                    </div>
                    {activeSubmission && (
                      <span style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                        Lọc theo Lần {activeSubmission.attempt || 1}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                    {displayedWeakTags.map((wt) => {
                      const percent = Math.round(wt.wrongRate * 100);
                      return (
                        <div
                          key={wt.tag}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#ffffff',
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--text-main)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={wt.tag}
                            >
                              {wt.tag}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#dc2626',
                              background: 'rgba(239,68,68,0.1)',
                              padding: '2px 8px',
                              borderRadius: 12,
                              whiteSpace: 'nowrap',
                              marginLeft: 8,
                            }}
                          >
                            Sai {percent}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Submissions of this student with direct link to AI */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div
                className="card-header"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>📑 Lịch sử bài làm</h2>

                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {selectedSubmissionId !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedSubmissionId('all')}
                      className="btn sm secondary"
                      style={{
                        fontSize: 12,
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontWeight: 600,
                      }}
                    >
                      🌐 Xem tổng hợp tất cả lần
                    </button>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Tổng cộng: <strong>{studentSubmissions.length}</strong> bài nộp
                  </span>
                </div>
              </div>

              {studentSubmissions.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 16px' }}>
                  <div className="empty-state-icon">📭</div>
                  <div className="empty-state-title">Học sinh này chưa nộp bài thi nào</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {groupedSubmissions.map((group) => {
                    const latestAttempt = group.submissions[0];
                    const firstAttempt = group.submissions[group.submissions.length - 1];
                    const attemptsCount = group.submissions.length;
                    const scoreDiff = (latestAttempt.score - firstAttempt.score).toFixed(1);

                    return (
                      <div
                        key={group.examId || group.examTitle}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 12,
                          background: '#ffffff',
                          overflow: 'hidden',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                        }}
                      >
                        {/* Exam Title & Progress Header */}
                        <div
                          style={{
                            padding: '12px 18px',
                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 16 }}>📑</span>
                            <strong style={{ fontSize: 15, color: '#0f172a' }}>
                              {group.examTitle}
                            </strong>
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: '#4f46e5',
                                background: '#ede9fe',
                                padding: '2px 8px',
                                borderRadius: 10,
                              }}
                            >
                              {attemptsCount} đợt làm
                            </span>
                          </div>

                          {attemptsCount > 1 && (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                padding: '4px 12px',
                                borderRadius: 20,
                                fontSize: 12,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                              }}
                            >
                              <span style={{ color: '#64748b' }}>
                                L1: <strong style={{ color: '#334155' }}>{firstAttempt.score}đ</strong>
                              </span>
                              <span style={{ color: '#94a3b8' }}>➔</span>
                              <span style={{ fontWeight: 700, color: latestAttempt.score >= 5 ? '#16a34a' : '#dc2626' }}>
                                L{attemptsCount}: <strong style={{ fontSize: 13 }}>{latestAttempt.score}đ</strong>
                              </span>
                              {parseFloat(scoreDiff) > 0 ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: '#15803d',
                                    background: '#dcfce7',
                                    padding: '2px 6px',
                                    borderRadius: 8,
                                  }}
                                >
                                  🚀 +{scoreDiff}đ
                                </span>
                              ) : parseFloat(scoreDiff) < 0 ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#b91c1c',
                                    background: '#fee2e2',
                                    padding: '2px 6px',
                                    borderRadius: 8,
                                  }}
                                >
                                  📉 {scoreDiff}đ
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>

                        {/* Attempts Table */}
                        <div className="table-responsive" style={{ margin: 0 }}>
                          <table style={{ margin: 0, width: '100%' }}>
                            <thead>
                              <tr style={{ background: '#fafbfc' }}>
                                <th style={{ width: 140, padding: '9px 16px', fontSize: 12, color: '#64748b' }}>Đợt làm</th>
                                <th style={{ width: 120, padding: '9px 16px', fontSize: 12, color: '#64748b' }}>Điểm số</th>
                                <th style={{ width: 180, padding: '9px 16px', fontSize: 12, color: '#64748b' }}>Kết quả làm bài</th>
                                <th style={{ padding: '9px 16px', fontSize: 12, color: '#64748b' }}>Thời gian nộp</th>
                                <th style={{ width: 160, textAlign: 'center', padding: '9px 16px', fontSize: 12, color: '#64748b' }}>Chẩn đoán AI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.submissions.map((sub, idx) => {
                                const isSelected = selectedSubmissionId === sub.id;
                                const score = sub.score !== undefined ? sub.score : 0;
                                let scoreColor = '#dc2626';
                                let scoreBg = '#fee2e2';
                                let scoreBorder = '#fecaca';
                                if (score >= 8) {
                                  scoreColor = '#16a34a';
                                  scoreBg = '#dcfce7';
                                  scoreBorder = '#bbf7d0';
                                } else if (score >= 5) {
                                  scoreColor = '#d97706';
                                  scoreBg = '#fef3c7';
                                  scoreBorder = '#fde68a';
                                }

                                return (
                                  <tr
                                    key={sub.id}
                                    onClick={() => setSelectedSubmissionId(isSelected ? 'all' : sub.id)}
                                    style={{
                                      cursor: 'pointer',
                                      background: isSelected ? 'rgba(138,97,31,0.08)' : idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                                      transition: 'all 0.15s ease',
                                      borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                                    }}
                                    title="Click để lọc thống kê chuyên đề theo đợt làm này"
                                  >
                                    <td style={{ padding: '12px 16px' }}>
                                      <span
                                        style={{
                                          background: isSelected ? 'var(--primary)' : '#f1f5f9',
                                          color: isSelected ? '#ffffff' : '#334155',
                                          fontWeight: 700,
                                          padding: '3px 10px',
                                          borderRadius: 14,
                                          fontSize: 12,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          boxShadow: isSelected ? '0 2px 6px rgba(138,97,31,0.3)' : 'none',
                                        }}
                                      >
                                        Lần {sub.attempt || (group.submissions.length - idx)}
                                        {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          fontWeight: 800,
                                          fontSize: 13.5,
                                          color: scoreColor,
                                          background: scoreBg,
                                          border: `1px solid ${scoreBorder}`,
                                          padding: '3px 10px',
                                          borderRadius: 6,
                                        }}
                                      >
                                        {score} / 10
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#334155', fontWeight: 600 }}>
                                      Đúng {sub.correctCount || 0}/{sub.totalQuestions || sub.totalCount || 0} câu
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#64748b' }}>
                                      🕒 {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : '---'}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                                      <Link
                                        to={`/teacher/exams/${sub.examId}/submissions/${sub.id}`}
                                        className="btn sm"
                                        style={{
                                          padding: '5px 14px',
                                          fontSize: 12,
                                          fontWeight: 700,
                                          borderRadius: 6,
                                          whiteSpace: 'nowrap',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          background: 'var(--primary)',
                                          color: '#fff',
                                          boxShadow: '0 2px 5px rgba(138,97,31,0.25)',
                                        }}
                                      >
                                        ✨ Xem bài & AI ➔
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Student Weak Topics (Xuống DƯỚI lịch sử bài làm - Đồng bộ theo lần thi đã chọn) */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 style={{ margin: 0 }}>
                    📊 Thống kê theo chuyên đề
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {activeSubmission ? (
                      <>
                        Đợt làm: <strong style={{ color: 'var(--primary)' }}>{activeSubmission.examTitle || 'Đề thi'} - Lần {activeSubmission.attempt || 1}</strong> ({activeSubmission.score}/10đ)
                      </>
                    ) : (
                      `Tổng hợp tất cả (${studentSubmissions.length} bài thi đã nộp)`
                    )}
                  </p>
                </div>
                {activeSubmission ? (
                  <button
                    type="button"
                    onClick={() => setSelectedSubmissionId('all')}
                    className="btn sm secondary"
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}
                  >
                    🌐 Xem tất cả
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--primary)',
                      background: 'rgba(138,97,31,0.08)',
                      border: '1px solid rgba(138,97,31,0.25)',
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontWeight: 600,
                    }}
                  >
                    🌐 Toàn bộ các lần làm (Tổng hợp)
                  </span>
                )}
              </div>

              {activeSubmission && activeSubmission.score === 10 && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.1) 100%)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#065f46',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>🎉</span>
                  <span>Học sinh đạt điểm tuyệt đối 10/10 ở lần làm này! Tất cả câu hỏi đều làm đúng.</span>
                </div>
              )}

              {displayedTopicStats && displayedTopicStats.length > 0 ? (
                <WeakTopicsChart data={displayedTopicStats} />
              ) : (
                <div className="empty-state" style={{ padding: '30px 16px' }}>
                  <div className="empty-state-icon">📝</div>
                  <div className="empty-state-title">Chưa có dữ liệu thống kê chuyên đề cho lượt làm này</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
