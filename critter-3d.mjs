import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { motionPose3D } from "./critter-motion.mjs";

const SIZE = 8;
const BODY_LAYERS = 4;
const BODY_FRONT = BODY_LAYERS / 2;
const OUTLINE_ROUNDING = 0.5;
const GLOW = 0.5;
const OUTLINE_RADIUS = OUTLINE_ROUNDING * 0.48;

// Masks run from back to front. 0b0110 is the middle two layers.
const FULL = 0b1111;
const CORE = 0b0110;
const BACK = 0b0011;
const FRONT = 0b1100;
const NEAR_FRONT = 0b1110;
const NEAR_BACK = 0b0111;
const CENTER = 0b0100;

const TOP_DEPTH = {
  dome: [CORE, NEAR_FRONT, FULL, FULL],
  flat: [FULL, FULL, FULL, FULL],
  notch: [CORE, FULL, FULL, FULL],
  ears: [CORE, CORE, FULL, FULL],
  antennae: [CENTER, CORE, FULL, FULL],
  loaf: [NEAR_FRONT, FULL, FULL, FULL],
  crown: [FRONT, FULL, FULL, FULL],
  w: [BACK, NEAR_BACK, FULL, FULL],
  trident: [FRONT, FULL, FULL, FULL],
  dots: [CORE, NEAR_FRONT, FULL, FULL],
  handle: [CORE, CORE, FULL, FULL],
  lego: [CORE, FULL, FULL, FULL],
  "tail-l": [NEAR_BACK, FULL, FULL, FULL],
  "tail-r": [NEAR_BACK, FULL, FULL, FULL],
  "2tl": [NEAR_FRONT, FULL, FULL, FULL],
  "2tr": [NEAR_FRONT, FULL, FULL, FULL],
  "3tl": [CORE, NEAR_FRONT, FULL, FULL],
  "3tr": [CORE, NEAR_FRONT, FULL, FULL],
};

const BOTTOM_DEPTH = {
  flat: [FULL, FULL, FULL, FULL],
  round: [FULL, FULL, NEAR_FRONT, CORE],
  legs: [FULL, FULL, FULL, CORE],
  splayed: [FULL, FULL, FULL, NEAR_FRONT],
  tripod: [FULL, FULL, FULL, FRONT],
  tripod2: [FULL, FULL, CORE, FRONT],
  toes: [FULL, FULL, FULL, FRONT],
  "toes-a": [FULL, FULL, FULL, FRONT],
  "toes-b": [FULL, FULL, FULL, BACK],
  dots: [FULL, FULL, NEAR_BACK, CORE],
  "2bl": [FULL, FULL, FULL, NEAR_BACK],
  "2br": [FULL, FULL, FULL, NEAR_BACK],
  "3bl": [FULL, FULL, NEAR_BACK, CORE],
  "3br": [FULL, FULL, NEAR_BACK, CORE],
};

function topDepth(shape, row, column) {
  if (row === 0) {
    if (shape === "dots" && (column === 0 || column === 7)) return CENTER;
    if (shape === "trident" && (column === 3 || column === 4)) return BACK;
    if (shape === "crown" && column > 0 && column < 7) return CORE;
    if ((shape === "tail-l" && column === 0) || (shape === "tail-r" && column === 7)) return CENTER;
  }
  return TOP_DEPTH[shape][row];
}

function bottomDepth(shape, row, column) {
  if (row === 7) {
    const center = column === 3 || column === 4;
    if (shape.startsWith("tripod") && center) return BACK;
    if (shape === "toes" && center) return BACK;
    if (shape === "dots" && !center) return CENTER;
    if (shape === "toes-a") return column % 4 === 0 ? FRONT : BACK;
    if (shape === "toes-b") return column % 4 === 1 ? BACK : FRONT;
  }
  return BOTTOM_DEPTH[shape][row - 4];
}

function middleDepth(shape, column) {
  if (shape === "pinch" && (column === 1 || column === 6)) return CORE;
  if (shape === "narrow" && (column === 2 || column === 5)) return CORE;
  if ((shape === "bite-l" && column === 1) || (shape === "bite-r" && column === 6)) return NEAR_BACK;
  return FULL;
}

