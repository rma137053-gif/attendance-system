export declare function ensureUploadDir(): void;
/** Save a file buffer to local storage. Returns the storage key. */
export declare function savePhoto(buffer: Buffer, originalName: string): Promise<string>;
/** Get a file buffer from local storage by key */
export declare function getPhoto(key: string): Promise<Buffer>;
/** Delete a photo from local storage */
export declare function deletePhoto(key: string): Promise<void>;
