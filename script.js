// Basic state
const state = {
  scale: 0.8,
  offsetX: 0,
  offsetY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panOriginX: 0,
  panOriginY: 0,
  draggingNodeId: null,
  dragNodeStart: { x: 0, y: 0 },
  dragPointerStart: { x: 0, y: 0 },
  selectedNodeId: null,
  linkMode: null, // { fromId, type }
  editor: { isNew: false, currentId: null },
  bubbles: [],
  nodes: [],
  links: []
};

const canvas = document.getElementById("canvas");
const canvasInner = document.getElementById("canvas-inner");
const bubbleFoldersContainer = document.getElementById("bubble-folders");
const allNodesList = document.getElementById("all-nodes-list");
const detailTitle = document.getElementById("detail-title");
const detailContent = document.getElementById("detail-content");
const hiddenNodeContentContainer = document.getElementById("hidden-node-content-container");
const textMapContent = document.getElementById("text-map-content");

// Editor elements
const btnNewNode = document.getElementById("btn-new-node");
const btnSaveNode = document.getElementById("btn-save-node");
const btnDeleteNode = document.getElementById("btn-delete-node");
const btnDownloadJson = document.getElementById("btn-download-json");
const editNodeIdInput = document.getElementById("edit-node-id");
const editNodeTitleInput = document.getElementById("edit-node-title");
const editNodeSummaryInput = document.getElementById("edit-node-summary");
const editNodeContentInput = document.getElementById("edit-node-content");
const editBubblesContainer = document.getElementById("edit-bubbles-container");

let linkSvg;

// Load initial data from the embedded JSON
function loadInitialData() {
  const el = document.getElementById("initial-data");
  const json = el.textContent || el.innerText;
  const data = JSON.parse(json);

  state.bubbles = data.bubbles.map(b => ({
    ...b,
    diameter: b.radius * 2
  }));

  const nodePositions = [
    { x: -200, y: -420 },
    { x: -220, y: -230 },
    { x: -900, y: -260 },
    { x: -40, y: -120 },
    { x: -40, y: 40 },
    { x: 480, y: -260 },
    { x: 820, y: -80 },
    { x: 40, y: 210 },
    { x: -430, y: 260 },
    { x: 210, y: -10 },
    { x: 430, y: 260 },
    { x: 820, y: 260 },
    { x: -1150, y: 260 },
    { x: -70, y: 420 },
    { x: 80, y: 600 }
  ];

  state.nodes = data.nodes.map((n, idx) => ({
    ...n,
    x: nodePositions[idx] ? nodePositions[idx].x : 0,
    y: nodePositions[idx] ? nodePositions[idx].y : idx * 60
  }));

  state.links = data.links.slice();
}

// Build canvas items
function buildCanvas() {
  canvasInner.innerHTML = "";

  // create svg link layer
  linkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  linkSvg.classList.add("link-layer");
  linkSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  linkSvg.setAttribute("width", "100%");
  linkSvg.setAttribute("height", "100%");
  canvasInner.appendChild(linkSvg);

  // bubbles
  state.bubbles.forEach(bubble => {
    const el = document.createElement("div");
    el.className = "bubble";
    el.dataset.bubbleId = bubble.id;
    el.style.width = bubble.diameter + "px";
    el.style.height = bubble.diameter + "px";
    el.style.left = bubble.x - bubble.radius + "px";
    el.style.top = bubble.y - bubble.radius + "px";

    const label = document.createElement("div");
    label.className = "bubble-label";
    label.innerHTML = `<strong>${bubble.title}</strong><br>${bubble.description}`;
    el.appendChild(label);

    canvasInner.appendChild(el);
  });

  // nodes
  state.nodes.forEach(node => {
    const el = document.createElement("div");
    el.className = "node";
    el.dataset.nodeId = node.id;

    const titleEl = document.createElement("h3");
    titleEl.className = "node-title";
    titleEl.textContent = node.title;
    el.appendChild(titleEl);

    const summaryEl = document.createElement("p");
    summaryEl.className = "node-summary";
    summaryEl.textContent = node.summary || "";
    el.appendChild(summaryEl);

    if (node.bubbles && node.bubbles.length) {
      const badge = document.createElement("span");
      badge.className = "node-badge";
      badge.textContent =
        node.bubbles.length === 1 ? "Bubble: 1" : `Bubbles: ${node.bubbles.length}`;
      el.appendChild(badge);
    }

    el.style.left = node.x + "px";
    el.style.top = node.y + "px";

    el.addEventListener("mousedown", onNodeMouseDown);
    el.addEventListener("click", e => {
      e.stopPropagation();
      handleNodeClickFromCanvas(node.id);
    });
    el.addEventListener("contextmenu", e => {
      e.preventDefault();
      e.stopPropagation();
      openNodeContextMenu(e.clientX, e.clientY, node.id);
    });

    canvasInner.appendChild(el);
  });

  updateCanvasTransform();
  rebuildLinks();
}

