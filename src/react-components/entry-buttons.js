import React from "react";
import { FormattedMessage } from "react-intl";
import PropTypes from "prop-types";

import MobileScreenEntryImg from "../assets/images/mobile_screen_entry.svg";
import DesktopScreenEntryImg from "../assets/images/desktop_screen_entry.svg";
import GenericVREntryImg from "../assets/images/generic_vr_entry.svg";
import GearVREntryImg from "../assets/images/gearvr_entry.svg";
import DaydreamEntryImg from "../assets/images/daydream_entry.svg";
import DeviceEntryImg from "../assets/images/device_entry.svg";
import styles from "../assets/stylesheets/entry.scss";
import { WithHoverSound } from "./wrap-with-audio";
import cx from "classnames";

const EntryButton = props => {
  return (
    <WithHoverSound>
      <button
        className={cx([{ [styles.entryButton]: true, [styles.entryButtonSecondary]: props.secondary }])}
        onClick={props.onClick}
      >
        <img src={props.iconSrc} className={styles.icon} />
        <div className={styles.label}>
          <div className={styles.contents}>
            <span>
              <FormattedMessage id={props.prefixMessageId} />
            </span>
            <span className={styles.bolded}>
              <FormattedMessage id={props.mediumMessageId} />
            </span>
            {props.subtitle && (
              <div className={styles.subtitle}>
                <FormattedMessage id={props.subtitle} />
              </div>
            )}
          </div>
        </div>
      </button>
    </WithHoverSound>
  );
};

EntryButton.propTypes = {
  onClick: PropTypes.func,
  iconSrc: PropTypes.string,
  secondary: PropTypes.bool,
  prefixMessageId: PropTypes.string,
  mediumMessageId: PropTypes.string,
  subtitle: PropTypes.string,
  isInHMD: PropTypes.bool
};

const isMobile = AFRAME.utils.device.isMobile() || AFRAME.utils.device.isMobileVR();

export const TwoDEntryButton = props => {
  const entryButtonProps = {
    ...props,
    iconSrc: isMobile ? MobileScreenEntryImg : DesktopScreenEntryImg,
    prefixMessageId: "entry.screen-prefix",
    mediumMessageId: isMobile ? "entry.mobile-screen" : "entry.desktop-screen"
  };

  return <EntryButton {...entryButtonProps} />;
};

export const GenericEntryButton = props => {
  const entryButtonProps = {
    ...props,
    iconSrc: GenericVREntryImg,
    prefixMessageId: "entry.generic-prefix",
    mediumMessageId: "entry.generic-medium",
    subtitle: isMobile ? null : "entry.generic-subtitle-desktop"
  };

  return <EntryButton {...entryButtonProps} />;
};

export const GearVREntryButton = props => {
  const entryButtonProps = {
    ...props,
    iconSrc: GearVREntryImg,
    prefixMessageId: "entry.gearvr-prefix",
    mediumMessageId: "entry.gearvr-medium"
  };

  return <EntryButton {...entryButtonProps} />;
};

export const DaydreamEntryButton = props => {
  const entryButtonProps = {
    ...props,
    iconSrc: DaydreamEntryImg,
    prefixMessageId: "entry.daydream-prefix",
    mediumMessageId: "entry.daydream-medium"
  };

  return <EntryButton {...entryButtonProps} />;
};

export const SafariEntryButton = props => {
  const entryButtonProps = {
    ...props,
    iconSrc: MobileScreenEntryImg,
    prefixMessageId: "entry.screen-prefix",
    mediumMessageId: "entry.mobile-safari"
  };

  return <EntryButton {...entryButtonProps} />;
};

export const DeviceEntryButton = props => {
  const entryButtonProps = {
    ...props,
    iconSrc: DeviceEntryImg,
    prefixMessageId: isMobile ? "entry.device-prefix-mobile" : "entry.device-prefix-desktop",
    mediumMessageId: "entry.device-medium"
  };

  entryButtonProps.subtitle = entryButtonProps.isInHMD
    ? "entry.device-subtitle-vr"
    : isMobile
      ? "entry.device-subtitle-mobile"
      : "entry.device-subtitle-desktop";

  return <EntryButton {...entryButtonProps} />;
};
