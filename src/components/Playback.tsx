import { ReactNode } from 'react';
import { Button, Icon, Segmented } from './ui';

/** Transport controls shared by all time-dependent views. */
export function PlaybackBar({
  playing,
  onToggle,
  onReset,
  onReplay,
  onStepBack,
  onStepForward,
  speed,
  onSpeed,
  speeds = [0.25, 0.5, 1, 2],
  children,
}: {
  playing: boolean;
  onToggle: () => void;
  onReset?: () => void;
  onReplay?: () => void;
  onStepBack?: () => void;
  onStepForward?: () => void;
  speed?: number;
  onSpeed?: (s: number) => void;
  speeds?: number[];
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} title="Reset">
          {Icon.reset}
        </Button>
      )}
      {onStepBack && (
        <Button variant="ghost" size="sm" onClick={onStepBack} title="Step back">
          {Icon.stepB}
        </Button>
      )}
      <Button variant="primary" size="sm" onClick={onToggle} title={playing ? 'Pause' : 'Play'} className="w-9">
        {playing ? Icon.pause : Icon.play}
      </Button>
      {onStepForward && (
        <Button variant="ghost" size="sm" onClick={onStepForward} title="Step forward">
          {Icon.stepF}
        </Button>
      )}
      {onReplay && (
        <Button variant="ghost" size="sm" onClick={onReplay} title="Replay from start">
          {Icon.replay}
        </Button>
      )}
      {speed !== undefined && onSpeed && (
        <Segmented
          size="sm"
          className="ml-1"
          value={String(speed)}
          onChange={(v) => onSpeed(parseFloat(v))}
          options={speeds.map((s) => ({ value: String(s), label: `${s}×` }))}
        />
      )}
      {children}
    </div>
  );
}
