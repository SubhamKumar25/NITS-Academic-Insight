const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');

// Check if Canvas is available for scanned PDF rendering fallback
let Canvas = null;
try {
    Canvas = require('canvas');
} catch (err) {
    console.warn("Canvas module is not installed. Scanned PDF page rendering to OCR will not be supported.");
}

// Load legacy build of PDF.js for Node.js compatibility
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const app = express();
const port = 3000;

// Configure temporary Multer storage (use /tmp on Vercel as root is read-only)
const uploadDir = (process.env.VERCEL || process.env.NODE_ENV === 'production') ? '/tmp' : 'uploads';
const upload = multer({
    dest: uploadDir + '/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

// Serve frontend static files
app.use(express.static(__dirname));
app.use(express.json());

// Main Document Analysis Endpoint
app.post('/api/analyze', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No document uploaded.' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname.toLowerCase();

    try {
        let rawText = "";
        let docType = "unknown";

        if (originalName.endsWith('.pdf')) {
            rawText = await extractTextFromPdf(filePath);
            docType = "pdf";
        } else if (originalName.endsWith('.jpg') || originalName.endsWith('.jpeg') || originalName.endsWith('.png')) {
            rawText = await extractTextFromImage(filePath);
            docType = "image";
        } else {
            return res.status(400).json({ success: false, error: 'Unsupported file type.' });
        }

        // Parse extracted text into academic structured details (compatible with Part 6 Academic Analysis Dashboard)
        const parsedData = parseAcademicText(rawText);

        const docId = 'DOC_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        res.json({
            success: true,
            document: {
                id: docId,
                type: docType,
                originalName: req.file.originalname
            },
            semesters: parsedData.semesters,
            documentType: parsedData.documentType,
            warnings: parsedData.warnings
        });

    } catch (err) {
        console.error("Document analysis error:", err);
        res.status(500).json({
            success: false,
            error: err.message || 'Unable to extract readable text from the document.'
        });
    } finally {
        // Safe Cleanup: delete temp file
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (cleanupErr) {
            console.error("Failed to delete temp file:", cleanupErr);
        }
    }
});

// Extract text layer from digital PDF
async function extractTextFromPdf(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true });
    const pdfDocument = await loadingTask.promise;
    
    let fullText = "";
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += `\n--- PAGE ${i} ---\n` + pageText;
    }

    // Heuristic: If PDF text layer is empty, run scanned PDF rendering + OCR
    if (fullText.trim().length < 50) {
        console.log("Digital PDF text layer is empty. Attempting scanned PDF OCR...");
        if (Canvas) {
            return await ocrScannedPdf(pdfDocument);
        } else {
            throw new Error("Empty PDF text layer. OCR engine cannot render PDF pages without 'canvas' package.");
        }
    }

    return fullText;
}

// Render scanned PDF pages to canvas and perform OCR
async function ocrScannedPdf(pdfDocument) {
    let ocrText = "";
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Upscale for OCR resolution
        const canvas = Canvas.createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const buffer = canvas.toBuffer('image/png');
        const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
        ocrText += `\n--- PAGE ${i} (OCR) ---\n` + text;
    }
    return ocrText;
}

// OCR Image files using Tesseract.js
async function extractTextFromImage(filePath) {
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
    return text;
}

// Normalize spacing, breaks, and OCR punctuation errors
function normalizeText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ') // normalize repeated spaces/tabs
        .replace(/\n\s*\n/g, '\n') // remove empty lines
        .trim();
}