// build left sidebar
function buildSidebars() {
  bubbleFoldersContainer.innerHTML = "";
  allNodesList.innerHTML = "";

  const bubbleMap = {};
  state.bubbles.forEach(b => {
    bubbleMap[b.id] = [];
  });
  const unassigned = [];

  state.nodes.forEach(node => {
    if (node.bubbles && node.bubbles.length) {
      node.bubbles.forEach(bid => {
        if (bubbleMap[bid]) bubbleMap[bid].push(node);
      });
    } else {
      unassigned.push(node);
    }
  });

  state.bubbles.forEach(bubble => {
    const folder = document.createElement("div");
    folder.className = "folder";

    const header = document.createElement("div");
    header.className = "folder-header";

    const titleSpan = document.createElement("span");
    titleSpan.className = "folder-title";
    titleSpan.textContent = bubble.title;

    const metaSpan = document.createElement("span");
    metaSpan.className = "folder-meta";
    metaSpan.textContent = `${bubbleMap[bubble.id].length} nodes`;

    header.appendChild(titleSpan);
    header.appendChild(metaSpan);

    const body = document.createElement("div");
    body.className = "folder-body";

    const list = document.createElement("ul");
    list.className = "folder-node-list";

    bubbleMap[bubble.id].forEach(node => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "node-button";
      btn.textContent = node.title;
      btn.dataset.nodeId = node.id;
      btn.addEventListener("click", () => selectNode(node.id));
      li.appendChild(btn);
      list.appendChild(li);
    });

    body.appendChild(list);

    let collapsed = false;
    header.addEventListener("click", () => {
      collapsed = !collapsed;
      body.style.display = collapsed ? "none" : "block";
    });

    folder.appendChild(header);
    folder.appendChild(body);
    bubbleFoldersContainer.appendChild(folder);
  });

  // flat list
  state.nodes.forEach(node => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "node-button";
    btn.textContent = node.title;
    btn.dataset.nodeId = node.id;
    btn.addEventListener("click", () => selectNode(node.id));
    li.appendChild(btn);
    allNodesList.appendChild(li);
  });
}

// hidden dump for crawlers
function buildHiddenContentDump() {
  hiddenNodeContentContainer.innerHTML = "";
  state.nodes.forEach(node => {
    const wrapper = document.createElement("div");
    wrapper.className = "hidden-node";
    const h3 = document.createElement("h3");
    h3.textContent = node.title;
    wrapper.appendChild(h3);
    const bubbleInfo = document.createElement("p");
    bubbleInfo.textContent =
      "Bubbles: " + (node.bubbles && node.bubbles.length ? node.bubbles.join(", ") : "none");
    wrapper.appendChild(bubbleInfo);
    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = node.contentHtml || "";
    wrapper.appendChild(contentDiv);
    hiddenNodeContentContainer.appendChild(wrapper);
  });
}

// text map for lazy extractors
function buildTextMap() {
  textMapContent.innerHTML = "";

  const bubblesSection = document.createElement("section");
  const bh = document.createElement("h3");
  bh.textContent = "Bubbles and their nodes";
  bubblesSection.appendChild(bh);

  state.bubbles.forEach(bubble => {
    const p = document.createElement("p");
    const nodeTitles = state.nodes
      .filter(n => n.bubbles && n.bubbles.includes(bubble.id))
      .map(n => n.title)
      .join("; ");
    p.textContent = `${bubble.title}: ${nodeTitles || "no nodes yet"}.`;
    bubblesSection.appendChild(p);
  });

  const linksSection = document.createElement("section");
  const lh = document.createElement("h3");
  lh.textContent = "Node links (logical connections)";
  linksSection.appendChild(lh);

  state.links.forEach(link => {
    const fromNode = state.nodes.find(n => n.id === link.from);
    const toNode = state.nodes.find(n => n.id === link.to);
    if (!fromNode || !toNode) return;
    const p = document.createElement("p");
    p.textContent = `${fromNode.title} → ${toNode.title} (${link.label}).`;
    linksSection.appendChild(p);
  });

  textMapContent.appendChild(bubblesSection);
  textMapContent.appendChild(linksSection);
}

