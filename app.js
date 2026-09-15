/* NetCmd — Find. Fill. Copy. */

"use strict";

const STORAGE_KEY = "netcmd.custom";

const BUILTINS = [
  { name: "Routing table",          template: "display ip routing-table" },
  { name: "Current config",         template: "display current-configuration" },
  { name: "Interface brief",        template: "display ip interface brief" },
  { name: "ARP all",                template: "display arp all" },
  { name: "MAC address",            template: "display mac-address" },
  { name: "VLANs",                  template: "display vlan" },
  { name: "LLDP neighbors",         template: "display lldp neighbor brief" },
  { name: "OSPF peers",             template: "display ospf peer brief" },
  { name: "BGP peer",               template: "display bgp routing-table ipv4 peer {peer}" },
  { name: "BGP advertised routes",  template: "display bgp routing-table ipv4 peer {peer} advertised-routes" },
  { name: "BGP received routes",    template: "display bgp routing-table ipv4 peer {peer} received-routes" },
  { name: "Interface stats",        template: "display interface {interface}" },
  { name: "Route lookup",           template: "display ip routing-table {ip}" },
  { name: "VLAN detail",            template: "display vlan {vlan}" },
];

function loadCustom() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveCustom(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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

const listEl = document.getElementById("cmd-list");

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

function buildRow(item, isCustom, index) {
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

  if (isCustom) {
    const delBtn = document.createElement("button");
    delBtn.className = "del-btn";
    delBtn.type = "button";
    delBtn.title = "Delete";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", e => {
      e.stopPropagation();
      const custom = loadCustom();
      custom.splice(index, 1);
      saveCustom(custom);
      render();
    });
    li.appendChild(delBtn);
  }

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

function render() {
  listEl.textContent = "";
  BUILTINS.forEach(item => listEl.appendChild(buildRow(item, false, -1)));
  loadCustom().forEach((item, i) => listEl.appendChild(buildRow(item, true, i)));
}

document.getElementById("add-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("add-name").value.trim();
  const template = document.getElementById("add-template").value.trim();
  if (!template) return;
  const custom = loadCustom();
  custom.push({ name, template });
  saveCustom(custom);
  e.target.reset();
  document.getElementById("add-box").removeAttribute("open");
  render();
});

render();
