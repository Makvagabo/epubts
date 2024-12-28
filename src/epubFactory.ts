import PromiseFileReader from 'promise-file-reader';
import JSZip from 'jszip';

import { EPub } from './epub.js';
import EPubParser from './epubParser.ts';

export class EpubFactory {
  public static async load(file: File): Promise<EPub> {
    const arrayBuffer = await PromiseFileReader.readAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(arrayBuffer);

    if (!(await this.isSupportedMimeType(zip))) {
      throw new Error('Unsupported mime type');
    }

    const contentFileFilename = await this.getContentFileFilename(zip);
    const contentFileContent = await this.getContentFileContent(
      zip,
      contentFileFilename,
    );
    const contentPath = this.getBasePath(contentFileFilename);

    return EPubParser.parseContentFileToEPub(
      contentFileContent,
      zip,
      contentPath,
    );
  }

  private static async getContentFileFilename(zip: JSZip): Promise<string> {
    const containerFile = zip.file('META-INF/container.xml');

    if (!containerFile) {
      throw new Error('File not found in zip');
    }

    const containerFileContent = await containerFile.async('string');

    return await EPubParser.parseRootFileForContentFilename(
      containerFileContent,
    );
  }

  private static async getContentFileContent(
    zip: JSZip,
    contentFileFilename: string,
  ): Promise<string> {
    const contentFile = zip.file(contentFileFilename);

    if (!contentFile) {
      throw new Error(`File ${contentFileFilename} not found in zip`);
    }
    return await contentFile.async('string');
  }

  private static async isSupportedMimeType(zip: JSZip): Promise<boolean> {
    const mimeTypeFile = zip.file('mimetype');

    if (!mimeTypeFile) {
      throw new Error('No mimetype file in archive');
    }

    const mimeType = await mimeTypeFile.async('string');

    return mimeType.includes('application/epub+zip');
  }

  private static getBasePath(path: string): string {
    const pathParts = path.split('/');
    pathParts.pop();
    return pathParts.join('/');
  }
}
