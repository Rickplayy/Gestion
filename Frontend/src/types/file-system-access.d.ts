// Tipado mínimo de la File System Access API (no incluida en lib.dom.d.ts
// todavía). Solo cubre lo que usa src/utils/groupGenerator.ts.
export {};

declare global {
  interface FileSystemWritableFileStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }

  interface FileSystemFileHandle {
    readonly name: string;
    createWritable(): Promise<FileSystemWritableFileStream>;
    getFile(): Promise<File>;
    remove?(): Promise<void>;
  }

  type FilePickerAcceptType = {
    description?: string;
    accept: Record<string, string[]>;
  };

  type SaveFilePickerOptions = {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
  };

  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}