function bodyDepth(spec, grid, row, column) {
  // Keep a front face behind the eyes, including while they blink.
  if (grid[row][column] >= 2) return FULL;
  const depth = row < 4 ? topDepth(spec.top, row, column) : bottomDepth(spec.bottom, row, column);
  return row === 3 || row === 4 ? depth & middleDepth(spec.waist, column) : depth;
}

function silhouettePass(operation, output) {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      radius: { value: new THREE.Vector2() },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 radius;
      varying vec2 vUv;
      void main() {
        vec4 pixel = texture2D(tDiffuse, vUv);
        float alpha = pixel.a;
        for (int i = 0; i < 32; i++) {
          float angle = float(i) * 0.19634954;
          vec2 offset = vec2(cos(angle), sin(angle)) * radius;
          float neighbor = texture2D(tDiffuse, vUv + offset).a;
          alpha = ${operation}(alpha, neighbor);
        }
        gl_FragColor = ${output};
      }`,
  });
}

function placeVoxels(mesh, grid, depthAt) {
  const matrix = new THREE.Matrix4();
  const cells = [];
  for (let row = 0; row < SIZE; row++) {
    for (let column = 0; column < SIZE; column++) {
      if (!grid[row][column]) continue;
      const x = column + 0.5 - SIZE / 2;
      const y = SIZE - row - 0.5;
      const depth = depthAt(row, column);
      for (let layer = 0; layer < BODY_LAYERS; layer++) {
        if (!(depth & (1 << layer))) continue;
        mesh.setMatrixAt(cells.length, matrix.makeTranslation(x, y, layer + 0.5 - BODY_FRONT));
        cells.push(row * SIZE + column);
      }
    }
  }
  mesh.count = cells.length;
  mesh.instanceMatrix.needsUpdate = true;
  return cells;
}

function eyeGeometry(width, height, radius) {
  const x = width / 2, y = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -y);
  shape.lineTo(x - radius, -y);
  shape.quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius);
  shape.quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y);
  shape.quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius);
  shape.quadraticCurveTo(-x, -y, -x + radius, -y);
  return new THREE.ShapeGeometry(shape, 10);
}

function almondGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.97, 0);
  shape.quadraticCurveTo(0, 1.56, 0.97, 0);
  shape.quadraticCurveTo(0, -1.56, -0.97, 0);
  return new THREE.ShapeGeometry(shape, 20);
}

const VECTOR_EYES = {
  round: { pupil: [0.51, 0.51], travel: [0.31, 0.31] },
  oval: { opening: [0.77, 0.97], pupil: [0.44, 0.54], travel: [0.23, 0.31] },
  "soft-square": { sclera: () => eyeGeometry(1.94, 1.94, 0.48), pupil: [0.51, 0.51], travel: [0.31, 0.31] },
  wide: { opening: [0.97, 0.65], pupil: [0.37, 0.37], travel: [0.42, 0.18] },
  almond: { sclera: almondGeometry, pupil: [0.43, 0.43], travel: [0.27, 0.18] },
  sleepy: { sclera: () => eyeGeometry(1.94, 0.77, 0.25), pupil: [0.44, 0.30], travel: [0.36, 0.06] },
};
const ellipse = ([x, y]) => new THREE.CircleGeometry(1, 36).scale(x, y, 1);

function pixelEyeMaterial(center, height) {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  material.onBeforeCompile = shader => {
    shader.uniforms.pupilCenter = { value: center };
    shader.uniforms.pupilHalfHeight = { value: height / 2 };
    shader.vertexShader = "varying vec2 eyePosition;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\neyePosition = position.xy;"
    );
    shader.fragmentShader = "varying vec2 eyePosition; uniform vec2 pupilCenter; uniform float pupilHalfHeight;\n"
      + shader.fragmentShader.replace("#include <opaque_fragment>", `
        vec2 edge = abs(eyePosition - pupilCenter) - vec2(0.5, pupilHalfHeight);
        float distanceToPupil = max(edge.x, edge.y);
        float aa = max(fwidth(distanceToPupil) * 0.5, 0.0001);
        outgoingLight *= smoothstep(-aa, aa, distanceToPupil);
        #include <opaque_fragment>`);
  };
  return material;
}

