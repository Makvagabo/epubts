import JSZip from 'jszip';
import {Epubfactory} from 'epubfactory';

export interface Metadata {
  publisher?: string;
  language?: string;
  title?: string;
  subject?: string[];
  description?: string;
  creator?: string;
  date?: string;
  identifier?: string;
  ISBN?: string;
  UUID?: string;
  creatorFileAs?: string;
}

export interface ManifestItem {
  href?: string;
  mediaType?: string;
}

export interface Manifest {
  [key: string]: ManifestItem;
}

export interface Spine {
  toc?: ManifestItem;
  contents: ManifestItem[];
}

export class EPub {

  constructor(private zip: JSZip, public version: string, public metadata: Metadata) {
  }

  // public async getChapter(id: string): Promise<string> {}
  // public async getChapterRaw(id: string): Promise<string> {}
  // public async getImage(id: string): Promise<string> {}
  // public async getFile(id: string): Promise<string> {}
  // public async hasDRM(): Promise<boolean> {}

  public static async load(file: File) {
    return Epubfactory.load(file);
  }



  private static

}
