import {EPub, Manifest, ManifestItem, Metadata, NavElement, Spine, TableOfContents} from 'epub';
import {defaults as xml2jsDefaults, Parser} from 'xml2js';
import JSZip from 'jszip';

class EPubParser {
  private parser: Parser;

  public constructor() {
    this.parser = new Parser(xml2jsDefaults['0.1']);
  }
  public async parseContentFileToEPub(contentFileContent:string, zip: JSZip, contentPath: string): Promise<EPub> {
    const xml = await this.parser.parseStringPromise(contentFileContent);

    const version = xml['@'].version || '2.0';
    let metadata: Metadata = {};
    let manifest: Manifest = {};
    let spine: Spine = { contents: [] };
    let _flow: ManifestItem[] = [];
    // const guide: Guide = [];
    let toc: TableOfContents = [];


    const tags = this.getTagNames(xml);
    for (const tag of tags) {
      switch (tag) {
        case 'metadata':
          metadata = this.parseMetadataNode(xml[tag]);
          break;
        case 'manifest':
          manifest = this.parseManifestNode(xml[tag], contentPath);
          break;
        case 'spine':
          spine = this.parseSpineNode(xml[tag], manifest);
          _flow = spine.contents;
          break;
      }
    }

    if (spine.toc && spine.toc.href && zip) {
      const tocXml = await this.loadTocXml(zip, spine.toc.href);
      toc = await this.parseTOC(manifest, tocXml, contentPath);
    }

    return new EPub(zip, version, metadata, manifest, toc, contentPath, spine);
  }

  public async parseTOC(manifest: Manifest, tocXml: any, contentPath: string): Promise<TableOfContents> {
    const hrefsToManifestIds = this.getHrefToManifestIdMap(manifest);
    return this.walkNavMap(tocXml.navMap.navPoint, [contentPath], hrefsToManifestIds, 0, manifest);
  }

  private async loadTocXml(zip: JSZip, filePath: string): Promise<any> {
    const tocFileContent = await zip.file(filePath).async('string');
    if (tocFileContent === null) {
      throw new Error('Table of contents file not found in archive: ' + filePath);
    }
    return await this.parser.parseStringPromise(tocFileContent);
  }

  private walkNavMap(
    branch: any, path: Array<string>, hrefToManifestIdMap: {[key: string]: string}, level: number, manifest: Manifest
  ) {
    // don't go too far
    if (level > 7) {
      return [];
    }

    let output: TableOfContents = [];

    if (!Array.isArray(branch)) {
      branch = [branch];
    }

    for (const navPoint of branch) {
      if (navPoint.navLabel) {
        const element = this.getNavElementFromNode(navPoint, level, path, hrefToManifestIdMap, manifest);

        if (element.href) {
          output.push(element);
        }
      }

      if (navPoint.navPoint) {
        output = output.concat(this.walkNavMap(navPoint.navPoint, path, hrefToManifestIdMap, level + 1, manifest));
      }
    }
    return output;
  };

  private getNavElementFromNode(
    navPoint: any, level: number, path: Array<string>, hrefToManifestIdMap: {[key: string]: string}, manifest: Manifest
  ) {
    const title = navPoint.navLabel && typeof navPoint.navLabel.text == 'string' ? navPoint.navLabel.text.trim() : ''
    const order = Number(navPoint["@"] && navPoint["@"].playOrder || 0);
    const href = navPoint.content && navPoint.content["@"] && typeof navPoint.content["@"].src == 'string' ? navPoint.content["@"].src.trim() : '';

    let element: NavElement = {
      level,
      order,
      title,
      href: '',
      id: ''
    };

    if (href) {
      element.href = path.concat([href]).join("/");
      const manifestId = hrefToManifestIdMap[element.href];

      if (manifestId) {
        // link existing object
        element = { ...element, ...manifest[manifestId] };
        element.id = manifestId;
      } else {
        // use new one
        element.href = href;
        element.id = (navPoint["@"] && navPoint["@"].id || "").trim();
      }
    }
    return element;
  }

  private getHrefToManifestIdMap(manifest: Manifest): {[key: string]: string} {
    const manifestIds = Object.keys(manifest);
    const hrefsToManifestIds = {};
    for (const manifestId of manifestIds) {
      hrefsToManifestIds[manifest[manifestId].href] = manifestId;
    }
    return hrefsToManifestIds;
  }

  public parseManifestNode(manifestNode: any, contentPath: string): Manifest {
    const manifest: Manifest = {};

    if (Array.isArray(manifestNode.item)) {
     for(const itemNode of manifestNode.item) {
        const attributes = itemNode['@'];

        const manifestItem: ManifestItem = {
          id: attributes.id
        };

        if (attributes.href) {
          if (!attributes.href.startsWith(contentPath)) {
            manifestItem.href = [contentPath, attributes.href].join("/");
          } else {
            manifestItem.href = attributes.href;
          }
        }

        if (attributes['media-type']) {
          manifestItem.mediaType = attributes['media-type'];
        }

        manifest[attributes.id] = manifestItem;
      }
    }

    return manifest;
  }

  public parseSpineNode(spineNode: any, manifest: Manifest) {
    const spine: Spine = { contents: [] };

    if (spineNode['@'] && spineNode['@'].toc) {
      spine.toc = manifest[spineNode['@'].toc] || undefined;
    }

    if (spineNode.itemref) {
      if(!Array.isArray(spineNode.itemref)){
        spineNode.itemref = [spineNode.itemref];
      }

      for (const itemref of spineNode.itemref) {
        if (itemref['@']) {
          const element = manifest[itemref['@'].idref]

          if (element) {
            spine.contents.push(element);
          }
        }
      }
    }

    return spine;
  }

