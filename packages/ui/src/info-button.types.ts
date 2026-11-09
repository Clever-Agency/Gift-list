/** Props shared by the web tooltip and the native dialog fallback. */
export type InfoButtonProps = {
  /** The accessible name of the icon-only control; also the native dialog title. */
  label: string;
  /** The same explanation in every state of the control it sits next to. */
  explanation: string;
  /** The label of the native dialog's close button. */
  closeLabel: string;
  testID?: string;
};
