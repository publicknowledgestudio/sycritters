import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SavePass } from "three/addons/postprocessing/SavePass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { nativeVolume, VOLUME_LAYERS, VOLUME_ORIGIN } from "./critter-volume.mjs";
import { petPose } from "./critter-petting.mjs";
import { blockMotion3D, blockPose3D } from "./critter-block-motion.mjs";
import { motionPose3D } from "./critter-motion.mjs";
import { SpeechAttention } from "./critter-attention.mjs";

const SIZE = 8;
const BODY_LAYERS = 4;
const BODY_FRONT = BODY_LAYERS / 2;
const OUTLINE_ROUNDING = 0.5;
const GLOW = 0.5;
const OUTLINE_RADIUS = OUTLINE_ROUNDING * 0.48;

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

function placeVoxels(mesh, grid, depthAt, layers = BODY_LAYERS, origin = BODY_FRONT) {
  const matrix = new THREE.Matrix4();
  const cells = [];
  for (let row = 0; row < SIZE; row++) {
    for (let column = 0; column < SIZE; column++) {
      if (!grid[row][column]) continue;
      const x = column + 0.5 - SIZE / 2;
      const y = SIZE - row - 0.5;
      const depth = depthAt(row, column);
      for (let layer = 0; layer < layers; layer++) {
        if (!(depth & (1 << layer))) continue;
        mesh.setMatrixAt(cells.length, matrix.makeTranslation(x, y, layer + 0.5 - origin));
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

// A pie-cut pupil gives the graphic, early-cartoon expression in the reference.
function cartoonPupilGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 56; i++) {
    const angle = (155 + i / 56 * 315) * Math.PI / 180;
    const x = Math.cos(angle) * 0.51, y = Math.sin(angle) * 0.78;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.lineTo(-0.03, 0.15);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function eyeRingGeometry() {
  const outline = new THREE.Shape();
  outline.absellipse(0, 0, 0.89, 1.12, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, 0.76, 0.99, 0, Math.PI * 2, true);
  outline.holes.push(hole);
  return new THREE.ShapeGeometry(outline, 48);
}
function lashedEyeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.78, -0.87);
  shape.bezierCurveTo(-0.82, 0.2, -0.57, 1.12, 0, 1.12);
  shape.bezierCurveTo(0.57, 1.12, 0.82, 0.2, 0.78, -0.87);
  shape.quadraticCurveTo(0, -0.61, -0.78, -0.87);
  return new THREE.ShapeGeometry(shape, 32);
}
function decorateIllustratedEye(style, opening, pupil, dark, white) {
  const details = new THREE.Group();
  opening.add(details);
  const stroke = (points, radius = 0.065) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0.012)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), dark);
    details.add(mesh);
    // Round the ends of the drawn strokes.
    for (const point of [curve.getPoint(0), curve.getPoint(1)]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), dark);
      cap.position.copy(point);
      details.add(cap);
    }
  };
  if (style === "outlined") {
    const rim = new THREE.Mesh(eyeRingGeometry(), dark);
    rim.position.z = 0.008;
    details.add(rim);
  }
  if (style === "lashed") {
    stroke([[-0.78,-0.87],[-0.76,0.25],[-0.49,0.95],[0,1.12],[0.49,0.95],[0.76,0.25],[0.78,-0.87]]);
    stroke([[-0.85,-0.93],[-0.4,-0.78],[0,-0.74],[0.4,-0.78],[0.85,-0.93]]);
    stroke([[-0.56,0.75],[-0.85,0.82],[-1,1.08]], 0.075);
  }
  if (style === "arched") stroke([[-0.93,0.26],[-0.7,0.92],[0,1.32],[0.7,0.92],[0.93,0.26]], 0.075);
  const glints = style === "lashed" ? [[-0.22,0.48,0.23],[-0.35,0.29,0.1]]
    : style === "outlined" ? [[0.18,0.42,0.13]] : [[0.17,0.43,0.19],[0.34,0.14,0.08]];
  for (const [x,y,radius] of glints) {
    const glint = new THREE.Mesh(new THREE.CircleGeometry(radius,32),white);
    glint.position.set(x,y,0.018);
    pupil.add(glint);
  }
  return details;
}

