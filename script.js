/**
 * NITS Academic Insight
 * M.Tech Academic Utility for NIT Silchar Students
 * Fully functional Vanilla JavaScript logic
 */

// Firebase modular SDK imports (loaded via ES module)
import {
    initializeFirebase,
    getFirebaseAuth,
    getFirebaseDb,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    signInWithPopup,
    GoogleAuthProvider,
    browserLocalPersistence,
    browserSessionPersistence,
    setPersistence,
    onAuthStateChanged,
    updateProfile,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot
} from './src/firebase/config.js';


// Application State
const state = {
    calculationMethod: 'grade', // 'grade' or 'marks'
    activeSemester: 'sem1', // Current visible semester (sem1, sem2, sem3, sem4)
    auth: {
        loading: true,
        user: null,
        mode: 'mock'
    },
    // Two-Level Hierarchy State: Current Student Profile & Active Calculation
    currentProfile: {
        profileId: null,        // null = unsaved new profile; string = existing profile ID
        studentName: '',         // blank on fresh load — user must enter or select
        program: 'mtech',
        department: 'cse'
    },
    currentCalculation: {
        calculationId: null,        // null = unsaved new calculation; string = existing calculation ID
        resultNickname: 'Main Result',
        isDirty: false,
        mode: 'normal'              // 'normal' | 'advanced'
    },
    semesters: {
        sem1: [], // Array of courses: { id, code, courseType, obtainedMarks, maximumMarks, credits, grade, gradeSource, manualGrade, attemptType, parentCourseId, documentType, source }
        sem2: [],
        sem3: [],
        sem4: []
    },
    selectedSemesters: {
        sem1: false, // Checkbox selections for custom CGPA analysis
        sem2: false,
        sem3: false,
        sem4: false
    },
    importedDocSgpa: null,
    importedDocCgpa: null,
    extractionSession: {
        file: null,
        status: 'empty', // 'empty' | 'selected' | 'processing' | 'extracted'
        extractedSubjects: []
    },
    ignoredRepeats: [],
    resolvedFinalDataset: [],
    attemptHistories: [],
    unlinkedRepeats: []
};

// Global Student Profiles & History Records State
let stateProfileHistory = [];

// M.Tech Theory Grading Rules (91-100 AA, 81-90 AB, etc.)
const THEORY_GRADING = [
    { min: 91, max: 100, grade: 'AA', gp: 10 },
    { min: 81, max: 90, grade: 'AB', gp: 9 },
    { min: 71, max: 80, grade: 'BB', gp: 8 },
    { min: 61, max: 70, grade: 'BC', gp: 7 },
    { min: 52, max: 60, grade: 'CC', gp: 6 },
    { min: 43, max: 51, grade: 'CD', gp: 5 },
    { min: 35, max: 42, grade: 'DD', gp: 4 },
    { min: 0, max: 34, grade: 'F', gp: 0 }
];

// M.Tech Other than Theory Grading Rules (94-100 AA, 87-93 AB, etc.)
const OTHER_GRADING = [
    { min: 94, max: 100, grade: 'AA', gp: 10 },
    { min: 87, max: 93, grade: 'AB', gp: 9 },
    { min: 80, max: 86, grade: 'BB', gp: 8 },
    { min: 73, max: 79, grade: 'BC', gp: 7 },
    { min: 65, max: 72, grade: 'CC', gp: 6 },
    { min: 57, max: 64, grade: 'CD', gp: 5 },
    { min: 50, max: 56, grade: 'DD', gp: 4 },
    { min: 0, max: 49, grade: 'F', gp: 0 }
];

// Grade Point Mapping Rules
const GRADE_POINT_MAPPING = {
    'AA': 10,
    'AB': 9,
    'BB': 8,
    'BC': 7,
    'CC': 6,
    'CD': 5,
    'DD': 4,
    'F': 0,
    'W': 0,
    'PP': 0,
    'NP': 0,
    'AU': 0,
    'Satisfactory': 0,
    'Unsatisfactory': 0,
    'I': 0
};

// Predefined Academic Programs & Departments course configuration
const ACADEMIC_PROGRAMS = {
    "mtech": {
        name: "M.Tech",
        departments: {
            "cse": {
                name: "Computer Science and Engineering",
                courses: {
                    sem1: [
                        { code: "CS5101", subject: "Foundations of Computing Science", credits: 3, courseType: "Theory" },
                        { code: "CS5102", subject: "Advanced Algorithms & Data Structure", credits: 3, courseType: "Theory" },
                        { code: "CS5103", subject: "Linear Optimization", credits: 3, courseType: "Theory" },
                        { code: "CS5137", subject: "Machine Learning", credits: 3, courseType: "Theory" },
                        { code: "CS5104", subject: "Computer Systems Lab-I", credits: 2, courseType: "Other" },
                        { code: "CS5105", subject: "Seminar-I", credits: 2, courseType: "Other" }
                    ],
                    sem2: [
                        { code: "CS5106", subject: "Advanced Database Management System", credits: 3, courseType: "Theory" },
                        { code: "CS5107", subject: "High Performance Computing", credits: 3, courseType: "Theory" },
                        { code: "CS5108", subject: "Internet Protocol", credits: 4, courseType: "Theory" },
                        { code: "CS5109", subject: "Artificial Intelligence", credits: 3, courseType: "Theory" },
                        { code: "CS5141", subject: "Complex Networks", credits: 3, courseType: "Theory" },
                        { code: "CS5110", subject: "Computer Systems Lab-II", credits: 2, courseType: "Other" }
                    ],
                    sem3: [
                        { code: "CS6098", subject: "PROJECT 1", credits: 6, courseType: "Other" },
                        { code: "CS6101", subject: "SEMINAR", credits: 2, courseType: "Other" }
                    ],
                    sem4: [
                        { code: "CS6099", subject: "PROJECT 2", credits: 8, courseType: "Other" }
                    ]
                }
            },
            "aiml": {
                name: "Artificial Intelligence and Machine Learning",
                courses: {
                    sem1: [
                        { code: "AI5101", subject: "Foundations of Artificial Intelligence", credits: 3, courseType: "Theory" },
                        { code: "AI5102", subject: "Machine Learning", credits: 3, courseType: "Theory" },
                        { code: "AI5103", subject: "Mathematical Foundations for AI", credits: 3, courseType: "Theory" },
                        { code: "AI5104", subject: "Data Structures and Algorithms", credits: 3, courseType: "Theory" },
                        { code: "AI5105", subject: "AI Lab-I", credits: 2, courseType: "Other" },
                        { code: "AI5106", subject: "Seminar-I", credits: 2, courseType: "Other" }
                    ],
                    sem2: [
                        { code: "AI5201", subject: "Deep Learning", credits: 3, courseType: "Theory" },
                        { code: "AI5202", subject: "Natural Language Processing", credits: 3, courseType: "Theory" },
                        { code: "AI5203", subject: "Computer Vision", credits: 3, courseType: "Theory" },
                        { code: "AI5204", subject: "Reinforcement Learning", credits: 3, courseType: "Theory" },
                        { code: "AI5205", subject: "AI Systems Lab-II", credits: 4, courseType: "Other" },
                        { code: "AI5206", subject: "Seminar-II", credits: 2, courseType: "Other" }
                    ],
                    sem3: [
                        { code: "AI6098", subject: "PROJECT 1", credits: 6, courseType: "Other" },
                        { code: "AI6101", subject: "SEMINAR", credits: 2, courseType: "Other" }
                    ],
                    sem4: [
                        { code: "AI6099", subject: "PROJECT 2", credits: 8, courseType: "Other" }
                    ]
                }
            }
        }
    }
};

// Backward-compatible alias
const DEPARTMENTS = ACADEMIC_PROGRAMS.mtech.departments;

// DOM Cache
const dom = {
    subjectRowsContainer: document.getElementById('subject-rows-container'),
    emptyStateMessage: document.getElementById('empty-state-message'),
    addSubjectBtn: document.getElementById('add-subject-btn'),
    resetBtn: document.getElementById('reset-btn'),
    semOverviewPanel: document.getElementById('semester-overview-panel'),
    
    // Quick Semester Overview Labels
    overviewCredits: document.getElementById('overview-credits'),
    overviewPoints: document.getElementById('overview-points'),
    overviewSgpa: document.getElementById('overview-sgpa'),
    overviewPercentage: document.getElementById('overview-percentage'),

    // Result Dashboard Cards
    cardCurrentSgpa: document.getElementById('card-current-sgpa'),
    currentSgpaPct: document.getElementById('current-sgpa-pct'),
    currentSemTitle: document.getElementById('current-sem-title'),
    
    cardSelectedCgpa: document.getElementById('card-selected-cgpa'),
    selectedCgpaPct: document.getElementById('selected-cgpa-pct'),
    
    cardOverallCgpa: document.getElementById('card-overall-cgpa'),
    overallCgpaPct: document.getElementById('overall-cgpa-pct'),
    cardPercentage: document.getElementById('card-percentage'),
    
    cardTotalCredits: document.getElementById('card-total-credits'),
    cardBacklogs: document.getElementById('card-backlogs'),
    cardBacklogsFooter: document.getElementById('card-backlogs-footer'),
    
    cardStatus: document.getElementById('card-status'),
    cardStatusFooter: document.getElementById('card-status-footer'),
    statusSemTitle: document.getElementById('status-sem-title'),

    // Sidebar custom checkboxes and buttons
    checkSem1: document.getElementById('check-sem1'),
    checkSem2: document.getElementById('check-sem2'),
    checkSem3: document.getElementById('check-sem3'),
    checkSem4: document.getElementById('check-sem4'),
    analysisSelectAll: document.getElementById('analysis-select-all'),
    analysisClearAll: document.getElementById('analysis-clear-all'),
    summaryRowsContainer: document.getElementById('summary-rows-container'),
    summaryEmptyMessage: document.getElementById('summary-empty-message'),

    // Part 3 elements
    uploadDropzone: document.getElementById('upload-dropzone'),
    fileInput: document.getElementById('file-input'),
    previewPanel: document.getElementById('preview-panel'),
    previewFilename: document.getElementById('preview-filename'),
    previewFilesize: document.getElementById('preview-filesize'),
    previewIconType: document.getElementById('preview-icon-type'),
    imagePreviewWrapper: document.getElementById('image-preview-wrapper'),
    previewImage: document.getElementById('preview-image'),
    pdfPreviewPlaceholder: document.getElementById('pdf-preview-placeholder'),
    removeFileBtn: document.getElementById('remove-file-btn'),
    analyzeBtn: document.getElementById('analyze-btn'),
    processingPanel: document.getElementById('processing-panel'),
    verificationPanel: document.getElementById('verification-panel'),
    verificationRowsContainer: document.getElementById('verification-rows-container'),
    addVerificationRowBtn: document.getElementById('add-verification-row-btn'),
    confirmImportBtn: document.getElementById('confirm-import-btn'),
    cancelExtractionBtn: document.getElementById('cancel-extraction-btn'),
    docSgpaInput: document.getElementById('doc-sgpa-input'),
    docCgpaInput: document.getElementById('doc-cgpa-input'),
    calcSgpaVerify: document.getElementById('calc-sgpa-verify'),
    calcCgpaVerify: document.getElementById('calc-cgpa-verify'),
    sgpaCompareStatus: document.getElementById('sgpa-compare-status'),
    cgpaCompareStatus: document.getElementById('cgpa-compare-status'),
    duplicateModal: document.getElementById('duplicate-modal'),
    duplicateModalMsg: document.getElementById('duplicate-modal-msg'),
    dupKeepExisting: document.getElementById('dup-keep-existing'),
    dupUseUploaded: document.getElementById('dup-use-uploaded'),
    dupAddSeparate: document.getElementById('dup-add-separate'),
    
    // Part 6 Dashboard elements
    dashboardSection: document.getElementById('dashboard-section'),
    dashboardEmptyState: document.getElementById('dashboard-empty-state'),
    dashboardContents: document.getElementById('dashboard-contents'),
    dashCurrentSgpa: document.getElementById('dash-current-sgpa'),
    dashOverallCgpa: document.getElementById('dash-overall-cgpa'),
    dashSelectedCgpa: document.getElementById('dash-selected-cgpa'),
    dashSelectedSemestersLabel: document.getElementById('dash-selected-semesters-label'),
    dashPercentage: document.getElementById('dash-percentage'),
    dashTotalCredits: document.getElementById('dash-total-credits'),
    dashActiveBacklogs: document.getElementById('dash-active-backlogs'),
    dashSemesterRows: document.getElementById('dash-semester-rows'),
    dashBestSem: document.getElementById('dash-best-sem'),
    dashLowestSem: document.getElementById('dash-lowest-sem'),
    semesterChartContainer: document.getElementById('semester-chart-container'),
    filterSemester: document.getElementById('filter-semester'),
    filterStatus: document.getElementById('filter-status'),
    filterGrade: document.getElementById('filter-grade'),
    dashSubjectRows: document.getElementById('dash-subject-rows'),
    dashSubjectsEmpty: document.getElementById('dash-subjects-empty'),
    gradeDistributionContainer: document.getElementById('grade-distribution-container'),
    gradeDistributionEmpty: document.getElementById('grade-distribution-empty'),
    creditEntered: document.getElementById('credit-entered'),
    creditPassed: document.getElementById('credit-passed'),
    creditBacklog: document.getElementById('credit-backlog'),
    creditWithdrawn: document.getElementById('credit-withdrawn'),
    attemptsSummaryContainer: document.getElementById('attempts-summary-container'),
    attemptsSummaryEmpty: document.getElementById('attempts-summary-empty'),
    finalStatusCard: document.getElementById('final-status-card'),
    finalStatusTitle: document.getElementById('final-status-title'),
    finalStatusDesc: document.getElementById('final-status-desc'),
    dashSourceIndicator: document.getElementById('dash-source-indicator'),
    dashQualityIndicator: document.getElementById('dash-quality-indicator'),
    insightsListContainer: document.getElementById('insights-list-container'),
    printAnalysisBtn: document.getElementById('print-analysis-btn'),
    
    // Auth elements
    authContainer: document.getElementById('auth-container'),
    appContainer: document.getElementById('app-container'),
    loginView: document.getElementById('login-view'),
    signupView: document.getElementById('signup-view'),
    forgotView: document.getElementById('forgot-view'),
    loginForm: document.getElementById('login-form'),
    signupForm: document.getElementById('signup-form'),
    forgotForm: document.getElementById('forgot-form'),
    mobLogoutBtn: document.getElementById('mob-logout-btn'),
    mobileUserInfo: document.getElementById('mobile-user-info'),

    // Part 25+ History Elements
    historySection: document.getElementById('history'),
    saveCurrentHistoryBtn: document.getElementById('save-current-history-btn'),
    historySearchInput: document.getElementById('history-search-input'),
    historyFilterType: document.getElementById('history-filter-type'),
    historySort: document.getElementById('history-sort'),
    historyItemsContainer: document.getElementById('history-items-container'),
    historyEmptyState: document.getElementById('history-empty-state'),
    historyStartCalcBtn: document.getElementById('history-start-calc-btn'),
    lookupStudentId: document.getElementById('lookup-student-id'),
    btnLookupStudent: document.getElementById('btn-lookup-student'),
    
    // Save History Modal
    saveHistoryModal: document.getElementById('save-history-modal'),
    closeSaveHistoryModalBtn: document.getElementById('close-save-history-modal-btn'),
    saveHistorySourceType: document.getElementById('save-history-source-type'),
    saveHistoryNicknameInput: document.getElementById('save-history-nickname-input'),
    btnCancelSaveHistoryModal: document.getElementById('btn-cancel-save-history-modal'),
    btnConfirmSaveHistoryModal: document.getElementById('btn-confirm-save-history-modal'),

    // History Details Modal
    historyDetailModal: document.getElementById('history-detail-modal'),
    closeHistDetailBtn: document.getElementById('close-hist-detail-btn'),
    histDetailName: document.getElementById('hist-detail-name'),
    histDetailRoll: document.getElementById('hist-detail-roll'),
    histDetailNickname: document.getElementById('hist-detail-nickname'),
    histDetailBadge: document.getElementById('hist-detail-badge'),
    histDetailCgpa: document.getElementById('hist-detail-cgpa'),
    histDetailPct: document.getElementById('hist-detail-pct'),
    histDetailCredits: document.getElementById('hist-detail-credits'),
    histDetailBacklogs: document.getElementById('hist-detail-backlogs'),
    histDetailSemestersWrapper: document.getElementById('hist-detail-semesters-wrapper'),
    histDetailVersionInfo: document.getElementById('hist-detail-version-info'),
    btnHistDetailCsv: document.getElementById('btn-hist-detail-csv'),
    btnHistDetailPdf: document.getElementById('btn-hist-detail-pdf'),
    btnHistDetailClose: document.getElementById('btn-hist-detail-close'),

    // History Edit Modal
    historyEditModal: document.getElementById('history-edit-modal'),
    closeHistoryEditBtn: document.getElementById('close-history-edit-btn'),
    editHistNameInput: document.getElementById('edit-hist-name-input'),
    editHistRollInput: document.getElementById('edit-hist-roll-input'),
    editHistNicknameInput: document.getElementById('edit-hist-nickname-input'),
    editHistCoursesEditor: document.getElementById('edit-hist-courses-editor'),
    editHistVersionDisplay: document.getElementById('edit-hist-version-display'),
    btnCancelEditHistory: document.getElementById('btn-cancel-edit-history'),
    btnSaveChangesHistory: document.getElementById('btn-save-changes-history'),
    btnSaveAsNewHistory: document.getElementById('btn-save-as-new-history'),
    calcStudentName: document.getElementById('calc-student-name'),
    calcResultNickname: document.getElementById('calc-result-nickname'),
    calcProgramSelect: document.getElementById('calc-program-select'),
    calcDepartmentSelect: document.getElementById('calc-department-select'),
    calcLockStructure: document.getElementById('calc-lock-structure'),
    autoSaveStatus: document.getElementById('auto-save-status'),
    btnNewResult: document.getElementById('btn-new-result'),
    btnNewCalculation: document.getElementById('btn-new-calculation'),
    btnSaveToHistory: document.getElementById('btn-save-to-history'),
    btnSaveAsNew: document.getElementById('btn-save-as-new'),
    currentProfileDisplayBadge: document.getElementById('current-profile-display-badge')
};

// Initial setup & safe application bootstrap
document.addEventListener('DOMContentLoaded', () => {
    try { initMobileMenu(); } catch (e) { console.warn("initMobileMenu error:", e); }
    try { initGradeRulesTabs(); } catch (e) { console.warn("initGradeRulesTabs error:", e); }
    try { initDashboardSearch(); } catch (e) { console.warn("initDashboardSearch error:", e); }
    try { initAccessibilityKeys(); } catch (e) { console.warn("initAccessibilityKeys error:", e); }
    try { checkServiceAvailability(); } catch (e) { console.warn("checkServiceAvailability error:", e); }
    try { initEventListeners(); } catch (e) { console.error("initEventListeners error:", e); }
    try { initAnalyzerEvents(); } catch (e) { console.error("initAnalyzerEvents error:", e); }
    try { initAttemptEvents(); } catch (e) { console.error("initAttemptEvents error:", e); }

    if (!state.semesters.sem1 || state.semesters.sem1.length === 0) {
        try { applyPredefinedCourses(); } catch (e) { console.error("applyPredefinedCourses error:", e); }
    }

    try { render(); } catch (e) { console.error("render error:", e); }
    try { initHistorySystem(); } catch (e) { console.error("initHistorySystem error:", e); }

    // Init Auth last — guaranteed fallback hides loading overlay
    try {
        initAuth();
    } catch (e) {
        console.error("initAuth error:", e);
        hideLoadingOverlay();
    }
});


// Render Academic Analysis Progress Tracker
function renderAnalysis() {
    const emptyState = document.getElementById('dashboard-empty-state');
    const contents = document.getElementById('dashboard-contents');

    // Aggregate saved calculations across all loaded student profiles
    let allCalculations = [];
    (stateProfileHistory || []).forEach(prof => {
        (prof.calculations || []).forEach(c => {
            allCalculations.push({
                studentName: prof.studentName,
                program: prof.program,
                department: prof.department,
                ...c
            });
        });
    });

    if (allCalculations.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (contents) contents.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (contents) contents.style.display = 'block';

    const latest = allCalculations[0];
    const sum = latest.summary || {};

    const cgpa = sum.overallCGPA !== undefined && sum.overallCGPA !== null ? Number(sum.overallCGPA).toFixed(2) : '—';
    const pct = sum.percentage !== undefined && sum.percentage !== null ? Number(sum.percentage).toFixed(1) + '%' : (sum.overallCGPA ? (Number(sum.overallCGPA) * 10).toFixed(1) + '%' : '—');
    const credits = sum.totalCredits !== undefined && sum.totalCredits !== null ? String(sum.totalCredits) : '—';
    const backlogs = sum.activeBacklogs !== undefined && sum.activeBacklogs !== null ? String(sum.activeBacklogs) : '—';

    const dashCurrentSgpa = document.getElementById('dash-current-sgpa');
    const dashOverallCgpa = document.getElementById('dash-overall-cgpa');
    const dashPercentage = document.getElementById('dash-percentage');
    const dashTotalCredits = document.getElementById('dash-total-credits');
    const dashActiveBacklogs = document.getElementById('dash-active-backlogs');

    if (dashCurrentSgpa) dashCurrentSgpa.textContent = cgpa;
    if (dashOverallCgpa) dashOverallCgpa.textContent = cgpa;
    if (dashPercentage) dashPercentage.textContent = pct;
    if (dashTotalCredits) dashTotalCredits.textContent = credits;
    if (dashActiveBacklogs) dashActiveBacklogs.textContent = backlogs;
}

// Navigation Tab Switcher
function switchTab(tabId) {
    const tabs = ['calculator', 'advanced-calc', 'history', 'analysis'];
    tabs.forEach(t => {
        const sec = document.getElementById(t);
        if (sec) sec.style.display = (t === tabId) ? 'block' : 'none';
        
        const navId = t === 'calculator' ? 'nav-calc-btn' : (t === 'advanced-calc' ? 'nav-advanced-btn' : `nav-${t}-btn`);
        const navBtn = document.getElementById(navId);
        if (navBtn) {
            if (t === tabId) navBtn.classList.add('active');
            else navBtn.classList.remove('active');
        }

        const mobId = t === 'calculator' ? 'mob-calc-btn' : (t === 'advanced-calc' ? 'mob-advanced-btn' : `mob-${t}-btn`);
        const mobBtn = document.getElementById(mobId);
        if (mobBtn) {
            if (t === tabId) mobBtn.classList.add('active');
            else mobBtn.classList.remove('active');
        }
    });

    // Hide Grade Rules reference section when viewing History or Analysis tabs
    const gradeRulesSec = document.getElementById('grade-rules');
    if (gradeRulesSec) {
        gradeRulesSec.style.display = (tabId === 'calculator' || tabId === 'advanced-calc') ? 'block' : 'none';
    }

    state.activeTab = tabId;

    if (tabId === 'history') {
        loadHistoryFromDb();
    } else if (tabId === 'analysis') {
        renderAnalysis();
    }
}



// Initialize All UI Event Listeners
function initEventListeners() {
    // Navigation Links
    document.getElementById('nav-calc-btn')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('calculator'); });
    document.getElementById('nav-advanced-btn')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('advanced-calc'); });
    document.getElementById('nav-history-btn')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('history'); });
    document.getElementById('nav-analysis-btn')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('analysis'); });

    document.getElementById('mob-calc-btn')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('calculator'); });
    document.getElementById('mob-advanced-btn')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('advanced-calc'); });
    document.getElementById('mob-history-btn')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('history'); });
    document.getElementById('mob-analysis-btn')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('analysis'); });

    // Radio toggle for calculation method
    document.querySelectorAll('input[name="calc-method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.calculationMethod = e.target.value;
            toggleCalculatorMode();
            render();
        });
    });
    // Initial mode layout setup
    toggleCalculatorMode();

    // Add Course Row
    dom.addSubjectBtn?.addEventListener('click', () => {
        addSubject(state.activeSemester);
    });

    // Reset Current Result (header button & bottom button)
    dom.resetBtn?.addEventListener('click', () => {
        resetCurrentResult();
    });
    document.getElementById('reset-btn-bottom')?.addEventListener('click', () => {
        resetCurrentResult();
    });

    // Semester Tabs switching
    document.querySelectorAll('.sem-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.sem-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            state.activeSemester = e.target.getAttribute('data-sem');
            render();
        });
    });

    // Custom CGPA Checkboxes
    const checkboxes = [dom.checkSem1, dom.checkSem2, dom.checkSem3, dom.checkSem4];
    checkboxes.forEach(chk => {
        chk?.addEventListener('change', (e) => {
            const sem = e.target.getAttribute('data-sem');
            state.selectedSemesters[sem] = e.target.checked;
            calculateAndRefresh();
        });
    });

    // Custom analysis actions
    dom.analysisSelectAll?.addEventListener('click', () => {
        setAllCheckboxes(true);
    });

    dom.analysisClearAll?.addEventListener('click', () => {
        setAllCheckboxes(false);
    });

    // Print analysis trigger
    dom.printAnalysisBtn?.addEventListener('click', () => {
        window.print();
    });

    // + New Student button (Creates a new Student Profile)
    document.getElementById('btn-new-student')?.addEventListener('click', () => {
        handleNewStudent();
    });

    // + New Result button (Creates a new result calculation under active Student Profile)
    if (dom.btnNewResult) {
        dom.btnNewResult.addEventListener('click', () => {
            handleNewResult();
        });
    }

    // Save Result to History button (overwrites existing calculation if editing)
    if (dom.btnSaveToHistory) {
        dom.btnSaveToHistory.addEventListener('click', () => {
            saveCurrentToHistory(false);
        });
    }

    // Save as New button (creates a new calculation under current profile)
    if (dom.btnSaveAsNew) {
        dom.btnSaveAsNew.addEventListener('click', () => {
            saveCurrentToHistory(true);
        });
    }

    // Student Profile Name Input
    if (dom.calcStudentName) {
        dom.calcStudentName.addEventListener('input', () => {
            const nameVal = dom.calcStudentName.value.trim();
            state.currentProfile.studentName = nameVal;
            state.currentCalculation.isDirty = true;
            if (dom.currentProfileDisplayBadge) dom.currentProfileDisplayBadge.textContent = nameVal || 'No Student Selected';
            triggerAutoSave();
        });
    }

    // Result Nickname Input
    if (dom.calcResultNickname) {
        dom.calcResultNickname.addEventListener('input', () => {
            state.currentCalculation.resultNickname = dom.calcResultNickname.value;
            state.currentCalculation.isDirty = true;
            triggerAutoSave();
        });
    }

    // Program change — reload courses
    if (dom.calcProgramSelect) {
        dom.calcProgramSelect.addEventListener('change', () => {
            state.currentProfile.program = dom.calcProgramSelect.value;
            applyPredefinedCourses();
            calculateAndRefresh();
            render();
            state.currentCalculation.isDirty = true;
            triggerAutoSave();
        });
    }

    // Department change — confirm then reload courses
    if (dom.calcDepartmentSelect) {
        dom.calcDepartmentSelect.addEventListener('change', () => {
            const hasGrades = Object.values(state.semesters).some(arr =>
                arr.some(c => c.grade !== '' && c.grade !== null)
            );
            const doChange = () => {
                state.currentProfile.department = dom.calcDepartmentSelect.value;
                ['sem1', 'sem2', 'sem3', 'sem4'].forEach(s => { state.semesters[s] = []; });
                applyPredefinedCourses();
                calculateAndRefresh();
                render();
                state.currentCalculation.isDirty = true;
                triggerAutoSave();
            };
            if (hasGrades) {
                showConfirmModal(
                    'Changing department will reload the predefined courses. Any grades you have entered will be cleared. Continue?',
                    doChange,
                    () => {
                        dom.calcDepartmentSelect.value = state.currentProfile.department;
                    }
                );
            } else {
                doChange();
            }
        });
    }

    // Normal vs Advanced mode toggle (Lock Predefined Courses)
    if (dom.calcLockStructure) {
        dom.calcLockStructure.addEventListener('change', () => {
            state.currentCalculation.mode = dom.calcLockStructure.checked ? 'normal' : 'advanced';
            renderSubjectRows();
            triggerAutoSave();
        });
    }
}



// -------------------------------------------------------------
// CORE DYNAMIC RENDER FUNCTIONS
// -------------------------------------------------------------

// Main render orchestrator — calculateAndRefresh() internally calls renderDashboard()
function render() {
    renderSubjectRows();
    calculateAndRefresh();
}

