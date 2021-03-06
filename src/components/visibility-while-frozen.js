import { getLastWorldPosition } from "../utils/three-utils";

const isMobile = AFRAME.utils.device.isMobile();

/**
 * Toggles the visibility of this entity when the scene is frozen.
 * @namespace ui
 * @component visibility-while-frozen
 */
AFRAME.registerComponent("visibility-while-frozen", {
  schema: {
    withinDistance: { type: "number" },
    visible: { type: "boolean", default: true },
    requireHoverOnNonMobile: { type: "boolean", default: true }
  },

  init() {
    this.updateVisibility = this.updateVisibility.bind(this);
    this.camWorldPos = new THREE.Vector3();
    this.objWorldPos = new THREE.Vector3();
    this.cam = this.el.sceneEl.camera.el.object3D;

    let hoverableSearch = this.el;

    while (hoverableSearch !== document) {
      if (hoverableSearch.getAttribute("is-remote-hover-target") !== null) {
        this.hoverable = hoverableSearch;
        break;
      }

      hoverableSearch = hoverableSearch.parentNode;
    }
    if (!this.hoverable && this.data.requireHoverOnNonMobile) {
      console.error("Didn't find a remote hover target.");
    }

    this.onStateChange = evt => {
      if (!evt.detail === "frozen") return;
      this.updateVisibility();
    };
    this.updateVisibility();
  },

  tick() {
    if (!this.data.withinDistance) return;

    const isFrozen = this.el.sceneEl.is("frozen");
    const isVisible = this.el.getAttribute("visible");
    if (!isFrozen && !isVisible) return;

    this.updateVisibility();
  },

  updateVisibility() {
    const isFrozen = this.el.sceneEl.is("frozen");

    let isWithinDistance = true;
    const isVisible = this.el.object3D.visible;

    if (this.data.withinDistance !== undefined) {
      if (!isVisible) {
        // Edge case, if the object is not visible force a matrix update
        // since the main matrix update loop will not do it.
        this.el.object3D.updateMatrices(true, true);
      }

      getLastWorldPosition(this.cam, this.camWorldPos);
      this.objWorldPos.copy(this.el.object3D.position);
      this.el.object3D.localToWorld(this.objWorldPos);

      isWithinDistance =
        this.camWorldPos.distanceToSquared(this.objWorldPos) < this.data.withinDistance * this.data.withinDistance;
    }

    const isTransforming = AFRAME.scenes[0].systems["transform-selected-object"].transforming;

    let shouldBeVisible =
      ((isFrozen && this.data.visible) || (!isFrozen && !this.data.visible)) && isWithinDistance && !isTransforming;

    if (this.data.requireHoverOnNonMobile && !isMobile) {
      shouldBeVisible =
        shouldBeVisible &&
        ((this.hoverable && AFRAME.scenes[0].systems.interaction.state.rightRemote.hovered === this.hoverable) ||
          isVisible);
    }

    if (isVisible !== shouldBeVisible) {
      this.el.setAttribute("visible", shouldBeVisible);
    }
  },

  play() {
    this.el.sceneEl.addEventListener("stateadded", this.onStateChange);
    this.el.sceneEl.addEventListener("stateremoved", this.onStateChange);

    if (this.hoverable) {
      this.hoverable.object3D.addEventListener("hovered", this.updateVisibility);
      this.hoverable.object3D.addEventListener("unhovered", this.updateVisibility);
    }
  },

  pause() {
    this.el.sceneEl.removeEventListener("stateadded", this.onStateChange);
    this.el.sceneEl.removeEventListener("stateremoved", this.onStateChange);

    if (this.hoverable) {
      this.hoverable.object3D.addEventListener("hovered", this.updateVisibility);
      this.hoverable.object3D.addEventListener("unhovered", this.updateVisibility);
    }
  }
});

/**
 * Toggles the interactivity of a UI entity while the scene is frozen.
 * @namespace ui
 * @component ui-class-while-frozen
 */
AFRAME.registerComponent("ui-class-while-frozen", {
  init() {
    this.onStateChange = evt => {
      if (!evt.detail === "frozen") return;
      this.el.classList.toggle("ui", this.el.sceneEl.is("frozen"));
    };
    this.el.classList.toggle("ui", this.el.sceneEl.is("frozen"));
  },

  play() {
    this.el.sceneEl.addEventListener("stateadded", this.onStateChange);
    this.el.sceneEl.addEventListener("stateremoved", this.onStateChange);
  },

  pause() {
    this.el.sceneEl.removeEventListener("stateadded", this.onStateChange);
    this.el.sceneEl.removeEventListener("stateremoved", this.onStateChange);
  }
});
