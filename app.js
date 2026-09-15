/* NetCmd — Find. Fill. Copy. */

"use strict";

const COMMANDS_KEY = "netcmd.commands";
const CAT_STORAGE_KEY = "netcmd.categories";
const NAME_KEY = "netcmd.hideName";
const SCHEMA_KEY = "netcmd.schema";
const SCHEMA_VERSION = "2";

/*
 * Eye-friendly color presets. Backgrounds are very low alpha so the
 * command text always stays readable on top of the tint.
 */
const COLOR_PRESETS = [
  { key: "red",    label: "Red",    accent: "#b0524a", bg: "rgba(176, 82, 74, 0.07)" },
  { key: "green",  label: "Green",  accent: "#0e7a5f", bg: "rgba(14, 122, 95, 0.05)" },
  { key: "blue",   label: "Blue",   accent: "#3a6ea5", bg: "rgba(58, 110, 165, 0.06)" },
  { key: "amber",  label: "Amber",  accent: "#a97b12", bg: "rgba(169, 123, 18, 0.07)" },
  { key: "purple", label: "Purple", accent: "#7a5ea8", bg: "rgba(122, 94, 168, 0.06)" },
  { key: "teal",   label: "Teal",   accent: "#0e7f8c", bg: "rgba(14, 127, 140, 0.05)" },
  { key: "gray",   label: "Gray",   accent: "#666666", bg: "rgba(102, 102, 102, 0.05)" },
];
const colorByKey = key =>
  COLOR_PRESETS.find(c => c.key === key) || COLOR_PRESETS[COLOR_PRESETS.length - 1];

/*
 * Factory defaults. These only seed a fresh browser (or a storage reset).
 * From then on every command and category lives in localStorage and is
 * edited through the UI — the seed never overrides user data.
 */
const SEED_CATEGORIES = [
  { id: "h3c", name: "H3C", color: "red", builtin: true },
  { id: "ib",  name: "IB",  color: "green", builtin: true },
];

const SEED_COMMANDS = [
  /* ---- H3C ---- */
  { cat: "h3c", name: "Routing table",         template: "display ip routing-table" },
  { cat: "h3c", name: "Current config",        template: "display current-configuration" },
  { cat: "h3c", name: "Interface brief",       template: "display ip interface brief" },
  { cat: "h3c", name: "ARP all",               template: "display arp all" },
  { cat: "h3c", name: "MAC address",           template: "display mac-address" },
  { cat: "h3c", name: "VLANs",                 template: "display vlan" },
  { cat: "h3c", name: "LLDP neighbors",        template: "display lldp neighbor brief" },
  { cat: "h3c", name: "OSPF peers",            template: "display ospf peer brief" },
  { cat: "h3c", name: "BGP peer",              template: "display bgp routing-table ipv4 peer {peer}" },
  { cat: "h3c", name: "BGP advertised routes", template: "display bgp routing-table ipv4 peer {peer} advertised-routes" },
  { cat: "h3c", name: "BGP received routes",   template: "display bgp routing-table ipv4 peer {peer} received-routes" },
  { cat: "h3c", name: "Interface stats",       template: "display interface {interface}" },
  { cat: "h3c", name: "Route lookup",          template: "display ip routing-table {ip}" },
  { cat: "h3c", name: "VLAN detail",           template: "display vlan {vlan}" },

  /* ---- IB (NVIDIA InfiniBand switch) ---- */
  { cat: "ib", name: "Port status",     template: "ibstat" },
  { cat: "ib", name: "Topology",        template: "ibnetdiscover" },
  { cat: "ib", name: "Link errors",     template: "ibqueryerrors" },
  { cat: "ib", name: "Fabric diagnose", template: "ibdiagnet" },
  { cat: "ib", name: "Hosts",           template: "ibhosts" },
  { cat: "ib", name: "Switches",        template: "ibswitches" },
  { cat: "ib", name: "Port counters",   template: "smpquery portcounters {lid}" },
  { cat: "ib", name: "Version",         template: "show version" },
  { cat: "ib", name: "Inventory",       template: "show inventory" },
  { cat: "ib", name: "Running config",  template: "show running-config" },
];

