// UI-only state. No notification or callback is serialized into a document.
export const notificationUI = $state({
  busy: '', busyIndicator: true, error: '', recoveryBusy: false,
  recover: async () => {}, exportRecovery: async () => {}, exportCopy: async () => {}, dismissError: () => {},
  dialog: undefined as HTMLDialogElement | undefined,
});
const dialogs: HTMLDialogElement[] = [];
export function registerNotificationDialog(dialog: HTMLDialogElement) {
  dialogs.push(dialog); notificationUI.dialog = dialog;
  return () => {
    const index = dialogs.indexOf(dialog); if (index >= 0) dialogs.splice(index, 1);
    notificationUI.dialog = dialogs.filter(item => item.open && item.isConnected).at(-1);
  };
}