const VECTOR_EYES = {
  outlined: { opening: [0.79, 1.02], pupil: [0.54, 0.78], travel: [0.1, 0.1] },
  lashed: { sclera: lashedEyeGeometry, pupil: [0.54, 0.86], travel: [0.08, 0.08], bias: [0.1, -0.08] },
  arched: { sclera: () => new THREE.BufferGeometry(), pupil: [0.62, 0.91], travel: [0.12, 0.1], bias: [0, -0.17] },
  cartoon: { opening: [0.8, 1.08], pupil: [0.51, 0.78], travel: [0.14, 0.14] },
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
  const pixel = style === "pixel" || style === "pixel-square";
  const bar = pixel && spec.eyes.pupil === "bar";
  const white = pixel ? null : new THREE.MeshBasicMaterial({ color: style === "cartoon" ? 0xffffe9 : 0xffffff });
  const dark = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const vector = VECTOR_EYES[style] ?? VECTOR_EYES.round;
  const scleraGeometry = pixel ? (style === "pixel-square" ? new THREE.PlaneGeometry(2, 2) : eyeGeometry(2, 2, OUTLINE_RADIUS))
    : vector.sclera?.() ?? ellipse(vector.opening ?? [0.97, 0.97]);
  const pupilGeometry = pixel ? new THREE.PlaneGeometry(1, 2)
    : style === "cartoon" ? cartoonPupilGeometry() : ellipse(vector.pupil);
  return eyes.map((column, index) => {
    const opening = new THREE.Group();
    // Draw the square pupil on the rounded face itself, so its corners are clipped
    // by the eye silhouette and there is no gap between the bar and the rim.
    const center = pixel ? new THREE.Vector2() : null;
    const sclera = new THREE.Mesh(scleraGeometry, pixel ? pixelEyeMaterial(center, bar ? 2.2 : 1) : white);
    const pupil = new THREE.Mesh(pupilGeometry, dark);
    pupil.position.z = 0.004;
    opening.add(sclera, pupil);
    if (style === "cartoon") {
      for (const [x, y, radius] of [[0.16, 0.25, 0.115], [0.07, -0.03, 0.055]]) {
        const glint = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), white);
        glint.position.set(x, y, 0.004);
        pupil.add(glint);
      }
    }
    const details = ["outlined", "lashed", "arched"].includes(style)
      ? decorateIllustratedEye(style, opening, pupil, dark, white) : null;
    const x = column + 1 - SIZE / 2, y = SIZE - row - 1;
    opening.position.set(x, y, BODY_FRONT + 0.004);
    return { opening, sclera, pupil, details, center, bar, pixel, bias: vector.bias ?? [0, 0], travel: vector.travel, mirror: index === 1 && spec.eyes.mirror };
  });
}