/* ---- storage ---- */

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function loadCommands() {
  const cmds = readJson(COMMANDS_KEY);
  return Array.isArray(cmds) ? cmds : [];
}
function saveCommands(list) {
  localStorage.setItem(COMMANDS_KEY, JSON.stringify(list));
}

function loadCategories() {
  const cats = readJson(CAT_STORAGE_KEY);
  return Array.isArray(cats) ? cats : [];
}
function saveCategories(list) {
  localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(list));
}

/*
 * One-time migration to the unified model (schema 2).
 * v1 kept commands split between code and localStorage, hid deleted
 * built-ins in netcmd.hidden, and stored user categories without the
 * built-in ones. Merge all of that into netcmd.commands / netcmd.categories.
 */
function migrateIfNeeded() {
  if (localStorage.getItem(SCHEMA_KEY) === SCHEMA_VERSION) return;

  const oldCats = loadCategories().filter(c => !SEED_CATEGORIES.some(s => s.id === c.id));
  saveCategories([...SEED_CATEGORIES.map(c => ({ ...c })), ...oldCats]);

  const hidden = readJson("netcmd.hidden") || [];
  const oldCustom = readJson("netcmd.custom") || [];
  saveCommands([
    ...SEED_COMMANDS.filter(c => !hidden.includes(c.template)),
    ...oldCustom.map(c => ({ name: c.name || "", template: c.template, cat: c.cat || "" })),
  ]);

  localStorage.removeItem("netcmd.custom");
  localStorage.removeItem("netcmd.hidden");
  localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
}

/* ---- template helpers ---- */

function paramsOf(template) {
  const set = [];
  const re = /\{(\w+)\}/g;
  let m;
  while ((m = re.exec(template)) !== null) {
    if (!set.includes(m[1])) set.push(m[1]);
  }
  return set;
}

function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, p) => values[p] !== undefined ? values[p] : "{" + p + "}");
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  fallbackCopy(text);
  return Promise.resolve();
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function showCopied(btn, row) {
  const old = btn.textContent;
  btn.textContent = "✓ Copied";
  btn.classList.add("copied");
  if (row) {
    row.classList.add("just-copied");
    setTimeout(() => row.classList.remove("just-copied"), 600);
  }
  setTimeout(() => { btn.textContent = old; btn.classList.remove("copied"); }, 1200);
}

/*
 * Two-step inline confirm for destructive actions: first click arms the
 * button ("Sure?"), second click within 2.5s fires. No modal dialogs.
 */
function armConfirm(btn, action) {
  if (btn.dataset.armed === "1") {
    btn.dataset.armed = "";
    btn.textContent = btn.dataset.oldText || btn.textContent;
    btn.classList.remove("armed");
    action();
    return;
  }
  btn.dataset.armed = "1";
  btn.dataset.oldText = btn.textContent;
  btn.textContent = "Sure?";
  btn.classList.add("armed");
  setTimeout(() => {
    if (btn.dataset.armed === "1" && btn.isConnected) {
      btn.dataset.armed = "";
      btn.textContent = btn.dataset.oldText;
      btn.classList.remove("armed");
    }
  }, 2500);
}

/* ---- drag & drop state ---- */

let drag = null; // { type: "cmd" | "cat", index?, id?, el }

function endDrag() {
  document.querySelectorAll(".dragging, .drop-above, .drop-below, .drop-into").forEach(el => {
    el.classList.remove("dragging", "drop-above", "drop-below", "drop-into");
  });
  document.body.classList.remove("drag-cursor");
  drag = null;
}

/*
 * Feishu-style drag grip: six dots at the front, hand cursor, and the row
 * only becomes draggable while the mouse is down on the grip.
 */
function makeGrip(host) {
  const g = document.createElement("span");
  g.className = "grip";
  g.textContent = "⠿";
  g.title = "Drag to reorder";
  g.addEventListener("mousedown", () => {
    host.draggable = true;
    const reset = () => {
      host.draggable = false;
      document.removeEventListener("mouseup", reset);
    };
    document.addEventListener("mouseup", reset);
  });
  return g;
}

/* ---- command rows ---- */

