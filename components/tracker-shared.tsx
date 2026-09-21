"use client";
import { t as tr, useI18n, errorMessage } from "@/lib/i18n";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { X, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  dateLabel,
  monthLabel,
  shiftDate,
  shiftMonth,
  type State,
} from "@/lib/tracker-core";
export type Save = (
  change: (s: State) => void,
  message?: string,
) => Promise<boolean>;
export function Btn({
  children,
  secondary = false,
  className = "",
  ...props
}: React.ComponentProps<typeof Button> & { secondary?: boolean }) {
  useI18n();
  return (
    <Button
      {...props}
      className={`button ${secondary ? "secondary" : "primary"} ${className}`}
    >
      {children}
    </Button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  useI18n();
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Form({
  children,
  onSubmit,
  label = tr("Lagre"),
  cancel,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<boolean | void>;
  label?: string;
  cancel?: () => void;
}) {
  useI18n();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onSubmit(new FormData(e.currentTarget));
    } catch (e) {
      setError(errorMessage(e, "Sjekk at alle feltene har gyldige verdier."));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack" aria-busy={busy}>
      {children}
      {error && (
        <div className="error-box" role="alert">
          {errorMessage(new Error(error))}
        </div>
      )}
      <div className="form-actions">
        {cancel && (
          <Btn type="button" secondary onClick={cancel}>
            {tr("Avbryt")}
          </Btn>
        )}
        <Btn type="submit" disabled={busy}>
          {busy ? tr("Lagrer …") : label}
        </Btn>
      </div>
    </form>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  trigger,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  trigger?: HTMLElement | null;
}) {
  useI18n();
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement),
  );
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      document.documentElement.style.setProperty(
        "--dialog-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      document.documentElement.style.setProperty(
        "--dialog-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        contained
        ref={dialog}
        className="tracker-dialog"
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          dialog.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          (trigger ?? returnFocus.current)?.focus();
        }}
      >
        <DialogTitle className="dialog-title">{title}</DialogTitle>
        <DialogDescription
          className={description ? "dialog-description" : "sr-only"}
        >
          {description ?? title}
        </DialogDescription>
        <DialogClose asChild>
          <button aria-label={tr("Lukk")} className="dialog-close icon-button">
            <X size={19} />
          </button>
        </DialogClose>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function DatePicker({
  value,
  onChange,
  month = false,
}: {
  value: string;
  onChange: (x: string) => void;
  month?: boolean;
}) {
  useI18n();
  return (
    <div className="date-picker">
      <button
        aria-label={month ? tr("Forrige måned") : tr("Forrige dag")}
        className="icon-button"
        onClick={() =>
          onChange(month ? shiftMonth(value, -1) : shiftDate(value, -1))
        }
      >
        <ChevronLeft size={16} />
      </button>
      <label>
        <span>
          {month
            ? monthLabel(value)
            : dateLabel(value, { day: "numeric", month: "long" })}
        </span>
        <input
          aria-label={month ? tr("Velg måned") : tr("Velg dato")}
          type={month ? "month" : "date"}
          value={value}
          min={month ? "1900-01" : "1900-01-01"}
          max={month ? "2200-12" : "2200-12-31"}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        />
      </label>
      <button
        aria-label={month ? tr("Neste måned") : tr("Neste dag")}
        className="icon-button"
        onClick={() =>
          onChange(month ? shiftMonth(value, 1) : shiftDate(value, 1))
        }
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
export function Empty({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  useI18n();
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon ?? <Inbox size={25} />}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  useI18n();
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span
        className={value >= 100 ? "over" : ""}
        style={{
          transform: `scaleX(${Math.min(1, Math.max(0, value / 100))})`,
        }}
      />
    </div>
  );
}
export const val = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
export const optional = (d: FormData, k: string, fn: (s: string) => number) =>
  val(d, k) === "" ? null : fn(val(d, k));
export function download(name: string, content: string, type: string) {
  void exportFile(name, content, type);
}
async function exportFile(name: string, content: string, type: string) {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory, Encoding } =
        await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const file = await Filesystem.writeFile({
        path: name,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: tr("Arc by Nortivo – sikkerhetskopi"),
        files: [file.uri],
        dialogTitle: tr("Lagre en kopi"),
      });
    } catch {
      const { toast } = await import("sonner");
      toast.error(
        tr(
          "Eksporten ble ikke fullført. Prøv igjen og velg hvor kopien skal lagres.",
        ),
      );
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
