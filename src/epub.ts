import JSZip from 'jszip';
import { Epubfactory } from './epubfactory.js';
import ChapterCleaner from './chaptercleaner.js';
import {
  ContentFile,
  Manifest,
  Metadata,
  Spine,
  TableOfContents,
} from './types.js';

export class EPub {
  private imageroot = '/images/';
  private linkroot = '/links/';

  constructor(
    private zip: JSZip,
    public version: string,
    public metadata: Metadata,
    public manifest: Manifest,
    public spine: Spine,
    public toc: TableOfContents,
    public contentPath: string,
  ) {}

  public async getChapter(id: string): Promise<string> {
    const rawChapter = await this.getRawChapter(id);
    return ChapterCleaner.cleanChapter(
      rawChapter,
      this.manifest,
      this.contentPath,
      this.imageroot,
      this.linkroot,
    );
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

    return this.zip.file(this.manifest[id].href).async('string');
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
      throw new Error('File not found');
    }

    const fileContent = await this.zip
      .file(this.manifest[id].href)
      .async('string');

    return {
      content: fileContent,
      mediaType: this.manifest[id].mediaType,
    };
  }

  public async hasDRM(): Promise<boolean> {
    const drmFile = 'META-INF/encryption.xml';
    return this.zip.files[drmFile] !== undefined;
  }

  public static async load(file: File) {
    return Epubfactory.load(file);
  }
}

export default EPub;
