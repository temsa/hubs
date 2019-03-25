import { paths } from "../systems/userinput/paths";
import { sets } from "../systems/userinput/sets";
import { getLastWorldPosition } from "../utils/three-utils";

// Color code from https://codepen.io/njmcode/pen/axoyD/
const rgb2hsl = function(color, out) {
  const r = color[0] / 255;
  const g = color[1] / 255;
  const b = color[2] / 255;

  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max == min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  out[0] = h;
  out[1] = s;
  out[2] = l;
  return out;
};

const hue2rgb = function(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

const hsl2rgb = function(color, out) {
  const l = color[2];
  const s = color[1];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  out[0] = hue2rgb(p, q, color[0] + 1 / 3);
  out[1] = hue2rgb(p, q, color[0]);
  out[2] = hue2rgb(p, q, color[0] - 1 / 3);
  return out;
};

const _interpolateHSL = (function() {
  const hsl1 = [0, 0, 0];
  const hsl2 = [0, 0, 0];
  return function _interpolateHSL(color1, color2, factor, out) {
    rgb2hsl(color1, hsl1);
    rgb2hsl(color2, hsl2);
    for (let i = 0; i < 3; i++) {
      hsl1[i] += factor * (hsl2[i] - hsl1[i]);
    }
    return hsl2rgb(hsl1, out);
  };
})();

const HIGHLIGHT = new THREE.Color(23 / 255, 64 / 255, 118 / 255);
const NO_HIGHLIGHT = new THREE.Color(190 / 255, 190 / 255, 190 / 255);
const ROTATE_COLOR_1 = [150, 80, 150];
const ROTATE_COLOR_2 = [23, 64, 118];
const FAR = 4;

AFRAME.registerComponent("cursor-controller", {
  schema: {
    cursor: { type: "selector" },
    camera: { type: "selector" },
    minDistance: { default: 0.18 }
  },

  init: function() {
    this.enabled = true;

    this.data.cursor.addEventListener(
      "loaded",
      () => {
        this.data.cursor.object3DMap.mesh.renderOrder = window.APP.RENDER_ORDER.CURSOR;
      },
      { once: true }
    );

    this.distance = FAR;
    // raycaster state
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true; // flag specific to three-mesh-bvh
    this.raycaster.far = FAR;
    this.raycaster.near = 0.01;
    this.color = new THREE.Color(0, 0, 0);
    this.rotateColor = [0, 0, 0];
    const lineMaterial = new THREE.LineBasicMaterial({
      color: "white",
      opacity: 0.2,
      transparent: true,
      visible: false
    });

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.addAttribute("position", new THREE.BufferAttribute(new Float32Array(2 * 3), 3));

    this.line = new THREE.Line(lineGeometry, lineMaterial);
    this.el.setObject3D("line", this.line);
  },

  tick2: (() => {
    const rawIntersections = [];
    const cameraPos = new THREE.Vector3();

    return function(t) {
      const userinput = AFRAME.scenes[0].systems.userinput;
      const cursorPose = userinput.get(paths.actions.cursor.pose);
      const rightHandPose = userinput.get(paths.actions.rightHand.pose);

      this.data.cursor.object3D.visible = this.enabled && !!cursorPose;
      this.line.material.visible = this.enabled && rightHandPose;

      if (!this.enabled || !cursorPose) {
        return -1;
      }

      const interaction = AFRAME.scenes[0].systems.interaction;
      let intersection;
      const isGrabbing = !!interaction.rightRemoteConstraintTarget || !!interaction.buttonHeldByRightRemote;
      if (!isGrabbing) {
        rawIntersections.length = 0;
        this.raycaster.ray.origin = cursorPose.position;
        this.raycaster.ray.direction = cursorPose.direction;
        this.raycaster.intersectObjects(interaction.cursorHoverSystem.targets, true, rawIntersections);
        intersection = rawIntersections[0];
        this.distance = intersection ? intersection.distance : FAR;
      }

      const { cursor, minDistance, camera } = this.data;

      const cursorModDelta = userinput.get(paths.actions.cursor.modDelta) || 0;
      if (isGrabbing && !userinput.activeSets.has(sets.cursorHoldingUI)) {
        this.distance = THREE.Math.clamp(this.distance - cursorModDelta, minDistance, FAR);
      }
      cursor.object3D.position.copy(cursorPose.position).addScaledVector(cursorPose.direction, this.distance);
      // The cursor will always be oriented towards the player about its Y axis, so objects held by the cursor will rotate towards the player.
      getLastWorldPosition(camera.object3D, cameraPos);
      cameraPos.y = cursor.object3D.position.y;
      cursor.object3D.lookAt(cameraPos);
      cursor.object3D.scale.setScalar(Math.pow(this.distance, 0.315) * 0.75);
      cursor.object3D.matrixNeedsUpdate = true;

      if (AFRAME.scenes[0].systems["rotate-selected-object"].rotating) {
        _interpolateHSL(ROTATE_COLOR_1, ROTATE_COLOR_2, 0.5 + 0.5 * Math.sin(t / 1000.0), this.rotateColor);
        this.color.setRGB(this.rotateColor[0], this.rotateColor[1], this.rotateColor[2]);
      } else if (intersection || isGrabbing) {
        this.color.copy(HIGHLIGHT);
      } else {
        this.color.copy(NO_HIGHLIGHT);
      }

      if (!this.data.cursor.object3DMap.mesh.material.color.equals(this.color)) {
        this.data.cursor.object3DMap.mesh.material.color.copy(this.color);
        this.data.cursor.object3DMap.mesh.material.needsUpdate = true;
      }

      if (this.line.material.visible) {
        // Reach into line component for better performance
        const posePosition = cursorPose.position;
        const cursorPosition = cursor.object3D.position;
        const positionArray = this.line.geometry.attributes.position.array;

        positionArray[0] = posePosition.x;
        positionArray[1] = posePosition.y;
        positionArray[2] = posePosition.z;
        positionArray[3] = cursorPosition.x;
        positionArray[4] = cursorPosition.y;
        positionArray[5] = cursorPosition.z;

        this.line.geometry.attributes.position.needsUpdate = true;
        this.line.geometry.computeBoundingSphere();
      }
      return isGrabbing ? -1 : intersection;
    };
  })()
});
