import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { COLUMNS, COLUMN_STAGE_TARGET, type ColumnKey } from "@/components/impact/impact-queue-types";

export function ImpactStageMoveDialog({
  open,
  leadName,
  from,
  to,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  leadName: string;
  from: ColumnKey;
  to: ColumnKey;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const fromLabel = COLUMNS.find((c) => c.key === from)?.label ?? from;
  const toLabel = COLUMNS.find((c) => c.key === to)?.label ?? to;
  const stage = COLUMN_STAGE_TARGET[to];

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move {leadName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Move from <strong>{fromLabel}</strong> to <strong>{toLabel}</strong>
            {stage ? ` (stage → ${stage.replace(/-/g, " ")})` : ""}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm move</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
