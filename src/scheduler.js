const msInHour = 60 * 60 * 1000;

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