// Select node and update viewer + editor
function selectNode(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  state.selectedNodeId = nodeId;

  document.querySelectorAll(".node").forEach(el => {
    if (el.dataset.nodeId === nodeId) {
      el.style.borderColor = "rgba(251, 191, 36, 0.95)";
      el.style.boxShadow = "0 0 26px rgba(251, 191, 36, 0.6)";
    } else {
      el.style.borderColor = "rgba(148, 163, 184, 0.8)";
      el.style.boxShadow = "0 10px 25px rgba(15, 23, 42, 0.85)";
    }
  });

  document.querySelectorAll(".node-button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.nodeId === nodeId);
  });

  detailTitle.textContent = node.title;

  const relatedLinks = state.links.filter(link => link.from === node.id);
  let linksHtml = "";
  if (relatedLinks.length) {
    const items = relatedLinks
      .map(link => {
        const target = state.nodes.find(n => n.id === link.to);
        if (!target) return "";
        const label = link.label || target.title;
        return `<li><a href="#" data-node-id="${target.id}">${label}</a></li>`;
      })
      .join("");
    linksHtml = `<section><h4>Linked nodes</h4><ul>${items}</ul></section>`;
  }

  detailContent.innerHTML = (node.contentHtml || "") + linksHtml;

  fillEditorFromNode(node);
}

function handleNodeClickFromCanvas(nodeId) {
  // If user is in linkMode, let that logic handle first
  if (state.linkMode) return;
  selectNode(nodeId);
}

// Canvas transform
function updateCanvasTransform() {
  canvasInner.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
}

// Rebuild SVG links
function rebuildLinks() {
  if (!linkSvg) return;
  linkSvg.innerHTML = "";

  state.links.forEach(link => {
    const fromNode = state.nodes.find(n => n.id === link.from);
    const toNode = state.nodes.find(n => n.id === link.to);
    if (!fromNode || !toNode) return;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("link-line");
    line.dataset.fromId = fromNode.id;
    line.dataset.toId = toNode.id;

    const x1 = fromNode.x + 100;
    const y1 = fromNode.y + 30;
    const x2 = toNode.x + 100;
    const y2 = toNode.y + 30;

    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    linkSvg.appendChild(line);
  });
}

/* CANVAS INTERACTION */

// zoom
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const delta = e.deltaY;
  const zoomFactor = delta > 0 ? 0.9 : 1.1;
  const newScale = Math.min(2.5, Math.max(0.3, state.scale * zoomFactor));

  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left - rect.width / 2;
  const cy = e.clientY - rect.top - rect.height / 2;

  state.offsetX = cx + (state.offsetX - cx) * (newScale / state.scale);
  state.offsetY = cy + (state.offsetY - cy) * (newScale / state.scale);
  state.scale = newScale;

  updateCanvasTransform();
});

// pan on empty drag
canvas.addEventListener("mousedown", e => {
  const target = e.target;
  if (target.closest(".node")) return;
  state.isPanning = true;
  state.panStartX = e.clientX;
  state.panStartY = e.clientY;
  state.panOriginX = state.offsetX;
  state.panOriginY = state.offsetY;
});

window.addEventListener("mousemove", e => {
  if (state.isPanning) {
    const dx = e.clientX - state.panStartX;
    const dy = e.clientY - state.panStartY;
    state.offsetX = state.panOriginX + dx;
    state.offsetY = state.panOriginY + dy;
    updateCanvasTransform();
  }

  if (state.draggingNodeId) {
    const node = state.nodes.find(n => n.id === state.draggingNodeId);
    if (!node) return;
    const dx = (e.clientX - state.dragPointerStart.x) / state.scale;
    const dy = (e.clientY - state.dragPointerStart.y) / state.scale;
    node.x = state.dragNodeStart.x + dx;
    node.y = state.dragNodeStart.y + dy;
    const el = document.querySelector(`.node[data-node-id="${node.id}"]`);
    if (el) {
      el.style.left = node.x + "px";
      el.style.top = node.y + "px";
    }
    rebuildLinks();
  }
});

