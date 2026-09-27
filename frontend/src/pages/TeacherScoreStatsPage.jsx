import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function TeacherScoreStatsPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [groups, setGroups] = useState([]);

  // So sánh điểm giữa học sinh (theo lớp/nhóm + chọn đề)
  const [compareExamId, setCompareExamId] = useState('all');
  const [compareScopeType, setCompareScopeType] = useState('class'); // 'class' | 'group'
  const [compareScopeValue, setCompareScopeValue] = useState('all');

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

  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const [stRes, subRes, groupsRes] = await Promise.all([
          api.get('/teacher/students'),
          api.get('/teacher/submissions'),
          api.get('/teacher/groups').catch(() => ({ data: [] })),
        ]);
        setStudents(stRes.data || []);
        setAllSubmissions(subRes.data || []);
        setGroups(groupsRes.data || []);
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu thống kê điểm số:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  return (
    <div className="container" style={{ maxWidth: 1200, paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">🏆 Thống kê điểm số</h1>
          <p className="page-subtitle">
            So sánh điểm giữa các học sinh theo lớp, theo nhóm hoặc theo từng đề
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải dữ liệu...</div>
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: '18px 20px',
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
      )}
    </div>
  );
}
