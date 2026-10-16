import { useState } from "react";
import { Button, Modal } from "../ui/Ui";

const TEMPLATES = [
  { id: "ink", label: "Soft black", swatch: "bg-[#1C1916]" },
  { id: "ivory", label: "Warm ivory", swatch: "border border-slate-300 bg-[#FFFBF5]" },
  { id: "split", label: "Split orange", swatch: "bg-gradient-to-r from-[#BF5700] from-50% to-[#FFFBF5] to-50%" },
  { id: "sand", label: "Sand band", swatch: "bg-[#F3E0CC]" },
] as const;

export function CreatePptButton({ scanId, className = "" }: { scanId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["id"]>("ink");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setOpen(false);
    setError("");
  }

  async function create() {
    const presenter = name.trim();
    const company = companyName.trim();
    if (!presenter || !company) {
      setError("Enter your name and the company name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const token = window.localStorage.getItem("qa-auth-token");
      const response = await fetch(`/api/scans/${scanId}/presentation.pptx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: presenter, companyName: company, template }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ error: "Could not create the PPT" }))) as { error?: string };
        throw new Error(payload.error || "Could not create the PPT");
      }
      const blob = await response.blob();
      const header = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(header);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] || "website-presentation.pptx";
      link.click();
      URL.revokeObjectURL(url);
      setOpen(false);
      setName("");
      setCompanyName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the PPT");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" className={className} onClick={() => setOpen(true)}>
        Create PPT
      </Button>
      <Modal open={open} title="Create PPT" onClose={close}>
        <p className="text-sm text-slate-600">
          Pick a cover design. The company name is the title. Your name stays at the bottom right. Each following slide holds three screens, and every captured screen is included.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <fieldset>
            <legend className="text-sm font-medium text-slate-800">Design</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplate(item.id)}
                  className={`rounded-xl border p-2 text-left text-sm ${template === item.id ? "border-brand-700 ring-2 ring-brand-700" : "border-slate-300"}`}
                >
                  <span className={`mb-2 block h-10 rounded-lg ${item.swatch}`} />
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium text-slate-800">
            Your name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              autoComplete="name"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700"
            />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Company name
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              maxLength={80}
              autoComplete="organization"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create PPT"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
