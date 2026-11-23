/* =========================================================================
   Forge UI  v1.0  ·  behaviors that go with forge-ui.css. No dependencies.
   Usage: <script src="forge-ui.js"></script>, then call FUI.* (see DESIGN.md).
   ========================================================================= */
(function (global) {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Star rating (1–5) ----------
     FUI.stars(el, { value, onChange(n|0), readOnly, team: { avg, count }, label })
     Click a star to set; click the current value again to clear (0). Arrow keys move, Delete/0 clears.
     Returns { set(n), get() }. */
  function stars(el, opts = {}) {
    let value = Number(opts.value) || 0;
    const ro = Boolean(opts.readOnly);
    function draw() {
      const team = opts.team && opts.team.count ? `<span class="avg" title="Team average of ${opts.team.count} rating${opts.team.count > 1 ? "s" : ""}">Team ${Number(opts.team.avg).toFixed(1)} · ${opts.team.count}</span>` : opts.team ? `<span class="avg">Team: no ratings</span>` : "";
      el.className = "stars" + (ro ? " ro" : "");
      el.setAttribute("role", "radiogroup");
      el.setAttribute("aria-label", opts.label || "Rating");
      el.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${n === value}" class="${n <= value ? "on" : ""}" data-n="${n}" ${ro ? "disabled" : ""} tabindex="${(value ? n === value : n === 1) ? 0 : -1}" title="${ro ? `${value || "No"} star rating` : n === value ? "Click again to clear" : `Rate ${n} star${n > 1 ? "s" : ""}`}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("") + team;
    }
    function apply(n, fire = true) {
      const hadFocus = el.contains(document.activeElement);   // redraw replaces the buttons, so restore keyboard focus
      value = n; draw(); if (fire && opts.onChange) opts.onChange(value);
      const f = el.querySelector(`[data-n="${value || 1}"]`); if (f && hadFocus) f.focus();
    }
    el.addEventListener("click", (e) => { const b = e.target.closest("button[data-n]"); if (!b || ro) return; const n = Number(b.dataset.n); apply(n === value ? 0 : n); });
    el.addEventListener("keydown", (e) => {
      if (ro) return;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); apply(Math.min(5, value + 1)); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); if (value > 1) apply(value - 1); }
      else if (e.key === "Delete" || e.key === "Backspace" || e.key === "0") { e.preventDefault(); apply(0); }
      else if (/^[1-5]$/.test(e.key)) { e.preventDefault(); apply(Number(e.key)); }
    });
    draw();
    return { set: (n) => apply(Number(n) || 0, false), get: () => value };
  }

  /* ---------- Tag input (chips in a text box) ----------
     FUI.tagInput(el, { value: [], suggestions: [] | (q) => Promise<[]>, onChange(tags), placeholder, max, maxLength, allowNew })
     Enter, comma, Tab or semicolon adds; pasting "a, b; c" adds each; Backspace on empty removes the last chip;
     × removes one; duplicates are ignored (case-insensitive). Returns { get(), set(tags), add(tag) }. */
  function tagInput(el, opts = {}) {
    let tags = [...new Set((opts.value || []).map(String))];
    const max = opts.max || 60, maxLen = opts.maxLength || 80, allowNew = opts.allowNew !== false;
    el.classList.add("taginput");
    el.innerHTML = `<span class="chips-in"></span><input type="text" autocomplete="off" aria-label="${esc(opts.label || "Add a tag")}" placeholder="${esc(opts.placeholder || "Type and press Enter")}"><ul class="sugg" role="listbox" hidden></ul>`;
    const box = el.querySelector(".chips-in"), input = el.querySelector("input"), list = el.querySelector(".sugg");
    let sugg = [], sel = -1;
    const has = (t) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
    function draw() {
      box.innerHTML = tags.map((t, i) => `<span class="chip">${esc(t)}<button type="button" data-i="${i}" aria-label="Remove ${esc(t)}">×</button></span>`).join("");
      box.style.display = "contents";
    }
    function changed() { draw(); opts.onChange && opts.onChange([...tags]); }
    function add(raw) {
      let added = false;
      String(raw).split(/[,;\n]/).map((t) => t.trim().replace(/\s+/g, " ").slice(0, maxLen)).filter(Boolean).forEach((t) => {
        if (tags.length >= max || has(t)) return;
        if (!allowNew && !(Array.isArray(opts.suggestions) ? opts.suggestions : sugg).some((s) => s.toLowerCase() === t.toLowerCase())) return;
        tags.push(t); added = true;
      });
      if (added) changed();
      input.value = ""; hide();
    }
    function hide() { list.hidden = true; sel = -1; }
    async function suggest() {
      const q = input.value.trim().toLowerCase();
      const src = typeof opts.suggestions === "function" ? await opts.suggestions(q) : (opts.suggestions || []);
      sugg = src.filter((s) => !has(s) && (!q || s.toLowerCase().includes(q))).slice(0, 8);
      if (!sugg.length || (!q && !opts.showOnFocus)) return hide();
      list.innerHTML = sugg.map((s, i) => `<li role="option" data-i="${i}" aria-selected="${i === sel}">${esc(s)}</li>`).join("");
      list.hidden = false;
    }
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".chip button"); if (b) { tags.splice(Number(b.dataset.i), 1); changed(); input.focus(); return; }
      const li = e.target.closest(".sugg li"); if (li) { add(sugg[Number(li.dataset.i)]); input.focus(); return; }
      input.focus();
    });
    input.addEventListener("input", suggest);
    input.addEventListener("focus", () => opts.showOnFocus && suggest());
    input.addEventListener("blur", () => setTimeout(() => { if (input.value.trim() && allowNew) add(input.value); hide(); }, 150));
    input.addEventListener("paste", (e) => { const t = e.clipboardData?.getData("text") || ""; if (/[,;\n]/.test(t)) { e.preventDefault(); add(t); } });
    input.addEventListener("keydown", (e) => {
      if (!list.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + sugg.length) % sugg.length; [...list.children].forEach((li, i) => li.setAttribute("aria-selected", i === sel)); return; }
      if (e.key === "Enter" || e.key === "," || e.key === ";" || (e.key === "Tab" && input.value.trim())) {
        if (!input.value.trim() && sel < 0) return;
        e.preventDefault(); add(sel >= 0 ? sugg[sel] : input.value);
      } else if (e.key === "Backspace" && !input.value && tags.length) { tags.pop(); changed(); }
      else if (e.key === "Escape") hide();
    });
    draw();
    return { get: () => [...tags], set: (t) => { tags = [...new Set(t)]; draw(); }, add };
  }

  /* ---------- People picker ----------
     FUI.peoplePicker(el, { value: [ids], search(q) => Promise<[{id,name,avatarUrl}]>, me: {id,name}, names: {id:name}, onChange(ids) })
     Search the team directory, add as chips, "Assign to me" one-click. Store ids, never names. */
  function peoplePicker(el, opts = {}) {
    let ids = [...(opts.value || [])]; const names = Object.assign({}, opts.names || {});
    el.innerHTML = `<div class="people"></div><div class="picker"><input type="text" placeholder="Search the team by name…" autocomplete="off" aria-label="Add a person"><ul hidden></ul></div>`;
    const box = el.querySelector(".people"), input = el.querySelector("input"), list = el.querySelector("ul");
    function draw() {
      box.innerHTML = (ids.map((id) => `<span class="person">${esc(names[id] || "Team member")}<button type="button" data-rm="${esc(id)}" aria-label="Remove">×</button></span>`).join("") || `<span class="help">No one yet.</span>`)
        + (opts.me && !ids.includes(opts.me.id) ? ` <button type="button" class="btn-ghost btn-sm" data-me="1">+ Assign to me</button>` : "");
    }
    const changed = () => { draw(); opts.onChange && opts.onChange([...ids]); };
    input.addEventListener("input", async () => {
      const found = opts.search ? await opts.search(input.value.trim()) : [];
      found.forEach((p) => (names[p.id] = p.name));
      list.innerHTML = found.filter((p) => !ids.includes(p.id)).slice(0, 8).map((p) => `<li><button type="button" data-add="${esc(p.id)}">${p.avatarUrl ? `<img src="${esc(p.avatarUrl)}" alt="" width="20" height="20" style="border-radius:50%">` : ""}${esc(p.name)}</button></li>`).join("") || `<li class="help" style="padding:6px">No matches.</li>`;
      list.hidden = false;
    });
    input.addEventListener("focus", () => input.dispatchEvent(new Event("input")));
    document.addEventListener("click", (e) => { if (!el.contains(e.target)) list.hidden = true; });
    el.addEventListener("click", (e) => {
      const t = e.target.closest("button"); if (!t) return;
      if (t.dataset.rm) { ids = ids.filter((x) => x !== t.dataset.rm); changed(); }
      if (t.dataset.add) { ids.push(t.dataset.add); input.value = ""; list.hidden = true; changed(); }
      if (t.dataset.me) { names[opts.me.id] = opts.me.name || "You"; ids.push(opts.me.id); changed(); }
    });
    draw();
    return { get: () => [...ids], set: (v) => { ids = [...v]; draw(); } };
  }

  /* ---------- Confirm dialog (use for anything that overwrites or deletes) ----------
     await FUI.confirm({ title, body (HTML), ok: "Replace", cancel: "Cancel", danger: true }) -> true|false */
  function confirm({ title, body = "", ok = "Continue", cancel = "Cancel", danger = true } = {}) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog"); d.className = "fui-modal" + (danger ? " danger" : "");
      d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${body}<div class="btns"><button value="cancel" class="btn-ghost" autofocus>${esc(cancel)}</button><button value="ok" class="${danger ? "btn-danger" : "btn"}">${esc(ok)}</button></div></form>`;
      d.addEventListener("close", () => { resolve(d.returnValue === "ok"); d.remove(); });
      d.addEventListener("click", (e) => { if (e.target === d) d.close("cancel"); });
      document.body.append(d); d.showModal();
    });
  }

  /* ---------- Two-step remove ("Remove" → "Confirm remove" / "Cancel") ----------
     FUI.armRemove(button, onConfirm) for inline deletes that don't need a full dialog. */
  function armRemove(btn, onConfirm) {
    btn.addEventListener("click", function arm() {
      const wrap = document.createElement("span"); wrap.className = "armed";
      wrap.innerHTML = `<button type="button" class="btn-danger btn-sm">Confirm remove</button> <button type="button" class="btn-ghost btn-sm">Cancel</button>`;
      btn.replaceWith(wrap);
      const [yes, no] = wrap.querySelectorAll("button");
      yes.addEventListener("click", () => { onConfirm(); });
      no.addEventListener("click", () => wrap.replaceWith(btn));
    });
  }

  /* ---------- Toast ---------- */
  function toast(msg, ms = 2600) {
    const t = document.createElement("div"); t.className = "fui-toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.append(t); setTimeout(() => t.remove(), ms);
  }

  /* ---------- Theme and sidebar (preferences kept in this browser) ---------- */
  const pref = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { v == null || v === "" ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
  function theme(value) {   // "", "light" or "dark"; no argument re-applies the saved choice
    if (value !== undefined) pref.set("fui-theme", value);
    const t = pref.get("fui-theme", "");
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    return t;
  }
  function sidebar({ collapseButton, menuButton } = {}) {
    const root = document.documentElement;
    root.classList.toggle("fui-collapsed", pref.get("fui-side", "") === "icons");
    collapseButton?.addEventListener("click", () => { const c = !root.classList.contains("fui-collapsed"); root.classList.toggle("fui-collapsed", c); pref.set("fui-side", c ? "icons" : ""); });
    menuButton?.addEventListener("click", () => root.classList.toggle("fui-navopen"));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") root.classList.remove("fui-navopen"); });
  }

  /* ---------- Formatting ---------- */
  const money = (n) => n == null ? "—" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`;
  const dateCT = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) + " CT";
  const daysLeft = (iso) => { if (!iso) return null; const t = new Date(iso), n = new Date(); return Math.round((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); };
  const deadlineHtml = (iso) => { const d = daysLeft(iso); if (d === null) return `<span class="dl none">No deadline listed</span>`;
    const cls = d < 0 ? "none" : d < 30 ? "urgent" : d <= 90 ? "soon" : "ok", day = new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    return `<span class="dl ${cls}">${day} · ${d < 0 ? "closed" : d === 0 ? "today" : d + "d left"}</span>`; };
  const scoreHtml = (n, { pre = false } = {}) => n == null ? `<span class="note">—</span>` : `<span class="score ${n >= 8 ? "s8" : n >= 6 ? "s6" : n >= 4 ? "s4" : "s1"} ${pre ? "pre" : ""}">${n}/10${pre ? "*" : ""}</span>`;

  global.FUI = { esc, stars, tagInput, peoplePicker, confirm, armRemove, toast, theme, sidebar, pref, money, dateCT, daysLeft, deadlineHtml, scoreHtml, version: "1.0" };
})(window);
