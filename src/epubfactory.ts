import PromiseFileReader from 'promise-file-reader';
import JSZip from 'jszip';
import {EPub} from 'epubnew';
import EPubParser from 'epubparser';

export class Epubfactory {
  public static async load(file: File): Promise<EPub> {
    const arrayBuffer = await PromiseFileReader.readAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(arrayBuffer);

    if (!this.isSupportedMimeType(zip)) {
      throw new Error('Unsupported mime type');
    }

    const contentFileFilename = await this.getContentFileFilename(zip);
    const contentFileContent = await this.getContentFileContent(zip, contentFileFilename);
    const contentPath = this.getBasePath(contentFileFilename);
    return EPubParser.parseContentFileToEPub(contentFileContent, zip, contentPath);
  }

  private static async getContentFileFilename(zip: JSZip): Promise<string> {
    const containerFileContent = await zip.file('META-INF/container.xml').async('string');
    return await EPubParser.parseRootFileForContentFilename(containerFileContent);
  }

  private static async getContentFileContent(zip: JSZip, contentFileFilename: string): Promise<string> {
    return await zip.file(contentFileFilename).async('string');
  }

  private static async isSupportedMimeType(zip: JSZip): Promise<boolean> {
    try {
      const mimeType = await zip.file('mimetype').async('string');
      return mimeType.includes('application/epub+zip');
    } catch(e) {
      throw new Error('No mimetype file in archive');
    }
  }

  private static getBasePath(path: string): string {
    const pathParts = path.split('/');
    pathParts.pop();
    return pathParts.join('/');
  }
}
