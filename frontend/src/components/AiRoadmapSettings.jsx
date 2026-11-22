import UiIcon from './UiIcon';

// Cài đặt "Lộ trình ôn tập AI" của 1 đề thi (dùng ở form tạo đề và sửa đề):
// - Tích "AI tự gửi lộ trình" (mặc định): học sinh nộp bài có câu sai là AI
//   tự phân tích, soạn lộ trình và gửi thẳng cho học sinh kèm thông báo,
//   không cần giáo viên duyệt.
// - Bỏ tích: AI chỉ soạn khi giáo viên bấm, giáo viên duyệt rồi mới gửi.
// value = { aiRoadmapMode: 'auto' | 'review', aiRoadmapExercises: boolean }
export default function AiRoadmapSettings({ value, onChange, idPrefix = 'ai-roadmap' }) {
  const auto = value.aiRoadmapMode !== 'review';
  const withExercises = value.aiRoadmapExercises !== false;

  return (
    <fieldset className="ai-roadmap-settings">
      <legend>
        <UiIcon name="sparkles" size={15} className="ai-mark" /> Lộ trình ôn tập AI
      </legend>

      <label className={`check-row${auto ? ' is-checked' : ''}`} htmlFor={`${idPrefix}-auto`}>
        <input
          id={`${idPrefix}-auto`}
          type="checkbox"
          checked={auto}
          onChange={(e) => onChange({ ...value, aiRoadmapMode: e.target.checked ? 'auto' : 'review' })}
        />
        <span>
          <strong>AI tự gửi lộ trình ngay khi học sinh nộp bài</strong>
          <span>
            {auto
              ? 'Không cần giáo viên duyệt. Học sinh nhận thông báo khi AI phân tích xong lỗ hổng kiến thức.'
              : 'Đang tắt: giáo viên bấm phân tích bằng AI và duyệt lộ trình trước khi gửi cho học sinh.'}
          </span>
        </span>
      </label>

      {auto && (
        <label className={`check-row is-sub${withExercises ? ' is-checked' : ''}`} htmlFor={`${idPrefix}-exercises`}>
          <input
            id={`${idPrefix}-exercises`}
            type="checkbox"
            checked={withExercises}
            onChange={(e) => onChange({ ...value, aiRoadmapExercises: e.target.checked })}
          />
          <span>
            <strong>Giao kèm bài tập luyện tập</strong>
            <span>AI giao thêm đề câu hỏi tương tự theo từng chuyên đề còn yếu.</span>
          </span>
        </label>
      )}
    </fieldset>
  );
}