/* Render the command text; {param} becomes a clickable span. */
function renderTemplateHtml(template) {
  const div = document.createElement("div");
  div.className = "template";
  template.split(/(\{\w+\})/).forEach(part => {
    if (/^\{(\w+)\}$/.test(part)) {
      const s = document.createElement("span");
      s.className = "param";
      s.dataset.param = part.slice(1, -1);
      s.textContent = part;
      div.appendChild(s);
    } else {
      div.appendChild(document.createTextNode(part));
    }
  });
  return div;
}

function buildRow(item, index) {
  const li = document.createElement("li");
  li.className = "cmd";
  li._cmdIndex = index;
  li._values = {};

  li.appendChild(makeGrip(li));

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = item.name || "";
  li.appendChild(name);

  li.appendChild(renderTemplateHtml(item.template));

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.type = "button";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", e => {
    e.stopPropagation();
    activate(li, item, copyBtn, null);
  });
  li.appendChild(copyBtn);

  const delBtn = document.createElement("button");
  delBtn.className = "del-btn";
  delBtn.type = "button";
  delBtn.title = "Delete";
  delBtn.textContent = "×";
  delBtn.addEventListener("click", e => {
    e.stopPropagation();
    armConfirm(delBtn, () => {
      // index is the row's position in the stored array at render time
      const cmds = loadCommands();
      if (index > -1 && index < cmds.length) {
        cmds.splice(index, 1);
        saveCommands(cmds);
      }
      render();
    });
  });
  li.appendChild(delBtn);

  // clicking a {param} span starts editing right there, in place
  li.addEventListener("click", e => {
    const param = e.target.dataset ? e.target.dataset.param : null;
    activate(li, item, copyBtn, param);
  });

  /* drag: reorder within a category, or drop into another category */
  li.addEventListener("dragstart", e => {
    if (li.querySelector("input[data-param]")) { e.preventDefault(); return; } // not while editing
    drag = { type: "cmd", index, el: li };
    li.classList.add("dragging");
    document.body.classList.add("drag-cursor");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "netcmd-cmd");
  });
  li.addEventListener("dragend", () => { li.draggable = false; endDrag(); });
  li.addEventListener("dragover", e => {
    if (!drag || drag.type !== "cmd") return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".drop-above, .drop-below").forEach(el => el.classList.remove("drop-above", "drop-below"));
    const rect = li.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    li.classList.toggle("drop-above", before);
    li.classList.toggle("drop-below", !before);
  });
  li.addEventListener("drop", e => {
    if (!drag || drag.type !== "cmd") return;
    e.preventDefault();
    e.stopPropagation();
    const before = li.classList.contains("drop-above");
    dropCommand(drag.index, li._cmdIndex, before);
  });

  return li;
}

/* Move command `from` to before/after command `to` (same array indexes). */
function dropCommand(from, to, before) {
  const cmds = loadCommands();
  if (from === to || from < 0 || to < 0 || from >= cmds.length || to >= cmds.length) {
    endDrag();
    return;
  }
  const target = cmds[to];
  const [moved] = cmds.splice(from, 1);
  moved.cat = target.cat; // dropping onto a row adopts that row's category
  const idx = cmds.indexOf(target);
  cmds.splice(before ? idx : idx + 1, 0, moved);
  saveCommands(cmds);
  endDrag();
  render();
}

/* Move command `from` to the end of category `catId`. */
function dropCommandIntoCategory(from, catId) {
  const cmds = loadCommands();
  if (from < 0 || from >= cmds.length) { endDrag(); return; }
  const [moved] = cmds.splice(from, 1);
  moved.cat = catId;
  cmds.push(moved);
  saveCommands(cmds);
  endDrag();
  render();
}