// Render dynamic rows of the active semester
function renderSubjectRows() {
    const courses = state.semesters[state.activeSemester];
    dom.subjectRowsContainer.innerHTML = '';

    if (courses.length === 0) {
        dom.emptyStateMessage.style.display = 'block';
        dom.semOverviewPanel.style.display = 'none';
        return;
    }

    dom.emptyStateMessage.style.display = 'none';
    dom.semOverviewPanel.style.display = 'block';

    const isGradeMode = state.calculationMethod === 'grade';
    const lockStructure = dom.calcLockStructure?.checked ?? true;
    const predefinedCourses = getPredefinedCoursesForActiveSemester();

    courses.forEach(course => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', course.id);
        tr.style.cursor = 'pointer';

        const isPredefined = predefinedCourses.some(pre => pre.code.toUpperCase() === course.code.toUpperCase());
        const readonlyAttr = (lockStructure && isPredefined) ? 'readonly style="background-color: var(--neutral-light); cursor: not-allowed;"' : '';
        const disabledAttr = (lockStructure && isPredefined) ? 'disabled style="background-color: var(--neutral-light); cursor: not-allowed;"' : '';
        const removeBtnHtml = (lockStructure && isPredefined)
            ? `<button type="button" class="btn-remove" style="visibility: hidden; pointer-events: none;">&times;</button>`
            : `<button type="button" class="btn-remove" aria-label="Remove subject">&times;</button>`;

        if (isGradeMode) {
            tr.innerHTML = `
                <td data-label="Course" class="course-cell">
                    <input type="text" class="input-code" placeholder="Course Code" value="${course.code}" ${readonlyAttr}>
                </td>
                <td data-label="Subject" class="subject-cell">
                    <input type="text" class="input-subject" placeholder="Subject Name" value="${course.subject || ''}" ${readonlyAttr}>
                </td>
                <td data-label="Type" class="type-cell">
                    <select class="select-type" ${disabledAttr}>
                        <option value="">Select Type</option>
                        <option value="Theory" ${course.courseType === 'Theory' ? 'selected' : ''}>Theory</option>
                        <option value="Other" ${course.courseType === 'Other' ? 'selected' : ''}>Other than Theory</option>
                    </select>
                </td>
                <td data-label="Obtained" class="obtained-cell">
                    <input type="number" step="any" class="input-marks input-obtained" placeholder="Obt" value="${course.obtainedMarks === null ? '' : course.obtainedMarks}" ${readonlyAttr}>
                </td>
                <td data-label="Max" class="max-cell">
                    <input type="number" step="any" class="input-marks input-max" placeholder="Max" value="${course.maximumMarks === null ? '' : course.maximumMarks}" ${readonlyAttr}>
                </td>
                <td data-label="Credits" class="credits-cell">
                    <input type="number" step="any" class="input-credits" placeholder="Cr" value="${course.credits === null ? '' : course.credits}" ${readonlyAttr}>
                </td>
                <td data-label="Grade" class="grade-cell">
                    <select class="select-grade">
                        <option value="">Select Grade</option>
                        <option value="AA" ${course.grade === 'AA' ? 'selected' : ''}>AA</option>
                        <option value="AB" ${course.grade === 'AB' ? 'selected' : ''}>AB</option>
                        <option value="BB" ${course.grade === 'BB' ? 'selected' : ''}>BB</option>
                        <option value="BC" ${course.grade === 'BC' ? 'selected' : ''}>BC</option>
                        <option value="CC" ${course.grade === 'CC' ? 'selected' : ''}>CC</option>
                        <option value="CD" ${course.grade === 'CD' ? 'selected' : ''}>CD</option>
                        <option value="DD" ${course.grade === 'DD' ? 'selected' : ''}>DD</option>
                        <option value="F" ${course.grade === 'F' ? 'selected' : ''}>F</option>
                        <option value="W" ${course.grade === 'W' ? 'selected' : ''}>W</option>
                        <option value="PP" ${course.grade === 'PP' ? 'selected' : ''}>PP</option>
                        <option value="NP" ${course.grade === 'NP' ? 'selected' : ''}>NP</option>
                        <option value="AU" ${course.grade === 'AU' ? 'selected' : ''}>AU</option>
                        <option value="Satisfactory" ${course.grade === 'Satisfactory' ? 'selected' : ''}>Satisfactory</option>
                        <option value="Unsatisfactory" ${course.grade === 'Unsatisfactory' ? 'selected' : ''}>Unsatisfactory</option>
                        <option value="I" ${course.grade === 'I' ? 'selected' : ''}>I</option>
                    </select>
                </td>
                <td data-label="GP" class="gp-cell grade-point-display">—</td>
                <td data-label="Status" class="status-cell" style="text-align: center;"><span class="status-text">Incomplete</span></td>
                <td data-label="Action" class="remove-cell" style="text-align: center;">
                    ${removeBtnHtml}
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td data-label="Course" class="course-cell">
                    <input type="text" class="input-code" placeholder="Course Code" value="${course.code}" ${readonlyAttr}>
                </td>
                <td data-label="Subject" class="subject-cell">
                    <input type="text" class="input-subject" placeholder="Subject Name" value="${course.subject || ''}" ${readonlyAttr}>
                </td>
                <td data-label="Type" class="type-cell">
                    <select class="select-type" ${disabledAttr}>
                        <option value="">Select Course Type</option>
                        <option value="Theory" ${course.courseType === 'Theory' ? 'selected' : ''}>Theory</option>
                        <option value="Other" ${course.courseType === 'Other' ? 'selected' : ''}>Other than Theory</option>
                    </select>
                </td>
                <td data-label="Obtained" class="obtained-cell">
                    <input type="number" step="any" class="input-marks input-obtained" placeholder="Obtained" value="${course.obtainedMarks === null ? '' : course.obtainedMarks}">
                </td>
                <td data-label="Max" class="max-cell">
                    <input type="number" step="any" class="input-marks input-max" placeholder="Max" value="${course.maximumMarks === null ? '' : course.maximumMarks}">
                </td>
                <td data-label="Credits" class="credits-cell">
                    <input type="number" step="any" class="input-credits" placeholder="Credits" value="${course.credits === null ? '' : course.credits}" ${readonlyAttr}>
                </td>
                <td data-label="Grade" class="grade-cell">
                    <select class="select-grade" ${course.gradeSource === 'Calculated from Marks' ? 'disabled' : ''}>
                        <option value="">Select Grade</option>
                        <option value="AA" ${course.grade === 'AA' ? 'selected' : ''}>AA</option>
                        <option value="AB" ${course.grade === 'AB' ? 'selected' : ''}>AB</option>
                        <option value="BB" ${course.grade === 'BB' ? 'selected' : ''}>BB</option>
                        <option value="BC" ${course.grade === 'BC' ? 'selected' : ''}>BC</option>
                        <option value="CC" ${course.grade === 'CC' ? 'selected' : ''}>CC</option>
                        <option value="CD" ${course.grade === 'CD' ? 'selected' : ''}>CD</option>
                        <option value="DD" ${course.grade === 'DD' ? 'selected' : ''}>DD</option>
                        <option value="F" ${course.grade === 'F' ? 'selected' : ''}>F</option>
                        <option value="W" ${course.grade === 'W' ? 'selected' : ''}>W</option>
                        <option value="PP" ${course.grade === 'PP' ? 'selected' : ''}>PP</option>
                        <option value="NP" ${course.grade === 'NP' ? 'selected' : ''}>NP</option>
                        <option value="AU" ${course.grade === 'AU' ? 'selected' : ''}>AU</option>
                        <option value="Satisfactory" ${course.grade === 'Satisfactory' ? 'selected' : ''}>Satisfactory</option>
                        <option value="Unsatisfactory" ${course.grade === 'Unsatisfactory' ? 'selected' : ''}>Unsatisfactory</option>
                        <option value="I" ${course.grade === 'I' ? 'selected' : ''}>I</option>
                    </select>
                </td>
                <td data-label="GP" class="gp-cell grade-point-display">—</td>
                <td data-label="Status" class="status-cell" style="text-align: center;"><span class="status-text">Incomplete</span></td>
                <td data-label="Action" class="remove-cell" style="text-align: center;">
                    ${removeBtnHtml}
                </td>
            `;
        }

        // Bind event listeners using selector queries to prevent layout/index mismatches
        const inputCode = tr.querySelector('.input-code');
        if (inputCode) {
            inputCode.addEventListener('input', (e) => {
                updateCourse(course.id, 'code', e.target.value);
            });
        }

        const inputSubject = tr.querySelector('.input-subject');
        if (inputSubject) {
            inputSubject.addEventListener('input', (e) => {
                updateCourse(course.id, 'subject', e.target.value);
            });
        }

        const selectType = tr.querySelector('.select-type');
        if (selectType) {
            selectType.addEventListener('change', (e) => {
                updateCourse(course.id, 'courseType', e.target.value);
            });
        }

        const inputObtained = tr.querySelector('.input-obtained');
        if (inputObtained) {
            inputObtained.addEventListener('input', (e) => {
                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                updateCourse(course.id, 'obtainedMarks', val);
            });
        }

        const inputMax = tr.querySelector('.input-max');
        if (inputMax) {
            inputMax.addEventListener('input', (e) => {
                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                updateCourse(course.id, 'maximumMarks', val);
            });
        }

        const inputCredits = tr.querySelector('.input-credits');
        if (inputCredits) {
            inputCredits.addEventListener('input', (e) => {
                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                updateCourse(course.id, 'credits', val);
            });
        }

        const selectGrade = tr.querySelector('.select-grade');
        if (selectGrade) {
            selectGrade.addEventListener('change', (e) => {
                updateCourse(course.id, 'grade', e.target.value);
            });
        }

        const btnRemove = tr.querySelector('.btn-remove');
        if (btnRemove) {
            btnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                removeSubject(course.id);
            });
        }

        tr.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && !e.target.classList.contains('btn-remove')) {
                openSubjectDetailModal(course.id);
            }
        });

        dom.subjectRowsContainer.appendChild(tr);
        updateRowDOM(course.id);
    });
}

// Add Subject Row
function addSubject(semId) {
    const newCourse = {
        id: 'course_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        code: '',
        subject: '',
        courseType: '', 
        obtainedMarks: null,
        maximumMarks: null,
        credits: null,
        grade: '',
        gradeSource: '', 
        manualGrade: '', 
        attemptType: 'original', 
        parentCourseId: '',
        documentType: '',
        source: 'manual',
        confidence: {}
    };
    state.semesters[semId].push(newCourse);
    render();
}

// Remove Subject Row
function removeSubject(courseId) {
    const courses = state.semesters[state.activeSemester];
    state.semesters[state.activeSemester] = courses.filter(c => c.id !== courseId);
    render();
}

// Update values in courses
function updateCourse(courseId, field, value) {
    const course = state.semesters[state.activeSemester].find(c => c.id === courseId);
    if (course) {
        course[field] = value;
        if (field === 'grade') {
            course.manualGrade = value;
        }
        recalculateCourseGrade(course);
        updateRowDOM(courseId);
        calculateAndRefresh();
    }
}

// Recalculate dynamic grade values based on marks completeness and manual grades
function recalculateCourseGrade(course) {
    if (course.source === 'imported' || course.source === 'document') {
        return; // Do not overwrite imported grades
    }

    if (state.calculationMethod === 'marks') {
        const hasType = course.courseType !== '';
        const hasObtained = course.obtainedMarks !== null && !isNaN(course.obtainedMarks);
        const hasMax = course.maximumMarks !== null && !isNaN(course.maximumMarks);

        if (hasType && hasObtained && hasMax) {
            const calc = calculateGradeFromMarks(course.courseType, course.obtainedMarks, course.maximumMarks);
            if (calc && !calc.error) {
                course.grade = calc.grade;
                course.gradeSource = 'Calculated from Marks';
                return;
            }
        }
    }

    if (course.manualGrade !== '') {
        course.grade = course.manualGrade;
        course.gradeSource = 'Manual Grade';
    } else {
        course.grade = '';
        course.gradeSource = '';
    }
}

// Helper calculation mapping for obtained marks
function calculateGradeFromMarks(courseType, obtained, max) {
    if (courseType === '' || obtained === null || max === null) {
        return null;
    }
    if (obtained < 0 || max <= 0 || obtained > max) {
        return { error: 'Obtained marks cannot be greater than maximum marks.' };
    }

    const normalized = (obtained / max) * 100;
    const rounded = Math.round(normalized);

    let grade = 'F';
    let gp = 0;

    if (courseType === 'Theory') {
        const match = THEORY_GRADING.find(r => rounded >= r.min && rounded <= r.max);
        if (match) {
            grade = match.grade;
            gp = match.gp;
        }
    } else if (courseType === 'Other') {
        const match = OTHER_GRADING.find(r => rounded >= r.min && rounded <= r.max);
        if (match) {
            grade = match.grade;
            gp = match.gp;
        }
    }

    return {
        normalized: normalized.toFixed(2),
        rounded,
        grade,
        gp
    };
}

// Update specific row's warning messages and grade point dynamically in the DOM
function updateRowDOM(courseId) {
    const course = state.semesters[state.activeSemester].find(c => c.id === courseId);
    if (!course) return;

    const tr = document.querySelector(`tr[data-id="${courseId}"]`);
    if (!tr) return;

    // 1. Course Code Warning
    const tdCode = tr.querySelector('.course-cell');
    if (tdCode) {
        let codeWarn = tdCode.querySelector('.validation-warning');
        if (course.code.trim() === '') {
            if (!codeWarn) {
                codeWarn = document.createElement('span');
                codeWarn.className = 'validation-warning';
                codeWarn.textContent = 'Course identification recommended.';
                tdCode.appendChild(codeWarn);
            }
        } else {
            if (codeWarn) codeWarn.remove();
        }
    }

    // 2. Course Type Warning (only in Marks mode)
    const tdType = tr.querySelector('.type-cell');
    if (tdType) {
        let typeWarn = tdType.querySelector('.validation-warning');
        const hasObtained = course.obtainedMarks !== null && !isNaN(course.obtainedMarks);
        const hasMax = course.maximumMarks !== null && !isNaN(course.maximumMarks);
        if (course.courseType === '' && (hasObtained || hasMax)) {
            if (!typeWarn) {
                typeWarn = document.createElement('span');
                typeWarn.className = 'validation-warning';
                typeWarn.textContent = 'Select course type to calculate.';
                tdType.appendChild(typeWarn);
            }
        } else {
            if (typeWarn) typeWarn.remove();
        }
    }

    // 3. Obtained Marks Warning & Subtext (only in Marks mode)
    const tdObtained = tr.querySelector('.obtained-cell');
    if (tdObtained) {
        let obtainedWarn = tdObtained.querySelector('.validation-warning');
        let subtext = tdObtained.querySelector('.normalized-subtext');

        if (course.obtainedMarks !== null && course.obtainedMarks < 0) {
            if (!obtainedWarn) {
                obtainedWarn = document.createElement('span');
                obtainedWarn.className = 'validation-warning';
                tdObtained.appendChild(obtainedWarn);
            }
            obtainedWarn.textContent = 'Obtained marks cannot be negative.';
        } else if (course.obtainedMarks !== null && course.maximumMarks !== null && course.obtainedMarks > course.maximumMarks) {
            if (!obtainedWarn) {
                obtainedWarn = document.createElement('span');
                obtainedWarn.className = 'validation-warning';
                tdObtained.appendChild(obtainedWarn);
            }
            obtainedWarn.textContent = 'Obtained marks cannot exceed max marks.';
        } else {
            if (obtainedWarn) obtainedWarn.remove();
        }

        const calc = calculateGradeFromMarks(course.courseType, course.obtainedMarks, course.maximumMarks);
        if (calc && !calc.error) {
            if (!subtext) {
                subtext = document.createElement('span');
                subtext.className = 'normalized-subtext';
                tdObtained.appendChild(subtext);
            }
            subtext.innerHTML = `Raw: ${calc.normalized} | Round: ${calc.rounded}`;
        } else {
            if (subtext) subtext.remove();
        }
    }

    // 4. Maximum Marks Warning (only in Marks mode)
    const tdMax = tr.querySelector('.max-cell');
    if (tdMax) {
        let maxWarn = tdMax.querySelector('.validation-warning');
        if (course.maximumMarks !== null && course.maximumMarks <= 0) {
            if (!maxWarn) {
                maxWarn = document.createElement('span');
                maxWarn.className = 'validation-warning';
                tdMax.appendChild(maxWarn);
            }
            maxWarn.textContent = 'Maximum marks must be greater than 0.';
        } else if (course.obtainedMarks !== null && course.maximumMarks === null) {
            if (!maxWarn) {
                maxWarn = document.createElement('span');
                maxWarn.className = 'validation-warning';
                tdMax.appendChild(maxWarn);
            }
            maxWarn.textContent = 'Enter max marks.';
        } else if (course.obtainedMarks === null && course.maximumMarks !== null) {
            if (!maxWarn) {
                maxWarn = document.createElement('span');
                maxWarn.className = 'validation-warning';
                tdMax.appendChild(maxWarn);
            }
            maxWarn.textContent = 'Enter obtained marks.';
        } else {
            if (maxWarn) maxWarn.remove();
        }
    }

    // 5. Credits Warning
    const tdCredits = tr.querySelector('.credits-cell');
    if (tdCredits) {
        let creditsWarn = tdCredits.querySelector('.validation-warning');
        if (course.credits !== null && course.credits <= 0) {
            if (!creditsWarn) {
                creditsWarn = document.createElement('span');
                creditsWarn.className = 'validation-warning';
                creditsWarn.textContent = 'Credits must be greater than 0.';
                tdCredits.appendChild(creditsWarn);
            }
        } else if (course.credits === null) {
            if (!creditsWarn) {
                creditsWarn = document.createElement('span');
                creditsWarn.className = 'validation-warning';
                creditsWarn.textContent = 'Credits must be greater than 0.';
                tdCredits.appendChild(creditsWarn);
            }
        } else {
            if (creditsWarn) creditsWarn.remove();
        }
    }

    // 6. Grade Warning
    const tdGrade = tr.querySelector('.grade-cell');
    if (tdGrade) {
        let gradeWarn = tdGrade.querySelector('.validation-warning');
        const selectGrade = tdGrade.querySelector('.select-grade');
        if (selectGrade) {
            selectGrade.value = course.grade;
        }

        const isCreditsEmptyOrInvalid = course.credits === null || isNaN(course.credits) || course.credits <= 0;
        const isGradeEmpty = course.grade === '';

        if (isCreditsEmptyOrInvalid || isGradeEmpty) {
            if (!gradeWarn) {
                gradeWarn = document.createElement('span');
                gradeWarn.className = 'validation-warning';
                tdGrade.appendChild(gradeWarn);
            }
            if (state.calculationMethod === 'grade') {
                gradeWarn.textContent = 'Enter credits and grade.';
            } else {
                gradeWarn.textContent = 'Enter type, marks and credits.';
            }
        } else {
            if (gradeWarn) gradeWarn.remove();
        }
    }

    // 7. Grade Point
    const tdGp = tr.querySelector('.gp-cell');
    if (tdGp) {
        if (course.grade !== '') {
            tdGp.textContent = GRADE_POINT_MAPPING[course.grade];
        } else {
            tdGp.textContent = '—';
        }
    }

    // 8. Status
    const tdStatus = tr.querySelector('.status-cell');
    if (tdStatus) {
        let statusSpan = tdStatus.querySelector('.status-text');
        if (!statusSpan) {
            statusSpan = document.createElement('span');
            statusSpan.className = 'status-text';
            tdStatus.appendChild(statusSpan);
        }
        statusSpan.className = 'status-text';
        
        const isCreditsEmptyOrInvalid = course.credits === null || isNaN(course.credits) || course.credits <= 0;
        const isGradeEmpty = course.grade === '';

        if (isCreditsEmptyOrInvalid || isGradeEmpty) {
            statusSpan.textContent = 'Incomplete';
            statusSpan.classList.add('status-text-incomplete');
        } else {
            // Find resolved final status for this course in dataset
            const resolvedCourse = state.resolvedFinalDataset ? state.resolvedFinalDataset.find(rc => rc.id === course.id) : null;
            if (resolvedCourse) {
                if (resolvedCourse.status === 'cleared') {
                    statusSpan.textContent = 'Cleared';
                    statusSpan.className = 'status-text status-text-passed';
                } else if (resolvedCourse.status === 'improved') {
                    statusSpan.textContent = 'Improved';
                    statusSpan.className = 'status-text status-text-passed';
                } else if (resolvedCourse.status === 'backlog') {
                    statusSpan.textContent = resolvedCourse.grade === 'W' ? 'Fail / Attendance' : 'Backlog';
                    statusSpan.className = 'status-text status-text-backlog';
                } else if (resolvedCourse.status === 'withdrawn') {
                    statusSpan.textContent = 'Fail / Attendance';
                    statusSpan.className = 'status-text status-text-backlog';
                } else {
                    if (resolvedCourse.grade === 'PP') {
                        statusSpan.textContent = 'Passed';
                        statusSpan.className = 'status-text status-text-passed';
                    } else if (resolvedCourse.grade === 'NP') {
                        statusSpan.textContent = 'Not Passed';
                        statusSpan.className = 'status-text status-text-backlog';
                    } else if (resolvedCourse.grade === 'AU') {
                        statusSpan.textContent = 'Audit';
                        statusSpan.className = 'status-text status-text-withdrawn';
                    } else if (resolvedCourse.grade === 'Satisfactory') {
                        statusSpan.textContent = 'Satisfactory';
                        statusSpan.className = 'status-text status-text-passed';
                    } else if (resolvedCourse.grade === 'Unsatisfactory') {
                        statusSpan.textContent = 'Unsatisfactory';
                        statusSpan.className = 'status-text status-text-backlog';
                    } else if (resolvedCourse.grade === 'I') {
                        statusSpan.textContent = 'Incomplete';
                        statusSpan.className = 'status-text status-text-incomplete';
                    } else {
                        statusSpan.textContent = 'Passed';
                        statusSpan.className = 'status-text status-text-passed';
                    }
                }
            } else {
                if (course.grade === 'F') {
                    statusSpan.textContent = 'Backlog';
                    statusSpan.className = 'status-text status-text-backlog';
                } else if (course.grade === 'W') {
                    statusSpan.textContent = 'Fail / Attendance';
                    statusSpan.className = 'status-text status-text-backlog';
                } else if (course.grade === 'PP') {
                    statusSpan.textContent = 'Passed';
                    statusSpan.className = 'status-text status-text-passed';
                } else if (course.grade === 'NP') {
                    statusSpan.textContent = 'Not Passed';
                    statusSpan.className = 'status-text status-text-backlog';
                } else if (course.grade === 'AU') {
                    statusSpan.textContent = 'Audit';
                    statusSpan.className = 'status-text status-text-withdrawn';
                } else if (course.grade === 'Satisfactory') {
                    statusSpan.textContent = 'Satisfactory';
                    statusSpan.className = 'status-text status-text-passed';
                } else if (course.grade === 'Unsatisfactory') {
                    statusSpan.textContent = 'Unsatisfactory';
                    statusSpan.className = 'status-text status-text-backlog';
                } else if (course.grade === 'I') {
                    statusSpan.textContent = 'Incomplete';
                    statusSpan.className = 'status-text status-text-incomplete';
                } else {
                    statusSpan.textContent = 'Passed';
                    statusSpan.className = 'status-text status-text-passed';
                }
            }
        }
    }
}

// -------------------------------------------------------------
// CALCULATIONS & RESULTS HANDLERS
// -------------------------------------------------------------

// Compute calculations and push updates to cards & sidebar summary
function calculateAndRefresh() {
    // 0. Resolve attempts chains and compile applicable dataset
    buildAttemptHistories();

    // 1. Current Active Semester calculation
    const currentSemData = calculateSemester(state.activeSemester);
    updateActiveSemesterPanel(currentSemData);

    // 2. Overall Cumulative calculation (ALL semesters combined — single source of truth)
    const overallData = calculateCombined(['sem1', 'sem2', 'sem3', 'sem4']);
    updateOverallCards(overallData, currentSemData);

    // 3. Selected Semesters calculation (based on checkboxes)
    const selectedSemsList = Object.keys(state.selectedSemesters).filter(sem => state.selectedSemesters[sem] === true);
    const selectedData = calculateCombined(selectedSemsList);
    updateSelectedCards(selectedData);

    // 4. Render Sidebar Semester Summary grid
    renderSemesterSummaryTable();

    // 5. Render repeated attempts link warning indicators and accordion rows
    renderLinkWarnings();
    renderAttemptHistoryTable();

    // 6. Sync Academic Analysis Dashboard — must always reflect current state
    renderDashboard();

    // 7. Sync Result Analyzer Workbench — single source of truth
    if (typeof renderAnalyzerWorkbench === 'function') {
        renderAnalyzerWorkbench();
    }
}

// Calculate individual semester data using final resolved dataset
function calculateSemester(semId) {
    const courses = state.semesters[semId] || [];
    let totalCredits = 0;
    let sumWeight = 0;
    let backlogs = 0;

    const validCourses = courses.filter(c => c.credits !== null && c.credits > 0 && c.grade !== '');
    const nonGpa = ['PP', 'NP', 'AU', 'Satisfactory', 'Unsatisfactory', 'I'];
    const gpaCourses = validCourses.filter(c => !nonGpa.includes(c.grade));

    gpaCourses.forEach(c => {
        totalCredits += c.credits;
        const gp = GRADE_POINT_MAPPING[c.grade] || 0;
        sumWeight += (c.credits * gp);
    });

    validCourses.forEach(c => {
        if (c.grade === 'F' || c.grade === 'W') {
            backlogs++;
        }
    });

    const sgpa = totalCredits > 0 ? (sumWeight / totalCredits) : null;
    const percentage = sgpa !== null ? (sgpa * 10) : null;

    let status = '—';
    if (validCourses.length > 0) {
        status = backlogs > 0 ? 'Backlog' : 'Passed';
    }

    return {
        totalCredits,
        totalGradePoints: sumWeight,
        sgpa,
        percentage,
        backlogs,
        status,
        hasData: state.semesters[semId].length > 0,
        hasValidData: validCourses.length > 0
    };
}

// Calculate credit-weighted combined performance across selected semesters using final resolved dataset
function calculateCombined(semesterKeys) {
    if (semesterKeys.length === 0) {
        return {
            cgpa: null,
            percentage: null,
            totalCredits: 0,
            backlogs: 0,
            hasValidData: false
        };
    }

    let totalCredits = 0;
    let sumWeight = 0;
    let totalBacklogs = 0;
    let hasValidData = false;

    semesterKeys.forEach(semKey => {
        const courses = state.semesters[semKey] || [];
        const validCourses = courses.filter(c => c.credits !== null && c.credits > 0 && c.grade !== '');
        const nonGpa = ['PP', 'NP', 'AU', 'Satisfactory', 'Unsatisfactory', 'I'];
        const gpaCourses = validCourses.filter(c => !nonGpa.includes(c.grade));

        gpaCourses.forEach(c => {
            totalCredits += c.credits;
            const gp = GRADE_POINT_MAPPING[c.grade] || 0;
            sumWeight += (c.credits * gp);
            hasValidData = true;
        });

        validCourses.forEach(c => {
            if (c.grade === 'F' || c.grade === 'W') {
                totalBacklogs++;
            }
        });
    });

    const cgpa = totalCredits > 0 ? (sumWeight / totalCredits) : null;
    const percentage = cgpa !== null ? (cgpa * 10) : null;

    return {
        cgpa,
        percentage,
        totalCredits,
        backlogs: totalBacklogs,
        hasValidData
    };
}

// -------------------------------------------------------------
// DOM UPDATER HELPERS
// -------------------------------------------------------------

// Update the quick summary calculations at the bottom of the active calculator card
function updateActiveSemesterPanel(data) {
    if (!data.hasData) {
        dom.semOverviewPanel.style.display = 'none';
        return;
    }
    
    dom.semOverviewPanel.style.display = 'block';
    dom.overviewCredits.textContent = data.totalCredits % 1 === 0 ? data.totalCredits : data.totalCredits.toFixed(2);
    dom.overviewPoints.textContent = data.totalGradePoints % 1 === 0 ? data.totalGradePoints : data.totalGradePoints.toFixed(2);
    dom.overviewSgpa.textContent = data.sgpa !== null ? data.sgpa.toFixed(2) : '—';
    dom.overviewPercentage.textContent = data.percentage !== null ? data.percentage.toFixed(2) + '%' : '—';
}

// Update the Dashboard result cards with overall & current values including attempts metrics
function updateOverallCards(overallData, currentSemData) {
    const semName = state.activeSemester.toUpperCase().replace('SEM', 'Semester ');
    dom.currentSemTitle.textContent = semName;
    dom.statusSemTitle.textContent = semName;

    // Current SGPA Card
    if (currentSemData.sgpa !== null) {
        dom.cardCurrentSgpa.textContent = currentSemData.sgpa.toFixed(2);
        if (state.importedDocSgpa !== null && state.importedDocSgpa !== undefined && !isNaN(state.importedDocSgpa)) {
            const isMatch = Math.abs(state.importedDocSgpa - currentSemData.sgpa) < 0.005;
            const matchText = isMatch ? '✓ Matches document' : `⚠ Does not match document (Doc: ${state.importedDocSgpa.toFixed(2)})`;
            dom.currentSgpaPct.textContent = `${currentSemData.percentage.toFixed(2)}% | ${matchText}`;
        } else {
            dom.currentSgpaPct.textContent = currentSemData.percentage.toFixed(2) + '%';
        }
    } else {
        dom.cardCurrentSgpa.textContent = '—';
        dom.currentSgpaPct.textContent = '—';
    }

    // Cumulative CGPA up to active semester
    const activeSemNum = parseInt(state.activeSemester.replace('sem', ''));
    const semsUpToActive = [];
    for (let k = 1; k <= activeSemNum; k++) {
        semsUpToActive.push('sem' + k);
    }
    const cumulativeActiveData = calculateCombined(semsUpToActive);

    // Overall CGPA Card
    if (state.activeSemester === 'sem1') {
        dom.cardOverallCgpa.textContent = '—';
        dom.overallCgpaPct.textContent = 'N/A (Sem 1)';
        if (dom.cardPercentage) {
            dom.cardPercentage.textContent = '—';
        }
    } else {
        if (cumulativeActiveData.cgpa !== null) {
            dom.cardOverallCgpa.textContent = cumulativeActiveData.cgpa.toFixed(2);
            if (state.importedDocCgpa !== null && state.importedDocCgpa !== undefined && !isNaN(state.importedDocCgpa)) {
                const isMatch = Math.abs(state.importedDocCgpa - cumulativeActiveData.cgpa) < 0.005;
                const matchText = isMatch ? '✓ Matches document' : `⚠ Does not match document (Doc: ${state.importedDocCgpa.toFixed(2)})`;
                dom.overallCgpaPct.textContent = `${cumulativeActiveData.percentage.toFixed(2)}% | ${matchText}`;
            } else {
                dom.overallCgpaPct.textContent = cumulativeActiveData.percentage.toFixed(2) + '%';
            }
        } else {
            dom.cardOverallCgpa.textContent = '—';
            dom.overallCgpaPct.textContent = '—';
        }

        // Percentage Card (new top-row card)
        if (dom.cardPercentage) {
            dom.cardPercentage.textContent = cumulativeActiveData.percentage !== null 
                ? cumulativeActiveData.percentage.toFixed(2) + '%' 
                : '—';
        }
    }

    // Total Credits Card (Across all entered semesters)
    dom.cardTotalCredits.textContent = overallData.totalCredits > 0 
        ? (overallData.totalCredits % 1 === 0 ? overallData.totalCredits : overallData.totalCredits.toFixed(2)) 
        : '—';

    // Gather raw courses list and resolved list
    const rawCourses = [];
    Object.keys(state.semesters).forEach(semKey => {
        rawCourses.push(...state.semesters[semKey]);
    });

    const resolvedCourses = state.resolvedFinalDataset || [];
    const hasAnyCourses = rawCourses.length > 0;

    const domActiveBacklogs = document.getElementById('card-active-backlogs');
    const domActiveBacklogsFooter = document.getElementById('card-active-backlogs-footer');
    const domClearedBacklogs = document.getElementById('card-cleared-backlogs');
    const domSuppAttempts = document.getElementById('card-supp-attempts');
    const domReexamAttempts = document.getElementById('card-reexam-attempts');
    const domImproveAttempts = document.getElementById('card-improve-attempts');
    const domWithdrawnCourses = document.getElementById('card-withdrawn-courses');

    if (!hasAnyCourses) {
        if (domActiveBacklogs) domActiveBacklogs.textContent = '—';
        if (domActiveBacklogsFooter) {
            domActiveBacklogsFooter.textContent = 'No courses evaluated yet.';
            domActiveBacklogsFooter.style.color = 'var(--text-muted)';
        }
        if (domClearedBacklogs) domClearedBacklogs.textContent = '—';
        if (domSuppAttempts) domSuppAttempts.textContent = '—';
        if (domReexamAttempts) domReexamAttempts.textContent = '—';
        if (domImproveAttempts) domImproveAttempts.textContent = '—';
        if (domWithdrawnCourses) domWithdrawnCourses.textContent = '—';
    } else {
        // Active Backlogs: resolved courses with F or W grade
        const activeBacklogs = resolvedCourses.filter(c => c.grade === 'F' || c.grade === 'W').length;
        if (domActiveBacklogs) domActiveBacklogs.textContent = activeBacklogs;
        if (domActiveBacklogsFooter) {
            if (activeBacklogs > 0) {
                domActiveBacklogsFooter.textContent = `${activeBacklogs} unresolved backlog course(s)`;
                domActiveBacklogsFooter.style.color = 'var(--danger)';
            } else {
                domActiveBacklogsFooter.textContent = 'All cleared. No active backlogs.';
                domActiveBacklogsFooter.style.color = 'var(--success)';
            }
        }

        // Cleared Backlogs: resolved status cleared
        const clearedBacklogs = resolvedCourses.filter(c => c.status === 'cleared').length;
        if (domClearedBacklogs) domClearedBacklogs.textContent = clearedBacklogs > 0 ? clearedBacklogs : 'No records';

        // Supplementary: count in raw courses
        const suppAttempts = rawCourses.filter(c => c.attemptType === 'supplementary').length;
        if (domSuppAttempts) domSuppAttempts.textContent = suppAttempts > 0 ? suppAttempts : 'No records';

        // Re-examinations: count in raw courses
        const reexamAttempts = rawCourses.filter(c => c.attemptType === 're-examination').length;
        if (domReexamAttempts) domReexamAttempts.textContent = reexamAttempts > 0 ? reexamAttempts : 'No records';

        // Improvements: count in raw courses
        const improveAttempts = rawCourses.filter(c => c.attemptType === 'improvement').length;
        if (domImproveAttempts) domImproveAttempts.textContent = improveAttempts > 0 ? improveAttempts : 'No records';

        // Withdrawn: resolved W grades
        const withdrawnCourses = resolvedCourses.filter(c => c.grade === 'W').length;
        if (domWithdrawnCourses) domWithdrawnCourses.textContent = withdrawnCourses > 0 ? withdrawnCourses : 'No records';
    }
}

