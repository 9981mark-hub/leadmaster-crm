import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, AlertCircle } from 'lucide-react';

interface CustomAudioPlayerProps {
    src: string;
    fileName?: string;
    onClose?: () => void;
}

const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({ src, fileName }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState(false);

    useEffect(() => {
        // Reset state when src changes
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setError(false);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.load(); // Reload audio element
        }
    }, [src]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.error("Playback failed", err);
                    setError(true);
                });
            }
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
            setError(false);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const skip = (seconds: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime += seconds;
        }
    };

    const handleError = () => {
        setError(true);
        setIsPlaying(false);
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-purple-100 p-4 w-full">
            {/* Header: Filename & Icon */}
            <div className="flex items-center gap-2 mb-3">
                <div className="bg-purple-100 p-1.5 rounded-full text-purple-600">
                    <Volume2 size={16} />
                </div>
                <span className="text-sm font-bold text-gray-700 truncate flex-1">
                    {fileName || "오디오 재생 중"}
                </span>
            </div>

            {/* Audio Element (Hidden) */}
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                onError={handleError}
            />

            {error ? (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded flex items-center justify-between">
                    <span className="flex items-center gap-1">
                        <AlertCircle size={14} /> 재생할 수 없는 파일입니다.
                    </span>
                    <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-bold"
                    >
                        직접 열기
                    </a>
                </div>
            ) : (
                <>
                    {/* Controls & Progress */}
                    <div className="space-y-3">
                        {/* Progress Bar */}
                        <div className="relative group">
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleSeek}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 hover:h-2 transition-all"
                                style={{
                                    background: `linear-gradient(to right, #9333ea ${(currentTime / (duration || 1)) * 100}%, #e5e7eb ${(currentTime / (duration || 1)) * 100}%)`
                                }}
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Control Buttons */}
                        <div className="flex justify-center items-center gap-6">
                            {/* Skip Back 10s */}
                            <button
                                onClick={() => skip(-10)}
                                className="text-gray-400 hover:text-purple-600 transition-colors p-2 hover:bg-purple-50 rounded-full"
                                title="10초 뒤로"
                            >
                                <RotateCcw size={20} />
                                <span className="sr-only">10초 뒤로</span>
                            </button>

                            {/* Play/Pause Main Button */}
                            <button
                                onClick={togglePlay}
                                className="bg-purple-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:bg-purple-700 hover:scale-105 transition-all"
                            >
                                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                            </button>

                            {/* Skip Forward 30s */}
                            <button
                                onClick={() => skip(30)}
                                className="text-gray-400 hover:text-purple-600 transition-colors p-2 hover:bg-purple-50 rounded-full"
                                title="30초 앞으로"
                            >
                                <RotateCw size={20} />
                                <span className="sr-only">30초 앞으로</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