/* Turn {param} spans into in-place inputs (focusParam = which one to focus). */
function activate(li, item, copyBtn, focusParam) {
  const params = paramsOf(item.template);
  if (params.length === 0) {
    copyToClipboard(item.template).then(() => showCopied(copyBtn, li));
    return;
  }

  li.draggable = false; // never drag while typing (grip mousedown may have enabled it)

  let inputs = [...li.querySelectorAll("input[data-param]")];
  if (!inputs.length) {
    li.querySelectorAll("span[data-param]").forEach(span => {
      span.replaceWith(makeInput(li, item, copyBtn, span.dataset.param));
    });
    inputs = [...li.querySelectorAll("input[data-param]")];
  }

  const target = focusParam
    ? inputs.find(i => i.dataset.param === focusParam)
    : (inputs.find(i => !i.value.trim()) || inputs[0]);
  if (target) { target.focus(); target.select(); }
}

function makeInput(li, item, copyBtn, param) {
  const input = document.createElement("input");
  input.type = "text";
  input.dataset.param = param;
  input.value = li._values[param] || "";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = param;
  sizeInput(input);
  input.addEventListener("input", () => sizeInput(input));
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishEdit(li, item, copyBtn);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit(li);
    }
  });
  // keep clicks inside the input from re-triggering the row handler
  input.addEventListener("click", e => e.stopPropagation());
  return input;
}

function sizeInput(input) {
  input.style.width = Math.max(6, input.value.length + 1) + "ch";
}

/* Enter: freeze values back into the command line, copy it, done. */
function finishEdit(li, item, copyBtn) {
  const values = {};
  li.querySelectorAll("input[data-param]").forEach(input => {
    values[input.dataset.param] = input.value.trim();
    const span = document.createElement("span");
    span.dataset.param = input.dataset.param;
    if (input.value.trim()) {
      span.className = "param filled";
      span.textContent = input.value.trim();
    } else {
      span.className = "param";
      span.textContent = "{" + input.dataset.param + "}";
    }
    input.replaceWith(span);
  });
  li._values = values;
  copyToClipboard(fillTemplate(item.template, values)).then(() => showCopied(copyBtn, li));
}

/* Escape: back to placeholders, values kept for next time. */
function cancelEdit(li) {
  li.querySelectorAll("input[data-param]").forEach(input => {
    li._values[input.dataset.param] = input.value.trim();
    const span = document.createElement("span");
    span.className = "param";
    span.dataset.param = input.dataset.param;
    span.textContent = "{" + input.dataset.param + "}";
    input.replaceWith(span);
  });
}

/* ---- category context menu (right-click or the ⋯ button) ---- */

let ctxMenu = null;
function closeCtxMenu() {
  if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
}
document.addEventListener("click", e => {
  if (!e.target.closest(".ctx-menu")) closeCtxMenu();
});
document.addEventListener("scroll", closeCtxMenu, true);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeCtxMenu(); });

function menuItem(text, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function openCatMenu(x, y, catId, catName, isVirtual) {
  closeCtxMenu();
  const menu = document.createElement("div");
  menu.className = "ctx-menu";

  const clearItem = menuItem("Clear all commands", () => {
    armConfirm(clearItem, () => {
      saveCommands(loadCommands().filter(c => c.cat !== catId));
      closeCtxMenu();
      render();
    });
  });
  menu.appendChild(clearItem);

  if (!isVirtual) {
    const delItem = menuItem("Delete category", () => {
      armConfirm(delItem, () => {
        // commands inside are NOT lost — they fall to Uncategorized
        saveCategories(loadCategories().filter(c => c.id !== catId));
        closeCtxMenu();
        render();
      });
    });
    menu.appendChild(delItem);
  }

  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 8)) + "px";
  menu.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 8)) + "px";
  ctxMenu = menu;
}

/* ---- category sections ---- */