// Update custom selection result cards
function updateSelectedCards(selectedData) {
    const selectedCreditsEl = document.getElementById('selected-credits');
    if (selectedData.cgpa !== null) {
        dom.cardSelectedCgpa.textContent = selectedData.cgpa.toFixed(2);
        dom.selectedCgpaPct.textContent = selectedData.percentage.toFixed(2) + '%';
        if (selectedCreditsEl) {
            selectedCreditsEl.textContent = selectedData.totalCredits % 1 === 0 ? selectedData.totalCredits : selectedData.totalCredits.toFixed(2);
        }
    } else {
        dom.cardSelectedCgpa.textContent = '—';
        dom.selectedCgpaPct.textContent = '—';
        if (selectedCreditsEl) {
            selectedCreditsEl.textContent = '—';
        }
    }
}

// Render dynamic semester summaries on the sidebar
function renderSemesterSummaryTable() {
    dom.summaryRowsContainer.innerHTML = '';
    let hasSummaryData = false;

    for (let i = 1; i <= 4; i++) {
        const semKey = 'sem' + i;
        const semName = 'Semester ' + i;
        const semData = calculateSemester(semKey);

        if (semData.hasData) {
            hasSummaryData = true;
            const tr = document.createElement('tr');
            
            // Name
            const tdName = document.createElement('td');
            tdName.textContent = semName;
            tr.appendChild(tdName);

            // Credits
            const tdCredits = document.createElement('td');
            tdCredits.textContent = semData.totalCredits % 1 === 0 ? semData.totalCredits : semData.totalCredits.toFixed(2);
            tr.appendChild(tdCredits);

            // SGPA
            const tdSgpa = document.createElement('td');
            tdSgpa.textContent = semData.sgpa !== null ? semData.sgpa.toFixed(2) : '—';
            tr.appendChild(tdSgpa);

            // CGPA
            const tdCgpa = document.createElement('td');
            if (i === 1) {
                tdCgpa.textContent = '—';
            } else {
                const semsUpToI = [];
                for (let k = 1; k <= i; k++) {
                    semsUpToI.push('sem' + k);
                }
                const cumulative = calculateCombined(semsUpToI);
                tdCgpa.textContent = cumulative.cgpa !== null ? cumulative.cgpa.toFixed(2) : '—';
            }
            tr.appendChild(tdCgpa);

            // Backlogs
            const tdBack = document.createElement('td');
            tdBack.textContent = semData.backlogs;
            tr.appendChild(tdBack);

            // Status Badge
            const tdStatus = document.createElement('td');
            const statusSpan = document.createElement('span');
            
            if (semData.hasValidData) {
                statusSpan.className = semData.status === 'Passed' ? 'status-badge status-passed' : 'status-badge status-backlog';
                statusSpan.textContent = semData.status;
            } else {
                statusSpan.className = 'status-badge';
                statusSpan.style.backgroundColor = 'var(--neutral-light)';
                statusSpan.style.color = 'var(--text-muted)';
                statusSpan.textContent = 'Incomplete';
            }
            tdStatus.appendChild(statusSpan);
            tr.appendChild(tdStatus);

            dom.summaryRowsContainer.appendChild(tr);
        }
    }

    if (hasSummaryData) {
        dom.summaryEmptyMessage.style.display = 'none';
    } else {
        dom.summaryEmptyMessage.style.display = 'block';
    }
    const summaryTable = document.querySelector('.summary-table');
    if (summaryTable) {
        summaryTable.style.display = hasSummaryData ? 'table' : 'none';
    }
}

// -------------------------------------------------------------
// CHECKBOX SELECTION HELPERS
// -------------------------------------------------------------

// Select or clear all checkbox values for custom analysis
function setAllCheckboxes(checkedState) {
    Object.keys(state.selectedSemesters).forEach(key => {
        state.selectedSemesters[key] = checkedState;
    });

    dom.checkSem1.checked = checkedState;
    dom.checkSem2.checked = checkedState;
    dom.checkSem3.checked = checkedState;
    dom.checkSem4.checked = checkedState;

    calculateAndRefresh();
}

// -------------------------------------------------------------
// RESET ACTIONS
// -------------------------------------------------------------

// Completely reset state
function resetCalculator() {
    // Reset calculation method
    state.calculationMethod = 'grade';
    const gradeRadio = document.querySelector('input[name="calc-method"][value="grade"]');
    if (gradeRadio) gradeRadio.checked = true;
    toggleCalculatorMode();

    // Reset semesters course lists
    state.semesters.sem1 = [];
    state.semesters.sem2 = [];
    state.semesters.sem3 = [];
    state.semesters.sem4 = [];

    // Reset checkbox selections
    state.selectedSemesters.sem1 = false;
    state.selectedSemesters.sem2 = false;
    state.selectedSemesters.sem3 = false;
    state.selectedSemesters.sem4 = false;

    // Reset imported metrics
    state.importedDocSgpa = null;
    state.importedDocCgpa = null;

    // Reset attempt links and history
    state.attemptHistories = [];
    state.resolvedFinalDataset = [];
    state.unlinkedRepeats = [];
    state.ignoredRepeats = [];

    // Reset extraction session
    state.extractionSession.file = null;
    state.extractionSession.status = 'empty';
    state.extractionSession.extractedSubjects = [];
    dom.fileInput.value = '';
    showExtractionState();

    // Reset DOM inputs
    dom.checkSem1.checked = false;
    dom.checkSem2.checked = false;
    dom.checkSem3.checked = false;
    dom.checkSem4.checked = false;

    // Reset Dashboard filters
    if (dom.filterSemester) dom.filterSemester.value = 'all';
    if (dom.filterStatus) dom.filterStatus.value = 'all';
    if (dom.filterGrade) dom.filterGrade.value = 'all';

    // Reset to sem1 active view
    state.activeSemester = 'sem1';
    
    // Set tabs visually
    document.querySelectorAll('.sem-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const sem1Tab = document.getElementById('tab-sem1');
    if (sem1Tab) sem1Tab.classList.add('active');

    // Full UI redraw
    render();
}


// ==============================================================
// PART 3: RESULT ANALYZER LOGIC
// ==============================================================

// File Drag and Drop Event Listeners
function initAnalyzerEvents() {
    if (dom.uploadDropzone) {
        dom.uploadDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dom.uploadDropzone.classList.add('drag-over');
        });

        dom.uploadDropzone.addEventListener('dragleave', () => {
            dom.uploadDropzone.classList.remove('drag-over');
        });

        dom.uploadDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dom.uploadDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });

        dom.uploadDropzone.addEventListener('click', () => {
            if (dom.fileInput) dom.fileInput.click();
        });
    }

    if (dom.fileInput) {
        dom.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });
    }

    if (dom.removeFileBtn) {
        dom.removeFileBtn.addEventListener('click', () => {
            removeUploadedFile();
        });
    }

    if (dom.analyzeBtn) {
        dom.analyzeBtn.addEventListener('click', () => {
            analyzeDocument();
        });
    }

    if (dom.addVerificationRowBtn) {
        dom.addVerificationRowBtn.addEventListener('click', () => {
            addExtractedSubject();
        });
    }

    if (dom.confirmImportBtn) {
        dom.confirmImportBtn.addEventListener('click', () => {
            confirmImport();
        });
    }

    if (dom.cancelExtractionBtn) {
        dom.cancelExtractionBtn.addEventListener('click', () => {
            cancelExtraction();
        });
    }

    if (dom.docSgpaInput) {
        dom.docSgpaInput.addEventListener('input', () => {
            calculateVerificationMetrics();
        });
    }
    if (dom.docCgpaInput) {
        dom.docCgpaInput.addEventListener('input', () => {
            calculateVerificationMetrics();
        });
    }

    if (dom.dupKeepExisting) {
        dom.dupKeepExisting.addEventListener('click', () => {
            resolveDuplicate('keep');
        });
    }
    if (dom.dupUseUploaded) {
        dom.dupUseUploaded.addEventListener('click', () => {
            resolveDuplicate('overwrite');
        });
    }
    if (dom.dupAddSeparate) {
        dom.dupAddSeparate.addEventListener('click', () => {
            resolveDuplicate('separate');
        });
    }
}


// Handle File upload validations
function handleFileSelection(file) {
    if (!file) return;

    // Validate size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast("File is too large. Maximum allowed size is 10 MB.", "error");
        dom.fileInput.value = '';
        return;
    }

    // Validate type (.pdf, .jpg, .jpeg, .png)
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const fileNameLower = file.name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileNameLower.endsWith(ext));
    
    if (!isValidExtension) {
        showToast("Unsupported file type.", "error");
        dom.fileInput.value = '';
        return;
    }

    state.extractionSession.file = file;
    state.extractionSession.status = 'selected';
    state.extractionSession.extractedSubjects = [];

    // Set preview text
    dom.previewFilename.textContent = file.name;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    dom.previewFilesize.textContent = `${sizeMB} MB`;

    // Show PDF vs Image graphics
    if (file.type === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
        dom.previewIconType.textContent = '📄';
        dom.pdfPreviewPlaceholder.style.display = 'block';
        dom.imagePreviewWrapper.style.display = 'none';
    } else {
        dom.previewIconType.textContent = '🖼️';
        dom.pdfPreviewPlaceholder.style.display = 'none';
        dom.imagePreviewWrapper.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (e) => {
            dom.previewImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    showExtractionState();
}

// Clear currently selected document
function removeUploadedFile() {
    state.extractionSession.file = null;
    state.extractionSession.status = 'empty';
    state.extractionSession.extractedSubjects = [];
    dom.fileInput.value = '';
    showExtractionState();
}

// Toggle layout components based on extraction status
function showExtractionState() {
    const status = state.extractionSession.status;
    
    dom.uploadDropzone.style.display = status === 'empty' ? 'flex' : 'none';
    dom.previewPanel.style.display = status === 'selected' ? 'flex' : 'none';
    dom.processingPanel.style.display = status === 'processing' ? 'flex' : 'none';
    dom.verificationPanel.style.display = status === 'extracted' ? 'block' : 'none';
}

// Call real document analysis API and transition states
function analyzeDocument() {
    if (!state.extractionSession.file) return;

    state.extractionSession.status = 'processing';
    showExtractionState();

    dom.analyzeBtn.disabled = true;

    const formData = new FormData();
    formData.append('document', state.extractionSession.file);

    fetch('/api/analyze', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errData => {
                throw new Error(errData.error || 'Server error occurred during document analysis.');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            state.extractionSession.status = 'extracted';
            showExtractionState();

            // Display file-level warning alerts (e.g. supplementary alert)
            const warnings = data.warnings || [];
            if (warnings.length > 0) {
                showToast(warnings.join(' | '), "warning");
            }

            state.extractionSession.extractedSubjects = [];

            let docSgpa = "";
            let docCgpa = "";

            // Flatten backend multi-semester structure into verified list
            if (data.semesters && data.semesters.length > 0) {
                data.semesters.forEach(semBlock => {
                    let semKey = semBlock.semester;
                    
                    // Match semester strings to keys sem1-sem4
                    if (semKey.toLowerCase().includes("sem1") || semKey.toLowerCase().includes("semester 1") || semKey.toLowerCase().includes("first")) {
                        semKey = "sem1";
                    } else if (semKey.toLowerCase().includes("sem2") || semKey.toLowerCase().includes("semester 2") || semKey.toLowerCase().includes("second")) {
                        semKey = "sem2";
                    } else if (semKey.toLowerCase().includes("sem3") || semKey.toLowerCase().includes("semester 3") || semKey.toLowerCase().includes("third")) {
                        semKey = "sem3";
                    } else if (semKey.toLowerCase().includes("sem4") || semKey.toLowerCase().includes("semester 4") || semKey.toLowerCase().includes("fourth")) {
                        semKey = "sem4";
                    } else {
                        semKey = ""; // Needs verification
                    }

                    if (semKey === state.activeSemester || (semKey === "" && docSgpa === "")) {
                        if (semBlock.sgpa !== undefined && semBlock.sgpa !== "") docSgpa = semBlock.sgpa;
                        if (semBlock.cgpa !== undefined && semBlock.cgpa !== "") docCgpa = semBlock.cgpa;
                    }

                    if (semBlock.subjects && semBlock.subjects.length > 0) {
                        semBlock.subjects.forEach(sub => {
                            state.extractionSession.extractedSubjects.push({
                                id: 'verify_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + state.extractionSession.extractedSubjects.length,
                                semester: semKey,
                                code: sub.code || '',
                                name: sub.name || '',
                                credits: sub.credits !== undefined && sub.credits !== "" ? parseFloat(sub.credits) : null,
                                obtainedMarks: sub.obtainedMarks !== undefined && sub.obtainedMarks !== "" ? parseFloat(sub.obtainedMarks) : null,
                                maximumMarks: sub.maximumMarks !== undefined && sub.maximumMarks !== "" ? parseFloat(sub.maximumMarks) : null,
                                grade: sub.grade || '',
                                courseType: sub.courseType || '',
                                status: sub.status || 'Passed',
                                confidence: sub.confidence || {}
                            });
                        });
                    }
                });
            }

            // Set document SGPA/CGPA inputs
            dom.docSgpaInput.value = docSgpa;
            dom.docCgpaInput.value = docCgpa;

            renderVerificationRows();
            calculateVerificationMetrics();
        } else {
            throw new Error(data.error || 'Server returned invalid extraction response.');
        }
    })
    .catch(err => {
        console.error("API Extraction failed:", err);
        let errorMsg = err.message;
        if (err.name === 'TypeError' || errorMsg.includes('Failed to fetch')) {
            errorMsg = "The document analysis service is currently offline or unreachable. Please run the server locally or input grades manually.";
            document.getElementById('service-offline-notice').classList.add('visible');
        }
        showToast("Extraction failed: " + errorMsg, "error");
        state.extractionSession.status = 'selected';
        showExtractionState();
    })
    .finally(() => {
        dom.analyzeBtn.disabled = false;
    });
}

// Render dynamic rows of extracted subjects inside verification panel
function renderVerificationRows() {
    dom.verificationRowsContainer.innerHTML = '';
    const subjects = state.extractionSession.extractedSubjects || [];

    const hasAnyMarks = subjects.some(s => s.obtainedMarks !== null || s.maximumMarks !== null);

    const verifyTableHead = document.querySelector('#verification-table thead tr');
    if (verifyTableHead) {
        if (hasAnyMarks) {
            verifyTableHead.innerHTML = `
                <th style="width: 130px;">Semester</th>
                <th>Course Code</th>
                <th>Course Name</th>
                <th style="width: 70px; text-align: center;">Credits</th>
                <th style="width: 70px; text-align: center;">Obtained</th>
                <th style="width: 70px; text-align: center;">Max</th>
                <th style="width: 100px;">Grade</th>
                <th style="width: 120px;">Course Type</th>
                <th style="width: 120px;">Attempt Type</th>
                <th style="width: 50px; text-align: center;">Remove</th>
            `;
        } else {
            verifyTableHead.innerHTML = `
                <th style="width: 130px;">Semester</th>
                <th>Course Code</th>
                <th>Course Name</th>
                <th style="width: 70px; text-align: center;">Credits</th>
                <th style="width: 100px;">Grade</th>
                <th style="width: 100px; text-align: center;">GP</th>
                <th style="width: 110px; text-align: center;">Status</th>
                <th style="width: 120px;">Attempt Type</th>
                <th style="width: 50px; text-align: center;">Remove</th>
            `;
        }
    }

    subjects.forEach(sub => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', sub.id);

        if (hasAnyMarks) {
            tr.innerHTML = `
                <td data-label="Semester">
                    <select class="select-verify-sem select-verify-sem-input">
                        <option value="">Select Semester</option>
                        <option value="sem1" ${sub.semester === 'sem1' ? 'selected' : ''}>Semester 1</option>
                        <option value="sem2" ${sub.semester === 'sem2' ? 'selected' : ''}>Semester 2</option>
                        <option value="sem3" ${sub.semester === 'sem3' ? 'selected' : ''}>Semester 3</option>
                        <option value="sem4" ${sub.semester === 'sem4' ? 'selected' : ''}>Semester 4</option>
                    </select>
                </td>
                <td data-label="Course Code" class="verify-code-cell">
                    <input type="text" class="input-code verify-code-input" placeholder="Course Code" value="${sub.code}">
                </td>
                <td data-label="Course Name" class="verify-name-cell">
                    <input type="text" class="input-code verify-name-input" placeholder="Course Name" value="${sub.name || ''}">
                </td>
                <td data-label="Credits" class="verify-credits-cell">
                    <input type="number" step="any" class="input-credits verify-credits-input" placeholder="Credits" value="${sub.credits === null ? '' : sub.credits}">
                </td>
                <td data-label="Obtained" class="verify-obtained-cell">
                    <input type="number" step="any" class="input-marks verify-obtained-input" placeholder="Obtained" value="${sub.obtainedMarks === null ? '' : sub.obtainedMarks}">
                </td>
                <td data-label="Max" class="verify-max-cell">
                    <input type="number" step="any" class="input-marks verify-max-input" placeholder="Max" value="${sub.maximumMarks === null ? '' : sub.maximumMarks}">
                </td>
                <td data-label="Grade" class="verify-grade-cell">
                    <select class="select-grade verify-grade-input">
                        <option value="">Select Grade</option>
                        ${Object.keys(GRADE_POINT_MAPPING).map(g => `<option value="${g}" ${sub.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
                    </select>
                </td>
                <td data-label="Course Type" class="verify-type-cell">
                    <select class="select-type verify-type-input">
                        <option value="">Select Course Type</option>
                        <option value="Theory" ${sub.courseType === 'Theory' ? 'selected' : ''}>Theory</option>
                        <option value="Other" ${sub.courseType === 'Other' ? 'selected' : ''}>Other than Theory</option>
                    </select>
                </td>
                <td data-label="Attempt Type" class="verify-attempt-cell">
                    <select class="select-type verify-attempt-type-input">
                        <option value="">Select Attempt Type</option>
                        <option value="original" ${sub.attemptType === 'original' ? 'selected' : ''}>Original</option>
                        <option value="supplementary" ${sub.attemptType === 'supplementary' ? 'selected' : ''}>Supplementary</option>
                        <option value="re-examination" ${sub.attemptType === 're-examination' ? 'selected' : ''}>Re-examination</option>
                        <option value="improvement" ${sub.attemptType === 'improvement' ? 'selected' : ''}>Improvement</option>
                    </select>
                </td>
                <td data-label="Remove" style="text-align: center;">
                    <button type="button" class="btn-remove verify-remove-btn">&times;</button>
                </td>
            `;
        } else {
            const gp = GRADE_POINT_MAPPING[sub.grade];
            let statusText = 'Passed';
            if (sub.grade === 'F') statusText = 'Backlog';
            else if (sub.grade === 'W') statusText = 'Fail / Attendance';
            else if (sub.grade === 'PP') statusText = 'Passed';
            else if (sub.grade === 'NP') statusText = 'Not Passed';
            else if (sub.grade === 'AU') statusText = 'Audit';
            else if (sub.grade === 'Satisfactory') statusText = 'Satisfactory';
            else if (sub.grade === 'Unsatisfactory') statusText = 'Unsatisfactory';
            else if (sub.grade === 'I') statusText = 'Incomplete';

            tr.innerHTML = `
                <td data-label="Semester">
                    <select class="select-verify-sem select-verify-sem-input">
                        <option value="">Select Semester</option>
                        <option value="sem1" ${sub.semester === 'sem1' ? 'selected' : ''}>Semester 1</option>
                        <option value="sem2" ${sub.semester === 'sem2' ? 'selected' : ''}>Semester 2</option>
                        <option value="sem3" ${sub.semester === 'sem3' ? 'selected' : ''}>Semester 3</option>
                        <option value="sem4" ${sub.semester === 'sem4' ? 'selected' : ''}>Semester 4</option>
                    </select>
                </td>
                <td data-label="Course Code" class="verify-code-cell">
                    <input type="text" class="input-code verify-code-input" placeholder="Course Code" value="${sub.code}">
                </td>
                <td data-label="Course Name" class="verify-name-cell">
                    <input type="text" class="input-code verify-name-input" placeholder="Course Name" value="${sub.name || ''}">
                </td>
                <td data-label="Credits" class="verify-credits-cell">
                    <input type="number" step="any" class="input-credits verify-credits-input" placeholder="Credits" value="${sub.credits === null ? '' : sub.credits}">
                </td>
                <td data-label="Grade" class="verify-grade-cell">
                    <select class="select-grade verify-grade-input">
                        <option value="">Select Grade</option>
                        ${Object.keys(GRADE_POINT_MAPPING).map(g => `<option value="${g}" ${sub.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
                    </select>
                </td>
                <td data-label="GP" class="verify-gp-cell" style="text-align: center; font-weight: 700;">${gp !== undefined ? gp : '—'}</td>
                <td data-label="Status" class="verify-status-cell" style="text-align: center;"><span class="status-text">${statusText}</span></td>
                <td data-label="Attempt Type" class="verify-attempt-cell">
                    <select class="select-type verify-attempt-type-input">
                        <option value="">Select Attempt Type</option>
                        <option value="original" ${sub.attemptType === 'original' ? 'selected' : ''}>Original</option>
                        <option value="supplementary" ${sub.attemptType === 'supplementary' ? 'selected' : ''}>Supplementary</option>
                        <option value="re-examination" ${sub.attemptType === 're-examination' ? 'selected' : ''}>Re-examination</option>
                        <option value="improvement" ${sub.attemptType === 'improvement' ? 'selected' : ''}>Improvement</option>
                    </select>
                </td>
                <td data-label="Remove" style="text-align: center;">
                    <button type="button" class="btn-remove verify-remove-btn">&times;</button>
                </td>
            `;
        }

        // Event listeners
        const semSelect = tr.querySelector('.select-verify-sem-input');
        if (semSelect) {
            semSelect.addEventListener('change', (e) => {
                updateExtractedSubject(sub.id, 'semester', e.target.value);
            });
        }

        const codeInput = tr.querySelector('.verify-code-input');
        if (codeInput) {
            codeInput.addEventListener('input', (e) => {
                updateExtractedSubject(sub.id, 'code', e.target.value);
            });
        }

        const nameInput = tr.querySelector('.verify-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                updateExtractedSubject(sub.id, 'name', e.target.value);
            });
        }

        const creditsInput = tr.querySelector('.verify-credits-input');
        if (creditsInput) {
            creditsInput.addEventListener('input', (e) => {
                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                updateExtractedSubject(sub.id, 'credits', val);
            });
        }

        const obtainedInput = tr.querySelector('.verify-obtained-input');
        if (obtainedInput) {
            obtainedInput.addEventListener('input', (e) => {
                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                updateExtractedSubject(sub.id, 'obtainedMarks', val);
            });
        }

        const maxInput = tr.querySelector('.verify-max-input');
        if (maxInput) {
            maxInput.addEventListener('input', (e) => {
                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                updateExtractedSubject(sub.id, 'maximumMarks', val);
            });
        }

        const gradeInput = tr.querySelector('.verify-grade-input');
        if (gradeInput) {
            gradeInput.addEventListener('change', (e) => {
                updateExtractedSubject(sub.id, 'grade', e.target.value);
            });
        }

        const typeInput = tr.querySelector('.verify-type-input');
        if (typeInput) {
            typeInput.addEventListener('change', (e) => {
                updateExtractedSubject(sub.id, 'courseType', e.target.value);
            });
        }

        const attemptInput = tr.querySelector('.verify-attempt-type-input');
        if (attemptInput) {
            attemptInput.addEventListener('change', (e) => {
                updateExtractedSubject(sub.id, 'attemptType', e.target.value);
            });
        }

        const removeBtn = tr.querySelector('.verify-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                removeExtractedSubject(sub.id);
            });
        }

        dom.verificationRowsContainer.appendChild(tr);
        updateVerificationRowDOM(sub.id);
    });
}

// Modify temporary values inside verification row list
function updateExtractedSubject(id, field, value) {
    const sub = state.extractionSession.extractedSubjects.find(s => s.id === id);
    if (sub) {
        sub[field] = value;

        if (field === 'obtainedMarks' || field === 'maximumMarks' || field === 'courseType') {
            if (sub.obtainedMarks !== null && sub.maximumMarks !== null && sub.courseType !== '') {
                const calc = calculateGradeFromMarks(sub.courseType, sub.obtainedMarks, sub.maximumMarks);
                if (calc && !calc.error) {
                    sub.grade = calc.grade;
                }
            }
        }

        calculateVerificationMetrics();
        updateVerificationRowDOM(id);
    }
}

// Render dynamic validation highlights and mismatch messages inside row
function updateVerificationRowDOM(id) {
    const sub = state.extractionSession.extractedSubjects.find(s => s.id === id);
    if (!sub) return;

    const tr = document.querySelector(`tr[data-id="${sub.id}"]`);
    if (!tr) return;

    const inputCode = tr.querySelector('.verify-code-input');
    const inputCredits = tr.querySelector('.verify-credits-input');
    const inputObtained = tr.querySelector('.verify-obtained-input');
    const selectGrade = tr.querySelector('.verify-grade-input');

    if (inputCode) {
        if (sub.confidence && sub.confidence.code === 'low') {
            inputCode.classList.add('input-highlight-warning');
        } else {
            inputCode.classList.remove('input-highlight-warning');
        }
    }

    if (inputCredits) {
        if (sub.confidence && sub.confidence.credits === 'low') {
            inputCredits.classList.add('input-highlight-warning');
        } else {
            inputCredits.classList.remove('input-highlight-warning');
        }
    }

    if (inputObtained) {
        if (sub.confidence && (sub.confidence.marks === 'low' || sub.confidence.marks === 'medium')) {
            inputObtained.classList.add('input-highlight-warning');
        } else {
            inputObtained.classList.remove('input-highlight-warning');
        }
    }

    const tdGrade = tr.querySelector('.verify-grade-cell');
    if (tdGrade) {
        let gradeWarn = tdGrade.querySelector('.validation-warning');
        let gradeSuccess = tdGrade.querySelector('.validation-success');

        if (gradeWarn) gradeWarn.remove();
        if (gradeSuccess) gradeSuccess.remove();

        if (selectGrade) {
            selectGrade.value = sub.grade;
        }

        const hasMarks = sub.obtainedMarks !== null && sub.maximumMarks !== null;
        const hasType = sub.courseType !== '';

        if (hasMarks && !hasType) {
            gradeWarn = document.createElement('span');
            gradeWarn.className = 'validation-warning';
            gradeWarn.textContent = 'Course type required';
            tdGrade.appendChild(gradeWarn);
        } else if (hasMarks && hasType && sub.grade !== '') {
            const calc = calculateGradeFromMarks(sub.courseType, sub.obtainedMarks, sub.maximumMarks);
            if (calc && !calc.error) {
                if (calc.grade === sub.grade) {
                    gradeSuccess = document.createElement('span');
                    gradeSuccess.className = 'validation-success';
                    gradeSuccess.style.color = 'var(--success)';
                    gradeSuccess.style.fontSize = '0.75rem';
                    gradeSuccess.style.display = 'block';
                    gradeSuccess.textContent = '✓ Grade matches marks';
                    tdGrade.appendChild(gradeSuccess);
                } else {
                    gradeWarn = document.createElement('span');
                    gradeWarn.className = 'validation-warning';
                    gradeWarn.textContent = '⚠ Grade mismatch — please verify.';
                    tdGrade.appendChild(gradeWarn);
                }
            }
        }
    }
}

function addExtractedSubject() {
    const newSub = {
        id: 'verify_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        semester: '',
        code: '',
        name: '',
        credits: null,
        obtainedMarks: null,
        maximumMarks: null,
        grade: '',
        courseType: '',
        status: ''
    };
    state.extractionSession.extractedSubjects.push(newSub);
    renderVerificationRows();
    calculateVerificationMetrics();
}

// Compute live metrics check inside verification editor panel
function calculateVerificationMetrics() {
    const subjects = state.extractionSession.extractedSubjects;

    // Calculate Calculated SGPA for state.activeSemester
    const activeSemRows = subjects.filter(s => s.semester === state.activeSemester && s.credits !== null && s.credits > 0 && s.grade !== '');
    let activeCreditsSum = 0;
    let activeWeightSum = 0;
    activeSemRows.forEach(s => {
        activeCreditsSum += s.credits;
        activeWeightSum += (s.credits * GRADE_POINT_MAPPING[s.grade]);
    });
    const calculatedSGPA = activeCreditsSum > 0 ? (activeWeightSum / activeCreditsSum) : null;

    // Calculate Calculated CGPA over all semesters in verification rows
    const validRows = subjects.filter(s => s.semester !== '' && s.credits !== null && s.credits > 0 && s.grade !== '');
    let overallCreditsSum = 0;
    let overallWeightSum = 0;
    validRows.forEach(s => {
        overallCreditsSum += s.credits;
        overallWeightSum += (s.credits * GRADE_POINT_MAPPING[s.grade]);
    });
    const calculatedCGPA = overallCreditsSum > 0 ? (overallWeightSum / overallCreditsSum) : null;

    // Update comparative displays
    dom.calcSgpaVerify.textContent = calculatedSGPA !== null ? calculatedSGPA.toFixed(2) : '—';
    dom.calcCgpaVerify.textContent = calculatedCGPA !== null ? calculatedCGPA.toFixed(2) : '—';

    const docSgpa = parseFloat(dom.docSgpaInput.value);
    const docCgpa = parseFloat(dom.docCgpaInput.value);

    // SGPA Mismatch alerts
    if (!isNaN(docSgpa) && calculatedSGPA !== null) {
        if (Math.abs(docSgpa - calculatedSGPA) < 0.005) {
            dom.sgpaCompareStatus.innerHTML = '<span class="compare-match">✓ Matches document</span>';
        } else {
            dom.sgpaCompareStatus.innerHTML = '<span class="compare-mismatch">⚠ SGPA mismatch detected</span>';
        }
    } else {
        dom.sgpaCompareStatus.textContent = '';
    }

    // CGPA Mismatch alerts
    if (!isNaN(docCgpa) && calculatedCGPA !== null) {
        if (Math.abs(docCgpa - calculatedCGPA) < 0.005) {
            dom.cgpaCompareStatus.innerHTML = '<span class="compare-match">✓ Matches document</span>';
        } else {
            dom.cgpaCompareStatus.innerHTML = '<span class="compare-mismatch">⚠ CGPA mismatch detected</span>';
        }
    } else {
        dom.cgpaCompareStatus.textContent = '';
    }
}

