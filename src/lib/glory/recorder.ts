export interface RecordingState {
  isRecording: boolean;
  startTime: Date | null;
  durationMs: number;
  error: string | null;
}

export interface RecorderEvents {
  onStart?: () => void;
  onStop?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onDurationChange?: (durationMs: number) => void;
}

const MIME_TYPE = "video/webm;codecs=vp8,opus";

export class GloryRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: Date | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private stream: MediaStream | null = null;
  private events: RecorderEvents = {};

  get isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  get recordingDuration(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime.getTime();
  }

  constructor(events?: RecorderEvents) {
    this.events = events || {};
  }

  async startRecording(stream?: MediaStream): Promise<void> {
    try {
      this.chunks = [];

      if (stream) {
        this.stream = stream;
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      if (!MediaRecorder.isTypeSupported(MIME_TYPE)) {
        throw new Error(`MIME type ${MIME_TYPE} is not supported in this browser`);
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: MIME_TYPE,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: MIME_TYPE });
        this.cleanup();
        this.events.onStop?.(blob);
      };

      this.mediaRecorder.onerror = () => {
        const error = new Error("MediaRecorder encountered an error");
        this.cleanup();
        this.events.onError?.(error);
      };

      this.mediaRecorder.start(1000); // collect data every second
      this.startTime = new Date();
      this.events.onStart?.();

      // Track duration
      this.durationInterval = setInterval(() => {
        if (this.startTime) {
          this.events.onDurationChange?.(Date.now() - this.startTime.getTime());
        }
      }, 1000);
    } catch (error) {
      this.cleanup();
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    } else {
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.startTime = null;
  }

  static async uploadToGoogleDrive(blob: Blob, filename: string): Promise<void> {
    const formData = new FormData();
    formData.append("file", blob, filename);

    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await GloryRecorder.getAccessToken()}`,
          "Content-Type": blob.type,
          "Content-Length": blob.size.toString(),
        },
        body: blob,
      }
    );

    if (!response.ok) {
      throw new Error(`Google Drive upload failed: ${response.statusText}`);
    }
  }

  private static async getAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.identity?.getAuthToken(
        { interactive: true, scopes: ["https://www.googleapis.com/auth/drive.file"] },
        (token) => {
          if (chrome.runtime.lastError || !token) {
            reject(new Error("Failed to get Google Drive access token"));
          } else {
            resolve(token);
          }
        }
      );
    });
  }

  static formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
}