function buildSection(cat, rows, isVirtual) {
  const colors = colorByKey(cat.color);
  const section = document.createElement("section");
  section.className = "cat";
  section.style.setProperty("--accent", colors.accent);
  section.style.setProperty("--tint", colors.bg);

  const header = document.createElement("div");
  header.className = "cat-header";
  header.title = "Right-click for actions";

  if (!isVirtual) header.appendChild(makeGrip(header));

  const chip = document.createElement("span");
  chip.className = "chip";
  const nameEl = document.createElement("span");
  nameEl.className = "cat-name";
  nameEl.textContent = cat.name;
  const countEl = document.createElement("span");
  countEl.className = "cat-count";
  countEl.textContent = rows.length;
  header.append(chip, nameEl, countEl);

  const kebab = document.createElement("button");
  kebab.type = "button";
  kebab.className = "cat-kebab";
  kebab.textContent = "⋯";
  kebab.title = "Category actions";
  kebab.addEventListener("click", e => {
    e.stopPropagation(); // keep the document click handler from closing it again
    const r = kebab.getBoundingClientRect();
    openCatMenu(r.left, r.bottom + 2, cat.id, cat.name, isVirtual);
  });
  header.appendChild(kebab);

  header.addEventListener("contextmenu", e => {
    e.preventDefault();
    openCatMenu(e.clientX, e.clientY, cat.id, cat.name, isVirtual);
  });

  /* drag: drop this category before another one */
  header.addEventListener("dragstart", e => {
    drag = { type: "cat", id: cat.id, el: header };
    header.classList.add("dragging");
    document.body.classList.add("drag-cursor");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "netcmd-cat");
  });
  header.addEventListener("dragend", () => { header.draggable = false; endDrag(); });
  header.addEventListener("dragover", e => {
    if (!drag || drag.type !== "cat" || drag.id === cat.id) return;
    e.preventDefault();
    e.stopPropagation();
    header.classList.add("drop-into");
  });
  header.addEventListener("drop", e => {
    if (!drag || drag.type !== "cat" || drag.id === cat.id) return;
    e.preventDefault();
    e.stopPropagation();
    const cats = loadCategories();
    const from = cats.findIndex(c => c.id === drag.id);
    const to = cats.findIndex(c => c.id === cat.id);
    if (from > -1 && to > -1 && from !== to) {
      const [moved] = cats.splice(from, 1);
      cats.splice(to, 0, moved);
      saveCategories(cats);
    }
    endDrag();
    render();
  });

  section.appendChild(header);

  /* dropping a command on empty section space = append to this category */
  section.addEventListener("dragover", e => {
    if (!drag || drag.type !== "cmd") return;
    if (e.target.closest("li.cmd")) return; // rows handle themselves
    e.preventDefault();
    section.classList.add("drop-into");
  });
  section.addEventListener("drop", e => {
    if (!drag || drag.type !== "cmd") return;
    if (e.target.closest("li.cmd")) return;
    e.preventDefault();
    dropCommandIntoCategory(drag.index, cat.id);
  });

  const ul = document.createElement("ul");
  rows.forEach(row => ul.appendChild(row));
  section.appendChild(ul);

  return section;
}

function render() {
  const wrap = document.getElementById("cmd-list");
  wrap.textContent = "";

  const cats = loadCategories();
  const cmds = loadCommands();

  cats.forEach(cat => {
    const rows = cmds.map((c, i) => ({ c, i }))
      .filter(({ c }) => c.cat === cat.id)
      .map(({ c, i }) => buildRow(c, i));
    wrap.appendChild(buildSection(cat, rows, false));
  });

  // commands whose category is gone (or was never set)
  const orphan = cmds.map((c, i) => ({ c, i })).filter(({ c }) => !cats.some(k => k.id === c.cat));
  if (orphan.length) {
    wrap.appendChild(buildSection({ id: "", name: "Uncategorized", color: "gray" }, orphan.map(({ c, i }) => buildRow(c, i)), true));
  }

  refreshCatSelect(cats);
}

function refreshCatSelect(cats) {
  const select = document.getElementById("add-cat");
  select.textContent = "";
  const uncat = document.createElement("option");
  uncat.value = "";
  uncat.textContent = "Uncategorized";
  select.appendChild(uncat);
  cats.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}

/* ---- add command ---- */

document.getElementById("add-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("add-name").value.trim();
  const template = document.getElementById("add-template").value.trim();
  if (!template) return;
  const cmds = loadCommands();
  cmds.push({ name, template, cat: document.getElementById("add-cat").value });
  saveCommands(cmds);
  e.target.reset();
  document.getElementById("add-box").removeAttribute("open");
  render();
});

/* ---- add category ---- */

