
"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export interface Track {
    id: string;
    title: string;
    url: string;
    artist?: string;
    thumbnailUrl?: string;
}

type RepeatMode = 'off' | 'one' | 'all';

interface AudioPlayerContextType {
  currentTrack: Track | null;
  playlist: Track[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  currentTime: number;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  volume: number;
  isMuted: boolean;
  playTrack: (track: Track, playlist?: Track[]) => void;
  togglePlayPause: () => void;
  seek: (percentage: number) => void;
  closePlayer: () => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType>({
  currentTrack: null,
  playlist: [],
  isPlaying: false,
  progress: 0,
  duration: 0,
  currentTime: 0,
  repeatMode: 'off',
  isShuffled: false,
  hasNext: false,
  hasPrevious: false,
  volume: 1,
  isMuted: false,
  playTrack: () => {},
  togglePlayPause: () => {},
  seek: () => {},
  closePlayer: () => {},
  playNext: () => {},
  playPrevious: () => {},
  toggleRepeat: () => {},
  toggleShuffle: () => {},
  setVolume: () => {},
  toggleMute: () => {},
});

export const AudioPlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [shuffledPlaylist, setShuffledPlaylist] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffled, setIsShuffled] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackIndexRef = useRef<number>(-1);

  const activePlaylist = isShuffled ? shuffledPlaylist : playlist;

  const playNext = useCallback(() => {
    if (!currentTrack) return;
    const currentIndex = activePlaylist.findIndex(t => t.id === currentTrack.id);
    if (currentIndex > -1 && currentIndex < activePlaylist.length - 1) {
        const nextTrack = activePlaylist[currentIndex + 1];
        playTrack(nextTrack, playlist);
    } else if (repeatMode === 'all' && activePlaylist.length > 0) {
        playTrack(activePlaylist[0], playlist);
    }
  }, [currentTrack, activePlaylist, playlist, repeatMode]);

  const playPrevious = useCallback(() => {
    if (!currentTrack) return;
    const currentIndex = activePlaylist.findIndex(t => t.id === currentTrack.id);
    if (currentIndex > 0) {
        const prevTrack = activePlaylist[currentIndex - 1];
        playTrack(prevTrack, playlist);
    }
  }, [currentTrack, activePlaylist, playlist]);

  const playTrack = useCallback((track: Track, newPlaylist?: Track[]) => {
    if (newPlaylist) {
        setPlaylist(newPlaylist);
        if (isShuffled) {
             const shuffled = [...newPlaylist].sort(() => Math.random() - 0.5);
             setShuffledPlaylist(shuffled);
        }
    }
    
    if (audioRef.current && audioRef.current.src === track.url) {
        audioRef.current.play();
        setIsPlaying(true);
    } else {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        const newAudio = new Audio(track.url);
        newAudio.play();
        audioRef.current = newAudio;
        setIsPlaying(true);
    }
    setCurrentTrack(track);
  }, [isShuffled]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(prev => !prev);
  }, [isPlaying]);

  const seek = useCallback((percentage: number) => {
      if (!audioRef.current) return;
      const newTime = (percentage / 100) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
  }, []);

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
    }
    setCurrentTrack(null);
    setIsPlaying(false);
  }, []);

   const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffled(prev => {
        const newState = !prev;
        if (newState) {
            const shuffled = [...playlist].sort(() => Math.random() - 0.5);
            setShuffledPlaylist(shuffled);
        }
        return newState;
    });
  }, [playlist]);

    const setVolume = useCallback((newVolume: number) => {
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
            setVolumeState(newVolume);
            if (newVolume > 0) {
                setIsMuted(false);
            }
        }
    }, []);

    const toggleMute = useCallback(() => {
        if (audioRef.current) {
            const newMuted = !isMuted;
            audioRef.current.muted = newMuted;
            setIsMuted(newMuted);
        }
    }, [isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
        if (repeatMode === 'one') {
            audio.currentTime = 0;
            audio.play();
        } else {
            playNext();
        }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentTrack, repeatMode, playNext]);

  const currentIndex = currentTrack ? activePlaylist.findIndex(t => t.id === currentTrack.id) : -1;
  const hasNext = repeatMode === 'all' ? activePlaylist.length > 0 : currentIndex > -1 && currentIndex < activePlaylist.length - 1;
  const hasPrevious = currentIndex > 0;

  const value = {
    currentTrack,
    playlist,
    isPlaying,
    progress,
    duration,
    currentTime,
    repeatMode,
    isShuffled,
    hasNext,
    hasPrevious,
    volume,
    isMuted,
    playTrack,
    togglePlayPause,
    seek,
    closePlayer,
    playNext,
    playPrevious,
    toggleRepeat,
    toggleShuffle,
    setVolume,
    toggleMute,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  return useContext(AudioPlayerContext);
};
