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

export interface ResourceItem {
  id: string;
  href: string;
  mediaType: string;
}

export interface Manifest {
  [key: string]: ResourceItem;
}

export interface Spine {
  toc?: ResourceItem;
  contents: ResourceItem[];
}

export interface NavElement {
  level: number;
  order: number;
  title: string;
  href: string;
  id: string;
  mediaType?: string;
}

export interface ContentFile {
  content: string;
  mediaType: string;
}

export interface ContentElement {
  title: string;
  id: string;
  href: string;
}

export type TableOfContents = ContentElement[];
