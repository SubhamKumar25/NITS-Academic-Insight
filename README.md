# NITS Academic Insight

NITS Academic Insight is a student-focused academic utility for calculating and analyzing NIT Silchar M.Tech academic performance.


## Features
- **Manual Grade Mode**: Enter grade directly to calculate.
- **Marks Mode**: Enter raw marks; the application automatically normalizes, rounds, and derives grades using the official Theory vs. Other than Theory grading scales.
- **PDF & Image Result Analyzer**: Drag & drop or browse a PDF/Image results document (M.Tech marksheet, grade card, semester result sheet) to extract course codes, credits, marks, and grades using built-in PDF text extraction and OCR (Tesseract.js).
- **Attempt History Tracking**: Supports multiple attempts for the same course (Original, Supplementary, Re-examination, Improvement). Tracks backlog resolutions (Previously Back → Cleared) and improved grades without double-counting credits in CGPA.
- **Visual Timelines & Audits**: View expandable attempt histories with timeline details and audit trail explanations for repeated courses.
- **Link/Unlink Overlays**: Manually link or unlink repeated course attempts to fix Ambiguous OCR extractions or manual duplications.
- **Academic Performance Dashboard**: Renders dynamic overall statistics (SGPA, Overall CGPA, Percentage, Credits, Active Backlogs), semester performance matrices, best/lowest highlights, dynamic subject filters, grade distribution charts, credit audits, and attempts trackers.
- **SVG SGPA Trend Graph**: Dynamically plots a lightweight, responsive SVG line chart representing semester-by-semester SGPA changes.
- **Factual Performance Insights**: Auto-generates exact, factual observations based on active statistics.
- **Downloadable Printable Reports**: Features a print-friendly layout triggered via `window.print()` that automatically hides navigation headers, upload dropzones, and forms, presenting a clean academic report sheet.
- **Security & Privacy**: Uploaded documents are processed locally/temporarily on the Node server and are deleted immediately after parsing.

## Installation & Setup

1. **Install Node.js**: Ensure you have Node.js LTS installed.
2. **Install Dependencies**: Open your project terminal and run:
   ```bash
   npm install
   ```
3. **Start the Application**: Run the following command:
   ```bash
   npm start
   ```
4. **Access the App**: Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Folder Structure
- `index.html`, `style.css`, `script.js` - Core frontend UI.
- `server.js` - Express backend with document analysis API.
- `package.json` - Node dependencies configuration.
- `.gitignore` - Prevents temporary uploads and `node_modules` from entering version control.
