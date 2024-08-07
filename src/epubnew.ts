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

export interface GuideItem {
  href: string;
}

export type Guide = GuideItem[];

export interface NavElement {
  level: number;
  order: number;
  title: string;
  href: string;
  id: string;
}

export interface ContentFile {
  content: string;
  mediaType: string;
}

export type TableOfContents = NavElement[];

export class EPub {

  private imageroot = "/images/";
  private linkroot = "/links/";

  constructor(private zip: JSZip, public version: string, public metadata: Metadata, public manifest: Manifest,
              public toc: TableOfContents, public contentPath: string) {
  }

  public async getChapter(id: string): Promise<string> {
    const rawChapter = await this.getRawChapter(id);
    return this.processChapter(rawChapter);
  }

  private processChapter(rawChapter: string): string {
    // no multi line matches in JS regex!
    rawChapter = this.removeLinebreaks(rawChapter);
    rawChapter = this.keepOnlyBodyContents(rawChapter);
    rawChapter = this.removeScriptBlocks(rawChapter);
    rawChapter = this.removeStyleBlocks(rawChapter);
    rawChapter = this.removeOnEventHandlers(rawChapter);
    rawChapter = this.removeImages(rawChapter);
    rawChapter = this.replaceLinks(rawChapter);
    rawChapter = this.bringBackLinebreaks(rawChapter);

    return rawChapter;
  }

  private bringBackLinebreaks(rawChapter: string) {
    return rawChapter.replace(/\u0000/g, "\n").trim(); // eslint-disable-line no-control-regex
  }

  private removeImages(rawChapter: string) {
    const keys = Object.keys(this.manifest);
    return rawChapter.replace(/(\ssrc\s*=\s*["']?)([^"'\s>]*?)(["'\s>])/g, (_match, offset, str, groups) => {
      const img = [this.contentPath, str].join("/").trim();
      let element;

      for (let i = 0, len = keys.length; i < len; i++) {
        if (this.manifest[keys[i]].href == img) {
          element = this.manifest[keys[i]];
          break;
        }
      }

      // include only images from manifest
      if (element) {
        return offset + this.imageroot + element.id + "/" + img + groups;
      } else {
        return "";
      }

    });
  }

  private replaceLinks(rawChapter: string) {
    const keys = Object.keys(this.manifest);
    return rawChapter.replace(/(\shref\s*=\s*["']?)([^"'\s>]*?)(["'\s>])/g, (_match, offset, str, groups) => {
      const linkparts = str && str.split("#");
      let link = linkparts.length ? [this.contentPath, linkparts.shift() || ""].join("/").trim() : '';
      let element;

      for (let i = 0, len = keys.length; i < len; i++) {
        if (this.manifest[keys[i]].href.split("#")[0] == link) {
          element = this.manifest[keys[i]];
          break;
        }
      }

      if (linkparts.length) {
        link  +=  "#" + linkparts.join("#");
      }

      // include only images from manifest
      if (element) {
        return offset + this.linkroot + element.id + "/" + link + groups;
      } else {
        return offset + str + groups;
      }
    });
  }

  private removeOnEventHandlers(rawChapter: string) {
    return rawChapter.replace(/(\s)(on\w+)(\s*=\s*["']?[^"'\s>]*?["'\s>])/g, function (_match, a, b, c) {
      return a + "skip-" + b + c;
    });
  }

  private removeStyleBlocks(rawChapter: string) {
    return rawChapter.replace(/<style[^>]*?>(.*?)<\/style[^>]*?>/ig, function (_o, _s) {
      return "";
    });
  }

  private removeScriptBlocks(rawChapter: string) {
    return rawChapter.replace(/<script[^>]*?>(.*?)<\/script[^>]*?>/ig, function (_o, _s) {
      return "";
    });
  }

  private keepOnlyBodyContents(rawChapter: string) {
    return rawChapter.replace(/<body[^>]*?>(.*)<\/body[^>]*?>/i, function (_o, d) {
      return d.trim();
    });
  }

  private removeLinebreaks(rawChapter: string) {
    return rawChapter.replace(/\r?\n/g, "\u0000");
  }

  public async getRawChapter(id: string): Promise<string> {
    if (!(id in this.manifest)) {
      throw new Error('Chapter not found');
    }

    if (!(this.manifest[id]['media-type'] == "application/xhtml+xml" || this.manifest[id]['media-type'] == "image/svg+xml")) {
      throw new Error('Invalid mime type for chapter');
    }

    return this.zip.file(this.manifest[id].href).async('string');
  }

  public async getImage(id: string): Promise<ContentFile> {
    if (!(id in this.manifest)) {
      throw new Error('Image not found');
    }

    if ((this.manifest[id]['media-type'] || "").toLowerCase().trim().substr(0, 6)  !=  "image/") {
      throw new Error("Invalid mime type for image");
    }

    return this.getFile(id);
  }

  public async getFile(id: string): Promise<ContentFile> {
    if (!(id in this.manifest)) {
      throw new Error('File not found');
    }

    const fileContent = await this.zip.file(this.manifest[id].href).async('string');

    return {
      content: fileContent,
      mediaType: this.manifest[id]['media-type']
    }
  }

  public async hasDRM(): Promise<boolean> {
    const drmFile = 'META-INF/encryption.xml';
    return this.zip.files[drmFile] !== undefined;
  }

  public static async load(file: File) {
    return Epubfactory.load(file);
  }



  private static

}