window.addEventListener("mouseup", () => {
  state.isPanning = false;
  state.draggingNodeId = null;
});

// node drag
function onNodeMouseDown(e) {
  e.stopPropagation();
  const nodeId = e.currentTarget.dataset.nodeId;
  state.draggingNodeId = nodeId;
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  state.dragNodeStart = { x: node.x, y: node.y };
  state.dragPointerStart = { x: e.clientX, y: e.clientY };
}

// disable native context menu inside canvas
canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
});

// keyboard pan
document.addEventListener("keydown", e => {
  const step = 40;
  let moved = false;
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    state.offsetY += step;
    moved = true;
  }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
    state.offsetY -= step;
    moved = true;
  }
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    state.offsetX += step;
    moved = true;
  }
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    state.offsetX -= step;
    moved = true;
  }
  if (moved) {
    updateCanvasTransform();
  }
});

/* CONTEXT MENU + LINK CREATION */

let contextMenuEl = null;

function openNodeContextMenu(x, y, nodeId) {
  if (contextMenuEl) {
    contextMenuEl.remove();
    contextMenuEl = null;
  }

  contextMenuEl = document.createElement("div");
  contextMenuEl.className = "context-menu";

  const startLinkBtn = document.createElement("button");
  startLinkBtn.textContent = "Start supporting link from this node";
  startLinkBtn.addEventListener("click", () => {
    state.linkMode = { fromId: nodeId, type: "supporting" };
    closeContextMenu();
    alert("Now click another node to complete the link.");
  });

  const cancelLinkBtn = document.createElement("button");
  cancelLinkBtn.textContent = "Cancel active link (if any)";
  cancelLinkBtn.addEventListener("click", () => {
    state.linkMode = null;
    closeContextMenu();
  });

  contextMenuEl.appendChild(startLinkBtn);
  contextMenuEl.appendChild(cancelLinkBtn);

  contextMenuEl.style.left = x + "px";
  contextMenuEl.style.top = y + "px";

  document.body.appendChild(contextMenuEl);

  window.addEventListener(
    "click",
    () => {
      closeContextMenu();
    },
    { once: true }
  );
}

function closeContextMenu() {
  if (contextMenuEl) {
    contextMenuEl.remove();
    contextMenuEl = null;
  }
}

// link completion
canvasInner.addEventListener("click", e => {
  if (!state.linkMode) return;
  const nodeEl = e.target.closest(".node");
  if (!nodeEl) return;
  const toId = nodeEl.dataset.nodeId;
  if (!toId || toId === state.linkMode.fromId) return;

  const label = window.prompt(
    "Enter link label (or leave blank to use target node title):",
    ""
  );
  const targetNode = state.nodes.find(n => n.id === toId);
  const finalLabel = label && label.trim().length ? label.trim() : targetNode.title;

  state.links.push({
    from: state.linkMode.fromId,
    to: toId,
    label: finalLabel
  });
  state.linkMode = null;
  rebuildLinks();

  if (state.selectedNodeId) {
    selectNode(state.selectedNodeId);
  }
});

// hyperlinks inside detail panel
detailContent.addEventListener("click", e => {
  const link = e.target.closest("a[data-node-id]");
  if (!link) return;
  e.preventDefault();
  const nodeId = link.dataset.nodeId;
  selectNode(nodeId);
  scrollNodeIntoView(nodeId);
});

function scrollNodeIntoView(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  state.offsetX = -node.x;
  state.offsetY = -node.y;
  updateCanvasTransform();
}

/* EDITOR HELPERS */

function buildEditorBubbleCheckboxes() {
  editBubblesContainer.innerHTML = "";
  state.bubbles.forEach(bubble => {
    const label = document.createElement("label");
    label.className = "checkbox-label";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = bubble.id;
    cb.name = "bubble-checkbox";
    const span = document.createElement("span");
    span.textContent = bubble.title;
    label.appendChild(cb);
    label.appendChild(span);
    editBubblesContainer.appendChild(label);
  });
}

function setEditorBubbleSelection(selectedIds) {
  const set = new Set(selectedIds || []);
  editBubblesContainer
    .querySelectorAll('input[name="bubble-checkbox"]')
    .forEach(cb => {
      cb.checked = set.has(cb.value);
    });
}

function getEditorSelectedBubbleIds() {
  const ids = [];
  editBubblesContainer
    .querySelectorAll('input[name="bubble-checkbox"]')
    .forEach(cb => {
      if (cb.checked) ids.push(cb.value);
    });
  return ids;
}

