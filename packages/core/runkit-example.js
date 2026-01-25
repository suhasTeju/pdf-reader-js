/**
 * pdfjs-reader-core - RunKit Example
 *
 * Note: This package is primarily a React component library for rendering PDFs.
 * The full viewer requires a browser environment with React.
 *
 * This example demonstrates the headless/utility APIs that work in Node.js:
 * - Loading PDF documents
 * - Extracting text content
 * - Getting document metadata
 * - Getting document outline (table of contents)
 *
 * For the full React viewer, see the documentation:
 * https://github.com/suhasTeju/pdf-reader-js
 */

const { getDocument } = require('pdfjs-dist');

// Sample PDF URL (a simple public PDF)
const PDF_URL = 'https://raw.githubusercontent.com/niconiahi/puppeteer-pdf/main/sample.pdf';

async function extractPDFInfo() {
  console.log('Loading PDF from:', PDF_URL);
  console.log('---');

  try {
    // Load the PDF document
    const loadingTask = getDocument(PDF_URL);
    const pdf = await loadingTask.promise;

    console.log('PDF loaded successfully!');
    console.log('Number of pages:', pdf.numPages);
    console.log('---');

    // Get metadata
    const metadata = await pdf.getMetadata();
    console.log('Document Info:');
    if (metadata.info) {
      console.log('  Title:', metadata.info.Title || 'N/A');
      console.log('  Author:', metadata.info.Author || 'N/A');
      console.log('  Creator:', metadata.info.Creator || 'N/A');
      console.log('  Producer:', metadata.info.Producer || 'N/A');
    }
    console.log('---');

    // Extract text from first page
    console.log('Extracting text from page 1...');
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();

    const text = textContent.items
      .filter(item => 'str' in item)
      .map(item => item.str)
      .join(' ')
      .substring(0, 500); // First 500 chars

    console.log('Page 1 text (first 500 chars):');
    console.log(text + (text.length >= 500 ? '...' : ''));
    console.log('---');

    // Get outline (table of contents) if available
    const outline = await pdf.getOutline();
    if (outline && outline.length > 0) {
      console.log('Document Outline:');
      outline.slice(0, 5).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title}`);
      });
      if (outline.length > 5) {
        console.log(`  ... and ${outline.length - 5} more items`);
      }
    } else {
      console.log('No outline/table of contents found.');
    }

    console.log('---');
    console.log('For the full React PDF viewer component, install the package:');
    console.log('  npm install pdfjs-reader-core');
    console.log('');
    console.log('Then use in your React app:');
    console.log('  import { PDFViewerClient } from "pdfjs-reader-core";');
    console.log('  import "pdfjs-reader-core/styles.css";');

    // Clean up
    await pdf.destroy();

  } catch (error) {
    console.error('Error loading PDF:', error.message);
  }
}

extractPDFInfo();
