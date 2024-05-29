import {Options, Parser, defaults as xml2jsDefaults} from 'xml2js';
import { EventEmitter } from "events";
import JSZip from "jszip";

import { ZipFile } from "zipfile";
import PromiseFileReader from 'promise-file-reader';

interface ParseOptions {
  xml2jsOptions?: Partial<Options>;
}



class UninitializedError extends Error {}

//TODO: Cache parsed data

/**
 *  new EPub(fname[, imageroot][, linkroot])
 *  - fname (String): filename for the ebook
 *  - imageroot (String): URL prefix for images
 *  - linkroot (String): URL prefix for links
 *
 *  Creates an Event Emitter type object for parsing epub files
 *
 *      var epub = new EPub("book.epub");
 *      epub.on("end", function () {
 *           console.log(epub.spine);
 *      });
 *      epub.on("error", function (error) { ... });
 *      epub.parse();
 *
 *  Image and link URL format is:
 *
 *      imageroot + img_id + img_zip_path
 *
 *  So an image "logo.jpg" which resides in "OPT/" in the zip archive
 *  and is listed in the manifest with id "logo_img" will have the
 *  following url (providing that imageroot is "/images/"):
 *
 *      /images/logo_img/OPT/logo.jpg
 **/
class EPub extends EventEmitter {
  public flow: Array<any> = [];
  public toc: Array<any> = [];
  public version: string | undefined;
  public metadata: any;

  private imageroot: string;
  private linkroot: string;
  private containerFile: string | undefined;
  private mimeFile: string | undefined;
  private rootFile: string | undefined;
  private manifest: any;
  private guide: any;
  private spine: any;
  private zip: ZipFile | undefined;
  private jsZip: JSZip;
  private xml2jsOptions: Options;

  constructor(private file: File, imageroot?: string, linkroot?: string) {
    super();

    this.imageroot = (imageroot || "/images/").trim();
    this.linkroot = (linkroot || "/links/").trim();

    if (this.imageroot.substr(-1) != "/") {
      this.imageroot += "/";
    }
    if (this.linkroot.substr(-1) != "/") {
      this.linkroot += "/";
    }

    this.xml2jsOptions = { ... xml2jsDefaults['0.1'] };
  }

  private getZip(): ZipFile {
    if (this.zip != undefined) {
      return this.zip;
    }

    throw new UninitializedError('No file open.');
  }

  /**
   *  EPub#parse(options) -> undefined
   *  - options (object): An optional options object to override xml2jsOptions
   *  Starts the parser, needs to be called by the script
   **/
  public async parse(options: ParseOptions = {}) {
    this.xml2jsOptions = { ...this.xml2jsOptions, ...options.xml2jsOptions }

    this.metadata = {};
    this.manifest = {};
    this.guide = [];
    this.spine = {toc: false, contents: []};
    this.flow = [];
    this.toc = [];

    await this.open();
  }


  /**
   *  EPub#open() -> undefined
   *
   *  Opens the epub file with Zip unpacker, retrieves file listing
   *  and runs mime type check
   **/
  private async open(): Promise<void> {
    const uint8Array = await PromiseFileReader.readAsArrayBuffer(this.file);

    try {
      this.zip = await ZipFile.openZipFile(uint8Array, this.file.name);
    } catch (e) {
      this.emit("error", e);
      return;
    }

    if (!this.zip.names || !this.zip.names.length) {
      this.emit("error", new Error("No files in archive"));
      return;
    }

    this.checkMimeType();
  };

  /**
   *  EPub#checkMimeType() -> undefined
   *
   *  Checks if there's a file called "mimetype" and that it's contents
   *  are "application/epub+zip". On success runs root file check.
   **/
  private checkMimeType(): void {
    for (let i = 0, len = this.getZip().names.length; i < len; i++) {
      if (this.getZip().names[i].toLowerCase() == "mimetype") {
        this.mimeFile = this.getZip().names[i];
        break;
      }
    }
    if (!this.mimeFile) {
      this.emit("error", new Error("No mimetype file in archive"));
      return;
    }
    this.getZip().readFile(this.mimeFile, (data, err) => {
      if (data === null) {
        this.emit("error", new Error("Reading archive failed: " + err));
        return;
      }
      var txt = data.toString().toLowerCase().trim();

      if (txt  !=  "application/epub+zip") {
        this.emit("error", new Error("Unsupported mime type"));
        return;
      }

      this.getRootFiles();
    });
  };

