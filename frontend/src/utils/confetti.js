// Pháo giấy màu vẽ trên <canvas> (không cần thư viện ngoài).
// Bắn 2 loạt từ 2 góc dưới lên giữa màn hình rồi rơi xuống, kèm mưa giấy từ
// trên. Trả về hàm dừng sớm.
const COLORS = ['#ffcf3f', '#f6a04d', '#2952d9', '#5b7cf0', '#e5484d', '#ff8fa3', '#34c48b', '#a78bfa'];

export function launchConfetti(canvas, { duration = 3800 } = {}) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  const make = (x, y, angle, speed) => ({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    w: rand(6, 11),
    h: rand(9, 16),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: rand(0, Math.PI * 2),
    vr: rand(-0.2, 0.2),
    wobble: rand(0, Math.PI * 2),
    vw: rand(0.08, 0.18),
    round: Math.random() < 0.25,
  });
  const cannon = (fromLeft) => {
    const x = fromLeft ? -10 : width + 10;
    const y = height * 0.85;
    for (let i = 0; i < 90; i += 1) {
      const angle = fromLeft ? rand(-1.35, -0.75) : rand(-2.4, -1.8);
      particles.push(make(x, y, angle, rand(11, 21)));
    }
  };
  const rain = () => {
    for (let i = 0; i < 70; i += 1) particles.push(make(rand(0, width), rand(-height * 0.4, -10), Math.PI / 2, rand(1, 4)));
  };

  cannon(true);
  cannon(false);
  const timers = [setTimeout(rain, 350), setTimeout(() => { cannon(true); cannon(false); }, 900)];

  const startedAt = performance.now();
  let frame;
  const step = (now) => {
    const elapsed = now - startedAt;
    const fade = elapsed > duration ? Math.max(0, 1 - (elapsed - duration) / 800) : 1;
    ctx.clearRect(0, 0, width, height);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.32;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.wobble += p.vw;
      if (p.y > height + 30) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.wobble)); // lật mảnh giấy cho giống đang bay
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (fade > 0 && (particles.length > 0 || elapsed < 1000)) frame = requestAnimationFrame(step);
    else ctx.clearRect(0, 0, width, height);
  };
  frame = requestAnimationFrame(step);

  return () => {
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    window.removeEventListener('resize', resize);
    ctx.clearRect(0, 0, width, height);
  };
}