// Academic Parser Heuristic Rules Engine
function parseAcademicText(rawText) {
    const normalized = normalizeText(rawText);
    const warnings = [];
    let docType = "unknown";

    // Detect document keywords
    const lowerText = normalized.toLowerCase();
    if (lowerText.includes("supplementary") || lowerText.includes("reappear") || lowerText.includes("repeat") || lowerText.includes("improvement") || lowerText.includes("re-examination")) {
        docType = "supplementary";
        warnings.push("Supplementary/re-examination information detected. Review before importing.");
    } else if (lowerText.includes("grade card") || lowerText.includes("grade sheet") || lowerText.includes("academic record")) {
        docType = "grade_card";
    } else if (lowerText.includes("marksheet") || lowerText.includes("mark sheet") || lowerText.includes("statement of marks")) {
        docType = "marksheet";
    }

    // Split text into semester blocks
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
        let match;
        const rx = new RegExp(regex, 'gi');
        while ((match = rx.exec(normalized)) !== null) {
            semesterMatches.push({
                sem,
                index: match.index,
                length: match[0].length
            });
        }
    });

    // Sort matches by text index
    semesterMatches.sort((a, b) => a.index - b.index);

    const blocks = [];
    if (semesterMatches.length === 0) {
        // Fallback: entire text under needs verification
        blocks.push({
            semesterName: "Needs verification",
            text: normalized
        });
    } else {
        // If there is text before the first semester heading, parse it for overall metrics
        if (semesterMatches[0].index > 0) {
            blocks.push({
                semesterName: "Header Info",
                text: normalized.substring(0, semesterMatches[0].index)
            });
        }

        for (let i = 0; i < semesterMatches.length; i++) {
            const start = semesterMatches[i].index + semesterMatches[i].length;
            const end = (i + 1 < semesterMatches.length) ? semesterMatches[i + 1].index : normalized.length;
            blocks.push({
                semesterName: `sem${semesterMatches[i].sem}`,
                text: normalized.substring(start, end)
            });
        }
    }

    const semestersResult = [];

    // Parse each block
    blocks.forEach(block => {
        if (block.semesterName === "Header Info") return; // Header info contains no subjects

        // Heuristic detection of block attempt type
        let attemptType = "original";
        const blockTextLower = block.text.toLowerCase();
        
        if (blockTextLower.includes("improvement") || blockTextLower.includes("grade improvement")) {
            attemptType = "improvement";
        } else if (blockTextLower.includes("re-examination") || blockTextLower.includes("re examination") || blockTextLower.includes("re-exam") || blockTextLower.includes("re exam")) {
            attemptType = "re-examination";
        } else if (blockTextLower.includes("supplementary") || blockTextLower.includes("reappear") || blockTextLower.includes("re-appear") || blockTextLower.includes("repeat") || blockTextLower.includes("back paper") || blockTextLower.includes("backlog")) {
            attemptType = "supplementary";
        } else if (docType === "supplementary") {
            attemptType = "supplementary";
        }

        const subjects = [];
        const lines = block.text.split('\n');
        
        lines.forEach(line => {
            const cleanLine = line.trim();
            if (cleanLine.length < 5) return;

            // Search for course code regex (e.g. CS-501, CS501, MA-102)
            const codeMatch = cleanLine.match(/\b([A-Z]{2,4}[- ]?[0-9]{3,5})\b/i);
            if (!codeMatch) return;

            const courseCode = codeMatch[1];
            let remainingText = cleanLine.replace(courseCode, '').trim();

            // Extract grade (AA, AB, BB, BC, CC, CD, DD, F, W)
            let grade = "";
            let gradeConfidence = "low";
            const gradeMatch = remainingText.match(/\b(AA|AB|BB|BC|CC|CD|DD|F|W)\b/);
            if (gradeMatch) {
                grade = gradeMatch[1];
                gradeConfidence = "high";
                remainingText = remainingText.replace(/\b(AA|AB|BB|BC|CC|CD|DD|F|W)\b/, '').trim();
            }

            // Extract marks pattern like (obtained / max)
            let obtainedMarks = "";
            let maximumMarks = "";
            let marksConfidence = "low";
            const marksMatch = remainingText.match(/\b(\d+(?:\.\d+)?)\s*[\/\\]\s*(\d+(?:\.\d+)?)\b/);
            if (marksMatch) {
                obtainedMarks = parseFloat(marksMatch[1]);
                maximumMarks = parseFloat(marksMatch[2]);
                marksConfidence = "high";
                remainingText = remainingText.replace(/\b(\d+(?:\.\d+)?)\s*[\/\\]\s*(\d+(?:\.\d+)?)\b/, '').trim();
            }

            // Extract credits (usually integer or float 1.5, 2.5, 3.0, 4.0)
            let credits = "";
            let creditsConfidence = "low";
            // Look for credits accompanied by labels first
            const creditsLabeledMatch = remainingText.match(/\b([1-4](?:\.[0-9]+)?)\s*(?:credits?|cr)\b/i);
            if (creditsLabeledMatch) {
                credits = parseFloat(creditsLabeledMatch[1]);
                creditsConfidence = "high";
                remainingText = remainingText.replace(/\b([1-4](?:\.[0-9]+)?)\s*(?:credits?|cr)\b/i, '').trim();
            } else {
                // Secondary check for loose numbers representing credits
                const creditsLooseMatch = remainingText.match(/\b([1-4](?:\.[50])?)\b/);
                if (creditsLooseMatch) {
                    credits = parseFloat(creditsLooseMatch[1]);
                    creditsConfidence = "medium";
                    remainingText = remainingText.replace(/\b([1-4](?:\.[50])?)\b/, '').trim();
                }
            }

            // Detect course type
            let courseType = "";
            if (remainingText.toLowerCase().includes("theory")) {
                courseType = "Theory";
                remainingText = remainingText.replace(/theory/i, '').trim();
            } else if (remainingText.toLowerCase().includes("lab") || remainingText.toLowerCase().includes("project") || remainingText.toLowerCase().includes("thesis") || remainingText.toLowerCase().includes("practical")) {
                courseType = "Other";
            }

            // Determine status
            let status = "Passed";
            if (grade === "F") status = "Backlog";
            if (grade === "W") status = "Withdrawn";

            // The leftover text is likely the course name
            const courseName = remainingText
                .replace(/[^a-zA-Z0-9\s]/g, '') // remove trailing weird characters
                .replace(/\s+/g, ' ')
                .trim();

            subjects.push({
                code: courseCode,
                name: courseName || "Course Name",
                credits: credits !== "" ? credits : "",
                obtainedMarks: obtainedMarks !== "" ? obtainedMarks : "",
                maximumMarks: maximumMarks !== "" ? maximumMarks : "",
                grade: grade,
                courseType: courseType,
                attemptType: attemptType,
                status: status,
                confidence: {
                    code: "high",
                    credits: creditsConfidence,
                    marks: marksConfidence,
                    grade: gradeConfidence
                }
            });
        });

        // Search for SGPA/CGPA inside this block
        let sgpaVal = "";
        let cgpaVal = "";

        const sgpaMatch = block.text.match(/(?:SGPA|S\.G\.P\.A|Semester Grade Point Average)\s*(?::|=)?\s*\b([0-9]\.[0-9]{1,2})\b/i);
        if (sgpaMatch) {
            sgpaVal = parseFloat(sgpaMatch[1]);
        }

        const cgpaMatch = block.text.match(/(?:CGPA|C\.G\.P\.A|Cumulative Grade Point Average)\s*(?::|=)?\s*\b([0-9]\.[0-9]{1,2})\b/i);
        if (cgpaMatch) {
            cgpaVal = parseFloat(cgpaMatch[1]);
        }

        if (subjects.length > 0 || sgpaVal !== "" || cgpaVal !== "") {
            semestersResult.push({
                semester: block.semesterName,
                sgpa: sgpaVal !== "" ? sgpaVal : "",
                cgpa: cgpaVal !== "" ? cgpaVal : "",
                subjects: subjects
            });
        }
    });

    // If no semesters parsed but overall text contains CGPA/SGPA, add an empty verified block
    if (semestersResult.length === 0) {
        let globalSgpa = "";
        let globalCgpa = "";
        
        const sgpaMatch = normalized.match(/(?:SGPA|S\.G\.P\.A|Semester Grade Point Average)\s*(?::|=)?\s*\b([0-9]\.[0-9]{1,2})\b/i);
        if (sgpaMatch) globalSgpa = parseFloat(sgpaMatch[1]);

        const cgpaMatch = normalized.match(/(?:CGPA|C\.G\.P\.A|Cumulative Grade Point Average)\s*(?::|=)?\s*\b([0-9]\.[0-9]{1,2})\b/i);
        if (cgpaMatch) globalCgpa = parseFloat(cgpaMatch[1]);

        if (globalSgpa !== "" || globalCgpa !== "") {
            semestersResult.push({
                semester: "Needs verification",
                sgpa: globalSgpa,
                cgpa: globalCgpa,
                subjects: []
            });
        }
    }

    return {
        semesters: semestersResult,
        documentType: docType,
        warnings
    };
}

// Ensure temp uploads folder exists locally
if (uploadDir === 'uploads' && !fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Start Server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`NITS Academic Insight backend running at http://localhost:${port}`);
    });
}

module.exports = app;