// Queue conflict resolution container
const importQueue = {
    subjectsToImport: [],
    currentIndex: 0,
    currentDuplicate: null
};

// Confirm and initiate import process
function confirmImport() {
    const subjects = state.extractionSession.extractedSubjects;
    
    // Filter fully valid verification rows (must have semester, credits and grade)
    const validRows = subjects.filter(s => s.semester !== '' && s.credits !== null && s.credits > 0 && s.grade !== '');

    if (validRows.length === 0) {
        showToast("Please add at least one complete subject (with Semester, Credits, and Grade) to import.", "warning");
        return;
    }

    importQueue.subjectsToImport = validRows;
    importQueue.currentIndex = 0;
    importQueue.currentDuplicate = null;

    processNextImportItem();
}

// Process conflict resolution queue sequentially
function processNextImportItem() {
    if (importQueue.currentIndex >= importQueue.subjectsToImport.length) {
        finalizeImport();
        return;
    }

    const sub = importQueue.subjectsToImport[importQueue.currentIndex];
    
    // Check if course already exists in manual calculator
    const existing = state.semesters[sub.semester].find(c => c.code.trim().toUpperCase() === sub.code.trim().toUpperCase());

    if (existing) {
        // Open conflict resolution modal
        const semTitle = sub.semester.toUpperCase().replace('SEM', 'Semester ');
        dom.duplicateModalMsg.textContent = `Possible duplicate course detected. Semester: ${semTitle}, Course Code: ${sub.code.toUpperCase()}. You already have this course in the calculator.`;
        dom.duplicateModal.style.display = 'flex';
        
        importQueue.currentDuplicate = {
            existing,
            imported: sub
        };
    } else {
        importCourse(sub);
        importQueue.currentIndex++;
        processNextImportItem();
    }
}

// Resolve duplicate modals
function resolveDuplicate(choice) {
    if (!importQueue.currentDuplicate) return;

    const existing = importQueue.currentDuplicate.existing;
    const imported = importQueue.currentDuplicate.imported;

    if (choice === 'overwrite') {
        // Use uploaded data -> Update fields in-place
        existing.code = imported.code;
        existing.subject = imported.name || '';
        existing.courseType = imported.courseType;
        existing.obtainedMarks = imported.obtainedMarks;
        existing.maximumMarks = imported.maximumMarks;
        existing.credits = imported.credits;
        existing.grade = imported.grade;
        existing.manualGrade = imported.grade;
        existing.gradeSource = (imported.obtainedMarks !== null && imported.maximumMarks !== null) ? 'Calculated from Marks' : 'Manual Grade';
        existing.source = 'document';
    } else if (choice === 'separate') {
        // Add as separate record
        importCourse(imported);
    }
    // 'keep' does nothing (keeps existing record as is)

    // Hide Modal and continue queue
    dom.duplicateModal.style.display = 'none';
    importQueue.currentDuplicate = null;
    importQueue.currentIndex++;
    processNextImportItem();
}

// Create new course row from extracted properties
function importCourse(sub) {
    const newCourse = {
        id: 'course_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + importQueue.currentIndex,
        code: sub.code,
        subject: sub.name || '',
        courseType: sub.courseType,
        obtainedMarks: sub.obtainedMarks,
        maximumMarks: sub.maximumMarks,
        credits: sub.credits,
        grade: sub.grade,
        gradeSource: (sub.obtainedMarks !== null && sub.maximumMarks !== null) ? 'Calculated from Marks' : 'Manual Grade',
        manualGrade: sub.grade,
        attemptType: sub.attemptType || 'original',
        parentCourseId: sub.parentCourseId || '',
        documentType: sub.documentType || '',
        source: 'document',
        confidence: sub.confidence || {}
    };

    state.semesters[sub.semester].push(newCourse);
}

// Finalize verification import updates and compare results
function finalizeImport() {
    // Save imported document values to state for card footer comparison
    state.importedDocSgpa = parseFloat(dom.docSgpaInput.value);
    state.importedDocCgpa = parseFloat(dom.docCgpaInput.value);

    // Reset extraction session
    state.extractionSession.file = null;
    state.extractionSession.status = 'empty';
    state.extractionSession.extractedSubjects = [];
    dom.fileInput.value = '';
    showExtractionState();

    // Redraw and recalculate manual calculator
    render();
}

// Cancel verification editor and purge temporary data
function cancelExtraction() {
    showConfirmModal("Are you sure you want to cancel? All temporary extracted data will be discarded.", () => {
        removeUploadedFile();
        showToast("Extraction session cancelled.", "info");
    });
}

// ==============================================================
// PART 5: BACKLOGS, SUPPLEMENTARY, & GRADE IMPROVEMENTS LOGIC
// ==============================================================

// Attempts Resolution Engine
function buildAttemptHistories() {
    const allCourses = [];
    Object.keys(state.semesters).forEach(semKey => {
        state.semesters[semKey].forEach(c => {
            allCourses.push({ ...c, semKey });
        });
    });

    const normalizedGroups = {};
    allCourses.forEach(c => {
        const normCode = c.code.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (!normCode) return;
        if (!normalizedGroups[normCode]) {
            normalizedGroups[normCode] = [];
        }
        normalizedGroups[normCode].push(c);
    });

    const resolvedCourses = [];
    const attemptHistoryList = [];
    const unlinkedRepeats = [];

    Object.keys(normalizedGroups).forEach(normCode => {
        const group = normalizedGroups[normCode];

        if (group.length === 1) {
            const c = group[0];
            const singleStatus = c.grade === 'F' ? 'backlog' : (c.grade === 'W' ? 'withdrawn' : 'passed');
            resolvedCourses.push({
                ...c,
                status: singleStatus,
                finalGrade: c.grade,
                finalStatus: singleStatus
            });
            return;
        }

        // Multiple attempts matching the same code!
        const roots = group.filter(c => !c.parentCourseId || !group.some(parent => parent.id === c.parentCourseId));

        if (roots.length > 1) {
            // Auto link attempts if relationship is clear
            const originalAttempt = roots.find(c => c.attemptType === 'original' || c.grade === 'F' || c.attemptType === '');
            
            if (originalAttempt) {
                const otherAttempts = roots.filter(c => c.id !== originalAttempt.id);
                let canAutoLink = true;
                
                otherAttempts.forEach(child => {
                    if (child.attemptType !== 'supplementary' && child.attemptType !== 're-examination' && child.attemptType !== 'improvement') {
                        canAutoLink = false;
                    }
                });

                if (canAutoLink) {
                    otherAttempts.forEach(child => {
                        child.parentCourseId = originalAttempt.id;
                    });
                } else {
                    // Check if ignored previously
                    const isIgnored = state.ignoredRepeats && state.ignoredRepeats.includes(normCode);
                    if (!isIgnored) {
                        otherAttempts.forEach(child => {
                            unlinkedRepeats.push({
                                parentId: originalAttempt.id,
                                childId: child.id,
                                code: originalAttempt.code
                            });
                        });
                    }
                }
            } else {
                const isIgnored = state.ignoredRepeats && state.ignoredRepeats.includes(normCode);
                if (!isIgnored) {
                    for (let i = 1; i < roots.length; i++) {
                        unlinkedRepeats.push({
                            parentId: roots[0].id,
                            childId: roots[i].id,
                            code: roots[0].code
                        });
                    }
                }
            }
        }

        // Re-evaluate parent-child chains after auto-linking
        const finalRoots = group.filter(c => !c.parentCourseId || !group.some(parent => parent.id === c.parentCourseId));

        finalRoots.forEach(root => {
            const chain = [root];
            let current = root;
            
            while (true) {
                const children = group.filter(c => c.parentCourseId === current.id);
                if (children.length === 0) break;
                children.sort((a, b) => a.id.localeCompare(b.id));
                chain.push(...children);
                current = children[children.length - 1];
            }

            let finalGrade = root.grade;
            let finalGp = GRADE_POINT_MAPPING[root.grade] || 0;
            let finalStatus = root.grade === 'F' ? 'backlog' : (root.grade === 'W' ? 'withdrawn' : 'passed');
            let finalCredits = root.credits;

            for (let i = 1; i < chain.length; i++) {
                const attempt = chain[i];
                const attemptGrade = attempt.grade;
                const attemptGp = GRADE_POINT_MAPPING[attemptGrade] || 0;

                if (attempt.attemptType === 'supplementary' || attempt.attemptType === 're-examination') {
                    if (finalGrade === 'F' || finalGrade === 'W') {
                        if (attemptGrade !== 'F' && attemptGrade !== 'W' && attemptGrade !== '') {
                            finalGrade = attemptGrade;
                            finalGp = attemptGp;
                            finalStatus = 'cleared';
                        } else if (attemptGrade === 'F' || attemptGrade === 'W') {
                            finalGrade = attemptGrade;
                            finalGp = 0;
                            finalStatus = 'backlog';
                        }
                    }
                } else if (attempt.attemptType === 'improvement') {
                    if (attemptGp > finalGp && attemptGrade !== 'F' && attemptGrade !== 'W' && attemptGrade !== '') {
                        finalGrade = attemptGrade;
                        finalGp = attemptGp;
                        finalStatus = 'improved';
                    }
                }
            }

            resolvedCourses.push({
                ...root,
                grade: finalGrade,
                gradePoint: finalGp,
                status: finalStatus,
                credits: finalCredits,
                chain: chain
            });

            if (chain.length > 1) {
                attemptHistoryList.push({
                    courseCode: root.code,
                    courseName: root.name,
                    semKey: root.semKey,
                    attempts: chain,
                    finalGrade: finalGrade,
                    finalStatus: finalStatus,
                    type: chain[1].attemptType || 'supplementary'
                });
            }
        });
    });

    state.resolvedFinalDataset = resolvedCourses;
    state.attemptHistories = attemptHistoryList;
    state.unlinkedRepeats = unlinkedRepeats;
}

// Render dynamic validation highlights and mismatch warnings for repeated attempts
function renderLinkWarnings() {
    const container = document.getElementById('link-warning-container');
    const desc = document.getElementById('link-warning-desc');
    const actions = document.getElementById('link-warning-actions');

    if (!container || !desc || !actions) return;

    if (!state.unlinkedRepeats || state.unlinkedRepeats.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    actions.innerHTML = '';

    const uniqueRepeats = [];
    state.unlinkedRepeats.forEach(rep => {
        if (!uniqueRepeats.some(r => r.code === rep.code)) {
            uniqueRepeats.push(rep);
        }
    });

    uniqueRepeats.forEach(rep => {
        const row = document.createElement('div');
        row.className = 'warning-row';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.width = '100%';
        row.innerHTML = `
            <span class="warning-row-text" style="font-size: 0.85rem; font-weight:600; color:var(--text-main);">Possible repeated attempt detected: ${rep.code.toUpperCase()}.</span>
            <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-primary btn-sm" style="font-size:0.75rem; padding: 0.25rem 0.5rem;" onclick="openManualLinkModal('${rep.code}')">Link Attempts</button>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding: 0.25rem 0.5rem;" onclick="ignoreRepeats('${rep.code}')">Keep Separate</button>
            </div>
        `;
        actions.appendChild(row);
    });
}

// Render Accordion table rows representing full history logs
function renderAttemptHistoryTable() {
    const tbody = document.getElementById('history-rows-container');
    const emptyMsg = document.getElementById('history-empty-message');
    if (!tbody || !emptyMsg) return;

    tbody.innerHTML = '';
    const histories = state.attemptHistories || [];

    if (histories.length === 0) {
        emptyMsg.style.display = 'block';
        const historyTable = document.getElementById('history-table');
        if (historyTable) historyTable.style.display = 'none';
        return;
    }
    emptyMsg.style.display = 'none';
    const historyTable = document.getElementById('history-table');
    if (historyTable) {
        historyTable.style.display = 'table';
    }

    histories.forEach(hist => {
        const tr = document.createElement('tr');
        
        const latest = hist.attempts[hist.attempts.length - 1];
        const original = hist.attempts[0];
        const semName = hist.semKey.toUpperCase().replace('SEM', 'Semester ');

        tr.innerHTML = `
            <td data-label="Course"><strong>${hist.courseCode.toUpperCase()}</strong><br><small style="color: var(--text-muted);">${hist.courseName || 'Course Name'}</small></td>
            <td data-label="Semester" style="text-align: center;">${semName}</td>
            <td data-label="Original Grade" style="text-align: center;"><span class="badge ${original.grade === 'F' ? 'badge-f' : 'badge-cc'}">${original.grade}</span></td>
            <td data-label="Latest Grade" style="text-align: center;"><span class="badge ${latest.grade === 'F' ? 'badge-f' : 'badge-aa'}">${latest.grade}</span></td>
            <td style="text-align: center; text-transform: capitalize;" data-label="Attempt Type">${hist.type}</td>
            <td data-label="Status" style="text-align: center;">
                <span class="status-text ${hist.finalStatus === 'cleared' ? 'status-text-passed' : (hist.finalStatus === 'improved' ? 'status-text-passed' : 'status-text-backlog')}">
                    ${hist.finalStatus === 'cleared' ? 'Cleared' : (hist.finalStatus === 'improved' ? 'Improved' : 'Active Backlog')}
                </span>
            </td>
            <td data-label="Actions" style="text-align: center;">
                <button type="button" class="btn btn-outline-primary btn-sm" onclick="openSubjectDetailModal('${latest.id}')">View Details</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

// Open and load timeline audits inside Subject detail sidebar modal
window.openSubjectDetailModal = function(courseId) {
    let course = null;
    let semKey = "";
    Object.keys(state.semesters).forEach(key => {
        const found = state.semesters[key].find(c => c.id === courseId);
        if (found) {
            course = found;
            semKey = key;
        }
    });

    if (!course) return;

    const normCode = course.code.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const resolved = state.resolvedFinalDataset ? state.resolvedFinalDataset.find(c => c.code.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === normCode) : null;

    const titleEl = document.getElementById('detail-course-title');
    const codeEl = document.getElementById('detail-code');
    const creditsEl = document.getElementById('detail-credits');
    const nameEl = document.getElementById('detail-name');
    const timelineContainer = document.getElementById('detail-timeline-container');
    const auditBox = document.getElementById('detail-audit-box');
    const finalGradeEl = document.getElementById('detail-final-grade');
    const finalGpEl = document.getElementById('detail-final-gp');
    const finalStatusEl = document.getElementById('detail-final-status');
    const unlinkBtn = document.getElementById('detail-unlink-btn');

    if (codeEl) codeEl.textContent = course.code.toUpperCase();
    if (creditsEl) creditsEl.textContent = course.credits !== null ? course.credits : '—';
    if (nameEl) nameEl.textContent = course.subject || 'Course Name';

    if (timelineContainer) timelineContainer.innerHTML = '';

    const chain = resolved ? resolved.chain : [course];

    chain.forEach((c, idx) => {
        const semName = (c.semKey || semKey).toUpperCase().replace('SEM', 'Semester ');
        const timelineItem = document.createElement('div');
        timelineItem.className = `timeline-item timeline-${c.attemptType || 'original'}`;
        
        let typeLabel = c.attemptType || 'original';
        typeLabel = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

        timelineItem.innerHTML = `
            <div class="timeline-header">
                <span class="timeline-title">${idx + 1}. Attempt (${typeLabel})</span>
                <span class="timeline-meta">${semName}</span>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
                <span class="badge ${c.grade === 'F' ? 'badge-f' : 'badge-aa'}">${c.grade || '—'}</span>
                <span class="timeline-body">Grade Point: ${GRADE_POINT_MAPPING[c.grade] !== undefined ? GRADE_POINT_MAPPING[c.grade] : '—'} | Source: ${c.source === 'document' ? 'Document' : 'Manual'}</span>
            </div>
        `;
        if (timelineContainer) timelineContainer.appendChild(timelineItem);
    });

    const finalGrade = resolved ? resolved.grade : course.grade;
    const finalGp = GRADE_POINT_MAPPING[finalGrade];
    const finalStatus = resolved ? resolved.status : (course.grade === 'F' ? 'backlog' : (course.grade === 'W' ? 'withdrawn' : 'passed'));

    if (finalGradeEl) finalGradeEl.textContent = finalGrade || '—';
    if (finalGpEl) finalGpEl.textContent = finalGp !== undefined ? `(Grade Point: ${finalGp})` : '—';
    
    if (finalStatusEl) {
        finalStatusEl.className = 'status-text';
        if (finalStatus === 'passed') {
            finalStatusEl.textContent = 'Passed';
            finalStatusEl.classList.add('status-text-passed');
        } else if (finalStatus === 'cleared') {
            finalStatusEl.textContent = 'Cleared';
            finalStatusEl.classList.add('status-text-passed');
        } else if (finalStatus === 'improved') {
            finalStatusEl.textContent = 'Improved';
            finalStatusEl.classList.add('status-text-passed');
        } else if (finalStatus === 'backlog') {
            finalStatusEl.textContent = finalGrade === 'W' ? 'Fail / Attendance' : 'Active Backlog';
            finalStatusEl.classList.add('status-text-backlog');
        } else if (finalStatus === 'withdrawn') {
            finalStatusEl.textContent = 'Fail / Attendance';
            finalStatusEl.classList.add('status-text-backlog');
        } else {
            finalStatusEl.textContent = 'Incomplete';
            finalStatusEl.classList.add('status-text-incomplete');
        }
    }

    // Set Attempt Type dropdown selector and bind changes
    const attemptSelect = document.getElementById('detail-attempt-type-select');
    if (attemptSelect) {
        attemptSelect.value = course.attemptType || 'original';
        attemptSelect.onchange = function() {
            course.attemptType = attemptSelect.value;
            calculateAndRefresh();
            render();
            // Refresh modal layout with updated state
            openSubjectDetailModal(courseId);
        };
    }

    document.getElementById('subject-detail-panel').style.display = 'flex';
};

// Open Manual linking selection overlays
window.openManualLinkModal = function(code) {
    const parentSelect = document.getElementById('link-parent-select');
    const childSelect = document.getElementById('link-child-select');
    
    if (!parentSelect || !childSelect) return;

    parentSelect.innerHTML = '';
    childSelect.innerHTML = '';
    
    const normCode = code.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const group = [];
    Object.keys(state.semesters).forEach(semKey => {
        state.semesters[semKey].forEach(c => {
            const cNorm = c.code.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (cNorm === normCode) {
                group.push({ ...c, semKey });
            }
        });
    });

    group.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        const semTitle = c.semKey.toUpperCase().replace('SEM', 'Semester ');
        opt.textContent = `${c.code || 'No Code'} (${semTitle} - Grade: ${c.grade || '—'} - ${c.attemptType || 'Original'})`;
        
        parentSelect.appendChild(opt.cloneNode(true));
        childSelect.appendChild(opt.cloneNode(true));
    });

    if (group.length >= 2) {
        parentSelect.selectedIndex = 0;
        childSelect.selectedIndex = 1;
    }

    document.getElementById('linking-modal').style.display = 'flex';
};

// Ignore duplicate prompt alerts
window.ignoreRepeats = function(code) {
    if (!state.ignoredRepeats) {
        state.ignoredRepeats = [];
    }
    const normCode = code.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    state.ignoredRepeats.push(normCode);
    renderLinkWarnings();
};

// Initialize Attempt actions event triggers
function initAttemptEvents() {
    const accHeader = document.getElementById('history-accordion-header');
    const accContent = document.getElementById('history-accordion-content');
    const accIcon = document.getElementById('accordion-toggle-icon');

    if (accHeader && accContent && accIcon) {
        accHeader.addEventListener('click', () => {
            const isHidden = accContent.style.display === 'none';
            accContent.style.display = isHidden ? 'block' : 'none';
            accIcon.textContent = isHidden ? '[ Collapse - ]' : '[ Expand + ]';
        });
    }

    const cancelLink = document.getElementById('cancel-link-btn');
    if (cancelLink) {
        cancelLink.addEventListener('click', () => {
            document.getElementById('linking-modal').style.display = 'none';
        });
    }

    const confirmLink = document.getElementById('confirm-link-btn');
    if (confirmLink) {
        confirmLink.addEventListener('click', () => {
            const parentId = document.getElementById('link-parent-select').value;
            const childId = document.getElementById('link-child-select').value;
            const type = document.getElementById('link-type-select').value;

            if (parentId === childId) {
                showToast("Cannot link a course to itself.", "error");
                return;
            }

            let childCourse = null;
            Object.keys(state.semesters).forEach(key => {
                const found = state.semesters[key].find(c => c.id === childId);
                if (found) childCourse = found;
            });

            if (childCourse) {
                childCourse.parentCourseId = parentId;
                childCourse.attemptType = type;
                document.getElementById('linking-modal').style.display = 'none';
                calculateAndRefresh();
                render();
            }
        });
    }

    const closeDetailX = document.getElementById('close-detail-btn');
    if (closeDetailX) {
        closeDetailX.addEventListener('click', () => {
            document.getElementById('subject-detail-panel').style.display = 'none';
        });
    }

    const closeDetailBtn = document.getElementById('detail-close-btn');
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', () => {
            document.getElementById('subject-detail-panel').style.display = 'none';
        });
    }
}

// ==============================================================
// PART 6: FINAL ACADEMIC ANALYSIS DASHBOARD
// ==============================================================

// Orchestrate showing dashboard empty states and redrawing elements
function renderDashboard() {
    if (!dom.dashboardSection) return;

    // Check if there is any course entered in the semesters
    const totalRawCourses = Object.keys(state.semesters).reduce((sum, sem) => sum + state.semesters[sem].length, 0);
    const hasData = totalRawCourses > 0;

    if (!hasData) {
        dom.dashboardEmptyState.style.display = 'block';
        dom.dashboardContents.style.display = 'none';
        return;
    }

    dom.dashboardEmptyState.style.display = 'none';
    dom.dashboardContents.style.display = 'block';

    // 1. Calculate and populate top summary card metrics
    const activeSemData = calculateSemester(state.activeSemester);
    const overallData = calculateCombined(['sem1', 'sem2', 'sem3', 'sem4']);

    // Selected semesters calculation
    const selectedSemsList = Object.keys(state.selectedSemesters).filter(sem => state.selectedSemesters[sem] === true);
    const selectedData = calculateCombined(selectedSemsList);

    // Current SGPA
    dom.dashCurrentSgpa.textContent = activeSemData.sgpa !== null ? activeSemData.sgpa.toFixed(2) : '—';
    
    // Overall CGPA
    dom.dashOverallCgpa.textContent = overallData.cgpa !== null ? overallData.cgpa.toFixed(2) : '—';

    // Selected CGPA & Semesters Label
    dom.dashSelectedCgpa.textContent = selectedData.cgpa !== null ? selectedData.cgpa.toFixed(2) : '—';
    if (selectedSemsList.length > 0) {
        const labels = selectedSemsList.map(s => s.replace('sem', 'S'));
        dom.dashSelectedSemestersLabel.textContent = `Semesters: ${labels.join(', ')}`;
    } else {
        dom.dashSelectedSemestersLabel.textContent = 'No Semester Selected';
    }

    // Equivalent Percentage
    dom.dashPercentage.textContent = overallData.cgpa !== null ? (overallData.cgpa * 10).toFixed(2) + '%' : '—';

    // Total Credits
    dom.dashTotalCredits.textContent = overallData.totalCredits > 0 
        ? (overallData.totalCredits % 1 === 0 ? overallData.totalCredits : overallData.totalCredits.toFixed(2)) 
        : '0';

    // Active Backlogs
    const resolvedCourses = state.resolvedFinalDataset || [];
    const activeBacklogs = resolvedCourses.filter(c => c.grade === 'F' || c.grade === 'W').length;
    dom.dashActiveBacklogs.textContent = activeBacklogs;
    
    // Backlog footer text
    if (activeBacklogs > 0) {
        dom.dashActiveBacklogs.style.color = 'var(--danger)';
        dom.dashActiveBacklogsFooter.textContent = `${activeBacklogs} unresolved backlog(s)`;
    } else {
        dom.dashActiveBacklogs.style.color = 'var(--primary)';
        dom.dashActiveBacklogsFooter.textContent = 'All clear';
    }

    // 2. Render subcomponents
    renderDashSemesterSummaryTable();
    renderSemesterChart();
    renderSubjectTable();
    renderGradeDistribution();
    renderCreditSummary();
    renderAttemptSummary();
    renderFinalAcademicStatus();
    renderInsights();
}

// Render the semester performance breakdown table and best/lowest highlights
function renderDashSemesterSummaryTable() {
    const tbody = dom.dashSemesterRows;
    if (!tbody) return;

    tbody.innerHTML = '';
    
    const validSems = [];

    for (let i = 1; i <= 4; i++) {
        const semKey = 'sem' + i;
        const semName = 'Semester ' + i;
        const semData = calculateSemester(semKey);

        if (semData.hasData) {
            const tr = document.createElement('tr');
            
            // Format status badge
            let statusClass = 'status-text-incomplete';
            if (semData.hasValidData) {
                if (semData.status === 'Passed') statusClass = 'status-text-passed';
                else if (semData.status === 'Backlog') statusClass = 'status-text-backlog';
            }

            tr.innerHTML = `
                <td style="padding: 0.5rem 0.75rem;"><strong>${semName}</strong></td>
                <td style="padding: 0.5rem 0.75rem; text-align: center;">${semData.totalCredits % 1 === 0 ? semData.totalCredits : semData.totalCredits.toFixed(2)}</td>
                <td style="padding: 0.5rem 0.75rem; text-align: center; font-weight: 700;">${semData.sgpa !== null ? semData.sgpa.toFixed(2) : '—'}</td>
                <td style="padding: 0.5rem 0.75rem; text-align: center;">${semData.backlogs}</td>
                <td style="padding: 0.5rem 0.75rem; text-align: center;"><span class="${statusClass}">${semData.hasValidData ? semData.status : 'Incomplete'}</span></td>
            `;
            tbody.appendChild(tr);

            if (semData.hasValidData && semData.sgpa !== null) {
                validSems.push({ key: semKey, name: semName, sgpa: semData.sgpa });
            }
        }
    }

    // Determine Best / Lowest semesters
    const bestEl = dom.dashBestSem;
    const lowestEl = dom.dashLowestSem;

    if (validSems.length === 0) {
        if (bestEl) bestEl.textContent = '—';
        if (lowestEl) lowestEl.textContent = '—';
        return;
    }

    // Find highest SGPA
    const highestSgpa = Math.max(...validSems.map(s => s.sgpa));
    const lowestSgpa = Math.min(...validSems.map(s => s.sgpa));

    const bestSems = validSems.filter(s => Math.abs(s.sgpa - highestSgpa) < 0.005);
    const lowestSems = validSems.filter(s => Math.abs(s.sgpa - lowestSgpa) < 0.005);

    if (bestEl) {
        bestEl.innerHTML = bestSems.map(s => `${s.name} <span style="font-weight:800;">(${s.sgpa.toFixed(2)})</span>`).join(', ');
    }
    if (lowestEl) {
        lowestEl.innerHTML = lowestSems.map(s => `${s.name} <span style="font-weight:800;">(${s.sgpa.toFixed(2)})</span>`).join(', ');
    }
}

// Generate responsive SVG Line Graph for SGPA trends
function renderSemesterChart() {
    const container = dom.semesterChartContainer;
    if (!container) return;

    container.innerHTML = '';

    const data = [];
    for (let i = 1; i <= 4; i++) {
        const semKey = 'sem' + i;
        const semData = calculateSemester(semKey);
        if (semData.hasValidData && semData.sgpa !== null) {
            data.push({ label: `Sem ${i}`, val: semData.sgpa });
        }
    }

    if (data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No SGPA trend data available.</p>';
        return;
    }

    // Responsive sizing parameters
    const width = container.clientWidth || 320;
    const height = 180;
    const paddingLeft = 30;
    const paddingRight = 15;
    const paddingTop = 25;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Calculate Coordinates
    const xCoords = [];
    if (data.length === 1) {
        xCoords.push(paddingLeft + chartWidth / 2);
    } else {
        const step = chartWidth / (data.length - 1);
        for (let i = 0; i < data.length; i++) {
            xCoords.push(paddingLeft + i * step);
        }
    }

    // Y coordinates mapped from 0 to 10
    const yCoords = data.map(d => {
        const ratio = d.val / 10;
        return paddingTop + chartHeight * (1 - ratio);
    });

    let pointsSvg = '';
    let pathD = '';
    let gridLinesSvg = '';

    // Draw horizontal grid lines for SGPA values (0, 2, 4, 6, 8, 10)
    const yTicks = [0, 2, 4, 6, 8, 10];
    yTicks.forEach(tick => {
        const ratio = tick / 10;
        const yPos = paddingTop + chartHeight * (1 - ratio);
        gridLinesSvg += `
            <line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" stroke="var(--border-color)" stroke-dasharray="3,3" stroke-width="1" />
            <text x="${paddingLeft - 8}" y="${yPos + 4}" font-size="9" text-anchor="end" fill="var(--text-muted)" font-family="var(--font-sans)">${tick}</text>
        `;
    });

    // Build line path and points
    for (let i = 0; i < data.length; i++) {
        pointsSvg += `
            <circle cx="${xCoords[i]}" cy="${yCoords[i]}" r="4" fill="var(--primary)" stroke="var(--bg-card)" stroke-width="1.5" />
            <text x="${xCoords[i]}" y="${yCoords[i] - 8}" font-size="10" font-weight="700" text-anchor="middle" fill="var(--text-main)" font-family="var(--font-sans)">${data[i].val.toFixed(2)}</text>
            <text x="${xCoords[i]}" y="${height - paddingBottom + 16}" font-size="9" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-sans)">${data[i].label}</text>
        `;

        if (i === 0) {
            pathD = `M ${xCoords[i]} ${yCoords[i]}`;
        } else {
            pathD += ` L ${xCoords[i]} ${yCoords[i]}`;
        }
    }

    const svg = `
        <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="overflow: visible;">
            ${gridLinesSvg}
            ${data.length > 1 ? `<path d="${pathD}" fill="none" stroke="var(--primary)" stroke-width="2" />` : ''}
            ${pointsSvg}
        </svg>
    `;

    container.innerHTML = svg;
}

// Render dynamic filtered subject rows inside dashboard table
function renderSubjectTable() {
    const tbody = dom.dashSubjectRows;
    const emptyMsg = dom.dashSubjectsEmpty;
    if (!tbody || !emptyMsg) return;

    tbody.innerHTML = '';

    const semFilter = dom.filterSemester.value;
    const statusFilter = dom.filterStatus.value;
    const gradeFilter = dom.filterGrade.value;
    const attemptFilter = document.getElementById('filter-attempt') ? document.getElementById('filter-attempt').value : 'all';
    const searchQuery = document.getElementById('dash-search-input') ? document.getElementById('dash-search-input').value.toLowerCase().trim() : '';

    const resolved = state.resolvedFinalDataset || [];
    
    // Filter dataset
    const filtered = resolved.filter(c => {
        // Semester Filter
        if (semFilter !== 'all' && c.semKey !== semFilter) return false;

        // Grade Filter
        if (gradeFilter !== 'all' && c.grade !== gradeFilter) return false;

        // Status Filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'passed' && c.grade === 'F') return false;
            if (statusFilter === 'backlog' && c.grade !== 'F') return false;
            if (statusFilter === 'withdrawn' && c.grade !== 'W') return false;
            if (statusFilter === 'cleared' && c.status !== 'cleared') return false;
            if (statusFilter === 'improved' && c.status !== 'improved') return false;
        }

        // Attempt Filter
        if (attemptFilter !== 'all') {
            if ((c.attemptType || 'original') !== attemptFilter) return false;
        }

        // Search Query
        if (searchQuery !== '') {
            const codeMatch = c.code.toLowerCase().includes(searchQuery);
            const nameMatch = c.name ? c.name.toLowerCase().includes(searchQuery) : false;
            if (!codeMatch && !nameMatch) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        const semName = c.semKey.toUpperCase().replace('SEM', 'Semester ');
        const gp = GRADE_POINT_MAPPING[c.grade];
        
        let statusBadgeClass = 'status-text-incomplete';
        let statusText = 'Incomplete';

        if (c.grade === 'F') {
            statusBadgeClass = 'status-text-backlog';
            statusText = 'Backlog';
        } else if (c.grade === 'W') {
            statusBadgeClass = 'status-text-backlog';
            statusText = 'Fail / Attendance';
        } else if (c.grade !== '') {
            statusBadgeClass = 'status-text-passed';
            if (c.status === 'cleared') statusText = 'Cleared';
            else if (c.status === 'improved') statusText = 'Improved';
            else statusText = 'Passed';
        }

        let typeLabel = c.attemptType || 'original';
        typeLabel = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

        tr.innerHTML = `
            <td style="padding: 0.5rem 0.75rem;">${semName}</td>
            <td style="padding: 0.5rem 0.75rem;"><strong>${c.code.toUpperCase()}</strong></td>
            <td style="padding: 0.5rem 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.name || '—'}</td>
            <td style="padding: 0.5rem 0.75rem; text-align: center;">${c.credits !== null ? c.credits : '—'}</td>
            <td style="padding: 0.5rem 0.75rem; text-align: center;"><span class="badge ${c.grade === 'F' ? 'badge-f' : (c.grade === 'W' ? 'badge-cc' : 'badge-aa')}">${c.grade || '—'}</span></td>
            <td style="padding: 0.5rem 0.75rem; text-align: center;">${gp !== undefined ? gp : '—'}</td>
            <td style="padding: 0.5rem 0.75rem; text-align: center;"><span class="${statusBadgeClass}">${statusText}</span></td>
            <td style="padding: 0.5rem 0.75rem; text-align: center; text-transform: capitalize;">${typeLabel}</td>
        `;

        tbody.appendChild(tr);
    });
}

// Calculate and render grade frequency bars
function renderGradeDistribution() {
    const container = dom.gradeDistributionContainer;
    const emptyMsg = dom.gradeDistributionEmpty;
    if (!container || !emptyMsg) return;

    container.innerHTML = '';

    const resolved = state.resolvedFinalDataset || [];
    const validGrades = resolved.filter(c => c.grade !== '');

    if (validGrades.length === 0) {
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';

    // Count distributions
    const counts = { 'AA': 0, 'AB': 0, 'BB': 0, 'BC': 0, 'CC': 0, 'CD': 0, 'DD': 0, 'F': 0, 'W': 0, 'PP': 0, 'NP': 0, 'AU': 0, 'Satisfactory': 0, 'Unsatisfactory': 0, 'I': 0 };
    validGrades.forEach(c => {
        if (counts[c.grade] !== undefined) {
            counts[c.grade]++;
        }
    });

    const maxCount = Math.max(...Object.values(counts));

    Object.keys(counts).forEach(grade => {
        const count = counts[grade];
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

        const row = document.createElement('div');
        row.className = 'distribution-row';
        row.innerHTML = `
            <span class="distribution-label">${grade}</span>
            <div class="distribution-track">
                <div class="distribution-fill" style="width: ${pct}%; background-color: ${grade === 'F' ? 'var(--danger)' : (grade === 'W' ? 'var(--warning)' : 'var(--primary)')};"></div>
            </div>
            <span class="distribution-count">${count}</span>
        `;
        container.appendChild(row);
    });
}

// Render dynamic credit breakdown summary metrics
function renderCreditSummary() {
    const resolved = state.resolvedFinalDataset || [];
    
    let totalEntered = 0;
    let totalPassed = 0;
    let totalBacklog = 0;
    let totalWithdrawn = 0;

    resolved.forEach(c => {
        if (c.credits !== null) {
            totalEntered += c.credits;
            if (c.grade === 'F') {
                totalBacklog += c.credits;
            } else if (c.grade === 'W') {
                totalWithdrawn += c.credits;
            } else if (c.grade !== '') {
                totalPassed += c.credits;
            }
        }
    });

    const enteredEl = dom.creditEntered;
    const passedEl = dom.creditPassed;
    const backlogEl = dom.creditBacklog;
    const withdrawnEl = dom.creditWithdrawn;

    if (enteredEl) enteredEl.textContent = totalEntered % 1 === 0 ? totalEntered : totalEntered.toFixed(2);
    if (passedEl) passedEl.textContent = totalPassed % 1 === 0 ? totalPassed : totalPassed.toFixed(2);
    if (backlogEl) backlogEl.textContent = totalBacklog % 1 === 0 ? totalBacklog : totalBacklog.toFixed(2);
    if (withdrawnEl) withdrawnEl.textContent = totalWithdrawn % 1 === 0 ? totalWithdrawn : totalWithdrawn.toFixed(2);
}

// Render Attempts tracking summary metrics list
function renderAttemptSummary() {
    const container = dom.attemptsSummaryContainer;
    const emptyMsg = dom.attemptsSummaryEmpty;
    if (!container || !emptyMsg) return;

    container.innerHTML = '';

    const rawCourses = [];
    Object.keys(state.semesters).forEach(semKey => {
        rawCourses.push(...state.semesters[semKey]);
    });

    const resolved = state.resolvedFinalDataset || [];

    const activeBacklogs = resolved.filter(c => c.grade === 'F' || c.grade === 'W').length;
    const clearedBacklogs = resolved.filter(c => c.status === 'cleared').length;
    const suppAttempts = rawCourses.filter(c => c.attemptType === 'supplementary').length;
    const reexamAttempts = rawCourses.filter(c => c.attemptType === 're-examination').length;
    const improveAttempts = rawCourses.filter(c => c.attemptType === 'improvement').length;
    const withdrawnCourses = resolved.filter(c => c.grade === 'W').length;

    const hasAnyAttempts = (activeBacklogs + clearedBacklogs + suppAttempts + reexamAttempts + improveAttempts + withdrawnCourses) > 0;

    if (!hasAnyAttempts) {
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';

    const metrics = [
        { label: 'Active Backlogs', value: activeBacklogs, color: activeBacklogs > 0 ? 'var(--danger)' : 'var(--text-main)' },
        { label: 'Previously Cleared', value: clearedBacklogs, color: clearedBacklogs > 0 ? 'var(--success)' : 'var(--text-main)' },
        { label: 'Supplementary Attempts', value: suppAttempts, color: 'var(--text-main)' },
        { label: 'Re-examinations', value: reexamAttempts, color: 'var(--text-main)' },
        { label: 'Improvement Attempts', value: improveAttempts, color: 'var(--text-main)' },
        { label: 'Withdrawn Courses', value: withdrawnCourses, color: withdrawnCourses > 0 ? 'var(--warning)' : 'var(--text-main)' }
    ];

    metrics.forEach(m => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.fontSize = '0.85rem';
        div.style.padding = '0.25rem 0';
        div.style.borderBottom = '1px solid var(--border-color)';
        div.innerHTML = `
            <span style="color: var(--text-muted);">${m.label}</span>
            <strong style="color: ${m.color};">${m.value}</strong>
        `;
        container.appendChild(div);
    });
}

// Calculate and render final standing status card
function renderFinalAcademicStatus() {
    const card = dom.finalStatusCard;
    const titleEl = dom.finalStatusTitle;
    const descEl = dom.finalStatusDesc;

    if (!card || !titleEl || !descEl) return;

    const resolved = state.resolvedFinalDataset || [];
    const hasUnresolved = state.unlinkedRepeats && state.unlinkedRepeats.length > 0;
    const activeBacklogs = resolved.filter(c => c.grade === 'F' || c.grade === 'W').length;

    // Reset status styles
    card.className = 'final-status-large-card';
    card.style.borderColor = 'var(--border-color)';
    card.style.backgroundColor = 'var(--bg-card)';

    if (hasUnresolved) {
        titleEl.textContent = 'Review Required';
        titleEl.style.color = 'var(--warning)';
        descEl.textContent = 'Unresolved repeated attempts require verification before the final status can be confirmed.';
        card.style.borderColor = 'var(--warning)';
        card.style.backgroundColor = 'rgba(217, 119, 6, 0.05)';
    } else if (activeBacklogs > 0) {
        titleEl.textContent = 'Backlog Present';
        titleEl.style.color = 'var(--danger)';
        descEl.textContent = `${activeBacklogs} active backlog course(s) remain unresolved.`;
        card.style.borderColor = 'var(--danger)';
        card.style.backgroundColor = 'rgba(220, 38, 38, 0.05)';
    } else {
        titleEl.textContent = 'All Entered Courses Cleared';
        titleEl.style.color = 'var(--success)';
        descEl.textContent = 'All currently resolved courses are cleared and no active F grade remains.';
        card.style.borderColor = 'var(--success)';
        card.style.backgroundColor = 'rgba(22, 163, 74, 0.05)';
    }

    // Determine Data Source
    let isManual = false;
    let isImport = false;

    Object.keys(state.semesters).forEach(key => {
        state.semesters[key].forEach(c => {
            if (c.source === 'document') isImport = true;
            else isManual = true;
        });
    });

    const sourceEl = dom.dashSourceIndicator;
    if (sourceEl) {
        if (isManual && isImport) sourceEl.textContent = 'Mixed';
        else if (isImport) sourceEl.textContent = 'Imported Document';
        else if (isManual) sourceEl.textContent = 'Manual Entry';
        else sourceEl.textContent = '—';
    }

    // Determine Data Quality
    const qualityEl = dom.dashQualityIndicator;
    if (qualityEl) {
        let hasMissing = false;
        
        Object.keys(state.semesters).forEach(key => {
            state.semesters[key].forEach(c => {
                if (c.credits === null || c.grade === '' || c.code.trim() === '') {
                    hasMissing = true;
                }
            });
        });

        if (hasUnresolved) {
            qualityEl.textContent = 'Needs Verification';
            qualityEl.style.color = 'var(--warning)';
        } else if (hasMissing) {
            qualityEl.textContent = 'Incomplete';
            qualityEl.style.color = 'var(--danger)';
        } else {
            qualityEl.textContent = 'Complete';
            qualityEl.style.color = 'var(--success)';
        }
    }
}

// Generate dynamically calculated factual performance insights
function renderInsights() {
    const container = dom.insightsListContainer;
    if (!container) return;

    container.innerHTML = '';

    const insights = [];
    const validSems = [];

    for (let i = 1; i <= 4; i++) {
        const semKey = 'sem' + i;
        const semData = calculateSemester(semKey);
        if (semData.hasValidData && semData.sgpa !== null) {
            validSems.push({ index: i, name: `Semester ${i}`, sgpa: semData.sgpa });
        }
    }

    // Best semester insight
    if (validSems.length > 0) {
        const highestSgpa = Math.max(...validSems.map(s => s.sgpa));
        const best = validSems.filter(s => Math.abs(s.sgpa - highestSgpa) < 0.005);
        const names = best.map(b => b.name).join(' and ');
        insights.push(`Your highest SGPA was in ${names} (${highestSgpa.toFixed(2)}).`);
    }

    // Trend insights
    if (validSems.length >= 2) {
        validSems.sort((a, b) => a.index - b.index);
        for (let i = 0; i < validSems.length - 1; i++) {
            const current = validSems[i];
            const next = validSems[i + 1];
            if (next.sgpa > current.sgpa) {
                insights.push(`Your SGPA increased from ${current.name} to ${next.name}.`);
            } else if (next.sgpa < current.sgpa) {
                insights.push(`Your SGPA decreased from ${current.name} to ${next.name}.`);
            }
        }
    }

    // Attempts resolutions insights
    const resolved = state.resolvedFinalDataset || [];
    
    const activeBacklogs = resolved.filter(c => c.grade === 'F' || c.grade === 'W').length;
    if (activeBacklogs > 0) {
        insights.push(`${activeBacklogs} active backlog(s) remain.`);
    }

    const clearedBacklogs = resolved.filter(c => c.status === 'cleared').length;
    if (clearedBacklogs > 0) {
        insights.push(`${clearedBacklogs} course(s) were cleared through supplementary/re-examination attempts.`);
    }

    const improvedCourses = resolved.filter(c => c.status === 'improved').length;
    if (improvedCourses > 0) {
        insights.push(`${improvedCourses} course(s) were successfully improved.`);
    }

    if (insights.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; margin: auto 0;">No factual performance insights generated yet.</p>';
        return;
    }

    insights.forEach(ins => {
        const li = document.createElement('li');
        li.textContent = ins;
        li.style.color = 'var(--text-main)';
        container.appendChild(li);
    });
}



// ==============================================================
// PART 7 OVERHAUL EXTENSIONS (TOASTS, MODALS, ACCESSIBILITY, FILTERS)
// ==============================================================

// Accessible Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    else if (type === 'warning') icon = '⚠';
    else if (type === 'error') icon = '✗';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-msg">${message}</span>
        <button type="button" class="toast-close" aria-label="Close Notification">&times;</button>
    `;
    
    container.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('leaving');
        toast.addEventListener('animationend', () => toast.remove());
    });
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('leaving');
            toast.addEventListener('animationend', () => toast.remove());
        }
    }, 4000);
}

