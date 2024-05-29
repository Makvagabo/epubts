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

    const contentFileContent = await this.getContentFileContent(zip);
    return EPubParser.parseContentFileToEPub(contentFileContent, zip);
  }

  private static async getContentFileContent(zip: JSZip): Promise<string> {
    const containerFileContent = await zip.file('META-INF/container.xml').async('string');
    const contentFileFilename = await EPubParser.parseRootFileForContentFilename(containerFileContent);
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
}
