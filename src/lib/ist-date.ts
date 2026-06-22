/** Today's calendar date in IST (YYYY-MM-DD). */
export function getTodayIstDate() {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + istOffsetMs).toISOString().slice(0, 10);
}