  /**
   *  EPub#getRootFiles() -> undefined
   *
   *  Looks for a "meta-inf/container.xml" file and searches for a
   *  rootfile element with mime type "application/oebps-package+xml".
   *  On success calls the rootfile parser
   **/
  private getRootFiles() {
    for (let i = 0, len = this.getZip().names.length; i < len; i++) {
      if (this.getZip().names[i].toLowerCase() == "meta-inf/container.xml") {
        this.containerFile = this.getZip().names[i];
        break;
      }
    }
    if (!this.containerFile) {
      this.emit("error", new Error("No container file in archive"));
      return;
    }

    this.getZip().readFile(this.containerFile, (data, err) => {
      if (data === null) {
        this.emit("error", new Error("Reading archive failed: " + err));
        return;
      }
      const xml = data.toString().toLowerCase().trim();
      const xmlParser = new Parser(this.xml2jsOptions);

      xmlParser.on("end", (result) => {

        if (!result.rootfiles || !result.rootfiles.rootfile) {
          this.emit("error", new Error("No rootfiles found"));
          console.dir(result);
          return;
        }

        const rootfile = result.rootfiles.rootfile;
        let filename = '', i, len;

        if (Array.isArray(rootfile)) {

          for (i = 0, len = rootfile.length; i < len; i++) {
            if (rootfile[i]["@"]["media-type"] &&
              rootfile[i]["@"]["media-type"] == "application/oebps-package+xml" &&
              rootfile[i]["@"]["full-path"]) {
              filename = rootfile[i]["@"]["full-path"].toLowerCase().trim();
              break;
            }
          }

        } else if (rootfile["@"]) {
          if (rootfile["@"]["media-type"]  !=  "application/oebps-package+xml" || !rootfile["@"]["full-path"]) {
            this.emit("error", new Error("Rootfile in unknown format"));
            return;
          }
          filename = rootfile["@"]["full-path"].toLowerCase().trim();
        }

        if (!filename) {
          this.emit("error", new Error("Empty rootfile"));
          return;
        }


        for (i = 0, len = this.getZip().names.length; i < len; i++) {
          if (this.getZip().names[i].toLowerCase() == filename) {
            this.rootFile = this.getZip().names[i];
            break;
          }
        }

        this.handleRootFile();

      });

      xmlParser.on("error", (err) => {
        this.emit("error", new Error("Parsing container XML failed in getRootFiles: " + err.message));
        return;
      });

      xmlParser.parseString(xml);
    });
  };

  /**
   *  EPub#handleRootFile() -> undefined
   *
   *  Parses the rootfile XML and calls rootfile parser
   **/
  private handleRootFile() {
    if (!this.rootFile) {
      this.emit("error", new Error("Rootfile not found from archive"));
      return;
    }

    this.getZip().readFile(this.rootFile, (data, err) => {
      if (data === null) {
        this.emit("error", new Error("Reading archive failed"));
        return;
      }
      const xml = data.toString();
      const xmlparser = new Parser(this.xml2jsOptions);

      xmlparser.on("end", this.parseRootFile.bind(this));

      xmlparser.on("error", (err) => {
        this.emit("error", new Error("Parsing container XML failed in handleRootFile: " + err.message));
        return;
      });

      xmlparser.parseString(xml);

    });
  };

  /**
   *  EPub#parseRootFile() -> undefined
   *
   *  Parses elements "metadata," "manifest," "spine" and TOC.
   *  Emits "end" if no TOC
   **/
  private parseRootFile(rootfile: any) {

    this.version = rootfile['@'].version || '2.0';

    const keys = Object.keys(rootfile);
    for (let i = 0, len = keys.length; i < len; i++) {
      const keyparts = keys[i].split(":");
      const key = (keyparts.pop() || "").toLowerCase().trim();
      switch (key) {
        case "metadata":
          this.parseMetadata(rootfile[keys[i]]);
          break;
        case "manifest":
          this.parseManifest(rootfile[keys[i]]);
          break;
        case "spine":
          this.parseSpine(rootfile[keys[i]]);
          break;
        case "guide":
          this.parseGuide(rootfile[keys[i]]);
          break;
      }
    }

    if (this.spine.toc) {
      this.parseTOC();
    } else {
      this.emit("end");
    }
  };