function makeEyes(grid, spec, style = "round") {
  const row = grid.findIndex(row => row.some(cell => cell >= 2));
  const left = grid[row].findIndex(cell => cell >= 2);
  const eyes = [left, left + 2 + spec.eyes.gap];
  const pixel = style === "pixel";
  const bar = pixel && spec.eyes.pupil === "bar";
  const white = pixel ? null : new THREE.MeshBasicMaterial({ color: 0xffffff });
  const dark = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const vector = VECTOR_EYES[style] ?? VECTOR_EYES.round;
  const scleraGeometry = pixel ? eyeGeometry(2, 2, OUTLINE_RADIUS)
    : vector.sclera?.() ?? ellipse(vector.opening ?? [0.97, 0.97]);
  const pupilGeometry = pixel ? new THREE.PlaneGeometry(1, 2)
    : ellipse(vector.pupil);
  return eyes.map((column, index) => {
    const opening = new THREE.Group();
    // Draw the square pupil on the rounded face itself, so its corners are clipped
    // by the eye silhouette and there is no gap between the bar and the rim.
    const center = pixel ? new THREE.Vector2() : null;
    const sclera = new THREE.Mesh(scleraGeometry, pixel ? pixelEyeMaterial(center, bar ? 2.2 : 1) : white);
    const pupil = new THREE.Mesh(pupilGeometry, dark);
    pupil.position.z = 0.004;
    opening.add(sclera, pupil);
    const x = column + 1 - SIZE / 2, y = SIZE - row - 1;
    opening.position.set(x, y, BODY_FRONT + 0.004);
    return { opening, sclera, pupil, center, bar, pixel, travel: vector.travel, mirror: index === 1 && spec.eyes.mirror };
  });
}

function disposeEyes(eyes) {
  const materials = new Set();
  const geometries = new Set();
  for (const { opening } of eyes) {
    opening.removeFromParent();
    for (const mesh of opening.children) {
      geometries.add(mesh.geometry);
      materials.add(mesh.material);
    }
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function pupilPosition(eye, x, y) {
  const horizontal = eye.mirror ? -x : x;
  if (eye.pixel) return { x: horizontal * 0.5, y: eye.bar ? 0 : y * 0.5 };
  const length = Math.max(1, Math.hypot(horizontal, y));
  return { x: horizontal * eye.travel[0] / length, y: y * eye.travel[1] / length };
}

function makeAccessory(option) {
  const group = new THREE.Group();
  const scale = option.width / 24;
  const { paths } = new SVGLoader().parse(option.icon);
  paths.forEach((path, index) => {
    const shapes = SVGLoader.createShapes(path);
    const geometry = new THREE.ShapeGeometry(shapes, 12);
    geometry.translate(-12, -12, 0);
    geometry.scale(scale, -scale, 1);
    // Flipping SVG's Y axis reverses the triangle winding.
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: path.color, side: THREE.BackSide }));
    mesh.position.z = 0.005 * index;
    group.add(mesh);
  });
  return group;
}

function idleExpression(elapsed) {
  const time = elapsed % 5500;
  const ease = THREE.MathUtils.smoothstep;
  const right = ease(time, 590, 865) * (1 - ease(time, 1490, 1860));
  const left = ease(time, 3090, 3390) * (1 - ease(time, 3920, 4300));
  const blink = ease(time, 2210, 2290) * (1 - ease(time, 2310, 2435));
  const follow = ease(time, 740, 1130) * (1 - ease(time, 1510, 2040))
    - ease(time, 3250, 3630) * (1 - ease(time, 4020, 4530));
  return {
    x: -1 + 2 * right,
    y: 0.46 * right + 0.18 * left,
    open: 1 - 0.96 * blink,
    lean: follow * 0.038,
  };
}

function idleBreath(elapsed) {
  const phase = elapsed % 4300;
  const ease = THREE.MathUtils.smoothstep;
  return ease(phase, 0, 1520) * (1 - ease(phase, 1670, 3970));
}

