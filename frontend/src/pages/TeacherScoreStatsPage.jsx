import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import UiIcon, { scoreLevel, formatScore } from '../components/UiIcon';

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

  const summary = (() => {
    if (comparisonRows.length === 0) return null;
    const scores = comparisonRows.map((r) => r.score);
    return {
      count: scores.length,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      max: Math.max(...scores),
      below5: scores.filter((x) => x < 5).length,
    };
  })();

  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Thống kê điểm số</h1>
          <p className="page-subtitle">So sánh điểm giữa các học sinh theo lớp, theo nhóm hoặc theo từng đề</p>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div className="empty-state-title">Đang tải dữ liệu…</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <h2>Bảng xếp hạng</h2>
              <p className="card-hint">
                {compareExamId === 'all'
                  ? 'Điểm trung bình của mỗi học sinh qua các đề đã nộp.'
                  : 'Điểm lần làm gần nhất của mỗi học sinh ở đề này.'}
              </p>
            </div>
          </div>

          <div className="toolbar" style={{ marginBottom: 16 }}>
            <label className="toolbar-field">
              Đề thi
              <select value={compareExamId} onChange={(e) => setCompareExamId(e.target.value)} style={{ minWidth: 220 }}>
                <option value="all">Trung bình mọi đề</option>
                {examOptionsForCompare.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.title}</option>
                ))}
              </select>
            </label>

            <div className="toolbar-spacer" />

            <div className="segmented" role="group" aria-label="Phạm vi so sánh">
              <button
                type="button"
                className={`segmented-btn${compareScopeType === 'class' ? ' is-active' : ''}`}
                aria-pressed={compareScopeType === 'class'}
                onClick={() => { setCompareScopeType('class'); setCompareScopeValue('all'); }}
              >
                Theo lớp
              </button>
              <button
                type="button"
                className={`segmented-btn${compareScopeType === 'group' ? ' is-active' : ''}`}
                aria-pressed={compareScopeType === 'group'}
                onClick={() => { setCompareScopeType('group'); setCompareScopeValue(groups[0]?.id || 'all'); }}
                disabled={groups.length === 0}
                title={groups.length === 0 ? 'Chưa có nhóm nào. Tạo nhóm ở mục Quản lý học sinh.' : undefined}
              >
                Theo nhóm
              </button>
            </div>

            {compareScopeType === 'class' ? (
              <select aria-label="Chọn lớp" value={compareScopeValue} onChange={(e) => setCompareScopeValue(e.target.value)}>
                <option value="all">Tất cả lớp</option>
                {classesList.map((cls) => (
                  <option key={cls} value={cls}>Lớp {cls}</option>
                ))}
              </select>
            ) : (
              <select aria-label="Chọn nhóm" value={compareScopeValue} onChange={(e) => setCompareScopeValue(e.target.value)}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          </div>

          {summary && (
            <div className="stat-strip">
              <div className="stat-item">
                <span className="stat-item-label">Học sinh</span>
                <span className="stat-item-value">{summary.count}</span>
              </div>
              <div className="stat-item">
                <span className="stat-item-label">Điểm trung bình</span>
                <span className={`stat-item-value score-text is-${scoreLevel(summary.avg)}`}>{summary.avg.toFixed(1)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-item-label">Cao nhất</span>
                <span className="stat-item-value">{formatScore(summary.max)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-item-label">Dưới 5 điểm</span>
                <span className={`stat-item-value${summary.below5 > 0 ? ' score-text is-low' : ''}`}>{summary.below5}</span>
              </div>
            </div>
          )}

          {comparisonRows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon is-svg"><UiIcon name="chart" size={22} /></div>
              <div className="empty-state-title">Chưa có bài nộp trong phạm vi này</div>
              <p className="empty-state-desc">Khi học sinh nộp bài, bảng xếp hạng sẽ hiện ở đây. Thử chọn lớp, nhóm hoặc đề khác.</p>
            </div>
          ) : (
            <ol className="rank-list">
              {comparisonRows.map((row, idx) => {
                const rank = idx + 1;
                const level = scoreLevel(row.score);
                const barPercent = Math.max(0, Math.min(100, (row.score / 10) * 100));
                return (
                  <li key={row.studentId} className="rank-row">
                    <span className={`rank-badge${rank <= 3 ? ` is-top${rank}` : ''}`}>{rank}</span>
                    <div className="rank-name">
                      <Link to={`/teacher/analytics?studentId=${row.studentId}`}>{row.name}</Link>
                      <span className="class-badge">{row.className ? `Lớp ${row.className}` : 'Chưa phân lớp'}</span>
                    </div>
                    <div className="score-bar rank-bar" aria-hidden="true">
                      <span className={`is-${level}`} style={{ width: `${barPercent}%` }} />
                    </div>
                    <span className={`rank-score score-text is-${level}`}>
                      {row.score.toFixed(1)}<small>/10</small>
                    </span>
                    <span className="rank-meta">{row.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
