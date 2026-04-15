export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'list_item'
  | 'figure'
  | 'figure_region'
  | 'caption'
  | 'table'
  | 'mcq_option';

export type DefaultAction = 'zoom_pan' | 'spotlight' | 'underline' | 'pulse';

/** Four numbers: [x1, y1, x2, y2] in PDF coordinates (origin top-left). */
export type BBoxCoords = readonly [number, number, number, number];

export interface Block {
  block_id: string;
  bbox: BBoxCoords;
  text: string | null;
  type: BlockType;
  parent_id: string | null;
  confidence: number;
  reading_order: number;
  default_action: DefaultAction;
  semantic_unit_id: string;
}

export interface PageDimensionsDpi {
  width: number;
  height: number;
  dpi: number;
}

export interface PageBBoxData {
  id: string;
  page_number: number;
  page_text: string;
  page_dimensions: PageDimensionsDpi;
  blocks: Block[];
  created_at: string;
}

/** Lookup indexes used by the director + engine. */
export interface BBoxIndex {
  byPage: Map<number, PageBBoxData>;
  blockById: Map<string, { block: Block; pageNumber: number }>;
  crossPageFigures: Array<{
    block_id: string;
    page: number;
    type: 'figure' | 'figure_region' | 'caption';
    text: string;
  }>;
}