function clearEditorFields() {
  editNodeIdInput.value = "";
  editNodeTitleInput.value = "";
  editNodeSummaryInput.value = "";
  editNodeContentInput.value = "";
  setEditorBubbleSelection([]);
  state.editor = { isNew: false, currentId: null };
}

function fillEditorFromNode(node) {
  editNodeIdInput.value = node.id;
  editNodeTitleInput.value = node.title || "";
  editNodeSummaryInput.value = node.summary || "";
  editNodeContentInput.value = node.contentHtml || "";
  setEditorBubbleSelection(node.bubbles || []);
  state.editor = { isNew: false, currentId: node.id };
}

/* EDITOR BUTTON HANDLERS */

btnNewNode.addEventListener("click", () => {
  const newId = "node-" + Date.now();
  editNodeIdInput.value = newId;
  editNodeTitleInput.value = "";
  editNodeSummaryInput.value = "";
  editNodeContentInput.value = "";
  setEditorBubbleSelection([]);
  state.editor = { isNew: true, currentId: newId };
  state.selectedNodeId = null;
  detailTitle.textContent = "New node";
  detailContent.innerHTML = "<p>Fill out the editor below and press <strong>Save node</strong>.</p>";
  document.querySelectorAll(".node").forEach(el => {
    el.style.borderColor = "rgba(148, 163, 184, 0.8)";
    el.style.boxShadow = "0 10px 25px rgba(15, 23, 42, 0.85)";
  });
  document.querySelectorAll(".node-button").forEach(btn => btn.classList.remove("active"));
});

btnSaveNode.addEventListener("click", () => {
  let id = (editNodeIdInput.value || "").trim();
  const title = (editNodeTitleInput.value || "").trim();
  const summary = (editNodeSummaryInput.value || "").trim();
  const contentHtml = editNodeContentInput.value || "";
  const bubbles = getEditorSelectedBubbleIds();

  if (!title) {
    alert("Title is required.");
    return;
  }

  if (!id) {
    id = "node-" + Date.now();
    editNodeIdInput.value = id;
  }

  const existing = state.nodes.find(n => n.id === id);

  if (!existing || state.editor.isNew) {
    const worldX = -state.offsetX / state.scale;
    const worldY = -state.offsetY / state.scale;
    const newNode = {
      id,
      title,
      summary,
      contentHtml,
      bubbles,
      x: worldX,
      y: worldY
    };
    state.nodes.push(newNode);
    state.editor = { isNew: false, currentId: id };
  } else {
    existing.title = title;
    existing.summary = summary;
    existing.contentHtml = contentHtml;
    existing.bubbles = bubbles;
  }

  state.selectedNodeId = id;

  buildCanvas();
  buildSidebars();
  buildHiddenContentDump();
  buildTextMap();
  selectNode(id);
});

btnDeleteNode.addEventListener("click", () => {
  const id = (editNodeIdInput.value || "").trim();
  if (!id) {
    alert("No node selected to delete.");
    return;
  }
  const node = state.nodes.find(n => n.id === id);
  if (!node) {
    alert("Node not found in current graph.");
    return;
  }
  const ok = window.confirm(`Delete node "${node.title}" and its links?`);
  if (!ok) return;

  state.nodes = state.nodes.filter(n => n.id !== id);
  state.links = state.links.filter(l => l.from !== id && l.to !== id);

  clearEditorFields();
  state.selectedNodeId = null;
  detailTitle.textContent = "Select a node";
  detailContent.innerHTML = "<p>Click any node or folder entry to view its content here.</p>";

  buildCanvas();
  buildSidebars();
  buildHiddenContentDump();
  buildTextMap();
});

btnDownloadJson.addEventListener("click", () => {
  const exportBubbles = state.bubbles.map(({ diameter, ...rest }) => rest);
  const exportNodes = state.nodes.map(({ x, y, ...rest }) => rest);
  const exportLinks = state.links.slice();

  const payload = {
    bubbles: exportBubbles,
    nodes: exportNodes,
    links: exportLinks
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "graph-data.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* INIT */

loadInitialData();
buildCanvas();
buildSidebars();
buildHiddenContentDump();
buildTextMap();
buildEditorBubbleCheckboxes();

if (state.nodes.length) {
  selectNode(state.nodes[0].id);
}