  /**
   *  EPub#parseMetadata() -> undefined
   *
   *  Parses "metadata" block (book metadata, title, author etc.)
   **/
  private parseMetadata(metadata: any) {
    const keys = Object.keys(metadata);
    for (let i = 0, len = keys.length; i < len; i++) {
      const keyparts = keys[i].split(":");
      const key = (keyparts.pop() || "").toLowerCase().trim();
      switch (key) {
        case "publisher":
          if (Array.isArray(metadata[keys[i]])) {
            this.metadata.publisher = String(metadata[keys[i]][0] && metadata[keys[i]][0]["#"] || metadata[keys[i]][0] || "").trim();
          } else {
            this.metadata.publisher = String(metadata[keys[i]]["#"] || metadata[keys[i]] || "").trim();
          }
          break;
        case "language":
          if (Array.isArray(metadata[keys[i]])) {
            this.metadata.language = String(metadata[keys[i]][0] && metadata[keys[i]][0]["#"] || metadata[keys[i]][0] || "").toLowerCase().trim();
          } else {
            this.metadata.language = String(metadata[keys[i]]["#"] || metadata[keys[i]] || "").toLowerCase().trim();
          }
          break;
        case "title":
          if (Array.isArray(metadata[keys[i]])) {
            this.metadata.title = String(metadata[keys[i]][0] && metadata[keys[i]][0]["#"] || metadata[keys[i]][0] || "").trim();
          } else {
            this.metadata.title = String(metadata[keys[i]]["#"] || metadata[keys[i]] || "").trim();
          }
          break;
        case "subject":
          if (Array.isArray(metadata[keys[i]])) {
            this.metadata.subject = String(metadata[keys[i]][0] && metadata[keys[i]][0]["#"] || metadata[keys[i]][0] || "").trim();
          } else {
            this.metadata.subject = String(metadata[keys[i]]["#"] || metadata[keys[i]] || "").trim();
          }
          break;
        case "description":
          if (Array.isArray(metadata[keys[i]])) {
            this.metadata.description = String(metadata[keys[i]][0] && metadata[keys[i]][0]["#"] || metadata[keys[i]][0] || "").trim();
          } else {
            this.metadata.description = String(metadata[keys[i]]["#"] || metadata[keys[i]] || "").trim();
          }
          break;
        case "creator":
          if (Array.isArray(metadata[keys[i]])) {
            this.metadata.creator = String(metadata[keys[i]][0] && metadata[keys[i]][0]["#"] || metadata[keys[i]][0] || "").trim();
            this.metadata.creatorFileAs = String(metadata[keys[i]][0] && metadata[keys[i]][0]['@'] && metadata[keys[i]][0]['@']["opf:file-as"] || this.metadata.creator).trim();
          } else {
            this.metadata.creator = String(metadata[keys[i]]["#"] || metadata[keys[i]] || "").trim();
            this.metadata.creatorFileAs = String(metadata[keys[i]]['@'] && metadata[keys[i]]['@']["opf:file-as"] || this.metadata.creator).trim();
          }
          break;
        case "date":
          if (Array.isArray(metadata[keys[i]])) {
            this.metadata.date = String(metadata[keys[i]][0] && metadata[keys[i]][0]["#"] || metadata[keys[i]][0] || "").trim();
          } else {
            this.metadata.date = String(metadata[keys[i]]["#"] || metadata[keys[i]] || "").trim();
          }
          break;
        case "identifier":
          if (metadata[keys[i]]["@"] && metadata[keys[i]]["@"]["opf:scheme"] == "ISBN") {
            this.metadata.ISBN = String(metadata[keys[i]]["#"] || "").trim();
          } else if (metadata[keys[i]]["@"] && metadata[keys[i]]["@"].id && metadata[keys[i]]["@"].id.match(/uuid/i)) {
            this.metadata.UUID = String(metadata[keys[i]]["#"] || "").replace('urn:uuid:', '').toUpperCase().trim();
          } else if (Array.isArray(metadata[keys[i]])) {
            for (let j = 0; j < metadata[keys[i]].length; j++) {
              if (metadata[keys[i]][j]["@"]) {
                if (metadata[keys[i]][j]["@"]["opf:scheme"] == "ISBN") {
                  this.metadata.ISBN = String(metadata[keys[i]][j]["#"] || "").trim();
                } else if (metadata[keys[i]][j]["@"].id && metadata[keys[i]][j]["@"].id.match(/uuid/i)) {
                  this.metadata.UUID = String(metadata[keys[i]][j]["#"] || "").replace('urn:uuid:', '').toUpperCase().trim();
                }
              }
            }
          }
          break;
      }
    }

    const metas = metadata['meta'] || {};
    Object.keys(metas).forEach((key) => {
      const meta = metas[key];
      if (meta['@'] && meta['@'].name) {
        const name = meta['@'].name;
        this.metadata[name] = meta['@'].content;
      }
      if (meta['#'] && meta['@'].property) {
        this.metadata[meta['@'].property] = meta['#'];
      }

      if(meta.name && meta.name =="cover"){
        this.metadata[meta.name] = meta.content;
      }
    });
  };

