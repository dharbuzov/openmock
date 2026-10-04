"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useInterviewSession,
  useCaptureWorkspace,
} from "@/components/interview-session-context";
import { saveInterviewSession } from "@/lib/interview/session-storage";
import {
  buildInterviewContext,
  completeInterview,
} from "@/lib/interview/engine";

export function FinishInterviewButton() {
  const router = useRouter();
  const {
    problem,
    definition,
    operation,
    beginOperation,
    commitOperation,
    endOperation,
  } = useInterviewSession();
  const captureWorkspace = useCaptureWorkspace();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  function finish() {
    const request = beginOperation("finish");
    if (!request) return;
    setError("");
    try {
      const workspace = captureWorkspace();
      buildInterviewContext(request.interview, problem, definition, workspace);
      const completed = completeInterview(request.interview);
      saveInterviewSession({
        interview: completed,
        evaluationWorkspace: workspace,
        evaluationContext: { problem, definition },
      });
      commitOperation(request, completed);
      setOpen(false);
      router.replace(`/interviews/${completed.id}/result`);
    } catch {
      setError(
        "Could not save the interview. Check browser storage permissions and try again.",
      );
    } finally {
      endOperation(request);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            data-interview-finish
            size="icon-sm"
            className="sm:w-auto sm:px-2.5"
            variant="outline"
          />
        }
        aria-label="Finish interview"
        disabled={operation !== null}
      >
        <Check aria-hidden="true" className="sm:hidden" />
        <span className="hidden sm:inline">Finish</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finish interview?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to finish? You won&apos;t be able to continue
            this interview.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-muted-foreground">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={operation !== null}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={finish} disabled={operation !== null}>
            Finish interview
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
