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

function renderTemplateHtml(template) {
  const div = document.createElement("div");
  div.className = "template";
  div.textContent = ""; // build safely below
  template.split(/(\{\w+\})/).forEach(part => {
    if (/^\{\w+\}$/.test(part)) {
      const s = document.createElement("span");
      s.className = "param";
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
    activate(li, item, copyBtn);
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

  // clicking the row itself works the same as clicking Copy
  li.addEventListener("click", () => activate(li, item, copyBtn));

  return li;
}

function activate(li, item, copyBtn) {
  const params = paramsOf(item.template);
  if (params.length === 0) {
    copyToClipboard(item.template).then(() => showCopied(copyBtn));
    return;
  }
  // toggle inline parameter form
  const existing = li.nextElementSibling;
  if (existing && existing.classList.contains("param-form")) {
    existing.querySelector("input").focus();
    return;
  }
  const form = document.createElement("div");
  form.className = "param-form";
  const inputs = {};
  params.forEach(p => {
    const label = document.createElement("label");
    label.textContent = p + ": ";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = p === "ip" ? "10.1.1.1" : p === "vlan" ? "10" : p === "interface" ? "GE1/0/1" : "1.1.1.1";
    input.autocomplete = "off";
    input.dataset.param = p;
    label.appendChild(input);
    form.appendChild(label);
    inputs[p] = input;
  });
  const hint = document.createElement("span");
  hint.className = "hint";
  hint.textContent = "Enter = copy";
  form.appendChild(hint);

  form.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      const values = {};
      params.forEach(p => { values[p] = inputs[p].value.trim(); });
      copyToClipboard(fillTemplate(item.template, values)).then(() => {
        showCopied(copyBtn);
        form.remove();
      });
    } else if (e.key === "Escape") {
      form.remove();
    }
  });

  li.insertAdjacentElement("afterend", form);
  params.length === 1 ? inputs[params[0]].select() : inputs[params[0]].focus();
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