  public parseMetadataNode(metadataNode: any): Metadata {
    const metadata: any = {};

    const tags = this.getTagNames(metadataNode);
    for (const tag of tags) {
      switch (this.getCleanTagName(tag)) {
        case 'publisher':
          metadata.publisher = this.getFirstStringValueFromNode(metadataNode[tag]);
          break;
        case 'language':
          metadata.language = this.getFirstStringValueFromNode(metadataNode[tag]);
          break;
        case 'title':
          metadata.title = this.getFirstStringValueFromNode(metadataNode[tag]);
          break;
        case 'subject':
          metadata.subject = this.getFirstStringValueFromNode(metadataNode[tag]);
          break;
        case 'description':
          metadata.description = this.getFirstStringValueFromNode(metadataNode[tag]);
          break;
        case 'creator':
          this.parseAndSetCreatorNodeData(metadataNode[tag], metadata);
          break;
        case 'date':
          metadata.date = this.getFirstStringValueFromNode(metadataNode[tag]);
          break;
        case 'identifier':
          this.parseAndSetIdentifierNodeData(metadataNode[tag], metadata);
          break;
      }
    }

    this.parseMetaNode(metadataNode, metadata);

    return metadata;
  };

  public parseMetaNode(metadataNode: any, metadata: Metadata) {
    const metas = metadataNode['meta'] || {};
    Object.keys(metas).forEach((key) => {
      const meta = metas[key];
      if (meta['@'] && meta['@'].name) {
        const name = meta['@'].name;
        metadata[name] = meta['@'].content;
      }
      if (meta['#'] && meta['@'].property) {
        metadata[meta['@'].property] = meta['#'];
      }

      if (meta.name && meta.name == 'cover') {
        metadata[meta.name] = meta.content;
      }
    });
  }

  public parseAndSetIdentifierNodeData(idNode: any, metadata: Metadata) {
    if (this.parseAndSetISBNIfPresent(idNode, metadata) || this.parseAndSetUUIDIfPresent(idNode, metadata)) {
      return;
    } else if (Array.isArray(idNode)) {
      for (const node of idNode) {
        this.parseAndSetISBNIfPresent(node, metadata);
        this.parseAndSetUUIDIfPresent(node, metadata);
      }
    }
  }

  private parseAndSetISBNIfPresent(idNode: any, metadata: Metadata):boolean {
    if (idNode['@'] && idNode['@']['opf:scheme'] == 'ISBN') {
      metadata.ISBN = String(idNode['#'] || '').trim();
      return true;
    }
    return false;
  }

  private parseAndSetUUIDIfPresent(idNode: any, metadata: Metadata):boolean {
    if (idNode['@'] && idNode['@'].id && idNode['@'].id.match(/uuid/i)) {
      metadata.UUID = String(idNode['#'] || '').replace('urn:uuid:', '').toUpperCase().trim();
      return true;
    }
    return false;
  }

  public parseAndSetCreatorNodeData(creatorNode: any, metadata: Metadata) {
    if (Array.isArray(creatorNode)) {
      metadata.creator = String(creatorNode[0] && creatorNode[0]['#'] || creatorNode[0] || '').trim();
      metadata.creatorFileAs = String(creatorNode[0] && creatorNode[0]['@'] && creatorNode[0]['@']['opf:file-as'] || metadata.creator).trim();
    } else {
      metadata.creator = String(creatorNode['#'] || creatorNode || '').trim();
      metadata.creatorFileAs = String(creatorNode['@'] && creatorNode['@']['opf:file-as'] || metadata.creator).trim();
    }
  }

  public async parseRootFileForContentFilename(containerFileContent: string): Promise<string> {
    const xml = await this.parser.parseStringPromise(containerFileContent);
    return this.findContentFilename(xml);
  }

  private findContentFilename(xml: any): string {
    if (!xml.rootfiles || !xml.rootfiles.rootfile) {
      throw new Error('No rootfiles found');
    }

    const rootfile = xml.rootfiles.rootfile;
    let contentFilename = '';

    if (Array.isArray(rootfile)) {
      for (let i = 0; i < rootfile.length; i++) {
        if (this.isContentFilenameNode(rootfile[i])) {
          contentFilename = rootfile[i]['@']['full-path'].trim();
          break;
        }
      }

    } else if (rootfile['@']) {
      if (!this.isContentFilenameNode(rootfile)) {
        throw new Error('Rootfile in unknown format');
      }
      contentFilename = rootfile['@']['full-path'].trim();
    }

    if (!contentFilename) {
      throw new Error('Empty rootfile');
    }

    return contentFilename;
  }

  private isContentFilenameNode(node: any): boolean {
    return node['@']['media-type'] &&
      node['@']['media-type'] == 'application/oebps-package+xml' &&
      node['@']['full-path'];
  }

  public getTagNames(node: any): string[] {
    return Object.keys(node).map((key) => key.toLowerCase().trim());
  }

  public getCleanTagName(tag: string): string {
    return tag.split(':').pop() || '';
  }

  public getFirstStringValueFromNode(node: any) {
    if (Array.isArray(node)) {
      return String(node[0] && node[0]['#'] || node[0] || '').trim();
    }
    return String(node['#'] || node || '').trim();
  }
}

export default new EPubParser();