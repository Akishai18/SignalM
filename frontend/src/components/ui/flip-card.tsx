/**
 * FlipCard Component
 * Displays educational content in a modal dialog
 */
import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  className?: string;
}

export function FlipCard({ front, back, className }: FlipCardProps) {
  return (
    <Dialog>
      <div className={cn("relative", className)}>
        {front}
        {/* Info button overlay */}
        <DialogTrigger asChild>
          <button
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all hover:scale-110 shadow-lg"
            title="Learn more"
          >
            <Info className="h-4 w-4" />
          </button>
        </DialogTrigger>
      </div>

      {/* Educational content in modal */}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-primary/20 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
        {back}
      </DialogContent>
    </Dialog>
  );
}