// Accessible Custom Reusable Confirmation Modal
function showConfirmModal(message, onConfirm, onCancel) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-modal-msg');
    const okBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const closeBtn = document.getElementById('confirm-modal-close');
    
    if (!modal || !msgEl || !okBtn || !cancelBtn) return;
    
    msgEl.textContent = message;
    modal.style.display = 'flex';
    
    // Clean old listeners
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newCloseBtn = closeBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    newOkBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    });
    
    const closeModal = () => {
        modal.style.display = 'none';
        if (onCancel) onCancel();
    };
    newCancelBtn.addEventListener('click', closeModal);
    newCloseBtn.addEventListener('click', closeModal);
}

// Mobile Hamburger Navigation Toggle
function initMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburger-menu-btn');
    const mobileMenu = document.getElementById('mobile-drawer-menu');
    
    if (hamburgerBtn && mobileMenu) {
        hamburgerBtn.addEventListener('click', e => {
            e.stopPropagation();
            hamburgerBtn.classList.toggle('open');
            mobileMenu.classList.toggle('open');
        });
        
        mobileMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburgerBtn.classList.remove('open');
                mobileMenu.classList.remove('open');
            });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768) {
                hamburgerBtn.classList.remove('open');
                mobileMenu.classList.remove('open');
            }
        });
    }
}

// Grade Rules Tab Switcher
function initGradeRulesTabs() {
    const tabRuleTheory = document.getElementById('tab-rule-theory');
    const tabRuleOther = document.getElementById('tab-rule-other');
    const panelRuleTheory = document.getElementById('panel-rule-theory');
    const panelRuleOther = document.getElementById('panel-rule-other');
    
    if (tabRuleTheory && tabRuleOther && panelRuleTheory && panelRuleOther) {
        tabRuleTheory.addEventListener('click', () => {
            tabRuleTheory.classList.add('active');
            tabRuleOther.classList.remove('active');
            panelRuleTheory.classList.add('active');
            panelRuleOther.classList.remove('active');
        });
        tabRuleOther.addEventListener('click', () => {
            tabRuleOther.classList.add('active');
            tabRuleTheory.classList.remove('active');
            panelRuleOther.classList.add('active');
            panelRuleTheory.classList.remove('active');
        });
    }
}

// Dashboard Subject Search and Filters
function initDashboardSearch() {
    const searchInput = document.getElementById('dash-search-input');
    const attemptFilter = document.getElementById('filter-attempt');
    const clearFiltersBtn = document.getElementById('btn-clear-filters');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderSubjectTable();
        });
    }
    if (attemptFilter) {
        attemptFilter.addEventListener('change', () => {
            renderSubjectTable();
        });
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (attemptFilter) attemptFilter.value = 'all';
            if (dom.filterSemester) dom.filterSemester.value = 'all';
            if (dom.filterStatus) dom.filterStatus.value = 'all';
            if (dom.filterGrade) dom.filterGrade.value = 'all';
            renderSubjectTable();
            showToast("Dashboard filters cleared", "info");
        });
    }
}

// Document Service Offline Status check
function checkServiceAvailability() {
    fetch('/')
    .then(res => {
        const el = document.getElementById('service-offline-notice');
        if (el) {
            if (res.ok) el.classList.remove('visible');
            else el.classList.add('visible');
        }
    })
    .catch(() => {
        const el = document.getElementById('service-offline-notice');
        if (el) el.classList.add('visible');
    });
}


// Keyboard Modals Closure
function initAccessibilityKeys() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(m => m.style.display = 'none');
            const detailPanel = document.getElementById('subject-detail-panel');
            if (detailPanel) detailPanel.style.display = 'none';
            const linkingModal = document.getElementById('linking-modal');
            if (linkingModal) linkingModal.style.display = 'none';
            const duplicateModal = document.getElementById('duplicate-modal');
            if (duplicateModal) duplicateModal.style.display = 'none';
            const confirmModal = document.getElementById('confirm-modal');
            if (confirmModal) confirmModal.style.display = 'none';
        }
    });
}




// Toggle Calculator mode columns and headers
function toggleCalculatorMode() {
    const isGradeMode = state.calculationMethod === 'grade';
    const table = document.getElementById('subjects-table');
    
    const gradeDesc = document.getElementById('grade-method-desc');
    const marksDesc = document.getElementById('marks-method-desc');
    if (gradeDesc) gradeDesc.style.display = isGradeMode ? 'block' : 'none';
    if (marksDesc) marksDesc.style.display = isGradeMode ? 'none' : 'block';

    // Toggle grade-mode class on the table for column visibility
    if (table) {
        if (isGradeMode) {
            table.classList.add('grade-mode');
        } else {
            table.classList.remove('grade-mode');
        }
    }
}

// PART 7: AUTHENTICATION (LOGIN, SIGNUP, RESET, FIREBASE & MOCK)
// ==============================================================

// Helper to translate Firebase Auth error codes into descriptive user-friendly texts
function getAuthErrorMessage(error) {
    if (!error) return "An unexpected error occurred. Please try again.";
    
    switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
            return "Incorrect password. Please verify and try again.";
        case 'auth/user-not-found':
            return "No account exists with this email address. Please create an account.";
        case 'auth/invalid-email':
            return "The email address is invalid. Please double-check formatting.";
        case 'auth/too-many-requests':
            return "Too many unsuccessful requests. Access has been temporarily disabled. Please wait and try again later.";
        case 'auth/network-request-failed':
            return "A network error occurred. Please check your internet connection and try again.";
        case 'auth/email-already-in-use':
            return "This email address is already registered. Please sign in instead.";
        case 'auth/weak-password':
            return "The password is too weak. It must be at least 8 characters long.";
        case 'auth/user-disabled':
            return "This user account has been disabled by an administrator.";
        case 'auth/operation-not-allowed':
            return "This authentication provider is not enabled in the Firebase Console.";
        case 'auth/popup-closed-by-user':
            return "Google sign-in popup was closed before completing. Please try again.";
        case 'auth/popup-blocked':
            return "Popup was blocked by your browser. Please allow popups for this site.";
        default:
            return error.message || "Authentication failed. Please check your credentials.";
    }
}

// Global AuthService Wrapper - uses Firebase modular SDK when config is available, falls back to mock
window.AuthService = {
    getUser: () => state.auth.user,
    isLoading: () => state.auth.loading,
    
    login: (email, password, remember) => {
        if (state.auth.mode === 'disabled') {
            return Promise.reject({ code: 'auth/configuration-error', message: 'Firebase configuration is missing or invalid on Vercel. Please check settings.' });
        }
        if (state.auth.mode === 'firebase') {
            const auth = getFirebaseAuth();
            const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
            return setPersistence(auth, persistence)
                .then(() => signInWithEmailAndPassword(auth, email, password));
        } else {
            // Mock Mode Sign In Promise
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const users = JSON.parse(localStorage.getItem('nits_mock_users_list') || '[]');
                    const user = users.find(u => u.email === email && u.password === password);
                    if (user) {
                        const sessionUser = { uid: user.uid, email: user.email, name: user.name, photoURL: null };
                        if (remember) {
                            localStorage.setItem('nits_mock_user', JSON.stringify(sessionUser));
                        } else {
                            sessionStorage.setItem('nits_mock_user', JSON.stringify(sessionUser));
                        }
                        handleAuthState(sessionUser);
                        resolve(sessionUser);
                    } else {
                        reject({ code: 'auth/invalid-credential', message: 'Invalid credentials in local mock database.' });
                    }
                }, 800);
            });
        }
    },
    
    signup: (name, email, password) => {
        if (state.auth.mode === 'disabled') {
            return Promise.reject({ code: 'auth/configuration-error', message: 'Firebase configuration is missing or invalid on Vercel. Please check settings.' });
        }
        if (state.auth.mode === 'firebase') {
            const auth = getFirebaseAuth();
            const db = getFirebaseDb();
            return createUserWithEmailAndPassword(auth, email, password)
                .then(cred => {
                    const user = cred.user;
                    return updateProfile(user, { displayName: name })
                        .then(() => {
                            // Store user profile under users/{uid} in Firestore
                            return setDoc(doc(db, 'users', user.uid), {
                                uid: user.uid,
                                name: name,
                                email: email,
                                photoURL: null,
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                            });
                        });
                });
        } else {
            // Mock Mode Sign Up Promise
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const users = JSON.parse(localStorage.getItem('nits_mock_users_list') || '[]');
                    if (users.some(u => u.email === email)) {
                        reject({ code: 'auth/email-already-in-use', message: 'Email address is already registered in local mock database.' });
                        return;
                    }
                    const newUser = {
                        uid: 'mock_uid_' + Date.now(),
                        name: name,
                        email: email,
                        password: password
                    };
                    users.push(newUser);
                    localStorage.setItem('nits_mock_users_list', JSON.stringify(users));
                    
                    const sessionUser = { uid: newUser.uid, email: newUser.email, name: newUser.name, photoURL: null };
                    localStorage.setItem('nits_mock_user', JSON.stringify(sessionUser));
                    handleAuthState(sessionUser);
                    resolve(sessionUser);
                }, 800);
            });
        }
    },
    
    loginWithGoogle: () => {
        if (state.auth.mode === 'disabled') {
            return Promise.reject({ code: 'auth/configuration-error', message: 'Firebase configuration is missing or invalid on Vercel. Please check settings.' });
        }
        if (state.auth.mode === 'firebase') {
            const auth = getFirebaseAuth();
            const db = getFirebaseDb();
            const provider = new GoogleAuthProvider();
            return signInWithPopup(auth, provider)
                .then(async (result) => {
                    const user = result.user;
                    const userDocRef = doc(db, 'users', user.uid);
                    const userSnap = await getDoc(userDocRef);
                    if (!userSnap.exists()) {
                        await setDoc(userDocRef, {
                            uid: user.uid,
                            name: user.displayName || 'Google User',
                            email: user.email,
                            photoURL: user.photoURL || null,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                    }
                    // For Firebase auth, let's call handleAuthState explicitly upon success to trigger UI updates
                    handleAuthState(user);
                    return user;
                });
        } else {
            // Mock Google Login Promise
            return new Promise((resolve) => {
                setTimeout(() => {
                    const mockGoogleUser = {
                        uid: 'mock_google_uid_123',
                        name: 'Google User',
                        email: 'googleuser@nits.ac.in',
                        photoURL: null
                    };
                    localStorage.setItem('nits_mock_user', JSON.stringify(mockGoogleUser));
                    handleAuthState(mockGoogleUser);
                    resolve(mockGoogleUser);
                }, 500);
            });
        }
    },
    
    logout: () => {
        if (state.auth.mode === 'firebase') {
            return signOut(getFirebaseAuth());
        } else {
            return new Promise((resolve) => {
                localStorage.removeItem('nits_mock_user');
                sessionStorage.removeItem('nits_mock_user');
                handleAuthState(null);
                resolve();
            });
        }
    },
    
    resetPassword: (email) => {
        if (state.auth.mode === 'disabled') {
            return Promise.reject({ code: 'auth/configuration-error', message: 'Firebase configuration is missing or invalid on Vercel. Please check settings.' });
        }
        if (state.auth.mode === 'firebase') {
            return sendPasswordResetEmail(getFirebaseAuth(), email);
        } else {
            return new Promise((resolve) => {
                setTimeout(() => resolve(), 500);
            });
        }
    }
};

function initAuth() {
    // Safety fallback: Guarantee loading overlay hides after 1.5s max even if network/auth latency occurs
    const overlayTimeout = setTimeout(() => {
        hideLoadingOverlay();
    }, 1500);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    fetch('/api/config')
        .then(res => res.json())
        .then(config => {
            const hasFirebaseConfig = config && config.apiKey && config.apiKey.trim() !== "" && !config.apiKey.includes('your-api-key-here') && !config.apiKey.includes('api.example.com');
            if (hasFirebaseConfig) {
                const { auth } = initializeFirebase(config);
                state.auth.mode = 'firebase';
                console.log("NITS Academic Insight: Initialized in Firebase Auth Mode.");
                onAuthStateChanged(auth, user => {
                    clearTimeout(overlayTimeout);
                    handleAuthState(user);
                    hideLoadingOverlay();
                });
            } else {
                clearTimeout(overlayTimeout);
                if (isLocalhost) {
                    initMockAuth();
                } else {
                    console.error("Firebase configuration missing or invalid in production.");
                    state.auth.mode = 'disabled';
                    state.auth.loading = false;
                    showToast("Configuration Error: Firebase environment variables are missing or set to placeholder values. Please check Vercel settings.", "error");
                    hideLoadingOverlay();
                }
            }
        })
        .catch(err => {
            console.warn("Failed to fetch Firebase config:", err);
            clearTimeout(overlayTimeout);
            if (isLocalhost) {
                initMockAuth();
            } else {
                state.auth.mode = 'disabled';
                state.auth.loading = false;
                showToast("System Error: Failed to fetch Firebase configuration from the backend.", "error");
                hideLoadingOverlay();
            }
        });

    setupAuthUIEvents();
}

function initMockAuth() {
    state.auth.mode = 'mock';
    console.log("NITS Academic Insight: Running in Mock Auth Mode.");
    
    // Default to logged-out state so real users can log in on the login screen
    const savedUser = localStorage.getItem('nits_mock_user');
    if (savedUser) {
        try {
            handleAuthState(JSON.parse(savedUser));
        } catch (e) {
            handleAuthState(null);
        }
    } else {
        handleAuthState(null);
    }
    
    hideLoadingOverlay();
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('auth-loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.display = 'none';
    }
}

let unsubscribeProfilesListener = null;

function setupRealtimeDatabaseSync(uid) {
    if (unsubscribeProfilesListener) {
        unsubscribeProfilesListener();
        unsubscribeProfilesListener = null;
    }

    if (!uid || state.auth.mode !== 'firebase') return;

    // Verify Firebase Auth state before attaching listener
    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser || auth.currentUser.uid !== uid) {
        console.warn("setupRealtimeDatabaseSync: Auth not ready or user mismatch. Skipping listener.");
        return;
    }

    const db = getFirebaseDb();
    if (!db) return;

    try {
        const profCol = collection(db, "users", uid, "resultProfiles");
        unsubscribeProfilesListener = onSnapshot(profCol, async (profSnap) => {
            try {
                // Verify user remains authenticated during snapshot execution
                const activeAuth = getFirebaseAuth();
                if (!activeAuth || !activeAuth.currentUser) return;

                const profilesList = [];
                for (const profDoc of profSnap.docs) {
                    const profData = profDoc.data();
                    let calcSnap;
                    try {
                        calcSnap = await getDocs(query(collection(db, "users", uid, "resultProfiles", profDoc.id, "calculations"), orderBy("updatedAt", "desc")));
                    } catch (e) {
                        calcSnap = await getDocs(collection(db, "users", uid, "resultProfiles", profDoc.id, "calculations"));
                    }
                    
                    const calculations = [];
                    calcSnap.forEach(cDoc => {
                        calculations.push({
                            calculationId: cDoc.id,
                            ...cDoc.data()
                        });
                    });

                    // In-memory sort by updatedAt descending
                    calculations.sort((a, b) => {
                        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                        return tB - tA;
                    });

                    profilesList.push({
                        profileId: profDoc.id,
                        ...profData,
                        studentName: profData.studentName || 'Unknown Student',
                        program: profData.program || 'mtech',
                        department: profData.department || 'cse',
                        calculations
                    });
                }

                // Also read from the old flat 'history' collection for backward compatibility
                // These records were saved before the profile system existed
                try {
                    const legacySnap = await getDocs(collection(db, "users", uid, "history"));
                    if (!legacySnap.empty) {
                        const legacyCalcs = [];
                        legacySnap.forEach(lDoc => {
                            const d = lDoc.data();
                            legacyCalcs.push({
                                calculationId: lDoc.id,
                                profileId: 'legacy_prof',
                                resultNickname: d.nickname || d.resultNickname || 'Saved Result',
                                program: d.program || 'mtech',
                                department: d.department || 'cse',
                                semesters: d.semesters,
                                summary: d.summary,
                                calculationMethod: d.calculationMethod,
                                createdAt: d.createdAt,
                                updatedAt: d.updatedAt,
                                isLegacy: true
                            });
                        });
                        // Sort by updatedAt desc
                        legacyCalcs.sort((a, b) => {
                            const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                            const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                            return tB - tA;
                        });
                        if (legacyCalcs.length > 0) {
                            profilesList.push({
                                profileId: 'legacy_prof',
                                studentName: 'My Previous Results',
                                program: 'mtech',
                                department: 'cse',
                                calculations: legacyCalcs,
                                isLegacyGroup: true
                            });
                        }
                    }
                } catch (e) {
                    console.warn('Legacy history read skipped:', e.code || e.message);
                }

                stateProfileHistory = profilesList;
                renderHistoryList();
                if (state.activeTab === 'analysis') {
                    renderAnalysis();
                }
            } catch (err) {
                console.error("Error processing real-time profiles update:", err);
            }
        }, (error) => {
            if (error.code === 'permission-denied') {
                console.warn("Real-time database sync listener paused: User not authenticated or permission restricted.");
            } else {
                console.error("Real-time database sync listener error:", error);
            }
        });
    } catch (err) {
        console.error("Failed to attach real-time database listener:", err);
    }
}