export function createStage(host, avatar, shapePreviews, rasterize, restPaint) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearAlpha(0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.LinearToneMapping;
  const canvas = renderer.domElement;
  canvas.tabIndex = -1;
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("aria-label", "3D critter");
  canvas.setAttribute("aria-describedby", "orbitHint");

  const scene = new THREE.Scene();
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, 0.025).texture;
  scene.environmentIntensity = 0.32;
  environment.dispose();
  pmrem.dispose();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 110);
  camera.position.set(8.6, 7.5, 17);
  const avatarCamera = new THREE.OrthographicCamera(-4.42, 4.42, 4.42, -4.42, 0.1, 30);
  avatarCamera.position.set(0, 4.18, 17);
  avatarCamera.lookAt(0, 4.02, 0);
  const avatarContext = avatar.getContext("2d");
  const orbit = new OrbitControls(camera, canvas);
  orbit.target.set(0, 3.8, 0);
  orbit.enablePan = false;
  orbit.minPolarAngle = 0.56;
  orbit.maxPolarAngle = Math.PI / 2 - 0.06;
  orbit.minZoom = 0.75;
  orbit.maxZoom = 1.6;
  orbit.update();
  orbit.saveState();
  orbit.enabled = false;
  let orbitPose = { offset: new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target)), zoom: camera.zoom };
  let projection = 0, targetProjection = 0, transition = null;

  const key = new THREE.DirectionalLight(0xffffff, 1.65);
  key.position.set(-7, 12, 6);
  const rim = new THREE.DirectionalLight(0xf0f7ff, 1.35);
  rim.position.set(6, 7, -7);
  scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0x505050, 0.42));

  const gl = renderer.getContext();
  const supportedSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: supportedSamples.find(count => count <= 4) ?? 0,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), GLOW * 0.32, 0.63, 0.49);
  // Modulate the bloom by the destination color to keep pupils black.
  Object.assign(bloom.blendMaterial, {
    blending: THREE.CustomBlending,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  composer.addPass(bloom);
  // Erode then grow the alpha mask with a disk to soften outward corners.
  // Preserve the RGB buffer so the eyes and surface shading stay sharp.
  const erode = silhouettePass("min", "vec4(pixel.rgb, alpha)");
  const dilate = silhouettePass("max", "vec4(pixel.rgb * alpha, alpha)");
  const sticker = silhouettePass("max", "vec4(pixel.rgb + vec3(alpha - pixel.a), alpha)");
  composer.addPass(erode);
  composer.addPass(dilate);
  composer.addPass(sticker);
  composer.addPass(new OutputPass());

  const skin = new THREE.MeshStandardMaterial({
    roughness: 0.81, emissive: 0xffffff, emissiveIntensity: 0.2 + GLOW * 0.92,
  });
  // Each cube emits its own body color on every side.
  skin.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= diffuseColor.rgb;"
    );
    // Scale bright colors together so saturated channels retain their hue.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "outgoingLight /= max(1.0, max3(outgoingLight));\n#include <opaque_fragment>"
    );
  };
  const critter = new THREE.Group();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const body = new THREE.InstancedMesh(cube, skin, SIZE * SIZE * BODY_LAYERS);
  body.count = 0;
  body.frustumCulled = false;
  critter.add(body);
  scene.add(critter);

  let spec, grid, basePaint, eyes = [];
  let eyeShape = "round", motionName = "none", motionSince = null;
  let accessoryOption, accessoryMesh, previewScale = 1;
  let attention = 0, listeningSince = null, previousFrame = null;
  let pointerTarget = null, pointerX = 0, pointerY = 0, pointerWeight = 0;
  let silhouette = "", colors = "", dirty = true;
  let startedAt = null, breathingSince = null;
  let width = 0, height = 0;
  let voxels = [];
  let shapePreviewsReady = false;
  let pendingWall = null;
  const voxelColor = new THREE.Color();
  const motionPivot = new THREE.Vector3();
  const refresh = () => { dirty = true; };
  orbit.addEventListener("change", refresh);
  canvas.addEventListener("webglcontextrestored", refresh);
  canvas.addEventListener("keydown", event => {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const offset = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
    offset.theta += direction[0] * 0.14;
    offset.phi = THREE.MathUtils.clamp(offset.phi + direction[1] * 0.14, orbit.minPolarAngle, orbit.maxPolarAngle);
    camera.position.setFromSpherical(offset).add(orbit.target);
    orbit.update();
  });
  host.append(canvas);

  function applyProjection(progress) {
    projection = progress;
    const turn = THREE.MathUtils.smoothstep(progress, 0.14, 1);
    const { radius, theta, phi } = orbitPose.offset;
    orbit.target.y = THREE.MathUtils.lerp(4, 3.8, turn);
    camera.position.setFromSphericalCoords(
      radius, THREE.MathUtils.lerp(Math.PI / 2, phi, turn), theta * turn
    ).add(orbit.target);
    camera.zoom = THREE.MathUtils.lerp(1, orbitPose.zoom, turn);
    camera.lookAt(orbit.target);
    camera.updateProjectionMatrix();
    host.style.setProperty("--model-opacity", THREE.MathUtils.smoothstep(progress, 0, 0.48));
    refresh();
  }

  function finishProjection() {
    transition = null;
    applyProjection(targetProjection);
    orbit.enabled = targetProjection === 1;
    canvas.tabIndex = orbit.enabled ? 0 : -1;
    canvas.setAttribute("aria-hidden", String(!orbit.enabled));
    if (orbit.enabled) orbit.update();
  }

  function setProjection(use3D, animate) {
    const next = Number(use3D);
    if (next === targetProjection && (transition || projection === next)) return;
    if (orbit.enabled) {
      orbitPose = { offset: new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target)), zoom: camera.zoom };
    }
    targetProjection = next;
    orbit.enabled = false;
    canvas.tabIndex = -1;
    canvas.setAttribute("aria-hidden", "true");
    if (!animate || projection === next) finishProjection();
    else transition = { from: projection, start: null, duration: 580 * Math.abs(next - projection) };
  }

  function setCritter(next) {
    if (spec === next) return;
    disposeEyes(eyes);
    spec = next;
    basePaint = restPaint(spec);
    grid = rasterize(spec);
    silhouette = "";
    startedAt = null;
    breathingSince = null;
    eyes = makeEyes(grid, spec, eyeShape);
    for (const eye of eyes) critter.add(eye.opening);
    placeAccessory();
    host.style.setProperty("--glow-color", `color-mix(in srgb, ${spec.colors[0].hex} ${GLOW * 36}%, transparent)`);
    refresh();
  }

  function updateSilhouettePasses() {
    const radius = OUTLINE_RADIUS * camera.zoom * height / (camera.top - camera.bottom);
    erode.uniforms.radius.value.set(radius / width, radius / height);
    dilate.uniforms.radius.value.copy(erode.uniforms.radius.value);
    const stroke = THREE.MathUtils.clamp(height * 0.024, 4, 10);
    sticker.uniforms.radius.value.set(stroke / width, stroke / height);
  }

  function setWall(tiles) {
    pendingWall = tiles;
  }

  function setEyeShape(next) {
    if (next === eyeShape) return;
    eyeShape = next;
    if (!spec) return;
    disposeEyes(eyes);
    eyes = makeEyes(grid, spec, eyeShape);
    for (const eye of eyes) critter.add(eye.opening);
    refresh();
  }

  function placeAccessory() {
    if (!accessoryMesh || !grid) return;
    const eyeY = eyes[0].opening.position.y;
    const crownRow = grid.findIndex(row => row[3] && row[4]);
    const pinRow = grid[SIZE - Math.max(2, Math.floor(eyeY - 1.6)) - 1];
    const pinX = pinRow?.[5] && pinRow[6] ? 2.18 : 0.9;
    const chestY = Math.max(1.25, eyeY - 1.82);
    const head = accessoryOption.anchor === "head", top = accessoryOption.anchor === "top";
    const y = head ? SIZE - 1.60 : top ? SIZE - Math.max(0, crownRow) + 0.53 : chestY;
    accessoryMesh.position.set(accessoryOption.anchor === "pin" ? pinX : 0, y, BODY_FRONT + 0.035);
  }

  function setAccessory(next) {
    if (next === accessoryOption) return;
    if (accessoryMesh) {
      accessoryMesh.removeFromParent();
      for (const mesh of accessoryMesh.children) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      accessoryMesh = null;
    }
    accessoryOption = next;
    if (next?.art) {
      accessoryMesh = makeAccessory(next);
      critter.add(accessoryMesh);
      placeAccessory();
    }
    refresh();
  }

  function setPreviewScale(next) {
    previewScale = next;
    refresh();
  }

  function updateBody() {
    const nextSilhouette = grid.map(row => row.map(cell => cell ? "1" : "0").join("")).join("");
    if (nextSilhouette !== silhouette) {
      silhouette = nextSilhouette;
      voxels = placeVoxels(body, grid, (row, column) => bodyDepth(spec, grid, row, column));
      colors = "";
    }
    const palette = grid.flatMap((row, y) => row.map((_, x) => basePaint(x, y)));
    const nextColors = palette.join("");
    if (colors === nextColors) return;
    paintVoxels(body, voxels, palette);
    colors = nextColors;
  }

  function paintVoxels(mesh, cells, palette) {
    for (let i = 0; i < cells.length; i++) mesh.setColorAt(i, voxelColor.set(palette[cells[i]]));
    mesh.instanceColor.needsUpdate = true;
  }

  function drawThumbnail(context, thumbnailScene, thumbnailCamera) {
    const pixelRatio = renderer.getPixelRatio();
    const { width: thumbnailWidth, height: thumbnailHeight } = context.canvas;
    const size = Math.ceil(thumbnailWidth / pixelRatio);
    const pixels = Math.floor(size * pixelRatio);
    renderer.setViewport(0, 0, size, size);
    renderer.setScissor(0, 0, size, size);
    renderer.setScissorTest(true);
    renderer.render(thumbnailScene, thumbnailCamera);
    context.clearRect(0, 0, thumbnailWidth, thumbnailHeight);
    context.drawImage(canvas, 0, canvas.height - pixels, pixels, pixels, 0, 0, thumbnailWidth, thumbnailHeight);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
  }

  function drawShapePreviews() {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5.3, 5.3, 5.3, -5.3, 0.1, 30);
    const light = new THREE.DirectionalLight(0xffffff, 1.55);
    light.position.set(-5, 7, 5);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0x729aa9 });
    const mesh = new THREE.InstancedMesh(geometry, material, SIZE * SIZE * BODY_LAYERS);
    mesh.frustumCulled = false;
    scene.add(mesh, light, new THREE.AmbientLight(0xffffff, 0.75));
    for (const { canvas, grid, centerY, kind, value } of shapePreviews) {
      const depthAt = kind === "top" ? (row, column) => topDepth(value, row, column)
        : kind === "bottom" ? (row, column) => bottomDepth(value, row, column)
        : (_, column) => middleDepth(value, column);
      placeVoxels(mesh, grid, depthAt);
      camera.position.set(7, centerY + 6, 15);
      camera.lookAt(0, centerY, 0);
      drawThumbnail(canvas.getContext("2d"), scene, camera);
    }
    mesh.dispose();
    geometry.dispose();
    material.dispose();
    shapePreviewsReady = true;
  }

  function drawWall(tiles) {
    const wallCamera = new THREE.OrthographicCamera(-5.25, 5.25, 5.25, -5.25, 0.1, 40);
    wallCamera.position.set(8.6, 7.7, 17);
    wallCamera.lookAt(0, 4, 0);
    const thumbnailBody = new THREE.InstancedMesh(cube, skin, SIZE * SIZE * BODY_LAYERS);
    thumbnailBody.frustumCulled = false;
    critter.visible = false;
    scene.add(thumbnailBody);
    for (const { model, spec, grid } of tiles) {
      const cells = placeVoxels(thumbnailBody, grid, (row, column) => bodyDepth(spec, grid, row, column));
      const paint = restPaint(spec);
      paintVoxels(thumbnailBody, cells, grid.flatMap((row, y) => row.map((_, x) => paint(x, y))));
      const tileEyes = makeEyes(grid, spec);
      for (const eye of tileEyes) {
        const { x, y } = pupilPosition(eye, spec.eyes.gaze.dx, -spec.eyes.gaze.dy);
        eye.pupil.position.x = x;
        eye.pupil.position.y = y;
        scene.add(eye.opening);
      }
      drawThumbnail(model.getContext("2d"), scene, wallCamera);
      model.hidden = false;
      disposeEyes(tileEyes);
    }
    thumbnailBody.removeFromParent();
    thumbnailBody.dispose();
    critter.visible = true;
  }

  function draw(time, animateEyes, requestedMotion, allowMotion, listening = false, directedPose = null) {
    if (!spec) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    if (width !== w || height !== h) {
      width = w;
      height = h;
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      refresh();
    }
    if (transition) {
      transition.start ??= time;
      const elapsed = time - transition.start;
      if (!allowMotion || elapsed >= transition.duration) finishProjection();
      else applyProjection(THREE.MathUtils.lerp(
        transition.from, targetProjection, THREE.MathUtils.smoothstep(elapsed, 0, transition.duration)
      ));
    }
    if (projection === 0) return;
    if (pendingWall) {
      drawWall(pendingWall);
      pendingWall = null;
      refresh();
    }
    if (!shapePreviewsReady) drawShapePreviews();
    const targetAttention = Number(listening && !transition);
    const delta = Math.min(50, time - (previousFrame ?? time - 16));
    previousFrame = time;
    const nextAttention = allowMotion ? THREE.MathUtils.lerp(attention, targetAttention, 1 - Math.exp(-delta / 90)) : targetAttention;
    const resolvedAttention = Math.abs(nextAttention - targetAttention) < 0.002 ? targetAttention : nextAttention;
    const attentionChanged = attention !== resolvedAttention;
    attention = resolvedAttention;
    if (!attention) listeningSince = null;
    else listeningSince ??= time;
    const listeningTime = (time - (listeningSince ?? time)) / 1000;
    const nextMotion = allowMotion && !transition && !attention ? requestedMotion : "none";
    if (nextMotion !== motionName) {
      motionName = nextMotion;
      motionSince = time;
      refresh();
    }
    motionSince ??= time;
    const pose = directedPose ?? motionPose3D(motionName, (time - motionSince) / 1000);
    const following = !pose && !transition && pointerTarget !== null;
    const ease = allowMotion ? 1 - Math.exp(-delta / 105) : 1;
    const follow = (current, target) => {
      const next = THREE.MathUtils.lerp(current, target, ease);
      return Math.abs(next - target) < 0.002 ? target : next;
    };
    const nextX = follow(pointerX, following ? pointerTarget.x : 0);
    const nextY = follow(pointerY, following ? pointerTarget.y : 0);
    const nextWeight = follow(pointerWeight, Number(following));
    const pointerChanged = nextX !== pointerX || nextY !== pointerY || nextWeight !== pointerWeight;
    pointerX = nextX;
    pointerY = nextY;
    pointerWeight = nextWeight;
    const useIdle = animateEyes && !transition && !pose;
    const breathe = allowMotion && !transition && !pose;
    if (!useIdle) startedAt = null;
    else startedAt ??= time;
    if (!breathe) breathingSince = null;
    else breathingSince ??= time;
    const breath = breathe ? idleBreath(time - breathingSince) : 0;
    const gaze = spec.eyes.gaze;
    const expression = pose ? { x: pose.gazeX, y: pose.gazeY, open: pose.open, lean: 0 }
      : useIdle ? idleExpression(time - startedAt)
      : { x: gaze.dx > 0 ? 1 : -1, y: gaze.dy > 0 ? -1 : 1, open: 1, lean: 0 };
    if (pointerWeight && !pose) {
      // Reach the pixel eye's edge just before the pointer leaves the stage.
      const pointerGazeX = eyeShape === "pixel"
        ? THREE.MathUtils.clamp(pointerX / 0.85, -1, 1) * pointerWeight
        : pointerX * 0.9;
      expression.x = expression.x * (1 - pointerWeight) + pointerGazeX;
      expression.y = expression.y * (1 - pointerWeight) + pointerY * 0.7;
      expression.lean *= 1 - pointerWeight;
    }
    if (attention) {
      expression.x *= 1 - attention;
      expression.y *= 1 - attention;
      const blinkPhase = listeningTime % 4.7;
      const blink = allowMotion ? THREE.MathUtils.smoothstep(blinkPhase, 2.5, 2.59)
        * (1 - THREE.MathUtils.smoothstep(blinkPhase, 2.62, 2.77)) : 0;
      expression.open = THREE.MathUtils.lerp(expression.open, 1.035 - 0.99 * blink, attention);
      expression.lean *= 1 - attention;
    }
    const closedEyes = pose?.closedEyes ?? expression.open <= 0.08;
    const poses = eyes.map(eye => pupilPosition(eye, expression.x, expression.y));
    const pupilChanged = eyes.some((eye, i) =>
      eye.opening.scale.y !== expression.open ||
      eye.sclera.visible === closedEyes ||
      (!closedEyes && (eye.pupil.position.x !== poses[i].x || eye.pupil.position.y !== poses[i].y))
    );
    const scaleX = 1 + 0.014 * breath;
    const breathingChanged = critter.scale.x !== scaleX;
    if (!pose && !dirty && !attentionChanged && !pointerChanged && !(allowMotion && attention)
        && !pupilChanged && !breathingChanged) return;
    if (dirty) updateBody();
    dirty = false;
    const depthScale = THREE.MathUtils.lerp(0.1, 1, THREE.MathUtils.smoothstep(projection, 0.06, 0.94));
    const squash = pose?.squash ?? 1;
    critter.scale.set(scaleX / Math.sqrt(squash), squash * (1 + 0.025 * breath), depthScale / Math.sqrt(squash));
    const faceCamera = Math.atan2(camera.position.x - orbit.target.x, camera.position.z - orbit.target.z);
    const followWeight = allowMotion ? (1 - attention) : 0;
    const leanIn = allowMotion ? Math.sin(Math.PI * THREE.MathUtils.smoothstep(listeningTime, 0, 0.68)) : 0;
    const listenSway = allowMotion ? Math.sin(listeningTime * 1.8) : 0;
    critter.rotation.set(
      pose?.pitch ?? ((-0.09 - 0.085 * leanIn + 0.024 * listenSway) * attention - 0.16 * pointerY * followWeight),
      pose?.yaw ?? ((faceCamera + 0.045 * listenSway) * attention
        + (0.18 * faceCamera * pointerWeight + 0.32 * pointerX) * followWeight),
      pose?.roll ?? (-expression.lean - 0.04 * pointerX * followWeight + 0.041 * listenSway * attention),
      "YXZ"
    );
    const pivotOffset = motionPivot.set(0, 4 * critter.scale.y, 0).applyEuler(critter.rotation);
    critter.position.set((pose?.x ?? 0) - pivotOffset.x,
      4 * critter.scale.y - pivotOffset.y + (pose?.y ?? Math.abs(expression.lean) * 2.8),
      (pose?.z ?? 0) - pivotOffset.z);
    skin.emissiveIntensity = 0.2 + GLOW * 0.92 * (pose?.glow ?? 1);
    eyes.forEach((eye, i) => {
      eye.opening.scale.y = expression.open;
      eye.sclera.visible = !closedEyes;
      eye.pupil.visible = closedEyes || !eye.pixel;
      eye.pupil.scale.x = closedEyes ? 1.55 : 1;
      eye.pupil.position.x = closedEyes ? 0 : poses[i].x;
      eye.pupil.position.y = closedEyes ? 0 : poses[i].y;
      eye.center?.set(poses[i].x, poses[i].y);
    });
    const anchor = accessoryOption?.anchor;
    const headwear = anchor === "head" || anchor === "top";
    avatarCamera.zoom = headwear ? 0.86 : 1;
    avatarCamera.updateProjectionMatrix();
    drawThumbnail(avatarContext, scene, avatarCamera);
    const scale = THREE.MathUtils.lerp(1, previewScale, projection);
    const span = Math.max(anchor === "head" ? 6.45 : anchor === "top" ? 6.15 : 5.5,
      (headwear ? 5.75 : 5.2) * height / width) / scale;
    camera.left = -span * width / height;
    camera.right = -camera.left;
    camera.top = span;
    camera.bottom = -span;
    camera.updateProjectionMatrix();
    updateSilhouettePasses();
    composer.render();
  }

  return {
    setCritter, setEyeShape, setAccessory, setPreviewScale, draw, setProjection, setWall,
    setPointer: point => { pointerTarget = point; },
    transitioning: () => transition !== null,
    resetView: () => { if (orbit.enabled) orbit.reset(); },
  };
}
