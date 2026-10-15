import type { CameraType, CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useRef, useState } from 'react';

import { resolveMediaUrl, suggestPoseBatch, type PoseMatch, type Scene } from '@/api/client';

/** The frame sent to the AI only needs CLIP's input size; smaller means a faster upload. */
const FRAME_WIDTH = 512;

export type Notice = { tone: 'info' | 'error'; text: string };

type SuggestionState = {
  sceneId: number | null | undefined;
  gender: string | null | undefined;
  seenIds: number[];
};

const EMPTY_STATE: SuggestionState = { sceneId: undefined, gender: undefined, seenIds: [] };

/** Grabs a throwaway frame for analysis; it is never saved or shown. */
async function captureFrame(camera: CameraView): Promise<string> {
  const frame = await camera.takePictureAsync({ quality: 0.5, shutterSound: false });
  if (!frame?.uri) throw new Error('Không đọc được ảnh từ camera. Thử lại nhé.');
  const image = await ImageManipulator.manipulate(frame.uri).resize({ width: FRAME_WIDTH }).renderAsync();
  const { base64 } = await image.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG });
  if (!base64) throw new Error('Không đọc được ảnh từ camera. Thử lại nhé.');
  return base64;
}

/**
 * AI pose suggestions, three at a time. Repeated calls in the same scene (and for the same
 * detected gender) page forward and put the new poses first; a change in either starts over.
 */
export function usePoseSuggestions(onNotice: (notice: Notice | null) => void) {
  const [poses, setPoses] = useState<PoseMatch[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const stateRef = useRef<SuggestionState>(EMPTY_STATE);

  const suggest = useCallback(
    async (camera: CameraView, facing: CameraType) => {
      if (suggesting) return;
      setSuggesting(true);
      onNotice(null);
      try {
        const frame = await captureFrame(camera);
        const batch = await suggestPoseBatch(frame, stateRef.current.seenIds, facing);
        if (batch.matches.length === 0) {
          onNotice({ tone: 'error', text: 'Chưa tìm được pose phù hợp. Thử ở nơi sáng hơn nhé.' });
          return;
        }

        // Start downloading the outlines now so switching between poses is instant.
        void Image.prefetch(batch.matches.map((pose) => resolveMediaUrl(pose.skeleton_url)));

        const sceneId = batch.scene?.id ?? null;
        const detectedGender = batch.detected_gender ?? null;
        const shownIds = batch.matches.map((pose) => pose.id);
        const previous = stateRef.current;
        const sameGroup = previous.sceneId === sceneId && previous.gender === detectedGender;
        stateRef.current = {
          sceneId,
          gender: detectedGender,
          seenIds: sameGroup && !batch.reset ? [...previous.seenIds, ...shownIds] : shownIds,
        };
        // After a reset a pose may already be listed; it moves to the front instead of repeating.
        setPoses((current) =>
          sameGroup ? [...batch.matches, ...current.filter((pose) => !shownIds.includes(pose.id))] : batch.matches,
        );
        setSelectedId(batch.matches[0].id);
        setScene(batch.scene);
        setGender(detectedGender);
        if (batch.reset) onNotice({ tone: 'info', text: 'Đã xem hết pose của cảnh này, quay lại từ đầu.' });
      } catch (error) {
        onNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Chưa thể gợi ý pose.' });
      } finally {
        setSuggesting(false);
      }
    },
    [suggesting, onNotice],
  );

  const clear = useCallback(() => {
    stateRef.current = EMPTY_STATE;
    setPoses([]);
    setSelectedId(null);
    setScene(null);
    setGender(null);
    onNotice(null);
  }, [onNotice]);

  const selectedPose = poses.find((pose) => pose.id === selectedId) ?? poses[0] ?? null;

  return { poses, selectedPose, select: setSelectedId, scene, gender, suggesting, suggest, clear };
}
