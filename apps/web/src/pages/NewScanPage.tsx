import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ScanForm } from "../components/scans/ScanForm";
import { Card } from "../components/ui/Ui";

export function NewScanPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const create = useMutation({
    mutationFn: api.createScan,
    onSuccess: (data) => navigate(`/scans/${data.scanId}`),
  });

  return (
    <div className="w-full space-y-5">
      <h1 className="text-3xl font-semibold">Start a website scan</h1>
      <p className="text-sm text-slate-600">For a Chrome window and live typing, choose Autonomous workflow. Full website only checks the pages.</p>
      <Card>
        <ScanForm
          initialName={params.get("name") ?? ""}
          pending={create.isPending}
          error={create.error ? (create.error as Error).message : undefined}
          onSubmit={(value) => create.mutate(value)}
        />
      </Card>
    </div>
  );
}
