/* global Ammo */
import { waitForEvent } from "../utils/async-utils";
import { paths } from "./userinput/paths";
import { addMedia } from "../utils/media-utils";
import { ObjectContentOrigins } from "../object-types";

export const EVENT_TYPE_CONSTRAINT_CREATION_ATTEMPT = "constraint-creation-attempt";
export const EVENT_TYPE_CONSTRAINT_REMOVAL = "constraint-removal";
export const RIGHT_HAND_CONSTRAINER = "right-hand";
export const LEFT_HAND_CONSTRAINER = "left-hand";
export const RIGHT_REMOTE_CONSTRAINER = "right-hand-constrainer";

const UNHOVERED_EVENT = { type: "unhovered" };
const HOVERED_EVENT = { type: "hovered" };
const RIGHT_HAND_CONSTRAINT_CREATION_ATTEMPT_EVENT = {
  type: EVENT_TYPE_CONSTRAINT_CREATION_ATTEMPT,
  constrainer: RIGHT_HAND_CONSTRAINER
};
const LEFT_HAND_CONSTRAINT_CREATION_ATTEMPT_EVENT = {
  type: EVENT_TYPE_CONSTRAINT_CREATION_ATTEMPT,
  constrainer: LEFT_HAND_CONSTRAINER
};
const RIGHT_REMOTE_CONSTRAINT_CREATION_ATTEMPT_EVENT = {
  type: EVENT_TYPE_CONSTRAINT_CREATION_ATTEMPT,
  constrainer: RIGHT_REMOTE_CONSTRAINER
};
const RIGHT_HAND_CONSTRAINT_REMOVAL_EVENT = {
  type: EVENT_TYPE_CONSTRAINT_REMOVAL,
  constrainer: RIGHT_HAND_CONSTRAINER
};
const LEFT_HAND_CONSTRAINT_REMOVAL_EVENT = {
  type: EVENT_TYPE_CONSTRAINT_REMOVAL,
  constrainer: LEFT_HAND_CONSTRAINER
};
const RIGHT_REMOTE_CONSTRAINT_REMOVAL_EVENT = {
  type: EVENT_TYPE_CONSTRAINT_REMOVAL,
  constrainer: RIGHT_REMOTE_CONSTRAINER
};

AFRAME.registerComponent("offers-constraint-when-colliding", {});
AFRAME.registerComponent("offers-remote-constraint", {});
AFRAME.registerComponent("single-action-button", {});
AFRAME.registerComponent("holdable-button", {});
AFRAME.registerComponent("is-pen", {});

const handCollisionTargets = new Map();
AFRAME.registerComponent("is-hand-collision-target", {
  init: function() {
    handCollisionTargets.set(this.el.object3D.uuid, this.el);
  }
});
function findHandCollisionTarget(o) {
  if (!o) return null;
  const target = handCollisionTargets.get(o.uuid);
  return target || findHandCollisionTarget(o.parent);
}
function findHandCollisionTargetForBody(body) {
  const driver = AFRAME.scenes[0].systems.physics.driver;
  const collisions = driver.collisions;
  const rightHandPtr = Ammo.getPointer(body);
  for (const key in collisions) {
    const [body0ptr, body1ptr] = collisions[key];
    if (body0ptr === rightHandPtr) {
      return findHandCollisionTarget(driver.els[body1ptr].object3D);
    }
    if (body1ptr === rightHandPtr) {
      return findHandCollisionTarget(driver.els[body0ptr].object3D);
    }
  }
}

const remoteHoverTargets = new Map();
function findRemoteHoverTarget(o) {
  if (!o) return null;
  const target = remoteHoverTargets.get(o.uuid);
  return target || findRemoteHoverTarget(o.parent);
}
AFRAME.registerComponent("is-remote-hover-target", {
  init: function() {
    remoteHoverTargets.set(this.el.object3D.uuid, this.el);
  }
});