function handleAuthState(user) {
    state.auth.loading = false;
    state.auth.user = user;
    
    const isLoggedIn = !!user;
    
    if (isLoggedIn) {
        if (dom.authContainer) dom.authContainer.style.display = 'none';
        if (dom.appContainer) dom.appContainer.style.display = 'block';
        
        const nav = document.querySelector('.site-nav');
        if (nav) nav.style.display = ''; // Let CSS media queries control nav visibility
        if (dom.resetBtn) dom.resetBtn.style.display = 'inline-flex';
        if (dom.mobLogoutBtn) dom.mobLogoutBtn.style.display = 'block';
        
        const displayName = user.displayName || user.name || user.email.split('@')[0];
        if (dom.mobileUserInfo) {
            dom.mobileUserInfo.textContent = `Logged in as: ${displayName}`;
            dom.mobileUserInfo.style.display = 'block';
        }

        // Update Desktop Header Profile Display
        const profileWrapper = document.getElementById('profile-wrapper');
        if (profileWrapper) {
            profileWrapper.style.display = 'block';
        }
        const avatarEl = document.getElementById('profile-avatar');
        const dropdownAvatarEl = document.getElementById('profile-dropdown-avatar');
        const nameEl = document.getElementById('profile-name');
        const dropdownNameEl = document.getElementById('profile-dropdown-name');
        const dropdownEmailEl = document.getElementById('profile-dropdown-email');
        
        if (user.photoURL) {
            const imgHtml = `<img src="${user.photoURL}" alt="${displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
            if (avatarEl) {
                avatarEl.innerHTML = imgHtml;
                avatarEl.style.padding = '0';
            }
            if (dropdownAvatarEl) {
                dropdownAvatarEl.innerHTML = imgHtml;
                dropdownAvatarEl.style.padding = '0';
            }
        } else {
            const initial = displayName.charAt(0).toUpperCase() || 'U';
            if (avatarEl) {
                avatarEl.textContent = initial;
                avatarEl.style.padding = '';
            }
            if (dropdownAvatarEl) {
                dropdownAvatarEl.textContent = initial;
                dropdownAvatarEl.style.padding = '';
            }
        }
        if (nameEl) nameEl.textContent = displayName;
        if (dropdownNameEl) dropdownNameEl.textContent = displayName;
        if (dropdownEmailEl) dropdownEmailEl.textContent = user.email || '';
        
        // Force-resolve the Firebase ID token before starting Firestore operations.
        // onAuthStateChanged can fire before the token is fully minted on the client,
        // causing permission-denied. getIdToken() guarantees the token is ready.
        user.getIdToken(false).then(() => {
            initCurrentResultFromDraft(user.uid);
            setupRealtimeDatabaseSync(user.uid);
            loadHistoryFromDb();
        }).catch(() => {
            // Token refresh failed — still attempt operations; auth guards inside will handle gracefully
            initCurrentResultFromDraft(user.uid);
            setupRealtimeDatabaseSync(user.uid);
            loadHistoryFromDb();
        });
    } else {
        // Clean up real-time listener and clear memory on logout
        if (unsubscribeProfilesListener) {
            unsubscribeProfilesListener();
            unsubscribeProfilesListener = null;
        }

        stateProfileHistory = [];
        state.currentProfile = { profileId: null, studentName: 'Rohit', program: 'mtech', department: 'cse' };
        state.currentCalculation = { calculationId: null, resultNickname: 'Current Result', isDirty: false, mode: 'normal', situation: 'normal' };
        ['sem1', 'sem2', 'sem3', 'sem4'].forEach(s => { state.semesters[s] = []; });

        renderHistoryList();
        renderAnalysis();

        if (dom.appContainer) dom.appContainer.style.display = 'none';
        if (dom.authContainer) dom.authContainer.style.display = 'block';
        
        const nav = document.querySelector('.site-nav');
        if (nav) nav.style.display = 'none';
        if (dom.resetBtn) dom.resetBtn.style.display = 'none';
        if (dom.mobLogoutBtn) dom.mobLogoutBtn.style.display = 'none';
        
        const hamburger = document.getElementById('hamburger-menu-btn');
        if (hamburger) hamburger.classList.remove('open');
        
        const mobileMenu = document.getElementById('mobile-drawer-menu');
        if (mobileMenu) mobileMenu.classList.remove('open');
        
        if (dom.mobileUserInfo) dom.mobileUserInfo.style.display = 'none';

        // Hide Desktop Header Profile Display and Reset Avatar markup
        const profileWrapper = document.getElementById('profile-wrapper');
        if (profileWrapper) {
            profileWrapper.style.display = 'none';
        }
        const profileDropdown = document.getElementById('profile-dropdown');
        const profileTrigger = document.getElementById('profile-trigger');
        if (profileDropdown) profileDropdown.classList.remove('show');
        if (profileTrigger) profileTrigger.classList.remove('active');

        const avatarEl = document.getElementById('profile-avatar');
        const dropdownAvatarEl = document.getElementById('profile-dropdown-avatar');
        if (avatarEl) {
            avatarEl.innerHTML = 'U';
            avatarEl.style.padding = '';
        }
        if (dropdownAvatarEl) {

            dropdownAvatarEl.innerHTML = 'U';
            dropdownAvatarEl.style.padding = '';
        }
        
        showAuthView('login');
    }
}

function getPredefinedCoursesForActiveSemester() {
    const progVal = document.getElementById('calc-program-select')?.value || 'mtech';
    const deptVal = document.getElementById('calc-department-select')?.value || 'cse';
    
    const prog = ACADEMIC_PROGRAMS[progVal];
    const dept = prog?.departments[deptVal];
    if (!dept) return [];

    return dept.courses[state.activeSemester] || [];
}

function applyPredefinedCourses() {
    const progVal = document.getElementById('calc-program-select')?.value || 'mtech';
    const deptVal = document.getElementById('calc-department-select')?.value || 'cse';

    const prog = ACADEMIC_PROGRAMS[progVal];
    const dept = prog?.departments[deptVal];
    if (!dept) return;

    const structure = dept.courses;
    
    ['sem1', 'sem2', 'sem3', 'sem4'].forEach(semKey => {
        const predefinedList = structure[semKey] || [];
        const currentList = state.semesters[semKey] || [];
        
        const mergedList = predefinedList.map(pre => {
            const existing = currentList.find(c => c.code.toUpperCase() === pre.code.toUpperCase());
            return {
                id: existing ? existing.id : 'course_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                code: pre.code,
                subject: pre.subject,
                courseType: pre.courseType,
                credits: pre.credits,
                grade: existing ? existing.grade : '',
                gradeSource: existing ? existing.gradeSource : '',
                manualGrade: existing ? existing.manualGrade : '',
                attemptType: existing ? existing.attemptType : 'original',
                obtainedMarks: existing ? existing.obtainedMarks : null,
                maximumMarks: existing ? existing.maximumMarks : null,
                source: existing ? existing.source : 'manual'
            };
        });
        
        currentList.forEach(c => {
            const isPredefined = predefinedList.some(pre => pre.code.toUpperCase() === c.code.toUpperCase());
            if (!isPredefined) {
                mergedList.push(c);
            }
        });
        
        state.semesters[semKey] = mergedList;
    });
}

// No-op: profiles have been removed; kept to avoid reference errors from legacy calls
function populateAllProfileSelects() {}

// No-op: profiles have been removed; kept to avoid reference errors from legacy calls
function saveProfilesToStorage() {}

// No-op: profiles have been removed
function loadProfilesFromDb() {}


let autoSaveTimeout = null;


function triggerAutoSave() {
    const statusEl = document.getElementById('auto-save-status');
    if (statusEl) {
        statusEl.textContent = 'Saving...';
        statusEl.style.color = 'var(--muted)';
    }

    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        const uid = state.auth.user ? state.auth.user.uid : null;
        if (!uid) {
            if (statusEl) statusEl.textContent = '';
            return;
        }

        const studentName = dom.calcStudentName?.value || 'Rohit';
        const nickname = dom.calcResultNickname?.value || 'Main Result';
        const program = dom.calcProgramSelect?.value || 'mtech';
        const department = dom.calcDepartmentSelect?.value || 'cse';

        const draft = {
            ownerUid: uid,
            profileId: state.currentProfile.profileId,
            studentName: studentName.trim(),
            calculationId: state.currentCalculation.calculationId,
            resultNickname: nickname.trim(),
            program,
            department,
            semesters: JSON.parse(JSON.stringify(state.semesters)),
            selectedSemesters: state.selectedSemesters,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem(`nits_draft_${uid}`, JSON.stringify(draft));

        if (state.auth.mode === 'firebase') {
            const db = getFirebaseDb();
            const authInst = getFirebaseAuth();
            // Auth guard: only save to Firestore if auth token is confirmed ready
            if (db && authInst && authInst.currentUser && authInst.currentUser.uid === uid) {
                setDoc(doc(db, 'users', uid, 'currentDraft', 'data'), {
                    ...draft,
                    updatedAt: serverTimestamp()
                }, { merge: true })
                .then(() => {
                    if (statusEl) {
                        statusEl.textContent = 'Draft Saved';
                        statusEl.style.color = 'var(--success)';
                    }
                })
                .catch(err => {
                    if (err.code === 'permission-denied') {
                        console.warn('Auto-save draft skipped: Auth token not ready.');
                    } else {
                        console.error('Auto-save draft failed:', err);
                    }
                    if (statusEl) {
                        statusEl.textContent = 'Saved (Local)';
                        statusEl.style.color = 'var(--success)';
                    }
                });
            } else {
                if (statusEl) { statusEl.textContent = 'Saved (Local)'; statusEl.style.color = 'var(--success)'; }
            }
        } else {
            if (statusEl) { statusEl.textContent = 'Saved (Local)'; statusEl.style.color = 'var(--success)'; }
        }
    }, 1000);
}

// Load current draft (on login / on auth state change)
async function initCurrentResultFromDraft(uid) {
    // 1. Try localStorage first for immediate render
    const local = localStorage.getItem(`nits_draft_${uid}`);
    if (local) {
        try {
            const d = JSON.parse(local);
            _applyDraftToState(d);
            calculateAndRefresh();
            render();
        } catch (e) { console.warn("Failed to parse local draft:", e); }
    } else {
        applyPredefinedCourses();
        calculateAndRefresh();
        render();
    }

    // Clear studentName from field after draft load if there is no active calculation being edited
    // This prevents stale 'Rohit' or old names from auto-filling on fresh login
    if (!state.currentCalculation.calculationId) {
        state.currentProfile.studentName = '';
        state.currentProfile.profileId = null;
        if (dom.calcStudentName) dom.calcStudentName.value = '';
        if (dom.currentProfileDisplayBadge) dom.currentProfileDisplayBadge.textContent = 'No Student Selected';
    }

    // 2. Try Firestore for the authoritative draft
    if (state.auth.mode === 'firebase') {
        const auth = getFirebaseAuth();
        if (!auth || !auth.currentUser || auth.currentUser.uid !== uid) {
            return;
        }

        const db = getFirebaseDb();
        if (db) {
            try {
                const snap = await getDoc(doc(db, 'users', uid, 'currentDraft', 'data'));
                if (snap.exists()) {
                    _applyDraftToState(snap.data());
                    localStorage.setItem(`nits_draft_${uid}`, JSON.stringify(snap.data()));
                    calculateAndRefresh();
                    render();
                } else {
                    if (Object.values(state.semesters).every(a => a.length === 0)) {
                        applyPredefinedCourses();
                        calculateAndRefresh();
                        render();
                    }
                }
            } catch (err) {
                if (err.code === 'permission-denied') {
                    console.warn("Firestore draft load skipped: Auth permission denied.");
                } else {
                    console.warn("Firestore draft load failed:", err);
                }
            }
        }
    }

}

function _applyDraftToState(d) {
    if (!d) return;
    state.currentProfile.profileId = d.profileId || null;
    state.currentProfile.studentName = d.studentName || '';  // never auto-fill a name
    state.currentProfile.program = d.program || 'mtech';
    state.currentProfile.department = d.department || 'cse';

    state.currentCalculation.calculationId = d.calculationId || null;
    state.currentCalculation.resultNickname = d.resultNickname || d.nickname || '';
    state.currentCalculation.isDirty = false;

    state.semesters = d.semesters ? JSON.parse(JSON.stringify(d.semesters)) : state.semesters;
    state.selectedSemesters = d.selectedSemesters || state.selectedSemesters;

    if (dom.calcStudentName) dom.calcStudentName.value = state.currentProfile.studentName;
    if (dom.calcResultNickname) dom.calcResultNickname.value = state.currentCalculation.resultNickname;
    if (dom.calcProgramSelect) dom.calcProgramSelect.value = state.currentProfile.program;
    if (dom.calcDepartmentSelect) dom.calcDepartmentSelect.value = state.currentProfile.department;
    if (dom.currentProfileDisplayBadge) dom.currentProfileDisplayBadge.textContent = state.currentProfile.studentName || 'No Student Selected';
}

function loadUserDataFromStorage(uid) {
    initCurrentResultFromDraft(uid);
}

function saveUserDataToStorage() {
    triggerAutoSave();
}

function clearCurrentDraft(uid) {
    if (!uid) return;
    localStorage.removeItem(`nits_draft_${uid}`);
    if (state.auth.mode === 'firebase') {
        const db = getFirebaseDb();
        if (db) {
            deleteDoc(doc(db, 'users', uid, 'currentDraft', 'data')).catch(e => console.warn("Draft clear failed:", e));
        }
    }
}

// ============================================================
// TWO-LEVEL FLOW: STUDENT PROFILE & CALCULATIONS
// ============================================================

// 1. "+ NEW STUDENT" -> Creates a brand new Student Profile
function handleNewStudent() {
    const hasCourses = Object.values(state.semesters).some(arr => arr.some(c => c.grade !== '' && c.grade !== null));
    const doCreate = () => {
        const newProfId = 'prof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const newCalcId = 'result_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

        state.currentProfile = {
            profileId: newProfId,
            studentName: '',          // blank — user enters the student name
            program: dom.calcProgramSelect?.value || 'mtech',
            department: dom.calcDepartmentSelect?.value || 'cse'
        };

        state.currentCalculation = {
            calculationId: newCalcId,
            resultNickname: '',
            isDirty: false,
            mode: 'normal',
            situation: 'normal'
        };

        ['sem1', 'sem2', 'sem3', 'sem4'].forEach(s => { state.semesters[s] = []; });
        state.selectedSemesters = { sem1: false, sem2: false, sem3: false, sem4: false };

        if (dom.calcStudentName) { dom.calcStudentName.value = ''; dom.calcStudentName.focus(); }
        if (dom.calcResultNickname) dom.calcResultNickname.value = '';
        if (dom.currentProfileDisplayBadge) dom.currentProfileDisplayBadge.textContent = 'New Student';

        applyPredefinedCourses();
        calculateAndRefresh();
        render();

        const statusEl = document.getElementById('auto-save-status');
        if (statusEl) statusEl.textContent = '';

        showToast('New Student Profile started. Enter the student name above.', 'info');
    };

    if (hasCourses && state.currentCalculation.isDirty) {
        showConfirmModal(
            'Create a new Student Profile? Unsaved changes in active calculation will be cleared. Saved History will not be affected.',
            doCreate
        );
    } else {
        doCreate();
    }
}

// 2. "+ NEW RESULT" -> Creates a new result under the CURRENT Student Profile
function handleNewResult() {
    // Keep the current student profile — New Result is a new calculation under the SAME student
    const studentName = (dom.calcStudentName?.value || state.currentProfile.studentName || '').trim();
    state.currentProfile.studentName = studentName;
    if (dom.currentProfileDisplayBadge) dom.currentProfileDisplayBadge.textContent = studentName || 'No Student Selected';

    const hasCourses = Object.values(state.semesters).some(arr => arr.some(c => c.grade !== '' && c.grade !== null));
    const doAddCalc = () => {
        if (!state.currentProfile.profileId) {
            state.currentProfile.profileId = 'prof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        }

        const newCalcId = 'result_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        state.currentCalculation = {
            calculationId: newCalcId,
            resultNickname: '',       // blank — user enters the result name
            isDirty: false,
            mode: 'normal',
            situation: 'normal'
        };

        ['sem1', 'sem2', 'sem3', 'sem4'].forEach(s => { state.semesters[s] = []; });
        state.selectedSemesters = { sem1: false, sem2: false, sem3: false, sem4: false };

        if (dom.calcResultNickname) { dom.calcResultNickname.value = ''; dom.calcResultNickname.focus(); }

        applyPredefinedCourses();
        calculateAndRefresh();
        render();

        const statusEl = document.getElementById('auto-save-status');
        if (statusEl) statusEl.textContent = '';

        showToast(`New calculation started under "${studentName || 'current student'}". Enter a result name above.`, 'success');
    };

    if (hasCourses && state.currentCalculation.isDirty) {
        showConfirmModal(
            `Create a new result calculation under "${studentName || 'current student'}"? Unsaved grades in current calculation will be cleared.`,
            doAddCalc
        );
    } else {
        doAddCalc();
    }
}

// 3. Resets ONLY current active calculation draft (does NOT touch profile or saved history)
function resetCurrentResult() {
    showConfirmModal(
        'Reset current calculation workspace? Unsaved grades will be cleared. Saved History records will remain untouched.',
        () => {
            const uid = state.auth.user ? state.auth.user.uid : null;
            state.currentCalculation.calculationId = null;
            state.currentCalculation.resultNickname = 'Current Result';
            state.currentCalculation.isDirty = false;

            if (dom.calcResultNickname) dom.calcResultNickname.value = 'Current Result';

            ['sem1', 'sem2', 'sem3', 'sem4'].forEach(s => { state.semesters[s] = []; });
            applyPredefinedCourses();
            calculateAndRefresh();
            render();

            if (uid) clearCurrentDraft(uid);
            showToast('Current calculation reset.', 'success');
        }
    );
}

// 4. Save current calculation to History under its Student Profile
async function saveCurrentToHistory(asNew = false) {
    const uid = state.auth.user ? state.auth.user.uid : null;
    if (!uid) {
        showToast("Please login to save records.", "error");
        return;
    }

    const studentName = (dom.calcStudentName?.value || '').trim();
    if (!studentName) {
        showToast("Please enter a Student Profile Name before saving.", "warning");
        if (dom.calcStudentName) dom.calcStudentName.focus();
        return;
    }

    const resultNickname = (dom.calcResultNickname?.value || '').trim();
    if (!resultNickname) {
        showToast("Please enter a Result Nickname before saving.", "warning");
        if (dom.calcResultNickname) dom.calcResultNickname.focus();
        return;
    }

    const program = dom.calcProgramSelect?.value || 'mtech';
    const department = dom.calcDepartmentSelect?.value || 'cse';
    state.currentProfile.studentName = studentName;
    state.currentProfile.program = program;
    state.currentProfile.department = department;
    state.currentCalculation.resultNickname = resultNickname;

    const semestersSnapshot = JSON.parse(JSON.stringify(state.semesters));

    // Calculate metrics
    const originalSemesters = state.semesters;
    state.semesters = semestersSnapshot;
    const overall = calculateCombined(['sem1', 'sem2', 'sem3', 'sem4']);
    state.semesters = originalSemesters;

    const summary = {
        overallCGPA: overall.cgpa,
        percentage: overall.percentage,
        totalCredits: overall.totalCredits,
        activeBacklogs: overall.backlogs
    };

    try {
        let profileId = state.currentProfile.profileId || ('prof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
        let calcId = (asNew || !state.currentCalculation.calculationId) 
            ? ('result_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5))
            : state.currentCalculation.calculationId;
            
        state.currentProfile.profileId = profileId;

        if (state.auth.mode === 'firebase') {
            const db = getFirebaseDb();
            if (db) {
                // Save Profile Doc
                await setDoc(doc(db, "users", uid, "resultProfiles", profileId), {
                    ownerUid: uid,
                    studentName,
                    program,
                    department,
                    updatedAt: serverTimestamp()
                }, { merge: true });

                // Save Calculation Doc
                const calcPayload = {
                    profileId,
                    ownerUid: uid,
                    resultNickname,
                    program,
                    department,
                    semesters: semestersSnapshot,
                    summary,
                    calculationMethod: state.calculationMethod,
                    mode: dom.calcLockStructure?.checked ? 'normal' : 'advanced',
                    updatedAt: serverTimestamp()
                };

                await setDoc(doc(db, "users", uid, "resultProfiles", profileId, "calculations", calcId), calcPayload, { merge: true });
                showToast(asNew ? `Saved as NEW result "${resultNickname}" under "${studentName}".` : `Saved result "${resultNickname}" under "${studentName}".`, "success");
            }
        } else {
            // Mock Mode
            let mockProfiles = JSON.parse(localStorage.getItem(`nits_mock_result_profiles_${uid}`) || '[]');
            let existingProf = mockProfiles.find(p => p.profileId === profileId);

            if (!existingProf) {
                existingProf = {
                    profileId,
                    studentName,
                    program,
                    department,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    calculations: []
                };
                mockProfiles.unshift(existingProf);
            } else {
                existingProf.studentName = studentName;
                existingProf.updatedAt = Date.now();
            }

            const existingCalcIdx = (existingProf.calculations || []).findIndex(c => c.calculationId === calcId);
            const calcObj = {
                calculationId: calcId,
                profileId,
                resultNickname,
                program,
                department,
                semesters: semestersSnapshot,
                summary,
                calculationMethod: state.calculationMethod,
                mode: dom.calcLockStructure?.checked ? 'normal' : 'advanced',
                createdAt: existingCalcIdx !== -1 ? existingProf.calculations[existingCalcIdx].createdAt : Date.now(),
                updatedAt: Date.now()
            };

            if (existingCalcIdx !== -1) {
                existingProf.calculations[existingCalcIdx] = calcObj;
            } else {
                existingProf.calculations.unshift(calcObj);
            }

            localStorage.setItem(`nits_mock_result_profiles_${uid}`, JSON.stringify(mockProfiles));
            showToast(`Saved result "${resultNickname}" under "${studentName}".`, "success");
        }

        clearCurrentDraft(uid);
        state.currentCalculation.isDirty = false;

        // Post-save: keep the student profile active, reset only the result/calculation fields
        // This lets user immediately start a NEW result under the SAME student profile
        state.currentCalculation.calculationId = null;
        state.currentCalculation.resultNickname = '';
        ['sem1', 'sem2', 'sem3', 'sem4'].forEach(s => { state.semesters[s] = []; });

        // Update UI fields — keep student name/profile, clear result name
        if (dom.calcResultNickname) dom.calcResultNickname.value = '';

        applyPredefinedCourses();
        calculateAndRefresh();
        render();

        const statusEl = document.getElementById('auto-save-status');
        if (statusEl) { statusEl.textContent = 'Result Saved ✓'; statusEl.style.color = 'var(--success)'; }

        await loadHistoryFromDb();
    } catch (err) {
        console.error("Error saving result to database:", err);
        showToast("Error saving calculation: " + err.message, "error");
    }
}




function showAuthView(view) {
    if (dom.loginView) dom.loginView.style.display = view === 'login' ? 'block' : 'none';
    if (dom.signupView) dom.signupView.style.display = view === 'signup' ? 'block' : 'none';
    if (dom.forgotView) dom.forgotView.style.display = view === 'forgot' ? 'block' : 'none';
}

function setupAuthUIEvents() {
    // View toggles
    const toSignupBtn = document.getElementById('to-signup-btn');
    const toLoginBtn = document.getElementById('to-login-btn');
    const toForgotBtn = document.getElementById('to-forgot-btn');
    const forgotToLoginBtn = document.getElementById('forgot-to-login-btn');

    if (toSignupBtn) toSignupBtn.addEventListener('click', e => { e.preventDefault(); showAuthView('signup'); });
    if (toLoginBtn) toLoginBtn.addEventListener('click', e => { e.preventDefault(); showAuthView('login'); });
    if (toForgotBtn) toForgotBtn.addEventListener('click', e => { e.preventDefault(); showAuthView('forgot'); });
    if (forgotToLoginBtn) forgotToLoginBtn.addEventListener('click', e => { e.preventDefault(); showAuthView('login'); });

    // Password toggles
    document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
        btn.addEventListener('click', () => {
            const wrapper = btn.closest('.password-input-wrapper');
            if (!wrapper) return;
            const input = wrapper.querySelector('input[type="password"], input[type="text"]');
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        });
    });

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', e => {
            e.preventDefault();
            handleLogin();
        });
    }

    // Signup form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', e => {
            e.preventDefault();
            handleSignup();
        });
    }

    // Forgot password form
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', e => {
            e.preventDefault();
            handleForgotReset();
        });
    }

    // Google auth buttons
    const loginGoogleBtn = document.getElementById('login-google-btn');
    const signupGoogleBtn = document.getElementById('signup-google-btn');
    if (loginGoogleBtn) loginGoogleBtn.addEventListener('click', handleGoogleLogin);
    if (signupGoogleBtn) signupGoogleBtn.addEventListener('click', handleGoogleLogin);

    // Logout buttons
    const pdLogoutBtn = document.getElementById('pd-logout-btn');
    if (pdLogoutBtn) pdLogoutBtn.addEventListener('click', e => { e.preventDefault(); handleLogout(); });
    if (dom.mobLogoutBtn) dom.mobLogoutBtn.addEventListener('click', e => { e.preventDefault(); handleLogout(); });

    // Desktop Profile Dropdown Toggle Logic
    const profileTrigger = document.getElementById('profile-trigger');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (profileTrigger && profileDropdown) {
        profileTrigger.addEventListener('click', e => {
            e.stopPropagation();
            const showDropdown = !profileDropdown.classList.contains('show');
            if (showDropdown) {
                profileDropdown.classList.add('show');
                profileTrigger.classList.add('active');
            } else {
                profileDropdown.classList.remove('show');
                profileTrigger.classList.remove('active');
            }
        });

        // Close dropdown when clicking dropdown items
        profileDropdown.querySelectorAll('.profile-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                profileDropdown.classList.remove('show');
                profileTrigger.classList.remove('active');
            });
        });

        // Close dropdown on click outside
        document.addEventListener('click', e => {
            if (!e.target.closest('#profile-wrapper')) {
                profileDropdown.classList.remove('show');
                profileTrigger.classList.remove('active');
            }
        });

        // Close dropdown on Escape key
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                profileDropdown.classList.remove('show');
                profileTrigger.classList.remove('active');
            }
        });
    }
}

function validateEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showInlineError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideInlineError(id) {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function toggleButtonLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const textEl = btn.querySelector('.btn-text');
    const spinnerEl = btn.querySelector('.btn-spinner');
    btn.disabled = isLoading;
    if (textEl) textEl.style.display = isLoading ? 'none' : 'inline';
    if (spinnerEl) spinnerEl.style.display = isLoading ? 'inline-block' : 'none';
}

function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('login-remember')?.checked ?? true;

    hideInlineError('login-email-error');
    hideInlineError('login-password-error');

    let valid = true;
    if (!email) { showInlineError('login-email-error', 'Email is required.'); valid = false; }
    else if (!validateEmailFormat(email)) { showInlineError('login-email-error', 'Please enter a valid email address.'); valid = false; }
    if (!password) { showInlineError('login-password-error', 'Password is required.'); valid = false; }
    if (!valid) return;

    toggleButtonLoading('login-submit-btn', true);

    window.AuthService.login(email, password, remember)
        .then(() => {
            showToast("Welcome back!", "success");
        })
        .catch(err => {
            console.error("Login failed:", err);
            const friendlyMsg = getAuthErrorMessage(err);
            showInlineError('login-email-error', friendlyMsg);
        })
        .finally(() => {
            toggleButtonLoading('login-submit-btn', false);
        });
}

function handleSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const terms = document.getElementById('signup-terms')?.checked;

    hideInlineError('signup-name-error');
    hideInlineError('signup-email-error');
    hideInlineError('signup-password-error');
    hideInlineError('signup-confirm-password-error');
    hideInlineError('signup-terms-error');

    let valid = true;
    if (!name) { showInlineError('signup-name-error', 'Full name is required.'); valid = false; }
    if (!email) { showInlineError('signup-email-error', 'Email is required.'); valid = false; }
    else if (!validateEmailFormat(email)) { showInlineError('signup-email-error', 'Please enter a valid email address.'); valid = false; }
    if (!password) { showInlineError('signup-password-error', 'Password is required.'); valid = false; }
    else if (password.length < 8) { showInlineError('signup-password-error', 'Password must be at least 8 characters.'); valid = false; }
    if (password !== confirmPassword) { showInlineError('signup-confirm-password-error', 'Passwords do not match.'); valid = false; }
    if (!terms) { showInlineError('signup-terms-error', 'You must accept the terms and conditions.'); valid = false; }
    if (!valid) return;

    toggleButtonLoading('signup-submit-btn', true);

    window.AuthService.signup(name, email, password)
        .then(() => {
            showToast("Account created successfully! Welcome.", "success");
        })
        .catch(err => {
            console.error("Signup failed:", err);
            const friendlyMsg = getAuthErrorMessage(err);
            showInlineError('signup-email-error', friendlyMsg);
        })
        .finally(() => {
            toggleButtonLoading('signup-submit-btn', false);
        });
}

function handleForgotReset() {
    const email = document.getElementById('forgot-email').value.trim();
    hideInlineError('forgot-email-error');

    if (!email) {
        showInlineError('forgot-email-error', 'Email is required.');
        return;
    } else if (!validateEmailFormat(email)) {
        showInlineError('forgot-email-error', 'Please enter a valid email address.');
        return;
    }

    toggleButtonLoading('forgot-submit-btn', true);

    window.AuthService.resetPassword(email)
        .then(() => {
            showToast("Password reset email sent successfully!", "success");
            showAuthView('login');
        })
        .catch(err => {
            console.error("Password reset failed:", err);
            const friendlyMsg = getAuthErrorMessage(err);
            showInlineError('forgot-email-error', friendlyMsg);
        })
        .finally(() => {
            toggleButtonLoading('forgot-submit-btn', false);
        });
}

function handleGoogleLogin() {
    const activeBtnId = dom.loginView && dom.loginView.style.display !== 'none' ? 'login-google-btn' : 'signup-google-btn';
    toggleButtonLoading(activeBtnId, true);

    window.AuthService.loginWithGoogle()
        .then(() => {
            showToast("Successfully authenticated via Google!", "success");
        })
        .catch(err => {
            console.error("Google authentication failed:", err);
            showToast(getAuthErrorMessage(err), "error");
        })
        .finally(() => {
            toggleButtonLoading(activeBtnId, false);
        });
}

function handleLogout() {
    showConfirmModal("Are you sure you want to sign out?", () => {
        localStorage.removeItem('nits_mock_user');
        sessionStorage.removeItem('nits_mock_user');
        window.AuthService.logout()
            .then(() => {
                showToast("Successfully signed out.", "success");
                handleAuthState(null);
            })
            .catch(err => {
                console.error("Logout failed:", err);
                handleAuthState(null);
            });
    });
}

// ====================================================
// PART 8: ACADEMIC HISTORY & REPORT SYSTEM
// ====================================================
let stateHistory = [];
let editingHistoryRecord = null;
let viewingHistoryRecord = null;
// Carries the public-lookup record context when the user clicks "Save to My History"
// so saveHistoryRecord can pull name/roll from it rather than from removed modal inputs.
let pendingSavePublicRecord = null;

// Initialize history controls & event listeners
window.initHistorySystem = function() {
    if (!dom.saveCurrentHistoryBtn) return; // Prevent double registration

    // Save calculator snapshot triggers
    dom.saveCurrentHistoryBtn.addEventListener('click', () => {
        // Pre-fill nickname from the active profile's nickname
        const activeProf = state.profiles.find(p => p.id === state.activeProfileId);
        const defaultNickname = activeProf ? (activeProf.nickname || 'My M.Tech Result') : 'My M.Tech Result';
        dom.saveHistoryNicknameInput.value = defaultNickname;
        dom.saveHistorySourceType.value = 'own';
        pendingSavePublicRecord = null; // Saving own current result, no public record context
        dom.saveHistoryModal.style.display = 'flex';
    });
    
    dom.closeSaveHistoryModalBtn.addEventListener('click', () => {
        dom.saveHistoryModal.style.display = 'none';
    });
    dom.btnCancelSaveHistoryModal.addEventListener('click', () => {
        dom.saveHistoryModal.style.display = 'none';
    });
    
    dom.btnConfirmSaveHistoryModal.addEventListener('click', () => {
        const nickname = (dom.saveHistoryNicknameInput.value || '').trim();
        const sourceType = dom.saveHistorySourceType.value;

        if (!nickname) {
            showToast("Please enter a private nickname for this snapshot.", "warning");
            return;
        }

        let name = '';
        let roll = '';

        if (sourceType === 'viewed' && pendingSavePublicRecord) {
            // Saving a public lookup result — use its own student data
            name = pendingSavePublicRecord.studentName || '';
            roll = pendingSavePublicRecord.studentId || '';
        } else {
            // Saving own current result — pull from the active profile
            const activeProf = state.profiles.find(p => p.id === state.activeProfileId);
            name = activeProf ? (activeProf.studentName || '') : '';
            roll = activeProf ? (activeProf.rollNumber || '') : '';
        }

        saveHistoryRecord(nickname, name, roll, sourceType);
    });
    
    // Search history inputs
    dom.historySearchInput.addEventListener('input', () => {
        renderHistoryList();
    });
    dom.historyFilterType.addEventListener('change', () => {
        renderHistoryList();
    });
    dom.historySort.addEventListener('change', () => {
        renderHistoryList();
    });
    
    // Start calculating empty state button
    dom.historyStartCalcBtn.addEventListener('click', () => {
        const calcLink = document.getElementById('nav-calc-btn');
        if (calcLink) calcLink.click();
    });
    
    // Lookup Student ID
    dom.btnLookupStudent.addEventListener('click', async () => {
        const studentId = dom.lookupStudentId.value.trim();
        if (!studentId) {
            showToast("Please enter a Student ID.", "warning");
            return;
        }
        
        toggleButtonLoading('btn-lookup-student', true);
        try {
            if (state.auth.mode === 'firebase') {
                const db = getFirebaseDb();
                if (db) {
                    const docSnap = await getDoc(doc(db, "publicProfiles", studentId));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        
                        // Map private nickname if it exists
                        const uid = state.auth.user.uid;
                        const nickSnap = await getDoc(doc(db, "users", uid, "nicknames", studentId));
                        const privateNickname = nickSnap.exists() ? nickSnap.data().nickname : '';
                        
                        const record = {
                            id: studentId,
                            studentId: data.studentId,
                            studentName: data.studentName,
                            semesters: data.semesters,
                            summary: data.summary,
                            nickname: privateNickname,
                            isPublicLookup: true,
                            sourceType: 'viewed',
                            version: 1
                        };
                        openHistoryDetail(record);
                        showToast(`Retrieved record for Roll Number: ${studentId}`, "success");
                    } else {
                        showToast(`No public academic record found for Student ID: ${studentId}`, "warning");
                    }
                }
            } else {
                // Mock lookup
                const publicProfiles = JSON.parse(localStorage.getItem('nits_mock_public_profiles') || '{}');
                if (publicProfiles[studentId]) {
                    const data = publicProfiles[studentId];
                    const mockNicks = JSON.parse(localStorage.getItem(`nits_mock_nicknames_${state.auth.user.uid}`) || '{}');
                    const privateNickname = mockNicks[studentId] || '';
                    
                    const record = {
                        id: studentId,
                        studentId: data.studentId,
                        studentName: data.studentName,
                        semesters: data.semesters,
                        summary: data.summary,
                        nickname: privateNickname,
                        isPublicLookup: true,
                        sourceType: 'viewed',
                        version: 1
                    };
                    openHistoryDetail(record);
                    showToast(`Mock lookup: retrieved record for ${studentId}`, "success");
                } else {
                    showToast(`No public academic record found for Student ID: ${studentId}`, "warning");
                }
            }
        } catch (err) {
            console.error("Lookup error:", err);
            showToast("Lookup failed: " + err.message, "error");
        } finally {
            toggleButtonLoading('btn-lookup-student', false);
        }
    });
    
    // Details Modal
    dom.closeHistDetailBtn.addEventListener('click', () => {
        dom.historyDetailModal.style.display = 'none';
    });
    dom.btnHistDetailClose.addEventListener('click', () => {
        dom.historyDetailModal.style.display = 'none';
    });
    dom.btnHistDetailPdf.addEventListener('click', () => {
        if (viewingHistoryRecord) {
            downloadReportPDF(viewingHistoryRecord);
            showToast("PDF report downloaded successfully.", "success");
        }
    });
    dom.btnHistDetailCsv.addEventListener('click', () => {
        if (viewingHistoryRecord) {
            downloadReportCSV(viewingHistoryRecord);
        }
    });
    
    // Edit Modal
    if (dom.closeHistoryEditBtn) {
        dom.closeHistoryEditBtn.addEventListener('click', () => {
            dom.historyEditModal.style.display = 'none';
        });
    }
    if (dom.btnCancelEditHistory) {
        dom.btnCancelEditHistory.addEventListener('click', () => {
            dom.historyEditModal.style.display = 'none';
        });
    }
    
    if (dom.btnSaveChangesHistory) {
        dom.btnSaveChangesHistory.addEventListener('click', () => {
            if (editingHistoryRecord) {
                const nickname = dom.editHistNicknameInput ? dom.editHistNicknameInput.value : '';
                const name = dom.editHistNameInput ? dom.editHistNameInput.value : '';
                const roll = dom.editHistRollInput ? dom.editHistRollInput.value : '';
                updateHistoryRecord(editingHistoryRecord.calculationId || editingHistoryRecord.id, nickname, name, roll, editingHistoryRecord.semesters, false);
            }
        });
    }
    
    if (dom.btnSaveAsNewHistory) {
        dom.btnSaveAsNewHistory.addEventListener('click', () => {
            if (editingHistoryRecord) {
                const nickname = dom.editHistNicknameInput ? dom.editHistNicknameInput.value : '';
                const name = dom.editHistNameInput ? dom.editHistNameInput.value : '';
                const roll = dom.editHistRollInput ? dom.editHistRollInput.value : '';
                updateHistoryRecord(editingHistoryRecord.calculationId || editingHistoryRecord.id, nickname, name, roll, editingHistoryRecord.semesters, true);
            }
        });
    }
};

async function updateHistoryRecord(calcId, nickname, name, roll, semesters, isNew = false) {
    const uid = state.auth.user ? state.auth.user.uid : null;
    if (!uid) {
        showToast("Please login to update history.", "error");
        return;
    }

    try {
        const originalSemesters = state.semesters;
        state.semesters = semesters;
        const overall = calculateCombined(['sem1', 'sem2', 'sem3', 'sem4']);
        state.semesters = originalSemesters;

        const summary = {
            overallCGPA: overall.cgpa,
            percentage: overall.percentage,
            totalCredits: overall.totalCredits,
            activeBacklogs: overall.backlogs
        };

        if (state.auth.mode === 'firebase') {
            const db = getFirebaseDb();
            if (db && editingHistoryRecord) {
                const profileId = editingHistoryRecord.profileId || 'legacy_prof';
                const targetCalcId = isNew ? ('result_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)) : calcId;

                if (profileId === 'legacy_prof') {
                    const calcPayload = {
                        nickname: (nickname || 'Result').trim(),
                        resultNickname: (nickname || 'Result').trim(),
                        semesters,
                        summary,
                        updatedAt: serverTimestamp()
                    };
                    if (isNew) {
                        await addDoc(collection(db, "users", uid, "history"), { ...calcPayload, createdAt: serverTimestamp() });
                    } else {
                        await setDoc(doc(db, "users", uid, "history", targetCalcId), calcPayload, { merge: true });
                    }
                } else {
                    const calcPayload = {
                        profileId,
                        ownerUid: uid,
                        resultNickname: (nickname || 'Result').trim(),
                        semesters,
                        summary,
                        updatedAt: serverTimestamp()
                    };
                    await setDoc(doc(db, "users", uid, "resultProfiles", profileId, "calculations", targetCalcId), calcPayload, { merge: true });
                }
                showToast(isNew ? `Saved as new result "${nickname}".` : `Updated result "${nickname}".`, "success");
            }
        }

        if (dom.historyEditModal) dom.historyEditModal.style.display = 'none';
        await loadHistoryFromDb();
    } catch (err) {
        console.error("Error updating history record:", err);
        showToast("Failed to update history: " + err.message, "error");
    }
}

// Fetch user student profiles and their nested calculations from database
window.loadHistoryFromDb = async function() {
    const uid = state.auth.user ? state.auth.user.uid : null;
    if (!uid) {
        stateProfileHistory = [];
        renderHistoryList();
        return;
    }
    
    if (state.auth.mode === 'firebase') {
        const auth = getFirebaseAuth();
        if (!auth || !auth.currentUser || auth.currentUser.uid !== uid) {
            return;
        }

        const db = getFirebaseDb();
        if (db) {
            try {
                const profilesList = [];
                const profSnap = await getDocs(collection(db, "users", uid, "resultProfiles"));
                
                for (const profDoc of profSnap.docs) {
                    const profData = profDoc.data();
                    let calcSnap;
                    try {
                        calcSnap = await getDocs(query(collection(db, "users", uid, "resultProfiles", profDoc.id, "calculations"), orderBy("updatedAt", "desc")));
                    } catch (e) {
                        calcSnap = await getDocs(collection(db, "users", uid, "resultProfiles", profDoc.id, "calculations"));
                    }
                    
                    const calculations = [];
                    calcSnap.forEach(cDoc => {
                        calculations.push({
                            calculationId: cDoc.id,
                            ...cDoc.data()
                        });
                    });

                    // In-memory sort by updatedAt descending
                    calculations.sort((a, b) => {
                        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                        return tB - tA;
                    });
                    
                    profilesList.push({
                        profileId: profDoc.id,
                        ...profData,
                        studentName: profData.studentName || 'Unknown Student',
                        program: profData.program || 'mtech',
                        department: profData.department || 'cse',
                        calculations
                    });
                }

                // Also read from the old flat 'history' collection for backward compatibility
                try {
                    const legacySnap = await getDocs(collection(db, "users", uid, "history"));
                    if (!legacySnap.empty) {
                        const legacyCalcs = [];
                        legacySnap.forEach(lDoc => {
                            const d = lDoc.data();
                            legacyCalcs.push({
                                calculationId: lDoc.id,
                                profileId: 'legacy_prof',
                                resultNickname: d.nickname || d.resultNickname || 'Saved Result',
                                program: d.program || 'mtech',
                                department: d.department || 'cse',
                                semesters: d.semesters,
                                summary: d.summary,
                                calculationMethod: d.calculationMethod,
                                createdAt: d.createdAt,
                                updatedAt: d.updatedAt,
                                isLegacy: true
                            });
                        });
                        legacyCalcs.sort((a, b) => {
                            const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                            const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                            return tB - tA;
                        });
                        if (legacyCalcs.length > 0) {
                            profilesList.push({
                                profileId: 'legacy_prof',
                                studentName: 'My Previous Results',
                                program: 'mtech',
                                department: 'cse',
                                calculations: legacyCalcs,
                                isLegacyGroup: true
                            });
                        }
                    }
                } catch (e) {
                    console.warn('Legacy history read skipped:', e.code || e.message);
                }

                stateProfileHistory = profilesList;
                renderHistoryList();
            } catch (err) {
                if (err.code === 'permission-denied') {
                    console.warn("loadHistoryFromDb skipped: Permission denied (User not authenticated).");
                } else {
                    console.error("Error loading profiles and calculations from Firestore:", err);
                }
            }
        }
    } else {
        // Mock Mode
        const mockData = localStorage.getItem(`nits_mock_result_profiles_${uid}`);
        stateProfileHistory = mockData ? JSON.parse(mockData) : [];
        renderHistoryList();
    }
};


// Delete a calculation inside a profile
async function deleteCalculationRecord(profileId, calculationId) {
    const uid = state.auth.user ? state.auth.user.uid : null;
    if (!uid) {
        showToast("You must be logged in to delete calculations.", "error");
        return;
    }
    
    showConfirmModal("Delete this calculation? This exact result will be permanently removed from the database.", async () => {
        showToast("Deleting calculation from database...", "info");
        try {
            if (state.auth.mode === 'firebase') {
                const db = getFirebaseDb();
                if (!db) throw new Error("Database service unavailable.");

                if (profileId === 'legacy_prof') {
                    await deleteDoc(doc(db, "users", uid, "history", calculationId));
                } else {
                    await deleteDoc(doc(db, "users", uid, "resultProfiles", profileId, "calculations", calculationId));
                }
                showToast("Calculation deleted successfully from database.", "success");
            } else {
                let mockProfiles = JSON.parse(localStorage.getItem(`nits_mock_result_profiles_${uid}`) || '[]');
                const prof = mockProfiles.find(p => p.profileId === profileId);
                if (prof) {
                    prof.calculations = (prof.calculations || []).filter(c => c.calculationId !== calculationId);
                }
                localStorage.setItem(`nits_mock_result_profiles_${uid}`, JSON.stringify(mockProfiles));
                showToast("Mock calculation deleted.", "success");
            }
            await loadHistoryFromDb();
        } catch (err) {
            console.error("Error deleting calculation record from database:", err);
            showToast("Could not delete calculation: " + err.message, "error");
        }
    });
}

// Delete an entire student profile and all its calculations (Cascading Delete)
async function deleteProfileRecord(profileId, studentName) {
    const uid = state.auth.user ? state.auth.user.uid : null;
    if (!uid) {
        showToast("You must be logged in to delete profiles.", "error");
        return;
    }

    showConfirmModal(`Delete profile "${studentName}" and ALL of its associated calculation records from the database?`, async () => {
        showToast(`Deleting profile "${studentName}" and all associated results...`, "info");
        try {
            if (state.auth.mode === 'firebase') {
                const db = getFirebaseDb();
                if (!db) throw new Error("Database service unavailable.");

                if (profileId !== 'legacy_prof') {
                    // Cascading Delete: Delete all subcollection calculation documents first
                    const calcSnap = await getDocs(collection(db, "users", uid, "resultProfiles", profileId, "calculations"));
                    for (const cDoc of calcSnap.docs) {
                        await deleteDoc(doc(db, "users", uid, "resultProfiles", profileId, "calculations", cDoc.id));
                    }
                    // Delete parent Profile document
                    await deleteDoc(doc(db, "users", uid, "resultProfiles", profileId));
                    showToast(`Profile "${studentName}" and all results permanently deleted from database.`, "success");
                }
            } else {
                let mockProfiles = JSON.parse(localStorage.getItem(`nits_mock_result_profiles_${uid}`) || '[]');
                mockProfiles = mockProfiles.filter(p => p.profileId !== profileId);
                localStorage.setItem(`nits_mock_result_profiles_${uid}`, JSON.stringify(mockProfiles));
                showToast(`Profile "${studentName}" deleted.`, "success");
            }
            await loadHistoryFromDb();
        } catch (err) {
            console.error("Error deleting profile record from database:", err);
            showToast("Could not delete profile: " + err.message, "error");
        }
    });
}


// Edit Student Profile Name
async function renameProfileRecord(profileId, currentName) {
    const uid = state.auth.user ? state.auth.user.uid : null;
    if (!uid) return;

    const newName = prompt("Enter new Student Profile Name:", currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    const updatedName = newName.trim();
    try {
        if (state.auth.mode === 'firebase') {
            const db = getFirebaseDb();
            if (db && profileId !== 'legacy_prof') {
                await setDoc(doc(db, "users", uid, "resultProfiles", profileId), {
                    studentName: updatedName,
                    updatedAt: serverTimestamp()
                }, { merge: true });
                showToast(`Profile renamed to "${updatedName}".`, "success");
            }
        } else {
            let mockProfiles = JSON.parse(localStorage.getItem(`nits_mock_result_profiles_${uid}`) || '[]');
            const prof = mockProfiles.find(p => p.profileId === profileId);
            if (prof) {
                prof.studentName = updatedName;
            }
            localStorage.setItem(`nits_mock_result_profiles_${uid}`, JSON.stringify(mockProfiles));
            showToast(`Profile renamed to "${updatedName}".`, "success");
        }

        if (state.currentProfile.profileId === profileId) {
            state.currentProfile.studentName = updatedName;
            if (dom.calcStudentName) dom.calcStudentName.value = updatedName;
            if (dom.currentProfileDisplayBadge) dom.currentProfileDisplayBadge.textContent = updatedName;
        }

        await loadHistoryFromDb();
    } catch (err) {
        console.error("Error renaming profile:", err);
        showToast("Error renaming profile: " + err.message, "error");
    }
}

function formatAcademicDate(timestamp) {
    if (!timestamp) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    let d;
    if (typeof timestamp === 'object' && timestamp.seconds) {
        d = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
        d = timestamp.toDate();
    } else {
        d = new Date(timestamp);
    }
    if (isNaN(d.getTime())) {
        d = new Date();
    }
    return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Render History Grouped by Student Profile
function renderHistoryList() {
    const container = dom.historyItemsContainer;
    container.innerHTML = '';
    
    const searchQuery = dom.historySearchInput ? dom.historySearchInput.value.toLowerCase().trim() : '';
    
    let profilesToRender = [...stateProfileHistory];
    
    // Filter profiles matching search query
    if (searchQuery) {
        profilesToRender = profilesToRender.filter(prof => {
            const matchesProfName = (prof.studentName || '').toLowerCase().includes(searchQuery);
            const matchesProg = (prof.program || '').toLowerCase().includes(searchQuery);
            const matchesDept = (prof.department || '').toLowerCase().includes(searchQuery);
            
            const matchesCalcs = (prof.calculations || []).some(calc => {
                return (calc.resultNickname || '').toLowerCase().includes(searchQuery);
            });
            
            return matchesProfName || matchesProg || matchesDept || matchesCalcs;
        });
    }

    // Filter profiles that have calculations
    profilesToRender = profilesToRender.filter(prof => prof.calculations && prof.calculations.length > 0);

    // Rename any profiles that still have the legacy placeholder name from old migration code
    profilesToRender = profilesToRender.map(prof => {
        if (prof.studentName === 'Saved Snapshots (Legacy)' || prof.studentName === '') {
            return { ...prof, studentName: 'My Results', _wasLegacy: true };
        }
        return prof;
    });

    
    if (profilesToRender.length === 0) {
        container.style.display = 'none';
        if (dom.historyEmptyState) dom.historyEmptyState.style.display = 'block';
        return;
    }
    
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    if (dom.historyEmptyState) dom.historyEmptyState.style.display = 'none';
    
    profilesToRender.forEach(prof => {
        const profCard = document.createElement('div');
        profCard.className = 'history-card profile-group-card';
        profCard.style.border = '1.5px solid var(--border)';
        profCard.style.borderRadius = 'var(--r-md)';
        profCard.style.background = 'var(--surface)';
        profCard.style.boxShadow = 'var(--shadow-sm)';
        profCard.style.padding = '16px';

        const progName = prof.program ? (ACADEMIC_PROGRAMS[prof.program]?.name || prof.program) : 'M.Tech';
        const deptName = prof.department ? (ACADEMIC_PROGRAMS.mtech?.departments[prof.department]?.name || prof.department) : 'Computer Science and Engineering';
        const calcCount = (prof.calculations || []).length;
        const calcCountLabel = `${calcCount} ${calcCount === 1 ? 'Calculation' : 'Calculations'}`;

        profCard.innerHTML = `
            <div class="profile-card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:12px;">
                <div>
                    <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-main, var(--text)); margin:0; display:flex; align-items:center; gap:8px;">
                        <span>${prof.studentName || 'Student Profile'}</span>
                        ${prof.profileId !== 'legacy_prof' ? `<button type="button" class="history-action-btn edit-prof-name-btn" style="padding:2px 6px; font-size:0.75rem;" title="Rename Profile">✏️ Edit Name</button>` : ''}
                    </h3>
                    <p style="font-size:0.8rem; color:var(--muted); margin:4px 0 0 0;">${progName} • ${deptName}</p>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="history-card-badge badge-own" style="background:var(--primary-light, #eef2ff); color:var(--primary); font-weight:700;">${calcCountLabel}</span>
                    <button type="button" class="btn btn-secondary btn-sm toggle-calc-list-btn" style="font-size:0.8rem; padding:4px 10px;">View Results ▼</button>
                    ${prof.profileId !== 'legacy_prof' ? `<button type="button" class="history-action-btn history-action-btn-danger delete-prof-btn" style="padding:4px 8px; font-size:0.75rem;" title="Delete Profile">&times; Delete Profile</button>` : ''}
                </div>
            </div>
            
            <div class="profile-calc-list" style="display:flex; flex-direction:column; gap:10px;">
                ${prof.calculations.map(calc => {
                    const sum = calc.summary || {};
                    const cgpaStr = sum.overallCGPA !== undefined && sum.overallCGPA !== null ? Number(sum.overallCGPA).toFixed(2) : '—';
                    const creditsStr = sum.totalCredits !== undefined && sum.totalCredits !== null ? String(sum.totalCredits) : '—';
                    const backlogsStr = sum.activeBacklogs !== undefined && sum.activeBacklogs !== null ? String(sum.activeBacklogs) : '—';
                    const updatedDate = formatAcademicDate(calc.updatedAt || calc.createdAt);
                    
                    return `
                        <div class="calculation-item-row" data-calc-id="${calc.calculationId}" style="background:var(--background); border:1px solid var(--border); padding:12px 14px; border-radius:var(--r-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                            <div>
                                <h4 style="font-size:0.92rem; font-weight:700; color:var(--text-main, var(--text)); margin:0 0 4px 0;">${calc.resultNickname || 'Calculation'}</h4>
                                <div style="display:flex; gap:12px; font-size:0.8rem; color:var(--muted); flex-wrap:wrap;">
                                    <span>CGPA: <strong style="color:var(--primary); font-weight:700;">${cgpaStr}</strong></span>
                                    <span>Credits: <strong>${creditsStr}</strong></span>
                                    <span>Backlogs: <strong>${backlogsStr}</strong></span>
                                    <span>Updated: ${updatedDate}</span>
                                </div>
                            </div>
                            <div class="history-card-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
                                <button type="button" class="history-action-btn view-calc-btn" data-id="${calc.calculationId}">View</button>
                                <button type="button" class="history-action-btn edit-calc-btn" data-id="${calc.calculationId}" style="background-color:var(--primary); color:white; border-color:var(--primary);">Edit in Calculator</button>
                                <button type="button" class="history-action-btn report-calc-btn" data-id="${calc.calculationId}">Download PDF</button>
                                <button type="button" class="history-action-btn history-action-btn-danger delete-calc-btn" data-id="${calc.calculationId}">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Bind Profile Card Header buttons
        const editProfNameBtn = profCard.querySelector('.edit-prof-name-btn');
        if (editProfNameBtn) {
            editProfNameBtn.addEventListener('click', () => renameProfileRecord(prof.profileId, prof.studentName));
        }
        
        const deleteProfBtn = profCard.querySelector('.delete-prof-btn');
        if (deleteProfBtn) {
            deleteProfBtn.addEventListener('click', () => deleteProfileRecord(prof.profileId, prof.studentName));
        }

        const calcListEl = profCard.querySelector('.profile-calc-list');
        const toggleBtn = profCard.querySelector('.toggle-calc-list-btn');
        toggleBtn.addEventListener('click', () => {
            const isHidden = calcListEl.style.display === 'none';
            calcListEl.style.display = isHidden ? 'flex' : 'none';
            toggleBtn.textContent = isHidden ? 'View Results ▼' : 'Hide Results ▲';
        });

        // Bind Calculation item buttons
        prof.calculations.forEach(calc => {
            const rowEl = profCard.querySelector(`.calculation-item-row[data-calc-id="${calc.calculationId}"]`);
            if (!rowEl) return;

            rowEl.querySelector('.view-calc-btn').addEventListener('click', () => {
                openHistoryDetail({
                    ...calc,
                    nickname: calc.resultNickname,
                    studentName: prof.studentName
                });
            });

            rowEl.querySelector('.edit-calc-btn').addEventListener('click', () => {
                loadCalculationIntoCalculator(prof, calc);
            });

            rowEl.querySelector('.report-calc-btn').addEventListener('click', () => {
                downloadReportPDF({
                    ...calc,
                    nickname: `${prof.studentName} — ${calc.resultNickname}`
                });
            });

            rowEl.querySelector('.delete-calc-btn').addEventListener('click', () => {
                deleteCalculationRecord(prof.profileId, calc.calculationId);
            });
        });

        container.appendChild(profCard);
    });
}

// Load a specific calculation into the calculator workspace
function loadCalculationIntoCalculator(prof, calc) {
    const doLoad = () => {
        state.currentProfile = {
            profileId: prof.profileId === 'legacy_prof' ? null : prof.profileId,
            studentName: prof.studentName || '',
            program: prof.program || calc.program || 'mtech',
            department: prof.department || calc.department || 'cse'
        };

        state.currentCalculation = {
            calculationId: calc.calculationId,
            resultNickname: calc.resultNickname || 'Main Result',
            isDirty: false,
            mode: calc.mode || 'normal'
        };

        state.semesters = JSON.parse(JSON.stringify(calc.semesters || { sem1: [], sem2: [], sem3: [], sem4: [] }));
        state.selectedSemesters = calc.selectedSemesters || { sem1: false, sem2: false, sem3: false, sem4: false };

        if (dom.calcStudentName) dom.calcStudentName.value = state.currentProfile.studentName;
        if (dom.calcResultNickname) dom.calcResultNickname.value = state.currentCalculation.resultNickname;
        if (dom.calcProgramSelect) dom.calcProgramSelect.value = state.currentProfile.program;
        if (dom.calcDepartmentSelect) dom.calcDepartmentSelect.value = state.currentProfile.department;
        if (dom.currentProfileDisplayBadge) dom.currentProfileDisplayBadge.textContent = state.currentProfile.studentName;
        // Always unlock courses when loading a result for editing
        // so user can freely edit/delete any course row
        if (dom.calcLockStructure) dom.calcLockStructure.checked = false;
        state.currentCalculation.mode = 'advanced'; // unlocked

        calculateAndRefresh();
        render();

        const calcTab = document.getElementById('nav-calc-btn');
        if (calcTab) calcTab.click();

        showToast(`Loaded calculation "${calc.resultNickname}" under "${prof.studentName}" into calculator.`, 'info');
    };

    const hasDirty = Object.values(state.semesters).some(arr => arr.some(c => c.grade !== '')) && state.currentCalculation.isDirty;
    if (hasDirty) {
        showConfirmModal(
            `Load "${calc.resultNickname}" into calculator? Unsaved changes in active calculation will be discarded.`,
            doLoad
        );
    } else {
        doLoad();
    }
}


function loadHistoryIntoCalculator(record) {
    const doLoad = () => {
        // Load directly into flat current result state
        state.currentResult.resultId = record.id;
        state.currentResult.nickname = record.nickname || 'My M.Tech Result';
        state.currentResult.program = record.program || 'mtech';
        state.currentResult.department = record.department || 'cse';
        state.currentResult.isDirty = false;

        state.semesters = JSON.parse(JSON.stringify(record.semesters || { sem1: [], sem2: [], sem3: [], sem4: [] }));
        state.selectedSemesters = record.selectedSemesters || { sem1: false, sem2: false, sem3: false, sem4: false };

        if (dom.calcResultNickname) dom.calcResultNickname.value = state.currentResult.nickname;
        if (dom.calcProgramSelect) dom.calcProgramSelect.value = state.currentResult.program;
        if (dom.calcDepartmentSelect) dom.calcDepartmentSelect.value = state.currentResult.department;

        calculateAndRefresh();
        render();

        // Navigate to calculator tab
        const calcTab = document.getElementById('nav-calc-btn');
        if (calcTab) calcTab.click();

        showToast(`Editing: "${state.currentResult.nickname}" — click Save to History to update the record.`, 'info');
    };

    const hasDirty = Object.values(state.semesters).some(arr => arr.some(c => c.grade !== '')) && state.currentResult.isDirty;
    if (hasDirty) {
        showConfirmModal(
            `Load "${record.nickname || 'this record'}" into the calculator? Unsaved changes to the current result will be discarded.`,
            doLoad
        );
    } else {
        doLoad();
    }
}

function openHistoryDetail(record) {
    viewingHistoryRecord = record;
    
    dom.histDetailName.textContent = record.nickname || '—';
    dom.histDetailRoll.textContent = record.program ? (ACADEMIC_PROGRAMS[record.program]?.name || record.program) : 'M.Tech';
    dom.histDetailNickname.textContent = record.department ? (ACADEMIC_PROGRAMS.mtech?.departments[record.department]?.name || record.department) : 'CSE';
    
    const isOwn = record.recordType === 'own' || record.sourceType === 'own';
    dom.histDetailBadge.textContent = isOwn ? 'MY RESULT' : 'OTHER RESULT';
    dom.histDetailBadge.className = 'history-card-badge ' + (isOwn ? 'badge-own' : 'badge-viewed');
    
    const sum = record.summary || {};
    dom.histDetailCgpa.textContent = sum.overallCGPA !== undefined && sum.overallCGPA !== null ? sum.overallCGPA.toFixed(2) : '—';
    dom.histDetailPct.textContent = sum.percentage !== undefined && sum.percentage !== null ? `${sum.percentage.toFixed(1)}%` : '—';
    dom.histDetailCredits.textContent = sum.totalCredits !== undefined && sum.totalCredits !== null ? String(sum.totalCredits) : '—';
    dom.histDetailBacklogs.textContent = sum.activeBacklogs !== undefined && sum.activeBacklogs !== null ? String(sum.activeBacklogs) : '—';
    
    const wrapper = dom.histDetailSemestersWrapper;
    wrapper.innerHTML = '';
    
    const semesters = record.semesters || {};
    ['sem1', 'sem2', 'sem3', 'sem4'].forEach(semKey => {
        const courses = semesters[semKey] || [];
        if (courses.length === 0) return;
        
        const semTitle = semKey.toUpperCase().replace('SEM', 'Semester ');
        const semBlock = document.createElement('div');
        semBlock.innerHTML = `
            <h4 style="font-size:0.85rem; font-weight:700; margin-bottom:8px; border-bottom:1.5px solid var(--border); padding-bottom:4px; color:var(--text-main);">${semTitle}</h4>
            <div class="table-container">
                <table class="subjects-table" style="width:100%;">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Subject</th>
                            <th style="text-align:center; width:80px;">Credits</th>
                            <th style="text-align:center; width:80px;">Grade</th>
                            <th style="text-align:center; width:60px;">GP</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${courses.map(c => `
                            <tr>
                                <td>${c.code || '—'}</td>
                                <td>${c.subject || '—'}</td>
                                <td style="text-align:center;">${c.credits !== null ? c.credits : '—'}</td>
                                <td style="text-align:center;"><span class="badge ${c.grade === 'F' ? 'badge-f' : 'badge-aa'}">${c.grade || '—'}</span></td>
                                <td style="text-align:center;">${GRADE_POINT_MAPPING[c.grade] !== undefined ? GRADE_POINT_MAPPING[c.grade] : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        wrapper.appendChild(semBlock);
    });
    
    dom.histDetailVersionInfo.textContent = `Version ${record.version || 1} | Last Modified: ${formatAcademicDate(record.updatedAt || record.createdAt)}`;
    
    const savePublicBtn = document.getElementById('btn-hist-detail-save-public');
    if (savePublicBtn) savePublicBtn.remove();

    const loadCalcBtn = document.getElementById('btn-hist-detail-load-calc');
    if (loadCalcBtn) loadCalcBtn.remove();

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'btn btn-outline-primary btn-sm';
    loadBtn.id = 'btn-hist-detail-load-calc';
    loadBtn.textContent = 'Load into Calculator';
    loadBtn.addEventListener('click', () => {
        dom.historyDetailModal.style.display = 'none';
        loadHistoryIntoCalculator(record);
    });
    dom.btnHistDetailPdf.parentNode.insertBefore(loadBtn, dom.btnHistDetailCsv);
    
    if (record.isPublicLookup) {
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-outline-primary btn-sm';
        saveBtn.id = 'btn-hist-detail-save-public';
        saveBtn.textContent = 'Save to My History';
        saveBtn.addEventListener('click', () => {
            dom.historyDetailModal.style.display = 'none';
            // Store the public record so saveHistoryRecord can retrieve name/roll from it
            pendingSavePublicRecord = record;
            dom.saveHistoryNicknameInput.value = record.nickname || '';
            dom.saveHistorySourceType.value = 'viewed';
            dom.saveHistoryModal.style.display = 'flex';
        });
        dom.btnHistDetailPdf.parentNode.insertBefore(saveBtn, dom.btnHistDetailCsv);
    }
    
    dom.historyDetailModal.style.display = 'flex';
}

// Show editing panel for history records
function openHistoryEdit(record) {
    editingHistoryRecord = JSON.parse(JSON.stringify(record));
    
    dom.editHistNameInput.value = record.studentName || '';
    dom.editHistRollInput.value = record.studentId || '';
    dom.editHistNicknameInput.value = record.nickname || '';
    dom.editHistVersionDisplay.textContent = `Version ${record.version || 1}`;
    
    renderEditHistoryCourses(editingHistoryRecord.semesters);
    dom.historyEditModal.style.display = 'flex';
}

// Generate semesters course rows editor inside edit modal
function renderEditHistoryCourses(semesters) {
    const container = dom.editHistCoursesEditor;
    container.innerHTML = '';
    
    ['sem1', 'sem2', 'sem3', 'sem4'].forEach(semKey => {
        const courses = semesters[semKey] || [];
        const semTitle = semKey.toUpperCase().replace('SEM', 'Semester ');
        
        const semBlock = document.createElement('div');
        semBlock.style.marginBottom = '16px';
        semBlock.innerHTML = `
            <h4 style="font-size:0.85rem; font-weight:700; margin-bottom:8px; border-bottom:1.5px solid var(--primary); padding-bottom:4px; color:var(--primary);">${semTitle}</h4>
            <div class="table-container">
                <table class="subjects-table">
                    <thead>
                        <tr>
                            <th>Course</th>
                            <th>Subject</th>
                            <th style="width: 70px;">Credits</th>
                            <th style="width: 100px;">Grade</th>
                            <th style="width: 50px;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="edit-hist-tbody-${semKey}"></tbody>
                </table>
            </div>
            <button type="button" class="btn btn-outline-primary btn-sm" id="btn-edit-hist-add-${semKey}" style="margin-top:8px;">+ Add Course</button>
        `;
        container.appendChild(semBlock);
        
        const tbody = document.getElementById(`edit-hist-tbody-${semKey}`);
        
        function renderRows() {
            tbody.innerHTML = '';
            courses.forEach((course, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="text" class="input-code edit-c-code" data-idx="${idx}" placeholder="Code" value="${course.code || ''}"></td>
                    <td><input type="text" class="input-subject edit-c-subject" data-idx="${idx}" placeholder="Subject" value="${course.subject || ''}"></td>
                    <td><input type="number" step="any" class="input-credits edit-c-credits" data-idx="${idx}" placeholder="Cr" value="${course.credits === null ? '' : course.credits}"></td>
                    <td>
                        <select class="select-grade edit-c-grade" data-idx="${idx}" style="min-height:32px; padding:2px 4px;">
                            <option value="">Grade</option>
                            ${Object.keys(GRADE_POINT_MAPPING).map(g => `<option value="${g}" ${course.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
                        </select>
                    </td>
                    <td style="text-align:center;"><button type="button" class="btn-remove edit-c-remove" data-idx="${idx}">&times;</button></td>
                `;
                
                tr.querySelector('.edit-c-code').addEventListener('input', (e) => {
                    courses[idx].code = e.target.value;
                });
                tr.querySelector('.edit-c-subject').addEventListener('input', (e) => {
                    courses[idx].subject = e.target.value;
                });
                tr.querySelector('.edit-c-credits').addEventListener('input', (e) => {
                    courses[idx].credits = e.target.value === '' ? null : parseFloat(e.target.value);
                });
                tr.querySelector('.edit-c-grade').addEventListener('change', (e) => {
                    courses[idx].grade = e.target.value;
                });
                tr.querySelector('.edit-c-remove').addEventListener('click', () => {
                    courses.splice(idx, 1);
                    renderRows();
                });
                
                tbody.appendChild(tr);
            });
        }
        
        renderRows();
        
        document.getElementById(`btn-edit-hist-add-${semKey}`).addEventListener('click', () => {
            courses.push({
                id: 'course_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                code: '',
                subject: '',
                credits: null,
                grade: '',
                attemptType: 'original',
                source: 'manual'
            });
            renderRows();
        });
    });
}

// Download PDF Academic Performance Report
function downloadReportPDF(record) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const primaryColor = [158, 27, 27]; 
    const textColor = [33, 37, 41];
    const mutedColor = [108, 117, 125];
    
    // Header Bar
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("NITS Academic Insight", 14, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Academic Performance Report", 14, 25);
    doc.text(`Generated: ${formatAcademicDate(record.updatedAt || record.createdAt)}`, 14, 32);
    
    // Result Details Card
    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ACADEMIC RECORD INFORMATION", 14, 52);
    doc.line(14, 54, 196, 54);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Result Name: ${record.nickname || 'My M.Tech Result'}`, 14, 62);
    const progName = record.program ? (ACADEMIC_PROGRAMS[record.program]?.name || record.program) : 'M.Tech';
    const deptName = record.department ? (ACADEMIC_PROGRAMS.mtech?.departments[record.department]?.name || record.department) : 'Computer Science and Engineering';
    doc.text(`Program: ${progName}`, 14, 68);
    doc.text(`Department: ${deptName}`, 110, 62);
    
    // Determine active semesters with data to calculate cumulative CGPA
    const semesters = record.semesters || {};
    const semsWithData = Object.keys(semesters).filter(semKey => (semesters[semKey] || []).length > 0);
    let maxSemNum = 1;
    semsWithData.forEach(k => {
        const num = parseInt(k.replace('sem', ''));
        if (num > maxSemNum) maxSemNum = num;
    });

    const semsUpToMax = [];
    for (let k = 1; k <= maxSemNum; k++) {
        semsUpToMax.push('sem' + k);
    }

    // Temporary context swap to use the same calculation engine
    const originalSemesters = state.semesters;
    state.semesters = semesters;
    const cumulativeData = calculateCombined(semsUpToMax);
    state.semesters = originalSemesters;

    let cgpaText = '—';
    let pctText = '—';
    if (maxSemNum > 1 && cumulativeData.cgpa !== null) {
        cgpaText = cumulativeData.cgpa.toFixed(2);
        pctText = `${cumulativeData.percentage.toFixed(1)}%`;
    }

    // Summary Metrics Cards
    doc.setFillColor(248, 249, 250);
    doc.rect(14, 76, 182, 26, "F");
    doc.setDrawColor(222, 226, 230);
    doc.rect(14, 76, 182, 26, "S");
    
    doc.setFont("helvetica", "bold");
    doc.text("CGPA (Cumulative)", 24, 84);
    doc.setFont("helvetica", "normal");
    doc.text(cgpaText, 24, 92);
    
    doc.setFont("helvetica", "bold");
    doc.text("Percentage", 74, 84);
    doc.setFont("helvetica", "normal");
    doc.text(pctText, 74, 92);
    
    doc.setFont("helvetica", "bold");
    doc.text("Credits Earned", 124, 84);
    doc.setFont("helvetica", "normal");
    doc.text(cumulativeData.totalCredits !== undefined && cumulativeData.totalCredits !== null ? String(cumulativeData.totalCredits) : '—', 124, 92);
    
    doc.setFont("helvetica", "bold");
    doc.text("Active Backlogs", 164, 84);
    doc.setFont("helvetica", "normal");
    doc.text(cumulativeData.backlogs !== undefined && cumulativeData.backlogs !== null ? String(cumulativeData.backlogs) : '—', 164, 92);
    
    // Semester breakdowns
    let yPos = 114;
    
    ['sem1', 'sem2', 'sem3', 'sem4'].filter(semKey => (semesters[semKey] || []).length > 0).forEach((semKey) => {
        const courses = semesters[semKey] || [];
        if (courses.length === 0) return;
        
        if (yPos > 230) {
            doc.addPage();
            yPos = 20;
        }
        
        const semTitle = semKey.toUpperCase().replace('SEM', 'Semester ');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...primaryColor);
        doc.text(semTitle, 14, yPos);
        yPos += 4;
        
        // Draw Table Header
        doc.setFillColor(241, 243, 245);
        doc.rect(14, yPos, 182, 6, "F");
        doc.setFontSize(8);
        doc.setTextColor(...textColor);
        doc.setFont("helvetica", "bold");
        doc.text("Course Code", 16, yPos + 4);
        doc.text("Subject Name", 46, yPos + 4);
        doc.text("Credits", 136, yPos + 4);
        doc.text("Grade", 156, yPos + 4);
        doc.text("Grade Point", 176, yPos + 4);
        yPos += 7;
        
        doc.setFont("helvetica", "normal");
        courses.forEach(c => {
            const subj = c.subject || '—';
            const subjLines = doc.splitTextToSize(subj, 85);
            const rowHeight = Math.max(subjLines.length * 5, 6);

            if (yPos + rowHeight > 275) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.text(c.code || '—', 16, yPos + 4);
            subjLines.forEach((line, index) => {
                doc.text(line, 46, yPos + 4 + (index * 5));
            });
            doc.text(c.credits !== null ? String(c.credits) : '—', 136, yPos + 4);
            doc.text(c.grade || '—', 156, yPos + 4);
            
            const gp = GRADE_POINT_MAPPING[c.grade];
            doc.text(gp !== undefined ? String(gp) : '—', 176, yPos + 4);
            
            yPos += rowHeight;
        });

        // Semester Calculations Summary
        const semNum = parseInt(semKey.replace('sem', ''));
        const originalSem = state.semesters;
        state.semesters = semesters;
        const semCalc = calculateSemester(semKey);
        const semsUpToSem = [];
        for (let k = 1; k <= semNum; k++) {
            semsUpToSem.push('sem' + k);
        }
        const cumulativeCalc = calculateCombined(semsUpToSem);
        state.semesters = originalSem;

        yPos += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...textColor);
        let summaryLine = `Semester SGPA: ${semCalc.sgpa !== null ? semCalc.sgpa.toFixed(2) : '—'}  |  Semester Credits: ${semCalc.totalCredits}`;
        if (semNum > 1 && cumulativeCalc.cgpa !== null) {
            summaryLine += `  |  Cumulative CGPA: ${cumulativeCalc.cgpa.toFixed(2)}`;
        }
        doc.text(summaryLine, 14, yPos);
        yPos += 8;
    });
    
    // Page Footer Notes
    if (yPos > 260) {
        doc.addPage();
        yPos = 20;
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.line(14, yPos, 196, yPos);
    doc.text("Disclaimer: This report is generated by NITS Academic Insight and is intended for informational purposes only.", 14, yPos + 5);
    
    // Save report file with sanitized name
    const rawName = record.nickname || 'My-MTech-Result';
    const safeName = rawName.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    const filename = `${safeName}-Report.pdf`;
    doc.save(filename);
}

// Download CSV Academic Performance Report
function downloadReportCSV(record) {
    let csv = 'Semester,Course Code,Subject,Credits,Grade,Grade Point\r\n';
    
    const semesters = record.semesters || {};
    ['sem1', 'sem2', 'sem3', 'sem4'].forEach(semKey => {
        const courses = semesters[semKey] || [];
        const semTitle = semKey.toUpperCase().replace('SEM', 'Semester ');
        courses.forEach(c => {
            const gp = GRADE_POINT_MAPPING[c.grade] !== undefined ? GRADE_POINT_MAPPING[c.grade] : '—';
            csv += `"${semTitle}","${c.code || ''}","${c.subject || ''}",${c.credits || 0},"${c.grade || ''}",${gp}\r\n`;
        });
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `NITS-Academic-Report-${record.studentName || record.nickname || 'Student'}-${record.studentId || 'Report'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV report exported successfully.", "success");
}

function openHistoryReport(record) {
    downloadReportPDF(record);
    showToast("Report PDF generated successfully.", "success");
}

// ====================================================
// PART 26: PROFILE NICKNAMES & RESULT ANALYZER WORKBENCH
// (SINGLE SOURCE OF TRUTH — state.semesters)
// ====================================================

function initAnalyzerWorkbench() {
    bindAnalyzerEvents();
    renderAnalyzerWorkbench();
}

function loadProfilesFromStorage() {}
function createDefaultProfile() {}


function bindAnalyzerEvents() {
    const addProfileBtn = document.getElementById('btn-add-profile-modal');
    const closeProfileBtn = document.getElementById('close-profile-modal-btn');
    const cancelProfileBtn = document.getElementById('btn-cancel-profile-modal');
    const saveProfileBtn = document.getElementById('btn-save-profile-modal');
    const profileModal = document.getElementById('create-profile-modal');
    const profileSelect = document.getElementById('analyzer-profile-select');
    const semFilter = document.getElementById('analyzer-sem-filter');

    if (addProfileBtn && profileModal) {
        addProfileBtn.addEventListener('click', () => { profileModal.style.display = 'flex'; });
    }
    const hideProfileModal = () => { if (profileModal) profileModal.style.display = 'none'; };
    if (closeProfileBtn) closeProfileBtn.addEventListener('click', hideProfileModal);
    if (cancelProfileBtn) cancelProfileBtn.addEventListener('click', hideProfileModal);

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            const nickInput = document.getElementById('new-profile-nickname');
            const typeInput = document.getElementById('new-profile-type');
            const progInput = document.getElementById('new-profile-prog');
            const deptInput = document.getElementById('new-profile-dept');
            
            const nickname = (nickInput ? nickInput.value : '').trim();
            if (!nickname) {
                showToast("Please enter a result nickname.", "error");
                return;
            }
            
            const program = progInput?.value || 'mtech';
            const department = deptInput?.value || 'cse';
            const recordType = typeInput?.value || 'own';

            const newProf = {
                id: 'prof_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                nickname,
                recordType,
                program,
                department,
                isCustomStructure: false,
                semesters: { sem1: [], sem2: [], sem3: [], sem4: [] },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            state.profiles.push(newProf);
            state.activeProfileId = newProf.id;
            
            // Apply predefined courses for this new profile
            applyPredefinedCourses();
            newProf.semesters = JSON.parse(JSON.stringify(state.semesters));
            
            saveProfilesToStorage();
            
            const user = state.auth.user;
            if (user && state.auth.mode === 'firebase') {
                const db = getFirebaseDb();
                const authInst = getFirebaseAuth();
                if (db && authInst && authInst.currentUser && authInst.currentUser.uid === user.uid) {
                    setDoc(doc(db, 'users', user.uid, 'resultProfiles', newProf.id), {
                        profileId: newProf.id,
                        ownerUid: user.uid,
                        userId: user.uid,
                        studentName: newProf.nickname || 'Student',
                        program: newProf.program || 'mtech',
                        department: newProf.department || 'cse',
                        updatedAt: serverTimestamp()
                    }, { merge: true }).catch(err => console.warn('Firestore profile save failed:', err));
                }
            }
            
            populateAllProfileSelects();
            
            // Clear inputs
            if (nickInput) nickInput.value = '';

            loadUserDataFromStorage(user ? user.uid : 'default');
            hideProfileModal();
            showToast(`Result "${nickname}" created.`, "success");
        });
    }

    if (profileSelect) {
        profileSelect.addEventListener('change', (e) => {
            state.activeProfileId = e.target.value;
            const uid = state.auth.user ? state.auth.user.uid : 'default';
            loadUserDataFromStorage(uid);
            populateAllProfileSelects();
            showToast("Active result switched.", "info");
        });
    }

    if (semFilter) {
        semFilter.addEventListener('change', () => {
            renderAnalyzerWorkbench();
        });
    }

    const addCourseBtn = document.getElementById('analyzer-add-course-btn');
    if (addCourseBtn) {
        addCourseBtn.addEventListener('click', () => {
            const currentFilter = semFilter ? semFilter.value : 'all';
            const targetSem = currentFilter !== 'all' ? currentFilter : state.activeSemester;
            if (!state.semesters[targetSem]) state.semesters[targetSem] = [];

            state.semesters[targetSem].push({
                id: 'c_' + Date.now(),
                code: 'CS' + (5100 + state.semesters[targetSem].length + 1),
                subject: 'New Course',
                credits: 4,
                grade: 'A',
                status: 'passed',
                academicStatus: 'Regular'
            });
            calculateAndRefresh();
            saveUserDataToStorage();
            showToast(`Course added to ${targetSem.toUpperCase()}.`, "success");
        });
    }

    const btnVerify = document.getElementById('btn-verify-result');
    const btnImpact = document.getElementById('btn-calculate-impact');
    const btnSaveHist = document.getElementById('btn-analyzer-save-history');
    const btnExportPDF = document.getElementById('btn-analyzer-download-pdf');
    const btnExportCSV = document.getElementById('btn-analyzer-export-csv');

    if (btnVerify) btnVerify.addEventListener('click', verifyAnalyzerResult);
    if (btnImpact) btnImpact.addEventListener('click', calculateAnalyzerImpact);
    if (btnSaveHist) btnSaveHist.addEventListener('click', saveAnalyzerToHistory);
    if (btnExportPDF) btnExportPDF.addEventListener('click', exportAnalyzerPDF);
    if (btnExportCSV) btnExportCSV.addEventListener('click', exportAnalyzerCSV);
}

function renderAnalyzerWorkbench() {
    const tbody = document.getElementById('analyzer-courses-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const semFilter = document.getElementById('analyzer-sem-filter');
    const selectedSem = semFilter ? semFilter.value : 'all';

    let coursesToDisplay = [];

    if (selectedSem === 'all') {
        ['sem1', 'sem2', 'sem3', 'sem4'].forEach(semKey => {
            (state.semesters[semKey] || []).forEach(c => {
                coursesToDisplay.push({ ...c, _semKey: semKey });
            });
        });
    } else {
        (state.semesters[selectedSem] || []).forEach(c => {
            coursesToDisplay.push({ ...c, _semKey: selectedSem });
        });
    }

    let totalPoints = 0;
    let totalCredits = 0;
    let passedCount = 0;
    let failedCount = 0;

    coursesToDisplay.forEach((c) => {
        const tr = document.createElement('tr');
        const gp = GRADE_POINT_MAPPING[c.grade] !== undefined ? GRADE_POINT_MAPPING[c.grade] : 0;
        const status = c.status || 'passed';

        if (status === 'passed' || status === 'improvement' || status === 'repeated' || status === 'replaced') {
            if (c.grade !== 'F' && c.grade !== 'W' && c.grade !== 'EX') {
                totalPoints += (gp * Number(c.credits || 0));
                totalCredits += Number(c.credits || 0);
                passedCount++;
            } else {
                failedCount++;
            }
        } else if (status === 'failed' || status === 'backlog') {
            failedCount++;
            totalCredits += Number(c.credits || 0);
        }

        tr.innerHTML = `
            <td><input type="text" class="subject-code-input" value="${c.code || ''}" style="width:100px;" onchange="updateCentralCourse('${c.id}', '${c._semKey}', 'code', this.value)"></td>
            <td><input type="text" class="subject-name-input" value="${c.subject || ''}" style="width:100%;" onchange="updateCentralCourse('${c.id}', '${c._semKey}', 'subject', this.value)"></td>
            <td style="text-align:center;"><input type="number" class="subject-credits-input" value="${c.credits || 4}" min="1" max="12" style="width:50px; text-align:center;" onchange="updateCentralCourse('${c.id}', '${c._semKey}', 'credits', this.value)"></td>
            <td style="text-align:center;">
                <select class="select-grade" style="padding:2px 4px; font-size:0.8rem;" onchange="updateCentralCourse('${c.id}', '${c._semKey}', 'grade', this.value)">
                    ${Object.keys(GRADE_POINT_MAPPING).map(g => `<option value="${g}" ${g === c.grade ? 'selected' : ''}>${g}</option>`).join('')}
                </select>
            </td>
            <td style="text-align:center; font-weight:700;">${gp}</td>
            <td>
                <select class="select-type" style="padding:2px 4px; font-size:0.78rem;" onchange="updateCentralCourse('${c.id}', '${c._semKey}', 'status', this.value)">
                    <option value="passed" ${status === 'passed' ? 'selected' : ''}>Passed</option>
                    <option value="failed" ${status === 'failed' ? 'selected' : ''}>Failed</option>
                    <option value="backlog" ${status === 'backlog' ? 'selected' : ''}>Backlog</option>
                    <option value="improvement" ${status === 'improvement' ? 'selected' : ''}>Improvement</option>
                    <option value="repeated" ${status === 'repeated' ? 'selected' : ''}>Repeated</option>
                    <option value="replaced" ${status === 'replaced' ? 'selected' : ''}>Replaced</option>
                    <option value="withdrawn" ${status === 'withdrawn' ? 'selected' : ''}>Withdrawn</option>
                    <option value="excluded" ${status === 'excluded' ? 'selected' : ''}>Excluded</option>
                </select>
            </td>
            <td style="text-align:center;">
                <button type="button" class="btn-remove" onclick="deleteCentralCourse('${c.id}', '${c._semKey}')" title="Delete Course">&times;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const sgpaEl = document.getElementById('analyzer-calc-sgpa');
    const cgpaEl = document.getElementById('analyzer-calc-cgpa');
    const cgpaRow = document.getElementById('analyzer-calc-cgpa-row');
    const credEl = document.getElementById('analyzer-calc-credits');
    const passEl = document.getElementById('analyzer-calc-passed');
    const failEl = document.getElementById('analyzer-calc-failed');

    const sgpaLabel = sgpaEl?.previousElementSibling;

    if (selectedSem === 'all') {
        if (sgpaLabel) sgpaLabel.textContent = 'Calculated CGPA:';
        const overall = calculateCombined(['sem1', 'sem2', 'sem3', 'sem4']);
        if (sgpaEl) sgpaEl.textContent = overall.cgpa !== null ? overall.cgpa.toFixed(2) : '0.00';
        if (cgpaRow) cgpaRow.style.display = 'none';
    } else if (selectedSem === 'sem1') {
        if (sgpaLabel) sgpaLabel.textContent = 'Calculated SGPA:';
        const semData = calculateSemester('sem1');
        if (sgpaEl) sgpaEl.textContent = semData.sgpa !== null ? semData.sgpa.toFixed(2) : '0.00';
        if (cgpaRow) cgpaRow.style.display = 'none';
    } else {
        if (sgpaLabel) sgpaLabel.textContent = 'Calculated SGPA:';
        const semData = calculateSemester(selectedSem);
        if (sgpaEl) sgpaEl.textContent = semData.sgpa !== null ? semData.sgpa.toFixed(2) : '0.00';
        
        const semNum = parseInt(selectedSem.replace('sem', ''));
        const semsUpToSelected = [];
        for (let k = 1; k <= semNum; k++) {
            semsUpToSelected.push('sem' + k);
        }
        const cumulative = calculateCombined(semsUpToSelected);
        if (cgpaEl) cgpaEl.textContent = cumulative.cgpa !== null ? cumulative.cgpa.toFixed(2) : '0.00';
        if (cgpaRow) cgpaRow.style.display = 'flex';
    }

    if (credEl) credEl.textContent = totalCredits;
    if (passEl) passEl.textContent = passedCount;
    if (failEl) failEl.textContent = failedCount;
}

window.updateCentralCourse = function(id, semKey, field, val) {
    const semList = state.semesters[semKey];
    if (semList) {
        const course = semList.find(c => c.id === id);
        if (course) {
            if (field === 'credits') course[field] = parseFloat(val) || 0;
            else course[field] = val;
            calculateAndRefresh();
            saveUserDataToStorage();
        }
    }
};

window.deleteCentralCourse = function(id, semKey) {
    if (state.semesters[semKey]) {
        state.semesters[semKey] = state.semesters[semKey].filter(c => c.id !== id);
        calculateAndRefresh();
        saveUserDataToStorage();
    }
};

function calculateAnalyzerImpact() {
    let oldPoints = 0, newPoints = 0, totalCredits = 0, affectedCredits = 0;
    
    ['sem1', 'sem2', 'sem3', 'sem4'].forEach(semKey => {
        (state.semesters[semKey] || []).forEach(c => {
            const newGP = GRADE_POINT_MAPPING[c.grade] !== undefined ? GRADE_POINT_MAPPING[c.grade] : 0;
            const cr = Number(c.credits) || 0;
            totalCredits += cr;

            const status = c.status || 'passed';
            if (status === 'improvement' || status === 'replaced' || status === 'repeated') {
                const oldGP = c.prevGradePoint !== undefined ? c.prevGradePoint : Math.max(0, newGP - 2);
                oldPoints += (oldGP * cr);
                newPoints += (newGP * cr);
                affectedCredits += cr;
            } else {
                oldPoints += (newGP * cr);
                newPoints += (newGP * cr);
            }
        });
    });

    const oldSGPA = totalCredits > 0 ? (oldPoints / totalCredits).toFixed(2) : '0.00';
    const newSGPA = totalCredits > 0 ? (newPoints / totalCredits).toFixed(2) : '0.00';
    const delta = (parseFloat(newSGPA) - parseFloat(oldSGPA)).toFixed(2);

    const impactCard = document.getElementById('analyzer-impact-card');
    if (impactCard) impactCard.style.display = 'block';

    const oldEl = document.getElementById('impact-old-sgpa');
    const newEl = document.getElementById('impact-new-sgpa');
    const deltaEl = document.getElementById('impact-delta-sgpa');
    const affEl = document.getElementById('impact-credits-count');

    if (oldEl) oldEl.textContent = oldSGPA;
    if (newEl) newEl.textContent = newSGPA;
    if (deltaEl) {
        deltaEl.textContent = (delta >= 0 ? '+' : '') + delta;
        deltaEl.style.color = delta >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    if (affEl) affEl.textContent = affectedCredits;

    showToast(`Grade Impact Calculated: Net Change ${delta >= 0 ? '+' : ''}${delta} SGPA`, "info");
}

function verifyAnalyzerResult() {
    const officialInput = document.getElementById('analyzer-official-sgpa-input');
    const badge = document.getElementById('analyzer-verification-badge');
    
    if (!officialInput || !officialInput.value) {
        showToast("Please enter the official/reported SGPA to perform verification.", "warning");
        return;
    }

    const officialVal = parseFloat(officialInput.value);
    const sgpaEl = document.getElementById('analyzer-calc-sgpa');
    const calcVal = parseFloat(sgpaEl ? sgpaEl.textContent : '0');

    const diff = Math.abs(officialVal - calcVal).toFixed(2);

    if (diff < 0.05) {
        badge.className = 'verification-card-success';
        badge.style.display = 'block';
        badge.innerHTML = `✓ Result Verified &mdash; Matches Calculated SGPA (${calcVal})`;
        showToast("Result verified cleanly. No mismatch detected.", "success");
    } else {
        badge.className = 'verification-card-warning';
        badge.style.display = 'block';
        badge.innerHTML = `⚠ Result Mismatch &mdash; Expected: ${calcVal}, Entered: ${officialVal} (Diff: ${diff})`;
        showToast(`Result Mismatch detected: Difference of ${diff} SGPA`, "error");
    }
}

function saveAnalyzerToHistory() {
    const activeProf = state.profiles.find(p => p.id === state.activeProfileId) || { nickname: 'My M.Tech Result', studentName: 'Subham Kumar', rollNumber: '2314056' };
    const sgpaEl = document.getElementById('analyzer-calc-sgpa');
    const credEl = document.getElementById('analyzer-calc-credits');
    const failEl = document.getElementById('analyzer-calc-failed');

    const historyRecord = {
        id: 'hist_' + Date.now(),
        profileId: activeProf.id,
        nickname: activeProf.nickname,
        studentName: activeProf.studentName || 'Subham Kumar',
        studentId: activeProf.rollNumber || '2314056',
        semester: 'Cumulative',
        savedAt: new Date().toISOString(),
        summary: {
            overallSGPA: sgpaEl ? parseFloat(sgpaEl.textContent) : 0,
            overallCGPA: sgpaEl ? parseFloat(sgpaEl.textContent) : 0,
            totalCredits: credEl ? parseInt(credEl.textContent) : 0,
            activeBacklogs: failEl ? parseInt(failEl.textContent) : 0
        },
        semesters: JSON.parse(JSON.stringify(state.semesters)),
        version: 1
    };

    saveHistoryRecordToDb(historyRecord);
}

function exportAnalyzerPDF() {
    const activeProf = state.profiles.find(p => p.id === state.activeProfileId) || { nickname: 'My M.Tech Result', studentName: 'Subham Kumar', rollNumber: '2314056' };
    const sgpaEl = document.getElementById('analyzer-calc-sgpa');
    const credEl = document.getElementById('analyzer-calc-credits');
    const failEl = document.getElementById('analyzer-calc-failed');

    const record = {
        nickname: activeProf.nickname,
        studentName: activeProf.studentName,
        studentId: activeProf.rollNumber,
        savedAt: new Date().toISOString(),
        summary: {
            overallSGPA: sgpaEl ? parseFloat(sgpaEl.textContent) : 0,
            overallCGPA: sgpaEl ? parseFloat(sgpaEl.textContent) : 0,
            totalCredits: credEl ? parseInt(credEl.textContent) : 0,
            activeBacklogs: failEl ? parseInt(failEl.textContent) : 0
        },
        semesters: state.semesters
    };
    downloadReportPDF(record);
}

function exportAnalyzerCSV() {
    const activeProf = state.profiles.find(p => p.id === state.activeProfileId) || { nickname: 'My M.Tech Result', studentName: 'Subham Kumar', rollNumber: '2314056' };
    const record = {
        nickname: activeProf.nickname,
        studentName: activeProf.studentName,
        studentId: activeProf.rollNumber,
        semesters: state.semesters
    };
    downloadReportCSV(record);
}

// Auto-initialize workbench on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalyzerWorkbench);
} else {
    initAnalyzerWorkbench();
}