  /**
   *  EPub#parseManifest() -> undefined
   *
   *  Parses "manifest" block (all items included, html files, images, styles)
   **/
  private parseManifest(manifest: any) {
    const path = this.rootFile!.split("/");
    path.pop();
    const path_str = path.join("/");

    if (manifest.item) {
      for (let i = 0, len = manifest.item.length; i < len; i++) {
        if (manifest.item[i]['@']) {
          const element = manifest.item[i]['@'];

          if (element.href && element.href.substr(0, path_str.length)  !=  path_str) {
            element.href = path.concat([element.href]).join("/");
          }

          this.manifest[manifest.item[i]['@'].id] = element;

        }
      }
    }
  };

  /**
   *  EPub#parseGuide() -> undefined
   *
   *  Parses "guide" block (locations of the fundamental structural components of the publication)
   **/
  parseGuide(guide: any) {
    const path = this.rootFile!.split("/");
    path.pop();
    const path_str = path.join("/");

    if (guide.reference) {
      if(!Array.isArray(guide.reference)){
        guide.reference = [guide.reference];
      }

      for (let i = 0, len = guide.reference.length; i < len; i++) {
        if (guide.reference[i]['@']) {

          const element = guide.reference[i]['@'];

          if (element.href && element.href.substr(0, path_str.length)  !=  path_str) {
            element.href = path.concat([element.href]).join("/");
          }

          this.guide.push(element);

        }
      }
    }
  };

  /**
   *  EPub#parseSpine() -> undefined
   *
   *  Parses "spine" block (all html elements that are shown to the reader)
   **/
  parseSpine(spine: any) {
    const path = this.rootFile!.split("/");
    path.pop();

    if (spine['@'] && spine['@'].toc) {
      this.spine.toc = this.manifest[spine['@'].toc] || false;
    }

    if (spine.itemref) {
      if(!Array.isArray(spine.itemref)){
        spine.itemref = [spine.itemref];
      }
      for (let i = 0, len = spine.itemref.length; i < len; i++) {
        if (spine.itemref[i]['@']) {
          const element = this.manifest[spine.itemref[i]['@'].idref]

          if (!!element) {
            this.spine.contents.push(element);
          }
        }
      }
    }
    this.flow = this.spine.contents;
  };

  /**
   *  EPub#parseTOC() -> undefined
   *
   *  Parses ncx file for table of contents (title, html file)
   **/
  parseTOC() {
    const path = this.spine.toc.href.split("/");
    const id_list: any = {};
    path.pop();

    const keys = Object.keys(this.manifest);
    for (let i = 0, len = keys.length; i < len; i++) {
      id_list[this.manifest[keys[i]].href] = keys[i];
    }

    this.getZip().readFile(this.spine.toc.href, (data, err) => {
      if (data === null) {
        this.emit("error", new Error("Reading archive failed: " + err));
        return;
      }
      const xml = data.toString();
      const xmlparser = new Parser(this.xml2jsOptions);

      xmlparser.on("end", (result) => {
        if (result.navMap && result.navMap.navPoint) {
          this.toc = this.walkNavMap(result.navMap.navPoint, path, id_list);
        }

        this.emit("end");
      });

      xmlparser.on("error", (err) => {
        this.emit("error", new Error("Parsing container XML failed in TOC: " + err.message));
        return;
      });

      xmlparser.parseString(xml);

    });
  };

