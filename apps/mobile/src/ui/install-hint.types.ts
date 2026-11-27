/** The hint is shown until the cross writes the marker of this browser (UX-DR11). */
export type InstallHintState = {
  /** The browser has not closed it yet. */
  visible: boolean;
  /** Closes it for this browser: local storage plus this mount. */
  dismiss: () => void;
};

export type InstallHintProps = {
  /** The cross «Закрыть подсказку». */
  onClose: () => void;
  testID?: string;
};
