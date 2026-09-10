# CẤU TRÚC DỮ LIỆU (thay cho schema SQL)

Vì đồ án dùng file JSON thay cho SQL/PostgreSQL, mỗi file trong `data/` đóng
vai trò như một **bảng**. Mỗi phần tử trong mảng JSON là một **dòng (row)**.
Quan hệ giữa các "bảng" được thể hiện qua các trường `xxxId` tham chiếu chéo
(tương đương khóa ngoại - foreign key), thay vì `JOIN` thì code backend sẽ tự
lọc mảng theo id.

## Sơ đồ quan hệ (ERD dạng text)

```
users (1) ---- (N) exams            [exams.createdBy -> users.id]
users (N) ---- (N) exams            [exams.assignedTo: mảng studentId]
exams (1) ---- (N) questions        [questions.examId -> exams.id]
exams (1) ---- (N) submissions      [submissions.examId -> exams.id]
users (1) ---- (N) submissions      [submissions.studentId -> users.id]
submissions (1) -- (N) submission_answers [submission_answers.submissionId -> submissions.id]
questions (1) -- (N) submission_answers   [submission_answers.questionId -> questions.id]
users (1) ---- (N) student_topic_stats    [student_topic_stats.studentId -> users.id]
users (1) ---- (N) generated_exercises    [generated_exercises.studentId -> users.id]
```

## 1. `users.json` — Tài khoản giáo viên & học sinh

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | string | UUID, khóa chính |
| name | string | Họ tên |
| email | string | Dùng để đăng nhập, duy nhất |
| passwordHash | string | Băm bằng bcryptjs, KHÔNG lưu plaintext |
| role | 'teacher' \| 'student' | Phân quyền |
| className | string \| null | Chỉ áp dụng cho học sinh |
| createdAt | ISO date string | |

## 2. `exams.json` — Đề trắc nghiệm

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | string | UUID |
| title | string | Tên đề thi |
| description | string | |
| createdBy | string | FK -> `users.id` (giáo viên tạo đề) |
| assignedTo | string[] | Mảng FK -> `users.id` (học sinh được giao) |
| durationMinutes | number | Thời gian làm bài |
| status | 'draft' \| 'assigned' \| 'closed' | |
| createdAt | ISO date string | |

Câu hỏi của đề nằm ở `questions.json`, liên kết ngược qua `questions.examId`
(không nhúng trực tiếp mảng câu hỏi vào exam để tránh trùng lặp dữ liệu khi
sửa câu hỏi).

## 3. `questions.json` — Câu hỏi trắc nghiệm

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | string | UUID |
| examId | string | FK -> `exams.id` |
| content | string | Nội dung câu hỏi |
| options | {key: string, text: string}[] | Các phương án (A/B/C/D) |
| correctAnswer | string | key của đáp án đúng, ví dụ "B" |
| tags | string[] | Tag chủ đề/dạng bài, ví dụ ["Cực trị hàm số"] |
| difficulty | 'easy' \| 'medium' \| 'hard' | |
| createdAt | ISO date string | |

## 4. `submissions.json` — Lượt nộp bài của học sinh

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | string | UUID |
| examId | string | FK -> `exams.id` |
| studentId | string | FK -> `users.id` |
| totalQuestions | number | |
| correctCount | number | |
| score | number | Thang điểm 10, tính từ correctCount/totalQuestions |
| status | 'in_progress' \| 'submitted' \| 'graded' | |
| submittedAt | ISO date string \| null | |

Chi tiết từng câu trả lời nằm ở `submission_answers.json` (tách riêng để dễ
tính thống kê theo tag mà không phải parse nội dung lồng nhau).

## 5. `submission_answers.json` — Chi tiết từng câu trả lời

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | string | UUID |
| submissionId | string | FK -> `submissions.id` |
| questionId | string | FK -> `questions.id` |
| selectedAnswer | string \| null | key học sinh chọn, null nếu bỏ trống |
| isCorrect | boolean | |
| tags | string[] | Sao chép lại tags của câu hỏi tại thời điểm chấm, để thống kê không bị ảnh hưởng nếu sau này giáo viên sửa tag câu hỏi gốc |

## 6. `student_topic_stats.json` — Thống kê tỷ lệ sai theo chủ đề

Bảng tổng hợp (denormalized) được backend tính lại mỗi khi có bài nộp mới,
dùng để hiển thị biểu đồ và làm đầu vào cho việc xác định chủ đề yếu.

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | string | UUID, hoặc `${studentId}_${tag}` để dễ tra cứu |
| studentId | string | FK -> `users.id` |
| tag | string | Tên chủ đề |
| totalAnswered | number | Tổng số câu đã làm thuộc tag này |
| totalWrong | number | Tổng số câu sai thuộc tag này |
| wrongRate | number | `totalWrong / totalAnswered`, 0..1 |
| lastUpdated | ISO date string | |

**Ngưỡng số câu tối thiểu**: khi xác định "chủ đề yếu nhất", backend chỉ xét
các tag có `totalAnswered >= MIN_QUESTIONS_THRESHOLD` (đề xuất = 3) để tránh
kết luận sai lệch khi học sinh mới làm 1 câu.

## 7. `generated_exercises.json` — Roadmap & bài tập AI sinh ra

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | string | UUID |
| studentId | string | FK -> `users.id` |
| weakTags | string[] | Các tag yếu dùng làm input cho Gemini |
| cacheKey | string | Hash của (studentId + weakTags đã sort) để tránh gọi API lặp lại |
| roadmap | object | Nội dung roadmap ôn tập do Gemini trả về (đã parse JSON) |
| exercises | object[] | Bài tập tương tự do Gemini sinh, mỗi phần tử có cấu trúc giống `questions.json` (content, options, correctAnswer, tags) nhưng chưa có `examId` |
| status | 'pending_review' \| 'approved' \| 'rejected' | Trạng thái duyệt của giáo viên |
| reviewedBy | string \| null | FK -> `users.id` (giáo viên duyệt) |
| generatedAt | ISO date string | |

Khi giáo viên duyệt (`status = 'approved'`), backend sẽ tạo một `exam` mới từ
`exercises` này và gán `assignedTo = [studentId]`, tái sử dụng luồng giao đề
bình thường thay vì tạo luồng riêng.
