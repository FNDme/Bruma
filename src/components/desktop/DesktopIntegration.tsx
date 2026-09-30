import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSystemChecks } from "@/contexts/SystemChecksContext";
import {
  DesktopActionPayload,
  hideMainWindow,
  onDesktopAction,
} from "@/lib/desktop";
import { QuickCaptureDialog, type QuickCaptureKind } from "./QuickCaptureDialog";

/**
 * Handles tray menu items and the global quick-capture shortcut sent by the
 * Rust side (src-tauri/src/desktop.rs). Mount once, inside the router and the
 * app providers.
 */
export function DesktopIntegration() {
  const navigate = useNavigate();
  const { runChecks } = useSystemChecks();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<QuickCaptureKind>("todo");
  // Hide again after capturing if the shortcut pulled the window out of the tray
  const hideWhenDone = useRef(false);

  const latest = useRef({ navigate, runChecks });
  latest.current = { navigate, runChecks };

  const handleAction = useCallback((payload: DesktopActionPayload) => {
    switch (payload.action) {
      case "quick-capture":
      case "quick-note":
      case "quick-todo": {
        if (payload.action === "quick-note") setKind("note");
        if (payload.action === "quick-todo") setKind("todo");
        // A second press while open should not forget that we came from the tray
        setOpen((wasOpen) => {
          if (!wasOpen) hideWhenDone.current = payload.wasHidden;
          return true;
        });
        break;
      }
      case "run-checks": {
        latest.current.navigate("/system-checks");
        void latest.current.runChecks().then((results) => {
          if (results === null) toast.info("The checks are already running");
        });
        break;
      }
    }
  }, []);

  useEffect(() => onDesktopAction(handleAction), [handleAction]);

  const handleClose = (saved: boolean) => {
    setOpen(false);
    if (hideWhenDone.current) {
      hideWhenDone.current = false;
      // Only go back to the tray after a capture; cancelling keeps the window
      // up, since the user may have wanted the app itself.
      if (saved) void hideMainWindow();
    }
  };

  return (
    <QuickCaptureDialog
      open={open}
      kind={kind}
      onKindChange={setKind}
      onClose={handleClose}
    />
  );
}