  /**
   *  EPub#walkNavMap(branch, path, id_list,[, level]) -> Array
   *  - branch (Array | Object): NCX NavPoint object
   *  - path (Array): Base path
   *  - id_list (Object): map of file paths and id values
   *  - level (Number): deepness
   *
   *  Walks the NavMap object through all levels and finds elements
   *  for TOC
   **/
  private walkNavMap(branch: any, path: Array<string>, id_list: any, level?: number | undefined) {
    level = level || 0;

    // don't go too far
    if (level > 7) {
      return [];
    }

    let output: Array<any> = [];

    if (!Array.isArray(branch)) {
      branch = [branch];
    }

    for (var i = 0; i < branch.length; i++) {
      if (branch[i].navLabel) {

        var title = '';
        if (branch[i].navLabel && typeof branch[i].navLabel.text == 'string') {
          title = branch[i].navLabel && branch[i].navLabel.text || branch[i].navLabel===branch[i].navLabel && branch[i].navLabel.text.length > 0  ?
            (branch[i].navLabel && branch[i].navLabel.text || branch[i].navLabel || "").trim() : '';
        }
        var order = Number(branch[i]["@"] && branch[i]["@"].playOrder || 0);
        if (isNaN(order)) {
          order = 0;
        }
        var href = '';
        if (branch[i].content && branch[i].content["@"] && typeof branch[i].content["@"].src == 'string') {
          href = branch[i].content["@"].src.trim();
        }

        let element = {
          level: level,
          order: order,
          title: title,
          href: '',
          id: ''
        };

        if (href) {
          href = path.concat([href]).join("/");
          element.href = href;

          if (id_list[element.href]) {
            // link existing object
            element = this.manifest[id_list[element.href]];
            element.title = title;
            element.order = order;
            element.level = level;
          } else {
            // use new one
            element.href = href;
            element.id =  (branch[i]["@"] && branch[i]["@"].id || "").trim();
          }

          output.push(element);
        }
      }
      if (branch[i].navPoint) {
        output = output.concat(this.walkNavMap(branch[i].navPoint, path, id_list, level + 1));
      }
    }
    return output;
  };

  /**
   *  EPub#getChapter(id, callback) -> undefined
   *  - id (String): Manifest id value for a chapter
   *  - callback (Function): callback function
   *
   *  Finds a chapter text for an id. Replaces image and link URL's, removes
   *  <head> etc. elements. Return only chapters with mime type application/xhtml+xml
   **/
  public getChapter(id: string, callback: (str: string | null, err?: Error) => void) {
    this.getChapterRaw(id, (str, err) => {
      if (str == null) {
        callback(null, err);
        return;
      }

      let i, len, path = this.rootFile!.split("/"), keys = Object.keys(this.manifest);
      path.pop();

      // remove linebreaks (no multi line matches in JS regex!)
      str = str.replace(/\r?\n/g, "\u0000");

      // keep only <body> contents
      str = str.replace(/<body[^>]*?>(.*)<\/body[^>]*?>/i, function (o, d) {
        return d.trim();
      });

      // remove <script> blocks if any
      str = str.replace(/<script[^>]*?>(.*?)<\/script[^>]*?>/ig, function (o, s) {
        return "";
      });

      // remove <style> blocks if any
      str = str.replace(/<style[^>]*?>(.*?)<\/style[^>]*?>/ig, function (o, s) {
        return "";
      });

      // remove onEvent handlers
      str = str.replace(/(\s)(on\w+)(\s*=\s*["']?[^"'\s>]*?["'\s>])/g, function (o, a, b, c) {
        return a + "skip-" + b + c;
      });

      // replace images
      str = str.replace(/(\ssrc\s*=\s*["']?)([^"'\s>]*?)(["'\s>])/g, (o, a, b, c) => {
        var img = path.concat([b]).join("/").trim(),
          element;

        for (i = 0, len = keys.length; i < len; i++) {
          if (this.manifest[keys[i]].href == img) {
            element = this.manifest[keys[i]];
            break;
          }
        }

        // include only images from manifest
        if (element) {
          return a + this.imageroot + element.id + "/" + img + c;
        } else {
          return "";
        }

      });

      // replace links
      str = str.replace(/(\shref\s*=\s*["']?)([^"'\s>]*?)(["'\s>])/g, (o, a, b, c) => {
        var linkparts = b && b.split("#");
        var link = linkparts.length ? path.concat([(linkparts.shift() || "")]).join("/").trim() : '',
          element;

        for (i = 0, len = keys.length; i < len; i++) {
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
          return a + this.linkroot + element.id + "/" + link + c;
        } else {
          return a + b + c;
        }

      });

      // bring back linebreaks
      str = str.replace(/\u0000/g, "\n").trim();

      callback(str);
    });
  };