function buildSwatches() {
  const wrap = document.getElementById("color-swatches");
  wrap.textContent = "";
  COLOR_PRESETS.forEach(preset => {
    const label = document.createElement("label");
    label.className = "swatch";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "cat-color";
    radio.value = preset.key;
    if (preset.key === "blue") radio.checked = true; // default for new categories
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.setProperty("--accent", preset.accent);
    dot.title = preset.label;
    label.append(radio, dot, document.createTextNode(preset.label));
    wrap.appendChild(label);
  });
}

document.getElementById("add-cat-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("add-cat-name").value.trim();
  if (!name) return;
  const color = document.querySelector('input[name="cat-color"]:checked');
  const cats = loadCategories();
  cats.push({
    id: "c" + Date.now().toString(36),
    name,
    color: color ? color.value : "gray",
  });
  saveCategories(cats);
  e.target.reset();
  document.getElementById("add-cat-box").removeAttribute("open");
  render();
});

buildSwatches();

/* ---- YAML data (edit / replace everything) ---- */

function yamlQuote(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

function toYaml() {
  const lines = [
    "# NetCmd data. Edit, then click 'Replace all' — this replaces EVERYTHING.",
    "categories:",
  ];
  loadCategories().forEach(c => {
    lines.push("  - id: " + yamlQuote(c.id));
    lines.push("    name: " + yamlQuote(c.name));
    lines.push("    color: " + yamlQuote(c.color || "gray"));
    if (c.builtin) lines.push("    builtin: true");
  });
  lines.push("commands:");
  loadCommands().forEach(c => {
    lines.push("  - name: " + yamlQuote(c.name || ""));
    lines.push("    template: " + yamlQuote(c.template));
    lines.push("    cat: " + yamlQuote(c.cat || ""));
  });
  return lines.join("\n") + "\n";
}

function stripYamlComment(line) {
  let inS = false, inD = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    else if (ch === "#" && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function yamlScalar(s) {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s.slice(1, -1).replace(/\\(["\\])/g, "$1");
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1);
  if (s === "true") return true;
  if (s === "false") return false;
  return s;
}

/* Minimal YAML subset: exactly the shape toYaml() writes — top-level
 * "categories:" / "commands:" with "- key: value" list items. */
function parseYaml(text) {
  const categories = [];
  const commands = [];
  let section = null;
  let current = null;

  text.split(/\r?\n/).forEach(raw => {
    const line = stripYamlComment(raw);
    if (!line.trim()) return;
    const content = line.trim();
    const indent = line.match(/^\s*/)[0].length;

    if (indent === 0) {
      const m = content.match(/^([\w-]+):(.*)$/);
      current = null;
      section = m && !m[2].trim() && (m[1] === "categories" || m[1] === "commands") ? m[1] : null;
      return;
    }

    let m = content.match(/^-\s+([\w-]+):\s*(.*)$/);
    if (m && section) {
      current = {};
      (section === "categories" ? categories : commands).push(current);
      current[m[1]] = yamlScalar(m[2]);
      return;
    }
    m = content.match(/^([\w-]+):\s*(.*)$/);
    if (m && current) current[m[1]] = yamlScalar(m[2]);
  });

  return { categories, commands };
}

function importYaml(text) {
  const { categories, commands } = parseYaml(text);

  const seen = new Set();
  const cats = categories
    .filter(c => c && c.id && c.name)
    .map(c => ({
      id: String(c.id),
      name: String(c.name),
      color: colorByKey(String(c.color || "")).key === String(c.color) ? String(c.color) : "gray",
      ...(c.builtin === true ? { builtin: true } : {}),
    }))
    .filter(c => !seen.has(c.id) && seen.add(c.id));

  const cmds = commands
    .filter(c => c && c.template)
    .map(c => ({
      name: c.name ? String(c.name) : "",
      template: String(c.template),
      cat: c.cat ? String(c.cat) : "",
    }));

  if (!cats.length && !cmds.length) throw new Error("no categories or commands found");
  return { cats, cmds };
}

const dataBox = document.getElementById("data-box");
const yamlText = document.getElementById("yaml-text");
const yamlHl = document.getElementById("yaml-hl");
const yamlMsg = document.getElementById("yaml-msg");

function setYamlMsg(text, bad) {
  yamlMsg.textContent = text;
  yamlMsg.classList.toggle("bad", !!bad);
}

/* ---- YAML syntax highlight (transparent textarea over a colored <pre>) ---- */

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function hlValue(v) {
  const lead = v.match(/^\s*/)[0];
  const t = v.trim();
  let body;
  if (t === "true" || t === "false") {
    body = '<span class="y-bool">' + escHtml(t) + "</span>";
  } else if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) {
    // quoted string; {param} inside gets the same orange as the main UI
    const q = t[0];
    body = '<span class="y-str">' + escHtml(q) + "</span>"
      + escHtml(t.slice(1, -1)).replace(/\{(\w+)\}/g, '<span class="y-param">{$1}</span>')
      + '<span class="y-str">' + escHtml(q) + "</span>";
  } else {
    body = escHtml(t);
  }
  return escHtml(lead) + body;
}

function hlYamlLine(line) {
  // split off a comment (only a # that sits outside quotes)
  let code = line, comment = "";
  let inS = false, inD = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    else if (ch === "#" && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]))) {
      code = line.slice(0, i);
      comment = line.slice(i);
      break;
    }
  }

  let html;
  const m = code.match(/^(\s*(?:-\s+)?)([\w-]+)(:)(\s*)(.*)$/);
  if (m) {
    html = escHtml(m[1]) + '<span class="y-key">' + escHtml(m[2]) + "</span>"
      + escHtml(m[3]) + escHtml(m[4]) + hlValue(m[5]);
  } else {
    html = escHtml(code);
  }
  if (comment) html += '<span class="y-com">' + escHtml(comment) + "</span>";
  return html;
}

