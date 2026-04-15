'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { PDFPageProxy } from 'pdfjs-dist';
import { PDFPage } from '../PDFPage';
import type { PageBBoxData, BBoxIndex } from '../../types/bbox';
import type { NarrationStoreApi } from '../../store/narration-store';
import { usePDFViewer } from '../../hooks';
import { CameraView } from './CameraView';
import { CinemaLayer } from './CinemaLayer';

export interface TutorModeContainerProps {
  pageNumber: number;
  bboxData: PageBBoxData[];
  narrationStore: NarrationStoreApi;
  scale: number;
  rotation?: number;
  className?: string;
}

/** Build a cross-page/block index from the raw bbox list. */
export function buildBBoxIndex(bboxData: PageBBoxData[]): BBoxIndex {
  const byPage = new Map<number, PageBBoxData>();
  const blockById = new Map<
    string,
    { block: PageBBoxData['blocks'][number]; pageNumber: number }
  >();
  const crossPageFigures: BBoxIndex['crossPageFigures'] = [];

  for (const page of bboxData) {
    byPage.set(page.page_number, page);
    for (const block of page.blocks) {
      blockById.set(block.block_id, { block, pageNumber: page.page_number });
      if (
        (block.type === 'figure' ||
          block.type === 'figure_region' ||
          block.type === 'caption') &&
        typeof block.text === 'string' &&
        block.text.length > 0
      ) {
        crossPageFigures.push({
          block_id: block.block_id,
          page: page.page_number,
          type: block.type,
          text: block.text,
        });
      }
    }
  }
  return { byPage, blockById, crossPageFigures };
}

export function TutorModeContainer({
  pageNumber,
  bboxData,
  narrationStore,
  scale,
  rotation = 0,
  className,
}: TutorModeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => buildBBoxIndex(bboxData), [bboxData]);

  const { document } = usePDFViewer();
  const [pageProxy, setPageProxy] = useState<PDFPageProxy | null>(null);

  // Subscribe to store state for re-renders
  const camera = useStore(narrationStore, (s) => s.camera);
  const activeOverlays = useStore(narrationStore, (s) => s.activeOverlays);

  // Load the current PDF page proxy
  useEffect(() => {
    if (!document) {
      setPageProxy(null);
      return;
    }
    let cancelled = false;
    document
      .getPage(pageNumber)
      .then((p) => {
        if (!cancelled) setPageProxy(p);
      })
      .catch(() => {
        if (!cancelled) setPageProxy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [document, pageNumber]);

  const page = index.byPage.get(pageNumber);
  if (!page) {
    return (
      <div
        className={className}
        ref={containerRef}
        data-tutor-mode-missing-page={pageNumber}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#111',
      }}
      data-role="tutor-mode-container"
    >
      <CameraView camera={camera}>
        <div
          style={{
            position: 'relative',
            width: page.page_dimensions.width * scale,
            height: page.page_dimensions.height * scale,
            margin: '0 auto',
          }}
        >
          <PDFPage
            pageNumber={pageNumber}
            page={pageProxy}
            scale={scale}
            rotation={rotation}
            showTextLayer={false}
            showHighlightLayer={false}
            showAnnotationLayer={false}
          />
          <CinemaLayer
            page={page}
            index={index}
            overlays={activeOverlays}
            scale={scale}
          />
        </div>
      </CameraView>
    </div>
  );
}
