/* Pure geometry, shared by the browser and Node tests. Local wall-clock minutes. */
(function (root) {
  'use strict';
  function segments(events, date) {
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const next = new Date(midnight); next.setDate(next.getDate() + 1);
    const minute = d => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    return events.filter(e => !e.all_day).flatMap(event => {
      const start = new Date(event.occurrence_start), end = new Date(event.occurrence_end);
      if (start >= next || end <= midnight || end <= start) return [];
      const from = start < midnight ? 0 : minute(start);
      const to = end >= next ? 1440 : minute(end);
      // Repeated wall-clock hour during autumn DST cannot be represented twice on a 24h grid.
      return [{ event, from, to: Math.min(1440, Math.max(from + 1, to)) }];
    });
  }
  function layout(events, date) {
    const items = segments(events, date).sort((a, b) => a.from - b.from || b.to - a.to || a.event.id - b.event.id);
    let group = [], ends = [], groupEnd = -1;
    function flush() { for (const item of group) item.columns = ends.length; group = []; ends = []; }
    for (const item of items) {
      if (item.from >= groupEnd) { flush(); groupEnd = -1; }
      let column = ends.findIndex(end => end <= item.from);
      if (column < 0) column = ends.length;
      ends[column] = item.to;
      item.column = column; group.push(item); groupEnd = Math.max(groupEnd, item.to);
    }
    flush(); return items;
  }
  const api = { segments, layout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalendarLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