function syncHighlight() {
  yamlHl.innerHTML = yamlText.value.split(/\r?\n/).map(hlYamlLine).join("\n") + "\n";
  yamlHl.scrollTop = yamlText.scrollTop;
  yamlHl.scrollLeft = yamlText.scrollLeft;
}

yamlText.addEventListener("input", syncHighlight);
yamlText.addEventListener("scroll", () => {
  yamlHl.scrollTop = yamlText.scrollTop;
  yamlHl.scrollLeft = yamlText.scrollLeft;
});
yamlText.addEventListener("keydown", e => {
  if (e.key === "Tab") { // two-space indent, YAML-style
    e.preventDefault();
    yamlText.setRangeText("  ", yamlText.selectionStart, yamlText.selectionEnd, "end");
    syncHighlight();
  }
});

function refreshYaml(msg, bad) {
  yamlText.value = toYaml();
  syncHighlight();
  setYamlMsg(msg || "", bad);
}

dataBox.addEventListener("toggle", () => {
  if (dataBox.open) refreshYaml();
});

document.getElementById("yaml-reload").addEventListener("click", () => refreshYaml());

document.getElementById("yaml-download").addEventListener("click", () => {
  const blob = new Blob([yamlText.value], { type: "text/yaml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "net-paste.yaml";
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("yaml-file").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    yamlText.value = reader.result;
    syncHighlight();
    setYamlMsg("Loaded — review, then click Replace all");
  };
  reader.readAsText(file);
  e.target.value = ""; // allow re-opening the same file
});

document.getElementById("yaml-replace").addEventListener("click", e => {
  armConfirm(e.currentTarget, () => {
    try {
      const { cats, cmds } = importYaml(yamlText.value);
      saveCategories(cats);
      saveCommands(cmds);
      render();
      refreshYaml("Imported " + cmds.length + " commands, " + cats.length + " categories");
    } catch (err) {
      setYamlMsg("Import failed: " + err.message, true);
    }
  });
});

/* ---- name column toggle (persisted) ---- */

const nameToggle = document.getElementById("toggle-name");
function applyNamePref() {
  const hidden = localStorage.getItem(NAME_KEY) === "1";
  document.body.classList.toggle("hide-name", hidden);
  nameToggle.textContent = hidden ? "Show names" : "Hide names";
}
nameToggle.addEventListener("click", () => {
  localStorage.setItem(NAME_KEY, localStorage.getItem(NAME_KEY) === "1" ? "0" : "1");
  applyNamePref();
});
applyNamePref();

migrateIfNeeded();
render();
