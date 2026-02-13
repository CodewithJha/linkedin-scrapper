const msInHour = 60 * 60 * 1000;
const msInMinute = 60 * 1000;
const msInDay = 24 * msInHour;
// IST is fixed at UTC+05:30 (no DST)
const IST_OFFSET_MINUTES = 330;

function pickGap(minHours, maxHours) {
  const min = Math.min(minHours, maxHours);
  const max = Math.max(minHours, maxHours);
  return min + Math.random() * (max - min);
}

export function buildScheduler({ sessionsPerDay, minGapHours, maxGapHours }, runFn) {
  let sessionsDoneToday = 0;
  let timer = null;

  const scheduleNext = (delayHours) => {
    const delayMs = delayHours * msInHour;
    timer = setTimeout(async () => {
      await runFn();
      sessionsDoneToday += 1;
      const now = new Date();

      if (sessionsDoneToday >= sessionsPerDay) {
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const hoursUntilMidnight = (midnight.getTime() - now.getTime()) / msInHour;
        sessionsDoneToday = 0;
        scheduleNext(hoursUntilMidnight + pickGap(minGapHours, maxGapHours));
      } else {
        scheduleNext(pickGap(minGapHours, maxGapHours));
      }
    }, delayMs);
  };

  const start = () => {
    const initialGap = pickGap(minGapHours, maxGapHours);
    scheduleNext(initialGap);
  };

  const stop = () => {
    if (timer) clearTimeout(timer);
  };

  return { start, stop };
}

function parseTimeHHMM(value, fallback = { hour: 10, minute: 0 }) {
  if (typeof value !== 'string') return fallback;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return { hour, minute };
}

function msUntilNextIstTime({ hour, minute }, now = new Date()) {
  const istTotalMinutes = hour * 60 + minute;
  // Convert IST clock time to UTC clock time (in minutes since 00:00 UTC)
  let utcTotalMinutes = istTotalMinutes - IST_OFFSET_MINUTES;
  utcTotalMinutes = ((utcTotalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);

  const utcHour = Math.floor(utcTotalMinutes / 60);
  const utcMinute = utcTotalMinutes % 60;

  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();
  let targetUtcMs = Date.UTC(y, mo, d, utcHour, utcMinute, 0, 0);
  const nowMs = now.getTime();
  if (nowMs >= targetUtcMs) targetUtcMs += msInDay;
  return Math.max(0, targetUtcMs - nowMs);
}

export function buildDailyIstScheduler({ istTime = '10:00' } = {}, runFn) {
  let timer = null;

  const scheduleNext = () => {
    const { hour, minute } = parseTimeHHMM(istTime, { hour: 10, minute: 0 });
    const delayMs = msUntilNextIstTime({ hour, minute });

    timer = setTimeout(async () => {
      try {
        await runFn();
      } finally {
        // Recompute next run based on the current time to avoid drift.
        scheduleNext();
      }
    }, delayMs);
  };

  const start = () => {
    // Small jitter to avoid potential thundering herd if many instances start at once.
    const jitterMs = Math.floor(Math.random() * 15 * msInMinute);
    timer = setTimeout(() => scheduleNext(), jitterMs);
  };

  const stop = () => {
    if (timer) clearTimeout(timer);
  };

  return { start, stop };
}
