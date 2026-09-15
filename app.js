/* NetCmd — Find. Fill. Copy. */

"use strict";

const STORAGE_KEY = "netcmd.custom";
const CAT_STORAGE_KEY = "netcmd.categories";
const HIDDEN_KEY = "netcmd.hidden";     // built-in commands deleted by the user (by template)
const NAME_KEY = "netcmd.hideName";     // "1" = name column hidden

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

/* Built-in categories. User-added ones live in localStorage. */
const DEFAULT_CATEGORIES = [
  { id: "h3c", name: "H3C", color: "red" },
  { id: "ib",  name: "IB",  color: "green" },
];

const BUILTINS = [
  /* ---- 华三 ---- */
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

function loadCustom() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveCustom(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function loadCategories() {
  try { return JSON.parse(localStorage.getItem(CAT_STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveCategories(list) {
  localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(list));
}
function loadHidden() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY)) || []; }
  catch { return []; }
}
function saveHidden(list) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(list));
}

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

function showCopied(btn) {
  const old = btn.textContent;
  btn.textContent = "Copied";
  btn.classList.add("copied");
  setTimeout(() => { btn.textContent = old; btn.classList.remove("copied"); }, 1200);
}

/*
 * Two-step inline confirm for destructive actions: first click arms the
 * button ("Sure?"), second click within 2.5s fires. No modal dialogs.
 */
function armConfirm(btn, action) {
  if (btn.dataset.armed === "1") {
    btn.dataset.armed = "";
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

function buildRow(item, isCustom, customIndex) {
  const li = document.createElement("li");
  li.className = "cmd";
  li._values = {};

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
      if (isCustom) {
        // customIndex is the row's position in the stored array at render time
        const custom = loadCustom();
        if (customIndex > -1 && customIndex < custom.length) {
          custom.splice(customIndex, 1);
          saveCustom(custom);
        }
      } else {
        const hidden = loadHidden();
        if (!hidden.includes(item.template)) hidden.push(item.template);
        saveHidden(hidden);
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

  return li;
}

/* Turn {param} spans into in-place inputs (focusParam = which one to focus). */
function activate(li, item, copyBtn, focusParam) {
  const params = paramsOf(item.template);
  if (params.length === 0) {
    copyToClipboard(item.template).then(() => showCopied(copyBtn));
    return;
  }

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
  copyToClipboard(fillTemplate(item.template, values)).then(() => showCopied(copyBtn));
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

/* ---- category sections ---- */

function buildSection(cat, rows, opts) {
  const colors = colorByKey(cat.color);
  const section = document.createElement("section");
  section.className = "cat";
  section.style.setProperty("--accent", colors.accent);
  section.style.setProperty("--tint", colors.bg);

  const header = document.createElement("div");
  header.className = "cat-header";

  const chip = document.createElement("span");
  chip.className = "chip";
  const nameEl = document.createElement("span");
  nameEl.className = "cat-name";
  nameEl.textContent = cat.name;
  const countEl = document.createElement("span");
  countEl.className = "cat-count";
  countEl.textContent = rows.length;
  header.append(chip, nameEl, countEl);

  const actions = document.createElement("div");
  actions.className = "cat-actions";

  if (opts.onClear) {
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "clear";
    clearBtn.title = "Clear all commands in this category";
    clearBtn.addEventListener("click", e => {
      e.stopPropagation();
      armConfirm(clearBtn, opts.onClear);
    });
    actions.appendChild(clearBtn);
  }

  if (opts.deletable) {
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "delete";
    delBtn.title = "Delete empty category";
    delBtn.addEventListener("click", e => {
      e.stopPropagation();
      armConfirm(delBtn, () => {
        saveCategories(loadCategories().filter(c => c.id !== cat.id));
        render();
      });
    });
    actions.appendChild(delBtn);
  }

  if (actions.childNodes.length) header.appendChild(actions);
  section.appendChild(header);

  const ul = document.createElement("ul");
  rows.forEach(row => ul.appendChild(row));
  section.appendChild(ul);

  return section;
}

/* Clear a whole category: hide its built-ins, drop custom commands in it. */
function clearCategory(catId) {
  const hidden = loadHidden();
  BUILTINS.forEach(c => {
    if (c.cat === catId && !hidden.includes(c.template)) hidden.push(c.template);
  });
  saveHidden(hidden);
  saveCustom(loadCustom().filter(c => c.cat !== catId));
  render();
}

function render() {
  const wrap = document.getElementById("cmd-list");
  wrap.textContent = "";

  const cats = [...DEFAULT_CATEGORIES, ...loadCategories()];
  const custom = loadCustom();
  const hidden = loadHidden();

  cats.forEach(cat => {
    const rows = [
      ...BUILTINS.filter(c => c.cat === cat.id && !hidden.includes(c.template))
        .map(c => buildRow(c, false)),
      ...custom.map((c, i) => ({ c, i }))
        .filter(({ c }) => c.cat === cat.id)
        .map(({ c, i }) => buildRow(c, true, i)),
    ];
    // user-added categories are deletable only while empty
    const deletable = !DEFAULT_CATEGORIES.some(d => d.id === cat.id) && rows.length === 0;
    wrap.appendChild(buildSection(cat, rows, { deletable, onClear: () => clearCategory(cat.id) }));
  });

  // custom commands whose category is gone (or was never set)
  const orphan = custom.map((c, i) => ({ c, i })).filter(({ c }) => !cats.some(k => k.id === c.cat));
  if (orphan.length) {
    wrap.appendChild(buildSection({ name: "Uncategorized", color: "gray" }, orphan.map(({ c, i }) => buildRow(c, true, i)), {
      onClear: () => {
        const valid = new Set([...DEFAULT_CATEGORIES, ...loadCategories()].map(k => k.id));
        saveCustom(loadCustom().filter(c => valid.has(c.cat)));
        render();
      },
    }));
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
  const custom = loadCustom();
  custom.push({ name, template, cat: document.getElementById("add-cat").value });
  saveCustom(custom);
  e.target.reset();
  document.getElementById("add-box").removeAttribute("open");
  render();
});

/* ---- add category ---- */

function buildSwatches() {
  const wrap = document.getElementById("color-swatches");
  wrap.textContent = "";
  COLOR_PRESETS.forEach((preset, i) => {
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

/* ---- footer: clear all custom categories (kept out of the way) ----
 * Commands inside them are NOT lost — they move to Uncategorized. */

document.getElementById("reset-cats").addEventListener("click", e => {
  armConfirm(e.currentTarget, () => {
    saveCategories([]);
    render();
  });
});

render();
