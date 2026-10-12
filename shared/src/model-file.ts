import type { Camera } from './model.ts';

/**
 * Exported model file ("Експортувати у файл" -> "Імпортувати з файлу" on another laptop).
 * Name + cameras only: the id is regenerated on import. Contains camera credentials.
 */
export const MODEL_FILE_FORMAT = 'ugv-cams-model';
export const MODEL_FILE_VERSION = 1;
export const MODEL_FILE_EXT = '.ugvcam.json';

export interface ModelFile {
  format: typeof MODEL_FILE_FORMAT;
  version: typeof MODEL_FILE_VERSION;
  name: string;
  cameras: Camera[];
}
