import JSZip from 'jszip';

import { EpubFactory } from './epubFactory.ts';
import { ChapterCleaner } from './chapterCleaner.ts';
import {
  ContentFile,
  Manifest,
  Metadata,
  Spine,
  TableOfContents,
} from './types.js';

export class EPub {
  private imageRoot = '/images/';
  private linkRoot = '/links/';

  constructor(
    private zip: null | JSZip,
    public version: string,
    public metadata: Metadata,
    public manifest: Manifest,
    public spine: Spine,
    public toc: TableOfContents,
    public contentPath: string,
  ) {}

  public async getChapter(id: string): Promise<string> {
    const rawChapter = await this.getRawChapter(id);
    const { manifest, contentPath, imageRoot, linkRoot } = this;

    return ChapterCleaner.execute({
      rawChapter,
      manifest,
      contentPath,
      imageRoot,
      linkRoot,
    });
  }

  public async getRawChapter(id: string): Promise<string> {
    if (!(id in this.manifest)) {
      throw new Error('Chapter not found');
    }

    if (
      !(
        this.manifest[id].mediaType == 'application/xhtml+xml' ||
        this.manifest[id].mediaType == 'image/svg+xml'
      )
    ) {
      throw new Error('Invalid mime type for chapter');
    }

    const file = this.zip?.file(this.manifest[id].href);

    if (!file) {
      throw new Error('File not found in zip');
    }

    return file.async('string');
  }

  public async getImage(id: string): Promise<ContentFile> {
    if (!(id in this.manifest)) {
      throw new Error('Image not found');
    }

    if (
      (this.manifest[id].mediaType || '').toLowerCase().trim().substr(0, 6) !=
      'image/'
    ) {
      throw new Error('Invalid mime type for image');
    }

    return this.getFile(id);
  }

  public async getFile(id: string): Promise<ContentFile> {
    if (!(id in this.manifest)) {
      throw new Error('File not found in manifest');
    }

    const file = this.zip?.file(this.manifest[id].href);

    if (!file) {
      throw new Error('File not found in zip');
    }

    const fileContent = await file.async('string');

    return {
      content: fileContent,
      mediaType: this.manifest[id].mediaType,
    };
  }

  public async hasDRM(): Promise<boolean> {
    const drmFile = 'META-INF/encryption.xml';
    return this.zip?.files[drmFile] !== undefined;
  }

  public static async load(file: File) {
    return EpubFactory.load(file);
  }
}

export default EPub;