  /**
   *  EPub#getChapterRaw(id, callback) -> undefined
   *  - id (String): Manifest id value for a chapter
   *  - callback (Function): callback function
   *
   *  Returns the raw chapter text for an id.
   **/
  public getChapterRaw(id: string, callback: (str: string | null, err?: Error) => void) {
    if (this.manifest[id]) {

      if (!(this.manifest[id]['media-type'] == "application/xhtml+xml" || this.manifest[id]['media-type'] == "image/svg+xml")) {
        return callback(null, new Error("Invalid mime type for chapter"));
      }

      this.getZip().readFile(this.manifest[id].href, (data, err) => {
        if (data === null) {
          callback(null, new Error("Reading archive failed"));
          return;
        }

        let str = "";
        if (data) {
          str = data.toString();
        }


        callback(str);

      });
    } else {
      callback(null, new Error("File not found"));
    }
  };


  /**
   *  EPub#getImage(id, callback) -> undefined
   *  - id (String): Manifest id value for an image
   *  - callback (Function): callback function
   *
   *  Finds an image for an id. Returns the image as Buffer. Callback gets
   *  an error object, image buffer and image content-type.
   *  Return only images with mime type image
   **/
  public getImage(id: string, callback: (data: string | null, err: string) => void) {
    if (this.manifest[id]) {

      if ((this.manifest[id]['media-type'] || "").toLowerCase().trim().substr(0, 6)  !=  "image/") {
        return callback(null, "Invalid mime type for image");
      }

      this.getFile(id, callback);
    } else {
      callback(null, "File not found");
    }
  };


  /**
   *  EPub#getFile(id, callback) -> undefined
   *  - id (String): Manifest id value for a file
   *  - callback (Function): callback function
   *
   *  Finds a file for an id. Returns the file as Buffer. Callback gets
   *  an error object, file contents buffer and file content-type.
   **/
  public getFile(id: string, callback: (data: string | null, err: string) => void) {
    if (this.manifest[id]) {
      this.getZip().readFile(this.manifest[id].href, (data, err) => {
        if (data === null) {
          callback(null, "Reading archive failed");
          return;
        }

        callback(data.toString(), this.manifest[id]['media-type']);
      });
    } else {
      callback(null, "File not found");
    }
  };


  public readFile(filename: string, options: Function | string, callback_?: any) {
    const callback = arguments[arguments.length - 1];

    if (typeof options === 'function' || !options) {
      this.getZip().readFile(filename, callback);
    } else {
      // options is an encoding
      this.getZip().readFile(filename, (data, err) => {
        if (data === null) {
          callback(new Error('Reading archive failed'));
          return;
        }
        callback(null, data.toString());
      });
    }
  };

  /**
   *  EPub#hasDRM() -> boolean
   *
   *  Parses the tree to see if there's an ecnryption file, signifying the presence of DRM
   *  see: https://stackoverflow.com/questions/14442968/how-to-check-if-an-epub-file-is-drm-protected
   **/
  public hasDRM () {
    const drmFile = 'META-INF/encryption.xml';
    return this.getZip().names.includes(drmFile);
  };
}

// Expose to the world
export default EPub;
