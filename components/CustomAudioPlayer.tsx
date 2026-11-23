import React, { forwardRef } from 'react';
import SmartAudioPlayer, { SmartAudioPlayerRef } from './case-detail/SmartAudioPlayer';

export type CustomAudioPlayerRef = SmartAudioPlayerRef;

export interface CustomAudioPlayerProps {
  src: string;
  fileName?: string;
  file?: File | null;
  caseId?: string;
  onClose?: () => void;
}

/**
 * CustomAudioPlayer (Legacy Compatible Wrapper)
 * 구형 보라색 플레이어 및 구글 드라이브 iframe을 완전히 폐기하고,
 * 최신 School Dark 규격의 고성능 SmartAudioPlayer로 100% 매핑합니다.
 */
export const CustomAudioPlayer = forwardRef<CustomAudioPlayerRef, CustomAudioPlayerProps>(({
  src,
  fileName,
  file,
  caseId
}, ref) => {
  return (
    <SmartAudioPlayer
      ref={ref}
      src={src}
      fileName={fileName}
      file={file}
      caseId={caseId}
    />
  );
});

CustomAudioPlayer.displayName = 'CustomAudioPlayer';
export default CustomAudioPlayer;