AFRAME.registerSystem("interaction", {
  updateCursorIntersection: function(intersection) {
    const hoverTarget = intersection && findRemoteHoverTarget(intersection.object);
    if (!hoverTarget) {
      if (this.rightRemoteHoverTarget) {
        this.rightRemoteHoverTarget.object3D.dispatchEvent(UNHOVERED_EVENT);
        this.rightRemoteHoverTarget = null;
      }
      return;
    }

    if (!this.rightRemoteHoverTarget) {
      this.rightRemoteHoverTarget = hoverTarget;
      this.rightRemoteHoverTarget.object3D.dispatchEvent(HOVERED_EVENT);
    } else if (hoverTarget !== this.rightRemoteHoverTarget) {
      this.rightRemoteHoverTarget.object3D.dispatchEvent(UNHOVERED_EVENT);
      this.rightRemoteHoverTarget = hoverTarget;
      this.rightRemoteHoverTarget.object3D.dispatchEvent(HOVERED_EVENT);
    }
  },

  async spawnObjectRoutine(constraintObject3D, superSpawner, constraintTarget, event) {
    constraintObject3D.updateMatrices();
    constraintObject3D.matrix.decompose(
      constraintObject3D.position,
      constraintObject3D.quaternion,
      constraintObject3D.scale
    );
    const data = superSpawner.data;
    const entity = addMedia(data.src, data.template, ObjectContentOrigins.SPAWNER, data.resolve, data.resize).entity;
    entity.object3D.position.copy(data.useCustomSpawnPosition ? data.spawnPosition : superSpawner.el.object3D.position);
    entity.object3D.rotation.copy(data.useCustomSpawnRotation ? data.spawnRotation : superSpawner.el.object3D.rotation);
    entity.object3D.scale.copy(data.useCustomSpawnScale ? data.spawnScale : superSpawner.el.object3D.scale);
    entity.object3D.matrixNeedsUpdate = true;

    superSpawner.activateCooldown();
    // WARNING: waitForEvent is semantically different than entity.addEventListener("body-loaded", ...)
    // and adding a callback fn via addEventListener will not work unless the callback function
    // wraps its code in setTimeout(()=>{...}, 0)
    await waitForEvent("body-loaded", entity);
    entity.object3D.position.copy(data.useCustomSpawnPosition ? data.spawnPosition : superSpawner.el.object3D.position);
    if (data.centerSpawnedObject) {
      entity.body.position.copy(constraintObject3D.position);
    }
    entity.object3D.scale.copy(data.useCustomSpawnScale ? data.spawnScale : superSpawner.el.object3D.scale);
    entity.object3D.matrixNeedsUpdate = true;

    if (constraintTarget === "#player-left-controller") {
      this.leftHandConstraintTarget = entity;
    } else if (constraintTarget === "#player-right-controller") {
      this.rightHandConstraintTarget = entity;
    } else if (constraintTarget === "#cursor") {
      this.rightRemoteConstraintTarget = entity;
    }
    entity.setAttribute("ammo-constraint", { target: constraintTarget });
    entity.object3D.dispatchEvent(event);
    entity.components["ammo-body"].syncToPhysics();
  },

  init: function() {
    this.rightRemoteConstraintTarget = null;
    this.weWantToGrab = false;
  },

  tick: async function() {
    const userinput = AFRAME.scenes[0].systems.userinput;
    const rightHandDrop = userinput.get(paths.actions.rightHand.drop);
    const rightHandGrab = userinput.get(paths.actions.rightHand.grab);
    const leftHandDrop = userinput.get(paths.actions.leftHand.drop);
    const leftHandGrab = userinput.get(paths.actions.leftHand.grab);
    const drop = userinput.get(paths.actions.cursor.drop);
    const grab = userinput.get(paths.actions.cursor.grab);
    this.cursor = this.cursor || document.querySelector("#cursor");
    this.cursorController = this.cursorController || document.querySelector("#cursor-controller");
    this.rightHand = this.rightHand || document.querySelector("#player-right-controller");
    this.leftHand = this.leftHand || document.querySelector("#player-left-controller");
    this.rightHandTeleporter = this.rightHand.components["teleporter"];

    if (this.leftHandConstraintTarget) {
      if (leftHandDrop) {
        this.leftHandConstraintTarget.object3D.dispatchEvent(LEFT_HAND_CONSTRAINT_REMOVAL_EVENT);
        this.leftHandConstraintTarget.removeAttribute("ammo-constraint");
        this.leftHandConstraintTarget = null;
      }
    } else {
      this.leftHandCollisionTarget =
        !this.leftRemoteConstraintTarget && findHandCollisionTargetForBody(this.leftHand.body);

      if (this.leftHandCollisionTarget) {
        if (leftHandGrab) {
          const offersCollisionConstraint = this.leftHandCollisionTarget.components["offers-constraint-when-colliding"];
          const superSpawner = this.leftHandCollisionTarget.components["super-spawner"];
          if (offersCollisionConstraint) {
            this.leftHandConstraintTarget = this.leftHandCollisionTarget;
            this.leftHandConstraintTarget.setAttribute("ammo-constraint", { target: "#player-left-controller" });

            this.leftHandCollisionTarget.object3D.dispatchEvent(LEFT_HAND_CONSTRAINT_CREATION_ATTEMPT_EVENT);
          } else if (superSpawner) {
            this.spawnObjectRoutine(
              this.leftHand.object3D,
              superSpawner,
              "#player-left-controller",
              LEFT_HAND_CONSTRAINT_CREATION_ATTEMPT_EVENT
            );
          }
        }
      }
    }

    if (this.rightHandConstraintTarget) {
      if (rightHandDrop) {
        this.rightHandConstraintTarget.object3D.dispatchEvent(RIGHT_HAND_CONSTRAINT_REMOVAL_EVENT);
        this.rightHandConstraintTarget.removeAttribute("ammo-constraint");
        this.rightHandConstraintTarget = null;
      }
    } else {
      this.rightHandCollisionTarget =
        !this.rightRemoteConstraintTarget && findHandCollisionTargetForBody(this.rightHand.body);
      if (this.rightHandCollisionTarget) {
        if (rightHandGrab) {
          const offersCollisionConstraint = this.rightHandCollisionTarget.components[
            "offers-constraint-when-colliding"
          ];
          const superSpawner = this.rightHandCollisionTarget.components["super-spawner"];
          if (offersCollisionConstraint) {
            this.rightHandConstraintTarget = this.rightHandCollisionTarget;
            this.rightHandConstraintTarget.setAttribute("ammo-constraint", { target: "#player-right-controller" });

            this.rightHandConstraintTarget.object3D.dispatchEvent(RIGHT_HAND_CONSTRAINT_CREATION_ATTEMPT_EVENT);
          } else if (superSpawner) {
            this.spawnObjectRoutine(
              this.rightHand.object3D,
              superSpawner,
              "#player-right-controller",
              RIGHT_HAND_CONSTRAINT_CREATION_ATTEMPT_EVENT
            );
          }
        }
      }
    }

    const cursorWasEnabled = this.cursorController.components["cursor-controller"].enabled;
    const cursorShouldBeEnabled = !this.rightHandCollisionTarget && !this.rightHandTeleporter.isTeleporting;
    this.cursorController.components["cursor-controller"].enabled = cursorShouldBeEnabled;
    if (cursorWasEnabled && !cursorShouldBeEnabled && this.rightRemoteHoverTarget) {
      this.rightRemoteHoverTarget.object3D.dispatchEvent(UNHOVERED_EVENT);
      this.rightRemoteHoverTarget = null;
    }

    const rightRemoteHoverTarget = !this.rightHandCollisionTarget && this.rightRemoteHoverTarget; // TODO: THIS IS SUPER CONFUSING

    if (this.buttonHeldByRightRemote && drop) {
      this.buttonHeldByRightRemote.el.object3D.dispatchEvent({
        type: "holdable-button-up",
        path: paths.actions.cursor.drop
      });
      this.buttonHeldByRightRemote = null;
    }

    if (this.rightRemoteConstraintTarget) {
      if (drop) {
        this.rightRemoteConstraintTarget.object3D.dispatchEvent(RIGHT_REMOTE_CONSTRAINT_REMOVAL_EVENT);
        this.rightRemoteConstraintTarget.removeAttribute("ammo-constraint");
        this.rightRemoteConstraintTarget = null;
      }
    } else {
      if (rightRemoteHoverTarget && (grab || this.weWantToGrab)) {
        this.weWantToGrab = false;
        const singleActionButton = rightRemoteHoverTarget.components["single-action-button"];
        if (singleActionButton) {
          singleActionButton.el.object3D.dispatchEvent({ type: "interact", path: paths.actions.cursor.grab });
        }

        const holdableButton = rightRemoteHoverTarget.components["holdable-button"];
        if (holdableButton) {
          this.buttonHeldByRightRemote = holdableButton;
          holdableButton.el.object3D.dispatchEvent({ type: "holdable-button-down", path: paths.actions.cursor.grab });
        }

        const offersRemoteConstraint = rightRemoteHoverTarget.components["offers-remote-constraint"];
        const superSpawner = rightRemoteHoverTarget.components["super-spawner"];
        if (offersRemoteConstraint) {
          this.rightRemoteConstraintTarget = rightRemoteHoverTarget;
          this.rightRemoteConstraintTarget.setAttribute("ammo-constraint", { target: "#cursor" });

          this.rightRemoteConstraintTarget.object3D.dispatchEvent(RIGHT_REMOTE_CONSTRAINT_CREATION_ATTEMPT_EVENT);
        } else if (superSpawner) {
          this.spawnObjectRoutine(
            this.cursor.object3D,
            superSpawner,
            "#cursor",
            RIGHT_REMOTE_CONSTRAINT_CREATION_ATTEMPT_EVENT
          );
        }
      }
    }
  }
});