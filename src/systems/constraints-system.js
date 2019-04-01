const ACTIVATION_STATE = require("aframe-physics-system/src/constants").ACTIVATION_STATE;

function storeState(prev, curr, holdingBlocked) {
  prev.held = !holdingBlocked && curr.held;
  prev.hovered = curr.hovered;
}

export class ConstraintsSystem {
  constructor() {
    this.prevLeftHand = {
      held: null,
      hovered: null
    };
    this.prevRightHand = {
      held: null,
      hovered: null
    };
    this.prevRightRemote = {
      held: null,
      hovered: null
    };
  }

  tickInteractor(options, state, prevState) {
    if (prevState.held === state.held) {
      return;
    }
    if (
      prevState.held &&
      prevState.held.components.tags &&
      prevState.held.components.tags.data[options.constraintTag]
    ) {
      prevState.held.removeAttribute("ammo-constraint__" + options.entity.id);
      let hasAnotherConstraint = false;
      for (const componentName in prevState.held.components) {
        if (componentName.startsWith("ammo-constraint")) {
          hasAnotherConstraint = true;
        }
      }
      if (!hasAnotherConstraint) {
        prevState.held.setAttribute("ammo-body", { activationState: ACTIVATION_STATE.ACTIVE_TAG });
      }
    }
    if (state.held && state.held.components.tags && state.held.components.tags.data[options.constraintTag]) {
      if (!state.held.components["networked"] || NAF.utils.isMine(state.held) || NAF.utils.takeOwnership(state.held)) {
        if (!state.held.components["ammo-body"] || !state.held.components["ammo-body"].isLoaded) {
          return true;
        }
        state.held.object3D.updateMatrices();
        state.held.setAttribute("ammo-body", {
          type: "dynamic",
          activationState: ACTIVATION_STATE.DISABLE_DEACTIVATION
        });
        state.held.components["ammo-body"].syncToPhysics();
        state.held.setAttribute("ammo-constraint__" + options.entity.id, { target: "#" + options.entity.id });
      } else {
        // TODO communicate failure to obtain network ownership
      }
    }
  }

  tick() {
    const interaction = AFRAME.scenes[0].systems.interaction;

    this.tickInteractor(interaction.options.leftHand, interaction.state.leftHand, this.prevLeftHand);
    this.tickInteractor(interaction.options.rightHand, interaction.state.rightHand, this.prevRightHand);
    const holdingBlocked = this.tickInteractor(
      interaction.options.rightRemote,
      interaction.state.rightRemote,
      this.prevRightRemote
    );

    storeState(this.prevLeftHand, interaction.state.leftHand);
    storeState(this.prevRightHand, interaction.state.rightHand);
    storeState(this.prevRightRemote, interaction.state.rightRemote, holdingBlocked);
  }
}
