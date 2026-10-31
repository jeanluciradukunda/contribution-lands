import { useEffect, useRef, useState } from 'react';
import { IsoRenderer, type ContributionData } from '../content/renderer';
import { computeStats, todayKey } from '../content/stats';
import { loadTheme, type LoadedTheme } from '../lib/theme-loader';

interface LandViewProps {
  data: ContributionData[];
  themeId: string | null;
  motion: boolean;
  centralPark: boolean;
  complete?: boolean;
  onSelect?: (date: string) => void;
  selectedDate?: string | null;
}

function releaseTheme(theme: LoadedTheme) {
  const images = [
    ...Object.values(theme.sprites).flat().map((sprite) => sprite.image),
    ...theme.todayStages,
    ...Object.values(theme.park?.textures ?? {}),
    ...(theme.park?.trees ?? []),
    ...Object.values(theme.park?.landmarks ?? {}),
  ];
  for (const image of new Set(images)) image?.close();
}

/** The same city renderer as the GitHub profile view, sized for a toolbar popup. */
export function LandView({ data, themeId, motion, centralPark, complete = true, onSelect, selectedDate = null }: LandViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<IsoRenderer | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selectedDate);
  const motionRef = useRef(motion);
  const [status, setStatus] = useState<string | null>('Building your land…');
  onSelectRef.current = onSelect;
  selectedRef.current = selectedDate;
  motionRef.current = motion;

  useEffect(() => {
    let disposed = false;
    let loadedTheme: LoadedTheme | null = null;
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) {
      setStatus('Add an account to build your land.');
      return;
    }
    setStatus('Building your land…');
    void loadTheme({ themeId, centralPark }).then((theme) => {
      if (disposed) {
        releaseTheme(theme);
        return;
      }
      loadedTheme = theme;
      if (!Object.values(theme.sprites).some((sprites) => sprites.length > 0)) {
        throw new Error('The city artwork could not be loaded. Reopen the popup to try again.');
      }
      const stats = computeStats(data);
      rendererRef.current = new IsoRenderer(canvas, data, theme.config, theme.sprites, {
        motion: motionRef.current && !matchMedia('(prefers-reduced-motion: reduce)').matches,
        maxHeight: 300,
        clampTooltips: true,
        centralPark: theme.park,
        today: { date: todayKey(), stages: theme.todayStages },
        streaks: complete ? { longest: stats.longest, current: stats.current } : undefined,
        onSelect: (date) => onSelectRef.current?.(date),
      });
      rendererRef.current.setSelected(selectedRef.current);
      setStatus(null);
    }).catch((error: unknown) => {
      if (!disposed) setStatus(error instanceof Error ? error.message : 'The city artwork could not be loaded.');
    });
    return () => {
      disposed = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
      if (loadedTheme) releaseTheme(loadedTheme);
    };
  }, [data, themeId, centralPark, complete]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => rendererRef.current?.setMotion(motion && !preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, [motion]);

  useEffect(() => {
    rendererRef.current?.setSelected(selectedDate);
  }, [selectedDate]);

  return (
    <div className="land-view" aria-busy={status === 'Building your land…'}>
      <canvas ref={canvasRef} className="land-canvas" role="img" aria-label="Combined contribution land for your watched GitHub accounts" />
      {status && <p className="land-status" role="status">{status}</p>}
    </div>
  );
}