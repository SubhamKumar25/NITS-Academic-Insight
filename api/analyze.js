/**
 * NITS Academic Insight — Vercel Serverless Function
 * Endpoint: POST /api/analyze
 * Accepts a PDF or image upload, extracts text via PDF.js and Tesseract.js OCR,
 * and returns structured academic data.
 *
 * On Vercel, the /tmp directory is used for temporary file storage since the
 * filesystem root is read-only. Files are cleaned up after each request.
 */
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const Tesseract = require('tesseract.js');

// Optional: canvas for scanned PDF OCR rendering
let Canvas = null;
try {
    Canvas = require('canvas');
} catch (_) {
    // canvas is optional — scanned PDFs won't render, but digital PDFs and images still work
}

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Use /tmp on Vercel (read-only root), or local uploads/ for dev
const uploadDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'uploads');

const upload = multer({
    dest: uploadDir + '/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// Multer promise wrapper for Vercel (req/res pattern)
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) reject(result);
            else resolve(result);
        });
    });
}

// ── Text extraction ────────────────────────────────────────────────────────────

async function extractTextFromPdf(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true });
    const pdfDocument = await loadingTask.promise;

    let fullText = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n--- PAGE ${i} ---\n` + pageText;
    }

    if (fullText.trim().length < 50) {
        if (Canvas) {
            return await ocrScannedPdf(pdfDocument);
        }
        throw new Error("Empty PDF text layer. OCR engine cannot render PDF pages without 'canvas' package.");
    }
    return fullText;
}

async function ocrScannedPdf(pdfDocument) {
    let ocrText = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = Canvas.createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        const buffer = canvas.toBuffer('image/png');
        const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
        ocrText += `\n--- PAGE ${i} (OCR) ---\n` + text;
    }
    return ocrText;
}

async function extractTextFromImage(filePath) {
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
    return text;
}

// ── Text normalisation ─────────────────────────────────────────────────────────

function normalizeText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
}

// ── Academic parser ────────────────────────────────────────────────────────────

function parseAcademicText(rawText) {
    const normalized = normalizeText(rawText);
    const warnings = [];
    let docType = 'unknown';

    const lowerText = normalized.toLowerCase();
    if (lowerText.includes('supplementary') || lowerText.includes('reappear') || lowerText.includes('repeat') || lowerText.includes('re-appear')) {
        docType = 'supplementary_result';
        warnings.push('Supplementary result sheet detected. Review before importing.');
    } else if (lowerText.includes('re-examination') || lowerText.includes('re examination') || lowerText.includes('re-exam')) {
        docType = 're-examination_result';
        warnings.push('Re-examination result sheet detected. Review before importing.');
    } else if (lowerText.includes('improvement')) {
        docType = 'improvement_result';
        warnings.push('Improvement result sheet detected. Review before importing.');
    } else if (lowerText.includes('grade card') || lowerText.includes('grade sheet') || lowerText.includes('academic record')) {
        docType = 'grade_card';
    } else if (lowerText.includes('marksheet') || lowerText.includes('mark sheet') || lowerText.includes('statement of marks')) {
        docType = 'marksheet';
    } else {
        docType = 'other';
    }

    const semRegexes = [
        { sem: 1, regex: /\b(?:first|1st|1|i)\b\s*semester/i },
        { sem: 1, regex: /semester\s*\b(?:first|1st|1|i)\b/i },
        { sem: 2, regex: /\b(?:second|2nd|2|ii)\b\s*semester/i },
        { sem: 2, regex: /semester\s*\b(?:second|2nd|2|ii)\b/i },
        { sem: 3, regex: /\b(?:third|3rd|3|iii)\b\s*semester/i },
        { sem: 3, regex: /semester\s*\b(?:third|3rd|3|iii)\b/i },
        { sem: 4, regex: /\b(?:fourth|4th|4|iv)\b\s*semester/i },
        { sem: 4, regex: /semester\s*\b(?:fourth|4th|4|iv)\b/i }
    ];

    const semesterMatches = [];
    semRegexes.forEach(({ sem, regex }) => {
        const rx = new RegExp(regex, 'gi');
        let match;
        while ((match = rx.exec(normalized)) !== null) {
            semesterMatches.push({ sem, index: match.index, length: match[0].length });
        }
    });
    semesterMatches.sort((a, b) => a.index - b.index);

    const blocks = [];
    if (semesterMatches.length === 0) {
        blocks.push({ semesterName: 'Needs verification', text: normalized });
    } else {
        if (semesterMatches[0].index > 0) {
            blocks.push({ semesterName: 'Header Info', text: normalized.substring(0, semesterMatches[0].index) });
        }
        for (let i = 0; i < semesterMatches.length; i++) {
            const start = semesterMatches[i].index + semesterMatches[i].length;
            const end = (i + 1 < semesterMatches.length) ? semesterMatches[i + 1].index : normalized.length;
            blocks.push({ semesterName: `sem${semesterMatches[i].sem}`, text: normalized.substring(start, end) });
        }
    }

    const semestersResult = [];

    blocks.forEach(block => {
        if (block.semesterName === 'Header Info') return;

        let attemptType = 'original';
        const blockTextLower = block.text.toLowerCase();
        if (blockTextLower.includes('improvement') || blockTextLower.includes('grade improvement')) {
            attemptType = 'improvement';
        } else if (blockTextLower.includes('re-examination') || blockTextLower.includes('re examination') || blockTextLower.includes('re-exam') || blockTextLower.includes('re exam')) {
            attemptType = 're-examination';
        } else if (blockTextLower.includes('supplementary') || blockTextLower.includes('reappear') || blockTextLower.includes('re-appear') || blockTextLower.includes('repeat') || blockTextLower.includes('back paper') || blockTextLower.includes('backlog')) {
            attemptType = 'supplementary';
        } else if (docType === 'supplementary_result') {
            attemptType = 'supplementary';
        } else if (docType === 're-examination_result') {
            attemptType = 're-examination';
        } else if (docType === 'improvement_result') {
            attemptType = 'improvement';
        }

        const subjects = [];
        const lines = block.text.split('\n');

        lines.forEach(line => {
            const cleanLine = line.trim();
            if (cleanLine.length < 5) return;

            const codeMatch = cleanLine.match(/\b([A-Z]{2,4}[- ]?[0-9]{3,5})\b/i);
            if (!codeMatch) return;

            const courseCode = codeMatch[1];
            let remainingText = cleanLine.replace(courseCode, '').trim();

            const rollMatch = cleanLine.match(/\b(\d{2}[-\/]?\d{2,3}[-\/]?\d{3}|\d{7,9})\b/);
            const rollNumber = rollMatch ? rollMatch[1] : '';
            if (rollNumber) remainingText = remainingText.replace(rollNumber, '').trim();

            let grade = '';
            let gradeConfidence = 'low';
            const gradeMatch = remainingText.match(/\b(AA|AB|BB|BC|CC|CD|DD|F|W)\b/);
            if (gradeMatch) {
                grade = gradeMatch[1];
                gradeConfidence = 'high';
                remainingText = remainingText.replace(/\b(AA|AB|BB|BC|CC|CD|DD|F|W)\b/, '').trim();
            }

            let obtainedMarks = '';
            let maximumMarks = '';
            let marksConfidence = 'low';
            const marksMatch = remainingText.match(/\b(\d+(?:\.\d+)?)\s*[\/\\]\s*(\d+(?:\.\d+)?)\b/);
            if (marksMatch) {
                obtainedMarks = parseFloat(marksMatch[1]);
                maximumMarks = parseFloat(marksMatch[2]);
                marksConfidence = 'high';
                remainingText = remainingText.replace(/\b(\d+(?:\.\d+)?)\s*[\/\\]\s*(\d+(?:\.\d+)?)\b/, '').trim();
            }

            let credits = '';
            let creditsConfidence = 'low';
            const creditsLabeledMatch = remainingText.match(/\b([1-4](?:\.[0-9]+)?)\s*(?:credits?|cr)\b/i);
            if (creditsLabeledMatch) {
                credits = parseFloat(creditsLabeledMatch[1]);
                creditsConfidence = 'high';
                remainingText = remainingText.replace(/\b([1-4](?:\.[0-9]+)?)\s*(?:credits?|cr)\b/i, '').trim();
            } else {
                const creditsLooseMatch = remainingText.match(/\b([1-4](?:\.[50])?)\b/);
                if (creditsLooseMatch) {
                    credits = parseFloat(creditsLooseMatch[1]);
                    creditsConfidence = 'medium';
                    remainingText = remainingText.replace(/\b([1-4](?:\.[50])?)\b/, '').trim();
                }
            }

            let courseType = '';
            if (remainingText.toLowerCase().includes('theory')) {
                courseType = 'Theory';
                remainingText = remainingText.replace(/theory/i, '').trim();
            } else if (remainingText.toLowerCase().includes('lab') || remainingText.toLowerCase().includes('project') || remainingText.toLowerCase().includes('thesis') || remainingText.toLowerCase().includes('practical')) {
                courseType = 'Other';
            }

            let status = 'Passed';
            if (grade === 'F') status = 'Backlog';
            if (grade === 'W') status = 'Withdrawn';

            const courseName = remainingText.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

            subjects.push({
                rollNumber,
                code: courseCode,
                name: courseName || 'Course Name',
                credits: credits !== '' ? credits : '',
                obtainedMarks: obtainedMarks !== '' ? obtainedMarks : '',
                maximumMarks: maximumMarks !== '' ? maximumMarks : '',
                grade,
                courseType,
                attemptType,
                status,
                confidence: { code: 'high', credits: creditsConfidence, marks: marksConfidence, grade: gradeConfidence }
            });
        });

        let sgpaVal = '';
        let cgpaVal = '';
        const sgpaMatch = block.text.match(/(?:SGPA|S\.G\.P\.A|Semester Grade Point Average)\s*(?::|=)?\s*\b([0-9]\.[0-9]{1,2})\b/i);
        if (sgpaMatch) sgpaVal = parseFloat(sgpaMatch[1]);
        const cgpaMatch = block.text.match(/(?:CGPA|C\.G\.P\.A|Cumulative Grade Point Average)\s*(?::|=)?\s*\b([0-9]\.[0-9]{1,2})\b/i);
        if (cgpaMatch) cgpaVal = parseFloat(cgpaMatch[1]);

        if (subjects.length > 0 || sgpaVal !== '' || cgpaVal !== '') {
            semestersResult.push({ semester: block.semesterName, sgpa: sgpaVal !== '' ? sgpaVal : '', cgpa: cgpaVal !== '' ? cgpaVal : '', subjects });
        }
    });

    if (semestersResult.length === 0) {
        let globalSgpa = '';
        let globalCgpa = '';
        const sgpaMatch = normalized.match(/(?:SGPA|S\.G\.P\.A|Semester Grade Point Average)\s*(?::|=)?\s*\b([0-9]\.[0-9]{1,2})\b/i);
        if (sgpaMatch) globalSgpa = parseFloat(sgpaMatch[1]);
        const cgpaMatch = normalized.match(/(?:CGPA|C\.G\.P\.A|Cumulative Grade Point Average)\s*(?::|=)?\s*\b([0-9]\.[0-9]{1,2})\b/i);
        if (cgpaMatch) globalCgpa = parseFloat(cgpaMatch[1]);
        if (globalSgpa !== '' || globalCgpa !== '') {
            semestersResult.push({ semester: 'Needs verification', sgpa: globalSgpa, cgpa: globalCgpa, subjects: [] });
        }
    }

    return { semesters: semestersResult, documentType: docType, warnings };
}

// ── Vercel handler ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Ensure /tmp dir exists on Vercel
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    await runMiddleware(req, res, upload.single('document'));

    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No document uploaded.' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname.toLowerCase();

    try {
        let rawText = '';
        let docType = 'unknown';

        if (originalName.endsWith('.pdf')) {
            rawText = await extractTextFromPdf(filePath);
            docType = 'pdf';
        } else if (originalName.endsWith('.jpg') || originalName.endsWith('.jpeg') || originalName.endsWith('.png')) {
            rawText = await extractTextFromImage(filePath);
            docType = 'image';
        } else {
            return res.status(400).json({ success: false, error: 'Unsupported file type. Please upload a PDF, JPG, or PNG.' });
        }

        const parsedData = parseAcademicText(rawText);
        const docId = 'DOC_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        res.status(200).json({
            success: true,
            document: { id: docId, type: docType, originalName: req.file.originalname },
            semesters: parsedData.semesters,
            documentType: parsedData.documentType,
            warnings: parsedData.warnings
        });

    } catch (err) {
        console.error('Document analysis error:', err);
        res.status(500).json({ success: false, error: err.message || 'Unable to extract readable text from the document.' });
    } finally {
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_) { /* cleanup failure is non-fatal */ }
    }
};
