(() => {
  const PAY_PER_HOUR = 10;
  const STORAGE_KEY = "farm-work-tracker-data-v1";

  const state = {
    entries: [],
    activeStart: null,
    timerId: null,
  };

  const els = {
    activeTimer: document.getElementById("activeTimer"),
    activeNote: document.getElementById("activeNote"),
    startBtn: document.getElementById("startBtn"),
    stopBtn: document.getElementById("stopBtn"),
    historyStart: document.getElementById("historyStart"),
    historyEnd: document.getElementById("historyEnd"),
    historyNote: document.getElementById("historyNote"),
    addHistoryBtn: document.getElementById("addHistoryBtn"),
    totalHours: document.getElementById("totalHours"),
    totalMoney: document.getElementById("totalMoney"),
    avgHours: document.getElementById("avgHours"),
    sessionCount: document.getElementById("sessionCount"),
    entriesBody: document.getElementById("entriesBody"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    printBtn: document.getElementById("printBtn"),
    clearBtn: document.getElementById("clearBtn"),
    status: document.getElementById("status"),
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.entries)) return;
      state.entries = data.entries.filter((entry) => isValidEntry(entry));
      state.activeStart = typeof data.activeStart === "string" ? data.activeStart : null;
      if (typeof data.activeNote === "string") {
        els.activeNote.value = data.activeNote;
      }
    } catch {
      setStatus("Couldn't load saved data.");
    }
  }

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        entries: state.entries,
        activeStart: state.activeStart,
        activeNote: els.activeNote.value,
      }),
    );
  }

  function isValidEntry(entry) {
    if (!entry || typeof entry !== "object") return false;
    const start = new Date(entry.start).getTime();
    const end = new Date(entry.end).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  }

  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function formatHours(ms) {
    return (ms / 3600000).toFixed(2);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount);
  }

  function parseLocalDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function entryDurationMs(entry) {
    return new Date(entry.end).getTime() - new Date(entry.start).getTime();
  }

  function setStatus(message) {
    els.status.textContent = message;
  }

  function updateTimer() {
    if (!state.activeStart) {
      els.activeTimer.textContent = "00:00:00";
      return;
    }
    const elapsed = Date.now() - new Date(state.activeStart).getTime();
    els.activeTimer.textContent = formatDuration(Math.max(elapsed, 0));
  }

  function syncActiveControls() {
    const active = Boolean(state.activeStart);
    els.startBtn.disabled = active;
    els.stopBtn.disabled = !active;
    updateTimer();

    clearInterval(state.timerId);
    state.timerId = null;
    if (active) {
      state.timerId = setInterval(updateTimer, 1000);
    }
  }

  function renderSummary() {
    const totalMs = state.entries.reduce((sum, entry) => sum + entryDurationMs(entry), 0);
    const totalHours = totalMs / 3600000;

    const byDay = new Map();
    for (const entry of state.entries) {
      const day = new Date(entry.start).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + entryDurationMs(entry));
    }

    const avgHours = byDay.size ? totalHours / byDay.size : 0;

    els.totalHours.textContent = totalHours.toFixed(2);
    els.totalMoney.textContent = formatCurrency(totalHours * PAY_PER_HOUR);
    els.avgHours.textContent = avgHours.toFixed(2);
    els.sessionCount.textContent = String(state.entries.length);
  }

  function renderEntries() {
    if (!state.entries.length) {
      els.entriesBody.innerHTML = `<tr><td colspan="6">No entries yet.</td></tr>`;
      return;
    }

    const sorted = [...state.entries].sort((a, b) => new Date(b.start) - new Date(a.start));
    els.entriesBody.innerHTML = sorted
      .map((entry) => {
        const start = new Date(entry.start);
        const end = new Date(entry.end);
        const id = String(entry.id);
        return `<tr>
          <td>${start.toLocaleDateString()}</td>
          <td>${start.toLocaleTimeString()}</td>
          <td>${end.toLocaleTimeString()}</td>
          <td>${formatHours(entryDurationMs(entry))}</td>
          <td>${escapeHtml(entry.note || "")}</td>
          <td><button data-delete-id="${id}">Delete</button></td>
        </tr>`;
      })
      .join("");
  }

  function renderAll() {
    renderSummary();
    renderEntries();
    syncActiveControls();
    saveState();
  }

  function addEntry(startIso, endIso, note) {
    const entry = {
      id: crypto.randomUUID(),
      start: startIso,
      end: endIso,
      note: (note || "").trim(),
    };
    if (!isValidEntry(entry)) {
      setStatus("Entry must have a valid start and end time.");
      return false;
    }
    state.entries.push(entry);
    setStatus("Entry saved.");
    renderAll();
    return true;
  }

  function escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function exportCsv() {
    if (!state.entries.length) {
      setStatus("Nothing to export yet.");
      return;
    }

    const rows = [["Date", "Start", "End", "Hours", "Money", "Note"]];
    const sorted = [...state.entries].sort((a, b) => new Date(a.start) - new Date(b.start));

    for (const entry of sorted) {
      const start = new Date(entry.start);
      const end = new Date(entry.end);
      const hours = entryDurationMs(entry) / 3600000;
      rows.push([
        start.toISOString().slice(0, 10),
        start.toLocaleTimeString(),
        end.toLocaleTimeString(),
        hours.toFixed(2),
        (hours * PAY_PER_HOUR).toFixed(2),
        entry.note || "",
      ]);
    }

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "farm-work-log.csv";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("CSV exported.");
  }

  function printReport() {
    const sorted = [...state.entries].sort((a, b) => new Date(a.start) - new Date(b.start));
    const totalHours = state.entries.reduce((sum, entry) => sum + entryDurationMs(entry), 0) / 3600000;
    const html = `<!doctype html><html><head><title>Farm Work Report</title>
      <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:6px;text-align:left}
      </style></head><body>
      <h1>Farm Work Report</h1>
      <p>Total Hours: ${totalHours.toFixed(2)} | Money: ${formatCurrency(totalHours * PAY_PER_HOUR)}</p>
      <table><thead><tr><th>Date</th><th>Start</th><th>End</th><th>Hours</th><th>Note</th></tr></thead>
      <tbody>
      ${sorted
        .map((entry) => {
          const start = new Date(entry.start);
          const end = new Date(entry.end);
          return `<tr><td>${start.toLocaleDateString()}</td><td>${start.toLocaleTimeString()}</td><td>${end.toLocaleTimeString()}</td><td>${formatHours(
            entryDurationMs(entry),
          )}</td><td>${escapeHtml(entry.note || "")}</td></tr>`;
        })
        .join("")}
      </tbody></table>
      </body></html>`;

    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      setStatus("Popup blocked. Please allow popups to print.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    setStatus("Print dialog opened.");
  }

  els.startBtn.addEventListener("click", () => {
    if (state.activeStart) return;
    state.activeStart = new Date().toISOString();
    setStatus("Work session started.");
    renderAll();
  });

  els.stopBtn.addEventListener("click", () => {
    if (!state.activeStart) return;
    const started = state.activeStart;
    const ended = new Date().toISOString();
    const note = els.activeNote.value;
    const ok = addEntry(started, ended, note);
    if (!ok) return;
    state.activeStart = null;
    els.activeNote.value = "";
    renderAll();
  });

  els.addHistoryBtn.addEventListener("click", () => {
    const start = parseLocalDateTime(els.historyStart.value);
    const end = parseLocalDateTime(els.historyEnd.value);
    if (!start || !end) {
      setStatus("Please enter valid start and end values.");
      return;
    }
    const note = els.historyNote.value;
    const ok = addEntry(start, end, note);
    if (!ok) return;
    els.historyStart.value = "";
    els.historyEnd.value = "";
    els.historyNote.value = "";
  });

  els.entriesBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-delete-id]");
    if (!button) return;
    const id = button.dataset.deleteId;
    state.entries = state.entries.filter((entry) => String(entry.id) !== id);
    setStatus("Entry deleted.");
    renderAll();
  });

  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.printBtn.addEventListener("click", printReport);

  els.clearBtn.addEventListener("click", () => {
    if (!confirm("Clear all saved entries?")) return;
    state.entries = [];
    state.activeStart = null;
    els.activeNote.value = "";
    setStatus("All entries cleared.");
    renderAll();
  });

  els.activeNote.addEventListener("input", saveState);

  loadState();
  renderAll();
})();
