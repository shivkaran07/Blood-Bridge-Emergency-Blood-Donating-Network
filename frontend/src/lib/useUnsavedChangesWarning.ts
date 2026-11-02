import { useEffect } from 'react';

/**
 * Warns before a full page unload when a form has unsaved changes. In-app
 * route changes are still navigable (the router has no blocker in this app),
 * but closing or refreshing the tab cannot silently discard edits.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
}
