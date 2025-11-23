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

let linkSvg;

// Utility: load initial data
function loadInitialData() {
  const el = document.getElementById("initial-data");
  const json = el.textContent || el.innerText;
  const data = JSON.parse(json);

  state.bubbles = data.bubbles.map(b => ({
    ...b,
    // Precompute diameter for DOM
    diameter: b.radius * 2
  }));

  // Give each node a default position in world space
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

// Build DOM for bubbles and nodes
function buildCanvas() {
  canvasInner.innerHTML = "";

  // Create SVG layer for links
  linkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  linkSvg.classList.add("link-layer");
  linkSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  linkSvg.setAttribute("width", "100%");
  linkSvg.setAttribute("height", "100%");
  canvasInner.appendChild(linkSvg);

  // Bubbles
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

  // Nodes
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
    summaryEl.textContent = node.summary;
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

    // Node events
    el.addEventListener("mousedown", onNodeMouseDown);
    el.addEventListener("click", e => {
      e.stopPropagation();
      selectNode(node.id);
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

// Build left sidebar
function buildSidebars() {
  bubbleFoldersContainer.innerHTML = "";
  allNodesList.innerHTML = "";

  // Map bubble -> nodes
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

  // Build bubble folders
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

    // simple collapse/expand
    let collapsed = false;
    header.addEventListener("click", () => {
      collapsed = !collapsed;
      body.style.display = collapsed ? "none" : "block";
    });

    folder.appendChild(header);
    folder.appendChild(body);
    bubbleFoldersContainer.appendChild(folder);
  });

  // All nodes flat list
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

// Hidden node dump for LLMs
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
    contentDiv.innerHTML = node.contentHtml;
    wrapper.appendChild(contentDiv);
    hiddenNodeContentContainer.appendChild(wrapper);
  });
}

// Text map to help dumb extractors
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

// Select and display node
function selectNode(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  state.selectedNodeId = nodeId;

  // Highlight in canvas
  document.querySelectorAll(".node").forEach(el => {
    if (el.dataset.nodeId === nodeId) {
      el.style.borderColor = "rgba(251, 191, 36, 0.95)";
      el.style.boxShadow = "0 0 26px rgba(251, 191, 36, 0.6)";
    } else {
      el.style.borderColor = "rgba(148, 163, 184, 0.8)";
      el.style.boxShadow = "0 10px 25px rgba(15, 23, 42, 0.85)";
    }
  });

  // Highlight in left list
  document.querySelectorAll(".node-button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.nodeId === nodeId);
  });

  detailTitle.textContent = node.title;

  // Build content with hyperlinks to linked nodes
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

  detailContent.innerHTML = node.contentHtml + linksHtml;
}

// Move canvas according to state
function updateCanvasTransform() {
  canvasInner.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
}

// Rebuild SVG links between node centers
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
    // Work in the same world coordinate system as nodes
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

// Mouse wheel zoom
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const delta = e.deltaY;
  const zoomFactor = delta > 0 ? 0.9 : 1.1;
  const newScale = Math.min(2.5, Math.max(0.3, state.scale * zoomFactor));

  // Zoom relative to pointer
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left - rect.width / 2;
  const cy = e.clientY - rect.top - rect.height / 2;

  state.offsetX = cx + (state.offsetX - cx) * (newScale / state.scale);
  state.offsetY = cy + (state.offsetY - cy) * (newScale / state.scale);
  state.scale = newScale;

  updateCanvasTransform();
});

// Canvas pan with left mouse on empty space
canvas.addEventListener("mousedown", e => {
  // Only start pan if click is not on a node
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

// Node drag start
function onNodeMouseDown(e) {
  e.stopPropagation();
  const nodeId = e.currentTarget.dataset.nodeId;
  state.draggingNodeId = nodeId;
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  state.dragNodeStart = { x: node.x, y: node.y };
  state.dragPointerStart = { x: e.clientX, y: e.clientY };
}

// Disable native context menu on canvas
canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
});

// Keyboard pan (WASD + arrows)
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

// Link context menu on nodes
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

// Complete link when linkMode is active and user clicks a node
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

  // If current detail matches fromId, refresh links section
  if (state.selectedNodeId === nodeEl.dataset.nodeId || state.selectedNodeId) {
    selectNode(state.selectedNodeId);
  }
});

// Handle hyperlink clicks inside detail panel
detailContent.addEventListener("click", e => {
  const link = e.target.closest("a[data-node-id]");
  if (!link) return;
  e.preventDefault();
  const nodeId = link.dataset.nodeId;
  selectNode(nodeId);
  scrollNodeIntoView(nodeId);
});

// Scroll canvas so that given node is near center (approximate)
function scrollNodeIntoView(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  state.offsetX = -node.x;
  state.offsetY = -node.y;
  updateCanvasTransform();
}

// Init
loadInitialData();
buildCanvas();
buildSidebars();
buildHiddenContentDump();
buildTextMap();

// Select a default node
if (state.nodes.length) {
  selectNode(state.nodes[0].id);
}