function disposeEyes(eyes) {
  const materials = new Set();
  const geometries = new Set();
  for (const { opening } of eyes) {
    opening.removeFromParent();
    opening.traverse(mesh => {
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) materials.add(mesh.material);
    });
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function pupilPosition(eye, x, y) {
  const horizontal = eye.mirror ? -x : x;
  if (eye.pixel) return { x: horizontal * 0.5, y: eye.bar ? 0 : y * 0.5 };
  const length = Math.max(1, Math.hypot(horizontal, y));
  return { x: horizontal * eye.travel[0] / length + eye.bias[0], y: y * eye.travel[1] / length + eye.bias[1] };
}

function squareGlassesGeometry() {
  const rounded = (path, half, radius) => {
    path.moveTo(-half + radius, -half);
    path.lineTo(half - radius, -half);
    path.quadraticCurveTo(half, -half, half, -half + radius);
    path.lineTo(half, half - radius);
    path.quadraticCurveTo(half, half, half - radius, half);
    path.lineTo(-half + radius, half);
    path.quadraticCurveTo(-half, half, -half, half - radius);
    path.lineTo(-half, -half + radius);
    path.quadraticCurveTo(-half, -half, -half + radius, -half);
    path.closePath();
  };
  const frame = new THREE.Shape();
  rounded(frame, 1.58, 0.34);
  const lens = new THREE.Path();
  rounded(lens, 1.37, 0.18);
  frame.holes.push(lens);
  const geometry = new THREE.ExtrudeGeometry(frame, {
    depth: 0.2, bevelEnabled: true, bevelThickness: 0.035,
    bevelSize: 0.035, bevelSegments: 2, curveSegments: 10, steps: 1,
  });
  geometry.translate(0, 0, -0.1);
  return geometry;
}

function makeAccessory(option) {
  const group = new THREE.Group();
  if (["top-hat", "round-glasses", "square-glasses", "headphones", "crown", "scarf", "baseball-cap", "beret", "flower-crown", "monocle", "backpack"].includes(option.value)) {
    const black = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const add = (geometry, material, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    if (option.value === "baseball-cap") {
      const blue = new THREE.MeshStandardMaterial({color: 0x3965d8, roughness: 0.85});
      add(new THREE.SphereGeometry(2.25, 32, 16, 0, Math.PI*2, 0, Math.PI/2), blue, 0, -0.4, -2.035);
      const brim = add(new THREE.SphereGeometry(1.8, 32, 12), blue, 0, -0.35, -0.1);
      brim.scale.set(1.15, 0.07, 0.9);
      add(new THREE.SphereGeometry(0.18, 16, 12), white, 0, 1.87, -2.035);
      const patch = add(new THREE.CircleGeometry(.45, 24), white, 0, .45, .23);
      patch.rotation.x = -0.25;
    } else if (option.value === "beret") {
      const red = new THREE.MeshStandardMaterial({color: 0xa92e42, roughness: 0.95});
      add(new THREE.CylinderGeometry(1.7, 1.7, .25, 32), black, 0, -.35, -2.035);
      const cap = add(new THREE.SphereGeometry(2.1, 32, 16), red, -.3, .05, -2.035);
      cap.scale.set(1.12, .32, 1);
      cap.rotation.z = -.14;
      add(new THREE.CylinderGeometry(.12, .15, .45, 12), red, -.55, .85, -2.035);
    } else if (option.value === "flower-crown") {
      const green = new THREE.MeshStandardMaterial({color: 0x3b8054, roughness: .9});
      const pink = new THREE.MeshStandardMaterial({color: 0xffa9c7, roughness: .8});
      const gold = new THREE.MeshStandardMaterial({color: 0xffbb33, roughness: .7});
      const band = add(new THREE.TorusGeometry(2.1, .13, 8, 40), green, 0, -.35, -2.035);
      band.rotation.x = Math.PI/2;
      for (let i=0;i<5;i++) {
        const angle = (i-2)*.55;
        const x=Math.sin(angle)*2.1, z=-2.035+Math.cos(angle)*2.1;
        for(let j=0;j<5;j++) {
          const a=j*Math.PI*2/5;
          const petal=add(new THREE.SphereGeometry(.32, 12, 10), i%2 ? pink : white,
            x+Math.cos(a)*.36, -.05+Math.sin(a)*.36, z+.05);
          petal.scale.z=.4;
        }
        add(new THREE.SphereGeometry(.22,16,12), gold, x,-.05,z+.18);
      }
    } else if (option.value === "monocle") {
      const brass = new THREE.MeshStandardMaterial({color: 0xba873b, metalness: .65, roughness: .3});
      add(new THREE.TorusGeometry(1.27,.1,10,48), brass, 0,0,.25);
      const chain=new THREE.CatmullRomCurve3([[1.2,-.25,.25],[1.55,-1,.3],[1.45,-2,.3],[.8,-2.7,.35],[.3,-2.5,.35]].map(p=>new THREE.Vector3(...p)));
      add(new THREE.TubeGeometry(chain,36,.045,6,false),brass,0,0,0);
    } else if (option.value === "backpack") {
      const leather = new THREE.MeshStandardMaterial({color: 0xb56c3e, roughness: .9});
      const tan = new THREE.MeshStandardMaterial({color: 0xe8c28b, roughness: .85});
      const pack=add(new THREE.CapsuleGeometry(1.4,1.4,6,24),leather,0,0,-.25);
      pack.scale.set(1,.95,.6);
      add(new THREE.BoxGeometry(2,1.3,.4),tan,0,-.5,-1.05);
      add(new THREE.BoxGeometry(.35,.55,.1),black,0,.15,-1.3);
      const handle=new THREE.CatmullRomCurve3([[-.6,1.4,0],[-.55,2.2,0],[.55,2.2,0],[.6,1.4,0]].map(p=>new THREE.Vector3(...p)));
      add(new THREE.TubeGeometry(handle,24,.12,8,false),tan,0,0,0);
      for(const side of [-1,1]) {
        const strap=add(new THREE.TorusGeometry(1.8,.13,8,32),tan,side*1.1,0,1.1);
        strap.rotation.y=Math.PI/2;
        strap.scale.y=1.2;
      }
    } else if (option.value === "crown") {
      const profile = [
        new THREE.Vector2(1.3, -0.45), new THREE.Vector2(1.6, -0.45),
        new THREE.Vector2(1.6, 0.25), new THREE.Vector2(1.3, 0.25),
        new THREE.Vector2(1.3, -0.45),
      ];
      add(new THREE.LatheGeometry(profile, 32), black, 0, 0, -2.035);
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        add(new THREE.ConeGeometry(0.38, 0.85, 4), white,
          1.45 * Math.sin(angle), 0.6, -2.035 + 1.45 * Math.cos(angle));
      }
    } else if (option.value === "scarf") {
      const corners = [
        [-3.1, 0, 0.28], [3.1, 0, 0.28], [3.75, 0, -0.35],
        [3.75, 0, -3.75], [3.1, 0, -4.35], [-3.1, 0, -4.35],
        [-3.75, 0, -3.75], [-3.75, 0, -0.35],
      ].map(point => new THREE.Vector3(...point));
      const wrap = new THREE.CatmullRomCurve3(corners, true, "centripetal");
      add(new THREE.TubeGeometry(wrap, 64, 0.33, 8, true), black, 0, 0.5, 0);
      add(new THREE.BoxGeometry(0.65, 1.85, 0.35), black, 2.35, -0.45, 0.44);
      add(new THREE.BoxGeometry(0.67, 0.22, 0.37), white, 2.35, -1.1, 0.44);
    } else if (option.value === "headphones") {
      // Seat the band over the body's depth, rather than on its front face.
      const points = Array.from({ length: 33 }, (_, i) => {
        const angle = Math.PI * i / 32;
        return new THREE.Vector3(4.25 * Math.cos(angle), -0.55 + 2.45 * Math.sin(angle), -2.035);
      });
      const band = new THREE.CatmullRomCurve3(points);
      add(new THREE.TubeGeometry(band, 48, 0.24, 8, false), black, 0, 0, 0);
      for (const side of [-1, 1]) {
        const cup = add(new THREE.CylinderGeometry(0.98, 0.98, 0.65, 24), black,
          side * 4.25, -0.65, -2.035);
        cup.rotation.z = Math.PI / 2;
        const inset = add(new THREE.CylinderGeometry(0.67, 0.67, 0.07, 24), white,
          side * 4.6, -0.65, -2.035);
        inset.rotation.z = Math.PI / 2;
      }
    } else if (option.value === "top-hat") {
      add(new THREE.CylinderGeometry(2.05, 2.05, 0.22, 32), black, 0, -0.35, -2.035);
      add(new THREE.CylinderGeometry(1.35, 1.45, 1.85, 32), black, 0, 0.65, -2.035);
      add(new THREE.CylinderGeometry(1.43, 1.45, 0.32, 32), white, 0, -0.05, -2.035);
    } else {
      for (const x of [-1.45, 1.45]) {
        const geometry = option.value === "square-glasses" ? squareGlassesGeometry() : new THREE.TorusGeometry(1.58, 0.12, 8, 40);
        const rim = add(geometry, black, x, 0, 0.24);
        rim.userData.glassesPart = "rim";
      }
      const bridge = add(new THREE.BoxGeometry(1, 0.18, 0.18), black, 0, 0.25, 0.24);
      bridge.userData.glassesPart = "bridge";
    }
    return group;
  }
  const scale = option.width / 24;
  const { paths } = new SVGLoader().parse(option.icon);
  paths.forEach((path, index) => {
    const shapes = SVGLoader.createShapes(path);
    const depth = option.anchor === "head" ? 0.55 : 0.3;
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: depth / scale,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: 0.035 / scale,
      bevelSize: 0.035 / scale,
      bevelSegments: 2,
      curveSegments: 12,
    });
    geometry.translate(-12, -12, 0);
    // Turn SVG coordinates upright without reversing the surface winding.
    geometry.scale(scale, -scale, -scale);
    geometry.translate(0, 0, depth);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: path.color,
      roughness: 0.85,
      metalness: 0,
    }));
    // Raised inlays overlap the base and remain clear during turns and squashes.
    mesh.position.z = 0.085 * index;
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
  orbit.minPolarAngle = 0.01;
  orbit.maxPolarAngle = Math.PI - 0.01;
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
  // Retain the rendered silhouette before rounding: thin accessories outside
  // the body must survive the erosion used to soften voxel corners.
  const original = new SavePass(new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  const accessoryMask = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const preserveAccessory = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      original: { value: null },
      accessoryMask: { value: null },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse;
      uniform sampler2D original;
      uniform sampler2D accessoryMask;
      varying vec2 vUv;
      void main() {
        vec4 rounded = texture2D(tDiffuse, vUv);
        vec4 source = texture2D(original, vUv);
        float accessory = texture2D(accessoryMask, vUv).a;
        gl_FragColor = accessory > 0.001 && source.a > rounded.a
          ? vec4(source.rgb * source.a, source.a) : rounded;
      }`,
  });
  // ShaderPass clones supplied uniforms. Bind the live render-target texture
  // afterward so the preservation pass samples the saved frame, not a clone.
  preserveAccessory.uniforms.original.value = original.renderTarget.texture;
  preserveAccessory.uniforms.accessoryMask.value = accessoryMask.texture;
  composer.addPass(original);
  composer.addPass(erode);
  composer.addPass(dilate);
  composer.addPass(preserveAccessory);
  composer.addPass(sticker);
  composer.addPass(new OutputPass());

  const skin = new THREE.MeshStandardMaterial({
    roughness: 0.81, emissive: 0xffffff, emissiveIntensity: 0.2 + GLOW * 0.92,
  });
  const frontOnly = form => form.startsWith("curated:") && !["curated:brass", "curated:minty"].includes(form);
  // Instance paint belongs to the whole voxel, including its side faces.
  skin.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= diffuseColor.rgb;"
    );
    // Render every critter body with flat paint, independent of scene lighting.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>"
    );
  };
  const critter = new THREE.Group();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const body = new THREE.InstancedMesh(cube, skin, SIZE * SIZE * VOLUME_LAYERS);
  body.count = 0;
  body.frustumCulled = false;
  critter.add(body);
  scene.add(critter);

  let spec, grid, basePaint, eyes = [];
  let bodyForm = "seed", volume;
  let eyeShape = "round", motionName = "none", motionSince = null;
  let accessoryOption, accessoryMesh, previewScale = 1;
  let attention = 0, listeningSince = null, previousFrame = null;
  const speechAttention = new SpeechAttention();
  let pointerTarget = null, pointerX = 0, pointerY = 0, pointerWeight = 0, hoverWeight = 0;
  let petSince = null;
  const pointerRay = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let silhouette = "", colors = "", dirty = true;
  let startedAt = null, breathingSince = null;
  let width = 0, height = 0;
  let pendingCapture = null;
  let voxels = [];
  let restVoxels = [];
  const blockMatrix = new THREE.Matrix4();
  const blockPosition = new THREE.Vector3();
  const blockRotation = new THREE.Quaternion();
  const blockAxis = new THREE.Vector3(0, 1, 0);
  const blockScale = new THREE.Vector3(1, 1, 1);
  let shapePreviewsReady = false;
  let pendingWall = null, wallTiles = [];
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
    volume = nativeVolume(spec, rasterize(spec), bodyForm);
    grid = volume.grid;
    silhouette = "";
    shapePreviewsReady = false;
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
    wallTiles = tiles;
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
    const y = accessoryOption.anchor === "eyes" ? eyeY : head ? SIZE - 1.60 : top ? SIZE - Math.max(0, crownRow) + 0.53 : chestY;
    const floatOffset = accessoryOption.value === "top-hat" ? 0.65 : 0;
    accessoryMesh.position.set(accessoryOption.anchor === "pin" ? pinX : 0, y + floatOffset, BODY_FRONT + 0.035);
    if (accessoryOption.value === "monocle") accessoryMesh.position.x = eyes[1].opening.position.x;
    if (accessoryOption.anchor === "back") {
      let backLayer = VOLUME_LAYERS-1;
      for(const mask of volume.masks.flat()) for(let layer=0;layer<backLayer;layer++) {
        if(mask & (1<<layer)) { backLayer=layer; break; }
      }
      accessoryMesh.position.set(0, 3.5, backLayer-VOLUME_ORIGIN-.4);
    }
    if (["round-glasses", "square-glasses"].includes(accessoryOption.value)) {
      const left = eyes[0].opening.position.x;
      const right = eyes[1].opening.position.x;
      const center = (left + right) / 2;
      const radius = Math.min(1.58, (right - left) / 2 - 0.24);
      accessoryMesh.position.x = center;
      let rimIndex = 0;
      for (const mesh of accessoryMesh.children) {
        if (mesh.userData.glassesPart === "rim") {
          mesh.position.x = [left, right][rimIndex++] - center;
          mesh.scale.set(radius / 1.58, radius / 1.58, 1);
        } else if (mesh.userData.glassesPart === "bridge") {
          mesh.scale.x = right - left - 2 * radius;
        }
      }
    }
  }

  function setAccessory(next) {
    if (next === accessoryOption) return;
    if (accessoryMesh) {
      accessoryMesh.removeFromParent();
      const materials = new Set();
      for (const mesh of accessoryMesh.children) {
        mesh.geometry.dispose();
        materials.add(mesh.material);
      }
      for (const material of materials) material.dispose();
      accessoryMesh = null;
    }
    accessoryOption = next;
    // Restore thin geometry only when an accessory is present; bare critters
    // retain their existing rounded silhouette.
    preserveAccessory.enabled = Boolean(next?.art);
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
      voxels = placeVoxels(body, grid, (row, column) => volume.masks[row][column], VOLUME_LAYERS, VOLUME_ORIGIN);
      restVoxels = voxels.map((cell, i) => {
        body.getMatrixAt(i, blockMatrix);
        const position = new THREE.Vector3().setFromMatrixPosition(blockMatrix);
        return { position, face: grid[Math.floor(cell / SIZE)][cell % SIZE] >= 2 };
      });
      colors = "";
    }
    const palette = grid.flatMap((row, y) => row.map((_, x) => basePaint(x, y)));
    const nextColors = palette.join("");
    if (colors === nextColors) return;
    paintVoxels(body, voxels, palette, spec, bodyForm);
    colors = nextColors;
  }

  function paintVoxels(mesh, cells, palette, paintSpec, form) {
    const onlyFront = frontOnly(form);
    const outer = paintSpec.colors.at(-1).hex;
    for (let i = 0; i < cells.length; i++) {
      // Use the two absolute front layers, not the front of each column:
      // recessed surfaces deeper in the body must stay the outermost color.
      mesh.getMatrixAt(i, blockMatrix);
      const frontTwoLayers = blockMatrix.elements[14] >= VOLUME_LAYERS - 2 + 0.5 - VOLUME_ORIGIN;
      const mintyHorn = form === "curated:minty" && (cells[i] === 0 || cells[i] === 7);
      const cushionEdge = form === "curated:cushion" && [0, 7].includes(cells[i] % SIZE) && [1, 2, 5, 6].includes(Math.floor(cells[i] / SIZE));
      const color = cushionEdge ? outer : mintyHorn ? paintSpec.colors[0].hex : onlyFront && !frontTwoLayers ? outer : palette[cells[i]];
      mesh.setColorAt(i, voxelColor.set(color));
    }
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
    if (bodyForm.startsWith("curated:")) { shapePreviewsReady = true; return; }
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5.3, 5.3, 5.3, -5.3, 0.1, 30);
    const light = new THREE.DirectionalLight(0xffffff, 1.55);
    light.position.set(-5, 7, 5);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0x729aa9 });
    const mesh = new THREE.InstancedMesh(geometry, material, SIZE * SIZE * VOLUME_LAYERS);
    mesh.frustumCulled = false;
    scene.add(mesh, light, new THREE.AmbientLight(0xffffff, 0.75));
    for (const { canvas, kind, value } of shapePreviews) {
      const key = kind === "waist" ? "waist" : kind === "top" ? "top" : "bottom";
      const previewSpec = { ...spec, [key]: value };
      const { grid, masks } = nativeVolume(previewSpec, rasterize(previewSpec), bodyForm);
      placeVoxels(mesh, grid, (row, column) => masks[row][column], VOLUME_LAYERS, VOLUME_ORIGIN);
      camera.position.set(7, 10, 15);
      camera.lookAt(0, 4, -1.5);
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
    const thumbnailBody = new THREE.InstancedMesh(cube, skin, SIZE * SIZE * VOLUME_LAYERS);
    thumbnailBody.frustumCulled = false;
    critter.visible = false;
    scene.add(thumbnailBody);
    for (const { model, spec, grid: eyeGrid, form, eyeStyle } of tiles) {
      const { grid, masks } = nativeVolume(spec, eyeGrid, form ?? bodyForm);
      const cells = placeVoxels(thumbnailBody, grid, (row, column) => masks[row][column], VOLUME_LAYERS, VOLUME_ORIGIN);
      const paint = restPaint(spec);
      paintVoxels(thumbnailBody, cells, grid.flatMap((row, y) => row.map((_, x) => paint(x, y))), spec, form ?? bodyForm);
      const tileEyes = makeEyes(grid, spec, eyeStyle ?? "round");
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

  function draw(time, animateEyes, requestedMotion, allowMotion, listening = false, directedPose = null, speechSignal = null) {
    if (!spec) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    if (width !== w || height !== h) {
      width = w;
      height = h;
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      accessoryMask.setSize(canvas.width, canvas.height);
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
    const speechPose = speechAttention.update(time, speechSignal);
    const pose = directedPose ?? (allowMotion && !transition && requestedMotion === "none" ? speechPose : null)
      ?? blockPose3D(motionName, (time - motionSince) / 1000)
      ?? motionPose3D(motionName, (time - motionSince) / 1000);
    if (!allowMotion || transition) petSince = null;
    const pet = petSince === null ? null : petPose(Math.max(0, time - petSince));
    if (!pet && petSince !== null) { petSince = null; refresh(); }
    canvas.dataset.petting = String(Boolean(pet));
    const following = allowMotion && !transition && !attention && pointerTarget !== null;
    let hovered = false;
    if (pointerTarget?.overStage && !transition) {
      pointerNDC.set(pointerTarget.x, pointerTarget.y);
      pointerRay.setFromCamera(pointerNDC, camera);
      hovered = pointerRay.intersectObject(body, false).length > 0;
    }
    canvas.dataset.hovered = String(hovered);
    const ease = allowMotion ? 1 - Math.exp(-delta / 105) : 1;
    const follow = (current, target) => {
      const next = THREE.MathUtils.lerp(current, target, ease);
      return Math.abs(next - target) < 0.002 ? target : next;
    };
    const nextX = follow(pointerX, following ? pointerTarget.x : 0);
    const nextY = follow(pointerY, following ? pointerTarget.y : 0);
    const nextWeight = follow(pointerWeight, Number(following));
    const nextHover = follow(hoverWeight, Number(hovered && allowMotion && !attention));
    const hoverChanged = nextHover !== hoverWeight;
    hoverWeight = nextHover;
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
    if (pointerWeight) {
      // Reach the pixel eye's edge just before the pointer leaves the stage.
      const pointerGazeX = ["pixel", "pixel-square"].includes(eyeShape)
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
    if (pet) expression.open *= pet.open;
    const closedEyes = pose?.closedEyes ?? expression.open <= 0.08;
    const poses = eyes.map(eye => pupilPosition(eye, expression.x, expression.y));
    const pupilChanged = eyes.some((eye, i) =>
      eye.opening.scale.y !== expression.open ||
      eye.sclera.visible === closedEyes ||
      (!closedEyes && (eye.pupil.position.x !== poses[i].x || eye.pupil.position.y !== poses[i].y))
    );
    const scaleX = 1 + 0.014 * breath + 0.025 * hoverWeight;
    const breathingChanged = critter.scale.x !== scaleX;
    if (!pose && !dirty && !attentionChanged && !pointerChanged && !(allowMotion && attention)
        && !pupilChanged && !breathingChanged && !hoverChanged && !pet) return;
    if (dirty) updateBody();
    dirty = false;
    const depthScale = THREE.MathUtils.lerp(0.1, 1, THREE.MathUtils.smoothstep(projection, 0.06, 0.94));
    const squash = (pose?.squash ?? 1) * (pet?.squash ?? 1);
    critter.scale.set(scaleX / Math.sqrt(squash), squash * (1 + 0.025 * breath), depthScale / Math.sqrt(squash));
    const faceCamera = Math.atan2(camera.position.x - orbit.target.x, camera.position.z - orbit.target.z);
    const followWeight = allowMotion ? (1 - attention) : 0;
    const leanIn = allowMotion ? Math.sin(Math.PI * THREE.MathUtils.smoothstep(listeningTime, 0, 0.68)) : 0;
    const listenSway = allowMotion ? Math.sin(listeningTime * 1.8) : 0;
    critter.rotation.set(
      (pose?.pitch ?? ((-0.09 - 0.085 * leanIn + 0.024 * listenSway) * attention)) - 0.16 * pointerY * followWeight,
      (pose?.yaw ?? ((faceCamera + 0.045 * listenSway) * attention))
        + (0.18 * faceCamera * pointerWeight + 0.32 * pointerX) * followWeight,
      (pose?.roll ?? (-expression.lean + 0.041 * listenSway * attention)) - 0.04 * pointerX * followWeight + (pet?.roll ?? 0),
      "YXZ"
    );
    const pivotOffset = motionPivot.set(0, 4 * critter.scale.y, 0).applyEuler(critter.rotation);
    critter.position.set((pose?.x ?? 0) - pivotOffset.x,
      4 * critter.scale.y - pivotOffset.y + (pose?.y ?? Math.abs(expression.lean) * 2.8) + 0.14 * hoverWeight + (pet?.lift ?? 0),
      (pose?.z ?? 0) - pivotOffset.z);
    skin.emissiveIntensity = 0.2 + GLOW * 0.92 * ((pose?.glow ?? 1) + 0.18 * hoverWeight);
    eyes.forEach((eye, i) => {
      eye.opening.scale.y = expression.open;
      eye.sclera.visible = !closedEyes;
      if (eye.details) eye.details.visible = !closedEyes;
      eye.pupil.visible = closedEyes || !eye.pixel;
      eye.pupil.scale.x = closedEyes ? 1.55 : 1;
      for (const glint of eye.pupil.children) glint.visible = !closedEyes;
      eye.pupil.position.x = closedEyes ? 0 : poses[i].x;
      eye.pupil.position.y = closedEyes ? 0 : poses[i].y;
      eye.center?.set(poses[i].x, poses[i].y);
    });
    // Rebuild from rest every frame, including when a clip is interrupted.
    for (let i = 0; i < restVoxels.length; i++) {
      const { position, face } = restVoxels[i];
      const offset = pose && blockMotion3D(motionName, (time - motionSince) / 1000,
        position.x, position.y, position.z, face);
      blockPosition.copy(position);
      if (offset) {
        blockPosition.x += offset.x;
        blockPosition.y += offset.y;
        blockPosition.z += offset.z;
      }
      blockRotation.setFromAxisAngle(blockAxis, offset?.turn ?? 0);
      blockMatrix.compose(blockPosition, blockRotation, blockScale);
      body.setMatrixAt(i, blockMatrix);
    }
    body.instanceMatrix.needsUpdate = true;
    for (const eye of eyes) eye.opening.position.z = BODY_FRONT + 0.004 + (pose?.faceDepth ?? 0);
    const anchor = accessoryOption?.anchor;
    const headwear = anchor === "head" || anchor === "top";
    const tallCap = accessoryOption?.value === "baseball-cap";
    avatarCamera.zoom = tallCap ? 0.66 : headwear ? 0.86 : 1;
    avatarCamera.updateProjectionMatrix();
    drawThumbnail(avatarContext, scene, avatarCamera);
    const scale = THREE.MathUtils.lerp(1, previewScale, projection);
    const span = Math.max(tallCap ? 7.4 : anchor === "head" ? 6.45 : anchor === "top" ? 6.15 : 5.5,
      (headwear ? 5.75 : 5.2) * height / width) / scale;
    camera.left = -span * width / height;
    camera.right = -camera.left;
    camera.top = span;
    camera.bottom = -span;
    camera.updateProjectionMatrix();
    updateSilhouettePasses();
    if (accessoryMesh) {
      // Capture only visible accessory pixels. Body and eyes still write depth,
      // so back-mounted pieces retain proper occlusion without undoing rounding.
      const maskedMaterials = new Set([skin]);
      for (const eye of eyes) eye.opening.traverse(mesh => {
        if (mesh.material) maskedMaterials.add(mesh.material);
      });
      const previousTarget = renderer.getRenderTarget();
      const previousWrites = new Map([...maskedMaterials].map(material => [material, material.colorWrite]));
      try {
        for (const material of maskedMaterials) material.colorWrite = false;
        renderer.setRenderTarget(accessoryMask);
        renderer.render(scene, camera);
      } finally {
        for (const [material, value] of previousWrites) material.colorWrite = value;
        renderer.setRenderTarget(previousTarget);
      }
    }
    composer.render();
    if (pendingCapture) {
      const capture = pendingCapture;
      pendingCapture = null;
      // Read inside the render frame, before WebGL clears its drawing buffer.
      try {
        canvas.toBlob(blob => blob ? capture.resolve(blob) : capture.reject(new Error("PNG capture failed")), "image/png");
      } catch (error) { capture.reject(error); }
    }
  }

  return {
    setCritter, setEyeShape, setAccessory, setPreviewScale, draw, setProjection, setWall,
    setBodyForm: next => {
      if (next === bodyForm) return;
      bodyForm = next;
      pendingWall = wallTiles;
      if (spec) { const previous = spec; spec = null; setCritter(previous); }
    },
    setPointer: point => {
      pointerTarget = point;
      if (!point) canvas.dataset.hovered = "false";
      refresh();
    },
    hitTest: point => {
      if (transition || !spec || projection < 1) return false;
      pointerNDC.set(point.x, point.y);
      pointerRay.setFromCamera(pointerNDC, camera);
      return pointerRay.intersectObject(body, false).length > 0;
    },
    capturePNG: () => new Promise((resolve, reject) => {
      if (pendingCapture) { reject(new Error("A capture is already pending")); return; }
      pendingCapture = { resolve, reject };
      refresh();
    }),
    pet: () => { petSince = performance.now(); refresh(); },
    transitioning: () => transition !== null,
    resetView: () => { if (orbit.enabled) orbit.reset(); },
  };
}
