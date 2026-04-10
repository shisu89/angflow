import {
  drag_default,
  identity,
  pointer_default,
  select_default,
  transform,
  value_default,
  zoom_default,
  zoom_default2
} from "./chunk-EPTEGXFS.js";
import {
  CommonModule,
  NgComponentOutlet,
  NgStyle,
  NgTemplateOutlet
} from "./chunk-M7VSX7U7.js";
import {
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  Inject,
  Injectable,
  InjectionToken,
  Injector,
  Input,
  NO_ERRORS_SCHEMA,
  NgZone,
  Optional,
  Output,
  TemplateRef,
  ViewChild,
  computed,
  contentChildren,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  setClassMetadata,
  signal,
  viewChild,
  ɵɵNgOnChangesFeature,
  ɵɵProvidersFeature,
  ɵɵadvance,
  ɵɵattribute,
  ɵɵclassMap,
  ɵɵclassProp,
  ɵɵconditional,
  ɵɵconditionalCreate,
  ɵɵcontentQuerySignal,
  ɵɵdeclareLet,
  ɵɵdefineComponent,
  ɵɵdefineDirective,
  ɵɵdefineInjectable,
  ɵɵdirectiveInject,
  ɵɵdomElement,
  ɵɵdomElementEnd,
  ɵɵdomElementStart,
  ɵɵdomListener,
  ɵɵdomProperty,
  ɵɵelement,
  ɵɵelementContainer,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵlistener,
  ɵɵnamespaceHTML,
  ɵɵnamespaceSVG,
  ɵɵnextContext,
  ɵɵprojection,
  ɵɵprojectionDef,
  ɵɵproperty,
  ɵɵqueryAdvance,
  ɵɵreadContextLet,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵresetView,
  ɵɵresolveDocument,
  ɵɵrestoreView,
  ɵɵsanitizeStyle,
  ɵɵstoreLet,
  ɵɵstyleProp,
  ɵɵtemplate,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵviewQuerySignal
} from "./chunk-YQ5EPEIE.js";
import {
  __objRest,
  __spreadProps,
  __spreadValues
} from "./chunk-GOMI4DH3.js";

// ../../node_modules/.pnpm/@angflow+system@0.0.77/node_modules/@angflow/system/dist/esm/index.js
var errorMessages = {
  error001: () => "[React Flow]: Seems like you have not used zustand provider as an ancestor. Help: https://reactflow.dev/error#001",
  error002: () => "It looks like you've created a new nodeTypes or edgeTypes object. If this wasn't on purpose please define the nodeTypes/edgeTypes outside of the component or memoize them.",
  error003: (nodeType) => `Node type "${nodeType}" not found. Using fallback type "default".`,
  error004: () => "The React Flow parent container needs a width and a height to render the graph.",
  error005: () => "Only child nodes can use a parent extent.",
  error006: () => "Can't create edge. An edge needs a source and a target.",
  error007: (id) => `The old edge with id=${id} does not exist.`,
  error009: (type) => `Marker type "${type}" doesn't exist.`,
  error008: (handleType, { id, sourceHandle, targetHandle }) => `Couldn't create edge for ${handleType} handle id: "${handleType === "source" ? sourceHandle : targetHandle}", edge id: ${id}.`,
  error010: () => "Handle: No node id found. Make sure to only use a Handle inside a custom Node.",
  error011: (edgeType) => `Edge type "${edgeType}" not found. Using fallback type "default".`,
  error012: (id) => `Node with id "${id}" does not exist, it may have been removed. This can happen when a node is deleted before the "onNodeClick" handler is called.`,
  error013: (lib = "react") => `It seems that you haven't loaded the styles. Please import '@ngflow/${lib}/dist/style.css' or base.css to make sure everything is working properly.`,
  error014: () => "useNodeConnections: No node ID found. Call useNodeConnections inside a custom Node or provide a node ID.",
  error015: () => "It seems that you are trying to drag a node that is not initialized. Please use onNodesChange as explained in the docs."
};
var infiniteExtent = [
  [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
];
var defaultAriaLabelConfig = {
  "node.a11yDescription.default": "Press enter or space to select a node. Press delete to remove it and escape to cancel.",
  "node.a11yDescription.keyboardDisabled": "Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.",
  "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) => `Moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
  "edge.a11yDescription.default": "Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.",
  // Control elements
  "controls.ariaLabel": "Control Panel",
  "controls.zoomIn.ariaLabel": "Zoom In",
  "controls.zoomOut.ariaLabel": "Zoom Out",
  "controls.fitView.ariaLabel": "Fit View",
  "controls.interactive.ariaLabel": "Toggle Interactivity",
  // Mini map
  "minimap.ariaLabel": "Mini Map",
  // Handle
  "handle.ariaLabel": "Handle"
};
var ConnectionMode;
(function(ConnectionMode2) {
  ConnectionMode2["Strict"] = "strict";
  ConnectionMode2["Loose"] = "loose";
})(ConnectionMode || (ConnectionMode = {}));
var PanOnScrollMode;
(function(PanOnScrollMode2) {
  PanOnScrollMode2["Free"] = "free";
  PanOnScrollMode2["Vertical"] = "vertical";
  PanOnScrollMode2["Horizontal"] = "horizontal";
})(PanOnScrollMode || (PanOnScrollMode = {}));
var SelectionMode;
(function(SelectionMode2) {
  SelectionMode2["Partial"] = "partial";
  SelectionMode2["Full"] = "full";
})(SelectionMode || (SelectionMode = {}));
var initialConnection = {
  inProgress: false,
  isValid: null,
  from: null,
  fromHandle: null,
  fromPosition: null,
  fromNode: null,
  to: null,
  toHandle: null,
  toPosition: null,
  toNode: null,
  pointer: null
};
var ConnectionLineType;
(function(ConnectionLineType2) {
  ConnectionLineType2["Bezier"] = "default";
  ConnectionLineType2["Straight"] = "straight";
  ConnectionLineType2["Step"] = "step";
  ConnectionLineType2["SmoothStep"] = "smoothstep";
  ConnectionLineType2["SimpleBezier"] = "simplebezier";
})(ConnectionLineType || (ConnectionLineType = {}));
var MarkerType;
(function(MarkerType2) {
  MarkerType2["Arrow"] = "arrow";
  MarkerType2["ArrowClosed"] = "arrowclosed";
})(MarkerType || (MarkerType = {}));
var Position;
(function(Position2) {
  Position2["Left"] = "left";
  Position2["Top"] = "top";
  Position2["Right"] = "right";
  Position2["Bottom"] = "bottom";
})(Position || (Position = {}));
var oppositePosition = {
  [Position.Left]: Position.Right,
  [Position.Right]: Position.Left,
  [Position.Top]: Position.Bottom,
  [Position.Bottom]: Position.Top
};
var isEdgeBase = (element) => "id" in element && "source" in element && "target" in element;
var isNodeBase = (element) => "id" in element && "position" in element && !("source" in element) && !("target" in element);
var isInternalNodeBase = (element) => "id" in element && "internals" in element && !("source" in element) && !("target" in element);
var getOutgoers = (node, nodes, edges) => {
  if (!node.id) {
    return [];
  }
  const outgoerIds = /* @__PURE__ */ new Set();
  edges.forEach((edge) => {
    if (edge.source === node.id) {
      outgoerIds.add(edge.target);
    }
  });
  return nodes.filter((n) => outgoerIds.has(n.id));
};
var getIncomers = (node, nodes, edges) => {
  if (!node.id) {
    return [];
  }
  const incomersIds = /* @__PURE__ */ new Set();
  edges.forEach((edge) => {
    if (edge.target === node.id) {
      incomersIds.add(edge.source);
    }
  });
  return nodes.filter((n) => incomersIds.has(n.id));
};
var getNodePositionWithOrigin = (node, nodeOrigin = [0, 0]) => {
  const { width, height } = getNodeDimensions(node);
  const origin = node.origin ?? nodeOrigin;
  const offsetX = width * origin[0];
  const offsetY = height * origin[1];
  return {
    x: node.position.x - offsetX,
    y: node.position.y - offsetY
  };
};
var getNodesBounds = (nodes, params = { nodeOrigin: [0, 0] }) => {
  if (!params.nodeLookup) {
    console.warn("Please use `getNodesBounds` from `useReactFlow`/`useSvelteFlow` hook to ensure correct values for sub flows. If not possible, you have to provide a nodeLookup to support sub flows.");
  }
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const box = nodes.reduce((currBox, nodeOrId) => {
    const isId = typeof nodeOrId === "string";
    let currentNode = !params.nodeLookup && !isId ? nodeOrId : void 0;
    if (params.nodeLookup) {
      currentNode = isId ? params.nodeLookup.get(nodeOrId) : !isInternalNodeBase(nodeOrId) ? params.nodeLookup.get(nodeOrId.id) : nodeOrId;
    }
    const nodeBox = currentNode ? nodeToBox(currentNode, params.nodeOrigin) : { x: 0, y: 0, x2: 0, y2: 0 };
    return getBoundsOfBoxes(currBox, nodeBox);
  }, { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity });
  return boxToRect(box);
};
var getInternalNodesBounds = (nodeLookup, params = {}) => {
  let box = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
  let hasVisibleNodes = false;
  nodeLookup.forEach((node) => {
    if (params.filter === void 0 || params.filter(node)) {
      box = getBoundsOfBoxes(box, nodeToBox(node));
      hasVisibleNodes = true;
    }
  });
  return hasVisibleNodes ? boxToRect(box) : { x: 0, y: 0, width: 0, height: 0 };
};
var getNodesInside = (nodes, rect, [tx, ty, tScale] = [0, 0, 1], partially = false, excludeNonSelectableNodes = false) => {
  const paneRect = __spreadProps(__spreadValues({}, pointToRendererPoint(rect, [tx, ty, tScale])), {
    width: rect.width / tScale,
    height: rect.height / tScale
  });
  const visibleNodes = [];
  for (const node of nodes.values()) {
    const { measured, selectable = true, hidden = false } = node;
    if (excludeNonSelectableNodes && !selectable || hidden) {
      continue;
    }
    const width = measured.width ?? node.width ?? node.initialWidth ?? null;
    const height = measured.height ?? node.height ?? node.initialHeight ?? null;
    const overlappingArea = getOverlappingArea(paneRect, nodeToRect(node));
    const area = (width ?? 0) * (height ?? 0);
    const partiallyVisible = partially && overlappingArea > 0;
    const forceInitialRender = !node.internals.handleBounds;
    const isVisible = forceInitialRender || partiallyVisible || overlappingArea >= area;
    if (isVisible || node.dragging) {
      visibleNodes.push(node);
    }
  }
  return visibleNodes;
};
var getConnectedEdges = (nodes, edges) => {
  const nodeIds = /* @__PURE__ */ new Set();
  nodes.forEach((node) => {
    nodeIds.add(node.id);
  });
  return edges.filter((edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target));
};
function getFitViewNodes(nodeLookup, options) {
  const fitViewNodes = /* @__PURE__ */ new Map();
  const optionNodeIds = options?.nodes ? new Set(options.nodes.map((node) => node.id)) : null;
  nodeLookup.forEach((n) => {
    const isVisible = n.measured.width && n.measured.height && (options?.includeHiddenNodes || !n.hidden);
    if (isVisible && (!optionNodeIds || optionNodeIds.has(n.id))) {
      fitViewNodes.set(n.id, n);
    }
  });
  return fitViewNodes;
}
async function fitViewport({ nodes, width, height, panZoom, minZoom, maxZoom }, options) {
  if (nodes.size === 0) {
    return Promise.resolve(true);
  }
  const nodesToFit = getFitViewNodes(nodes, options);
  const bounds = getInternalNodesBounds(nodesToFit);
  const viewport = getViewportForBounds(bounds, width, height, options?.minZoom ?? minZoom, options?.maxZoom ?? maxZoom, options?.padding ?? 0.1);
  await panZoom.setViewport(viewport, {
    duration: options?.duration,
    ease: options?.ease,
    interpolate: options?.interpolate
  });
  return Promise.resolve(true);
}
function calculateNodePosition({ nodeId, nextPosition, nodeLookup, nodeOrigin = [0, 0], nodeExtent, onError }) {
  const node = nodeLookup.get(nodeId);
  const parentNode = node.parentId ? nodeLookup.get(node.parentId) : void 0;
  const { x: parentX, y: parentY } = parentNode ? parentNode.internals.positionAbsolute : { x: 0, y: 0 };
  const origin = node.origin ?? nodeOrigin;
  let extent = node.extent || nodeExtent;
  if (node.extent === "parent" && !node.expandParent) {
    if (!parentNode) {
      onError?.("005", errorMessages["error005"]());
    } else {
      const parentWidth = parentNode.measured.width;
      const parentHeight = parentNode.measured.height;
      if (parentWidth && parentHeight) {
        extent = [
          [parentX, parentY],
          [parentX + parentWidth, parentY + parentHeight]
        ];
      }
    }
  } else if (parentNode && isCoordinateExtent(node.extent)) {
    extent = [
      [node.extent[0][0] + parentX, node.extent[0][1] + parentY],
      [node.extent[1][0] + parentX, node.extent[1][1] + parentY]
    ];
  }
  const positionAbsolute = isCoordinateExtent(extent) ? clampPosition(nextPosition, extent, node.measured) : nextPosition;
  if (node.measured.width === void 0 || node.measured.height === void 0) {
    onError?.("015", errorMessages["error015"]());
  }
  return {
    position: {
      x: positionAbsolute.x - parentX + (node.measured.width ?? 0) * origin[0],
      y: positionAbsolute.y - parentY + (node.measured.height ?? 0) * origin[1]
    },
    positionAbsolute
  };
}
var clamp = (val, min = 0, max = 1) => Math.min(Math.max(val, min), max);
var clampPosition = (position = { x: 0, y: 0 }, extent, dimensions) => ({
  x: clamp(position.x, extent[0][0], extent[1][0] - (dimensions?.width ?? 0)),
  y: clamp(position.y, extent[0][1], extent[1][1] - (dimensions?.height ?? 0))
});
function clampPositionToParent(childPosition, childDimensions, parent) {
  const { width: parentWidth, height: parentHeight } = getNodeDimensions(parent);
  const { x: parentX, y: parentY } = parent.internals.positionAbsolute;
  return clampPosition(childPosition, [
    [parentX, parentY],
    [parentX + parentWidth, parentY + parentHeight]
  ], childDimensions);
}
var calcAutoPanVelocity = (value, min, max) => {
  if (value < min) {
    return clamp(Math.abs(value - min), 1, min) / min;
  } else if (value > max) {
    return -clamp(Math.abs(value - max), 1, min) / min;
  }
  return 0;
};
var calcAutoPan = (pos, bounds, speed = 15, distance2 = 40) => {
  const xMovement = calcAutoPanVelocity(pos.x, distance2, bounds.width - distance2) * speed;
  const yMovement = calcAutoPanVelocity(pos.y, distance2, bounds.height - distance2) * speed;
  return [xMovement, yMovement];
};
var getBoundsOfBoxes = (box1, box2) => ({
  x: Math.min(box1.x, box2.x),
  y: Math.min(box1.y, box2.y),
  x2: Math.max(box1.x2, box2.x2),
  y2: Math.max(box1.y2, box2.y2)
});
var rectToBox = ({ x, y, width, height }) => ({
  x,
  y,
  x2: x + width,
  y2: y + height
});
var boxToRect = ({ x, y, x2, y2 }) => ({
  x,
  y,
  width: x2 - x,
  height: y2 - y
});
var nodeToRect = (node, nodeOrigin = [0, 0]) => {
  const { x, y } = isInternalNodeBase(node) ? node.internals.positionAbsolute : getNodePositionWithOrigin(node, nodeOrigin);
  return {
    x,
    y,
    width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
    height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0
  };
};
var nodeToBox = (node, nodeOrigin = [0, 0]) => {
  const { x, y } = isInternalNodeBase(node) ? node.internals.positionAbsolute : getNodePositionWithOrigin(node, nodeOrigin);
  return {
    x,
    y,
    x2: x + (node.measured?.width ?? node.width ?? node.initialWidth ?? 0),
    y2: y + (node.measured?.height ?? node.height ?? node.initialHeight ?? 0)
  };
};
var getBoundsOfRects = (rect1, rect2) => boxToRect(getBoundsOfBoxes(rectToBox(rect1), rectToBox(rect2)));
var getOverlappingArea = (rectA, rectB) => {
  const xOverlap = Math.max(0, Math.min(rectA.x + rectA.width, rectB.x + rectB.width) - Math.max(rectA.x, rectB.x));
  const yOverlap = Math.max(0, Math.min(rectA.y + rectA.height, rectB.y + rectB.height) - Math.max(rectA.y, rectB.y));
  return Math.ceil(xOverlap * yOverlap);
};
var isNumeric = (n) => !isNaN(n) && isFinite(n);
var devWarn = (id, message) => {
  if (true) {
    console.warn(`[React Flow]: ${message} Help: https://reactflow.dev/error#${id}`);
  }
};
var snapPosition = (position, snapGrid = [1, 1]) => {
  return {
    x: snapGrid[0] * Math.round(position.x / snapGrid[0]),
    y: snapGrid[1] * Math.round(position.y / snapGrid[1])
  };
};
var pointToRendererPoint = ({ x, y }, [tx, ty, tScale], snapToGrid = false, snapGrid = [1, 1]) => {
  const position = {
    x: (x - tx) / tScale,
    y: (y - ty) / tScale
  };
  return snapToGrid ? snapPosition(position, snapGrid) : position;
};
var rendererPointToPoint = ({ x, y }, [tx, ty, tScale]) => {
  return {
    x: x * tScale + tx,
    y: y * tScale + ty
  };
};
function parsePadding(padding, viewport) {
  if (typeof padding === "number") {
    return Math.floor((viewport - viewport / (1 + padding)) * 0.5);
  }
  if (typeof padding === "string" && padding.endsWith("px")) {
    const paddingValue = parseFloat(padding);
    if (!Number.isNaN(paddingValue)) {
      return Math.floor(paddingValue);
    }
  }
  if (typeof padding === "string" && padding.endsWith("%")) {
    const paddingValue = parseFloat(padding);
    if (!Number.isNaN(paddingValue)) {
      return Math.floor(viewport * paddingValue * 0.01);
    }
  }
  console.error(`[React Flow] The padding value "${padding}" is invalid. Please provide a number or a string with a valid unit (px or %).`);
  return 0;
}
function parsePaddings(padding, width, height) {
  if (typeof padding === "string" || typeof padding === "number") {
    const paddingY = parsePadding(padding, height);
    const paddingX = parsePadding(padding, width);
    return {
      top: paddingY,
      right: paddingX,
      bottom: paddingY,
      left: paddingX,
      x: paddingX * 2,
      y: paddingY * 2
    };
  }
  if (typeof padding === "object") {
    const top = parsePadding(padding.top ?? padding.y ?? 0, height);
    const bottom = parsePadding(padding.bottom ?? padding.y ?? 0, height);
    const left = parsePadding(padding.left ?? padding.x ?? 0, width);
    const right = parsePadding(padding.right ?? padding.x ?? 0, width);
    return { top, right, bottom, left, x: left + right, y: top + bottom };
  }
  return { top: 0, right: 0, bottom: 0, left: 0, x: 0, y: 0 };
}
function calculateAppliedPaddings(bounds, x, y, zoom, width, height) {
  const { x: left, y: top } = rendererPointToPoint(bounds, [x, y, zoom]);
  const { x: boundRight, y: boundBottom } = rendererPointToPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, [x, y, zoom]);
  const right = width - boundRight;
  const bottom = height - boundBottom;
  return {
    left: Math.floor(left),
    top: Math.floor(top),
    right: Math.floor(right),
    bottom: Math.floor(bottom)
  };
}
var getViewportForBounds = (bounds, width, height, minZoom, maxZoom, padding) => {
  const p = parsePaddings(padding, width, height);
  const xZoom = (width - p.x) / bounds.width;
  const yZoom = (height - p.y) / bounds.height;
  const zoom = Math.min(xZoom, yZoom);
  const clampedZoom = clamp(zoom, minZoom, maxZoom);
  const boundsCenterX = bounds.x + bounds.width / 2;
  const boundsCenterY = bounds.y + bounds.height / 2;
  const x = width / 2 - boundsCenterX * clampedZoom;
  const y = height / 2 - boundsCenterY * clampedZoom;
  const newPadding = calculateAppliedPaddings(bounds, x, y, clampedZoom, width, height);
  const offset = {
    left: Math.min(newPadding.left - p.left, 0),
    top: Math.min(newPadding.top - p.top, 0),
    right: Math.min(newPadding.right - p.right, 0),
    bottom: Math.min(newPadding.bottom - p.bottom, 0)
  };
  return {
    x: x - offset.left + offset.right,
    y: y - offset.top + offset.bottom,
    zoom: clampedZoom
  };
};
var isMacOs = () => typeof navigator !== "undefined" && navigator?.userAgent?.indexOf("Mac") >= 0;
function isCoordinateExtent(extent) {
  return extent !== void 0 && extent !== null && extent !== "parent";
}
function getNodeDimensions(node) {
  return {
    width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
    height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0
  };
}
function getPointerPosition(event, { snapGrid = [0, 0], snapToGrid = false, transform: transform2, containerBounds }) {
  const { x, y } = getEventPosition(event);
  const pointerPos = pointToRendererPoint({ x: x - (containerBounds?.left ?? 0), y: y - (containerBounds?.top ?? 0) }, transform2);
  const { x: xSnapped, y: ySnapped } = snapToGrid ? snapPosition(pointerPos, snapGrid) : pointerPos;
  return __spreadValues({
    xSnapped,
    ySnapped
  }, pointerPos);
}
var getDimensions = (node) => ({
  width: node.offsetWidth,
  height: node.offsetHeight
});
var getHostForElement = (element) => element?.getRootNode?.() || window?.document;
var inputTags = ["INPUT", "SELECT", "TEXTAREA"];
function isInputDOMNode(event) {
  const target = event.composedPath?.()?.[0] || event.target;
  if (target?.nodeType !== 1)
    return false;
  const isInput = inputTags.includes(target.nodeName) || target.hasAttribute("contenteditable");
  return isInput || !!target.closest(".nokey");
}
var isMouseEvent = (event) => "clientX" in event;
var getEventPosition = (event, bounds) => {
  const isMouse = isMouseEvent(event);
  const evtX = isMouse ? event.clientX : event.touches?.[0].clientX;
  const evtY = isMouse ? event.clientY : event.touches?.[0].clientY;
  return {
    x: evtX - (bounds?.left ?? 0),
    y: evtY - (bounds?.top ?? 0)
  };
};
var getHandleBounds = (type, nodeElement, nodeBounds, zoom, nodeId) => {
  const handles = nodeElement.querySelectorAll(`.${type}`);
  if (!handles || !handles.length) {
    return null;
  }
  return Array.from(handles).map((handle) => {
    const handleBounds = handle.getBoundingClientRect();
    return __spreadValues({
      id: handle.getAttribute("data-handleid"),
      type,
      nodeId,
      position: handle.getAttribute("data-handlepos"),
      x: (handleBounds.left - nodeBounds.left) / zoom,
      y: (handleBounds.top - nodeBounds.top) / zoom
    }, getDimensions(handle));
  });
};
function getBezierEdgeCenter({ sourceX, sourceY, targetX, targetY, sourceControlX, sourceControlY, targetControlX, targetControlY }) {
  const centerX = sourceX * 0.125 + sourceControlX * 0.375 + targetControlX * 0.375 + targetX * 0.125;
  const centerY = sourceY * 0.125 + sourceControlY * 0.375 + targetControlY * 0.375 + targetY * 0.125;
  const offsetX = Math.abs(centerX - sourceX);
  const offsetY = Math.abs(centerY - sourceY);
  return [centerX, centerY, offsetX, offsetY];
}
function calculateControlOffset(distance2, curvature) {
  if (distance2 >= 0) {
    return 0.5 * distance2;
  }
  return curvature * 25 * Math.sqrt(-distance2);
}
function getControlWithCurvature({ pos, x1, y1, x2, y2, c }) {
  switch (pos) {
    case Position.Left:
      return [x1 - calculateControlOffset(x1 - x2, c), y1];
    case Position.Right:
      return [x1 + calculateControlOffset(x2 - x1, c), y1];
    case Position.Top:
      return [x1, y1 - calculateControlOffset(y1 - y2, c)];
    case Position.Bottom:
      return [x1, y1 + calculateControlOffset(y2 - y1, c)];
  }
}
function getBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, curvature = 0.25 }) {
  const [sourceControlX, sourceControlY] = getControlWithCurvature({
    pos: sourcePosition,
    x1: sourceX,
    y1: sourceY,
    x2: targetX,
    y2: targetY,
    c: curvature
  });
  const [targetControlX, targetControlY] = getControlWithCurvature({
    pos: targetPosition,
    x1: targetX,
    y1: targetY,
    x2: sourceX,
    y2: sourceY,
    c: curvature
  });
  const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    sourceControlY,
    targetControlX,
    targetControlY
  });
  return [
    `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
    offsetX,
    offsetY
  ];
}
function getEdgeCenter({ sourceX, sourceY, targetX, targetY }) {
  const xOffset = Math.abs(targetX - sourceX) / 2;
  const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;
  const yOffset = Math.abs(targetY - sourceY) / 2;
  const centerY = targetY < sourceY ? targetY + yOffset : targetY - yOffset;
  return [centerX, centerY, xOffset, yOffset];
}
var getEdgeId = ({ source, sourceHandle, target, targetHandle }) => `xy-edge__${source}${sourceHandle || ""}-${target}${targetHandle || ""}`;
var connectionExists = (edge, edges) => {
  return edges.some((el) => el.source === edge.source && el.target === edge.target && (el.sourceHandle === edge.sourceHandle || !el.sourceHandle && !edge.sourceHandle) && (el.targetHandle === edge.targetHandle || !el.targetHandle && !edge.targetHandle));
};
var addEdge = (edgeParams, edges, options = {}) => {
  if (!edgeParams.source || !edgeParams.target) {
    devWarn("006", errorMessages["error006"]());
    return edges;
  }
  const edgeIdGenerator = options.getEdgeId || getEdgeId;
  let edge;
  if (isEdgeBase(edgeParams)) {
    edge = __spreadValues({}, edgeParams);
  } else {
    edge = __spreadProps(__spreadValues({}, edgeParams), {
      id: edgeIdGenerator(edgeParams)
    });
  }
  if (connectionExists(edge, edges)) {
    return edges;
  }
  if (edge.sourceHandle === null) {
    delete edge.sourceHandle;
  }
  if (edge.targetHandle === null) {
    delete edge.targetHandle;
  }
  return edges.concat(edge);
};
var reconnectEdge = (oldEdge, newConnection, edges, options = { shouldReplaceId: true }) => {
  const _a = oldEdge, { id: oldEdgeId } = _a, rest = __objRest(_a, ["id"]);
  if (!newConnection.source || !newConnection.target) {
    devWarn("006", errorMessages["error006"]());
    return edges;
  }
  const foundEdge = edges.find((e) => e.id === oldEdge.id);
  if (!foundEdge) {
    devWarn("007", errorMessages["error007"](oldEdgeId));
    return edges;
  }
  const edgeIdGenerator = options.getEdgeId || getEdgeId;
  const edge = __spreadProps(__spreadValues({}, rest), {
    id: options.shouldReplaceId ? edgeIdGenerator(newConnection) : oldEdgeId,
    source: newConnection.source,
    target: newConnection.target,
    sourceHandle: newConnection.sourceHandle,
    targetHandle: newConnection.targetHandle
  });
  return edges.filter((e) => e.id !== oldEdgeId).concat(edge);
};
function getStraightPath({ sourceX, sourceY, targetX, targetY }) {
  const [labelX, labelY, offsetX, offsetY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY
  });
  return [`M ${sourceX},${sourceY}L ${targetX},${targetY}`, labelX, labelY, offsetX, offsetY];
}
var handleDirections = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 }
};
var getDirection = ({ source, sourcePosition = Position.Bottom, target }) => {
  if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
    return source.x < target.x ? { x: 1, y: 0 } : { x: -1, y: 0 };
  }
  return source.y < target.y ? { x: 0, y: 1 } : { x: 0, y: -1 };
};
var distance = (a, b) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
function getPoints({ source, sourcePosition = Position.Bottom, target, targetPosition = Position.Top, center, offset, stepPosition }) {
  const sourceDir = handleDirections[sourcePosition];
  const targetDir = handleDirections[targetPosition];
  const sourceGapped = { x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset };
  const targetGapped = { x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset };
  const dir = getDirection({
    source: sourceGapped,
    sourcePosition,
    target: targetGapped
  });
  const dirAccessor = dir.x !== 0 ? "x" : "y";
  const currDir = dir[dirAccessor];
  let points = [];
  let centerX, centerY;
  const sourceGapOffset = { x: 0, y: 0 };
  const targetGapOffset = { x: 0, y: 0 };
  const [, , defaultOffsetX, defaultOffsetY] = getEdgeCenter({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y
  });
  if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
    if (dirAccessor === "x") {
      centerX = center.x ?? sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition;
      centerY = center.y ?? (sourceGapped.y + targetGapped.y) / 2;
    } else {
      centerX = center.x ?? (sourceGapped.x + targetGapped.x) / 2;
      centerY = center.y ?? sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
    }
    const verticalSplit = [
      { x: centerX, y: sourceGapped.y },
      { x: centerX, y: targetGapped.y }
    ];
    const horizontalSplit = [
      { x: sourceGapped.x, y: centerY },
      { x: targetGapped.x, y: centerY }
    ];
    if (sourceDir[dirAccessor] === currDir) {
      points = dirAccessor === "x" ? verticalSplit : horizontalSplit;
    } else {
      points = dirAccessor === "x" ? horizontalSplit : verticalSplit;
    }
  } else {
    const sourceTarget = [{ x: sourceGapped.x, y: targetGapped.y }];
    const targetSource = [{ x: targetGapped.x, y: sourceGapped.y }];
    if (dirAccessor === "x") {
      points = sourceDir.x === currDir ? targetSource : sourceTarget;
    } else {
      points = sourceDir.y === currDir ? sourceTarget : targetSource;
    }
    if (sourcePosition === targetPosition) {
      const diff = Math.abs(source[dirAccessor] - target[dirAccessor]);
      if (diff <= offset) {
        const gapOffset = Math.min(offset - 1, offset - diff);
        if (sourceDir[dirAccessor] === currDir) {
          sourceGapOffset[dirAccessor] = (sourceGapped[dirAccessor] > source[dirAccessor] ? -1 : 1) * gapOffset;
        } else {
          targetGapOffset[dirAccessor] = (targetGapped[dirAccessor] > target[dirAccessor] ? -1 : 1) * gapOffset;
        }
      }
    }
    if (sourcePosition !== targetPosition) {
      const dirAccessorOpposite = dirAccessor === "x" ? "y" : "x";
      const isSameDir = sourceDir[dirAccessor] === targetDir[dirAccessorOpposite];
      const sourceGtTargetOppo = sourceGapped[dirAccessorOpposite] > targetGapped[dirAccessorOpposite];
      const sourceLtTargetOppo = sourceGapped[dirAccessorOpposite] < targetGapped[dirAccessorOpposite];
      const flipSourceTarget = sourceDir[dirAccessor] === 1 && (!isSameDir && sourceGtTargetOppo || isSameDir && sourceLtTargetOppo) || sourceDir[dirAccessor] !== 1 && (!isSameDir && sourceLtTargetOppo || isSameDir && sourceGtTargetOppo);
      if (flipSourceTarget) {
        points = dirAccessor === "x" ? sourceTarget : targetSource;
      }
    }
    const sourceGapPoint = { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y };
    const targetGapPoint = { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y };
    const maxXDistance = Math.max(Math.abs(sourceGapPoint.x - points[0].x), Math.abs(targetGapPoint.x - points[0].x));
    const maxYDistance = Math.max(Math.abs(sourceGapPoint.y - points[0].y), Math.abs(targetGapPoint.y - points[0].y));
    if (maxXDistance >= maxYDistance) {
      centerX = (sourceGapPoint.x + targetGapPoint.x) / 2;
      centerY = points[0].y;
    } else {
      centerX = points[0].x;
      centerY = (sourceGapPoint.y + targetGapPoint.y) / 2;
    }
  }
  const gappedSource = { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y };
  const gappedTarget = { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y };
  const pathPoints = [
    source,
    // we only want to add the gapped source/target if they are different from the first/last point to avoid duplicates which can cause issues with the bends
    ...gappedSource.x !== points[0].x || gappedSource.y !== points[0].y ? [gappedSource] : [],
    ...points,
    ...gappedTarget.x !== points[points.length - 1].x || gappedTarget.y !== points[points.length - 1].y ? [gappedTarget] : [],
    target
  ];
  return [pathPoints, centerX, centerY, defaultOffsetX, defaultOffsetY];
}
function getBend(a, b, c, size) {
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
  const { x, y } = b;
  if (a.x === x && x === c.x || a.y === y && y === c.y) {
    return `L${x} ${y}`;
  }
  if (a.y === y) {
    const xDir2 = a.x < c.x ? -1 : 1;
    const yDir2 = a.y < c.y ? 1 : -1;
    return `L ${x + bendSize * xDir2},${y}Q ${x},${y} ${x},${y + bendSize * yDir2}`;
  }
  const xDir = a.x < c.x ? 1 : -1;
  const yDir = a.y < c.y ? -1 : 1;
  return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}
function getSmoothStepPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, borderRadius = 5, centerX, centerY, offset = 20, stepPosition = 0.5 }) {
  const [points, labelX, labelY, offsetX, offsetY] = getPoints({
    source: { x: sourceX, y: sourceY },
    sourcePosition,
    target: { x: targetX, y: targetY },
    targetPosition,
    center: { x: centerX, y: centerY },
    offset,
    stepPosition
  });
  let path = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    path += getBend(points[i - 1], points[i], points[i + 1], borderRadius);
  }
  path += `L${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return [path, labelX, labelY, offsetX, offsetY];
}
function getHandlePosition(node, handle, fallbackPosition = Position.Left, center = false) {
  const x = (handle?.x ?? 0) + node.internals.positionAbsolute.x;
  const y = (handle?.y ?? 0) + node.internals.positionAbsolute.y;
  const { width, height } = handle ?? getNodeDimensions(node);
  if (center) {
    return { x: x + width / 2, y: y + height / 2 };
  }
  const position = handle?.position ?? fallbackPosition;
  switch (position) {
    case Position.Top:
      return { x: x + width / 2, y };
    case Position.Right:
      return { x: x + width, y: y + height / 2 };
    case Position.Bottom:
      return { x: x + width / 2, y: y + height };
    case Position.Left:
      return { x, y: y + height / 2 };
  }
}
function getMarkerId(marker, id) {
  if (!marker) {
    return "";
  }
  if (typeof marker === "string") {
    return marker;
  }
  const idPrefix = id ? `${id}__` : "";
  return `${idPrefix}${Object.keys(marker).sort().map((key) => `${key}=${marker[key]}`).join("&")}`;
}
function getNodeToolbarTransform(nodeRect, viewport, position, offset, align) {
  let alignmentOffset = 0.5;
  if (align === "start") {
    alignmentOffset = 0;
  } else if (align === "end") {
    alignmentOffset = 1;
  }
  let pos = [
    (nodeRect.x + nodeRect.width * alignmentOffset) * viewport.zoom + viewport.x,
    nodeRect.y * viewport.zoom + viewport.y - offset
  ];
  let shift = [-100 * alignmentOffset, -100];
  switch (position) {
    case Position.Right:
      pos = [
        (nodeRect.x + nodeRect.width) * viewport.zoom + viewport.x + offset,
        (nodeRect.y + nodeRect.height * alignmentOffset) * viewport.zoom + viewport.y
      ];
      shift = [0, -100 * alignmentOffset];
      break;
    case Position.Bottom:
      pos[1] = (nodeRect.y + nodeRect.height) * viewport.zoom + viewport.y + offset;
      shift[1] = 0;
      break;
    case Position.Left:
      pos = [
        nodeRect.x * viewport.zoom + viewport.x - offset,
        (nodeRect.y + nodeRect.height * alignmentOffset) * viewport.zoom + viewport.y
      ];
      shift = [-100, -100 * alignmentOffset];
      break;
  }
  return `translate(${pos[0]}px, ${pos[1]}px) translate(${shift[0]}%, ${shift[1]}%)`;
}
var alignXToPercent = {
  left: 0,
  center: 50,
  right: 100
};
var alignYToPercent = {
  top: 0,
  center: 50,
  bottom: 100
};
function getEdgeToolbarTransform(x, y, zoom, alignX = "center", alignY = "center") {
  return `translate(${x}px, ${y}px) scale(${1 / zoom}) translate(${-(alignXToPercent[alignX] ?? 50)}%, ${-(alignYToPercent[alignY] ?? 50)}%)`;
}
var SELECTED_NODE_Z = 1e3;
var ROOT_PARENT_Z_INCREMENT = 10;
var defaultOptions = {
  nodeOrigin: [0, 0],
  nodeExtent: infiniteExtent,
  elevateNodesOnSelect: true,
  zIndexMode: "basic",
  defaults: {}
};
var adoptUserNodesDefaultOptions = __spreadProps(__spreadValues({}, defaultOptions), {
  checkEquality: true
});
function mergeObjects(base, incoming) {
  const result = __spreadValues({}, base);
  for (const key in incoming) {
    if (incoming[key] !== void 0) {
      result[key] = incoming[key];
    }
  }
  return result;
}
function updateAbsolutePositions(nodeLookup, parentLookup, options) {
  const _options = mergeObjects(defaultOptions, options);
  for (const node of nodeLookup.values()) {
    if (node.parentId) {
      updateChildNode(node, nodeLookup, parentLookup, _options);
    } else {
      const positionWithOrigin = getNodePositionWithOrigin(node, _options.nodeOrigin);
      const extent = isCoordinateExtent(node.extent) ? node.extent : _options.nodeExtent;
      const clampedPosition = clampPosition(positionWithOrigin, extent, getNodeDimensions(node));
      node.internals.positionAbsolute = clampedPosition;
    }
  }
}
function parseHandles(userNode, internalNode) {
  if (!userNode.handles) {
    return !userNode.measured ? void 0 : internalNode?.internals.handleBounds;
  }
  const source = [];
  const target = [];
  for (const handle of userNode.handles) {
    const handleBounds = {
      id: handle.id,
      width: handle.width ?? 1,
      height: handle.height ?? 1,
      nodeId: userNode.id,
      x: handle.x,
      y: handle.y,
      position: handle.position,
      type: handle.type
    };
    if (handle.type === "source") {
      source.push(handleBounds);
    } else if (handle.type === "target") {
      target.push(handleBounds);
    }
  }
  return {
    source,
    target
  };
}
function isManualZIndexMode(zIndexMode) {
  return zIndexMode === "manual";
}
function adoptUserNodes(nodes, nodeLookup, parentLookup, options = {}) {
  const _options = mergeObjects(adoptUserNodesDefaultOptions, options);
  const rootParentIndex = { i: 0 };
  const tmpLookup = new Map(nodeLookup);
  const selectedNodeZ = _options?.elevateNodesOnSelect && !isManualZIndexMode(_options.zIndexMode) ? SELECTED_NODE_Z : 0;
  let nodesInitialized = nodes.length > 0;
  let hasSelectedNodes = false;
  nodeLookup.clear();
  parentLookup.clear();
  for (const userNode of nodes) {
    let internalNode = tmpLookup.get(userNode.id);
    if (_options.checkEquality && userNode === internalNode?.internals.userNode) {
      nodeLookup.set(userNode.id, internalNode);
    } else {
      const positionWithOrigin = getNodePositionWithOrigin(userNode, _options.nodeOrigin);
      const extent = isCoordinateExtent(userNode.extent) ? userNode.extent : _options.nodeExtent;
      const clampedPosition = clampPosition(positionWithOrigin, extent, getNodeDimensions(userNode));
      internalNode = __spreadProps(__spreadValues(__spreadValues({}, _options.defaults), userNode), {
        measured: {
          width: userNode.measured?.width,
          height: userNode.measured?.height
        },
        internals: {
          positionAbsolute: clampedPosition,
          // if user re-initializes the node or removes `measured` for whatever reason, we reset the handleBounds so that the node gets re-measured
          handleBounds: parseHandles(userNode, internalNode),
          z: calculateZ(userNode, selectedNodeZ, _options.zIndexMode),
          userNode
        }
      });
      nodeLookup.set(userNode.id, internalNode);
    }
    if ((internalNode.measured === void 0 || internalNode.measured.width === void 0 || internalNode.measured.height === void 0) && !internalNode.hidden) {
      nodesInitialized = false;
    }
    if (userNode.parentId) {
      updateChildNode(internalNode, nodeLookup, parentLookup, options, rootParentIndex);
    }
    hasSelectedNodes ||= userNode.selected ?? false;
  }
  return { nodesInitialized, hasSelectedNodes };
}
function updateParentLookup(node, parentLookup) {
  if (!node.parentId) {
    return;
  }
  const childNodes = parentLookup.get(node.parentId);
  if (childNodes) {
    childNodes.set(node.id, node);
  } else {
    parentLookup.set(node.parentId, /* @__PURE__ */ new Map([[node.id, node]]));
  }
}
function updateChildNode(node, nodeLookup, parentLookup, options, rootParentIndex) {
  const { elevateNodesOnSelect, nodeOrigin, nodeExtent, zIndexMode } = mergeObjects(defaultOptions, options);
  const parentId = node.parentId;
  const parentNode = nodeLookup.get(parentId);
  if (!parentNode) {
    console.warn(`Parent node ${parentId} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`);
    return;
  }
  updateParentLookup(node, parentLookup);
  if (rootParentIndex && !parentNode.parentId && parentNode.internals.rootParentIndex === void 0 && zIndexMode === "auto") {
    parentNode.internals.rootParentIndex = ++rootParentIndex.i;
    parentNode.internals.z = parentNode.internals.z + rootParentIndex.i * ROOT_PARENT_Z_INCREMENT;
  }
  if (rootParentIndex && parentNode.internals.rootParentIndex !== void 0) {
    rootParentIndex.i = parentNode.internals.rootParentIndex;
  }
  const selectedNodeZ = elevateNodesOnSelect && !isManualZIndexMode(zIndexMode) ? SELECTED_NODE_Z : 0;
  const { x, y, z } = calculateChildXYZ(node, parentNode, nodeOrigin, nodeExtent, selectedNodeZ, zIndexMode);
  const { positionAbsolute } = node.internals;
  const positionChanged = x !== positionAbsolute.x || y !== positionAbsolute.y;
  if (positionChanged || z !== node.internals.z) {
    nodeLookup.set(node.id, __spreadProps(__spreadValues({}, node), {
      internals: __spreadProps(__spreadValues({}, node.internals), {
        positionAbsolute: positionChanged ? { x, y } : positionAbsolute,
        z
      })
    }));
  }
}
function calculateZ(node, selectedNodeZ, zIndexMode) {
  const zIndex = isNumeric(node.zIndex) ? node.zIndex : 0;
  if (isManualZIndexMode(zIndexMode)) {
    return zIndex;
  }
  return zIndex + (node.selected ? selectedNodeZ : 0);
}
function calculateChildXYZ(childNode, parentNode, nodeOrigin, nodeExtent, selectedNodeZ, zIndexMode) {
  const { x: parentX, y: parentY } = parentNode.internals.positionAbsolute;
  const childDimensions = getNodeDimensions(childNode);
  const positionWithOrigin = getNodePositionWithOrigin(childNode, nodeOrigin);
  const clampedPosition = isCoordinateExtent(childNode.extent) ? clampPosition(positionWithOrigin, childNode.extent, childDimensions) : positionWithOrigin;
  let absolutePosition = clampPosition({ x: parentX + clampedPosition.x, y: parentY + clampedPosition.y }, nodeExtent, childDimensions);
  if (childNode.extent === "parent") {
    absolutePosition = clampPositionToParent(absolutePosition, childDimensions, parentNode);
  }
  const childZ = calculateZ(childNode, selectedNodeZ, zIndexMode);
  const parentZ = parentNode.internals.z ?? 0;
  return {
    x: absolutePosition.x,
    y: absolutePosition.y,
    z: parentZ >= childZ ? parentZ + 1 : childZ
  };
}
function handleExpandParent(children, nodeLookup, parentLookup, nodeOrigin = [0, 0]) {
  const changes = [];
  const parentExpansions = /* @__PURE__ */ new Map();
  for (const child of children) {
    const parent = nodeLookup.get(child.parentId);
    if (!parent) {
      continue;
    }
    const parentRect = parentExpansions.get(child.parentId)?.expandedRect ?? nodeToRect(parent);
    const expandedRect = getBoundsOfRects(parentRect, child.rect);
    parentExpansions.set(child.parentId, { expandedRect, parent });
  }
  if (parentExpansions.size > 0) {
    parentExpansions.forEach(({ expandedRect, parent }, parentId) => {
      const positionAbsolute = parent.internals.positionAbsolute;
      const dimensions = getNodeDimensions(parent);
      const origin = parent.origin ?? nodeOrigin;
      const xChange = expandedRect.x < positionAbsolute.x ? Math.round(Math.abs(positionAbsolute.x - expandedRect.x)) : 0;
      const yChange = expandedRect.y < positionAbsolute.y ? Math.round(Math.abs(positionAbsolute.y - expandedRect.y)) : 0;
      const newWidth = Math.max(dimensions.width, Math.round(expandedRect.width));
      const newHeight = Math.max(dimensions.height, Math.round(expandedRect.height));
      const widthChange = (newWidth - dimensions.width) * origin[0];
      const heightChange = (newHeight - dimensions.height) * origin[1];
      if (xChange > 0 || yChange > 0 || widthChange || heightChange) {
        changes.push({
          id: parentId,
          type: "position",
          position: {
            x: parent.position.x - xChange + widthChange,
            y: parent.position.y - yChange + heightChange
          }
        });
        parentLookup.get(parentId)?.forEach((childNode) => {
          if (!children.some((child) => child.id === childNode.id)) {
            changes.push({
              id: childNode.id,
              type: "position",
              position: {
                x: childNode.position.x + xChange,
                y: childNode.position.y + yChange
              }
            });
          }
        });
      }
      if (dimensions.width < expandedRect.width || dimensions.height < expandedRect.height || xChange || yChange) {
        changes.push({
          id: parentId,
          type: "dimensions",
          setAttributes: true,
          dimensions: {
            width: newWidth + (xChange ? origin[0] * xChange - widthChange : 0),
            height: newHeight + (yChange ? origin[1] * yChange - heightChange : 0)
          }
        });
      }
    });
  }
  return changes;
}
function updateNodeInternals(updates, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, zIndexMode) {
  const viewportNode = domNode?.querySelector(".xyflow__viewport");
  let updatedInternals = false;
  if (!viewportNode) {
    return { changes: [], updatedInternals };
  }
  const changes = [];
  const style = window.getComputedStyle(viewportNode);
  const { m22: zoom } = new window.DOMMatrixReadOnly(style.transform);
  const parentExpandChildren = [];
  for (const update of updates.values()) {
    const node = nodeLookup.get(update.id);
    if (!node) {
      continue;
    }
    if (node.hidden) {
      nodeLookup.set(node.id, __spreadProps(__spreadValues({}, node), {
        internals: __spreadProps(__spreadValues({}, node.internals), {
          handleBounds: void 0
        })
      }));
      updatedInternals = true;
      continue;
    }
    const dimensions = getDimensions(update.nodeElement);
    const dimensionChanged = node.measured.width !== dimensions.width || node.measured.height !== dimensions.height;
    const doUpdate = !!(dimensions.width && dimensions.height && (dimensionChanged || !node.internals.handleBounds || update.force));
    if (doUpdate) {
      const nodeBounds = update.nodeElement.getBoundingClientRect();
      const extent = isCoordinateExtent(node.extent) ? node.extent : nodeExtent;
      let { positionAbsolute } = node.internals;
      if (node.parentId && node.extent === "parent") {
        positionAbsolute = clampPositionToParent(positionAbsolute, dimensions, nodeLookup.get(node.parentId));
      } else if (extent) {
        positionAbsolute = clampPosition(positionAbsolute, extent, dimensions);
      }
      const newNode = __spreadProps(__spreadValues({}, node), {
        measured: dimensions,
        internals: __spreadProps(__spreadValues({}, node.internals), {
          positionAbsolute,
          handleBounds: {
            source: getHandleBounds("source", update.nodeElement, nodeBounds, zoom, node.id),
            target: getHandleBounds("target", update.nodeElement, nodeBounds, zoom, node.id)
          }
        })
      });
      nodeLookup.set(node.id, newNode);
      if (node.parentId) {
        updateChildNode(newNode, nodeLookup, parentLookup, { nodeOrigin, zIndexMode });
      }
      updatedInternals = true;
      if (dimensionChanged) {
        changes.push({
          id: node.id,
          type: "dimensions",
          dimensions
        });
        if (node.expandParent && node.parentId) {
          parentExpandChildren.push({
            id: node.id,
            parentId: node.parentId,
            rect: nodeToRect(newNode, nodeOrigin)
          });
        }
      }
    }
  }
  if (parentExpandChildren.length > 0) {
    const parentExpandChanges = handleExpandParent(parentExpandChildren, nodeLookup, parentLookup, nodeOrigin);
    changes.push(...parentExpandChanges);
  }
  return { changes, updatedInternals };
}
async function panBy({ delta, panZoom, transform: transform2, translateExtent, width, height }) {
  if (!panZoom || !delta.x && !delta.y) {
    return Promise.resolve(false);
  }
  const nextViewport = await panZoom.setViewportConstrained({
    x: transform2[0] + delta.x,
    y: transform2[1] + delta.y,
    zoom: transform2[2]
  }, [
    [0, 0],
    [width, height]
  ], translateExtent);
  const transformChanged = !!nextViewport && (nextViewport.x !== transform2[0] || nextViewport.y !== transform2[1] || nextViewport.k !== transform2[2]);
  return Promise.resolve(transformChanged);
}
function addConnectionToLookup(type, connection, connectionKey, connectionLookup, nodeId, handleId) {
  let key = nodeId;
  const nodeMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
  connectionLookup.set(key, nodeMap.set(connectionKey, connection));
  key = `${nodeId}-${type}`;
  const typeMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
  connectionLookup.set(key, typeMap.set(connectionKey, connection));
  if (handleId) {
    key = `${nodeId}-${type}-${handleId}`;
    const handleMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
    connectionLookup.set(key, handleMap.set(connectionKey, connection));
  }
}
function updateConnectionLookup(connectionLookup, edgeLookup, edges) {
  connectionLookup.clear();
  edgeLookup.clear();
  for (const edge of edges) {
    const { source: sourceNode, target: targetNode, sourceHandle = null, targetHandle = null } = edge;
    const connection = { edgeId: edge.id, source: sourceNode, target: targetNode, sourceHandle, targetHandle };
    const sourceKey = `${sourceNode}-${sourceHandle}--${targetNode}-${targetHandle}`;
    const targetKey = `${targetNode}-${targetHandle}--${sourceNode}-${sourceHandle}`;
    addConnectionToLookup("source", connection, targetKey, connectionLookup, sourceNode, sourceHandle);
    addConnectionToLookup("target", connection, sourceKey, connectionLookup, targetNode, targetHandle);
    edgeLookup.set(edge.id, edge);
  }
}
function isParentSelected(node, nodeLookup) {
  if (!node.parentId) {
    return false;
  }
  const parentNode = nodeLookup.get(node.parentId);
  if (!parentNode) {
    return false;
  }
  if (parentNode.selected) {
    return true;
  }
  return isParentSelected(parentNode, nodeLookup);
}
function hasSelector(target, selector, domNode) {
  let current = target;
  do {
    if (current?.matches?.(selector))
      return true;
    if (current === domNode)
      return false;
    current = current?.parentElement;
  } while (current);
  return false;
}
function getDragItems(nodeLookup, nodesDraggable, mousePos, nodeId) {
  const dragItems = /* @__PURE__ */ new Map();
  for (const [id, node] of nodeLookup) {
    if ((node.selected || node.id === nodeId) && (!node.parentId || !isParentSelected(node, nodeLookup)) && (node.draggable || nodesDraggable && typeof node.draggable === "undefined")) {
      const internalNode = nodeLookup.get(id);
      if (internalNode) {
        dragItems.set(id, {
          id,
          position: internalNode.position || { x: 0, y: 0 },
          distance: {
            x: mousePos.x - internalNode.internals.positionAbsolute.x,
            y: mousePos.y - internalNode.internals.positionAbsolute.y
          },
          extent: internalNode.extent,
          parentId: internalNode.parentId,
          origin: internalNode.origin,
          expandParent: internalNode.expandParent,
          internals: {
            positionAbsolute: internalNode.internals.positionAbsolute || { x: 0, y: 0 }
          },
          measured: {
            width: internalNode.measured.width ?? 0,
            height: internalNode.measured.height ?? 0
          }
        });
      }
    }
  }
  return dragItems;
}
function getEventHandlerParams({ nodeId, dragItems, nodeLookup, dragging = true }) {
  const nodesFromDragItems = [];
  for (const [id, dragItem] of dragItems) {
    const node2 = nodeLookup.get(id)?.internals.userNode;
    if (node2) {
      nodesFromDragItems.push(__spreadProps(__spreadValues({}, node2), {
        position: dragItem.position,
        dragging
      }));
    }
  }
  if (!nodeId) {
    return [nodesFromDragItems[0], nodesFromDragItems];
  }
  const node = nodeLookup.get(nodeId)?.internals.userNode;
  return [
    !node ? nodesFromDragItems[0] : __spreadProps(__spreadValues({}, node), {
      position: dragItems.get(nodeId)?.position || node.position,
      dragging
    }),
    nodesFromDragItems
  ];
}
function calculateSnapOffset({ dragItems, snapGrid, x, y }) {
  const refDragItem = dragItems.values().next().value;
  if (!refDragItem) {
    return null;
  }
  const refPos = {
    x: x - refDragItem.distance.x,
    y: y - refDragItem.distance.y
  };
  const refPosSnapped = snapPosition(refPos, snapGrid);
  return {
    x: refPosSnapped.x - refPos.x,
    y: refPosSnapped.y - refPos.y
  };
}
function XYDrag({ onNodeMouseDown, getStoreItems, onDragStart, onDrag, onDragStop }) {
  let lastPos = { x: null, y: null };
  let autoPanId = 0;
  let dragItems = /* @__PURE__ */ new Map();
  let autoPanStarted = false;
  let mousePosition = { x: 0, y: 0 };
  let containerBounds = null;
  let dragStarted = false;
  let d3Selection = null;
  let abortDrag = false;
  let nodePositionsChanged = false;
  let dragEvent = null;
  function update({ noDragClassName, handleSelector, domNode, isSelectable, nodeId, nodeClickDistance = 0 }) {
    d3Selection = select_default(domNode);
    function updateNodes({ x, y }) {
      const { nodeLookup, nodeExtent, snapGrid, snapToGrid, nodeOrigin, onNodeDrag, onSelectionDrag, onError, updateNodePositions } = getStoreItems();
      lastPos = { x, y };
      let hasChange = false;
      const isMultiDrag = dragItems.size > 1;
      const nodesBox = isMultiDrag && nodeExtent ? rectToBox(getInternalNodesBounds(dragItems)) : null;
      const multiDragSnapOffset = isMultiDrag && snapToGrid ? calculateSnapOffset({
        dragItems,
        snapGrid,
        x,
        y
      }) : null;
      for (const [id, dragItem] of dragItems) {
        if (!nodeLookup.has(id)) {
          continue;
        }
        let nextPosition = { x: x - dragItem.distance.x, y: y - dragItem.distance.y };
        if (snapToGrid) {
          nextPosition = multiDragSnapOffset ? {
            x: Math.round(nextPosition.x + multiDragSnapOffset.x),
            y: Math.round(nextPosition.y + multiDragSnapOffset.y)
          } : snapPosition(nextPosition, snapGrid);
        }
        let adjustedNodeExtent = null;
        if (isMultiDrag && nodeExtent && !dragItem.extent && nodesBox) {
          const { positionAbsolute: positionAbsolute2 } = dragItem.internals;
          const x1 = positionAbsolute2.x - nodesBox.x + nodeExtent[0][0];
          const x2 = positionAbsolute2.x + dragItem.measured.width - nodesBox.x2 + nodeExtent[1][0];
          const y1 = positionAbsolute2.y - nodesBox.y + nodeExtent[0][1];
          const y2 = positionAbsolute2.y + dragItem.measured.height - nodesBox.y2 + nodeExtent[1][1];
          adjustedNodeExtent = [
            [x1, y1],
            [x2, y2]
          ];
        }
        const { position, positionAbsolute } = calculateNodePosition({
          nodeId: id,
          nextPosition,
          nodeLookup,
          nodeExtent: adjustedNodeExtent ? adjustedNodeExtent : nodeExtent,
          nodeOrigin,
          onError
        });
        hasChange = hasChange || dragItem.position.x !== position.x || dragItem.position.y !== position.y;
        dragItem.position = position;
        dragItem.internals.positionAbsolute = positionAbsolute;
      }
      nodePositionsChanged = nodePositionsChanged || hasChange;
      if (!hasChange) {
        return;
      }
      updateNodePositions(dragItems, true);
      if (dragEvent && (onDrag || onNodeDrag || !nodeId && onSelectionDrag)) {
        const [currentNode, currentNodes] = getEventHandlerParams({
          nodeId,
          dragItems,
          nodeLookup
        });
        onDrag?.(dragEvent, dragItems, currentNode, currentNodes);
        onNodeDrag?.(dragEvent, currentNode, currentNodes);
        if (!nodeId) {
          onSelectionDrag?.(dragEvent, currentNodes);
        }
      }
    }
    async function autoPan() {
      if (!containerBounds) {
        return;
      }
      const { transform: transform2, panBy: panBy2, autoPanSpeed, autoPanOnNodeDrag } = getStoreItems();
      if (!autoPanOnNodeDrag) {
        autoPanStarted = false;
        cancelAnimationFrame(autoPanId);
        return;
      }
      const [xMovement, yMovement] = calcAutoPan(mousePosition, containerBounds, autoPanSpeed);
      if (xMovement !== 0 || yMovement !== 0) {
        lastPos.x = (lastPos.x ?? 0) - xMovement / transform2[2];
        lastPos.y = (lastPos.y ?? 0) - yMovement / transform2[2];
        if (await panBy2({ x: xMovement, y: yMovement })) {
          updateNodes(lastPos);
        }
      }
      autoPanId = requestAnimationFrame(autoPan);
    }
    function startDrag(event) {
      const { nodeLookup, multiSelectionActive, nodesDraggable, transform: transform2, snapGrid, snapToGrid, selectNodesOnDrag, onNodeDragStart, onSelectionDragStart, unselectNodesAndEdges } = getStoreItems();
      dragStarted = true;
      if ((!selectNodesOnDrag || !isSelectable) && !multiSelectionActive && nodeId) {
        if (!nodeLookup.get(nodeId)?.selected) {
          unselectNodesAndEdges();
        }
      }
      if (isSelectable && selectNodesOnDrag && nodeId) {
        onNodeMouseDown?.(nodeId);
      }
      const pointerPos = getPointerPosition(event.sourceEvent, { transform: transform2, snapGrid, snapToGrid, containerBounds });
      lastPos = pointerPos;
      dragItems = getDragItems(nodeLookup, nodesDraggable, pointerPos, nodeId);
      if (dragItems.size > 0 && (onDragStart || onNodeDragStart || !nodeId && onSelectionDragStart)) {
        const [currentNode, currentNodes] = getEventHandlerParams({
          nodeId,
          dragItems,
          nodeLookup
        });
        onDragStart?.(event.sourceEvent, dragItems, currentNode, currentNodes);
        onNodeDragStart?.(event.sourceEvent, currentNode, currentNodes);
        if (!nodeId) {
          onSelectionDragStart?.(event.sourceEvent, currentNodes);
        }
      }
    }
    const d3DragInstance = drag_default().clickDistance(nodeClickDistance).on("start", (event) => {
      const { domNode: domNode2, nodeDragThreshold, transform: transform2, snapGrid, snapToGrid } = getStoreItems();
      containerBounds = domNode2?.getBoundingClientRect() || null;
      abortDrag = false;
      nodePositionsChanged = false;
      dragEvent = event.sourceEvent;
      if (nodeDragThreshold === 0) {
        startDrag(event);
      }
      const pointerPos = getPointerPosition(event.sourceEvent, { transform: transform2, snapGrid, snapToGrid, containerBounds });
      lastPos = pointerPos;
      mousePosition = getEventPosition(event.sourceEvent, containerBounds);
    }).on("drag", (event) => {
      const { autoPanOnNodeDrag, transform: transform2, snapGrid, snapToGrid, nodeDragThreshold, nodeLookup } = getStoreItems();
      const pointerPos = getPointerPosition(event.sourceEvent, { transform: transform2, snapGrid, snapToGrid, containerBounds });
      dragEvent = event.sourceEvent;
      if (event.sourceEvent.type === "touchmove" && event.sourceEvent.touches.length > 1 || // if user deletes a node while dragging, we need to abort the drag to prevent errors
      nodeId && !nodeLookup.has(nodeId)) {
        abortDrag = true;
      }
      if (abortDrag) {
        return;
      }
      if (!autoPanStarted && autoPanOnNodeDrag && dragStarted) {
        autoPanStarted = true;
        autoPan();
      }
      if (!dragStarted) {
        const currentMousePosition = getEventPosition(event.sourceEvent, containerBounds);
        const x = currentMousePosition.x - mousePosition.x;
        const y = currentMousePosition.y - mousePosition.y;
        const distance2 = Math.sqrt(x * x + y * y);
        if (distance2 > nodeDragThreshold) {
          startDrag(event);
        }
      }
      if ((lastPos.x !== pointerPos.xSnapped || lastPos.y !== pointerPos.ySnapped) && dragItems && dragStarted) {
        mousePosition = getEventPosition(event.sourceEvent, containerBounds);
        updateNodes(pointerPos);
      }
    }).on("end", (event) => {
      if (!dragStarted || abortDrag) {
        return;
      }
      autoPanStarted = false;
      dragStarted = false;
      cancelAnimationFrame(autoPanId);
      if (dragItems.size > 0) {
        const { nodeLookup, updateNodePositions, onNodeDragStop, onSelectionDragStop } = getStoreItems();
        if (nodePositionsChanged) {
          updateNodePositions(dragItems, false);
          nodePositionsChanged = false;
        }
        if (onDragStop || onNodeDragStop || !nodeId && onSelectionDragStop) {
          const [currentNode, currentNodes] = getEventHandlerParams({
            nodeId,
            dragItems,
            nodeLookup,
            dragging: false
          });
          onDragStop?.(event.sourceEvent, dragItems, currentNode, currentNodes);
          onNodeDragStop?.(event.sourceEvent, currentNode, currentNodes);
          if (!nodeId) {
            onSelectionDragStop?.(event.sourceEvent, currentNodes);
          }
        }
      }
    }).filter((event) => {
      const target = event.target;
      const isDraggable = !event.button && (!noDragClassName || !hasSelector(target, `.${noDragClassName}`, domNode)) && (!handleSelector || hasSelector(target, handleSelector, domNode));
      return isDraggable;
    });
    d3Selection.call(d3DragInstance);
  }
  function destroy() {
    d3Selection?.on(".drag", null);
  }
  return {
    update,
    destroy
  };
}
function getNodesWithinDistance(position, nodeLookup, distance2) {
  const nodes = [];
  const rect = {
    x: position.x - distance2,
    y: position.y - distance2,
    width: distance2 * 2,
    height: distance2 * 2
  };
  for (const node of nodeLookup.values()) {
    if (getOverlappingArea(rect, nodeToRect(node)) > 0) {
      nodes.push(node);
    }
  }
  return nodes;
}
var ADDITIONAL_DISTANCE = 250;
function getClosestHandle(position, connectionRadius, nodeLookup, fromHandle) {
  let closestHandles = [];
  let minDistance = Infinity;
  const closeNodes = getNodesWithinDistance(position, nodeLookup, connectionRadius + ADDITIONAL_DISTANCE);
  for (const node of closeNodes) {
    const allHandles = [...node.internals.handleBounds?.source ?? [], ...node.internals.handleBounds?.target ?? []];
    for (const handle of allHandles) {
      if (fromHandle.nodeId === handle.nodeId && fromHandle.type === handle.type && fromHandle.id === handle.id) {
        continue;
      }
      const { x, y } = getHandlePosition(node, handle, handle.position, true);
      const distance2 = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (distance2 > connectionRadius) {
        continue;
      }
      if (distance2 < minDistance) {
        closestHandles = [__spreadProps(__spreadValues({}, handle), { x, y })];
        minDistance = distance2;
      } else if (distance2 === minDistance) {
        closestHandles.push(__spreadProps(__spreadValues({}, handle), { x, y }));
      }
    }
  }
  if (!closestHandles.length) {
    return null;
  }
  if (closestHandles.length > 1) {
    const oppositeHandleType = fromHandle.type === "source" ? "target" : "source";
    return closestHandles.find((handle) => handle.type === oppositeHandleType) ?? closestHandles[0];
  }
  return closestHandles[0];
}
function getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode, withAbsolutePosition = false) {
  const node = nodeLookup.get(nodeId);
  if (!node) {
    return null;
  }
  const handles = connectionMode === "strict" ? node.internals.handleBounds?.[handleType] : [...node.internals.handleBounds?.source ?? [], ...node.internals.handleBounds?.target ?? []];
  const handle = (handleId ? handles?.find((h) => h.id === handleId) : handles?.[0]) ?? null;
  return handle && withAbsolutePosition ? __spreadValues(__spreadValues({}, handle), getHandlePosition(node, handle, handle.position, true)) : handle;
}
function getHandleType(edgeUpdaterType, handleDomNode) {
  if (edgeUpdaterType) {
    return edgeUpdaterType;
  } else if (handleDomNode?.classList.contains("target")) {
    return "target";
  } else if (handleDomNode?.classList.contains("source")) {
    return "source";
  }
  return null;
}
function isConnectionValid(isInsideConnectionRadius, isHandleValid) {
  let isValid = null;
  if (isHandleValid) {
    isValid = true;
  } else if (isInsideConnectionRadius && !isHandleValid) {
    isValid = false;
  }
  return isValid;
}
var alwaysValid = () => true;
function onPointerDown(event, { connectionMode, connectionRadius, handleId, nodeId, edgeUpdaterType, isTarget, domNode, nodeLookup, lib, autoPanOnConnect, flowId, panBy: panBy2, cancelConnection, onConnectStart, onConnect, onConnectEnd, isValidConnection = alwaysValid, onReconnectEnd, updateConnection, getTransform, getFromHandle, autoPanSpeed, dragThreshold = 1, handleDomNode }) {
  const doc = getHostForElement(event.target);
  let autoPanId = 0;
  let closestHandle;
  const { x, y } = getEventPosition(event);
  const handleType = getHandleType(edgeUpdaterType, handleDomNode);
  const containerBounds = domNode?.getBoundingClientRect();
  let connectionStarted = false;
  if (!containerBounds || !handleType) {
    return;
  }
  const fromHandleInternal = getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode);
  if (!fromHandleInternal) {
    return;
  }
  let position = getEventPosition(event, containerBounds);
  let autoPanStarted = false;
  let connection = null;
  let isValid = false;
  let resultHandleDomNode = null;
  function autoPan() {
    if (!autoPanOnConnect || !containerBounds) {
      return;
    }
    const [x2, y2] = calcAutoPan(position, containerBounds, autoPanSpeed);
    panBy2({ x: x2, y: y2 });
    autoPanId = requestAnimationFrame(autoPan);
  }
  const fromHandle = __spreadProps(__spreadValues({}, fromHandleInternal), {
    nodeId,
    type: handleType,
    position: fromHandleInternal.position
  });
  const fromInternalNode = nodeLookup.get(nodeId);
  const from = getHandlePosition(fromInternalNode, fromHandle, Position.Left, true);
  let previousConnection = {
    inProgress: true,
    isValid: null,
    from,
    fromHandle,
    fromPosition: fromHandle.position,
    fromNode: fromInternalNode,
    to: position,
    toHandle: null,
    toPosition: oppositePosition[fromHandle.position],
    toNode: null,
    pointer: position
  };
  function startConnection() {
    connectionStarted = true;
    updateConnection(previousConnection);
    onConnectStart?.(event, { nodeId, handleId, handleType });
  }
  if (dragThreshold === 0) {
    startConnection();
  }
  function onPointerMove(event2) {
    if (!connectionStarted) {
      const { x: evtX, y: evtY } = getEventPosition(event2);
      const dx = evtX - x;
      const dy = evtY - y;
      const nextConnectionStarted = dx * dx + dy * dy > dragThreshold * dragThreshold;
      if (!nextConnectionStarted) {
        return;
      }
      startConnection();
    }
    if (!getFromHandle() || !fromHandle) {
      onPointerUp(event2);
      return;
    }
    const transform2 = getTransform();
    position = getEventPosition(event2, containerBounds);
    closestHandle = getClosestHandle(pointToRendererPoint(position, transform2, false, [1, 1]), connectionRadius, nodeLookup, fromHandle);
    if (!autoPanStarted) {
      autoPan();
      autoPanStarted = true;
    }
    const result = isValidHandle(event2, {
      handle: closestHandle,
      connectionMode,
      fromNodeId: nodeId,
      fromHandleId: handleId,
      fromType: isTarget ? "target" : "source",
      isValidConnection,
      doc,
      lib,
      flowId,
      nodeLookup
    });
    resultHandleDomNode = result.handleDomNode;
    connection = result.connection;
    isValid = isConnectionValid(!!closestHandle, result.isValid);
    const fromInternalNode2 = nodeLookup.get(nodeId);
    const from2 = fromInternalNode2 ? getHandlePosition(fromInternalNode2, fromHandle, Position.Left, true) : previousConnection.from;
    const newConnection = __spreadProps(__spreadValues({}, previousConnection), {
      from: from2,
      isValid,
      to: result.toHandle && isValid ? rendererPointToPoint({ x: result.toHandle.x, y: result.toHandle.y }, transform2) : position,
      toHandle: result.toHandle,
      toPosition: isValid && result.toHandle ? result.toHandle.position : oppositePosition[fromHandle.position],
      toNode: result.toHandle ? nodeLookup.get(result.toHandle.nodeId) : null,
      pointer: position
    });
    updateConnection(newConnection);
    previousConnection = newConnection;
  }
  function onPointerUp(event2) {
    if ("touches" in event2 && event2.touches.length > 0) {
      return;
    }
    if (connectionStarted) {
      if ((closestHandle || resultHandleDomNode) && connection && isValid) {
        onConnect?.(connection);
      }
      const _a = previousConnection, { inProgress } = _a, connectionState = __objRest(_a, ["inProgress"]);
      const finalConnectionState = __spreadProps(__spreadValues({}, connectionState), {
        toPosition: previousConnection.toHandle ? previousConnection.toPosition : null
      });
      onConnectEnd?.(event2, finalConnectionState);
      if (edgeUpdaterType) {
        onReconnectEnd?.(event2, finalConnectionState);
      }
    }
    cancelConnection();
    cancelAnimationFrame(autoPanId);
    autoPanStarted = false;
    isValid = false;
    connection = null;
    resultHandleDomNode = null;
    doc.removeEventListener("mousemove", onPointerMove);
    doc.removeEventListener("mouseup", onPointerUp);
    doc.removeEventListener("touchmove", onPointerMove);
    doc.removeEventListener("touchend", onPointerUp);
  }
  doc.addEventListener("mousemove", onPointerMove);
  doc.addEventListener("mouseup", onPointerUp);
  doc.addEventListener("touchmove", onPointerMove);
  doc.addEventListener("touchend", onPointerUp);
}
function isValidHandle(event, { handle, connectionMode, fromNodeId, fromHandleId, fromType, doc, lib, flowId, isValidConnection = alwaysValid, nodeLookup }) {
  const isTarget = fromType === "target";
  const handleDomNode = handle ? doc.querySelector(`.${lib}-flow__handle[data-id="${flowId}-${handle?.nodeId}-${handle?.id}-${handle?.type}"]`) : null;
  const { x, y } = getEventPosition(event);
  const handleBelow = doc.elementFromPoint(x, y);
  const handleToCheck = handleBelow?.classList.contains(`${lib}-flow__handle`) ? handleBelow : handleDomNode;
  const result = {
    handleDomNode: handleToCheck,
    isValid: false,
    connection: null,
    toHandle: null
  };
  if (handleToCheck) {
    const handleType = getHandleType(void 0, handleToCheck);
    const handleNodeId = handleToCheck.getAttribute("data-nodeid");
    const handleId = handleToCheck.getAttribute("data-handleid");
    const connectable = handleToCheck.classList.contains("connectable");
    const connectableEnd = handleToCheck.classList.contains("connectableend");
    if (!handleNodeId || !handleType) {
      return result;
    }
    const connection = {
      source: isTarget ? handleNodeId : fromNodeId,
      sourceHandle: isTarget ? handleId : fromHandleId,
      target: isTarget ? fromNodeId : handleNodeId,
      targetHandle: isTarget ? fromHandleId : handleId
    };
    result.connection = connection;
    const isConnectable = connectable && connectableEnd;
    const isValid = isConnectable && (connectionMode === ConnectionMode.Strict ? isTarget && handleType === "source" || !isTarget && handleType === "target" : handleNodeId !== fromNodeId || handleId !== fromHandleId);
    result.isValid = isValid && isValidConnection(connection);
    result.toHandle = getHandle(handleNodeId, handleType, handleId, nodeLookup, connectionMode, true);
  }
  return result;
}
var XYHandle = {
  onPointerDown,
  isValid: isValidHandle
};
var transformToViewport = (transform2) => ({
  x: transform2.x,
  y: transform2.y,
  zoom: transform2.k
});
var viewportToTransform = ({ x, y, zoom }) => identity.translate(x, y).scale(zoom);
var isWrappedWithClass = (event, className) => event.target.closest(`.${className}`);
var isRightClickPan = (panOnDrag, usedButton) => usedButton === 2 && Array.isArray(panOnDrag) && panOnDrag.includes(2);
var defaultEase = (t) => ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
var getD3Transition = (selection, duration = 0, ease = defaultEase, onEnd = () => {
}) => {
  const hasDuration = typeof duration === "number" && duration > 0;
  if (!hasDuration) {
    onEnd();
  }
  return hasDuration ? selection.transition().duration(duration).ease(ease).on("end", onEnd) : selection;
};
var wheelDelta = (event) => {
  const factor = event.ctrlKey && isMacOs() ? 10 : 1;
  return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 2e-3) * factor;
};
function createPanOnScrollHandler({ zoomPanValues, noWheelClassName, d3Selection, d3Zoom, panOnScrollMode, panOnScrollSpeed, zoomOnPinch, onPanZoomStart, onPanZoom, onPanZoomEnd }) {
  return (event) => {
    if (isWrappedWithClass(event, noWheelClassName)) {
      if (event.ctrlKey) {
        event.preventDefault();
      }
      return false;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const currentZoom = d3Selection.property("__zoom").k || 1;
    if (event.ctrlKey && zoomOnPinch) {
      const point = pointer_default(event);
      const pinchDelta = wheelDelta(event);
      const zoom = currentZoom * Math.pow(2, pinchDelta);
      d3Zoom.scaleTo(d3Selection, zoom, point, event);
      return;
    }
    const deltaNormalize = event.deltaMode === 1 ? 20 : 1;
    let deltaX = panOnScrollMode === PanOnScrollMode.Vertical ? 0 : event.deltaX * deltaNormalize;
    let deltaY = panOnScrollMode === PanOnScrollMode.Horizontal ? 0 : event.deltaY * deltaNormalize;
    if (!isMacOs() && event.shiftKey && panOnScrollMode !== PanOnScrollMode.Vertical) {
      deltaX = event.deltaY * deltaNormalize;
      deltaY = 0;
    }
    d3Zoom.translateBy(
      d3Selection,
      -(deltaX / currentZoom) * panOnScrollSpeed,
      -(deltaY / currentZoom) * panOnScrollSpeed,
      // @ts-ignore
      { internal: true }
    );
    const nextViewport = transformToViewport(d3Selection.property("__zoom"));
    clearTimeout(zoomPanValues.panScrollTimeout);
    if (!zoomPanValues.isPanScrolling) {
      zoomPanValues.isPanScrolling = true;
      onPanZoomStart?.(event, nextViewport);
    } else {
      onPanZoom?.(event, nextViewport);
      zoomPanValues.panScrollTimeout = setTimeout(() => {
        onPanZoomEnd?.(event, nextViewport);
        zoomPanValues.isPanScrolling = false;
      }, 150);
    }
  };
}
function createZoomOnScrollHandler({ noWheelClassName, preventScrolling, d3ZoomHandler }) {
  return function(event, d) {
    const isWheel = event.type === "wheel";
    const preventZoom = !preventScrolling && isWheel && !event.ctrlKey;
    const hasNoWheelClass = isWrappedWithClass(event, noWheelClassName);
    if (event.ctrlKey && isWheel && hasNoWheelClass) {
      event.preventDefault();
    }
    if (preventZoom || hasNoWheelClass) {
      return null;
    }
    event.preventDefault();
    d3ZoomHandler.call(this, event, d);
  };
}
function createPanZoomStartHandler({ zoomPanValues, onDraggingChange, onPanZoomStart }) {
  return (event) => {
    if (event.sourceEvent?.internal) {
      return;
    }
    const viewport = transformToViewport(event.transform);
    zoomPanValues.mouseButton = event.sourceEvent?.button || 0;
    zoomPanValues.isZoomingOrPanning = true;
    zoomPanValues.prevViewport = viewport;
    if (event.sourceEvent?.type === "mousedown") {
      onDraggingChange(true);
    }
    if (onPanZoomStart) {
      onPanZoomStart?.(event.sourceEvent, viewport);
    }
  };
}
function createPanZoomHandler({ zoomPanValues, panOnDrag, onPaneContextMenu, onTransformChange, onPanZoom }) {
  return (event) => {
    zoomPanValues.usedRightMouseButton = !!(onPaneContextMenu && isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0));
    if (!event.sourceEvent?.sync) {
      onTransformChange([event.transform.x, event.transform.y, event.transform.k]);
    }
    if (onPanZoom && !event.sourceEvent?.internal) {
      onPanZoom?.(event.sourceEvent, transformToViewport(event.transform));
    }
  };
}
function createPanZoomEndHandler({ zoomPanValues, panOnDrag, panOnScroll, onDraggingChange, onPanZoomEnd, onPaneContextMenu }) {
  return (event) => {
    if (event.sourceEvent?.internal) {
      return;
    }
    zoomPanValues.isZoomingOrPanning = false;
    if (onPaneContextMenu && isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0) && !zoomPanValues.usedRightMouseButton && event.sourceEvent) {
      onPaneContextMenu(event.sourceEvent);
    }
    zoomPanValues.usedRightMouseButton = false;
    onDraggingChange(false);
    if (onPanZoomEnd) {
      const viewport = transformToViewport(event.transform);
      zoomPanValues.prevViewport = viewport;
      clearTimeout(zoomPanValues.timerId);
      zoomPanValues.timerId = setTimeout(
        () => {
          onPanZoomEnd?.(event.sourceEvent, viewport);
        },
        // we need a setTimeout for panOnScroll to suppress multiple end events fired during scroll
        panOnScroll ? 150 : 0
      );
    }
  };
}
function createFilter({ zoomActivationKeyPressed, zoomOnScroll, zoomOnPinch, panOnDrag, panOnScroll, zoomOnDoubleClick, userSelectionActive, noWheelClassName, noPanClassName, lib, connectionInProgress }) {
  return (event) => {
    const zoomScroll = zoomActivationKeyPressed || zoomOnScroll;
    const pinchZoom = zoomOnPinch && event.ctrlKey;
    const isWheelEvent = event.type === "wheel";
    if (event.button === 1 && event.type === "mousedown" && (isWrappedWithClass(event, `${lib}-flow__node`) || isWrappedWithClass(event, `${lib}-flow__edge`))) {
      return true;
    }
    if (!panOnDrag && !zoomScroll && !panOnScroll && !zoomOnDoubleClick && !zoomOnPinch) {
      return false;
    }
    if (userSelectionActive) {
      return false;
    }
    if (connectionInProgress && !isWheelEvent) {
      return false;
    }
    if (isWrappedWithClass(event, noWheelClassName) && isWheelEvent) {
      return false;
    }
    if (isWrappedWithClass(event, noPanClassName) && (!isWheelEvent || panOnScroll && isWheelEvent && !zoomActivationKeyPressed)) {
      return false;
    }
    if (!zoomOnPinch && event.ctrlKey && isWheelEvent) {
      return false;
    }
    if (!zoomOnPinch && event.type === "touchstart" && event.touches?.length > 1) {
      event.preventDefault();
      return false;
    }
    if (!zoomScroll && !panOnScroll && !pinchZoom && isWheelEvent) {
      return false;
    }
    if (!panOnDrag && (event.type === "mousedown" || event.type === "touchstart")) {
      return false;
    }
    if (Array.isArray(panOnDrag) && !panOnDrag.includes(event.button) && event.type === "mousedown") {
      return false;
    }
    const buttonAllowed = Array.isArray(panOnDrag) && panOnDrag.includes(event.button) || !event.button || event.button <= 1;
    return (!event.ctrlKey || isWheelEvent) && buttonAllowed;
  };
}
function XYPanZoom({ domNode, minZoom, maxZoom, translateExtent, viewport, onPanZoom, onPanZoomStart, onPanZoomEnd, onDraggingChange }) {
  const zoomPanValues = {
    isZoomingOrPanning: false,
    usedRightMouseButton: false,
    prevViewport: { x: 0, y: 0, zoom: 0 },
    mouseButton: 0,
    timerId: void 0,
    panScrollTimeout: void 0,
    isPanScrolling: false
  };
  const bbox = domNode.getBoundingClientRect();
  const d3ZoomInstance = zoom_default2().scaleExtent([minZoom, maxZoom]).translateExtent(translateExtent);
  const d3Selection = select_default(domNode).call(d3ZoomInstance);
  setViewportConstrained({
    x: viewport.x,
    y: viewport.y,
    zoom: clamp(viewport.zoom, minZoom, maxZoom)
  }, [
    [0, 0],
    [bbox.width, bbox.height]
  ], translateExtent);
  const d3ZoomHandler = d3Selection.on("wheel.zoom");
  const d3DblClickZoomHandler = d3Selection.on("dblclick.zoom");
  d3ZoomInstance.wheelDelta(wheelDelta);
  function setTransform(transform2, options) {
    if (d3Selection) {
      return new Promise((resolve) => {
        d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default).transform(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), transform2);
      });
    }
    return Promise.resolve(false);
  }
  function update({ noWheelClassName, noPanClassName, onPaneContextMenu, userSelectionActive, panOnScroll, panOnDrag, panOnScrollMode, panOnScrollSpeed, preventScrolling, zoomOnPinch, zoomOnScroll, zoomOnDoubleClick, zoomActivationKeyPressed, lib, onTransformChange, connectionInProgress, paneClickDistance, selectionOnDrag }) {
    if (userSelectionActive && !zoomPanValues.isZoomingOrPanning) {
      destroy();
    }
    const isPanOnScroll = panOnScroll && !zoomActivationKeyPressed && !userSelectionActive;
    d3ZoomInstance.clickDistance(selectionOnDrag ? Infinity : !isNumeric(paneClickDistance) || paneClickDistance < 0 ? 0 : paneClickDistance);
    const wheelHandler = isPanOnScroll ? createPanOnScrollHandler({
      zoomPanValues,
      noWheelClassName,
      d3Selection,
      d3Zoom: d3ZoomInstance,
      panOnScrollMode,
      panOnScrollSpeed,
      zoomOnPinch,
      onPanZoomStart,
      onPanZoom,
      onPanZoomEnd
    }) : createZoomOnScrollHandler({
      noWheelClassName,
      preventScrolling,
      d3ZoomHandler
    });
    d3Selection.on("wheel.zoom", wheelHandler, { passive: false });
    if (!userSelectionActive) {
      const startHandler = createPanZoomStartHandler({
        zoomPanValues,
        onDraggingChange,
        onPanZoomStart
      });
      d3ZoomInstance.on("start", startHandler);
      const panZoomHandler = createPanZoomHandler({
        zoomPanValues,
        panOnDrag,
        onPaneContextMenu: !!onPaneContextMenu,
        onPanZoom,
        onTransformChange
      });
      d3ZoomInstance.on("zoom", panZoomHandler);
      const panZoomEndHandler = createPanZoomEndHandler({
        zoomPanValues,
        panOnDrag,
        panOnScroll,
        onPaneContextMenu,
        onPanZoomEnd,
        onDraggingChange
      });
      d3ZoomInstance.on("end", panZoomEndHandler);
    }
    const filter = createFilter({
      zoomActivationKeyPressed,
      panOnDrag,
      zoomOnScroll,
      panOnScroll,
      zoomOnDoubleClick,
      zoomOnPinch,
      userSelectionActive,
      noPanClassName,
      noWheelClassName,
      lib,
      connectionInProgress
    });
    d3ZoomInstance.filter(filter);
    if (zoomOnDoubleClick) {
      d3Selection.on("dblclick.zoom", d3DblClickZoomHandler);
    } else {
      d3Selection.on("dblclick.zoom", null);
    }
  }
  function destroy() {
    d3ZoomInstance.on("zoom", null);
  }
  async function setViewportConstrained(viewport2, extent, translateExtent2) {
    const nextTransform = viewportToTransform(viewport2);
    const contrainedTransform = d3ZoomInstance?.constrain()(nextTransform, extent, translateExtent2);
    if (contrainedTransform) {
      await setTransform(contrainedTransform);
    }
    return new Promise((resolve) => resolve(contrainedTransform));
  }
  async function setViewport(viewport2, options) {
    const nextTransform = viewportToTransform(viewport2);
    await setTransform(nextTransform, options);
    return new Promise((resolve) => resolve(nextTransform));
  }
  function syncViewport(viewport2) {
    if (d3Selection) {
      const nextTransform = viewportToTransform(viewport2);
      const currentTransform = d3Selection.property("__zoom");
      if (currentTransform.k !== viewport2.zoom || currentTransform.x !== viewport2.x || currentTransform.y !== viewport2.y) {
        d3ZoomInstance?.transform(d3Selection, nextTransform, null, { sync: true });
      }
    }
  }
  function getViewport() {
    const transform2 = d3Selection ? transform(d3Selection.node()) : { x: 0, y: 0, k: 1 };
    return { x: transform2.x, y: transform2.y, zoom: transform2.k };
  }
  function scaleTo(zoom, options) {
    if (d3Selection) {
      return new Promise((resolve) => {
        d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default).scaleTo(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), zoom);
      });
    }
    return Promise.resolve(false);
  }
  function scaleBy(factor, options) {
    if (d3Selection) {
      return new Promise((resolve) => {
        d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default).scaleBy(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), factor);
      });
    }
    return Promise.resolve(false);
  }
  function setScaleExtent(scaleExtent) {
    d3ZoomInstance?.scaleExtent(scaleExtent);
  }
  function setTranslateExtent(translateExtent2) {
    d3ZoomInstance?.translateExtent(translateExtent2);
  }
  function setClickDistance(distance2) {
    const validDistance = !isNumeric(distance2) || distance2 < 0 ? 0 : distance2;
    d3ZoomInstance?.clickDistance(validDistance);
  }
  return {
    update,
    destroy,
    setViewport,
    setViewportConstrained,
    getViewport,
    scaleTo,
    scaleBy,
    setScaleExtent,
    setTranslateExtent,
    syncViewport,
    setClickDistance
  };
}
var ResizeControlVariant;
(function(ResizeControlVariant2) {
  ResizeControlVariant2["Line"] = "line";
  ResizeControlVariant2["Handle"] = "handle";
})(ResizeControlVariant || (ResizeControlVariant = {}));
function getResizeDirection({ width, prevWidth, height, prevHeight, affectsX, affectsY }) {
  const deltaWidth = width - prevWidth;
  const deltaHeight = height - prevHeight;
  const direction = [deltaWidth > 0 ? 1 : deltaWidth < 0 ? -1 : 0, deltaHeight > 0 ? 1 : deltaHeight < 0 ? -1 : 0];
  if (deltaWidth && affectsX) {
    direction[0] = direction[0] * -1;
  }
  if (deltaHeight && affectsY) {
    direction[1] = direction[1] * -1;
  }
  return direction;
}
function getControlDirection(controlPosition) {
  const isHorizontal = controlPosition.includes("right") || controlPosition.includes("left");
  const isVertical = controlPosition.includes("bottom") || controlPosition.includes("top");
  const affectsX = controlPosition.includes("left");
  const affectsY = controlPosition.includes("top");
  return {
    isHorizontal,
    isVertical,
    affectsX,
    affectsY
  };
}
function getLowerExtentClamp(lowerExtent, lowerBound) {
  return Math.max(0, lowerBound - lowerExtent);
}
function getUpperExtentClamp(upperExtent, upperBound) {
  return Math.max(0, upperExtent - upperBound);
}
function getSizeClamp(size, minSize, maxSize) {
  return Math.max(0, minSize - size, size - maxSize);
}
function xor(a, b) {
  return a ? !b : b;
}
function getDimensionsAfterResize(startValues, controlDirection, pointerPosition, boundaries, keepAspectRatio, nodeOrigin, extent, childExtent) {
  let { affectsX, affectsY } = controlDirection;
  const { isHorizontal, isVertical } = controlDirection;
  const isDiagonal = isHorizontal && isVertical;
  const { xSnapped, ySnapped } = pointerPosition;
  const { minWidth, maxWidth, minHeight, maxHeight } = boundaries;
  const { x: startX, y: startY, width: startWidth, height: startHeight, aspectRatio } = startValues;
  let distX = Math.floor(isHorizontal ? xSnapped - startValues.pointerX : 0);
  let distY = Math.floor(isVertical ? ySnapped - startValues.pointerY : 0);
  const newWidth = startWidth + (affectsX ? -distX : distX);
  const newHeight = startHeight + (affectsY ? -distY : distY);
  const originOffsetX = -nodeOrigin[0] * startWidth;
  const originOffsetY = -nodeOrigin[1] * startHeight;
  let clampX = getSizeClamp(newWidth, minWidth, maxWidth);
  let clampY = getSizeClamp(newHeight, minHeight, maxHeight);
  if (extent) {
    let xExtentClamp = 0;
    let yExtentClamp = 0;
    if (affectsX && distX < 0) {
      xExtentClamp = getLowerExtentClamp(startX + distX + originOffsetX, extent[0][0]);
    } else if (!affectsX && distX > 0) {
      xExtentClamp = getUpperExtentClamp(startX + newWidth + originOffsetX, extent[1][0]);
    }
    if (affectsY && distY < 0) {
      yExtentClamp = getLowerExtentClamp(startY + distY + originOffsetY, extent[0][1]);
    } else if (!affectsY && distY > 0) {
      yExtentClamp = getUpperExtentClamp(startY + newHeight + originOffsetY, extent[1][1]);
    }
    clampX = Math.max(clampX, xExtentClamp);
    clampY = Math.max(clampY, yExtentClamp);
  }
  if (childExtent) {
    let xExtentClamp = 0;
    let yExtentClamp = 0;
    if (affectsX && distX > 0) {
      xExtentClamp = getUpperExtentClamp(startX + distX, childExtent[0][0]);
    } else if (!affectsX && distX < 0) {
      xExtentClamp = getLowerExtentClamp(startX + newWidth, childExtent[1][0]);
    }
    if (affectsY && distY > 0) {
      yExtentClamp = getUpperExtentClamp(startY + distY, childExtent[0][1]);
    } else if (!affectsY && distY < 0) {
      yExtentClamp = getLowerExtentClamp(startY + newHeight, childExtent[1][1]);
    }
    clampX = Math.max(clampX, xExtentClamp);
    clampY = Math.max(clampY, yExtentClamp);
  }
  if (keepAspectRatio) {
    if (isHorizontal) {
      const aspectHeightClamp = getSizeClamp(newWidth / aspectRatio, minHeight, maxHeight) * aspectRatio;
      clampX = Math.max(clampX, aspectHeightClamp);
      if (extent) {
        let aspectExtentClamp = 0;
        if (!affectsX && !affectsY || affectsX && !affectsY && isDiagonal) {
          aspectExtentClamp = getUpperExtentClamp(startY + originOffsetY + newWidth / aspectRatio, extent[1][1]) * aspectRatio;
        } else {
          aspectExtentClamp = getLowerExtentClamp(startY + originOffsetY + (affectsX ? distX : -distX) / aspectRatio, extent[0][1]) * aspectRatio;
        }
        clampX = Math.max(clampX, aspectExtentClamp);
      }
      if (childExtent) {
        let aspectExtentClamp = 0;
        if (!affectsX && !affectsY || affectsX && !affectsY && isDiagonal) {
          aspectExtentClamp = getLowerExtentClamp(startY + newWidth / aspectRatio, childExtent[1][1]) * aspectRatio;
        } else {
          aspectExtentClamp = getUpperExtentClamp(startY + (affectsX ? distX : -distX) / aspectRatio, childExtent[0][1]) * aspectRatio;
        }
        clampX = Math.max(clampX, aspectExtentClamp);
      }
    }
    if (isVertical) {
      const aspectWidthClamp = getSizeClamp(newHeight * aspectRatio, minWidth, maxWidth) / aspectRatio;
      clampY = Math.max(clampY, aspectWidthClamp);
      if (extent) {
        let aspectExtentClamp = 0;
        if (!affectsX && !affectsY || affectsY && !affectsX && isDiagonal) {
          aspectExtentClamp = getUpperExtentClamp(startX + newHeight * aspectRatio + originOffsetX, extent[1][0]) / aspectRatio;
        } else {
          aspectExtentClamp = getLowerExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio + originOffsetX, extent[0][0]) / aspectRatio;
        }
        clampY = Math.max(clampY, aspectExtentClamp);
      }
      if (childExtent) {
        let aspectExtentClamp = 0;
        if (!affectsX && !affectsY || affectsY && !affectsX && isDiagonal) {
          aspectExtentClamp = getLowerExtentClamp(startX + newHeight * aspectRatio, childExtent[1][0]) / aspectRatio;
        } else {
          aspectExtentClamp = getUpperExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio, childExtent[0][0]) / aspectRatio;
        }
        clampY = Math.max(clampY, aspectExtentClamp);
      }
    }
  }
  distY = distY + (distY < 0 ? clampY : -clampY);
  distX = distX + (distX < 0 ? clampX : -clampX);
  if (keepAspectRatio) {
    if (isDiagonal) {
      if (newWidth > newHeight * aspectRatio) {
        distY = (xor(affectsX, affectsY) ? -distX : distX) / aspectRatio;
      } else {
        distX = (xor(affectsX, affectsY) ? -distY : distY) * aspectRatio;
      }
    } else {
      if (isHorizontal) {
        distY = distX / aspectRatio;
        affectsY = affectsX;
      } else {
        distX = distY * aspectRatio;
        affectsX = affectsY;
      }
    }
  }
  const x = affectsX ? startX + distX : startX;
  const y = affectsY ? startY + distY : startY;
  return {
    width: startWidth + (affectsX ? -distX : distX),
    height: startHeight + (affectsY ? -distY : distY),
    x: nodeOrigin[0] * distX * (!affectsX ? 1 : -1) + x,
    y: nodeOrigin[1] * distY * (!affectsY ? 1 : -1) + y
  };
}
var initPrevValues = { width: 0, height: 0, x: 0, y: 0 };
var initStartValues = __spreadProps(__spreadValues({}, initPrevValues), {
  pointerX: 0,
  pointerY: 0,
  aspectRatio: 1
});
function nodeToParentExtent(node) {
  return [
    [0, 0],
    [node.measured.width, node.measured.height]
  ];
}
function nodeToChildExtent(child, parent, nodeOrigin) {
  const x = parent.position.x + child.position.x;
  const y = parent.position.y + child.position.y;
  const width = child.measured.width ?? 0;
  const height = child.measured.height ?? 0;
  const originOffsetX = nodeOrigin[0] * width;
  const originOffsetY = nodeOrigin[1] * height;
  return [
    [x - originOffsetX, y - originOffsetY],
    [x + width - originOffsetX, y + height - originOffsetY]
  ];
}
function XYResizer({ domNode, nodeId, getStoreItems, onChange, onEnd }) {
  const selection = select_default(domNode);
  let params = {
    controlDirection: getControlDirection("bottom-right"),
    boundaries: {
      minWidth: 0,
      minHeight: 0,
      maxWidth: Number.MAX_VALUE,
      maxHeight: Number.MAX_VALUE
    },
    resizeDirection: void 0,
    keepAspectRatio: false
  };
  function update({ controlPosition, boundaries, keepAspectRatio, resizeDirection, onResizeStart, onResize, onResizeEnd, shouldResize }) {
    let prevValues = __spreadValues({}, initPrevValues);
    let startValues = __spreadValues({}, initStartValues);
    params = {
      boundaries,
      resizeDirection,
      keepAspectRatio,
      controlDirection: getControlDirection(controlPosition)
    };
    let node = void 0;
    let containerBounds = null;
    let childNodes = [];
    let parentNode = void 0;
    let parentExtent = void 0;
    let childExtent = void 0;
    let resizeDetected = false;
    const dragHandler = drag_default().on("start", (event) => {
      const { nodeLookup, transform: transform2, snapGrid, snapToGrid, nodeOrigin, paneDomNode } = getStoreItems();
      node = nodeLookup.get(nodeId);
      if (!node) {
        return;
      }
      containerBounds = paneDomNode?.getBoundingClientRect() ?? null;
      const { xSnapped, ySnapped } = getPointerPosition(event.sourceEvent, {
        transform: transform2,
        snapGrid,
        snapToGrid,
        containerBounds
      });
      prevValues = {
        width: node.measured.width ?? 0,
        height: node.measured.height ?? 0,
        x: node.position.x ?? 0,
        y: node.position.y ?? 0
      };
      startValues = __spreadProps(__spreadValues({}, prevValues), {
        pointerX: xSnapped,
        pointerY: ySnapped,
        aspectRatio: prevValues.width / prevValues.height
      });
      parentNode = void 0;
      if (node.parentId && (node.extent === "parent" || node.expandParent)) {
        parentNode = nodeLookup.get(node.parentId);
        parentExtent = parentNode && node.extent === "parent" ? nodeToParentExtent(parentNode) : void 0;
      }
      childNodes = [];
      childExtent = void 0;
      for (const [childId, child] of nodeLookup) {
        if (child.parentId === nodeId) {
          childNodes.push({
            id: childId,
            position: __spreadValues({}, child.position),
            extent: child.extent
          });
          if (child.extent === "parent" || child.expandParent) {
            const extent = nodeToChildExtent(child, node, child.origin ?? nodeOrigin);
            if (childExtent) {
              childExtent = [
                [Math.min(extent[0][0], childExtent[0][0]), Math.min(extent[0][1], childExtent[0][1])],
                [Math.max(extent[1][0], childExtent[1][0]), Math.max(extent[1][1], childExtent[1][1])]
              ];
            } else {
              childExtent = extent;
            }
          }
        }
      }
      onResizeStart?.(event, __spreadValues({}, prevValues));
    }).on("drag", (event) => {
      const { transform: transform2, snapGrid, snapToGrid, nodeOrigin: storeNodeOrigin } = getStoreItems();
      const pointerPosition = getPointerPosition(event.sourceEvent, {
        transform: transform2,
        snapGrid,
        snapToGrid,
        containerBounds
      });
      const childChanges = [];
      if (!node) {
        return;
      }
      const { x: prevX, y: prevY, width: prevWidth, height: prevHeight } = prevValues;
      const change = {};
      const nodeOrigin = node.origin ?? storeNodeOrigin;
      const { width, height, x, y } = getDimensionsAfterResize(startValues, params.controlDirection, pointerPosition, params.boundaries, params.keepAspectRatio, nodeOrigin, parentExtent, childExtent);
      const isWidthChange = width !== prevWidth;
      const isHeightChange = height !== prevHeight;
      const isXPosChange = x !== prevX && isWidthChange;
      const isYPosChange = y !== prevY && isHeightChange;
      if (!isXPosChange && !isYPosChange && !isWidthChange && !isHeightChange) {
        return;
      }
      if (isXPosChange || isYPosChange || nodeOrigin[0] === 1 || nodeOrigin[1] === 1) {
        change.x = isXPosChange ? x : prevValues.x;
        change.y = isYPosChange ? y : prevValues.y;
        prevValues.x = change.x;
        prevValues.y = change.y;
        if (childNodes.length > 0) {
          const xChange = x - prevX;
          const yChange = y - prevY;
          for (const childNode of childNodes) {
            childNode.position = {
              x: childNode.position.x - xChange + nodeOrigin[0] * (width - prevWidth),
              y: childNode.position.y - yChange + nodeOrigin[1] * (height - prevHeight)
            };
            childChanges.push(childNode);
          }
        }
      }
      if (isWidthChange || isHeightChange) {
        change.width = isWidthChange && (!params.resizeDirection || params.resizeDirection === "horizontal") ? width : prevValues.width;
        change.height = isHeightChange && (!params.resizeDirection || params.resizeDirection === "vertical") ? height : prevValues.height;
        prevValues.width = change.width;
        prevValues.height = change.height;
      }
      if (parentNode && node.expandParent) {
        const xLimit = nodeOrigin[0] * (change.width ?? 0);
        if (change.x && change.x < xLimit) {
          prevValues.x = xLimit;
          startValues.x = startValues.x - (change.x - xLimit);
        }
        const yLimit = nodeOrigin[1] * (change.height ?? 0);
        if (change.y && change.y < yLimit) {
          prevValues.y = yLimit;
          startValues.y = startValues.y - (change.y - yLimit);
        }
      }
      const direction = getResizeDirection({
        width: prevValues.width,
        prevWidth,
        height: prevValues.height,
        prevHeight,
        affectsX: params.controlDirection.affectsX,
        affectsY: params.controlDirection.affectsY
      });
      const nextValues = __spreadProps(__spreadValues({}, prevValues), { direction });
      const callResize = shouldResize?.(event, nextValues);
      if (callResize === false) {
        return;
      }
      resizeDetected = true;
      onResize?.(event, nextValues);
      onChange(change, childChanges);
    }).on("end", (event) => {
      if (!resizeDetected) {
        return;
      }
      onResizeEnd?.(event, __spreadValues({}, prevValues));
      onEnd?.(__spreadValues({}, prevValues));
      resizeDetected = false;
    });
    selection.call(dragHandler);
  }
  function destroy() {
    selection.on(".drag", null);
  }
  return {
    update,
    destroy
  };
}

// ../../packages/angular/dist/esm/lib/utils/changes.js
function applyChanges(changes, elements) {
  const updatedElements = [];
  const changesMap = /* @__PURE__ */ new Map();
  const addItemChanges = [];
  for (const change of changes) {
    if (change.type === "add") {
      addItemChanges.push(change);
      continue;
    } else if (change.type === "remove" || change.type === "replace") {
      changesMap.set(change.id, [change]);
    } else {
      const elementChanges = changesMap.get(change.id);
      if (elementChanges) {
        elementChanges.push(change);
      } else {
        changesMap.set(change.id, [change]);
      }
    }
  }
  for (const element of elements) {
    const changes2 = changesMap.get(element.id);
    if (!changes2) {
      updatedElements.push(element);
      continue;
    }
    if (changes2[0].type === "remove") {
      continue;
    }
    if (changes2[0].type === "replace") {
      updatedElements.push(__spreadValues({}, changes2[0].item));
      continue;
    }
    const updatedElement = __spreadValues({}, element);
    for (const change of changes2) {
      applyChange(change, updatedElement);
    }
    updatedElements.push(updatedElement);
  }
  if (addItemChanges.length) {
    addItemChanges.forEach((change) => {
      if (change.index !== void 0) {
        updatedElements.splice(change.index, 0, __spreadValues({}, change.item));
      } else {
        updatedElements.push(__spreadValues({}, change.item));
      }
    });
  }
  return updatedElements;
}
function applyChange(change, element) {
  switch (change.type) {
    case "select": {
      element.selected = change.selected;
      break;
    }
    case "position": {
      if (typeof change.position !== "undefined") {
        element.position = change.position;
      }
      if (typeof change.dragging !== "undefined") {
        element.dragging = change.dragging;
      }
      break;
    }
    case "dimensions": {
      if (typeof change.dimensions !== "undefined") {
        element.measured = __spreadValues({}, change.dimensions);
        if (change.setAttributes) {
          if (change.setAttributes === true || change.setAttributes === "width") {
            element.width = change.dimensions.width;
          }
          if (change.setAttributes === true || change.setAttributes === "height") {
            element.height = change.dimensions.height;
          }
        }
      }
      if (typeof change.resizing === "boolean") {
        element.resizing = change.resizing;
      }
      break;
    }
  }
}
function applyNodeChanges(changes, nodes) {
  return applyChanges(changes, nodes);
}
function applyEdgeChanges(changes, edges) {
  return applyChanges(changes, edges);
}
function createSelectionChange(id, selected) {
  return { id, type: "select", selected };
}
function getSelectionChanges(items, selectedIds = /* @__PURE__ */ new Set(), mutateItem = false) {
  const changes = [];
  for (const [id, item] of items) {
    const willBeSelected = selectedIds.has(id);
    if (!(item.selected === void 0 && !willBeSelected) && item.selected !== willBeSelected) {
      if (mutateItem) {
        item.selected = willBeSelected;
      }
      changes.push(createSelectionChange(item.id, willBeSelected));
    }
  }
  return changes;
}
function elementToRemoveChange(item) {
  return { id: item.id, type: "remove" };
}

// ../../packages/angular/dist/esm/lib/services/flow-store.service.js
var FlowStore = class _FlowStore {
  constructor() {
    this.rfId = signal("1", ...ngDevMode ? [{
      debugName: "rfId"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.width = signal(0, ...ngDevMode ? [{
      debugName: "width"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.height = signal(0, ...ngDevMode ? [{
      debugName: "height"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.transform = signal([0, 0, 1], ...ngDevMode ? [{
      debugName: "transform"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodes = signal([], ...ngDevMode ? [{
      debugName: "nodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edges = signal([], ...ngDevMode ? [{
      debugName: "edges"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesInitialized = signal(false, ...ngDevMode ? [{
      debugName: "nodesInitialized"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.hasDefaultNodes = signal(false, ...ngDevMode ? [{
      debugName: "hasDefaultNodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.hasDefaultEdges = signal(false, ...ngDevMode ? [{
      debugName: "hasDefaultEdges"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.paneDragging = signal(false, ...ngDevMode ? [{
      debugName: "paneDragging"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesSelectionActive = signal(false, ...ngDevMode ? [{
      debugName: "nodesSelectionActive"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.userSelectionActive = signal(false, ...ngDevMode ? [{
      debugName: "userSelectionActive"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.userSelectionRect = signal(null, ...ngDevMode ? [{
      debugName: "userSelectionRect"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.multiSelectionActive = signal(false, ...ngDevMode ? [{
      debugName: "multiSelectionActive"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectionKeyActive = signal(false, ...ngDevMode ? [{
      debugName: "selectionKeyActive"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.panZoom = signal(null, ...ngDevMode ? [{
      debugName: "panZoom"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.minZoom = signal(0.5, ...ngDevMode ? [{
      debugName: "minZoom"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.maxZoom = signal(2, ...ngDevMode ? [{
      debugName: "maxZoom"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.translateExtent = signal(infiniteExtent, ...ngDevMode ? [{
      debugName: "translateExtent"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeExtent = signal(infiniteExtent, ...ngDevMode ? [{
      debugName: "nodeExtent"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.domNode = signal(null, ...ngDevMode ? [{
      debugName: "domNode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.noDragClassName = signal("nodrag", ...ngDevMode ? [{
      debugName: "noDragClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.noWheelClassName = signal("nowheel", ...ngDevMode ? [{
      debugName: "noWheelClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.noPanClassName = signal("nopan", ...ngDevMode ? [{
      debugName: "noPanClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeOrigin = signal([0, 0], ...ngDevMode ? [{
      debugName: "nodeOrigin"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeDragThreshold = signal(1, ...ngDevMode ? [{
      debugName: "nodeDragThreshold"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionDragThreshold = signal(1, ...ngDevMode ? [{
      debugName: "connectionDragThreshold"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.paneClickDistance = signal(0, ...ngDevMode ? [{
      debugName: "paneClickDistance"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeClickDistance = signal(0, ...ngDevMode ? [{
      debugName: "nodeClickDistance"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.snapGrid = signal([15, 15], ...ngDevMode ? [{
      debugName: "snapGrid"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.snapToGrid = signal(false, ...ngDevMode ? [{
      debugName: "snapToGrid"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesDraggable = signal(true, ...ngDevMode ? [{
      debugName: "nodesDraggable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesConnectable = signal(true, ...ngDevMode ? [{
      debugName: "nodesConnectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesFocusable = signal(true, ...ngDevMode ? [{
      debugName: "nodesFocusable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgesFocusable = signal(true, ...ngDevMode ? [{
      debugName: "edgesFocusable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgesReconnectable = signal(true, ...ngDevMode ? [{
      debugName: "edgesReconnectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.elementsSelectable = signal(true, ...ngDevMode ? [{
      debugName: "elementsSelectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.elevateNodesOnSelect = signal(true, ...ngDevMode ? [{
      debugName: "elevateNodesOnSelect"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.elevateEdgesOnSelect = signal(true, ...ngDevMode ? [{
      debugName: "elevateEdgesOnSelect"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectNodesOnDrag = signal(true, ...ngDevMode ? [{
      debugName: "selectNodesOnDrag"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionMode = signal(ConnectionMode.Strict, ...ngDevMode ? [{
      debugName: "connectionMode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connection = signal(__spreadValues({}, initialConnection), ...ngDevMode ? [{
      debugName: "connection"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionClickStartHandle = signal(null, ...ngDevMode ? [{
      debugName: "connectionClickStartHandle"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectOnClick = signal(true, ...ngDevMode ? [{
      debugName: "connectOnClick"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionRadius = signal(20, ...ngDevMode ? [{
      debugName: "connectionRadius"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.fitViewQueued = signal(false, ...ngDevMode ? [{
      debugName: "fitViewQueued"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.fitViewOptions = signal(void 0, ...ngDevMode ? [{
      debugName: "fitViewOptions"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.autoPanOnConnect = signal(true, ...ngDevMode ? [{
      debugName: "autoPanOnConnect"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.autoPanOnNodeDrag = signal(true, ...ngDevMode ? [{
      debugName: "autoPanOnNodeDrag"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.autoPanOnNodeFocus = signal(true, ...ngDevMode ? [{
      debugName: "autoPanOnNodeFocus"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.autoPanSpeed = signal(15, ...ngDevMode ? [{
      debugName: "autoPanSpeed"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isValidConnection = signal(void 0, ...ngDevMode ? [{
      debugName: "isValidConnection"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.onError = signal(devWarn, ...ngDevMode ? [{
      debugName: "onError"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.lib = signal("ng", ...ngDevMode ? [{
      debugName: "lib"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.debug = signal(false, ...ngDevMode ? [{
      debugName: "debug"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zIndexMode = signal("basic", ...ngDevMode ? [{
      debugName: "zIndexMode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.ariaLabelConfig = signal(defaultAriaLabelConfig, ...ngDevMode ? [{
      debugName: "ariaLabelConfig"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.onlyRenderVisibleElements = signal(false, ...ngDevMode ? [{
      debugName: "onlyRenderVisibleElements"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.ariaLiveMessage = signal("", ...ngDevMode ? [{
      debugName: "ariaLiveMessage"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.defaultEdgeOptions = signal(void 0, ...ngDevMode ? [{
      debugName: "defaultEdgeOptions"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.onConnect = null;
    this.onConnectStart = null;
    this.onConnectEnd = null;
    this.onClickConnectStart = null;
    this.onClickConnectEnd = null;
    this.onBeforeDelete = null;
    this.onNodeDragStart = null;
    this.onNodeDrag = null;
    this.onNodeDragStop = null;
    this.onSelectionDragStart = null;
    this.onSelectionDrag = null;
    this.onSelectionDragStop = null;
    this.nodesChangeMiddleware = /* @__PURE__ */ new Map();
    this.edgesChangeMiddleware = /* @__PURE__ */ new Map();
    this.nodeLookup = /* @__PURE__ */ new Map();
    this.parentLookup = /* @__PURE__ */ new Map();
    this.edgeLookup = /* @__PURE__ */ new Map();
    this.connectionLookup = /* @__PURE__ */ new Map();
    this.onNodesChange = null;
    this.onEdgesChange = null;
    this.version = signal(0, ...ngDevMode ? [{
      debugName: "version"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.batchDepth = 0;
    this.batchDirty = false;
    this.viewport = computed(() => {
      const t = this.transform();
      return {
        x: t[0],
        y: t[1],
        zoom: t[2]
      };
    }, ...ngDevMode ? [{
      debugName: "viewport"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectedNodes = computed(() => this.nodes().filter((n) => n.selected), ...ngDevMode ? [{
      debugName: "selectedNodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectedEdges = computed(() => this.edges().filter((e) => e.selected), ...ngDevMode ? [{
      debugName: "selectedEdges"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.visibleNodes = computed(() => {
      this.version();
      if (!this.onlyRenderVisibleElements()) {
        return Array.from(this.nodeLookup.values());
      }
      const t = this.transform();
      return getNodesInside(this.nodeLookup, {
        x: 0,
        y: 0,
        width: this.width(),
        height: this.height()
      }, t, true);
    }, ...ngDevMode ? [{
      debugName: "visibleNodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.visibleEdgeIds = computed(() => {
      this.version();
      const edges = this.edges();
      if (!this.onlyRenderVisibleElements()) {
        return new Set(edges.map((e) => e.id));
      }
      const visibleNodeIds = new Set(this.visibleNodes().map((n) => n.id));
      return new Set(edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)).map((e) => e.id));
    }, ...ngDevMode ? [{
      debugName: "visibleEdgeIds"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  bumpVersion() {
    if (this.batchDepth > 0) {
      this.batchDirty = true;
      return;
    }
    this.version.update((v) => v + 1);
  }
  /**
   * Coalesce multiple updates into a single version bump / reactivity cycle.
   * Usage: `store.batch(() => { store.setNodes(...); store.setEdges(...); })`
   */
  batch(fn) {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.batchDirty) {
        this.batchDirty = false;
        this.version.update((v) => v + 1);
      }
    }
  }
  // ── Actions ───────────────────────────────────────────────────────────
  setNodes(nodes) {
    const {
      nodesInitialized,
      hasSelectedNodes
    } = adoptUserNodes(nodes, this.nodeLookup, this.parentLookup, {
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: this.nodeExtent(),
      elevateNodesOnSelect: this.elevateNodesOnSelect(),
      checkEquality: true,
      zIndexMode: this.zIndexMode()
    });
    const nextNodesSelectionActive = this.nodesSelectionActive() && hasSelectedNodes;
    this.nodesInitialized.set(nodesInitialized);
    this.nodesSelectionActive.set(nextNodesSelectionActive);
    this.nodes.set(nodes);
    this.bumpVersion();
    if (this.fitViewQueued() && nodesInitialized) {
      this.resolveFitView();
      this.fitViewQueued.set(false);
      this.fitViewOptions.set(void 0);
    }
  }
  setEdges(edges) {
    updateConnectionLookup(this.connectionLookup, this.edgeLookup, edges);
    this.edges.set(edges);
    this.bumpVersion();
  }
  setDefaultNodesAndEdges(nodes, edges) {
    if (nodes) {
      this.setNodes(nodes);
      this.hasDefaultNodes.set(true);
    }
    if (edges) {
      this.setEdges(edges);
      this.hasDefaultEdges.set(true);
    }
  }
  updateNodeInternals(updates) {
    const {
      changes,
      updatedInternals
    } = updateNodeInternals(updates, this.nodeLookup, this.parentLookup, this.domNode(), this.nodeOrigin(), this.nodeExtent(), this.zIndexMode());
    if (!updatedInternals) {
      return;
    }
    updateAbsolutePositions(this.nodeLookup, this.parentLookup, {
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: this.nodeExtent(),
      zIndexMode: this.zIndexMode()
    });
    if (this.fitViewQueued()) {
      this.resolveFitView();
      this.fitViewQueued.set(false);
      this.fitViewOptions.set(void 0);
    }
    this.nodes.update((n) => [...n]);
    if (changes?.length > 0) {
      this.triggerNodeChanges(changes);
    }
  }
  updateNodePositions(nodeDragItems, dragging = false) {
    const parentExpandChildren = [];
    const changes = [];
    const conn = this.connection();
    for (const [id, dragItem] of nodeDragItems) {
      const node = this.nodeLookup.get(id);
      const expandParent = !!(node?.expandParent && node?.parentId && dragItem?.position);
      const change = {
        id,
        type: "position",
        position: expandParent ? {
          x: Math.max(0, dragItem.position.x),
          y: Math.max(0, dragItem.position.y)
        } : dragItem.position,
        dragging
      };
      if (node && conn.inProgress && conn.fromNode?.id === node.id) {
        const updatedFrom = getHandlePosition(node, conn.fromHandle, Position.Left, true);
        this.updateConnection(__spreadProps(__spreadValues({}, conn), {
          from: updatedFrom
        }));
      }
      if (expandParent && node.parentId) {
        parentExpandChildren.push({
          id,
          parentId: node.parentId,
          rect: __spreadProps(__spreadValues({}, dragItem.internals.positionAbsolute), {
            width: dragItem.measured.width ?? 0,
            height: dragItem.measured.height ?? 0
          })
        });
      }
      changes.push(change);
    }
    if (parentExpandChildren.length > 0) {
      const parentExpandChanges = handleExpandParent(parentExpandChildren, this.nodeLookup, this.parentLookup, this.nodeOrigin());
      changes.push(...parentExpandChanges);
    }
    this.triggerNodeChanges(changes);
  }
  triggerNodeChanges(changes) {
    if (!changes?.length) return;
    for (const middleware of this.nodesChangeMiddleware.values()) {
      changes = middleware(changes);
      if (!changes?.length) return;
    }
    const allPosition = changes.every((c) => c.type === "position");
    if (allPosition) {
      const currentNodes = this.nodes();
      let nodesChanged = false;
      for (const change of changes) {
        if (change.type !== "position") continue;
        const internalNode = this.nodeLookup.get(change.id);
        if (!internalNode) continue;
        if (change.position) {
          internalNode.position = change.position;
          if (internalNode.internals) {
            internalNode.internals.positionAbsolute = change.position;
          }
        }
        if (change.dragging !== void 0) {
          internalNode.dragging = change.dragging;
        }
        const userNode = internalNode.internals?.userNode;
        if (userNode && change.position) {
          userNode.position = change.position;
          userNode.dragging = change.dragging;
          nodesChanged = true;
        }
      }
      if (nodesChanged) {
        this.bumpVersion();
      }
    } else {
      const updatedNodes = applyNodeChanges(changes, this.nodes());
      this.setNodes(updatedNodes);
    }
    if (this.debug()) {
      console.log("Angular Flow: trigger node changes", changes);
    }
    this.onNodesChange?.(changes);
  }
  triggerEdgeChanges(changes) {
    if (!changes?.length) return;
    for (const middleware of this.edgesChangeMiddleware.values()) {
      changes = middleware(changes);
      if (!changes?.length) return;
    }
    const updatedEdges = applyEdgeChanges(changes, this.edges());
    this.setEdges(updatedEdges);
    if (this.debug()) {
      console.log("Angular Flow: trigger edge changes", changes);
    }
    this.onEdgesChange?.(changes);
  }
  addSelectedNodes(selectedNodeIds) {
    if (this.multiSelectionActive()) {
      const nodeChanges = selectedNodeIds.map((nodeId) => createSelectionChange(nodeId, true));
      this.triggerNodeChanges(nodeChanges);
      return;
    }
    this.triggerNodeChanges(getSelectionChanges(this.nodeLookup, /* @__PURE__ */ new Set([...selectedNodeIds]), true));
    this.triggerEdgeChanges(getSelectionChanges(this.edgeLookup));
  }
  addSelectedEdges(selectedEdgeIds) {
    if (this.multiSelectionActive()) {
      const changedEdges = selectedEdgeIds.map((edgeId) => createSelectionChange(edgeId, true));
      this.triggerEdgeChanges(changedEdges);
      return;
    }
    this.triggerEdgeChanges(getSelectionChanges(this.edgeLookup, /* @__PURE__ */ new Set([...selectedEdgeIds])));
    this.triggerNodeChanges(getSelectionChanges(this.nodeLookup, /* @__PURE__ */ new Set(), true));
  }
  unselectNodesAndEdges(params = {}) {
    const nodesToUnselect = params.nodes ?? this.nodes();
    const edgesToUnselect = params.edges ?? this.edges();
    const nodeChanges = [];
    for (const node of nodesToUnselect) {
      if (!node.selected) continue;
      const internalNode = this.nodeLookup.get(node.id);
      if (internalNode) {
        internalNode.selected = false;
      }
      nodeChanges.push(createSelectionChange(node.id, false));
    }
    const edgeChanges = [];
    for (const edge of edgesToUnselect) {
      if (!edge.selected) continue;
      edgeChanges.push(createSelectionChange(edge.id, false));
    }
    this.triggerNodeChanges(nodeChanges);
    this.triggerEdgeChanges(edgeChanges);
  }
  // ── Viewport actions ──────────────────────────────────────────────────
  panBy(delta) {
    return panBy({
      delta,
      panZoom: this.panZoom(),
      transform: this.transform(),
      translateExtent: this.translateExtent(),
      width: this.width(),
      height: this.height()
    });
  }
  async fitView(options) {
    const pz = this.panZoom();
    if (!pz) return false;
    await fitViewport({
      nodes: this.nodeLookup,
      width: this.width(),
      height: this.height(),
      panZoom: pz,
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom()
    }, options);
    return true;
  }
  async setCenter(x, y, options) {
    const pz = this.panZoom();
    if (!pz) return false;
    const nextZoom = options?.zoom ?? this.maxZoom();
    await pz.setViewport({
      x: this.width() / 2 - x * nextZoom,
      y: this.height() / 2 - y * nextZoom,
      zoom: nextZoom
    }, {
      duration: options?.duration,
      ease: options?.ease
    });
    return true;
  }
  async setViewport(viewport, options) {
    const pz = this.panZoom();
    if (!pz) return;
    await pz.setViewport(viewport, {
      duration: options?.duration
    });
  }
  async zoomIn(options) {
    const pz = this.panZoom();
    if (!pz) return false;
    return pz.scaleBy(1.2, {
      duration: options?.duration
    });
  }
  async zoomOut(options) {
    const pz = this.panZoom();
    if (!pz) return false;
    return pz.scaleBy(1 / 1.2, {
      duration: options?.duration
    });
  }
  async zoomTo(zoomLevel, options) {
    const pz = this.panZoom();
    if (!pz) return false;
    return pz.scaleTo(zoomLevel, {
      duration: options?.duration
    });
  }
  setMinZoom(minZoom) {
    this.panZoom()?.setScaleExtent([minZoom, this.maxZoom()]);
    this.minZoom.set(minZoom);
  }
  setMaxZoom(maxZoom) {
    this.panZoom()?.setScaleExtent([this.minZoom(), maxZoom]);
    this.maxZoom.set(maxZoom);
  }
  setTranslateExtent(extent) {
    this.panZoom()?.setTranslateExtent(extent);
    this.translateExtent.set(extent);
  }
  setNodeExtent(extent) {
    this.nodeExtent.set(extent);
    const currentNodes = this.nodes();
    adoptUserNodes(currentNodes, this.nodeLookup, this.parentLookup, {
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: extent,
      elevateNodesOnSelect: this.elevateNodesOnSelect(),
      checkEquality: false,
      zIndexMode: this.zIndexMode()
    });
    updateAbsolutePositions(this.nodeLookup, this.parentLookup, {
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: extent,
      zIndexMode: this.zIndexMode()
    });
    this.nodes.update((n) => [...n]);
    this.bumpVersion();
  }
  resetSelectedElements() {
    this.unselectNodesAndEdges();
    this.nodesSelectionActive.set(false);
  }
  // ── Connection actions ────────────────────────────────────────────────
  cancelConnection() {
    this.connection.set(__spreadValues({}, initialConnection));
  }
  updateConnection(connectionState) {
    this.connection.set(connectionState);
  }
  // ── Reset ─────────────────────────────────────────────────────────────
  reset() {
    this.nodeLookup.clear();
    this.parentLookup.clear();
    this.edgeLookup.clear();
    this.connectionLookup.clear();
    this.nodes.set([]);
    this.edges.set([]);
    this.transform.set([0, 0, 1]);
    this.nodesInitialized.set(false);
    this.connection.set(__spreadValues({}, initialConnection));
    this.paneDragging.set(false);
    this.nodesSelectionActive.set(false);
    this.userSelectionActive.set(false);
    this.userSelectionRect.set(null);
    this.multiSelectionActive.set(false);
    this.selectionKeyActive.set(false);
    this.fitViewQueued.set(false);
  }
  // ── Internal helpers ──────────────────────────────────────────────────
  async resolveFitView() {
    const pz = this.panZoom();
    if (!pz) return;
    await fitViewport({
      nodes: this.nodeLookup,
      width: this.width(),
      height: this.height(),
      panZoom: pz,
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom()
    }, this.fitViewOptions());
  }
  /**
   * Returns a snapshot of store items needed by @angflow/system subsystems (XYDrag, XYHandle, etc.).
   */
  getStoreItems() {
    return {
      nodes: this.nodes(),
      nodeLookup: this.nodeLookup,
      edges: this.edges(),
      edgeLookup: this.edgeLookup,
      connectionLookup: this.connectionLookup,
      parentLookup: this.parentLookup,
      nodeOrigin: this.nodeOrigin(),
      nodeExtent: this.nodeExtent(),
      elevateNodesOnSelect: this.elevateNodesOnSelect(),
      elevateEdgesOnSelect: this.elevateEdgesOnSelect(),
      connectionMode: this.connectionMode(),
      domNode: this.domNode(),
      transform: this.transform(),
      panZoom: this.panZoom(),
      snapGrid: this.snapGrid(),
      snapToGrid: this.snapToGrid(),
      nodesDraggable: this.nodesDraggable(),
      selectNodesOnDrag: this.selectNodesOnDrag(),
      nodeDragThreshold: this.nodeDragThreshold(),
      multiSelectionActive: this.multiSelectionActive(),
      connectionRadius: this.connectionRadius(),
      connectionDragThreshold: this.connectionDragThreshold(),
      isValidConnection: this.isValidConnection(),
      autoPanOnConnect: this.autoPanOnConnect(),
      autoPanOnNodeDrag: this.autoPanOnNodeDrag(),
      autoPanOnNodeFocus: this.autoPanOnNodeFocus(),
      autoPanSpeed: this.autoPanSpeed(),
      defaultEdgeOptions: this.defaultEdgeOptions(),
      width: this.width(),
      height: this.height(),
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom(),
      translateExtent: this.translateExtent(),
      zIndexMode: this.zIndexMode(),
      lib: this.lib(),
      connection: this.connection(),
      connectOnClick: this.connectOnClick(),
      noDragClassName: this.noDragClassName(),
      noPanClassName: this.noPanClassName(),
      noWheelClassName: this.noWheelClassName(),
      // Node drag callbacks for XYDrag multi-select support
      onNodeDragStart: this.onNodeDragStart ?? void 0,
      onNodeDrag: this.onNodeDrag ?? void 0,
      onNodeDragStop: this.onNodeDragStop ?? void 0,
      onSelectionDragStart: this.onSelectionDragStart ?? void 0,
      onSelectionDrag: this.onSelectionDrag ?? void 0,
      onSelectionDragStop: this.onSelectionDragStop ?? void 0,
      // Store-bound callbacks for system subsystems
      panBy: (delta) => this.panBy(delta),
      updateNodePositions: (items, dragging) => this.updateNodePositions(items, dragging),
      unselectNodesAndEdges: (params) => this.unselectNodesAndEdges(params),
      addSelectedNodes: (ids) => this.addSelectedNodes(ids),
      addSelectedEdges: (ids) => this.addSelectedEdges(ids),
      updateConnection: (conn) => this.updateConnection(conn),
      cancelConnection: () => this.cancelConnection(),
      triggerNodeChanges: (changes) => this.triggerNodeChanges(changes),
      triggerEdgeChanges: (changes) => this.triggerEdgeChanges(changes)
    };
  }
  static {
    this.ɵfac = function FlowStore_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _FlowStore)();
    };
  }
  static {
    this.ɵprov = ɵɵdefineInjectable({
      token: _FlowStore,
      factory: _FlowStore.ɵfac
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FlowStore, [{
    type: Injectable
  }], null, null);
})();

// ../../packages/angular/dist/esm/lib/services/ng-flow.service.js
var NgFlowService = class _NgFlowService {
  constructor() {
    this.store = inject(FlowStore);
    this.destroyRef = inject(DestroyRef);
    this.nodes = computed(() => this.store.nodes(), ...ngDevMode ? [{
      debugName: "nodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edges = computed(() => this.store.edges(), ...ngDevMode ? [{
      debugName: "edges"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.viewport = computed(() => this.store.viewport(), ...ngDevMode ? [{
      debugName: "viewport"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectedNodes = computed(() => this.store.selectedNodes(), ...ngDevMode ? [{
      debugName: "selectedNodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectedEdges = computed(() => this.store.selectedEdges(), ...ngDevMode ? [{
      debugName: "selectedEdges"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connection = computed(() => this.store.connection(), ...ngDevMode ? [{
      debugName: "connection"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesInitialized = computed(() => this.store.nodesInitialized(), ...ngDevMode ? [{
      debugName: "nodesInitialized"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.visibleNodes = computed(() => this.store.visibleNodes(), ...ngDevMode ? [{
      debugName: "visibleNodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.visibleEdgeIds = computed(() => this.store.visibleEdgeIds(), ...ngDevMode ? [{
      debugName: "visibleEdgeIds"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  // ── Viewport operations ───────────────────────────────────────────────
  zoomIn(options) {
    return this.store.zoomIn(options);
  }
  zoomOut(options) {
    return this.store.zoomOut(options);
  }
  zoomTo(zoomLevel, options) {
    return this.store.zoomTo(zoomLevel, options);
  }
  fitView(options) {
    return this.store.fitView(options);
  }
  setViewport(viewport, options) {
    return this.store.setViewport(viewport, options);
  }
  getViewport() {
    return this.store.viewport();
  }
  getZoom() {
    return this.store.transform()[2];
  }
  setCenter(x, y, options) {
    return this.store.setCenter(x, y, options);
  }
  async fitBounds(bounds, options) {
    const pz = this.store.panZoom();
    if (!pz) return false;
    const {
      x,
      y,
      zoom
    } = this.getViewportForBoundsInternal(bounds, options?.padding ?? 0.1);
    await pz.setViewport({
      x,
      y,
      zoom
    }, {
      duration: options?.duration
    });
    return true;
  }
  // ── Coordinate Conversion ─────────────────────────────────────────────
  screenToFlowPosition(clientPosition, options) {
    const domNode = this.store.domNode();
    if (!domNode) return clientPosition;
    const {
      x: domX,
      y: domY
    } = domNode.getBoundingClientRect();
    const correctedPosition = {
      x: clientPosition.x - domX,
      y: clientPosition.y - domY
    };
    return pointToRendererPoint(correctedPosition, this.store.transform(), options?.snapToGrid ?? this.store.snapToGrid(), options?.snapGrid ?? this.store.snapGrid());
  }
  flowToScreenPosition(flowPosition) {
    const domNode = this.store.domNode();
    if (!domNode) return flowPosition;
    const {
      x: domX,
      y: domY
    } = domNode.getBoundingClientRect();
    const rendered = rendererPointToPoint(flowPosition, this.store.transform());
    return {
      x: rendered.x + domX,
      y: rendered.y + domY
    };
  }
  // ── Node Operations ───────────────────────────────────────────────────
  getNode(id) {
    return this.store.nodeLookup.get(id)?.internals?.userNode;
  }
  getNodes(ids) {
    if (ids) {
      return ids.map((id) => this.getNode(id)).filter((n) => n !== void 0);
    }
    return this.store.nodes();
  }
  getInternalNode(id) {
    return this.store.nodeLookup.get(id);
  }
  setNodes(nodes) {
    this.store.setNodes(nodes);
  }
  addNodes(nodes) {
    const toAdd = Array.isArray(nodes) ? nodes : [nodes];
    this.store.setNodes([...this.store.nodes(), ...toAdd]);
  }
  updateNode(id, nodeUpdate) {
    this.store.setNodes(this.store.nodes().map((node) => {
      if (node.id === id) {
        const update = typeof nodeUpdate === "function" ? nodeUpdate(node) : nodeUpdate;
        return __spreadValues(__spreadValues({}, node), update);
      }
      return node;
    }));
  }
  updateNodeData(id, dataUpdate) {
    this.store.setNodes(this.store.nodes().map((node) => {
      if (node.id === id) {
        const update = typeof dataUpdate === "function" ? dataUpdate(node.data) : dataUpdate;
        return __spreadProps(__spreadValues({}, node), {
          data: __spreadValues(__spreadValues({}, node.data), update)
        });
      }
      return node;
    }));
  }
  // ── Edge Operations ───────────────────────────────────────────────────
  getEdge(id) {
    return this.store.edgeLookup.get(id);
  }
  getEdges() {
    return this.store.edges();
  }
  setEdges(edges) {
    this.store.setEdges(edges);
  }
  addEdges(edges) {
    const toAdd = Array.isArray(edges) ? edges : [edges];
    this.store.setEdges([...this.store.edges(), ...toAdd]);
  }
  updateEdge(id, edgeUpdate) {
    this.store.setEdges(this.store.edges().map((edge) => {
      if (edge.id === id) {
        const update = typeof edgeUpdate === "function" ? edgeUpdate(edge) : edgeUpdate;
        return __spreadValues(__spreadValues({}, edge), update);
      }
      return edge;
    }));
  }
  updateEdgeData(id, dataUpdate) {
    this.store.setEdges(this.store.edges().map((edge) => {
      if (edge.id === id) {
        const update = typeof dataUpdate === "function" ? dataUpdate(edge.data) : dataUpdate;
        return __spreadProps(__spreadValues({}, edge), {
          data: __spreadValues(__spreadValues({}, edge.data), update)
        });
      }
      return edge;
    }));
  }
  // ── Batch ─────────────────────────────────────────────────────────────
  /**
   * Coalesce multiple setNodes/setEdges calls into a single reactivity cycle.
   * Prevents intermediate renders when updating both nodes and edges together.
   */
  batch(fn) {
    this.store.batch(fn);
  }
  // ── Delete ────────────────────────────────────────────────────────────
  async deleteElements(params) {
    const nodeIdsToDelete = new Set((params.nodes ?? []).map((n) => n.id));
    const edgeIdsToDelete = new Set((params.edges ?? []).map((e) => e.id));
    for (const edge of this.store.edges()) {
      if (nodeIdsToDelete.has(edge.source) || nodeIdsToDelete.has(edge.target)) {
        edgeIdsToDelete.add(edge.id);
      }
    }
    const nodesToDelete = this.store.nodes().filter((n) => nodeIdsToDelete.has(n.id));
    const edgesToDelete = this.store.edges().filter((e) => edgeIdsToDelete.has(e.id));
    if (this.store.onBeforeDelete && (nodesToDelete.length > 0 || edgesToDelete.length > 0)) {
      const shouldDelete = await this.store.onBeforeDelete({
        nodes: nodesToDelete,
        edges: edgesToDelete
      });
      if (!shouldDelete) {
        return {
          deletedNodes: [],
          deletedEdges: []
        };
      }
    }
    if (nodeIdsToDelete.size > 0) {
      this.store.setNodes(this.store.nodes().filter((n) => !nodeIdsToDelete.has(n.id)));
    }
    if (edgeIdsToDelete.size > 0) {
      this.store.setEdges(this.store.edges().filter((e) => !edgeIdsToDelete.has(e.id)));
    }
    return {
      deletedNodes: nodesToDelete,
      deletedEdges: edgesToDelete
    };
  }
  // ── Spatial Queries ───────────────────────────────────────────────────
  getIntersectingNodes(node, partially = true) {
    const internalNode = this.store.nodeLookup.get(node.id);
    if (!internalNode) return [];
    const nodeRect = {
      x: internalNode.internals?.positionAbsolute?.x ?? node.position.x,
      y: internalNode.internals?.positionAbsolute?.y ?? node.position.y,
      width: internalNode.measured?.width ?? node.width ?? 0,
      height: internalNode.measured?.height ?? node.height ?? 0
    };
    return this.store.nodes().filter((n) => {
      if (n.id === node.id) return false;
      const otherNode = this.store.nodeLookup.get(n.id);
      if (!otherNode) return false;
      const otherRect = {
        x: otherNode.internals?.positionAbsolute?.x ?? n.position.x,
        y: otherNode.internals?.positionAbsolute?.y ?? n.position.y,
        width: otherNode.measured?.width ?? n.width ?? 0,
        height: otherNode.measured?.height ?? n.height ?? 0
      };
      if (partially) {
        return !(nodeRect.x + nodeRect.width < otherRect.x || otherRect.x + otherRect.width < nodeRect.x || nodeRect.y + nodeRect.height < otherRect.y || otherRect.y + otherRect.height < nodeRect.y);
      }
      return nodeRect.x <= otherRect.x && nodeRect.y <= otherRect.y && nodeRect.x + nodeRect.width >= otherRect.x + otherRect.width && nodeRect.y + nodeRect.height >= otherRect.y + otherRect.height;
    });
  }
  isNodeIntersecting(node, area, partially = true) {
    const internalNode = this.store.nodeLookup.get(node.id);
    if (!internalNode) return false;
    const nodeRect = {
      x: internalNode.internals?.positionAbsolute?.x ?? node.position.x,
      y: internalNode.internals?.positionAbsolute?.y ?? node.position.y,
      width: internalNode.measured?.width ?? node.width ?? 0,
      height: internalNode.measured?.height ?? node.height ?? 0
    };
    if (partially) {
      return !(nodeRect.x + nodeRect.width < area.x || area.x + area.width < nodeRect.x || nodeRect.y + nodeRect.height < area.y || area.y + area.height < nodeRect.y);
    }
    return area.x <= nodeRect.x && area.y <= nodeRect.y && area.x + area.width >= nodeRect.x + nodeRect.width && area.y + area.height >= nodeRect.y + nodeRect.height;
  }
  getNodesBounds(nodes) {
    return getNodesBounds(nodes, {
      nodeOrigin: this.store.nodeOrigin()
    });
  }
  // ── Connection Queries ────────────────────────────────────────────────
  getConnectedEdges(nodeIds) {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    const nodeObjects = ids.map((id) => ({
      id
    }));
    return getConnectedEdges(nodeObjects, this.store.edges());
  }
  getHandleConnections(params) {
    const lookupKey = params.id ? `${params.nodeId}-${params.type}-${params.id}` : `${params.nodeId}-${params.type}`;
    const connections = this.store.connectionLookup.get(lookupKey);
    if (!connections) return [];
    return Array.from(connections.values());
  }
  getNodeConnections(nodeId) {
    const nodeConnections = this.store.connectionLookup.get(nodeId);
    if (!nodeConnections) return [];
    return Array.from(nodeConnections.values());
  }
  // ── Serialization ─────────────────────────────────────────────────────
  toObject() {
    return {
      nodes: this.store.nodes(),
      edges: this.store.edges(),
      viewport: this.store.viewport()
    };
  }
  // ── Signal-based queries (Angular equivalents of React hooks) ──────
  /**
   * Returns a signal containing the data for specific node(s).
   * Equivalent to React's `useNodesData()`.
   */
  selectNodesData(nodeIds) {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    return computed(() => {
      this.store.version();
      return ids.map((id) => {
        const node = this.store.nodeLookup.get(id);
        const userNode = node?.internals?.userNode;
        if (!userNode) return null;
        return {
          id: userNode.id,
          data: userNode.data,
          type: userNode.type
        };
      }).filter((n) => n !== null);
    });
  }
  /**
   * Returns a signal containing all connections for a node.
   * Equivalent to React's `useNodeConnections()`.
   */
  selectNodeConnections(nodeId) {
    return computed(() => {
      this.store.version();
      const nodeConnections = this.store.connectionLookup.get(nodeId);
      if (!nodeConnections) return [];
      return Array.from(nodeConnections.values());
    });
  }
  /**
   * Returns a signal containing connections for a specific handle.
   * Equivalent to React's `useHandleConnections()`.
   */
  selectHandleConnections(params) {
    return computed(() => {
      this.store.version();
      const lookupKey = params.id ? `${params.nodeId}-${params.type}-${params.id}` : `${params.nodeId}-${params.type}`;
      const connections = this.store.connectionLookup.get(lookupKey);
      if (!connections) return [];
      return Array.from(connections.values());
    });
  }
  /**
   * Returns a signal with the internal node for a given ID.
   * Equivalent to React's `useInternalNode()`.
   */
  selectInternalNode(nodeId) {
    return computed(() => {
      this.store.version();
      return this.store.nodeLookup.get(nodeId);
    });
  }
  /**
   * Returns a signal indicating whether all nodes have been initialized (have measured dimensions).
   * Equivalent to React's `useNodesInitialized()`.
   */
  selectNodesInitialized() {
    return this.store.nodesInitialized;
  }
  /**
   * Triggers a recalculation of node internals (e.g., after handle positions change).
   * Equivalent to React's `useUpdateNodeInternals()`.
   */
  updateNodeInternals(nodeIds) {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    const domNode = this.store.domNode();
    if (!domNode) return;
    const updates = /* @__PURE__ */ new Map();
    for (const id of ids) {
      const nodeEl = domNode.querySelector(`[data-id="${id}"]`);
      if (nodeEl) {
        updates.set(id, {
          id,
          nodeElement: nodeEl,
          force: true
        });
      }
    }
    if (updates.size > 0) {
      this.store.updateNodeInternals(updates);
    }
  }
  /**
   * Returns a reactive signal of the current viewport.
   * Equivalent to React's `useViewport()` / `useOnViewportChange()`.
   */
  selectViewport() {
    return this.store.viewport;
  }
  /**
   * Returns a reactive signal of the currently selected nodes and edges.
   * Equivalent to React's `useOnSelectionChange()`.
   */
  selectSelectedElements() {
    return computed(() => ({
      nodes: this.store.selectedNodes(),
      edges: this.store.selectedEdges()
    }));
  }
  /**
   * Returns a signal that tracks whether a specific key (or any key in an array) is currently pressed.
   * Equivalent to React's `useKeyPress()`.
   * Automatically cleaned up when the service is destroyed.
   */
  selectKeyPressed(keyCode) {
    const pressed = signal(false, ...ngDevMode ? [{
      debugName: "pressed"
    }] : (
      /* istanbul ignore next */
      []
    ));
    const keys = Array.isArray(keyCode) ? keyCode : [keyCode];
    const onKeyDown = (e) => {
      if (keys.includes(e.key)) pressed.set(true);
    };
    const onKeyUp = (e) => {
      if (keys.includes(e.key)) pressed.set(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    });
    return pressed.asReadonly();
  }
  // ── State queries ─────────────────────────────────────────────────────
  /**
   * Whether the viewport/panZoom has been initialized.
   */
  get viewportInitialized() {
    return this.store.panZoom() !== null;
  }
  /**
   * Returns a signal containing the data for specific edge(s).
   */
  selectEdgesData(edgeIds) {
    const ids = Array.isArray(edgeIds) ? edgeIds : [edgeIds];
    return computed(() => {
      this.store.version();
      return ids.map((id) => {
        const edge = this.store.edges().find((e) => e.id === id);
        if (!edge) return null;
        return {
          id: edge.id,
          data: edge.data,
          type: edge.type
        };
      }).filter((e) => e !== null);
    });
  }
  // ── Computed Graph Signals ─────────────────────────────────────────
  /**
   * Returns a reactive signal of the outgoing neighbor nodes for a given node ID.
   */
  selectOutgoers(nodeId) {
    return computed(() => {
      this.store.version();
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return [];
      return getOutgoers(node, nodes, edges);
    });
  }
  /**
   * Returns a reactive signal of the incoming neighbor nodes for a given node ID.
   */
  selectIncomers(nodeId) {
    return computed(() => {
      this.store.version();
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return [];
      return getIncomers(node, nodes, edges);
    });
  }
  /**
   * Returns a reactive signal of all edges connected to a given node ID (as source or target).
   */
  selectConnectedEdges(nodeId) {
    return computed(() => {
      this.store.version();
      return getConnectedEdges([{
        id: nodeId
      }], this.store.edges());
    });
  }
  // ── Change Middleware ──────────────────────────────────────────────
  /**
   * Registers middleware that intercepts node changes before they are applied.
   * Returns an unregister function.
   */
  onNodesChangeMiddleware(id, fn) {
    this.store.nodesChangeMiddleware.set(id, fn);
    return () => {
      this.store.nodesChangeMiddleware.delete(id);
    };
  }
  /**
   * Registers middleware that intercepts edge changes before they are applied.
   * Returns an unregister function.
   */
  onEdgesChangeMiddleware(id, fn) {
    this.store.edgesChangeMiddleware.set(id, fn);
    return () => {
      this.store.edgesChangeMiddleware.delete(id);
    };
  }
  // ── Helpers ───────────────────────────────────────────────────────────
  getViewportForBoundsInternal(bounds, padding) {
    return getViewportForBounds(bounds, this.store.width(), this.store.height(), this.store.minZoom(), this.store.maxZoom(), padding);
  }
  static {
    this.ɵfac = function NgFlowService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NgFlowService)();
    };
  }
  static {
    this.ɵprov = ɵɵdefineInjectable({
      token: _NgFlowService,
      factory: _NgFlowService.ɵfac
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgFlowService, [{
    type: Injectable
  }], null, null);
})();

// ../../packages/angular/dist/esm/lib/services/tokens.js
var NODE_ID = new InjectionToken("NODE_ID");
var EDGE_ID = new InjectionToken("EDGE_ID");

// ../../packages/angular/dist/esm/lib/directives/drag.directive.js
var DragDirective = class _DragDirective {
  constructor() {
    this.store = inject(FlowStore);
    this.el = inject(ElementRef);
    this.nodeId = input.required(__spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "nodeId"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "ngFlowDrag"
    }));
    this.disabled = input(false, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "disabled"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "ngFlowDragDisabled"
    }));
    this.noDragClassName = input("nodrag", __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "noDragClassName"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "ngFlowDragNoDragClass"
    }));
    this.handleSelector = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "handleSelector"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "ngFlowDragHandleSelector"
    }));
    this.isSelectable = input(true, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "isSelectable"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "ngFlowDragSelectable"
    }));
    this.nodeClickDistance = input(0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "nodeClickDistance"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "ngFlowDragClickDistance"
    }));
    this.dragInstance = null;
  }
  ngOnInit() {
    this.dragInstance = XYDrag({
      getStoreItems: () => this.store.getStoreItems(),
      onNodeMouseDown: (id) => {
        this.handleNodeClick(id);
      }
    });
    this.updateDrag();
  }
  ngOnChanges(changes) {
    if (this.dragInstance) {
      this.updateDrag();
    }
  }
  ngOnDestroy() {
    this.dragInstance?.destroy();
  }
  updateDrag() {
    if (this.disabled() || !this.el.nativeElement || !this.dragInstance) {
      return;
    }
    this.dragInstance.update({
      noDragClassName: this.noDragClassName(),
      handleSelector: this.handleSelector(),
      domNode: this.el.nativeElement,
      isSelectable: this.isSelectable(),
      nodeId: this.nodeId(),
      nodeClickDistance: this.nodeClickDistance()
    });
  }
  handleNodeClick(id) {
    const store = this.store;
    const node = store.nodeLookup.get(id);
    if (!node) return;
    if (store.selectNodesOnDrag() && node.selectable !== false) {
      if (!node.selected) {
        store.addSelectedNodes([id]);
      }
    }
  }
  static {
    this.ɵfac = function DragDirective_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _DragDirective)();
    };
  }
  static {
    this.ɵdir = ɵɵdefineDirective({
      type: _DragDirective,
      selectors: [["", "ngFlowDrag", ""]],
      inputs: {
        nodeId: [1, "ngFlowDrag", "nodeId"],
        disabled: [1, "ngFlowDragDisabled", "disabled"],
        noDragClassName: [1, "ngFlowDragNoDragClass", "noDragClassName"],
        handleSelector: [1, "ngFlowDragHandleSelector", "handleSelector"],
        isSelectable: [1, "ngFlowDragSelectable", "isSelectable"],
        nodeClickDistance: [1, "ngFlowDragClickDistance", "nodeClickDistance"]
      },
      features: [ɵɵNgOnChangesFeature]
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(DragDirective, [{
    type: Directive,
    args: [{
      selector: "[ngFlowDrag]",
      standalone: true
    }]
  }], null, {
    nodeId: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "ngFlowDrag",
        required: true
      }]
    }],
    disabled: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "ngFlowDragDisabled",
        required: false
      }]
    }],
    noDragClassName: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "ngFlowDragNoDragClass",
        required: false
      }]
    }],
    handleSelector: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "ngFlowDragHandleSelector",
        required: false
      }]
    }],
    isSelectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "ngFlowDragSelectable",
        required: false
      }]
    }],
    nodeClickDistance: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "ngFlowDragClickDistance",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/handle/handle.component.js
var _c0 = ["*"];
var HandleComponent = class _HandleComponent {
  constructor(nodeId) {
    this.Position = Position;
    this.type = input.required(...ngDevMode ? [{
      debugName: "type"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.position = input(Position.Top, ...ngDevMode ? [{
      debugName: "position"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.handleId = input(null, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "handleId"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "id"
    }));
    this.isConnectable = input(true, ...ngDevMode ? [{
      debugName: "isConnectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isConnectableStart = input(true, ...ngDevMode ? [{
      debugName: "isConnectableStart"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isConnectableEnd = input(true, ...ngDevMode ? [{
      debugName: "isConnectableEnd"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isValidConnection = input(void 0, ...ngDevMode ? [{
      debugName: "isValidConnection"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.handleConnect = output({
      alias: "onConnect"
    });
    this.store = inject(FlowStore);
    this.el = inject(ElementRef);
    this.nodeId = "";
    this.dataId = computed(() => `${this.store.rfId()}-${this.nodeId}-${this.handleId()}-${this.type()}`, ...ngDevMode ? [{
      debugName: "dataId"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeId = nodeId ?? "";
  }
  ngOnInit() {
  }
  ngOnDestroy() {
  }
  onPointerDown(event) {
    if (!this.isConnectableStart()) return;
    event.stopPropagation();
    const isTarget = this.type() === "target";
    const store = this.store;
    const handleValidation = this.isValidConnection();
    const storeValidation = store.isValidConnection();
    const validationFn = handleValidation ?? storeValidation;
    XYHandle.onPointerDown(event, {
      autoPanOnConnect: store.autoPanOnConnect(),
      connectionMode: store.connectionMode(),
      connectionRadius: store.connectionRadius(),
      domNode: store.domNode(),
      handleId: this.handleId(),
      nodeId: this.nodeId,
      isTarget,
      nodeLookup: store.nodeLookup,
      lib: "ng",
      flowId: store.rfId(),
      updateConnection: (connection) => store.updateConnection(connection),
      panBy: (delta) => store.panBy(delta),
      cancelConnection: () => store.cancelConnection(),
      onConnect: (connection) => {
        this.handleConnect.emit(connection);
        store.onConnect?.(connection);
      },
      onConnectStart: (event2, params) => store.onConnectStart?.(event2, params),
      onConnectEnd: (event2) => store.onConnectEnd?.(event2),
      getTransform: () => store.transform(),
      getFromHandle: () => {
        const conn = store.connection();
        return conn.inProgress ? conn.fromHandle : null;
      },
      autoPanSpeed: store.autoPanSpeed(),
      dragThreshold: 0,
      handleDomNode: this.el.nativeElement,
      isValidConnection: validationFn
    });
  }
  onClick(event) {
    const store = this.store;
    if (!store.connectOnClick()) return;
    const startHandle = store.connectionClickStartHandle();
    if (!startHandle) {
      store.connectionClickStartHandle.set({
        nodeId: this.nodeId,
        handleId: this.handleId(),
        type: this.type()
      });
      store.onClickConnectStart?.(event, {
        nodeId: this.nodeId,
        handleId: this.handleId(),
        handleType: this.type()
      });
      store.onConnectStart?.(event, {
        nodeId: this.nodeId,
        handleId: this.handleId(),
        handleType: this.type()
      });
    } else {
      const isSource = startHandle.type === "source";
      const connection = {
        source: isSource ? startHandle.nodeId : this.nodeId,
        sourceHandle: isSource ? startHandle.handleId : this.handleId(),
        target: isSource ? this.nodeId : startHandle.nodeId,
        targetHandle: isSource ? this.handleId() : startHandle.handleId
      };
      const handleValidation = this.isValidConnection();
      const storeValidation = store.isValidConnection();
      const validationFn = handleValidation ?? storeValidation;
      if (!validationFn || validationFn(connection)) {
        this.handleConnect.emit(connection);
        store.onConnect?.(connection);
      }
      store.connectionClickStartHandle.set(null);
      store.onClickConnectEnd?.(event);
      store.onConnectEnd?.(event);
    }
  }
  static {
    this.ɵfac = function HandleComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _HandleComponent)(ɵɵdirectiveInject(NODE_ID, 8));
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _HandleComponent,
      selectors: [["ng-flow-handle"]],
      hostAttrs: [1, "ng-flow__handle", "xy-flow__handle"],
      hostVars: 25,
      hostBindings: function HandleComponent_HostBindings(rf, ctx) {
        if (rf & 1) {
          ɵɵlistener("mousedown", function HandleComponent_mousedown_HostBindingHandler($event) {
            return ctx.onPointerDown($event);
          })("click", function HandleComponent_click_HostBindingHandler($event) {
            return ctx.onClick($event);
          });
        }
        if (rf & 2) {
          ɵɵattribute("data-handleid", ctx.handleId())("data-nodeid", ctx.nodeId)("data-handlepos", ctx.position())("data-id", ctx.dataId())("aria-describedby", ctx.store.rfId() + "-handle-desc");
          ɵɵclassProp("xy-flow__handle-top", ctx.position() === ctx.Position.Top)("xy-flow__handle-bottom", ctx.position() === ctx.Position.Bottom)("xy-flow__handle-left", ctx.position() === ctx.Position.Left)("xy-flow__handle-right", ctx.position() === ctx.Position.Right)("source", ctx.type() === "source")("target", ctx.type() === "target")("connectionindicator", true)("connectable", ctx.isConnectable())("connectablestart", ctx.isConnectableStart())("connectableend", ctx.isConnectableEnd());
        }
      },
      inputs: {
        type: [1, "type"],
        position: [1, "position"],
        handleId: [1, "id", "handleId"],
        isConnectable: [1, "isConnectable"],
        isConnectableStart: [1, "isConnectableStart"],
        isConnectableEnd: [1, "isConnectableEnd"],
        isValidConnection: [1, "isValidConnection"]
      },
      outputs: {
        handleConnect: "onConnect"
      },
      ngContentSelectors: _c0,
      decls: 1,
      vars: 0,
      template: function HandleComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(HandleComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-handle",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__handle xy-flow__handle",
        "[class.xy-flow__handle-top]": "position() === Position.Top",
        "[class.xy-flow__handle-bottom]": "position() === Position.Bottom",
        "[class.xy-flow__handle-left]": "position() === Position.Left",
        "[class.xy-flow__handle-right]": "position() === Position.Right",
        "[class.source]": 'type() === "source"',
        "[class.target]": 'type() === "target"',
        "[class.connectionindicator]": "true",
        "[class.connectable]": "isConnectable()",
        "[class.connectablestart]": "isConnectableStart()",
        "[class.connectableend]": "isConnectableEnd()",
        "[attr.data-handleid]": "handleId()",
        "[attr.data-nodeid]": "nodeId",
        "[attr.data-handlepos]": "position()",
        "[attr.data-id]": "dataId()",
        "[attr.aria-describedby]": 'store.rfId() + "-handle-desc"',
        "(mousedown)": "onPointerDown($event)",
        "(click)": "onClick($event)"
      },
      template: `<ng-content />`
    }]
  }], () => [{
    type: void 0,
    decorators: [{
      type: Optional
    }, {
      type: Inject,
      args: [NODE_ID]
    }]
  }], {
    type: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "type",
        required: true
      }]
    }],
    position: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "position",
        required: false
      }]
    }],
    handleId: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: false
      }]
    }],
    isConnectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isConnectable",
        required: false
      }]
    }],
    isConnectableStart: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isConnectableStart",
        required: false
      }]
    }],
    isConnectableEnd: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isConnectableEnd",
        required: false
      }]
    }],
    isValidConnection: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isValidConnection",
        required: false
      }]
    }],
    handleConnect: [{
      type: Output,
      args: ["onConnect"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/nodes/default-node.component.js
var DefaultNodeComponent = class _DefaultNodeComponent {
  constructor() {
    this.Position = Position;
    this.id = input.required(...ngDevMode ? [{
      debugName: "id"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.data = input(...ngDevMode ? [void 0, {
      debugName: "data"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.type = input(...ngDevMode ? [void 0, {
      debugName: "type"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selected = input(false, ...ngDevMode ? [{
      debugName: "selected"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.dragging = input(false, ...ngDevMode ? [{
      debugName: "dragging"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zIndex = input(0, ...ngDevMode ? [{
      debugName: "zIndex"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isConnectable = input(true, ...ngDevMode ? [{
      debugName: "isConnectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.positionAbsoluteX = input(0, ...ngDevMode ? [{
      debugName: "positionAbsoluteX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.positionAbsoluteY = input(0, ...ngDevMode ? [{
      debugName: "positionAbsoluteY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourcePosition = input(...ngDevMode ? [void 0, {
      debugName: "sourcePosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetPosition = input(...ngDevMode ? [void 0, {
      debugName: "targetPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.dragHandle = input(...ngDevMode ? [void 0, {
      debugName: "dragHandle"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function DefaultNodeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _DefaultNodeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _DefaultNodeComponent,
      selectors: [["ng-flow-default-node"]],
      inputs: {
        id: [1, "id"],
        data: [1, "data"],
        type: [1, "type"],
        selected: [1, "selected"],
        dragging: [1, "dragging"],
        zIndex: [1, "zIndex"],
        isConnectable: [1, "isConnectable"],
        positionAbsoluteX: [1, "positionAbsoluteX"],
        positionAbsoluteY: [1, "positionAbsoluteY"],
        sourcePosition: [1, "sourcePosition"],
        targetPosition: [1, "targetPosition"],
        dragHandle: [1, "dragHandle"]
      },
      decls: 4,
      vars: 3,
      consts: [["type", "target", 3, "position"], ["type", "source", 3, "position"]],
      template: function DefaultNodeComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelement(0, "ng-flow-handle", 0);
          ɵɵelementStart(1, "div");
          ɵɵtext(2);
          ɵɵelementEnd();
          ɵɵelement(3, "ng-flow-handle", 1);
        }
        if (rf & 2) {
          let tmp_1_0;
          ɵɵproperty("position", ctx.Position.Top);
          ɵɵadvance(2);
          ɵɵtextInterpolate((tmp_1_0 = ctx.data()) == null ? null : tmp_1_0.label);
          ɵɵadvance();
          ɵɵproperty("position", ctx.Position.Bottom);
        }
      },
      dependencies: [HandleComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(DefaultNodeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-default-node",
      standalone: true,
      imports: [HandleComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div>{{ data()?.label }}</div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `
    }]
  }], null, {
    id: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: true
      }]
    }],
    data: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "data",
        required: false
      }]
    }],
    type: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "type",
        required: false
      }]
    }],
    selected: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selected",
        required: false
      }]
    }],
    dragging: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "dragging",
        required: false
      }]
    }],
    zIndex: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zIndex",
        required: false
      }]
    }],
    isConnectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isConnectable",
        required: false
      }]
    }],
    positionAbsoluteX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "positionAbsoluteX",
        required: false
      }]
    }],
    positionAbsoluteY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "positionAbsoluteY",
        required: false
      }]
    }],
    sourcePosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourcePosition",
        required: false
      }]
    }],
    targetPosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetPosition",
        required: false
      }]
    }],
    dragHandle: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "dragHandle",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/nodes/input-node.component.js
var InputNodeComponent = class _InputNodeComponent {
  constructor() {
    this.Position = Position;
    this.id = input.required(...ngDevMode ? [{
      debugName: "id"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.data = input(...ngDevMode ? [void 0, {
      debugName: "data"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.type = input(...ngDevMode ? [void 0, {
      debugName: "type"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selected = input(false, ...ngDevMode ? [{
      debugName: "selected"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.dragging = input(false, ...ngDevMode ? [{
      debugName: "dragging"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zIndex = input(0, ...ngDevMode ? [{
      debugName: "zIndex"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isConnectable = input(true, ...ngDevMode ? [{
      debugName: "isConnectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.positionAbsoluteX = input(0, ...ngDevMode ? [{
      debugName: "positionAbsoluteX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.positionAbsoluteY = input(0, ...ngDevMode ? [{
      debugName: "positionAbsoluteY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourcePosition = input(...ngDevMode ? [void 0, {
      debugName: "sourcePosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetPosition = input(...ngDevMode ? [void 0, {
      debugName: "targetPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.dragHandle = input(...ngDevMode ? [void 0, {
      debugName: "dragHandle"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function InputNodeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _InputNodeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _InputNodeComponent,
      selectors: [["ng-flow-input-node"]],
      inputs: {
        id: [1, "id"],
        data: [1, "data"],
        type: [1, "type"],
        selected: [1, "selected"],
        dragging: [1, "dragging"],
        zIndex: [1, "zIndex"],
        isConnectable: [1, "isConnectable"],
        positionAbsoluteX: [1, "positionAbsoluteX"],
        positionAbsoluteY: [1, "positionAbsoluteY"],
        sourcePosition: [1, "sourcePosition"],
        targetPosition: [1, "targetPosition"],
        dragHandle: [1, "dragHandle"]
      },
      decls: 3,
      vars: 2,
      consts: [["type", "source", 3, "position"]],
      template: function InputNodeComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelementStart(0, "div");
          ɵɵtext(1);
          ɵɵelementEnd();
          ɵɵelement(2, "ng-flow-handle", 0);
        }
        if (rf & 2) {
          let tmp_0_0;
          ɵɵadvance();
          ɵɵtextInterpolate((tmp_0_0 = ctx.data()) == null ? null : tmp_0_0.label);
          ɵɵadvance();
          ɵɵproperty("position", ctx.Position.Bottom);
        }
      },
      dependencies: [HandleComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(InputNodeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-input-node",
      standalone: true,
      imports: [HandleComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <div>{{ data()?.label }}</div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `
    }]
  }], null, {
    id: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: true
      }]
    }],
    data: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "data",
        required: false
      }]
    }],
    type: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "type",
        required: false
      }]
    }],
    selected: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selected",
        required: false
      }]
    }],
    dragging: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "dragging",
        required: false
      }]
    }],
    zIndex: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zIndex",
        required: false
      }]
    }],
    isConnectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isConnectable",
        required: false
      }]
    }],
    positionAbsoluteX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "positionAbsoluteX",
        required: false
      }]
    }],
    positionAbsoluteY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "positionAbsoluteY",
        required: false
      }]
    }],
    sourcePosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourcePosition",
        required: false
      }]
    }],
    targetPosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetPosition",
        required: false
      }]
    }],
    dragHandle: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "dragHandle",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/nodes/output-node.component.js
var OutputNodeComponent = class _OutputNodeComponent {
  constructor() {
    this.Position = Position;
    this.id = input.required(...ngDevMode ? [{
      debugName: "id"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.data = input(...ngDevMode ? [void 0, {
      debugName: "data"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.type = input(...ngDevMode ? [void 0, {
      debugName: "type"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selected = input(false, ...ngDevMode ? [{
      debugName: "selected"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.dragging = input(false, ...ngDevMode ? [{
      debugName: "dragging"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zIndex = input(0, ...ngDevMode ? [{
      debugName: "zIndex"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isConnectable = input(true, ...ngDevMode ? [{
      debugName: "isConnectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.positionAbsoluteX = input(0, ...ngDevMode ? [{
      debugName: "positionAbsoluteX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.positionAbsoluteY = input(0, ...ngDevMode ? [{
      debugName: "positionAbsoluteY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourcePosition = input(...ngDevMode ? [void 0, {
      debugName: "sourcePosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetPosition = input(...ngDevMode ? [void 0, {
      debugName: "targetPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.dragHandle = input(...ngDevMode ? [void 0, {
      debugName: "dragHandle"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function OutputNodeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _OutputNodeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _OutputNodeComponent,
      selectors: [["ng-flow-output-node"]],
      inputs: {
        id: [1, "id"],
        data: [1, "data"],
        type: [1, "type"],
        selected: [1, "selected"],
        dragging: [1, "dragging"],
        zIndex: [1, "zIndex"],
        isConnectable: [1, "isConnectable"],
        positionAbsoluteX: [1, "positionAbsoluteX"],
        positionAbsoluteY: [1, "positionAbsoluteY"],
        sourcePosition: [1, "sourcePosition"],
        targetPosition: [1, "targetPosition"],
        dragHandle: [1, "dragHandle"]
      },
      decls: 3,
      vars: 2,
      consts: [["type", "target", 3, "position"]],
      template: function OutputNodeComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelement(0, "ng-flow-handle", 0);
          ɵɵelementStart(1, "div");
          ɵɵtext(2);
          ɵɵelementEnd();
        }
        if (rf & 2) {
          let tmp_1_0;
          ɵɵproperty("position", ctx.Position.Top);
          ɵɵadvance(2);
          ɵɵtextInterpolate((tmp_1_0 = ctx.data()) == null ? null : tmp_1_0.label);
        }
      },
      dependencies: [HandleComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(OutputNodeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-output-node",
      standalone: true,
      imports: [HandleComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div>{{ data()?.label }}</div>
  `
    }]
  }], null, {
    id: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: true
      }]
    }],
    data: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "data",
        required: false
      }]
    }],
    type: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "type",
        required: false
      }]
    }],
    selected: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selected",
        required: false
      }]
    }],
    dragging: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "dragging",
        required: false
      }]
    }],
    zIndex: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zIndex",
        required: false
      }]
    }],
    isConnectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isConnectable",
        required: false
      }]
    }],
    positionAbsoluteX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "positionAbsoluteX",
        required: false
      }]
    }],
    positionAbsoluteY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "positionAbsoluteY",
        required: false
      }]
    }],
    sourcePosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourcePosition",
        required: false
      }]
    }],
    targetPosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetPosition",
        required: false
      }]
    }],
    dragHandle: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "dragHandle",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/nodes/group-node.component.js
var GroupNodeComponent = class _GroupNodeComponent {
  constructor() {
    this.id = input.required(...ngDevMode ? [{
      debugName: "id"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.data = input(...ngDevMode ? [void 0, {
      debugName: "data"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.type = input(...ngDevMode ? [void 0, {
      debugName: "type"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selected = input(false, ...ngDevMode ? [{
      debugName: "selected"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.dragging = input(false, ...ngDevMode ? [{
      debugName: "dragging"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zIndex = input(0, ...ngDevMode ? [{
      debugName: "zIndex"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isConnectable = input(true, ...ngDevMode ? [{
      debugName: "isConnectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.positionAbsoluteX = input(0, ...ngDevMode ? [{
      debugName: "positionAbsoluteX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.positionAbsoluteY = input(0, ...ngDevMode ? [{
      debugName: "positionAbsoluteY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourcePosition = input(...ngDevMode ? [void 0, {
      debugName: "sourcePosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetPosition = input(...ngDevMode ? [void 0, {
      debugName: "targetPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.dragHandle = input(...ngDevMode ? [void 0, {
      debugName: "dragHandle"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function GroupNodeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _GroupNodeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _GroupNodeComponent,
      selectors: [["ng-flow-group-node"]],
      hostAttrs: [2, "width", "100%", "height", "100%"],
      inputs: {
        id: [1, "id"],
        data: [1, "data"],
        type: [1, "type"],
        selected: [1, "selected"],
        dragging: [1, "dragging"],
        zIndex: [1, "zIndex"],
        isConnectable: [1, "isConnectable"],
        positionAbsoluteX: [1, "positionAbsoluteX"],
        positionAbsoluteY: [1, "positionAbsoluteY"],
        sourcePosition: [1, "sourcePosition"],
        targetPosition: [1, "targetPosition"],
        dragHandle: [1, "dragHandle"]
      },
      decls: 0,
      vars: 0,
      template: function GroupNodeComponent_Template(rf, ctx) {
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(GroupNodeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-group-node",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "style": "width: 100%; height: 100%;"
      },
      template: ``
    }]
  }], null, {
    id: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: true
      }]
    }],
    data: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "data",
        required: false
      }]
    }],
    type: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "type",
        required: false
      }]
    }],
    selected: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selected",
        required: false
      }]
    }],
    dragging: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "dragging",
        required: false
      }]
    }],
    zIndex: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zIndex",
        required: false
      }]
    }],
    isConnectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isConnectable",
        required: false
      }]
    }],
    positionAbsoluteX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "positionAbsoluteX",
        required: false
      }]
    }],
    positionAbsoluteY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "positionAbsoluteY",
        required: false
      }]
    }],
    sourcePosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourcePosition",
        required: false
      }]
    }],
    targetPosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetPosition",
        required: false
      }]
    }],
    dragHandle: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "dragHandle",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/container/node-renderer/node-renderer.component.js
var _forTrack0 = ($index, $item) => $item.id;
function NodeRendererComponent_For_1_Conditional_0_Conditional_1_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementContainer(0);
  }
}
function NodeRendererComponent_For_1_Conditional_0_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵtemplate(0, NodeRendererComponent_For_1_Conditional_0_Conditional_1_ng_container_0_Template, 1, 0, "ng-container", 2);
  }
  if (rf & 2) {
    const node_r2 = ɵɵnextContext(2).$implicit;
    const ctx_r2 = ɵɵnextContext();
    ɵɵproperty("ngTemplateOutlet", ctx)("ngTemplateOutletContext", ctx_r2.getNodeTemplateContext(node_r2))("ngTemplateOutletInjector", ctx_r2.getNodeInjector(node_r2.id));
  }
}
function NodeRendererComponent_For_1_Conditional_0_Conditional_2_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementContainer(0);
  }
}
function NodeRendererComponent_For_1_Conditional_0_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵtemplate(0, NodeRendererComponent_For_1_Conditional_0_Conditional_2_ng_container_0_Template, 1, 0, "ng-container", 3);
  }
  if (rf & 2) {
    const node_r2 = ɵɵnextContext(2).$implicit;
    const ctx_r2 = ɵɵnextContext();
    ɵɵproperty("ngComponentOutlet", ctx_r2.getNodeComponent(node_r2.type))("ngComponentOutletInputs", ctx_r2.getNodeInputs(node_r2))("ngComponentOutletInjector", ctx_r2.getNodeInjector(node_r2.id));
  }
}
function NodeRendererComponent_For_1_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "div", 1);
    ɵɵlistener("click", function NodeRendererComponent_For_1_Conditional_0_Template_div_click_0_listener($event) {
      ɵɵrestoreView(_r1);
      const node_r2 = ɵɵnextContext().$implicit;
      const ctx_r2 = ɵɵnextContext();
      return ɵɵresetView(ctx_r2.onNodeEvent($event, node_r2.id, "click"));
    })("dblclick", function NodeRendererComponent_For_1_Conditional_0_Template_div_dblclick_0_listener($event) {
      ɵɵrestoreView(_r1);
      const node_r2 = ɵɵnextContext().$implicit;
      const ctx_r2 = ɵɵnextContext();
      return ɵɵresetView(ctx_r2.onNodeEvent($event, node_r2.id, "dblclick"));
    })("contextmenu", function NodeRendererComponent_For_1_Conditional_0_Template_div_contextmenu_0_listener($event) {
      ɵɵrestoreView(_r1);
      const node_r2 = ɵɵnextContext().$implicit;
      const ctx_r2 = ɵɵnextContext();
      return ɵɵresetView(ctx_r2.onNodeEvent($event, node_r2.id, "contextmenu"));
    })("mouseenter", function NodeRendererComponent_For_1_Conditional_0_Template_div_mouseenter_0_listener($event) {
      ɵɵrestoreView(_r1);
      const node_r2 = ɵɵnextContext().$implicit;
      const ctx_r2 = ɵɵnextContext();
      return ɵɵresetView(ctx_r2.onNodeEvent($event, node_r2.id, "mouseenter"));
    })("mousemove", function NodeRendererComponent_For_1_Conditional_0_Template_div_mousemove_0_listener($event) {
      ɵɵrestoreView(_r1);
      const node_r2 = ɵɵnextContext().$implicit;
      const ctx_r2 = ɵɵnextContext();
      return ɵɵresetView(ctx_r2.onNodeEvent($event, node_r2.id, "mousemove"));
    })("mouseleave", function NodeRendererComponent_For_1_Conditional_0_Template_div_mouseleave_0_listener($event) {
      ɵɵrestoreView(_r1);
      const node_r2 = ɵɵnextContext().$implicit;
      const ctx_r2 = ɵɵnextContext();
      return ɵɵresetView(ctx_r2.onNodeEvent($event, node_r2.id, "mouseleave"));
    })("keydown", function NodeRendererComponent_For_1_Conditional_0_Template_div_keydown_0_listener($event) {
      ɵɵrestoreView(_r1);
      const node_r2 = ɵɵnextContext().$implicit;
      const ctx_r2 = ɵɵnextContext();
      return ɵɵresetView(ctx_r2.onNodeKeyDown($event, node_r2));
    })("focus", function NodeRendererComponent_For_1_Conditional_0_Template_div_focus_0_listener() {
      ɵɵrestoreView(_r1);
      const node_r2 = ɵɵnextContext().$implicit;
      const ctx_r2 = ɵɵnextContext();
      return ɵɵresetView(ctx_r2.onNodeFocus(node_r2));
    });
    ɵɵconditionalCreate(1, NodeRendererComponent_For_1_Conditional_0_Conditional_1_Template, 1, 3, "ng-container")(2, NodeRendererComponent_For_1_Conditional_0_Conditional_2_Template, 1, 3, "ng-container");
    ɵɵelementEnd();
  }
  if (rf & 2) {
    let tmp_31_0;
    const node_r2 = ɵɵnextContext().$implicit;
    const ctx_r2 = ɵɵnextContext();
    ɵɵclassMap(ctx_r2.getNodeClasses(node_r2));
    ɵɵstyleProp("z-index", ctx_r2.getNodeZ(node_r2))("transform", ctx_r2.getNodeTransform(node_r2))("width", node_r2.width ?? null, "px")("height", node_r2.height ?? null, "px");
    ɵɵclassProp("selected", node_r2.selected)("draggable", node_r2.draggable !== false && ctx_r2.store.nodesDraggable())("dragging", node_r2.dragging)("selectable", node_r2.selectable !== false)("connectable", true);
    ɵɵproperty("ngFlowDrag", node_r2.id)("ngFlowDragDisabled", node_r2.draggable === false || !ctx_r2.store.nodesDraggable())("ngFlowDragHandleSelector", node_r2.dragHandle)("ngFlowDragNoDragClass", ctx_r2.store.noDragClassName())("ngStyle", node_r2.style);
    ɵɵattribute("aria-label", ctx_r2.getNodeAriaLabel(node_r2))("aria-describedby", ctx_r2.store.rfId() + "-node-desc")("aria-selected", node_r2.selected ?? false)("data-id", node_r2.id)("tabindex", ctx_r2.store.nodesFocusable() ? 0 : -1);
    ɵɵadvance();
    ɵɵconditional((tmp_31_0 = ctx_r2.getNodeTemplate(node_r2.type)) ? 1 : 2, tmp_31_0);
  }
}
function NodeRendererComponent_For_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵconditionalCreate(0, NodeRendererComponent_For_1_Conditional_0_Template, 3, 31, "div", 0);
  }
  if (rf & 2) {
    const node_r2 = ctx.$implicit;
    ɵɵconditional(!node_r2.hidden ? 0 : -1);
  }
}
var builtInNodeTypes = {
  default: DefaultNodeComponent,
  input: InputNodeComponent,
  output: OutputNodeComponent,
  group: GroupNodeComponent
};
var NodeRendererComponent = class _NodeRendererComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.parentInjector = inject(Injector);
    this.el = inject(ElementRef);
    this.customNodeTypes = input({}, ...ngDevMode ? [{
      debugName: "customNodeTypes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeTemplateMap = input(/* @__PURE__ */ new Map(), ...ngDevMode ? [{
      debugName: "nodeTemplateMap"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeClick = output();
    this.nodeDoubleClick = output();
    this.nodeContextMenu = output();
    this.nodeMouseEnter = output();
    this.nodeMouseMove = output();
    this.nodeMouseLeave = output();
    this.visibleNodes = computed(() => this.store.visibleNodes(), ...ngDevMode ? [{
      debugName: "visibleNodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeInjectorCache = /* @__PURE__ */ new Map();
    this.nodeInputsCache = /* @__PURE__ */ new Map();
    this.resizeObserver = null;
    this.mutationObserver = null;
    this.observedNodeIds = /* @__PURE__ */ new Set();
  }
  ngAfterViewInit() {
    this.resizeObserver = new ResizeObserver((entries) => {
      const updates = /* @__PURE__ */ new Map();
      for (const entry of entries) {
        const nodeEl = entry.target;
        const nodeId = nodeEl.getAttribute("data-id");
        if (nodeId) {
          updates.set(nodeId, {
            id: nodeId,
            nodeElement: nodeEl
          });
        }
      }
      if (updates.size > 0) {
        this.store.updateNodeInternals(updates);
      }
    });
    this.mutationObserver = new MutationObserver((mutations) => {
      this.observeNewNodes();
      this.cleanupRemovedNodes(mutations);
    });
    this.mutationObserver.observe(this.el.nativeElement, {
      childList: true,
      subtree: false
    });
    Promise.resolve().then(() => this.observeNewNodes());
  }
  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }
  observeNewNodes() {
    if (!this.resizeObserver) return;
    const container = this.el.nativeElement;
    const nodeElements = container.querySelectorAll(".xy-flow__node");
    nodeElements.forEach((el) => {
      const id = el.getAttribute("data-id");
      if (id && !this.observedNodeIds.has(id)) {
        this.observedNodeIds.add(id);
        this.resizeObserver.observe(el);
      }
    });
  }
  cleanupRemovedNodes(mutations) {
    for (const mutation of mutations) {
      for (const removedNode of Array.from(mutation.removedNodes)) {
        if (!(removedNode instanceof HTMLElement)) continue;
        const id = removedNode.getAttribute("data-id");
        if (id && this.observedNodeIds.has(id)) {
          this.observedNodeIds.delete(id);
          this.resizeObserver?.unobserve(removedNode);
          this.nodeInjectorCache.delete(id);
          this.nodeInputsCache.delete(id);
        }
      }
    }
  }
  onNodeEvent(event, nodeId, eventType) {
    const internalNode = this.store.nodeLookup.get(nodeId);
    const node = internalNode?.internals?.userNode ?? internalNode;
    if (!node) return;
    switch (eventType) {
      case "click":
        if (this.store.elementsSelectable() && internalNode?.selectable !== false) {
          if (this.store.multiSelectionActive()) {
            if (internalNode?.selected) {
              this.store.unselectNodesAndEdges({
                nodes: [node]
              });
            } else {
              this.store.addSelectedNodes([nodeId]);
            }
          } else if (!internalNode?.selected) {
            this.store.addSelectedNodes([nodeId]);
          }
        }
        this.nodeClick.emit({
          event,
          node
        });
        break;
      case "dblclick":
        this.nodeDoubleClick.emit({
          event,
          node
        });
        break;
      case "contextmenu":
        this.nodeContextMenu.emit({
          event,
          node
        });
        break;
      case "mouseenter":
        this.nodeMouseEnter.emit({
          event,
          node
        });
        break;
      case "mousemove":
        this.nodeMouseMove.emit({
          event,
          node
        });
        break;
      case "mouseleave":
        this.nodeMouseLeave.emit({
          event,
          node
        });
        break;
    }
  }
  onNodeKeyDown(event, node) {
    if (event.key === "Escape") {
      this.store.unselectNodesAndEdges({
        nodes: [node]
      });
      event.currentTarget?.blur();
    } else if (event.key === "Enter") {
      if (this.store.elementsSelectable() && !node.selected) {
        this.store.addSelectedNodes([node.id]);
      }
    }
  }
  onNodeFocus(node) {
    if (this.store.elementsSelectable() && node.selectable !== false && !node.selected) {
      this.store.addSelectedNodes([node.id]);
    }
    if (!this.store.autoPanOnNodeFocus()) return;
    const internalNode = this.store.nodeLookup.get(node.id);
    if (!internalNode) return;
    const x = internalNode.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
    const y = internalNode.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
    const w = internalNode.measured?.width ?? node.width ?? 150;
    const h = internalNode.measured?.height ?? node.height ?? 40;
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const zoom = this.store.transform()[2];
    const viewportCenterX = this.store.width() / 2;
    const viewportCenterY = this.store.height() / 2;
    const targetX = viewportCenterX - centerX * zoom;
    const targetY = viewportCenterY - centerY * zoom;
    const currentX = this.store.transform()[0];
    const currentY = this.store.transform()[1];
    const nodeScreenX = x * zoom + currentX;
    const nodeScreenY = y * zoom + currentY;
    const nodeScreenRight = nodeScreenX + w * zoom;
    const nodeScreenBottom = nodeScreenY + h * zoom;
    const margin = 50;
    if (nodeScreenX > margin && nodeScreenY > margin && nodeScreenRight < this.store.width() - margin && nodeScreenBottom < this.store.height() - margin) {
      return;
    }
    this.store.panBy({
      x: targetX - currentX,
      y: targetY - currentY
    });
  }
  getNodeTemplate(type) {
    const resolvedType = type || "default";
    return this.nodeTemplateMap().get(resolvedType) ?? null;
  }
  getNodeTemplateContext(node) {
    const userNode = node.internals?.userNode ?? node;
    return {
      $implicit: userNode,
      node: userNode,
      data: userNode.data,
      selected: node.selected ?? false,
      id: node.id,
      type: node.type,
      dragging: node.dragging ?? false
    };
  }
  getNodeComponent(type) {
    const resolvedType = type || "default";
    return this.customNodeTypes()[resolvedType] ?? builtInNodeTypes[resolvedType] ?? DefaultNodeComponent;
  }
  getNodeInjector(nodeId) {
    let injector = this.nodeInjectorCache.get(nodeId);
    if (!injector) {
      injector = Injector.create({
        providers: [{
          provide: NODE_ID,
          useValue: nodeId
        }],
        parent: this.parentInjector
      });
      this.nodeInjectorCache.set(nodeId, injector);
    }
    return injector;
  }
  getNodeClasses(node) {
    const typeClass = "xy-flow__node-" + (node.type || "default");
    return node.className ? typeClass + " " + node.className : typeClass;
  }
  getNodeZ(node) {
    return node.internals?.z ?? 0;
  }
  getNodeTransform(node) {
    const x = node.internals?.positionAbsolute?.x ?? node.position.x;
    const y = node.internals?.positionAbsolute?.y ?? node.position.y;
    return `translate(${x}px, ${y}px)`;
  }
  getNodeAriaLabel(node) {
    if (node.ariaLabel) return node.ariaLabel;
    const label = node.data?.label ?? node.id;
    const type = node.type || "default";
    return `Node: ${label}, type: ${type}`;
  }
  getNodeInputs(node) {
    const version = this.store.version();
    const cached = this.nodeInputsCache.get(node.id);
    if (cached && cached.version === version) {
      return cached.inputs;
    }
    const inputs = {
      id: node.id,
      data: node.data,
      type: node.type,
      selected: node.selected ?? false,
      dragging: node.dragging ?? false,
      zIndex: node.internals?.z ?? 0,
      isConnectable: true,
      positionAbsoluteX: node.internals?.positionAbsolute?.x ?? node.position.x,
      positionAbsoluteY: node.internals?.positionAbsolute?.y ?? node.position.y,
      sourcePosition: node.sourcePosition,
      targetPosition: node.targetPosition,
      dragHandle: node.dragHandle
    };
    this.nodeInputsCache.set(node.id, {
      version,
      inputs
    });
    return inputs;
  }
  static {
    this.ɵfac = function NodeRendererComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NodeRendererComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _NodeRendererComponent,
      selectors: [["ng-flow-node-renderer"]],
      hostAttrs: [1, "ng-flow__nodes", "xy-flow__nodes", 2, "display", "block", "pointer-events", "none", "transform-origin", "0 0", "width", "100%", "height", "100%"],
      inputs: {
        customNodeTypes: [1, "customNodeTypes"],
        nodeTemplateMap: [1, "nodeTemplateMap"]
      },
      outputs: {
        nodeClick: "nodeClick",
        nodeDoubleClick: "nodeDoubleClick",
        nodeContextMenu: "nodeContextMenu",
        nodeMouseEnter: "nodeMouseEnter",
        nodeMouseMove: "nodeMouseMove",
        nodeMouseLeave: "nodeMouseLeave"
      },
      decls: 2,
      vars: 0,
      consts: [["role", "button", 1, "ng-flow__node", "xy-flow__node", 3, "class", "selected", "draggable", "dragging", "selectable", "connectable", "ngFlowDrag", "ngFlowDragDisabled", "ngFlowDragHandleSelector", "ngFlowDragNoDragClass", "z-index", "transform", "width", "height", "ngStyle"], ["role", "button", 1, "ng-flow__node", "xy-flow__node", 3, "click", "dblclick", "contextmenu", "mouseenter", "mousemove", "mouseleave", "keydown", "focus", "ngFlowDrag", "ngFlowDragDisabled", "ngFlowDragHandleSelector", "ngFlowDragNoDragClass", "ngStyle"], [4, "ngTemplateOutlet", "ngTemplateOutletContext", "ngTemplateOutletInjector"], [4, "ngComponentOutlet", "ngComponentOutletInputs", "ngComponentOutletInjector"]],
      template: function NodeRendererComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵrepeaterCreate(0, NodeRendererComponent_For_1_Template, 1, 1, null, null, _forTrack0);
        }
        if (rf & 2) {
          ɵɵrepeater(ctx.visibleNodes());
        }
      },
      dependencies: [CommonModule, NgComponentOutlet, NgTemplateOutlet, NgStyle, DragDirective],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NodeRendererComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-node-renderer",
      standalone: true,
      imports: [CommonModule, NgComponentOutlet, NgTemplateOutlet, NgStyle, DragDirective],
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__nodes xy-flow__nodes",
        "style": "display: block; pointer-events: none; transform-origin: 0 0; width: 100%; height: 100%;"
      },
      template: `
    @for (node of visibleNodes(); track node.id) {
      @if (!node.hidden) {
      <div
        class="ng-flow__node xy-flow__node"
        [class]="getNodeClasses(node)"
        [class.selected]="node.selected"
        [class.draggable]="node.draggable !== false && store.nodesDraggable()"
        [class.dragging]="node.dragging"
        [class.selectable]="node.selectable !== false"
        [class.connectable]="true"
        [ngFlowDrag]="node.id"
        [ngFlowDragDisabled]="node.draggable === false || !store.nodesDraggable()"
        [ngFlowDragHandleSelector]="node.dragHandle"
        [ngFlowDragNoDragClass]="store.noDragClassName()"
        role="button"
        [attr.aria-label]="getNodeAriaLabel(node)"
        [attr.aria-describedby]="store.rfId() + '-node-desc'"
        [attr.aria-selected]="node.selected ?? false"
        [attr.data-id]="node.id"
        [attr.tabindex]="store.nodesFocusable() ? 0 : -1"
        [style.z-index]="getNodeZ(node)"
        [style.transform]="getNodeTransform(node)"
        [style.width.px]="node.width ?? null"
        [style.height.px]="node.height ?? null"
        [ngStyle]="node.style"
        (click)="onNodeEvent($event, node.id, 'click')"
        (dblclick)="onNodeEvent($event, node.id, 'dblclick')"
        (contextmenu)="onNodeEvent($event, node.id, 'contextmenu')"
        (mouseenter)="onNodeEvent($event, node.id, 'mouseenter')"
        (mousemove)="onNodeEvent($event, node.id, 'mousemove')"
        (mouseleave)="onNodeEvent($event, node.id, 'mouseleave')"
        (keydown)="onNodeKeyDown($event, node)"
        (focus)="onNodeFocus(node)"
      >
        @if (getNodeTemplate(node.type); as tmpl) {
          <ng-container
            *ngTemplateOutlet="tmpl; context: getNodeTemplateContext(node); injector: getNodeInjector(node.id)"
          />
        } @else {
          <ng-container
            *ngComponentOutlet="getNodeComponent(node.type); inputs: getNodeInputs(node); injector: getNodeInjector(node.id)"
          />
        }
      </div>
      }
    }
  `
    }]
  }], null, {
    customNodeTypes: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "customNodeTypes",
        required: false
      }]
    }],
    nodeTemplateMap: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeTemplateMap",
        required: false
      }]
    }],
    nodeClick: [{
      type: Output,
      args: ["nodeClick"]
    }],
    nodeDoubleClick: [{
      type: Output,
      args: ["nodeDoubleClick"]
    }],
    nodeContextMenu: [{
      type: Output,
      args: ["nodeContextMenu"]
    }],
    nodeMouseEnter: [{
      type: Output,
      args: ["nodeMouseEnter"]
    }],
    nodeMouseMove: [{
      type: Output,
      args: ["nodeMouseMove"]
    }],
    nodeMouseLeave: [{
      type: Output,
      args: ["nodeMouseLeave"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/edges/base-edge.component.js
function BaseEdgeComponent_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵdomElement(0, "path", 1);
  }
  if (rf & 2) {
    const ctx_r0 = ɵɵnextContext();
    ɵɵattribute("d", ctx_r0.path())("stroke-width", ctx_r0.interactionWidth());
  }
}
var BaseEdgeComponent = class _BaseEdgeComponent {
  constructor() {
    this.path = input.required(...ngDevMode ? [{
      debugName: "path"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerStart = input(...ngDevMode ? [void 0, {
      debugName: "markerStart"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerEnd = input(...ngDevMode ? [void 0, {
      debugName: "markerEnd"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.style = input(...ngDevMode ? [void 0, {
      debugName: "style"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.interactionWidth = input(20, ...ngDevMode ? [{
      debugName: "interactionWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function BaseEdgeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _BaseEdgeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _BaseEdgeComponent,
      selectors: [["ng-flow-base-edge"]],
      hostAttrs: [2, "display", "contents"],
      inputs: {
        path: [1, "path"],
        markerStart: [1, "markerStart"],
        markerEnd: [1, "markerEnd"],
        style: [1, "style"],
        interactionWidth: [1, "interactionWidth"]
      },
      decls: 3,
      vars: 5,
      consts: [["xmlns", "http://www.w3.org/2000/svg", 2, "position", "absolute", "top", "0", "left", "0", "width", "100%", "height", "100%", "overflow", "visible", "pointer-events", "none"], ["fill", "none", "stroke", "transparent", 1, "xy-flow__edge-interaction", 2, "pointer-events", "stroke"], [1, "xy-flow__edge-path"]],
      template: function BaseEdgeComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵnamespaceSVG();
          ɵɵdomElementStart(0, "svg", 0);
          ɵɵconditionalCreate(1, BaseEdgeComponent_Conditional_1_Template, 1, 2, ":svg:path", 1);
          ɵɵdomElement(2, "path", 2);
          ɵɵdomElementEnd();
        }
        if (rf & 2) {
          ɵɵadvance();
          ɵɵconditional(ctx.interactionWidth() ? 1 : -1);
          ɵɵadvance();
          ɵɵattribute("d", ctx.path())("marker-start", ctx.markerStart())("marker-end", ctx.markerEnd())("style", ctx.style(), ɵɵsanitizeStyle);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BaseEdgeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-base-edge",
      standalone: true,
      schemas: [NO_ERRORS_SCHEMA],
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "style": "display: contents;"
      },
      // The inline <svg> wrapper forces the <path> elements into the SVG namespace,
      // which is required when this component is projected through NgComponentOutlet
      // (Angular creates the dynamic component's host in the XHTML namespace even
      // when it sits inside an <svg>, so raw <path> children would render as unknown
      // HTML elements without this wrapper).
      template: `
    <svg xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
      @if (interactionWidth()) {
        <path
          class="xy-flow__edge-interaction"
          [attr.d]="path()"
          fill="none"
          stroke="transparent"
          [attr.stroke-width]="interactionWidth()"
          style="pointer-events: stroke;"
        />
      }
      <path
        class="xy-flow__edge-path"
        [attr.d]="path()"
        [attr.marker-start]="markerStart()"
        [attr.marker-end]="markerEnd()"
        [attr.style]="style()"
      />
    </svg>
  `
    }]
  }], null, {
    path: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "path",
        required: true
      }]
    }],
    markerStart: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerStart",
        required: false
      }]
    }],
    markerEnd: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerEnd",
        required: false
      }]
    }],
    style: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "style",
        required: false
      }]
    }],
    interactionWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "interactionWidth",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/edges/bezier-edge.component.js
var BezierEdgeComponent = class _BezierEdgeComponent {
  constructor() {
    this.id = input(...ngDevMode ? [void 0, {
      debugName: "id"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.source = input(...ngDevMode ? [void 0, {
      debugName: "source"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.target = input(...ngDevMode ? [void 0, {
      debugName: "target"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.type = input(...ngDevMode ? [void 0, {
      debugName: "type"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.animated = input(false, ...ngDevMode ? [{
      debugName: "animated"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selected = input(false, ...ngDevMode ? [{
      debugName: "selected"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.data = input(...ngDevMode ? [void 0, {
      debugName: "data"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.label = input(...ngDevMode ? [void 0, {
      debugName: "label"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceX = input(0, ...ngDevMode ? [{
      debugName: "sourceX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceY = input(0, ...ngDevMode ? [{
      debugName: "sourceY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetX = input(0, ...ngDevMode ? [{
      debugName: "targetX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetY = input(0, ...ngDevMode ? [{
      debugName: "targetY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourcePosition = input(Position.Bottom, ...ngDevMode ? [{
      debugName: "sourcePosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetPosition = input(Position.Top, ...ngDevMode ? [{
      debugName: "targetPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerStart = input(...ngDevMode ? [void 0, {
      debugName: "markerStart"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerEnd = input(...ngDevMode ? [void 0, {
      debugName: "markerEnd"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.interactionWidth = input(...ngDevMode ? [void 0, {
      debugName: "interactionWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.pathOptions = input(...ngDevMode ? [void 0, {
      debugName: "pathOptions"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceHandleId = input(...ngDevMode ? [void 0, {
      debugName: "sourceHandleId"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetHandleId = input(...ngDevMode ? [void 0, {
      debugName: "targetHandleId"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectable = input(...ngDevMode ? [void 0, {
      debugName: "selectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.deletable = input(...ngDevMode ? [void 0, {
      debugName: "deletable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgePath = computed(() => {
      const [path] = getBezierPath(__spreadValues({
        sourceX: this.sourceX(),
        sourceY: this.sourceY(),
        targetX: this.targetX(),
        targetY: this.targetY(),
        sourcePosition: this.sourcePosition(),
        targetPosition: this.targetPosition()
      }, this.pathOptions()));
      return path;
    }, ...ngDevMode ? [{
      debugName: "edgePath"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function BezierEdgeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _BezierEdgeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _BezierEdgeComponent,
      selectors: [["ng-flow-bezier-edge"]],
      hostAttrs: [2, "display", "contents"],
      inputs: {
        id: [1, "id"],
        source: [1, "source"],
        target: [1, "target"],
        type: [1, "type"],
        animated: [1, "animated"],
        selected: [1, "selected"],
        data: [1, "data"],
        label: [1, "label"],
        sourceX: [1, "sourceX"],
        sourceY: [1, "sourceY"],
        targetX: [1, "targetX"],
        targetY: [1, "targetY"],
        sourcePosition: [1, "sourcePosition"],
        targetPosition: [1, "targetPosition"],
        markerStart: [1, "markerStart"],
        markerEnd: [1, "markerEnd"],
        interactionWidth: [1, "interactionWidth"],
        pathOptions: [1, "pathOptions"],
        sourceHandleId: [1, "sourceHandleId"],
        targetHandleId: [1, "targetHandleId"],
        selectable: [1, "selectable"],
        deletable: [1, "deletable"]
      },
      decls: 1,
      vars: 4,
      consts: [[3, "path", "markerStart", "markerEnd", "interactionWidth"]],
      template: function BezierEdgeComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelement(0, "ng-flow-base-edge", 0);
        }
        if (rf & 2) {
          ɵɵproperty("path", ctx.edgePath())("markerStart", ctx.markerStart())("markerEnd", ctx.markerEnd())("interactionWidth", ctx.interactionWidth() ?? 20);
        }
      },
      dependencies: [BaseEdgeComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BezierEdgeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-bezier-edge",
      standalone: true,
      imports: [BaseEdgeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "style": "display: contents;"
      },
      template: `
    <ng-flow-base-edge
      [path]="edgePath()"
      [markerStart]="markerStart()"
      [markerEnd]="markerEnd()"
      [interactionWidth]="interactionWidth() ?? 20"
    />
  `
    }]
  }], null, {
    id: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: false
      }]
    }],
    source: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "source",
        required: false
      }]
    }],
    target: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "target",
        required: false
      }]
    }],
    type: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "type",
        required: false
      }]
    }],
    animated: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "animated",
        required: false
      }]
    }],
    selected: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selected",
        required: false
      }]
    }],
    data: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "data",
        required: false
      }]
    }],
    label: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "label",
        required: false
      }]
    }],
    sourceX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceX",
        required: false
      }]
    }],
    sourceY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceY",
        required: false
      }]
    }],
    targetX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetX",
        required: false
      }]
    }],
    targetY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetY",
        required: false
      }]
    }],
    sourcePosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourcePosition",
        required: false
      }]
    }],
    targetPosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetPosition",
        required: false
      }]
    }],
    markerStart: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerStart",
        required: false
      }]
    }],
    markerEnd: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerEnd",
        required: false
      }]
    }],
    interactionWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "interactionWidth",
        required: false
      }]
    }],
    pathOptions: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "pathOptions",
        required: false
      }]
    }],
    sourceHandleId: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceHandleId",
        required: false
      }]
    }],
    targetHandleId: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetHandleId",
        required: false
      }]
    }],
    selectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selectable",
        required: false
      }]
    }],
    deletable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "deletable",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/edges/straight-edge.component.js
var StraightEdgeComponent = class _StraightEdgeComponent {
  constructor() {
    this.id = input(...ngDevMode ? [void 0, {
      debugName: "id"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceX = input(0, ...ngDevMode ? [{
      debugName: "sourceX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceY = input(0, ...ngDevMode ? [{
      debugName: "sourceY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetX = input(0, ...ngDevMode ? [{
      debugName: "targetX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetY = input(0, ...ngDevMode ? [{
      debugName: "targetY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.data = input(...ngDevMode ? [void 0, {
      debugName: "data"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selected = input(false, ...ngDevMode ? [{
      debugName: "selected"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerStart = input(...ngDevMode ? [void 0, {
      debugName: "markerStart"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerEnd = input(...ngDevMode ? [void 0, {
      debugName: "markerEnd"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.interactionWidth = input(...ngDevMode ? [void 0, {
      debugName: "interactionWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.label = input(...ngDevMode ? [void 0, {
      debugName: "label"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgePath = computed(() => {
      const [path] = getStraightPath({
        sourceX: this.sourceX(),
        sourceY: this.sourceY(),
        targetX: this.targetX(),
        targetY: this.targetY()
      });
      return path;
    }, ...ngDevMode ? [{
      debugName: "edgePath"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function StraightEdgeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _StraightEdgeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _StraightEdgeComponent,
      selectors: [["ng-flow-straight-edge"]],
      inputs: {
        id: [1, "id"],
        sourceX: [1, "sourceX"],
        sourceY: [1, "sourceY"],
        targetX: [1, "targetX"],
        targetY: [1, "targetY"],
        data: [1, "data"],
        selected: [1, "selected"],
        markerStart: [1, "markerStart"],
        markerEnd: [1, "markerEnd"],
        interactionWidth: [1, "interactionWidth"],
        label: [1, "label"]
      },
      decls: 1,
      vars: 4,
      consts: [[3, "path", "markerStart", "markerEnd", "interactionWidth"]],
      template: function StraightEdgeComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelement(0, "ng-flow-base-edge", 0);
        }
        if (rf & 2) {
          ɵɵproperty("path", ctx.edgePath())("markerStart", ctx.markerStart())("markerEnd", ctx.markerEnd())("interactionWidth", ctx.interactionWidth() ?? 20);
        }
      },
      dependencies: [BaseEdgeComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(StraightEdgeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-straight-edge",
      standalone: true,
      imports: [BaseEdgeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <ng-flow-base-edge
      [path]="edgePath()"
      [markerStart]="markerStart()"
      [markerEnd]="markerEnd()"
      [interactionWidth]="interactionWidth() ?? 20"
    />
  `
    }]
  }], null, {
    id: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: false
      }]
    }],
    sourceX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceX",
        required: false
      }]
    }],
    sourceY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceY",
        required: false
      }]
    }],
    targetX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetX",
        required: false
      }]
    }],
    targetY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetY",
        required: false
      }]
    }],
    data: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "data",
        required: false
      }]
    }],
    selected: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selected",
        required: false
      }]
    }],
    markerStart: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerStart",
        required: false
      }]
    }],
    markerEnd: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerEnd",
        required: false
      }]
    }],
    interactionWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "interactionWidth",
        required: false
      }]
    }],
    label: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "label",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/edges/step-edge.component.js
var StepEdgeComponent = class _StepEdgeComponent {
  constructor() {
    this.id = input(...ngDevMode ? [void 0, {
      debugName: "id"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceX = input(0, ...ngDevMode ? [{
      debugName: "sourceX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceY = input(0, ...ngDevMode ? [{
      debugName: "sourceY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetX = input(0, ...ngDevMode ? [{
      debugName: "targetX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetY = input(0, ...ngDevMode ? [{
      debugName: "targetY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourcePosition = input(Position.Bottom, ...ngDevMode ? [{
      debugName: "sourcePosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetPosition = input(Position.Top, ...ngDevMode ? [{
      debugName: "targetPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.data = input(...ngDevMode ? [void 0, {
      debugName: "data"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selected = input(false, ...ngDevMode ? [{
      debugName: "selected"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerStart = input(...ngDevMode ? [void 0, {
      debugName: "markerStart"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerEnd = input(...ngDevMode ? [void 0, {
      debugName: "markerEnd"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.interactionWidth = input(...ngDevMode ? [void 0, {
      debugName: "interactionWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.pathOptions = input(...ngDevMode ? [void 0, {
      debugName: "pathOptions"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.label = input(...ngDevMode ? [void 0, {
      debugName: "label"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgePath = computed(() => {
      const [path] = getSmoothStepPath(__spreadValues({
        sourceX: this.sourceX(),
        sourceY: this.sourceY(),
        targetX: this.targetX(),
        targetY: this.targetY(),
        sourcePosition: this.sourcePosition(),
        targetPosition: this.targetPosition(),
        borderRadius: 0
      }, this.pathOptions()));
      return path;
    }, ...ngDevMode ? [{
      debugName: "edgePath"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function StepEdgeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _StepEdgeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _StepEdgeComponent,
      selectors: [["ng-flow-step-edge"]],
      inputs: {
        id: [1, "id"],
        sourceX: [1, "sourceX"],
        sourceY: [1, "sourceY"],
        targetX: [1, "targetX"],
        targetY: [1, "targetY"],
        sourcePosition: [1, "sourcePosition"],
        targetPosition: [1, "targetPosition"],
        data: [1, "data"],
        selected: [1, "selected"],
        markerStart: [1, "markerStart"],
        markerEnd: [1, "markerEnd"],
        interactionWidth: [1, "interactionWidth"],
        pathOptions: [1, "pathOptions"],
        label: [1, "label"]
      },
      decls: 1,
      vars: 4,
      consts: [[3, "path", "markerStart", "markerEnd", "interactionWidth"]],
      template: function StepEdgeComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelement(0, "ng-flow-base-edge", 0);
        }
        if (rf & 2) {
          ɵɵproperty("path", ctx.edgePath())("markerStart", ctx.markerStart())("markerEnd", ctx.markerEnd())("interactionWidth", ctx.interactionWidth() ?? 20);
        }
      },
      dependencies: [BaseEdgeComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(StepEdgeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-step-edge",
      standalone: true,
      imports: [BaseEdgeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <ng-flow-base-edge
      [path]="edgePath()"
      [markerStart]="markerStart()"
      [markerEnd]="markerEnd()"
      [interactionWidth]="interactionWidth() ?? 20"
    />
  `
    }]
  }], null, {
    id: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: false
      }]
    }],
    sourceX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceX",
        required: false
      }]
    }],
    sourceY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceY",
        required: false
      }]
    }],
    targetX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetX",
        required: false
      }]
    }],
    targetY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetY",
        required: false
      }]
    }],
    sourcePosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourcePosition",
        required: false
      }]
    }],
    targetPosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetPosition",
        required: false
      }]
    }],
    data: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "data",
        required: false
      }]
    }],
    selected: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selected",
        required: false
      }]
    }],
    markerStart: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerStart",
        required: false
      }]
    }],
    markerEnd: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerEnd",
        required: false
      }]
    }],
    interactionWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "interactionWidth",
        required: false
      }]
    }],
    pathOptions: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "pathOptions",
        required: false
      }]
    }],
    label: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "label",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/edges/smooth-step-edge.component.js
var SmoothStepEdgeComponent = class _SmoothStepEdgeComponent {
  constructor() {
    this.id = input(...ngDevMode ? [void 0, {
      debugName: "id"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceX = input(0, ...ngDevMode ? [{
      debugName: "sourceX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceY = input(0, ...ngDevMode ? [{
      debugName: "sourceY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetX = input(0, ...ngDevMode ? [{
      debugName: "targetX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetY = input(0, ...ngDevMode ? [{
      debugName: "targetY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourcePosition = input(Position.Bottom, ...ngDevMode ? [{
      debugName: "sourcePosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetPosition = input(Position.Top, ...ngDevMode ? [{
      debugName: "targetPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.data = input(...ngDevMode ? [void 0, {
      debugName: "data"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selected = input(false, ...ngDevMode ? [{
      debugName: "selected"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerStart = input(...ngDevMode ? [void 0, {
      debugName: "markerStart"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerEnd = input(...ngDevMode ? [void 0, {
      debugName: "markerEnd"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.interactionWidth = input(...ngDevMode ? [void 0, {
      debugName: "interactionWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.pathOptions = input(...ngDevMode ? [void 0, {
      debugName: "pathOptions"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.label = input(...ngDevMode ? [void 0, {
      debugName: "label"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgePath = computed(() => {
      const [path] = getSmoothStepPath(__spreadValues({
        sourceX: this.sourceX(),
        sourceY: this.sourceY(),
        targetX: this.targetX(),
        targetY: this.targetY(),
        sourcePosition: this.sourcePosition(),
        targetPosition: this.targetPosition()
      }, this.pathOptions()));
      return path;
    }, ...ngDevMode ? [{
      debugName: "edgePath"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function SmoothStepEdgeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _SmoothStepEdgeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _SmoothStepEdgeComponent,
      selectors: [["ng-flow-smooth-step-edge"]],
      inputs: {
        id: [1, "id"],
        sourceX: [1, "sourceX"],
        sourceY: [1, "sourceY"],
        targetX: [1, "targetX"],
        targetY: [1, "targetY"],
        sourcePosition: [1, "sourcePosition"],
        targetPosition: [1, "targetPosition"],
        data: [1, "data"],
        selected: [1, "selected"],
        markerStart: [1, "markerStart"],
        markerEnd: [1, "markerEnd"],
        interactionWidth: [1, "interactionWidth"],
        pathOptions: [1, "pathOptions"],
        label: [1, "label"]
      },
      decls: 1,
      vars: 4,
      consts: [[3, "path", "markerStart", "markerEnd", "interactionWidth"]],
      template: function SmoothStepEdgeComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelement(0, "ng-flow-base-edge", 0);
        }
        if (rf & 2) {
          ɵɵproperty("path", ctx.edgePath())("markerStart", ctx.markerStart())("markerEnd", ctx.markerEnd())("interactionWidth", ctx.interactionWidth() ?? 20);
        }
      },
      dependencies: [BaseEdgeComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(SmoothStepEdgeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-smooth-step-edge",
      standalone: true,
      imports: [BaseEdgeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <ng-flow-base-edge
      [path]="edgePath()"
      [markerStart]="markerStart()"
      [markerEnd]="markerEnd()"
      [interactionWidth]="interactionWidth() ?? 20"
    />
  `
    }]
  }], null, {
    id: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: false
      }]
    }],
    sourceX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceX",
        required: false
      }]
    }],
    sourceY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceY",
        required: false
      }]
    }],
    targetX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetX",
        required: false
      }]
    }],
    targetY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetY",
        required: false
      }]
    }],
    sourcePosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourcePosition",
        required: false
      }]
    }],
    targetPosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetPosition",
        required: false
      }]
    }],
    data: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "data",
        required: false
      }]
    }],
    selected: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selected",
        required: false
      }]
    }],
    markerStart: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerStart",
        required: false
      }]
    }],
    markerEnd: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerEnd",
        required: false
      }]
    }],
    interactionWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "interactionWidth",
        required: false
      }]
    }],
    pathOptions: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "pathOptions",
        required: false
      }]
    }],
    label: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "label",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/edges/simple-bezier-edge.component.js
var SimpleBezierEdgeComponent = class _SimpleBezierEdgeComponent {
  constructor() {
    this.id = input(...ngDevMode ? [void 0, {
      debugName: "id"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceX = input(0, ...ngDevMode ? [{
      debugName: "sourceX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourceY = input(0, ...ngDevMode ? [{
      debugName: "sourceY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetX = input(0, ...ngDevMode ? [{
      debugName: "targetX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetY = input(0, ...ngDevMode ? [{
      debugName: "targetY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.sourcePosition = input(Position.Bottom, ...ngDevMode ? [{
      debugName: "sourcePosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.targetPosition = input(Position.Top, ...ngDevMode ? [{
      debugName: "targetPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.data = input(...ngDevMode ? [void 0, {
      debugName: "data"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selected = input(false, ...ngDevMode ? [{
      debugName: "selected"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerStart = input(...ngDevMode ? [void 0, {
      debugName: "markerStart"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markerEnd = input(...ngDevMode ? [void 0, {
      debugName: "markerEnd"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.interactionWidth = input(...ngDevMode ? [void 0, {
      debugName: "interactionWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.label = input(...ngDevMode ? [void 0, {
      debugName: "label"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgePath = computed(() => {
      const [path] = getBezierPath({
        sourceX: this.sourceX(),
        sourceY: this.sourceY(),
        targetX: this.targetX(),
        targetY: this.targetY(),
        sourcePosition: this.sourcePosition(),
        targetPosition: this.targetPosition()
      });
      return path;
    }, ...ngDevMode ? [{
      debugName: "edgePath"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function SimpleBezierEdgeComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _SimpleBezierEdgeComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _SimpleBezierEdgeComponent,
      selectors: [["ng-flow-simple-bezier-edge"]],
      inputs: {
        id: [1, "id"],
        sourceX: [1, "sourceX"],
        sourceY: [1, "sourceY"],
        targetX: [1, "targetX"],
        targetY: [1, "targetY"],
        sourcePosition: [1, "sourcePosition"],
        targetPosition: [1, "targetPosition"],
        data: [1, "data"],
        selected: [1, "selected"],
        markerStart: [1, "markerStart"],
        markerEnd: [1, "markerEnd"],
        interactionWidth: [1, "interactionWidth"],
        label: [1, "label"]
      },
      decls: 1,
      vars: 4,
      consts: [[3, "path", "markerStart", "markerEnd", "interactionWidth"]],
      template: function SimpleBezierEdgeComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelement(0, "ng-flow-base-edge", 0);
        }
        if (rf & 2) {
          ɵɵproperty("path", ctx.edgePath())("markerStart", ctx.markerStart())("markerEnd", ctx.markerEnd())("interactionWidth", ctx.interactionWidth() ?? 20);
        }
      },
      dependencies: [BaseEdgeComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(SimpleBezierEdgeComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-simple-bezier-edge",
      standalone: true,
      imports: [BaseEdgeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <ng-flow-base-edge
      [path]="edgePath()"
      [markerStart]="markerStart()"
      [markerEnd]="markerEnd()"
      [interactionWidth]="interactionWidth() ?? 20"
    />
  `
    }]
  }], null, {
    id: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: false
      }]
    }],
    sourceX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceX",
        required: false
      }]
    }],
    sourceY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourceY",
        required: false
      }]
    }],
    targetX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetX",
        required: false
      }]
    }],
    targetY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetY",
        required: false
      }]
    }],
    sourcePosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "sourcePosition",
        required: false
      }]
    }],
    targetPosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "targetPosition",
        required: false
      }]
    }],
    data: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "data",
        required: false
      }]
    }],
    selected: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selected",
        required: false
      }]
    }],
    markerStart: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerStart",
        required: false
      }]
    }],
    markerEnd: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "markerEnd",
        required: false
      }]
    }],
    interactionWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "interactionWidth",
        required: false
      }]
    }],
    label: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "label",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/container/edge-renderer/edge-renderer.component.js
var _forTrack02 = ($index, $item) => $item.id;
function EdgeRendererComponent_For_3_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵelementStart(0, "marker", 1);
    ɵɵelement(1, "polyline", 3);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const marker_r1 = ctx.$implicit;
    ɵɵproperty("id", marker_r1.id);
    ɵɵattribute("markerWidth", marker_r1.width ?? 12.5)("markerHeight", marker_r1.height ?? 12.5);
    ɵɵadvance();
    ɵɵclassProp("arrowclosed", marker_r1.type === "arrowclosed");
    ɵɵattribute("stroke", marker_r1.color || "currentColor")("fill", marker_r1.type === "arrowclosed" ? marker_r1.color || "currentColor" : "none");
  }
}
function EdgeRendererComponent_For_5_Conditional_0_Conditional_3__svg_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵelementContainer(0);
  }
}
function EdgeRendererComponent_For_5_Conditional_0_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵtemplate(0, EdgeRendererComponent_For_5_Conditional_0_Conditional_3__svg_ng_container_0_Template, 1, 0, "ng-container", 7);
  }
  if (rf & 2) {
    ɵɵnextContext();
    const ei_r5 = ɵɵreadContextLet(0);
    const edge_r3 = ɵɵnextContext().$implicit;
    const ctx_r3 = ɵɵnextContext();
    ɵɵproperty("ngComponentOutlet", ctx_r3.getEdgeComponent(edge_r3.type))("ngComponentOutletInputs", ei_r5);
  }
}
function EdgeRendererComponent_For_5_Conditional_0_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵelement(0, "path", 8)(1, "path", 9);
  }
  if (rf & 2) {
    ɵɵnextContext();
    const ei_r5 = ɵɵreadContextLet(0);
    const edge_r3 = ɵɵnextContext().$implicit;
    const ctx_r3 = ɵɵnextContext();
    ɵɵattribute("d", ctx_r3.getEdgePath(ei_r5))("stroke-width", edge_r3.interactionWidth ?? 20);
    ɵɵadvance();
    ɵɵattribute("d", ctx_r3.getEdgePath(ei_r5))("marker-start", ei_r5["markerStart"])("marker-end", ei_r5["markerEnd"])("style", ctx_r3.getEdgePathStyle(edge_r3), ɵɵsanitizeStyle);
  }
}
function EdgeRendererComponent_For_5_Conditional_0_Conditional_5_Template(rf, ctx) {
  if (rf & 1) {
    const _r6 = ɵɵgetCurrentView();
    ɵɵnamespaceSVG();
    ɵɵelementStart(0, "circle", 10);
    ɵɵlistener("mousedown", function EdgeRendererComponent_For_5_Conditional_0_Conditional_5_Template_circle_mousedown_0_listener($event) {
      ɵɵrestoreView(_r6);
      const edge_r3 = ɵɵnextContext(2).$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onReconnectSourceMouseDown($event, edge_r3));
    });
    ɵɵelementEnd();
    ɵɵelementStart(1, "circle", 11);
    ɵɵlistener("mousedown", function EdgeRendererComponent_For_5_Conditional_0_Conditional_5_Template_circle_mousedown_1_listener($event) {
      ɵɵrestoreView(_r6);
      const edge_r3 = ɵɵnextContext(2).$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onReconnectTargetMouseDown($event, edge_r3));
    });
    ɵɵelementEnd();
  }
  if (rf & 2) {
    ɵɵnextContext();
    const ei_r5 = ɵɵreadContextLet(0);
    const ctx_r3 = ɵɵnextContext(2);
    ɵɵattribute("cx", ctx_r3.shiftX(ei_r5["sourceX"], ctx_r3.reconnectRadius(), ei_r5["sourcePosition"]))("cy", ctx_r3.shiftY(ei_r5["sourceY"], ctx_r3.reconnectRadius(), ei_r5["sourcePosition"]))("r", ctx_r3.reconnectRadius());
    ɵɵadvance();
    ɵɵattribute("cx", ctx_r3.shiftX(ei_r5["targetX"], ctx_r3.reconnectRadius(), ei_r5["targetPosition"]))("cy", ctx_r3.shiftY(ei_r5["targetY"], ctx_r3.reconnectRadius(), ei_r5["targetPosition"]))("r", ctx_r3.reconnectRadius());
  }
}
function EdgeRendererComponent_For_5_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r2 = ɵɵgetCurrentView();
    ɵɵdeclareLet(0);
    ɵɵnamespaceSVG();
    ɵɵelementStart(1, "svg", 5);
    ɵɵlistener("keydown", function EdgeRendererComponent_For_5_Conditional_0_Template_svg_keydown_1_listener($event) {
      ɵɵrestoreView(_r2);
      const edge_r3 = ɵɵnextContext().$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onEdgeKeyDown($event, edge_r3));
    })("focus", function EdgeRendererComponent_For_5_Conditional_0_Template_svg_focus_1_listener() {
      ɵɵrestoreView(_r2);
      const edge_r3 = ɵɵnextContext().$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onEdgeFocus(edge_r3));
    });
    ɵɵelementStart(2, "g", 6);
    ɵɵlistener("click", function EdgeRendererComponent_For_5_Conditional_0_Template_g_click_2_listener($event) {
      ɵɵrestoreView(_r2);
      const edge_r3 = ɵɵnextContext().$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onEdgeEvent($event, edge_r3, "click"));
    })("dblclick", function EdgeRendererComponent_For_5_Conditional_0_Template_g_dblclick_2_listener($event) {
      ɵɵrestoreView(_r2);
      const edge_r3 = ɵɵnextContext().$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onEdgeEvent($event, edge_r3, "dblclick"));
    })("contextmenu", function EdgeRendererComponent_For_5_Conditional_0_Template_g_contextmenu_2_listener($event) {
      ɵɵrestoreView(_r2);
      const edge_r3 = ɵɵnextContext().$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onEdgeEvent($event, edge_r3, "contextmenu"));
    })("mouseenter", function EdgeRendererComponent_For_5_Conditional_0_Template_g_mouseenter_2_listener($event) {
      ɵɵrestoreView(_r2);
      const edge_r3 = ɵɵnextContext().$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onEdgeEvent($event, edge_r3, "mouseenter"));
    })("mousemove", function EdgeRendererComponent_For_5_Conditional_0_Template_g_mousemove_2_listener($event) {
      ɵɵrestoreView(_r2);
      const edge_r3 = ɵɵnextContext().$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onEdgeEvent($event, edge_r3, "mousemove"));
    })("mouseleave", function EdgeRendererComponent_For_5_Conditional_0_Template_g_mouseleave_2_listener($event) {
      ɵɵrestoreView(_r2);
      const edge_r3 = ɵɵnextContext().$implicit;
      const ctx_r3 = ɵɵnextContext();
      return ɵɵresetView(ctx_r3.onEdgeEvent($event, edge_r3, "mouseleave"));
    });
    ɵɵconditionalCreate(3, EdgeRendererComponent_For_5_Conditional_0_Conditional_3_Template, 1, 2, ":svg:ng-container")(4, EdgeRendererComponent_For_5_Conditional_0_Conditional_4_Template, 2, 6);
    ɵɵconditionalCreate(5, EdgeRendererComponent_For_5_Conditional_0_Conditional_5_Template, 2, 6);
    ɵɵelementEnd()();
  }
  if (rf & 2) {
    const edge_r3 = ɵɵnextContext().$implicit;
    const ctx_r3 = ɵɵnextContext();
    ɵɵstoreLet(ctx_r3.getEdgeInputs(edge_r3));
    ɵɵadvance();
    ɵɵclassMap(ctx_r3.getEdgeClasses(edge_r3));
    ɵɵstyleProp("z-index", ctx_r3.getEdgeZIndex(edge_r3));
    ɵɵclassProp("selected", edge_r3.selected)("animated", edge_r3.animated)("selectable", edge_r3.selectable !== false);
    ɵɵattribute("aria-label", ctx_r3.getEdgeAriaLabel(edge_r3))("tabindex", ctx_r3.store.edgesFocusable() ? 0 : -1);
    ɵɵadvance();
    ɵɵclassMap(ctx_r3.getEdgeGClasses(edge_r3));
    ɵɵattribute("data-id", edge_r3.id)("aria-label", edge_r3.ariaLabel ? edge_r3.ariaLabel : void 0);
    ɵɵadvance();
    ɵɵconditional(ctx_r3.isCustomEdge(edge_r3.type) ? 3 : 4);
    ɵɵadvance(2);
    ɵɵconditional(ctx_r3.isEdgeReconnectable(edge_r3) ? 5 : -1);
  }
}
function EdgeRendererComponent_For_5_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵconditionalCreate(0, EdgeRendererComponent_For_5_Conditional_0_Template, 6, 19, ":svg:svg", 4);
  }
  if (rf & 2) {
    const edge_r3 = ctx.$implicit;
    ɵɵconditional(!edge_r3.hidden ? 0 : -1);
  }
}
function EdgeRendererComponent_For_8_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementStart(0, "div", 13);
    ɵɵtext(1);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const edge_r7 = ɵɵnextContext().$implicit;
    const ctx_r3 = ɵɵnextContext();
    const ei_r8 = ctx_r3.getEdgeInputs(edge_r7);
    ɵɵstyleProp("position", "absolute")("transform", "translate(-50%, -50%) translate(" + ctx_r3.getEdgeCenterX(ei_r8) + "px, " + ctx_r3.getEdgeCenterY(ei_r8) + "px)")("pointer-events", "all");
    ɵɵadvance();
    ɵɵtextInterpolate1(" ", edge_r7.label, " ");
  }
}
function EdgeRendererComponent_For_8_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵconditionalCreate(0, EdgeRendererComponent_For_8_Conditional_0_Template, 2, 7, "div", 12);
  }
  if (rf & 2) {
    const edge_r7 = ctx.$implicit;
    ɵɵconditional(edge_r7.label && !edge_r7.hidden ? 0 : -1);
  }
}
var builtInEdgeTypes = {
  default: BezierEdgeComponent,
  bezier: BezierEdgeComponent,
  straight: StraightEdgeComponent,
  step: StepEdgeComponent,
  smoothstep: SmoothStepEdgeComponent,
  simplebezier: SimpleBezierEdgeComponent
};
var EdgeRendererComponent = class _EdgeRendererComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.reconnectRadius = input(10, ...ngDevMode ? [{
      debugName: "reconnectRadius"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgeClick = output();
    this.edgeDoubleClick = output();
    this.edgeContextMenu = output();
    this.edgeMouseEnter = output();
    this.edgeMouseMove = output();
    this.edgeMouseLeave = output();
    this.customEdgeTypes = input({}, ...ngDevMode ? [{
      debugName: "customEdgeTypes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.reconnect = output();
    this.reconnectStart = output();
    this.reconnectEnd = output();
    this.visibleEdges = computed(() => {
      const visibleIds = this.store.visibleEdgeIds();
      return this.store.edges().filter((e) => visibleIds.has(e.id));
    }, ...ngDevMode ? [{
      debugName: "visibleEdges"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.markers = computed(() => {
      const edges = this.store.edges();
      const markerMap = /* @__PURE__ */ new Map();
      for (const edge of edges) {
        this.addMarker(markerMap, edge.markerStart);
        this.addMarker(markerMap, edge.markerEnd);
      }
      return Array.from(markerMap.values());
    }, ...ngDevMode ? [{
      debugName: "markers"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  isCustomEdge(type) {
    const resolvedType = type || "default";
    const customTypes = this.customEdgeTypes();
    return resolvedType in customTypes;
  }
  getEdgeClasses(edge) {
    const typeClass = "xy-flow__edge-" + (edge.type || "default");
    return edge.className ? typeClass + " " + edge.className : typeClass;
  }
  getEdgeGClasses(edge) {
    let cls = "ng-flow__edge-wrapper";
    if (edge.selected) cls += " selected";
    if (edge.animated) cls += " animated";
    if (edge.className) cls += " " + edge.className;
    return cls;
  }
  getEdgePathStyle(edge) {
    const style = edge.style;
    if (!style) return null;
    return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join("; ");
  }
  getEdgeZIndex(edge) {
    if (edge.zIndex !== void 0) return edge.zIndex;
    const sourceZ = this.store.nodeLookup.get(edge.source)?.internals?.z ?? 0;
    const targetZ = this.store.nodeLookup.get(edge.target)?.internals?.z ?? 0;
    return Math.max(sourceZ, targetZ);
  }
  getEdgePath(ei) {
    const type = ei["type"] || "default";
    const params = {
      sourceX: ei["sourceX"],
      sourceY: ei["sourceY"],
      targetX: ei["targetX"],
      targetY: ei["targetY"],
      sourcePosition: ei["sourcePosition"] ?? Position.Bottom,
      targetPosition: ei["targetPosition"] ?? Position.Top
    };
    switch (type) {
      case "straight":
        return getStraightPath(params)[0];
      case "step":
        return getSmoothStepPath(__spreadProps(__spreadValues({}, params), {
          borderRadius: 0
        }))[0];
      case "smoothstep":
        return getSmoothStepPath(params)[0];
      case "default":
      case "bezier":
      default:
        return getBezierPath(params)[0];
    }
  }
  getEdgeComponent(type) {
    const resolvedType = type || "default";
    return this.customEdgeTypes()[resolvedType] ?? builtInEdgeTypes[resolvedType] ?? BezierEdgeComponent;
  }
  getEdgeInputs(edge) {
    const sourceNode = this.store.nodeLookup.get(edge.source);
    const targetNode = this.store.nodeLookup.get(edge.target);
    const sourceHandle = sourceNode?.internals?.handleBounds?.source?.find((h) => h.id === edge.sourceHandle || !edge.sourceHandle && h.id === null) ?? sourceNode?.internals?.handleBounds?.source?.[0];
    const targetHandle = targetNode?.internals?.handleBounds?.target?.find((h) => h.id === edge.targetHandle || !edge.targetHandle && h.id === null) ?? targetNode?.internals?.handleBounds?.target?.[0];
    const sourcePos = sourceNode?.internals?.positionAbsolute ?? sourceNode?.position ?? {
      x: 0,
      y: 0
    };
    const targetPos = targetNode?.internals?.positionAbsolute ?? targetNode?.position ?? {
      x: 0,
      y: 0
    };
    const sourceW = sourceNode?.measured?.width ?? sourceNode?.width ?? 150;
    const sourceH = sourceNode?.measured?.height ?? sourceNode?.height ?? 40;
    const targetW = targetNode?.measured?.width ?? targetNode?.width ?? 150;
    const targetH = targetNode?.measured?.height ?? targetNode?.height ?? 40;
    let sourceX, sourceY, targetX, targetY;
    let srcPos = sourceHandle?.position ?? edge.sourcePosition ?? Position.Bottom;
    let tgtPos = targetHandle?.position ?? edge.targetPosition ?? Position.Top;
    if (sourceHandle) {
      sourceX = sourcePos.x + sourceHandle.x + (sourceHandle.width ?? 0) / 2;
      sourceY = sourcePos.y + sourceHandle.y + (sourceHandle.height ?? 0) / 2;
    } else {
      sourceX = sourcePos.x + sourceW / 2;
      sourceY = sourcePos.y + sourceH;
    }
    if (targetHandle) {
      targetX = targetPos.x + targetHandle.x + (targetHandle.width ?? 0) / 2;
      targetY = targetPos.y + targetHandle.y + (targetHandle.height ?? 0) / 2;
    } else {
      targetX = targetPos.x + targetW / 2;
      targetY = targetPos.y;
    }
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data,
      selected: edge.selected ?? false,
      animated: edge.animated ?? false,
      label: edge.label,
      selectable: edge.selectable,
      deletable: edge.deletable,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: srcPos,
      targetPosition: tgtPos,
      markerStart: this.getMarkerUrl(edge.markerStart),
      markerEnd: this.getMarkerUrl(edge.markerEnd),
      interactionWidth: edge.interactionWidth,
      pathOptions: edge.pathOptions,
      sourceHandleId: edge.sourceHandle,
      targetHandleId: edge.targetHandle
    };
  }
  onEdgeEvent(event, edge, eventType) {
    switch (eventType) {
      case "click":
        if (this.store.elementsSelectable()) {
          this.store.addSelectedEdges([edge.id]);
        }
        this.edgeClick.emit({
          event,
          edge
        });
        break;
      case "dblclick":
        this.edgeDoubleClick.emit({
          event,
          edge
        });
        break;
      case "contextmenu":
        this.edgeContextMenu.emit({
          event,
          edge
        });
        break;
      case "mouseenter":
        this.edgeMouseEnter.emit({
          event,
          edge
        });
        break;
      case "mousemove":
        this.edgeMouseMove.emit({
          event,
          edge
        });
        break;
      case "mouseleave":
        this.edgeMouseLeave.emit({
          event,
          edge
        });
        break;
    }
  }
  onEdgeKeyDown(event, edge) {
    if (event.key === "Escape") {
      this.store.unselectNodesAndEdges({
        edges: [edge]
      });
    } else if (event.key === "Enter") {
      if (this.store.elementsSelectable()) {
        this.store.addSelectedEdges([edge.id]);
      }
    }
  }
  onEdgeFocus(edge) {
    if (this.store.elementsSelectable() && !edge.selected) {
      this.store.addSelectedEdges([edge.id]);
    }
  }
  getEdgeCenterX(ei) {
    return (ei["sourceX"] + ei["targetX"]) / 2;
  }
  getEdgeCenterY(ei) {
    return (ei["sourceY"] + ei["targetY"]) / 2;
  }
  getEdgeAriaLabel(edge) {
    if (edge.ariaLabel) return edge.ariaLabel;
    return `Edge from ${edge.source} to ${edge.target}`;
  }
  isEdgeReconnectable(edge) {
    if (edge.reconnectable !== void 0) return !!edge.reconnectable;
    return this.store.edgesReconnectable();
  }
  shiftX(x, shift, position) {
    if (position === Position.Left) return x - shift;
    if (position === Position.Right) return x + shift;
    return x;
  }
  shiftY(y, shift, position) {
    if (position === Position.Top) return y - shift;
    if (position === Position.Bottom) return y + shift;
    return y;
  }
  onReconnectSourceMouseDown(event, edge) {
    if (event.button !== 0) return;
    this.handleEdgeReconnect(event, edge, {
      nodeId: edge.target,
      id: edge.targetHandle ?? null,
      type: "target"
    });
  }
  onReconnectTargetMouseDown(event, edge) {
    if (event.button !== 0) return;
    this.handleEdgeReconnect(event, edge, {
      nodeId: edge.source,
      id: edge.sourceHandle ?? null,
      type: "source"
    });
  }
  handleEdgeReconnect(event, edge, oppositeHandle) {
    const store = this.store;
    const isTarget = oppositeHandle.type === "target";
    this.reconnectStart.emit({
      event,
      edge,
      handleType: oppositeHandle.type
    });
    XYHandle.onPointerDown(event, {
      autoPanOnConnect: store.autoPanOnConnect(),
      connectionMode: store.connectionMode(),
      connectionRadius: store.connectionRadius(),
      domNode: store.domNode(),
      handleId: oppositeHandle.id,
      nodeId: oppositeHandle.nodeId,
      nodeLookup: store.nodeLookup,
      isTarget,
      edgeUpdaterType: oppositeHandle.type,
      lib: "ng",
      flowId: store.rfId(),
      cancelConnection: () => store.cancelConnection(),
      panBy: (delta) => store.panBy(delta),
      updateConnection: (conn) => store.updateConnection(conn),
      getTransform: () => store.transform(),
      getFromHandle: () => {
        const conn = store.connection();
        return conn.inProgress ? conn.fromHandle : null;
      },
      autoPanSpeed: store.autoPanSpeed(),
      dragThreshold: store.connectionDragThreshold(),
      handleDomNode: event.currentTarget,
      isValidConnection: store.isValidConnection(),
      onConnect: (connection) => {
        this.reconnect.emit({
          edge,
          connection
        });
      },
      onReconnectEnd: (evt, connectionState) => {
        this.reconnectEnd.emit({
          event: evt,
          edge,
          handleType: oppositeHandle.type,
          connectionState
        });
      }
    });
  }
  addMarker(map, marker) {
    if (!marker || typeof marker === "string") return;
    const id = getMarkerId(marker, this.store.rfId());
    if (!map.has(id)) {
      map.set(id, __spreadProps(__spreadValues({}, marker), {
        id
      }));
    }
  }
  getMarkerUrl(marker) {
    if (!marker) return void 0;
    if (typeof marker === "string") return marker;
    return `url('#${getMarkerId(marker, this.store.rfId())}')`;
  }
  static {
    this.ɵfac = function EdgeRendererComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _EdgeRendererComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _EdgeRendererComponent,
      selectors: [["ng-flow-edge-renderer"]],
      hostAttrs: [1, "ng-flow__edges", "xy-flow__edges", 2, "position", "absolute", "width", "100%", "height", "100%", "top", "0", "left", "0", "pointer-events", "none"],
      inputs: {
        reconnectRadius: [1, "reconnectRadius"],
        customEdgeTypes: [1, "customEdgeTypes"]
      },
      outputs: {
        edgeClick: "edgeClick",
        edgeDoubleClick: "edgeDoubleClick",
        edgeContextMenu: "edgeContextMenu",
        edgeMouseEnter: "edgeMouseEnter",
        edgeMouseMove: "edgeMouseMove",
        edgeMouseLeave: "edgeMouseLeave",
        reconnect: "reconnect",
        reconnectStart: "reconnectStart",
        reconnectEnd: "reconnectEnd"
      },
      decls: 9,
      vars: 0,
      consts: [[2, "position", "absolute", "width", "100%", "height", "100%", "overflow", "visible", "pointer-events", "none"], ["viewBox", "-10 -10 20 20", "markerUnits", "strokeWidth", "orient", "auto-start-reverse", "refX", "0", "refY", "0", 3, "id"], [1, "xy-flow__edgelabel-renderer", 2, "position", "absolute", "width", "100%", "height", "100%", "pointer-events", "none", "top", "0", "left", "0"], ["stroke-linecap", "round", "stroke-linejoin", "round", "stroke-width", "1", "points", "-5,-4 0,0 -5,4", 1, "xy-flow__arrowhead"], ["role", "img", 1, "ng-flow__edge", "xy-flow__edge", 2, "overflow", "visible", "position", "absolute", "width", "100%", "height", "100%", "pointer-events", "none", 3, "class", "selected", "animated", "selectable", "z-index"], ["role", "img", 1, "ng-flow__edge", "xy-flow__edge", 2, "overflow", "visible", "position", "absolute", "width", "100%", "height", "100%", "pointer-events", "none", 3, "keydown", "focus"], [2, "pointer-events", "visibleStroke", 3, "click", "dblclick", "contextmenu", "mouseenter", "mousemove", "mouseleave"], [4, "ngComponentOutlet", "ngComponentOutletInputs"], ["fill", "none", "stroke", "transparent", 1, "xy-flow__edge-interaction", 2, "pointer-events", "all"], [1, "ng-flow__edge-path", "xy-flow__edge-path"], ["stroke", "transparent", "fill", "transparent", 1, "xy-flow__edgeupdater", "xy-flow__edgeupdater-source", 3, "mousedown"], ["stroke", "transparent", "fill", "transparent", 1, "xy-flow__edgeupdater", "xy-flow__edgeupdater-target", 3, "mousedown"], [1, "xy-flow__edge-label", 3, "position", "transform", "pointer-events"], [1, "xy-flow__edge-label"]],
      template: function EdgeRendererComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵnamespaceSVG();
          ɵɵelementStart(0, "svg", 0)(1, "defs");
          ɵɵrepeaterCreate(2, EdgeRendererComponent_For_3_Template, 2, 7, ":svg:marker", 1, _forTrack02);
          ɵɵelementEnd()();
          ɵɵrepeaterCreate(4, EdgeRendererComponent_For_5_Template, 1, 1, null, null, _forTrack02);
          ɵɵnamespaceHTML();
          ɵɵelementStart(6, "div", 2);
          ɵɵrepeaterCreate(7, EdgeRendererComponent_For_8_Template, 1, 1, null, null, _forTrack02);
          ɵɵelementEnd();
        }
        if (rf & 2) {
          ɵɵadvance(2);
          ɵɵrepeater(ctx.markers());
          ɵɵadvance(2);
          ɵɵrepeater(ctx.visibleEdges());
          ɵɵadvance(3);
          ɵɵrepeater(ctx.visibleEdges());
        }
      },
      dependencies: [CommonModule, NgComponentOutlet],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(EdgeRendererComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-edge-renderer",
      standalone: true,
      imports: [CommonModule, NgComponentOutlet],
      schemas: [NO_ERRORS_SCHEMA],
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__edges xy-flow__edges",
        "style": "position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none;"
      },
      template: `
    <svg style="position: absolute; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
      <defs>
        @for (marker of markers(); track marker.id) {
          <marker
            [id]="marker.id"
            [attr.markerWidth]="marker.width ?? 12.5"
            [attr.markerHeight]="marker.height ?? 12.5"
            viewBox="-10 -10 20 20"
            markerUnits="strokeWidth"
            orient="auto-start-reverse"
            refX="0"
            refY="0"
          >
            <polyline
              class="xy-flow__arrowhead"
              [class.arrowclosed]="marker.type === 'arrowclosed'"
              [attr.stroke]="marker.color || 'currentColor'"
              [attr.fill]="marker.type === 'arrowclosed' ? (marker.color || 'currentColor') : 'none'"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1"
              points="-5,-4 0,0 -5,4"
            />
          </marker>
        }
      </defs>
    </svg>
    @for (edge of visibleEdges(); track edge.id) {
      @if (!edge.hidden) {
      @let ei = getEdgeInputs(edge);
      <svg
        class="ng-flow__edge xy-flow__edge"
        [class]="getEdgeClasses(edge)"
        [class.selected]="edge.selected"
        [class.animated]="edge.animated"
        [class.selectable]="edge.selectable !== false"
        [style.z-index]="getEdgeZIndex(edge)"
        [attr.aria-label]="getEdgeAriaLabel(edge)"
        [attr.tabindex]="store.edgesFocusable() ? 0 : -1"
        role="img"
        style="overflow: visible; position: absolute; width: 100%; height: 100%; pointer-events: none;"
        (keydown)="onEdgeKeyDown($event, edge)"
        (focus)="onEdgeFocus(edge)"
      >
        <g
          [attr.data-id]="edge.id"
          [class]="getEdgeGClasses(edge)"
          [attr.aria-label]="edge.ariaLabel ? edge.ariaLabel : undefined"
          style="pointer-events: visibleStroke;"
          (click)="onEdgeEvent($event, edge, 'click')"
          (dblclick)="onEdgeEvent($event, edge, 'dblclick')"
          (contextmenu)="onEdgeEvent($event, edge, 'contextmenu')"
          (mouseenter)="onEdgeEvent($event, edge, 'mouseenter')"
          (mousemove)="onEdgeEvent($event, edge, 'mousemove')"
          (mouseleave)="onEdgeEvent($event, edge, 'mouseleave')"
        >
          @if (isCustomEdge(edge.type)) {
            <ng-container
              *ngComponentOutlet="getEdgeComponent(edge.type); inputs: ei"
            />
          } @else {
            <path
              class="xy-flow__edge-interaction"
              [attr.d]="getEdgePath(ei)"
              fill="none"
              stroke="transparent"
              [attr.stroke-width]="edge.interactionWidth ?? 20"
              style="pointer-events: all;"
            />
            <path
              class="ng-flow__edge-path xy-flow__edge-path"
              [attr.d]="getEdgePath(ei)"
              [attr.marker-start]="ei['markerStart']"
              [attr.marker-end]="ei['markerEnd']"
              [attr.style]="getEdgePathStyle(edge)"
            />
          }
          @if (isEdgeReconnectable(edge)) {
            <circle
              class="xy-flow__edgeupdater xy-flow__edgeupdater-source"
              [attr.cx]="shiftX(ei['sourceX'], reconnectRadius(), ei['sourcePosition'])"
              [attr.cy]="shiftY(ei['sourceY'], reconnectRadius(), ei['sourcePosition'])"
              [attr.r]="reconnectRadius()"
              stroke="transparent"
              fill="transparent"
              (mousedown)="onReconnectSourceMouseDown($event, edge)"
            />
            <circle
              class="xy-flow__edgeupdater xy-flow__edgeupdater-target"
              [attr.cx]="shiftX(ei['targetX'], reconnectRadius(), ei['targetPosition'])"
              [attr.cy]="shiftY(ei['targetY'], reconnectRadius(), ei['targetPosition'])"
              [attr.r]="reconnectRadius()"
              stroke="transparent"
              fill="transparent"
              (mousedown)="onReconnectTargetMouseDown($event, edge)"
            />
          }
        </g>
      </svg>
      }
    }
    <div class="xy-flow__edgelabel-renderer" style="position: absolute; width: 100%; height: 100%; pointer-events: none; top: 0; left: 0;">
      @for (edge of visibleEdges(); track edge.id) {
        @if (edge.label && !edge.hidden) {
          @let ei = getEdgeInputs(edge);
          <div
            class="xy-flow__edge-label"
            [style.position]="'absolute'"
            [style.transform]="'translate(-50%, -50%) translate(' + getEdgeCenterX(ei) + 'px, ' + getEdgeCenterY(ei) + 'px)'"
            [style.pointer-events]="'all'"
          >
            {{ edge.label }}
          </div>
        }
      }
    </div>
  `
    }]
  }], null, {
    reconnectRadius: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "reconnectRadius",
        required: false
      }]
    }],
    edgeClick: [{
      type: Output,
      args: ["edgeClick"]
    }],
    edgeDoubleClick: [{
      type: Output,
      args: ["edgeDoubleClick"]
    }],
    edgeContextMenu: [{
      type: Output,
      args: ["edgeContextMenu"]
    }],
    edgeMouseEnter: [{
      type: Output,
      args: ["edgeMouseEnter"]
    }],
    edgeMouseMove: [{
      type: Output,
      args: ["edgeMouseMove"]
    }],
    edgeMouseLeave: [{
      type: Output,
      args: ["edgeMouseLeave"]
    }],
    customEdgeTypes: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "customEdgeTypes",
        required: false
      }]
    }],
    reconnect: [{
      type: Output,
      args: ["reconnect"]
    }],
    reconnectStart: [{
      type: Output,
      args: ["reconnectStart"]
    }],
    reconnectEnd: [{
      type: Output,
      args: ["reconnectEnd"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/container/viewport/viewport.component.js
var _c02 = ["*"];
var ViewportComponent = class _ViewportComponent {
  constructor() {
    this.transform = input.required(...ngDevMode ? [{
      debugName: "transform"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.cssTransform = computed(() => {
      const t = this.transform();
      return `translate(${t[0]}px, ${t[1]}px) scale(${t[2]})`;
    }, ...ngDevMode ? [{
      debugName: "cssTransform"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function ViewportComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _ViewportComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _ViewportComponent,
      selectors: [["ng-flow-viewport"]],
      hostAttrs: [1, "ng-flow__viewport", "xy-flow__viewport", "xyflow__viewport", 2, "display", "block", "transform-origin", "0 0", "z-index", "2", "pointer-events", "none", "position", "absolute", "width", "100%", "height", "100%"],
      hostVars: 2,
      hostBindings: function ViewportComponent_HostBindings(rf, ctx) {
        if (rf & 2) {
          ɵɵstyleProp("transform", ctx.cssTransform());
        }
      },
      inputs: {
        transform: [1, "transform"]
      },
      ngContentSelectors: _c02,
      decls: 1,
      vars: 0,
      template: function ViewportComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ViewportComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-viewport",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__viewport xy-flow__viewport xyflow__viewport",
        "style": "display: block; transform-origin: 0 0; z-index: 2; pointer-events: none; position: absolute; width: 100%; height: 100%;",
        "[style.transform]": "cssTransform()"
      },
      template: `<ng-content />`
    }]
  }], null, {
    transform: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "transform",
        required: true
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/container/pane/pane.component.js
var _c03 = ["*"];
var PaneComponent = class _PaneComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.zone = inject(NgZone);
    this.el = inject(ElementRef);
    this.panOnDrag = input(true, ...ngDevMode ? [{
      debugName: "panOnDrag"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectionOnDrag = input(false, ...ngDevMode ? [{
      debugName: "selectionOnDrag"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectionKeyCode = input(null, ...ngDevMode ? [{
      debugName: "selectionKeyCode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectionMode = input(SelectionMode.Full, ...ngDevMode ? [{
      debugName: "selectionMode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectionStart = output();
    this.selectionEnd = output();
    this.paneScroll = output();
    this.isSelecting = false;
    this.startX = 0;
    this.startY = 0;
    this.boundOnMouseMove = null;
    this.boundOnMouseUp = null;
    this.nativeMouseDownHandler = null;
  }
  onWheel(event) {
    this.paneScroll.emit(event);
  }
  /**
   * Call this after d3-zoom is initialized to attach a capture-phase
   * mousedown listener that fires BEFORE d3-zoom's listener.
   */
  initSelectionListener() {
    this.nativeMouseDownHandler = (e) => this.onMouseDown(e);
    this.el.nativeElement.addEventListener("mousedown", this.nativeMouseDownHandler, true);
  }
  onMouseDown(event) {
    const shouldSelect = this.selectionOnDrag() || this.store.selectionKeyActive();
    if (!shouldSelect) return;
    if (event.button !== 0) return;
    const target = event.target;
    if (target.closest(".xy-flow__node") || target.closest(".xy-flow__handle") || target.closest(".xy-flow__edge") || target.closest(".xy-flow__controls") || target.closest(".xy-flow__panel")) {
      return;
    }
    event.stopImmediatePropagation();
    event.preventDefault();
    const containerEl = this.store.domNode();
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;
    this.isSelecting = true;
    this.store.userSelectionActive.set(true);
    this.store.userSelectionRect.set({
      x: this.startX,
      y: this.startY,
      width: 0,
      height: 0,
      startX: this.startX,
      startY: this.startY
    });
    this.selectionStart.emit(event);
    this.boundOnMouseMove = (e) => this.onMouseMove(e);
    this.boundOnMouseUp = (e) => this.onMouseUp(e);
    this.zone.runOutsideAngular(() => {
      document.addEventListener("mousemove", this.boundOnMouseMove);
      document.addEventListener("mouseup", this.boundOnMouseUp);
    });
  }
  onMouseMove(event) {
    if (!this.isSelecting) return;
    const containerEl = this.store.domNode();
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;
    const selectionRect = {
      x: Math.min(this.startX, currentX),
      y: Math.min(this.startY, currentY),
      width: Math.abs(currentX - this.startX),
      height: Math.abs(currentY - this.startY),
      startX: this.startX,
      startY: this.startY
    };
    this.zone.run(() => {
      this.store.userSelectionRect.set(selectionRect);
      const transform2 = this.store.transform();
      const partially = this.selectionMode() === SelectionMode.Partial;
      const nodesInside = getNodesInside(this.store.nodeLookup, selectionRect, transform2, partially);
      const nodeIds = nodesInside.map((n) => n.id);
      if (nodeIds.length > 0) {
        this.store.addSelectedNodes(nodeIds);
      }
    });
  }
  onMouseUp(event) {
    if (!this.isSelecting) return;
    this.isSelecting = false;
    if (this.boundOnMouseMove) {
      document.removeEventListener("mousemove", this.boundOnMouseMove);
      this.boundOnMouseMove = null;
    }
    if (this.boundOnMouseUp) {
      document.removeEventListener("mouseup", this.boundOnMouseUp);
      this.boundOnMouseUp = null;
    }
    this.zone.run(() => {
      this.store.userSelectionActive.set(false);
      this.store.userSelectionRect.set(null);
      if (this.store.selectedNodes().length > 0) {
        this.store.nodesSelectionActive.set(true);
      }
      this.selectionEnd.emit(event);
    });
  }
  ngOnDestroy() {
    if (this.nativeMouseDownHandler) {
      this.el.nativeElement.removeEventListener("mousedown", this.nativeMouseDownHandler, true);
    }
    if (this.boundOnMouseMove) {
      document.removeEventListener("mousemove", this.boundOnMouseMove);
    }
    if (this.boundOnMouseUp) {
      document.removeEventListener("mouseup", this.boundOnMouseUp);
    }
  }
  static {
    this.ɵfac = function PaneComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PaneComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _PaneComponent,
      selectors: [["ng-flow-pane"]],
      hostAttrs: [1, "ng-flow__pane", "xy-flow__pane", "xy-flow__container", 2, "display", "block", "position", "absolute", "width", "100%", "height", "100%", "top", "0", "left", "0", "z-index", "1"],
      hostVars: 6,
      hostBindings: function PaneComponent_HostBindings(rf, ctx) {
        if (rf & 1) {
          ɵɵlistener("wheel", function PaneComponent_wheel_HostBindingHandler($event) {
            return ctx.onWheel($event);
          });
        }
        if (rf & 2) {
          ɵɵclassProp("draggable", ctx.panOnDrag())("dragging", ctx.store.paneDragging())("selection", ctx.store.userSelectionActive());
        }
      },
      inputs: {
        panOnDrag: [1, "panOnDrag"],
        selectionOnDrag: [1, "selectionOnDrag"],
        selectionKeyCode: [1, "selectionKeyCode"],
        selectionMode: [1, "selectionMode"]
      },
      outputs: {
        selectionStart: "selectionStart",
        selectionEnd: "selectionEnd",
        paneScroll: "paneScroll"
      },
      ngContentSelectors: _c03,
      decls: 1,
      vars: 0,
      template: function PaneComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PaneComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-pane",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__pane xy-flow__pane xy-flow__container",
        "style": "display: block; position: absolute; width: 100%; height: 100%; top: 0; left: 0; z-index: 1;",
        "[class.draggable]": "panOnDrag()",
        "[class.dragging]": "store.paneDragging()",
        "[class.selection]": "store.userSelectionActive()",
        "(wheel)": "onWheel($event)"
      },
      template: `<ng-content />`
    }]
  }], null, {
    panOnDrag: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "panOnDrag",
        required: false
      }]
    }],
    selectionOnDrag: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selectionOnDrag",
        required: false
      }]
    }],
    selectionKeyCode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selectionKeyCode",
        required: false
      }]
    }],
    selectionMode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selectionMode",
        required: false
      }]
    }],
    selectionStart: [{
      type: Output,
      args: ["selectionStart"]
    }],
    selectionEnd: [{
      type: Output,
      args: ["selectionEnd"]
    }],
    paneScroll: [{
      type: Output,
      args: ["paneScroll"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/connection-line/connection-line.component.js
function ConnectionLineComponent_Conditional_0_Conditional_0_ng_container_0_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementContainer(0);
  }
}
function ConnectionLineComponent_Conditional_0_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵtemplate(0, ConnectionLineComponent_Conditional_0_Conditional_0_ng_container_0_Template, 1, 0, "ng-container", 1);
  }
  if (rf & 2) {
    const ctx_r0 = ɵɵnextContext(2);
    ɵɵproperty("ngComponentOutlet", ctx_r0.customComponent())("ngComponentOutletInputs", ctx_r0.connectionProps());
  }
}
function ConnectionLineComponent_Conditional_0_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵelementStart(0, "svg", 0)(1, "g");
    ɵɵelement(2, "path", 2);
    ɵɵelementEnd()();
  }
  if (rf & 2) {
    const ctx_r0 = ɵɵnextContext(2);
    ɵɵadvance(2);
    ɵɵattribute("d", ctx_r0.connectionPath());
  }
}
function ConnectionLineComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵconditionalCreate(0, ConnectionLineComponent_Conditional_0_Conditional_0_Template, 1, 2, "ng-container")(1, ConnectionLineComponent_Conditional_0_Conditional_1_Template, 3, 1, ":svg:svg", 0);
  }
  if (rf & 2) {
    const ctx_r0 = ɵɵnextContext();
    ɵɵconditional(ctx_r0.customComponent() ? 0 : 1);
  }
}
var ConnectionLineComponent = class _ConnectionLineComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.customComponent = input(null, ...ngDevMode ? [{
      debugName: "customComponent"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionLineType = input(ConnectionLineType.Bezier, ...ngDevMode ? [{
      debugName: "connectionLineType"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isConnecting = computed(() => {
      this.store.version();
      const conn = this.store.connection();
      return conn?.inProgress ?? false;
    }, ...ngDevMode ? [{
      debugName: "isConnecting"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionProps = computed(() => {
      const coords = this.connectionCoords();
      if (!coords) return {};
      return {
        fromX: coords.fromX,
        fromY: coords.fromY,
        toX: coords.toX,
        toY: coords.toY,
        fromPosition: coords.fromPosition,
        toPosition: coords.toPosition,
        connectionLineType: this.connectionLineType(),
        fromNode: coords.fromNode,
        fromHandle: coords.fromHandle
      };
    }, ...ngDevMode ? [{
      debugName: "connectionProps"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionCoords = computed(() => {
      this.store.version();
      const conn = this.store.connection();
      if (!conn?.inProgress) return null;
      const activeConn = conn;
      const fromX = activeConn.from?.x ?? 0;
      const fromY = activeConn.from?.y ?? 0;
      const fromPosition = activeConn.fromPosition ?? Position.Bottom;
      const toScreenX = activeConn.to?.x ?? 0;
      const toScreenY = activeConn.to?.y ?? 0;
      const transform2 = this.store.transform();
      const toX = (toScreenX - transform2[0]) / transform2[2];
      const toY = (toScreenY - transform2[1]) / transform2[2];
      const toPosition = activeConn.toPosition ?? Position.Top;
      return {
        fromX,
        fromY,
        fromPosition,
        toX,
        toY,
        toPosition,
        fromNode: activeConn.fromNode ?? null,
        fromHandle: activeConn.fromHandle ?? null
      };
    }, ...ngDevMode ? [{
      debugName: "connectionCoords"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionPath = computed(() => {
      const coords = this.connectionCoords();
      if (!coords) return "";
      const params = {
        sourceX: coords.fromX,
        sourceY: coords.fromY,
        targetX: coords.toX,
        targetY: coords.toY,
        sourcePosition: coords.fromPosition,
        targetPosition: coords.toPosition
      };
      const lineType = this.connectionLineType();
      switch (lineType) {
        case ConnectionLineType.Straight:
          return getStraightPath(params)[0];
        case ConnectionLineType.Step:
          return getSmoothStepPath(__spreadProps(__spreadValues({}, params), {
            borderRadius: 0
          }))[0];
        case ConnectionLineType.SmoothStep:
          return getSmoothStepPath(params)[0];
        case ConnectionLineType.Bezier:
        default:
          return getBezierPath(params)[0];
      }
    }, ...ngDevMode ? [{
      debugName: "connectionPath"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function ConnectionLineComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _ConnectionLineComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _ConnectionLineComponent,
      selectors: [["ng-flow-connection-line"]],
      hostAttrs: [2, "display", "contents"],
      inputs: {
        customComponent: [1, "customComponent"],
        connectionLineType: [1, "connectionLineType"]
      },
      decls: 1,
      vars: 1,
      consts: [[1, "ng-flow__connectionline", "xy-flow__connectionline", 2, "overflow", "visible", "position", "absolute", "width", "100%", "height", "100%", "pointer-events", "none"], [4, "ngComponentOutlet", "ngComponentOutletInputs"], ["fill", "none", 1, "ng-flow__connection-path", "xy-flow__connection-path"]],
      template: function ConnectionLineComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵconditionalCreate(0, ConnectionLineComponent_Conditional_0_Template, 2, 1);
        }
        if (rf & 2) {
          ɵɵconditional(ctx.isConnecting() ? 0 : -1);
        }
      },
      dependencies: [CommonModule, NgComponentOutlet],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ConnectionLineComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-connection-line",
      standalone: true,
      imports: [CommonModule, NgComponentOutlet],
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "style": "display: contents;"
      },
      template: `
    @if (isConnecting()) {
      @if (customComponent()) {
        <ng-container
          *ngComponentOutlet="customComponent(); inputs: connectionProps()"
        />
      } @else {
        <svg class="ng-flow__connectionline xy-flow__connectionline"
             style="overflow: visible; position: absolute; width: 100%; height: 100%; pointer-events: none;">
          <g>
            <path
              class="ng-flow__connection-path xy-flow__connection-path"
              [attr.d]="connectionPath()"
              fill="none"
            />
          </g>
        </svg>
      }
    }
  `
    }]
  }], null, {
    customComponent: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "customComponent",
        required: false
      }]
    }],
    connectionLineType: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "connectionLineType",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/selection-box/selection-box.component.js
function SelectionBoxComponent_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = ɵɵgetCurrentView();
    ɵɵdomElementStart(0, "div", 2);
    ɵɵdomListener("contextmenu", function SelectionBoxComponent_Conditional_0_Template_div_contextmenu_0_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onContextMenu($event));
    });
    ɵɵdomElementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = ɵɵnextContext();
    ɵɵstyleProp("left", ctx_r1.rect().x, "px")("top", ctx_r1.rect().y, "px")("width", ctx_r1.rect().width, "px")("height", ctx_r1.rect().height, "px");
  }
}
function SelectionBoxComponent_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = ɵɵgetCurrentView();
    ɵɵdomElementStart(0, "div", 3);
    ɵɵdomListener("contextmenu", function SelectionBoxComponent_Conditional_1_Template_div_contextmenu_0_listener($event) {
      ɵɵrestoreView(_r3);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onContextMenu($event));
    });
    ɵɵdomElementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = ɵɵnextContext();
    ɵɵstyleProp("transform", ctx_r1.nodesSelectionTransform())("width", ctx_r1.nodesSelectionBounds().width, "px")("height", ctx_r1.nodesSelectionBounds().height, "px");
  }
}
var SelectionBoxComponent = class _SelectionBoxComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.contextMenu = output();
    this.isVisible = computed(() => this.store.userSelectionActive() && this.store.userSelectionRect() !== null, ...ngDevMode ? [{
      debugName: "isVisible"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.rect = computed(() => this.store.userSelectionRect(), ...ngDevMode ? [{
      debugName: "rect"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesSelectionBounds = computed(() => {
      this.store.version();
      const selected = this.store.selectedNodes();
      if (selected.length === 0) return {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of selected) {
        const internal = this.store.nodeLookup.get(node.id);
        const x = internal?.internals?.positionAbsolute?.x ?? node.position.x;
        const y = internal?.internals?.positionAbsolute?.y ?? node.position.y;
        const w = internal?.measured?.width ?? node.width ?? 150;
        const h = internal?.measured?.height ?? node.height ?? 40;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      }
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }, ...ngDevMode ? [{
      debugName: "nodesSelectionBounds"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesSelectionTransform = computed(() => {
      const b = this.nodesSelectionBounds();
      return `translate(${b.x}px, ${b.y}px)`;
    }, ...ngDevMode ? [{
      debugName: "nodesSelectionTransform"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  onContextMenu(event) {
    event.preventDefault();
    this.contextMenu.emit(event);
  }
  static {
    this.ɵfac = function SelectionBoxComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _SelectionBoxComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _SelectionBoxComponent,
      selectors: [["ng-flow-selection-box"]],
      hostAttrs: [2, "display", "contents"],
      outputs: {
        contextMenu: "contextMenu"
      },
      decls: 2,
      vars: 2,
      consts: [[1, "ng-flow__selection", "xy-flow__selection", 2, "position", "absolute", "pointer-events", "all", "z-index", "10", 3, "left", "top", "width", "height"], [1, "ng-flow__selection", "ng-flow__nodesselection", "xy-flow__selection", "xy-flow__nodesselection", 2, "position", "absolute", "pointer-events", "all", "z-index", "10", "transform-origin", "left top", 3, "transform", "width", "height"], [1, "ng-flow__selection", "xy-flow__selection", 2, "position", "absolute", "pointer-events", "all", "z-index", "10", 3, "contextmenu"], [1, "ng-flow__selection", "ng-flow__nodesselection", "xy-flow__selection", "xy-flow__nodesselection", 2, "position", "absolute", "pointer-events", "all", "z-index", "10", "transform-origin", "left top", 3, "contextmenu"]],
      template: function SelectionBoxComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵconditionalCreate(0, SelectionBoxComponent_Conditional_0_Template, 1, 8, "div", 0);
          ɵɵconditionalCreate(1, SelectionBoxComponent_Conditional_1_Template, 1, 6, "div", 1);
        }
        if (rf & 2) {
          ɵɵconditional(ctx.isVisible() ? 0 : -1);
          ɵɵadvance();
          ɵɵconditional(ctx.store.nodesSelectionActive() ? 1 : -1);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(SelectionBoxComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-selection-box",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "style": "display: contents;"
      },
      template: `
    @if (isVisible()) {
      <div
        class="ng-flow__selection xy-flow__selection"
        style="position: absolute; pointer-events: all; z-index: 10;"
        [style.left.px]="rect()!.x"
        [style.top.px]="rect()!.y"
        [style.width.px]="rect()!.width"
        [style.height.px]="rect()!.height"
        (contextmenu)="onContextMenu($event)"
      ></div>
    }
    @if (store.nodesSelectionActive()) {
      <div
        class="ng-flow__selection ng-flow__nodesselection xy-flow__selection xy-flow__nodesselection"
        style="position: absolute; pointer-events: all; z-index: 10; transform-origin: left top;"
        [style.transform]="nodesSelectionTransform()"
        [style.width.px]="nodesSelectionBounds().width"
        [style.height.px]="nodesSelectionBounds().height"
        (contextmenu)="onContextMenu($event)"
      ></div>
    }
  `
    }]
  }], null, {
    contextMenu: [{
      type: Output,
      args: ["contextMenu"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/a11y-descriptions/a11y-descriptions.component.js
var A11yDescriptionsComponent = class _A11yDescriptionsComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.config = this.store.ariaLabelConfig;
  }
  get rfId() {
    return this.store.rfId();
  }
  static {
    this.ɵfac = function A11yDescriptionsComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _A11yDescriptionsComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _A11yDescriptionsComponent,
      selectors: [["ng-flow-a11y-descriptions"]],
      hostAttrs: [2, "position", "absolute", "width", "1px", "height", "1px", "margin", "-1px", "padding", "0", "overflow", "hidden", "clip", "rect(0,0,0,0)", "border", "0"],
      decls: 6,
      vars: 5,
      consts: [[1, "xy-flow__sr-only", 3, "id"]],
      template: function A11yDescriptionsComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵdomElementStart(0, "div", 0);
          ɵɵtext(1);
          ɵɵdomElementEnd();
          ɵɵdomElementStart(2, "div", 0);
          ɵɵtext(3);
          ɵɵdomElementEnd();
          ɵɵdomElementStart(4, "div", 0);
          ɵɵtext(5, " Edge connection ");
          ɵɵdomElementEnd();
        }
        if (rf & 2) {
          ɵɵdomProperty("id", ctx.rfId + "-node-desc");
          ɵɵadvance();
          ɵɵtextInterpolate1(" ", ctx.config()["node.a11yDescription.default"], " ");
          ɵɵadvance();
          ɵɵdomProperty("id", ctx.rfId + "-handle-desc");
          ɵɵadvance();
          ɵɵtextInterpolate1(" ", ctx.config()["handle.ariaLabel"], " ");
          ɵɵadvance();
          ɵɵdomProperty("id", ctx.rfId + "-edge-desc");
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(A11yDescriptionsComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-a11y-descriptions",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <div [id]="rfId + '-node-desc'" class="xy-flow__sr-only">
      {{ config()['node.a11yDescription.default'] }}
    </div>
    <div [id]="rfId + '-handle-desc'" class="xy-flow__sr-only">
      {{ config()['handle.ariaLabel'] }}
    </div>
    <div [id]="rfId + '-edge-desc'" class="xy-flow__sr-only">
      Edge connection
    </div>
  `,
      host: {
        "style": "position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); border: 0;"
      }
    }]
  }], null, null);
})();

// ../../packages/angular/dist/esm/lib/components/panel/panel.component.js
var _c04 = ["*"];
var PanelComponent = class _PanelComponent {
  constructor() {
    this.position = input("top-left", ...ngDevMode ? [{
      debugName: "position"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isTop = computed(() => this.position().includes("top"), ...ngDevMode ? [{
      debugName: "isTop"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isBottom = computed(() => this.position().includes("bottom"), ...ngDevMode ? [{
      debugName: "isBottom"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isLeft = computed(() => this.position().includes("left"), ...ngDevMode ? [{
      debugName: "isLeft"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isRight = computed(() => this.position().includes("right"), ...ngDevMode ? [{
      debugName: "isRight"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isCenter = computed(() => this.position().includes("center"), ...ngDevMode ? [{
      debugName: "isCenter"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function PanelComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _PanelComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _PanelComponent,
      selectors: [["ng-flow-panel"]],
      hostAttrs: [1, "ng-flow__panel", "xy-flow__panel"],
      hostVars: 10,
      hostBindings: function PanelComponent_HostBindings(rf, ctx) {
        if (rf & 2) {
          ɵɵclassProp("top", ctx.isTop())("bottom", ctx.isBottom())("left", ctx.isLeft())("right", ctx.isRight())("center", ctx.isCenter());
        }
      },
      inputs: {
        position: [1, "position"]
      },
      ngContentSelectors: _c04,
      decls: 1,
      vars: 0,
      template: function PanelComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PanelComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-panel",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__panel xy-flow__panel",
        "[class.top]": "isTop()",
        "[class.bottom]": "isBottom()",
        "[class.left]": "isLeft()",
        "[class.right]": "isRight()",
        "[class.center]": "isCenter()"
      },
      template: `<ng-content />`
    }]
  }], null, {
    position: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "position",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/attribution/attribution.component.js
var AttributionComponent = class _AttributionComponent {
  static {
    this.ɵfac = function AttributionComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _AttributionComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _AttributionComponent,
      selectors: [["ng-flow-attribution"]],
      decls: 3,
      vars: 0,
      consts: [["position", "bottom-right"], [1, "ng-flow__attribution", "xy-flow__attribution", 2, "font-size", "10px", "color", "#999", "pointer-events", "all"]],
      template: function AttributionComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelementStart(0, "ng-flow-panel", 0)(1, "span", 1);
          ɵɵtext(2, " angflow ");
          ɵɵelementEnd()();
        }
      },
      dependencies: [PanelComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(AttributionComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-attribution",
      standalone: true,
      imports: [PanelComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <ng-flow-panel position="bottom-right">
      <span
        class="ng-flow__attribution xy-flow__attribution"
        style="font-size: 10px; color: #999; pointer-events: all;"
      >
        angflow
      </span>
    </ng-flow-panel>
  `
    }]
  }], null, null);
})();

// ../../packages/angular/dist/esm/lib/directives/key-handler.directive.js
var KeyHandlerDirective = class _KeyHandlerDirective {
  constructor() {
    this.store = inject(FlowStore);
    this.deleteKeyCode = input(["Backspace", "Delete"], ...ngDevMode ? [{
      debugName: "deleteKeyCode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectionKeyCode = input("Shift", ...ngDevMode ? [{
      debugName: "selectionKeyCode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.multiSelectionKeyCode = input("Meta", ...ngDevMode ? [{
      debugName: "multiSelectionKeyCode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.disableKeyboardA11y = input(false, ...ngDevMode ? [{
      debugName: "disableKeyboardA11y"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesDelete = output();
    this.edgesDelete = output();
    this.deleteElements = output();
    this.selectionKeyPressed = false;
    this.multiSelectionKeyPressed = false;
  }
  ngOnInit() {
  }
  ngOnDestroy() {
  }
  onKeyDown(event) {
    if (isInputDOMNode(event)) return;
    if (this.matchesKey(event.key, this.selectionKeyCode())) {
      this.selectionKeyPressed = true;
      this.store.selectionKeyActive.set(true);
    }
    if (this.matchesKey(event.key, this.multiSelectionKeyCode())) {
      this.multiSelectionKeyPressed = true;
      this.store.multiSelectionActive.set(true);
    }
    if (this.matchesKey(event.key, this.deleteKeyCode())) {
      this.handleDelete();
    }
    if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.handleSelectAll();
    }
    if (event.key === "Escape") {
      this.store.unselectNodesAndEdges();
      this.store.connectionClickStartHandle.set(null);
    }
    if (!this.disableKeyboardA11y() && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      this.handleArrowKey(event);
    }
  }
  onKeyUp(event) {
    if (this.matchesKey(event.key, this.selectionKeyCode())) {
      this.selectionKeyPressed = false;
      this.store.selectionKeyActive.set(false);
    }
    if (this.matchesKey(event.key, this.multiSelectionKeyCode())) {
      this.multiSelectionKeyPressed = false;
      this.store.multiSelectionActive.set(false);
    }
  }
  handleDelete() {
    const selectedNodes = this.store.selectedNodes();
    const selectedEdges = this.store.selectedEdges();
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    const deletableNodes = selectedNodes.filter((n) => n.deletable !== false);
    const deletableEdges = selectedEdges.filter((e) => e.deletable !== false);
    const nodeIds = new Set(deletableNodes.map((n) => n.id));
    const connectedEdges = this.store.edges().filter((e) => (nodeIds.has(e.source) || nodeIds.has(e.target)) && e.deletable !== false);
    const allEdgesToDelete = [...deletableEdges, ...connectedEdges.filter((e) => !deletableEdges.some((se) => se.id === e.id))];
    if (deletableNodes.length === 0 && allEdgesToDelete.length === 0) return;
    const performDelete = () => {
      if (deletableNodes.length > 0) {
        this.nodesDelete.emit(deletableNodes);
      }
      if (allEdgesToDelete.length > 0) {
        this.edgesDelete.emit(allEdgesToDelete);
      }
      this.deleteElements.emit({
        nodes: deletableNodes,
        edges: allEdgesToDelete
      });
      const nodeChanges = deletableNodes.map((n) => elementToRemoveChange(n));
      const edgeChanges = allEdgesToDelete.map((e) => elementToRemoveChange(e));
      this.store.triggerNodeChanges(nodeChanges);
      this.store.triggerEdgeChanges(edgeChanges);
    };
    const beforeDelete = this.store.onBeforeDelete;
    if (beforeDelete) {
      const result = beforeDelete({
        nodes: deletableNodes,
        edges: allEdgesToDelete
      });
      if (result instanceof Promise) {
        result.then((allowed) => {
          if (allowed) performDelete();
        });
      } else if (result) {
        performDelete();
      }
    } else {
      performDelete();
    }
  }
  handleSelectAll() {
    const nodeChanges = this.store.nodes().map((n) => ({
      id: n.id,
      type: "select",
      selected: true
    }));
    const edgeChanges = this.store.edges().map((e) => ({
      id: e.id,
      type: "select",
      selected: true
    }));
    this.store.triggerNodeChanges(nodeChanges);
    this.store.triggerEdgeChanges(edgeChanges);
  }
  handleArrowKey(event) {
    const selectedNodes = this.store.selectedNodes();
    if (selectedNodes.length === 0) return;
    event.preventDefault();
    const step = this.store.snapToGrid() ? this.store.snapGrid()[0] : 1;
    let dx = 0, dy = 0;
    switch (event.key) {
      case "ArrowUp":
        dy = -step;
        break;
      case "ArrowDown":
        dy = step;
        break;
      case "ArrowLeft":
        dx = -step;
        break;
      case "ArrowRight":
        dx = step;
        break;
    }
    const changes = selectedNodes.map((node) => ({
      id: node.id,
      type: "position",
      position: {
        x: node.position.x + dx,
        y: node.position.y + dy
      }
    }));
    this.store.triggerNodeChanges(changes);
  }
  matchesKey(eventKey, keyCode) {
    if (keyCode === null) return false;
    if (Array.isArray(keyCode)) return keyCode.includes(eventKey);
    return eventKey === keyCode;
  }
  static {
    this.ɵfac = function KeyHandlerDirective_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _KeyHandlerDirective)();
    };
  }
  static {
    this.ɵdir = ɵɵdefineDirective({
      type: _KeyHandlerDirective,
      selectors: [["", "ngFlowKeyHandler", ""]],
      hostBindings: function KeyHandlerDirective_HostBindings(rf, ctx) {
        if (rf & 1) {
          ɵɵlistener("keydown", function KeyHandlerDirective_keydown_HostBindingHandler($event) {
            return ctx.onKeyDown($event);
          }, ɵɵresolveDocument)("keyup", function KeyHandlerDirective_keyup_HostBindingHandler($event) {
            return ctx.onKeyUp($event);
          }, ɵɵresolveDocument);
        }
      },
      inputs: {
        deleteKeyCode: [1, "deleteKeyCode"],
        selectionKeyCode: [1, "selectionKeyCode"],
        multiSelectionKeyCode: [1, "multiSelectionKeyCode"],
        disableKeyboardA11y: [1, "disableKeyboardA11y"]
      },
      outputs: {
        nodesDelete: "nodesDelete",
        edgesDelete: "edgesDelete",
        deleteElements: "deleteElements"
      }
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(KeyHandlerDirective, [{
    type: Directive,
    args: [{
      selector: "[ngFlowKeyHandler]",
      standalone: true,
      host: {
        "(document:keydown)": "onKeyDown($event)",
        "(document:keyup)": "onKeyUp($event)"
      }
    }]
  }], null, {
    deleteKeyCode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "deleteKeyCode",
        required: false
      }]
    }],
    selectionKeyCode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selectionKeyCode",
        required: false
      }]
    }],
    multiSelectionKeyCode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "multiSelectionKeyCode",
        required: false
      }]
    }],
    disableKeyboardA11y: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "disableKeyboardA11y",
        required: false
      }]
    }],
    nodesDelete: [{
      type: Output,
      args: ["nodesDelete"]
    }],
    edgesDelete: [{
      type: Output,
      args: ["edgesDelete"]
    }],
    deleteElements: [{
      type: Output,
      args: ["deleteElements"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/directives/node-type.directive.js
var NgFlowNodeTypeDirective = class _NgFlowNodeTypeDirective {
  constructor() {
    this.template = inject(TemplateRef);
  }
  static {
    this.ɵfac = function NgFlowNodeTypeDirective_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NgFlowNodeTypeDirective)();
    };
  }
  static {
    this.ɵdir = ɵɵdefineDirective({
      type: _NgFlowNodeTypeDirective,
      selectors: [["", "ngFlowNodeType", ""]],
      inputs: {
        type: [0, "ngFlowNodeType", "type"]
      }
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgFlowNodeTypeDirective, [{
    type: Directive,
    args: [{
      selector: "[ngFlowNodeType]",
      standalone: true
    }]
  }], null, {
    type: [{
      type: Input,
      args: [{
        required: true,
        alias: "ngFlowNodeType"
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/container/ng-flow/ng-flow.component.js
var _c05 = ["container"];
var _c1 = ["*"];
function NgFlowComponent_Conditional_10_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "ng-flow-attribution");
  }
}
var NgFlowComponent = class _NgFlowComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.ngFlowService = inject(NgFlowService);
    this.zone = inject(NgZone);
    this.containerRef = viewChild("container", ...ngDevMode ? [{
      debugName: "containerRef"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.paneRef = viewChild(PaneComponent, ...ngDevMode ? [{
      debugName: "paneRef"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeTypeDirectives = contentChildren(NgFlowNodeTypeDirective, ...ngDevMode ? [{
      debugName: "nodeTypeDirectives"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeTemplateMap = computed(() => {
      const map = /* @__PURE__ */ new Map();
      for (const dir of this.nodeTypeDirectives()) {
        map.set(dir.type, dir.template);
      }
      return map;
    }, ...ngDevMode ? [{
      debugName: "nodeTemplateMap"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.resizeObserver = null;
    this.panZoomInstance = null;
    this.colorSchemeQuery = null;
    this.colorSchemeHandler = null;
    this.systemPrefersDark = signal(typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false, ...ngDevMode ? [{
      debugName: "systemPrefersDark"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.resolvedColorMode = computed(() => {
      const mode = this.colorMode();
      if (mode === "system") {
        return this.systemPrefersDark() ? "dark" : "light";
      }
      return mode;
    }, ...ngDevMode ? [{
      debugName: "resolvedColorMode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesModel = model([], __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "nodesModel"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "nodes"
    }));
    this.edgesModel = model([], __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "edgesModel"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "edges"
    }));
    this.viewportModel = model(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "viewportModel"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "viewport"
    }));
    this.defaultNodes = input(...ngDevMode ? [void 0, {
      debugName: "defaultNodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.defaultEdges = input(...ngDevMode ? [void 0, {
      debugName: "defaultEdges"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.defaultViewport = input({
      x: 0,
      y: 0,
      zoom: 1
    }, ...ngDevMode ? [{
      debugName: "defaultViewport"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeTypes = input({}, ...ngDevMode ? [{
      debugName: "nodeTypes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgeTypes = input({}, ...ngDevMode ? [{
      debugName: "edgeTypes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.defaultEdgeOptions = input(...ngDevMode ? [void 0, {
      debugName: "defaultEdgeOptions"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionMode = input(ConnectionMode.Strict, ...ngDevMode ? [{
      debugName: "connectionMode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionLineType = input(ConnectionLineType.Bezier, ...ngDevMode ? [{
      debugName: "connectionLineType"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionLineComponent = input(null, ...ngDevMode ? [{
      debugName: "connectionLineComponent"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionLineStyle = input(...ngDevMode ? [void 0, {
      debugName: "connectionLineStyle"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionLineContainerStyle = input(...ngDevMode ? [void 0, {
      debugName: "connectionLineContainerStyle"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.widthInput = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "widthInput"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "width"
    }));
    this.heightInput = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "heightInput"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "height"
    }));
    this.nodesDraggable = input(true, ...ngDevMode ? [{
      debugName: "nodesDraggable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesConnectable = input(true, ...ngDevMode ? [{
      debugName: "nodesConnectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesFocusable = input(true, ...ngDevMode ? [{
      debugName: "nodesFocusable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgesFocusable = input(true, ...ngDevMode ? [{
      debugName: "edgesFocusable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.edgesReconnectable = input(true, ...ngDevMode ? [{
      debugName: "edgesReconnectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.elementsSelectable = input(true, ...ngDevMode ? [{
      debugName: "elementsSelectable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectNodesOnDrag = input(true, ...ngDevMode ? [{
      debugName: "selectNodesOnDrag"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectOnClick = input(true, ...ngDevMode ? [{
      debugName: "connectOnClick"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.panOnDrag = input(true, ...ngDevMode ? [{
      debugName: "panOnDrag"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.panOnScroll = input(false, ...ngDevMode ? [{
      debugName: "panOnScroll"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.panOnScrollMode = input(PanOnScrollMode.Free, ...ngDevMode ? [{
      debugName: "panOnScrollMode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.panOnScrollSpeed = input(0.5, ...ngDevMode ? [{
      debugName: "panOnScrollSpeed"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zoomOnScroll = input(true, ...ngDevMode ? [{
      debugName: "zoomOnScroll"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zoomOnPinch = input(true, ...ngDevMode ? [{
      debugName: "zoomOnPinch"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zoomOnDoubleClick = input(true, ...ngDevMode ? [{
      debugName: "zoomOnDoubleClick"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.preventScrolling = input(true, ...ngDevMode ? [{
      debugName: "preventScrolling"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectionOnDrag = input(false, ...ngDevMode ? [{
      debugName: "selectionOnDrag"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectionMode = input(SelectionMode.Full, ...ngDevMode ? [{
      debugName: "selectionMode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.minZoom = input(0.5, ...ngDevMode ? [{
      debugName: "minZoom"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.maxZoom = input(2, ...ngDevMode ? [{
      debugName: "maxZoom"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.translateExtent = input(infiniteExtent, ...ngDevMode ? [{
      debugName: "translateExtent"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeExtent = input(infiniteExtent, ...ngDevMode ? [{
      debugName: "nodeExtent"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.snapToGrid = input(false, ...ngDevMode ? [{
      debugName: "snapToGrid"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.snapGrid = input([15, 15], ...ngDevMode ? [{
      debugName: "snapGrid"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.fitView = input(false, ...ngDevMode ? [{
      debugName: "fitView"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.fitViewOptions = input(...ngDevMode ? [void 0, {
      debugName: "fitViewOptions"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.deleteKeyCode = input(["Backspace", "Delete"], ...ngDevMode ? [{
      debugName: "deleteKeyCode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.selectionKeyCode = input("Shift", ...ngDevMode ? [{
      debugName: "selectionKeyCode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.panActivationKeyCode = input(" ", ...ngDevMode ? [{
      debugName: "panActivationKeyCode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.multiSelectionKeyCode = input(["Meta", "Control"], ...ngDevMode ? [{
      debugName: "multiSelectionKeyCode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zoomActivationKeyCode = input("Meta", ...ngDevMode ? [{
      debugName: "zoomActivationKeyCode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.autoPanOnNodeDrag = input(true, ...ngDevMode ? [{
      debugName: "autoPanOnNodeDrag"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.autoPanOnConnect = input(true, ...ngDevMode ? [{
      debugName: "autoPanOnConnect"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.autoPanSpeed = input(15, ...ngDevMode ? [{
      debugName: "autoPanSpeed"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionRadius = input(20, ...ngDevMode ? [{
      debugName: "connectionRadius"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.reconnectRadius = input(10, ...ngDevMode ? [{
      debugName: "reconnectRadius"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeDragThreshold = input(1, ...ngDevMode ? [{
      debugName: "nodeDragThreshold"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.connectionDragThreshold = input(1, ...ngDevMode ? [{
      debugName: "connectionDragThreshold"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.paneClickDistance = input(0, ...ngDevMode ? [{
      debugName: "paneClickDistance"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeClickDistance = input(0, ...ngDevMode ? [{
      debugName: "nodeClickDistance"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.colorMode = input("light", ...ngDevMode ? [{
      debugName: "colorMode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.elevateNodesOnSelect = input(true, ...ngDevMode ? [{
      debugName: "elevateNodesOnSelect"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.elevateEdgesOnSelect = input(false, ...ngDevMode ? [{
      debugName: "elevateEdgesOnSelect"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.onlyRenderVisibleElements = input(false, ...ngDevMode ? [{
      debugName: "onlyRenderVisibleElements"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zIndexMode = input("basic", ...ngDevMode ? [{
      debugName: "zIndexMode"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeOrigin = input([0, 0], ...ngDevMode ? [{
      debugName: "nodeOrigin"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.defaultMarkerColor = input("#b1b1b7", ...ngDevMode ? [{
      debugName: "defaultMarkerColor"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.noDragClassName = input("nodrag", ...ngDevMode ? [{
      debugName: "noDragClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.noWheelClassName = input("nowheel", ...ngDevMode ? [{
      debugName: "noWheelClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.noPanClassName = input("nopan", ...ngDevMode ? [{
      debugName: "noPanClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.disableKeyboardA11y = input(false, ...ngDevMode ? [{
      debugName: "disableKeyboardA11y"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.ariaLabelConfig = input(...ngDevMode ? [void 0, {
      debugName: "ariaLabelConfig"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isValidConnection = input(...ngDevMode ? [void 0, {
      debugName: "isValidConnection"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.proOptions = input(...ngDevMode ? [void 0, {
      debugName: "proOptions"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.attributionPosition = input("bottom-right", ...ngDevMode ? [{
      debugName: "attributionPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.hideAttribution = input(false, ...ngDevMode ? [{
      debugName: "hideAttribution"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.flowId = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "flowId"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "id"
    }));
    this.debug = input(false, ...ngDevMode ? [{
      debugName: "debug"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodesChange = output({
      alias: "nodesChange"
    });
    this.edgesChange = output({
      alias: "edgesChange"
    });
    this.init = output({
      alias: "init"
    });
    this.nodeClick = output({
      alias: "nodeClick"
    });
    this.nodeDoubleClick = output({
      alias: "nodeDoubleClick"
    });
    this.nodeMouseEnter = output({
      alias: "nodeMouseEnter"
    });
    this.nodeMouseMove = output({
      alias: "nodeMouseMove"
    });
    this.nodeMouseLeave = output({
      alias: "nodeMouseLeave"
    });
    this.nodeContextMenu = output({
      alias: "nodeContextMenu"
    });
    this.nodeDragStart = output({
      alias: "nodeDragStart"
    });
    this.nodeDrag = output({
      alias: "nodeDrag"
    });
    this.nodeDragStop = output({
      alias: "nodeDragStop"
    });
    this.edgeClick = output({
      alias: "edgeClick"
    });
    this.edgeDoubleClick = output({
      alias: "edgeDoubleClick"
    });
    this.edgeContextMenu = output({
      alias: "edgeContextMenu"
    });
    this.edgeMouseEnter = output({
      alias: "edgeMouseEnter"
    });
    this.edgeMouseMove = output({
      alias: "edgeMouseMove"
    });
    this.edgeMouseLeave = output({
      alias: "edgeMouseLeave"
    });
    this.connect = output({
      alias: "connect"
    });
    this.connectStart = output({
      alias: "connectStart"
    });
    this.connectEnd = output({
      alias: "connectEnd"
    });
    this.clickConnectStart = output({
      alias: "clickConnectStart"
    });
    this.clickConnectEnd = output({
      alias: "clickConnectEnd"
    });
    this.reconnect = output({
      alias: "reconnect"
    });
    this.reconnectStart = output({
      alias: "reconnectStart"
    });
    this.reconnectEnd = output({
      alias: "reconnectEnd"
    });
    this.paneClick = output({
      alias: "paneClick"
    });
    this.paneContextMenu = output({
      alias: "paneContextMenu"
    });
    this.paneMouseEnter = output({
      alias: "paneMouseEnter"
    });
    this.paneMouseMove = output({
      alias: "paneMouseMove"
    });
    this.paneMouseLeave = output({
      alias: "paneMouseLeave"
    });
    this.paneScroll = output({
      alias: "paneScroll"
    });
    this.moveStart = output({
      alias: "moveStart"
    });
    this.move = output({
      alias: "move"
    });
    this.moveEnd = output({
      alias: "moveEnd"
    });
    this.viewportChange = output({
      alias: "viewportChange"
    });
    this.selectionChange = output({
      alias: "selectionChange"
    });
    this.selectionDragStart = output({
      alias: "selectionDragStart"
    });
    this.selectionDrag = output({
      alias: "selectionDrag"
    });
    this.selectionDragStop = output({
      alias: "selectionDragStop"
    });
    this.selectionStart = output({
      alias: "selectionStart"
    });
    this.selectionEnd = output({
      alias: "selectionEnd"
    });
    this.selectionContextMenu = output({
      alias: "selectionContextMenu"
    });
    this.nodesDelete = output({
      alias: "nodesDelete"
    });
    this.edgesDelete = output({
      alias: "edgesDelete"
    });
    this.deleteEvent = output({
      alias: "delete"
    });
    this.onBeforeDelete = input(void 0, ...ngDevMode ? [{
      debugName: "onBeforeDelete"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.error = output({
      alias: "error"
    });
    this.autoPanStart = output({
      alias: "autoPanStart"
    });
    this.autoPanEnd = output({
      alias: "autoPanEnd"
    });
    this.lastNodesRef = null;
    this.lastEdgesRef = null;
    this.panePointerDownPos = null;
    effect(() => {
      const nodes = this.nodesModel();
      if (nodes !== void 0 && nodes !== this.lastNodesRef) {
        this.lastNodesRef = nodes;
        this.store.setNodes(nodes);
      }
    });
    effect(() => {
      const edges = this.edgesModel();
      if (edges !== void 0 && edges !== this.lastEdgesRef) {
        this.lastEdgesRef = edges;
        this.store.setEdges(edges);
      }
    });
    effect(() => {
      this.store.nodesDraggable.set(this.nodesDraggable());
      this.store.nodesConnectable.set(this.nodesConnectable());
      this.store.nodesFocusable.set(this.nodesFocusable());
      this.store.edgesFocusable.set(this.edgesFocusable());
      this.store.edgesReconnectable.set(this.edgesReconnectable());
      this.store.elementsSelectable.set(this.elementsSelectable());
      this.store.selectNodesOnDrag.set(this.selectNodesOnDrag());
      this.store.connectOnClick.set(this.connectOnClick());
      this.store.connectionMode.set(this.connectionMode());
      this.store.snapToGrid.set(this.snapToGrid());
      this.store.snapGrid.set(this.snapGrid());
      this.store.nodeOrigin.set(this.nodeOrigin());
      this.store.nodeExtent.set(this.nodeExtent());
      this.store.elevateNodesOnSelect.set(this.elevateNodesOnSelect());
      this.store.elevateEdgesOnSelect.set(this.elevateEdgesOnSelect());
      this.store.connectionRadius.set(this.connectionRadius());
      this.store.connectionDragThreshold.set(this.connectionDragThreshold());
      this.store.nodeDragThreshold.set(this.nodeDragThreshold());
      this.store.paneClickDistance.set(this.paneClickDistance());
      this.store.nodeClickDistance.set(this.nodeClickDistance());
      this.store.autoPanOnConnect.set(this.autoPanOnConnect());
      this.store.autoPanOnNodeDrag.set(this.autoPanOnNodeDrag());
      this.store.autoPanSpeed.set(this.autoPanSpeed());
      this.store.noDragClassName.set(this.noDragClassName());
      this.store.noWheelClassName.set(this.noWheelClassName());
      this.store.noPanClassName.set(this.noPanClassName());
      this.store.debug.set(this.debug());
      this.store.zIndexMode.set(this.zIndexMode());
      this.store.onlyRenderVisibleElements.set(this.onlyRenderVisibleElements());
    });
    effect(() => {
      const id = this.flowId();
      if (id !== void 0) {
        this.store.rfId.set(id);
      }
    });
    effect(() => {
      const opts = this.defaultEdgeOptions();
      if (opts !== void 0) {
        this.store.defaultEdgeOptions.set(opts);
      }
    });
    effect(() => {
      const isValid = this.isValidConnection();
      this.store.isValidConnection.set(isValid);
    });
    effect(() => {
      this.store.onBeforeDelete = this.onBeforeDelete() ?? null;
    });
    effect(() => {
      this.store.setMinZoom(this.minZoom());
    });
    effect(() => {
      this.store.setMaxZoom(this.maxZoom());
    });
    effect(() => {
      this.store.setTranslateExtent(this.translateExtent());
    });
    effect(() => {
      this.panOnDrag();
      this.panOnScroll();
      this.panOnScrollMode();
      this.panOnScrollSpeed();
      this.zoomOnScroll();
      this.zoomOnPinch();
      this.zoomOnDoubleClick();
      this.preventScrolling();
      this.noPanClassName();
      this.noWheelClassName();
      this.paneClickDistance();
      this.updatePanZoomOptions();
    });
    this.store.onNodesChange = (changes) => {
      this.nodesChange.emit(changes);
    };
    this.store.onEdgesChange = (changes) => {
      this.edgesChange.emit(changes);
    };
    this.store.onConnect = (connection) => {
      this.connect.emit(connection);
    };
    this.store.onConnectStart = (event, params) => {
      this.connectStart.emit({
        event,
        params
      });
    };
    this.store.onConnectEnd = (event) => {
      this.connectEnd.emit(event);
    };
    this.store.onClickConnectStart = (event, params) => {
      this.clickConnectStart.emit({
        event,
        params
      });
    };
    this.store.onClickConnectEnd = (event) => {
      this.clickConnectEnd.emit(event);
    };
    this.store.onNodeDragStart = (event, node, nodes) => {
      this.nodeDragStart.emit({
        event,
        node,
        nodes
      });
    };
    this.store.onNodeDrag = (event, node, nodes) => {
      this.nodeDrag.emit({
        event,
        node,
        nodes
      });
    };
    this.store.onNodeDragStop = (event, node, nodes) => {
      this.nodeDragStop.emit({
        event,
        node,
        nodes
      });
    };
    this.store.onSelectionDragStart = (event, nodes) => {
      this.selectionDragStart.emit({
        event,
        nodes
      });
    };
    this.store.onSelectionDrag = (event, nodes) => {
      this.selectionDrag.emit({
        event,
        nodes
      });
    };
    this.store.onSelectionDragStop = (event, nodes) => {
      this.selectionDragStop.emit({
        event,
        nodes
      });
    };
  }
  ngOnInit() {
    const defaultN = this.defaultNodes();
    const defaultE = this.defaultEdges();
    if (defaultN || defaultE) {
      this.store.setDefaultNodesAndEdges(defaultN, defaultE);
    }
    if (this.fitView()) {
      this.store.fitViewQueued.set(true);
      this.store.fitViewOptions.set(this.fitViewOptions());
    }
    if (typeof window !== "undefined") {
      this.colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.colorSchemeHandler = (e) => {
        this.systemPrefersDark.set(e.matches);
      };
      this.colorSchemeQuery.addEventListener("change", this.colorSchemeHandler);
    }
  }
  ngAfterViewInit() {
    const containerEl = this.containerRef()?.nativeElement;
    if (!containerEl) return;
    this.store.domNode.set(containerEl);
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const {
          width,
          height
        } = entry.contentRect;
        this.store.width.set(width);
        this.store.height.set(height);
      }
    });
    this.resizeObserver.observe(containerEl);
    this.initPanZoom(containerEl);
    this.paneRef()?.initSelectionListener();
    if (this.fitView()) {
      setTimeout(() => {
        this.doFitView();
      }, 50);
    }
    this.init.emit(this.ngFlowService);
  }
  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.panZoomInstance?.destroy();
    if (this.colorSchemeQuery && this.colorSchemeHandler) {
      this.colorSchemeQuery.removeEventListener("change", this.colorSchemeHandler);
    }
    this.store.reset();
  }
  doFitView() {
    const nodes = this.store.nodes();
    if (nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      const x = node.position.x;
      const y = node.position.y;
      const w = node.width ?? 150;
      const h = node.height ?? 40;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
    const bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
    const padding = this.fitViewOptions()?.padding ?? 0.1;
    const vp = getViewportForBounds(bounds, this.store.width(), this.store.height(), this.minZoom(), this.maxZoom(), padding);
    this.panZoomInstance?.setViewport(vp, {
      duration: 0
    });
    this.store.transform.set([vp.x, vp.y, vp.zoom]);
  }
  onPanePointerDown(event) {
    this.panePointerDownPos = {
      x: event.clientX,
      y: event.clientY
    };
  }
  onPaneClick(event) {
    const threshold = this.paneClickDistance();
    if (threshold > 0 && this.panePointerDownPos) {
      const dx = event.clientX - this.panePointerDownPos.x;
      const dy = event.clientY - this.panePointerDownPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > threshold) return;
    }
    this.panePointerDownPos = null;
    const target = event.target;
    if (target.closest(".xy-flow__node") || target.closest(".xy-flow__edge") || target.closest(".xy-flow__handle") || target.closest(".xy-flow__selection")) {
      return;
    }
    if (this.store.nodesSelectionActive()) {
      return;
    }
    this.store.resetSelectedElements();
    this.paneClick.emit(event);
  }
  onPaneContextMenu(event) {
    event.preventDefault();
    this.paneContextMenu.emit(event);
  }
  initPanZoom(domNode) {
    const paneElement = domNode.querySelector(".xy-flow__pane");
    if (!paneElement) return;
    const panZoom = XYPanZoom({
      domNode: paneElement,
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom(),
      viewport: this.defaultViewport(),
      translateExtent: this.translateExtent(),
      onDraggingChange: (dragging) => {
        this.store.paneDragging.set(dragging);
      },
      onPanZoomStart: (event, viewport) => {
        this.moveStart.emit({
          event,
          viewport
        });
      },
      onPanZoom: (event, viewport) => {
        this.zone.run(() => {
          const transform2 = [viewport.x, viewport.y, viewport.zoom];
          this.store.transform.set(transform2);
          this.store.bumpVersion();
          this.move.emit({
            event,
            viewport
          });
          this.viewportChange.emit(viewport);
        });
      },
      onPanZoomEnd: (event, viewport) => {
        this.moveEnd.emit({
          event,
          viewport
        });
      }
    });
    this.panZoomInstance = panZoom;
    this.store.panZoom.set(panZoom);
    const dv = this.defaultViewport();
    this.store.transform.set([dv.x, dv.y, dv.zoom]);
    this.updatePanZoomOptions();
  }
  updatePanZoomOptions() {
    this.panZoomInstance?.update({
      panOnDrag: this.panOnDrag(),
      panOnScroll: this.panOnScroll(),
      panOnScrollMode: this.panOnScrollMode(),
      panOnScrollSpeed: this.panOnScrollSpeed(),
      zoomOnScroll: this.zoomOnScroll(),
      zoomOnPinch: this.zoomOnPinch(),
      zoomOnDoubleClick: this.zoomOnDoubleClick(),
      preventScrolling: this.preventScrolling(),
      noPanClassName: this.noPanClassName(),
      noWheelClassName: this.noWheelClassName(),
      userSelectionActive: this.store.userSelectionActive(),
      lib: "ng",
      onTransformChange: (transform2) => {
        this.store.transform.set(transform2);
      },
      paneClickDistance: this.paneClickDistance()
    });
  }
  static {
    this.ɵfac = function NgFlowComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NgFlowComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _NgFlowComponent,
      selectors: [["ng-flow"]],
      contentQueries: function NgFlowComponent_ContentQueries(rf, ctx, dirIndex) {
        if (rf & 1) {
          ɵɵcontentQuerySignal(dirIndex, ctx.nodeTypeDirectives, NgFlowNodeTypeDirective, 4);
        }
        if (rf & 2) {
          ɵɵqueryAdvance();
        }
      },
      viewQuery: function NgFlowComponent_Query(rf, ctx) {
        if (rf & 1) {
          ɵɵviewQuerySignal(ctx.containerRef, _c05, 5)(ctx.paneRef, PaneComponent, 5);
        }
        if (rf & 2) {
          ɵɵqueryAdvance(2);
        }
      },
      hostAttrs: ["role", "application", 1, "ng-flow", "xy-flow", 2, "display", "block", "position", "relative", "overflow", "hidden", "width", "100%", "height", "100%"],
      hostVars: 8,
      hostBindings: function NgFlowComponent_HostBindings(rf, ctx) {
        if (rf & 2) {
          ɵɵstyleProp("width", ctx.widthInput(), "px")("height", ctx.heightInput(), "px");
          ɵɵclassProp("dark", ctx.resolvedColorMode() === "dark")("light", ctx.resolvedColorMode() === "light");
        }
      },
      inputs: {
        nodesModel: [1, "nodes", "nodesModel"],
        edgesModel: [1, "edges", "edgesModel"],
        viewportModel: [1, "viewport", "viewportModel"],
        defaultNodes: [1, "defaultNodes"],
        defaultEdges: [1, "defaultEdges"],
        defaultViewport: [1, "defaultViewport"],
        nodeTypes: [1, "nodeTypes"],
        edgeTypes: [1, "edgeTypes"],
        defaultEdgeOptions: [1, "defaultEdgeOptions"],
        connectionMode: [1, "connectionMode"],
        connectionLineType: [1, "connectionLineType"],
        connectionLineComponent: [1, "connectionLineComponent"],
        connectionLineStyle: [1, "connectionLineStyle"],
        connectionLineContainerStyle: [1, "connectionLineContainerStyle"],
        widthInput: [1, "width", "widthInput"],
        heightInput: [1, "height", "heightInput"],
        nodesDraggable: [1, "nodesDraggable"],
        nodesConnectable: [1, "nodesConnectable"],
        nodesFocusable: [1, "nodesFocusable"],
        edgesFocusable: [1, "edgesFocusable"],
        edgesReconnectable: [1, "edgesReconnectable"],
        elementsSelectable: [1, "elementsSelectable"],
        selectNodesOnDrag: [1, "selectNodesOnDrag"],
        connectOnClick: [1, "connectOnClick"],
        panOnDrag: [1, "panOnDrag"],
        panOnScroll: [1, "panOnScroll"],
        panOnScrollMode: [1, "panOnScrollMode"],
        panOnScrollSpeed: [1, "panOnScrollSpeed"],
        zoomOnScroll: [1, "zoomOnScroll"],
        zoomOnPinch: [1, "zoomOnPinch"],
        zoomOnDoubleClick: [1, "zoomOnDoubleClick"],
        preventScrolling: [1, "preventScrolling"],
        selectionOnDrag: [1, "selectionOnDrag"],
        selectionMode: [1, "selectionMode"],
        minZoom: [1, "minZoom"],
        maxZoom: [1, "maxZoom"],
        translateExtent: [1, "translateExtent"],
        nodeExtent: [1, "nodeExtent"],
        snapToGrid: [1, "snapToGrid"],
        snapGrid: [1, "snapGrid"],
        fitView: [1, "fitView"],
        fitViewOptions: [1, "fitViewOptions"],
        deleteKeyCode: [1, "deleteKeyCode"],
        selectionKeyCode: [1, "selectionKeyCode"],
        panActivationKeyCode: [1, "panActivationKeyCode"],
        multiSelectionKeyCode: [1, "multiSelectionKeyCode"],
        zoomActivationKeyCode: [1, "zoomActivationKeyCode"],
        autoPanOnNodeDrag: [1, "autoPanOnNodeDrag"],
        autoPanOnConnect: [1, "autoPanOnConnect"],
        autoPanSpeed: [1, "autoPanSpeed"],
        connectionRadius: [1, "connectionRadius"],
        reconnectRadius: [1, "reconnectRadius"],
        nodeDragThreshold: [1, "nodeDragThreshold"],
        connectionDragThreshold: [1, "connectionDragThreshold"],
        paneClickDistance: [1, "paneClickDistance"],
        nodeClickDistance: [1, "nodeClickDistance"],
        colorMode: [1, "colorMode"],
        elevateNodesOnSelect: [1, "elevateNodesOnSelect"],
        elevateEdgesOnSelect: [1, "elevateEdgesOnSelect"],
        onlyRenderVisibleElements: [1, "onlyRenderVisibleElements"],
        zIndexMode: [1, "zIndexMode"],
        nodeOrigin: [1, "nodeOrigin"],
        defaultMarkerColor: [1, "defaultMarkerColor"],
        noDragClassName: [1, "noDragClassName"],
        noWheelClassName: [1, "noWheelClassName"],
        noPanClassName: [1, "noPanClassName"],
        disableKeyboardA11y: [1, "disableKeyboardA11y"],
        ariaLabelConfig: [1, "ariaLabelConfig"],
        isValidConnection: [1, "isValidConnection"],
        proOptions: [1, "proOptions"],
        attributionPosition: [1, "attributionPosition"],
        hideAttribution: [1, "hideAttribution"],
        flowId: [1, "id", "flowId"],
        debug: [1, "debug"],
        onBeforeDelete: [1, "onBeforeDelete"]
      },
      outputs: {
        nodesModel: "nodesChange",
        edgesModel: "edgesChange",
        viewportModel: "viewportChange",
        nodesChange: "nodesChange",
        edgesChange: "edgesChange",
        init: "init",
        nodeClick: "nodeClick",
        nodeDoubleClick: "nodeDoubleClick",
        nodeMouseEnter: "nodeMouseEnter",
        nodeMouseMove: "nodeMouseMove",
        nodeMouseLeave: "nodeMouseLeave",
        nodeContextMenu: "nodeContextMenu",
        nodeDragStart: "nodeDragStart",
        nodeDrag: "nodeDrag",
        nodeDragStop: "nodeDragStop",
        edgeClick: "edgeClick",
        edgeDoubleClick: "edgeDoubleClick",
        edgeContextMenu: "edgeContextMenu",
        edgeMouseEnter: "edgeMouseEnter",
        edgeMouseMove: "edgeMouseMove",
        edgeMouseLeave: "edgeMouseLeave",
        connect: "connect",
        connectStart: "connectStart",
        connectEnd: "connectEnd",
        clickConnectStart: "clickConnectStart",
        clickConnectEnd: "clickConnectEnd",
        reconnect: "reconnect",
        reconnectStart: "reconnectStart",
        reconnectEnd: "reconnectEnd",
        paneClick: "paneClick",
        paneContextMenu: "paneContextMenu",
        paneMouseEnter: "paneMouseEnter",
        paneMouseMove: "paneMouseMove",
        paneMouseLeave: "paneMouseLeave",
        paneScroll: "paneScroll",
        moveStart: "moveStart",
        move: "move",
        moveEnd: "moveEnd",
        viewportChange: "viewportChange",
        selectionChange: "selectionChange",
        selectionDragStart: "selectionDragStart",
        selectionDrag: "selectionDrag",
        selectionDragStop: "selectionDragStop",
        selectionStart: "selectionStart",
        selectionEnd: "selectionEnd",
        selectionContextMenu: "selectionContextMenu",
        nodesDelete: "nodesDelete",
        edgesDelete: "edgesDelete",
        deleteEvent: "delete",
        error: "error",
        autoPanStart: "autoPanStart",
        autoPanEnd: "autoPanEnd"
      },
      features: [ɵɵProvidersFeature([FlowStore, NgFlowService])],
      ngContentSelectors: _c1,
      decls: 13,
      vars: 16,
      consts: [["container", ""], ["ngFlowKeyHandler", "", 1, "ng-flow__container", "xy-flow__container", 3, "nodesDelete", "edgesDelete", "deleteElements", "deleteKeyCode", "selectionKeyCode", "multiSelectionKeyCode", "disableKeyboardA11y"], [3, "pointerdown", "click", "contextmenu", "mouseenter", "mousemove", "mouseleave", "selectionStart", "selectionEnd", "paneScroll", "panOnDrag", "selectionOnDrag", "selectionKeyCode", "selectionMode"], [3, "transform"], [3, "edgeClick", "edgeDoubleClick", "edgeContextMenu", "edgeMouseEnter", "edgeMouseMove", "edgeMouseLeave", "reconnect", "reconnectStart", "reconnectEnd", "customEdgeTypes"], [3, "customComponent", "connectionLineType"], [3, "nodeClick", "nodeDoubleClick", "nodeContextMenu", "nodeMouseEnter", "nodeMouseMove", "nodeMouseLeave", "customNodeTypes", "nodeTemplateMap"], [3, "contextMenu"], ["aria-live", "assertive", "aria-atomic", "true", 1, "xy-flow__a11y-descriptions", 2, "position", "absolute", "width", "1px", "height", "1px", "margin", "-1px", "padding", "0", "overflow", "hidden", "clip", "rect(0,0,0,0)", "border", "0"]],
      template: function NgFlowComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵelementStart(0, "div", 1, 0);
          ɵɵlistener("nodesDelete", function NgFlowComponent_Template_div_nodesDelete_0_listener($event) {
            return ctx.nodesDelete.emit($event);
          })("edgesDelete", function NgFlowComponent_Template_div_edgesDelete_0_listener($event) {
            return ctx.edgesDelete.emit($event);
          })("deleteElements", function NgFlowComponent_Template_div_deleteElements_0_listener($event) {
            return ctx.deleteEvent.emit($event);
          });
          ɵɵelementStart(2, "ng-flow-pane", 2);
          ɵɵlistener("pointerdown", function NgFlowComponent_Template_ng_flow_pane_pointerdown_2_listener($event) {
            return ctx.onPanePointerDown($event);
          })("click", function NgFlowComponent_Template_ng_flow_pane_click_2_listener($event) {
            return ctx.onPaneClick($event);
          })("contextmenu", function NgFlowComponent_Template_ng_flow_pane_contextmenu_2_listener($event) {
            return ctx.onPaneContextMenu($event);
          })("mouseenter", function NgFlowComponent_Template_ng_flow_pane_mouseenter_2_listener($event) {
            return ctx.paneMouseEnter.emit($event);
          })("mousemove", function NgFlowComponent_Template_ng_flow_pane_mousemove_2_listener($event) {
            return ctx.paneMouseMove.emit($event);
          })("mouseleave", function NgFlowComponent_Template_ng_flow_pane_mouseleave_2_listener($event) {
            return ctx.paneMouseLeave.emit($event);
          })("selectionStart", function NgFlowComponent_Template_ng_flow_pane_selectionStart_2_listener($event) {
            return ctx.selectionStart.emit($event);
          })("selectionEnd", function NgFlowComponent_Template_ng_flow_pane_selectionEnd_2_listener($event) {
            return ctx.selectionEnd.emit($event);
          })("paneScroll", function NgFlowComponent_Template_ng_flow_pane_paneScroll_2_listener($event) {
            return ctx.paneScroll.emit($event);
          });
          ɵɵelementStart(3, "ng-flow-viewport", 3)(4, "ng-flow-edge-renderer", 4);
          ɵɵlistener("edgeClick", function NgFlowComponent_Template_ng_flow_edge_renderer_edgeClick_4_listener($event) {
            return ctx.edgeClick.emit($event);
          })("edgeDoubleClick", function NgFlowComponent_Template_ng_flow_edge_renderer_edgeDoubleClick_4_listener($event) {
            return ctx.edgeDoubleClick.emit($event);
          })("edgeContextMenu", function NgFlowComponent_Template_ng_flow_edge_renderer_edgeContextMenu_4_listener($event) {
            return ctx.edgeContextMenu.emit($event);
          })("edgeMouseEnter", function NgFlowComponent_Template_ng_flow_edge_renderer_edgeMouseEnter_4_listener($event) {
            return ctx.edgeMouseEnter.emit($event);
          })("edgeMouseMove", function NgFlowComponent_Template_ng_flow_edge_renderer_edgeMouseMove_4_listener($event) {
            return ctx.edgeMouseMove.emit($event);
          })("edgeMouseLeave", function NgFlowComponent_Template_ng_flow_edge_renderer_edgeMouseLeave_4_listener($event) {
            return ctx.edgeMouseLeave.emit($event);
          })("reconnect", function NgFlowComponent_Template_ng_flow_edge_renderer_reconnect_4_listener($event) {
            return ctx.reconnect.emit($event);
          })("reconnectStart", function NgFlowComponent_Template_ng_flow_edge_renderer_reconnectStart_4_listener($event) {
            return ctx.reconnectStart.emit($event);
          })("reconnectEnd", function NgFlowComponent_Template_ng_flow_edge_renderer_reconnectEnd_4_listener($event) {
            return ctx.reconnectEnd.emit($event);
          });
          ɵɵelementEnd();
          ɵɵelement(5, "ng-flow-connection-line", 5);
          ɵɵelementStart(6, "ng-flow-node-renderer", 6);
          ɵɵlistener("nodeClick", function NgFlowComponent_Template_ng_flow_node_renderer_nodeClick_6_listener($event) {
            return ctx.nodeClick.emit($event);
          })("nodeDoubleClick", function NgFlowComponent_Template_ng_flow_node_renderer_nodeDoubleClick_6_listener($event) {
            return ctx.nodeDoubleClick.emit($event);
          })("nodeContextMenu", function NgFlowComponent_Template_ng_flow_node_renderer_nodeContextMenu_6_listener($event) {
            return ctx.nodeContextMenu.emit($event);
          })("nodeMouseEnter", function NgFlowComponent_Template_ng_flow_node_renderer_nodeMouseEnter_6_listener($event) {
            return ctx.nodeMouseEnter.emit($event);
          })("nodeMouseMove", function NgFlowComponent_Template_ng_flow_node_renderer_nodeMouseMove_6_listener($event) {
            return ctx.nodeMouseMove.emit($event);
          })("nodeMouseLeave", function NgFlowComponent_Template_ng_flow_node_renderer_nodeMouseLeave_6_listener($event) {
            return ctx.nodeMouseLeave.emit($event);
          });
          ɵɵelementEnd()();
          ɵɵelementStart(7, "ng-flow-selection-box", 7);
          ɵɵlistener("contextMenu", function NgFlowComponent_Template_ng_flow_selection_box_contextMenu_7_listener($event) {
            return ctx.selectionContextMenu.emit({
              event: $event,
              nodes: ctx.store.selectedNodes()
            });
          });
          ɵɵelementEnd()();
          ɵɵprojection(8);
          ɵɵelement(9, "ng-flow-a11y-descriptions");
          ɵɵconditionalCreate(10, NgFlowComponent_Conditional_10_Template, 1, 0, "ng-flow-attribution");
          ɵɵelementStart(11, "div", 8);
          ɵɵtext(12);
          ɵɵelementEnd()();
        }
        if (rf & 2) {
          ɵɵproperty("deleteKeyCode", ctx.deleteKeyCode())("selectionKeyCode", ctx.selectionKeyCode())("multiSelectionKeyCode", ctx.multiSelectionKeyCode())("disableKeyboardA11y", ctx.disableKeyboardA11y());
          ɵɵadvance(2);
          ɵɵproperty("panOnDrag", ctx.panOnDrag())("selectionOnDrag", ctx.selectionOnDrag())("selectionKeyCode", ctx.selectionKeyCode())("selectionMode", ctx.selectionMode());
          ɵɵadvance();
          ɵɵproperty("transform", ctx.store.transform());
          ɵɵadvance();
          ɵɵproperty("customEdgeTypes", ctx.edgeTypes());
          ɵɵadvance();
          ɵɵproperty("customComponent", ctx.connectionLineComponent())("connectionLineType", ctx.connectionLineType());
          ɵɵadvance();
          ɵɵproperty("customNodeTypes", ctx.nodeTypes())("nodeTemplateMap", ctx.nodeTemplateMap());
          ɵɵadvance(4);
          ɵɵconditional(!ctx.hideAttribution() ? 10 : -1);
          ɵɵadvance(2);
          ɵɵtextInterpolate1(" ", ctx.store.ariaLiveMessage(), " ");
        }
      },
      dependencies: [CommonModule, NodeRendererComponent, EdgeRendererComponent, ViewportComponent, PaneComponent, ConnectionLineComponent, SelectionBoxComponent, KeyHandlerDirective, A11yDescriptionsComponent, AttributionComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgFlowComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow",
      standalone: true,
      imports: [CommonModule, NodeRendererComponent, EdgeRendererComponent, ViewportComponent, PaneComponent, ConnectionLineComponent, SelectionBoxComponent, KeyHandlerDirective, A11yDescriptionsComponent, AttributionComponent],
      providers: [FlowStore, NgFlowService],
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow xy-flow",
        "role": "application",
        "[class.dark]": 'resolvedColorMode() === "dark"',
        "[class.light]": 'resolvedColorMode() === "light"',
        "[style.width.px]": "widthInput()",
        "[style.height.px]": "heightInput()",
        "style": "display: block; position: relative; overflow: hidden; width: 100%; height: 100%;"
      },
      template: `
    <div
      class="ng-flow__container xy-flow__container"
      #container
      ngFlowKeyHandler
      [deleteKeyCode]="deleteKeyCode()"
      [selectionKeyCode]="selectionKeyCode()"
      [multiSelectionKeyCode]="multiSelectionKeyCode()"
      [disableKeyboardA11y]="disableKeyboardA11y()"
      (nodesDelete)="nodesDelete.emit($event)"
      (edgesDelete)="edgesDelete.emit($event)"
      (deleteElements)="deleteEvent.emit($event)"
    >
      <ng-flow-pane
        [panOnDrag]="panOnDrag()"
        [selectionOnDrag]="selectionOnDrag()"
        [selectionKeyCode]="selectionKeyCode()"
        [selectionMode]="selectionMode()"
        (pointerdown)="onPanePointerDown($event)"
        (click)="onPaneClick($event)"
        (contextmenu)="onPaneContextMenu($event)"
        (mouseenter)="paneMouseEnter.emit($event)"
        (mousemove)="paneMouseMove.emit($event)"
        (mouseleave)="paneMouseLeave.emit($event)"
        (selectionStart)="selectionStart.emit($event)"
        (selectionEnd)="selectionEnd.emit($event)"
        (paneScroll)="paneScroll.emit($event)"
      >
        <ng-flow-viewport [transform]="store.transform()">
          <ng-flow-edge-renderer
            [customEdgeTypes]="edgeTypes()"
            (edgeClick)="edgeClick.emit($event)"
            (edgeDoubleClick)="edgeDoubleClick.emit($event)"
            (edgeContextMenu)="edgeContextMenu.emit($event)"
            (edgeMouseEnter)="edgeMouseEnter.emit($event)"
            (edgeMouseMove)="edgeMouseMove.emit($event)"
            (edgeMouseLeave)="edgeMouseLeave.emit($event)"
            (reconnect)="reconnect.emit($event)"
            (reconnectStart)="reconnectStart.emit($event)"
            (reconnectEnd)="reconnectEnd.emit($event)"
          />
          <ng-flow-connection-line [customComponent]="connectionLineComponent()" [connectionLineType]="connectionLineType()" />
          <ng-flow-node-renderer
            [customNodeTypes]="nodeTypes()"
            [nodeTemplateMap]="nodeTemplateMap()"
            (nodeClick)="nodeClick.emit($event)"
            (nodeDoubleClick)="nodeDoubleClick.emit($event)"
            (nodeContextMenu)="nodeContextMenu.emit($event)"
            (nodeMouseEnter)="nodeMouseEnter.emit($event)"
            (nodeMouseMove)="nodeMouseMove.emit($event)"
            (nodeMouseLeave)="nodeMouseLeave.emit($event)"
          />
        </ng-flow-viewport>
        <ng-flow-selection-box (contextMenu)="selectionContextMenu.emit({ event: $event, nodes: store.selectedNodes() })" />
      </ng-flow-pane>
      <ng-content />
      <ng-flow-a11y-descriptions />
      @if (!hideAttribution()) {
        <ng-flow-attribution />
      }
      <div class="xy-flow__a11y-descriptions" aria-live="assertive" aria-atomic="true"
           style="position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); border: 0;">
        {{ store.ariaLiveMessage() }}
      </div>
    </div>
  `
    }]
  }], () => [], {
    containerRef: [{
      type: ViewChild,
      args: ["container", {
        isSignal: true
      }]
    }],
    paneRef: [{
      type: ViewChild,
      args: [forwardRef(() => PaneComponent), {
        isSignal: true
      }]
    }],
    nodeTypeDirectives: [{
      type: ContentChildren,
      args: [forwardRef(() => NgFlowNodeTypeDirective), {
        isSignal: true
      }]
    }],
    nodesModel: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodes",
        required: false
      }]
    }, {
      type: Output,
      args: ["nodesChange"]
    }],
    edgesModel: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "edges",
        required: false
      }]
    }, {
      type: Output,
      args: ["edgesChange"]
    }],
    viewportModel: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "viewport",
        required: false
      }]
    }, {
      type: Output,
      args: ["viewportChange"]
    }],
    defaultNodes: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "defaultNodes",
        required: false
      }]
    }],
    defaultEdges: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "defaultEdges",
        required: false
      }]
    }],
    defaultViewport: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "defaultViewport",
        required: false
      }]
    }],
    nodeTypes: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeTypes",
        required: false
      }]
    }],
    edgeTypes: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "edgeTypes",
        required: false
      }]
    }],
    defaultEdgeOptions: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "defaultEdgeOptions",
        required: false
      }]
    }],
    connectionMode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "connectionMode",
        required: false
      }]
    }],
    connectionLineType: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "connectionLineType",
        required: false
      }]
    }],
    connectionLineComponent: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "connectionLineComponent",
        required: false
      }]
    }],
    connectionLineStyle: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "connectionLineStyle",
        required: false
      }]
    }],
    connectionLineContainerStyle: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "connectionLineContainerStyle",
        required: false
      }]
    }],
    widthInput: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "width",
        required: false
      }]
    }],
    heightInput: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "height",
        required: false
      }]
    }],
    nodesDraggable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodesDraggable",
        required: false
      }]
    }],
    nodesConnectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodesConnectable",
        required: false
      }]
    }],
    nodesFocusable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodesFocusable",
        required: false
      }]
    }],
    edgesFocusable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "edgesFocusable",
        required: false
      }]
    }],
    edgesReconnectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "edgesReconnectable",
        required: false
      }]
    }],
    elementsSelectable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "elementsSelectable",
        required: false
      }]
    }],
    selectNodesOnDrag: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selectNodesOnDrag",
        required: false
      }]
    }],
    connectOnClick: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "connectOnClick",
        required: false
      }]
    }],
    panOnDrag: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "panOnDrag",
        required: false
      }]
    }],
    panOnScroll: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "panOnScroll",
        required: false
      }]
    }],
    panOnScrollMode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "panOnScrollMode",
        required: false
      }]
    }],
    panOnScrollSpeed: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "panOnScrollSpeed",
        required: false
      }]
    }],
    zoomOnScroll: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zoomOnScroll",
        required: false
      }]
    }],
    zoomOnPinch: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zoomOnPinch",
        required: false
      }]
    }],
    zoomOnDoubleClick: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zoomOnDoubleClick",
        required: false
      }]
    }],
    preventScrolling: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "preventScrolling",
        required: false
      }]
    }],
    selectionOnDrag: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selectionOnDrag",
        required: false
      }]
    }],
    selectionMode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selectionMode",
        required: false
      }]
    }],
    minZoom: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "minZoom",
        required: false
      }]
    }],
    maxZoom: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "maxZoom",
        required: false
      }]
    }],
    translateExtent: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "translateExtent",
        required: false
      }]
    }],
    nodeExtent: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeExtent",
        required: false
      }]
    }],
    snapToGrid: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "snapToGrid",
        required: false
      }]
    }],
    snapGrid: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "snapGrid",
        required: false
      }]
    }],
    fitView: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "fitView",
        required: false
      }]
    }],
    fitViewOptions: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "fitViewOptions",
        required: false
      }]
    }],
    deleteKeyCode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "deleteKeyCode",
        required: false
      }]
    }],
    selectionKeyCode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "selectionKeyCode",
        required: false
      }]
    }],
    panActivationKeyCode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "panActivationKeyCode",
        required: false
      }]
    }],
    multiSelectionKeyCode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "multiSelectionKeyCode",
        required: false
      }]
    }],
    zoomActivationKeyCode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zoomActivationKeyCode",
        required: false
      }]
    }],
    autoPanOnNodeDrag: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "autoPanOnNodeDrag",
        required: false
      }]
    }],
    autoPanOnConnect: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "autoPanOnConnect",
        required: false
      }]
    }],
    autoPanSpeed: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "autoPanSpeed",
        required: false
      }]
    }],
    connectionRadius: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "connectionRadius",
        required: false
      }]
    }],
    reconnectRadius: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "reconnectRadius",
        required: false
      }]
    }],
    nodeDragThreshold: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeDragThreshold",
        required: false
      }]
    }],
    connectionDragThreshold: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "connectionDragThreshold",
        required: false
      }]
    }],
    paneClickDistance: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "paneClickDistance",
        required: false
      }]
    }],
    nodeClickDistance: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeClickDistance",
        required: false
      }]
    }],
    colorMode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "colorMode",
        required: false
      }]
    }],
    elevateNodesOnSelect: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "elevateNodesOnSelect",
        required: false
      }]
    }],
    elevateEdgesOnSelect: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "elevateEdgesOnSelect",
        required: false
      }]
    }],
    onlyRenderVisibleElements: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "onlyRenderVisibleElements",
        required: false
      }]
    }],
    zIndexMode: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zIndexMode",
        required: false
      }]
    }],
    nodeOrigin: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeOrigin",
        required: false
      }]
    }],
    defaultMarkerColor: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "defaultMarkerColor",
        required: false
      }]
    }],
    noDragClassName: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "noDragClassName",
        required: false
      }]
    }],
    noWheelClassName: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "noWheelClassName",
        required: false
      }]
    }],
    noPanClassName: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "noPanClassName",
        required: false
      }]
    }],
    disableKeyboardA11y: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "disableKeyboardA11y",
        required: false
      }]
    }],
    ariaLabelConfig: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "ariaLabelConfig",
        required: false
      }]
    }],
    isValidConnection: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isValidConnection",
        required: false
      }]
    }],
    proOptions: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "proOptions",
        required: false
      }]
    }],
    attributionPosition: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "attributionPosition",
        required: false
      }]
    }],
    hideAttribution: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "hideAttribution",
        required: false
      }]
    }],
    flowId: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: false
      }]
    }],
    debug: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "debug",
        required: false
      }]
    }],
    nodesChange: [{
      type: Output,
      args: ["nodesChange"]
    }],
    edgesChange: [{
      type: Output,
      args: ["edgesChange"]
    }],
    init: [{
      type: Output,
      args: ["init"]
    }],
    nodeClick: [{
      type: Output,
      args: ["nodeClick"]
    }],
    nodeDoubleClick: [{
      type: Output,
      args: ["nodeDoubleClick"]
    }],
    nodeMouseEnter: [{
      type: Output,
      args: ["nodeMouseEnter"]
    }],
    nodeMouseMove: [{
      type: Output,
      args: ["nodeMouseMove"]
    }],
    nodeMouseLeave: [{
      type: Output,
      args: ["nodeMouseLeave"]
    }],
    nodeContextMenu: [{
      type: Output,
      args: ["nodeContextMenu"]
    }],
    nodeDragStart: [{
      type: Output,
      args: ["nodeDragStart"]
    }],
    nodeDrag: [{
      type: Output,
      args: ["nodeDrag"]
    }],
    nodeDragStop: [{
      type: Output,
      args: ["nodeDragStop"]
    }],
    edgeClick: [{
      type: Output,
      args: ["edgeClick"]
    }],
    edgeDoubleClick: [{
      type: Output,
      args: ["edgeDoubleClick"]
    }],
    edgeContextMenu: [{
      type: Output,
      args: ["edgeContextMenu"]
    }],
    edgeMouseEnter: [{
      type: Output,
      args: ["edgeMouseEnter"]
    }],
    edgeMouseMove: [{
      type: Output,
      args: ["edgeMouseMove"]
    }],
    edgeMouseLeave: [{
      type: Output,
      args: ["edgeMouseLeave"]
    }],
    connect: [{
      type: Output,
      args: ["connect"]
    }],
    connectStart: [{
      type: Output,
      args: ["connectStart"]
    }],
    connectEnd: [{
      type: Output,
      args: ["connectEnd"]
    }],
    clickConnectStart: [{
      type: Output,
      args: ["clickConnectStart"]
    }],
    clickConnectEnd: [{
      type: Output,
      args: ["clickConnectEnd"]
    }],
    reconnect: [{
      type: Output,
      args: ["reconnect"]
    }],
    reconnectStart: [{
      type: Output,
      args: ["reconnectStart"]
    }],
    reconnectEnd: [{
      type: Output,
      args: ["reconnectEnd"]
    }],
    paneClick: [{
      type: Output,
      args: ["paneClick"]
    }],
    paneContextMenu: [{
      type: Output,
      args: ["paneContextMenu"]
    }],
    paneMouseEnter: [{
      type: Output,
      args: ["paneMouseEnter"]
    }],
    paneMouseMove: [{
      type: Output,
      args: ["paneMouseMove"]
    }],
    paneMouseLeave: [{
      type: Output,
      args: ["paneMouseLeave"]
    }],
    paneScroll: [{
      type: Output,
      args: ["paneScroll"]
    }],
    moveStart: [{
      type: Output,
      args: ["moveStart"]
    }],
    move: [{
      type: Output,
      args: ["move"]
    }],
    moveEnd: [{
      type: Output,
      args: ["moveEnd"]
    }],
    viewportChange: [{
      type: Output,
      args: ["viewportChange"]
    }],
    selectionChange: [{
      type: Output,
      args: ["selectionChange"]
    }],
    selectionDragStart: [{
      type: Output,
      args: ["selectionDragStart"]
    }],
    selectionDrag: [{
      type: Output,
      args: ["selectionDrag"]
    }],
    selectionDragStop: [{
      type: Output,
      args: ["selectionDragStop"]
    }],
    selectionStart: [{
      type: Output,
      args: ["selectionStart"]
    }],
    selectionEnd: [{
      type: Output,
      args: ["selectionEnd"]
    }],
    selectionContextMenu: [{
      type: Output,
      args: ["selectionContextMenu"]
    }],
    nodesDelete: [{
      type: Output,
      args: ["nodesDelete"]
    }],
    edgesDelete: [{
      type: Output,
      args: ["edgesDelete"]
    }],
    deleteEvent: [{
      type: Output,
      args: ["delete"]
    }],
    onBeforeDelete: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "onBeforeDelete",
        required: false
      }]
    }],
    error: [{
      type: Output,
      args: ["error"]
    }],
    autoPanStart: [{
      type: Output,
      args: ["autoPanStart"]
    }],
    autoPanEnd: [{
      type: Output,
      args: ["autoPanEnd"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/ng-flow-provider/ng-flow-provider.component.js
var _c06 = ["*"];
var NgFlowProviderComponent = class _NgFlowProviderComponent {
  static {
    this.ɵfac = function NgFlowProviderComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NgFlowProviderComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _NgFlowProviderComponent,
      selectors: [["ng-flow-provider"]],
      features: [ɵɵProvidersFeature([FlowStore, NgFlowService])],
      ngContentSelectors: _c06,
      decls: 1,
      vars: 0,
      template: function NgFlowProviderComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgFlowProviderComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-provider",
      standalone: true,
      providers: [FlowStore, NgFlowService],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<ng-content />`
    }]
  }], null, null);
})();

// ../../packages/angular/dist/esm/lib/components/edges/edge-text.component.js
var EdgeTextComponent = class _EdgeTextComponent {
  constructor() {
    this.x = input(0, ...ngDevMode ? [{
      debugName: "x"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.y = input(0, ...ngDevMode ? [{
      debugName: "y"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.label = input(...ngDevMode ? [void 0, {
      debugName: "label"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.width = input(40, ...ngDevMode ? [{
      debugName: "width"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.height = input(20, ...ngDevMode ? [{
      debugName: "height"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function EdgeTextComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _EdgeTextComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _EdgeTextComponent,
      selectors: [["ng-flow-edge-text"]],
      inputs: {
        x: [1, "x"],
        y: [1, "y"],
        label: [1, "label"],
        width: [1, "width"],
        height: [1, "height"]
      },
      decls: 4,
      vars: 5,
      consts: [["requiredExtensions", "http://www.w3.org/1999/xhtml", 1, "xy-flow__edge-textwrapper"], ["xmlns", "http://www.w3.org/1999/xhtml", 1, "xy-flow__edge-textbg"], [1, "xy-flow__edge-text"]],
      template: function EdgeTextComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵnamespaceSVG();
          ɵɵdomElementStart(0, "foreignObject", 0);
          ɵɵnamespaceHTML();
          ɵɵdomElementStart(1, "div", 1)(2, "span", 2);
          ɵɵtext(3);
          ɵɵdomElementEnd()()();
        }
        if (rf & 2) {
          ɵɵattribute("width", ctx.width())("height", ctx.height())("x", ctx.x() - ctx.width() / 2)("y", ctx.y() - ctx.height() / 2);
          ɵɵadvance(3);
          ɵɵtextInterpolate(ctx.label());
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(EdgeTextComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-edge-text",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <foreignObject
      [attr.width]="width()"
      [attr.height]="height()"
      [attr.x]="x() - width() / 2"
      [attr.y]="y() - height() / 2"
      class="xy-flow__edge-textwrapper"
      requiredExtensions="http://www.w3.org/1999/xhtml"
    >
      <div class="xy-flow__edge-textbg" xmlns="http://www.w3.org/1999/xhtml">
        <span class="xy-flow__edge-text">{{ label() }}</span>
      </div>
    </foreignObject>
  `
    }]
  }], null, {
    x: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "x",
        required: false
      }]
    }],
    y: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "y",
        required: false
      }]
    }],
    label: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "label",
        required: false
      }]
    }],
    width: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "width",
        required: false
      }]
    }],
    height: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "height",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/edge-label-renderer/edge-label-renderer.component.js
var _c07 = ["*"];
var EdgeLabelRendererComponent = class _EdgeLabelRendererComponent {
  static {
    this.ɵfac = function EdgeLabelRendererComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _EdgeLabelRendererComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _EdgeLabelRendererComponent,
      selectors: [["ng-flow-edge-label-renderer"]],
      hostAttrs: [1, "ng-flow__edgelabel-renderer", "xy-flow__edgelabel-renderer"],
      ngContentSelectors: _c07,
      decls: 1,
      vars: 0,
      template: function EdgeLabelRendererComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(EdgeLabelRendererComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-edge-label-renderer",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__edgelabel-renderer xy-flow__edgelabel-renderer"
      },
      template: `<ng-content />`
    }]
  }], null, null);
})();

// ../../packages/angular/dist/esm/lib/components/viewport-portal/viewport-portal.component.js
var _c08 = ["*"];
var ViewportPortalComponent = class _ViewportPortalComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.cssTransform = computed(() => {
      const t = this.store.transform();
      return `translate(${t[0]}px, ${t[1]}px) scale(${t[2]})`;
    }, ...ngDevMode ? [{
      debugName: "cssTransform"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function ViewportPortalComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _ViewportPortalComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _ViewportPortalComponent,
      selectors: [["ng-flow-viewport-portal"]],
      hostAttrs: [1, "ng-flow__viewport-portal", "xy-flow__viewport-portal"],
      hostVars: 2,
      hostBindings: function ViewportPortalComponent_HostBindings(rf, ctx) {
        if (rf & 2) {
          ɵɵstyleProp("transform", ctx.cssTransform());
        }
      },
      ngContentSelectors: _c08,
      decls: 1,
      vars: 0,
      template: function ViewportPortalComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ViewportPortalComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-viewport-portal",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__viewport-portal xy-flow__viewport-portal",
        "[style.transform]": "cssTransform()"
      },
      template: `<ng-content />`
    }]
  }], null, null);
})();

// ../../packages/angular/dist/esm/lib/components/background/background.component.js
function BackgroundComponent_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵdomElement(0, "rect", 1);
  }
  if (rf & 2) {
    const ctx_r0 = ɵɵnextContext();
    ɵɵattribute("fill", ctx_r0.bgColor());
  }
}
function BackgroundComponent_Case_3_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵdomElementStart(0, "pattern", 2);
    ɵɵdomElement(1, "circle");
    ɵɵdomElementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = ɵɵnextContext();
    ɵɵattribute("id", ctx_r0.patternId())("x", ctx_r0.patternOffset().x)("y", ctx_r0.patternOffset().y)("width", ctx_r0.scaledGapX())("height", ctx_r0.scaledGapY());
    ɵɵadvance();
    ɵɵclassMap("xy-flow__background-pattern dots " + (ctx_r0.patternClassName() ?? ""));
    ɵɵattribute("cx", ctx_r0.size() * ctx_r0.zoom())("cy", ctx_r0.size() * ctx_r0.zoom())("r", ctx_r0.size() * ctx_r0.zoom())("fill", ctx_r0.color());
  }
}
function BackgroundComponent_Case_4_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵdomElementStart(0, "pattern", 2);
    ɵɵdomElement(1, "path");
    ɵɵdomElementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = ɵɵnextContext();
    ɵɵattribute("id", ctx_r0.patternId())("x", ctx_r0.patternOffset().x)("y", ctx_r0.patternOffset().y)("width", ctx_r0.scaledGapX())("height", ctx_r0.scaledGapY());
    ɵɵadvance();
    ɵɵclassMap("xy-flow__background-pattern lines " + (ctx_r0.patternClassName() ?? ""));
    ɵɵattribute("stroke", ctx_r0.color())("stroke-width", ctx_r0.resolvedLineWidth() * ctx_r0.zoom())("d", "M " + ctx_r0.scaledGapX() + " 0 L 0 0 0 " + ctx_r0.scaledGapY());
  }
}
function BackgroundComponent_Case_5_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵdomElementStart(0, "pattern", 2);
    ɵɵdomElement(1, "path");
    ɵɵdomElementEnd();
  }
  if (rf & 2) {
    const ctx_r0 = ɵɵnextContext();
    ɵɵattribute("id", ctx_r0.patternId())("x", ctx_r0.patternOffset().x)("y", ctx_r0.patternOffset().y)("width", ctx_r0.scaledGapX())("height", ctx_r0.scaledGapY());
    ɵɵadvance();
    ɵɵclassMap("xy-flow__background-pattern cross " + (ctx_r0.patternClassName() ?? ""));
    ɵɵattribute("stroke", ctx_r0.color())("stroke-width", ctx_r0.resolvedLineWidth() * ctx_r0.zoom())("d", ctx_r0.crossPath());
  }
}
var BackgroundComponent = class _BackgroundComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.variant = input("dots", ...ngDevMode ? [{
      debugName: "variant"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.gap = input(20, ...ngDevMode ? [{
      debugName: "gap"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.size = input(1, ...ngDevMode ? [{
      debugName: "size"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.lineWidth = input(...ngDevMode ? [void 0, {
      debugName: "lineWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.offset = input(0, ...ngDevMode ? [{
      debugName: "offset"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.color = input(...ngDevMode ? [void 0, {
      debugName: "color"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.bgColor = input(...ngDevMode ? [void 0, {
      debugName: "bgColor"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.patternClassName = input(...ngDevMode ? [void 0, {
      debugName: "patternClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.bgId = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "bgId"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "id"
    }));
    this.patternId = computed(() => {
      const customId = this.bgId();
      return customId ?? `ng-flow-bg-${this.store.rfId()}`;
    }, ...ngDevMode ? [{
      debugName: "patternId"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zoom = computed(() => this.store.transform()[2], ...ngDevMode ? [{
      debugName: "zoom"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.gapX = computed(() => {
      const g = this.gap();
      return Array.isArray(g) ? g[0] : g;
    }, ...ngDevMode ? [{
      debugName: "gapX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.gapY = computed(() => {
      const g = this.gap();
      return Array.isArray(g) ? g[1] : g;
    }, ...ngDevMode ? [{
      debugName: "gapY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.offsetX = computed(() => {
      const o = this.offset();
      return Array.isArray(o) ? o[0] : o;
    }, ...ngDevMode ? [{
      debugName: "offsetX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.offsetY = computed(() => {
      const o = this.offset();
      return Array.isArray(o) ? o[1] : o;
    }, ...ngDevMode ? [{
      debugName: "offsetY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.scaledGapX = computed(() => this.gapX() * this.zoom(), ...ngDevMode ? [{
      debugName: "scaledGapX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.scaledGapY = computed(() => this.gapY() * this.zoom(), ...ngDevMode ? [{
      debugName: "scaledGapY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.resolvedLineWidth = computed(() => {
      const lw = this.lineWidth();
      if (lw !== void 0) return lw;
      return this.variant() === "dots" ? this.size() : 1;
    }, ...ngDevMode ? [{
      debugName: "resolvedLineWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.patternOffset = computed(() => {
      const t = this.store.transform();
      return {
        x: t[0] % this.scaledGapX() + this.offsetX() * this.zoom(),
        y: t[1] % this.scaledGapY() + this.offsetY() * this.zoom()
      };
    }, ...ngDevMode ? [{
      debugName: "patternOffset"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.crossPath = computed(() => {
      const gx = this.scaledGapX();
      const gy = this.scaledGapY();
      const s = this.size() * this.zoom();
      const halfGX = gx / 2;
      const halfGY = gy / 2;
      return `M ${halfGX - s} ${halfGY} L ${halfGX + s} ${halfGY} M ${halfGX} ${halfGY - s} L ${halfGX} ${halfGY + s}`;
    }, ...ngDevMode ? [{
      debugName: "crossPath"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function BackgroundComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _BackgroundComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _BackgroundComponent,
      selectors: [["ng-flow-background"]],
      hostAttrs: [1, "ng-flow__background", "xy-flow__background", "xy-flow__container", 2, "display", "block", "position", "absolute", "width", "100%", "height", "100%", "top", "0", "left", "0", "pointer-events", "none", "z-index", "-1"],
      inputs: {
        variant: [1, "variant"],
        gap: [1, "gap"],
        size: [1, "size"],
        lineWidth: [1, "lineWidth"],
        offset: [1, "offset"],
        color: [1, "color"],
        bgColor: [1, "bgColor"],
        patternClassName: [1, "patternClassName"],
        bgId: [1, "id", "bgId"]
      },
      decls: 7,
      vars: 7,
      consts: [[1, "ng-flow__background-svg"], ["x", "0", "y", "0", "width", "100%", "height", "100%"], ["patternUnits", "userSpaceOnUse"]],
      template: function BackgroundComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵnamespaceSVG();
          ɵɵdomElementStart(0, "svg", 0);
          ɵɵconditionalCreate(1, BackgroundComponent_Conditional_1_Template, 1, 1, ":svg:rect", 1);
          ɵɵdomElementStart(2, "defs");
          ɵɵconditionalCreate(3, BackgroundComponent_Case_3_Template, 2, 11, ":svg:pattern", 2)(4, BackgroundComponent_Case_4_Template, 2, 10, ":svg:pattern", 2)(5, BackgroundComponent_Case_5_Template, 2, 10, ":svg:pattern", 2);
          ɵɵdomElementEnd();
          ɵɵdomElement(6, "rect", 1);
          ɵɵdomElementEnd();
        }
        if (rf & 2) {
          let tmp_3_0;
          ɵɵstyleProp("width", "100%")("height", "100%");
          ɵɵadvance();
          ɵɵconditional(ctx.bgColor() ? 1 : -1);
          ɵɵadvance(2);
          ɵɵconditional((tmp_3_0 = ctx.variant()) === "dots" ? 3 : tmp_3_0 === "lines" ? 4 : tmp_3_0 === "cross" ? 5 : -1);
          ɵɵadvance(3);
          ɵɵattribute("fill", "url(#" + ctx.patternId() + ")");
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BackgroundComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-background",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__background xy-flow__background xy-flow__container",
        "style": "display: block; position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none; z-index: -1;"
      },
      template: `
    <svg
      class="ng-flow__background-svg"
      [style.width]="'100%'"
      [style.height]="'100%'"
    >
      @if (bgColor()) {
        <rect x="0" y="0" width="100%" height="100%" [attr.fill]="bgColor()" />
      }
      <defs>
        @switch (variant()) {
          @case ('dots') {
            <pattern
              [attr.id]="patternId()"
              [attr.x]="patternOffset().x"
              [attr.y]="patternOffset().y"
              [attr.width]="scaledGapX()"
              [attr.height]="scaledGapY()"
              patternUnits="userSpaceOnUse"
            >
              <circle
                [class]="'xy-flow__background-pattern dots ' + (patternClassName() ?? '')"
                [attr.cx]="size() * zoom()"
                [attr.cy]="size() * zoom()"
                [attr.r]="size() * zoom()"
                [attr.fill]="color()"
              />
            </pattern>
          }
          @case ('lines') {
            <pattern
              [attr.id]="patternId()"
              [attr.x]="patternOffset().x"
              [attr.y]="patternOffset().y"
              [attr.width]="scaledGapX()"
              [attr.height]="scaledGapY()"
              patternUnits="userSpaceOnUse"
            >
              <path
                [class]="'xy-flow__background-pattern lines ' + (patternClassName() ?? '')"
                [attr.stroke]="color()"
                [attr.stroke-width]="resolvedLineWidth() * zoom()"
                [attr.d]="'M ' + scaledGapX() + ' 0 L 0 0 0 ' + scaledGapY()"
              />
            </pattern>
          }
          @case ('cross') {
            <pattern
              [attr.id]="patternId()"
              [attr.x]="patternOffset().x"
              [attr.y]="patternOffset().y"
              [attr.width]="scaledGapX()"
              [attr.height]="scaledGapY()"
              patternUnits="userSpaceOnUse"
            >
              <path
                [class]="'xy-flow__background-pattern cross ' + (patternClassName() ?? '')"
                [attr.stroke]="color()"
                [attr.stroke-width]="resolvedLineWidth() * zoom()"
                [attr.d]="crossPath()"
              />
            </pattern>
          }
        }
      </defs>
      <rect
        x="0" y="0" width="100%" height="100%"
        [attr.fill]="'url(#' + patternId() + ')'"
      />
    </svg>
  `
    }]
  }], null, {
    variant: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "variant",
        required: false
      }]
    }],
    gap: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "gap",
        required: false
      }]
    }],
    size: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "size",
        required: false
      }]
    }],
    lineWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "lineWidth",
        required: false
      }]
    }],
    offset: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "offset",
        required: false
      }]
    }],
    color: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "color",
        required: false
      }]
    }],
    bgColor: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "bgColor",
        required: false
      }]
    }],
    patternClassName: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "patternClassName",
        required: false
      }]
    }],
    bgId: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "id",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/controls/controls.component.js
var _c09 = ["*"];
function ControlsComponent_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "button", 4);
    ɵɵlistener("click", function ControlsComponent_Conditional_2_Template_button_click_0_listener() {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onZoomIn());
    });
    ɵɵnamespaceSVG();
    ɵɵelementStart(1, "svg", 5);
    ɵɵelement(2, "path", 6);
    ɵɵelementEnd()();
    ɵɵnamespaceHTML();
    ɵɵelementStart(3, "button", 7);
    ɵɵlistener("click", function ControlsComponent_Conditional_2_Template_button_click_3_listener() {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onZoomOut());
    });
    ɵɵnamespaceSVG();
    ɵɵelementStart(4, "svg", 5);
    ɵɵelement(5, "path", 8);
    ɵɵelementEnd()();
  }
}
function ControlsComponent_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "button", 9);
    ɵɵlistener("click", function ControlsComponent_Conditional_3_Template_button_click_0_listener() {
      ɵɵrestoreView(_r3);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onFitView());
    });
    ɵɵnamespaceSVG();
    ɵɵelementStart(1, "svg", 5);
    ɵɵelement(2, "path", 10);
    ɵɵelementEnd()();
  }
}
function ControlsComponent_Conditional_4_Conditional_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵelementStart(0, "svg", 12);
    ɵɵelement(1, "path", 13);
    ɵɵelementEnd();
  }
}
function ControlsComponent_Conditional_4_Conditional_2_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵelementStart(0, "svg", 12);
    ɵɵelement(1, "path", 14);
    ɵɵelementEnd();
  }
}
function ControlsComponent_Conditional_4_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "button", 11);
    ɵɵlistener("click", function ControlsComponent_Conditional_4_Template_button_click_0_listener() {
      ɵɵrestoreView(_r4);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onToggleLock());
    });
    ɵɵconditionalCreate(1, ControlsComponent_Conditional_4_Conditional_1_Template, 2, 0, ":svg:svg", 12)(2, ControlsComponent_Conditional_4_Conditional_2_Template, 2, 0, ":svg:svg", 12);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = ɵɵnextContext();
    ɵɵattribute("aria-pressed", ctx_r1.isLocked());
    ɵɵadvance();
    ɵɵconditional(ctx_r1.isLocked() ? 1 : 2);
  }
}
var ControlsComponent = class _ControlsComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.ngFlowService = inject(NgFlowService);
    this.position = input("bottom-left", ...ngDevMode ? [{
      debugName: "position"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.showZoom = input(true, ...ngDevMode ? [{
      debugName: "showZoom"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.showFitView = input(true, ...ngDevMode ? [{
      debugName: "showFitView"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.showInteractive = input(true, ...ngDevMode ? [{
      debugName: "showInteractive"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.fitViewOptions = input(...ngDevMode ? [void 0, {
      debugName: "fitViewOptions"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.orientation = input("vertical", ...ngDevMode ? [{
      debugName: "orientation"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.ariaLabel = input("Angular Flow controls", ...ngDevMode ? [{
      debugName: "ariaLabel"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zoomInClick = output();
    this.zoomOutClick = output();
    this.fitViewClick = output();
    this.interactiveChange = output();
    this.isLocked = signal(false, ...ngDevMode ? [{
      debugName: "isLocked"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  onZoomIn() {
    this.ngFlowService.zoomIn();
    this.zoomInClick.emit();
  }
  onZoomOut() {
    this.ngFlowService.zoomOut();
    this.zoomOutClick.emit();
  }
  onFitView() {
    this.ngFlowService.fitView(this.fitViewOptions());
    this.fitViewClick.emit();
  }
  onToggleLock() {
    const locked = !this.isLocked();
    this.isLocked.set(locked);
    this.store.nodesDraggable.set(!locked);
    this.store.nodesConnectable.set(!locked);
    this.store.elementsSelectable.set(!locked);
    this.interactiveChange.emit(!locked);
  }
  static {
    this.ɵfac = function ControlsComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _ControlsComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _ControlsComponent,
      selectors: [["ng-flow-controls"]],
      inputs: {
        position: [1, "position"],
        showZoom: [1, "showZoom"],
        showFitView: [1, "showFitView"],
        showInteractive: [1, "showInteractive"],
        fitViewOptions: [1, "fitViewOptions"],
        orientation: [1, "orientation"],
        ariaLabel: [1, "ariaLabel"]
      },
      outputs: {
        zoomInClick: "zoomInClick",
        zoomOutClick: "zoomOutClick",
        fitViewClick: "fitViewClick",
        interactiveChange: "interactiveChange"
      },
      ngContentSelectors: _c09,
      decls: 6,
      vars: 7,
      consts: [[3, "position"], [1, "ng-flow__controls", "xy-flow__controls"], ["type", "button", "title", "fit view", "aria-label", "fit view", 1, "ng-flow__controls-button", "xy-flow__controls-button"], ["type", "button", "title", "toggle interactivity", "aria-label", "toggle interactivity", 1, "ng-flow__controls-button", "xy-flow__controls-button"], ["type", "button", "title", "zoom in", "aria-label", "zoom in", 1, "ng-flow__controls-button", "xy-flow__controls-button", 3, "click"], ["xmlns", "http://www.w3.org/2000/svg", "viewBox", "0 0 32 32", "aria-hidden", "true"], ["d", "M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z"], ["type", "button", "title", "zoom out", "aria-label", "zoom out", 1, "ng-flow__controls-button", "xy-flow__controls-button", 3, "click"], ["d", "M0 13.867h32v4.266H0z"], ["type", "button", "title", "fit view", "aria-label", "fit view", 1, "ng-flow__controls-button", "xy-flow__controls-button", 3, "click"], ["d", "M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94a.919.919 0 01-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z"], ["type", "button", "title", "toggle interactivity", "aria-label", "toggle interactivity", 1, "ng-flow__controls-button", "xy-flow__controls-button", 3, "click"], ["xmlns", "http://www.w3.org/2000/svg", "viewBox", "0 0 25 32", "aria-hidden", "true"], ["d", "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z"], ["d", "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z"]],
      template: function ControlsComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵelementStart(0, "ng-flow-panel", 0)(1, "div", 1);
          ɵɵconditionalCreate(2, ControlsComponent_Conditional_2_Template, 6, 0);
          ɵɵconditionalCreate(3, ControlsComponent_Conditional_3_Template, 3, 0, "button", 2);
          ɵɵconditionalCreate(4, ControlsComponent_Conditional_4_Template, 3, 2, "button", 3);
          ɵɵprojection(5);
          ɵɵelementEnd()();
        }
        if (rf & 2) {
          ɵɵproperty("position", ctx.position());
          ɵɵadvance();
          ɵɵclassProp("horizontal", ctx.orientation() === "horizontal");
          ɵɵattribute("aria-label", ctx.ariaLabel());
          ɵɵadvance();
          ɵɵconditional(ctx.showZoom() ? 2 : -1);
          ɵɵadvance();
          ɵɵconditional(ctx.showFitView() ? 3 : -1);
          ɵɵadvance();
          ɵɵconditional(ctx.showInteractive() ? 4 : -1);
        }
      },
      dependencies: [PanelComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ControlsComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-controls",
      standalone: true,
      imports: [PanelComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <ng-flow-panel [position]="position()">
      <div
        class="ng-flow__controls xy-flow__controls"
        [class.horizontal]="orientation() === 'horizontal'"
        [attr.aria-label]="ariaLabel()"
      >
        @if (showZoom()) {
          <button
            type="button"
            class="ng-flow__controls-button xy-flow__controls-button"
            title="zoom in"
            aria-label="zoom in"
            (click)="onZoomIn()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z"/></svg>
          </button>
          <button
            type="button"
            class="ng-flow__controls-button xy-flow__controls-button"
            title="zoom out"
            aria-label="zoom out"
            (click)="onZoomOut()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M0 13.867h32v4.266H0z"/></svg>
          </button>
        }
        @if (showFitView()) {
          <button
            type="button"
            class="ng-flow__controls-button xy-flow__controls-button"
            title="fit view"
            aria-label="fit view"
            (click)="onFitView()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94a.919.919 0 01-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z"/></svg>
          </button>
        }
        @if (showInteractive()) {
          <button
            type="button"
            class="ng-flow__controls-button xy-flow__controls-button"
            title="toggle interactivity"
            aria-label="toggle interactivity"
            [attr.aria-pressed]="isLocked()"
            (click)="onToggleLock()"
          >
            @if (isLocked()) {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32" aria-hidden="true"><path d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z"/></svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32" aria-hidden="true"><path d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z"/></svg>
            }
          </button>
        }
        <ng-content />
      </div>
    </ng-flow-panel>
  `
    }]
  }], null, {
    position: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "position",
        required: false
      }]
    }],
    showZoom: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "showZoom",
        required: false
      }]
    }],
    showFitView: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "showFitView",
        required: false
      }]
    }],
    showInteractive: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "showInteractive",
        required: false
      }]
    }],
    fitViewOptions: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "fitViewOptions",
        required: false
      }]
    }],
    orientation: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "orientation",
        required: false
      }]
    }],
    ariaLabel: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "ariaLabel",
        required: false
      }]
    }],
    zoomInClick: [{
      type: Output,
      args: ["zoomInClick"]
    }],
    zoomOutClick: [{
      type: Output,
      args: ["zoomOutClick"]
    }],
    fitViewClick: [{
      type: Output,
      args: ["fitViewClick"]
    }],
    interactiveChange: [{
      type: Output,
      args: ["interactiveChange"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/minimap/minimap.component.js
var _c010 = ["minimapContainer"];
var _forTrack03 = ($index, $item) => $item.id;
function MiniMapComponent_For_10_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = ɵɵgetCurrentView();
    ɵɵnamespaceSVG();
    ɵɵelementStart(0, "rect", 8);
    ɵɵlistener("click", function MiniMapComponent_For_10_Template_rect_click_0_listener($event) {
      const node_r2 = ɵɵrestoreView(_r1).$implicit;
      const ctx_r2 = ɵɵnextContext();
      return ɵɵresetView(ctx_r2.onMinimapNodeClick($event, node_r2));
    });
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const node_r2 = ctx.$implicit;
    const ctx_r2 = ɵɵnextContext();
    ɵɵclassMap(ctx_r2.getNodeClassName(node_r2));
    ɵɵattribute("x", node_r2.x)("y", node_r2.y)("width", node_r2.width)("height", node_r2.height)("rx", ctx_r2.nodeBorderRadius())("fill", ctx_r2.getNodeColor(node_r2))("stroke", ctx_r2.getNodeStrokeColor(node_r2))("stroke-width", ctx_r2.nodeStrokeWidth());
  }
}
function MiniMapComponent_Conditional_12_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵelement(0, "rect", 9)(1, "rect", 10);
  }
  if (rf & 2) {
    const ctx_r2 = ɵɵnextContext();
    ɵɵattribute("fill", ctx_r2.maskColor());
    ɵɵadvance();
    ɵɵattribute("x", ctx_r2.maskPosition().x)("y", ctx_r2.maskPosition().y)("width", ctx_r2.maskPosition().width)("height", ctx_r2.maskPosition().height);
  }
}
var MiniMapComponent = class _MiniMapComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.minimapContainerRef = viewChild("minimapContainer", ...ngDevMode ? [{
      debugName: "minimapContainerRef"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.position = input("bottom-right", ...ngDevMode ? [{
      debugName: "position"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.mmWidth = input(200, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "mmWidth"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "width"
    }));
    this.mmHeight = input(150, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "mmHeight"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "height"
    }));
    this.pannable = input(false, ...ngDevMode ? [{
      debugName: "pannable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zoomable = input(false, ...ngDevMode ? [{
      debugName: "zoomable"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zoomStep = input(10, ...ngDevMode ? [{
      debugName: "zoomStep"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.inversePan = input(false, ...ngDevMode ? [{
      debugName: "inversePan"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeColor = input("#e2e2e2", ...ngDevMode ? [{
      debugName: "nodeColor"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeStrokeColor = input("transparent", ...ngDevMode ? [{
      debugName: "nodeStrokeColor"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeClassName = input("", ...ngDevMode ? [{
      debugName: "nodeClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeBorderRadius = input(5, ...ngDevMode ? [{
      debugName: "nodeBorderRadius"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeStrokeWidth = input(2, ...ngDevMode ? [{
      debugName: "nodeStrokeWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeComponent = input(null, ...ngDevMode ? [{
      debugName: "nodeComponent"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.bgColor = input(...ngDevMode ? [void 0, {
      debugName: "bgColor"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.maskColor = input("rgba(240, 240, 240, 0.6)", ...ngDevMode ? [{
      debugName: "maskColor"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.maskStrokeColor = input(...ngDevMode ? [void 0, {
      debugName: "maskStrokeColor"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.maskStrokeWidth = input(6, ...ngDevMode ? [{
      debugName: "maskStrokeWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.offsetScale = input(5, ...ngDevMode ? [{
      debugName: "offsetScale"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.ariaLabel = input("Mini Map", ...ngDevMode ? [{
      debugName: "ariaLabel"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.minimapClick = output();
    this.minimapNodeClick = output();
    this.xyMinimap = null;
    this.animationFrameId = null;
    this.isDragging = false;
    this.boundOnMouseMove = this.onMinimapMouseMove.bind(this);
    this.boundOnMouseUp = this.onMinimapMouseUp.bind(this);
    this.minimapNodes = computed(() => {
      this.store.version();
      const nodes = Array.from(this.store.nodeLookup.values());
      return nodes.map((node) => ({
        id: node.id,
        x: node.internals?.positionAbsolute?.x ?? 0,
        y: node.internals?.positionAbsolute?.y ?? 0,
        width: node.measured?.width ?? node.width ?? 150,
        height: node.measured?.height ?? node.height ?? 40,
        _userNode: node.internals?.userNode
      }));
    }, ...ngDevMode ? [{
      debugName: "minimapNodes"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.viewBox = computed(() => {
      this.store.version();
      const bounds = this.computeBounds();
      const padding = 20;
      return `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;
    }, ...ngDevMode ? [{
      debugName: "viewBox"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.maskPosition = computed(() => {
      const t = this.store.transform();
      const w = this.store.width();
      const h = this.store.height();
      return {
        x: -t[0] / t[2],
        y: -t[1] / t[2],
        width: w / t[2],
        height: h / t[2]
      };
    }, ...ngDevMode ? [{
      debugName: "maskPosition"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  getNodeColor(node) {
    const color = this.nodeColor();
    if (typeof color === "function" && node._userNode) {
      return color(node._userNode);
    }
    return typeof color === "string" ? color : "#e2e2e2";
  }
  getNodeStrokeColor(node) {
    const strokeColor = this.nodeStrokeColor();
    if (typeof strokeColor === "function" && node._userNode) {
      return strokeColor(node._userNode);
    }
    return typeof strokeColor === "string" ? strokeColor : "transparent";
  }
  getNodeClassName(node) {
    const className = this.nodeClassName();
    if (typeof className === "function" && node._userNode) {
      return className(node._userNode);
    }
    return typeof className === "string" ? className : "";
  }
  ngAfterViewInit() {
  }
  onMinimapClick(event) {
    const container = this.minimapContainerRef()?.nativeElement;
    if (!container) return;
    const svgEl = container.querySelector("svg");
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const bounds = this.computeBounds();
    const padding = 20;
    const vbX = bounds.x - padding;
    const vbY = bounds.y - padding;
    const vbW = bounds.width + padding * 2;
    const vbH = bounds.height + padding * 2;
    const flowX = vbX + clickX / this.mmWidth() * vbW;
    const flowY = vbY + clickY / this.mmHeight() * vbH;
    this.minimapClick.emit({
      event,
      position: {
        x: flowX,
        y: flowY
      }
    });
    if (!this.pannable()) return;
    const zoom = this.store.transform()[2];
    const newX = this.store.width() / 2 - flowX * zoom;
    const newY = this.store.height() / 2 - flowY * zoom;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    const startX = this.store.transform()[0];
    const startY = this.store.transform()[1];
    const startTime = performance.now();
    const duration = 300;
    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const currentX = startX + (newX - startX) * ease;
      const currentY = startY + (newY - startY) * ease;
      this.store.transform.set([currentX, currentY, zoom]);
      this.store.bumpVersion();
      if (t < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
        try {
          this.store.panZoom()?.syncViewport({
            x: newX,
            y: newY,
            zoom
          });
        } catch {
        }
      }
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }
  onMinimapMouseDown(event) {
    if (!this.pannable()) return;
    this.isDragging = true;
    document.addEventListener("mousemove", this.boundOnMouseMove);
    document.addEventListener("mouseup", this.boundOnMouseUp);
  }
  onMinimapMouseMove(event) {
    if (!this.isDragging) return;
    const container = this.minimapContainerRef()?.nativeElement;
    if (!container) return;
    const svgEl = container.querySelector("svg");
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const bounds = this.computeBounds();
    const padding = 20;
    const vbX = bounds.x - padding;
    const vbY = bounds.y - padding;
    const vbW = bounds.width + padding * 2;
    const vbH = bounds.height + padding * 2;
    const flowX = vbX + clickX / this.mmWidth() * vbW;
    const flowY = vbY + clickY / this.mmHeight() * vbH;
    const zoom = this.store.transform()[2];
    const newX = this.store.width() / 2 - flowX * zoom;
    const newY = this.store.height() / 2 - flowY * zoom;
    this.store.transform.set([newX, newY, zoom]);
    this.store.bumpVersion();
    try {
      this.store.panZoom()?.syncViewport({
        x: newX,
        y: newY,
        zoom
      });
    } catch {
    }
  }
  onMinimapMouseUp() {
    this.isDragging = false;
    document.removeEventListener("mousemove", this.boundOnMouseMove);
    document.removeEventListener("mouseup", this.boundOnMouseUp);
  }
  onMinimapWheel(event) {
    if (!this.zoomable()) return;
    event.preventDefault();
    const currentZoom = this.store.transform()[2];
    const delta = -event.deltaY * (this.zoomStep() / 1e3);
    const nextZoom = Math.min(this.store.maxZoom(), Math.max(this.store.minZoom(), currentZoom + delta));
    const [x, y] = this.store.transform();
    const cx = this.store.width() / 2;
    const cy = this.store.height() / 2;
    const scale = nextZoom / currentZoom;
    const newX = cx - (cx - x) * scale;
    const newY = cy - (cy - y) * scale;
    this.store.transform.set([newX, newY, nextZoom]);
    this.store.bumpVersion();
    try {
      this.store.panZoom()?.syncViewport({
        x: newX,
        y: newY,
        zoom: nextZoom
      });
    } catch {
    }
  }
  onMinimapNodeClick(event, node) {
    event.stopPropagation();
    if (node._userNode) {
      this.minimapNodeClick.emit({
        event,
        node: node._userNode
      });
    }
  }
  ngOnDestroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    document.removeEventListener("mousemove", this.boundOnMouseMove);
    document.removeEventListener("mouseup", this.boundOnMouseUp);
    this.xyMinimap?.destroy();
  }
  computeBounds() {
    const nodes = this.minimapNodes();
    if (nodes.length === 0) return {
      x: 0,
      y: 0,
      width: 200,
      height: 150
    };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  static {
    this.ɵfac = function MiniMapComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _MiniMapComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _MiniMapComponent,
      selectors: [["ng-flow-minimap"]],
      viewQuery: function MiniMapComponent_Query(rf, ctx) {
        if (rf & 1) {
          ɵɵviewQuerySignal(ctx.minimapContainerRef, _c010, 5);
        }
        if (rf & 2) {
          ɵɵqueryAdvance();
        }
      },
      inputs: {
        position: [1, "position"],
        mmWidth: [1, "width", "mmWidth"],
        mmHeight: [1, "height", "mmHeight"],
        pannable: [1, "pannable"],
        zoomable: [1, "zoomable"],
        zoomStep: [1, "zoomStep"],
        inversePan: [1, "inversePan"],
        nodeColor: [1, "nodeColor"],
        nodeStrokeColor: [1, "nodeStrokeColor"],
        nodeClassName: [1, "nodeClassName"],
        nodeBorderRadius: [1, "nodeBorderRadius"],
        nodeStrokeWidth: [1, "nodeStrokeWidth"],
        nodeComponent: [1, "nodeComponent"],
        bgColor: [1, "bgColor"],
        maskColor: [1, "maskColor"],
        maskStrokeColor: [1, "maskStrokeColor"],
        maskStrokeWidth: [1, "maskStrokeWidth"],
        offsetScale: [1, "offsetScale"],
        ariaLabel: [1, "ariaLabel"]
      },
      outputs: {
        minimapClick: "minimapClick",
        minimapNodeClick: "minimapNodeClick"
      },
      decls: 13,
      vars: 22,
      consts: [["minimapContainer", ""], [3, "position"], [1, "ng-flow__minimap", "xy-flow__minimap", 2, "border-radius", "4px", "overflow", "hidden", "border", "1px solid #ddd", "box-shadow", "0 1px 4px rgba(0,0,0,0.1)", "cursor", "pointer", 3, "click", "mousedown", "wheel"], [1, "xy-flow__minimap-svg"], ["x", "-10000", "y", "-10000", "width", "20000", "height", "20000"], ["fill", "#fff"], [1, "xy-flow__minimap-node", 3, "class"], ["fill", "none", "rx", "2"], [1, "xy-flow__minimap-node", 3, "click"], ["x", "-10000", "y", "-10000", "width", "20000", "height", "20000", 2, "pointer-events", "none"], ["fill", "#fff", 2, "pointer-events", "none"]],
      template: function MiniMapComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵelementStart(0, "ng-flow-panel", 1)(1, "div", 2, 0);
          ɵɵlistener("click", function MiniMapComponent_Template_div_click_1_listener($event) {
            return ctx.onMinimapClick($event);
          })("mousedown", function MiniMapComponent_Template_div_mousedown_1_listener($event) {
            return ctx.onMinimapMouseDown($event);
          })("wheel", function MiniMapComponent_Template_div_wheel_1_listener($event) {
            return ctx.onMinimapWheel($event);
          });
          ɵɵnamespaceSVG();
          ɵɵelementStart(3, "svg", 3);
          ɵɵelement(4, "rect", 4);
          ɵɵelementStart(5, "defs")(6, "clipPath");
          ɵɵelement(7, "rect", 4);
          ɵɵelementEnd()();
          ɵɵelement(8, "rect", 5);
          ɵɵrepeaterCreate(9, MiniMapComponent_For_10_Template, 1, 10, ":svg:rect", 6, _forTrack03);
          ɵɵelement(11, "rect", 7);
          ɵɵconditionalCreate(12, MiniMapComponent_Conditional_12_Template, 2, 5);
          ɵɵelementEnd()()();
        }
        if (rf & 2) {
          ɵɵproperty("position", ctx.position());
          ɵɵadvance();
          ɵɵstyleProp("width", ctx.mmWidth(), "px")("height", ctx.mmHeight(), "px");
          ɵɵattribute("aria-label", ctx.ariaLabel());
          ɵɵadvance(2);
          ɵɵattribute("width", ctx.mmWidth())("height", ctx.mmHeight())("viewBox", ctx.viewBox());
          ɵɵadvance();
          ɵɵattribute("fill", ctx.bgColor() ?? "#f0f0f0");
          ɵɵadvance(2);
          ɵɵattribute("id", "minimap-mask-" + ctx.store.rfId());
          ɵɵadvance(2);
          ɵɵattribute("x", ctx.maskPosition().x)("y", ctx.maskPosition().y)("width", ctx.maskPosition().width)("height", ctx.maskPosition().height);
          ɵɵadvance();
          ɵɵrepeater(ctx.minimapNodes());
          ɵɵadvance(2);
          ɵɵattribute("x", ctx.maskPosition().x)("y", ctx.maskPosition().y)("width", ctx.maskPosition().width)("height", ctx.maskPosition().height)("stroke", ctx.maskStrokeColor() ?? "rgba(0,89,220,0.6)")("stroke-width", ctx.maskStrokeWidth());
          ɵɵadvance();
          ɵɵconditional(ctx.maskColor() ? 12 : -1);
        }
      },
      dependencies: [PanelComponent],
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MiniMapComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-minimap",
      standalone: true,
      imports: [PanelComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
    <ng-flow-panel [position]="position()">
      <div
        class="ng-flow__minimap xy-flow__minimap"
        #minimapContainer
        [attr.aria-label]="ariaLabel()"
        [style.width.px]="mmWidth()"
        [style.height.px]="mmHeight()"
        style="border-radius: 4px; overflow: hidden; border: 1px solid #ddd; box-shadow: 0 1px 4px rgba(0,0,0,0.1); cursor: pointer;"
        (click)="onMinimapClick($event)"
        (mousedown)="onMinimapMouseDown($event)"
        (wheel)="onMinimapWheel($event)"
      >
        <svg
          class="xy-flow__minimap-svg"
          [attr.width]="mmWidth()"
          [attr.height]="mmHeight()"
          [attr.viewBox]="viewBox()"
        >
          <!-- Background -->
          <rect x="-10000" y="-10000" width="20000" height="20000" [attr.fill]="bgColor() ?? '#f0f0f0'" />
          <!-- Mask: dim area outside viewport -->
          <defs>
            <clipPath [attr.id]="'minimap-mask-' + store.rfId()">
              <rect x="-10000" y="-10000" width="20000" height="20000" />
            </clipPath>
          </defs>
          <!-- Viewport window (bright area) -->
          <rect
            [attr.x]="maskPosition().x"
            [attr.y]="maskPosition().y"
            [attr.width]="maskPosition().width"
            [attr.height]="maskPosition().height"
            fill="#fff"
          />
          <!-- Nodes -->
          @for (node of minimapNodes(); track node.id) {
            <rect
              class="xy-flow__minimap-node"
              [class]="getNodeClassName(node)"
              [attr.x]="node.x"
              [attr.y]="node.y"
              [attr.width]="node.width"
              [attr.height]="node.height"
              [attr.rx]="nodeBorderRadius()"
              [attr.fill]="getNodeColor(node)"
              [attr.stroke]="getNodeStrokeColor(node)"
              [attr.stroke-width]="nodeStrokeWidth()"
              (click)="onMinimapNodeClick($event, node)"
            />
          }
          <!-- Viewport outline -->
          <rect
            [attr.x]="maskPosition().x"
            [attr.y]="maskPosition().y"
            [attr.width]="maskPosition().width"
            [attr.height]="maskPosition().height"
            fill="none"
            [attr.stroke]="maskStrokeColor() ?? 'rgba(0,89,220,0.6)'"
            [attr.stroke-width]="maskStrokeWidth()"
            rx="2"
          />
          <!-- Mask overlay (dim non-viewport area) -->
          @if (maskColor()) {
            <rect x="-10000" y="-10000" width="20000" height="20000"
              [attr.fill]="maskColor()"
              style="pointer-events: none;"
            />
            <rect
              [attr.x]="maskPosition().x"
              [attr.y]="maskPosition().y"
              [attr.width]="maskPosition().width"
              [attr.height]="maskPosition().height"
              fill="#fff"
              style="pointer-events: none;"
            />
          }
        </svg>
      </div>
    </ng-flow-panel>
  `
    }]
  }], null, {
    minimapContainerRef: [{
      type: ViewChild,
      args: ["minimapContainer", {
        isSignal: true
      }]
    }],
    position: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "position",
        required: false
      }]
    }],
    mmWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "width",
        required: false
      }]
    }],
    mmHeight: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "height",
        required: false
      }]
    }],
    pannable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "pannable",
        required: false
      }]
    }],
    zoomable: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zoomable",
        required: false
      }]
    }],
    zoomStep: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "zoomStep",
        required: false
      }]
    }],
    inversePan: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "inversePan",
        required: false
      }]
    }],
    nodeColor: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeColor",
        required: false
      }]
    }],
    nodeStrokeColor: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeStrokeColor",
        required: false
      }]
    }],
    nodeClassName: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeClassName",
        required: false
      }]
    }],
    nodeBorderRadius: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeBorderRadius",
        required: false
      }]
    }],
    nodeStrokeWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeStrokeWidth",
        required: false
      }]
    }],
    nodeComponent: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeComponent",
        required: false
      }]
    }],
    bgColor: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "bgColor",
        required: false
      }]
    }],
    maskColor: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "maskColor",
        required: false
      }]
    }],
    maskStrokeColor: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "maskStrokeColor",
        required: false
      }]
    }],
    maskStrokeWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "maskStrokeWidth",
        required: false
      }]
    }],
    offsetScale: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "offsetScale",
        required: false
      }]
    }],
    ariaLabel: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "ariaLabel",
        required: false
      }]
    }],
    minimapClick: [{
      type: Output,
      args: ["minimapClick"]
    }],
    minimapNodeClick: [{
      type: Output,
      args: ["minimapNodeClick"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/node-toolbar/node-toolbar.component.js
var _c011 = ["*"];
var NodeToolbarComponent = class _NodeToolbarComponent {
  constructor(nodeId) {
    this.store = inject(FlowStore);
    this.nodeIdInput = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "nodeIdInput"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "nodeId"
    }));
    this.position = input(Position.Top, ...ngDevMode ? [{
      debugName: "position"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isVisible = input(...ngDevMode ? [void 0, {
      debugName: "isVisible"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.offset = input(10, ...ngDevMode ? [{
      debugName: "offset"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.align = input("center", ...ngDevMode ? [{
      debugName: "align"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.contextNodeId = "";
    this.resolvedNodeIds = computed(() => {
      const inputId = this.nodeIdInput();
      if (inputId !== void 0) {
        return Array.isArray(inputId) ? inputId : [inputId];
      }
      return this.contextNodeId ? [this.contextNodeId] : [];
    }, ...ngDevMode ? [{
      debugName: "resolvedNodeIds"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.shouldShow = computed(() => {
      this.store.version();
      if (this.isVisible() !== void 0) return this.isVisible();
      const ids = this.resolvedNodeIds();
      return ids.some((id) => {
        const node = this.store.nodeLookup.get(id);
        return node?.selected ?? false;
      });
    }, ...ngDevMode ? [{
      debugName: "shouldShow"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.toolbarTransform = computed(() => {
      const ids = this.resolvedNodeIds();
      if (ids.length === 0) return "";
      const node = this.store.nodeLookup.get(ids[0]);
      if (!node) return "";
      const w = node.measured?.width ?? node.width ?? 0;
      const h = node.measured?.height ?? node.height ?? 0;
      const pos = this.position();
      const off = this.offset();
      const alignVal = this.align();
      let alignTranslate;
      switch (pos) {
        case Position.Top:
        case Position.Bottom: {
          const xOffset = alignVal === "start" ? 0 : alignVal === "end" ? w : w / 2;
          const xTranslate = alignVal === "start" ? "0" : alignVal === "end" ? "-100%" : "-50%";
          if (pos === Position.Top) {
            return `translate(${xOffset}px, ${-off}px) translate(${xTranslate}, -100%)`;
          }
          return `translate(${xOffset}px, ${h + off}px) translate(${xTranslate}, 0)`;
        }
        case Position.Left:
        case Position.Right: {
          const yOffset = alignVal === "start" ? 0 : alignVal === "end" ? h : h / 2;
          const yTranslate = alignVal === "start" ? "0" : alignVal === "end" ? "-100%" : "-50%";
          if (pos === Position.Left) {
            return `translate(${-off}px, ${yOffset}px) translate(-100%, ${yTranslate})`;
          }
          return `translate(${w + off}px, ${yOffset}px) translate(0, ${yTranslate})`;
        }
        default:
          return "";
      }
    }, ...ngDevMode ? [{
      debugName: "toolbarTransform"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.contextNodeId = nodeId ?? "";
  }
  static {
    this.ɵfac = function NodeToolbarComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NodeToolbarComponent)(ɵɵdirectiveInject(NODE_ID, 8));
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _NodeToolbarComponent,
      selectors: [["ng-flow-node-toolbar"]],
      hostVars: 17,
      hostBindings: function NodeToolbarComponent_HostBindings(rf, ctx) {
        if (rf & 2) {
          ɵɵattribute("data-id", ctx.resolvedNodeIds()[0]);
          ɵɵclassMap(ctx.shouldShow() ? "ng-flow__node-toolbar xy-flow__node-toolbar" : "");
          ɵɵstyleProp("position", "absolute")("left", 0, "px")("top", 0, "px")("pointer-events", ctx.shouldShow() ? "all" : "none")("z-index", 1e3)("display", ctx.shouldShow() ? "block" : "none")("transform", ctx.toolbarTransform());
        }
      },
      inputs: {
        nodeIdInput: [1, "nodeId", "nodeIdInput"],
        position: [1, "position"],
        isVisible: [1, "isVisible"],
        offset: [1, "offset"],
        align: [1, "align"]
      },
      ngContentSelectors: _c011,
      decls: 1,
      vars: 0,
      template: function NodeToolbarComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NodeToolbarComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-node-toolbar",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "[attr.data-id]": "resolvedNodeIds()[0]",
        "[class]": 'shouldShow() ? "ng-flow__node-toolbar xy-flow__node-toolbar" : ""',
        "[style.position]": '"absolute"',
        "[style.left.px]": "0",
        "[style.top.px]": "0",
        "[style.pointer-events]": 'shouldShow() ? "all" : "none"',
        "[style.z-index]": "1000",
        "[style.display]": 'shouldShow() ? "block" : "none"',
        "[style.transform]": "toolbarTransform()"
      },
      template: `<ng-content />`
    }]
  }], () => [{
    type: void 0,
    decorators: [{
      type: Optional
    }, {
      type: Inject,
      args: [NODE_ID]
    }]
  }], {
    nodeIdInput: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeId",
        required: false
      }]
    }],
    position: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "position",
        required: false
      }]
    }],
    isVisible: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isVisible",
        required: false
      }]
    }],
    offset: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "offset",
        required: false
      }]
    }],
    align: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "align",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/edge-toolbar/edge-toolbar.component.js
var _c012 = ["*"];
var EdgeToolbarComponent = class _EdgeToolbarComponent {
  constructor() {
    this.store = inject(FlowStore);
    this.edgeId = input.required(...ngDevMode ? [{
      debugName: "edgeId"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.x = input.required(...ngDevMode ? [{
      debugName: "x"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.y = input.required(...ngDevMode ? [{
      debugName: "y"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.alignX = input("center", ...ngDevMode ? [{
      debugName: "alignX"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.alignY = input("center", ...ngDevMode ? [{
      debugName: "alignY"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isVisible = input(void 0, ...ngDevMode ? [{
      debugName: "isVisible"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.shouldShow = computed(() => {
      const vis = this.isVisible();
      if (vis !== void 0) return vis;
      const edge = this.store.edges().find((e) => e.id === this.edgeId());
      return edge?.selected ?? false;
    }, ...ngDevMode ? [{
      debugName: "shouldShow"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.zIndex = computed(() => {
      const edge = this.store.edges().find((e) => e.id === this.edgeId());
      return (edge?.zIndex ?? 0) + 1;
    }, ...ngDevMode ? [{
      debugName: "zIndex"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.toolbarTransform = computed(() => {
      const [tx, ty, zoom] = this.store.transform();
      const vx = this.x() * zoom + tx;
      const vy = this.y() * zoom + ty;
      return getEdgeToolbarTransform(vx, vy, zoom, this.alignX(), this.alignY());
    }, ...ngDevMode ? [{
      debugName: "toolbarTransform"
    }] : (
      /* istanbul ignore next */
      []
    ));
  }
  static {
    this.ɵfac = function EdgeToolbarComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _EdgeToolbarComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _EdgeToolbarComponent,
      selectors: [["ng-flow-edge-toolbar"]],
      hostAttrs: [1, "ng-flow__edge-toolbar", "xy-flow__edge-toolbar"],
      hostVars: 12,
      hostBindings: function EdgeToolbarComponent_HostBindings(rf, ctx) {
        if (rf & 2) {
          ɵɵstyleProp("display", ctx.shouldShow() ? "block" : "none")("position", "absolute")("transform", ctx.toolbarTransform())("transform-origin", "0 0")("z-index", ctx.zIndex())("pointer-events", "all");
        }
      },
      inputs: {
        edgeId: [1, "edgeId"],
        x: [1, "x"],
        y: [1, "y"],
        alignX: [1, "alignX"],
        alignY: [1, "alignY"],
        isVisible: [1, "isVisible"]
      },
      ngContentSelectors: _c012,
      decls: 1,
      vars: 0,
      template: function EdgeToolbarComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef();
          ɵɵprojection(0);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(EdgeToolbarComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-edge-toolbar",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__edge-toolbar xy-flow__edge-toolbar",
        "[style.display]": 'shouldShow() ? "block" : "none"',
        "[style.position]": '"absolute"',
        "[style.transform]": "toolbarTransform()",
        "[style.transform-origin]": '"0 0"',
        "[style.z-index]": "zIndex()",
        "[style.pointer-events]": '"all"'
      },
      template: `<ng-content />`
    }]
  }], null, {
    edgeId: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "edgeId",
        required: true
      }]
    }],
    x: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "x",
        required: true
      }]
    }],
    y: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "y",
        required: true
      }]
    }],
    alignX: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "alignX",
        required: false
      }]
    }],
    alignY: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "alignY",
        required: false
      }]
    }],
    isVisible: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isVisible",
        required: false
      }]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/components/node-resizer/node-resizer.component.js
var NodeResizerComponent = class _NodeResizerComponent {
  constructor(nodeId) {
    this.store = inject(FlowStore);
    this.el = inject(ElementRef);
    this.nodeIdInput = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "nodeIdInput"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "nodeId"
    }));
    this.minWidth = input(10, ...ngDevMode ? [{
      debugName: "minWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.minHeight = input(10, ...ngDevMode ? [{
      debugName: "minHeight"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.maxWidth = input(Infinity, ...ngDevMode ? [{
      debugName: "maxWidth"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.maxHeight = input(Infinity, ...ngDevMode ? [{
      debugName: "maxHeight"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.keepAspectRatio = input(false, ...ngDevMode ? [{
      debugName: "keepAspectRatio"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.isVisible = input(void 0, ...ngDevMode ? [{
      debugName: "isVisible"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.color = input(...ngDevMode ? [void 0, {
      debugName: "color"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.handleClassName = input("", ...ngDevMode ? [{
      debugName: "handleClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.handleStyle = input(...ngDevMode ? [void 0, {
      debugName: "handleStyle"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.lineClassName = input("", ...ngDevMode ? [{
      debugName: "lineClassName"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.lineStyle = input(...ngDevMode ? [void 0, {
      debugName: "lineStyle"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.autoScale = input(true, ...ngDevMode ? [{
      debugName: "autoScale"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.shouldResize = input(...ngDevMode ? [void 0, {
      debugName: "shouldResize"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.onResizeStartCb = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "onResizeStartCb"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "onResizeStart"
    }));
    this.onResizeCb = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "onResizeCb"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "onResize"
    }));
    this.onResizeEndCb = input(void 0, __spreadProps(__spreadValues({}, ngDevMode ? {
      debugName: "onResizeEndCb"
    } : (
      /* istanbul ignore next */
      {}
    )), {
      alias: "onResizeEnd"
    }));
    this.resizeStart = output();
    this.resize = output();
    this.resizeEnd = output();
    this.nodeId = "";
    this.resizerInstances = [];
    this.effectivelyVisible = computed(() => {
      const explicit = this.isVisible();
      if (explicit !== void 0) return explicit;
      const nodes = this.store.nodes();
      const id = this.nodeIdInput() ?? this.nodeId;
      if (!id) return true;
      const node = nodes.find((n) => n.id === id);
      return node?.selected ?? false;
    }, ...ngDevMode ? [{
      debugName: "effectivelyVisible"
    }] : (
      /* istanbul ignore next */
      []
    ));
    this.nodeId = nodeId ?? "";
  }
  ngAfterViewInit() {
    const resolvedNodeId = this.nodeIdInput() ?? this.nodeId;
    const handles = Array.from(this.el.nativeElement.querySelectorAll(":scope > .xy-flow__resize-control"));
    const positions = ["top-left", "top-right", "bottom-left", "bottom-right", "top", "right", "bottom", "left"];
    handles.forEach((handle, index) => {
      const resizer = XYResizer({
        domNode: handle,
        nodeId: resolvedNodeId,
        getStoreItems: () => ({
          nodeLookup: this.store.nodeLookup,
          transform: this.store.transform(),
          snapGrid: this.store.snapToGrid() ? this.store.snapGrid() : void 0,
          snapToGrid: this.store.snapToGrid(),
          nodeOrigin: this.store.nodeOrigin(),
          paneDomNode: this.store.domNode()
        }),
        onChange: (change, childChanges) => {
          const nodeChanges = [];
          const nextPosition = {
            x: change.x,
            y: change.y
          };
          if (nextPosition.x !== void 0 && nextPosition.y !== void 0) {
            nodeChanges.push({
              id: resolvedNodeId,
              type: "position",
              position: {
                x: nextPosition.x,
                y: nextPosition.y
              }
            });
          }
          if (change.width !== void 0 && change.height !== void 0) {
            nodeChanges.push({
              id: resolvedNodeId,
              type: "dimensions",
              resizing: true,
              setAttributes: true,
              dimensions: {
                width: change.width,
                height: change.height
              }
            });
          }
          for (const childChange of childChanges) {
            nodeChanges.push({
              id: childChange.id,
              type: "position",
              position: childChange.position
            });
          }
          if (nodeChanges.length > 0) {
            this.store.triggerNodeChanges(nodeChanges);
          }
          this.resize.emit({
            changes: change,
            childChanges
          });
        },
        onEnd: (change) => {
          this.store.triggerNodeChanges([{
            id: resolvedNodeId,
            type: "dimensions",
            resizing: false,
            dimensions: {
              width: change.width,
              height: change.height
            }
          }]);
          this.resizeEnd.emit({
            changes: change
          });
        }
      });
      resizer.update({
        controlPosition: positions[index],
        boundaries: {
          minWidth: this.minWidth(),
          minHeight: this.minHeight(),
          maxWidth: this.maxWidth(),
          maxHeight: this.maxHeight()
        },
        keepAspectRatio: this.keepAspectRatio(),
        onResizeStart: this.onResizeStartCb() ?? ((event, params) => {
          this.resizeStart.emit(__spreadValues({
            event
          }, params));
        }),
        onResize: this.onResizeCb() ?? ((event, params) => {
          this.resize.emit(__spreadValues({
            event
          }, params));
        }),
        onResizeEnd: this.onResizeEndCb() ?? ((event, params) => {
          this.resizeEnd.emit(__spreadValues({
            event
          }, params));
        }),
        shouldResize: this.shouldResize()
      });
      this.resizerInstances.push(resizer);
    });
  }
  ngOnDestroy() {
    this.resizerInstances.forEach((r) => r.destroy());
  }
  static {
    this.ɵfac = function NodeResizerComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NodeResizerComponent)(ɵɵdirectiveInject(NODE_ID, 8));
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _NodeResizerComponent,
      selectors: [["ng-flow-node-resizer"]],
      hostAttrs: [1, "ng-flow__node-resizer", "xy-flow__resize-control", 2, "position", "absolute", "inset", "0", "pointer-events", "none"],
      hostVars: 2,
      hostBindings: function NodeResizerComponent_HostBindings(rf, ctx) {
        if (rf & 2) {
          ɵɵstyleProp("display", ctx.effectivelyVisible() ? null : "none");
        }
      },
      inputs: {
        nodeIdInput: [1, "nodeId", "nodeIdInput"],
        minWidth: [1, "minWidth"],
        minHeight: [1, "minHeight"],
        maxWidth: [1, "maxWidth"],
        maxHeight: [1, "maxHeight"],
        keepAspectRatio: [1, "keepAspectRatio"],
        isVisible: [1, "isVisible"],
        color: [1, "color"],
        handleClassName: [1, "handleClassName"],
        handleStyle: [1, "handleStyle"],
        lineClassName: [1, "lineClassName"],
        lineStyle: [1, "lineStyle"],
        autoScale: [1, "autoScale"],
        shouldResize: [1, "shouldResize"],
        onResizeStartCb: [1, "onResizeStart", "onResizeStartCb"],
        onResizeCb: [1, "onResize", "onResizeCb"],
        onResizeEndCb: [1, "onResizeEnd", "onResizeEndCb"]
      },
      outputs: {
        resizeStart: "resizeStart",
        resize: "resize",
        resizeEnd: "resizeEnd"
      },
      decls: 8,
      vars: 144,
      consts: [[1, "xy-flow__resize-control", "nodrag", "handle", "handle-top-left", "top", "left"], [1, "xy-flow__resize-control", "nodrag", "handle", "handle-top-right", "top", "right"], [1, "xy-flow__resize-control", "nodrag", "handle", "handle-bottom-left", "bottom", "left"], [1, "xy-flow__resize-control", "nodrag", "handle", "handle-bottom-right", "bottom", "right"], [1, "xy-flow__resize-control", "nodrag", "line", "line-top", "top"], [1, "xy-flow__resize-control", "nodrag", "line", "line-right", "right"], [1, "xy-flow__resize-control", "nodrag", "line", "line-bottom", "bottom"], [1, "xy-flow__resize-control", "nodrag", "line", "line-left", "left"]],
      template: function NodeResizerComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵdomElement(0, "div", 0)(1, "div", 1)(2, "div", 2)(3, "div", 3)(4, "div", 4)(5, "div", 5)(6, "div", 6)(7, "div", 7);
        }
        if (rf & 2) {
          ɵɵclassMap(ctx.handleClassName());
          ɵɵstyleProp("position", "absolute")("top", "0")("left", "0")("cursor", "nw-resize")("pointer-events", "all")("width", 10, "px")("height", 10, "px")("background-color", ctx.color() ?? null);
          ɵɵadvance();
          ɵɵclassMap(ctx.handleClassName());
          ɵɵstyleProp("position", "absolute")("top", "0")("right", "0")("cursor", "ne-resize")("pointer-events", "all")("width", 10, "px")("height", 10, "px")("background-color", ctx.color() ?? null);
          ɵɵadvance();
          ɵɵclassMap(ctx.handleClassName());
          ɵɵstyleProp("position", "absolute")("bottom", "0")("left", "0")("cursor", "sw-resize")("pointer-events", "all")("width", 10, "px")("height", 10, "px")("background-color", ctx.color() ?? null);
          ɵɵadvance();
          ɵɵclassMap(ctx.handleClassName());
          ɵɵstyleProp("position", "absolute")("bottom", "0")("right", "0")("cursor", "se-resize")("pointer-events", "all")("width", 10, "px")("height", 10, "px")("background-color", ctx.color() ?? null);
          ɵɵadvance();
          ɵɵclassMap(ctx.lineClassName());
          ɵɵstyleProp("position", "absolute")("top", "0")("left", "0")("right", "0")("height", 2, "px")("cursor", "n-resize")("pointer-events", "all")("border-color", ctx.color() ?? null);
          ɵɵadvance();
          ɵɵclassMap(ctx.lineClassName());
          ɵɵstyleProp("position", "absolute")("top", "0")("right", "0")("bottom", "0")("width", 2, "px")("cursor", "e-resize")("pointer-events", "all")("border-color", ctx.color() ?? null);
          ɵɵadvance();
          ɵɵclassMap(ctx.lineClassName());
          ɵɵstyleProp("position", "absolute")("bottom", "0")("left", "0")("right", "0")("height", 2, "px")("cursor", "s-resize")("pointer-events", "all")("border-color", ctx.color() ?? null);
          ɵɵadvance();
          ɵɵclassMap(ctx.lineClassName());
          ɵɵstyleProp("position", "absolute")("top", "0")("left", "0")("bottom", "0")("width", 2, "px")("cursor", "w-resize")("pointer-events", "all")("border-color", ctx.color() ?? null);
        }
      },
      encapsulation: 2,
      changeDetection: 0
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NodeResizerComponent, [{
    type: Component,
    args: [{
      selector: "ng-flow-node-resizer",
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: {
        "class": "ng-flow__node-resizer xy-flow__resize-control",
        "style": "position: absolute; inset: 0; pointer-events: none;",
        "[style.display]": 'effectivelyVisible() ? null : "none"'
      },
      template: `
    <div
      class="xy-flow__resize-control nodrag handle handle-top-left top left"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.left]="'0'"
      [style.cursor]="'nw-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.background-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag handle handle-top-right top right"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.right]="'0'"
      [style.cursor]="'ne-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.background-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag handle handle-bottom-left bottom left"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.bottom]="'0'" [style.left]="'0'"
      [style.cursor]="'sw-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.background-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag handle handle-bottom-right bottom right"
      [class]="handleClassName()"
      [style.position]="'absolute'" [style.bottom]="'0'" [style.right]="'0'"
      [style.cursor]="'se-resize'" [style.pointer-events]="'all'"
      [style.width.px]="10" [style.height.px]="10"
      [style.background-color]="color() ?? null"
    ></div>
    <!-- Resize lines -->
    <div
      class="xy-flow__resize-control nodrag line line-top top"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.left]="'0'" [style.right]="'0'"
      [style.height.px]="2" [style.cursor]="'n-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag line line-right right"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.right]="'0'" [style.bottom]="'0'"
      [style.width.px]="2" [style.cursor]="'e-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag line line-bottom bottom"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.bottom]="'0'" [style.left]="'0'" [style.right]="'0'"
      [style.height.px]="2" [style.cursor]="'s-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
    <div
      class="xy-flow__resize-control nodrag line line-left left"
      [class]="lineClassName()"
      [style.position]="'absolute'" [style.top]="'0'" [style.left]="'0'" [style.bottom]="'0'"
      [style.width.px]="2" [style.cursor]="'w-resize'" [style.pointer-events]="'all'"
      [style.border-color]="color() ?? null"
    ></div>
  `
    }]
  }], () => [{
    type: void 0,
    decorators: [{
      type: Optional
    }, {
      type: Inject,
      args: [NODE_ID]
    }]
  }], {
    nodeIdInput: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "nodeId",
        required: false
      }]
    }],
    minWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "minWidth",
        required: false
      }]
    }],
    minHeight: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "minHeight",
        required: false
      }]
    }],
    maxWidth: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "maxWidth",
        required: false
      }]
    }],
    maxHeight: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "maxHeight",
        required: false
      }]
    }],
    keepAspectRatio: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "keepAspectRatio",
        required: false
      }]
    }],
    isVisible: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "isVisible",
        required: false
      }]
    }],
    color: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "color",
        required: false
      }]
    }],
    handleClassName: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "handleClassName",
        required: false
      }]
    }],
    handleStyle: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "handleStyle",
        required: false
      }]
    }],
    lineClassName: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "lineClassName",
        required: false
      }]
    }],
    lineStyle: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "lineStyle",
        required: false
      }]
    }],
    autoScale: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "autoScale",
        required: false
      }]
    }],
    shouldResize: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "shouldResize",
        required: false
      }]
    }],
    onResizeStartCb: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "onResizeStart",
        required: false
      }]
    }],
    onResizeCb: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "onResize",
        required: false
      }]
    }],
    onResizeEndCb: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "onResizeEnd",
        required: false
      }]
    }],
    resizeStart: [{
      type: Output,
      args: ["resizeStart"]
    }],
    resize: [{
      type: Output,
      args: ["resize"]
    }],
    resizeEnd: [{
      type: Output,
      args: ["resizeEnd"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/directives/drop-zone.directive.js
var NgFlowDropZoneDirective = class _NgFlowDropZoneDirective {
  constructor() {
    this.el = inject(ElementRef);
    this.flowService = inject(NgFlowService);
    this.nodeDrop = output();
    this.onDragOver = (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    };
    this.onDrop = (event) => {
      event.preventDefault();
      const flowPosition = this.flowService.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });
      const data = event.dataTransfer?.getData("application/json") ?? event.dataTransfer?.getData("text/plain") ?? null;
      this.nodeDrop.emit({
        event,
        flowPosition,
        data
      });
    };
  }
  ngOnInit() {
    const el = this.el.nativeElement;
    el.addEventListener("dragover", this.onDragOver);
    el.addEventListener("drop", this.onDrop);
  }
  ngOnDestroy() {
    const el = this.el.nativeElement;
    el.removeEventListener("dragover", this.onDragOver);
    el.removeEventListener("drop", this.onDrop);
  }
  static {
    this.ɵfac = function NgFlowDropZoneDirective_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NgFlowDropZoneDirective)();
    };
  }
  static {
    this.ɵdir = ɵɵdefineDirective({
      type: _NgFlowDropZoneDirective,
      selectors: [["", "ngFlowDropZone", ""]],
      outputs: {
        nodeDrop: "nodeDrop"
      }
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgFlowDropZoneDirective, [{
    type: Directive,
    args: [{
      selector: "[ngFlowDropZone]",
      standalone: true
    }]
  }], null, {
    nodeDrop: [{
      type: Output,
      args: ["nodeDrop"]
    }]
  });
})();

// ../../packages/angular/dist/esm/lib/utils/type-guards.js
function isNode(element) {
  return isNodeBase(element);
}
function isEdge(element) {
  return isEdgeBase(element);
}
export {
  A11yDescriptionsComponent,
  AttributionComponent,
  BackgroundComponent,
  BaseEdgeComponent,
  BezierEdgeComponent,
  ConnectionLineComponent,
  ConnectionLineType,
  ConnectionMode,
  ControlsComponent,
  DefaultNodeComponent,
  DragDirective,
  EDGE_ID,
  EdgeLabelRendererComponent,
  EdgeTextComponent,
  EdgeToolbarComponent,
  FlowStore,
  GroupNodeComponent,
  HandleComponent,
  InputNodeComponent,
  KeyHandlerDirective,
  MarkerType,
  MiniMapComponent,
  NODE_ID,
  NgFlowComponent,
  NgFlowDropZoneDirective,
  NgFlowNodeTypeDirective,
  NgFlowProviderComponent,
  NgFlowService,
  NodeResizerComponent,
  NodeToolbarComponent,
  OutputNodeComponent,
  PanOnScrollMode,
  PanelComponent,
  Position,
  SelectionMode,
  SimpleBezierEdgeComponent,
  SmoothStepEdgeComponent,
  StepEdgeComponent,
  StraightEdgeComponent,
  ViewportComponent,
  ViewportPortalComponent,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  getBezierEdgeCenter,
  getBezierPath,
  getConnectedEdges,
  getEdgeCenter,
  getEdgeToolbarTransform,
  getIncomers,
  getMarkerId,
  getNodeToolbarTransform,
  getNodesBounds,
  getOutgoers,
  getSmoothStepPath,
  getStraightPath,
  getViewportForBounds,
  infiniteExtent,
  isEdge,
  isEdgeBase,
  isNode,
  isNodeBase,
  reconnectEdge
};
//# sourceMappingURL=@angflow_angular.js.map
